// @vitest-environment happy-dom
// Cover, media, select, fan, number, calendar, nav, pop-up.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ent as entity, mockHass, mount as mountCard, type Card } from "./helpers";
import { setLanguage, setLocale } from "../src/core/i18n";
import type { HassLike } from "../src/hass/types";
import { dayLabel, eventTime, eventTone, groupByDay, parseEvents, rangeQuery } from "../src/logic/calendar";
import { COVER, activeButton, coverIcon, coverPosition, coverState, tiltDegrees } from "../src/logic/cover";
import { MEDIA, formatTrackTime, mediaInfo, mediaOff, mediaPosition, snapToStep, stepsNeeded, volumeButtons, volumeIcon } from "../src/logic/media";
import { StepChaser } from "../src/core/step-chaser";
import { activeIndex, resolvePath } from "../src/logic/nav";
import { cardSpan, hashMatches, innerConfig, normalizeHash } from "../src/logic/popup";
import { fractionAt, fractionOf, numberRange, numberText, snap, stepDecimals, valueAt } from "../src/logic/slider";

const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => entity(entity_id, state, attributes, "2026-10-29T10:00:00Z");

afterEach(() => {
  setLanguage("en");
  setLocale(undefined);
});

describe("slider math", () => {
  it("fraction follows the finger and is clamped", () => {
    expect(fractionAt(150, { left: 100, width: 200 })).toBe(0.25);
    expect(fractionAt(50, { left: 100, width: 200 })).toBe(0);
    expect(fractionAt(400, { left: 100, width: 200 })).toBe(1);
    expect(fractionAt(10, { left: 0, width: 0 })).toBe(0);
  });
  it("snaps to the step without float noise", () => {
    expect(stepDecimals(0.5)).toBe(1);
    expect(stepDecimals(1)).toBe(0);
    expect(stepDecimals(1e-7)).toBe(7);
    expect(snap(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
    expect(snap(21.26, 16, 30, 0.5)).toBe(21.5);
    expect(snap(99, 0, 10, 1)).toBe(10);
    expect(valueAt(0.55, 30, 80, 1)).toBe(58);
    expect(fractionOf(55, 30, 80)).toBeCloseTo(0.5);
    expect(fractionOf(5, 5, 5)).toBe(0);
  });
  it("range defaults and value text (%, unit, „3 of 10”)", () => {
    expect(numberRange({})).toEqual({ min: 0, max: 100, step: 1 });
    expect(numberRange({ min: 5, max: 1, step: 0 })).toEqual({ min: 5, max: 6, step: 1 });
    const r = numberRange({ min: 0, max: 10, step: 1 });
    expect(numberText(55, "%", numberRange({}))).toBe("55%");
    expect(numberText(21.5, "°C", { min: 10, max: 30, step: 0.5 })).toBe("21.5 °C");
    expect(numberText(3, undefined, r)).toBe("3 of 10");
    setLanguage("pl");
    setLocale({ language: "pl" });
    expect(numberText(3, undefined, r)).toBe("3 z 10");
    expect(numberText(21.5, "°C", { min: 10, max: 30, step: 0.5 })).toBe("21,5 °C");
  });
});

describe("cover", () => {
  it("position from current_position or the end state", () => {
    expect(coverPosition(ent("cover.a", "open", { current_position: 40 }))).toBe(40);
    expect(coverPosition(ent("cover.a", "open"))).toBe(100);
    expect(coverPosition(ent("cover.a", "closed"))).toBe(0);
    expect(coverPosition(ent("cover.a", "opening"))).toBeNull();
  });
  it("states: open, partial, closed, moving, unavailable, unknown", () => {
    expect(coverState(ent("cover.a", "open", { current_position: 100 })).key).toBe("open");
    expect(coverState(ent("cover.a", "open", { current_position: 40 })).label).toBe("Partly open");
    expect(coverState(ent("cover.a", "closed")).key).toBe("closed");
    expect(coverState(ent("cover.a", "closing", { current_position: 40 }))).toMatchObject({ key: "closing", moving: true, label: "Closing…" });
    expect(coverState(ent("cover.a", "unavailable")).key).toBe("unavailable");
    expect(coverState(undefined).key).toBe("unavailable");
    expect(coverState(ent("cover.a", "unknown")).label).toBe("No data");
  });
  it("a pressed command shows the direction before HA reports it", () => {
    const e = ent("cover.a", "open", { current_position: 100 });
    expect(coverState(e, 0).key).toBe("closing");
    expect(coverState(ent("cover.a", "closed"), 100).key).toBe("opening");
    expect(coverState(e, 100).key).toBe("open");
    expect(coverState(ent("cover.a", "open", { current_position: 40 }), 70).key).toBe("opening");
  });
  it("pressed segment button: Stop while moving, else the end it rests at", () => {
    expect(activeButton(coverState(ent("cover.a", "opening")))).toBe("stop");
    expect(activeButton(coverState(ent("cover.a", "open", { current_position: 100 })))).toBe("open");
    expect(activeButton(coverState(ent("cover.a", "closed")))).toBe("close");
    expect(activeButton(coverState(ent("cover.a", "open", { current_position: 50 })))).toBeNull();
  });
  it("tilt in degrees, icons by device class", () => {
    expect(tiltDegrees(50)).toBe(45);
    const blind = ent("cover.b", "closed", { current_tilt_position: 50, supported_features: COVER.SET_TILT_POSITION });
    expect(coverIcon(blind, coverState(blind))).toBe("mdi:blinds-horizontal-closed");
    const sh = ent("cover.s", "open", { current_position: 100 });
    expect(coverIcon(sh, coverState(sh))).toBe("mdi:window-shutter-open");
    const g = ent("cover.g", "closed", { device_class: "garage" });
    expect(coverIcon(g, coverState(g))).toBe("mdi:garage");
  });
});

describe("media", () => {
  const now = Date.parse("2026-10-29T10:00:10Z");
  it("position moves on while playing, stops at the duration", () => {
    const e = ent("media_player.a", "playing", { media_position: 100, media_position_updated_at: "2026-10-29T10:00:00Z", media_duration: 105 });
    expect(mediaPosition(e, now)).toBe(105);
    expect(mediaPosition({ ...e, attributes: { ...e.attributes, media_duration: 600 } }, now)).toBe(110);
    expect(mediaPosition({ ...e, state: "paused" }, now)).toBe(100);
    expect(mediaPosition(ent("media_player.a", "playing"), now)).toBeNull();
  });
  it("track time, off states, volume glyph", () => {
    expect(formatTrackTime(134)).toBe("2:14");
    expect(formatTrackTime(3729)).toBe("1:02:09");
    expect(formatTrackTime(null)).toBe("–");
    expect(mediaOff(ent("m.a", "off"))).toBe(true);
    expect(mediaOff(ent("m.a", "standby"))).toBe(true);
    expect(mediaOff(ent("m.a", "idle"))).toBe(false);
    expect(volumeIcon(0.2, false)).toBe("mdi:volume-low");
    expect(volumeIcon(0.9, false)).toBe("mdi:volume-high");
    expect(volumeIcon(0.5, true)).toBe("mdi:volume-off");
  });
  it("title / artist with fallbacks", () => {
    expect(mediaInfo(ent("m.a", "playing", { media_title: "Kind of Blue", media_artist: "Miles Davis", entity_picture: "/api/x" }), "Sonos")).toEqual({ title: "Kind of Blue", artist: "Miles Davis", picture: "/api/x" });
    expect(mediaInfo(ent("m.a", "playing", { app_name: "Netflix" }), "TV")).toMatchObject({ title: "Netflix", artist: "" });
    expect(mediaInfo(ent("m.a", "playing", { media_title: "Ep. 1", app_name: "Netflix" }), "TV").artist).toBe("Netflix");
  });
});

describe("calendar", () => {
  const now = new Date(2026, 9, 29, 12, 0).getTime();
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, 29 + d, h, m).toISOString();
  const raw = [
    { summary: "Dinner", start: { dateTime: at(1, 19, 30) }, end: { dateTime: at(1, 19, 30) } },
    { summary: "Bins", start: { date: "2026-10-29" }, end: { date: "2026-10-30" } },
    { summary: "Boiler", start: { dateTime: at(0, 14) }, end: { dateTime: at(0, 15) } },
    { summary: "Past", start: { dateTime: at(0, 8) }, end: { dateTime: at(0, 9) } },
    { summary: "Running", start: { dateTime: at(-1, 20) }, end: { dateTime: at(0, 13) } },
    { start: "nonsense" },
  ];
  it("parses date and dateTime, drops invalid, sorts by start", () => {
    const ev = parseEvents(raw);
    expect(ev.map((e) => e.summary)).toEqual(["Running", "Bins", "Past", "Boiler", "Dinner"]);
    expect(ev.find((e) => e.summary === "Bins")).toMatchObject({ allDay: true, start: new Date(2026, 9, 29).getTime() });
    expect(parseEvents(null)).toEqual([]);
  });
  it("groups the coming events by day, running events under today, max events", () => {
    const days = groupByDay(parseEvents(raw), now, 5);
    expect(days.map((d) => d.events.map((e) => e.summary))).toEqual([["Running", "Bins", "Boiler"], ["Dinner"]]);
    expect(days[0].label).toMatch(/^Today · /);
    expect(days[1].label).toMatch(/^Tomorrow · /);
    expect(groupByDay(parseEvents(raw), now, 2).flatMap((d) => d.events).length).toBe(2);
  });
  it("labels and times", () => {
    const [bins, boiler, dinner] = ["Bins", "Boiler", "Dinner"].map((s) => parseEvents(raw).find((e) => e.summary === s)!);
    expect(eventTime(bins)).toBe("all day");
    expect(eventTime(boiler)).toBe("14:00–15:00");
    expect(eventTime(dinner)).toBe("19:30");
    setLanguage("pl");
    setLocale({ language: "pl" });
    expect(dayLabel(now, now)).toBe("Dziś · czw 29.10");
    expect(eventTime(bins)).toBe("cały dzień");
    expect(dayLabel(new Date(2026, 9, 31).getTime(), now)).toBe("sob 31.10");
  });
  it("stable colour per title, API range from midnight", () => {
    expect(eventTone("Bins")).toBe(eventTone("bins"));
    expect(["accent", "ok", "orange", "info", "warning"]).toContain(eventTone("Dentist"));
    const r = rangeQuery(now, 7);
    expect(new Date(r.start).getHours()).toBe(0);
    expect((Date.parse(r.end) - Date.parse(r.start)) / 86_400_000).toBeCloseTo(7, 0);
  });
});

describe("nav + pop-up logic", () => {
  const items = [{ navigation_path: "home" }, { navigation_path: "/lovelace/rooms" }, { navigation_path: "#salon" }, { navigation_path: "/lovelace" }];
  it("resolves relative paths against the dashboard", () => {
    expect(resolvePath("rooms", "/dashboard-dom/home")).toBe("/dashboard-dom/rooms");
    expect(resolvePath("/lovelace/rooms/", "/x")).toBe("/lovelace/rooms");
    expect(resolvePath("#a", "/x")).toBe("#a");
  });
  it("active item: exact, then the longest prefix, hash items by hash", () => {
    expect(activeIndex(items, { pathname: "/lovelace/home" })).toBe(0);
    expect(activeIndex(items, { pathname: "/lovelace/rooms/kitchen" })).toBe(1);
    expect(activeIndex(items, { pathname: "/lovelace/other" })).toBe(3);
    expect(activeIndex(items, { pathname: "/lovelace/home", hash: "#salon" })).toBe(2);
    expect(activeIndex([{ navigation_path: "/a" }], { pathname: "/b" })).toBe(-1);
  });
  it("hash normalising and matching", () => {
    expect(normalizeHash(" salon ")).toBe("#salon");
    expect(normalizeHash("##salon")).toBe("#salon");
    expect(normalizeHash(undefined)).toBe("");
    expect(hashMatches("#salon", "#salon")).toBe(true);
    expect(hashMatches("#caf%C3%A9", "#café")).toBe(true);
    expect(hashMatches("", "")).toBe(false);
    expect(hashMatches("#%E0%A4%A", "#x")).toBe(false);
  });
  it("inner cards: span from grid_options or the card, weather off for Lumen cards", () => {
    expect(cardSpan({ grid_options: { columns: 6 } }, { columns: 12 })).toBe(6);
    expect(cardSpan({}, { columns: 6 })).toBe(6);
    expect(cardSpan({}, { columns: "full" })).toBe(12);
    expect(cardSpan(undefined, undefined)).toBe(12);
    expect(innerConfig({ type: "custom:lumen-light-card" })).toEqual({ type: "custom:lumen-light-card", weather_effects: false });
    expect(innerConfig({ type: "custom:lumen-light-card", weather_effects: true }).weather_effects).toBe(true);
    expect(innerConfig({ type: "tile" })).toEqual({ type: "tile" });
  });
});

// ------------------------------------------------------------------ cards

type Entry = { type: string; getEntitySuggestion?(h: HassLike, id: string): { config: Record<string, unknown> }[] | null };

const STATES = [
  ent("cover.shutter", "open", { current_position: 100, supported_features: 15 }),
  ent("cover.blind", "closed", { current_position: 0, current_tilt_position: 50, supported_features: 255 }),
  ent("cover.off", "unavailable", { supported_features: 15 }),
  ent("fan.f", "on", { percentage: 60, percentage_step: 10, supported_features: 1 }),
  ent("input_number.n", "55", { min: 30, max: 80, step: 1, unit_of_measurement: "%" }),
  ent("number.v", "3", { min: 0, max: 10, step: 1 }),
  ent("input_select.s", "Quiet", { options: ["Quiet", "Normal", "Strong"] }),
  ent("media_player.m", "playing", { media_title: "Kind of Blue", media_artist: "Miles Davis", volume_level: 0.4, supported_features: MEDIA.PAUSE | MEDIA.VOLUME_SET | MEDIA.NEXT_TRACK | MEDIA.PLAY }),
  ent("calendar.c", "off"),
];

const mkHass = (api?: (path: string) => unknown) => mockHass(STATES, { api, locale: { time_format: "24" } });

const mount = async (type: string, cfg: Record<string, unknown>, h = mkHass()) => {
  const el = await mountCard(type, cfg, h);
  return { el, h, root: el.shadowRoot! };
};

const press = (el: Element, key: string, extra: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...extra }));

beforeAll(async () => {
  await import("../src/lumen-cards");
});

describe("section 14 cards", () => {
  it("are in the picker and suggested for their domains", () => {
    const entries = (window as unknown as { customCards: Entry[] }).customCards;
    const h = mkHass();
    const sug = (type: string, id: string) => entries.find((e) => e.type === type)!.getEntitySuggestion?.(h, id)?.[0].config;
    expect(sug("lumen-cover-card", "cover.shutter")).toMatchObject({ entity: "cover.shutter" });
    expect(sug("lumen-media-card", "media_player.m")).toMatchObject({ entity: "media_player.m" });
    expect(sug("lumen-select-card", "input_select.s")).toMatchObject({ entity: "input_select.s" });
    expect(sug("lumen-fan-card", "fan.f")).toMatchObject({ entity: "fan.f" });
    expect(sug("lumen-number-card", "number.v")).toMatchObject({ entity: "number.v" });
    expect(sug("lumen-calendar-card", "calendar.c")).toMatchObject({ entity: "calendar.c" });
    for (const t of ["lumen-nav-card", "lumen-popup-card"]) expect(entries.some((e) => e.type === t)).toBe(true);
  });

  it("cover: state, buttons call the services, tilt bar only with tilt", async () => {
    const { el, h, root } = await mount("cover", { entity: "cover.shutter", layout: "wide" });
    expect(root.textContent).toContain("Open");
    expect(root.textContent).toContain("100%");
    const btns = [...root.querySelectorAll<HTMLButtonElement>("button")];
    expect(btns.map((b) => b.textContent!.trim())).toEqual(["Open", "Stop", "Close"]);
    expect(btns[0].getAttribute("aria-pressed")).toBe("true");
    btns[2].click();
    await el.updateComplete;
    expect(h.calls.at(-1)).toEqual(["cover", "close_cover", {}, { entity_id: "cover.shutter" }]);
    expect(root.textContent).toContain("Closing…");
    expect(root.querySelector('.ltile [role="slider"]')).toBeNull();
    el.remove();
    const blind = await mount("cover", { entity: "cover.blind", layout: "wide" });
    expect(blind.root.textContent).toContain("slats 45°");
    press(blind.root.querySelector('.ltile [role="slider"]')!, "ArrowRight");
    expect(blind.h.calls.at(-1)).toEqual(["cover", "set_cover_tilt_position", { tilt_position: 60 }, { entity_id: "cover.blind" }]);
    blind.el.remove();
    const off = await mount("cover", { entity: "cover.off", layout: "wide" });
    expect(off.root.querySelectorAll("button").length).toBe(0);
    expect(off.root.textContent).toContain("Unavailable");
    off.el.remove();
  });

  it("cover: arrow keys move the position, compact hides the buttons", async () => {
    const { el, h, root } = await mount("cover", { entity: "cover.shutter", layout: "compact" });
    expect(root.querySelectorAll("button").length).toBe(0);
    press(root.querySelector(".ltile")!, "ArrowLeft");
    expect(h.calls.at(-1)).toEqual(["cover", "set_cover_position", { position: 90 }, { entity_id: "cover.shutter" }]);
    el.remove();
  });

  it("fan: tap is HA's toggle, arrows step the speed by the fan's step", async () => {
    const { el, h, root } = await mount("fan", { entity: "fan.f" });
    const tile = root.querySelector(".ltile")!;
    // A settable fan is a slider: its value says whether it runs.
    expect(tile.getAttribute("role")).toBe("slider");
    expect(root.textContent).toContain("60%");
    const fired: unknown[] = [];
    el.addEventListener("hass-action", (e) => fired.push((e as CustomEvent).detail));
    press(tile, "Enter");
    expect(fired).toEqual([{ config: { entity: "fan.f", tap_action: { action: "toggle" } }, action: "tap" }]);
    press(tile, "ArrowRight");
    expect(h.calls.at(-1)).toEqual(["fan", "set_percentage", { percentage: 70 }, { entity_id: "fan.f" }]);
    el.remove();
  });

  it("number: value text and steps on its own scale", async () => {
    const a = await mount("number", { entity: "number.v" });
    expect(a.root.textContent).toContain("3 of 10");
    press(a.root.querySelector(".ltile")!, "ArrowRight");
    expect(a.h.calls.at(-1)).toEqual(["number", "set_value", { value: 4 }, { entity_id: "number.v" }]);
    a.el.remove();
    const b = await mount("number", { entity: "input_number.n" });
    expect(b.root.textContent).toContain("55%");
    press(b.root.querySelector(".ltile")!, "ArrowLeft");
    expect(b.h.calls.at(-1)).toEqual(["input_number", "set_value", { value: 54 }, { entity_id: "input_number.n" }]);
    b.el.remove();
  });

  it("select: the list opens in the layer and a choice calls select_option", async () => {
    const { el, h, root } = await mount("select", { entity: "input_select.s" });
    const pick = root.querySelector<HTMLButtonElement>(".pick")!;
    expect(pick.textContent).toContain("Quiet");
    pick.click();
    await el.updateComplete;
    const layer = document.querySelector("lumen-cards-layer")!.shadowRoot!;
    const opts = [...layer.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(opts.map((o) => o.textContent!.trim())).toEqual(["Quiet", "Normal", "Strong"]);
    expect(opts[0].getAttribute("aria-selected")).toBe("true");
    opts[2].click();
    await el.updateComplete;
    expect(h.calls.at(-1)).toEqual(["input_select", "select_option", { option: "Strong" }, { entity_id: "input_select.s" }]);
    expect(document.querySelector("lumen-cards-layer")).toBeNull();
    expect(root.querySelector(".pick")!.textContent).toContain("Strong");
    el.remove();
  });

  it("media: play/pause and next call the player", async () => {
    const { el, h, root } = await mount("media", { entity: "media_player.m", layout: "wide" });
    expect(root.textContent).toContain("Kind of Blue");
    root.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')!.click();
    expect(h.calls.at(-1)).toEqual(["media_player", "media_pause", {}, { entity_id: "media_player.m" }]);
    root.querySelector<HTMLButtonElement>('button[aria-label="Next"]')!.click();
    expect(h.calls.at(-1)).toEqual(["media_player", "media_next_track", {}, { entity_id: "media_player.m" }]);
    expect(root.querySelector<HTMLButtonElement>('button[aria-label="Previous"]')!.disabled).toBe(true);
    el.remove();
  });

  it("calendar: asks HA's calendar API and lists the events", async () => {
    // Tomorrow: an event earlier today is hidden once it has ended, so "today" fails late in the evening.
    const today = new Date();
    today.setDate(today.getDate() + 1);
    today.setHours(23, 30, 0, 0);
    const h = mkHass(() => [{ summary: "Boiler service", start: { dateTime: today.toISOString() }, end: { dateTime: new Date(today.getTime() + 600_000).toISOString() } }]);
    const { el, root } = await mount("calendar", { entity: "calendar.c" }, h);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(h.api[0]).toMatch(/^calendars\/calendar\.c\?start=.*&end=/);
    expect(root.textContent).toContain("Boiler service");
    expect(root.textContent).toContain("23:30–23:40");
    el.remove();
  });

  it("calendar: an empty list reads right for one day and for several", async () => {
    const empty = async (days: number) => {
      const { el, root } = await mount("calendar", { entity: "calendar.c", days }, mkHass(() => []));
      await new Promise((r) => setTimeout(r, 0));
      await el.updateComplete;
      const text = root.textContent;
      el.remove();
      return text;
    };
    expect(await empty(1)).toContain("No events in the next day");
    expect(await empty(5)).toContain("No events in the next 5 days");
  });

  it("nav: the current view is active, a tap navigates through HA", async () => {
    const { el, root } = await mount("nav", { position: "inline", items: [{ navigation_path: location.pathname, name: "Home", icon: "mdi:home" }, { navigation_path: "/rooms", name: "Rooms" }] });
    const links = [...root.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links[0].getAttribute("aria-current")).toBe("page");
    expect(links[1].getAttribute("aria-current")).toBeNull();
    const fired: unknown[] = [];
    el.addEventListener("hass-action", (e) => fired.push((e as CustomEvent).detail));
    links[1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    expect(fired).toEqual([{ config: { entity: undefined, tap_action: { action: "navigate", navigation_path: "/rooms" } }, action: "tap" }]);
    el.remove();
  });

  it("pop-up: opens on its #hash with the cards inside, close drops the hash", async () => {
    history.replaceState(null, "", "/lovelace/home");
    const { el } = await mount("popup", { hash: "salon", name: "Living room", cards: [{ type: "custom:lumen-fan-card", entity: "fan.f" }] });
    expect(el.shadowRoot!.textContent!.trim()).toBe("");
    history.pushState(null, "", "/lovelace/home#salon");
    window.dispatchEvent(new CustomEvent("location-changed"));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const layer = document.querySelector("lumen-cards-layer")!.shadowRoot!;
    expect(layer.querySelector('[role="dialog"]')!.getAttribute("aria-label")).toBe("Living room");
    const fan = layer.querySelector("lumen-fan-card") as Card;
    expect(fan).toBeTruthy();
    expect(fan.hass).toBeTruthy();
    (el as unknown as { close(): void }).close();
    expect(location.hash).toBe("");
    await new Promise((r) => setTimeout(r, 300));
    await el.updateComplete;
    expect(document.querySelector("lumen-cards-layer")).toBeNull();
    el.remove();
  });
});

describe("media volume_only", () => {
  const ALL = MEDIA.VOLUME_SET | MEDIA.VOLUME_MUTE | MEDIA.PLAY | MEDIA.PAUSE | MEDIA.PREVIOUS_TRACK | MEDIA.NEXT_TRACK;
  const player = (state = "playing", extra: Record<string, unknown> = {}) =>
    entity("media_player.sb", state, { friendly_name: "Soundbar", volume_level: 0.2, is_volume_muted: false, supported_features: ALL, media_title: "Song", ...extra });
  const open = async (e = player()) => {
    const h = mockHass({ "media_player.sb": e });
    const el = await mountCard("media", { entity: "media_player.sb", volume_only: true }, h);
    return { h, el, root: el.shadowRoot! };
  };
  const labels = (root: ShadowRoot) => [...root.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));

  it("is a slider with the level, without artwork or track title", async () => {
    const { root } = await open();
    expect(root.textContent).toContain("20%");
    expect(root.textContent).not.toContain("Song");
    const s = root.querySelector('[role="slider"]')!;
    expect(s.getAttribute("aria-valuenow")).toBe("20");
    expect(s.getAttribute("aria-valuetext")).toBe("20%");
    expect(labels(root)).toEqual(["Previous", "Pause", "Next", "Mute"]);
  });

  it("says muted to a screen reader", async () => {
    const { root } = await open(player("playing", { is_volume_muted: true }));
    expect(root.querySelector('[role="slider"]')!.getAttribute("aria-valuetext")).toBe("Muted, 20%");
    expect(labels(root)).toContain("Unmute");
  });

  it("buttons call their services", async () => {
    const { h, root } = await open();
    root.querySelectorAll("button").forEach((b) => b.click());
    const services = h.calls.map((c) => c[1]);
    expect(services).toEqual(["media_previous_track", "media_pause", "media_next_track", "volume_mute"]);
  });

  it("Home, End and Page keys set the volume", async () => {
    const { h, root } = await open();
    const s = root.querySelector<HTMLElement>('[role="slider"]')!;
    for (const key of ["End", "Home", "PageUp"]) s.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    expect(h.calls.map((c) => (c[2] as { volume_level: number }).volume_level)).toEqual([1, 0, 0.1]);
  });

  it("no buttons, slider or percentage when the player is off", async () => {
    const { root } = await open(player("off"));
    expect(root.querySelector("button")).toBeNull();
    expect(root.querySelector('[role="slider"]')).toBeNull();
    expect(root.textContent).not.toContain("%");
  });

  it.each([
    [0, ["previous", "play", "next", "mute"]],
    [320, ["previous", "play", "next", "mute"]],
    [319, ["play", "mute"]],
    [200, ["play", "mute"]],
    [199, ["play"]],
  ])("width %d shows %j", (width, shown) => {
    const b = volumeButtons(player(), width);
    expect(["previous", "play", "next", "mute"].filter((k) => b[k as "play"])).toEqual(shown);
  });

  it("show_playback: false leaves only mute", async () => {
    const el = await mountCard("media", { entity: "media_player.sb", volume_only: true, show_playback: false }, mockHass({ "media_player.sb": player() }));
    expect(labels(el.shadowRoot!)).toEqual(["Mute"]);
  });

  it("hides what the player cannot do and dims skipping while idle", () => {
    const b = volumeButtons(player("playing", { supported_features: MEDIA.VOLUME_SET }), 400);
    expect([b.previous, b.play, b.next, b.mute]).toEqual([false, false, false, false]);
    expect(volumeButtons(player("idle"), 400).skipDimmed).toBe(true);
    expect(volumeButtons(player("paused"), 400).skipDimmed).toBe(false);
  });

  const drag = (el: Card, ...xs: number[]) => {
    const tile = el.shadowRoot!.querySelector<HTMLElement>('[role="slider"]')!;
    tile.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 50, right: 100, bottom: 50, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const ev = (type: string, clientX: number) => tile.dispatchEvent(new PointerEvent(type, { clientX, clientY: 10, button: 0, bubbles: true, pointerId: 1 }));
    ev("pointerdown", xs[0]);
    xs.slice(1).forEach((x) => ev("pointermove", x));
    return (x: number) => ev("pointerup", x);
  };

  it("a player with a level follows the finger, spaced, and the release sets the final value", async () => {
    const { h, el } = await open();
    const release = drag(el, 20, 40, 41, 42);
    const during = h.calls.filter((c) => c[1] === "volume_set").length;
    expect(during).toBe(1);
    release(42);
    expect(h.calls.at(-1)![2]).toEqual({ volume_level: 0.42 });
  });

  describe("volume keys only", () => {
    const keysOnly = () => player("playing", { supported_features: MEDIA.VOLUME_STEP | MEDIA.VOLUME_MUTE, volume_level: 0.36 });

    it("sends a step while dragging, before the release", async () => {
      const { h, el } = await open(keysOnly());
      drag(el, 20, 60);
      await Promise.resolve();
      expect(h.calls.map((c) => c[1])).toEqual(["volume_up"]);
    });

    it("the tile jumps between levels while dragging", async () => {
      const { el, root } = await open(keysOnly());
      drag(el, 20, 37);
      await el.updateComplete;
      expect(root.querySelector('[role="slider"]')!.getAttribute("aria-valuenow")).toBe("36");
      expect(root.textContent).toContain("36%");
      drag(el, 20, 39);
      await el.updateComplete;
      expect(root.querySelector('[role="slider"]')!.getAttribute("aria-valuenow")).toBe("40");
    });

    it("reaches the target one key at a time and stops", async () => {
      const sent: number[] = [];
      const level = 0.36;
      const host = { addController() {}, requestUpdate() {} } as never;
      const c = new StepChaser(host, async (d) => void sent.push(d), () => level, () => 0.04, 0);
      c.to(0.5);
      await vi.waitFor(() => expect(c.pending).toBeNull());
      expect(sent).toEqual([1, 1, 1, 1]);
      c.to(0.44);
      await vi.waitFor(() => expect(c.pending).toBeNull());
      expect(sent.slice(4)).toEqual([-1, -1]);
    });

    it("with a remote a long jump is one command with every key", async () => {
      const h = mockHass({ "media_player.sb": keysOnly() });
      const el = await mountCard("media", { entity: "media_player.sb", volume_only: true, volume_remote: "remote.tv" }, h);
      drag(el, 20, 96);
      await Promise.resolve();
      expect(h.calls.length).toBe(1);
      expect(h.calls[0].slice(0, 3)).toEqual(["remote", "send_command", { command: "VOLUME_UP", num_repeats: 15, delay_secs: 0 }]);
      expect(h.calls[0][3]).toEqual({ entity_id: "remote.tv" });
    });

    it("a new target redirects it instead of queueing", async () => {
      const sent: number[] = [];
      const host = { addController() {}, requestUpdate() {} } as never;
      const c = new StepChaser(host, async (d) => void sent.push(d), () => 0.5, () => 0.04, 0);
      c.to(1);
      c.to(0.5);
      await vi.waitFor(() => expect(c.pending).toBeNull());
      expect(sent.reduce((a, b) => a + b, 0)).toBe(0);
    });
  });

  it("snapToStep lands on the nearest level", () => {
    expect(snapToStep(0.37, 0.04)).toBe(0.36);
    expect(snapToStep(0.39, 0.04)).toBe(0.4);
    expect(snapToStep(1, 0.04)).toBe(1);
    expect(snapToStep(0, 0.04)).toBe(0);
  });

  it("stepsNeeded stops within half a step", () => {
    expect(stepsNeeded(0.36, 0.4, 0.04)).toBe(1);
    expect(stepsNeeded(0.36, 0.32, 0.04)).toBe(-1);
    expect(stepsNeeded(0.36, 0.37, 0.04)).toBe(0);
  });
});

describe("a refused slider command rolls back at once", () => {
  const wait = () => new Promise((r) => setTimeout(r, 0));
  /** A drag to `x` % of an element 100 px wide. */
  const drag = async (el: Card, target: HTMLElement, x: number) => {
    target.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
    const ev = (type: string, clientX: number) => target.dispatchEvent(new PointerEvent(type, { button: 0, clientX, clientY: 0, pointerId: 1, bubbles: true, composed: true }));
    ev("pointerdown", 50);
    ev("pointermove", x);
    ev("pointerup", x);
    await el.updateComplete;
  };
  const tile = (el: Card) => el.shadowRoot!.querySelector<HTMLElement>(".ltile")!;
  const text = (el: Card) => tile(el).textContent!.replace(/\s+/g, " ");

  const cases: [string, Record<string, unknown>, ReturnType<typeof ent>, string, string][] = [
    ["number", { entity: "input_number.n" }, ent("input_number.n", "10", { min: 0, max: 100, step: 1 }), "80 of 100", "10 of 100"],
    ["fan", { entity: "fan.f" }, ent("fan.f", "on", { percentage: 10, supported_features: 1 }), "80%", "10%"],
    ["cover", { entity: "cover.c", show_buttons: false }, ent("cover.c", "open", { current_position: 10, supported_features: 15 }), "80%", "10%"],
  ];
  for (const [type, config, state, sent, back] of cases) {
    it(`${type}: the old value is back after the error, and stays the new one when accepted`, async () => {
      const h = mockHass([state]);
      h.fail = () => true;
      const el = await mountCard(type, config, h);
      await drag(el, tile(el), 80);
      expect(h.calls.length).toBe(1);
      await wait();
      await el.updateComplete;
      expect(text(el)).toContain(back);
      expect(text(el)).not.toContain(sent);

      h.fail = () => false;
      await drag(el, tile(el), 80);
      await wait();
      await el.updateComplete;
      expect(text(el)).toContain(sent);
      el.remove();
    });
  }

  it("cover: the slat bar rolls back too", async () => {
    const h = mockHass([ent("cover.c", "open", { current_position: 50, current_tilt_position: 20, supported_features: 15 | 128 })]);
    h.fail = () => true;
    const el = await mountCard("cover", { entity: "cover.c", show_buttons: false }, h);
    const bar = el.shadowRoot!.querySelector<HTMLElement>('.ltile [role="slider"]')!;
    await drag(el, bar, 80);
    await wait();
    await el.updateComplete;
    expect(bar.getAttribute("aria-valuenow")).toBe("20");
    el.remove();
  });

  it("media: the volume bar and the volume_only tile roll back", async () => {
    const player = ent("media_player.m", "playing", { supported_features: 4 | 8, volume_level: 0.1 });
    const h = mockHass([player]);
    h.fail = () => true;
    const el = await mountCard("media", { entity: "media_player.m", layout: "wide" }, h);
    const vol = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="slider"]')].find((s) => s.getAttribute("aria-label") === "Volume")!;
    await drag(el, vol, 80);
    await wait();
    await el.updateComplete;
    expect(vol.getAttribute("aria-valuenow")).toBe("10");
    el.remove();

    const only = await mountCard("media", { entity: "media_player.m", volume_only: true }, h);
    await drag(only, tile(only), 80);
    await wait();
    await only.updateComplete;
    expect(tile(only).getAttribute("aria-valuenow")).toBe("10");
    only.remove();
  });

  it("media: volume keys sent through a remote roll back too", async () => {
    const h = mockHass([ent("media_player.m", "playing", { supported_features: 1024, volume_level: 0.12 })]);
    h.fail = () => true;
    const el = await mountCard("media", { entity: "media_player.m", volume_only: true, volume_remote: "remote.tv" }, h);
    await drag(el, tile(el), 80);
    await new Promise((r) => setTimeout(r, 200));
    await el.updateComplete;
    expect(h.calls.at(-1)?.[0]).toBe("remote");
    expect(tile(el).getAttribute("aria-valuenow")).toBe("12");
    el.remove();
  });
});

describe("unknown: No data, and the actions stay", () => {
  const text = (el: Card) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");

  it("media says No data, not Off, in every look", async () => {
    const h = mockHass([ent("media_player.m", "unknown", { supported_features: 4 })]);
    for (const cfg of [{ layout: "wide" }, { layout: "compact" }, { volume_only: true }]) {
      const el = await mountCard("media", { entity: "media_player.m", ...cfg }, h);
      expect(text(el), JSON.stringify(cfg)).toContain("No data");
      expect(text(el), JSON.stringify(cfg)).not.toContain("Off");
      el.remove();
    }
  });

  it("climate says No data, not Unavailable, and its mode buttons still work", async () => {
    const h = mockHass([ent("climate.c", "unknown", { hvac_modes: ["heat", "off"] })]);
    for (const layout of ["wide", "compact"]) {
      const el = await mountCard("climate", { entity: "climate.c", layout }, h);
      expect(text(el), layout).toContain("No data");
      expect(text(el), layout).not.toContain("Unavailable");
      el.remove();
    }
    const el = await mountCard("climate", { entity: "climate.c", layout: "wide" }, h);
    [...el.shadowRoot!.querySelectorAll("button")].find((b) => b.textContent!.includes("Heat"))!.click();
    expect(h.calls.at(-1)).toEqual(["climate", "set_hvac_mode", { hvac_mode: "heat" }, { entity_id: "climate.c" }]);
    el.remove();
  });

  it("a sensor says No data in a solid frame; unavailable stays dashed with a dash", async () => {
    const h = mockHass([ent("sensor.u", "unknown"), ent("sensor.o", "unavailable")]);
    for (const layout of ["wide", "compact"]) {
      const u = await mountCard("sensor", { entity: "sensor.u", layout }, h);
      expect(text(u)).toContain("No data");
      expect(u.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!.getAttribute("style")).not.toContain("dashed");
      const o = await mountCard("sensor", { entity: "sensor.o", layout }, h);
      expect(text(o)).toContain("—");
      expect(o.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!.getAttribute("style")).toContain("dashed");
      u.remove();
      o.remove();
    }
  });

  it("a fan keeps its tap; an unavailable one does not", async () => {
    const h = mockHass([ent("fan.u", "unknown"), ent("fan.o", "unavailable")]);
    const taps = async (entity: string) => {
      const el = await mountCard("fan", { entity }, h);
      const fired: unknown[] = [];
      el.addEventListener("hass-action", (e) => fired.push(e));
      el.shadowRoot!.querySelector<HTMLElement>(".ltile")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      el.remove();
      return fired.length;
    };
    expect(await taps("fan.u")).toBe(1);
    expect(await taps("fan.o")).toBe(0);
  });

  it("a select opens its list so an option can be chosen", async () => {
    const h = mockHass([ent("input_select.s", "unknown", { options: ["a", "b"] })]);
    const el = await mountCard("select", { entity: "input_select.s" }, h);
    el.shadowRoot!.querySelector<HTMLElement>(".pick")!.click();
    await el.updateComplete;
    expect((el as unknown as { _menu: unknown })._menu).toBeTruthy();
    el.remove();
  });

  it("the cover's icon and value use the muted tone", async () => {
    const el = await mountCard("cover", { entity: "cover.u" }, mockHass([ent("cover.u", "unknown", { supported_features: 15 })]));
    expect(el.shadowRoot!.querySelector(".ltile")!.innerHTML).toContain("var(--lumen-text-3)");
    expect(text(el)).toContain("No data");
    el.remove();
  });
});

describe("sensor value: Home Assistant's own formatting", () => {
  const ha = (out: string) => ({ formatEntityState: () => out }) as never;

  it("uses HA's text when it has one (precision, locale, unit)", async () => {
    const { sensorValue } = await import("../src/cards/sensor");
    expect(sensorValue(ent("sensor.p", "1500.04", { unit_of_measurement: "W" }), ha("1,500 W"))).toBe("1,500 W");
    expect(sensorValue(ent("sensor.h", "55", { unit_of_measurement: "%" }), ha("55%"))).toBe("55%");
  });

  it("keeps the card's own temperature style on HA's number", async () => {
    const { sensorValue } = await import("../src/cards/sensor");
    expect(sensorValue(ent("sensor.t", "21.46", { unit_of_measurement: "°C", device_class: "temperature" }), ha("21,5 °C"))).toBe("21,5°");
    expect(sensorValue(ent("sensor.t", "21", { unit_of_measurement: "°C" }), ha("21 °C"))).toBe("21°");
    expect(sensorValue(ent("sensor.t", "unknown", { unit_of_measurement: "°C" }), ha("Unknown"))).toBe("—");
  });

  it("a rough formatter that drops the unit (the demo's mock) still shows it", async () => {
    const { sensorValue } = await import("../src/cards/sensor");
    const rough = { formatEntityState: (e: { state: string }) => e.state } as never;
    expect(sensorValue(ent("sensor.p", "1500", { unit_of_measurement: "W" }), rough)).toBe("1500 W");
    expect(sensorValue(ent("sensor.n", "3"), rough)).toBe("3");
    expect(sensorValue(ent("sensor.t", "21.5", { unit_of_measurement: "°C" }), rough)).toBe("21.5°");
  });

  it("without a formatter the number keeps its own decimals", async () => {
    const { sensorValue } = await import("../src/cards/sensor");
    expect(sensorValue(ent("sensor.p", "1500", { unit_of_measurement: "W" }))).toBe("1500 W");
    expect(sensorValue(ent("sensor.k", "0.123", { unit_of_measurement: "kWh" }))).toBe("0.123 kWh");
    expect(sensorValue(ent("sensor.t", "21", { unit_of_measurement: "°C" }))).toBe("21°");
    expect(sensorValue(ent("sensor.t", "21.5", { unit_of_measurement: "°C" }))).toBe("21.5°");
  });

  it("wide, compact and the accessible name read the same", async () => {
    const h = mockHass([ent("sensor.p", "1500", { unit_of_measurement: "W" })]);
    h.formatEntityState = () => "1.5 kW";
    for (const layout of ["wide", "compact"]) {
      const el = await mountCard("sensor", { entity: "sensor.p", layout }, h);
      const tile = el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!;
      expect(tile.textContent).toContain("1.5 kW");
      expect(tile.getAttribute("aria-label")).toContain("1.5 kW");
      el.remove();
    }
  });
});

describe("slider tiles for the keyboard and screen readers", () => {
  const tile = (el: Card) => el.shadowRoot!.querySelector<HTMLElement>(".ltile")!;

  it("no card takes the focus ring away; sliders get one too", async () => {
    const { shared } = await import("../src/core/styles");
    expect(shared).toMatch(/\[role="slider"\]:focus-visible[^{]*\{ outline: 2px/);
    const h = mockHass([ent("fan.f", "on", { percentage: 40, supported_features: 1 }), ent("light.l", "on", { brightness: 100 })]);
    const fan = await mountCard("fan", { entity: "fan.f" }, h);
    expect(tile(fan).getAttribute("style")).not.toContain("outline:none");
    const light = await mountCard("light", { entity: "light.l" }, h);
    expect(light.shadowRoot!.querySelector<HTMLElement>(".tile")!.getAttribute("style")).not.toContain("outline:none");
    fan.remove();
    light.remove();
  });

  it("a settable tile is a slider with its value; one that cannot be set stays a button", async () => {
    const h = mockHass([
      ent("fan.f", "on", { percentage: 40, supported_features: 1 }),
      ent("fan.g", "on", { supported_features: 0 }),
      ent("input_number.n", "25", { min: 0, max: 50, step: 1 }),
      ent("input_number.o", "unavailable"),
      ent("cover.c", "open", { current_position: 30, supported_features: 15 }),
      ent("cover.d", "open", { supported_features: 3 }),
    ]);
    const check = async (type: string, entity: string, role: string, now?: string) => {
      const el = await mountCard(type, { entity }, h);
      expect(tile(el).getAttribute("role"), entity).toBe(role);
      expect(tile(el).getAttribute("aria-valuenow") ?? undefined, entity).toBe(now);
      if (role === "slider") expect(tile(el).hasAttribute("aria-pressed")).toBe(false);
      el.remove();
    };
    await check("fan", "fan.f", "slider", "40");
    await check("fan", "fan.g", "button");
    await check("number", "input_number.n", "slider", "50");
    await check("number", "input_number.o", "button");
    await check("cover", "cover.c", "slider", "30");
    await check("cover", "cover.d", "button");
  });

  it("Home and End go to the ends", async () => {
    const h = mockHass([ent("input_number.n", "25", { min: 10, max: 50, step: 1 }), ent("fan.f", "on", { percentage: 40, supported_features: 1 }), ent("cover.c", "open", { current_position: 30, supported_features: 15 })]);
    const key = (el: Card, k: string) => tile(el).dispatchEvent(new KeyboardEvent("keydown", { key: k }));
    const n = await mountCard("number", { entity: "input_number.n" }, h);
    key(n, "End");
    expect(h.calls.at(-1)).toEqual(["input_number", "set_value", { value: 50 }, { entity_id: "input_number.n" }]);
    key(n, "Home");
    expect(h.calls.at(-1)).toEqual(["input_number", "set_value", { value: 10 }, { entity_id: "input_number.n" }]);
    const f = await mountCard("fan", { entity: "fan.f" }, h);
    key(f, "End");
    expect(h.calls.at(-1)).toEqual(["fan", "set_percentage", { percentage: 100 }, { entity_id: "fan.f" }]);
    const c = await mountCard("cover", { entity: "cover.c" }, h);
    key(c, "Home");
    expect(h.calls.at(-1)).toEqual(["cover", "set_cover_position", { position: 0 }, { entity_id: "cover.c" }]);
    [n, f, c].forEach((x) => x.remove());
  });
});

describe("keyboard steps", () => {
  const tile = (el: Card) => el.shadowRoot!.querySelector<HTMLElement>(".ltile")!;
  const key = (el: HTMLElement, k: string, o: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, ...o }));

  it("two quick presses add up before HA answers, and the tile shows it", async () => {
    const h = mockHass([ent("input_number.n", "10", { min: 0, max: 100, step: 1 }), ent("fan.f", "on", { percentage: 10, supported_features: 1 }), ent("cover.c", "open", { current_position: 20, current_tilt_position: 20, supported_features: 15 | 128 }), ent("media_player.m", "playing", { supported_features: 4, volume_level: 0.1 })]);
    const twice = async (type: string, config: Record<string, unknown>, target: (el: Card) => HTMLElement) => {
      const el = await mountCard(type, config, h);
      key(target(el), "ArrowRight");
      await el.updateComplete;
      key(target(el), "ArrowRight");
      await el.updateComplete;
      const out = h.calls.slice(-2).map((c) => Object.values(c[2] as object)[0]);
      const text = el.shadowRoot!.textContent!.replace(/\s+/g, " ");
      const now = target(el).getAttribute("aria-valuenow");
      el.remove();
      return { out, text, now };
    };
    const n = await twice("number", { entity: "input_number.n" }, tile);
    expect(n.out).toEqual([11, 12]);
    expect(n.text).toContain("12 of 100");
    const f = await twice("fan", { entity: "fan.f" }, tile);
    expect(f.out).toEqual([20, 30]);
    expect(f.text).toContain("30%");
    const c = await twice("cover", { entity: "cover.c", show_buttons: false }, tile);
    expect(c.out).toEqual([30, 40]);
    const t = await twice("cover", { entity: "cover.c", show_buttons: false }, (el) => tile(el).querySelector<HTMLElement>('[role="slider"]')!);
    expect(t.out).toEqual([30, 40]);
    const v = await twice("media", { entity: "media_player.m", volume_only: true }, tile);
    expect(v.out).toEqual([0.15, 0.2]);
    expect(v.now).toBe("20");
  });

  it("a held key does not repeat the tap on a light; the same keys step it", async () => {
    const h = mockHass([ent("light.a", "on", { brightness: 128, supported_color_modes: ["brightness"] })]);
    const el = await mountCard("light", { entity: "light.a" }, h);
    const t = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    key(t, "Enter");
    key(t, "Enter", { repeat: true });
    key(t, "Enter", { repeat: true });
    expect(h.calls.length).toBe(1);
    h.calls.length = 0;
    const lvl = () => (h.calls.at(-1)![2] as { brightness_pct?: number }).brightness_pct;
    (el as unknown as { lights: { overrides: Map<string, unknown>; pending: Map<string, unknown> } }).lights.overrides.clear();
    key(t, "ArrowUp");
    expect(lvl()).toBe(60);
    key(t, "ArrowDown");
    expect(lvl()).toBe(50);
    key(t, "PageUp");
    expect(lvl()).toBe(75);
    key(t, "End");
    expect(lvl()).toBe(100);
    key(t, "Home");
    expect(h.calls.at(-1)![1]).toBe("turn_off");
    el.remove();
  });

  it("volume_only: a tap on the tile sets the volume, whatever tap_action says", async () => {
    const h = mockHass([ent("media_player.m", "playing", { supported_features: 4, volume_level: 0.1 })]);
    const el = await mountCard("media", { entity: "media_player.m", volume_only: true, tap_action: { action: "more-info" } }, h);
    const fired: unknown[] = [];
    el.addEventListener("hass-action", (e) => fired.push(e));
    const t = tile(el);
    t.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
    t.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 60, clientY: 0 }));
    t.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 60, clientY: 0 }));
    expect(h.calls.at(-1)).toEqual(["media_player", "volume_set", { volume_level: 0.6 }, { entity_id: "media_player.m" }]);
    expect(fired).toEqual([]);
    el.remove();
  });
});
