import { css, html, nothing } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { form, maxWidthField, select } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { InnerCards, type CardConfig } from "../core/sheet";
import type { LumenStackEditor } from "../core/stack-editor";
import "../core/stack-editor";
import type { HassLike } from "../hass/types";

export interface StackConfig extends BaseConfig {
  /** Cards inside, one under another (vertical) or side by side with equal widths (horizontal). */
  cards?: CardConfig[];
  /** Heading above the cards, as in HA's stacks. */
  title?: string;
  /** Where a narrower stack (max_width) sits in its place (default centre); with `card_width: content` also where the cards sit in the row. */
  align?: "center" | "start" | "end";
  /** Horizontal stack: cards share the width equally (default) or keep their own width and wrap to the next row. */
  card_width?: "equal" | "content";
}

export function validateStack(c: Partial<StackConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.stack.error.cards"));
  if (c.align !== undefined && !["center", "start", "end"].includes(c.align)) throw new Error(t("card.stack.error.align"));
  if (c.card_width !== undefined && !["equal", "content"].includes(c.card_width)) throw new Error(t("card.stack.error.card_width"));
}

const fields = (row = false) => [
  maxWidthField(),
  {
    name: "",
    type: "grid",
    flatten: true,
    schema: [
      { name: "align", default: "center", selector: select([["center", "editor.align.center"], ["start", "editor.align.start"], ["end", "editor.align.end"]]) },
      ...(row ? [{ name: "card_width", default: "equal", selector: select([["equal", "editor.card_width.equal"], ["content", "editor.card_width.content"]]) }] : []),
    ],
  },
];

/**
 * Lumen stacks: HA's vertical / horizontal stack with a max. width (px or % of the place) and
 * its position built in – one width for a whole group of cards, no extra wrapper. No frame.
 */
abstract class LumenStackCard extends LumenBaseCard<StackConfig> {
  // Lumen cards are size containers (their layout follows their own width), which leaves them
  // no width of their own: with card_width content they size to their content instead.
  static styles = [LumenBaseCard.styles, css`
    .fit > *,
    .fit > * > * {
      container-type: normal;
    }
  `];
  protected static skeletonHeight = 0;
  protected abstract readonly row: boolean;
  private inner = new InnerCards(this, (c) => c, { wrap: true });

  protected entityIds() {
    return [];
  }

  protected validate(c: StackConfig) {
    validateStack(c);
  }

  protected defaults(): Partial<StackConfig> {
    return { cards: [], align: "center" };
  }

  setConfig(config: StackConfig): void {
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
    const title = this._config.title
      ? html`<div style="padding:4px 4px 0;font-size:16px;font-weight:700;letter-spacing:-0.01em;color:var(--lumen-text-1)">${this._config.title}</div>`
      : nothing;
    if (!(this._config.cards ?? []).length)
      return html`${title}<div style="display:grid;place-items:center;min-height:56px;border-radius:18px;border:1px dashed var(--lumen-border-strong);font-size:12px;font-weight:650;color:var(--lumen-text-3)">${t("card.stack.empty")}</div>`;
    // card_width content: each card as wide as its content, wrapping, placed by `align`
    const fit = this.row && this._config.card_width === "content";
    const justify = { start: "flex-start", end: "flex-end", center: "center" }[this._config.align ?? "center"];
    return html`<div style="display:flex;flex-direction:column;gap:8px">${title}
      <div class=${fit ? "fit" : ""} style="display:flex;flex-direction:${this.row ? "row" : "column"};gap:8px;${fit ? `flex-wrap:wrap;justify-content:${justify}` : ""}">
        ${this.inner.cards.map((el) => {
          // straight in the flex box: a card hidden by its visibility conditions leaves no gap
          el.style.flex = fit ? "0 1 auto" : this.row ? "1 1 0" : "";
          el.style.minWidth = "0";
          return el;
        })}
      </div>
    </div>`;
  }

  getCardSize() {
    return this.row ? 1 : Math.max(1, (this._config?.cards ?? []).length);
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig() {
    return { cards: [] };
  }

  protected static rowFields = false;

  static getConfigForm() {
    return form([{ name: "title", selector: { text: {} } }, { name: "cards", selector: { object: {} } }, ...fields(this.rowFields)]);
  }

  /** Width and position above HA's own stack editor for the title and the cards (tabs, card picker). */
  static getConfigElement() {
    const el = document.createElement("lumen-stack-editor") as LumenStackEditor;
    el.form = form(fields(this.rowFields));
    el.fallback = this.getConfigForm();
    return el;
  }
}

export class LumenVerticalStackCard extends LumenStackCard {
  protected readonly row = false;
}

export class LumenHorizontalStackCard extends LumenStackCard {
  protected readonly row = true;
  protected static rowFields = true;
}

registerCard("lumen-vertical-stack-card", LumenVerticalStackCard, { name: "card.stack.vertical.name", description: "card.stack.vertical.description" });
registerCard("lumen-horizontal-stack-card", LumenHorizontalStackCard, { name: "card.stack.horizontal.name", description: "card.stack.horizontal.description" });
