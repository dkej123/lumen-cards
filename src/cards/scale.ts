import { html, nothing } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { form, maxWidthField, select } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { InnerCards, type CardConfig } from "../core/sheet";
import type { HassLike } from "../hass/types";

export interface ScaleConfig extends BaseConfig {
  /** Cards inside, in their own 12-column grid (each spans its grid_options.columns). */
  cards?: CardConfig[];
  /** Where the narrower container sits in its place (default centre). */
  align?: "center" | "start" | "end";
}

export function validateScale(c: Partial<ScaleConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.scale.error.cards"));
  if (c.align !== undefined && !["center", "start", "end"].includes(c.align)) throw new Error(t("card.scale.error.align"));
}

/**
 * Scale: any cards (Lumen or not) in a 12-column grid like a section, the whole group at
 * most `max_width` wide (px or % of its place) – one width for many cards. No frame of its own.
 */
export class LumenScaleCard extends LumenBaseCard<ScaleConfig> {
  protected static skeletonHeight = 0;
  private inner = new InnerCards(this, (c) => c);

  protected entityIds() {
    return [];
  }

  protected validate(c: ScaleConfig) {
    validateScale(c);
  }

  protected defaults(): Partial<ScaleConfig> {
    return { cards: [], align: "center" };
  }

  setConfig(config: ScaleConfig): void {
    super.setConfig(config);
    if (this.inner.invalidate(this._config.cards)) this.inner.build(this._config.cards ?? []);
  }

  protected onHass(hass: HassLike): void {
    this.inner.setHass(hass);
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    super.willUpdate(changed);
    // the base centres a capped card; start / end keep it at one side
    if (this.style.maxWidth) {
      const a = this._config?.align;
      this.style.marginLeft = a === "start" ? "0" : "auto";
      this.style.marginRight = a === "end" ? "0" : "auto";
    }
    for (const c of this.inner.cards) c.preview = this.preview;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    if (!(this._config.cards ?? []).length)
      return html`<div style="display:grid;place-items:center;min-height:56px;border-radius:18px;border:1px dashed var(--lumen-border-strong);font-size:12px;font-weight:650;color:var(--lumen-text-3)">${t("card.scale.empty")}</div>`;
    return this.inner.grid(this._config.cards);
  }

  getCardSize() {
    return Math.max(1, (this._config?.cards ?? []).length);
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig() {
    return { cards: [], max_width: 80, max_width_unit: "%" };
  }

  static getConfigForm() {
    return form([
      { name: "cards", selector: { object: {} } },
      maxWidthField("%"),
      { name: "align", default: "center", selector: select([["center", "editor.align.center"], ["start", "editor.align.start"], ["end", "editor.align.end"]]) },
    ]);
  }
}

registerCard("lumen-scale-card", LumenScaleCard, {
  name: "card.scale.name",
  description: "card.scale.description",
});
