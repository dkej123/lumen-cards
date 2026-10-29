import { html } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import type { HassLike } from "../hass/types";
import { LightsController, type LightItem } from "../lights/controller";

export interface LightTileConfig extends BaseConfig, LightItem {
  /** Tile height in px (default 64, compact 52). */
  height?: number;
}

export function validateLightTile(c: Partial<LightTileConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.light.error.entity"));
  if (c.height !== undefined && (typeof c.height !== "number" || c.height < 40)) throw new Error(t("card.light.error.height"));
}

/** One large light tile of the design: tap toggles, horizontal drag dims, hold opens the sheet. */
export class LumenLightCard extends LumenBaseCard<LightTileConfig> {
  protected static compactBelow = 220;
  private lights = new LightsController(this);

  lightItems(): LightItem[] {
    return [this._config];
  }

  protected entityIds() {
    return [this._config.entity, this._config.power_entity];
  }

  protected validate(c: LightTileConfig) {
    validateLightTile(c);
  }

  render() {
    if (!this._config || !this._hass) return html``;
    const h = this._config.height ?? (this.compact ? 52 : 64);
    return this.lights.tile(this._config, 0, h, this.compact);
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
