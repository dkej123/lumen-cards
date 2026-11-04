// Time helpers with short wording ("3 h", "25 min temu", "time.just_now").
import { hour12, locale, numberLocale, t } from "../core/i18n";

export function ageMs(iso: string | undefined, now: number = Date.now()): number {
  return iso ? Math.max(0, now - Date.parse(iso)) : Number.POSITIVE_INFINITY;
}

/** Prototype `span`: minutes, hours, days. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? t("time.one_day") : t("time.days", { n: days });
}

export const formatAgo = (iso: string | undefined, now?: number): string => {
  const ms = ageMs(iso, now);
  return ms < 60_000 ? t("time.just_now") : t("time.ago", { x: formatDuration(ms) });
};

export const formatClock = (iso: string | number | undefined): string => {
  if (iso === undefined) return "—";
  const d = new Date(iso);
  if (hour12()) return new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Short weekday in the UI language: "Fri" (en) / "pt." (pl). */
export const weekday = (day: number): string =>
  new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(new Date(Date.UTC(2023, 0, 1 + day, 12)));

/** Point in time: "13:20", "yesterday 23:10", "Fri 13:20" (within a week), else "28/09". */
export function formatWhen(ms: number, now: number = Date.now()): string {
  const at = new Date(ms);
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86_400_000);
  const clock = formatClock(ms);
  if (days <= 0) return clock;
  if (days === 1) return t("time.yesterday", { clock });
  if (days < 7) return `${weekday(at.getDay())} ${clock}`;
  return new Intl.DateTimeFormat(locale(), { day: "numeric", month: "2-digit" }).format(at);
}

/** Fixed decimals in the profile's number format: 22.4 → "22,4" (pl) / "22.4" (en). */
export const formatNumber = (value: number, digits = 1): string =>
  new Intl.NumberFormat(numberLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).format(value);
