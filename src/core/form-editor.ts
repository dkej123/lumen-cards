import { LitElement, html, nothing } from "lit";
import type { Schema } from "./form";

/** What a card's getConfigForm() returns (see form() in form.ts). */
export interface CardForm {
  /** Every field: what the docs, the catalog and the defaults read. */
  schema: Schema[];
  /** The fields that apply to this config; without it the form always shows `schema`. */
  schemaFor?: (config: Record<string, unknown>) => Schema[];
  computeLabel?: (s: Schema) => string | undefined;
  computeHelper?: (s: Schema) => string | undefined;
  assertConfig?: (c: Record<string, unknown>) => void;
}

/**
 * Top-level `default`s of a form schema (fields inside flattened grids / expandables count, a
 * named nested object does not – its values live under another key).
 */
export function formDefaults(schema: Schema[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (items: Schema[]) => {
    for (const s of items) {
      const name = s.name as string | undefined;
      if (Array.isArray(s.schema)) {
        if (s.flatten || !name) walk(s.schema as Schema[]);
        continue;
      }
      if (name && "default" in s) out[name] = s.default;
    }
  };
  walk(schema);
  return out;
}

/** The form shows defaults (a switch that is on by default is checked); unchanged defaults stay out of the YAML. */
export const withDefaults = (config: Record<string, unknown>, defaults: Record<string, unknown>) => ({ ...defaults, ...config });

export function withoutDefaults(value: Record<string, unknown>, defaults: Record<string, unknown>, original: Record<string, unknown>) {
  const out = { ...value };
  for (const [k, v] of Object.entries(defaults)) if (out[k] === v && !(k in original)) delete out[k];
  return out;
}

/**
 * Visual editor of every Lumen card: HA's ha-form with the card's getConfigForm() schema, but
 * fields show their defaults (HA's own form editor leaves a default-on switch unchecked).
 */
export class LumenFormEditor extends LitElement {
  static properties = { hass: { attribute: false }, _config: { state: true } };
  hass?: unknown;
  form!: CardForm;
  private _config: Record<string, unknown> = {};
  private shown?: { key: string; schema: Schema[] };

  setConfig(config: Record<string, unknown>) {
    // Throwing makes HA switch to the YAML editor (same contract as assertConfig).
    this.form.assertConfig?.(config);
    this._config = config;
  }

  private get defaults() {
    return formDefaults(this.form.schema);
  }

  /** The fields of the current config; the same array until they change, so ha-form is not rebuilt on every key. */
  private get schema(): Schema[] {
    const schema = this.form.schemaFor?.(this._config) ?? this.form.schema;
    const key = JSON.stringify(schema);
    if (this.shown?.key !== key) this.shown = { key, schema };
    return this.shown.schema;
  }

  private changed(e: CustomEvent<{ value: Record<string, unknown> }>) {
    e.stopPropagation();
    const config = withoutDefaults(e.detail.value, this.defaults, this._config);
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  render() {
    if (!this.form) return nothing;
    return html`<ha-form .hass=${this.hass} .data=${withDefaults(this._config, this.defaults)} .schema=${this.schema}
      .computeLabel=${this.form.computeLabel} .computeHelper=${this.form.computeHelper} @value-changed=${this.changed}></ha-form>`;
  }
}
customElements.get("lumen-form-editor") || customElements.define("lumen-form-editor", LumenFormEditor);
