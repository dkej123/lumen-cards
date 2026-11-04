// Demo gallery: every Lumen card on a small made-up home (no Home Assistant needed).
//   npm run dev → /dev/index.html   [?compact] [&dark] [&lang=pl] [&fx] (weather effects)
//   &scene=phone | desktop   the example dashboards of the README
//   &only=<id>               one card of the gallery (ids in GALLERY below), for screenshots
//   &weather=rainy|snowy|…   weather state;  &alarm=triggered   alarm state;  &code   lock asks for a code
//   &only=alarm-states | lock-states | climate-states | sensor-states | general-states   every state of a card
//   &only=fab-sheet | compact-row   floating panel, 44 px compact looks;  &edit   dashboard edit mode
//   (demo code for the alarm and the locks: 1234)
import type { HassLike } from "../src/hass/types";
import { injectLocalFonts } from "./local-fonts";
import { DOMAINS, DOMAIN_GALLERY } from "./demo-domains";
import { createDemoHome } from "./mock-hass";

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

const home = createDemoHome({ lang: params.get("lang") ?? "en", dark: params.has("dark"), weather: params.get("weather") ?? undefined, alarm: params.get("alarm") ?? undefined, code: params.has("code") });

type Card = HTMLElement & { hass: HassLike; setConfig(c: unknown): void };
type Spec = [type: string, cfg: Record<string, unknown>, span?: number];
const compact = params.has("compact");
const cards: Card[] = [];
const mk = ([type, cfg, span = 12]: Spec) => {
  const el = document.createElement(`lumen-${type}-card`) as Card;
  el.setConfig({ type: `custom:lumen-${type}-card`, ...(compact ? { layout: "compact" } : {}), ...cfg });
  if (params.has("edit")) (el as unknown as { editMode: boolean }).editMode = true;
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
  // Catalog states (use &scene=phone for the phone grid: 6 columns = compact, 3 = icon only).
  "light-states": [
    ["light", { entity: "light.ceiling" }, 6],
    ["light", { entity: "light.sofa", icon: "mdi:ceiling-light" }, 6],
    ["light", { entity: "light.desk_strip", icon: "mdi:led-strip-variant" }, 6],
    ["light", { entity: "light.sconce", icon: "mdi:wall-sconce-flat" }, 6],
    ["light", { entity: "light.kitchen_all", icon: "mdi:lightbulb-group" }, 6],
    ["light", { entity: "light.bedroom" }, 6],
    ["light", { entity: "light.hall" }, 6],
  ],
  "light-compact": [
    ["light", { entity: "light.ceiling" }, 6],
    ["light", { entity: "light.sofa", icon: "mdi:ceiling-light" }, 6],
    ["light", { entity: "light.bedroom" }, 6],
    ["light", { entity: "light.desk_strip", icon: "mdi:led-strip-variant" }, 6],
    ["light", { entity: "light.ceiling" }, 3],
    ["light", { entity: "light.sofa", icon: "mdi:ceiling-light" }, 3],
    ["light", { entity: "light.bedroom" }, 3],
    ["light", { entity: "light.kitchen_all", icon: "mdi:lightbulb-group" }, 3],
  ],
  "entity-subs": [
    ["entity", { entity: "switch.coffee" }, 6],
    ["entity", { entity: "switch.coffee_on" }, 6],
    ["entity", { entity: "fan.purifier", sub_buttons: [{ entity: "fan.purifier", icon: "mdi:power" }] }, 6],
    ["entity", { entity: "fan.purifier", sub_buttons: [{ entity: "input_boolean.purifier_night" }, { entity: "fan.purifier", icon: "mdi:power" }] }, 6],
    ["entity", { entity: "fan.purifier", sub_buttons: [{ entity: "fan.purifier", icon: "mdi:fan-speed-1", tap_action: { action: "more-info" } }, { entity: "input_boolean.purifier_night" }, { entity: "input_boolean.purifier_lock" }, { entity: "fan.purifier", icon: "mdi:power" }] }, 12],
    ["entity", { entity: "switch.kettle", sub_buttons: [{ entity: "switch.kettle", icon: "mdi:power" }] }, 12],
    ["entity", { entity: "fan.purifier", layout: "compact", sub_buttons: [{ entity: "fan.purifier", icon: "mdi:power" }, { entity: "input_boolean.purifier_night" }] }, 4],
    ["entity", { entity: "switch.coffee", layout: "compact" }, 4],
    ["entity", { entity: "binary_sensor.front_door" }, 2],
    ["entity", { entity: "binary_sensor.back_door" }, 2],
  ],
  "button-states": [
    ["button", { entity: "script.gate", icon: "mdi:gate", feedback: { status_entity: "sensor.gate_status", message_entity: "sensor.gate_message", success_text: "Open" } }, 6],
    ["button", { entity: "script.barrier", sub_buttons: [{ entity: "script.barrier", icon: "mdi:history", tap_action: { action: "more-info" } }] }, 6],
    ["button", { entity: "script.garage", icon: "mdi:gate" }, 6],
    ["button", { entity: "script.gate", icon: "mdi:gate", name: "Gate", layout: "compact", feedback: { status_entity: "sensor.gate_status", message_entity: "sensor.gate_message", success_text: "Open" } }, 3],
  ],
  "person-states": [
    ["person", { entity: "person.alex" }, 6],
    ["person", { entity: "person.sam" }, 6],
    ["person", { entity: "person.mark" }, 6],
    ["person", { entity: "person.zoe", presence_entity: "binary_sensor.zoe_ble" }, 6],
    ["person", { entity: "person.alex", sub_buttons: [{ icon: "mdi:map-marker-outline", tap_action: { action: "more-info" }, entity: "person.alex" }, { icon: "mdi:cellphone", tap_action: { action: "more-info" }, entity: "person.alex" }] }, 6],
    ["person", { entity: "person.ola" }, 6],
    ["person", { entity: "person.alex", layout: "compact" }, 3],
    ["person", { entity: "person.sam", layout: "compact" }, 3],
  ],
  "reminder-states": [
    ["reminder", { entity: "input_boolean.trash", icon: "mdi:delete-outline", color: "info", value: "{value}", value_entity: "sensor.trash_kind", dialog: false }, 6],
    ["reminder", { entity: "input_boolean.laundry", icon: "mdi:washing-machine", color: "ok", value: "{value} min", value_entity: "sensor.laundry_min", dialog: false }, 6],
    ["reminder", { entity: "input_boolean.window", icon: "mdi:window-open-variant", color: "warning", value: "{value} min", value_entity: "sensor.window_min", alignment: "center", dialog: false }, 6],
    ["reminder", { ...reminder, value: "{value}%", alignment: "end", dialog: false }, 6],
  ],
  "fab-list": [["chips", { chips: [{ type: "action", entity: "scene.evening" }, { type: "action", entity: "scene.movie" }], fab: true, fab_narrow_only: false, title: "Scenes" }]],
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
  // Floating panel: the FAB (always, for the gallery) + the 52 px trigger row; &edit = edit mode.
  "fab-sheet": [
    ["fab-sheet", { title: "Heating", icon: "mdi:radiator", narrow_only: false, cards: ["th_living", "th_bedroom", "th_bathroom"].map((id) => ({ type: "custom:lumen-climate-card", entity: `climate.${id}` })) }],
    ["chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }], fab: true, fab_narrow_only: false }],
    ["fab-sheet", { title: "Heating", icon: "mdi:radiator", cards: ["th_living", "th_bedroom", "th_bathroom"].map((id) => ({ type: "custom:lumen-climate-card", entity: `climate.${id}` })) }],
    ["climate", { entity: "climate.th_bathroom", max_width: 340 }],
    ["climate", { entity: "climate.th_bathroom", layout: "compact" }, 4],
    ["climate", { entity: "climate.th_bedroom", layout: "compact" }, 6],
  ],
  "compact-row": [
    ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 3],
    ["light", { entity: "light.strip", icon: "mdi:led-strip-variant" }, 3],
    ["entity", { entity: "binary_sensor.back_door", sub_buttons: [{ entity: "light.ceiling", icon: "mdi:ceiling-light" }] }, 2],
    ["alarm", { entity: "alarm_control_panel.house", layout: "compact" }, 2],
    ["lock", { entity: "lock.car", icon: "mdi:car", layout: "compact" }, 2],
    ["person", { entity: "person.alex", avatar_color: "light-blue", layout: "compact", sub_buttons: [{ entity: "person.alex", icon: "mdi:cellphone", tap_action: { action: "more-info" } }] }, 4],
    ["person", { entity: "person.sam", avatar_color: "amber", layout: "compact" }, 4],
    ["button", { entity: "script.gate", icon: "mdi:gate", layout: "compact", sub_buttons: [{ entity: "light.ceiling", icon: "mdi:ceiling-light" }] }, 4],
  ],
  "weather": [["weather-background", { weather_entity: "weather.home", show_controls: true }], ["sensor", { entity: "sensor.outside_temp", color: "light-blue" }, 6], ["entity", { entity: "binary_sensor.front_door" }, 6], ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6], ["light", { entity: "light.ceiling", icon: "mdi:ceiling-light" }, 6]],
};

Object.assign(GALLERY, DOMAIN_GALLERY);

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
  ["title", { title: "New domains" }],
  ...DOMAINS,
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
home.listen(push);
push(home.hass());
