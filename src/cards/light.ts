import { html } from "lit";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, entityStub, form, nameIcon } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { COMPACT_H } from "../core/status-row";
import { SubButtons, subButtonEntities, subButtonLimit, subButtonsField, type SubButton } from "../core/sub-buttons";
import { requireEntity } from "../core/validate";
import { LightsController, relaysOf, type LightItem } from "../lights/controller";
import { groupMembers } from "../logic/light";

export interface LightTileConfig extends BaseConfig, LightItem {
  /** Tile height in px (default 64; the compact tile 44). */
  height?: number;
  /** Small extra buttons on the tile, e.g. one per relay of `power_entities`. */
  sub_buttons?: SubButton[];
}

export function validateLightTile(c: Partial<LightTileConfig>): void {
  requireEntity(c, { msg: "card.light.error.entity" });
  if (c.power_entities !== undefined && !Array.isArray(c.power_entities)) throw new Error(t("card.light.error.power_entities"));
  if (c.height !== undefined && (typeof c.height !== "number" || c.height < 40)) throw new Error(t("card.light.error.height"));
}

/**
 * One light tile: tap toggles, horizontal drag sets the brightness, the icon (or a hold) opens
 * the sheet. Narrower than 220 px the low 44 px compact tile.
 */
export class LumenLightCard extends LumenBaseCard<LightTileConfig> {
  protected static grid = GRID.half;
  protected static cardSize = 2;
  protected static compactBelow = 220;
  private lights = new LightsController(this);
  private subs = new SubButtons(this);

  lightItems(): LightItem[] {
    return [this._config];
  }

  protected entityIds() {
    // Group members too: a mixed group shows how many of them are on.
    const c = this._config;
    return [c.entity, ...relaysOf(c), ...groupMembers(this.entity(c.entity)), ...subButtonEntities(c.sub_buttons)];
  }

  protected validate(c: LightTileConfig) {
    validateLightTile(c);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return html``;
    const c = this._config;
    // Owner 2026-10-29: the catalog's square / icon-only tiles are out; compact is the 44 px tile,
    // without the colour swatch under 120 px (catalog correction 2026-10-30).
    const wide = !this._width || this._width >= 170;
    // Several relays: one button each (the relay's own icon), unless the card lists its own.
    const relays = relaysOf(c);
    const buttons = (Array.isArray(c.sub_buttons) ? c.sub_buttons : undefined) ?? (relays.length > 1 ? relays.map((entity) => ({ entity, icon: this.entity(entity)?.attributes.icon ?? "mdi:lightbulb-outline" })) : undefined);
    const extra = this.subs.render(buttons, { tint: this.lights.light(c).col, compact: this.compact, max: this.compact ? (wide ? 2 : 1) : subButtonLimit(false, this._width) });
    return this.compact ? this.lights.tile(c, 0, c.height ?? COMPACT_H, true, !buttons?.length && (!this._width || this._width >= 120), extra) : this.lights.tile(c, 0, c.height ?? 64, false, true, extra);
  }

  static getStubConfig = entityStub("light", "light.example");

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "light" } } },
      nameIcon(),
      { name: "power_entity", selector: { entity: { domain: ["switch", "light", "input_boolean"] } } },
      { name: "power_entities", selector: { entity: { multiple: true, domain: ["switch", "light", "input_boolean"] } } },
      { name: "height", helper: "light_height", selector: { number: { min: 40, max: 200, step: 2, mode: "box", unit_of_measurement: "px" } } },
      subButtonsField(),
      actions(),
      advanced([["show_state"], ["show_color_button"]]),
      appearance({ glow: true, layout: "width" }),
    ]);
  }
}

registerCard("lumen-light-card", LumenLightCard, {
  name: "card.light.name",
  description: "card.light.description",
  domains: ["light"],
});
