import { html, nothing } from "lit";
import { handleAction, haptic, type ActionConfig } from "./actions";
import type { LumenBaseCard } from "./base-card";
import { t } from "./i18n";
import { icon } from "./lumen-icon";
import { Presses, pressable } from "./press";
import type { Schema } from "./form";
import { isUnavailable } from "../hass/types";
import { stateText } from "../logic/format";

/** Small extra button on the right of a card (Bubble Card `sub_button`, Mushroom template chips). */
export interface SubButton {
  entity?: string;
  name?: string;
  icon?: string;
  /** Show the entity's state next to the icon. */
  show_state?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

const TOGGLE = new Set(["switch", "input_boolean", "light", "fan", "cover", "siren", "valve", "media_player", "lock", "group"]);

/** Sub-buttons a card shows (catalog C3): 4 in the full look, 2 on a narrow card (6 phone columns), 1 when compact. */
export function subButtonLimit(compact: boolean, width = 0): number {
  if (compact) return 1;
  return width > 0 && width < 280 ? 2 : 4;
}

/** Sub-button with nothing to do (no entity, no action, or the action is "none"). */
const inert = (b: SubButton) => (!b.entity && !b.tap_action) || b.tap_action?.action === "none";

export interface SubButtonsOptions {
  /** 30 px buttons (compact tile) instead of 36 px. */
  compact?: boolean;
  /** At most this many are rendered (default 4); the editor preview flags the rest. */
  max?: number;
}

/** Renders the sub-buttons of a card; owns its own press state. */
export class SubButtons {
  private presses: Presses;

  constructor(private host: LumenBaseCard) {
    // its timers are cleared with the card (Presses is a controller of the host)
    this.presses = new Presses((type) => haptic(host, type ?? "light"), host);
  }

  private tap(b: SubButton) {
    if (b.tap_action) handleAction(this.host, b.tap_action, b.entity, "tap");
    else if (b.entity && TOGGLE.has(b.entity.split(".")[0])) handleAction(this.host, { action: "toggle" }, b.entity, "tap");
    else if (b.entity) handleAction(this.host, { action: "more-info" }, b.entity, "tap");
  }

  /**
   * Catalog look: circles 36 px (30 px compact), gap 6; "on" = accent background, inert or
   * unavailable = opacity .38 without actions. Presses never reach the card underneath.
   */
  render(list: SubButton[] | undefined, opts: SubButtonsOptions = {}) {
    if (!Array.isArray(list) || !list.length) return nothing;
    const hass = this.host.hass;
    const max = Math.max(0, opts.max ?? 4);
    const shown = list.slice(0, max);
    const hidden = list.length - shown.length;
    const size = opts.compact ? 30 : 36;
    const stop = (e: Event) => e.stopPropagation();
    // Only the editor (card preview / dashboard edit mode) says that some do not fit.
    const warn = hidden > 0 && (this.host.preview || this.host.editMode);
    return html`<div class="subbtns" style="flex:none;display:flex;gap:6px;align-items:center" @pointerdown=${stop} @pointerup=${stop} @click=${stop} @keydown=${stop}>
      ${shown.map((b, i) => {
        const e = b.entity ? hass?.states[b.entity] : undefined;
        const on = e?.state === "on";
        const off = (!!b.entity && isUnavailable(e)) || inert(b);
        const label = b.name || e?.attributes.friendly_name || b.entity || t("card.button.name");
        const state = b.show_state && e ? stateText(hass, e, e.state) : "";
        const h = off
          ? undefined
          : this.presses.handlers(
              `sub:${i}:${b.entity ?? ""}`,
              () => this.tap(b),
              () => (b.hold_action ? handleAction(this.host, b.hold_action, b.entity, "hold") : b.entity && handleAction(this.host, { action: "more-info" }, b.entity, "hold")),
            );
        return html`<div ${pressable(h)} class=${off ? "" : "press"} aria-disabled=${off} aria-label="${label}${state ? ` · ${state}` : ""}" title=${label}
          style="display:flex;align-items:center;justify-content:center;gap:4px;height:${size}px;min-width:${size}px;padding:0 ${state ? 10 : 0}px 0 ${state ? 8 : 0}px;box-sizing:border-box;border-radius:999px;background:${on ? "var(--lumen-accent)" : "var(--lumen-surface-2)"};color:${on ? "var(--lumen-on-accent)" : "var(--lumen-text-2)"};opacity:${off ? 0.38 : 1};cursor:${off ? "default" : "pointer"};user-select:none;touch-action:pan-y;font:700 12px var(--lumen-font);white-space:nowrap;transition:background-color 300ms, color 300ms">
          ${icon(b.icon || e?.attributes.icon || "mdi:gesture-tap", `font-size:${opts.compact ? 16 : 18}px`)}${state ? html`<span>${state}</span>` : nothing}
        </div>`;
      })}
      ${warn
        ? html`<span role="note" title=${t("editor.sub_buttons_hidden", { n: hidden, max })} aria-label=${t("editor.sub_buttons_hidden", { n: hidden, max })}
            style="flex:none;display:inline-flex;align-items:center;gap:2px;height:20px;padding:0 6px;border-radius:999px;background:color-mix(in srgb, var(--lumen-warning) 18%, transparent);color:var(--lumen-warning);font:700 11px var(--lumen-font)">${icon("mdi:alert", "font-size:12px")}+${hidden}</span>`
        : nothing}
    </div>`;
  }
}

/** Editor field for the sub-buttons list. */
export const subButtonsField = (): Schema => ({
  name: "sub_buttons",
  selector: {
    object: {
      multiple: true,
      label_field: "name",
      description_field: "entity",
      fields: {
        entity: { label: t("editor.entity"), selector: { entity: {} } },
        name: { label: t("editor.name"), selector: { text: {} } },
        icon: { label: t("editor.icon"), selector: { icon: {} } },
        show_state: { label: t("editor.show_state"), selector: { boolean: {} } },
        tap_action: { label: t("editor.sub_tap_action"), selector: { ui_action: {} } },
        hold_action: { label: t("editor.hold_action"), selector: { ui_action: {} } },
      },
    },
  },
});
