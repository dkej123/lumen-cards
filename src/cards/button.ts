import { nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { icon } from "../core/lumen-icon";
import { cssColor } from "../core/styles";
import { actions, advanced, appearance, entityStub, form, hide, nameIcon } from "../core/form";
import { SubButtons, subButtonEntities, subButtonLimit } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { compactCell } from "../core/status-row";
import { ACCENT, NEUTRAL, type TileLook, toneBorder, toneLook, UNAVAILABLE, UNKNOWN } from "../core/parts";
import { rowTile } from "../core/tile";
import { requireEntity } from "../core/validate";
import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { stateText } from "../logic/format";
import { activeFeedback, waitForResponse, type EntitySource } from "../logic/response";
import { RUN, defaultTap } from "../logic/run";
import { formatWhen } from "../logic/time";

export interface ButtonFeedback {
  /** Sensor with the response code of the device. */
  status_entity: string;
  /** Status state that means success. Default "200". */
  success_state?: string;
  /** Sensor with the response text (shown on failure). */
  message_entity?: string;
  /** Text on success (with the response code). Default "Done". */
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
  /** Wait for the device's answer after a tap and show it on the card. */
  feedback?: ButtonFeedback;
  /** Second line. auto: last use (last_used_entity → last success → last run), else the state. */
  secondary_info?: "auto" | "state" | "last-triggered" | "last-changed" | "none";
  /** input_datetime (or any entity with a `timestamp` attribute) holding the last use. */
  last_used_entity?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
  /** Colour of the icon / access-bar cell at rest (Dom: gate and barrier in info blue). */
  color?: string | [number, number, number];
}

/** The time an entity holds: an input_datetime's `timestamp` attribute, or a timestamp sensor's ISO state. */
export function lastUsedMs(e: HassEntity | undefined): number | undefined {
  const ts = e?.attributes.timestamp;
  if (typeof ts === "number") return ts * 1000;
  const ms = e && /^\d{4}-\d{2}-\d{2}/.test(e.state) ? Date.parse(e.state) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

/** How long the success line stays before the last use comes back (catalog: 6 s). */
export const SUCCESS_MS = 6000;

const ICONS: Record<string, string> = { script: "mdi:script-text-play", scene: "mdi:palette", button: "mdi:gesture-tap-button", input_button: "mdi:gesture-tap-button", automation: "mdi:robot" };

export function validateButton(c: Partial<ButtonConfig>): void {
  requireEntity(c);
}

type Phase = "idle" | "wait" | "ok" | "err";

/**
 * A button that runs something and (optionally) waits for the device's answer (design gate /
 * barrier, generalised). With `feedback`: spinner and "Waiting…" (at most 10 s), then a green
 * line with the code for 6 s, or a red frame with the error until the next use.
 */
export class LumenButtonCard extends LumenBaseCard<ButtonConfig> {
  protected static grid = GRID.half;
  static properties = { ...LumenBaseCard.properties, _phase: { state: true } };
  protected static compactBelow = 120;
  private subs = new SubButtons(this);
  private _phase: Phase = "idle";
  /** Outcome of the last use: response code and text. */
  private result: { code: string | null; text: string } | null = null;
  private okTimer?: number;
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
    const fb = this.feedback;
    return [c.entity, fb?.status_entity, fb?.message_entity, c.last_used_entity, ...subButtonEntities(c.sub_buttons)];
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
    window.clearTimeout(this.okTimer);
    if (this._phase === "ok") this._phase = "idle";
  }

  /** The `feedback` option, once it names the status sensor. */
  private get feedback(): ButtonFeedback | undefined {
    return activeFeedback<ButtonFeedback>(this._config.feedback);
  }

  private get name() {
    const c = this._config;
    return entityName(c.name, this.entity(c.entity), c.entity);
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
    const tap = defaultTap(c.entity);
    if (tap.kind === "run") return this._hass!.callService(tap.domain, tap.service, {}, { entity_id: c.entity });
    if (tap.kind === "toggle") return this._hass!.callService("homeassistant", "toggle", {}, { entity_id: c.entity });
    this.moreInfo(c.entity);
    return Promise.resolve();
  }

  private fail(code: string | null, text: string) {
    this.result = { code, text };
    this._phase = "err";
  }

  private async run() {
    const c = this._config;
    if (!this._hass || this._phase === "wait") return;
    window.clearTimeout(this.okTimer);
    this.result = null;
    this._phase = "idle";
    const fb = this.feedback;
    // Without feedback a plain action (navigate, more-info…) needs no spinner.
    if (!fb) {
      this.start().catch((err: Error) => this.fail(null, err.message ?? String(err)));
      return;
    }
    this._phase = "wait";
    const since = Date.now();
    try {
      await this.start();
      const result = await waitForResponse(this.source, { script: c.entity, status: fb.status_entity, body: fb.message_entity, success: String(fb.success_state ?? "200") }, since);
      this.haptic(result?.ok ? "success" : "failure");
      if (!result) this.fail(null, t("card.button.no_response"));
      else if (!result.ok) this.fail(result.code, result.body || t("card.button.device_error"));
      else {
        this.result = { code: result.code, text: fb.success_text ?? t("card.button.done") };
        this._phase = "ok";
        this.okTimer = window.setTimeout(() => {
          if (this._phase === "ok") this._phase = "idle";
        }, SUCCESS_MS);
      }
    } catch (err) {
      this.haptic("failure");
      this.fail(null, (err as Error).message ?? String(err));
    }
  }

  /** Second line while waiting / after the answer; null = the normal `secondary_info`. */
  private outcome(short: boolean): string | null {
    const r = this.result;
    switch (this._phase) {
      case "wait":
        return t("card.button.waiting");
      case "ok": {
        const code = r?.code ? (/^2\d\d$/.test(r.code) ? `${r.code} OK` : r.code) : "";
        return short ? code || r!.text : [r?.text, code].filter(Boolean).join(" · ");
      }
      case "err": {
        const code = r?.code ? t("card.button.error_code", { code: r.code }) : "";
        return short ? code || r!.text : [code, r?.text].filter(Boolean).join(" · ");
      }
    }
    return null;
  }

  /** Colours of the current phase / state. */
  private look(e: HassEntity | undefined): TileLook {
    if (!e || e.state === "unavailable") return UNAVAILABLE;
    switch (this._phase) {
      case "wait":
        return { ...ACCENT, border: toneBorder("var(--lumen-accent)", 35) };
      case "ok":
        return toneLook("var(--lumen-ok)");
      case "err":
        return toneLook("var(--lumen-danger)", toneBorder("var(--lumen-danger)", 40));
    }
    if (e.state === "unknown") return UNKNOWN;
    if (e.state === "on") return ACCENT;
    const col = cssColor(this._config.color);
    return col ? { ...NEUTRAL, iconBg: `color-mix(in srgb, ${col} 16%, transparent)`, iconFg: col } : NEUTRAL;
  }

  private when(iso: string | undefined): string | undefined {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ms) ? formatWhen(ms) : undefined;
  }

  /** Second line (`secondary_info`). */
  private sub(e: HassEntity | undefined): string {
    const c = this._config;
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
    const used = lastUsedMs(this.entity(c.last_used_entity));
    if (used !== undefined) return formatWhen(used);
    const fb = this.feedback;
    const status = fb ? this.entity(fb.status_entity) : undefined;
    if (status && status.state === String(fb!.success_state ?? "200")) {
      const ok = this.when(status.attributes.last_run ?? status.last_changed);
      if (ok) return ok;
    }
    if (RUN[this.domain]) return this.when(e?.attributes.last_triggered ?? (this.domain === "script" ? undefined : e?.state)) ?? t("card.button.run");
    return state();
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const una = !e || e.state === "unavailable";
    const busy = this._phase === "wait";
    const h = una
      ? undefined
      : this.actions(`button:${c.entity}`, c, c.entity, { tap: () => this.run(), hold: () => this.moreInfo(this.feedback?.status_entity ?? c.entity) });
    const ic = c.icon ?? e?.attributes.icon ?? ICONS[this.domain] ?? "mdi:gesture-tap";
    const look = this.look(e);
    // Owner 2026-10-29: compact is always the access bar cell (no square tile).
    const tiny = this.compact;
    const out = this.outcome(tiny);
    const sub = una ? t("common.unavailable") : out ?? (c.show_state === false ? "" : this.sub(e));
    if (tiny) {
      return compactCell({ title: `${this.name}${sub ? ` · ${sub}` : ""}`, color: look.iconFg ?? "var(--lumen-text-2)", handlers: h, disabled: una, unavailable: una, extra: this.subs.render(c.sub_buttons, { compact: true, max: 1 }), body: icon(busy ? "mdi:loading" : ic, `display:block;animation:${busy ? "lumenSpin 900ms linear infinite" : "none"}`) });
    }
    const opts = {
      title: this.name,
      sub,
      look,
      lead: c.show_icon !== false ? ic : undefined,
      handlers: h,
      busy,
      plug: una,
      showTitle: c.show_name !== false,
      showSub: c.show_state !== false || out !== null || una,
      trailing: this.subs.render(c.sub_buttons, { compact: false, max: subButtonLimit(false, this._width) }),
    };
    return rowTile(opts);
  }

  static getStubConfig = entityStub(["script", "button", "input_button", "scene"], "script.open_gate");

  static getConfigForm() {
    return form(
      (config) => hide(config, [
        { name: "entity", required: true, selector: { entity: {} } },
        nameIcon(),
        { name: "color", selector: { ui_color: {} } },
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
      ], [[(config?.secondary_info ?? "auto") !== "auto", ["last_used_entity"]]]),
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
