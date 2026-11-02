import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";

const DIMMABLE_MODES = new Set(["brightness", "color_temp", "hs", "rgb", "rgbw", "rgbww", "xy", "white"]);

export const isDimmable = (entity?: HassEntity): boolean =>
  (entity?.attributes.supported_color_modes ?? []).some((mode: string) => DIMMABLE_MODES.has(mode));

export const supportsColorTemp = (entity?: HassEntity): boolean =>
  (entity?.attributes.supported_color_modes ?? []).includes("color_temp");

const COLOR_MODES = new Set(["hs", "rgb", "rgbw", "rgbww", "xy"]);
export const supportsColor = (entity?: HassEntity): boolean =>
  (entity?.attributes.supported_color_modes ?? []).some((mode: string) => COLOR_MODES.has(mode));

/** Colour temperature presets (design: B10 colour picker), extended for cool-white bulbs. */
export const CT_PRESETS: [number, string][] = [
  [2200, "card.light.ct.candle"],
  [2700, "card.light.ct.warm"],
  [3200, "card.light.ct.soft"],
  [4000, "card.light.ct.neutral"],
  [5000, "card.light.ct.cool"],
  [6500, "card.light.ct.daylight"],
];

/** The bulb's own kelvin range (2200–4000 K, the design range, when it does not say). */
export function kelvinRange(entity?: HassEntity): [number, number] {
  const lo = Number(entity?.attributes.min_color_temp_kelvin) || 2200;
  const hi = Number(entity?.attributes.max_color_temp_kelvin) || 4000;
  return lo < hi ? [lo, hi] : [2200, 4000];
}

/** Up to four presets inside the bulb's range, spread across it (the design's four for 2200–4000 K). */
export function ctPresets(entity?: HassEntity): [number, string][] {
  const [lo, hi] = kelvinRange(entity);
  const inRange = CT_PRESETS.filter(([k]) => k >= lo - 50 && k <= hi + 50);
  const list = inRange.length >= 2 ? inRange : ([[lo, "card.light.ct.warm"], [hi, "card.light.ct.cool"]] as [number, string][]);
  if (list.length <= 4) return list;
  return [0, 1 / 3, 2 / 3, 1].map((f) => list[Math.round(f * (list.length - 1))]);
}

/**
 * Hue swatches of the light sheet (catalog `HUES`): the swatch is drawn in the design colour
 * `oklch(0.74 0.16 h)`, the bulb gets the matching hs_color (hue of that colour, saturation
 * raised to at least 75 % so a bulb does not look washed out).
 */
export const HUE_PRESETS: [[number, number], string, string][] = [
  [[3, 75], "card.light.hue.red", "oklch(0.74 0.16 25)"],
  [[30, 83], "card.light.hue.orange", "oklch(0.74 0.16 60)"],
  [[50, 100], "card.light.hue.yellow", "oklch(0.74 0.16 95)"],
  [[137, 75], "card.light.hue.green", "oklch(0.74 0.16 150)"],
  [[183, 100], "card.light.hue.cyan", "oklch(0.74 0.16 200)"],
  [[207, 75], "card.light.hue.blue", "oklch(0.74 0.16 250)"],
  [[263, 75], "card.light.hue.purple", "oklch(0.74 0.16 300)"],
  [[324, 75], "card.light.hue.pink", "oklch(0.74 0.16 345)"],
];

const hueDist = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Name key of a colour: the nearest swatch hue; washed-out colours are white. */
export function hueName(hs: [number, number]): string {
  if (hs[1] < 15) return "card.light.hue.white";
  let best = HUE_PRESETS[0];
  for (const p of HUE_PRESETS) if (hueDist(p[0][0], hs[0]) < hueDist(best[0][0], hs[0])) best = p;
  return best[1];
}

/** Index of the swatch matching `hs` (same hue ±12°, not washed out), else -1. */
export const swatchIndex = (hs: [number, number] | undefined): number =>
  hs && hs[1] >= 15 ? HUE_PRESETS.findIndex(([p]) => hueDist(p[0], hs[0]) <= 12) : -1;

/** hs_color (hue 0–360, saturation 0–100) at full value → "rgb(r,g,b)". */
export function hsToRgb([h, s]: [number, number]): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return `rgb(${f(5)},${f(3)},${f(1)})`;
}

/** The light's current hs_color, if it reports one. */
export function hsOf(entity?: HassEntity): [number, number] | undefined {
  const hs = entity?.attributes.hs_color;
  return Array.isArray(hs) && hs.length === 2 && hs.every((v) => Number.isFinite(Number(v))) ? [Number(hs[0]), Number(hs[1])] : undefined;
}

/**
 * Four white presets spread evenly in mireds between the bulb's warmest and coolest white
 * (catalog: 2200, 2800, 3950, 6500 K for a 2200–6500 K bulb), rounded to 50 K.
 */
export function miredPresets(entity?: HassEntity): number[] {
  const [lo, hi] = kelvinRange(entity);
  const mWarm = 1e6 / lo;
  const mCool = 1e6 / hi;
  return [0, 1, 2, 3].map((i) => {
    if (i === 0) return lo;
    if (i === 3) return hi;
    return Math.round(1e6 / (mWarm - ((mWarm - mCool) * i) / 3) / 50) * 50;
  });
}

// Catalog white swatches (kToC) as anchors, interpolated in between.
const WHITE: [number, number, number, number][] = [
  [2200, 0.8, 0.12, 62],
  [2800, 0.86, 0.09, 72],
  [3950, 0.93, 0.04, 85],
  [6500, 0.89, 0.05, 235],
];

/** Swatch colour of a white (kelvin) in the light sheet (interpolated in Oklab, no green cast). */
export function whiteColor(k: number): string {
  const x = Math.max(WHITE[0][0], Math.min(WHITE[WHITE.length - 1][0], k));
  let i = 0;
  while (i < WHITE.length - 2 && x > WHITE[i + 1][0]) i++;
  const lab = ([, l, c, h]: (typeof WHITE)[number]) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  const a = lab(WHITE[i]);
  const b = lab(WHITE[i + 1]);
  const t = (x - WHITE[i][0]) / (WHITE[i + 1][0] - WHITE[i][0]);
  const [l, aa, bb] = a.map((v, j) => v + (b[j] - v) * t);
  return `oklab(${l.toFixed(3)} ${aa.toFixed(3)} ${bb.toFixed(3)})`;
}

/** Colour-temperature bar for a bulb's range: the catalog whites as stops, placed by kelvin. */
export function whiteGradient(lo: number, hi: number): string {
  const pos = (k: number) => `${(((k - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const stops = [lo, ...WHITE.map(([k]) => k).filter((k) => k > lo && k < hi), hi];
  return `linear-gradient(90deg, ${stops.map((k) => `${whiteColor(k)} ${pos(k)}`).join(", ")})`;
}

/** Light group (`entity_id` member list) with some members on and some off. */
export interface MixedGroup {
  on: number;
  total: number;
  /** Average brightness (%) of the members that are on; null when none of them dims. */
  avg: number | null;
}

/** Members of a light group (HA light group / old-style group). */
export const groupMembers = (entity?: HassEntity): string[] => {
  const ids = entity?.attributes.entity_id;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
};

export function mixedGroup(entity: HassEntity | undefined, states: Record<string, HassEntity | undefined>): MixedGroup | null {
  const members = groupMembers(entity).map((id) => states[id]).filter((m): m is HassEntity => !!m);
  if (members.length < 2) return null;
  const on = members.filter((m) => m.state === "on");
  if (!on.length || on.length === members.length) return null;
  const dims = on.filter((m) => typeof m.attributes.brightness === "number");
  const avg = dims.length ? Math.round(dims.reduce((a, m) => a + brightnessPct(m), 0) / dims.length) : null;
  return { on: on.length, total: members.length, avg };
}

/** Brightness 0–100 %, 0 when off or unavailable. */
export function brightnessPct(entity?: HassEntity): number {
  if (isUnavailable(entity) || entity!.state !== "on") return 0;
  const brightness = entity!.attributes.brightness;
  return typeof brightness === "number" ? Math.max(1, Math.round((brightness / 255) * 100)) : 100;
}

/** Warm glow colour of a lit tile: color_temp lights follow their kelvin. */
export function glowColor(entity?: HassEntity): string {
  const kelvin = entity?.attributes.color_temp_kelvin;
  if (typeof kelvin !== "number") return "255, 183, 94";
  const t = Math.min(1, Math.max(0, (kelvin - 2200) / (6500 - 2200)));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `${mix(255, 220)}, ${mix(170, 235)}, ${mix(80, 255)}`;
}

/** How long a freshly powered bulb may stay `unavailable` before it counts as offline. */
export const BOOT_MS = 60_000;

export interface LightPower {
  /** Nothing to control: the relay (or a plain bulb) is unavailable. */
  unavailable: boolean;
  /** Relay on (always true without a relay). */
  powerOn: boolean;
  /** Relay just switched on and the bulb has not joined yet. */
  booting: boolean;
  /** Tile shows "on". */
  on: boolean;
}

/** The relay that decides the tile's power with several relays: one that is on, else one that answers. */
export const leadPower = (relays: (HassEntity | undefined)[]): HassEntity | undefined =>
  relays.find((r) => r?.state === "on") ?? relays.find((r) => r && !isUnavailable(r)) ?? relays[0];

/**
 * State of a bulb fed by a wall relay, shown as one tile. The bulb is `unavailable`
 * whenever the relay is off, so that is plain "off", not an error.
 */
export function lightPower(
  bulb: HassEntity | undefined,
  power: HassEntity | undefined,
  hasPower: boolean,
  now: number = Date.now(),
): LightPower {
  if (!hasPower) {
    const unavailable = isUnavailable(bulb);
    return { unavailable, powerOn: true, booting: false, on: !unavailable && bulb!.state === "on" };
  }
  if (isUnavailable(power)) return { unavailable: true, powerOn: false, booting: false, on: false };
  const powerOn = power!.state === "on";
  const bulbDown = isUnavailable(bulb);
  const booting = powerOn && bulbDown && now - Date.parse(power!.last_changed) < BOOT_MS;
  // Relay on with an offline bulb still counts as on, so a tap can cut the relay.
  return { unavailable: false, powerOn, booting, on: powerOn && (bulbDown || bulb!.state === "on") };
}
