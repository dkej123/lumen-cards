import type { HassEntity } from "../hass/types";

// Air purifier card: everything without a template. Only the fan domain is assumed (`entity`);
// sensors, filters and device-specific controls come from the config or from what the device has.

/** FanEntityFeature bits. */
export const FAN_SET_SPEED = 1;
export const FAN_PRESET = 8;

/** Presets the card knows a name and an icon for; any other shows its own name. */
export const MODE_ICONS: Record<string, string> = {
  auto: "mdi:fan-auto",
  allergen: "mdi:flower-pollen-outline",
  sleep: "mdi:sleep",
  manual: "mdi:hand-back-right-outline",
  bacteria: "mdi:bacteria-outline",
  night: "mdi:weather-night",
};
export const MODE_ICON_OTHER = "mdi:tune-variant";

/** "very_quiet" → "Very quiet". */
export const humanize = (s: string): string => {
  const text = s.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Own names of speeds in the config. */
export interface SpeedConfig {
  percentage: number;
  name?: string;
}

/** Speed buttons: `speeds` from the config, else the fan's `percentage_step`; a fine or unknown step gives 5. */
export function speedSteps(step: unknown, speeds?: SpeedConfig[]): { percentage: number; name: string }[] {
  if (Array.isArray(speeds) && speeds.length) return speeds.map((s, i) => ({ percentage: Number(s.percentage), name: s.name ?? String(i + 1) }));
  const n = Number(step);
  const size = Number.isFinite(n) && n >= 10 && n <= 100 ? n : 20;
  const count = Math.round(100 / size);
  return Array.from({ length: count }, (_, i) => ({ percentage: Math.round(((i + 1) * 100) / count), name: String(i + 1) }));
}

/** The step closest to `percentage`, or undefined with no speed. */
export const nearestStep = <T extends { percentage: number }>(steps: T[], percentage: unknown): T | undefined => {
  const p = Number(percentage);
  if (!steps.length || percentage === null || percentage === undefined || !Number.isFinite(p) || p <= 0) return undefined;
  return steps.reduce((a, b) => (Math.abs(b.percentage - p) < Math.abs(a.percentage - p) ? b : a));
};

/** A service call and what it should change: `expected` shows at once, `confirm` settles it. */
export interface PurifierCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  expected: Record<string, unknown>;
  confirm: string[];
}

const call = (domain: string, service: string, data: Record<string, unknown>, expected: Record<string, unknown>, confirm = Object.keys(expected)): PurifierCall => ({ domain, service, data, expected, confirm });

export const powerCall = (on: boolean): PurifierCall => call("fan", on ? "turn_on" : "turn_off", {}, { state: on ? "on" : "off" });

/** A preset; on a fan that is off `turn_on` takes it in one go. */
export const presetCall = (mode: string, isOn: boolean): PurifierCall =>
  isOn ? call("fan", "set_preset_mode", { preset_mode: mode }, { preset_mode: mode, state: "on" }) : call("fan", "turn_on", { preset_mode: mode }, { preset_mode: mode, state: "on" });

/**
 * A speed. A fan with a `manual` preset goes there; on others the preset's fate is the device's
 * business, so only the speed and the power settle the call.
 */
export function speedCall(percentage: number, isOn: boolean, modes: string[]): PurifierCall {
  const manual = modes.includes("manual");
  const expected: Record<string, unknown> = { percentage, state: "on", ...(manual ? { preset_mode: "manual" } : {}) };
  const confirm = manual ? ["percentage", "state", "preset_mode"] : ["percentage", "state"];
  return isOn ? call("fan", "set_percentage", { percentage }, expected, confirm) : call("fan", "turn_on", { percentage }, expected, confirm);
}

/** One level of a threshold scale. */
export type Tone = "ok" | "info" | "warning" | "orange" | "danger";
export const TONE_RANK: Record<Tone, number> = { ok: 0, info: 0, warning: 1, orange: 2, danger: 3 };

export const WATER_LOW = 20;
export const waterTone = (v: number): Tone => (v > 50 ? "info" : v > WATER_LOW ? "orange" : "danger");

/** Filter thresholds by unit: `h` hours, `d` days, `%` life left. */
const FILTER_LIMITS: Record<string, [number, number, number]> = { h: [500, 200, 100], d: [20, 8, 4], "%": [30, 15, 5] };

export function filterUnit(unit: unknown): "h" | "d" | "%" {
  const u = String(unit ?? "%").trim().toLowerCase();
  return u.startsWith("h") ? "h" : u.startsWith("d") ? "d" : "%";
}

export function filterTone(value: number, unit: unknown): Tone {
  const [ok, warn, orange] = FILTER_LIMITS[filterUnit(unit)];
  return value > ok ? "ok" : value > warn ? "warning" : value > orange ? "orange" : "danger";
}

/** A filter ready to show. */
export interface FilterReading {
  name: string;
  value: number;
  unit: "h" | "d" | "%";
  tone: Tone;
}

/** The filter closest to replacement: the worst tone, then the lowest value. */
export const worstFilter = (list: FilterReading[]): FilterReading | undefined =>
  [...list].sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone] || a.value - b.value)[0];

/** A secondary index beside PM2.5 (e.g. allergens): which band of `thresholds` the value is in, 0-based. */
export const bandOf = (value: number, thresholds: number[]): number => {
  const i = thresholds.findIndex((limit) => value <= limit);
  return i === -1 ? thresholds.length : i;
};
const BAND_TONES: Tone[] = ["ok", "warning", "orange", "danger"];
export const bandTone = (band: number, bands: number): Tone => BAND_TONES[Math.min(BAND_TONES.length - 1, bands <= 1 ? band : Math.round((band * (BAND_TONES.length - 1)) / (bands - 1)))];

/** Other entities of the fan's device (HA's entity registry); none outside HA. */
export function deviceEntities(entities: Record<string, { device_id?: string | null } | undefined> | undefined, fanId: string): string[] {
  const device = entities?.[fanId]?.device_id;
  if (!device || !entities) return [];
  return Object.keys(entities).filter((id) => id !== fanId && entities[id]?.device_id === device);
}

const numeric = (e?: HassEntity): number | undefined => {
  if (!e || e.state === "unavailable" || e.state === "unknown" || e.state === "") return undefined;
  const v = Number(e.state);
  return Number.isFinite(v) ? v : undefined;
};

/** Where a reading comes from: a sensor (with history) or an attribute of the fan. */
export interface Reading {
  value: number;
  entity?: string;
}

/**
 * A reading of the purifier: the configured entity, a sensor of the same device with the device
 * class, a sensor named after the fan, then attributes of the fan.
 */
export function findReading(
  states: Record<string, HassEntity | undefined>,
  fanId: string,
  device: string[],
  o: { configured?: string; deviceClass?: string; suffix: string; attrs: string[] },
): Reading | undefined {
  const object = fanId.split(".")[1];
  const byClass = o.deviceClass ? device.filter((id) => id.startsWith("sensor.") && states[id]?.attributes.device_class === o.deviceClass) : [];
  for (const id of [o.configured, ...byClass, `sensor.${object}_${o.suffix}`]) {
    const value = id ? numeric(states[id]) : undefined;
    if (id && value !== undefined) return { value, entity: id };
  }
  const attributes = states[fanId]?.attributes ?? {};
  for (const a of o.attrs) {
    const raw = attributes[a];
    const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(value)) return { value };
  }
  return undefined;
}

/** Filters the device itself shows: sensors with "filter" in the id, then the usual fan attributes. */
export function findFilters(states: Record<string, HassEntity | undefined>, fanId: string, device: string[]): { name: string; entity?: string; attribute?: string; unit?: string }[] {
  const sensors = device.filter((id) => id.startsWith("sensor.") && id.includes("filter") && numeric(states[id]) !== undefined).map((id) => ({ name: String(states[id]?.attributes.friendly_name ?? id), entity: id, unit: String(states[id]?.attributes.unit_of_measurement ?? "%") }));
  if (sensors.length) return sensors;
  const attributes = states[fanId]?.attributes ?? {};
  return ["filter_life_remaining", "filter_life", "filter_left"].filter((a) => Number.isFinite(Number(attributes[a])) && attributes[a] !== null && attributes[a] !== undefined).slice(0, 1).map((attribute) => ({ name: "", attribute, unit: "%" }));
}
