import { LitElement, html, nothing } from "lit";
import type { CardForm, LumenFormEditor } from "./form-editor";
import "./form-editor";

type Config = Record<string, unknown> & { cards?: unknown[] };
type StackEditor = HTMLElement & { hass?: unknown; lovelace?: unknown; setConfig(c: unknown): void };
type Helpers = { createCardElement(c: unknown): HTMLElement };

/** HA's own visual editor of stack cards (tabs, card picker, per-card editors), loaded lazily. */
async function haStackEditor(): Promise<StackEditor | undefined> {
  try {
    const helpers = (await (window as unknown as { loadCardHelpers?: () => Promise<Helpers> }).loadCardHelpers?.()) as Helpers | undefined;
    helpers?.createCardElement({ type: "vertical-stack", cards: [] });
    await customElements.whenDefined("hui-vertical-stack-card");
    const ctor = customElements.get("hui-vertical-stack-card") as unknown as { getConfigElement?: () => Promise<StackEditor> } | undefined;
    return await ctor?.getConfigElement?.();
  } catch {
    return undefined;
  }
}

/**
 * Editor of Lumen cards that hold other cards: the card's own fields (Lumen form) above HA's
 * stack editor for `cards`. HA's editor only accepts a plain stack config, so it gets
 * {type: vertical-stack, cards} and its changes are merged back into the card's config.
 * Without it (old HA) the form alone is shown, `cards` included, as YAML.
 */
export class LumenStackEditor extends LitElement {
  static properties = { hass: { attribute: false }, lovelace: { attribute: false }, _config: { state: true }, _stack: { state: true } };
  hass?: unknown;
  lovelace?: unknown;
  /** Fields above the cards, and the fallback form (with `cards`) when HA's editor is missing. */
  form!: CardForm;
  fallback!: CardForm;
  private _config?: Config;
  private _stack?: StackEditor | null;
  private fields?: LumenFormEditor;

  setConfig(config: Config) {
    this._config = config;
    this.fields?.setConfig(config);
    this._stack?.setConfig(this.stackConfig(config));
  }

  /** What HA's stack editor accepts: type, cards and an optional title, nothing else. */
  private stackConfig(c?: Config) {
    return { type: "vertical-stack", cards: c?.cards ?? [], ...(typeof c?.title === "string" && c.title ? { title: c.title } : {}) };
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._stack !== undefined) return;
    this._stack = null;
    haStackEditor().then((el) => {
      if (!el) return;
      el.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const stack = (ev as CustomEvent<{ config?: Config }>).detail?.config;
        if (!Array.isArray(stack?.cards) || !this._config) return;
        const { title: _old, ...rest } = this._config;
        this.emit({ ...rest, ...(stack.title ? { title: stack.title } : {}), cards: stack.cards });
      });
      el.setConfig(this.stackConfig(this._config));
      this._stack = el;
    });
  }

  private emit(config: Config) {
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  private fieldsEl(form: CardForm): LumenFormEditor {
    if (!this.fields || this.fields.form !== form) {
      const el = document.createElement("lumen-form-editor") as LumenFormEditor;
      el.form = form;
      el.addEventListener("config-changed", (ev) => {
        ev.stopPropagation();
        const config = (ev as CustomEvent<{ config: Config }>).detail.config;
        // the fields form does not hold `cards` / `title`: keep the current ones
        this.emit(form === this.fallback ? config : { ...config, cards: this._config?.cards, ...(this._config?.title ? { title: this._config.title } : {}) });
      });
      this.fields = el;
      if (this._config) el.setConfig(this._config);
    }
    this.fields.hass = this.hass;
    return this.fields;
  }

  render() {
    if (!this._config) return nothing;
    const stack = this._stack;
    if (stack) {
      stack.hass = this.hass;
      stack.lovelace = this.lovelace;
    }
    return html`${this.fieldsEl(stack ? this.form : this.fallback)}${stack ? html`<div style="margin-top:16px">${stack}</div>` : nothing}`;
  }
}

customElements.get("lumen-stack-editor") || customElements.define("lumen-stack-editor", LumenStackEditor);
