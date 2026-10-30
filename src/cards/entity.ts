import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons, subButtonLimit } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { Presses } from "../core/press";
import { registerCard } from "../core/register";
import { compactCell } from "../core/status-row";
import { tone } from "../core/styles";
import { ACCENT, NEUTRAL, UNAVAILABLE, UNKNOWN, rowTile, squareTile, toneLook, type TileLook } from "../core/tile";
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
  /** Treat the sensor as this device class (e.g. `door` for an `opening` contact on a door). */
  device_class?: string;
}

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

/**
 * Tile look of an entity (catalog section 02): alerts (doors, leaks…) keep their tone, anything
 * else is accent when on and neutral when off; unknown = "No data", unavailable = dashed frame.
 */
export function entityLook(e: HassEntity | undefined, s: Status): TileLook {
  if (!e || e.state === "unavailable") return UNAVAILABLE;
  if (e.state === "unknown") return UNKNOWN;
  const dc: string | undefined = e.attributes.device_class;
  if (e.entity_id.startsWith("binary_sensor.") && dc && ALERTS.has(dc)) return { ...toneLook(tone(s.tone)), subC: s.tone === "danger" ? tone(s.tone) : "var(--lumen-text-2)" };
  return e.state === "on" ? ACCENT : NEUTRAL;
}

/** A state tile with optional sub-buttons; compact a square tile, below 100 px the access bar cell. */
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

  /** Sub-buttons that fit (catalog C3). */
  private get subMax() {
    return subButtonLimit(this.compact, this._width);
  }

  protected validate(c: EntityConfig) {
    validateEntity(c);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const raw = this.entity(c.entity);
    // `device_class` from the card wins (e.g. an `opening` contact shown as a door).
    const e = raw && c.device_class ? { ...raw, attributes: { ...raw.attributes, device_class: c.device_class } } : raw;
    const s = entityStatus(e, this._hass, c.icon);
    const look = entityLook(e, s);
    const col = look.iconFg;
    const name = c.name || e?.attributes.friendly_name || c.entity;
    const h = this.presses.handlers(
      `entity:${c.entity}`,
      () => (c.tap_action ? handleAction(this, c.tap_action, c.entity) : this.moreInfo(c.entity)),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    const una = !e || e.state === "unavailable";
    const label = una ? t("common.unavailable") : s.label;
    if (this.compact) {
      const glyph = s.icon === "mdi:door-closed-lock" ? "mdi:door-closed" : s.icon;
      return compactCell({
        title: `${name} ${label}`,
        color: col,
        handlers: h,
        unavailable: una,
        extra: this.subs.render(c.sub_buttons, { compact: true, max: 1 }),
        // Doors get the design's 5 px position dot next to the glyph.
        body: glyph.includes("door")
          ? html`<span style="position:relative;display:inline-flex">${icon(glyph, "display:block")}<span style="position:absolute;right:-7px;top:3px;width:5px;height:5px;border-radius:50%;background:${col}"></span></span>`
          : icon(glyph, "display:block"),
      });
    }
    const opts = {
      title: name,
      sub: label,
      look,
      lead: c.show_icon !== false ? s.icon : undefined,
      handlers: h,
      showTitle: c.show_name !== false,
      showSub: c.show_state !== false,
      label: `${name} · ${label}`,
      trailing: this.subs.render(c.sub_buttons, { compact: this.compact, max: this.subMax }),
    };
    return this.compact ? squareTile(opts) : rowTile(opts);
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
      { name: "device_class", selector: { select: { mode: "dropdown", options: ["door", "garage_door", "window", "opening", "moisture", "smoke", "motion", "occupancy"].map((value) => ({ value, label: t(`editor.device_class.${value}`) })) } } },
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
