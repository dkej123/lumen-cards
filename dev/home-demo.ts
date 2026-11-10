// The "Demo" tab (site/demo.html): the whole dashboard of the made-up home, on real Lumen cards, in the
// browser. There is no Home Assistant here: a small stand-in lays out the sections and answers the service
// calls. The home is always in the evening of its screenshots (see evening-clock.ts).
import "./evening-clock";
import {
  mdiBedOutline,
  mdiBicycleElectric,
  mdiBoomGateOutline,
  mdiCast,
  mdiCeilingLight,
  mdiCeilingLightMultiple,
  mdiFaucet,
  mdiFloorLamp,
  mdiGate,
  mdiHanger,
  mdiHomeHeart,
  mdiLamp,
  mdiLedStripVariant,
  mdiLightRecessed,
  mdiMeditation,
  mdiMonitor,
  mdiMovieOpen,
  mdiMovieOpenOutline,
  mdiMusic,
  mdiOutdoorLamp,
  mdiRadiator,
  mdiSoundbar,
  mdiStove,
  mdiTelevision,
  mdiTumbleDryer,
  mdiWallSconceFlat,
  mdiWarehouse,
  mdiWeatherSunset
} from "@mdi/js";
import type { HassLike } from "../src/hass/types";
import DASHBOARD from "./home-demo-dashboard.json";
import STATES from "./home-demo-states.json";
import { createDemoHome, type DemoHome } from "./mock-hass";

type Config = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Card = HTMLElement & { hass: HassLike; setConfig(c: unknown): void; getGridOptions?(): { columns?: number | string } };
type Condition = { condition: string; media_query?: string; entity?: string; state?: string; conditions?: Condition[] };

const lang = document.documentElement.lang === "pl" ? "pl" : "en";
const PARAMS = new URLSearchParams(location.search);
const tr = (en: string, pl: string) => (lang === "pl" ? pl : en);

const ICONS: Record<string, string> = {
  "mdi:bed-outline": mdiBedOutline,
  "mdi:bicycle-electric": mdiBicycleElectric,
  "mdi:boom-gate-outline": mdiBoomGateOutline,
  "mdi:cast": mdiCast,
  "mdi:ceiling-light": mdiCeilingLight,
  "mdi:ceiling-light-multiple": mdiCeilingLightMultiple,
  "mdi:faucet": mdiFaucet,
  "mdi:floor-lamp": mdiFloorLamp,
  "mdi:gate": mdiGate,
  "mdi:hanger": mdiHanger,
  "mdi:home-heart": mdiHomeHeart,
  "mdi:lamp": mdiLamp,
  "mdi:led-strip-variant": mdiLedStripVariant,
  "mdi:light-recessed": mdiLightRecessed,
  "mdi:meditation": mdiMeditation,
  "mdi:monitor": mdiMonitor,
  "mdi:movie-open": mdiMovieOpen,
  "mdi:movie-open-outline": mdiMovieOpenOutline,
  "mdi:music": mdiMusic,
  "mdi:outdoor-lamp": mdiOutdoorLamp,
  "mdi:radiator": mdiRadiator,
  "mdi:soundbar": mdiSoundbar,
  "mdi:stove": mdiStove,
  "mdi:television": mdiTelevision,
  "mdi:tumble-dryer": mdiTumbleDryer,
  "mdi:wall-sconce-flat": mdiWallSconceFlat,
  "mdi:warehouse": mdiWarehouse,
  "mdi:weather-sunset": mdiWeatherSunset,
};
customElements.define(
  "ha-icon",
  class extends HTMLElement {
    set icon(name: string) {
      this.innerHTML = `<svg viewBox="0 0 24 24" style="display:block;width:1em;height:1em;fill:currentColor"><path d="${ICONS[name] ?? ""}"/></svg>`;
    }
  },
);

const { setLanguage } = await import("../src/core/i18n");
setLanguage(lang);
await import("../src/lumen-cards");

/* The home's states were saved at the scene's time; dates move with it to this evening. */
const SAVED_AT = new Date("2026-11-03T21:30:00+01:00").getTime();
const moved = new Date().setHours(21, 30, 0, 0) - SAVED_AT;
const shift = (v: unknown) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(new Date(v).getTime() + moved).toISOString() : v);
const localStamp = (ms: number) => {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

const pct = (p: number) => Math.round(p * 2.55);
/* What each scene does: light → brightness in percent, 0 = off; anything not listed stays as it is. */
const SCENES: Record<string, Record<string, number>> = {
  movie: { wood_lamp: 18, floor_lamp: 0, ceiling_left: 0, ceiling_right: 0, table_lamp: 0, cabinets: 100, island: 0, hall_ceiling: 0 },
  evening: { wood_lamp: 88, floor_lamp: 74, cabinets: 100, island: 100, hall_ceiling: 42, balcony: 100 },
  meditation: { wood_lamp: 10, floor_lamp: 0, ceiling_left: 0, ceiling_right: 0, cabinets: 0, island: 0, hall_ceiling: 0, balcony: 0 },
  bed: { wood_lamp: 0, floor_lamp: 0, ceiling_left: 0, ceiling_right: 0, table_lamp: 0, sink: 0, stove: 0, cabinets: 0, island: 0, bath_top: 0, sconce_1: 0, sconce_2: 0, hall_ceiling: 0, wardrobe: 0, bedroom_ceiling: 0, office_ceiling: 0, monitor: 0, balcony: 0 },
};

const home: DemoHome = createDemoHome({
  lang,
  dark: true,
  extra: (e) =>
    (STATES as unknown as [string, string, Record<string, unknown>, number][]).map(([id, state, attrs, age]) => {
      // ?weather=<HA condition> and ?sun=up: other skies for checking the weather background.
      if (id === "weather.home" && PARAMS.get("weather")) return e(id, PARAMS.get("weather")!, attrs, age);
      if (id === "sun.sun" && PARAMS.get("sun") === "up") return e(id, "above_horizon", { ...attrs, elevation: 30, rising: false }, age);
      if (id === "input_datetime.barrier_last") {
        const at = new Date(state.replace(" ", "T") + "+01:00").getTime() + moved;
        return e(id, localStamp(at), { ...attrs, timestamp: at / 1000 }, age);
      }
      return e(id, shift(state) as string, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, shift(v)])), age);
    }),
  service: ({ get, set }, domain, service, _data, id) => {
    if (domain === "scene" && service === "turn_on") {
      const name = id.replace("scene.", "");
      for (const [light, p] of Object.entries(SCENES[name] ?? {})) {
        const lid = `light.${light}`;
        const a = get(lid)?.attributes ?? {};
        const dims = !(a.supported_color_modes as string[] | undefined)?.includes("onoff");
        set(lid, p ? "on" : "off", p && dims ? { brightness: pct(p), color_mode: (a.supported_color_modes as string[])[0] } : {});
      }
      set(id, new Date().toISOString());
      return true;
    }
    if (domain === "lock") {
      // The car's lock answers after a moment and reports through its busy flag.
      set("input_boolean.car_lock_busy", "on");
      setTimeout(() => {
        set(id, service === "lock" ? "locked" : "unlocked");
        set("input_boolean.car_lock_busy", "off");
      }, 1400);
      return true;
    }
    if (domain !== "script") return false;
    const script = id.replace("script.", "");
    set(id, "off", { last_triggered: new Date().toISOString() });
    if (script === "toggle_alarm_home" || script === "toggle_alarm_garage") {
      const alarm = `alarm_control_panel.${script.replace("toggle_alarm_", "")}`;
      const armed = script === "toggle_alarm_home" ? "armed_home" : "armed_away";
      if (get(alarm)?.state !== "disarmed") set(alarm, "disarmed");
      else {
        set(alarm, "arming", { next_state: armed, arming_time: 4 });
        setTimeout(() => set(alarm, armed), 4000);
      }
    } else if (script === "ac_toggle") {
      const on = get("climate.ac")?.state !== "off";
      set("climate.ac", on ? "off" : "cool", { hvac_action: on ? "off" : "cooling" });
    } else if (script.startsWith("sound_")) {
      set("media_player.soundbar", get("media_player.soundbar")?.state ?? "on", { sound_program: script.replace("sound_", "").replace("_", " ") });
    } else if (script === "gate" || script === "barrier") {
      set(`sensor.${script}_status`, "pending");
      setTimeout(() => {
        set(`sensor.${script}_status`, "200");
        set(`sensor.${script}_message`, "ok");
      }, 1200);
      if (script === "barrier") set("input_datetime.barrier_last", localStamp(Date.now()), { timestamp: Date.now() / 1000 });
    }
    return true;
  },
});

/* Home Assistant's job when a card asks for an action. */
const toast = document.getElementById("toast") as HTMLElement;
let toastTimer = 0;
const say = (text: string) => {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 3200);
};
document.addEventListener("hass-action", (ev) => {
  const { config, action } = (ev as CustomEvent<{ config: Config; action: string }>).detail;
  const a = config[`${action}_action`] as Config | undefined;
  const h = home.hass();
  if (a?.action === "perform-action") {
    const [domain, service] = String(a.perform_action).split(".");
    void h.callService(domain, service, a.data ?? {}, a.target);
  } else if (a?.action === "toggle" && config.entity) {
    void h.callService("homeassistant", h.states[config.entity]?.state === "on" ? "turn_off" : "turn_on", {}, { entity_id: config.entity });
  } else if (a?.action === "more-info") {
    say(tr("In Home Assistant this opens the device's details.", "W Home Assistant otwiera się tu okno ze szczegółami."));
  }
});
window.addEventListener("hass-more-info", () => say(tr("In Home Assistant this opens the device's details.", "W Home Assistant otwiera się tu okno ze szczegółami.")));

/* The stand-in for Home Assistant's sections view: hui-* wrappers, because Lumen looks for them to hide a floating button. */
const cards = new Set<Card>();
const gated: { el: HTMLElement; when: Condition[] }[] = [];
const holds = (c: Condition, h: HassLike): boolean => {
  if (c.condition === "screen") return matchMedia(String(c.media_query)).matches;
  if (c.condition === "state") return h.states[String(c.entity)]?.state === c.state;
  if (c.condition === "or") return (c.conditions ?? []).some((x) => holds(x, h));
  return false; // a template: the only one here says {{ false }}
};
const applyVisibility = () => {
  const h = home.hass();
  for (const g of gated) g.el.hidden = !g.when.every((c) => holds(c, h));
};

const wrapper = (tag: string, cfg: Config) => {
  const w = document.createElement(tag);
  if (cfg.visibility) gated.push({ el: w, when: cfg.visibility });
  return w;
};
const mount = (cfg: Config, inSection: boolean): HTMLElement => {
  const w = wrapper("hui-card", cfg);
  let columns: unknown = cfg.grid_options?.columns;
  if (cfg.type === "grid" || cfg.type === "vertical-stack") {
    const box = document.createElement("div");
    box.className = cfg.type === "grid" ? "in-grid" : "in-stack";
    if (cfg.type === "grid") box.style.gridTemplateColumns = `repeat(${cfg.columns ?? 2}, minmax(0, 1fr))`;
    for (const c of cfg.cards) box.append(mount(c, false));
    w.append(box);
  } else {
    const card = document.createElement(String(cfg.type).replace("custom:", "")) as Card;
    card.setConfig(cfg);
    card.hass = home.hass();
    cards.add(card);
    columns ??= card.getGridOptions?.().columns;
    w.append(card);
  }
  if (inSection) w.style.gridColumn = typeof columns === "number" ? `span min(${columns}, var(--cols))` : "1 / -1";
  return w;
};

const root = document.getElementById("dashboard") as HTMLElement;
const view = (DASHBOARD as Record<string, Config>)[lang];
const sections = view.sections as Config[];
const spans: { el: HTMLElement; span: number }[] = [];
for (const s of sections) {
  const el = wrapper("hui-section", s);
  if (s.column_span === 3) el.classList.add("whole");
  for (const c of s.cards) el.append(mount(c, true));
  root.append(el);
  spans.push({ el, span: s.column_span ?? 1 });
}
const layout = () => {
  const n = Math.max(1, Math.min(view.max_columns ?? 3, Math.floor((root.clientWidth + 32) / 352)));
  root.style.setProperty("--n", String(n));
  // A section with column_span 1.5 stays one column wide here but divides it into 18, as in Home Assistant.
  for (const { el, span } of spans) el.style.setProperty("--cols", String(12 * Math.min(span, n)));
  applyVisibility();
};
window.addEventListener("resize", layout);
layout();

home.listen((h) => {
  cards.forEach((c) => (c.hass = h));
  applyVisibility();
  // Groups follow their members, like in a real home.
  const anySconce = ["light.sconce_1", "light.sconce_2"].some((id) => h.states[id]?.state === "on");
  if ((h.states["light.sconces"]?.state === "on") !== anySconce) void h.callService("homeassistant", anySconce ? "turn_on" : "turn_off", {}, { entity_id: "light.sconces" });
  const bedroom = h.states["light.bedroom_ceiling"]?.state === "on";
  if ((h.states["light.bedroom_group"]?.state === "on") !== bedroom) void h.callService("homeassistant", bedroom ? "turn_on" : "turn_off", {}, { entity_id: "light.bedroom_group" });
});

for (const n of document.querySelectorAll<HTMLElement>("[data-pl]")) if (lang === "pl") n.textContent = n.dataset.pl ?? "";
document.documentElement.removeAttribute("data-translating");
document.title = tr("Demo: a whole dashboard · Lumen Cards", "Demo: cały dashboard · Lumen Cards");
