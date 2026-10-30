import { css, nothing, unsafeCSS } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { callOrToast, entityName } from "../core/call";
import { advanced, appearance, firstOf, stub } from "../core/form";
import { formX, nameIcon, tapHold } from "../core/form-extra";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, sliderTile } from "../core/slider-tile";
import { isUnavailable, type HassLike } from "../hass/types";
import { fractionOf, numberRange, numberText, snap, valueAt } from "../logic/slider";

export interface NumberConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  show_state?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

export function validateNumber(c: Partial<NumberConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("error.pick_entity"));
}

/**
 * input_number / number as a slider tile in the accent colour (catalog section 14): a horizontal
 * drag sets the value from the finger, snapped to the step (set_value on release); tap and hold
 * open more-info unless actions are set.
 */
export class LumenNumberCard extends LumenBaseCard<NumberConfig> {
  protected static compactBelow = 200;
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}`];

  private drag = new SlideDrag(this, {
    enabled: () => !this.offline,
    source: () => this.num,
    commit: (f) => {
      const r = numberRange(this.num?.attributes);
      this.setValue(valueAt(f, r.min, r.max, r.step));
    },
    tap: () => {
      const c = this._config;
      if (c.tap_action) handleAction(this, c.tap_action, c.entity, "tap");
      else this.moreInfo(c.entity);
    },
    hold: () => (this._config.hold_action ? handleAction(this, this._config.hold_action, this._config.entity, "hold") : this.moreInfo(this._config.entity)),
    step: (d, big) => {
      const r = numberRange(this.num?.attributes);
      const cur = Number(this.num?.state);
      const by = big ? Math.max(r.step, (r.max - r.min) / 10) : r.step;
      this.setValue(snap((Number.isFinite(cur) ? cur : r.min) + d * by, r.min, r.max, r.step));
    },
  });

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: NumberConfig) {
    validateNumber(c);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.drag.dispose();
  }

  private get num() {
    return this.entity(this._config.entity);
  }

  private get offline() {
    return isUnavailable(this.num);
  }

  private setValue(v: number) {
    const domain = this._config.entity.split(".")[0] === "number" ? "number" : "input_number";
    callOrToast(this, this._hass, domain, "set_value", { value: v }, this._config.entity).then(() => this.requestUpdate());
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.num;
    const una = !e || e.state === "unavailable";
    const r = numberRange(e?.attributes);
    const f = this.drag.value();
    const cur = Number(e?.state);
    const v = f !== null ? valueAt(f, r.min, r.max, r.step) : Number.isFinite(cur) && !this.offline ? cur : null;
    const name = entityName(c.name, e, c.entity);
    const value = una ? t("card.cover.unavailable") : v === null ? t("common.no_data") : numberText(v, e?.attributes.unit_of_measurement as string | undefined, r);
    return sliderTile(
      {
        title: name,
        sub: c.show_state === false ? "" : value,
        subColor: una || v === null ? "var(--lumen-text-3)" : undefined,
        icon: c.icon || (e?.attributes.icon as string | undefined) || "mdi:ray-vertex",
        iconBg: una ? "transparent" : "var(--lumen-accent-soft)",
        iconFg: una ? "var(--lumen-unavailable)" : v === null ? "var(--lumen-text-3)" : "var(--lumen-accent)",
        fill: v === null ? 0 : fractionOf(v, r.min, r.max) * 100,
        fillColor: "var(--lumen-accent)",
        una,
        compact: this.compact,
        label: `${name} · ${value}`,
        keys: "ArrowLeft ArrowRight Shift+Enter",
      },
      this.drag,
    );
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, ["input_number", "number"], entities, fallback) ?? firstOf(hass, "input_number", firstOf(hass, "number", "input_number.example")) };
  }

  static getConfigForm() {
    return formX([
      { name: "entity", required: true, selector: { entity: { domain: ["input_number", "number"] } } },
      nameIcon(),
      tapHold(),
      advanced([["show_state"]]),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-number-card", LumenNumberCard, {
  name: "card.number.name",
  description: "card.number.description",
  domains: ["input_number", "number"],
});
