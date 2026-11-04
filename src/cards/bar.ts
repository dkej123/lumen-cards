import { css, html, nothing, unsafeCSS } from "lit";
import { LumenBaseCard } from "../core/base-card";
import { LumenContainerCard, type ContainerConfig } from "../core/container-card";
import { advanced, appearance, form } from "../core/form";
import { t } from "../core/i18n";
import { WFX } from "../core/parts";
import { registerCard } from "../core/register";
import { type CardConfig } from "../core/sheet";
import type { LumenStackEditor } from "../core/stack-editor";
import "../core/stack-editor";
import { glass } from "../core/styles";

/** Cards in the bar, side by side (Lumen cards show their compact access-bar cell). */
export type BarConfig = ContainerConfig;

/** Inner Lumen cards: the compact cell; weather effects belong to the bar frame. */
export const barInner = (c: CardConfig): CardConfig =>
  String(c.type ?? "").startsWith("custom:lumen-") ? { weather_effects: false, ...c, layout: "compact" } : c;

/**
 * Access bar (Dom panel B7): one glass row 52 px high (padding 4, gap 4, r18) with the compact
 * 44 px cells of the cards inside – doors, alarms, locks, buttons in one frame, equal widths.
 */
export class LumenBarCard extends LumenContainerCard<BarConfig> {
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(".cell > * { display: block; min-width: 0; }")}`];
  protected static skeletonHeight = 52;
  protected prepare(c: CardConfig) {
    return barInner(c);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const n = Math.max(1, this.cards.length);
    const empty = !this.hasCards;
    return html`<div data-fx style="position:relative;display:grid;grid-template-columns:repeat(${n}, minmax(0,1fr));gap:4px;height:52px;padding:4px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:${empty ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};${glass}">${WFX}
      ${empty
        ? html`<div style="display:grid;place-items:center;font-size:12px;font-weight:650;color:var(--lumen-text-3)">${t("card.bar.empty")}</div>`
        : this.inner.cards.map((el) => html`<div class="cell" style="position:relative;min-width:0">${el}</div>`)}
    </div>`;
  }

  static getStubConfig() {
    return { cards: [] };
  }

  static getConfigForm() {
    return form([{ name: "cards", selector: { object: {} } }, ...this.fields()]);
  }

  private static fields() {
    return [advanced([], { haptics: false }), appearance({ layout: false, accent: false })];
  }

  /** The look above HA's own stack editor for the cards (tabs, card picker). The bar has no title. */
  static getConfigElement() {
    const el = document.createElement("lumen-stack-editor") as LumenStackEditor;
    el.titleKey = null;
    el.form = form(this.fields());
    el.fallback = this.getConfigForm();
    return el;
  }
}

registerCard("lumen-bar-card", LumenBarCard, {
  name: "card.bar.name",
  description: "card.bar.description",
});
