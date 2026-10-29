import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { t } from "../core/i18n";

export type Tone = "ok" | "warning" | "danger" | "info" | "orange" | "unavailable";

export interface Status {
  icon: string;
  tone: Tone;
  label: string;
  /** Strong alert (alarm triggered): pulse, shake, banner, screen ring. */
  alert?: boolean;
  /** Operation in progress – lumenBreath on the icon. */
  busy?: boolean;
}

const ARMED = new Set(["armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass"]);
const ARMED_ICON: Record<string, string> = {
  armed_away: "mdi:shield-lock",
  armed_home: "mdi:shield-home",
  armed_night: "mdi:shield-moon",
  armed_vacation: "mdi:shield-airplane",
  armed_custom_bypass: "mdi:security",
};
const ARMED_LABEL: Record<string, string> = {
  armed_away: "card.alarm.armed_away",
  armed_home: "card.alarm.armed_home",
  armed_night: "card.alarm.armed_night",
  armed_vacation: "card.alarm.armed_vacation",
  armed_custom_bypass: "card.alarm.armed_custom_bypass",
};

/** Every `alarm_control_panel` state; `icon` replaces the shield glyphs (except while triggered). */
export function alarmStatus(entity: HassEntity | undefined, customIcon?: string): Status {
  const ic = (fallback: string) => customIcon ?? fallback;
  if (isUnavailable(entity)) return { icon: ic("mdi:shield-off"), tone: "unavailable", label: t("common.no_data") };
  const state = entity!.state;
  if (ARMED.has(state)) return { icon: ic(ARMED_ICON[state]), tone: "ok", label: t(ARMED_LABEL[state]) };
  switch (state) {
    case "pending":
      return { icon: ic("mdi:shield-alert"), tone: "warning", label: t("card.alarm.pending"), busy: true };
    case "arming":
      return { icon: ic("mdi:shield-lock"), tone: "warning", label: t("card.alarm.arming"), busy: true };
    case "disarming":
      return { icon: ic("mdi:shield-off"), tone: "warning", label: t("card.alarm.disarming"), busy: true };
    case "triggered":
      return { icon: "mdi:alarm-light", tone: "warning", label: t("card.alarm.triggered"), alert: true };
    case "disarmed":
      return { icon: ic("mdi:shield-off"), tone: "danger", label: t("card.alarm.disarmed") };
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
