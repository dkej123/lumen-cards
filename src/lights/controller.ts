import { html, nothing, type ReactiveController, type TemplateResult } from "lit";
import type { ActionConfig } from "../core/actions";
import { handleAction } from "../core/actions";
import type { LumenBaseCard } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { glass, prevent, stop } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { HUE_PRESETS, brightnessPct, ctPresets, isDimmable, kelvinRange, lightPower, supportsColor, supportsColorTemp } from "../logic/light";
import { warm } from "../weather/fx";

// Lights of the design (light(), lightHandlers(), tile(), pill(), ctOverlay(),
// slider(), the light sheet and the brightness HUD) as a controller any card can own.
// Markup and inline styles are unchanged; `l.col` can be overridden by the card's glow colour.

export interface LightItem {
  entity: string;
  name?: string;
  icon?: string;
  /** Wall relay feeding the bulb; the bulb is `unavailable` while it is off. Both act as one tile. */
  power_entity?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Brightness / state line (default true). */
  show_state?: boolean;
  /** Colour-temperature swatch on the tile (default true). */
  show_color_button?: boolean;
}

interface LightOverride { on?: boolean; b?: number; k?: number }
interface Pending { from?: HassEntity; until: number }
interface Drag {
  entity: string; item: LightItem; el: HTMLElement;
  hudY: number | null; x0: number; y0: number; w: number; b0: number;
  moved: boolean; dragging: boolean; held: boolean; lx: number; lt: number; v: number; cur?: number;
}

const PENDING_MS = 10_000;
const HUD_H = 40;
const HUD_GAP = 12;
const HUD_MIN_TOP = 8;
/** HA toolbar height above the dashboard (the design measured from its own frame). */
const TOP = 56;
const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;
const onSwatch = (e: Event) => !!(e.target as Element | null)?.closest?.("[data-ct]");

export const lightName = (item: LightItem, e?: HassEntity) => item.name || e?.attributes.friendly_name || item.entity;
export const lightIcon = (item: LightItem, e?: HassEntity) => item.icon || e?.attributes.icon || "mdi:lightbulb";

export class LightsController implements ReactiveController {
  private overrides = new Map<string, LightOverride>();
  private pending = new Map<string, Pending>();
  private drag: Drag | null = null;
  private holdTimer?: number;
  private ctTimer?: number;
  private closeTimer?: number;
  private lastTap?: { entity: string; t: number };
  private dragEnd = 0;
  private sliding: "b" | "k" | null = null;
  private slideRect?: DOMRect;
  private grabY: number | null = null;
  private sheetDy = 0;
  private sheetOpenedAt = 0;
  private interval?: number;
  ctOpen: string | null = null;
  private sheet: { item: LightItem; closing: boolean } | null = null;
  now = Date.now();

  constructor(private host: LumenBaseCard & { lightItems(): LightItem[] }) {
    host.addController(this);
    new LayerController(host, () => this.layer(), () => this.closeSheet());
  }

  private get hass() {
    return this.host.hass;
  }

  private entity(id?: string) {
    return id ? this.hass?.states[id] : undefined;
  }

  hostConnected(): void {
    this.interval = window.setInterval(() => {
      this.now = Date.now();
      this.expirePending();
    }, 1000);
  }

  hostDisconnected(): void {
    window.clearInterval(this.interval);
    window.clearTimeout(this.holdTimer);
    window.clearTimeout(this.ctTimer);
    window.clearTimeout(this.closeTimer);
    if (this.lastTap) window.clearTimeout(this.lastTap.t);
    this.lastTap = undefined;
    this.drag = null;
    this.sheet = null;
    this.ctOpen = null;
  }

  /** Confirmed commands: any new state object for a pending entity. */
  hostUpdate(): void {
    for (const [id, p] of this.pending) {
      if (this.entity(id) !== p.from) {
        this.pending.delete(id);
        if (!this.drag?.dragging || this.drag.entity !== id) this.overrides.delete(id);
      }
    }
  }

  private requestUpdate() {
    this.host.requestUpdate();
  }

  private setPending(id: string) {
    this.pending.set(id, { from: this.entity(id), until: Date.now() + PENDING_MS });
    this.requestUpdate();
  }

  private expirePending() {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.pending) {
      if (p.until < now) {
        this.pending.delete(id);
        this.overrides.delete(id);
        changed = true;
      }
    }
    if (changed) this.requestUpdate();
  }

  private call(domain: string, service: string, data: Record<string, unknown>, entity?: string) {
    return this.hass
      ?.callService(domain, service, data, entity ? { entity_id: entity } : undefined)
      .catch((err: Error) => {
        if (entity) {
          this.pending.delete(entity);
          this.overrides.delete(entity);
        }
        toast(this.host, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: err.message ?? String(err) });
      });
  }

  private haptic(type = "light") {
    this.host.dispatchEvent(new CustomEvent("haptic", { detail: type, bubbles: true, composed: true }));
  }

  private moreInfo(entityId: string) {
    this.host.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------- state

  light(item: LightItem) {
    const e = this.entity(item.entity);
    const ov = this.overrides.get(item.entity);
    const p = lightPower(e, item.power_entity ? this.entity(item.power_entity) : undefined, !!item.power_entity, this.now);
    const una = p.unavailable;
    const reachable = !una && !p.booting && !isUnavailable(e);
    const dim = reachable && isDimmable(e);
    const ct = reachable && supportsColorTemp(e);
    const color = reachable && supportsColor(e);
    const on = !una && (ov?.on ?? p.on);
    const b = ov?.b ?? (brightnessPct(e) || 100);
    const [kMin, kMax] = kelvinRange(e);
    const k = Math.round(ov?.k ?? e?.attributes.color_temp_kelvin ?? Math.min(kMax, Math.max(kMin, 2700)));
    const pending = this.pending.has(item.entity) || (p.booting && ov?.on !== false);
    // Glow: the card's colour (glow_color / theme) wins over the light's own colour or warm white.
    const rgb: unknown = e?.attributes.rgb_color;
    const own = color && e?.attributes.color_mode !== "color_temp" && Array.isArray(rgb) ? `rgb(${rgb.join(",")})` : warm(ct ? k : 2700);
    const col = this.host.glowColor(own);
    return { e, una, dim, ct, color, on, b: dim ? b : 100, k, kMin, kMax, col, pending, powerOn: p.powerOn, booting: p.booting };
  }

  /** Tap: the configured action, else toggle (bulb, or its relay when that is what is off). */
  private tap(item: LightItem) {
    const a = item.tap_action;
    if (a && a.action !== "toggle") {
      this.haptic();
      handleAction(this.host, a, item.entity, "tap");
      return;
    }
    this.toggleLight(item);
  }

  /** Tap with double-tap support: waits 250 ms for a second tap only when a double tap is configured. */
  private tapOrDouble(item: LightItem) {
    if (!item.double_tap_action) {
      this.tap(item);
      return;
    }
    const prev = this.lastTap;
    if (prev?.entity === item.entity) {
      window.clearTimeout(prev.t);
      this.lastTap = undefined;
      this.haptic();
      handleAction(this.host, item.double_tap_action, item.entity, "double_tap");
      return;
    }
    if (prev) window.clearTimeout(prev.t);
    this.lastTap = {
      entity: item.entity,
      t: window.setTimeout(() => {
        this.lastTap = undefined;
        this.tap(item);
      }, 250),
    };
  }

  toggleLight(item: LightItem) {
    const l = this.light(item);
    if (l.una) return;
    this.haptic();
    this.overrides.set(item.entity, { ...this.overrides.get(item.entity), on: !l.on });
    this.setPending(item.entity);
    if (item.power_entity && (l.on || !l.powerOn)) {
      this.call("homeassistant", l.on ? "turn_off" : "turn_on", {}, item.power_entity);
      return;
    }
    this.call("light", l.on ? "turn_off" : "turn_on", {}, item.entity);
  }

  private setBrightness(item: LightItem, pct: number) {
    this.overrides.set(item.entity, pct < 1 ? { on: false } : { on: true, b: pct });
    this.setPending(item.entity);
    this.call("light", pct < 1 ? "turn_off" : "turn_on", pct < 1 ? {} : { brightness_pct: pct }, item.entity);
  }

  private setHue(entity: string, hs: [number, number]) {
    this.overrides.set(entity, { ...this.overrides.get(entity), on: true });
    this.setPending(entity);
    this.call("light", "turn_on", { hs_color: hs }, entity);
  }

  private hold(item: LightItem) {
    if (item.hold_action) handleAction(this.host, item.hold_action, item.entity, "hold");
    else if (this.light(item).dim && !this.light(item).una && !this.host.preview) this.openSheet(item);
    else this.moreInfo(item.entity);
  }

  private setKelvin(entity: string, k: number) {
    this.overrides.set(entity, { ...this.overrides.get(entity), on: true, k });
    this.setPending(entity);
    this.call("light", "turn_on", { color_temp_kelvin: k }, entity);
  }

  /** Tap = toggle, horizontal drag > 8 px = brightness with inertia, hold 500 ms = sheet / more-info. */
  handlers(item: LightItem) {
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const l = this.light(item);
      const onCt = onSwatch(e);
      const rect = el.getBoundingClientRect();
      this.drag = {
        entity: item.entity, item, el, hudY: this.hudY(rect.top), x0: e.clientX, y0: e.clientY, w: rect.width,
        b0: l.on ? l.b : 0, moved: false, dragging: false, held: false, lx: e.clientX, lt: performance.now(), v: 0,
      };
      window.clearTimeout(this.holdTimer);
      this.holdTimer = window.setTimeout(() => {
        const d = this.drag;
        if (!d || d.entity !== item.entity || d.moved || onCt) return;
        d.held = true;
        this.drag = null;
        this.haptic("medium");
        this.hold(item);
      }, 500);
    };
    const move = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.entity !== item.entity) return;
      const dx = e.clientX - d.x0;
      const dy = e.clientY - d.y0;
      if (!d.dragging) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          window.clearTimeout(this.holdTimer);
          this.drag = null;
          return;
        }
        if (Math.abs(dx) <= 8) return;
        d.moved = true;
        window.clearTimeout(this.holdTimer);
        const l = this.light(item);
        if (!l.dim || l.una) return;
        d.dragging = true;
        try {
          d.el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const now = performance.now();
      d.v = d.v * 0.6 + ((e.clientX - d.lx) / Math.max(1, now - d.lt)) * 0.4;
      d.lx = e.clientX;
      d.lt = now;
      const b = Math.round(Math.max(0, Math.min(100, d.b0 + (dx / d.w) * 100)));
      d.cur = b;
      this.overrides.set(item.entity, b < 1 ? { on: false } : { ...this.overrides.get(item.entity), on: true, b });
      this.requestUpdate();
    };
    const up = (e: PointerEvent) => {
      const d = this.drag;
      window.clearTimeout(this.holdTimer);
      if (!d || d.entity !== item.entity) return;
      this.drag = null;
      if (d.moved) this.dragEnd = performance.now();
      if (d.dragging) {
        const extra = ((d.v * 140) / d.w) * 100;
        const b = Math.round(Math.max(0, Math.min(100, (d.cur ?? d.b0) + extra)));
        this.haptic();
        this.setBrightness(item, b);
      } else if (!d.moved && !d.held && !onSwatch(e)) this.tapOrDouble(item);
      this.requestUpdate();
    };
    const cancel = () => {
      window.clearTimeout(this.holdTimer);
      if (this.drag?.entity === item.entity && this.drag.dragging && !this.pending.has(item.entity)) this.overrides.delete(item.entity);
      this.drag = null;
      this.requestUpdate();
    };
    // Keyboard: Enter / Space = tap, Shift+Enter or the menu key = hold (sheet), arrows = ±10 % brightness.
    const key = (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "ContextMenu" || (e.key === "Enter" && e.shiftKey)) {
        e.preventDefault();
        this.hold(item);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.tap(item);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const l = this.light(item);
        if (!l.dim || l.una) return;
        e.preventDefault();
        const b = Math.max(0, Math.min(100, (l.on ? l.b : 0) + (e.key === "ArrowRight" ? 10 : -10)));
        this.setBrightness(item, b);
      }
    };
    return { down, move, up, cancel, key };
  }

  openCt(entity: string) {
    if (performance.now() - this.dragEnd < 350) return;
    this.haptic();
    this.ctOpen = this.ctOpen === entity ? null : entity;
    this.ctAutoClose(5000);
    this.requestUpdate();
  }

  private ctAutoClose(ms: number) {
    window.clearTimeout(this.ctTimer);
    this.ctTimer = window.setTimeout(() => {
      this.ctOpen = null;
      this.requestUpdate();
    }, ms);
  }

  // ---------------------------------------------------------------- templates

  private swatch(item: LightItem, col: string, size: number, style: string) {
    return html`<button data-ct title=${t("card.light.ct_title")} aria-label=${t("card.light.ct_change")} class="ct" @click=${(e: Event) => {
      e.stopPropagation();
      this.openCt(item.entity);
    }} style=${style}>
      <span style="width:${size}px;height:${size}px;border-radius:50%;background:${col};box-shadow:0 0 0 2px var(--lumen-surface-solid), 0 0 0 3px var(--lumen-border-strong);transition:background-color 500ms"></span>
    </button>`;
  }

  /** Large tile (design `tile`). */
  tile(item: LightItem, i: number, minH: number, mobile: boolean): TemplateResult {
    const l = this.light(item);
    const h = this.handlers(item);
    const dragging = this.drag?.entity === item.entity && this.drag.dragging;
    const value = l.una ? t("card.light.unavailable") : l.booting ? t("card.light.booting") : l.on ? (l.dim ? `${l.b}%` : t("card.light.on")) : t("card.light.off");
    const meta = l.on && l.ct ? `${l.k} K` : "";
    const fillW = l.on ? `${l.dim ? l.b : 100}%` : "0%";
    const ctOpen = l.on && l.ct && this.ctOpen === item.entity;
    const border = l.una ? "1.5px dashed var(--lumen-border-strong)" : l.on ? `1px solid color-mix(in srgb, ${l.col} 45%, transparent)` : "1px solid var(--lumen-border)";
    const shadow = l.on ? `0 18px 44px -18px color-mix(in srgb, ${l.col} ${Math.round(35 + l.b * 0.5)}%, transparent), var(--lumen-shadow-1)` : "var(--lumen-shadow-1)";
    const iconSize = mobile ? 30 : 34;
    return html`<div data-fx role="button" tabindex="0" aria-pressed=${l.on} aria-disabled=${l.una} aria-label="${lightName(item, l.e)} · ${value}" aria-keyshortcuts="Shift+Enter ArrowLeft ArrowRight"
      @pointerdown=${h.down} @pointermove=${h.move} @pointerup=${h.up} @pointercancel=${h.cancel} @keydown=${h.key} @contextmenu=${prevent}
      class="press tile" style="position:relative;isolation:isolate;height:${minH}px;padding:${mobile ? "6px 6px 6px 8px" : "11px 12px"};box-sizing:border-box;border-radius:${mobile ? 18 : 20}px;background:var(--lumen-surface);${glass};border:${border};box-shadow:${shadow};opacity:${l.una ? 0.6 : 1};touch-action:pan-y;user-select:none;cursor:${l.una ? "not-allowed" : "pointer"};display:flex;flex-direction:row;align-items:center;gap:${mobile ? 8 : 10}px;outline:none;transition:box-shadow 700ms var(--lumen-ease-out), border-color 400ms, transform 240ms var(--lumen-ease-spring), opacity 300ms;animation:lumenRise 640ms var(--lumen-ease-spring) both;animation-delay:${i * 40}ms">${WFX}
      ${ctOpen ? this.ctOverlay(item.entity, l.k, mobile, false, l.e) : nothing}
      <div style="position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none">
      <div style="position:absolute;inset:0 auto 0 0;width:${fillW};background:linear-gradient(90deg, color-mix(in srgb, ${l.col} var(--lumen-fill-a), transparent), color-mix(in srgb, ${l.col} var(--lumen-fill-b), transparent));transition:${dragging ? "width 60ms linear" : "width 620ms var(--lumen-ease-spring)"};mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);-webkit-mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);pointer-events:none"></div>
      <div style="position:absolute;top:-70%;right:-35%;width:120%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${l.col} 55%, transparent) 0%, transparent 62%);opacity:${l.on ? (0.25 + (l.b / 100) * 0.75).toFixed(2) : 0};transition:opacity 800ms var(--lumen-ease-out);pointer-events:none"></div>
      </div>
      <div style="position:relative;flex:none;order:-2;width:${iconSize}px;height:${iconSize}px;border-radius:${mobile ? 10 : 12}px;display:grid;place-items:center;font-size:${mobile ? 17 : 19}px;background:${l.on ? l.col : "var(--lumen-surface-2)"};color:${l.on ? "#3B2709" : "var(--lumen-text-2)"};box-shadow:${l.on ? `0 0 18px color-mix(in srgb, ${l.col} 70%, transparent)` : "none"};transition:background-color 500ms, color 500ms, box-shadow 700ms">${icon(lightIcon(item, l.e))}</div>
      ${l.una ? icon("mdi:power-plug-off-outline", "font-size:18px;color:var(--lumen-text-3)") : nothing}
      ${l.on && l.ct && item.show_color_button !== false
        ? this.swatch(item, l.col, mobile ? 20 : 22, `position:relative;width:${mobile ? 30 : 40}px;height:44px;margin:${mobile ? "0 -4px 0 -2px" : "0 -6px 0 0"};padding:0;border-radius:12px;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;touch-action:pan-y`)
        : nothing}
      <div style="position:relative;flex:1;order:-1;${mobile ? "" : "display:flex;flex-direction:column;gap:1px;"}min-width:0">
        <div style="font-size:${mobile ? 12 : 14}px;font-weight:700;${mobile ? "line-height:14px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere" : "letter-spacing:-0.01em;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"}">${lightName(item, l.e)}</div>
        ${item.show_state === false
          ? nothing
          : mobile
          ? html`<div style="display:flex;gap:6px;font-size:11px;line-height:14px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden"><span style="overflow:hidden;text-overflow:ellipsis">${value}</span><span style="color:var(--lumen-text-3);flex:none">${meta}</span></div>`
          : html`<div style="display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden"><span style="overflow:hidden;text-overflow:ellipsis">${value}</span><span style="color:var(--lumen-text-3);font-weight:600;flex:none">${meta}</span></div>`}
      </div>
    </div>`;
  }

  /** Colour picker over the whole tile: 4 presets, a pick closes it after 280 ms. */
  ctOverlay(entity: string, k: number, mobile: boolean, pills = false, e?: HassEntity) {
    return html`<div class="ctov" role="radiogroup" aria-label=${t("card.light.ct")} @pointerdown=${stop} @pointerup=${stop} @click=${stop} style="position:absolute;inset:0;z-index:5;border-radius:${pills ? 14 : mobile ? 18 : 16}px;background:var(--lumen-surface-solid);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-1);display:flex;align-items:center;justify-content:space-around;padding:0 6px;box-sizing:border-box;animation:lumenFadeIn 180ms both">
      ${ctPresets(e ?? this.entity(entity)).map(([preset, name]) => {
        const on = Math.abs(k - preset) < 60;
        const label = `${t(name)} · ${preset} K`;
        return html`<button class="ct" role="radio" aria-checked=${on} aria-label=${label} title=${label} @click=${() => {
          this.haptic();
          this.setKelvin(entity, preset);
          this.ctAutoClose(280);
        }} style="width:${pills ? "auto;flex:1;max-width:40px" : `${mobile ? 36 : 40}px`};height:44px;padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:pointer">
          <span style="width:${mobile ? 26 : 28}px;height:${mobile ? 26 : 28}px;border-radius:50%;display:grid;place-items:center;background:${warm(preset)};box-shadow:${on ? "0 0 0 2px var(--lumen-surface-solid), 0 0 0 4px var(--lumen-text-1)" : "inset 0 0 0 1px rgba(0,0,0,.12)"};color:#3A2A1A;font-size:${mobile ? 15 : 16}px;transition:box-shadow 250ms">${on ? icon("mdi:check") : nothing}</span></button>`;
      })}
    </div>`;
  }

  /** Compact pill (design `pill`, rooms). */
  pill(item: LightItem, mobile = false) {
    const l = this.light(item);
    const h = this.handlers(item);
    return html`<div data-fx role="button" tabindex="0" aria-pressed=${l.on} @pointerdown=${h.down} @pointermove=${h.move} @pointerup=${h.up} @pointercancel=${h.cancel} @keydown=${h.key} @contextmenu=${prevent}
      class="press" style="display:flex;align-items:center;gap:${mobile ? "6px;max-width:100%;min-width:0;padding:0 10px 0 6px" : "7px;padding:0 12px 0 7px"};min-height:44px;box-sizing:border-box;border-radius:14px;background:${l.on ? `color-mix(in srgb, ${l.col} var(--lumen-fill-a), var(--lumen-surface))` : "var(--lumen-surface-2)"};border:${l.una ? "1.5px dashed var(--lumen-border-strong)" : l.on ? `1px solid color-mix(in srgb, ${l.col} 45%, transparent)` : "1px solid var(--lumen-border)"};opacity:${l.una ? 0.6 : 1};box-shadow:${l.on ? `0 18px 44px -18px color-mix(in srgb, ${l.col} ${Math.round(35 + l.b * 0.5)}%, transparent), var(--lumen-shadow-1)` : "var(--lumen-shadow-1)"};touch-action:pan-y;user-select:none;cursor:${l.una ? "not-allowed" : "pointer"};transition:background-color 500ms, box-shadow 600ms, transform 220ms var(--lumen-ease-spring)">${WFX}
      <span style="flex:none;width:${mobile ? 30 : 32}px;height:${mobile ? 30 : 32}px;border-radius:${mobile ? 10 : 11}px;display:grid;place-items:center;font-size:18px;background:${l.on ? l.col : "var(--lumen-surface-2)"};color:${l.on ? "#3B2709" : "var(--lumen-text-2)"};transition:background-color 500ms, color 500ms">${icon(lightIcon(item, l.e))}</span>
      <span style="min-width:0;font-size:${mobile ? 12 : 13}px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lightName(item, l.e)}</span>
      ${l.on && l.ct
        ? this.swatch(item, l.col, 18, `flex:none;width:30px;height:44px;margin:0 ${mobile ? -6 : -8}px 0 -4px;padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;touch-action:pan-y`)
        : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- sheet + HUD (body layer)

  private openSheet(item: LightItem) {
    this.haptic();
    this.sheetOpenedAt = performance.now();
    this.sheet = { item, closing: false };
    this.sheetDy = 0;
    this.requestUpdate();
  }

  private scrimClose = () => {
    if (performance.now() - this.sheetOpenedAt > 400) this.closeSheet();
  };

  private closeSheet = () => {
    if (!this.sheet || this.sheet.closing) return;
    this.sheet = { ...this.sheet, closing: true };
    this.requestUpdate();
    this.closeTimer = window.setTimeout(() => {
      this.sheet = null;
      this.sheetDy = 0;
      this.requestUpdate();
    }, 250);
  };

  private slider(kind: "b" | "k", item: LightItem) {
    const set = (e: PointerEvent) => {
      const r = this.slideRect!;
      const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      if (kind === "b") {
        const b = Math.round(p * 100);
        this.overrides.set(item.entity, b < 1 ? { on: false } : { ...this.overrides.get(item.entity), on: true, b });
      } else {
        const [lo, hi] = kelvinRange(this.entity(item.entity));
        this.overrides.set(item.entity, { ...this.overrides.get(item.entity), on: true, k: Math.round((lo + p * (hi - lo)) / 50) * 50 });
      }
      this.requestUpdate();
    };
    /** Arrow keys / Home / End on the focused slider. */
    const key = (e: KeyboardEvent) => {
      const l = this.light(item);
      const step = kind === "b" ? 5 : 100;
      const cur = kind === "b" ? (l.on ? l.b : 0) : l.k;
      const [lo, hi] = kind === "b" ? [0, 100] : [l.kMin, l.kMax];
      const next =
        e.key === "ArrowRight" || e.key === "ArrowUp" ? cur + step
        : e.key === "ArrowLeft" || e.key === "ArrowDown" ? cur - step
        : e.key === "PageUp" ? cur + step * 4
        : e.key === "PageDown" ? cur - step * 4
        : e.key === "Home" ? lo
        : e.key === "End" ? hi
        : null;
      if (next === null) return;
      e.preventDefault();
      const v = Math.max(lo, Math.min(hi, next));
      if (kind === "b") this.setBrightness(item, v);
      else this.setKelvin(item.entity, Math.round(v / 50) * 50);
    };
    return {
      key,
      down: (e: PointerEvent) => {
        this.slideRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.sliding = kind;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        set(e);
      },
      move: (e: PointerEvent) => {
        if (this.sliding === kind) set(e);
      },
      up: () => {
        if (this.sliding !== kind) return;
        this.sliding = null;
        this.haptic();
        const ov = this.overrides.get(item.entity) ?? {};
        if (kind === "b") this.setBrightness(item, ov.on === false ? 0 : (ov.b ?? 100));
        else if (ov.k) this.setKelvin(item.entity, ov.k);
        this.requestUpdate();
      },
    };
  }

  private grab = {
    down: (e: PointerEvent) => {
      if (!this.sheet || !this.host.narrowScreen || (e.target as HTMLElement).closest("button")) return;
      this.grabY = e.clientY;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e: PointerEvent) => {
      if (this.grabY === null) return;
      this.sheetDy = Math.max(0, e.clientY - this.grabY);
      this.requestUpdate();
    },
    up: () => {
      if (this.grabY === null) return;
      this.grabY = null;
      if (this.sheetDy > 110) this.closeSheet();
      else this.sheetDy = 0;
      this.requestUpdate();
    },
  };

  /** HUD top (viewport px): the design spot below the toolbar, or above the element; null if no room. */
  private hudY(elTop: number): number | null {
    const y = Math.min(TOP + (this.host.narrowScreen ? 64 : 24), elTop - HUD_GAP - HUD_H);
    return y < HUD_MIN_TOP ? null : y;
  }

  private layer() {
    const hud = this.hud();
    const sheet = this.renderSheet();
    return hud === nothing && sheet === nothing ? nothing : html`${hud}${sheet}`;
  }

  private hud() {
    const d = this.drag;
    if (!d?.dragging || d.hudY === null) return nothing;
    const l = this.light(d.item);
    const b = l.on ? l.b : 0;
    return html`<div aria-live="polite" style="position:absolute;left:50%;top:${d.hudY}px;z-index:30;transform:translateX(-50%);display:flex;align-items:center;gap:10px;min-width:180px;height:${HUD_H}px;padding:0 16px;box-sizing:border-box;border-radius:999px;overflow:hidden;background:var(--lumen-surface-solid);color:var(--lumen-text-1);box-shadow:var(--lumen-shadow-2);pointer-events:none;animation:lumenFadeIn 160ms both">
      <span style="position:absolute;inset:0 auto 0 0;width:${b}%;background:color-mix(in srgb, ${l.col} 45%, transparent)"></span>
      <span style="position:relative;display:grid;font-size:18px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;white-space:nowrap">${["100%", t("common.off_short")].map((x) => html`<span aria-hidden="true" style="grid-area:1/1;visibility:hidden">${x}</span>`)}<span style="grid-area:1/1">${l.on ? `${b}%` : t("common.off_short")}</span></span>
      <span style="position:relative;min-width:0;max-width:140px;font-size:12px;font-weight:700;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lightName(d.item, l.e)}</span>
    </div>`;
  }

  private renderSheet() {
    const sh = this.sheet;
    if (!sh) return nothing;
    const isSheet = this.host.narrowScreen;
    const item = sh.item;
    const anim = sh.closing
      ? isSheet ? "lumenSheetOut 250ms var(--lumen-ease-in-out) forwards" : "lumenModalOut 220ms ease forwards"
      : isSheet ? "lumenSheetIn 560ms var(--lumen-ease-spring) both" : "lumenModalIn 460ms var(--lumen-ease-spring) both";
    const l = this.light(item);
    const tr = this.sliding ? "none" : "width 500ms var(--lumen-ease-spring), left 500ms var(--lumen-ease-spring)";
    const b = this.slider("b", item);
    const k = this.slider("k", item);
    const title = lightName(item, l.e);
    return html`<div style="position:absolute;inset:0;z-index:50;display:flex;align-items:${isSheet ? "flex-end" : "center"};justify-content:center;padding:${isSheet ? "0" : "24px"};box-sizing:border-box;font-family:var(--lumen-font);color:var(--lumen-text-1)">
      <div @click=${this.scrimClose} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:${sh.closing ? "lumenFadeOut 250ms forwards" : "lumenFadeIn 300ms both"}"></div>
      <div role="dialog" aria-modal="true" aria-label=${title} style="position:relative;width:100%;max-width:${isSheet ? "520px" : "560px"};animation:${anim}">
        <div style="transform:translateY(${this.sheetDy}px);transition:${this.grabY !== null ? "none" : "transform 460ms var(--lumen-ease-spring)"};background:var(--lumen-surface-solid);border-radius:${isSheet ? "30px 30px 0 0" : "28px"};box-shadow:var(--lumen-shadow-2);border:1px solid var(--lumen-border);padding:6px 20px calc(28px + ${isSheet ? "env(safe-area-inset-bottom)" : "0px"});max-height:86vh;overflow:auto;overscroll-behavior:contain;box-sizing:border-box">
          <div @pointerdown=${this.grab.down} @pointermove=${this.grab.move} @pointerup=${this.grab.up} @pointercancel=${this.grab.up} style="touch-action:none;cursor:${isSheet ? "grab" : "default"}">
            ${isSheet ? html`<div style="display:flex;justify-content:center;padding:8px 0 10px"><span style="width:40px;height:5px;border-radius:3px;background:var(--lumen-border-strong)"></span></div>` : nothing}
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0 16px">
              <div style="width:44px;height:44px;border-radius:15px;display:grid;place-items:center;font-size:24px;background:${l.on ? l.col : "var(--lumen-surface-2)"};color:${l.on ? "#3B2709" : "var(--lumen-text-2)"}">${icon(lightIcon(item, l.e))}</div>
              <div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800;letter-spacing:-0.02em">${title}</div><div style="font:500 11px var(--lumen-mono);color:var(--lumen-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.entity}</div></div>
              <button aria-label=${t("common.close")} @click=${this.closeSheet} style="width:44px;height:44px;border-radius:50%;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;cursor:pointer;display:grid;place-items:center">${icon("mdi:close")}</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:13px;font-weight:700;color:var(--lumen-text-2)">${t("card.light.brightness")}</span><span style="font-size:32px;font-weight:300;letter-spacing:-0.03em;font-variant-numeric:tabular-nums">${l.on ? `${l.b}%` : t("common.off_short")}</span></div>
            <div role="slider" tabindex="0" aria-label=${t("card.light.brightness")} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${l.on ? l.b : 0} aria-valuetext=${l.on ? `${l.b}%` : t("common.off_short")}
              @keydown=${b.key} @pointerdown=${b.down} @pointermove=${b.move} @pointerup=${b.up} @pointercancel=${b.up} style="position:relative;height:72px;border-radius:22px;background:var(--lumen-surface-2);overflow:hidden;touch-action:none;cursor:ew-resize">
              <div style="position:absolute;inset:0 auto 0 0;width:${l.on ? l.b : 0}%;background:linear-gradient(90deg, color-mix(in srgb, ${l.col} 55%, transparent), ${l.col});transition:${tr}"></div>
            </div>
            ${l.ct
              ? html`<div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:8px"><span style="font-size:13px;font-weight:700;color:var(--lumen-text-2)">${t("card.light.ct")}</span><span style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums">${l.k} K</span></div>
                  <div role="slider" tabindex="0" aria-label=${t("card.light.ct")} aria-valuemin=${l.kMin} aria-valuemax=${l.kMax} aria-valuenow=${l.k} aria-valuetext="${l.k} K"
                    @keydown=${k.key} @pointerdown=${k.down} @pointermove=${k.move} @pointerup=${k.up} @pointercancel=${k.up} style="position:relative;height:48px;border-radius:16px;background:linear-gradient(90deg, ${warm(l.kMin)}, ${warm((l.kMin + l.kMax) / 2)}, ${warm(l.kMax)});touch-action:none;cursor:ew-resize">
                    <div style="position:absolute;top:4px;bottom:4px;left:${Math.max(0, Math.min(100, ((l.k - l.kMin) / (l.kMax - l.kMin)) * 100))}%;width:8px;margin-left:-4px;border-radius:4px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.35);transition:${tr}"></div>
                  </div>`
              : nothing}
            ${l.color
              ? html`<div style="font-size:13px;font-weight:700;color:var(--lumen-text-2);padding-top:8px">${t("card.light.color")}</div>
                  <div role="group" aria-label=${t("card.light.color")} style="display:grid;grid-template-columns:repeat(8, 1fr);gap:6px">${HUE_PRESETS.map(
                    ([hs, name]) => html`<button class="ct" aria-label=${t(name)} title=${t(name)} @click=${() => {
                      this.haptic();
                      this.setHue(item.entity, hs);
                    }} style="aspect-ratio:1;min-height:32px;border-radius:50%;border:0;padding:0;cursor:pointer;background:hsl(${hs[0]} ${hs[1]}% 60%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></button>`,
                  )}</div>`
              : nothing}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:10px">
              <button class="press" @click=${() => this.toggleLight(item)} style="min-height:52px;border-radius:18px;border:0;background:var(--lumen-text-1);color:var(--lumen-bg);font:750 14px var(--lumen-font);cursor:pointer">${l.on ? t("card.light.turn_off") : t("card.light.turn_on")}</button>
              <button class="press" @click=${() => this.moreInfo(item.entity)} style="min-height:52px;border-radius:18px;border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);font:750 14px var(--lumen-font);cursor:pointer">${t("card.light.more")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
}
