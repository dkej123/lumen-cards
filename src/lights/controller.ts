import { html, nothing, type ReactiveController, type TemplateResult } from "lit";
import type { ActionConfig } from "../core/actions";
import { DragTicks, handleAction, haptic } from "../core/actions";
import type { LumenBaseCard } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { glass, prevent, stop } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity } from "../hass/types";
import { PENDING_MS } from "../core/controllers/pending";
import { WFX } from "../core/parts";
import { isUnavailable } from "../hass/types";
import {
  HUE_PRESETS, brightnessPct, ctPresets, hsOf, hsToRgb, hueName, isDimmable, kelvinRange, lightPower, miredPresets, mixedGroup,
  supportsColor, supportsColorTemp, swatchIndex, whiteColor, whiteGradient,
} from "../logic/light";
import { warm } from "../weather/fx";

// Lights of the design (light(), lightHandlers(), tile(), pill(), ctOverlay(),
// slider(), the light sheet and the brightness HUD) as a controller any card can own.
// The compact and icon-only tiles, the sheet's white presets, hue swatches and colour wheel
// follow the Lumen Cards catalog (2026-10-29). `l.col` can be overridden by the card's glow colour.

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

interface LightOverride { on?: boolean; b?: number; k?: number; hs?: [number, number] }
interface Pending { from?: HassEntity; until: number }
interface Drag {
  entity: string; item: LightItem; el: HTMLElement;
  hudY: number | null; x0: number; y0: number; left: number; w: number;
  moved: boolean; dragging: boolean; held: boolean; cur?: number;
}

/** Horizontal movement (px) that turns a press into a brightness drag (catalog "Zachowanie"). */
export const DRAG_PX = 6;
const HUD_H = 40;
const HUD_GAP = 12;
const HUD_MIN_TOP = 8;
/** HA toolbar height above the dashboard (the design measured from its own frame). */
const TOP = 56;
const onSwatch = (e: Event) => !!(e.target as Element | null)?.closest?.("[data-ct]");
const RAINBOW = "conic-gradient(#f55, #fd5, #5d7, #5cf, #86f, #f5b, #f55)";
const WHEEL = "radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%), conic-gradient(from 90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";
const ring = (on: boolean) => (on ? "0 0 0 2px var(--lumen-surface-solid), 0 0 0 4px var(--lumen-text-1)" : "inset 0 0 0 1px rgba(0,0,0,.08)");

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
  private sheet: { item: LightItem; closing: boolean; view: "main" | "wheel" } | null = null;
  /** Colour wheel position while the finger is on it. */
  private wheelHs: [number, number] | null = null;
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
    haptic(this.host, type);
  }

  /** Gentle ticks while a brightness / white / colour value is dragged. */
  private ticks = new DragTicks(1);

  private moreInfo(entityId: string) {
    this.host.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------------------------------------------------------------- state

  light(item: LightItem) {
    const e = this.entity(item.entity);
    const ov = this.overrides.get(item.entity);
    const p = lightPower(e, item.power_entity ? this.entity(item.power_entity) : undefined, !!item.power_entity, this.now);
    // `unknown` is "no data", not an outage: the tile keeps its frame and its tap.
    const unknown = !item.power_entity && e?.state === "unknown";
    const una = p.unavailable && !unknown;
    const reachable = !una && !unknown && !p.booting && !isUnavailable(e);
    const dim = reachable && isDimmable(e);
    const ct = reachable && supportsColorTemp(e);
    const color = reachable && supportsColor(e);
    const on = !una && !unknown && (ov?.on ?? p.on);
    // Light group with only some members on: fill by their average brightness, softer glow.
    const group = reachable && !ov && this.hass ? mixedGroup(e, this.hass.states) : null;
    const b = ov?.b ?? (group?.avg ?? (brightnessPct(e) || 100));
    const [kMin, kMax] = kelvinRange(e);
    const k = Math.round(ov?.k ?? e?.attributes.color_temp_kelvin ?? Math.min(kMax, Math.max(kMin, 2700)));
    const pending = this.pending.has(item.entity) || (p.booting && ov?.on !== false);
    // Colour mode: a picked hue, else the bulb's own (anything but color_temp).
    const hs = ov?.hs ?? (ov?.k !== undefined || !color || e?.attributes.color_mode === "color_temp" ? undefined : hsOf(e));
    // Glow: the card's colour (glow_color / theme) wins over the light's own colour or warm white.
    const rgb: unknown = e?.attributes.rgb_color;
    const own = ov?.hs ? hsToRgb(ov.hs) : hs && Array.isArray(rgb) ? `rgb(${rgb.join(",")})` : hs ? hsToRgb(hs) : warm(ct ? k : 2700);
    const col = this.host.glowColor(own);
    const bb = dim ? b : 100;
    const value = una
      ? t("card.light.unavailable")
      : unknown
        ? t("common.no_data")
        : p.booting
          ? t("card.light.booting")
          : group && on
            ? t("card.light.group_on", { on: group.on, total: group.total })
            : on
              ? dim ? `${bb}%` : t("card.light.on")
              : t("card.light.off");
    const meta = !on ? "" : group ? (group.avg !== null ? `${group.avg}%` : "") : hs ? t(hueName(hs)) : ct ? `${k} K` : "";
    const glow = on ? (group ? 0.45 : 0.25 + (bb / 100) * 0.75) : 0;
    return { e, una, unknown, reachable, dim, ct, color, on, b: bb, k, kMin, kMax, hs, col, pending, powerOn: p.powerOn, booting: p.booting, group, value, meta, glow };
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
    this.overrides.set(entity, { ...this.overrides.get(entity), on: true, hs, k: undefined });
    this.setPending(entity);
    this.call("light", "turn_on", { hs_color: hs }, entity);
  }

  private hold(item: LightItem) {
    if (item.hold_action) handleAction(this.host, item.hold_action, item.entity, "hold");
    else this.sheetOrInfo(item);
  }

  /** The light sheet (any reachable light; on/off-only ones get it without sliders), else more-info. */
  private sheetOrInfo(item: LightItem) {
    if (this.light(item).reachable && !this.host.preview) this.openSheet(item);
    else this.moreInfo(item.entity);
  }

  /** The tile icon opens the sheet; its pointerdown never starts a drag. */
  private iconHandlers(item: LightItem) {
    return {
      down: (e: Event) => e.stopPropagation(),
      click: (e: Event) => {
        e.stopPropagation();
        if (performance.now() - this.dragEnd < 350) return;
        this.haptic();
        this.sheetOrInfo(item);
      },
    };
  }

  private setKelvin(entity: string, k: number) {
    this.overrides.set(entity, { ...this.overrides.get(entity), on: true, k, hs: undefined });
    this.setPending(entity);
    this.call("light", "turn_on", { color_temp_kelvin: k }, entity);
  }

  /**
   * Tap = toggle; horizontal drag > 6 px sets the brightness from the finger position on the
   * tile (pointer captured, page scroll stays vertical); hold 500 ms = sheet / more-info.
   */
  handlers(item: LightItem) {
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      const onCt = onSwatch(e);
      const rect = el.getBoundingClientRect();
      this.drag = {
        entity: item.entity, item, el, hudY: this.hudY(rect.top), x0: e.clientX, y0: e.clientY, left: rect.left, w: Math.max(1, rect.width),
        moved: false, dragging: false, held: false,
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
        if (Math.abs(dx) <= DRAG_PX) return;
        d.moved = true;
        window.clearTimeout(this.holdTimer);
        const l = this.light(item);
        if (!l.dim || l.una) return;
        d.dragging = true;
        this.ticks.start(l.on ? l.b : 0);
        try {
          d.el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      const b = Math.round(Math.max(1, Math.min(100, ((e.clientX - d.left) / d.w) * 100)));
      d.cur = b;
      this.ticks.move(this.host, b, 1, 100);
      this.overrides.set(item.entity, { ...this.overrides.get(item.entity), on: true, b });
      this.requestUpdate();
    };
    const up = (e: PointerEvent) => {
      const d = this.drag;
      window.clearTimeout(this.holdTimer);
      if (!d || d.entity !== item.entity) return;
      this.drag = null;
      if (d.moved) this.dragEnd = performance.now();
      if (d.dragging) {
        this.ticks.end();
        this.haptic("selection");
        if (d.cur !== undefined) this.setBrightness(item, d.cur);
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
  tile(item: LightItem, i: number, minH: number, mobile: boolean, swatch = true): TemplateResult {
    const l = this.light(item);
    const h = this.handlers(item);
    const dragging = this.drag?.entity === item.entity && this.drag.dragging;
    const { value, meta } = l;
    const fillW = l.on ? `${l.b}%` : "0%";
    const ih = this.iconHandlers(item);
    const ctOpen = l.on && l.ct && !l.hs && this.ctOpen === item.entity;
    const border = l.una ? "1.5px dashed var(--lumen-border-strong)" : l.on ? `1px solid color-mix(in srgb, ${l.col} 45%, transparent)` : "1px solid var(--lumen-border)";
    const shadow = l.on ? `0 18px 44px -18px color-mix(in srgb, ${l.col} ${Math.round(35 + l.b * 0.5)}%, transparent), var(--lumen-shadow-1)` : "var(--lumen-shadow-1)";
    // Compact (catalog correction 2026-10-30): the low Dom tile, r16, icon 28 r9, one-line name.
    const iconSize = mobile ? 28 : 34;
    return html`<div data-fx role="button" tabindex="0" aria-pressed=${l.on} aria-disabled=${l.una} aria-label="${lightName(item, l.e)} · ${value}" aria-keyshortcuts="Shift+Enter ArrowLeft ArrowRight"
      @pointerdown=${h.down} @pointermove=${h.move} @pointerup=${h.up} @pointercancel=${h.cancel} @keydown=${h.key} @contextmenu=${prevent}
      class="press tile" style="position:relative;isolation:isolate;height:${minH}px;padding:${mobile ? "8px 6px 8px 8px" : "11px 12px"};box-sizing:border-box;border-radius:${mobile ? 16 : 20}px;background:var(--lumen-surface);${glass};border:${border};box-shadow:${shadow};opacity:${l.una ? 0.6 : 1};touch-action:pan-y;user-select:none;cursor:${l.una ? "not-allowed" : "pointer"};display:flex;flex-direction:row;align-items:center;gap:${mobile ? 8 : 10}px;outline:none;transition:box-shadow 700ms var(--lumen-ease-out), border-color 400ms, transform 240ms var(--lumen-ease-spring), opacity 300ms;animation:lumenRise 640ms var(--lumen-ease-spring) both;animation-delay:${i * 40}ms">${WFX}
      ${ctOpen ? this.ctOverlay(item.entity, l.k, mobile, false, l.e) : nothing}
      <div style="position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none">
      <div style="position:absolute;inset:0 auto 0 0;width:${fillW};background:linear-gradient(90deg, color-mix(in srgb, ${l.col} var(--lumen-fill-a), transparent), color-mix(in srgb, ${l.col} var(--lumen-fill-b), transparent));transition:${dragging ? "width 60ms linear" : "width 620ms var(--lumen-ease-spring)"};mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);-webkit-mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);pointer-events:none"></div>
      <div style="position:absolute;top:-70%;right:-35%;width:120%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${l.col} 55%, transparent) 0%, transparent 62%);opacity:${l.glow.toFixed(2)};transition:opacity 800ms var(--lumen-ease-out);pointer-events:none"></div>
      </div>
      <div role="button" tabindex="-1" aria-label=${t("card.light.settings")} title=${t("card.light.settings")} @pointerdown=${ih.down} @click=${ih.click} style="position:relative;flex:none;order:-2;width:${iconSize}px;height:${iconSize}px;border-radius:${mobile ? 9 : 12}px;display:grid;place-items:center;font-size:${mobile ? 16 : 19}px;cursor:pointer;background:${l.on ? l.col : "var(--lumen-surface-2)"};color:${l.on ? "#3B2709" : l.unknown ? "var(--lumen-text-3)" : "var(--lumen-text-2)"};box-shadow:${l.on ? `0 0 18px color-mix(in srgb, ${l.col} 70%, transparent)` : "none"};transition:background-color 500ms, color 500ms, box-shadow 700ms">${icon(lightIcon(item, l.e))}</div>
      ${l.una ? icon("mdi:power-plug-off-outline", "font-size:18px;color:var(--lumen-text-3)") : nothing}
      ${l.on && l.ct && !l.hs && !l.group && item.show_color_button !== false && swatch
        ? this.swatch(item, l.col, mobile ? 18 : 22, `position:relative;width:${mobile ? 30 : 40}px;height:44px;margin:${mobile ? "-8px -4px -8px -2px" : "0 -6px 0 0"};padding:0;border-radius:12px;border:0;background:transparent;display:grid;place-items:center;cursor:pointer;touch-action:pan-y`)
        : nothing}
      <div style="position:relative;flex:1;order:-1;${mobile ? "" : "display:flex;flex-direction:column;gap:1px;"}min-width:0">
        <div style="font-size:${mobile ? 12 : 14}px;font-weight:700;${mobile ? "line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" : "letter-spacing:-0.01em;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"}">${lightName(item, l.e)}</div>
        ${item.show_state === false
          ? nothing
          : mobile
          ? html`<div style="display:flex;gap:6px;font-size:11px;line-height:14px;font-weight:600;color:var(--lumen-text-2);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden"><span style="overflow:hidden;text-overflow:ellipsis">${value}</span><span style="color:var(--lumen-text-3);flex:none">${meta}</span></div>`
          : html`<div style="display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:650;color:${l.unknown ? "var(--lumen-text-3)" : "var(--lumen-text-2)"};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden"><span style="overflow:hidden;text-overflow:ellipsis">${value}</span><span style="color:var(--lumen-text-3);font-weight:600;flex:none">${meta}</span></div>`}
      </div>
    </div>`;
  }

  /** Colour picker over the whole tile: 4 presets, a pick closes it after 280 ms. */
  ctOverlay(entity: string, k: number, mobile: boolean, pills = false, e?: HassEntity) {
    return html`<div class="ctov" role="radiogroup" aria-label=${t("card.light.ct")} @pointerdown=${stop} @pointerup=${stop} @click=${stop} style="position:absolute;inset:0;z-index:5;border-radius:${pills ? 14 : 16}px;background:var(--lumen-surface-solid);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-1);display:flex;align-items:center;justify-content:space-around;padding:0 6px;box-sizing:border-box;animation:lumenFadeIn 180ms both">
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
    this.sheet = { item, closing: false, view: "main" };
    this.wheelHs = null;
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
      this.ticks.move(this.host, Math.round(p * 100), 0, 100);
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
        this.ticks.end();
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
        this.ticks.end();
        this.haptic("selection");
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

  private sheetView(view: "main" | "wheel") {
    if (!this.sheet) return;
    this.haptic();
    this.sheet = { ...this.sheet, view };
    this.wheelHs = null;
    this.requestUpdate();
  }

  /** Colour wheel (hs): hue = angle clockwise from the right (as the conic gradient), saturation = distance from the centre. */
  private wheel(item: LightItem) {
    let rect: DOMRect | undefined;
    const at = (e: PointerEvent): [number, number] => {
      const r = rect!;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const h = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
      const sat = Math.round(Math.min(1, Math.hypot(dx, dy) / (r.width / 2)) * 100);
      return [h, sat];
    };
    return {
      down: (e: PointerEvent) => {
        if (e.button !== 0) return;
        rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.wheelHs = at(e);
        this.requestUpdate();
      },
      move: (e: PointerEvent) => {
        if (!this.wheelHs || !rect) return;
        this.wheelHs = at(e);
        this.requestUpdate();
      },
      up: () => {
        const hs = this.wheelHs;
        if (!hs) return;
        this.wheelHs = null;
        this.haptic();
        this.setHue(item.entity, hs);
      },
      /** Arrows: ←/→ hue ∓/± 10°, ↑/↓ saturation ± 10 %. */
      key: (e: KeyboardEvent) => {
        const cur = this.light(item).hs ?? [0, 100];
        const next: [number, number] | null =
          e.key === "ArrowRight" ? [(cur[0] + 10) % 360, cur[1]]
          : e.key === "ArrowLeft" ? [(cur[0] + 350) % 360, cur[1]]
          : e.key === "ArrowUp" ? [cur[0], Math.min(100, cur[1] + 10)]
          : e.key === "ArrowDown" ? [cur[0], Math.max(0, cur[1] - 10)]
          : null;
        if (!next) return;
        e.preventDefault();
        this.setHue(item.entity, next);
      },
    };
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
    const title = lightName(item, l.e);
    const body = sh.view === "wheel" && l.color ? this.wheelView(item, l) : this.mainView(item, l);
    return html`<div style="position:absolute;inset:0;z-index:50;display:flex;align-items:${isSheet ? "flex-end" : "center"};justify-content:center;padding:${isSheet ? "0" : "24px"};box-sizing:border-box;font-family:var(--lumen-font);color:var(--lumen-text-1)">
      <div @click=${this.scrimClose} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:${sh.closing ? "lumenFadeOut 250ms forwards" : "lumenFadeIn 300ms both"}"></div>
      <div role="dialog" aria-modal="true" aria-label=${title} style="position:relative;width:100%;max-width:${isSheet ? "520px" : "420px"};animation:${anim}">
        <div style="transform:translateY(${this.sheetDy}px);transition:${this.grabY !== null ? "none" : "transform 460ms var(--lumen-ease-spring)"};background:var(--lumen-surface-solid);border-radius:${isSheet ? "28px 28px 0 0" : "28px"};box-shadow:var(--lumen-shadow-2);border:1px solid var(--lumen-border);padding:${isSheet ? "4px" : "18px"} 18px calc(18px + ${isSheet ? "env(safe-area-inset-bottom)" : "0px"});max-height:86vh;overflow:auto;overscroll-behavior:contain;box-sizing:border-box">
          <div @pointerdown=${this.grab.down} @pointermove=${this.grab.move} @pointerup=${this.grab.up} @pointercancel=${this.grab.up} style="touch-action:none;cursor:${isSheet ? "grab" : "default"}">
            ${isSheet ? html`<div style="display:flex;justify-content:center;padding:6px 0 12px"><span style="width:40px;height:5px;border-radius:3px;background:var(--lumen-border-strong)"></span></div>` : nothing}
            ${sh.view === "wheel" && l.color
              ? html`<div style="display:flex;align-items:center;gap:8px;padding-bottom:14px">
                  <button aria-label=${t("common.back")} @click=${() => this.sheetView("main")} style="width:40px;height:40px;flex:none;border-radius:50%;border:0;padding:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;cursor:pointer;display:grid;place-items:center">${icon("mdi:chevron-left")}</button>
                  <span style="flex:1;font-size:16px;font-weight:800">${t("card.light.wheel")}</span>
                  <button aria-label=${t("common.close")} @click=${this.closeSheet} style="width:40px;height:40px;flex:none;border-radius:50%;border:0;padding:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;cursor:pointer;display:grid;place-items:center">${icon("mdi:close")}</button>
                </div>`
              : html`<div style="display:flex;align-items:center;gap:12px;padding-bottom:14px">
                  <div style="width:40px;height:40px;flex:none;border-radius:14px;display:grid;place-items:center;font-size:22px;background:${l.on ? l.col : "var(--lumen-surface-2)"};color:${l.on ? "var(--lumen-light-ink)" : "var(--lumen-text-2)"};transition:background-color 500ms">${icon(lightIcon(item, l.e))}</div>
                  <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div><div style="font-size:12px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[l.on ? (l.dim ? `${l.b}%` : t("card.light.on")) : t("common.off_short"), l.on ? l.meta : ""].filter(Boolean).join(" · ")}</div></div>
                  <button aria-label=${t("common.close")} @click=${this.closeSheet} style="width:40px;height:40px;flex:none;border-radius:50%;border:0;padding:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;cursor:pointer;display:grid;place-items:center">${icon("mdi:close")}</button>
                </div>`}
          </div>
          ${body}
        </div>
      </div>
    </div>`;
  }

  /** Sheet content: brightness, whites (4 presets in mireds), 8 hue swatches + the colour wheel. */
  private mainView(item: LightItem, l: ReturnType<LightsController["light"]>) {
    const tr = this.sliding ? "none" : "width 500ms var(--lumen-ease-spring), left 500ms var(--lumen-ease-spring)";
    const b = this.slider("b", item);
    const k = this.slider("k", item);
    const label = "font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)";
    const sel = swatchIndex(l.on ? l.hs : undefined);
    return html`<div style="display:flex;flex-direction:column;gap:14px">
      ${l.dim
        ? html`<div role="slider" tabindex="0" aria-label=${t("card.light.brightness")} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${l.on ? l.b : 0} aria-valuetext=${l.on ? `${l.b}%` : t("common.off_short")}
            @keydown=${b.key} @pointerdown=${b.down} @pointermove=${b.move} @pointerup=${b.up} @pointercancel=${b.up} style="position:relative;height:52px;border-radius:16px;background:var(--lumen-surface-2);overflow:hidden;touch-action:none;user-select:none;cursor:ew-resize">
            <div style="position:absolute;inset:0 auto 0 0;width:${l.on ? l.b : 0}%;background:linear-gradient(90deg, color-mix(in srgb, ${l.col} var(--lumen-fill-a), transparent), color-mix(in srgb, ${l.col} var(--lumen-fill-b), transparent));transition:${tr}"></div>
            <span style="position:absolute;left:14px;top:0;bottom:0;display:flex;align-items:center;gap:8px;font:700 13px var(--lumen-font)">${icon("mdi:brightness-6", "font-size:18px")}${t("card.light.brightness")}</span>
            <span style="position:absolute;right:14px;top:0;bottom:0;display:flex;align-items:center;font:750 15px var(--lumen-font);font-variant-numeric:tabular-nums">${l.on ? `${l.b}%` : t("common.off_short")}</span>
          </div>`
        : nothing}
      ${l.ct
        ? html`<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:-6px"><span style=${label}>${t("card.light.white")}</span><span style="font:500 11px var(--lumen-mono);color:var(--lumen-text-3)">${t("card.light.range", { lo: l.kMin, hi: l.kMax })}</span></div>
            <div role="slider" tabindex="0" aria-label=${t("card.light.ct")} aria-valuemin=${l.kMin} aria-valuemax=${l.kMax} aria-valuenow=${l.k} aria-valuetext="${l.k} K"
              @keydown=${k.key} @pointerdown=${k.down} @pointermove=${k.move} @pointerup=${k.up} @pointercancel=${k.up} style="position:relative;height:44px;border-radius:16px;background:${whiteGradient(l.kMin, l.kMax)};touch-action:none;user-select:none;cursor:ew-resize">
              <span style="position:absolute;top:6px;bottom:6px;left:${Math.max(0, Math.min(100, ((l.k - l.kMin) / (l.kMax - l.kMin)) * 100))}%;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.25);opacity:${l.hs ? 0.5 : 1};transition:${tr}"></span>
            </div>
            <div role="radiogroup" aria-label=${t("card.light.white")} style="display:grid;grid-template-columns:repeat(4, minmax(0,1fr));gap:6px">${miredPresets(l.e).map((preset) => {
              const on = l.on && !l.hs && Math.abs(l.k - preset) < 60;
              return html`<button class="ct" role="radio" aria-checked=${on} aria-label="${preset} K" @click=${() => {
                this.haptic();
                this.setKelvin(item.entity, preset);
              }} style="min-height:48px;padding:0;border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:4px;font:650 11px var(--lumen-font);color:var(--lumen-text-2);font-variant-numeric:tabular-nums;cursor:pointer">
                <span style="width:30px;height:30px;border-radius:50%;background:${whiteColor(preset)};box-shadow:${ring(on)};transition:box-shadow 250ms"></span>${preset} K</button>`;
            })}</div>`
        : nothing}
      ${l.color
        ? html`<div style="${label};margin-bottom:-6px">${t("card.light.color")}</div>
            <div role="radiogroup" aria-label=${t("card.light.color")} style="display:grid;grid-template-columns:repeat(9, minmax(0,1fr));gap:4px;justify-items:center">${HUE_PRESETS.map(
              ([hs, name, css], i) => html`<button class="ct" role="radio" aria-checked=${i === sel} aria-label=${t(name)} title=${t(name)} @click=${() => {
                this.haptic();
                this.setHue(item.entity, hs);
              }} style="width:100%;height:36px;padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:pointer"><span style="width:28px;height:28px;border-radius:50%;background:${css};box-shadow:${ring(i === sel)};transition:box-shadow 250ms"></span></button>`,
            )}<button class="ct" aria-label=${t("card.light.wheel")} title=${t("card.light.wheel")} @click=${() => this.sheetView("wheel")} style="width:100%;height:36px;padding:0;border:0;background:transparent;display:grid;place-items:center;cursor:pointer"><span style="width:28px;height:28px;border-radius:50%;background:${RAINBOW};box-shadow:${ring(false)};display:grid;place-items:center;color:#fff;font-size:16px">${icon("mdi:plus")}</span></button></div>`
        : nothing}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:4px">
        <button class="press" @click=${() => this.toggleLight(item)} style="min-height:48px;border-radius:16px;border:0;background:var(--lumen-text-1);color:var(--lumen-bg);font:750 14px var(--lumen-font);cursor:pointer">${l.on ? t("card.light.turn_off") : t("card.light.turn_on")}</button>
        <button class="press" @click=${() => this.moreInfo(item.entity)} style="min-height:48px;border-radius:16px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-1);font:750 14px var(--lumen-font);cursor:pointer">${t("card.light.more")}</button>
      </div>
    </div>`;
  }

  /** Colour wheel view of the sheet. */
  private wheelView(item: LightItem, l: ReturnType<LightsController["light"]>) {
    const w = this.wheel(item);
    const hs = this.wheelHs ?? (l.on ? l.hs : undefined) ?? [0, 0];
    const rad = (hs[0] * Math.PI) / 180;
    const x = 50 + Math.cos(rad) * hs[1] * 0.5;
    const y = 50 + Math.sin(rad) * hs[1] * 0.5;
    const col = hsToRgb(hs);
    const text = `hs ${hs[0]}°, ${hs[1]}%`;
    return html`<div style="display:flex;flex-direction:column;align-items:center;gap:14px">
      <div role="slider" tabindex="0" aria-label=${t("card.light.wheel")} aria-valuetext="${t(hueName(hs))} · ${text}" aria-valuenow=${hs[0]} aria-valuemin="0" aria-valuemax="360"
        @keydown=${w.key} @pointerdown=${w.down} @pointermove=${w.move} @pointerup=${w.up} @pointercancel=${w.up}
        style="position:relative;width:220px;height:220px;border-radius:50%;background:${WHEEL};box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);touch-action:none;user-select:none;cursor:crosshair">
        <span style="position:absolute;left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:26px;height:26px;margin:-13px;border-radius:50%;background:${col};box-shadow:0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,.35);pointer-events:none"></span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font:700 13px var(--lumen-font)"><span style="width:18px;height:18px;border-radius:50%;background:${col}"></span>${t(hueName(hs))}<span style="font:500 12px var(--lumen-mono);color:var(--lumen-text-3)">${text}</span></div>
    </div>`;
  }
}
