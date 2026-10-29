import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { Presses, pressable, spinnerStyle } from "../core/press";
import { registerCard } from "../core/register";
import { compactCell } from "../core/status-row";
import { glass } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity, HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { stateText } from "../logic/format";
import { waitForResponse, type EntitySource } from "../logic/response";
import { formatWhen } from "../logic/time";

export interface ButtonFeedback {
  /** Sensor with the response code of the device. */
  status_entity: string;
  /** Status state that means success. Default "200". */
  success_state?: string;
  /** Sensor with the response text (shown on failure). */
  message_entity?: string;
  /** Toast text on success. Default "Done". */
  success_text?: string;
}

export interface ButtonConfig extends BaseConfig {
  /** What the button runs: script, scene, button, input_button, automation, or anything toggleable. */
  entity: string;
  name?: string;
  icon?: string;
  /** Default: run / press / toggle by the entity's domain. */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** Wait for the device's answer after a tap and show it in a toast. */
  feedback?: ButtonFeedback;
  /** Second line. auto: last use (last_used_entity → last success → last run), else the state. */
  secondary_info?: "auto" | "state" | "last-triggered" | "last-changed" | "none";
  /** input_datetime (or any entity with a `timestamp` attribute) holding the last use. */
  last_used_entity?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

/** Default tap by domain (HA button card / Mushroom entity card behaviour). */
const RUN: Record<string, [string, string]> = {
  script: ["script", "turn_on"],
  scene: ["scene", "turn_on"],
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  automation: ["automation", "trigger"],
};
const TOGGLE = new Set(["switch", "input_boolean", "light", "fan", "cover", "siren", "humidifier", "valve", "media_player", "climate", "lock", "group"]);
const ICONS: Record<string, string> = { script: "mdi:script-text-play", scene: "mdi:palette", button: "mdi:gesture-tap-button", input_button: "mdi:gesture-tap-button", automation: "mdi:robot" };

export function validateButton(c: Partial<ButtonConfig>): void {
  if (!c.entity || typeof c.entity !== "string") throw new Error(t("error.pick_entity"));
  if (c.feedback !== undefined && (typeof c.feedback !== "object" || !c.feedback?.status_entity)) throw new Error(t("card.button.error.feedback"));
}

/**
 * A button that runs something and (optionally) waits for the device's answer (design gate /
 * barrier, generalised): spinner while sending, a toast with the result, the last use as subtitle.
 */
export class LumenButtonCard extends LumenBaseCard<ButtonConfig> {
  static properties = { ...LumenBaseCard.properties, _sending: { state: true } };
  protected static compactBelow = 120;
  private presses = new Presses((type) => this.haptic(type));
  private subs = new SubButtons(this);
  private _sending = false;
  private listeners = new Set<() => void>();
  private source: EntitySource = {
    entity: (id) => this.entity(id),
    subscribe: (fn) => {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    },
  };

  protected onHass() {
    this.listeners.forEach((fn) => fn());
  }

  protected entityIds() {
    const c = this._config;
    return [c.entity, c.feedback?.status_entity, c.feedback?.message_entity, c.last_used_entity, ...(c.sub_buttons ?? []).map((b) => b.entity)];
  }

  protected validate(c: ButtonConfig) {
    validateButton(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(30_000, () => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
    this.subs.dispose();
  }

  private get name() {
    const c = this._config;
    return c.name || this.entity(c.entity)?.attributes.friendly_name || c.entity;
  }

  private get domain() {
    return this._config.entity.split(".")[0];
  }

  private start(): Promise<unknown> {
    const c = this._config;
    if (c.tap_action) {
      handleAction(this, c.tap_action, c.entity, "tap");
      return Promise.resolve();
    }
    const run = RUN[this.domain];
    if (run) return this._hass!.callService(run[0], run[1], {}, { entity_id: c.entity });
    if (TOGGLE.has(this.domain)) return this._hass!.callService("homeassistant", "toggle", {}, { entity_id: c.entity });
    this.moreInfo(c.entity);
    return Promise.resolve();
  }

  private async run() {
    const c = this._config;
    if (!this._hass || this._sending) return;
    const fb = c.feedback;
    // Without feedback a plain action (navigate, more-info…) needs no spinner or toast.
    if (!fb) {
      this.start().catch((err: Error) => toast(this, { icon: "mdi:alert-circle", tone: "danger", title: this.name, text: err.message }));
      return;
    }
    this._sending = true;
    const since = Date.now();
    try {
      await this.start();
      const result = await waitForResponse(this.source, { script: c.entity, status: fb.status_entity, body: fb.message_entity, success: String(fb.success_state ?? "200") }, since);
      this.haptic(result?.ok ? "success" : "failure");
      toast(this,
        !result
          ? { icon: "mdi:alert-circle", tone: "danger", title: this.name, text: t("card.button.no_response") }
          : result.ok
            ? { icon: "mdi:check-circle", tone: "ok", title: this.name, text: fb.success_text ?? t("card.button.done") }
            : { icon: "mdi:alert-circle", tone: "danger", title: this.name, text: result.body || t("card.button.device_error"), code: result.code ?? undefined },
      );
    } catch (err) {
      toast(this, { icon: "mdi:alert-circle", tone: "danger", title: this.name, text: (err as Error).message });
    } finally {
      this._sending = false;
    }
  }

  private when(iso: string | undefined): string | undefined {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) ? formatWhen(ms) : undefined;
  }

  /** Second line (`secondary_info`). */
  private sub(e: HassEntity | undefined): string {
    const c = this._config;
    if (this._sending) return t("common.sending");
    const mode = c.secondary_info ?? "auto";
    const state = () => stateText(this._hass, e, isUnavailable(e) ? t("common.no_data") : (e?.state ?? ""));
    switch (mode) {
      case "none":
        return "";
      case "state":
        return state();
      case "last-changed":
        return this.when(e?.last_changed) ?? "—";
      case "last-triggered":
        return this.when(e?.attributes.last_triggered) ?? "—";
    }
    const ts = c.last_used_entity ? this.entity(c.last_used_entity)?.attributes.timestamp : undefined;
    if (typeof ts === "number") return formatWhen(ts * 1000);
    const fb = c.feedback;
    const status = fb ? this.entity(fb.status_entity) : undefined;
    if (status && status.state === String(fb!.success_state ?? "200")) {
      const ok = this.when(status.attributes.last_run ?? status.last_changed);
      if (ok) return ok;
    }
    if (RUN[this.domain]) return this.when(e?.attributes.last_triggered ?? (this.domain === "script" ? undefined : e?.state)) ?? t("card.button.run");
    return state();
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const busy = this._sending;
    const h = this.presses.handlers(
      `button:${c.entity}`,
      () => this.run(),
      () => (c.hold_action ? handleAction(this, c.hold_action, c.entity, "hold") : this.moreInfo(c.feedback?.status_entity ?? c.entity)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, c.entity, "double_tap") : undefined,
    );
    const ic = c.icon ?? e?.attributes.icon ?? ICONS[this.domain] ?? "mdi:gesture-tap";
    const col = isUnavailable(e) ? "var(--lumen-unavailable)" : e?.state === "on" ? "var(--lumen-warning)" : "var(--lumen-info)";
    const sub = c.show_state === false ? "" : this.sub(e);
    if (this.compact) {
      return compactCell({ title: `${this.name}${sub ? ` · ${sub}` : ""}`, color: col, handlers: h, body: icon(ic, `display:block;animation:${busy ? "lumenBreath 1600ms ease-in-out infinite" : "none"}`) });
    }
    return html`<div data-fx ${pressable(h)} class="press" aria-label="${this.name}${sub ? ` · ${sub}` : ""}" aria-busy=${busy}
      style="position:relative;display:flex;flex-direction:row;align-items:center;gap:6px;min-height:56px;padding:8px 6px 8px 8px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};cursor:pointer;user-select:none;touch-action:pan-y;transition:background-color 500ms, transform 220ms var(--lumen-ease-spring)">${WFX}
      ${c.show_icon !== false ? html`<div style="flex:none;width:28px;height:28px;border-radius:10px;display:grid;place-items:center;font-size:17px;background:color-mix(in srgb, ${col} 16%, transparent);color:${col}">${icon(ic, `display:block;animation:${busy ? "lumenBreath 1600ms ease-in-out infinite" : "none"}`)}</div>` : nothing}
      <div style="min-width:0;flex:1">${c.show_name !== false ? html`<div style="font-size:13px;font-weight:700;line-height:17px">${this.name}</div>` : nothing}${sub ? html`<div style="font-size:11px;font-weight:600;line-height:14px;color:var(--lumen-text-2);text-wrap:balance">${sub}</div>` : nothing}</div>
      ${this.subs.render(c.sub_buttons)}
      ${busy ? html`<span style=${spinnerStyle(10, "position:absolute;top:6px;right:6px")}></span>` : nothing}
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, ["script", "button", "input_button", "scene"], entities, fallback) ?? firstOf(hass, "script", "script.open_gate") };
  }

  static getConfigForm() {
    return form(
      [
        { name: "entity", required: true, selector: { entity: {} } },
        { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } }] },
        {
          name: "secondary_info",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                ["auto", "card.button.secondary.auto"],
                ["state", "card.button.secondary.state"],
                ["last-triggered", "card.button.secondary.last_triggered"],
                ["last-changed", "card.button.secondary.last_changed"],
                ["none", "card.button.secondary.none"],
              ].map(([value, label]) => ({ value, label: t(label) })),
            },
          },
        },
        { name: "last_used_entity", selector: { entity: { domain: ["input_datetime", "sensor"] } } },
        {
          name: "feedback",
          type: "expandable",
          title: t("card.button.feedback"),
          icon: "mdi:message-reply-text-outline",
          schema: [
            { name: "status_entity", selector: { entity: { domain: "sensor" } } },
            { name: "", type: "grid", flatten: true, schema: [{ name: "success_state", selector: { text: {} } }, { name: "success_text", selector: { text: {} } }] },
            { name: "message_entity", selector: { entity: { domain: "sensor" } } },
          ],
        },
        actions(),
        advanced([["show_name"], ["show_icon"], ["show_state"]], { subButtons: true }),
        appearance({ layout: "width" }),
      ],
      (c) => {
        const fb = c.feedback as ButtonFeedback | undefined;
        if (fb !== undefined && typeof fb !== "object") throw new Error("feedback");
      },
    );
  }
}

registerCard("lumen-button-card", LumenButtonCard, {
  name: "card.button.name",
  description: "card.button.description",
  domains: ["script", "button", "input_button", "scene", "automation"],
});
