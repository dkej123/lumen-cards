// Upcoming events of a calendar entity (HA REST `calendars/<entity>?start&end`), grouped by day.
import { locale, t } from "../core/i18n";
import { formatClock } from "./time";

/** One event as HA's calendar API returns it. */
export interface RawEvent {
  summary?: string;
  start: { dateTime?: string; date?: string } | string;
  end?: { dateTime?: string; date?: string } | string;
  location?: string;
  description?: string;
}

export interface CalEvent {
  summary: string;
  start: number;
  end: number;
  allDay: boolean;
  location?: string;
}

export interface CalDay {
  /** Local midnight of the day (ms). */
  day: number;
  label: string;
  events: CalEvent[];
}

/** "2026-10-29" → local midnight (a date-only string must not be read as UTC). */
const localDate = (s: string): number => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

const when = (v: RawEvent["start"] | undefined): { ms: number; allDay: boolean } | null => {
  if (!v) return null;
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? { ms: localDate(v), allDay: true } : { ms: Date.parse(v), allDay: false };
  if (v.dateTime) return { ms: Date.parse(v.dateTime), allDay: false };
  if (v.date) return { ms: localDate(v.date), allDay: true };
  return null;
};

export const startOfDay = (ms: number): number => new Date(ms).setHours(0, 0, 0, 0);

/** Normalised events, invalid ones dropped, sorted by start (all-day first on the same day). */
export function parseEvents(raw: unknown): CalEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: CalEvent[] = [];
  for (const r of raw as RawEvent[]) {
    const s = when(r?.start);
    if (!s || !Number.isFinite(s.ms)) continue;
    const e = when(r.end);
    const end = e && Number.isFinite(e.ms) && e.ms >= s.ms ? e.ms : s.ms + (s.allDay ? 86_400_000 : 0);
    out.push({ summary: String(r.summary ?? "").trim() || "—", start: s.ms, end, allDay: s.allDay, location: r.location || undefined });
  }
  return out.sort((a, b) => a.start - b.start || Number(b.allDay) - Number(a.allDay) || a.summary.localeCompare(b.summary));
}

const weekdayShort = (ms: number) => new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(ms).replace(/\.$/, "");
const dayMonth = (ms: number) => new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "2-digit" }).format(ms);

/** "Today · Thu 29.10", "Tomorrow · Fri 30.10", "Sat 31.10". */
export function dayLabel(day: number, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(day) - startOfDay(now)) / 86_400_000);
  const date = `${weekdayShort(day)} ${dayMonth(day)}`;
  if (diff === 0) return `${t("card.calendar.today")} · ${date}`;
  if (diff === 1) return `${t("card.calendar.tomorrow")} · ${date}`;
  return date;
}

/** "All day", "14:00–15:00", "19:30" (no length). */
export function eventTime(ev: CalEvent): string {
  if (ev.allDay) return t("card.calendar.all_day");
  const start = formatClock(ev.start);
  return ev.end > ev.start ? `${start}–${formatClock(ev.end)}` : start;
}

/**
 * Events that have not ended yet, grouped by day (an event already running shows under today),
 * at most `max` events in total.
 */
export function groupByDay(events: CalEvent[], now: number = Date.now(), max = 5): CalDay[] {
  const today = startOfDay(now);
  const days = new Map<number, CalEvent[]>();
  let n = 0;
  for (const ev of events) {
    if (ev.end <= now && ev.end > ev.start) continue;
    if (ev.end === ev.start && ev.start < now) continue;
    if (n >= max) break;
    const day = Math.max(startOfDay(ev.start), today);
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(ev);
    n++;
  }
  return [...days.entries()].sort(([a], [b]) => a - b).map(([day, evs]) => ({ day, label: dayLabel(day, now), events: evs }));
}

const TONES = ["accent", "ok", "orange", "info", "warning"];

/** Stable colour of an event by its title (the same kind of event keeps its colour). */
export function eventTone(summary: string): string {
  let h = 2166136261;
  for (const ch of summary.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return TONES[h % TONES.length];
}

/** Query string of the API call: from now to the end of the `days`-th day. */
export function rangeQuery(now: number, days: number): { start: string; end: string } {
  const start = new Date(startOfDay(now));
  const end = new Date(startOfDay(now));
  end.setDate(end.getDate() + Math.max(1, Math.round(days)));
  return { start: start.toISOString(), end: end.toISOString() };
}
