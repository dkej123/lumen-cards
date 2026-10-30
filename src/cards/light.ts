import { html } from "lit";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, entityStub, form, nameIcon } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { COMPACT_H } from "../core/status-row";
import { requireEntity } from "../core/validate";
import { LightsController, type LightItem } from "../lights/controller";
import { groupMembers } from "../logic/light";

export interface LightTileConfig extends BaseConfig, LightItem {
  /** Tile height in px (default 64; the compact tile 44). */
  height?: number;
}

export function validateLightTile(c: Partial<LightTileConfig>): void {
  requireEntity(c, { msg: "card.light.error.entity" });
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

  lightItems(): LightItem[] {
    return [this._config];
  }

  protected entityIds() {
    // Group members too: a mixed group shows how many of them are on.
    return [this._config.entity, this._config.power_entity, ...groupMembers(this.entity(this._config.entity))];
  }

  /** wide | compact | icon (layout + card width). */
  get look(): "wide" | "compact" | "icon" {
    // Owner 2026-10-29: the catalog's square / icon-only tiles are out; compact is the 44 px tile.
    return this.compact ? "compact" : "wide";
  }

  protected validate(c: LightTileConfig) {
    validateLightTile(c);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return html``;
    const c = this._config;
    switch (this.look) {
      case "icon":
        return this.lights.iconTile(c, Math.max(52, c.height ?? 84));
      case "compact":
        // No colour swatch under 120 px (catalog correction 2026-10-30).
        return this.lights.tile(c, 0, c.height ?? COMPACT_H, true, !this._width || this._width >= 120);
      default:
        return this.lights.tile(c, 0, c.height ?? 64, false);
    }
  }

  static getStubConfig = entityStub("light", "light.example");

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "light" } } },
      nameIcon(),
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
