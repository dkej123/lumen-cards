import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { Presses, pressable, spinnerStyle } from "../core/press";
import { registerCard } from "../core/register";
import { alarmBanner, alarmRing, compactCell } from "../core/status-row";
import { icon } from "../core/lumen-icon";
import { cssColor, tone } from "../core/styles";
import { codePad, countdown, rowFrame, rowIcon, rowText, segs, toned, unavailableLook, unplugged, WFX, type Look, type PadMode, type Seg } from "../core/parts";
import type { HassEntity, HassLike } from "../hass/types";
import { ARMED_ICON, alarmBarIcon, alarmStatus, armModes, isArmed, modeLabel, type Status } from "../logic/status";

export interface AlarmConfig extends BaseConfig {
  entity: string;
  name?: string;
  /** Replaces the shield glyphs (e.g. mdi:garage for a garage alarm). */
  icon?: string;
  /**
   * Own action (e.g. a script that toggles the alarm): the row tap and the Arm / Disarm buttons run
   * it instead of the built-in code pad. more-info / none keep the built-in pad.
   */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Floating banner at the top of the screen while triggered (compact card). */
  banner?: boolean;
  /** Banner headline. Default "Alarm: <name>!". */
  banner_text?: string;
  /** Red pulsing ring around the screen while triggered. */
  screen_ring?: boolean;
  show_state?: boolean;
  /** Arm / Disarm / Cancel / Code buttons on the card. */
  show_buttons?: boolean;
  /** Colour of the disarmed state (Dom: danger red). Default neutral. */
  disarmed_color?: string | [number, number, number];
  /** Arm modes offered by the pad (of those the entity supports). Default: all supported. */
  arm_modes?: string[];
  /** Exit delay in seconds for the arming bar when the entity does not report it. */
  arming_time?: number;
  /** Entry delay in seconds for the pending bar when the entity does not report it. */
  pending_time?: number;
}

const PENDING_MS = 10_000;
const MODE_KEY = "lumen-alarm-mode:";
const WHITE = "#fff";

export function validateAlarm(c: Partial<AlarmConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.alarm.error.entity"));
}

/** First number among the entity's attributes (integrations name the delays differently). */
const seconds = (e: HassEntity | undefined, keys: string[], fallback?: number): number | undefined => {
  for (const k of keys) {
    const v = Number(e?.attributes[k]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return typeof fallback === "number" && fallback > 0 ? fallback : undefined;
};

/** Countdown of arming (exit delay) / pending (entry delay): seconds left and the bar, or null when unknown. */
export function alarmCountdown(e: HassEntity | undefined, cfg: { arming_time?: number; pending_time?: number }, now = Date.now()): { left: number; pct: number } | null {
  if (!e || (e.state !== "arming" && e.state !== "pending")) return null;
  const arming = e.state === "arming";
  const total = arming
    ? seconds(e, ["arming_time", "exit_time", "delay", "arm_time"], cfg.arming_time)
    : seconds(e, ["pending_time", "delay_time", "entry_time", "delay"], cfg.pending_time);
  if (!total) return null;
  const elapsed = Math.max(0, (now - Date.parse(e.last_changed)) / 1000);
  const left = Math.max(0, Math.ceil(total - elapsed));
  // Arming fills up (time passed), the entry countdown runs out (time left).
  return { left, pct: arming ? Math.min(100, (elapsed / total) * 100) : (left / total) * 100 };
}

const readMode = (entity: string): string | null => {
  try {
    return localStorage.getItem(MODE_KEY + entity);
  } catch {
    return null;
  }
};

const writeMode = (entity: string, mode: string) => {
  try {
    localStorage.setItem(MODE_KEY + entity, mode);
  } catch {
    /* per-device convenience only */
  }
};

interface Pad {
  kind: "arm" | "disarm";
  code: string;
  mode: string;
  error?: string;
  shake: number;
  busy: boolean;
}

/**
 * One alarm (catalog section 05): a row with the state and Arm / Disarm when wide, a tile when
 * compact, only the icon below 100 px. Arm opens the code pad with the mode choice (modes the
 * entity supports), Disarm the pad alone; HA checks the code, a failed call shakes the dots.
 */
export class LumenAlarmCard extends LumenBaseCard<AlarmConfig> {
  static properties = { ...LumenBaseCard.properties, _pad: { state: true } };
  protected static compactBelow = 200;
  protected static iconBelow = 100;
  protected static sample = (id: string): HassEntity => ({ entity_id: id, state: "armed_home", attributes: { friendly_name: t("card.alarm.name"), supported_features: 7, code_format: "number" }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });

  private presses = new Presses((type) => this.haptic(type), this);
  private subs = new SubButtons(this);
  private pending: { from?: HassEntity; until: number } | null = null;
  private _pad: Pad | null = null;

  protected layer = new LayerController(
    this,
    () => {
      if (this.preview) return nothing;
      const c = this._config;
      const alert = this.triggered && !this._pad;
      const ring = alert && c.screen_ring !== false ? alarmRing() : nothing;
      // Phones: the banner floats at the top of the screen (a grid cell is too small for it).
      const banner = alert && c.banner !== false && this.compact
        ? html`<div style="position:absolute;left:12px;right:12px;top:calc(64px + env(safe-area-inset-top));z-index:9;pointer-events:auto;max-width:520px;margin:0 auto">${alarmBanner(true, this.bannerText, () => this.primary())}</div>`
        : nothing;
      if (ring === nothing && banner === nothing && !this._pad) return nothing;
      return html`${ring}${banner}${this._pad ? this.pad() : nothing}`;
    },
    () => (this._pad = null),
  );

  protected entityIds() {
    return [this._config.entity, ...(this._config.sub_buttons ?? []).map((b) => b.entity)];
  }

  protected validate(c: AlarmConfig) {
    validateAlarm(c);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._pad = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(1000, () => {
      if (this.pending && this.pending.until < Date.now()) {
        this.pending = null;
        this.requestUpdate();
      }
      // Countdown bars tick every second.
      const st = this.alarm?.state;
      if (st === "arming" || st === "pending") this.requestUpdate();
    });
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (this.pending && this.alarm !== this.pending.from) this.pending = null;
  }

  private get alarm() {
    return this.entity(this._config?.entity);
  }

  private get triggered() {
    return this.alarm?.state === "triggered";
  }

  private get bannerText() {
    return this._config.banner_text || t("card.alarm.banner", { name: this.name });
  }

  private get name() {
    const c = this._config;
    return c.name || this.alarm?.attributes.friendly_name || c.entity;
  }

  /** A tap_action of its own (script, service…) replaces the built-in pad. */
  private get ownAction() {
    const a = this._config.tap_action?.action;
    return !!a && a !== "more-info" && a !== "none";
  }

  private runTap() {
    const c = this._config;
    this.pending = { from: this.alarm, until: Date.now() + PENDING_MS };
    this.requestUpdate();
    handleAction(this, c.tap_action, c.entity, "tap");
  }

  /** Row / tile tap: the own action, else more-info (wide) or the main command (tiles). */
  tap() {
    const c = this._config;
    if (c.tap_action) {
      if (c.tap_action.action === "more-info") this.moreInfo(c.entity);
      else this.runTap();
      return;
    }
    if (this.compact) this.primary();
    else this.moreInfo(c.entity);
  }

  /** The state's main command: arm when disarmed, else disarm (enter the code). */
  primary() {
    const st = this.alarm?.state;
    if (st === "disarmed") this.arm();
    else this.disarm();
  }

  private needsCode(arm: boolean) {
    const a = this.alarm?.attributes ?? {};
    if (!a.code_format) return false;
    return arm ? a.code_arm_required !== false : true;
  }

  private arm() {
    if (this.ownAction) return this.runTap();
    const modes = armModes(this.alarm, this._config.arm_modes);
    const last = readMode(this._config.entity);
    const mode = last && modes.includes(last) ? last : modes.includes("armed_away") ? "armed_away" : modes[0];
    this._pad = { kind: "arm", code: "", mode, shake: 0, busy: false };
  }

  private disarm() {
    if (this.ownAction) return this.runTap();
    if (!this.needsCode(false)) {
      this.send("disarm", "");
      return;
    }
    this._pad = { kind: "disarm", code: "", mode: "", shake: 0, busy: false };
  }

  /** alarm_arm_<mode> / alarm_disarm; a rejected call (wrong code) keeps the pad open with the error. */
  private async send(kind: "arm" | "disarm", code: string, mode = "") {
    if (!this._hass) return;
    const c = this._config;
    const service = kind === "arm" ? `alarm_arm_${mode.replace("armed_", "")}` : "alarm_disarm";
    if (this._pad) this._pad = { ...this._pad, busy: true, error: undefined };
    this.haptic();
    try {
      await this._hass.callService("alarm_control_panel", service, code ? { code } : {}, { entity_id: c.entity });
      if (kind === "arm") writeMode(c.entity, mode);
      this._pad = null;
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.haptic("failure");
      if (this._pad) this._pad = { ...this._pad, busy: false, code: "", error: /code/i.test(msg) || code ? t("card.alarm.wrong_code") : msg, shake: this._pad.shake + 1 };
    }
  }

  private pad() {
    const p = this._pad!;
    const arm = p.kind === "arm";
    const kind = !this.needsCode(arm) ? "none" : this.alarm?.attributes.code_format === "text" ? "text" : "pin";
    const modes: PadMode[] | undefined = arm
      ? armModes(this.alarm, this._config.arm_modes).map((m) => ({ icon: ARMED_ICON[m], label: modeLabel(m), active: p.mode === m, on: () => this._pad && (this._pad = { ...this._pad, mode: m }) }))
      : undefined;
    const s = alarmStatus(this.alarm);
    return codePad({
      title: arm ? t("card.alarm.arm_title") : t("card.alarm.disarm_title"),
      sub: arm ? this.name : s.label,
      icon: arm ? "mdi:shield-lock-outline" : "mdi:shield-off-outline",
      color: arm ? "var(--lumen-ok)" : "var(--lumen-danger)",
      modes: modes && modes.length > 1 ? modes : undefined,
      kind,
      code: p.code,
      error: p.error,
      shakeKey: p.shake,
      busy: p.busy,
      act: arm ? t("card.alarm.arm_with", { mode: modeLabel(p.mode).toLocaleLowerCase() }) : t("card.alarm.disarm"),
      narrow: this.narrowScreen,
      // Read the live pad state: several key presses may land before the next render.
      onKey: (k) => {
        const cur = this._pad;
        if (!cur) return;
        const code = cur.error ? "" : cur.code;
        this._pad = { ...cur, error: undefined, code: k === "bk" ? code.slice(0, -1) : code.length < 12 ? code + k : code };
      },
      onText: (v) => this._pad && (this._pad = { ...this._pad, error: undefined, code: v }),
      submit: () => {
        const cur = this._pad;
        if (!cur || cur.busy || (kind !== "none" && !cur.code)) return;
        this.send(cur.kind, cur.code, cur.mode);
      },
      close: () => (this._pad = null),
    });
  }

  /** Row / tile look of the current state. */
  private look(s: Status, e: HassEntity | undefined, short: boolean): Look {
    if (s.tone === "unavailable") return unavailableLook(s.icon);
    const cd = alarmCountdown(e, this._config);
    const st = e?.state;
    if (s.alert) {
      const who = e?.attributes.changed_by;
      return { icon: s.icon, sub: who ? (short ? who : `${s.label} · ${who}`) : s.label, subC: "rgba(255,255,255,.9)", bg: "var(--lumen-danger)", fg: WHITE, border: "1px solid transparent", iconBg: "rgba(255,255,255,.2)", iconFg: WHITE, anim: "lumenAlarmBg 1.2s ease-in-out infinite" };
    }
    if (s.tone === "ok") return { icon: s.icon, sub: short && st ? modeLabel(st) : s.label, ...toned("var(--lumen-ok)"), ...(short ? { subC: "var(--lumen-text-2)" } : {}) };
    if (st === "pending") {
      const sub = short ? (cd ? t("card.alarm.code_left", { s: cd.left }) : t("card.lock.code")) : s.label;
      return { icon: s.icon, sub, ...toned("var(--lumen-orange)"), anim: "lumenPendingPulse 1.4s ease-in-out infinite", border: "1px solid color-mix(in srgb, var(--lumen-orange) 45%, var(--lumen-border))" };
    }
    if (st === "arming") {
      const sub = short && cd ? `${t("card.alarm.arming_short")} · ${cd.left} s` : s.label;
      return { icon: s.icon, sub, ...toned("var(--lumen-warning)") };
    }
    if (s.tone === "warning") return { icon: s.icon, sub: s.label, ...toned("var(--lumen-warning)"), subC: "var(--lumen-text-2)", iconAnim: "lumenBreath 2400ms ease-in-out infinite" };
    if (st === "unknown") return { icon: s.icon, sub: s.label, iconFg: "var(--lumen-text-3)", subC: "var(--lumen-text-3)" };
    const off = st === "disarmed" ? cssColor(this._config.disarmed_color) : undefined;
    if (off) return { icon: s.icon, sub: s.label, ...toned(off), subC: "var(--lumen-text-2)" };
    return { icon: s.icon, sub: s.label, ...(s.tone === "info" ? toned(tone("info")) : {}) };
  }

  /** Buttons of the state (catalog B): Arm / Disarm / Cancel / Code. */
  private buttons(e: HassEntity | undefined, s: Status): Seg[] {
    const st = e?.state;
    if (!e || s.tone === "unavailable" || this._config.show_buttons === false) return [];
    const busy = !!this.pending;
    if (st === "disarmed") return [{ icon: "mdi:shield-lock-outline", label: t("card.alarm.arm"), spin: busy, tap: () => this.arm() }];
    if (st === "arming") return [{ icon: "mdi:close", label: t("card.alarm.cancel"), spin: busy, tap: () => this.disarm() }];
    if (st === "pending") return [{ icon: "mdi:dialpad", label: this.needsCode(false) ? t("card.lock.code") : t("card.alarm.disarm"), spin: busy, tap: () => this.disarm() }];
    if (st === "triggered") return [{ icon: "mdi:dialpad", label: t("card.alarm.disarm"), color: WHITE, spin: busy, tap: () => this.disarm() }];
    if (st === "disarming") return [{ icon: "mdi:shield-off-outline", label: t("card.alarm.disarm"), spin: true }];
    if (isArmed(st) || st === "unknown") return [{ icon: "mdi:shield-off-outline", label: t("card.alarm.disarm"), spin: busy, tap: () => this.disarm() }];
    return [];
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.alarm;
    const s = alarmStatus(e, c.icon);
    const handlers = this.presses.handlers(
      `alarm:${c.entity}`,
      () => this.tap(),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    // Owner 2026-10-29: compact is the access bar cell again (no square / icon-only tiles).
    if (this.compact) {
      // Catalog correction 2026-10-30: hold 500 ms = the main command (arm / cancel / the
      // disarm pad), a tap = the tap action or more-info.
      const cell = this.presses.handlers(
        `alarmcell:${c.entity}`,
        () => (c.tap_action ? this.tap() : this.moreInfo(c.entity)),
        () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.primary()),
        c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
      );
      const anim = s.alert ? "lumenShake 900ms ease-in-out infinite" : s.busy ? "lumenBreath 2400ms ease-in-out infinite" : "none";
      const off = e?.state === "disarmed" ? cssColor(c.disarmed_color) : undefined;
      return compactCell({ title: `${this.name} · ${s.label}`, color: off ?? tone(s.tone), handlers: cell, alert: s.alert, unavailable: s.tone === "unavailable", extra: this.subs.render(c.sub_buttons, { compact: true, max: 1 }), body: icon(alarmBarIcon(e, c.icon), `display:block;animation:${anim}`) });
    }
    const l = this.look(s, e, false);
    const cd = alarmCountdown(e, c);
    const btns = this.buttons(e, s);
    const bar = e?.state === "arming" || e?.state === "pending"
      ? countdown(cd ? cd.pct : null, e.state === "arming" ? "var(--lumen-warning)" : "var(--lumen-orange)", cd ? `${cd.left} s` : "")
      : nothing;
    return html`<div data-fx ${pressable(handlers)} aria-label="${this.name} · ${l.sub}" class="press alarmrow" style=${rowFrame(l, true)}>${WFX}
      <div style="position:relative;display:flex;align-items:center;gap:10px;min-height:34px">
        ${rowIcon(l)}${rowText(this.name, l, c.show_state !== false)}
        ${this.pending && !btns.length ? html`<span style=${spinnerStyle(16)}></span>` : nothing}
        ${btns.length ? segs(btns, false, "rowbtns") : nothing}${this.subs.render(c.sub_buttons)}${l.una ? unplugged() : nothing}
      </div>${bar}
    </div>`;
  }

  getCardSize() {
    return this.compact ? 2 : 1;
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
      { name: "arm_modes", selector: { select: { multiple: true, mode: "list", options: ["armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass"].map((value) => ({ value, label: modeLabel(value) })) } } },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "arming_time", selector: { number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } } },
          { name: "pending_time", selector: { number: { min: 0, max: 600, step: 1, mode: "box", unit_of_measurement: "s" } } },
        ],
      },
      { name: "", type: "grid", flatten: true, schema: [{ name: "banner", default: true, selector: { boolean: {} } }, { name: "screen_ring", default: true, selector: { boolean: {} } }] },
      { name: "", type: "grid", flatten: true, schema: [{ name: "banner_text", selector: { text: {} } }, { name: "disarmed_color", selector: { ui_color: {} } }] },
      actions(),
      advanced([["show_state"], ["show_buttons"]], { subButtons: true }),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-alarm-card", LumenAlarmCard, {
  name: "card.alarm.name",
  description: "card.alarm.description",
  domains: ["alarm_control_panel"],
});
