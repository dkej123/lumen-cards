import { afterEach, describe, expect, it, vi } from "vitest";
import { setLanguage, setLocale } from "../src/core/i18n";
import { cssColor, tone } from "../src/core/styles";
import type { HassEntity } from "../src/hass/types";
import { airQuality } from "../src/logic/air";
import { alertToShow } from "../src/logic/alert";
import { ctPresets, kelvinRange, lightPower } from "../src/logic/light";
import { presence } from "../src/logic/presence";
import { alarmBarIcon, alarmStatus } from "../src/logic/status";
import { formatDuration, formatNumber, formatWhen } from "../src/logic/time";

const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, last_changed = "2026-10-29T10:00:00Z"): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed,
  last_updated: last_changed,
});

afterEach(() => {
  setLanguage("en");
  setLocale(undefined);
});

describe("alarmStatus", () => {
  it.each(["armed_away", "armed_home", "armed_night", "armed_vacation", "armed_custom_bypass"])("%s is armed (ok), never „disarmed”", (state) => {
    const s = alarmStatus(ent("alarm_control_panel.a", state));
    expect(s.tone).toBe("ok");
    expect(s.label).toMatch(/^Armed/);
    expect(alarmBarIcon(ent("alarm_control_panel.a", state))).toBe("mdi:home-lock");
  });
  it("disarmed is neutral, transitions are busy, triggered alerts", () => {
    expect(alarmStatus(ent("a.a", "disarmed")).tone).toBe("text-3");
    expect(alarmStatus(ent("a.a", "arming")).busy).toBe(true);
    expect(alarmStatus(ent("a.a", "disarming")).busy).toBe(true);
    expect(alarmStatus(ent("a.a", "pending")).busy).toBe(true);
    expect(alarmStatus(ent("a.a", "triggered")).alert).toBe(true);
    expect(alarmStatus(ent("a.a", "unavailable")).tone).toBe("unavailable");
  });
  it("custom icon replaces the glyphs except while triggered", () => {
    expect(alarmStatus(ent("a.a", "armed_home"), "mdi:garage").icon).toBe("mdi:garage");
    expect(alarmBarIcon(ent("a.a", "triggered"), "mdi:garage")).toBe("mdi:alarm-light");
  });
});

describe("lights", () => {
  it("kelvin range comes from the bulb, presets stay inside it", () => {
    const cool = ent("light.a", "on", { min_color_temp_kelvin: 2700, max_color_temp_kelvin: 6500 });
    expect(kelvinRange(cool)).toEqual([2700, 6500]);
    const p = ctPresets(cool).map(([k]) => k);
    expect(p.length).toBe(4);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(2700);
    expect(Math.max(...p)).toBe(6500);
    expect(ctPresets(ent("light.b", "on")).map(([k]) => k)).toEqual([2200, 2700, 3200, 4000]);
  });
  it("relay off = off, not unavailable; booting bulb counts as on", () => {
    const now = Date.parse("2026-10-29T10:00:30Z");
    expect(lightPower(ent("light.a", "unavailable"), ent("switch.r", "off"), true, now)).toMatchObject({ unavailable: false, on: false });
    expect(lightPower(ent("light.a", "unavailable"), ent("switch.r", "on"), true, now)).toMatchObject({ booting: true, on: true });
    expect(lightPower(ent("light.a", "on"), undefined, false, now)).toMatchObject({ on: true });
  });
});

describe("air quality", () => {
  const r = (value: number) => ({ value, at: "2026-10-29T10:00:00Z" });
  const now = Date.parse("2026-10-29T10:10:00Z");
  it("level is the worst of the sensors (EAQI bands)", () => {
    expect(airQuality(r(5), r(10), 1, now).level).toBe(0);
    expect(airQuality(r(22), r(10), 1, now).level).toBe(2);
    expect(airQuality(r(5), r(160), 1, now).level).toBe(5);
  });
  it("works with only one sensor or only AQI", () => {
    expect(airQuality(undefined, r(45), 1, now).level).toBe(2);
    expect(airQuality(undefined, undefined, 1, now, r(72)).level).toBe(2);
    expect(airQuality(undefined, undefined, 1, now, r(120)).level).toBe(3);
    expect(airQuality(undefined, undefined, 1, now).level).toBeNull();
  });
  it("stale after stale_hours", () => {
    expect(airQuality(r(5), r(5), 0.1, now).stale).toBe(true);
  });
});

describe("presence", () => {
  it("no data without the ESP wording", () => {
    setLanguage("en");
    expect(presence(undefined, undefined).status).toBe("No data");
  });
  it("away shows the zone", () => {
    setLanguage("en");
    const p = presence(ent("binary_sensor.p", "off", {}, "2026-10-29T09:50:00Z"), ent("person.p", "Work"), Date.parse("2026-10-29T10:00:00Z"));
    expect(p.home).toBe(false);
    expect(p.status).toContain("Work");
  });
});

describe("format", () => {
  it("number format follows the HA profile", () => {
    setLanguage("pl");
    setLocale({ language: "pl" });
    expect(formatNumber(22.4)).toBe("22,4");
    setLocale({ language: "pl", number_format: "comma_decimal" });
    expect(formatNumber(22.4)).toBe("22.4");
  });
  it("durations and points in time", () => {
    setLanguage("en");
    expect(formatDuration(25 * 60_000)).toBe("25 min");
    expect(formatDuration(3 * 86_400_000)).toBe("3 days");
    const now = Date.parse("2026-10-29T12:00:00");
    expect(formatWhen(Date.parse("2026-10-28T23:10:00"), now)).toMatch(/^yesterday /);
  });
  it("12-hour clock when the profile says so", () => {
    setLanguage("en");
    setLocale({ language: "en-US", time_format: "12" });
    expect(formatWhen(Date.parse("2026-10-29T13:20:00"), Date.parse("2026-10-29T14:00:00"))).toMatch(/1:20\s?PM/i);
  });
});

describe("reminder occurrences", () => {
  it("shows once per occurrence", () => {
    const e = ent("input_boolean.r", "on");
    const key = alertToShow(e, "on", undefined);
    expect(key).toBeTruthy();
    expect(alertToShow(e, "on", key!)).toBeNull();
    expect(alertToShow(ent("input_boolean.r", "off"), "on", undefined)).toBeNull();
  });
});

describe("colours from the config", () => {
  it("accepts HA names, hex and RGB; rejects CSS declarations", () => {
    expect(cssColor("red")).toBe("var(--red-color, #f44336)");
    expect(cssColor("#ff8800")).toBe("#ff8800");
    expect(cssColor([1, 2, 3])).toBe("rgb(1,2,3)");
    expect(cssColor("red;position:fixed")).toBeUndefined();
    expect(cssColor("url(x)")).toBeUndefined();
    expect(tone("x);background:url(y")).toBe("var(--lumen-accent)");
  });
});

describe("thermostat battery (Better Thermostat)", async () => {
  const { batteryLevel } = await import("../src/logic/battery");
  const e = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes, last_changed: "", last_updated: "" });
  it("BT batteries attribute (JSON text): the lowest valve", () => {
    const c = e("climate.x", "heat", { batteries: '{"climate.a": {"battery": 9, "battery_id": "sensor.a"}, "climate.b": {"battery": 64}}' });
    expect(batteryLevel(c, undefined)).toEqual({ pct: 9, low: true });
    expect(batteryLevel(c, undefined, 5)).toEqual({ pct: 9, low: false });
  });
  it("sensor wins; binary_sensor on = low; nothing known = null", () => {
    expect(batteryLevel(e("climate.x", "heat"), e("sensor.b", "55"))).toEqual({ pct: 55, low: false });
    expect(batteryLevel(e("climate.x", "heat"), e("binary_sensor.b", "on"))).toEqual({ pct: null, low: true });
    expect(batteryLevel(e("climate.x", "heat"), undefined)).toBeNull();
  });
});

describe("drag haptics", async () => {
  const { DragTicks } = await import("../src/core/actions");
  it("a selection tick every 1 %, light at the ends, at most one per 25 ms", () => {
    vi.useFakeTimers();
    const fired: string[] = [];
    const node = new EventTarget();
    node.addEventListener("haptic", (e) => fired.push((e as CustomEvent).detail));
    const t = new DragTicks();
    t.start(50);
    t.move(node, 50.3);
    expect(fired).toEqual([]);
    t.move(node, 51);
    t.move(node, 52); // within 25 ms: skipped
    vi.advanceTimersByTime(30);
    t.move(node, 53);
    t.move(node, 100); // the end always ticks
    vi.useRealTimers();
    expect(fired).toEqual(["selection", "selection", "light"]);
  });
  it("haptics: false on the card silences it", async () => {
    const { haptic } = await import("../src/core/actions");
    const fired: string[] = [];
    const card = Object.assign(new EventTarget(), { _config: { haptics: false } });
    card.addEventListener("haptic", (e) => fired.push((e as CustomEvent).detail));
    haptic(card, "light");
    expect(fired).toEqual([]);
  });
});
