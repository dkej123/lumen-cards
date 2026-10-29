import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { compactCell } from "../core/status-row";
import { glass, tone } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity, HassLike } from "../hass/types";
import { stateText } from "../logic/format";

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

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;
const glyph = (ic: string, anim: string) => icon(ic, `display:block;animation:${anim}`);
/** LockEntityFeature.OPEN */
const FEATURE_OPEN = 1;

export function validateLock(c: Partial<LockConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("card.lock.error.entity"));
}

interface LockLook {
  icon: string;
  tone: string;
  label: string;
}

function lockLook(e: HassEntity | undefined, custom?: string): LockLook {
  if (!e || e.state === "unavailable") return { icon: custom ?? "mdi:lock-off", tone: "unavailable", label: t("common.no_data") };
  // Many cars report `unknown` between polls: still controllable, state not known.
  if (e.state === "unknown") return { icon: custom ?? "mdi:lock-question", tone: "info", label: t("card.lock.unknown") };
  switch (e!.state) {
    case "locked":
      return { icon: custom ?? "mdi:lock", tone: "ok", label: t("card.lock.locked") };
    case "unlocked":
      return { icon: custom ?? "mdi:lock-open-variant", tone: "orange", label: t("card.lock.unlocked") };
    case "open":
      return { icon: custom ?? "mdi:lock-open-variant", tone: "danger", label: t("card.lock.open") };
    case "jammed":
      return { icon: "mdi:lock-alert", tone: "danger", label: t("card.lock.jammed") };
    case "locking":
      return { icon: "mdi:lock-clock", tone: "warning", label: t("card.lock.locking") };
    case "unlocking":
    case "opening":
      return { icon: "mdi:lock-clock", tone: "warning", label: t("card.lock.unlocking") };
    default:
      return { icon: custom ?? "mdi:lock", tone: "info", label: e!.state };
  }
}

/**
 * A lock (e.g. a car's remote lock): state + lock / unlock (+ open) buttons when wide,
 * a cell with a lock dialog when compact; asks for the code when the lock needs one; a toast
 * when the command went through.
 */
export class LumenLockCard extends LumenBaseCard<LockConfig> {
  static properties = { ...LumenBaseCard.properties, _cmd: { state: true }, _dialog: { state: true }, _ask: { state: true } };
  protected static compactBelow = 200;
  /** Command on its way. */
  private _cmd: { cmd: Cmd; sawBusy: boolean; since: number } | null = null;
  private _dialog = false;
  /** Command waiting for the code. */
  private _ask: Cmd | null = null;
  private presses = new Presses((type) => this.haptic(type));

  protected layer = new LayerController(
    this,
    () => ((this._dialog || this._ask) && !this.preview ? this.dialog() : nothing),
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
  }

  private get name() {
    const c = this._config;
    return c.name || this.entity(c.entity)?.attributes.friendly_name || c.entity;
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
    this._ask = null;
  }

  /** Asks for the code first when the lock has a `code_format`. */
  private request(cmd: Cmd) {
    if (this.busy() || this.offline) return;
    if (this.lock?.attributes.code_format) {
      this._ask = cmd;
      return;
    }
    this.send(cmd);
  }

  private send(cmd: Cmd, code?: string) {
    const c = this._config;
    // Taps while a command is on its way are ignored in logic, not only by `disabled`.
    if (this.busy() || !this._hass) return;
    this.haptic();
    this._cmd = { cmd, sawBusy: false, since: Date.now() };
    this._hass
      .callService("lock", cmd, code ? { code } : {}, { entity_id: c.entity })
      .catch((err: Error) => {
        this._cmd = null;
        toast(this, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: err.message ?? String(err) });
      });
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

  private look(): LockLook {
    const l = lockLook(this.lock, this._config.icon);
    const busy = this.busy();
    if (!busy) return l;
    const label = busy === "lock" ? t("card.lock.locking") : busy === "busy" ? t("common.sending_command") : t("card.lock.unlocking");
    return { icon: "mdi:lock-clock", tone: "warning", label };
  }

  private cardHandlers() {
    const c = this._config;
    if (!c.tap_action && !c.hold_action && !c.double_tap_action) return undefined;
    return this.presses.handlers(
      `lock:${c.entity}`,
      c.tap_action ? () => handleAction(this, c.tap_action, c.entity, "tap") : undefined,
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
  }

  private row() {
    const busy = this.busy();
    const una = this.offline;
    const st = this.lock?.state;
    const l = this.look();
    const col = tone(l.tone);
    const name = this.name;
    const btn = (cmd: Cmd, label: string, busyLabel: string, ico: string, current: boolean) => {
      const active = busy === cmd;
      const off = una || (!!busy && !active);
      return html`<button class="seg" aria-label="${label} · ${name}" aria-pressed=${current} ?disabled=${una || current || !!busy} @click=${() => this.request(cmd)}
        style="min-height:40px;padding:0 10px;border-radius:11px;border:0;background:${current ? "var(--lumen-surface-solid)" : "transparent"};color:${current ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};box-shadow:${current ? "var(--lumen-shadow-1)" : "none"};font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px;cursor:${current || off ? "default" : "pointer"};opacity:${off ? 0.4 : 1};transition:opacity 300ms, background-color 200ms, transform 200ms var(--lumen-ease-spring)">
        ${icon(active ? "mdi:loading" : ico, `font-size:16px;animation:${active ? "lumenSpin 800ms linear infinite" : "none"}`)}${active ? busyLabel : label}</button>`;
    };
    return html`<div data-fx class="lockrow" style="display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 6px 6px 8px;box-sizing:border-box;border-radius:18px;background:${busy ? "color-mix(in srgb, var(--lumen-orange) 9%, var(--lumen-surface))" : "var(--lumen-surface)"};border:1px solid var(--lumen-border);${glass}">${WFX}
      <div ${pressable(this.cardHandlers())} aria-label=${name} style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;cursor:${this.cardHandlers() ? "pointer" : "default"}">
        <div style="flex:none;width:28px;height:28px;border-radius:10px;display:grid;place-items:center;font-size:17px;background:color-mix(in srgb, ${col} 16%, transparent);color:${col};transition:background-color 400ms, color 400ms">${icon(l.icon, `display:block;animation:${busy ? "lumenBreath 2400ms ease-in-out infinite" : "none"}`)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>${this._config.show_state !== false || busy ? html`<div style="font-size:11px;font-weight:600;line-height:14px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${busy ? l.label : stateText(this._hass, this.lock, l.label)}</div>` : nothing}</div>
      </div>
      <div class="lockbtns" style="flex:none;display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--lumen-surface-2)">
        ${btn("lock", t("card.lock.lock"), t("card.lock.locking"), "mdi:lock", st === "locked")}${btn("unlock", t("card.lock.unlock"), t("card.lock.unlocking"), "mdi:lock-open-variant", st === "unlocked")}${this.canOpen ? btn("open", t("card.lock.open_action"), t("card.lock.opening"), "mdi:door-open", st === "open") : nothing}
      </div>
    </div>`;
  }

  /** Lock dialog (compact card) or code prompt: the choice closes it and sends the command. */
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
    const submit = (e: Event) => {
      e.preventDefault();
      const input = (e.currentTarget as HTMLFormElement).elements.namedItem("code") as HTMLInputElement;
      const cmd = this._ask;
      this._ask = null;
      if (cmd) this.send(cmd, input.value);
    };
    const numeric = this.lock?.attributes.code_format === "^\\d+$" || this.lock?.attributes.code_format === "^\\d*$";
    const body = this._ask
      ? html`<form @submit=${submit} style="display:flex;flex-direction:column;gap:10px">
          <input name="code" type="password" autocomplete="off" inputmode=${numeric ? "numeric" : "text"} aria-label=${t("card.lock.code")} placeholder=${t("card.lock.code")}
            style="height:52px;border-radius:16px;border:1px solid var(--lumen-border);background:var(--lumen-surface-2);color:var(--lumen-text-1);font:700 20px var(--lumen-font);text-align:center;letter-spacing:.2em;outline:none" />
          <button class="press" type="submit" style="height:52px;border-radius:16px;border:0;background:var(--lumen-accent);color:var(--lumen-on-accent);font:750 15px var(--lumen-font);cursor:pointer">${this._ask === "lock" ? t("card.lock.lock") : this._ask === "open" ? t("card.lock.open_action") : t("card.lock.unlock")}</button>
        </form>`
      : html`<div style="display:grid;grid-template-columns:repeat(${this.canOpen ? 3 : 2}, 1fr);gap:8px">
          ${act("lock", t("card.lock.lock"), "mdi:lock", "var(--lumen-ok)")}${act("unlock", t("card.lock.unlock"), "mdi:lock-open-variant", "var(--lumen-orange)")}${this.canOpen ? act("open", t("card.lock.open_action"), "mdi:door-open", "var(--lumen-danger)") : nothing}
        </div>`;
    return html`
      <div @click=${close} style="position:absolute;inset:0;z-index:20;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:lumenFadeIn 240ms both"></div>
      <div role="dialog" aria-modal="true" aria-label=${this.name} style="position:absolute;left:12px;right:12px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:21;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:18px 14px 14px;border-radius:30px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);animation:lumenSheetIn 460ms var(--lumen-ease-spring) both;max-width:520px;margin:0 auto">
        <div style="display:flex;align-items:center;gap:10px;padding:0 4px">
          <span style="flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb, ${tone(l.tone)} 16%, transparent);color:${tone(l.tone)}">${icon(l.icon)}</span>
          <div style="flex:1;min-width:0"><div style="font-size:17px;font-weight:800">${this.name}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2)">${this._ask ? t("card.lock.enter_code") : stateText(this._hass, this.lock, l.label)}</div></div>
          <button class="press" @click=${close} aria-label=${t("common.close")} style="flex:none;width:40px;height:40px;border-radius:12px;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;display:grid;place-items:center;cursor:pointer">${icon("mdi:close")}</button>
        </div>
        ${body}
      </div>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    if (!this.compact) return this.row();
    const una = this.offline;
    const busy = !!this.busy();
    const l = this.look();
    return compactCell({
      title: `${this.name} · ${stateText(this._hass, this.lock, l.label)}`,
      color: tone(l.tone),
      disabled: busy || una,
      handlers: this.presses.handlers(
        `lockcell:${this._config.entity}`,
        () => {
          if (busy || una) return;
          this._dialog = true;
        },
        () => this.moreInfo(this._config.entity),
      ),
      body: busy ? glyph("mdi:loading", "lumenSpin 800ms linear infinite") : glyph(l.icon, "none"),
    });
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "lock", entities, fallback) ?? firstOf(hass, "lock", "lock.front_door") };
  }

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
