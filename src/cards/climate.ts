import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { PENDING_MS, Pending } from "../core/controllers/pending";
import { Tweens } from "../core/controllers/tween";
import { deviceStore } from "../core/device-store";
import { icon } from "../core/lumen-icon";
import { appearance, entityStub, fabFields, form, hapticsField, nameIcon } from "../core/form";
import { t } from "../core/i18n";
import { FAB_ORDER, FabController, fabSideOf, LayerController } from "../core/layer";
import { WFX } from "../core/parts";
import { Sheet } from "../core/sheet";
import { pressable, spinnerStyle } from "../core/press";
import { registerCard } from "../core/register";
import { glass, ink, prevent } from "../core/styles";
import { toast } from "../core/toast";
import { requireEntity } from "../core/validate";
import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { formatNumber } from "../logic/time";
import { BATTERY_LOW, batteryLevel } from "../logic/battery";
import { formatTemp } from "../logic/format";

/** Low-battery pill next to the hvac_action badge (full card, catalog section 19). */
const batteryBadge = (text: string) =>
  html`<span role="status" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px 4px 7px;border-radius:999px;background:color-mix(in srgb, var(--lumen-warning) 18%, transparent);color:${ink("var(--lumen-warning)")};font:750 12px var(--lumen-font)">${icon("mdi:battery-alert-variant-outline", "font-size:15px")}${text}</span>`;

/** Low-battery chip next to the name in the compact row: icon + "9%", the full text in `title`. */
const batteryChip = (pct: string, full: string) =>
  html`<span role="img" title=${full} aria-label=${full} style="flex:none;display:inline-flex;align-items:center;gap:2px;padding:0 5px 0 3px;border-radius:6px;background:color-mix(in srgb, var(--lumen-warning) 18%, transparent);color:${ink("var(--lumen-warning)")};font:750 11px/16px var(--lumen-font);font-variant-numeric:tabular-nums">${icon("mdi:battery-alert-variant-outline", "font-size:13px")}${pct}</span>`;

export interface ClimateConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Power button action. Default: on = the last used mode, off = climate.turn_off. */
  power_action?: ActionConfig;
  /** Setpoint step of the −/+ buttons (default: the device's target_temp_step). */
  step?: number;
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
  /** Preset buttons (preset_modes). Default: all the entity has. */
  preset_modes?: string[];
  show_current_temp?: boolean;
  show_modes?: boolean;
  show_fan_modes?: boolean;
  /** Swing direction segment (swing_modes). */
  show_swing?: boolean;
  /** Preset pills (preset_modes). */
  show_presets?: boolean;
  /** hvac_action badge under the name (heating / cooling / idle). */
  show_action?: boolean;
  /** "range 16–30 °C · step 0.5" line under the controls. */
  show_range?: boolean;
  /** Battery of the valve/thermostat: a % sensor or a battery binary_sensor. Default: Better
   *  Thermostat's `batteries` attribute (or `battery_level`) on the climate entity. */
  battery_entity?: string;
  /** Low battery below this % (default 15). */
  battery_low?: number;
  /** Low-battery badge (default on). */
  show_battery?: boolean;
}

/** The setpoint goes out this long after the last −/+ tap. */
export const SETPOINT_DEBOUNCE_MS = 1000;
/** Last mode per unit (per device): turning on restores it. */
const acLast = deviceStore("lumen-ac-last:");

/** Modes in the catalog's order. */
const MODES: Record<string, [string, string]> = {
  auto: ["common.auto", "mdi:thermostat-auto"],
  heat_cool: ["card.climate.mode.heat_cool", "mdi:thermostat-auto"],
  cool: ["card.climate.mode.cool", "mdi:snowflake"],
  heat: ["card.climate.mode.heat", "mdi:fire"],
  dry: ["card.climate.mode.dry", "mdi:water-percent"],
  fan_only: ["card.climate.mode.fan_only", "mdi:fan"],
  off: ["common.off_short", "mdi:power"],
};
/** Colour of a mode (icon, badge): heat orange, cool blue, auto green, dry / fan accent. */
const MODE_COLOR: Record<string, string> = {
  heat: "var(--lumen-orange)",
  cool: "var(--lumen-info)",
  auto: "var(--lumen-ok)",
  heat_cool: "var(--lumen-ok)",
  dry: "var(--lumen-accent)",
  fan_only: "var(--lumen-accent)",
  off: "var(--lumen-text-3)",
};
/** hvac_action badge: label key, colour, pulsing dot. */
const ACTIONS: Record<string, [string, string, boolean]> = {
  heating: ["card.climate.action.heating", "var(--lumen-orange)", true],
  preheating: ["card.climate.action.heating", "var(--lumen-orange)", true],
  cooling: ["card.climate.action.cooling", "var(--lumen-info)", false],
  drying: ["card.climate.action.drying", "var(--lumen-accent)", false],
  fan: ["card.climate.action.fan", "var(--lumen-accent)", false],
  defrosting: ["card.climate.action.defrosting", "var(--lumen-info)", false],
  idle: ["card.climate.action.idle", "var(--lumen-text-3)", false],
};
const SWINGS: Record<string, [string, string]> = {
  off: ["card.climate.swing.off", "mdi:arrow-collapse-vertical"],
  on: ["card.climate.swing.on", "mdi:arrow-oscillating"],
  vertical: ["card.climate.swing.vertical", "mdi:arrow-up-down"],
  horizontal: ["card.climate.swing.horizontal", "mdi:arrow-left-right"],
  both: ["card.climate.swing.both", "mdi:arrow-all"],
};
const PRESETS: Record<string, [string, string]> = {
  none: ["card.climate.preset.none", "mdi:close"],
  eco: ["card.climate.preset.eco", "mdi:leaf"],
  comfort: ["card.climate.preset.comfort", "mdi:sofa-outline"],
  away: ["card.climate.preset.away", "mdi:home-export-outline"],
  home: ["card.climate.preset.home", "mdi:home-outline"],
  sleep: ["card.climate.preset.sleep", "mdi:weather-night"],
  boost: ["card.climate.preset.boost", "mdi:rocket-launch-outline"],
  activity: ["card.climate.preset.activity", "mdi:run"],
};
const MODE_LABEL: Record<string, string> = { heat: "card.climate.mode.heat", cool: "card.climate.mode.cool", heat_cool: "card.climate.mode.heat_cool", auto: "common.auto", dry: "card.climate.mode.dry", fan_only: "card.climate.mode.fan_only" };
const SECTION = "font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3);margin-bottom:-8px";
const STEP_BTN = "border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:22px;cursor:pointer;display:grid;place-items:center;border-radius:16px;height:48px";

const FANS: Record<string, [string, string]> = {
  auto: ["common.auto", "mdi:fan-auto"],
  low: ["card.climate.fan.low", "mdi:fan-speed-1"],
  medium: ["card.climate.fan.medium", "mdi:fan-speed-2"],
  high: ["card.climate.fan.high", "mdi:fan-speed-3"],
  mute: ["card.climate.fan.mute", "mdi:fan-minus"],
  turbo: ["card.climate.fan.turbo", "mdi:fan-plus"],
};


export function validateClimate(c: Partial<ClimateConfig>): void {
  requireEntity(c, { domains: ["climate"], msg: "card.climate.error.entity" });
}

/** Air conditioner / thermostat of the design: a card, or a FAB + dialog B9. */
export class LumenClimateCard extends LumenBaseCard<ClimateConfig> {
  protected static grid = GRID.full;
  protected static cardSize = 5;
  protected static compactBelow = 300;
  protected static sample = (id: string): HassEntity => ({ entity_id: id, state: "cool", attributes: { friendly_name: t("card.climate.name"), hvac_modes: ["off", "heat", "cool", "dry"], hvac_action: "cooling", fan_modes: ["auto", "low", "medium", "high"], fan_mode: "auto", temperature: 22, current_temperature: 24.1, min_temp: 16, max_temp: 30, target_temp_step: 0.5 }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
  static properties = { ...LumenBaseCard.properties, _side: { state: true } };
  private sheet = new Sheet(this, () => this.sheet.hide());
  /** heat_cool with a range: which end the ± buttons move. */
  private _side: "low" | "high" = "low";
  /** A mode / fan / power command sent: spinner until the entity answers (or 10 s). */
  private pending = new Pending(this, () => this.entity(this._config?.entity));
  private acLast = "cool";
  private acTarget: number | null = null;
  private rangeTarget: { low: number; high: number } | null = null;
  private acSentAt = 0;
  private acTimer?: number;
  /** A setpoint waits for the debounce (catalog section 19: sent 800 ms after the last tap). */
  private acQueued = false;
  private acHold?: number;
  private acHeld = false;
  private tweens = new Tweens(this);
  /** The setpoint as shown (gliding to a new value). */
  private get disp(): number | undefined {
    return this.tweens.get("set");
  }

  protected layer = new LayerController(
    this,
    () => (this.useFab ? html`${this.fab()}${this.sheet.open ? this.dialog() : nothing}` : nothing),
    () => this.sheet.hide(),
  );

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: ClimateConfig) {
    validateClimate(c);
  }

  setConfig(config: ClimateConfig): void {
    super.setConfig(config);
    this.acLast = (acLast.get(config.entity) ?? "cool");
  }

  private floating = new FabController(this, FAB_ORDER.climate, () => this.useFab, () => fabSideOf(this._config));

  private get useFab() {
    const c = this._config;
    return !!c && !!this._hass && !this.hasError && !!c.fab && (c.fab_narrow_only === false || this.narrowScreen) && !this.preview;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // the setpoint sent stops counting after PENDING_MS (no answer from the device)
    this.every(1000, () => {
      if (this.acSentAt && Date.now() - this.acSentAt > PENDING_MS) this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // A pending setpoint is still sent (acTimer): the user chose it.
    window.clearTimeout(this.acHold);
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (!this._config || !this._hass) return;
    const ac = this.entity(this._config.entity);
    if (ac && ac.state !== "off" && !isUnavailable(ac) && ac.state !== this.acLast) acLast.set(ac.entity_id, (this.acLast = ac.state));
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
    this.tweens.to("set", this.acTarget ?? reported);
  }

  private call(domain: string, service: string, data: Record<string, unknown>, entity?: string) {
    return this._hass?.callService(domain, service, data, entity ? { entity_id: entity } : undefined).catch((err: Error) => {
      this.pending.clear();
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
    const step = this.stepOf(e);
    const [lo, hi] = this.limits(e);
    // Off-grid values (e.g. 23.6 with step 0.5) first snap to the grid in the direction of the tap.
    const move = (v: number) => {
      const n = delta > 0 ? Math.floor(v / step + 1e-6) + 1 : Math.ceil(v / step - 1e-6) - 1;
      return Math.round(n * step * 100) / 100;
    };
    const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
    const r = this.rangeTarget ?? this.range(e);
    let data: Record<string, number>;
    if (r) {
      const next = { ...r, [this._side]: clamp(move(r[this._side])) };
      if (next.low > next.high) return;
      this.rangeTarget = next;
      data = { target_temp_low: next.low, target_temp_high: next.high };
    } else {
      const current = this.acTarget ?? Number(e.attributes.temperature ?? (lo + hi) / 2);
      this.acTarget = clamp(move(current));
      data = { temperature: this.acTarget };
    }
    this.haptic("selection");
    this.requestUpdate();
    this.acSentAt = 0;
    this.acQueued = true;
    window.clearTimeout(this.acTimer);
    this.acTimer = window.setTimeout(() => {
      this.acQueued = false;
      this.acSentAt = Date.now();
      this.call("climate", "set_temperature", data, entity);
    }, SETPOINT_DEBOUNCE_MS);
  }

  /** −/+ step: the card's `step`, else the device's target_temp_step (0.5 °C / 1 °F without one). */
  private stepOf(e: HassEntity): number {
    const own = Number(this._config.step);
    if (own > 0) return own;
    return Number(e.attributes.target_temp_step ?? (e.attributes.temperature_unit === "°F" ? 1 : 0.5));
  }

  /** °F per the entity or HA's unit system (no conversion: the device's numbers as they are). */
  private get fahrenheit(): boolean {
    const e = this.entity(this._config.entity);
    const unit = e?.attributes.temperature_unit ?? (this._hass as { config?: { unit_system?: { temperature?: string } } } | undefined)?.config?.unit_system?.temperature;
    return unit === "°F";
  }

  private ac() {
    const cfg = this._config;
    const e = this.entity(cfg.entity);
    const una = isUnavailable(e);
    const mode = una ? "off" : e!.state;
    const c = MODE_COLOR[mode] ?? "var(--lumen-accent)";
    const busy = this.pending.active;
    const f = this.fahrenheit;
    const room = formatTemp(typeof e?.attributes.current_temperature === "number" ? e.attributes.current_temperature : null, f);
    const target = this.disp;
    const off = mode === "off";
    const fan = e?.attributes.fan_mode ?? "auto";
    const sel = (a: boolean, color: string) =>
      a ? `background:var(--lumen-surface-solid);color:${color};box-shadow:var(--lumen-shadow-1)` : "background:transparent;color:var(--lumen-text-2);box-shadow:none";
    // The entity's own modes in the catalog's order; `hvac_modes` narrows them and sets the order.
    const hvac: string[] = e?.attributes.hvac_modes ?? ["off", "heat", "cool"];
    const order = cfg.hvac_modes?.length ? cfg.hvac_modes.filter((k) => MODES[k]) : Object.keys(MODES);
    // heat_cool reads "Auto" when the device has no separate auto mode (catalog section 09).
    const label = (k: string) => t(k === "heat_cool" && !hvac.includes("auto") ? "common.auto" : MODES[k][0]);
    const modes = order.filter((k) => hvac.includes(k)).map((k) => ({
      k, label: label(k), ic: MODES[k][1], active: mode === k,
      color: k === "off" ? "var(--lumen-text-1)" : MODE_COLOR[k],
      on: () => {
        if (una) return;
        this.haptic();
        if (k !== "off") acLast.set(cfg.entity, (this.acLast = k));
        this.pending.set(true);
        this.call("climate", "set_hvac_mode", { hvac_mode: k }, cfg.entity);
      },
    }));
    const fanModes: string[] = e?.attributes.fan_modes ?? [];
    const wantedFans = cfg.fan_modes?.length ? cfg.fan_modes : fanModes;
    const fans = (cfg.fan_modes?.length ? wantedFans.filter((k) => fanModes.includes(k)) : fanModes).map((k) => ({
      k, label: FANS[k] ? t(FANS[k][0]) : k, ic: FANS[k]?.[1] ?? (/^\d+$/.test(k) ? `mdi:fan-speed-${Math.min(3, Number(k))}` : "mdi:fan"), active: fan === k,
      on: () => {
        if (off || una) return;
        this.haptic();
        this.pending.set(true);
        this.call("climate", "set_fan_mode", { fan_mode: k }, cfg.entity);
      },
    }));
    const swing = e?.attributes.swing_mode;
    const swings = ((e?.attributes.swing_modes as string[] | undefined) ?? []).map((k) => ({
      k, label: SWINGS[k] ? t(SWINGS[k][0]) : k, ic: SWINGS[k]?.[1] ?? "mdi:arrow-oscillating", active: swing === k,
      on: () => {
        if (off || una) return;
        this.haptic();
        this.pending.set(true);
        this.call("climate", "set_swing_mode", { swing_mode: k }, cfg.entity);
      },
    }));
    const preset = e?.attributes.preset_mode;
    const allPresets = (e?.attributes.preset_modes as string[] | undefined) ?? [];
    const presets = allPresets.filter((k) => !cfg.preset_modes?.length || cfg.preset_modes.includes(k)).map((k) => ({
      k, label: PRESETS[k] ? t(PRESETS[k][0]) : k, ic: PRESETS[k]?.[1] ?? "mdi:tune-variant", active: preset === k,
      on: () => {
        if (una) return;
        this.haptic();
        this.pending.set(true);
        this.call("climate", "set_preset_mode", { preset_mode: k }, cfg.entity);
      },
    }));
    const power = () => {
      if (busy || una) return;
      this.haptic();
      this.pending.set(true);
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
    const modeLabel = (m: string) => (MODES[m] ? label(m) : t(MODE_LABEL[m] ?? m));
    const roomPart = cfg.show_current_temp !== false && room !== "—" ? t("card.climate.in_room", { t: room }) : "";
    const head = una ? t("card.climate.unavailable") : busy ? t("common.sending_command") : off ? t("card.climate.off") : modeLabel(mode);
    const state = [head, roomPart].filter(Boolean).join(" · ");
    const roomLine = t("card.climate.room", { t: room });
    const act = una || off ? undefined : ACTIONS[String(e?.attributes.hvac_action ?? "")];
    const action = act ? { label: t(act[0]), color: act[1], pulse: act[2] } : null;
    // Compact line: what it does now (hvac_action, else the mode) and the room.
    const short = [una ? t("card.climate.unavailable") : off ? t("card.climate.off") : action?.label ?? modeLabel(mode), cfg.show_current_temp !== false && room !== "—" ? room : ""].filter(Boolean).join(" · ");
    const r = this.rangeTarget ?? this.range(e);
    const range = r ? { low: formatTemp(r.low, f), high: formatTemp(r.high, f) } : null;
    const lim = e ? this.limits(e) : null;
    const stepVal = e ? this.stepOf(e) : f ? 1 : 0.5;
    const rangeLine = lim ? t("card.climate.range", { min: formatTemp(lim[0]).replace("°", ""), max: formatTemp(lim[1]).replace("°", ""), unit: f ? "°F" : "°C", step: Number.isInteger(stepVal) ? String(stepVal) : formatNumber(stepVal) }) : "";
    const heatOnly = hvac.every((m) => m === "heat" || m === "off");
    const ic = cfg.icon ?? (mode === "heat_cool" || mode === "auto" ? "mdi:thermostat-auto" : heatOnly ? "mdi:radiator" : "mdi:air-conditioner");
    const bat = cfg.show_battery === false ? null : batteryLevel(e, this.entity(cfg.battery_entity), cfg.battery_low ?? BATTERY_LOW);
    const battery = bat?.low ? (bat.pct === null ? t("card.climate.battery_low") : t("card.climate.battery_pct", { pct: Math.round(bat.pct) })) : "";
    const batteryPct = bat?.low && bat.pct !== null ? `${Math.round(bat.pct)}%` : "";
    // The setpoint is on its way: waiting for the debounce, or sent and not confirmed yet.
    const sending = this.acQueued || (!!this.acSentAt && (this.acTarget !== null || this.rangeTarget !== null));
    return { c, ic, mode, off, una, busy, target: formatTemp(target, f), range, modes, fans, swings, presets, power, state, short, roomLine, room, action, rangeLine, sel, battery, batteryPct, heatOnly, sending };
  }

  private get name() {
    return this._config.name || this.entity(this._config.entity)?.attributes.friendly_name || t("card.climate.name");
  }

  /** Setpoint: one number, or low–high with the end the ± buttons move picked by a tap (FAB dialog). */
  private setpoint(a: ReturnType<LumenClimateCard["ac"]>, size: number, color = "inherit") {
    const num = (v: string, side?: "low" | "high") => {
      const on = !side || this._side === side;
      return side
        ? html`<button aria-pressed=${on} aria-label=${side === "low" ? t("card.climate.low") : t("card.climate.high")} @click=${() => (this._side = side)} style="border:0;background:transparent;padding:0 2px;cursor:pointer;font:300 ${size}px/1 var(--lumen-font);letter-spacing:-0.04em;font-variant-numeric:tabular-nums;color:${color};opacity:${on ? 1 : 0.4};transition:opacity 200ms">${v}</button>`
        : html`<span style="font-size:${size}px;font-weight:300;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums;color:${color}">${v}</span>`;
    };
    return a.range ? html`<span style="display:inline-flex;align-items:baseline;gap:2px">${num(a.range.low, "low")}<span style="font-size:${size * 0.6}px;opacity:.5">–</span>${num(a.range.high, "high")}</span>` : num(a.target);
  }

  /** heat_cool: two fields, the selected one is raised and moved by −/+; a tap on the other selects it. */
  private rangeFields(a: ReturnType<LumenClimateCard["ac"]>) {
    const field = (side: "low" | "high", label: string, color: string, v: string) => {
      const on = this._side === side;
      return html`<button aria-pressed=${on ? "true" : "false"} aria-label="${label} ${v}" @click=${() => (this._side = side)}
        style="display:flex;flex-direction:column;align-items:center;padding:6px 4px;border:0;border-radius:16px;background:${on ? "var(--lumen-surface-solid)" : "transparent"};box-shadow:${on ? "var(--lumen-shadow-1)" : "none"};color:var(--lumen-text-1);cursor:pointer;font-family:inherit;transition:background-color 200ms, box-shadow 200ms">
        <span style="font-size:11px;font-weight:700;color:${color}">${label}</span><span style="font-size:30px;font-weight:300;letter-spacing:-0.04em;line-height:1.1;font-variant-numeric:tabular-nums">${v}</span></button>`;
    };
    return html`<div style="display:flex;align-items:center;gap:8px;opacity:${a.off ? 0.4 : 1};transition:opacity 400ms">
      <button class="press" aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style="${STEP_BTN};flex:none;width:44px">${icon("mdi:minus")}</button>
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px">${field("low", t("card.climate.heat_to"), "var(--lumen-orange)", a.range!.low)}${field("high", t("card.climate.cool_from"), "var(--lumen-info)", a.range!.high)}</div>
      <button class="press" aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style="${STEP_BTN};flex:none;width:44px">${icon("mdi:plus")}</button>
    </div>`;
  }

  private card() {
    const a = this.ac();
    const cfg = this._config;
    const seg = (o: { label: string; ic: string; active: boolean; on: () => void }, color: string, column = false) =>
      html`<button aria-pressed=${o.active} @click=${o.on} style="${column ? "flex:1;min-width:0;flex-direction:column;gap:1px;font:700 11px var(--lumen-font);" : "gap:6px;font:700 12px var(--lumen-font);"}min-height:44px;padding:0 4px;display:flex;align-items:center;justify-content:center;border:0;border-radius:12px;${a.sel(o.active, color)};cursor:pointer;white-space:nowrap;transition:background-color 300ms, color 300ms">${icon(o.ic, column ? "font-size:17px;line-height:18px" : "font-size:16px")}<span style="overflow:hidden;text-overflow:ellipsis">${o.label}</span></button>`;
    // Up to 4 modes in one row, more in a grid of 3 (catalog section 09).
    const cols = a.modes.length <= 4 ? a.modes.length : 3;
    const fanSelect = html`<label style="display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-radius:16px;background:var(--lumen-surface-2);opacity:${a.off ? 0.4 : 1}">
      ${icon(a.fans.find((o) => o.active)?.ic ?? "mdi:fan", "font-size:18px;color:var(--lumen-text-2)")}
      <select aria-label=${t("card.climate.fans")} ?disabled=${a.off || a.una} @change=${(ev: Event) => a.fans.find((o) => o.k === (ev.target as HTMLSelectElement).value)?.on()}
        style="flex:1;min-width:0;height:40px;border:0;background:transparent;color:var(--lumen-text-1);font:700 13px var(--lumen-font);cursor:pointer;outline:none">${a.fans.map((o) => html`<option value=${o.k} ?selected=${o.active}>${o.label}</option>`)}</select>
    </label>`;
    return html`<div data-fx style="padding:16px;border-radius:22px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};box-shadow:var(--lumen-shadow-1);display:flex;flex-direction:column;gap:14px">${WFX}
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:none;width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb, ${a.c} 16%, transparent);color:${a.c};transition:background-color 500ms, color 500ms">${icon(a.ic)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;line-height:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.name}</div><div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.state}</div></div>
        <button class="press" @click=${a.power} aria-label=${t("card.climate.power")} aria-pressed=${a.off ? "false" : "true"} style="flex:none;width:48px;height:48px;border-radius:50%;border:0;display:grid;place-items:center;font-size:22px;background:${a.off ? "var(--lumen-surface-2)" : "var(--lumen-accent)"};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};cursor:pointer;transition:background-color 400ms, color 400ms, transform 220ms var(--lumen-ease-spring)">${icon("mdi:power", `display:block;animation:${a.busy ? "lumenBreath 1200ms ease-in-out infinite" : "none"}`)}</button>
      </div>
      ${(a.action && cfg.show_action !== false) || a.battery
        ? html`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 -2px 52px">${a.action && cfg.show_action !== false
            ? html`<span role="status" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:color-mix(in srgb, ${a.action.color} 14%, transparent);color:${a.action.color};font:750 12px var(--lumen-font)"><span style="width:7px;height:7px;border-radius:50%;background:${a.action.color};animation:${a.action.pulse ? "lumenBreath 2.4s ease-in-out infinite" : "none"}"></span>${a.action.label}</span>`
            : nothing}${a.battery ? batteryBadge(a.battery) : nothing}</div>`
        : nothing}
      ${a.range
        ? this.rangeFields(a)
        : html`<div style="display:flex;align-items:center;justify-content:space-between;opacity:${a.off ? 0.4 : 1};transition:opacity 400ms">
            <button class="press" aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style="${STEP_BTN};width:48px">${icon("mdi:minus")}</button>
            <div style="text-align:center"><div style="font-size:40px;font-weight:300;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums">${a.target}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-3);margin-top:4px">${t("card.climate.target")}</div></div>
            <button class="press" aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style="${STEP_BTN};width:48px">${icon("mdi:plus")}</button>
          </div>`}
      ${cfg.show_modes !== false && a.modes.length ? html`<div style=${SECTION}>${t("card.climate.modes")}</div>
      <div class="modes" role="group" aria-label=${t("card.climate.modes")} style="display:grid;grid-template-columns:repeat(${cols}, minmax(0,1fr));gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2)">${a.modes.map((o) => seg(o, o.color))}</div>` : nothing}
      ${cfg.show_fan_modes !== false && a.fans.length ? html`<div style=${SECTION}>${t("card.climate.fans")}</div>
      ${a.fans.length > 5 ? fanSelect : html`<div role="group" aria-label=${t("card.climate.fans")} style="display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2);opacity:${a.off ? 0.4 : 1};transition:opacity 400ms">${a.fans.map((o) => seg(o, "var(--lumen-text-1)", true))}</div>`}` : nothing}
      ${cfg.show_swing !== false && a.swings.length ? html`<div style=${SECTION}>${t("card.climate.swing")}</div>
      <div role="group" aria-label=${t("card.climate.swing")} style="display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2);opacity:${a.off ? 0.4 : 1}">${a.swings.map((o) => html`<div style="flex:1;min-width:0;display:flex">${seg(o, "var(--lumen-text-1)")}</div>`)}</div>` : nothing}
      ${cfg.show_presets !== false && a.presets.some((o) => o.k !== "none") ? html`<div style=${SECTION}>${t("card.climate.preset")}</div>
      <div role="group" aria-label=${t("card.climate.preset")} style="display:flex;flex-wrap:wrap;gap:6px">${a.presets.map(
        (o) => html`<button aria-pressed=${o.active} @click=${o.on} style="display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px 0 10px;border-radius:999px;background:${o.active ? "var(--lumen-accent-soft)" : "transparent"};color:${o.active ? "var(--lumen-accent)" : "var(--lumen-text-2)"};border:${o.active ? "1px solid color-mix(in srgb, var(--lumen-accent) 40%, transparent)" : "1px solid var(--lumen-border)"};font:700 12px var(--lumen-font);cursor:pointer">${icon(o.ic, "font-size:15px")}${o.label}</button>`,
      )}</div>` : nothing}
      ${cfg.show_range && a.rangeLine ? html`<div style="font:500 11px var(--lumen-mono);color:var(--lumen-text-3)">${a.rangeLine}</div>` : nothing}
    </div>`;
  }

  /**
   * Compact row (under 300 px, and the thermostat row of the floating panel, catalog sections 09
   * and 19): icon, name with the low-battery chip, what it does now · the room, −, setpoint, +.
   */
  private compactRow() {
    const a = this.ac();
    const cfg = this._config;
    const e = this.entity(cfg.entity);
    const value = a.una ? "—" : a.range ? (this._side === "low" ? a.range.low : a.range.high) : a.target;
    // Narrow cells (e.g. 3 columns): drop the name under 240 px (a low battery is then a dot on
    // the icon), then −/+ under 192 px – the narrowest the icon and −/value/+ fit in (the
    // catalog says 170; between the two the + would stick out). The icon still opens the details.
    const w = this._width;
    const named = !w || w >= 240, stepper = !w || w >= 192;
    const act = String(e?.attributes.hvac_action ?? "");
    const heating = !a.una && !a.off && (act === "heating" || act === "preheating");
    const cooling = !a.una && !a.off && act === "cooling";
    // Heat-only devices are radiators (on / off glyph); air conditioners keep their mode icon.
    const glyph = cfg.icon ?? (a.heatOnly ? (a.off || a.una ? "mdi:radiator-off" : "mdi:radiator") : a.ic);
    const tint = a.una ? "var(--lumen-unavailable)" : a.off ? "var(--lumen-text-3)" : heating ? "var(--lumen-orange)" : cooling ? "var(--lumen-info)" : a.heatOnly ? "var(--lumen-text-2)" : a.c;
    const tintBg = a.una ? "transparent" : heating || cooling || (!a.off && !a.heatOnly) ? `color-mix(in srgb, ${tint} 16%, transparent)` : "color-mix(in srgb, var(--lumen-text-3) 14%, transparent)";
    const head = a.una
      ? t(a.heatOnly ? "card.climate.thermostat_unavailable" : "card.climate.unavailable")
      : a.off
        ? t(a.heatOnly ? "card.climate.thermostat_off" : "card.climate.off")
        : a.sending
          ? t("card.climate.sending")
          : a.action?.label ?? a.short.split(" · ")[0];
    const headColor = a.una ? "var(--lumen-text-3)" : (heating || cooling) && !a.sending ? a.action!.color : "var(--lumen-text-2)";
    const room = !a.una && cfg.show_current_temp !== false && a.room !== "—" ? (w && w < 320 ? a.room : t("card.climate.in_room", { t: a.room })) : "";
    const inert = a.off || a.una;
    const btn = `flex:none;width:40px;height:40px;border-radius:12px;border:0;padding:0;display:grid;place-items:center;background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:20px;opacity:1;cursor:${inert ? "default" : "pointer"}`;
    const title = a.battery ? `${this.name} · ${a.battery}` : this.name;
    return html`<div data-fx title=${title} style="position:relative;display:flex;align-items:center;gap:8px;min-height:56px;padding:8px 8px 8px 10px;box-sizing:border-box;border-radius:20px;background:${a.una ? "var(--lumen-surface-2)" : "var(--lumen-surface)"};border:${a.una ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};${a.una ? "" : glass};box-shadow:${a.una ? "none" : "var(--lumen-sheet-row-shadow, var(--lumen-shadow-1))"}">${WFX}
      <button class="press" ${pressable(this.presses.handlers(`power:${cfg.entity}`, () => a.power(), () => this.moreInfo(cfg.entity)))} aria-label="${title} · ${t(a.off ? "card.climate.tap_on" : "card.climate.tap_off")}" title="${t(a.off ? "card.climate.tap_on" : "card.climate.tap_off")}" aria-pressed=${a.off ? "false" : "true"} style="position:relative;flex:none;width:34px;height:34px;border-radius:12px;border:0;padding:0;display:grid;place-items:center;font-size:19px;background:${tintBg};color:${tint};cursor:pointer;transition:background-color 400ms, color 400ms">${icon(glyph, "display:block")}${!named && a.battery
        ? html`<span aria-hidden="true" style="position:absolute;top:-3px;right:-3px;width:10px;height:10px;box-sizing:content-box;border-radius:50%;background:var(--lumen-warning);border:2px solid var(--lumen-surface-solid)"></span>`
        : nothing}</button>
      ${named
        ? html`<div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:14px;font-weight:700;line-height:18px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.name}</span>${a.battery ? batteryChip(a.batteryPct, a.battery) : nothing}</div>
            <div style="font-size:12px;font-weight:650;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums"><span style="color:${headColor}">${head}</span>${room ? ` · ${room}` : ""}</div>
          </div>`
        : nothing}
      <div style="flex:none;display:flex;align-items:center;gap:2px;margin-left:auto;opacity:${inert ? 0.38 : 1};transition:opacity 300ms">
        ${stepper ? html`<button class="press" ?disabled=${inert} aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style=${btn}>${icon("mdi:minus")}</button>` : nothing}
        <span aria-live="polite" style="flex:none;min-width:${stepper ? 46 : 0}px;text-align:center;font-size:20px;font-weight:650;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;color:${a.sending ? "var(--lumen-text-3)" : "var(--lumen-text-1)"};transition:color 300ms">${value}</span>
        ${stepper ? html`<button class="press" ?disabled=${inert} aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style=${btn}>${icon("mdi:plus")}</button>` : nothing}
      </div>
      ${a.sending && stepper ? html`<span aria-hidden="true" style=${spinnerStyle(10, "position:absolute;top:7px;right:56px")}></span>` : nothing}
    </div>`;
  }

  /** AC FAB (B9): tap = dialog, hold 550 ms = power with a toast. */
  private fab() {
    const a = this.ac();
    const place = this.floating.place();
    // the setpoint to the nearest half degree: 21.76 → "22°", 21.5 → "21,5°" (smaller digits)
    const half = this.disp === undefined ? undefined : Math.round(this.disp * 2) / 2;
    const whole = half === undefined || Number.isInteger(half);
    const short = half === undefined ? "—" : `${whole ? String(half) : formatNumber(half)}°`;
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
      this.sheet.show();
    };
    return html`<button class="press acfab" @pointerdown=${down} @pointerup=${cancel} @pointerleave=${cancel} @click=${tap} @pointercancel=${cancel} @contextmenu=${prevent}
      aria-label="${this.name} · ${t("card.climate.fab_hint")}" aria-haspopup="dialog" title="${this.name} · ${a.off ? t("card.climate.hold_on") : t("card.climate.hold_off")}"
      style="position:absolute;${place.edge};bottom:${place.bottom};z-index:5;width:48px;height:48px;padding:0;border-radius:50%;border:0;background:${a.off ? "var(--lumen-surface-solid)" : a.c};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};font-size:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:none;${glass};box-shadow:var(--lumen-shadow-2);transition:background-color 400ms, color 400ms, transform 260ms var(--lumen-ease-spring)">
      ${a.off
        ? icon(this._config.icon ?? "mdi:air-conditioner", `display:block;${anim}`)
        : html`<span style="display:flex;flex-direction:column;align-items:center;gap:1px;${anim}">${icon(a.mode === "heat" ? "mdi:fire" : "mdi:snowflake", "font-size:13px;line-height:13px;opacity:.85")}<span style="font-size:${whole ? 14 : 12}px;font-weight:800;line-height:15px;letter-spacing:-0.03em;font-variant-numeric:tabular-nums">${short}</span></span>`}
    </button>`;
  }

  /** Mobile AC dialog (B9): power, setpoint, mode and fan. */
  private dialog() {
    const a = this.ac();
    const cfg = this._config;
    const seg = (o: { label: string; ic: string; active: boolean; on: () => void }, color: string) =>
      html`<button aria-pressed=${o.active} @click=${o.on} style="flex:1;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;border-radius:13px;${a.sel(o.active, color)};font:700 11px var(--lumen-font);cursor:pointer;transition:background-color 300ms, color 300ms">${icon(o.ic, "font-size:17px")}${o.label}</button>`;
    const step = "width:56px;height:56px;border-radius:18px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-1);font-size:24px;display:grid;place-items:center;cursor:pointer";
    return this.sheet.render(
      { title: this.name, sub: a.state, lead: html`<button class="press" @click=${a.power} aria-label=${t("card.climate.power")} style="flex:none;width:44px;height:44px;border-radius:14px;border:0;display:grid;place-items:center;font-size:20px;background:${a.off ? "var(--lumen-surface-2)" : a.c};color:${a.off ? "var(--lumen-text-2)" : "var(--lumen-on-accent)"};cursor:pointer;transition:background-color 400ms">${icon("mdi:power", `display:block;animation:${a.busy ? "lumenBreath 1200ms ease-in-out infinite" : "none"}`)}</button>` },
      html`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px;opacity:${a.off ? 0.45 : 1};transition:opacity 400ms">
          <button class="press" aria-label=${t("card.climate.decrease")} @click=${() => this.step(-1)} style=${step}>${icon("mdi:minus")}</button>
          <div style="display:flex;flex-direction:column;align-items:center"><div style="line-height:1">${this.setpoint(a, 52, a.c)}</div>${cfg.show_current_temp !== false ? html`<div style="font-size:12px;font-weight:600;color:var(--lumen-text-3);margin-top:6px">${a.roomLine}</div>` : nothing}</div>
          <button class="press" aria-label=${t("card.climate.increase")} @click=${() => this.step(1)} style=${step}>${icon("mdi:plus")}</button>
        </div>
        ${cfg.show_modes !== false && a.modes.length ? html`<div role="group" aria-label=${t("card.climate.modes")} style="display:flex;gap:2px;padding:3px;border-radius:16px;background:var(--lumen-surface-2)">${a.modes.map((o) => seg(o, o.color))}</div>` : nothing}
        ${cfg.show_fan_modes !== false && a.fans.length ? html`<div style="opacity:${a.off ? 0.45 : 1};transition:opacity 400ms"><div role="group" aria-label=${t("card.climate.fans")} style="display:flex;gap:2px;padding:3px;border-radius:16px;background:var(--lumen-surface-2)">${a.fans.map((o) => seg(o, a.c))}</div></div>` : nothing}`,
      nothing,
      { body: "gap:12px;padding:12px 14px calc(16px + env(safe-area-inset-bottom))" },
    );
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    if (this.useFab) return nothing;
    return this.compact ? this.compactRow() : this.card();
  }

  static getStubConfig = entityStub("climate", "climate.example");

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
      nameIcon(),
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "min_temp", selector: { number: { min: 0, max: 100, step: 0.5, mode: "box" } } },
          { name: "max_temp", selector: { number: { min: 0, max: 100, step: 0.5, mode: "box" } } },
          { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box", unit_of_measurement: "°" } } },
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
      {
        name: "preset_modes",
        selector: { select: { multiple: true, mode: "list", custom_value: true, options: Object.keys(PRESETS).map((value) => ({ value, label: t(PRESETS[value][0]) })) } },
      },
      // What the card shows: right under the mode / fan / preset lists, open by default.
      {
        name: "",
        type: "expandable",
        flatten: true,
        expanded: true,
        title: t("editor.visible_parts"),
        icon: "mdi:eye-outline",
        schema: [
          {
            name: "",
            type: "grid",
            flatten: true,
            schema: [
              { name: "show_modes", default: true, selector: { boolean: {} } },
              { name: "show_fan_modes", default: true, selector: { boolean: {} } },
              { name: "show_presets", default: true, selector: { boolean: {} } },
              { name: "show_swing", default: true, selector: { boolean: {} } },
              { name: "show_current_temp", default: true, selector: { boolean: {} } },
              { name: "show_action", default: true, selector: { boolean: {} } },
              { name: "show_battery", default: true, selector: { boolean: {} } },
              { name: "show_range", default: false, selector: { boolean: {} } },
            ],
          },
        ],
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
              { name: "battery_entity", selector: { entity: { domain: ["sensor", "binary_sensor"] } } },
              { name: "battery_low", selector: { number: { min: 1, max: 99, step: 1, mode: "box", unit_of_measurement: "%" } } },
            ],
          },
          hapticsField,
          { name: "styles", selector: { text: { multiline: true } } },
        ],
      },
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-climate-card", LumenClimateCard, {
  name: "card.climate.name",
  description: "card.climate.description",
  domains: ["climate"],
});
