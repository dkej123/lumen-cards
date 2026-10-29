import { LitElement, css, html, svg } from "lit";
import { ICONS } from "./icons";

/**
 * MDI icon sized by font-size (like `<i class="mdi">` in the design). Icons used by the
 * cards themselves are bundled (scripts/gen-icons.mjs); any other icon a user picks in
 * the editor comes from Home Assistant's own `ha-icon`.
 */
export class LumenIcon extends LitElement {
  static properties = { icon: {} };
  icon = "";

  static styles = css`
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      line-height: 1;
      flex: none;
      vertical-align: middle;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
    ha-icon {
      display: block;
      --mdc-icon-size: 1em;
      width: 1em;
      height: 1em;
    }
  `;

  render() {
    const path = ICONS[this.icon];
    if (path) return html`<svg viewBox="0 0 24 24" aria-hidden="true">${svg`<path d=${path}></path>`}</svg>`;
    return this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : html``;
  }
}
if (!customElements.get("lumen-icon")) customElements.define("lumen-icon", LumenIcon);

export const icon = (name: string, style = "") => html`<lumen-icon icon=${name} style=${style}></lumen-icon>`;
