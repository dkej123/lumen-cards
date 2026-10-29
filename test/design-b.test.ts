// @vitest-environment happy-dom
// Catalog 2026-10-29, sections 05, 06, 09, 10, 11, 13, 15, 16, 17.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { HassEntity, HassLike } from "../src/hass/types";
import { setLanguage } from "../src/core/i18n";
import { armModes, alarmStatus, targetMode } from "../src/logic/status";
import { colorSet, colorVars } from "../src/core/styles";
import { isSolidCard } from "../src/weather/engine";

const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, changedSecAgo = 600): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id.split(".")[1], ...attributes },
  last_changed: ago(changedSecAgo),
  last_updated: ago(changedSecAgo),
});

type Hass = HassLike & { calls: unknown[][]; fail?: (args: unknown[]) => boolean };
const hass = (...list: HassEntity[]): Hass => {
  const calls: unknown[][] = [];
  const h: Hass = {
    calls,
    states: Object.fromEntries(list.map((e) => [e.entity_id, e])),
    user: { id: "u1", name: "Ann", is_admin: true },
    language: "en",
    locale: { language: "en" },
    themes: { darkMode: false },
    formatEntityState: (e) => e.state,
    callService: async (...args) => {
      calls.push(args);
      if (h.fail?.(args)) throw new Error("Invalid alarm code provided");
      return undefined;
    },
    callWS: async () => ({}) as never,
  };
  return h;
};

type Card = HTMLElement & { setConfig(c: unknown): void; hass: HassLike; updateComplete: Promise<boolean>; getGridOptions(): Record<string, unknown> };

const mount = async (type: string, config: Record<string, unknown>, h?: HassLike) => {
  const el = document.createElement(`lumen-${type}-card`) as Card;
  el.setConfig({ type: `custom:lumen-${type}-card`, ...config });
  if (h) el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const root = (el: Card) => el.shadowRoot!;
const layer = () => document.querySelector("lumen-cards-layer")?.shadowRoot ?? null;
const settle = async (el: Card) => {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};
const button = (r: ParentNode | null, text: string) => [...(r?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);

beforeAll(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  await import("../src/lumen-cards");
});

afterEach(() => {
  document.body.innerHTML = "";
  setLanguage("en");
});

describe("05 alarm", () => {
  it("every armed mode is green, told apart by icon and caption", () => {
    const home = alarmStatus(ent("alarm_control_panel.a", "armed_home"));
    const night = alarmStatus(ent("alarm_control_panel.a", "armed_night"));
    expect([home.tone, night.tone]).toEqual(["ok", "ok"]);
    expect(home.icon).not.toBe(night.icon);
    expect(home.label).toBe("Armed · home");
    expect(alarmStatus(ent("alarm_control_panel.a", "arming", { next_state: "armed_away" })).label).toBe("Arming · away");
    expect(alarmStatus(ent("alarm_control_panel.a", "pending", { code_format: "number" })).label).toBe("Enter the code");
  });

  it("offers only the arm modes the entity supports", () => {
    expect(armModes(ent("alarm_control_panel.a", "disarmed", { supported_features: 1 | 2 }))).toEqual(["armed_home", "armed_away"]);
    expect(armModes(ent("alarm_control_panel.a", "disarmed", { supported_features: 63 }), ["armed_night"])).toEqual(["armed_night"]);
    expect(armModes(ent("alarm_control_panel.a", "disarmed"))).toEqual(["armed_home", "armed_away", "armed_night"]);
    expect(targetMode(ent("alarm_control_panel.a", "arming", { arm_mode: "armed_night" }))).toBe("armed_night");
  });

  it("arming bar from arming_time, pending bar from the card's pending_time", async () => {
    const { alarmCountdown } = await import("../src/cards/alarm");
    const arming = ent("alarm_control_panel.a", "arming", { arming_time: 40 }, 10);
    const pending = ent("alarm_control_panel.a", "pending", {}, 5);
    const now = Date.now();
    expect(alarmCountdown(arming, {}, now)).toMatchObject({ left: 30 });
    expect(alarmCountdown(arming, {}, now)!.pct).toBeCloseTo(25, 0);
    expect(alarmCountdown(pending, { pending_time: 20 }, now)).toMatchObject({ left: 15, pct: 75 });
    expect(alarmCountdown(ent("alarm_control_panel.a", "pending", {}, 5), {}, now)).toBeNull();
  });

  it("Arm opens the code pad with the supported modes and sends the chosen mode with the code", async () => {
    const h = hass(ent("alarm_control_panel.home", "disarmed", { supported_features: 1 | 2 | 4, code_format: "number" }));
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "wide" }, h);
    button(root(el), "Arm")!.click();
    await settle(el);
    const pad = layer()!;
    expect(pad.querySelectorAll('[role="radio"]').length).toBe(3);
    (pad.querySelectorAll<HTMLButtonElement>('[role="radio"]')[2]).click();
    await settle(el);
    for (const k of ["1", "2", "3", "4"]) button(layer(), k)!.click();
    await settle(el);
    button(layer(), "Arm · night")!.click();
    await settle(el);
    expect(h.calls.at(-1)).toEqual(["alarm_control_panel", "alarm_arm_night", { code: "1234" }, { entity_id: "alarm_control_panel.home" }]);
    expect(layer()).toBeNull();
  });

  it("a rejected disarm keeps the pad open with the wrong-code message", async () => {
    const h = hass(ent("alarm_control_panel.home", "armed_away", { code_format: "number" }));
    h.fail = () => true;
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "wide" }, h);
    button(root(el), "Disarm")!.click();
    await settle(el);
    expect(layer()!.querySelectorAll('[role="radio"]').length).toBe(0);
    for (const k of ["9", "9"]) button(layer(), k)!.click();
    await settle(el);
    button(layer(), "Disarm")!.click();
    await settle(el);
    await settle(el);
    expect(layer()!.querySelector('[role="alert"]')!.textContent).toContain("Wrong code");
  });

  it("code_format text shows a text field instead of the keypad", async () => {
    const h = hass(ent("alarm_control_panel.home", "armed_home", { code_format: "text" }));
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "wide" }, h);
    button(root(el), "Disarm")!.click();
    await settle(el);
    expect(layer()!.querySelector("input[type=password]")).toBeTruthy();
    expect(button(layer(), "5")).toBeUndefined();
  });

  it("an own tap_action (script) still runs from the row and the buttons", async () => {
    const h = hass(ent("alarm_control_panel.home", "disarmed", { code_format: "number" }));
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "wide", tap_action: { action: "perform-action", perform_action: "script.toggle_alarm" } }, h);
    const fired: unknown[] = [];
    el.addEventListener("hass-action", (e) => fired.push((e as CustomEvent).detail.action));
    button(root(el), "Arm")!.click();
    await settle(el);
    expect(fired).toEqual(["tap"]);
    expect(layer()).toBeNull();
  });

  it("triggered row is red with Disarm; compact = access bar cell", async () => {
    const h = hass(ent("alarm_control_panel.home", "triggered"));
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "wide", screen_ring: false }, h);
    const row = root(el).querySelector<HTMLElement>(".alarmrow")!;
    expect(row.getAttribute("style")).toContain("background:var(--lumen-danger)");
    expect(button(root(el), "Disarm")).toBeTruthy();
    const tile = await mount("alarm", { entity: "alarm_control_panel.home", layout: "compact", screen_ring: false, banner: false }, h);
    expect(root(tile).querySelector(".alarmrow")).toBeNull();
    expect(root(tile).querySelector<HTMLElement>('[role="button"]')!.getAttribute("style")).not.toContain("height:120px");
  });
});

describe("06 lock", () => {
  it("lock is sent at once, unlock asks for the PIN when the lock has a code_format", async () => {
    const h = hass(ent("lock.door", "unlocked", { supported_features: 1, code_format: "^\\d{4}$" }));
    const el = await mount("lock", { entity: "lock.door", layout: "wide" }, h);
    button(root(el), "Lock · door")!.click();
    await settle(el);
    expect(h.calls.at(-1)).toEqual(["lock", "lock", {}, { entity_id: "lock.door" }]);
    el.hass = { ...h, states: { ...h.states, "lock.door": ent("lock.door", "locked", { supported_features: 1, code_format: "^\\d{4}$" }) } };
    await settle(el);
    const unlock = button(root(el), "Unlock · door")!;
    unlock.click();
    await settle(el);
    expect(layer()!.querySelector('[role="dialog"]')!.getAttribute("aria-label")).toBe("Unlock the door");
    for (const k of ["4", "3", "2", "1"]) button(layer(), k)!.click();
    await settle(el);
    button(layer(), "Unlock")!.click();
    await settle(el);
    expect(h.calls.at(-1)).toEqual(["lock", "unlock", { code: "4321" }, { entity_id: "lock.door" }]);
  });

  it("two buttons without OPEN; open and jammed are red; unknown keeps every button", async () => {
    const h = hass(ent("lock.gate", "locked", { supported_features: 0 }), ent("lock.door", "open", { supported_features: 1 }), ent("lock.jam", "jammed", { supported_features: 1 }), ent("lock.unk", "unknown", { supported_features: 1 }));
    const gate = await mount("lock", { entity: "lock.gate", layout: "wide" }, h);
    expect(root(gate).querySelectorAll(".lockbtns button").length).toBe(2);
    const door = await mount("lock", { entity: "lock.door", layout: "wide" }, h);
    expect(root(door).querySelector<HTMLElement>(".lockrow")!.getAttribute("style")).toContain("var(--lumen-danger) 40%");
    const disabled = [...root(door).querySelectorAll<HTMLButtonElement>(".lockbtns button")].map((b) => b.disabled);
    expect(disabled).toEqual([true, true, true]);
    const unk = await mount("lock", { entity: "lock.unk", layout: "wide" }, h);
    expect([...root(unk).querySelectorAll<HTMLButtonElement>(".lockbtns button")].map((b) => b.disabled)).toEqual([false, false, false]);
    const jam = await mount("lock", { entity: "lock.jam", layout: "compact" }, h);
    expect(root(jam).querySelector('[role="button"]')!.getAttribute("aria-label")).toContain("jammed");
  });

  it("PIN pad kind from the code_format regex", async () => {
    const { lockPadKind } = await import("../src/cards/lock");
    expect(lockPadKind("^\\d+$")).toBe("pin");
    expect(lockPadKind("^\\d{4,6}$")).toBe("pin");
    expect(lockPadKind(".+")).toBe("text");
  });
});

describe("09 climate", () => {
  const ac = (state: string, attrs: Record<string, unknown> = {}) =>
    ent("climate.ac", state, { hvac_modes: ["off", "heat_cool", "cool", "heat"], min_temp: 10, max_temp: 32, target_temp_step: 0.5, current_temperature: 22.4, ...attrs });

  it("heat_cool: two fields, the selected one moves with −/+", async () => {
    const h = hass(ac("heat_cool", { target_temp_low: 20, target_temp_high: 25, hvac_action: "idle" }));
    const el = await mount("climate", { entity: "climate.ac" }, h);
    const text = root(el).textContent!;
    expect(text).toContain("Heat to");
    expect(text).toContain("Cool from");
    expect(text).toContain("Idle");
    // heat_cool reads "Auto" when the device has no separate auto mode.
    expect(button(root(el), "Auto")).toBeTruthy();
    root(el).querySelector<HTMLButtonElement>('button[aria-label^="Cool from"]')!.click();
    await el.updateComplete;
    vi.useFakeTimers();
    (el as unknown as { step(d: number): void }).step(1);
    vi.advanceTimersByTime(700);
    vi.useRealTimers();
    expect(h.calls.at(-1)).toEqual(["climate", "set_temperature", { target_temp_low: 20, target_temp_high: 25.5 }, { entity_id: "climate.ac" }]);
  });

  it("°F without conversion, five modes in a grid of three, presets, swing, fan list", async () => {
    const fans = ["auto", "1", "2", "3", "4", "5", "turbo"];
    const h = hass(ent("climate.f", "cool", { temperature_unit: "°F", hvac_modes: ["auto", "cool", "heat", "dry", "fan_only"], temperature: 72, current_temperature: 76, min_temp: 61, max_temp: 86, target_temp_step: 1, hvac_action: "cooling", preset_modes: ["none", "eco", "sleep", "boost"], preset_mode: "none", swing_modes: ["off", "vertical", "both"], swing_mode: "vertical", fan_modes: fans, fan_mode: "auto" }));
    const el = await mount("climate", { entity: "climate.f", show_range: true }, h);
    const r = root(el);
    expect(r.textContent).toContain("72 °F");
    expect(r.textContent).toContain("Cooling");
    expect(r.textContent).toContain("range 61–86 °F · step 1");
    expect(r.querySelector<HTMLElement>(".modes")!.getAttribute("style")).toContain("repeat(3,");
    expect(r.querySelector("select")!.querySelectorAll("option").length).toBe(fans.length);
    button(r, "Eco")!.click();
    expect(h.calls.at(-1)).toEqual(["climate", "set_preset_mode", { preset_mode: "eco" }, { entity_id: "climate.f" }]);
    button(r, "Both")!.click();
    expect(h.calls.at(-1)).toEqual(["climate", "set_swing_mode", { swing_mode: "both" }, { entity_id: "climate.f" }]);
  });

  it("compact row: what it does now and the setpoint", async () => {
    const h = hass(ac("cool", { temperature: 22, hvac_action: "cooling" }));
    const el = await mount("climate", { entity: "climate.ac", layout: "compact" }, h);
    expect(root(el).textContent).toContain("Cooling · 22.4°");
    expect(root(el).textContent).toContain("22°");
  });
});

describe("10 sensor / 11 air quality", () => {
  it("outdated: dashed frame and the age; unavailable: dash and no chart", async () => {
    const h = hass(ent("sensor.balcony", "8.1", { unit_of_measurement: "°C", device_class: "temperature" }, 3 * 3600), ent("sensor.cellar", "unavailable", { unit_of_measurement: "°C" }));
    const stale = await mount("sensor", { entity: "sensor.balcony" }, h);
    const s = root(stale).querySelector<HTMLElement>("[data-fx]")!;
    expect(s.getAttribute("style")).toContain("dashed");
    expect(s.textContent).toContain("3 h ago");
    const una = await mount("sensor", { entity: "sensor.cellar" }, h);
    expect(root(una).textContent).toContain("—");
    expect(root(una).querySelector("svg")).toBeNull();
    const compact = await mount("sensor", { entity: "sensor.balcony", layout: "compact" }, h);
    expect(root(compact).querySelector<HTMLElement>("[data-fx]")!.getAttribute("style")).toContain("height:36px");
    expect(root(compact).querySelector("svg")).toBeNull();
  });

  it("a single AQI sensor: AQI 72 is moderate", async () => {
    const h = hass(ent("sensor.aqi", "72", { device_class: "aqi" }, 60));
    const el = await mount("air-quality", { aqi_entity: "sensor.aqi" }, h);
    expect(root(el).textContent).toContain("AQI 72");
    expect(root(el).textContent).toContain("Moderate");
  });
});

describe("15 general states", () => {
  it("config error and missing entity render the Lumen error card", async () => {
    const h = hass();
    const noEntity = await mount("lock", {}, h);
    expect(root(noEntity).querySelector('[role="alert"]')!.textContent).toContain("type: custom:lumen-lock-card");
    const missing = await mount("lock", { entity: "lock.nope" }, h);
    expect(root(missing).textContent).toContain("Entity not found");
    expect(root(missing).textContent).toContain("lock.nope");
  });

  it("loading skeleton until hass arrives", async () => {
    const el = await mount("sensor", { entity: "sensor.x" });
    expect(root(el).querySelector('[aria-busy="true"]')).toBeTruthy();
    const bg = await mount("weather-background", { weather_entity: "weather.x" });
    expect(root(bg).querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("unavailable: dashed frame, Unavailable, actions off", async () => {
    const h = hass(ent("lock.door", "unavailable", { supported_features: 1 }));
    const el = await mount("lock", { entity: "lock.door", layout: "wide" }, h);
    expect(root(el).querySelector<HTMLElement>(".lockrow")!.getAttribute("style")).toContain("dashed");
    expect(root(el).textContent).toContain("Unavailable");
    expect([...root(el).querySelectorAll<HTMLButtonElement>(".lockbtns button")].every((b) => b.disabled)).toBe(true);
  });
});

describe("16 user colour", () => {
  it("one colour C gives the whole set", () => {
    const s = colorSet("#0080ff");
    expect(s.fillA).toBe("color-mix(in srgb, #0080ff var(--lumen-fill-a), transparent)");
    expect(s.glow).toContain("#0080ff 55%");
    expect(s.iconBg).toBe("color-mix(in srgb, #0080ff 16%, transparent)");
    expect(s.shadow).toBe("0 10px 30px -14px color-mix(in srgb, #0080ff 70%, transparent)");
    expect(s.ink).toBe("color-mix(in oklch, #0080ff var(--lumen-tone-k), var(--lumen-tone-mix))");
    expect(Object.keys(colorVars("glow", "red"))).toContain("--lumen-glow-ink");
  });

  it("accent_color and glow_color set the host variables", async () => {
    const h = hass(ent("sensor.t", "20", { unit_of_measurement: "°C" }));
    const el = await mount("sensor", { entity: "sensor.t", accent_color: "#00aa55", glow_color: [255, 0, 128] }, h);
    expect(el.style.getPropertyValue("--lumen-accent")).toBe("#00aa55");
    expect(el.style.getPropertyValue("--lumen-accent-soft")).toContain("16%");
    expect(el.style.getPropertyValue("--lumen-accent-ink")).toContain("var(--lumen-tone-k)");
    expect(el.style.getPropertyValue("--lumen-glow")).toBe("rgb(255,0,128)");
    el.setConfig({ type: "custom:lumen-sensor-card", entity: "sensor.t" });
    await el.updateComplete;
    expect(el.style.getPropertyValue("--lumen-accent")).toBe("");
  });
});

describe("17 section grid", () => {
  it("default and minimum columns", async () => {
    const h = hass(ent("alarm_control_panel.a", "disarmed"), ent("lock.a", "locked"), ent("sensor.a", "1"), ent("climate.a", "off"));
    expect((await mount("alarm", { entity: "alarm_control_panel.a" }, h)).getGridOptions()).toMatchObject({ columns: 12, min_columns: 3 });
    expect((await mount("lock", { entity: "lock.a" }, h)).getGridOptions()).toMatchObject({ columns: 12, min_columns: 3 });
    expect((await mount("sensor", { entity: "sensor.a" }, h)).getGridOptions()).toMatchObject({ columns: 6, min_columns: 3 });
    expect((await mount("climate", { entity: "climate.a" }, h)).getGridOptions()).toMatchObject({ columns: "full" });
  });
});

describe("13 weather on cards without glass", () => {
  it("no backdrop blur or an opaque background = edge effects only", () => {
    expect(isSolidCard({ backdropFilter: "none", backgroundColor: "rgba(255, 255, 255, 0.66)" })).toBe(true);
    expect(isSolidCard({ backdropFilter: "blur(22px) saturate(1.4)", backgroundColor: "rgb(255, 255, 255)" })).toBe(true);
    expect(isSolidCard({ backdropFilter: "blur(22px) saturate(1.4)", backgroundColor: "rgba(255, 255, 255, 0.66)" })).toBe(false);
  });
});
