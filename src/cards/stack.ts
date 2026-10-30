import { css, html, nothing } from "lit";
import { LumenBaseCard } from "../core/base-card";
import { assertCards, LumenContainerCard, type ContainerConfig } from "../core/container-card";
import { form, maxWidthField, select } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import type { LumenStackEditor } from "../core/stack-editor";
import "../core/stack-editor";

/** `cards`: one under another (vertical) or side by side (horizontal). */
export interface StackConfig extends ContainerConfig {
  /** Heading above the cards, as in HA's stacks. */
  title?: string;
  /** Where a narrower stack (max_width) sits in its place (default centre); with `card_width: content` also where the cards sit in the row. */
  align?: "center" | "start" | "end";
  /** Horizontal stack: cards share the width equally (default) or keep their own width and wrap to the next row. */
  card_width?: "equal" | "content";
}

export function validateStack(c: Partial<StackConfig>): void {
  assertCards(c);
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
abstract class LumenStackCard extends LumenContainerCard<StackConfig> {
  // Lumen cards are size containers (their layout follows their own width), which leaves them
  // no width of their own: with card_width content they size to their content instead.
  static styles = [LumenBaseCard.styles, css`
    .fit > *,
    .fit > * > * {
      container-type: normal;
    }
  `];
  protected static skeletonHeight = 0;
  protected static wrapCards = true;
  protected abstract readonly row: boolean;

  protected validate(c: StackConfig) {
    validateStack(c);
  }

  protected defaults(): Partial<StackConfig> {
    return { align: "center" };
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

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const title = this._config.title
      ? html`<div style="padding:4px 4px 0;font-size:16px;font-weight:700;letter-spacing:-0.01em;color:var(--lumen-text-1)">${this._config.title}</div>`
      : nothing;
    if (!this.hasCards)
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
