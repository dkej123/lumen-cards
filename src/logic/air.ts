import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { ageMs } from "./time";

// Six levels as in the European Air Quality Index (EEA); level = worst of PM2.5, PM10 and AQI.
export const PM25 = [10, 20, 25, 50, 75];
export const PM10 = [20, 40, 50, 100, 150];
/**
 * US EPA AQI on the six levels (catalog section 11): EPA "good" 0–50 splits into very good
 * (0–25) and good (26–50), "moderate" 51–100 is moderate, then 101–150, 151–200 and 201+.
 */
export const AQI = [26, 51, 101, 151, 201];

export const AIR_LEVELS = [
  { emoji: "🌿", title: "card.air_quality.level.0", hint: "card.air_quality.hint.0" },
  { emoji: "🙂", title: "card.air_quality.level.1", hint: "card.air_quality.hint.1" },
  { emoji: "😐", title: "card.air_quality.level.2", hint: "card.air_quality.hint.2" },
  { emoji: "😕", title: "card.air_quality.level.3", hint: "card.air_quality.hint.3" },
  { emoji: "😷", title: "card.air_quality.level.4", hint: "card.air_quality.hint.4" },
  { emoji: "☠️", title: "card.air_quality.level.5", hint: "card.air_quality.hint.5" },
] as const;

const levelFor = (value: number, thresholds: number[]): number => {
  const index = thresholds.findIndex((limit) => value < limit);
  return index === -1 ? thresholds.length : index;
};

export interface AirQuality {
  level: number | null;
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
  /** Time of the newest valid reading (live state or the last good one). */
  readAt?: string;
  /** No valid reading within `staleHours`. */
  stale: boolean;
}

/** A valid reading remembered across short `unknown`/`unavailable` gaps. */
export interface AirReading {
  value: number;
  /** ISO timestamp of the reading. */
  at: string;
}

const numeric = (entity?: HassEntity): number | null =>
  isUnavailable(entity) || Number.isNaN(Number(entity!.state)) ? null : Number(entity!.state);

const readingTime = (entity: HassEntity): string => entity.last_reported ?? entity.last_updated;

/** Live reading if the sensor has a value, otherwise the last good one. */
export function airReading(entity: HassEntity | undefined, lastGood?: AirReading): AirReading | undefined {
  const value = numeric(entity);
  return value === null ? lastGood : { value, at: readingTime(entity!) };
}

export function airQuality(
  pm25: AirReading | undefined,
  pm10: AirReading | undefined,
  staleHours: number,
  now: number = Date.now(),
  aqi?: AirReading,
): AirQuality {
  const readAt = [pm25?.at, pm10?.at, aqi?.at].filter((t): t is string => !!t).sort().at(-1);
  const stale = ageMs(readAt, now) >= staleHours * 3_600_000;
  const levels = [
    pm25 === undefined ? null : levelFor(pm25.value, PM25),
    pm10 === undefined ? null : levelFor(pm10.value, PM10),
    aqi === undefined ? null : levelFor(aqi.value, AQI),
  ].filter((l): l is number => l !== null);
  return {
    level: levels.length ? Math.max(...levels) : null,
    pm25: pm25?.value ?? null,
    pm10: pm10?.value ?? null,
    aqi: aqi?.value ?? null,
    readAt,
    stale,
  };
}
