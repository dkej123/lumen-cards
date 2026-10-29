import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { t } from "../core/i18n";
import { ageMs, formatAgo, formatSince } from "./time";

export interface Presence {
  home: boolean;
  unknown: boolean;
  /** Web: "W domu · od 25 min" / "W domu · od 13:20" / "Poza domem · Praca · 25 min temu" / "Poza domem · od 13:20". */
  status: string;
  /** Mobile (narrow tile): home → only the time ("Od wczoraj 22:42", the dot says home); away → "Praca · od 13:20". */
  short: string;
}

const NO_ZONE = new Set(["home", "not_home", "unknown", "unavailable"]);

/** Presence from a sensor (on = home) or the person's home zone; the person's zone is extra context. */
export function presence(sensor: HassEntity | undefined, person: HassEntity | undefined, now: number = Date.now()): Presence {
  if (isUnavailable(sensor)) {
    const text = t("common.no_data");
    return { home: false, unknown: true, status: text, short: text };
  }
  // Owner: from an hour on show the clock time instead of the duration.
  const since = formatSince(sensor!.last_changed, now);
  if (sensor!.state === "on") {
    return { home: true, unknown: false, status: t("card.person.home_since", { since }), short: since[0].toUpperCase() + since.slice(1) };
  }
  const zone = person && !NO_ZONE.has(person.state) ? person.state : "";
  const ago = ageMs(sensor!.last_changed, now) < 3_600_000 ? formatAgo(sensor!.last_changed, now) : since;
  return {
    home: false,
    unknown: false,
    status: `${t("card.person.away")}${zone ? ` · ${zone}` : ""} · ${ago}`,
    short: `${zone || t("card.person.away")} · ${ago}`,
  };
}
