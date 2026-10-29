import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { Presses } from "../core/press";
import { registerCard } from "../core/register";
import { alarmBanner, alarmRing, compactCell, statusRow } from "../core/status-row";
import { tone } from "../core/styles";
import type { HassEntity, HassLike } from "../hass/types";
import { stateText } from "../logic/format";
import { alarmBarIcon, alarmStatus } from "../logic/status";

export interface AlarmConfig extends BaseConfig {
  entity: string;
  name?: string;
  /** Replaces the shield / house glyphs (e.g. mdi:garage for a garage alarm). */
  icon?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Banner while triggered (above the row; floating at the top of the screen when compact). */
  banner?: boolean;
  /** Banner headline. Default "Alarm: <name>!". */
  banner_text?: string;
  /** Red pulsing ring around the screen while triggered. */
  screen_ring?: boolean;
  show_state?: boolean;
}

const PENDING_MS = 10_000;

export function validateAlarm(c: Partial<AlarmConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.alarm.error.entity"));
}

/**
 * One alarm: status row when wide, a cell of the access bar when
 * compact. Tap = configured action (with a 10 s spinner until the state changes), hold = details.
 */
export class LumenAlarmCard extends LumenBaseCard<AlarmConfig> {
  protected static compactBelow = 200;
  private presses = new Presses((type) => this.haptic(type));
  private subs = new SubButtons(this);
  private pending: { from?: HassEntity; until: number } | null = null;

  protected layer = new LayerController(this, () => {
    if (this.preview || !this.triggered) return nothing;
    const c = this._config;
    const ring = c.screen_ring !== false ? alarmRing() : nothing;
    // Phones: the banner floats at the top of the screen (a grid cell is too small for it).
    const banner = c.banner !== false && this.compact
      ? html`<div style="position:absolute;left:12px;right:12px;top:calc(64px + env(safe-area-inset-top));z-index:9;pointer-events:auto;max-width:520px;margin:0 auto">${alarmBanner(true, this.bannerText, c.tap_action ? () => this.tap() : undefined)}</div>`
      : nothing;
    return html`${ring}${banner}`;
  });

  protected entityIds() {
    return [this._config.entity, ...(this._config.sub_buttons ?? []).map((b) => b.entity)];
  }

  protected validate(c: AlarmConfig) {
    validateAlarm(c);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
    this.subs.dispose();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(1000, () => {
      if (this.pending && this.pending.until < Date.now()) {
        this.pending = null;
        this.requestUpdate();
      }
    });
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (this.pending && this.entity(this._config.entity) !== this.pending.from) this.pending = null;
  }

  private get triggered() {
    return this.entity(this._config.entity)?.state === "triggered";
  }

  private get bannerText() {
    return this._config.banner_text || t("card.alarm.banner", { name: this.name });
  }

  private get name() {
    const c = this._config;
    return c.name || this.entity(c.entity)?.attributes.friendly_name || c.entity;
  }

  tap() {
    const c = this._config;
    if (!c.tap_action) {
      this.moreInfo(c.entity);
      return;
    }
    this.pending = { from: this.entity(c.entity), until: Date.now() + PENDING_MS };
    this.requestUpdate();
    handleAction(this, c.tap_action, c.entity, "tap");
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const s0 = alarmStatus(e, c.icon);
    const s = { ...s0, label: s0.alert ? (c.tap_action ? t("card.alarm.triggered_tap") : s0.label) : stateText(this._hass, e, s0.label) };
    const handlers = this.presses.handlers(
      `alarm:${c.entity}`,
      () => this.tap(),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    if (this.compact) {
      const anim = s.alert ? "lumenShake 900ms ease-in-out infinite" : s.busy ? "lumenBreath 2400ms ease-in-out infinite" : "none";
      return compactCell({ title: `${this.name} · ${s.label}`, color: tone(s.tone), handlers, alert: s.alert, body: icon(alarmBarIcon(e, c.icon), `display:block;animation:${anim}`) });
    }
    return html`<div style="display:flex;flex-direction:column;gap:8px">
      ${this.triggered && c.banner !== false ? alarmBanner(false, this.bannerText, c.tap_action ? () => this.tap() : undefined) : nothing}
      ${statusRow(s, this.name, { pending: !!this.pending, handlers, showState: c.show_state, extra: this.subs.render(c.sub_buttons) })}
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "alarm_control_panel", entities, fallback) ?? firstOf(hass, "alarm_control_panel", "alarm_control_panel.home") };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "alarm_control_panel" } } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
      { name: "", type: "grid", flatten: true, schema: [{ name: "banner", default: true, selector: { boolean: {} } }, { name: "screen_ring", default: true, selector: { boolean: {} } }] },
      { name: "banner_text", selector: { text: {} } },
      actions(),
      advanced([["show_state"]], { subButtons: true }),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-alarm-card", LumenAlarmCard, {
  name: "card.alarm.name",
  description: "card.alarm.description",
  domains: ["alarm_control_panel"],
});
