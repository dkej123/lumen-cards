import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { compactCell } from "../core/status-row";
import { glass, tone } from "../core/styles";
import { isUnavailable, type HassEntity, type HassLike } from "../hass/types";
import { stateText } from "../logic/format";
import { binaryStatus, type Status } from "../logic/status";

export interface EntityConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

/** Binary sensor glyphs by device class [on, off]; openings are red when open (design doors). */
const BINARY: Record<string, [string, string]> = {
  door: ["mdi:door-open", "mdi:door-closed-lock"],
  garage_door: ["mdi:garage-open", "mdi:garage"],
  window: ["mdi:window-open", "mdi:window-closed"],
  opening: ["mdi:square-outline", "mdi:square"],
  motion: ["mdi:motion-sensor", "mdi:motion-sensor-off"],
  occupancy: ["mdi:home", "mdi:home-outline"],
  presence: ["mdi:home", "mdi:home-outline"],
  moisture: ["mdi:water", "mdi:water-off"],
  smoke: ["mdi:smoke-detector-alert", "mdi:smoke-detector"],
  gas: ["mdi:alert-circle", "mdi:check-circle"],
  problem: ["mdi:alert-circle", "mdi:check-circle"],
  battery: ["mdi:battery-outline", "mdi:battery"],
  plug: ["mdi:power-plug", "mdi:power-plug-off"],
  power: ["mdi:flash", "mdi:flash-off"],
};
const OPENINGS = new Set(["door", "garage_door", "window", "opening"]);
const ALERTS = new Set(["moisture", "smoke", "gas", "problem", "battery", ...OPENINGS]);

export function validateEntity(c: Partial<EntityConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("error.pick_entity"));
}

/** Openings and alarms look like the design doors; any other entity shows its HA-formatted state. */
export function entityStatus(e: HassEntity | undefined, hass: HassLike | undefined, iconOverride?: string): Status {
  const [domain] = (e?.entity_id ?? "").split(".");
  const dc: string | undefined = e?.attributes.device_class;
  if (domain === "binary_sensor") {
    const [on, off] = (dc && BINARY[dc]) || ["mdi:checkbox-marked-circle", "mdi:checkbox-blank-circle-outline"];
    const s = binaryStatus(e, { on, off }, { on: t("common.on_short"), off: t("common.off_short") });
    const label = stateText(hass, e, dc && OPENINGS.has(dc) ? (e?.state === "on" ? t("state.open") : t("state.closed")) : s.label);
    const tn = s.tone === "unavailable" ? s.tone : dc && ALERTS.has(dc) ? s.tone : e!.state === "on" ? "warning" : "info";
    return { icon: iconOverride || e?.attributes.icon || s.icon, tone: tn, label };
  }
  const base = iconOverride || e?.attributes.icon || "mdi:information-outline";
  if (isUnavailable(e)) return { icon: base, tone: "unavailable", label: t("common.no_data") };
  return { icon: base, tone: e!.state === "on" ? "warning" : "info", label: stateText(hass, e, e!.state) };
}

/** A small state tile (e.g. door contacts); when compact a square cell of an access bar. */
export class LumenEntityCard extends LumenBaseCard<EntityConfig> {
  protected static compactBelow = 120;
  private presses = new Presses((type) => this.haptic(type));
  private subs = new SubButtons(this);

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
    this.subs.dispose();
  }

  protected entityIds() {
    return [this._config.entity, ...(this._config.sub_buttons ?? []).map((b) => b.entity)];
  }

  protected validate(c: EntityConfig) {
    validateEntity(c);
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const s = entityStatus(e, this._hass, c.icon);
    const col = tone(s.tone);
    const name = c.name || e?.attributes.friendly_name || c.entity;
    const h = this.presses.handlers(
      `entity:${c.entity}`,
      () => (c.tap_action ? handleAction(this, c.tap_action, c.entity) : this.moreInfo(c.entity)),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    if (this.compact) {
      const glyph = s.icon === "mdi:door-closed-lock" ? "mdi:door-closed" : s.icon;
      return compactCell({
        title: `${name} ${s.label}`,
        color: col,
        handlers: h,
        body: html`<span style="position:relative;display:inline-flex">${icon(glyph, "font-size:24px")}<span style="position:absolute;right:-7px;top:3px;width:5px;height:5px;border-radius:50%;background:${col}"></span></span>`,
      });
    }
    return html`<div data-fx ${pressable(h)} class="press" title="${name} ${s.label}" aria-label="${name} ${s.label}"
      style="height:44px;box-sizing:border-box;border-radius:16px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};min-width:0;display:flex;align-items:center;gap:8px;padding:0 10px 0 6px;cursor:pointer;user-select:none;touch-action:pan-y">${WFX}
      ${c.show_icon !== false ? html`<div style="width:32px;height:32px;flex:none;border-radius:11px;display:grid;place-items:center;font-size:18px;background:color-mix(in srgb, ${col} 16%, transparent);color:${col};transition:background-color 500ms, color 500ms">${icon(s.icon, "display:block")}</div>` : nothing}
      <div style="min-width:0;flex:1">${c.show_name !== false ? html`<div style="font-size:12px;font-weight:700;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>` : nothing}${c.show_state !== false ? html`<div style="font-size:11px;font-weight:600;line-height:14px;color:${col};white-space:nowrap">${s.label}</div>` : nothing}</div>
      ${this.subs.render(c.sub_buttons)}
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    const door = Object.keys(hass?.states ?? {}).find((id) => id.startsWith("binary_sensor.") && OPENINGS.has(hass?.states[id]?.attributes.device_class));
    return { entity: stub(hass, "binary_sensor", entities, fallback) ?? door ?? firstOf(hass, "binary_sensor", "binary_sensor.front_door") };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: {} } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
      actions(),
      advanced([["show_name"], ["show_icon"], ["show_state"]], { subButtons: true }),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-entity-card", LumenEntityCard, {
  name: "editor.entity",
  description: "card.entity.description",
  domains: ["binary_sensor"],
});
