import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { History } from "../core/history";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { colorOr, glass } from "../core/styles";
import type { HassEntity, HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { num, stateText, temp } from "../logic/format";
import { ageMs, formatAgo, formatNumber } from "../logic/time";

export interface SensorConfig extends BaseConfig {
  entity: string;
  name?: string;
  /** Sparkline range in hours (3, 6, 12 or 24). */
  hours?: number;
  /** Chart colour: HA colour name or hex. Default: the accent. */
  color?: string | [number, number, number];
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  show_name?: boolean;
  show_graph?: boolean;
  /** Hours without a new reading after which the value counts as outdated (dashed card). Default none. */
  stale_after?: number;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

export function validateSensor(c: Partial<SensorConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.sensor.error.entity"));
}

/** Temperatures as "22.3°", other numbers as value + unit, text states as HA formats them. */
export function sensorValue(e: HassEntity | undefined, hass?: HassLike): string {
  const v = num(e);
  const unit: string = e?.attributes.unit_of_measurement ?? "";
  if (e?.attributes.device_class === "temperature" || unit === "°C" || unit === "°F") return temp(v);
  if (v === null) return isUnavailable(e) ? "—" : stateText(hass, e, e!.state);
  return `${formatNumber(v)}${unit ? ` ${unit}` : ""}`;
}

/** No reading (reported, even if unchanged) for longer than `hours`. */
export const sensorStale = (e: HassEntity | undefined, hours: number, now = Date.now()): boolean =>
  !!e && !isUnavailable(e) && hours > 0 && ageMs(e.last_reported ?? e.last_updated, now) > hours * 3_600_000;

/**
 * One sensor tile with a sparkline of the last hours (catalog section 10). Outdated: dashed frame,
 * value in text-3, "name · 3 h ago", chart at .4; unavailable: dashed, "—", no chart; compact:
 * a 36 px row without the chart (only with `layout: compact`).
 */
export class LumenSensorCard extends LumenBaseCard<SensorConfig> {
  /** Full look in any grid width (catalog section 17); compact only when chosen. */
  protected static compactBelow = 0;
  protected static sample = (id: string): HassEntity => ({ entity_id: id, state: "21.5", attributes: { friendly_name: t("card.sensor.name"), unit_of_measurement: "°C", device_class: "temperature" }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
  private history = new History(() => this.requestUpdate());
  private presses = new Presses((type) => this.haptic(type));

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.history.disconnect();
    this.presses.dispose();
  }

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: SensorConfig) {
    validateSensor(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.history.connect();
    this.every(60_000, () => this.history.load(this._hass, this.entityIds()));
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (!this._hass || !this._config) return;
    this.history.load(this._hass, this.entityIds());
    this.history.track(this._hass, this._config.entity);
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const sp = this.history.spark(c.entity, Number(c.hours ?? 12), 120, 36, 1);
    const color = colorOr(c.color, "var(--lumen-accent)");
    const name = c.name || e?.attributes.friendly_name || c.entity;
    const value = sensorValue(e, this._hass);
    const h = this.presses.handlers(
      `sensor:${c.entity}`,
      () => (c.tap_action ? handleAction(this, c.tap_action, c.entity) : this.moreInfo(c.entity)),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    const una = isUnavailable(e);
    const stale = sensorStale(e, Number(c.stale_after ?? 0));
    const name2 = c.show_name === false ? "" : stale ? `${name} · ${formatAgo(e!.last_reported ?? e!.last_updated)}` : name;
    const label = stale ? `${name} ${value} · ${t("card.sensor.stale", { x: formatAgo(e!.last_reported ?? e!.last_updated) })}` : `${name} ${value}`;
    const border = una || stale ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)";
    const ink = una || stale ? "var(--lumen-text-3)" : "var(--lumen-text-1)";
    if (this.compact) {
      return html`<div data-fx ${pressable(h)} class="press" aria-label=${label}
        style="position:relative;display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;box-sizing:border-box;border-radius:14px;background:var(--lumen-surface);border:${border};${glass};cursor:pointer;user-select:none;touch-action:pan-y">${WFX}
        <span style="flex:1;min-width:0;font-size:11px;font-weight:700;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name2}</span><span style="flex:none;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:${ink}">${value}</span>
      </div>`;
    }
    const chart = c.show_graph === false || una ? nothing : html`<svg viewBox="0 0 120 36" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:0;width:100%;height:70%;pointer-events:none;opacity:${stale ? 0.4 : 1}"><path d=${sp.area} fill="currentColor" opacity="0.16"></path><path d=${sp.line} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7" vector-effect="non-scaling-stroke"></path></svg>`;
    return html`<div data-fx ${pressable(h)} class="press" aria-label=${label}
      style="position:relative;display:flex;align-items:center;min-height:52px;padding:6px 12px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:${border};${glass};cursor:pointer;user-select:none;touch-action:pan-y;color:${stale ? "var(--lumen-text-3)" : color}">${WFX}
      <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none">${chart}</div>
      <div style="position:relative;display:flex;flex-direction:column;min-width:0"><span style="font-size:11px;font-weight:700;line-height:14px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name2}</span><span style="font-size:18px;font-weight:650;line-height:22px;letter-spacing:-0.02em;color:${ink};font-variant-numeric:tabular-nums">${value}</span></div>
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    const numeric = (x: string) => x.startsWith("sensor.") && !!hass?.states[x]?.attributes.unit_of_measurement;
    const id =
      entities?.find(numeric) ??
      Object.keys(hass?.states ?? {}).find((x) => x.startsWith("sensor.") && hass?.states[x]?.attributes.device_class === "temperature") ??
      stub(hass, "sensor", entities, fallback);
    return { entity: id ?? "sensor.temperature" };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
      { name: "name", selector: { text: {} } },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "hours", default: 12, selector: { number: { min: 1, max: 24, step: 1, mode: "box", unit_of_measurement: "h" } } },
          { name: "color", selector: { ui_color: {} } },
        ],
      },
      { name: "stale_after", selector: { number: { min: 0, max: 168, step: 0.5, mode: "box", unit_of_measurement: "h" } } },
      actions(),
      advanced([["show_name"], ["show_graph"]]),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-sensor-card", LumenSensorCard, {
  name: "card.sensor.name",
  description: "card.sensor.description",
  domains: ["sensor"],
  suggest: (e) => !!e.attributes.unit_of_measurement,
});
