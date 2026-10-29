import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { t } from "../core/i18n";

export type Tone = "ok" | "warning" | "danger" | "info" | "orange" | "unavailable" | "text-3";

export interface Status {
  icon: string;
  tone: Tone;
  label: string;
  /** Strong alert (alarm triggered): red row, pulse, banner, screen ring. */
  alert?: boolean;
  /** Operation in progress – lumenBreath on the icon. */
  busy?: boolean;
}

/** Arm modes in the catalog's order, with their AlarmControlPanelEntityFeature bit. */
export const ARM_MODES: readonly [string, number][] = [
  ["armed_home", 1],
  ["armed_away", 2],
  ["armed_night", 4],
  ["armed_vacation", 32],
  ["armed_custom_bypass", 16],
];
const ARMED = new Set(ARM_MODES.map(([m]) => m));
export const ARMED_ICON: Record<string, string> = {
  armed_away: "mdi:shield-lock",
  armed_home: "mdi:shield-home",
  armed_night: "mdi:shield-moon",
  armed_vacation: "mdi:shield-airplane",
  armed_custom_bypass: "mdi:security",
};

export const isArmed = (state?: string) => !!state && ARMED.has(state);

/** Short name of an arm mode ("At home"). */
export const modeLabel = (mode: string) => t(`card.alarm.mode.${ARMED.has(mode) ? mode : "armed_away"}`);

/**
 * Arm modes the entity supports (supported_features), optionally narrowed by the card's
 * `arm_modes`. Without supported_features: home, away, night (the catalog's set).
 */
export function armModes(entity: HassEntity | undefined, wanted?: string[]): string[] {
  const f = entity?.attributes.supported_features;
  const all = typeof f === "number" ? ARM_MODES.filter(([, bit]) => (f & bit) !== 0).map(([m]) => m) : ["armed_home", "armed_away", "armed_night"];
  const out = wanted?.length ? all.filter((m) => wanted.includes(m)) : all;
  return out.length ? out : all;
}

/** Target mode while arming / in the entry countdown (next_state of the manual alarm, arm_mode of Alarmo). */
export function targetMode(entity: HassEntity | undefined): string | undefined {
  const a = entity?.attributes ?? {};
  return [a.next_state, a.arm_mode, a.previous_state].find((m): m is string => typeof m === "string" && ARMED.has(m));
}

/**
 * Every `alarm_control_panel` state (catalog section 05): every armed mode is green and told
 * apart by icon and caption, arming yellow, pending orange, triggered red, disarmed neutral.
 * `icon` replaces the shield glyphs (except while triggered).
 */
export function alarmStatus(entity: HassEntity | undefined, customIcon?: string): Status {
  const ic = (fallback: string) => customIcon ?? fallback;
  if (!entity || entity.state === "unavailable") return { icon: ic("mdi:shield-off-outline"), tone: "unavailable", label: t("common.unavailable") };
  const state = entity.state;
  if (ARMED.has(state)) return { icon: ic(ARMED_ICON[state]), tone: "ok", label: t(`card.alarm.${state}`) };
  switch (state) {
    case "pending":
      return { icon: ic("mdi:shield-alert-outline"), tone: "orange", label: t(entity.attributes.code_format ? "card.alarm.enter_code" : "card.alarm.pending"), busy: true };
    case "arming": {
      const m = targetMode(entity);
      return { icon: ic("mdi:shield-lock-outline"), tone: "warning", label: m ? t("card.alarm.arming_mode", { mode: modeLabel(m).toLocaleLowerCase() }) : t("card.alarm.arming"), busy: true };
    }
    case "disarming":
      return { icon: ic("mdi:shield-off-outline"), tone: "warning", label: t("card.alarm.disarming"), busy: true };
    case "triggered":
      return { icon: "mdi:shield-alert", tone: "danger", label: t("card.alarm.triggered"), alert: true };
    case "disarmed":
      return { icon: ic("mdi:shield-off-outline"), tone: "text-3", label: t("card.alarm.disarmed") };
    case "unknown":
      return { icon: ic("mdi:shield-outline"), tone: "text-3", label: t("common.no_data") };
    default:
      return { icon: ic("mdi:shield"), tone: "info", label: state };
  }
}

/** Generic two-state entity (binary sensors, switches…): on = attention, off = calm. */
export function binaryStatus(entity: HassEntity | undefined, icons: { on: string; off: string }, labels: { on: string; off: string }): Status {
  if (isUnavailable(entity)) return { icon: icons.off, tone: "unavailable", label: t("common.no_data") };
  return entity!.state === "on" ? { icon: icons.on, tone: "danger", label: labels.on } : { icon: icons.off, tone: "ok", label: labels.off };
}

/**
 * Glyph of an alarm in a compact cell (design B7): the house with an open or closed padlock;
 * arming and the entry countdown already count as armed. A custom icon is used as is.
 */
export function alarmBarIcon(entity: HassEntity | undefined, customIcon?: string): string {
  const state = isUnavailable(entity) ? "" : entity!.state;
  if (state === "triggered") return "mdi:alarm-light";
  if (customIcon) return customIcon;
  const armed = ARMED.has(state) || state === "pending" || state === "arming";
  return armed ? "mdi:home-lock" : "mdi:home-lock-open";
}
