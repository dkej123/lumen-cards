// Weather card (catalog section 20): forecast logic ported from the Dom panel's weather sheet
// (design B6), generalised to one `weather.*` entity of any integration. Values stay in the
// entity's own units (temperature, wind, precipitation, pressure, visibility).

/** One item of a HA `weather/subscribe_forecast` message. */
export interface ForecastItem {
  datetime: string;
  condition?: string | null;
  temperature?: number | null;
  templow?: number | null;
  apparent_temperature?: number | null;
  precipitation?: number | null;
  precipitation_probability?: number | null;
  wind_speed?: number | null;
  wind_bearing?: number | null;
  is_daytime?: boolean | null;
}

export interface Hour {
  /** Start of the hour (ms). */
  t: number;
  /** Day offset from today (0 = today). */
  d: number;
  h: number;
  temp: number;
  /** Apparent temperature; null when the forecast has none (the chart line follows `temp`). */
  feel: number | null;
  cond: string;
  /** Precipitation chance %; null when the forecast has none for that time. */
  pp: number | null;
  mm: number;
  wind: number | null;
}

export interface DaySummary {
  d: number;
  /** Local midnight (ms). */
  date: number;
  cond: string;
  min: number;
  max: number;
  pp: number | null;
  mm: number | null;
  wind: number | null;
  /** Hourly data of this day; empty = the row cannot expand. */
  hours: Hour[];
  /** Summarised from the daily forecast although some hours exist (partial day caption). */
  partial: boolean;
}

/** `supported_features` bits of a weather entity. */
export const FORECAST_DAILY = 1;
export const FORECAST_HOURLY = 2;
export const FORECAST_TWICE_DAILY = 4;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** A day with at least this many forecast hours is summarised from them, otherwise from the daily forecast. */
export const FULL_DAY_HOURS = 20;

/** Local midnight `offset` days from `ms` (DST safe). */
export function dayStart(ms: number, offset = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime();
}

export const hourStart = (ms: number) => {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
};

export const dayOffset = (ms: number, now: number) => Math.round((dayStart(ms) - dayStart(now)) / DAY_MS);

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface ForecastInput {
  now: number;
  hourly?: ForecastItem[] | null;
  twice?: ForecastItem[] | null;
  daily?: ForecastItem[] | null;
}

/** Precipitation chance of an hour: hourly, else the twice-daily half, else the daily value. */
function chance(t: number, f: ForecastItem | undefined, twice: ForecastItem[], daily: ForecastItem[]): number | null {
  const h = n(f?.precipitation_probability);
  if (h !== null) return h;
  for (const x of twice) {
    const s = Date.parse(x.datetime);
    if (t >= s && t < s + DAY_MS / 2) {
      const v = n(x.precipitation_probability);
      if (v !== null) return v;
    }
  }
  const day = dayStart(t);
  return n(daily.find((x) => dayStart(Date.parse(x.datetime)) === day)?.precipitation_probability);
}

/** Hours from the current one to the end of day +3. */
export function hoursOf(o: ForecastInput): Hour[] {
  const map = new Map<number, ForecastItem>();
  for (const f of o.hourly ?? []) {
    const t = Date.parse(f.datetime);
    if (Number.isFinite(t) && n(f.temperature) !== null) map.set(hourStart(t), f);
  }
  const twice = o.twice ?? [];
  const daily = o.daily ?? [];
  const out: Hour[] = [];
  const end = dayStart(o.now, 4);
  for (let t = hourStart(o.now); t < end; t += HOUR_MS) {
    const f = map.get(t);
    if (!f) continue;
    out.push({
      t,
      d: dayOffset(t, o.now),
      h: new Date(t).getHours(),
      temp: f.temperature!,
      feel: n(f.apparent_temperature),
      cond: f.condition ?? "cloudy",
      pp: chance(t, f, twice, daily),
      mm: n(f.precipitation) ?? 0,
      wind: n(f.wind_speed),
    });
  }
  return out;
}

/** Hours of the "Today hourly" strip: now → 23:00; with < 6 h left it continues into tomorrow (12 in total). */
export function todayHours(hours: Hour[]): Hour[] {
  const today = hours.filter((h) => h.d === 0);
  return today.length >= 6 ? today : hours.slice(0, Math.max(12, today.length));
}

/** Day icon: the 13:00 state; with ≥ 3 wet hours (≥ 50%) between 07 and 20, the first of them. */
function dayCondition(hours: Hour[]): string {
  const wet = hours.filter((h) => (h.pp ?? 0) >= 50 && h.h >= 7 && h.h < 20);
  if (wet.length >= 3) return wet[0].cond;
  return (hours.find((h) => h.h === 13) ?? hours[Math.floor(hours.length / 2)]).cond;
}

const dailyOf = (daily: ForecastItem[] | null | undefined, date: number) => (daily ?? []).find((f) => dayStart(Date.parse(f.datetime)) === date);

/** Rows "Next days" (+1 … +count). A day covered by hourly data is summarised from it, otherwise from the daily forecast. */
export function daySummaries(hours: Hour[], daily: ForecastItem[] | null | undefined, now: number, count = 3): DaySummary[] {
  const out: DaySummary[] = [];
  for (let d = 1; d <= count; d++) {
    const date = dayStart(now, d);
    const hs = hours.filter((h) => h.d === d);
    const day = dailyOf(daily, date);
    const dayMax = n(day?.temperature);
    const dayMin = n(day?.templow);
    if (hs.length >= FULL_DAY_HOURS || ((dayMax === null || dayMin === null) && hs.length)) {
      const ts = hs.map((h) => h.temp);
      const pps = hs.map((h) => h.pp).filter((v): v is number => v !== null);
      const winds = hs.map((h) => h.wind).filter((v): v is number => v !== null);
      out.push({
        d,
        date,
        cond: dayCondition(hs),
        min: Math.min(...ts),
        max: Math.max(...ts),
        pp: pps.length ? Math.max(...pps) : null,
        mm: hs.reduce((a, h) => a + h.mm, 0),
        wind: winds.length ? Math.max(...winds) : null,
        hours: hs,
        partial: false,
      });
    } else if (dayMax !== null && dayMin !== null) {
      out.push({
        d,
        date,
        cond: day!.condition ?? "cloudy",
        min: dayMin,
        max: dayMax,
        pp: n(day!.precipitation_probability),
        mm: n(day!.precipitation),
        wind: n(day!.wind_speed),
        hours: hs,
        partial: hs.length > 0,
      });
    }
  }
  return out;
}

/** Today's low / high: the daily forecast, else the hours of today (with the current temperature). */
export function todayRange(o: ForecastInput, current: number | null): { min: number; max: number } | null {
  const day = dailyOf(o.daily, dayStart(o.now));
  const hi = n(day?.temperature);
  const lo = n(day?.templow);
  if (hi !== null && lo !== null) return { min: lo, max: hi };
  const ts = hoursOf(o)
    .filter((h) => h.d === 0)
    .map((h) => h.temp);
  if (current !== null) ts.push(current);
  return ts.length >= 2 ? { min: Math.min(...ts), max: Math.max(...ts) } : null;
}

// ---------------------------------------------------------------- sun

const RAD = Math.PI / 180;

/** Sunrise and sunset (ms) for the local day containing `ms` (NOAA approximation, ±1 min). Null in polar day/night. */
export function sunTimes(ms: number, lat: number, lon: number): { rise: number; set: number } | null {
  const d = new Date(ms);
  const jd = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12) / DAY_MS + 2440587.5;
  const nDay = Math.round(jd - 2451545 + 0.0008);
  const jStar = nDay - lon / 360;
  const m = (357.5291 + 0.98560028 * jStar) % 360;
  const c = 1.9148 * Math.sin(m * RAD) + 0.02 * Math.sin(2 * m * RAD) + 0.0003 * Math.sin(3 * m * RAD);
  const lambda = (m + c + 180 + 102.9372) % 360;
  const transit = 2451545 + jStar + 0.0053 * Math.sin(m * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDec = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosH = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDec) / (Math.cos(lat * RAD) * Math.cos(Math.asin(sinDec)));
  if (cosH < -1 || cosH > 1) return null;
  const w = Math.acos(cosH) / RAD / 360;
  const toMs = (j: number) => Math.round((j - 2440587.5) * DAY_MS);
  return { rise: toMs(transit - w), set: toMs(transit + w) };
}

/** Night for an hour = its middle (HH:30) is before sunrise or after sunset of that day. */
export function isNightHour(t: number, sun: { rise: number; set: number } | null): boolean {
  if (!sun) return false;
  const mid = t + 1_800_000;
  return mid < sun.rise || mid >= sun.set;
}

// ---------------------------------------------------------------- icons and text

const ICO: Record<string, string> = {
  sunny: "mdi:weather-sunny",
  "clear-night": "mdi:weather-night",
  partlycloudy: "mdi:weather-partly-cloudy",
  cloudy: "mdi:weather-cloudy",
  fog: "mdi:weather-fog",
  rainy: "mdi:weather-rainy",
  pouring: "mdi:weather-pouring",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy",
  hail: "mdi:weather-hail",
  windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
  exceptional: "mdi:alert-circle-outline",
};
const NIGHT: Record<string, string> = { sunny: "mdi:weather-night", partlycloudy: "mdi:weather-night-partly-cloudy" };

/** The 15 HA weather states (labels `card.forecast.cond.<state>`). */
export const CONDITIONS = Object.keys(ICO);

/** Icon for a condition; `night` swaps sunny / partly cloudy for their night variants (and clear-night by day back to sunny). */
export function conditionIcon(cond: string, night = false): string {
  if (night && NIGHT[cond]) return NIGHT[cond];
  if (!night && cond === "clear-night") return ICO.sunny;
  return ICO[cond] ?? ICO.cloudy;
}

/** Whole degrees with a real minus: -1.4 → "−1°". */
export function deg(v: number): string {
  const r = Math.round(v);
  return `${r < 0 ? "−" : ""}${Math.abs(r)}°`;
}

/** Wind direction index 0–7 (N, NE, E, SE, S, SW, W, NW) the wind blows from. */
export const windDirIndex = (bearing: number) => Math.round((((bearing % 360) + 360) % 360) / 45) % 8;

/** UV level key: low < 3, moderate < 6, high < 8, very high. */
export const uvLevel = (uv: number) => (uv < 3 ? "low" : uv < 6 ? "moderate" : uv < 8 ? "high" : "very_high");

/** Range bar colour: info (cold) → orange (warm) between 2° and 20°. */
export const tempColor = (t: number) =>
  `color-mix(in oklch, var(--lumen-orange) ${Math.round(Math.max(0, Math.min(100, ((t - 2) / 18) * 100)))}%, var(--lumen-info))`;

/** Columns of the hourly strip on the card: `hours` (4–8), but only as many as fit at 44 px. */
export const cardColumns = (hours: number, width: number) => Math.max(1, Math.min(Math.max(4, Math.min(8, hours || 6)), Math.floor((width - 28) / 44)));

export const COL_W = 52;
const CHART_H = 52;

/**
 * Temperature line, apparent temperature line, area and precipitation bars for a strip of n
 * columns (SVG n × col by 52; col 52 px, wider when a short strip fills the sheet). Both lines share the Y scale (min span 4°, band 8–28 px).
 */
export function stripChart(temps: number[], mms: number[], feels: (number | null)[] = [], col = COL_W) {
  const w = temps.length * col;
  const fs = temps.map((t, i) => feels[i] ?? t);
  const mn = Math.min(...temps, ...fs);
  const mx = Math.max(...temps, ...fs);
  const range = Math.max(4, mx - mn);
  const mid = (mn + mx) / 2;
  const y = (t: number) => +(18 - ((t - mid) / range) * 20).toFixed(1);
  const pts = temps.map((t, i) => [i * col + col / 2, y(t)]);
  const line = "M" + pts.map((p) => `${p[0]} ${p[1]}`).join(" L");
  const feel = "M" + fs.map((t, i) => `${i * col + col / 2} ${y(t)}`).join(" L");
  const area = `${line} L${w - col / 2} ${CHART_H} L${col / 2} ${CHART_H} Z`;
  let bars = "";
  mms.forEach((v, i) => {
    if (v > 0) {
      const bh = +Math.max(2, Math.min(1, v / 4) * 18).toFixed(1);
      bars += `M${i * col + col / 2 - 8} ${CHART_H - bh}h16v${bh}h-16Z`;
    }
  });
  return { w, line, feel, area, bars: bars || "M0 0", firstY: pts[0]?.[1] ?? 18 };
}

export interface StripMark {
  left: number;
  icon: string;
  /** Clock time (ms) for sunrise / sunset, else the day offset of a midnight line. */
  at?: number;
  day?: number;
  style: "dashed" | "solid";
}

/** Sunrise / sunset (dashed, exact minute) and midnight (solid) markers over the chart. */
export function stripMarks(hours: Hour[], sunOf: (h: Hour) => { rise: number; set: number } | null, col = COL_W): StripMark[] {
  const marks: StripMark[] = [];
  hours.forEach((h, i) => {
    const sun = sunOf(h);
    if (sun) {
      for (const [at, icon] of [[sun.rise, "mdi:weather-sunset-up"], [sun.set, "mdi:weather-sunset-down"]] as const) {
        if (at >= h.t && at < h.t + HOUR_MS) marks.push({ left: +(i * col + ((at - h.t) / HOUR_MS) * col).toFixed(1), icon, at, style: "dashed" });
      }
    }
    if (i > 0 && h.h === 0) marks.push({ left: i * col, icon: "", day: h.d, style: "solid" });
  });
  return marks;
}

// ---------------------------------------------------------------- warnings

/** One item of a warnings list (IMGW-PIB Monitor `warnings` attribute and similar). */
export interface RawWarning {
  event?: string;
  name?: string;
  title?: string;
  level?: number | string;
  severity?: number | string;
  probability?: number;
  valid_from?: string;
  valid_to?: string;
  start?: string;
  end?: string;
  content?: string;
  description?: string;
}

export interface Warning {
  name: string;
  level: 1 | 2 | 3;
  from: number;
  to: number;
  text: string;
  icon: string;
}

/** Phenomenon (by name, PL / EN) → icon, as in the Dom panel (B3). Unknown → mdi:alert-outline. */
const WARNING_ICONS: [RegExp, string][] = [
  [/grad|hail/i, "mdi:weather-hail"],
  [/burz|thunder|storm/i, "mdi:weather-lightning"],
  [/zawiej|zamie|blizzard|drift/i, "mdi:weather-cloudy-arrow-right"],
  [/\u015bnieg|snieg|snow/i, "mdi:weather-snowy-heavy"],
  [/deszcz|opady|rain/i, "mdi:weather-pouring"],
  [/mg\u0142|mgl|fog/i, "mdi:weather-fog"],
  [/wiatr|wind|gale/i, "mdi:weather-windy"],
  [/upa\u0142|upal|heat/i, "mdi:thermometer-high"],
  [/przymroz|ground frost/i, "mdi:snowflake-alert"],
  [/mr\u00f3z|mroz|frost|cold/i, "mdi:thermometer-low"],
  [/oblodz|go\u0142oled\u017a|ice|icing/i, "mdi:car-traction-control"],
  [/roztop|thaw/i, "mdi:snowflake-melt"],
];
export const warningIcon = (name = "") => WARNING_ICONS.find(([re]) => re.test(name))?.[1] ?? "mdi:alert-outline";

/** "YYYY-MM-DD HH:MM:SS" (IMGW, local) or ISO. */
const parseTime = (v?: string) => {
  if (!v) return NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(v) ? v.replace(" ", "T") : v);
};

/** Severity 1–3 from a number or a word (yellow / orange / red, minor / moderate / severe). */
function levelOf(v: unknown): 1 | 2 | 3 {
  const x = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  if (typeof x === "number") return x >= 3 ? 3 : x >= 2 ? 2 : 1;
  const s = String(x ?? "").toLowerCase();
  if (/red|czerw|severe|extreme|3/.test(s)) return 3;
  if (/orange|pomar|moderate|2/.test(s)) return 2;
  return 1;
}

/** Warnings active now or starting within 24 h: highest level first, then the earliest start. */
export function activeWarnings(list: unknown, now: number): Warning[] {
  if (!Array.isArray(list)) return [];
  return (list as RawWarning[])
    .filter((w) => w && typeof w === "object")
    .map((w) => {
      const name = String(w.event ?? w.name ?? w.title ?? "");
      const from = parseTime(w.valid_from ?? w.start);
      const to = parseTime(w.valid_to ?? w.end);
      return {
        name,
        level: levelOf(w.level ?? w.severity),
        from: Number.isFinite(from) ? from : now,
        to: Number.isFinite(to) ? to : Number.POSITIVE_INFINITY,
        text: String(w.content ?? w.description ?? ""),
        icon: warningIcon(name),
      };
    })
    .filter((w) => w.to > now && w.from - now < DAY_MS)
    .sort((a, b) => b.level - a.level || a.from - b.from);
}

/** Tone of a warning level: colour and the glyph colour inside the circle. */
export const warningTone = (level: number) =>
  level >= 3 ? { c: "var(--lumen-danger)", fg: "#fff" } : level === 2 ? { c: "var(--lumen-orange)", fg: "#fff" } : { c: "var(--lumen-warning)", fg: "var(--lumen-light-ink)" };
