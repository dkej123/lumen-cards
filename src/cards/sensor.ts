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
import { formatNumber } from "../logic/time";

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

/** One sensor tile with a sparkline of the last hours. */
export class LumenSensorCard extends LumenBaseCard<SensorConfig> {
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
    const name2 = c.show_name === false ? "" : name;
    const chart = c.show_graph === false ? nothing : html`<svg viewBox="0 0 120 36" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:0;width:100%;height:70%;pointer-events:none"><path d=${sp.area} fill="currentColor" opacity="0.16"></path><path d=${sp.line} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7" vector-effect="non-scaling-stroke"></path></svg>`;
    if (this.compact) {
      const shade = "color:var(--lumen-text-1);text-shadow:0 1px 6px color-mix(in srgb, var(--lumen-bg) 70%, transparent)";
      return html`<div data-fx ${pressable(h)} class="press" aria-label="${name} ${value}"
        style="position:relative;display:flex;align-items:center;height:36px;padding:0 10px;box-sizing:border-box;border-radius:14px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};cursor:pointer;user-select:none;touch-action:pan-y;color:${color}">${WFX}
        <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none">${chart}<span style="position:absolute;inset:0;background:color-mix(in srgb, var(--lumen-bg) 32%, transparent)"></span></div>
        <div style="position:relative;display:flex;align-items:baseline;justify-content:space-between;gap:6px;width:100%;min-width:0;white-space:nowrap"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:700;${shade}">${name2}</span><span style="flex:none;font-size:15px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;${shade}">${value}</span></div>
      </div>`;
    }
    return html`<div data-fx ${pressable(h)} class="press" aria-label="${name} ${value}"
      style="position:relative;display:flex;align-items:center;min-height:52px;padding:6px 12px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};cursor:pointer;user-select:none;touch-action:pan-y;color:${color}">${WFX}
      <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none">${chart}</div>
      <div style="position:relative;display:flex;flex-direction:column"><span style="font-size:11px;font-weight:700;line-height:14px;color:var(--lumen-text-2);white-space:nowrap">${name2}</span><span style="font-size:18px;font-weight:650;line-height:22px;letter-spacing:-0.02em;color:var(--lumen-text-1);font-variant-numeric:tabular-nums">${value}</span></div>
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
      actions(),
      advanced([["show_name"], ["show_graph"]]),
      appearance(),
    ]);
  }
}

registerCard("lumen-sensor-card", LumenSensorCard, {
  name: "card.sensor.name",
  description: "card.sensor.description",
  domains: ["sensor"],
  suggest: (e) => !!e.attributes.unit_of_measurement,
});
