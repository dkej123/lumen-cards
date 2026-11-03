// Demo data of the catalog's section 14 cards (cover, media, select, fan, number, calendar,
// nav, pop-up): fake entities, their services, the calendar API and HA's navigate / toggle actions.
import type { HassEntity } from "../src/hass/types";

type Mk = (id: string, state: string, attributes?: Record<string, unknown>, min?: number) => HassEntity;
type Spec = [type: string, cfg: Record<string, unknown>, span?: number];
export interface DemoCtx {
  get(id: string): HassEntity | undefined;
  set(id: string, state: string, attributes?: Record<string, unknown>): void;
}

const MEDIA_ALL = 1 + 2 + 4 + 8 + 16 + 32 + 128 + 256 + 4096 + 16384;
const TRACKS: [string, string, number][] = [
  ["Kind of Blue", "Miles Davis", 562],
  ["Blue Train", "John Coltrane", 643],
  ["Waltz for Debby", "Bill Evans", 419],
];

export const domainStates = (e: Mk): HassEntity[] => [
  e("cover.living_room", "open", { friendly_name: "Living room shutter", current_position: 100, supported_features: 15, device_class: "shutter" }),
  e("cover.office_blind", "closed", { friendly_name: "Office blind", current_position: 0, current_tilt_position: 50, supported_features: 255, device_class: "blind" }),
  e("cover.kitchen", "unavailable", { friendly_name: "Kitchen shutter", supported_features: 15 }),
  e("media_player.living_room", "playing", {
    friendly_name: "Living room · Sonos", media_title: TRACKS[0][0], media_artist: TRACKS[0][1], media_duration: TRACKS[0][2], media_position: 134,
    media_position_updated_at: new Date().toISOString(), volume_level: 0.4, is_volume_muted: false, supported_features: MEDIA_ALL, app_name: "Spotify",
  }),
  e("media_player.kitchen", "off", { friendly_name: "Kitchen speaker", app_name: "Spotify", supported_features: MEDIA_ALL }),
  e("input_select.vacuum_mode", "Quiet", { friendly_name: "Vacuum", icon: "mdi:robot-vacuum", options: ["Quiet", "Normal", "Strong", "Max"] }),
  e("sensor.vacuum_status", "Ready", { friendly_name: "Vacuum status" }),
  e("fan.bedroom", "on", { friendly_name: "Fan", percentage: 60, percentage_step: 1, supported_features: 1 }),
  e("input_number.humidity_threshold", "55", { friendly_name: "Humidity threshold", icon: "mdi:water-percent", min: 30, max: 80, step: 1, unit_of_measurement: "%" }),
  e("number.doorbell_volume", "3", { friendly_name: "Doorbell volume", icon: "mdi:bell-ring-outline", min: 0, max: 10, step: 1 }),
  e("calendar.home", "off", { friendly_name: "Home" }),
];

const timers = new Map<string, number>();

/** Moves a cover towards `target` like a real motor (3 % per 120 ms, the catalog's speed). */
function runCover(ctx: DemoCtx, id: string, target: number) {
  window.clearInterval(timers.get(id));
  const from = Number(ctx.get(id)?.attributes.current_position ?? 0);
  if (from === target) return;
  ctx.set(id, target > from ? "opening" : "closing");
  timers.set(
    id,
    window.setInterval(() => {
      const cur = Number(ctx.get(id)?.attributes.current_position ?? 0);
      const d = target - cur;
      if (Math.abs(d) <= 3) {
        window.clearInterval(timers.get(id));
        ctx.set(id, target === 0 ? "closed" : "open", { current_position: target });
      } else ctx.set(id, d > 0 ? "opening" : "closing", { current_position: cur + Math.sign(d) * 3 });
    }, 120),
  );
}

/** Handles the services of the section 14 domains; true when handled. */
export function domainService(ctx: DemoCtx, domain: string, service: string, data: Record<string, unknown>, id: string): boolean {
  const e = ctx.get(id);
  if (!e) return false;
  if (domain === "cover") {
    if (service === "open_cover") runCover(ctx, id, 100);
    else if (service === "close_cover") runCover(ctx, id, 0);
    else if (service === "set_cover_position") runCover(ctx, id, Number(data.position));
    else if (service === "stop_cover") {
      window.clearInterval(timers.get(id));
      const p = Number(e.attributes.current_position ?? 0);
      ctx.set(id, p === 0 ? "closed" : "open");
    } else if (service === "set_cover_tilt_position") ctx.set(id, e.state, { current_tilt_position: data.tilt_position });
    else if (service === "toggle") runCover(ctx, id, Number(e.attributes.current_position ?? 0) > 0 ? 0 : 100);
    return true;
  }
  if (domain === "media_player") {
    const pos = () => {
      const at = Date.parse(String(e.attributes.media_position_updated_at));
      return Number(e.attributes.media_position ?? 0) + (e.state === "playing" ? (Date.now() - at) / 1000 : 0);
    };
    const now = new Date().toISOString();
    const track = (d: number) => {
      const i = (TRACKS.findIndex((x) => x[0] === e.attributes.media_title) + d + TRACKS.length) % TRACKS.length;
      ctx.set(id, e.state, { media_title: TRACKS[i][0], media_artist: TRACKS[i][1], media_duration: TRACKS[i][2], media_position: 0, media_position_updated_at: now });
    };
    if (service === "media_play") ctx.set(id, "playing", { media_position_updated_at: now });
    else if (service === "media_pause" || service === "media_stop") ctx.set(id, "paused", { media_position: pos(), media_position_updated_at: now });
    else if (service === "media_next_track") track(1);
    else if (service === "media_previous_track") track(-1);
    else if (service === "volume_set") ctx.set(id, e.state, { volume_level: data.volume_level, is_volume_muted: false });
    else if (service === "volume_mute") ctx.set(id, e.state, { is_volume_muted: data.is_volume_muted });
    else if (service === "media_seek") ctx.set(id, e.state, { media_position: data.seek_position, media_position_updated_at: now });
    else if (service === "turn_on")
      ctx.set(id, "playing", { media_title: TRACKS[1][0], media_artist: TRACKS[1][1], media_duration: TRACKS[1][2], media_position: 0, media_position_updated_at: now, volume_level: 0.3 });
    else if (service === "turn_off") ctx.set(id, "off");
    return true;
  }
  if ((domain === "input_select" || domain === "select") && service === "select_option") {
    ctx.set(id, String(data.option));
    return true;
  }
  if (domain === "fan") {
    if (service === "set_percentage") ctx.set(id, Number(data.percentage) > 0 ? "on" : "off", { percentage: data.percentage });
    else if (service === "turn_off") ctx.set(id, "off", { percentage: 0 });
    else if (service === "turn_on") ctx.set(id, "on", { percentage: Number(e.attributes.percentage) || 50 });
    else if (service === "toggle") ctx.set(id, e.state === "on" ? "off" : "on", { percentage: e.state === "on" ? 0 : 60 });
    return true;
  }
  if ((domain === "input_number" || domain === "number") && service === "set_value") {
    ctx.set(id, String(data.value));
    return true;
  }
  return false;
}

/** HA REST stand-in: `calendars/<id>?start&end` with a few events from today on. */
export async function domainApi<T>(_method: string, path: string): Promise<T> {
  if (!path.startsWith("calendars/")) throw new Error(`no demo API for ${path}`);
  const day = (d: number, h = 0, m = 0) => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const date = (d: number) => {
    const x = day(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  return [
    { summary: "Bin collection · bio", start: { date: date(0) }, end: { date: date(1) } },
    { summary: "Boiler service", start: { dateTime: day(0, 23, 0).toISOString() }, end: { dateTime: day(0, 23, 50).toISOString() } },
    { summary: "Dinner at Mark's", start: { dateTime: day(1, 19, 30).toISOString() }, end: { dateTime: day(1, 19, 30).toISOString() } },
    { summary: "Window cleaner", start: { dateTime: day(3, 9, 0).toISOString() }, end: { dateTime: day(3, 11, 0).toISOString() }, location: "Flat" },
  ] as T;
}

/** HA's `hass-action` for the demo: navigate (nav card, pop-up hash) and toggle of the new domains. */
export function listenActions(ctx: DemoCtx, call: (domain: string, service: string, data: Record<string, unknown>, id: string) => void) {
  window.addEventListener("hass-action", (ev) => {
    const d = (ev as CustomEvent).detail as { config: Record<string, { action?: string; navigation_path?: string } | string | undefined>; action: string };
    const a = d.config[`${d.action}_action`] as { action?: string; navigation_path?: string } | undefined;
    const id = String(d.config.entity ?? "");
    if (a?.action === "navigate" && a.navigation_path) {
      const p = a.navigation_path;
      history.pushState(null, "", p.startsWith("#") ? location.pathname + location.search + p : p + location.search);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    } else if (a?.action === "toggle" && ctx.get(id)) call(id.split(".")[0], "toggle", {}, id);
  });
}

const NAV = (position: "inline" | "bottom") => ({
  position,
  items: [
    { navigation_path: location.pathname, name: "Home", icon: "mdi:home-variant" },
    { navigation_path: "#living-room", name: "Rooms", icon: "mdi:sofa-outline" },
    { navigation_path: "/dev/climate", name: "Climate", icon: "mdi:thermometer" },
    { navigation_path: "/dev/cameras", name: "Cameras", icon: "mdi:cctv" },
  ],
});

const POPUP = {
  hash: "#living-room",
  name: "Living room",
  icon: "mdi:sofa-outline",
  show_trigger: true,
  cards: [
    { type: "custom:lumen-light-card", entity: "light.sofa", icon: "mdi:sofa" },
    { type: "custom:lumen-light-card", entity: "light.ceiling", icon: "mdi:ceiling-light" },
    { type: "custom:lumen-cover-card", entity: "cover.living_room", show_buttons: false },
    { type: "custom:lumen-media-card", entity: "media_player.living_room", layout: "compact" },
  ],
};

export const DOMAIN_GALLERY: Record<string, Spec[]> = {
  cover: [["cover", { entity: "cover.living_room" }], ["cover", { entity: "cover.office_blind" }], ["cover", { entity: "cover.kitchen" }]],
  media: [["media", { entity: "media_player.living_room" }], ["media", { entity: "media_player.kitchen" }], ["media", { entity: "media_player.living_room", layout: "compact" }], ["media", { entity: "media_player.living_room", volume_only: true }]],
  select: [["select", { entity: "input_select.vacuum_mode", secondary_entity: "sensor.vacuum_status" }]],
  sliders: [["fan", { entity: "fan.bedroom" }, 6], ["number", { entity: "input_number.humidity_threshold" }, 6], ["number", { entity: "number.doorbell_volume" }, 6]],
  calendar: [["calendar", { entity: "calendar.home" }]],
  nav: [["nav", NAV("inline")]],
  "nav-fixed": [["nav", NAV("bottom")]],
  popup: [["popup", POPUP]],
};

/** Every section 14 card (also appended to the full gallery). */
export const DOMAINS: Spec[] = Object.entries(DOMAIN_GALLERY)
  .filter(([k]) => k !== "nav-fixed")
  .flatMap(([, v]) => v);
DOMAIN_GALLERY.domains = DOMAINS;
