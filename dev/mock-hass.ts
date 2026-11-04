// A small made-up home for the demo gallery and the catalog page: entity states, service calls
// that change them like Home Assistant would (lights, locks, alarm, climate, the new domains),
// a day of history for the sparklines. Demo code for the alarm and the locks: 1234.
import type { HassEntities, HassEntity, HassLike } from "../src/hass/types";
import { domainApi, domainService, domainStates, listenActions, type DemoCtx } from "./demo-domains";

export interface DemoOptions {
  lang?: string;
  dark?: boolean;
  /** weather.home state (default partlycloudy). */
  weather?: string;
  /** alarm_control_panel.house state (default armed_away). */
  alarm?: string;
  /** The car lock asks for a code. */
  code?: boolean;
  /** More entities; a state with the id of a built-in one replaces it. */
  extra?: (e: (id: string, state: string, attributes?: Record<string, unknown>, min?: number) => HassEntity) => HassEntity[];
  /** Answers a service call before the built-in ones; true = handled. */
  service?: (ctx: DemoCtx, domain: string, service: string, data: Record<string, unknown>, id: string) => boolean;
}

export interface DemoHome {
  /** The current hass object (a new one after every change). */
  hass(): HassLike;
  /** Called with the new hass after every state change. */
  listen(fn: (h: HassLike) => void): void;
  /** Light / dark theme of the hass object. */
  setDark(dark: boolean): void;
}

/** The made-up home speaks the visitor's language: names are written in either one here and looked up on creation. */
const NAMES_PL: Record<string, string> = {
  "AC · office": "Klima · biuro", "Alarm · home": "Alarm · dom", "Alarm · text code": "Alarm · kod tekstowy", "Back door": "Drzwi tylne", Balcony: "Balkon", Barrier: "Szlaban",
  Bathroom: "Łazienka", Bedroom: "Sypialnia", "Bedroom AC": "Klima w sypialni", "Bike battery low": "Niska bateria roweru", Car: "Samochód", Ceiling: "Sufit", Cellar: "Piwnica",
  "Child lock": "Blokada rodzicielska", "Climate · living room": "Klimat · salon", "Desk strip": "Listwa przy biurku", Evening: "Wieczór", "Front door": "Drzwi wejściowe",
  "Front door lock": "Zamek drzwi wejściowych", Garage: "Garaż", "Garage gate": "Brama garażowa", "Garden gate": "Furtka", Gate: "Brama", "Gate message": "Komunikat bramy",
  "Gate status": "Stan bramy", Hall: "Przedpokój", Home: "Dom", House: "Dom", Kitchen: "Kuchnia", "Kitchen · all": "Kuchnia · wszystko", "LED strip": "Taśma LED",
  "Laundry done": "Pranie gotowe", "Living room": "Salon", Movie: "Film", "Night mode": "Tryb nocny", Outside: "Na zewnątrz", Purifier: "Oczyszczacz", "Radiator · bathroom": "Grzejnik · łazienka",
  Sconce: "Kinkiet", "Socket · coffee": "Gniazdko · ekspres", "Socket · kettle": "Gniazdko · czajnik", Sofa: "Sofa", Trash: "Śmieci", "Weather warnings": "Ostrzeżenia pogodowe",
  "Window open": "Otwarte okno", "Zoe key fob": "Brelok Zoe",
};
const NAMES_EN: Record<string, string> = { Alergeny: "Allergens", "Kinkiet 1": "Sconce 1", "Kinkiet 2": "Sconce 2", Kinkiety: "Sconces", Oczyszczacz: "Purifier", Wilgotność: "Humidity" };

export function createDemoHome(o: DemoOptions = {}): DemoHome {
  const lang = o.lang ?? "en";
  const named = (name: unknown) => (typeof name === "string" ? ((lang === "pl" ? NAMES_PL : NAMES_EN)[name] ?? name) : name);
  let dark = !!o.dark;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const e = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, min = 30): HassEntity => ({
    entity_id,
    state,
    attributes: "friendly_name" in attributes ? { ...attributes, friendly_name: named(attributes.friendly_name) } : attributes,
    last_changed: ago(min),
    last_updated: ago(min),
  });
  /** Local time `day` days and `hour` hours from today (forecast items, warnings). */
  const forecastAt = (day: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + day);
    d.setHours(hour, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00:00`;
  };
  const CONDS = ["partlycloudy", "cloudy", "rainy", "rainy", "cloudy", "partlycloudy", "sunny", "sunny"];
  /** A made-up forecast: 48 hours from now and 7 days, mild autumn weather. */
  const forecast = (type: string) => {
    if (type === "hourly") {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      return Array.from({ length: 48 }, (_, i) => {
        const t = new Date(now.getTime() + i * 3_600_000);
        const h = t.getHours();
        const temp = 8 + 4 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + (i > 24 ? -1.5 : 0);
        return { datetime: t.toISOString(), condition: CONDS[Math.floor(i / 6) % CONDS.length], temperature: Math.round(temp * 10) / 10, apparent_temperature: Math.round((temp - 2.4) * 10) / 10, precipitation_probability: [10, 20, 60, 80, 40, 20, 5, 0][Math.floor(i / 6) % 8], precipitation: i % 13 === 4 ? 0.6 : 0, wind_speed: 12 + (i % 7) };
      });
    }
    return Array.from({ length: 7 }, (_, d) => ({ datetime: new Date(forecastAt(d, 0)).toISOString(), condition: CONDS[(d * 3) % CONDS.length], temperature: 11 + ((d * 5) % 4), templow: 3 + ((d * 3) % 4), precipitation_probability: [20, 70, 40, 10, 0, 30, 60][d], wind_speed: 10 + d }));
  };
  const CT = { supported_color_modes: ["color_temp"], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 4000 };

  let states: HassEntities = Object.fromEntries(
    [
      e("sun.sun", "above_horizon", { elevation: 25, rising: false }),
      e("weather.home", o.weather ?? "partlycloudy", { friendly_name: "Home", temperature: 9.4, apparent_temperature: 6.8, humidity: 81, wind_speed: 14, wind_bearing: 240, supported_features: 3 }, 120),
      e("sensor.weather_warnings", "1", { friendly_name: "Weather warnings", warnings: [{ event: "Silny wiatr", level: 1, valid_from: forecastAt(0, 18).replace("T", " ").slice(0, 19), valid_to: forecastAt(1, 9).replace("T", " ").slice(0, 19) }] }, 60),
      e("alarm_control_panel.house", o.alarm ?? "armed_away", { friendly_name: "House" }),
      e("alarm_control_panel.garage", "disarmed", { friendly_name: "Garage" }),
      e("person.alex", "home", { friendly_name: "Alex" }, 95),
      e("person.sam", "Work", { friendly_name: "Sam" }, 20),
      e("light.sofa", "on", { friendly_name: "Sofa", brightness: 170, color_temp_kelvin: 2700, ...CT }),
      e("light.ceiling", "off", { friendly_name: "Ceiling", ...CT }),
      e("light.kitchen", "on", { friendly_name: "Kitchen", brightness: 255, color_temp_kelvin: 4000, ...CT }),
      e("light.strip", "on", { friendly_name: "LED strip", brightness: 120, supported_color_modes: ["hs"], color_mode: "hs", rgb_color: [120, 90, 255] }),
      e("scene.movie", "2026-10-01T19:00:00Z", { friendly_name: "Movie", icon: "mdi:movie-open-outline" }),
      e("scene.evening", "2026-10-01T20:00:00Z", { friendly_name: "Evening", icon: "mdi:weather-sunset" }),
      e("binary_sensor.front_door", "off", { friendly_name: "Front door", device_class: "door" }),
      e("binary_sensor.back_door", "on", { friendly_name: "Back door", device_class: "door" }, 3),
      e("lock.car", "locked", { friendly_name: "Car", supported_features: 0, ...(o.code ? { code_format: "^\\d+$" } : {}) }),
      e("lock.front_door", "unlocked", { friendly_name: "Front door lock", supported_features: 1 }),
      e("script.gate", "off", { friendly_name: "Gate", last_triggered: ago(45) }),
      e("sensor.living_temp", "21.6", { friendly_name: "Living room", unit_of_measurement: "°C", device_class: "temperature" }),
      e("sensor.outside_temp", "8.2", { friendly_name: "Outside", unit_of_measurement: "°C", device_class: "temperature" }),
      e("sensor.pm25", "14", { friendly_name: "PM2.5", unit_of_measurement: "µg/m³", device_class: "pm25" }, 5),
      e("sensor.pm10", "22", { friendly_name: "PM10", unit_of_measurement: "µg/m³", device_class: "pm10" }, 5),
      e("climate.bedroom_ac", "cool", { friendly_name: "Bedroom AC", hvac_modes: ["off", "heat", "cool"], fan_modes: ["auto", "low", "medium", "high"], fan_mode: "auto", temperature: 22, current_temperature: 23.4, min_temp: 16, max_temp: 30, target_temp_step: 0.5 }),
      e("input_boolean.bike_battery", "on", { friendly_name: "Bike battery low" }, 10),
      // Every state of the alarm, lock, climate, sensor and air quality cards.
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
      // Floating panel: three Better Thermostat radiators, one valve at 9 %.
      e("climate.th_living", "heat", { friendly_name: "Living room", hvac_modes: ["heat", "off"], hvac_action: "heating", temperature: 21, current_temperature: 20.4, min_temp: 5, max_temp: 30, target_temp_step: 0.5, preset_modes: ["comfort", "eco", "away"], preset_mode: "comfort", batteries: '{"climate.valve_living": {"battery": 82}}' }),
      e("climate.th_bedroom", "heat", { friendly_name: "Bedroom", hvac_modes: ["heat", "off"], hvac_action: "idle", temperature: 19, current_temperature: 19.6, min_temp: 5, max_temp: 30, target_temp_step: 0.5, preset_modes: ["comfort", "eco", "away"], preset_mode: "comfort" }),
      e("climate.th_bathroom", "heat", { friendly_name: "Bathroom", hvac_modes: ["heat", "off"], hvac_action: "heating", temperature: 23, current_temperature: 21.8, min_temp: 5, max_temp: 30, target_temp_step: 0.5, preset_modes: ["comfort", "eco", "away"], preset_mode: "comfort", batteries: '{"climate.valve_bath_1": {"battery": 9}, "climate.valve_bath_2": {"battery": 64}}' }),
      e("sensor.balcony", "8.1", { friendly_name: "Balcony", unit_of_measurement: "°C", device_class: "temperature" }, 180),
      e("sensor.cellar", "unavailable", { friendly_name: "Cellar", unit_of_measurement: "°C", device_class: "temperature" }),
      e("sensor.aqi", "72", { friendly_name: "AQI", device_class: "aqi" }, 10),
      e("sensor.pm25_old", "14", { friendly_name: "PM2.5", unit_of_measurement: "µg/m³", device_class: "pm25" }, 180),
      e("sensor.pm10_old", "23", { friendly_name: "PM10", unit_of_measurement: "µg/m³", device_class: "pm10" }, 180),
      // Catalog states (sections 01–08).
      e("light.desk_strip", "on", { friendly_name: "Desk strip", brightness: 153, supported_color_modes: ["color_temp", "hs"], color_mode: "hs", hs_color: [324, 75], rgb_color: [255, 64, 182], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, color_temp_kelvin: 3950 }),
      e("light.sconces", "on", { friendly_name: "Kinkiety", brightness: 128, color_temp_kelvin: 2700, ...CT }),
      e("switch.sconce_1", "on", { friendly_name: "Kinkiet 1" }),
      e("switch.sconce_2", "off", { friendly_name: "Kinkiet 2" }),
      e("light.sconce", "on", { friendly_name: "Sconce", supported_color_modes: ["onoff"], color_mode: "onoff" }),
      e("light.kitchen_all", "on", { friendly_name: "Kitchen · all", brightness: 204, entity_id: ["light.kitchen", "light.sofa", "light.ceiling"], ...CT }),
      e("light.bedroom", "unavailable", { friendly_name: "Bedroom" }),
      e("light.hall", "unknown", { friendly_name: "Hall", ...CT }),
      e("fan.air_purifier", "on", { friendly_name: "Oczyszczacz", icon: "mdi:air-purifier", model: "Demo 3000", preset_modes: ["auto", "allergen", "sleep", "manual"], preset_mode: "auto", percentage: 40, percentage_step: 20, supported_features: 57, function: "Purification & Humidification", pm25: 8, allergen_index: 2, temperature: 22, humidity: 44, target_humidity: 50, water_level: 80, pre_filter: 318, hepa_filter: 1941, carbon_filter: 1941, wick_filter: 1200, timer: 0, timer_remaining_minutes: 0, light_brightness: 75, display_light: true, child_lock: false }),
      e("sensor.air_purifier_pm2_5", "8", { friendly_name: "PM2.5", device_class: "pm25", unit_of_measurement: "µg/m³" }),
      e("sensor.air_purifier_humidity", "44", { friendly_name: "Wilgotność", device_class: "humidity", unit_of_measurement: "%" }),
      e("sensor.air_purifier_allergens", "2", { friendly_name: "Alergeny" }),
      e("fan.simple_purifier", "on", { friendly_name: "Oczyszczacz", preset_modes: ["Auto", "Silent", "Favorite"], preset_mode: "Auto", percentage: 33, percentage_step: 33.33, supported_features: 57 }),
      e("sensor.simple_purifier_pm2_5", "62", { friendly_name: "PM2.5", device_class: "pm25", unit_of_measurement: "µg/m³" }),
      e("fan.old_filter_purifier", "on", { friendly_name: "Oczyszczacz", preset_modes: ["auto", "sleep"], preset_mode: "sleep", percentage: 20, percentage_step: 25, supported_features: 57, pm25: 18, filter_life_remaining: 4, water_level: 15, humidity: 38, target_humidity: 50 }),
      e("fan.gone_purifier", "unavailable", { friendly_name: "Oczyszczacz" }),
      e("fan.purifier", "on", { friendly_name: "Purifier", icon: "mdi:air-purifier" }),
      e("input_boolean.purifier_night", "off", { friendly_name: "Night mode", icon: "mdi:weather-night" }),
      e("input_boolean.purifier_lock", "unavailable", { friendly_name: "Child lock", icon: "mdi:lock-outline" }),
      e("switch.coffee", "off", { friendly_name: "Socket · coffee", icon: "mdi:power-socket-eu" }),
      e("switch.coffee_on", "on", { friendly_name: "Socket · coffee", icon: "mdi:power-socket-eu" }),
      e("switch.kettle", "unavailable", { friendly_name: "Socket · kettle", icon: "mdi:power-socket-eu" }),
      e("sensor.gate_status", "200", { friendly_name: "Gate status" }, 2),
      e("sensor.gate_message", "no response", { friendly_name: "Gate message" }, 2),
      e("script.barrier", "off", { friendly_name: "Barrier", icon: "mdi:boom-gate-outline", last_triggered: ago(60 * 20) }),
      e("script.garage", "unavailable", { friendly_name: "Garage gate" }),
      e("person.mark", "not_home", { friendly_name: "Mark" }, 15),
      e("person.zoe", "home", { friendly_name: "Zoe" }, 20),
      e("binary_sensor.zoe_ble", "on", { friendly_name: "Zoe key fob" }, 20),
      e("person.ola", "unavailable", { friendly_name: "Ola" }),
      e("input_boolean.trash", "on", { friendly_name: "Trash" }),
      e("sensor.trash_kind", "bio tomorrow", {}),
      e("input_boolean.laundry", "on", { friendly_name: "Laundry done" }),
      e("sensor.laundry_min", "12", { unit_of_measurement: "min" }),
      e("input_boolean.window", "on", { friendly_name: "Window open" }),
      e("sensor.window_min", "25", { unit_of_measurement: "min" }),
      e("sensor.bike_battery", "18", { unit_of_measurement: "%" }),
      ...domainStates(e),
      ...(o.extra?.(e) ?? []),
    ].map((x) => [x.entity_id, x]),
  );

  const listeners = new Set<(h: HassLike) => void>();
  let gatePresses = 0;
  const set = (id: string, state: string, attributes: Record<string, unknown> = {}) => {
    const old = states[id];
    if (!old) return;
    states = { ...states, [id]: { ...old, state, attributes: { ...old.attributes, ...attributes }, last_changed: state !== old.state ? ago(0) : old.last_changed, last_updated: ago(0) } };
    const h = make();
    setTimeout(() => listeners.forEach((l) => l(h)), 300);
  };
  const make = (): HassLike => ({
    states,
    user: { id: "demo", name: "Alex", is_admin: true },
    language: lang,
    locale: { language: lang },
    themes: { darkMode: dark },
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
      const shown = pl && /^-?\d+\.\d+$/.test(x.state) ? x.state.replace(".", ",") : x.state;
      return w ? w[pl ? 1 : 0] : shown + (x.attributes.unit_of_measurement ? ` ${x.attributes.unit_of_measurement}` : "");
    },
    callService: async (domain, service, data = {}, target): Promise<undefined> => {
      // Several entities at once (the floating panel's "All" segment): one call each.
      const many = (target as { entity_id?: unknown })?.entity_id;
      if (Array.isArray(many)) {
        for (const one of many) await make().callService(domain, service, data, { entity_id: one });
        return undefined;
      }
      const id = String((target as { entity_id?: string })?.entity_id ?? "");
      if (o.service?.(ctx, domain, service, data, id)) return undefined;
      if (domainService(ctx, domain, service, data, id)) return undefined;
      if (domain === "light")
        set(id, service === "turn_off" ? "off" : "on", data.brightness_pct ? { brightness: Math.round(Number(data.brightness_pct) * 2.55) } : data.color_temp_kelvin ? { color_temp_kelvin: data.color_temp_kelvin, color_mode: "color_temp" } : data.hs_color ? { hs_color: data.hs_color, color_mode: "hs", rgb_color: undefined } : {});
      if (domain === "fan") {
        const old = states[id]?.attributes ?? {};
        const on = service === "turn_off" ? "off" : "on";
        const speed = data.percentage !== undefined ? { percentage: data.percentage, preset_mode: (old.preset_modes as string[] | undefined)?.includes("manual") ? "manual" : old.preset_mode } : {};
        set(id, on, { ...speed, ...(data.preset_mode ? { preset_mode: data.preset_mode } : {}) });
      }
      // The made-up purifier's own services: "demo_purifier.set_x" writes the attribute of the field.
      if (domain === "demo_purifier") set(id, states[id].state, Object.fromEntries(Object.entries(data).map(([k, v]) => [{ hours: "timer", level: "light_brightness", light: "display_light", lock: "child_lock", humidity: "target_humidity" }[k] ?? k, v])));
      // Gate with a response sensor: every third press fails.
      if (domain === "script" && id === "script.gate") {
        const n = (gatePresses = gatePresses + 1);
        setTimeout(() => set("sensor.gate_status", n % 3 === 0 ? "503" : "200"), 1600);
      }
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
    ...({ callApi: domainApi } as object),
    // weather/subscribe_forecast answers once with the made-up forecast.
    connection: {
      subscribeMessage: async <T>(callback: (message: T) => void, msg: { type: string; [key: string]: unknown }) => {
        if (msg.type === "weather/subscribe_forecast") setTimeout(() => callback({ forecast: forecast(String(msg.forecast_type)) } as T), 50);
        return async () => undefined;
      },
    },
    callWS: async <T>() => {
      // A day of made-up history for the sparklines.
      const hist: Record<string, { s: string; lu: number }[]> = {};
      for (const [id, base] of [["sensor.living_temp", 21], ["sensor.outside_temp", 7], ["sensor.pm25", 15], ["sensor.pm10", 24], ["sensor.air_purifier_pm2_5", 8], ["sensor.air_purifier_humidity", 44], ["sensor.air_purifier_allergens", 2], ["sensor.simple_purifier_pm2_5", 62]] as const)
        hist[id] = Array.from({ length: 48 }, (_, i) => ({ s: String(base + Math.sin(i / 5) * 2), lu: Date.now() / 1000 - (48 - i) * 1800 }));
      return hist as T;
    },
  });

  const ctx: DemoCtx = { get: (id) => states[id], set };
  listenActions(ctx, (domain, service, data, id) => domainService(ctx, domain, service, data, id));

  return {
    hass: make,
    listen: (fn) => void listeners.add(fn),
    setDark: (d) => {
      dark = d;
      const h = make();
      listeners.forEach((l) => l(h));
    },
  };
}
