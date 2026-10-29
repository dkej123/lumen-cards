import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "./actions";
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

/** Renders the sub-buttons of a card; owns its own press state. */
export class SubButtons {
  private presses: Presses;

  constructor(private host: LumenBaseCard) {
    this.presses = new Presses((type) => host.dispatchEvent(new CustomEvent("haptic", { detail: type ?? "light", bubbles: true, composed: true })));
  }

  dispose() {
    this.presses.dispose();
  }

  private tap(b: SubButton) {
    if (b.tap_action) handleAction(this.host, b.tap_action, b.entity, "tap");
    else if (b.entity && TOGGLE.has(b.entity.split(".")[0])) handleAction(this.host, { action: "toggle" }, b.entity, "tap");
    else if (b.entity) handleAction(this.host, { action: "more-info" }, b.entity, "tap");
  }

  render(list: SubButton[] | undefined) {
    if (!Array.isArray(list) || !list.length) return nothing;
    const hass = this.host.hass;
    return html`<div class="subbtns" style="flex:none;display:flex;gap:4px;align-items:center" @pointerdown=${(e: Event) => e.stopPropagation()} @pointerup=${(e: Event) => e.stopPropagation()} @keydown=${(e: Event) => e.stopPropagation()}>
      ${list.map((b, i) => {
        const e = b.entity ? hass?.states[b.entity] : undefined;
        const on = e?.state === "on";
        const una = !!b.entity && isUnavailable(e);
        const label = b.name || e?.attributes.friendly_name || b.entity || t("card.button.name");
        const state = b.show_state && e ? stateText(hass, e, e.state) : "";
        const h = this.presses.handlers(
          `sub:${i}:${b.entity ?? ""}`,
          () => this.tap(b),
          () => (b.hold_action ? handleAction(this.host, b.hold_action, b.entity, "hold") : b.entity && handleAction(this.host, { action: "more-info" }, b.entity, "hold")),
        );
        return html`<div ${pressable(h)} class="press" aria-label="${label}${state ? ` · ${state}` : ""}" title=${label}
          style="display:flex;align-items:center;gap:4px;height:36px;min-width:36px;padding:0 ${state ? 10 : 0}px 0 ${state ? 8 : 0}px;box-sizing:border-box;justify-content:center;border-radius:12px;background:${on ? "color-mix(in srgb, var(--lumen-warning) 18%, var(--lumen-surface-2))" : "var(--lumen-surface-2)"};color:${on ? "var(--lumen-warning)" : "var(--lumen-text-2)"};opacity:${una ? 0.5 : 1};cursor:pointer;user-select:none;touch-action:pan-y;font:700 12px var(--lumen-font);white-space:nowrap;transition:background-color 300ms, color 300ms">
          ${icon(b.icon || e?.attributes.icon || "mdi:gesture-tap", "font-size:18px")}${state ? html`<span>${state}</span>` : nothing}
        </div>`;
      })}
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
