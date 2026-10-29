import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { appearance, fabFields, firstOf, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { fabBottom, fabSlot, LayerController, releaseFab } from "../core/layer";
import { registerCard } from "../core/register";
import { glass, prevent } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity, HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { temp } from "../logic/format";
import { formatNumber } from "../logic/time";

export interface ClimateConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Power button action. Default: on = the last used mode, off = climate.turn_off. */
  power_action?: ActionConfig;
  /** Narrower setpoint range than the device's (optional). */
  min_temp?: number;
  max_temp?: number;
  /** Floating round button + dialog instead of the card. */
  fab?: boolean;
  /** …only on narrow screens (default); off = always. */
  fab_narrow_only?: boolean;
  /** Mode buttons (those the entity supports). Default: off, heat, cool – the design set. */
  hvac_modes?: string[];
  /** Fan buttons (those the entity supports). Default: auto, low, medium, high. */
  fan_modes?: string[];
  show_current_temp?: boolean;
  show_modes?: boolean;
  show_fan_modes?: boolean;
}

const PENDING_MS = 10_000;
const AC_LAST_KEY = "lumen-ac-last:";
const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

const MODES: Record<string, [string, string]> = {
  off: ["common.off_short", "mdi:power"],
  heat: ["card.climate.mode.heat", "mdi:fire"],
  cool: ["card.climate.mode.cool", "mdi:snowflake"],
  heat_cool: ["card.climate.mode.heat_cool", "mdi:sun-snowflake-variant"],
  auto: ["common.auto", "mdi:thermostat-auto"],
  dry: ["card.climate.mode.dry", "mdi:water-percent"],
  fan_only: ["card.climate.mode.fan_only", "mdi:fan"],
};
const MODE_LABEL: Record<string, string> = { heat: "card.climate.mode.heat", cool: "card.climate.mode.cool", heat_cool: "card.climate.mode.heat_cool", auto: "common.auto", dry: "card.climate.mode.dry", fan_only: "card.climate.mode.fan_only" };
const FANS: Record<string, [string, string]> = {
  auto: ["common.auto", "mdi:fan-auto"],
  low: ["card.climate.fan.low", "mdi:fan-speed-1"],
  medium: ["card.climate.fan.medium", "mdi:fan-speed-2"],
  high: ["card.climate.fan.high", "mdi:fan-speed-3"],
  mute: ["card.climate.fan.mute", "mdi:fan-minus"],
  turbo: ["card.climate.fan.turbo", "mdi:fan-plus"],
};


/** Last mode per unit (per device): turning on restores it. */
const readAcLast = (entity: string): string => {
  try {
    return localStorage.getItem(AC_LAST_KEY + entity) ?? "cool";
  } catch {
    return "cool";
  }
};
const writeAcLast = (entity: string, mode: string) => {
  try {
    localStorage.setItem(AC_LAST_KEY + entity, mode);
  } catch {
    /* per-device convenience only */
  }
};

export function validateClimate(c: Partial<ClimateConfig>): void {
  if (!c.entity || !String(c.entity).startsWith("climate.")) throw new Error(t("card.climate.error.entity"));
}

/** Air conditioner / thermostat of the design: a card, or a FAB + dialog B9. */
export class LumenClimateCard extends LumenBaseCard<ClimateConfig> {
  static properties = { ...LumenBaseCard.properties, _dlg: { state: true }, _side: { state: true } };
  private _dlg = false;
  /** heat_cool with a range: which end the ± buttons move. */
  private _side: "low" | "high" = "low";
  private pending = new Map<string, { from?: HassEntity; until: number }>();
  private acLast = "cool";
  private acTarget: number | null = null;
  private rangeTarget: { low: number; high: number } | null = null;
  private acSentAt = 0;
  private acTimer?: number;
  private acHold?: number;
  private acHeld = false;
  private disp?: number;
  private tweenTo?: number;

  protected layer = new LayerController(
    this,
    () => (this.useFab ? html`${this.fab()}${this._dlg ? this.dialog() : nothing}` : nothing),
    () => (this._dlg = false),
  );

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: ClimateConfig) {
    validateClimate(c);
  }

  setConfig(config: ClimateConfig): void {
    super.setConfig(config);
    this.acLast = readAcLast(config.entity);
  }

  private get useFab() {
    const c = this._config;
    return !!c && !!this._hass && !!c.fab && (c.fab_narrow_only === false || this.narrowScreen) && !this.preview;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(1000, () => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.pending) if (p.until < now) changed = this.pending.delete(id) || changed;
      if (this.acSentAt && now - this.acSentAt > PENDING_MS) changed = true;
      if (changed) this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // A pending setpoint is still sent (acTimer): the user chose it.
    window.clearTimeout(this.acHold);
    this.tweenTo = undefined;
    this._dlg = false;
    releaseFab(this);
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (!this.useFab) releaseFab(this);
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (!this._config || !this._hass) return;
    for (const [id, p] of this.pending) if (this.entity(id) !== p.from) this.pending.delete(id);
    const ac = this.entity(this._config.entity);
    if (ac && ac.state !== "off" && !isUnavailable(ac) && ac.state !== this.acLast) writeAcLast(ac.entity_id, (this.acLast = ac.state));
    const reported = typeof ac?.attributes.temperature === "number" ? ac.attributes.temperature : null;
    if (this.acSentAt && Date.now() - this.acSentAt > PENDING_MS) {
      this.acTarget = null;
      this.rangeTarget = null;
      this.acSentAt = 0;
    }
    if (this.acTarget !== null && this.acSentAt && reported === this.acTarget) {
      this.acTarget = null;
      this.acSentAt = 0;
    }
    const r = this.range(ac);
    if (this.rangeTarget && this.acSentAt && r && r.low === this.rangeTarget.low && r.high === this.rangeTarget.high) {
      this.rangeTarget = null;
      this.acSentAt = 0;
    }
    this.tween(this.acTarget ?? reported);
  }

  /** Setpoint number tween (450 ms ease-out cubic). */
  private tween(to: number | null) {
    if (to === null) {
      this.disp = undefined;
      return;
    }
    if (this.tweenTo === to) return;
    this.tweenTo = to;
    const from = this.disp;
    if (from === undefined || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.disp = to;
      return;
    }
    const t0 = performance.now();
    const step = (tt: number) => {
      if (this.tweenTo !== to) return;
      const p = Math.min(1, (tt - t0) / 450);
      this.disp = from + (to - from) * (1 - Math.pow(1 - p, 3));
      this.requestUpdate();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private setPending(id: string) {
    this.pending.set(id, { from: this.entity(id), until: Date.now() + PENDING_MS });
    this.requestUpdate();
  }

  private call(domain: string, service: string, data: Record<string, unknown>, entity?: string) {
    return this._hass?.callService(domain, service, data, entity ? { entity_id: entity } : undefined).catch((err: Error) => {
      if (entity) this.pending.delete(entity);
      toast(this, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: err.message ?? String(err) });
    });
  }

  /** heat_cool with a low/high range (no single target). */
  private range(e?: HassEntity): { low: number; high: number } | null {
    const lo = e?.attributes.target_temp_low;
    const hi = e?.attributes.target_temp_high;
    return typeof lo === "number" && typeof hi === "number" && typeof e?.attributes.temperature !== "number" ? { low: lo, high: hi } : null;
  }

  /** The device's setpoint range, narrowed by min_temp / max_temp when set. */
  private limits(e: HassEntity): [number, number] {
    const c = this._config;
    const dmin = Number(e.attributes.min_temp ?? 7);
    const dmax = Number(e.attributes.max_temp ?? 35);
    const lo = typeof c.min_temp === "number" ? Math.max(dmin, c.min_temp) : dmin;
    const hi = typeof c.max_temp === "number" ? Math.min(dmax, c.max_temp) : dmax;
    return lo <= hi ? [lo, hi] : [dmin, dmax];
  }

  private step(delta: number) {
    const { entity } = this._config;
    const e = this.entity(entity);
    if (!e || isUnavailable(e) || e.state === "off") return;
    const step = Number(e.attributes.target_temp_step ?? (e.attributes.temperature_unit === "°F" ? 1 : 0.5));
    const [lo, hi] = this.limits(e);
    const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
    const r = this.rangeTarget ?? this.range(e);
    let data: Record<string, number>;
    if (r) {
      const next = { ...r, [this._side]: clamp(r[this._side] + delta * step) };
      if (next.low > next.high) return;
      this.rangeTarget = next;
      data = { target_temp_low: next.low, target_temp_high: next.high };
    } else {
      const current = this.acTarget ?? Number(e.attributes.temperature ?? (lo + hi) / 2);
      this.acTarget = clamp(current + delta * step);
      data = { temperature: this.acTarget };
    }
    this.haptic("selection");
    this.requestUpdate();
    this.acSentAt = 0;
    window.clearTimeout(this.acTimer);
    this.acTimer = window.setTimeout(() => {
      this.acSentAt = Date.now();
      this.call("climate", "set_temperature", data, entity);
    }, 600);
  }

  private ac() {
    const cfg = this._config;
    const e = this.entity(cfg.entity);
    const una = isUnavailable(e);
    const mode = una ? "off" : e!.state;
    const c = mode === "heat" ? "var(--lumen-orange)" : mode === "off" ? "var(--lumen-text-3)" : "var(--lumen-accent)";
    const busy = this.pending.has(cfg.entity);
    const room = temp(e?.attributes.current_temperature);
    const target = this.disp;
    const off = mode === "off";
    const fan = e?.attributes.fan_mode ?? "auto";
    const sel = (a: boolean, color: string) =>
      a ? `background:var(--lumen-surface-solid);color:${color};box-shadow:var(--lumen-shadow-1)` : "background:transparent;color:var(--lumen-text-2);box-shadow:none";
    // The entity's own modes in the design's order; off/heat/cool is the design's set.
    const hvac: string[] = e?.attributes.hvac_modes ?? ["off", "heat", "cool"];
    const wanted = cfg.hvac_modes?.length ? cfg.hvac_modes : ["off", "heat", "cool"];
    const modes = Object.keys(MODES).filter((k) => hvac.includes(k) && wanted.includes(k)).map((k) => ({
      k, label: t(MODES[k][0]), ic: MODES[k][1], active: mode === k,
      color: k === "heat" ? "var(--lumen-orange)" : k === "off" ? "var(--lumen-text-1)" : "var(--lumen-accent)",
      on: () => {
        if (una) return;
        this.haptic();
        if (k !== "off") writeAcLast(cfg.entity, (this.acLast = k));
        this.setPending(cfg.entity);
        this.call("climate", "set_hvac_mode", { hvac_mode: k }, cfg.entity);
      },
    }));
    const fanModes: string[] = e?.attributes.fan_modes ?? ["auto", "low", "medium", "high"];
    const wantedFans = cfg.fan_modes?.length ? cfg.fan_modes : ["auto", "low", "medium", "high"];
    const fans = fanModes.filter((k) => wantedFans.includes(k)).slice(0, 5).map((k) => ({
      k, label: t(FANS[k]?.[0] ?? k), ic: FANS[k]?.[1] ?? "mdi:fan", active: fan === k,
      on: () => {
        if (off || una) return;
        this.haptic();
        this.setPending(cfg.entity);
        this.call("climate", "set_fan_mode", { fan_mode: k }, cfg.entity);
      },
    }));
    const power = () => {
      if (busy || una) return;
      this.haptic();
      this.setPending(cfg.entity);
      if (cfg.power_action) {
        handleAction(this, cfg.power_action, cfg.entity, "tap");
        return;
      }
      // Turning on restores the last mode.
      if (off) {
        this.call("climate", "set_hvac_mode", { hvac_mode: hvac.includes(this.acLast) ? this.acLast : (hvac.find((m) => m !== "off") ?? "cool") }, cfg.entity);
        return;
      }
      this.call("climate", "turn_off", {}, cfg.entity);
    };
    const modeLabel = (m: string) => t(MODE_LABEL[m] ?? m);
    const fanLabel = (f: string) => (FANS[f] ? t(FANS[f][0]) : f).toLowerCase();
    const state = una ? t("card.climate.unavailable") : busy ? t("common.sending_command") : off ? t("card.climate.off") : `${modeLabel(mode)} · ${t("card.climate.fan_inline")} ${fanLabel(fan)}`;
    const roomLine = t("card.climate.room", { t: room });
    const r = this.rangeTarget ?? this.range(e);
    const range = r ? { low: `${formatNumber(r.low)}°`, high: `${formatNumber(r.high)}°` } : null;
    return { c, mode, off, una, busy, target: target === undefined ? "—" : `${formatNumber(target)}°`, range, modes, fans, power, state, roomLine, sel };
  }

  private get name() {
    return this._config.name || this.entity(this._config.entity)?.attributes.friendly_name || t("card.climate.name");
  }

  /** Setpoint: one number, or low–high with the end the ± buttons move picked by a tap. */
  private setpoint(a: ReturnType<LumenClimateCard["ac"]>, size: number, color = "inherit") {
    const num = (v: string, side?: "low" | "high") => {
      const on = !side || this._side === side;
      return side
        ? html`<button aria-pressed=${on} aria-label=${side === "low" ? t("card.climate.low") : t("card.climate.high")} @click=${() => (this._side = side)} style="border:0;background:transparent;padding:0 2px;cursor:pointer;font:300 ${size}px/1 var(--lumen-font);letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:${color};opacity:${on ? 1 : 0.4};transition:opacity 200ms">${v}</button>`
        : html`<span style="font-size:${size}px;font-weight:300;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums;color:${color}">${v}</span>`;
    };
    return a.range ? html`<span style="display:inline-flex;align-items:baseline;gap:2px">${num(a.range.low, "low")}<span style="font-size:${size * 0.6}px;opacity:.5">–</span>${num(a.range.high, "high")}</span>` : num(a.target);
  }

  private card() {
    const a = this.ac();
    const cfg = this._config;
    return html`<div data-fx style="padding:16px;border-radius:22px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};display:flex;flex-direction:column;gap:14px">${WFX}
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb, ${a.c} 16%, transparent);color:${a.c};transition:background-color 500ms, color 500ms">${icon(cfg.icon ?? "mdi:air-conditioner")}</div>
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;line-height:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.name}</div><div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.state}</div>${cfg.show_current_temp !== false ? html`<div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-3);white-space:nowrap">${a.roomLine}</div>` : nothing}</div>
        <button class="press" @click=${a.power} aria-label=${t("card.climate.power")} style="width:48px;height:48px;border-radius:50%;border:0;display:grid;place-items:center;font-size:22px;background:${a.off ? "var(--lumen-surface-2)" : a.c};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};cursor:pointer;transition:background-color 400ms, color 400ms, transform 220ms var(--lumen-ease-spring)">${icon("mdi:power", `display:block;animation:${a.busy ? "lumenBreath 1200ms ease-in-out infinite" : "none"}`)}</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;opacity:${a.off ? 0.45 : 1};transition:opacity 400ms">
        <button class="press" aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style="width:48px;height:48px;border-radius:16px;border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:22px;cursor:pointer;display:grid;place-items:center">${icon("mdi:minus")}</button>
        <div style="text-align:center"><div style="line-height:1">${this.setpoint(a, 40)}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-3);margin-top:4px">${t("card.climate.target")}</div></div>
        <button class="press" aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style="width:48px;height:48px;border-radius:16px;border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:22px;cursor:pointer;display:grid;place-items:center">${icon("mdi:plus")}</button>
      </div>
      ${cfg.show_modes !== false && a.modes.length ? html`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3);margin-bottom:-8px">${t("card.climate.modes")}</div>
      <div class="modes" role="group" aria-label=${t("card.climate.modes")} style="display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2)">${a.modes.map(
        (o) => html`<button aria-pressed=${o.active} @click=${o.on} style="flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:12px;${a.sel(o.active, o.color)};font:700 12px var(--lumen-font);cursor:pointer;transition:background-color 300ms, color 300ms">${icon(o.ic, "font-size:16px")}${o.label}</button>`,
      )}</div>` : nothing}
      ${cfg.show_fan_modes !== false && a.fans.length ? html`<div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3);margin-bottom:-8px">${t("card.climate.fans")}</div>
      <div role="group" aria-label=${t("card.climate.fans")} style="display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2);opacity:${a.off ? 0.45 : 1};transition:opacity 400ms">${a.fans.map(
        (o) => html`<button aria-pressed=${o.active} @click=${o.on} style="flex:1;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border:0;border-radius:12px;${a.sel(o.active, a.c)};font:700 11px var(--lumen-font);cursor:pointer;transition:background-color 300ms, color 300ms">${icon(o.ic, "font-size:17px;line-height:18px")}${o.label}</button>`,
      )}</div>` : nothing}
    </div>`;
  }

  /** AC FAB (B9): tap = dialog, hold 550 ms = power with a toast. */
  private fab() {
    const a = this.ac();
    const tt = this.disp;
    const whole = tt === undefined || Math.abs(tt - Math.round(tt)) < 0.05;
    const short = tt === undefined ? "—" : `${whole ? String(Math.round(tt)) : formatNumber(Math.round(tt * 2) / 2)}°`;
    const anim = `animation:${a.busy ? "lumenBreath 1200ms ease-in-out infinite" : "none"}`;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.acHeld = false;
      window.clearTimeout(this.acHold);
      this.acHold = window.setTimeout(() => {
        this.acHeld = true;
        const was = this.ac();
        if (was.busy || was.una) return;
        was.power();
        const heat = this.acLast === "heat";
        toast(this, { icon: this._config.icon ?? "mdi:air-conditioner", tone: was.off ? (heat ? "orange" : "info") : "unavailable", title: this.name, text: was.off ? (heat ? t("card.climate.on_heat") : t("card.climate.on_cool")) : t("card.climate.turning_off") });
      }, 550);
    };
    const cancel = () => window.clearTimeout(this.acHold);
    const tap = () => {
      if (this.acHeld) {
        this.acHeld = false;
        return;
      }
      this.haptic();
      this._dlg = true;
    };
    return html`<button class="press acfab" @pointerdown=${down} @pointerup=${cancel} @pointerleave=${cancel} @click=${tap} @pointercancel=${cancel} @contextmenu=${prevent}
      aria-label="${this.name} · ${t("card.climate.fab_hint")}" aria-haspopup="dialog" title="${this.name} · ${a.off ? t("card.climate.hold_on") : t("card.climate.hold_off")}"
      style="position:absolute;right:24px;bottom:calc(${fabBottom(fabSlot(this))} + 8px);z-index:5;width:48px;height:48px;padding:0;border-radius:50%;border:1px solid ${a.off ? "var(--lumen-border)" : "transparent"};background:${a.off ? "var(--lumen-surface)" : a.c};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};font-size:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:none;${glass};box-shadow:var(--lumen-shadow-2);transition:background-color 400ms, color 400ms, transform 260ms var(--lumen-ease-spring)">
      ${a.off
        ? icon(this._config.icon ?? "mdi:air-conditioner", `display:block;${anim}`)
        : html`<span style="display:flex;flex-direction:column;align-items:center;gap:1px;${anim}">${icon(a.mode === "heat" ? "mdi:fire" : "mdi:snowflake", "font-size:13px;line-height:13px;opacity:.85")}<span style="font-size:${whole ? 14 : 12}px;font-weight:800;line-height:15px;letter-spacing:-0.03em;font-variant-numeric:tabular-nums">${short}</span></span>`}
    </button>`;
  }

  /** Mobile AC dialog (B9): power, setpoint, mode and fan. */
  private dialog() {
    const a = this.ac();
    const close = () => (this._dlg = false);
    const cfg = this._config;
    const seg = (o: { label: string; ic: string; active: boolean; on: () => void }, color: string) =>
      html`<button aria-pressed=${o.active} @click=${o.on} style="flex:1;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;border-radius:13px;${a.sel(o.active, color)};font:700 11px var(--lumen-font);cursor:pointer;transition:background-color 300ms, color 300ms">${icon(o.ic, "font-size:17px")}${o.label}</button>`;
    const step = "width:56px;height:56px;border-radius:18px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:24px;display:grid;place-items:center;cursor:pointer";
    return html`
      <div @click=${close} style="position:absolute;inset:0;z-index:20;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:lumenFadeIn 240ms both"></div>
      <div role="dialog" aria-modal="true" aria-label=${this.name} style="position:absolute;left:12px;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:21;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:18px 14px 14px;border-radius:30px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);animation:lumenSheetIn 460ms var(--lumen-ease-spring) both;max-width:520px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:10px;padding:0 4px">
          <button class="press" @click=${a.power} aria-label=${t("card.climate.power")} style="flex:none;width:44px;height:44px;border-radius:14px;border:0;display:grid;place-items:center;font-size:20px;background:${a.off ? "var(--lumen-surface-2)" : a.c};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};cursor:pointer;transition:background-color 400ms">${icon("mdi:power", `display:block;animation:${a.busy ? "lumenBreath 1200ms ease-in-out infinite" : "none"}`)}</button>
          <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800">${this.name}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.state}</div></div>
          <button class="press" @click=${close} aria-label=${t("common.close")} style="flex:none;width:40px;height:40px;border-radius:12px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;display:grid;place-items:center;cursor:pointer">${icon("mdi:close")}</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;opacity:${a.off ? 0.45 : 1};transition:opacity 400ms">
          <button class="press" aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style=${step}>${icon("mdi:minus")}</button>
          <div style="display:flex;flex-direction:column;align-items:center"><div style="line-height:1">${this.setpoint(a, 52, a.c)}</div>${cfg.show_current_temp !== false ? html`<div style="font-size:12px;font-weight:600;color:var(--lumen-text-3);margin-top:6px">${a.roomLine}</div>` : nothing}</div>
          <button class="press" aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style=${step}>${icon("mdi:plus")}</button>
        </div>
        ${cfg.show_modes !== false && a.modes.length ? html`<div role="group" aria-label=${t("card.climate.modes")} style="display:flex;gap:2px;padding:3px;border-radius:16px;background:var(--lumen-surface-2)">${a.modes.map((o) => seg(o, o.color))}</div>` : nothing}
        ${cfg.show_fan_modes !== false && a.fans.length ? html`<div style="opacity:${a.off ? 0.45 : 1};transition:opacity 400ms"><div role="group" aria-label=${t("card.climate.fans")} style="display:flex;gap:2px;padding:3px;border-radius:16px;background:var(--lumen-surface-2)">${a.fans.map((o) => seg(o, a.c))}</div></div>` : nothing}
      </div>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    return this.useFab ? nothing : this.card();
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "climate", entities, fallback) ?? firstOf(hass, "climate", "climate.example") };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "min_temp", selector: { number: { min: 0, max: 100, step: 0.5, mode: "box" } } },
          { name: "max_temp", selector: { number: { min: 0, max: 100, step: 0.5, mode: "box" } } },
        ],
      },
      {
        name: "hvac_modes",
        selector: { select: { multiple: true, mode: "list", options: Object.keys(MODES).map((value) => ({ value, label: t(MODES[value][0]) })) } },
      },
      {
        name: "fan_modes",
        selector: { select: { multiple: true, mode: "list", custom_value: true, options: Object.keys(FANS).map((value) => ({ value, label: t(FANS[value][0]) })) } },
      },
      { name: "", type: "expandable", flatten: true, title: t("editor.fab"), icon: "mdi:gesture-tap-button", schema: fabFields() },
      {
        name: "",
        type: "expandable",
        flatten: true,
        title: t("editor.advanced"),
        icon: "mdi:tune-variant",
        schema: [
          { name: "power_action", selector: { ui_action: {} } },
          {
            name: "",
            type: "grid",
            flatten: true,
            schema: [
              { name: "show_current_temp", default: true, selector: { boolean: {} } },
              { name: "show_modes", default: true, selector: { boolean: {} } },
              { name: "show_fan_modes", default: true, selector: { boolean: {} } },
            ],
          },
          { name: "styles", selector: { text: { multiline: true } } },
        ],
      },
      appearance({ layout: false }),
    ]);
  }
}

registerCard("lumen-climate-card", LumenClimateCard, {
  name: "card.climate.name",
  description: "card.climate.description",
  domains: ["climate"],
});
