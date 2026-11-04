import { html, nothing } from "lit";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { advanced, appearance, form } from "../core/form";
import { locale, t } from "../core/i18n";
import { registerCard } from "../core/register";
import { GREETING, phaseFromSun } from "../logic/sky";

export interface HeaderConfig extends BaseConfig {
  show_date?: boolean;
  sun_entity?: string;
  /** Name after the greeting; default: the logged-in user. */
  name?: string;
}

/** Greeting by day phase + date (design header). */
export class LumenGreetingCard extends LumenBaseCard<HeaderConfig> {
  protected static grid = GRID.full;
  protected static cardSize = 2;
  protected entityIds() {
    return [this._config.sun_entity ?? "sun.sun"];
  }

  protected defaults() {
    return { show_date: true };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(30_000, () => this.requestUpdate());
  }

  private greeting() {
    const phase = phaseFromSun(this.entity(this._config.sun_entity ?? "sun.sun"));
    return `${t(GREETING[phase])}, ${this._config.name ?? this._hass?.user?.name ?? ""}`;
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    if (this.compact) {
      return html`<div style="display:flex;align-items:center;gap:12px;min-height:40px;padding:0 2px">
        <div style="flex:1;min-width:0;font-size:27px;line-height:1.12;font-weight:750;letter-spacing:-0.03em">${this.greeting()}</div>
      </div>`;
    }
    const date = new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
    return html`<div style="display:flex;flex-direction:column;gap:4px;padding:4px 2px">
      ${c.show_date ? html`<div style="font-size:13px;font-weight:600;color:var(--lumen-text-2);text-transform:capitalize">${date}</div>` : nothing}
      <div style="font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-0.03em;text-wrap:balance">${this.greeting()}</div>
    </div>`;
  }

  static getStubConfig() {
    return {};
  }

  static getConfigForm() {
    return form([
      { name: "show_date", default: true, selector: { boolean: {} } },
      { name: "name", selector: { text: {} } },
      { name: "sun_entity", selector: { entity: { domain: "sun" } } },
      advanced([], { haptics: false }),
      appearance({ effects: false, layout: "screen", accent: false }),
    ]);
  }
}

registerCard("lumen-greeting-card", LumenGreetingCard, {
  name: "card.greeting.name",
  description: "card.greeting.description",
});
