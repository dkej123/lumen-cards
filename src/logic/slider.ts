// Value math of the slider tiles (fan, number, cover): pointer → fraction → value on the
// entity's own scale, and the value text of a number entity.
import { numberLocale, t } from "../core/i18n";

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Finger position over the element → 0..1 (design: the value follows the finger, not the drag distance). */
export const fractionAt = (clientX: number, rect: { left: number; width: number }): number =>
  rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;

/** Decimals of a step (0.5 → 1, 0.25 → 2, 1 → 0). */
export function stepDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

/** Nearest valid value: min + n·step, inside [min, max], without float noise (0.1 + 0.2). */
export function snap(v: number, min: number, max: number, step: number): number {
  const st = step > 0 ? step : 1;
  const n = Math.round((clamp(v, min, max) - min) / st);
  const out = clamp(min + n * st, min, max);
  return Number(out.toFixed(Math.max(stepDecimals(st), stepDecimals(min))));
}

/** Fraction → value on [min, max] snapped to the step. */
export const valueAt = (f: number, min: number, max: number, step: number): number => snap(min + clamp(f, 0, 1) * (max - min), min, max, step);

/** Value → 0..1 on [min, max]. */
export const fractionOf = (v: number, min: number, max: number): number => (max > min ? clamp((v - min) / (max - min), 0, 1) : 0);

export interface NumberRange {
  min: number;
  max: number;
  step: number;
}

/** min / max / step of an input_number / number entity (HA defaults 0 / 100 / 1). */
export function numberRange(attrs: Record<string, unknown> | undefined): NumberRange {
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
  const min = n(attrs?.min, 0);
  const max = n(attrs?.max, 100);
  const step = n(attrs?.step, 1);
  return { min, max: max > min ? max : min + 1, step: step > 0 ? step : 1 };
}

const fmt = (v: number, decimals: number) =>
  new Intl.NumberFormat(numberLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(v);

/**
 * Value text of the number tile: "55%" (percent sticks to the number), "21,5 °C" (other units),
 * "3 of 10" (no unit: the position on the scale, as the design's ring volume).
 */
export function numberText(v: number, unit: string | undefined, r: NumberRange): string {
  const d = Math.max(stepDecimals(r.step), Number.isInteger(v) ? 0 : 1);
  const value = fmt(v, d);
  if (unit === "%") return `${value}%`;
  if (unit) return `${value} ${unit}`;
  return t("card.number.of", { value, max: fmt(r.max, Number.isInteger(r.max) ? 0 : d) });
}
