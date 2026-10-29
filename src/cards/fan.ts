import { css, nothing, unsafeCSS } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { callOrToast, entityName } from "../core/call";
import { advanced, appearance, firstOf, stub } from "../core/form";
import { formX, nameIcon, tapHold } from "../core/form-extra";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, sliderTile } from "../core/slider-tile";
import { isUnavailable, type HassEntity, type HassLike } from "../hass/types";
import { snap } from "../logic/slider";

export interface FanConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Spinning fan glyph while on (default true). */
  icon_animation?: boolean;
  show_state?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

/** FanEntityFeature.SET_SPEED */
const SET_SPEED = 1;

export function validateFan(c: Partial<FanConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("error.pick_entity"));
}

/** Speed of a fan: percentage (0 when off), its step, whether it can be set. */
export function fanSpeed(e: HassEntity | undefined): { on: boolean; pct: number; step: number; settable: boolean } {
  const on = e?.state === "on";
  const settable = ((Number(e?.attributes.supported_features) || 0) & SET_SPEED) !== 0;
  const raw = Number(e?.attributes.percentage);
  const step = Number(e?.attributes.percentage_step) > 0 ? Number(e?.attributes.percentage_step) : 1;
  return { on, pct: on ? (Number.isFinite(raw) && e?.attributes.percentage !== null ? Math.round(raw) : 100) : 0, step, settable };
}

/**
 * Fan as a slider tile (catalog section 14, "Wentylator · 60%"): lit in the accent colour while
 * on, a horizontal drag sets the speed from the finger (set_percentage on release), tap toggles.
 */
export class LumenFanCard extends LumenBaseCard<FanConfig> {
  protected static compactBelow = 200;
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}`];

  private drag = new SlideDrag(this, {
    enabled: () => !isUnavailable(this.fan) && fanSpeed(this.fan).settable,
    source: () => this.fan,
    commit: (f) => this.setPct(f * 100),
    tap: () => this.tap(),
    hold: () => (this._config.hold_action ? handleAction(this, this._config.hold_action, this._config.entity, "hold") : this.moreInfo(this._config.entity)),
    step: (d, big) => {
      const s = fanSpeed(this.fan);
      this.setPct(s.pct + d * (big ? 25 : Math.max(s.step, 10)));
    },
  });

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: FanConfig) {
    validateFan(c);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.drag.dispose();
  }

  private get fan() {
    return this.entity(this._config.entity);
  }

  private tap() {
    const c = this._config;
    if (isUnavailable(this.fan) && !c.tap_action) return;
    handleAction(this, c.tap_action ?? { action: "toggle" }, c.entity, "tap");
  }

  /** 0 turns the fan off; anything else is rounded to the fan's own step (min one step). */
  private setPct(v: number) {
    const s = fanSpeed(this.fan);
    const pct = v < s.step / 2 ? 0 : Math.max(s.step, snap(v, 0, 100, s.step));
    callOrToast(this, this._hass, "fan", pct === 0 ? "turn_off" : "set_percentage", pct === 0 ? {} : { percentage: Math.round(pct) }, this._config.entity).then(() => this.requestUpdate());
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.fan;
    const una = !e || e.state === "unavailable";
    const s = fanSpeed(e);
    const f = this.drag.value();
    const pct = f !== null ? (f * 100 < s.step / 2 ? 0 : Math.max(s.step, Math.round(snap(f * 100, 0, 100, s.step)))) : s.pct;
    const on = f !== null ? pct > 0 : s.on;
    const name = entityName(c.name, e, c.entity);
    const value = una ? t("card.cover.unavailable") : isUnavailable(e) ? t("common.no_data") : on ? (s.settable ? `${pct}%` : t("card.light.on")) : t("card.fan.off");
    return sliderTile(
      {
        title: name,
        sub: c.show_state === false ? "" : value,
        subColor: una ? "var(--lumen-text-3)" : undefined,
        icon: c.icon || (e?.attributes.icon as string | undefined) || (on ? "mdi:fan" : "mdi:fan-off"),
        iconAnim: on && c.icon_animation !== false ? `lumenSpin ${(2.6 - (pct / 100) * 1.6).toFixed(2)}s linear infinite` : "none",
        iconBg: una ? "transparent" : on ? "var(--lumen-accent)" : "var(--lumen-surface-2)",
        iconFg: una ? "var(--lumen-unavailable)" : on ? "var(--lumen-on-accent)" : "var(--lumen-text-2)",
        fill: una ? 0 : on ? (s.settable ? pct : 100) : 0,
        fillColor: "var(--lumen-accent)",
        lit: on && !una,
        una,
        compact: this.compact,
        pressed: on,
        label: `${name} · ${value}`,
        keys: s.settable ? "ArrowLeft ArrowRight Shift+Enter" : "Shift+Enter",
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
    return { entity: stub(hass, "fan", entities, fallback) ?? firstOf(hass, "fan", "fan.example") };
  }

  static getConfigForm() {
    return formX([
      { name: "entity", required: true, selector: { entity: { domain: "fan" } } },
      nameIcon(),
      tapHold(),
      advanced([["show_state"], ["icon_animation"]]),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-fan-card", LumenFanCard, {
  name: "card.fan.name",
  description: "card.fan.description",
  domains: ["fan"],
});
