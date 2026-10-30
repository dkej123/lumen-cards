import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { formatNumber } from "./time";

/** Numeric state or null (unavailable / not a number). */
export const num = (e?: HassEntity): number | null =>
  isUnavailable(e) || Number.isNaN(Number(e!.state)) ? null : Number(e!.state);

/** "22°", "22,5°", "72 °F": whole numbers without decimals, °F spelled out; "—" without a value. */
export function formatTemp(v: number | undefined | null, fahrenheit = false): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const n = Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : formatNumber(v);
  return fahrenheit ? `${n} °F` : `${n}°`;
}

/** "22,4°" (always one decimal) or "—". */
export const temp = (value: unknown): string =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : `${formatNumber(Number(value))}°`;

/** HA's own translated state text ("Locked", "card.lock.locked"), else `fallback`; unavailable → fallback. */
export const stateText = (hass: { formatEntityState?(e: HassEntity, s?: string): string } | undefined, e: HassEntity | undefined, fallback: string): string =>
  !e || isUnavailable(e) || !hass?.formatEntityState ? fallback : hass.formatEntityState(e);
