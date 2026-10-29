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

/** Hue presets for colour bulbs: [hs_color, name]. */
export const HUE_PRESETS: [[number, number], string][] = [
  [[0, 90], "card.light.hue.red"],
  [[30, 90], "card.light.hue.orange"],
  [[55, 85], "card.light.hue.yellow"],
  [[120, 75], "card.light.hue.green"],
  [[190, 80], "card.light.hue.cyan"],
  [[230, 80], "card.light.hue.blue"],
  [[280, 75], "card.light.hue.purple"],
  [[320, 70], "card.light.hue.pink"],
];

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
