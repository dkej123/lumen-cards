import { css, html, nothing, unsafeCSS } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { appearance, hapticsField } from "../core/form";
import { formX } from "../core/form-extra";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { registerCard } from "../core/register";
import { InnerCards, Sheet, type CardConfig } from "../core/sheet";
import { SlideDrag, TILE_CSS, sliderTile } from "../core/slider-tile";
import type { HassLike } from "../hass/types";
import { hashMatches, innerConfig, normalizeHash } from "../logic/popup";

export interface PopupConfig extends BaseConfig {
  /** `#hash` (with or without #) that opens the pop-up, e.g. from a navigate action. */
  hash: string;
  name?: string;
  icon?: string;
  /** Cards inside (any HA card, like a vertical stack). */
  cards?: CardConfig[];
  /** A row in the dashboard that opens the pop-up (default false: the card is invisible). */
  show_trigger?: boolean;
  /** Close by itself after this many seconds (0 = never). */
  auto_close?: number;
}

export function validatePopup(c: Partial<PopupConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.popup.error.cards"));
}

/**
 * Pop-up / sheet with any cards inside (catalog section 14). Opens when the URL hash matches
 * (`#salon`, e.g. a navigate action or the nav card), closes on the backdrop, ×, Esc or a swipe
 * down (the bottom sheet shared with the floating panel, core/sheet.ts); closing removes the
 * hash. Invisible in the dashboard unless `show_trigger` is on; the card editor shows the trigger
 * row so the card can be found and edited.
 */
export class LumenPopupCard extends LumenBaseCard<PopupConfig> {
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}`];
  private inner = new InnerCards(this, (c) => innerConfig(c));
  private sheetView = new Sheet(this, () => this.close());
  private autoTimer?: number;

  private press = new SlideDrag(this, { enabled: () => false, commit: () => undefined, tap: () => this.navigateOpen() });

  protected layer = new LayerController(this, () => (this.sheetView.open && !this.preview ? this.sheet() : nothing), () => this.close());

  protected entityIds() {
    return [];
  }

  protected validate(c: PopupConfig) {
    validatePopup(c);
  }

  protected defaults(): Partial<PopupConfig> {
    return { cards: [] };
  }

  get hashTag(): string {
    return normalizeHash(this._config?.hash);
  }

  setConfig(config: PopupConfig): void {
    super.setConfig(config);
    if (this.inner.invalidate(this._config.cards) && this.sheetView.open) this.inner.build(this._config.cards ?? []);
  }

  protected onHass(hass: HassLike): void {
    this.inner.setHass(hass);
  }

  private onLocation = () => this.sync();

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("location-changed", this.onLocation);
    window.addEventListener("popstate", this.onLocation);
    window.addEventListener("hashchange", this.onLocation);
    this.sync();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this.onLocation);
    window.removeEventListener("popstate", this.onLocation);
    window.removeEventListener("hashchange", this.onLocation);
    window.clearTimeout(this.autoTimer);
    this.press.dispose();
    this.sheetView.dispose();
  }

  /** Open / close with the URL hash. */
  private sync() {
    const want = !!this._config && !this.preview && hashMatches(window.location.hash, this.hashTag);
    const v = this.sheetView;
    if (want && (!v.open || v.closing)) this.show();
    else if (!want && v.open && !v.closing) this.hide();
  }

  private show() {
    this.sheetView.show();
    this.inner.build(this._config.cards ?? []);
    window.clearTimeout(this.autoTimer);
    const secs = Number(this._config.auto_close);
    if (secs > 0) this.autoTimer = window.setTimeout(() => this.close(), secs * 1000);
  }

  private hide() {
    window.clearTimeout(this.autoTimer);
    this.sheetView.hide();
  }

  /** Close = drop the hash from the URL (the location listener then hides the sheet). */
  close = () => {
    if (!this.sheetView.open || this.sheetView.closing) return;
    if (hashMatches(window.location.hash, this.hashTag)) {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: true } }));
    }
    this.hide();
  };

  /** Trigger row: push the hash like a navigate action would. */
  private navigateOpen() {
    if (this.preview || this.editMode || !this.hashTag) return;
    history.pushState(history.state, "", window.location.pathname + window.location.search + this.hashTag);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  private get popupTitle(): string {
    return this._config.name || this.hashTag.slice(1) || t("card.popup.name");
  }

  private sheet() {
    const c = this._config;
    return this.sheetView.render(
      { title: this.popupTitle, icon: c.icon, sub: this.hashTag, subMono: true },
      this.inner.cards.length
        ? this.inner.grid(c.cards)
        : html`<div style="padding:12px 4px;font-size:13px;font-weight:650;color:var(--lumen-text-3)">${(c.cards ?? []).length ? "" : t("card.popup.empty")}</div>`,
    );
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    if (!c.show_trigger && !this.preview && !this.editMode) return nothing;
    const n = (c.cards ?? []).length;
    return sliderTile(
      {
        title: this.popupTitle,
        sub: t("card.popup.cards", { n }),
        meta: this.hashTag || t("card.popup.no_hash"),
        icon: c.icon || "mdi:dock-window",
        iconBg: "var(--lumen-surface-2)",
        iconFg: "var(--lumen-text-2)",
        fill: null,
        fillColor: "transparent",
        compact: false,
        label: `${this.popupTitle} · ${this.hashTag}`,
      },
      this.press,
    );
  }

  getCardSize() {
    return this._config?.show_trigger ? 1 : 0;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig() {
    return { hash: "#living-room", name: "Living room", show_trigger: true, cards: [] };
  }

  static getConfigForm() {
    return formX([
      { name: "hash", required: true, selector: { text: {} } },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "icon", selector: { icon: {} } },
          { name: "show_trigger", default: false, selector: { boolean: {} } },
          { name: "auto_close", selector: { number: { min: 0, max: 600, step: 5, mode: "box", unit_of_measurement: "s" } } },
        ],
      },
      { name: "cards", selector: { object: {} } },
      hapticsField,
      appearance({ layout: false, effects: false, accent: false }),
    ]);
  }
}

registerCard("lumen-popup-card", LumenPopupCard, {
  name: "card.popup.name",
  description: "card.popup.description",
});
