import { html, nothing } from "lit";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { form } from "../core/form";
import { t } from "../core/i18n";
import { fabStackHeight, watchFabs } from "../core/layer";
import { registerCard } from "../core/register";

export interface SpacerConfig extends BaseConfig {
  /** Fixed height in px; without it the card clears the floating buttons on screen. */
  height?: number;
}

/** Room left above the floating buttons: the last content can always be scrolled clear of them. */
const CLEARANCE = 16;

/** Empty space: by default as tall as the floating buttons on screen, so nothing stays under them. */
export class LumenSpacerCard extends LumenBaseCard<SpacerConfig> {
  protected static grid = GRID.full;
  private unwatch?: () => void;

  protected entityIds() {
    return [];
  }

  protected validate(c: SpacerConfig) {
    if (c.height !== undefined && (typeof c.height !== "number" || c.height < 0)) throw new Error(t("card.spacer.error.height"));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.unwatch = watchFabs(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unwatch?.();
  }

  private get space(): string | null {
    const h = this._config?.height;
    if (h !== undefined) return h ? `${h}px` : null;
    const stack = fabStackHeight();
    return stack ? `calc(${stack} + ${CLEARANCE}px)` : null;
  }

  protected renderCard() {
    if (!this._config) return nothing;
    const space = this.space;
    if (this.editMode || this.preview) {
      const h = this._config.height;
      return html`<div style="display:grid;place-items:center;min-height:44px;height:${space ?? "44px"};box-sizing:border-box;padding:4px 12px;border:1.5px dashed var(--lumen-border-strong);border-radius:14px;font-size:12px;font-weight:650;color:var(--lumen-text-3);text-align:center">${h === undefined ? t("card.spacer.auto") : `${t("card.spacer.name")} · ${h} px`}</div>`;
    }
    return space ? html`<div style="height:${space}"></div>` : nothing;
  }

  static getStubConfig() {
    return {};
  }

  static getConfigForm() {
    return form([{ name: "height", helper: "spacer_height", selector: { number: { min: 0, max: 600, step: 4, mode: "box", unit_of_measurement: "px" } } }]);
  }
}

registerCard("lumen-spacer-card", LumenSpacerCard, {
  name: "card.spacer.name",
  description: "card.spacer.description",
});
