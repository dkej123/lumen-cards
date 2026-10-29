import { html } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import type { HassLike } from "../hass/types";
import { LightsController, type LightItem } from "../lights/controller";
import { groupMembers } from "../logic/light";

export interface LightTileConfig extends BaseConfig, LightItem {
  /** Tile height in px (default 64; compact tile 120, at least 96; icon-only tile 84, at least 52). */
  height?: number;
}

export function validateLightTile(c: Partial<LightTileConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.light.error.entity"));
  if (c.height !== undefined && (typeof c.height !== "number" || c.height < 40)) throw new Error(t("card.light.error.height"));
}

/**
 * One light tile: tap toggles, horizontal drag sets the brightness, the icon (or a hold) opens
 * the sheet. Narrower than 220 px a compact square tile, narrower than 100 px only the icon.
 */
export class LumenLightCard extends LumenBaseCard<LightTileConfig> {
  protected static compactBelow = 220;
  private lights = new LightsController(this);

  lightItems(): LightItem[] {
    return [this._config];
  }

  protected entityIds() {
    // Group members too: a mixed group shows how many of them are on.
    return [this._config.entity, this._config.power_entity, ...groupMembers(this.entity(this._config.entity))];
  }

  /** wide | compact | icon (layout + card width). */
  get look(): "wide" | "compact" | "icon" {
    // Owner 2026-10-29: the catalog's square / icon-only tiles are out; compact is the 52 px tile.
    return this.compact ? "compact" : "wide";
  }

  protected validate(c: LightTileConfig) {
    validateLightTile(c);
  }

  render() {
    if (!this._config || !this._hass) return html``;
    const c = this._config;
    switch (this.look) {
      case "icon":
        return this.lights.iconTile(c, Math.max(52, c.height ?? 84));
      case "compact":
        return this.lights.tile(c, 0, c.height ?? 52, true);
      default:
        return this.lights.tile(c, 0, c.height ?? 64, false);
    }
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "light", entities, fallback) ?? firstOf(hass, "light", "light.example") };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "light" } } },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
        ],
      },
      { name: "power_entity", selector: { entity: { domain: ["switch", "light", "input_boolean"] } } },
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
