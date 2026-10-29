import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { advanced, appearance, firstOf, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { activate } from "../core/press";
import { registerCard } from "../core/register";
import { tone } from "../core/styles";
import { isUnavailable, type HassEntity, type HassLike } from "../hass/types";
import { alertToShow } from "../logic/alert";
import { num, stateText } from "../logic/format";

export interface ReminderConfig extends BaseConfig {
  /** The reminder is active while this entity has `state`. */
  entity: string;
  /** Default "on". */
  state?: string;
  /** Pill label (and dialog title when `title` is empty). */
  name?: string;
  icon?: string;
  color?: "info" | "ok" | "warning" | "danger";
  /** Value text in the pill; `{value}` = state of `value_entity` (numbers rounded, text as HA shows it). */
  value?: string;
  value_entity?: string;
  /** Show the pill while active (default true); off = only the dialog. */
  show_chip?: boolean;
  /** Dialog when the reminder starts and on every entry while it holds (default true). */
  dialog?: boolean;
  title?: string;
  message?: string;
  /** "Done" button: turns the entity off (or runs `done_action`). Without it a single "OK". */
  done?: boolean;
  done_action?: ActionConfig;
  alignment?: "start" | "center" | "end";
}

const TONES = ["info", "ok", "warning", "danger"];
/** Glyph colour on the tone circle (catalog: on-tone; dark ink on the light warning yellow). */
const ON_TONE: Record<string, string> = { warning: "#2A1C06", accent: "var(--lumen-on-accent)" };

/** `{value}` in the pill text: a number rounded, any other state as text, "—" without data. */
export function reminderValue(template: string | undefined, e: HassEntity | undefined, hass?: HassLike): string {
  if (!template) return "";
  if (!template.includes("{value}")) return template;
  const n = num(e);
  const v = n !== null ? String(Math.round(n)) : e && !isUnavailable(e) ? stateText(hass, e, e.state) : "—";
  return template.replace("{value}", v);
}
const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end" };

export function validateReminder(c: Partial<ReminderConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("error.pick_entity"));
}

/**
 * A reminder (e.g. "Bike to charge"): a pill while the entity has the
 * state, and a dialog when it starts and on every entry (app / tab back in front) while it holds.
 */
export class LumenReminderCard extends LumenBaseCard<ReminderConfig> {
  static properties = { ...LumenBaseCard.properties, _open: { state: true } };
  private _open = false;
  /** Occurrence already shown since the last entry (key from `alertToShow`). */
  private seen?: string;

  protected layer = new LayerController(this, () => (this._open && !this.preview ? this.dialog() : nothing), () => (this._open = false));

  protected entityIds() {
    return [this._config.entity, this._config.value_entity];
  }

  protected validate(c: ReminderConfig) {
    validateReminder(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.onVisible);
    this.seen = undefined;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState !== "visible") return;
    this.seen = undefined;
    this.requestUpdate();
  };

  private get active() {
    return this.entity(this._config.entity)?.state === String(this._config.state ?? "on");
  }

  private get label() {
    const c = this._config;
    return c.name || this.entity(c.entity)?.attributes.friendly_name || c.entity;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    const c = this._config;
    if (!c || !this._hass || this.preview) return;
    if (!this.active) this._open = false;
    if (c.dialog === false) return;
    const key = alertToShow(this.entity(c.entity), String(c.state ?? "on"), this.seen);
    if (!key) return;
    this.seen = key;
    this._open = true;
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    const empty = !this.active || this._config?.show_chip === false;
    // Not the `hidden` attribute: HA would take the card out of the page, and it could not come
    // back (or show its dialog) when the reminder starts.
    this.style.display = this._config && empty && !this.editMode && !this.preview ? "none" : "";
  }

  /** Pill colour: the card's accent_color when set (any colour), else the `color` tone, else info. */
  private tone() {
    const c = this._config;
    const key = c.accent_color ? "accent" : TONES.includes(c.color ?? "") ? c.color! : "info";
    return { key, col: key === "accent" ? "var(--lumen-accent)" : tone(key) };
  }

  private dialog() {
    const c = this._config;
    const col = this.tone().col;
    const close = () => (this._open = false);
    const done = () => {
      this.haptic();
      this._open = false;
      if (c.done_action) handleAction(this, c.done_action, c.entity, "tap");
      else this._hass?.callService("homeassistant", "turn_off", {}, { entity_id: c.entity });
    };
    const title = c.title || this.label;
    return html`<div @click=${close} style="position:absolute;inset:0;z-index:20;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:lumenFadeIn 240ms both;pointer-events:auto"></div>
      ${this.box(title, col, close, done, false)}`;
  }

  /** The dialog body; `inline` = the static copy in the editor preview (buttons inert). */
  private box(title: string, col: string, close: () => void, done: () => void, inline: boolean) {
    const c = this._config;
    const primary = "min-height:48px;border-radius:16px;border:0;background:var(--lumen-text-1);color:var(--lumen-bg);font:750 14px var(--lumen-font);cursor:pointer";
    const secondary = "min-height:48px;border-radius:16px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-1);font:750 14px var(--lumen-font);cursor:pointer";
    const place = inline
      ? "position:relative;margin:12px auto 0;width:min(340px, 100%);pointer-events:none"
      : "position:absolute;left:50%;top:50%;z-index:21;transform:translate(-50%,-50%);width:min(340px, calc(100% - 40px));pointer-events:auto";
    return html`<div role=${inline ? "img" : "dialog"} aria-modal=${inline ? nothing : "true"} aria-label=${inline ? t("card.reminder.preview") : title} style="${place};box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:14px;padding:26px 18px 16px;border-radius:28px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);text-align:center">
        <span style="width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-size:30px;background:color-mix(in srgb, ${col} 16%, transparent);color:${col}">${icon(c.icon ?? "mdi:bell-ring")}</span>
        <div style="display:flex;flex-direction:column;gap:6px"><div style="font-size:19px;font-weight:800;letter-spacing:-0.01em">${title}</div>${c.message
          ? html`<div style="font-size:14px;line-height:1.5;color:var(--lumen-text-2);text-wrap:pretty">${c.message}</div>`
          : nothing}</div>
        ${c.done
          ? html`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;padding-top:4px">
              <button class="press" @click=${close} style=${secondary}>${t("card.reminder.later")}</button>
              <button class="press" @click=${done} style=${primary}>${t("card.reminder.done")}</button>
            </div>`
          : html`<div style="display:grid;grid-template-columns:1fr;width:100%;padding-top:4px">
              <button class="press" @click=${close} style=${primary}>${t("common.ok")}</button>
            </div>`}
      </div>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    // show_chip: false hides the pill everywhere (also in the editor preview and edit mode).
    const pill = c.show_chip !== false && (this.active || this.preview || this.editMode);
    const showDialog = this.preview && c.dialog !== false;
    if (!pill && !showDialog) return nothing;
    const { key, col } = this.tone();
    const value = reminderValue(c.value, this.entity(c.value_entity), this._hass);
    const a = c.dialog !== false && !this.preview ? activate(() => (this._open = true)) : undefined;
    // Editor preview: show the window under the pill so its texts and buttons can be checked.
    const noop = () => {};
    const sample = this.preview && c.dialog !== false ? this.box(c.title || this.label, col, noop, noop, true) : nothing;
    const dim = !this.active ? "opacity:.45;" : "";
    if (!pill) return sample;
    return html`<div style="display:flex;justify-content:${JUSTIFY[c.alignment ?? "start"] ?? "flex-start"}">
      <div role=${a ? "button" : "status"} tabindex=${a ? 0 : nothing} aria-label="${this.label} ${value}" class=${a ? "press" : ""} @click=${a?.click} @keydown=${a?.key}
        style="${a ? "cursor:pointer;" : ""}${dim}display:inline-flex;align-items:center;gap:7px;max-width:100%;min-width:0;box-sizing:border-box;padding:6px 14px 6px 6px;border-radius:999px;background:color-mix(in srgb, ${col} 16%, var(--lumen-surface-solid));border:1px solid color-mix(in srgb, ${col} 35%, transparent);font:700 12px var(--lumen-font);white-space:nowrap;animation:lumenRise 600ms var(--lumen-ease-spring) both">
        <span style="width:22px;height:22px;flex:none;border-radius:999px;display:grid;place-items:center;font-size:14px;background:${col};color:${ON_TONE[key] ?? "var(--lumen-on-tone, #fff)"}">${icon(c.icon ?? "mdi:bell-ring")}</span>
        <span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${this.label}</span>${value ? html`<span style="flex:none;color:var(--lumen-text-2);font-weight:600;font-variant-numeric:tabular-nums">${value}</span>` : nothing}
      </div>
    </div>${sample}`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "input_boolean", entities, fallback) ?? firstOf(hass, "input_boolean", "input_boolean.reminder"), done: true };
  }

  static getConfigForm() {
    const colors = [
      ["info", "tone.info"],
      ["ok", "common.ok"],
      ["warning", "tone.warning"],
      ["danger", "card.alarm.name"],
    ].map(([value, label]) => ({ value, label: t(label) }));
    return form([
      { name: "entity", required: true, selector: { entity: {} } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "state", default: "on", selector: { text: {} } }, { name: "color", selector: { select: { mode: "dropdown", options: colors } } }] },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
      { name: "", type: "grid", flatten: true, schema: [{ name: "value", selector: { text: {} } }, { name: "value_entity", selector: { entity: {} } }] },
      { name: "show_chip", default: true, selector: { boolean: {} } },
      {
        name: "",
        type: "expandable",
        flatten: true,
        title: t("card.reminder.dialog"),
        icon: "mdi:bell-ring-outline",
        schema: [
          { name: "dialog", default: true, selector: { boolean: {} } },
          { name: "title", selector: { text: {} } },
          { name: "message", selector: { text: { multiline: true } } },
          { name: "done", default: false, selector: { boolean: {} } },
          { name: "done_action", selector: { ui_action: {} } },
        ],
      },
      {
        name: "alignment",
        selector: { select: { mode: "dropdown", options: [["start", "align.start"], ["center", "align.center"], ["end", "align.end"]].map(([value, label]) => ({ value, label: t(label) })) } },
      },
      advanced(),
      appearance({ layout: false }),
    ]);
  }
}

registerCard("lumen-reminder-card", LumenReminderCard, {
  name: "card.reminder.name",
  description: "card.reminder.description",
  domains: ["input_boolean"],
});
