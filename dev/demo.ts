// Demo gallery: every Lumen card on a small made-up home (no Home Assistant needed).
//   npm run dev → /dev/index.html   [?compact] [&dark] [&lang=pl] [&fx] (weather effects)
//   &scene=phone | desktop   the example dashboards of the README
//   &only=<id>               one card of the gallery (ids in GALLERY below), for screenshots
//   &weather=rainy|snowy|…   weather state;  &alarm=triggered   alarm state;  &code   lock asks for a code
//   &only=alarm-states | lock-states | climate-states | sensor-states | general-states   catalog 2026-10-29 states
//   (demo code for the alarm and the locks: 1234)
import type { HassEntities, HassEntity, HassLike } from "../src/hass/types";
import { injectLocalFonts } from "./local-fonts";

injectLocalFonts();
const params = new URLSearchParams(location.search);
localStorage.setItem("lumen-effects", JSON.stringify(params.has("fx") ? { motion: false, background: true, surface: true } : { motion: false, background: false, surface: false }));

// HA's <ha-icon> stand-in (user-picked icons render through it inside Home Assistant).
const mdi = (await import("@mdi/js")) as unknown as Record<string, string>;
customElements.define(
  "ha-icon",
  class extends HTMLElement {
    set icon(name: string) {
      const key = "mdi" + name.replace("mdi:", "").split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
      this.innerHTML = `<svg viewBox="0 0 24 24" style="display:block;width:1em;height:1em;fill:currentColor"><path d="${mdi[key] ?? ""}"/></svg>`;
    }
  },
);
await import("../src/lumen-cards");

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const e = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, min = 30): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed: ago(min),
  last_updated: ago(min),
});
const CT = { supported_color_modes: ["color_temp"], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 4000 };

let states: HassEntities = Object.fromEntries(
  [
    e("sun.sun", "above_horizon", { elevation: 25, rising: false }),
    e("weather.home", params.get("weather") ?? "partlycloudy", { friendly_name: "Home" }, 120),
    e("alarm_control_panel.house", params.get("alarm") ?? "armed_away", { friendly_name: "House" }),
    e("alarm_control_panel.garage", "disarmed", { friendly_name: "Garage" }),
    e("person.alex", "home", { friendly_name: "Alex" }, 95),
    e("person.sam", "Work", { friendly_name: "Sam" }, 20),
    e("light.sofa", "on", { friendly_name: "Sofa", brightness: 170, color_temp_kelvin: 2700, ...CT }),
    e("light.ceiling", "off", { friendly_name: "Ceiling", ...CT }),
    e("light.kitchen", "on", { friendly_name: "Kitchen", brightness: 255, color_temp_kelvin: 4000, ...CT }),
    e("light.strip", "on", { friendly_name: "LED strip", brightness: 120, supported_color_modes: ["hs"], color_mode: "hs", rgb_color: [120, 90, 255] }),
    e("scene.movie", "2026-10-01T20:00:00Z", { friendly_name: "Movie", icon: "mdi:movie-open-outline" }),
    e("scene.evening", "2026-10-01T20:00:00Z", { friendly_name: "Evening", icon: "mdi:weather-sunset" }),
    e("binary_sensor.front_door", "off", { friendly_name: "Front door", device_class: "door" }),
    e("binary_sensor.back_door", "on", { friendly_name: "Back door", device_class: "door" }, 3),
    e("lock.car", "locked", { friendly_name: "Car", supported_features: 0, ...(params.has("code") ? { code_format: "^\\d+$" } : {}) }),
    e("lock.front_door", "unlocked", { friendly_name: "Front door lock", supported_features: 1 }),
    e("script.gate", "off", { friendly_name: "Gate", last_triggered: ago(45) }),
    e("sensor.living_temp", "21.6", { friendly_name: "Living room", unit_of_measurement: "°C", device_class: "temperature" }),
    e("sensor.outside_temp", "8.2", { friendly_name: "Outside", unit_of_measurement: "°C", device_class: "temperature" }),
    e("sensor.pm25", "14", { friendly_name: "PM2.5", unit_of_measurement: "µg/m³", device_class: "pm25" }, 5),
    e("sensor.pm10", "22", { friendly_name: "PM10", unit_of_measurement: "µg/m³", device_class: "pm10" }, 5),
    e("climate.bedroom_ac", "cool", { friendly_name: "Bedroom AC", hvac_modes: ["off", "heat", "cool"], fan_modes: ["auto", "low", "medium", "high"], fan_mode: "auto", temperature: 22, current_temperature: 23.4, min_temp: 16, max_temp: 30, target_temp_step: 0.5 }),
    e("input_boolean.bike_battery", "on", { friendly_name: "Bike battery low" }, 10),
    // Catalog 2026-10-29 states (sections 05, 06, 09, 10, 11, 15).
    e("alarm_control_panel.demo", "disarmed", { friendly_name: "Alarm · home", supported_features: 7, code_format: "number" }),
    e("alarm_control_panel.home_mode", "armed_home", { friendly_name: "Alarm · home", supported_features: 7, code_format: "number" }),
    e("alarm_control_panel.night", "armed_night", { friendly_name: "Alarm · home", supported_features: 7, code_format: "number" }),
    e("alarm_control_panel.arming", "arming", { friendly_name: "Alarm · home", next_state: "armed_away", arming_time: 60, code_format: "number" }, 0.4),
    e("alarm_control_panel.pending", "pending", { friendly_name: "Alarm · home", delay: 30, code_format: "number" }, 0.2),
    e("alarm_control_panel.triggered", "triggered", { friendly_name: "Alarm · home", changed_by: "Living room, motion", code_format: "number" }),
    e("alarm_control_panel.text", "armed_away", { friendly_name: "Alarm · text code", code_format: "text" }),
    e("alarm_control_panel.offline", "unavailable", { friendly_name: "Alarm · home" }),
    e("lock.demo", "locked", { friendly_name: "Front door", supported_features: 1, code_format: "^\\d+$" }),
    e("lock.unlocked", "unlocked", { friendly_name: "Front door", supported_features: 1 }, 5),
    e("lock.open", "open", { friendly_name: "Front door", supported_features: 1 }),
    e("lock.jammed", "jammed", { friendly_name: "Front door", supported_features: 1 }),
    e("lock.locking", "locking", { friendly_name: "Front door", supported_features: 1 }),
    e("lock.unknown", "unknown", { friendly_name: "Front door", supported_features: 1 }),
    e("lock.gate", "locked", { friendly_name: "Garden gate", supported_features: 0 }),
    e("lock.offline", "unavailable", { friendly_name: "Front door", supported_features: 1 }),
    e("climate.heat_cool", "heat_cool", { friendly_name: "Climate · living room", hvac_modes: ["heat_cool", "cool", "heat", "off"], hvac_action: "idle", target_temp_low: 20, target_temp_high: 25, current_temperature: 22.4, min_temp: 10, max_temp: 32, target_temp_step: 0.5 }),
    e("climate.radiator", "heat", { friendly_name: "Radiator · bathroom", hvac_modes: ["heat", "off"], hvac_action: "heating", temperature: 23, current_temperature: 21.2, min_temp: 5, max_temp: 30, target_temp_step: 0.5, preset_modes: ["comfort", "eco", "away"], preset_mode: "comfort" }),
    e("climate.office_f", "cool", { friendly_name: "AC · office", temperature_unit: "°F", hvac_modes: ["auto", "cool", "heat", "dry", "fan_only"], hvac_action: "cooling", temperature: 72, current_temperature: 76, min_temp: 61, max_temp: 86, target_temp_step: 1, fan_modes: ["auto", "1", "2", "3", "turbo"], fan_mode: "auto", swing_modes: ["off", "vertical", "both"], swing_mode: "vertical", preset_modes: ["none", "eco", "sleep", "boost"], preset_mode: "none" }),
    e("climate.off", "off", { friendly_name: "Climate · living room", hvac_modes: ["off", "cool", "heat", "dry"], fan_modes: ["auto", "low", "medium", "high"], fan_mode: "auto", temperature: 22, current_temperature: 24.1, min_temp: 16, max_temp: 30, target_temp_step: 0.5 }),
    e("sensor.balcony", "8.1", { friendly_name: "Balcony", unit_of_measurement: "°C", device_class: "temperature" }, 180),
    e("sensor.cellar", "unavailable", { friendly_name: "Cellar", unit_of_measurement: "°C", device_class: "temperature" }),
    e("sensor.aqi", "72", { friendly_name: "AQI", device_class: "aqi" }, 10),
    e("sensor.pm25_old", "14", { friendly_name: "PM2.5", unit_of_measurement: "µg/m³", device_class: "pm25" }, 180),
    e("sensor.pm10_old", "23", { friendly_name: "PM10", unit_of_measurement: "µg/m³", device_class: "pm10" }, 180),
    e("sensor.bike_battery", "18", { unit_of_measurement: "%" }),
  ].map((x) => [x.entity_id, x]),
);

const listeners = new Set<(h: HassLike) => void>();
const set = (id: string, state: string, attributes: Record<string, unknown> = {}) => {
  const old = states[id];
  if (!old) return;
  states = { ...states, [id]: { ...old, state, attributes: { ...old.attributes, ...attributes }, last_changed: state !== old.state ? ago(0) : old.last_changed, last_updated: ago(0) } };
  const h = make();
  setTimeout(() => listeners.forEach((l) => l(h)), 300);
};
const lang = params.get("lang") ?? "en";
const make = (): HassLike => ({
  states,
  user: { id: "demo", name: "Alex", is_admin: true },
  language: lang,
  locale: { language: lang },
  themes: { darkMode: params.has("dark") },
  // A rough stand-in for HA's translated state text.
  formatEntityState: (x) => {
    const pl = lang === "pl";
    if (x.entity_id.startsWith("binary_sensor.") && ["door", "window", "opening"].includes(String(x.attributes.device_class)))
      return x.state === "on" ? (pl ? "Otwarte" : "Open") : pl ? "Zamknięte" : "Closed";
    const words: Record<string, [string, string]> = {
      armed_away: ["Armed away", "Uzbrojony (poza domem)"],
      armed_home: ["Armed home", "Uzbrojony (w domu)"],
      disarmed: ["Disarmed", "Rozbrojony"],
      locked: ["Locked", "Zablokowany"],
      unlocked: ["Unlocked", "Odblokowany"],
      on: ["On", "Włączony"],
      off: ["Off", "Wyłączony"],
    };
    const w = words[x.state];
    return w ? w[pl ? 1 : 0] : x.state + (x.attributes.unit_of_measurement ? ` ${x.attributes.unit_of_measurement}` : "");
  },
  callService: async (domain, service, data = {}, target) => {
    const id = String((target as { entity_id?: string })?.entity_id ?? "");
    if (domain === "light") set(id, service === "turn_off" ? "off" : "on", data.brightness_pct ? { brightness: Math.round(Number(data.brightness_pct) * 2.55) } : data.color_temp_kelvin ? { color_temp_kelvin: data.color_temp_kelvin } : {});
    if (domain === "homeassistant" && service.startsWith("turn_")) set(id, service === "turn_on" ? "on" : "off");
    if (domain === "lock") {
      if (states[id]?.attributes.code_format && service !== "lock" && data.code !== "1234") throw new Error("Invalid code");
      set(id, service === "lock" ? "locked" : service === "open" ? "open" : "unlocked");
    }
    if (domain === "alarm_control_panel") {
      const needs = !!states[id]?.attributes.code_format;
      if (needs && data.code !== "1234") throw new Error("Invalid alarm code");
      if (service === "alarm_disarm") set(id, "disarmed");
      else {
        const mode = service.replace("alarm_arm_", "armed_");
        set(id, "arming", { next_state: mode, arming_time: 10 });
        setTimeout(() => set(id, mode), 10_000);
      }
    }
    if (domain === "climate" && service !== "set_hvac_mode" && service !== "set_temperature") set(id, states[id].state, data);
    if (domain === "climate" && service === "set_hvac_mode") set(id, String(data.hvac_mode));
    if (domain === "climate" && service === "set_temperature") set(id, states[id].state, data);
    return undefined;
  },
  callWS: async <T>() => {
    // A day of made-up history for the sparklines.
    const hist: Record<string, { s: string; lu: number }[]> = {};
    for (const [id, base] of [["sensor.living_temp", 21], ["sensor.outside_temp", 7], ["sensor.pm25", 15], ["sensor.pm10", 24]] as const)
      hist[id] = Array.from({ length: 48 }, (_, i) => ({ s: String(base + Math.sin(i / 5) * 2), lu: Date.now() / 1000 - (48 - i) * 1800 }));
    return hist as T;
  },
});

type Card = HTMLElement & { hass: HassLike; setConfig(c: unknown): void };
type Spec = [type: string, cfg: Record<string, unknown>, span?: number];
const compact = params.has("compact");
const cards: Card[] = [];
const mk = ([type, cfg, span = 12]: Spec) => {
  const el = document.createElement(`lumen-${type}-card`) as Card;
  el.setConfig({ type: `custom:lumen-${type}-card`, ...(compact ? { layout: "compact" } : {}), ...cfg });
  el.style.gridColumn = `span ${span}`;
  el.dataset.card = type;
  cards.push(el);
  return el;
};

const bg: Spec = ["weather-background", { weather_entity: "weather.home" }];
const reminder = { entity: "input_boolean.bike_battery", name: "Bike", icon: "mdi:bicycle-electric", color: "danger", value: "Battery {value}%", value_entity: "sensor.bike_battery", title: "Charge the bike", message: "The battery is below 20 %.", done: true };

/** Single cards for the README gallery (&only=<id>). */
const GALLERY: Record<string, Spec[]> = {
  "light": [["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6], ["light", { entity: "light.ceiling", icon: "mdi:ceiling-light" }, 6]],
  "light-color": [["light", { entity: "light.strip", icon: "mdi:led-strip-variant" }, 6], ["light", { entity: "light.kitchen", icon: "mdi:stove" }, 6]],
  "chips": [["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }, { type: "light", entity: "light.kitchen", name: "Stove" }, { type: "light", entity: "light.strip", name: "Strip" }] }]],
  "person": [["person", { entity: "person.alex", avatar_color: "light-blue" }, 6], ["person", { entity: "person.sam", avatar_color: "amber" }, 6]],
  "alarm": [["alarm", { entity: "alarm_control_panel.house", tap_action: { action: "more-info" } }], ["alarm", { entity: "alarm_control_panel.garage", icon: "mdi:garage" }]],
  "lock": [["lock", { entity: "lock.car", icon: "mdi:car" }], ["lock", { entity: "lock.front_door" }]],
  "entity": [["entity", { entity: "binary_sensor.front_door" }, 6], ["entity", { entity: "binary_sensor.back_door" }, 6]],
  "button": [["button", { entity: "script.gate", icon: "mdi:gate", sub_buttons: [{ entity: "light.ceiling", icon: "mdi:ceiling-light" }] }, 12]],
  "sensor": [["sensor", { entity: "sensor.living_temp" }, 6], ["sensor", { entity: "sensor.outside_temp", color: "light-blue" }, 6]],
  "climate": [["climate", { entity: "climate.bedroom_ac" }]],
  "climate-dialog": [["climate", { entity: "climate.bedroom_ac", fab: true, fab_narrow_only: false }]],
  "climate-fab": [["climate", { entity: "climate.bedroom_ac", fab: true, fab_narrow_only: false }], ["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }], fab: true, fab_narrow_only: false }]],
  "air-quality": [["air-quality", { pm25: "sensor.pm25", pm10: "sensor.pm10" }]],
  "reminder": [["reminder", { ...reminder, dialog: false }]],
  "reminder-dialog": [["reminder", reminder]],
  "title": [["title", { title: "Security" }], ["title", { title: "Living room", heading_style: "section", badges: ["sensor.living_temp"] }], ["title", { title: "Kitchen", heading_style: "room", badges: ["sensor.living_temp"], entity: "light.kitchen" }]],
  "greeting": [["greeting", {}]],
  "alarm-states": ["demo", "home_mode", "night", "arming", "pending", "triggered", "text", "offline"].map((id): Spec => ["alarm", { entity: `alarm_control_panel.${id}`, screen_ring: false, banner: false, max_width: 340 }])
    .concat([["alarm", { entity: "alarm_control_panel.home_mode", layout: "compact" }, 4], ["alarm", { entity: "alarm_control_panel.pending", layout: "compact", banner: false }, 4], ["alarm", { entity: "alarm_control_panel.triggered", layout: "compact", banner: false, screen_ring: false }, 4]]),
  "lock-states": ["demo", "unlocked", "open", "jammed", "locking", "unknown", "gate", "offline"].map((id): Spec => ["lock", { entity: `lock.${id}`, max_width: 340 }])
    .concat([["lock", { entity: "lock.demo", layout: "compact" }, 4], ["lock", { entity: "lock.open", layout: "compact" }, 4]]),
  "climate-states": [["climate", { entity: "climate.bedroom_ac", max_width: 340 }], ["climate", { entity: "climate.heat_cool", max_width: 340 }], ["climate", { entity: "climate.off", max_width: 340 }], ["climate", { entity: "climate.radiator", max_width: 340, show_range: true }], ["climate", { entity: "climate.office_f", max_width: 340, show_range: true }], ["climate", { entity: "climate.bedroom_ac", layout: "compact", max_width: 320 }], ["climate", { entity: "climate.off", layout: "compact", max_width: 320 }]],
  "sensor-states": [["sensor", { entity: "sensor.living_temp" }, 6], ["sensor", { entity: "sensor.balcony" }, 6], ["sensor", { entity: "sensor.cellar" }, 6], ["sensor", { entity: "sensor.living_temp", layout: "compact" }, 6], ["air-quality", { pm25: "sensor.pm25", pm10: "sensor.pm10" }], ["air-quality", { aqi_entity: "sensor.aqi" }], ["air-quality", { pm25: "sensor.pm25_old", pm10: "sensor.pm10_old" }], ["air-quality", { pm25: "sensor.pm25", pm10: "sensor.pm10", layout: "compact" }]],
  "general-states": [["lock", { entity: "lock.offline", max_width: 340 }], ["lock", { entity: "lock.unknown", max_width: 340 }], ["light", { entity: "light.salon_sufit" }], ["light", {}], ["sensor", { entity: "sensor.living_temp", accent_color: "pink" }, 6], ["sensor", { entity: "sensor.outside_temp", color: "green" }, 6]],
  "weather": [["weather-background", { weather_entity: "weather.home", show_controls: true }], ["sensor", { entity: "sensor.outside_temp", color: "light-blue" }, 6], ["entity", { entity: "binary_sensor.front_door" }, 6], ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6], ["light", { entity: "light.ceiling", icon: "mdi:ceiling-light" }, 6]],
};

/** Example dashboards of the README (same cards as the YAML there). */
const PHONE: Spec[] = [
  bg,
  ["greeting", {}],
  ["alarm", { entity: "alarm_control_panel.house" }, 3],
  ["alarm", { entity: "alarm_control_panel.garage", icon: "mdi:garage" }, 3],
  ["entity", { entity: "binary_sensor.front_door" }, 3],
  ["lock", { entity: "lock.car", icon: "mdi:car" }, 3],
  ["person", { entity: "person.alex", avatar_color: "light-blue" }, 6],
  ["person", { entity: "person.sam", avatar_color: "amber" }, 6],
  ["reminder", { ...reminder, dialog: false, alignment: "center" }],
  ["title", { title: "Living room", heading_style: "section", badges: ["sensor.living_temp"] }],
  ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6],
  ["light", { entity: "light.ceiling", icon: "mdi:ceiling-light" }, 6],
  ["light", { entity: "light.kitchen", icon: "mdi:stove" }, 6],
  ["light", { entity: "light.strip", icon: "mdi:led-strip-variant" }, 6],
  ["air-quality", { pm25: "sensor.pm25", pm10: "sensor.pm10" }],
  ["sensor", { entity: "sensor.living_temp" }, 6],
  ["sensor", { entity: "sensor.outside_temp", color: "light-blue" }, 6],
  ["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }], fab: true }],
  ["climate", { entity: "climate.bedroom_ac", fab: true }],
];
const DESKTOP: Spec[][] = [
  [
    bg,
    ["greeting", {}],
    ["title", { title: "Security" }],
    ["alarm", { entity: "alarm_control_panel.house" }],
    ["alarm", { entity: "alarm_control_panel.garage", icon: "mdi:garage" }],
    ["title", { title: "People" }],
    ["person", { entity: "person.alex", avatar_color: "light-blue" }],
    ["person", { entity: "person.sam", avatar_color: "amber" }],
  ],
  [
    ["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }] }],
    ["reminder", { ...reminder, dialog: false, alignment: "center" }],
    ["title", { title: "Living room", heading_style: "section", badges: ["sensor.living_temp"] }],
    ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6],
    ["light", { entity: "light.ceiling", icon: "mdi:ceiling-light" }, 6],
    ["light", { entity: "light.kitchen", icon: "mdi:stove" }, 6],
    ["light", { entity: "light.strip", icon: "mdi:led-strip-variant" }, 6],
    ["title", { title: "Kitchen", heading_style: "room", badges: ["sensor.living_temp"] }],
    ["chips", { chips: [{ type: "light", entity: "light.kitchen", name: "Stove" }, { type: "light", entity: "light.strip", name: "Strip" }] }],
  ],
  [
    ["title", { title: "Access" }],
    ["entity", { entity: "binary_sensor.front_door" }, 6],
    ["entity", { entity: "binary_sensor.back_door" }, 6],
    ["lock", { entity: "lock.car", icon: "mdi:car" }],
    ["button", { entity: "script.gate", icon: "mdi:gate" }, 6],
    ["title", { title: "Climate" }],
    ["air-quality", { pm25: "sensor.pm25", pm10: "sensor.pm10" }],
    ["sensor", { entity: "sensor.living_temp" }, 6],
    ["sensor", { entity: "sensor.outside_temp", color: "light-blue" }, 6],
    ["climate", { entity: "climate.bedroom_ac" }],
  ],
];
const ALL: Spec[] = [
  ["weather-background", { weather_entity: "weather.home", show_controls: true }],
  ["greeting", {}],
  ...GALLERY.title.slice(0, 1),
  ...GALLERY.alarm.map(([t, c]): Spec => [t, c, compact ? 3 : 12]),
  ...GALLERY.entity.map(([t, c]): Spec => [t, c, compact ? 3 : 6]),
  GALLERY.lock[0],
  ["button", { entity: "script.gate", icon: "mdi:gate" }, 6],
  ["reminder", { ...reminder, dialog: false }, 6],
  ["title", { title: "People" }],
  ...GALLERY.person,
  GALLERY.title[1],
  ["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }] }],
  ...GALLERY.light,
  ...GALLERY["light-color"],
  GALLERY.title[2],
  ["chips", { chips: [{ type: "light", entity: "light.kitchen", name: "Stove" }, { type: "light", entity: "light.strip", name: "Strip" }] }],
  ["title", { title: "Climate" }],
  ...GALLERY["air-quality"],
  ...GALLERY.sensor,
  ...GALLERY.climate,
];

const grid = document.getElementById("grid")!;
const scene = params.get("scene");
const only = params.get("only");
if (scene === "desktop") {
  grid.classList.add("desktop");
  for (const col of DESKTOP) {
    const section = document.createElement("div");
    section.className = "section";
    section.append(...col.map(mk));
    grid.append(section);
  }
} else {
  if (scene === "phone") grid.classList.add("phone");
  grid.append(...(only ? (GALLERY[only] ?? []) : scene === "phone" ? PHONE : ALL).map(mk));
}

const push = (h: HassLike) => cards.forEach((c) => (c.hass = h));
listeners.add(push);
push(make());
