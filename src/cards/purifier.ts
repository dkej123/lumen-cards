import { css, html, nothing, svg, type TemplateResult } from "lit";
import type { ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Optimistic, CONFIRM_MS, SEND_DELAY_MS } from "../core/controllers/optimistic";
import { actions, appearance, form, select, type Schema } from "../core/form";
import { History } from "../core/history";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { pressable, spinnerStyle } from "../core/press";
import { registerCard } from "../core/register";
import { Sheet } from "../core/sheet";
import { glass, stop } from "../core/styles";
import { listOf } from "../core/validate";
import { isUnavailable, type HassEntity } from "../hass/types";
import { AIR_LEVELS, PM25, pm25Level } from "../logic/air";
import { formatTemp } from "../logic/format";
import {
  FAN_PRESET, FAN_SET_SPEED, MODE_ICONS, MODE_ICON_OTHER, WATER_LOW, bandOf, bandTone, deviceEntities, filterTone, filterUnit, findFilters, findReading, humanize, nearestStep, powerCall, presetCall, speedCall, speedSteps, waterTone,
  worstFilter, type FilterReading, type PurifierCall, type Reading, type SpeedConfig, type Tone,
} from "../logic/purifier";
import { sparkY } from "../logic/spark";
import { ageMs, formatDuration } from "../logic/time";

/** A control of the details sheet: an entity of the device, or a service with an attribute of the fan. */
export interface PurifierControl {
  name?: string;
  icon?: string;
  entity?: string;
  attribute?: string;
  service?: string;
  field?: string;
  kind?: "switch" | "segment" | "stepper";
  options?: ({ value: string | number; label?: string; icon?: string } | string | number)[];
  min?: number;
  max?: number;
  step?: number;
  /** Text of the stepper's lowest value (e.g. "Off"). */
  min_label?: string;
}

export interface PurifierFilter {
  name?: string;
  entity?: string;
  attribute?: string;
  unit?: string;
}

export interface PurifierConfig extends BaseConfig {
  entity: string;
  name?: string;
  hours?: number;
  stale_hours?: number;
  /** Seconds a change waits for HA before it is undone. */
  confirm_timeout?: number;
  /** Seconds of quiet after the last tap before a change goes to the device. */
  send_delay?: number;
  show_humidifier?: boolean;
  show_filters?: boolean;
  preset_modes?: string[];
  speeds?: SpeedConfig[];
  pm25_entity?: string;
  temperature_entity?: string;
  humidity_entity?: string;
  target_humidity_entity?: string;
  water_level_entity?: string;
  /** Binary sensor that is on when the tank is empty. */
  water_empty_entity?: string;
  /** Standard humidifier entity of the device. */
  humidifier_entity?: string;
  humidity_targets?: (number | string)[];
  /** Device service that sets the target humidity (no humidifier entity). */
  target_humidity_service?: { service?: string; field?: string };
  /** Humidifying is available only while this attribute of the fan contains the text. */
  humidifier_when?: { attribute?: string; contains?: string };
  /** A second air index beside PM2.5. */
  index?: { name?: string; entity?: string; attribute?: string; thresholds?: number[]; labels?: string[]; max?: number };
  filters?: PurifierFilter[];
  controls?: PurifierControl[];
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

const NARROW = 300;
const COMPACT_PILL = 200;
const TONE_VAR: Record<Tone, string> = { ok: "var(--lumen-ok)", info: "var(--lumen-info)", warning: "var(--lumen-warning)", orange: "var(--lumen-orange)", danger: "var(--lumen-danger)" };
const aq = (level: number) => `var(--lumen-aq-${level})`;
const LABEL = "font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)";
const MONO = "font:500 11px var(--lumen-mono);color:var(--lumen-text-3)";

export function validatePurifier(c: Partial<PurifierConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.purifier.error.entity"));
  if (!c.entity.startsWith("fan.")) throw new Error(t("card.purifier.error.domain"));
}

const has = (features: unknown, bit: number) => ((Number(features) || 0) & bit) !== 0;

/** A control ready to draw. */
interface Control {
  key: string;
  name: string;
  icon?: string;
  kind: "switch" | "segment" | "stepper";
  path: string;
  options: { value: unknown; label: string; icon?: string }[];
  min: number;
  max: number;
  step: number;
  minLabel?: string;
  /** The change for a new value. */
  change(value: unknown): { expected: Record<string, unknown>; send(): Promise<unknown> };
}

/**
 * Air purifier (and purifier with a humidifier) on any `fan` entity: power, presets and speed from
 * the fan itself, the rest shows when the device or the config has it. Everything device-specific
 * (own services, extra entities) is configuration, not code.
 */
export class LumenPurifierCard extends LumenBaseCard<PurifierConfig> {
  protected static grid = { columns: 12, min_columns: 6, rows: "auto" };
  protected static cardSize = 6;
  /** The card reads its width (wide / narrow) but `layout` alone makes it compact. */
  protected static compactBelow = 0;
  static properties = { ...LumenBaseCard.properties, _range: { state: true } };
  static styles = [
    LumenBaseCard.styles,
    css`
      @keyframes lumenPurifierFloat { 0%, 100% { transform: translateY(1.5px); } 50% { transform: translateY(-1.5px); } }
      @media (prefers-reduced-motion: reduce) { .float { animation: none !important; } }
    `,
  ];

  private _range?: number;
  private sheet = new Sheet(this, () => this.sheet.hide());
  private opt = new Optimistic(
    this,
    (path) => this.live(path),
    () => (Number(this._config?.confirm_timeout) > 0 ? Number(this._config.confirm_timeout) * 1000 : CONFIRM_MS),
    () => (this._config?.send_delay !== undefined && Number.isFinite(Number(this._config.send_delay)) ? Number(this._config.send_delay) * 1000 : SEND_DELAY_MS),
  );
  private history = new History(this, () => [this.pm?.entity, this.indexReading?.entity, this.humidity?.entity], undefined, 48);

  protected layer = new LayerController(this, () => (this.sheet.open && !this.preview ? this.details() : nothing), () => this.sheet.hide());

  getGridOptions(): Record<string, unknown> {
    return this._config?.layout === "compact" ? { columns: 6, min_columns: 3, rows: 1 } : { ...GRID.row, columns: 12, min_columns: 6 };
  }

  protected validate(c: PurifierConfig) {
    validatePurifier(c);
  }

  protected entityIds() {
    const c = this._config;
    return [
      c.entity, c.pm25_entity, c.temperature_entity, c.humidity_entity, c.target_humidity_entity, c.water_level_entity, c.water_empty_entity, c.humidifier_entity, c.index?.entity,
      ...listOf<{ entity?: string }>(c.filters).map((f) => f.entity),
      ...listOf<{ entity?: string }>(c.controls).map((x) => x.entity),
      ...this.device,
      ...["pm2_5", "temperature", "humidity", "target_humidity", "water_level"].map((s) => `sensor.${c.entity?.split(".")[1]}_${s}`),
    ];
  }

  // ---------------------------------------------------------------- data

  private get device(): string[] {
    return deviceEntities(this._hass?.entities, this._config?.entity);
  }

  private get fan(): HassEntity | undefined {
    return this.entity(this._config?.entity);
  }

  private live(path: string): unknown {
    const [id, attr] = path.split("|");
    const e = this.entity(id);
    return attr === "state" ? e?.state : e?.attributes[attr];
  }

  /** A value of the fan, a pending change first. */
  private f(attr: string): unknown {
    return this.opt.value(`${this._config.entity}|${attr}`);
  }

  private reading(o: { configured?: string; deviceClass?: string; suffix: string; attrs: string[] }): Reading | undefined {
    return this._hass && this._config?.entity ? findReading(this._hass.states, this._config.entity, this.device, o) : undefined;
  }

  private get pm() {
    return this.reading({ configured: this._config?.pm25_entity, deviceClass: "pm25", suffix: "pm2_5", attrs: ["pm25", "pm2_5", "pm_2_5"] });
  }

  private get temperature() {
    return this.reading({ configured: this._config?.temperature_entity, deviceClass: "temperature", suffix: "temperature", attrs: ["temperature"] });
  }

  private get humidifierEntity() {
    return this.entity(this._config?.humidifier_entity);
  }

  private get humidity(): Reading | undefined {
    const h = Number(this.humidifierEntity?.attributes.current_humidity);
    const found = this.reading({ configured: this._config?.humidity_entity, deviceClass: "humidity", suffix: "humidity", attrs: ["humidity"] });
    return found ?? (Number.isFinite(h) && this.humidifierEntity?.attributes.current_humidity != null ? { value: h } : undefined);
  }

  /** Current target humidity: a pending change, then the humidifier, a sensor, the fan. */
  private get target(): number | undefined {
    const c = this._config;
    if (c.humidifier_entity) {
      const v = Number(this.opt.value(`${c.humidifier_entity}|humidity`));
      return Number.isFinite(v) ? v : undefined;
    }
    const pending = this.f("target_humidity");
    if (pending !== undefined && pending !== null && Number.isFinite(Number(pending))) return Number(pending);
    return this.reading({ configured: c.target_humidity_entity, suffix: "target_humidity", attrs: [] })?.value;
  }

  private get water() {
    return this.reading({ configured: this._config?.water_level_entity, suffix: "water_level", attrs: ["water_level"] });
  }

  private get waterEmpty(): boolean {
    return this.entity(this._config?.water_empty_entity)?.state === "on";
  }

  private get indexReading(): Reading | undefined {
    const i = this._config?.index;
    if (!i?.entity && !i?.attribute) return undefined;
    return this.reading({ configured: i.entity, suffix: "__none", attrs: i.attribute ? [i.attribute] : [] });
  }

  private get humidifierOn(): boolean {
    const c = this._config;
    if (c.show_humidifier === false || !this.humidity) return false;
    const when = c.humidifier_when;
    return !when?.attribute || String(this.f(when.attribute) ?? "").includes(when.contains ?? "");
  }

  private get filters(): FilterReading[] {
    const c = this._config;
    if (c.show_filters === false || !this._hass) return [];
    const own = listOf<PurifierFilter>(c.filters);
    const list = own.length ? own : findFilters(this._hass.states, c.entity, this.device);
    return list.flatMap((x) => {
      const e = this.entity(x.entity);
      const raw = x.attribute ? this.fan?.attributes[x.attribute] : e?.state;
      const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(value)) return [];
      const unit = filterUnit(x.unit ?? e?.attributes.unit_of_measurement ?? "%");
      return [{ name: x.name || String(e?.attributes.friendly_name ?? t("card.purifier.filter.default")), value, unit, tone: filterTone(value, unit) }];
    });
  }

  private get on(): boolean {
    return this.f("state") === "on";
  }

  private get modes(): string[] {
    const own = Array.isArray(this.fan?.attributes.preset_modes) ? (this.fan!.attributes.preset_modes as string[]) : [];
    if (!has(this.fan?.attributes.supported_features, FAN_PRESET) || !own.length) return [];
    const wanted = this._config.preset_modes;
    return Array.isArray(wanted) && wanted.length ? wanted.filter((m) => own.includes(m)) : own;
  }

  private get steps() {
    return has(this.fan?.attributes.supported_features, FAN_SET_SPEED) ? speedSteps(this.fan?.attributes.percentage_step, this._config.speeds) : [];
  }

  private get stale(): number | null {
    const hours = Number(this._config.stale_hours ?? 2);
    const e = this.entity(this.pm?.entity) ?? this.fan;
    if (!(hours > 0) || !e) return null;
    const age = ageMs(e.last_reported ?? e.last_updated);
    return age >= hours * 3_600_000 ? age : null;
  }

  private modeName(m: string): string {
    return m in MODE_ICONS ? t(`card.purifier.mode.${m}`) : humanize(m);
  }

  private get name(): string {
    return this._config.name ?? String(this.fan?.attributes.friendly_name ?? t("card.purifier.name"));
  }

  private stateLine(): string {
    if (isUnavailable(this.fan)) return t("common.unavailable");
    if (!this.on) return t("card.purifier.label.state_off");
    const mode = this.f("preset_mode") as string | null | undefined;
    const speed = nearestStep(this.steps, this.f("percentage"))?.name;
    const first = mode ? this.modeName(mode) : speed ? t("card.purifier.mode.manual") : t("common.on");
    return speed && (!mode || mode === "manual") ? `${first} · ${speed}` : first;
  }

  // ---------------------------------------------------------------- actions

  private run(key: string, label: string, c: PurifierCall) {
    const id = this._config.entity;
    const path = (k: string) => `${id}|${k}`;
    this.haptic();
    this.opt.apply({
      key,
      label,
      expected: Object.fromEntries(Object.entries(c.expected).map(([k, v]) => [path(k), v])),
      confirm: c.confirm.map(path),
      send: () => this._hass!.callService(c.domain, c.service, c.data, { entity_id: id }),
    });
  }

  private togglePower = () => this.run("power", t("card.purifier.label.power"), powerCall(!this.on));
  private openDetails = () => {
    this.haptic();
    this.sheet.show();
  };

  private setMode(m: string) {
    this.run("mode", this.modeName(m), presetCall(m, this.on));
  }

  private setSpeed(p: number, name: string) {
    this.run("speed", `${t("card.purifier.label.speed")} ${name}`, speedCall(p, this.on, Array.isArray(this.fan?.attributes.preset_modes) ? (this.fan!.attributes.preset_modes as string[]) : []));
  }

  private setTarget(v: number) {
    const c = this._config;
    const label = t("card.purifier.label.target");
    this.haptic();
    if (c.humidifier_entity) {
      this.opt.apply({ key: "target", label, expected: { [`${c.humidifier_entity}|humidity`]: v }, send: () => this._hass!.callService("humidifier", "set_humidity", { humidity: v }, { entity_id: c.humidifier_entity }) });
      return;
    }
    const svc = c.target_humidity_service;
    if (!svc?.service) return;
    const [domain, service] = svc.service.split(".", 2);
    this.opt.apply({ key: "target", label, expected: { [`${c.entity}|target_humidity`]: v }, send: () => this._hass!.callService(domain, service, { [svc.field ?? "humidity"]: v }, { entity_id: c.entity }) });
  }

  private get canSetTarget(): boolean {
    return !!this._config.humidifier_entity || !!this._config.target_humidity_service?.service;
  }

  /** The configured controls in one shape. */
  private controls(): Control[] {
    return listOf<PurifierControl>(this._config.controls).flatMap((x, i): Control[] => {
      const key = `control:${i}`;
      const base = { key, icon: x.icon, min: Number(x.min ?? 0), max: Number(x.max ?? 100), step: Number(x.step ?? 1), minLabel: x.min_label };
      const options = (x.options ?? []).map((o) => (typeof o === "object" ? { value: o.value, label: o.label ?? String(o.value), icon: o.icon } : { value: o, label: String(o) }));
      if (x.entity) {
        const e = this.entity(x.entity);
        if (!e) return [];
        const domain = x.entity.split(".")[0];
        const name = x.name ?? String(e.attributes.friendly_name ?? x.entity);
        const send = (d: string, s: string, data: Record<string, unknown>) => () => this._hass!.callService(d, s, data, { entity_id: x.entity });
        if (domain === "select" || domain === "input_select") {
          const list = (e.attributes.options as string[] | undefined) ?? [];
          return [{ ...base, name, kind: "segment", path: `${x.entity}|state`, options: options.length ? options : list.map((o) => ({ value: o, label: humanize(o) })), change: (v) => ({ expected: { [`${x.entity}|state`]: v }, send: send(domain, "select_option", { option: v }) }) }];
        }
        if (domain === "number" || domain === "input_number") {
          return [{ ...base, name, kind: "stepper", path: `${x.entity}|state`, options: [], min: Number(x.min ?? e.attributes.min ?? 0), max: Number(x.max ?? e.attributes.max ?? 100), step: Number(x.step ?? e.attributes.step ?? 1), change: (v) => ({ expected: { [`${x.entity}|state`]: String(v) }, send: send(domain, "set_value", { value: v }) }) }];
        }
        return [{ ...base, name, kind: "switch", path: `${x.entity}|state`, options: [], change: (v) => ({ expected: { [`${x.entity}|state`]: v ? "on" : "off" }, send: send("homeassistant", v ? "turn_on" : "turn_off", {}) }) }];
      }
      if (!x.service || !x.attribute || !x.field) return [];
      const [d, s] = x.service.split(".", 2);
      const path = `${this._config.entity}|${x.attribute}`;
      const kind = x.kind ?? (options.length ? "segment" : x.max !== undefined ? "stepper" : "switch");
      return [{ ...base, name: x.name ?? humanize(x.attribute), kind, path, options, change: (v) => ({ expected: { [path]: v }, send: () => this._hass!.callService(d, s, { [x.field!]: v }, { entity_id: this._config.entity }) }) }];
    });
  }

  private setControl(c: Control, value: unknown) {
    this.haptic();
    this.opt.apply({ key: c.key, label: c.name, ...c.change(value) });
  }

  // ---------------------------------------------------------------- small parts

  private spinner(key: string) {
    return this.opt.pending(key) ? html`<span aria-hidden="true" style="${spinnerStyle(8, "position:absolute;top:4px;right:4px;border-width:1.5px")}"></span>` : nothing;
  }

  private seg(o: { key?: string; active: boolean; dashed?: boolean; label: unknown; title?: string; ic?: string; column?: boolean; on: () => void; content?: unknown; small?: boolean }) {
    return html`<button aria-pressed=${o.active} title=${o.title ?? nothing} @click=${o.on} style="position:relative;flex:1;min-width:0;min-height:44px;display:flex;flex-direction:${o.column ? "column" : "row"};align-items:center;justify-content:center;gap:${o.column ? 2 : 6}px;padding:4px;box-sizing:border-box;border:0;border-radius:12px;background:${o.active ? "var(--lumen-surface-solid)" : "transparent"};box-shadow:${o.active ? "var(--lumen-shadow-1)" : "none"};outline:${o.dashed ? "1.5px dashed var(--lumen-accent)" : "none"};outline-offset:-2px;color:${o.active ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};font:700 ${o.small ? 11 : 12}px var(--lumen-font);cursor:pointer;transition:background-color 200ms">
      ${o.ic ? icon(o.ic, "font-size:16px") : nothing}${o.content ?? nothing}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.label}</span>${o.key ? this.spinner(o.key) : nothing}
    </button>`;
  }

  private group(items: unknown, columns: number, label: string) {
    return html`<div role="group" aria-label=${label} style="display:grid;grid-template-columns:repeat(${columns}, minmax(0, 1fr));gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2)">${items}</div>`;
  }

  private power(size: number) {
    const unavailable = isUnavailable(this.fan);
    if (unavailable) return html`<span style="flex:none;width:${size}px;height:${size}px;display:grid;place-items:center;font-size:20px;color:var(--lumen-unavailable)">${icon("mdi:power-plug-off-outline")}</span>`;
    const on = this.on;
    return html`<button class="press" aria-label=${t("card.purifier.label.power")} aria-pressed=${on} @click=${(e: Event) => {
      e.stopPropagation();
      this.togglePower();
    }} @pointerdown=${stop} @pointerup=${stop} style="position:relative;flex:none;width:${size}px;height:${size}px;border-radius:50%;border:0;display:grid;place-items:center;font-size:${size > 44 ? 22 : 20}px;background:${on ? "var(--lumen-accent)" : "var(--lumen-surface-2)"};color:${on ? "var(--lumen-on-accent)" : "var(--lumen-text-2)"};cursor:pointer;transition:background-color 300ms">
      ${icon("mdi:power")}${this.opt.pending("power") ? html`<span aria-hidden="true" style="position:absolute;inset:-3px;border-radius:50%;border:2px solid transparent;border-top-color:var(--lumen-accent);animation:lumenSpin 800ms linear infinite"></span>` : nothing}
    </button>`;
  }

  private pills(narrow: boolean) {
    const out: TemplateResult[] = [];
    const pill = (c: string | null, ic: string | null, text: string, pulse = false) =>
      html`<span role="status" style="display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:0 10px 0 ${ic || pulse ? 7 : 10}px;box-sizing:border-box;border-radius:999px;background:${c ? `color-mix(in srgb, ${c} 18%, transparent)` : "var(--lumen-surface-2)"};color:${c ?? "var(--lumen-text-2)"};font-size:12px;font-weight:750">${pulse ? html`<span style="width:7px;height:7px;border-radius:50%;background:currentColor;animation:lumenPendingPulse 1.8s infinite"></span>` : nothing}${ic ? icon(ic, "font-size:14px") : nothing}${text}</span>`;
    const stale = this.stale;
    if (stale !== null) out.push(pill(TONE_VAR.warning, "mdi:clock-alert-outline", t("card.purifier.msg.stale", { age: formatDuration(stale) })));
    const water = this.water?.value;
    const empty = this.waterEmpty || (water !== undefined && water <= WATER_LOW);
    const hum = this.humidity?.value;
    const target = this.target;
    const action = this.humidifierEntity?.attributes.action;
    if (this.humidifierOn && this.on && !empty && (action === "humidifying" || (action === undefined && hum !== undefined && target !== undefined && hum < target))) out.push(pill(TONE_VAR.info, null, t("card.purifier.msg.humidifying"), true));
    if (empty && this.humidifierOn) out.push(pill(TONE_VAR.danger, "mdi:water-alert-outline", t("card.purifier.msg.refill")));
    const worst = worstFilter(this.filters);
    if (worst?.tone === "danger") out.push(pill(TONE_VAR.danger, "mdi:air-filter", t("card.purifier.msg.replace_filter", { name: worst.name === t("card.purifier.filter.default") ? "" : worst.name }).trim()));
    const left = Number(this.fan?.attributes.timer_remaining_minutes);
    if (left > 0) out.push(pill(null, "mdi:timer-outline", t("card.purifier.msg.timer_left", { t: formatDuration(left * 60_000) })));
    return out.length ? html`<div style="display:flex;flex-wrap:wrap;gap:6px;padding-left:${narrow ? 0 : 52}px">${out}</div>` : nothing;
  }

  private pmBlock(narrow: boolean, staleNow: boolean) {
    const pm = this.pm;
    if (!pm) return nothing;
    const level = pm25Level(pm.value);
    const color = staleNow ? "var(--lumen-unavailable)" : aq(level);
    const spark = pm.entity ? this.history.spark(pm.entity, this.history.span(pm.entity, Number(this._config.hours ?? 24)), 300, 90) : { line: "", area: "" };
    const idx = this.indexReading;
    const cfg = this._config.index;
    const age = this.entity(pm.entity) ?? this.fan;
    const band = idx ? bandOf(idx.value, cfg?.thresholds ?? []) : 0;
    const bands = (cfg?.thresholds?.length ?? 0) + 1;
    return html`<button class="press" aria-haspopup="dialog" aria-label="PM2.5 ${pm.value} µg/m³ · ${t(AIR_LEVELS[level].title)}" @click=${this.openDetails} style="position:relative;overflow:hidden;display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:0;border-radius:18px;background:var(--lumen-surface-2);color:inherit;font:inherit;text-align:left;cursor:pointer;width:100%;box-sizing:border-box">
      ${spark.line
        ? html`<svg aria-hidden="true" viewBox="0 0 300 90" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:0;width:100%;height:62%;color:${color};opacity:${staleNow ? 0.4 : 1};pointer-events:none">${svg`<path d=${spark.area} fill="currentColor" opacity="0.14"></path><path d=${spark.line} fill="none" stroke="currentColor" stroke-opacity="0.65" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>`}</svg>`
        : nothing}
      <div style="position:relative;display:flex;flex-wrap:${narrow ? "wrap" : "nowrap"};align-items:flex-end;justify-content:space-between;gap:8px 12px">
        <div style="min-width:0">
          <div style="${LABEL}">PM2.5 · <span style="text-transform:none">µg/m³</span></div>
          <div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px">
            <span style="font-size:${narrow ? 36 : 44}px;line-height:1.1;font-weight:300;font-variant-numeric:tabular-nums;color:${staleNow ? "var(--lumen-text-3)" : "inherit"}">${Math.round(pm.value)}</span>
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:750;color:${staleNow ? "var(--lumen-text-3)" : `color-mix(in oklch, ${color} var(--lumen-tone-k), var(--lumen-tone-mix))`}"><span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>${t(AIR_LEVELS[level].title)}</span>
          </div>
        </div>
        ${idx
          ? html`<div style="flex:none;text-align:${narrow ? "left" : "right"}">
              <div style="${LABEL}">${cfg?.name ?? ""}</div>
              <div style="font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;color:${staleNow ? "var(--lumen-text-3)" : "inherit"}">${idx.value}</div>
              ${cfg?.labels?.[band] ? html`<div style="font-size:11px;font-weight:700;color:${staleNow ? "var(--lumen-text-3)" : TONE_VAR[bandTone(band, bands)]}">${cfg.labels[band]}</div>` : nothing}
            </div>`
          : nothing}
      </div>
      <div style="position:relative;display:flex;align-items:center;gap:8px">
        <div aria-hidden="true" style="flex:1;display:flex;align-items:center;gap:3px">${[0, 1, 2, 3, 4, 5].map((i) => html`<span style="flex:1;height:${i === level ? 8 : 5}px;border-radius:3px;background:${staleNow ? "var(--lumen-unavailable)" : aq(i)};opacity:${staleNow ? 0.3 : i === level ? 1 : 0.28}"></span>`)}</div>
        ${age ? html`<span style="${MONO};white-space:nowrap">${formatDuration(ageMs(age.last_reported ?? age.last_updated))}</span>` : nothing}
      </div>
    </button>`;
  }

  private modesBlock(narrow: boolean) {
    const modes = this.modes;
    if (!modes.length) return nothing;
    const current = this.f("preset_mode");
    const columns = narrow ? (modes.length > 4 ? 3 : 2) : modes.length <= 4 ? modes.length : 3;
    return html`<div style="display:flex;flex-direction:column;gap:6px">
      <div style=${LABEL}>${t("card.purifier.label.mode")}</div>
      ${this.group(modes.map((m) => this.seg({ key: this.opt.pending("mode") && current === m ? "mode" : undefined, active: this.on && current === m, label: this.modeName(m), ic: MODE_ICONS[m] ?? MODE_ICON_OTHER, column: narrow, on: () => this.setMode(m) })), columns, t("card.purifier.label.mode"))}
    </div>`;
  }

  private speedBlock(narrow: boolean) {
    const steps = this.steps;
    if (!steps.length) return nothing;
    const current = nearestStep(steps, this.f("percentage"));
    const mode = this.f("preset_mode") as string | null | undefined;
    const manual = !mode || mode === "manual";
    const hasManual = ((this.fan?.attributes.preset_modes as string[] | undefined) ?? []).includes("manual");
    const note = manual ? (mode === "manual" ? t("card.purifier.msg.manual_active") : "") : hasManual ? (narrow ? t("card.purifier.msg.manual_hint_short") : t("card.purifier.msg.manual_hint")) : "";
    const barsOf = (i: number) => html`<span aria-hidden="true" style="display:flex;align-items:flex-end;gap:1.5px;height:10px">${[3, 5, 6, 8, 10].map((h, b) => html`<span style="width:3px;height:${h}px;border-radius:1px;background:currentColor;opacity:${b <= Math.round(((i + 1) * 5) / steps.length) - 1 ? 1 : 0.25}"></span>`)}</span>`;
    return html`<div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span style=${LABEL}>${t("card.purifier.label.speed")}</span>${note ? html`<span style="${MONO};color:${mode === "manual" ? "var(--lumen-accent)" : "var(--lumen-text-3)"}">${note}</span>` : nothing}</div>
      ${this.group(
        steps.map((s, i) => {
          const isCurrent = this.on && current?.percentage === s.percentage;
          return this.seg({ key: isCurrent ? "speed" : undefined, active: isCurrent && manual, dashed: isCurrent && !manual, label: s.name, column: true, small: narrow, content: barsOf(i), on: () => this.setSpeed(s.percentage, s.name) });
        }),
        steps.length,
        t("card.purifier.label.speed"),
      )}
    </div>`;
  }

  private humidityBlock(narrow: boolean) {
    const hum = this.humidity?.value;
    if (!this.humidifierOn || hum === undefined) return nothing;
    const target = this.target;
    const targets = (this._config.humidity_targets ?? []).map(Number).filter(Number.isFinite);
    const lo = 20;
    const hi = 80;
    const at = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
    const water = this.water?.value;
    const waterC = water === undefined ? null : TONE_VAR[waterTone(water)];
    return html`<div style="display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:18px;background:var(--lumen-surface-2)">
      <div style="display:flex;align-items:center;gap:8px">
        ${icon("mdi:water-percent", "font-size:20px;color:var(--lumen-info)")}
        <span style="flex:1;font-size:13px;font-weight:700">${t("card.purifier.label.humidity")}</span>
        <span style="font-size:20px;font-weight:650;font-variant-numeric:tabular-nums">${Math.round(hum)}%</span>
        ${target !== undefined ? html`<span style="font-size:12px;font-weight:600;color:var(--lumen-text-2)">${t("card.purifier.label.target_short", { v: target })}</span>` : nothing}
      </div>
      <div role="img" aria-label="${Math.round(hum)}%" style="position:relative;height:22px;display:flex;align-items:center">
        <div style="position:absolute;left:0;right:0;height:10px;border-radius:5px;overflow:hidden;background:color-mix(in srgb, var(--lumen-info) 14%, transparent)"><div style="height:100%;width:${at(hum)};background:var(--lumen-info)"></div></div>
        ${target !== undefined ? html`<span style="position:absolute;left:${at(target)};transform:translateX(-50%);width:4px;height:22px;box-sizing:content-box;border-radius:2px;background:var(--lumen-text-1);box-shadow:0 0 0 1.5px var(--lumen-surface-solid)"></span>` : nothing}
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">
        ${targets.length && this.canSetTarget ? html`<div style="flex:1;min-width:150px">${this.group(targets.map((v) => this.seg({ key: target === v ? "target" : undefined, active: target === v, label: `${v}%`, on: () => this.setTarget(v) })), targets.length, t("card.purifier.label.target"))}</div>` : nothing}
        ${water !== undefined
          ? html`<span style="flex:none;display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:0 10px 0 8px;border-radius:999px;background:color-mix(in srgb, ${waterC} 14%, transparent);color:${waterC};font-size:12px;font-weight:750">${icon(water <= WATER_LOW ? "mdi:water-alert-outline" : "mdi:cup-water", "font-size:15px")}${narrow ? `${water}%` : t("card.purifier.label.water_value", { v: water })}</span>`
          : nothing}
      </div>
    </div>`;
  }

  private footer(narrow: boolean) {
    const tiles: unknown[] = [];
    const tile = (ic: string, c: string, label: string, value: string) =>
      html`<button class="press" aria-haspopup="dialog" @click=${this.openDetails} style="min-width:0;display:flex;align-items:center;gap:5px;min-height:48px;padding:6px;box-sizing:border-box;border:0;border-radius:14px;background:var(--lumen-surface-2);color:inherit;font:inherit;text-align:left;cursor:pointer">${icon(ic, `flex:none;font-size:18px;color:${c}`)}<span style="min-width:0"><span style="display:block;font-size:11px;font-weight:650;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span><span style="display:block;font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${value}</span></span></button>`;
    const temp = this.temperature?.value;
    if (temp !== undefined) tiles.push(tile("mdi:thermometer", "var(--lumen-orange)", t("card.purifier.label.temperature"), formatTemp(temp)));
    // The way into the details, with the filter closest to replacement on its second line.
    const worst = worstFilter(this.filters);
    const isDefault = worst?.name === t("card.purifier.filter.default");
    const filter = worst ? (isDefault ? `${worst.name} ${worst.value} ${worst.unit}` : `${t("card.purifier.filter.default")} ${worst.name} ${worst.value} ${worst.unit}`) : "";
    tiles.push(html`<button class="press" aria-haspopup="dialog" @click=${this.openDetails} style="min-width:0;display:flex;align-items:center;gap:5px;min-height:48px;padding:6px;box-sizing:border-box;border:0;border-radius:14px;background:var(--lumen-surface-2);color:inherit;font:inherit;text-align:left;cursor:pointer">${icon("mdi:tune-variant", "flex:none;font-size:18px;color:var(--lumen-text-2)")}<span style="min-width:0"><span style="display:block;font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t("card.purifier.label.more_options")}</span>${worst ? html`<span style="display:block;font-size:11px;font-weight:650;color:${worst.tone === "ok" ? "var(--lumen-text-2)" : TONE_VAR[worst.tone]};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${filter}</span>` : nothing}</span></button>`);
    return html`<div style="display:grid;grid-template-columns:repeat(${narrow ? 1 : tiles.length}, minmax(0, 1fr));gap:6px">${tiles}</div>`;
  }

  private headIcon(size: number, radius: number, gone: boolean, on: boolean, dot?: string) {
    return html`<span class=${on ? "float-wrap" : ""} style="position:relative;flex:none;width:${size}px;height:${size}px;border-radius:${radius}px;display:grid;place-items:center;font-size:${size > 36 ? 24 : 20}px;background:${gone ? "transparent" : on ? "var(--lumen-accent-soft)" : "var(--lumen-surface-2)"};color:${gone ? "var(--lumen-unavailable)" : on ? "var(--lumen-accent)" : "var(--lumen-text-2)"}">
      <span class=${on ? "float" : ""} style="display:grid;${on ? "animation:lumenPurifierFloat 2.6s ease-in-out infinite" : ""}">${icon(String(this.fan?.attributes.icon ?? "mdi:air-purifier"))}</span>
      ${dot ? html`<span style="position:absolute;right:-2px;top:-2px;width:10px;height:10px;border-radius:50%;background:${dot};box-shadow:0 0 0 2px var(--lumen-surface-solid)"></span>` : nothing}
    </span>`;
  }

  // ---------------------------------------------------------------- card

  private renderCompact(gone: boolean) {
    const c = this._config;
    const h = this.actions("row", c, c.entity, { tap: c.tap_action ? undefined : null, hold: this.openDetails });
    const pm = this.pm;
    const level = pm ? pm25Level(pm.value) : 0;
    const roomy = !this._width || this._width >= COMPACT_PILL;
    const line = this.stateLine();
    return html`<div data-fx ${pressable(h)} class="press" aria-label="${this.name} · ${line}" style="display:flex;align-items:center;gap:10px;min-height:58px;padding:0 8px 0 12px;box-sizing:border-box;border-radius:20px;background:${gone ? "var(--lumen-surface-2)" : "var(--lumen-surface)"};${gone ? "" : glass};border:${gone ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};box-shadow:${gone ? "none" : "var(--lumen-shadow-1)"};user-select:none;touch-action:pan-y">
      <button aria-label=${t("card.purifier.label.details")} aria-haspopup="dialog" @pointerdown=${stop} @pointerup=${stop} @click=${(e: Event) => {
        e.stopPropagation();
        if (!gone) this.openDetails();
      }} style="flex:none;padding:0;border:0;background:transparent;color:inherit;cursor:pointer">${this.headIcon(34, 12, gone, !gone && this.on, !gone && pm && !roomy ? aq(level) : undefined)}</button>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.name}</div><div style="font-size:12px;font-weight:650;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${line}</div></div>
      ${!gone && pm && roomy
        ? html`<span role="img" aria-label="PM2.5 ${pm.value}" style="flex:none;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 9px;box-sizing:border-box;border-radius:11px;background:color-mix(in srgb, ${aq(level)} 14%, transparent)"><span style="width:7px;height:7px;border-radius:50%;background:${aq(level)}"></span><span style="font-size:15px;font-weight:750;font-variant-numeric:tabular-nums">${Math.round(pm.value)}</span><span style="font-size:10px;font-weight:700;color:var(--lumen-text-2)">PM2.5</span></span>`
        : nothing}
      ${this.power(40)}
    </div>`;
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const gone = isUnavailable(this.fan);
    if (this.compact) return this.renderCompact(gone);
    const narrow = this._width > 0 && this._width < NARROW;
    const stale = !gone && this.stale !== null;
    const pm = this.pm;
    const bad = !gone && !stale && !!pm && pm25Level(pm.value) >= 3 ? aq(pm25Level(pm.value)) : null;
    const flat = gone || stale;
    const line = this.stateLine();
    const h = this.actions("head", c, c.entity, { tap: c.tap_action ? undefined : null, hold: this.openDetails });
    return html`<div data-fx style="display:flex;flex-direction:column;gap:${narrow ? 12 : 14}px;padding:${narrow ? 12 : 16}px;box-sizing:border-box;border-radius:22px;background:${flat ? "var(--lumen-surface-2)" : bad ? `color-mix(in srgb, ${bad} 9%, var(--lumen-surface))` : "var(--lumen-surface)"};${flat ? "" : glass};border:${flat ? "1px dashed var(--lumen-border-strong)" : bad ? `1px solid color-mix(in srgb, ${bad} 35%, transparent)` : "1px solid var(--lumen-border)"};box-shadow:${flat ? "none" : "var(--lumen-shadow-1)"}">
      <div style="display:flex;align-items:center;gap:12px">
        <div ${pressable(h)} aria-label="${this.name} · ${line}" style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;user-select:none;touch-action:pan-y">
          ${this.headIcon(40, 14, gone, !gone && this.on)}
          <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.name}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${line}</div></div>
        </div>
        ${this.power(48)}
      </div>
      ${gone
        ? nothing
        : html`${this.pills(narrow)}${this.pmBlock(narrow, stale)}
            <div style="display:flex;flex-direction:column;gap:${narrow ? 12 : 14}px;opacity:${this.on ? 1 : 0.4};transition:opacity 300ms">${this.modesBlock(narrow)}${this.speedBlock(narrow)}${this.humidityBlock(narrow)}</div>
            ${this.footer(narrow)}`}
    </div>`;
  }

  // ---------------------------------------------------------------- details sheet

  private chart(o: { name: string; entity?: string; value: string; hours: number; range: [number, number]; lines: number[]; color: string }) {
    if (!o.entity) return nothing;
    const seen = this.history.range(o.entity, o.hours);
    const spark = this.history.spark(o.entity, o.hours, 300, 84, 0, o.range);
    return html`<div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:baseline;gap:8px"><span style="flex:1;font-size:13px;font-weight:750">${o.name}</span><span style="font-size:13px;font-weight:750;font-variant-numeric:tabular-nums">${o.value}</span>${seen ? html`<span style=${MONO}>${Math.round(seen[0])} · ${Math.round(seen[1])}</span>` : nothing}</div>
      <svg role="img" aria-label=${o.name} viewBox="0 0 300 84" preserveAspectRatio="none" style="display:block;width:100%;height:84px;border-radius:14px;background:var(--lumen-surface-2);color:${o.color}">${svg`
        ${o.lines.map((v) => svg`<line x1="0" x2="300" y1=${sparkY(v, o.range, 84)} y2=${sparkY(v, o.range, 84)} stroke="var(--lumen-text-3)" stroke-width="1" stroke-dasharray="3 4" vector-effect="non-scaling-stroke" opacity="0.6"></line>`)}
        <path d=${spark.area} fill="currentColor" opacity="0.14"></path><path d=${spark.line} fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>`}</svg>
    </div>`;
  }

  private controlView(x: Control) {
    const v = this.opt.value(x.path);
    if (x.kind === "switch") {
      const on = v === true || v === "on";
      return html`<button role="switch" aria-checked=${on} @click=${() => this.setControl(x, x.path.endsWith("|state") ? !on : !on)} style="position:relative;display:flex;align-items:center;gap:10px;min-height:52px;padding:0 12px;box-sizing:border-box;border:0;border-radius:14px;background:var(--lumen-surface-2);color:inherit;font:700 14px var(--lumen-font);text-align:left;cursor:pointer;width:100%">
        ${x.icon ? icon(x.icon, "flex:none;font-size:20px;color:var(--lumen-text-2)") : nothing}<span style="flex:1;min-width:0">${x.name}</span>
        <span aria-hidden="true" style="position:relative;flex:none;width:42px;height:24px;border-radius:12px;background:${on ? "var(--lumen-accent)" : "var(--lumen-border-strong)"};transition:background-color 200ms"><span style="position:absolute;top:2px;left:${on ? 20 : 2}px;width:20px;height:20px;border-radius:50%;background:var(--lumen-surface-solid);transition:left 200ms"></span></span>
        ${this.spinner(x.key)}
      </button>`;
    }
    if (x.kind === "stepper") {
      const n = Number(v);
      const value = Number.isFinite(n) ? n : x.min;
      const go = (d: number) => this.setControl(x, Math.max(x.min, Math.min(x.max, value + d * x.step)));
      const btn = (label: string, ic: string, d: number, off: boolean) => html`<button class="press" aria-label=${label} ?disabled=${off} @click=${() => go(d)} style="width:44px;height:44px;border-radius:14px;border:0;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-2);color:var(--lumen-text-1);opacity:${off ? 0.4 : 1};cursor:pointer">${icon(ic)}</button>`;
      return html`<div style="position:relative;display:flex;align-items:center;gap:10px;min-height:52px">
        ${x.icon ? icon(x.icon, "flex:none;font-size:20px;color:var(--lumen-text-2)") : nothing}<span style="flex:1;min-width:0;font-size:14px;font-weight:700">${x.name}</span>
        ${btn(t("card.purifier.label.less"), "mdi:minus", -1, value <= x.min)}
        <span style="min-width:48px;text-align:center;font-size:15px;font-weight:750;font-variant-numeric:tabular-nums">${value === x.min && x.minLabel ? x.minLabel : value}</span>
        ${btn(t("card.purifier.label.more"), "mdi:plus", 1, value >= x.max)}
        ${this.spinner(x.key)}
      </div>`;
    }
    return html`<div style="display:flex;flex-direction:column;gap:6px"><div style=${LABEL}>${x.name}</div>${this.group(x.options.map((o) => this.seg({ key: String(o.value) === String(v) ? x.key : undefined, active: String(o.value) === String(v), label: o.label, ic: o.icon, column: !!o.icon, small: x.options.length > 3, on: () => this.setControl(x, o.value) })), Math.min(5, x.options.length) || 1, x.name)}</div>`;
  }

  private details() {
    const c = this._config;
    const hours = this._range ?? Math.min(48, Number(c.hours ?? 24));
    const pm = this.pm;
    const idx = this.indexReading;
    const hum = this.humidity;
    const temp = this.temperature?.value;
    const sub = [this.fan?.attributes.model, temp !== undefined ? formatTemp(temp) : ""].filter(Boolean).join(" · ");
    const pmPeak = pm?.entity ? this.history.range(pm.entity, hours)?.[1] ?? 0 : 0;
    const idxPeak = idx?.entity ? this.history.range(idx.entity, hours)?.[1] ?? 0 : 0;
    const filters = this.filters;
    const controls = this.controls();
    const hasCharts = !!pm?.entity || !!idx?.entity || !!hum?.entity;
    const body = html`
      ${hasCharts
        ? html`${this.group([6, 24, 48].map((h) => this.seg({ active: hours === h, label: `${h} h`, on: () => (this._range = h) })), 3, t("card.purifier.label.range"))}
            ${this.chart({ name: "PM2.5", entity: pm?.entity, value: `${pm?.value ?? ""} µg/m³`, hours, range: [0, Math.max(pmPeak * 1.15, PM25[1] * 1.5)], lines: [PM25[0], PM25[1]], color: pm ? aq(pm25Level(pm.value)) : "var(--lumen-info)" })}
            ${this.chart({ name: c.index?.name ?? "", entity: idx?.entity, value: String(idx?.value ?? ""), hours, range: [0, Number(c.index?.max) || Math.max(idxPeak * 1.15, 1)], lines: (c.index?.thresholds ?? []).slice(0, 2), color: "var(--lumen-accent)" })}
            ${this.humidifierOn ? this.chart({ name: t("card.purifier.label.humidity"), entity: hum?.entity, value: `${hum?.value ?? ""}%`, hours, range: [20, 80], lines: this.target !== undefined ? [this.target] : [], color: "var(--lumen-info)" }) : nothing}`
        : nothing}
      ${controls.map((x) => this.controlView(x))}
      ${filters.length
        ? html`<div style="display:flex;flex-direction:column;gap:6px"><div style=${LABEL}>${t("card.purifier.label.filters")}</div>${filters.map(
            (f) => html`<div style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border-radius:14px;background:${f.tone === "danger" ? "color-mix(in srgb, var(--lumen-danger) 8%, transparent)" : "var(--lumen-surface-2)"}"><span style="flex:1;min-width:0;font-size:14px;font-weight:700">${f.name}</span><span style="font-size:13px;font-weight:750;font-variant-numeric:tabular-nums">${f.value} ${f.unit}</span><span style="display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:999px;background:color-mix(in srgb, ${TONE_VAR[f.tone]} 18%, transparent);color:${TONE_VAR[f.tone]};font-size:11px;font-weight:750">${t(`card.purifier.filter.state.${f.tone}`)}</span></div>`,
          )}</div>`
        : nothing}`;
    return this.sheet.render({ title: this.name, sub: sub || undefined, icon: String(this.fan?.attributes.icon ?? "mdi:air-purifier"), iconBg: this.on ? "var(--lumen-accent-soft)" : undefined, iconFg: this.on ? "var(--lumen-accent)" : undefined }, body, nothing, { body: "gap:14px;padding:12px 14px calc(16px + env(safe-area-inset-bottom))" });
  }

  // ---------------------------------------------------------------- editor

  static getStubConfig(hass?: { states: Record<string, { attributes?: Record<string, unknown> }> }) {
    const fans = Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("fan."));
    return { entity: fans.find((id) => hass!.states[id].attributes?.pm25 !== undefined) ?? fans[0] ?? "fan.air_purifier" };
  }

  static getConfigForm() {
    const lab = (k: string) => t(`card.purifier.editor.${k}`);
    const text = { text: {} };
    const sensor = (name: string): Schema => ({ name, selector: { entity: { domain: "sensor" } } });
    const modes = Object.keys(MODE_ICONS).map((value) => ({ value, label: t(`card.purifier.mode.${value}`) }));
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "fan" } } },
      { name: "name", selector: text },
      { name: "layout", helper: "purifier_layout", selector: select([["wide", "editor.layout.wide"], ["compact", "editor.layout.compact"]]) },
      { name: "", type: "grid", flatten: true, schema: [{ name: "hours", default: 24, selector: { number: { min: 6, max: 48, step: 6, mode: "box", unit_of_measurement: "h" } } }, { name: "stale_hours", default: 2, selector: { number: { min: 0, max: 48, mode: "box", unit_of_measurement: "h" } } }] },
      { name: "preset_modes", helper: "purifier_preset_modes", selector: { select: { multiple: true, custom_value: true, reorder: true, mode: "list", options: modes } } },
      { name: "speeds", helper: "purifier_speeds", selector: { object: { multiple: true, label_field: "name", description_field: "percentage", fields: { percentage: { label: lab("speed_percentage"), required: true, selector: { number: { min: 1, max: 100, mode: "box", unit_of_measurement: "%" } } }, name: { label: t("editor.name"), selector: text } } } } },
      {
        name: "", type: "expandable", flatten: true, title: t("card.purifier.editor.humidifier_group"), icon: "mdi:water-percent",
        schema: [
          { name: "show_humidifier", default: true, selector: { boolean: {} } },
          { name: "humidifier_entity", selector: { entity: { domain: "humidifier" } } },
          { name: "humidity_targets", helper: "purifier_humidity_targets", selector: { select: { multiple: true, custom_value: true, mode: "dropdown", options: ["30", "40", "50", "60", "70"] } } },
          { name: "target_humidity_service", helper: "purifier_target_service", selector: { object: { fields: { service: { label: lab("service"), selector: text }, field: { label: lab("field"), selector: text } } } } },
          { name: "humidifier_when", helper: "purifier_when", selector: { object: { fields: { attribute: { label: lab("attribute"), selector: text }, contains: { label: lab("contains"), selector: text } } } } },
        ],
      },
      {
        name: "", type: "expandable", flatten: true, title: t("card.purifier.editor.filters_group"), icon: "mdi:air-filter",
        schema: [
          { name: "show_filters", default: true, selector: { boolean: {} } },
          { name: "filters", helper: "purifier_filters", selector: { object: { multiple: true, label_field: "name", description_field: "entity", fields: { name: { label: t("editor.name"), selector: text }, entity: { label: t("editor.entity"), selector: { entity: { domain: "sensor" } } }, attribute: { label: lab("attribute"), selector: text }, unit: { label: lab("unit"), selector: { select: { mode: "dropdown", options: ["%", "h", "d"] } } } } } } },
        ],
      },
      {
        name: "", type: "expandable", flatten: true, title: t("card.purifier.editor.controls_group"), icon: "mdi:tune-variant",
        schema: [
          { name: "controls", helper: "purifier_controls", selector: { object: { multiple: true, label_field: "name", description_field: "entity", fields: { name: { label: t("editor.name"), selector: text }, icon: { label: t("editor.icon"), selector: { icon: {} } }, entity: { label: t("editor.entity"), selector: { entity: { domain: ["switch", "light", "input_boolean", "select", "input_select", "number", "input_number"] } } }, attribute: { label: lab("attribute"), selector: text }, service: { label: lab("service"), selector: text }, field: { label: lab("field"), selector: text }, kind: { label: lab("kind"), selector: select([["switch", "card.purifier.editor.kind_switch"], ["segment", "card.purifier.editor.kind_segment"], ["stepper", "card.purifier.editor.kind_stepper"]]) }, options: { label: lab("options"), selector: { object: {} } }, min: { label: lab("min"), selector: { number: { mode: "box" } } }, max: { label: lab("max"), selector: { number: { mode: "box" } } }, step: { label: lab("step"), selector: { number: { mode: "box" } } }, min_label: { label: lab("min_label"), selector: text } } } } },
          { name: "confirm_timeout", helper: "purifier_confirm_timeout", default: 45, selector: { number: { min: 5, max: 300, mode: "box", unit_of_measurement: "s" } } },
          { name: "send_delay", helper: "purifier_send_delay", default: 0.8, selector: { number: { min: 0, max: 10, step: 0.1, mode: "box", unit_of_measurement: "s" } } },
        ],
      },
      {
        name: "", type: "expandable", flatten: true, title: t("card.purifier.editor.sensors_group"), icon: "mdi:gauge",
        schema: [
          sensor("pm25_entity"), sensor("temperature_entity"), sensor("humidity_entity"), sensor("target_humidity_entity"), sensor("water_level_entity"),
          { name: "water_empty_entity", selector: { entity: { domain: "binary_sensor" } } },
          { name: "index", helper: "purifier_index", selector: { object: { fields: { name: { label: t("editor.name"), selector: text }, entity: { label: t("editor.entity"), selector: { entity: { domain: "sensor" } } }, attribute: { label: lab("attribute"), selector: text }, thresholds: { label: lab("thresholds"), selector: { object: {} } }, labels: { label: lab("labels"), selector: { object: {} } }, max: { label: lab("max"), selector: { number: { mode: "box" } } } } } } },
        ],
      },
      actions(),
      appearance({ layout: false }),
    ]);
  }
}

registerCard("lumen-purifier-card", LumenPurifierCard, {
  name: "card.purifier.name",
  description: "card.purifier.description",
  domains: ["fan"],
  suggest: (e) => e.attributes.pm25 !== undefined || String(e.attributes.icon ?? "").includes("purifier"),
});
