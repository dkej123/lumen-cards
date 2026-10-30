import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { CodePad } from "../core/controllers/code-pad";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, entityStub, form } from "../core/form";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { codePad, dangerBorder, rowFrame, rowIcon, rowText, segs, toned, unavailableLook, unplugged, WFX, type Look, type Seg } from "../core/parts";
import { tone } from "../core/styles";
import { compactCell } from "../core/status-row";
import { toast } from "../core/toast";
import { requireEntity } from "../core/validate";
import type { HassEntity } from "../hass/types";
import { stateText } from "../logic/format";
import { ageMs, formatDuration } from "../logic/time";

export interface LockConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Read-only flag that is on while the lock carries out a command (e.g. a car's remote lock); without it the lock state decides. */
  busy_entity?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  show_state?: boolean;
}

type Cmd = "lock" | "unlock" | "open";

/** LockEntityFeature.OPEN */
const FEATURE_OPEN = 1;

export function validateLock(c: Partial<LockConfig>): void {
  requireEntity(c, { msg: "card.lock.error.entity" });
}

interface LockLook {
  icon: string;
  tone: string;
  label: string;
  /** Muted extra after the label ("5 min", "check the door"). */
  meta?: string;
  /** Red frame (open, jammed). */
  alarm?: boolean;
}

/** Look of every lock state (catalog section 06). */
export function lockLook(e: HassEntity | undefined, custom?: string, now = Date.now()): LockLook {
  if (!e || e.state === "unavailable") return { icon: custom ?? "mdi:lock-off-outline", tone: "unavailable", label: t("common.unavailable") };
  // Many cars report `unknown` between polls: still controllable, state not known.
  if (e.state === "unknown") return { icon: "mdi:lock-question", tone: "text-3", label: t("card.lock.unknown") };
  switch (e.state) {
    case "locked":
      return { icon: custom ?? "mdi:lock", tone: "ok", label: t("card.lock.locked") };
    case "unlocked": {
      const ms = ageMs(e.last_changed, now);
      return { icon: custom ?? "mdi:lock-open-variant", tone: "warning", label: t("card.lock.unlocked"), meta: Number.isFinite(ms) && ms >= 60_000 ? formatDuration(ms) : undefined };
    }
    case "open":
      return { icon: "mdi:door-open", tone: "danger", label: t("card.lock.open"), alarm: true };
    case "jammed":
      return { icon: "mdi:lock-alert", tone: "danger", label: t("card.lock.jammed"), meta: t("card.lock.check_door"), alarm: true };
    case "locking":
      return { icon: custom ?? "mdi:lock", tone: "warning", label: t("card.lock.locking") };
    case "unlocking":
    case "opening":
      return { icon: custom ?? "mdi:lock-open-variant", tone: "warning", label: e.state === "opening" ? t("card.lock.opening") : t("card.lock.unlocking") };
    default:
      return { icon: custom ?? "mdi:lock", tone: "info", label: e.state };
  }
}

/** Code pad kind of a lock's code_format (a regex): digits only = keypad, anything else = text field. */
export const lockPadKind = (format: unknown): "pin" | "text" =>
  typeof format === "string" && /^\^?(\\d|\[0-9\])[+*]?(\{\d*,?\d*\})?\$?$/.test(format) ? "pin" : "text";

/**
 * A lock (e.g. a car's remote lock): state + lock / unlock (+ open) buttons when wide,
 * a cell with a lock dialog when compact; asks for the code when the lock needs one; a toast
 * when the command went through.
 */
export class LumenLockCard extends LumenBaseCard<LockConfig> {
  protected static cardSize = 2;
  static properties = { ...LumenBaseCard.properties, _cmd: { state: true }, _dialog: { state: true } };
  protected static compactBelow = 200;
  protected static iconBelow = 100;
  protected static sample = (id: string): HassEntity => ({ entity_id: id, state: "locked", attributes: { friendly_name: t("card.lock.name"), supported_features: 1 }, last_changed: new Date().toISOString(), last_updated: new Date().toISOString() });
  /** Command on its way. */
  private _cmd: { cmd: Cmd; sawBusy: boolean; since: number } | null = null;
  private _dialog = false;
  /** Command waiting for the code (PIN pad). */
  private pad = new CodePad<{ cmd: Cmd }>(this);

  protected layer = new LayerController(
    this,
    () => (this.preview ? nothing : this.pad.state ? this.padView() : this._dialog ? this.dialog() : nothing),
    () => this.closeDialog(),
  );

  protected entityIds() {
    return [this._config.entity, this._config.busy_entity];
  }

  protected validate(c: LockConfig) {
    validateLock(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(1000, () => {
      if (this._cmd && Date.now() - this._cmd.since > 35_000) this._cmd = null;
    });
  }

  private get name() {
    const c = this._config;
    return entityName(c.name, this.entity(c.entity), c.entity);
  }

  private get lock() {
    return this.entity(this._config.entity);
  }

  /** Only `unavailable` blocks the buttons (`unknown` locks still take commands). */
  private get offline() {
    return !this.lock || this.lock.state === "unavailable";
  }

  private get canOpen() {
    return ((this.lock?.attributes.supported_features ?? 0) & FEATURE_OPEN) !== 0;
  }

  private busy(): Cmd | "busy" | null {
    const c = this._config;
    const st = this.lock?.state;
    return this._cmd?.cmd ?? (this.entity(c.busy_entity)?.state === "on" || st === "locking" || st === "unlocking" || st === "opening" ? "busy" : null);
  }

  private closeDialog() {
    this._dialog = false;
    this.pad.close();
  }

  /** Lock right away; unlock / open ask for the code first when the lock has a `code_format`. */
  private request(cmd: Cmd) {
    if (this.busy() || this.offline) return;
    if (cmd !== "lock" && this.lock?.attributes.code_format) {
      this.pad.show({ cmd });
      return;
    }
    this.send(cmd);
  }

  private async send(cmd: Cmd, code?: string) {
    const c = this._config;
    // Taps while a command is on its way are ignored in logic, not only by `disabled`.
    if (this.busy() || !this._hass) return;
    this.haptic();
    this._cmd = { cmd, sawBusy: false, since: Date.now() };
    this.pad.sending();
    try {
      await this._hass.callService("lock", cmd, code ? { code } : {}, { entity_id: c.entity });
      this.pad.close();
    } catch (err) {
      this._cmd = null;
      const msg = (err as Error)?.message ?? String(err);
      this.haptic("failure");
      if (this.pad.state) {
        this.pad.failed(t("card.alarm.wrong_code"));
      } else if (cmd === "lock" && this.lock?.attributes.code_format) {
        // A lock that wants the code for locking too.
        this.pad.show({ cmd });
      } else {
        toast(this, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: msg });
      }
    }
  }

  /** Done when the busy flag went on and off again, or (without one) when the lock reached the target state. */
  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    const c = this._config;
    const cmd = this._cmd;
    if (!c || !this._hass || !cmd) return;
    let done = false;
    if (c.busy_entity) {
      const busy = this.entity(c.busy_entity)?.state === "on";
      if (busy && !cmd.sawBusy) this._cmd = { ...cmd, sawBusy: true };
      done = !busy && cmd.sawBusy;
    } else {
      const st = this.lock?.state;
      done = st === (cmd.cmd === "lock" ? "locked" : cmd.cmd === "open" ? "open" : "unlocked") || (cmd.cmd === "open" && st === "unlocked") || st === "jammed";
    }
    if (!done) return;
    this._cmd = null;
    toast(this,
      cmd.cmd === "lock"
        ? { icon: "mdi:lock", tone: "ok", title: this.name, text: t("card.lock.sent_lock") }
        : { icon: "mdi:lock-open-variant", tone: "orange", title: this.name, text: t("card.lock.sent_unlock") },
    );
  }

  /** The state's look, with the command on its way (ours, the busy flag or locking / unlocking) on top. */
  private look(): Look {
    const l = lockLook(this.lock, this._config.icon);
    const busy = this.busy();
    if (l.tone === "unavailable") return unavailableLook(l.icon);
    const st = this.lock?.state;
    const sending = busy && st !== "locking" && st !== "unlocking" && st !== "opening";
    if (sending) {
      const label = busy === "lock" ? t("card.lock.locking") : busy === "busy" ? t("common.sending_command") : busy === "open" ? t("card.lock.opening") : t("card.lock.unlocking");
      return { icon: busy === "lock" ? "mdi:lock" : "mdi:lock-open-variant", sub: label, ...toned("var(--lumen-warning)"), subC: "var(--lumen-text-2)", iconAnim: "lumenBreath 2400ms ease-in-out infinite" };
    }
    const sub = l.tone === "text-3" || l.tone === "info" ? l.label : stateText(this._hass, this.lock, l.label);
    if (l.tone === "text-3") return { icon: l.icon, sub, iconFg: "var(--lumen-text-3)", subC: "var(--lumen-text-3)" };
    const look: Look = { icon: l.icon, sub, meta: l.meta, ...toned(tone(l.tone)), ...(l.alarm ? { border: dangerBorder } : {}) };
    // Locking / unlocking: the caption stays neutral, the button spins.
    if (st === "locking" || st === "unlocking" || st === "opening") look.subC = "var(--lumen-text-2)";
    return look;
  }

  private cardHandlers() {
    const c = this._config;
    if (!c.tap_action && !c.hold_action && !c.double_tap_action) return undefined;
    return this.actions(`lock:${c.entity}`, c, c.entity, { tap: null });
  }

  /**
   * Lock / Unlock (/ Open with LockEntityFeature.OPEN): the current state is raised, a command on
   * its way spins, the others wait (.38); open locks only offer Open; jammed / unknown offer all.
   */
  private buttons(): Seg[] {
    const una = this.offline;
    const st = this.lock?.state;
    const busy = this.busy();
    const spinning: Cmd | null = busy === "busy" ? (st === "locking" ? "lock" : st === "opening" ? "open" : st === "unlocking" ? "unlock" : null) : busy;
    const current: Cmd | null = st === "locked" ? "lock" : st === "unlocked" ? "unlock" : st === "open" ? "open" : null;
    const name = this.name;
    const b = (cmd: Cmd, label: string, ic: string): Seg => {
      const on = spinning ? spinning === cmd : current === cmd;
      const off = una || (!!busy && spinning !== cmd) || (st === "open" && cmd !== "open");
      return { icon: ic, label, on, spin: spinning === cmd, off, aria: `${label} · ${name}`, tap: on || off ? undefined : () => this.request(cmd) };
    };
    return [
      b("lock", t("card.lock.lock"), "mdi:lock"),
      b("unlock", t("card.lock.unlock"), "mdi:lock-open-variant-outline"),
      ...(this.canOpen ? [b("open", t("card.lock.open_action"), "mdi:door-open")] : []),
    ];
  }

  private row() {
    const l = this.look();
    const h = this.cardHandlers();
    return html`<div data-fx class="lockrow" style=${rowFrame(l, !!h)}>${WFX}
      <div ${pressable(h)} aria-label="${this.name} · ${l.sub}" style="position:relative;display:flex;align-items:center;gap:10px;min-height:34px">
        ${rowIcon(l)}${rowText(this.name, l, this._config.show_state !== false || !!this.busy())}${l.una ? unplugged() : nothing}
      </div>
      ${segs(this.buttons(), true, "lockbtns")}
    </div>`;
  }

  /** PIN pad (catalog PAD) before unlock / open when the lock has a code_format. */
  private padView() {
    const p = this.pad.state!;
    const open = p.cmd === "open";
    const kind = lockPadKind(this.lock?.attributes.code_format);
    return codePad({
      title: open ? t("card.lock.open_title") : p.cmd === "lock" ? t("card.lock.lock_title") : t("card.lock.unlock_title"),
      sub: this.name,
      icon: open ? "mdi:door-open" : p.cmd === "lock" ? "mdi:lock" : "mdi:lock-open-variant-outline",
      color: "var(--lumen-warning)",
      kind,
      ...this.pad.props(),
      act: open ? t("card.lock.open_action") : p.cmd === "lock" ? t("card.lock.lock") : t("card.lock.unlock"),
      narrow: this.narrowScreen,
      submit: () => {
        const cur = this.pad.state;
        if (cur && !cur.busy && cur.code) this.send(cur.cmd, cur.code);
      },
      close: () => this.closeDialog(),
    });
  }

  /** Lock dialog of the compact card: the choice closes it and sends the command (or opens the pad). */
  private dialog() {
    const close = () => this.closeDialog();
    const l = this.look();
    const st = this.lock?.state;
    const act = (cmd: Cmd, label: string, ic: string, col: string) =>
      html`<button class="press" ?disabled=${(cmd === "lock" && st === "locked") || (cmd === "unlock" && st === "unlocked")} @click=${() => {
        this._dialog = false;
        this.request(cmd);
      }} style="min-height:96px;border-radius:22px;border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font:750 15px var(--lumen-font);cursor:pointer;transition:transform 220ms var(--lumen-ease-spring)">
        <span style="width:44px;height:44px;border-radius:15px;display:grid;place-items:center;font-size:24px;background:color-mix(in srgb, ${col} 16%, transparent);color:${col}">${icon(ic)}</span>${label}</button>`;
    return html`
      <div @click=${close} style="position:absolute;inset:0;z-index:20;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:lumenFadeIn 240ms both"></div>
      <div role="dialog" aria-modal="true" aria-label=${this.name} style="position:absolute;left:12px;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:21;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:18px 14px 14px;border-radius:30px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);animation:lumenSheetIn 460ms var(--lumen-ease-spring) both;max-width:520px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:10px;padding:0 4px">
          <span style="flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:${l.iconBg ?? "var(--lumen-surface-2)"};color:${l.iconFg ?? "var(--lumen-text-2)"}">${icon(l.icon)}</span>
          <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800">${this.name}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2)">${l.sub}</div></div>
          <button class="press" @click=${close} aria-label=${t("common.close")} style="flex:none;width:40px;height:40px;border-radius:12px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;display:grid;place-items:center;cursor:pointer">${icon("mdi:close")}</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${this.canOpen ? 3 : 2}, 1fr);gap:8px">
          ${act("lock", t("card.lock.lock"), "mdi:lock", "var(--lumen-ok)")}${act("unlock", t("card.lock.unlock"), "mdi:lock-open-variant", "var(--lumen-warning)")}${this.canOpen ? act("open", t("card.lock.open_action"), "mdi:door-open", "var(--lumen-danger)") : nothing}
        </div>
      </div>`;
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    if (!this.compact) return this.row();
    const una = this.offline;
    const busy = !!this.busy();
    const l = this.look();
    const st = this.lock?.state;
    // Catalog correction 2026-10-30: hold 500 ms = the main command (lock, or unlock with the
    // code); a tap opens the lock dialog. Nothing while a command is on its way.
    const handlers = this.presses.handlers(
      `lockcell:${this._config.entity}`,
      () => {
        if (busy || una) return;
        this._dialog = true;
      },
      () => {
        if (busy || una) return;
        if (this._config.hold_action) handleAction(this, this._config.hold_action, this._config.entity, "hold");
        else this.request(st === "locked" ? "unlock" : "lock");
      },
    );
    return compactCell({
      title: `${this.name} · ${l.sub}`,
      color: l.iconFg ?? "var(--lumen-text-2)",
      disabled: busy || una,
      unavailable: una,
      handlers,
      body: icon(busy ? "mdi:loading" : l.icon, `display:block;animation:${busy ? "lumenSpin 900ms linear infinite" : "none"}`),
    });
  }

  static getStubConfig = entityStub("lock", "lock.front_door");

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "lock" } } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
      { name: "busy_entity", selector: { entity: { domain: ["input_boolean", "binary_sensor", "switch"] } } },
      actions(),
      advanced([["show_state"]]),
      appearance({ glow: false, layout: "width" }),
    ]);
  }
}

registerCard("lumen-lock-card", LumenLockCard, {
  name: "card.lock.name",
  description: "card.lock.description",
  domains: ["lock"],
});
