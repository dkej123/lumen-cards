import { html, nothing } from "lit";
import type { ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { actions, advanced, appearance, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { History } from "../core/history";
import { WFX } from "../core/parts";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { colorOr, glass } from "../core/styles";
import { requireEntity } from "../core/validate";
import type { HassEntity, HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { num, stateText } from "../logic/format";
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
  /** Card height in px (default 52, compact 36). Under 48 px: one line, name left and value right. */
  height?: number;
}

/** Below this height (px) the full card becomes the one-line row. */
const ONE_LINE_BELOW = 48;


export function validateSensor(c: Partial<SensorConfig>): void {
  requireEntity(c, { msg: "card.sensor.error.entity" });
}

/**
 * HA's own text wherever it has one (its precision, locale and unit). Temperatures keep the card's
 * style: HA's number with a bare degree ("21,5°"). Text states as HA formats them, "—" without data.
 */
export function sensorValue(e: HassEntity | undefined, hass?: HassLike): string {
  const v = num(e);
  const unit: string = e?.attributes.unit_of_measurement ?? "";
  const temperature = e?.attributes.device_class === "temperature" || unit === "°C" || unit === "°F";
  if (v === null) return temperature || isUnavailable(e) ? "—" : stateText(hass, e, e!.state);
  // Without a formatter the number keeps the decimals it came with.
  const decimals = e!.state.split(".")[1]?.length ?? 0;
  const text = hass?.formatEntityState?.(e!) ?? formatNumber(v, decimals);
  if (temperature) return `${(unit ? text.replace(unit, "") : text).trim()}°`;
  // A formatter that leaves the unit out (the demo's mock).
  return unit && !text.includes(unit) ? `${text} ${unit}` : text;
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
  protected static grid = GRID.half;
  /** Full look in any grid width (catalog section 17); compact only when chosen. */
  protected static compactBelow = 0;
  protected static sample = (id: string): HassEntity => ({ entity_id: id, state: "21.5", attributes: { friendly_name: t("card.sensor.name"), unit_of_measurement: "°C", device_class: "temperature" }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
  private history = new History(this, () => (this._config ? [this._config.entity] : []));

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: SensorConfig) {
    validateSensor(c);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const sp = this.history.spark(c.entity, Number(c.hours ?? 12), 120, 36, 1);
    const color = colorOr(c.color, "var(--lumen-accent)");
    const name = entityName(c.name, e, c.entity);
    const unknown = e?.state === "unknown";
    const value = unknown ? t("common.no_data") : sensorValue(e, this._hass);
    const h = this.actions(`sensor:${c.entity}`, c, c.entity);
    const una = !unknown && isUnavailable(e);
    const stale = sensorStale(e, Number(c.stale_after ?? 0));
    const name2 = c.show_name === false ? "" : stale ? `${name} · ${formatAgo(e!.last_reported ?? e!.last_updated)}` : name;
    const label = stale ? `${name} ${value} · ${t("card.sensor.stale", { x: formatAgo(e!.last_reported ?? e!.last_updated) })}` : `${name} ${value}`;
    const border = una || stale ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)";
    const ink = una || unknown || stale ? "var(--lumen-text-3)" : "var(--lumen-text-1)";
    const chart = c.show_graph === false || una ? nothing : html`<svg viewBox="0 0 120 36" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:0;width:100%;height:70%;pointer-events:none;opacity:${stale ? 0.4 : 1}"><path d=${sp.area} fill="currentColor" opacity="0.16"></path><path d=${sp.line} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7" vector-effect="non-scaling-stroke"></path></svg>`;
    const hpx = Number(c.height) > 0 ? Math.max(28, Math.min(200, Number(c.height))) : 0;
    if (this.compact || (hpx && hpx < ONE_LINE_BELOW)) {
      // Dom mobile (handoff 2026-10-06): one line over a dimmed sparkline, 36 px.
      const shade = `color:${ink};text-shadow:0 1px 6px color-mix(in srgb, var(--lumen-bg) 70%, transparent)`;
      return html`<div data-fx ${pressable(h)} class="press" aria-label=${label}
        style="position:relative;display:flex;align-items:center;height:${hpx || 36}px;padding:0 10px;box-sizing:border-box;border-radius:14px;background:var(--lumen-surface);border:${border};${glass};cursor:pointer;user-select:none;touch-action:pan-y;color:${stale ? "var(--lumen-text-3)" : color}">${WFX}
        <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none">${chart}${chart === nothing ? nothing : html`<span style="position:absolute;inset:0;background:color-mix(in srgb, var(--lumen-bg) 32%, transparent)"></span>`}</div>
        <div style="position:relative;display:flex;align-items:baseline;justify-content:space-between;gap:6px;width:100%;min-width:0;white-space:nowrap"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:700;${shade}">${name2}</span><span style="flex:none;font-size:15px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;${shade}">${value}</span></div>
      </div>`;
    }
    return html`<div data-fx ${pressable(h)} class="press" aria-label=${label}
      style="position:relative;display:flex;align-items:center;${hpx ? `height:${hpx}px` : "min-height:52px"};padding:6px 12px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:${border};${glass};cursor:pointer;user-select:none;touch-action:pan-y;color:${stale ? "var(--lumen-text-3)" : color}">${WFX}
      <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none">${chart}</div>
      <div style="position:relative;display:flex;flex-direction:column;min-width:0"><span style="font-size:11px;font-weight:700;line-height:14px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name2}</span><span style="font-size:18px;font-weight:650;line-height:22px;letter-spacing:-0.02em;color:${ink};font-variant-numeric:tabular-nums">${value}</span></div>
    </div>`;
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
      { name: "height", selector: { number: { min: 28, max: 200, step: 2, mode: "box", unit_of_measurement: "px" } } },
      { name: "stale_after", selector: { number: { min: 0, max: 168, step: 0.5, mode: "box", unit_of_measurement: "h" } } },
      actions(),
      advanced([["show_name"], ["show_graph"]]),
      appearance({ layout: "manual" }),
    ]);
  }
}

registerCard("lumen-sensor-card", LumenSensorCard, {
  name: "card.sensor.name",
  description: "card.sensor.description",
  domains: ["sensor"],
  suggest: (e) => !!e.attributes.unit_of_measurement,
});
