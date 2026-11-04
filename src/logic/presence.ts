import type { HassEntity } from "../hass/types";
import { t } from "../core/i18n";
import { ageMs, formatDuration } from "./time";

export interface Presence {
  home: boolean;
  /** Sensor missing or `unknown`: "No data". */
  unknown: boolean;
  /** Sensor `unavailable`. */
  unavailable: boolean;
  /** "Home" / "Away · Work" / "Away" / "No data" / "Unavailable". */
  label: string;
  /** Zone of the person while away (not home / not_home), else "". */
  zone: string;
  /** Time since the last change: "now", "15 min", "3 h", "2 days"; "" without data. */
  since: string;
  /** Wide card: label and time ("Away · Work · 2 h"). */
  status: string;
  /** Compact tile: home → "Home", away → "Work · 2 h" / "Away · 15 min". */
  short: string;
}

const NO_ZONE = new Set(["home", "not_home", "unknown", "unavailable"]);

/** "now" under a minute, else a duration ("15 min", "3 h"). */
export const sinceText = (iso: string | undefined, now: number = Date.now()): string => {
  const ms = ageMs(iso, now);
  return ms < 60_000 ? t("time.now") : formatDuration(ms);
};

/** Presence from a sensor (on = home) or the person's home zone; the person's zone is extra context. */
export function presence(sensor: HassEntity | undefined, person: HassEntity | undefined, now: number = Date.now()): Presence {
  if (sensor?.state === "unavailable") {
    const text = t("common.unavailable");
    return { home: false, unknown: false, unavailable: true, label: text, zone: "", since: "", status: text, short: text };
  }
  if (!sensor || sensor.state === "unknown") {
    const text = t("common.no_data");
    return { home: false, unknown: true, unavailable: false, label: text, zone: "", since: "", status: text, short: text };
  }
  const since = sinceText(sensor.last_changed, now);
  if (sensor.state === "on") {
    const label = t("card.person.home");
    return { home: true, unknown: false, unavailable: false, label, zone: "", since, status: `${label} · ${since}`, short: label };
  }
  const zone = person && !NO_ZONE.has(person.state) ? person.state : "";
  const label = zone ? `${t("card.person.away")} · ${zone}` : t("card.person.away");
  return { home: false, unknown: false, unavailable: false, label, zone, since, status: `${label} · ${since}`, short: `${zone || t("card.person.away")} · ${since}` };
}

/** Hues of the avatars without a colour (6 hues, oklch L .62). */
const AVATAR_HUES = [255, 150, 30, 330, 75, 200];

/** Avatar colour picked from the name, stable for the same name. */
export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `oklch(0.62 0.13 ${AVATAR_HUES[h % AVATAR_HUES.length]})`;
}
