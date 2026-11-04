import type { HassEntity } from "../hass/types";

export interface Battery {
  /** Lowest known level in %, null when only a low/ok flag is known. */
  pct: number | null;
  low: boolean;
}

/** Low battery below this % by default. */
export const BATTERY_LOW = 15;

const level = (v: unknown): number | null => {
  const n = typeof v === "object" && v !== null ? Number((v as { battery?: unknown }).battery) : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Battery of a thermostat: an explicit sensor (`%`, or a battery binary_sensor where on = low),
 * else Better Thermostat's `batteries` attribute (JSON text or object, one entry per valve – the
 * lowest counts), else a plain `battery_level` / `battery` attribute. null = nothing known.
 */
export function batteryLevel(climate: HassEntity | undefined, sensor: HassEntity | undefined, threshold = BATTERY_LOW): Battery | null {
  if (sensor && !["unavailable", "unknown"].includes(sensor.state)) {
    if (sensor.entity_id.startsWith("binary_sensor.")) return { pct: null, low: sensor.state === "on" };
    const pct = level(sensor.state);
    if (pct !== null) return { pct, low: pct < threshold };
  }
  const a = climate?.attributes ?? {};
  let raw: unknown = a.batteries;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = undefined;
    }
  }
  const levels = raw && typeof raw === "object" ? Object.values(raw).map(level).filter((n): n is number => n !== null) : [];
  const own = level(a.battery_level ?? a.battery);
  if (own !== null) levels.push(own);
  if (!levels.length) return null;
  const pct = Math.min(...levels);
  return { pct, low: pct < threshold };
}
