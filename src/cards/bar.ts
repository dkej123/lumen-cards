import { css, html, nothing, unsafeCSS } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { appearance, form } from "../core/form";
import { t } from "../core/i18n";
import { WFX } from "../core/parts";
import { registerCard } from "../core/register";
import { InnerCards, type CardConfig } from "../core/sheet";
import { glass } from "../core/styles";
import type { HassLike } from "../hass/types";

export interface BarConfig extends BaseConfig {
  /** Cards in the bar, side by side (Lumen cards show their compact access-bar cell). */
  cards?: CardConfig[];
}

export function validateBar(c: Partial<BarConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.bar.error.cards"));
}

/** Inner Lumen cards: the compact cell; weather effects belong to the bar frame. */
export const barInner = (c: CardConfig): CardConfig =>
  String(c.type ?? "").startsWith("custom:lumen-") ? { weather_effects: false, ...c, layout: "compact" } : c;

/**
 * Access bar (Dom panel B7): one glass row 52 px high (padding 4, gap 4, r18) with the compact
 * 44 px cells of the cards inside – doors, alarms, locks, buttons in one frame, equal widths.
 */
export class LumenBarCard extends LumenBaseCard<BarConfig> {
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(".cell > * { display: block; min-width: 0; }")}`];
  protected static skeletonHeight = 52;
  private inner = new InnerCards(this, barInner);

  protected entityIds() {
    return [];
  }

  protected validate(c: BarConfig) {
    validateBar(c);
  }

  protected defaults(): Partial<BarConfig> {
    return { cards: [] };
  }

  setConfig(config: BarConfig): void {
    super.setConfig(config);
    if (this.inner.invalidate(this._config.cards)) this.inner.build(this._config.cards ?? []);
  }

  protected onHass(hass: HassLike): void {
    this.inner.setHass(hass);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const n = Math.max(1, (this._config.cards ?? []).length);
    const empty = !(this._config.cards ?? []).length;
    return html`<div data-fx style="position:relative;display:grid;grid-template-columns:repeat(${n}, minmax(0,1fr));gap:4px;height:52px;padding:4px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:${empty ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};${glass}">${WFX}
      ${empty
        ? html`<div style="display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--lumen-text-3)">${t("card.bar.empty")}</div>`
        : this.inner.cards.map((el) => html`<div class="cell" style="position:relative;min-width:0">${el}</div>`)}
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig() {
    return { cards: [] };
  }

  static getConfigForm() {
    return form([{ name: "cards", selector: { object: {} } }, appearance({ layout: false, accent: false })]);
  }
}

registerCard("lumen-bar-card", LumenBarCard, {
  name: "card.bar.name",
  description: "card.bar.description",
});
