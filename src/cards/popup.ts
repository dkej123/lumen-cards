import { css, html, nothing, unsafeCSS } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { appearance } from "../core/form";
import { formX } from "../core/form-extra";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, sliderTile } from "../core/slider-tile";
import type { HassLike } from "../hass/types";
import { cardSpan, hashMatches, innerConfig, normalizeHash } from "../logic/popup";

type CardConfig = Record<string, unknown> & { type?: string };

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

type CardEl = HTMLElement & { hass?: HassLike; setConfig?(c: unknown): void; getGridOptions?(): { columns?: unknown }; preview?: boolean };
type Helpers = { createCardElement(c: CardConfig): CardEl };
declare global {
  interface Window {
    loadCardHelpers?: () => Promise<Helpers>;
  }
}

export function validatePopup(c: Partial<PopupConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.popup.error.cards"));
}

/** An inner card: HA's own card factory, or (outside HA) a custom element created directly. */
async function createCard(cfg: CardConfig): Promise<CardEl> {
  const helpers = await window.loadCardHelpers?.().catch(() => undefined);
  if (helpers) return helpers.createCardElement(cfg);
  const type = String(cfg.type ?? "");
  const el = document.createElement(type.startsWith("custom:") ? type.slice(7) : `hui-${type}-card`) as CardEl;
  try {
    el.setConfig?.(cfg);
  } catch (err) {
    const box = document.createElement("div") as CardEl;
    box.textContent = String((err as Error)?.message ?? err);
    return box;
  }
  return el;
}

/**
 * Pop-up / sheet with any cards inside (catalog section 14). Opens when the URL hash matches
 * (`#salon`, e.g. a navigate action or the nav card), closes on the backdrop, ×, Esc or a swipe
 * down; closing removes the hash. Invisible in the dashboard unless `show_trigger` is on; the
 * card editor shows the trigger row so the card can be found and edited.
 */
export class LumenPopupCard extends LumenBaseCard<PopupConfig> {
  static properties = { ...LumenBaseCard.properties, _open: { state: true }, _closing: { state: true } };
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}`];
  private _open = false;
  private _closing = false;
  private cards: CardEl[] = [];
  private builtFor?: unknown;
  private building = false;
  private grabY: number | null = null;
  private sheetDy = 0;
  private openedAt = 0;
  private closeTimer?: number;
  private autoTimer?: number;

  private press = new SlideDrag(this, { enabled: () => false, commit: () => undefined, tap: () => this.navigateOpen() });

  protected layer = new LayerController(this, () => (this._open && !this.preview ? this.sheet() : nothing), () => this.close());

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
    if (this.builtFor !== this._config.cards) {
      this.cards = [];
      this.builtFor = undefined;
      if (this._open) this.build();
    }
  }

  protected onHass(hass: HassLike): void {
    for (const c of this.cards) c.hass = hass;
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
    window.clearTimeout(this.closeTimer);
    window.clearTimeout(this.autoTimer);
    this.press.dispose();
    this._open = false;
    this._closing = false;
  }

  /** Open / close with the URL hash. */
  private sync() {
    const want = !!this._config && !this.preview && hashMatches(window.location.hash, this.hashTag);
    if (want && (!this._open || this._closing)) this.show();
    else if (!want && this._open && !this._closing) this.hide();
  }

  private show() {
    window.clearTimeout(this.closeTimer);
    this._open = true;
    this._closing = false;
    this.sheetDy = 0;
    this.openedAt = performance.now();
    this.build();
    window.clearTimeout(this.autoTimer);
    const secs = Number(this._config.auto_close);
    if (secs > 0) this.autoTimer = window.setTimeout(() => this.close(), secs * 1000);
  }

  private hide() {
    window.clearTimeout(this.autoTimer);
    this._closing = true;
    this.closeTimer = window.setTimeout(() => {
      this._open = false;
      this._closing = false;
      this.sheetDy = 0;
    }, 250);
  }

  /** Close = drop the hash from the URL (the location listener then hides the sheet). */
  close = () => {
    if (!this._open || this._closing) return;
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

  private async build() {
    const cfgs = this._config.cards ?? [];
    if (this.builtFor === cfgs || this.building) return;
    this.building = true;
    try {
      const els = await Promise.all(cfgs.map((c) => createCard(innerConfig(c ?? {}))));
      els.forEach((el, i) => {
        if (this._hass) el.hass = this._hass;
        el.addEventListener("ll-rebuild", (ev) => {
          ev.stopPropagation();
          createCard(innerConfig(cfgs[i] ?? {})).then((fresh) => {
            if (this._hass) fresh.hass = this._hass;
            this.cards = this.cards.map((x) => (x === el ? fresh : x));
            this.requestUpdate();
          });
        });
      });
      this.cards = els;
      this.builtFor = cfgs;
    } finally {
      this.building = false;
      this.requestUpdate();
    }
  }

  private scrim = () => {
    if (performance.now() - this.openedAt > 400) this.close();
  };

  private grab = {
    down: (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.grabY = e.clientY;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e: PointerEvent) => {
      if (this.grabY === null) return;
      this.sheetDy = Math.max(0, e.clientY - this.grabY);
      this.requestUpdate();
    },
    up: () => {
      if (this.grabY === null) return;
      this.grabY = null;
      if (this.sheetDy > 110) this.close();
      else this.sheetDy = 0;
      this.requestUpdate();
    },
  };

  private get popupTitle(): string {
    return this._config.name || this.hashTag.slice(1) || t("card.popup.name");
  }

  private sheet() {
    const isSheet = this.narrowScreen;
    const closing = this._closing;
    const anim = closing
      ? isSheet ? "lumenSheetOut 250ms var(--lumen-ease-in-out) forwards" : "lumenModalOut 220ms ease forwards"
      : isSheet ? "lumenSheetIn 520ms var(--lumen-ease-spring) both" : "lumenModalIn 420ms var(--lumen-ease-spring) both";
    const c = this._config;
    return html`<div style="position:absolute;inset:0;z-index:40;display:flex;align-items:${isSheet ? "flex-end" : "center"};justify-content:center;padding:${isSheet ? "0" : "24px"};box-sizing:border-box">
      <div @click=${this.scrim} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:${closing ? "lumenFadeOut 250ms forwards" : "lumenFadeIn 280ms both"}"></div>
      <div role="dialog" aria-modal="true" aria-label=${this.popupTitle} style="position:relative;width:100%;max-width:${isSheet ? "560px" : "600px"};animation:${anim}">
        <div class="lumen-noscroll" style="transform:translateY(${this.sheetDy}px);transition:${this.grabY !== null ? "none" : "transform 420ms var(--lumen-ease-spring)"};display:flex;flex-direction:column;gap:10px;padding:10px 14px calc(16px + ${isSheet ? "env(safe-area-inset-bottom)" : "0px"});box-sizing:border-box;max-height:${isSheet ? "88vh" : "86vh"};overflow:auto;overscroll-behavior:contain;border-radius:${isSheet ? "28px 28px 0 0" : "28px"};background:var(--lumen-surface-solid);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2)">
          <div @pointerdown=${this.grab.down} @pointermove=${this.grab.move} @pointerup=${this.grab.up} @pointercancel=${this.grab.up} style="display:flex;flex-direction:column;gap:10px;touch-action:none;cursor:grab;margin:-10px -14px 0;padding:10px 14px 0">
            <span style="align-self:center;width:36px;height:5px;border-radius:3px;background:var(--lumen-border-strong)"></span>
            <div style="display:flex;align-items:center;gap:8px;min-width:0">
              ${c.icon ? html`<span style="flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:var(--lumen-surface-2);color:var(--lumen-text-2)">${icon(c.icon)}</span>` : nothing}
              <span style="font-size:18px;font-weight:800;letter-spacing:-0.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.popupTitle}</span>
              <span style="flex:none;font:500 11px var(--lumen-mono);color:var(--lumen-text-3)">${this.hashTag}</span>
              <button aria-label=${t("common.close")} @click=${this.close} style="flex:none;margin-left:auto;width:40px;height:40px;border:0;padding:0;border-radius:50%;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-2);color:var(--lumen-text-2);cursor:pointer">${icon("mdi:close", "display:block")}</button>
            </div>
          </div>
          ${this.cards.length
            ? html`<div style="display:grid;grid-template-columns:repeat(12, minmax(0, 1fr));gap:8px">${this.cards.map((el, i) => html`<div style="grid-column:span ${cardSpan(c.cards?.[i] as { grid_options?: { columns?: unknown } }, el.getGridOptions?.())};min-width:0">${el}</div>`)}</div>`
            : html`<div style="padding:12px 4px;font-size:13px;font-weight:650;color:var(--lumen-text-3)">${(c.cards ?? []).length ? "" : t("card.popup.empty")}</div>`}
        </div>
      </div>
    </div>`;
  }

  render() {
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
      appearance({ layout: false, effects: false }),
    ]);
  }
}

registerCard("lumen-popup-card", LumenPopupCard, {
  name: "card.popup.name",
  description: "card.popup.description",
});
