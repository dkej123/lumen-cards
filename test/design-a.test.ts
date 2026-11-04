// @vitest-environment happy-dom
// Catalog 2026-10-29, sections 01–04, 07, 08: light, entity, button, person, reminder, chips / FAB.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { chipActive } from "../src/logic/chip";
import { ent, mockHass, mount as mountCard, type Card } from "./helpers";
import { setLanguage } from "../src/core/i18n";
import { FAB_ORDER, fabBottom, fabEdge, fabSize, fabSlot, releaseFab } from "../src/core/layer";
import { subButtonLimit } from "../src/core/sub-buttons";
import type { HassLike } from "../src/hass/types";
import { hsToRgb, hueName, miredPresets, mixedGroup, swatchIndex, whiteGradient } from "../src/logic/light";
import { avatarColor, presence } from "../src/logic/presence";


const CT = { supported_color_modes: ["color_temp", "hs"], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 };

const STATES = [
  ent("light.a", "on", { brightness: 255, ...CT, color_mode: "color_temp", color_temp_kelvin: 2700 }),
  ent("light.b", "on", { brightness: 153, ...CT, color_mode: "color_temp", color_temp_kelvin: 2700 }),
  ent("light.c", "off", CT),
  ent("light.group", "on", { brightness: 204, ...CT, entity_id: ["light.a", "light.b", "light.c"] }),
  ent("light.rgb", "on", { brightness: 153, ...CT, color_mode: "hs", hs_color: [324, 75], rgb_color: [255, 64, 178] }),
  ent("light.onoff", "on", { supported_color_modes: ["onoff"] }),
  ent("light.unknown", "unknown", CT),
  ent("light.gone", "unavailable"),
  ent("fan.purifier", "on"),
  ent("input_boolean.night", "off"),
  ent("switch.gone", "unavailable"),
  ent("script.gate", "off"),
  ent("sensor.gate_status", "200"),
  ent("person.ann", "home"),
  ent("person.bob", "Work"),
  ent("binary_sensor.ble", "on"),
  ent("sensor.trash", "bio tomorrow"),
  ent("sensor.pct", "17.6"),
  ent("scene.evening", "2026-10-29T18:00:00Z"),
  ent("scene.movie", "2026-10-28T18:00:00Z"),
];

const hass = (states = STATES) => mockHass(states);

const mount = (type: string, config: Record<string, unknown>, h: HassLike = hass()) => mountCard(type, config, h);
const text = (el: Card) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");

beforeAll(async () => {
  await import("../src/lumen-cards");
  setLanguage("en");
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("light logic", () => {
  it("four white presets spread evenly in mireds", () => {
    expect(miredPresets(ent("light.x", "on", { min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }))).toEqual([2200, 2800, 3950, 6500]);
    const p = miredPresets(ent("light.x", "on", { min_color_temp_kelvin: 2700, max_color_temp_kelvin: 4000 }));
    expect(p[0]).toBe(2700);
    expect(p[3]).toBe(4000);
    expect(p[1]).toBeGreaterThan(2700);
    expect(p[2]).toBeLessThan(4000);
  });
  it("mixed group: members on, average brightness of those", () => {
    const h = hass();
    expect(mixedGroup(h.states["light.group"], h.states)).toEqual({ on: 2, total: 3, avg: 80 });
    expect(mixedGroup(h.states["light.a"], h.states)).toBeNull();
  });
  it("colour names, swatches and rgb", () => {
    expect(hueName([324, 75])).toBe("card.light.hue.pink");
    expect(hueName([200, 5])).toBe("card.light.hue.white");
    expect(swatchIndex([324, 70])).toBe(7);
    expect(swatchIndex([100, 70])).toBe(-1);
    expect(hsToRgb([0, 100])).toBe("rgb(255,0,0)");
    expect(hsToRgb([120, 0])).toBe("rgb(255,255,255)");
    expect(whiteGradient(2200, 6500)).toMatch(/^linear-gradient\(90deg, oklab/);
  });
});

describe("light card", () => {
  it("states: RGB colour name, on/off only, mixed group, unknown, unavailable", async () => {
    expect(text(await mount("light", { entity: "light.rgb", layout: "wide" }))).toContain("Pink");
    expect(text(await mount("light", { entity: "light.onoff", layout: "wide" }))).toContain("On");
    const g = text(await mount("light", { entity: "light.group", layout: "wide" }));
    expect(g).toContain("2 of 3 on");
    expect(g).toContain("80%");
    expect(text(await mount("light", { entity: "light.unknown", layout: "wide" }))).toContain("No data");
    expect(text(await mount("light", { entity: "light.gone", layout: "wide" }))).toContain("Unavailable");
  });

  it("compact is the low 44 px tile (catalog correction 2026-10-30)", async () => {
    const el = await mount("light", { entity: "light.c", layout: "compact" });
    expect(text(el)).toContain("Off");
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    expect(tile.getAttribute("style")).toContain("height:44px");
    expect(tile.getAttribute("style")).toContain("border-radius:16px");
  });

  it("horizontal drag sets the brightness from the finger position", async () => {
    const h = hass();
    const el = await mount("light", { entity: "light.a", layout: "wide" }, h);
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    tile.getBoundingClientRect = () => ({ left: 0, top: 300, width: 200, height: 64, right: 200, bottom: 364, x: 0, y: 300, toJSON() {} }) as DOMRect;
    const ev = (type: string, x: number) => tile.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 320, button: 0, bubbles: true, pointerId: 1 }));
    ev("pointerdown", 20);
    ev("pointermove", 24); // under 6 px: still a tap
    ev("pointermove", 90);
    ev("pointermove", 120);
    ev("pointerup", 120);
    expect(h.calls.at(-1)).toEqual(["light", "turn_on", { brightness_pct: 60 }, { entity_id: "light.a" }]);
  });

  it("tap without movement toggles", async () => {
    const h = hass();
    const el = await mount("light", { entity: "light.a", layout: "wide" }, h);
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    tile.dispatchEvent(new PointerEvent("pointerdown", { clientX: 20, clientY: 20, button: 0, bubbles: true }));
    tile.dispatchEvent(new PointerEvent("pointerup", { clientX: 22, clientY: 20, button: 0, bubbles: true }));
    expect(h.calls.at(-1)).toEqual(["light", "turn_off", {}, { entity_id: "light.a" }]);
  });

  it("the icon opens the sheet without starting a drag; the sheet has whites, 8 hues and the wheel", async () => {
    const h = hass();
    const el = await mount("light", { entity: "light.rgb", layout: "wide" }, h);
    const icon = el.shadowRoot!.querySelector<HTMLElement>('.tile [tabindex="-1"]')!;
    icon.dispatchEvent(new PointerEvent("pointerdown", { clientX: 5, clientY: 5, button: 0, bubbles: true }));
    icon.click();
    await el.updateComplete;
    const layer = document.querySelector("lumen-cards-layer")!.shadowRoot!;
    expect(layer.querySelector('[role="dialog"]')).toBeTruthy();
    expect(layer.textContent).toContain("2800 K");
    const colors = layer.querySelectorAll('[role="radiogroup"]')[1].querySelectorAll("button");
    expect(colors.length).toBe(9);
    expect(colors[7].getAttribute("aria-checked")).toBe("true");
    colors[8].click();
    await el.updateComplete;
    expect(document.querySelector("lumen-cards-layer")!.shadowRoot!.textContent).toContain("Colour wheel");
    expect(h.calls).toEqual([]);
  });

  it("RGB-only light: sheet without the white section", async () => {
    const h = hass([...STATES, ent("light.rgbonly", "on", { brightness: 100, supported_color_modes: ["hs"], color_mode: "hs", hs_color: [0, 80] })]);
    const el = await mount("light", { entity: "light.rgbonly", layout: "wide" }, h);
    el.shadowRoot!.querySelector<HTMLElement>('.tile [tabindex="-1"]')!.click();
    await el.updateComplete;
    const layer = document.querySelector("lumen-cards-layer")!.shadowRoot!;
    expect(layer.querySelectorAll('[role="radiogroup"]').length).toBe(1);
    expect(layer.textContent).not.toContain("White");
  });
});

describe("sub-buttons", () => {
  it("limit: 4 full, 2 narrow, 1 compact", () => {
    expect(subButtonLimit(false, 400)).toBe(4);
    expect(subButtonLimit(false, 176)).toBe(2);
    expect(subButtonLimit(false, 0)).toBe(4);
    expect(subButtonLimit(true, 117)).toBe(1);
  });

  it("extra ones are not rendered; the editor preview flags them; unavailable ones are dimmed", async () => {
    const subs = [{ entity: "fan.purifier" }, { entity: "input_boolean.night" }, { entity: "switch.gone" }, { icon: "mdi:power" }, { entity: "fan.purifier" }];
    const el = await mount("entity", { entity: "fan.purifier", layout: "wide", sub_buttons: subs });
    const btns = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".subbtns > [aria-disabled]")];
    expect(btns().length).toBe(4);
    expect(btns()[0].style.background).toContain("--lumen-accent");
    expect(btns()[2].getAttribute("aria-disabled")).toBe("true");
    expect(btns()[3].style.opacity).toBe("0.38");
    expect(el.shadowRoot!.querySelector('.subbtns [role="note"]')).toBeNull();
    el.preview = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.subbtns [role="note"]')!.textContent).toContain("+1");
    const compact = await mount("entity", { entity: "fan.purifier", layout: "compact", sub_buttons: subs });
    // Compact entity = access bar cell with one sub-button beside it.
    expect(compact.shadowRoot!.querySelectorAll(".subbtns > [aria-disabled]").length).toBe(1);
  });

  it("a press on a sub-button does not reach the card", async () => {
    const h = hass();
    const el = await mount("entity", { entity: "fan.purifier", layout: "wide", tap_action: { action: "toggle" }, sub_buttons: [{ entity: "input_boolean.night" }] }, h);
    const fired: string[] = [];
    el.addEventListener("hass-action", (e) => fired.push(JSON.stringify((e as CustomEvent).detail)));
    const b = el.shadowRoot!.querySelector<HTMLElement>(".subbtns > [aria-disabled]")!;
    b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
    b.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
    expect(fired.length).toBe(1);
    expect(fired[0]).toContain("input_boolean.night");
  });
});

describe("entity card: device_class override", () => {
  it("an opening contact shown as a door", async () => {
    const h = hass([...STATES, ent("binary_sensor.contact", "on", { device_class: "opening" })]);
    const plain = await mount("entity", { entity: "binary_sensor.contact", layout: "wide" }, h);
    expect(plain.shadowRoot!.innerHTML).toContain("mdi:square-outline");
    const door = await mount("entity", { entity: "binary_sensor.contact", layout: "wide", device_class: "door" }, h);
    expect(door.shadowRoot!.innerHTML).toContain("mdi:door-open");
  });
});

describe("entity card", () => {
  it("on = accent icon, off = neutral", async () => {
    const on = await mount("entity", { entity: "fan.purifier", layout: "wide" });
    expect(on.shadowRoot!.innerHTML).toContain("var(--lumen-accent-soft)");
    const off = await mount("entity", { entity: "input_boolean.night", layout: "wide" });
    expect(off.shadowRoot!.innerHTML).not.toContain("var(--lumen-accent");
  });
});

describe("button card", () => {
  it("waits, then success with the code; an error stays until the next use", async () => {
    const h = hass();
    const el = await mount("button", { entity: "script.gate", layout: "wide", feedback: { status_entity: "sensor.gate_status", success_text: "Open" } }, h);
    const row = el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!;
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await el.updateComplete;
    expect(text(el)).toContain("Waiting…");
    expect(el.shadowRoot!.querySelector('[aria-busy="true"]')).toBeTruthy();
    await Promise.resolve();
    // The device answers.
    const answer = (state: string) => {
      const next = { ...h, states: { ...h.states, "sensor.gate_status": { ...ent("sensor.gate_status", state, {}, 0) } } };
      el.hass = next;
      return next;
    };
    answer("200");
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(text(el)).toContain("Open · 200 OK");

    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    answer("503");
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(text(el)).toContain("Error 503");
    expect(el.shadowRoot!.innerHTML).toContain("var(--lumen-danger) 40%");
  });

  it("unavailable: no action, plug glyph", async () => {
    const h = hass([...STATES, ent("script.gone", "unavailable")]);
    const el = await mount("button", { entity: "script.gone", layout: "wide" }, h);
    expect(text(el)).toContain("Unavailable");
    expect(el.shadowRoot!.querySelector('[role="button"]')).toBeNull();
  });
});

describe("person", () => {
  it("presence texts: home, away with / without zone, time since", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    const s = (state: string, min: number) => ({ ...ent("binary_sensor.p", state), last_changed: new Date(now - min * 60_000).toISOString() });
    const home = presence(s("on", 180), undefined, now);
    expect([home.label, home.since]).toEqual(["Home", "3 h"]);
    const away = presence(s("off", 120), ent("person.p", "Work"), now);
    expect([away.label, away.short]).toEqual(["Away · Work", "Work · 2 h"]);
    expect(presence(s("off", 15), ent("person.p", "not_home"), now).label).toBe("Away");
    expect(presence(s("on", 0), undefined, now).since).toBe("now");
    expect(presence({ ...s("on", 0), state: "unavailable" }, undefined, now).unavailable).toBe(true);
  });

  it("avatar colour from the name: stable, oklch L .62", () => {
    expect(avatarColor("Ola")).toBe(avatarColor("Ola"));
    expect(avatarColor("Ola")).toMatch(/^oklch\(0\.62 0\.13 \d+\)$/);
  });

  it("presence sensor shows the BLE badge", async () => {
    const el = await mount("person", { entity: "person.ann", presence_entity: "binary_sensor.ble", layout: "wide" });
    expect(text(el)).toContain("BLE");
    const plain = await mount("person", { entity: "person.bob", layout: "wide" });
    expect(text(plain)).not.toContain("BLE");
    expect(text(plain)).toContain("Away · Work");
  });
});

describe("reminder", () => {
  it("{value}: numbers rounded, text as is", async () => {
    const { reminderValue } = await import("../src/cards/reminder");
    const h = hass();
    expect(reminderValue("{value}%", h.states["sensor.pct"], h)).toBe("18%");
    expect(reminderValue("{value}", h.states["sensor.trash"], h)).toBe("bio tomorrow");
    expect(reminderValue("{value} min", undefined, h)).toBe("— min");
  });

  it("editor preview shows the window under the pill; show_chip: false hides the pill", async () => {
    const el = await mount("reminder", { entity: "input_boolean.night", title: "Bike", message: "Charge it", done: true });
    el.preview = true;
    await el.updateComplete;
    const root = el.shadowRoot!;
    expect(root.querySelector('[role="status"], [role="button"]')).not.toBeNull();
    expect(root.querySelector('[role="img"]')!.textContent).toContain("Charge it");
    el.setConfig({ type: "custom:lumen-reminder-card", entity: "input_boolean.night", title: "Bike", show_chip: false });
    await el.updateComplete;
    expect(root.querySelector('[role="status"], [role="button"]')).toBeNull();
    expect(root.querySelector('[role="img"]')).not.toBeNull();
  });

  it("accent_color colours the pill (over `color`)", async () => {
    const el = await mount("reminder", { entity: "input_boolean.night", state: "off", color: "danger", accent_color: "#ff0000" });
    expect(el.shadowRoot!.innerHTML).toContain("var(--lumen-accent)");
  });
});

describe("sub-buttons on every card that offers them", () => {
  const sub = [{ entity: "input_boolean.night", icon: "mdi:weather-night" }];
  const count = (el: Card) => el.shadowRoot!.querySelectorAll(".subbtns > [aria-disabled]").length;
  it.each([
    ["entity", { entity: "fan.purifier" }],
    ["button", { entity: "script.gate" }],
    ["person", { entity: "person.ann" }],
    ["alarm", { entity: "alarm_control_panel.home" }],
  ])("%s: wide and compact", async (type, cfg) => {
    const h = hass([...STATES, ent("alarm_control_panel.home", "disarmed")]);
    expect(count(await mount(type, { ...cfg, layout: "wide", sub_buttons: sub }, h))).toBe(1);
    expect(count(await mount(type, { ...cfg, layout: "compact", sub_buttons: sub }, h))).toBe(1);
  });
});

describe("chips and floating buttons", () => {
  it("stack from the bottom: scenes 64, then 48 px every 12 px, one outer edge; each side its own stack", () => {
    const climate = { requestUpdate: vi.fn() };
    const scenes = { requestUpdate: vi.fn() };
    const alarm = { requestUpdate: vi.fn() };
    expect(fabSlot(climate)).toBe(0);
    expect(fabSlot(alarm, FAB_ORDER.alarm)).toBe(1);
    expect(fabSlot(scenes, FAB_ORDER.scenes)).toBe(0);
    expect(climate.requestUpdate).toHaveBeenCalled();
    expect(fabSlot(climate)).toBe(1);
    expect(fabSlot(alarm, FAB_ORDER.alarm)).toBe(2);
    expect(fabSize(0)).toBe(64);
    expect(fabSize(2)).toBe(48);
    expect(fabBottom(1)).toContain("+ 76px");
    expect(fabBottom(2)).toContain("+ 136px");
    expect(fabEdge("right")).toBe("right:calc(var(--lumen-fab-view-right, 0px) + var(--lumen-cards-fab-right, 16px))");
    expect(fabEdge("left")).toBe("left:calc(var(--lumen-fab-view-left, 0px) + var(--lumen-cards-fab-left, 16px))");
    // A left-handed panel starts its own stack at the bottom of the left edge.
    const panel = { requestUpdate: vi.fn() };
    expect(fabSlot(panel, FAB_ORDER.panels, "left")).toBe(0);
    expect(fabSlot(alarm, FAB_ORDER.alarm)).toBe(2);
    [climate, scenes, alarm, panel].forEach(releaseFab);
  });
});

describe("chips sharing one entity", () => {
  const sb = ent("media_player.sb", "playing", { friendly_name: "Soundbar" });
  const chip = (name: string) => ({
    type: "action",
    entity: "media_player.sb",
    name,
    tap_action: { action: "perform-action", perform_action: "yamaha_soundbar.sound_settings", data: { sound_program: name } },
  });

  it("only the tapped chip plays the press animation", async () => {
    const el = await mountCard("chips", { chips: [chip("music"), chip("tv"), chip("movie")] }, mockHass({ "media_player.sb": sb }));
    const chips = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>("[aria-label]")].filter((x) => ["music", "tv", "movie"].includes(x.getAttribute("aria-label")!));
    expect(chips().length).toBe(3);
    const target = chips()[1];
    target.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true, pointerId: 1 }));
    target.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true, pointerId: 1 }));
    await el.updateComplete;
    expect(chips().map((x) => x.getAttribute("style")!.includes("lumenPop"))).toEqual([false, true, false]);
  });

  const mode = (name: string, value: string) => ({ ...chip(name), active_attribute: "sound_program", active_value: value });
  const modes = [mode("music", "music"), mode("tv", "tv program"), mode("movie", "movie")];
  const pressed = (el: Card) => [...el.shadowRoot!.querySelectorAll("[aria-pressed]")].map((x) => x.getAttribute("aria-pressed"));

  it("highlights the chip matching the attribute, ignoring case", async () => {
    const h = mockHass({ "media_player.sb": { ...sb, attributes: { ...sb.attributes, sound_program: "TV Program" } } });
    const el = await mountCard("chips", { chips: modes }, h);
    expect(pressed(el)).toEqual(["false", "true", "false"]);
    expect(el.shadowRoot!.querySelector('[aria-pressed="true"]')!.getAttribute("style")).toContain("--lumen-accent-soft");
  });

  it("a tapped chip shows as active at once, before the device reports it", async () => {
    const h = mockHass({ "media_player.sb": { ...sb, attributes: { ...sb.attributes, sound_program: "tv program" } } });
    const el = await mountCard("chips", { chips: modes }, h);
    const t = el.shadowRoot!.querySelector('[aria-label="movie"]')!;
    t.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true, pointerId: 1 }));
    t.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true, pointerId: 1 }));
    await el.updateComplete;
    expect(pressed(el)).toEqual(["false", "false", "true"]);
  });

  it("chipActive reads the state, the attribute, and nothing without a value", () => {
    expect(chipActive({ active_value: "playing" }, sb)).toBe(true);
    expect(chipActive({ active_value: "paused" }, sb)).toBe(false);
    expect(chipActive({ active_attribute: "friendly_name", active_value: "soundbar" }, sb)).toBe(true);
    expect(chipActive({}, sb)).toBe(false);
    expect(chipActive({ active_value: "playing" }, undefined)).toBe(false);
  });
});

describe("default tap: the same on a button, a chip and a sub-button", () => {
  const press = (el: HTMLElement) => {
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
  };
  const h0 = () => mockHass([ent("lock.front", "locked"), ent("sensor.t", "21"), ent("switch.s", "on"), ent("climate.c", "heat"), ent("script.gate", "off"), ent("binary_sensor.d", "off")]);
  const watch = (el: Card) => {
    const seen: unknown[] = [];
    el.addEventListener("hass-more-info", (e) => seen.push(["more-info", (e as CustomEvent).detail.entityId]));
    el.addEventListener("hass-action", (e) => seen.push(["action", (e as CustomEvent).detail.config.tap_action]));
    return seen;
  };

  it("a lock or a sensor on a button opens details and sends nothing", async () => {
    for (const entity of ["lock.front", "sensor.t"]) {
      const h = h0();
      const el = await mountCard("button", { entity, layout: "wide" }, h);
      const seen = watch(el);
      press(el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!);
      await el.updateComplete;
      expect(h.calls).toEqual([]);
      expect(seen).toEqual([["more-info", entity]]);
    }
  });

  it("a lock or a sensor on a chip opens details and sends nothing", async () => {
    for (const entity of ["lock.front", "sensor.t"]) {
      const h = h0();
      const el = await mountCard("chips", { chips: [{ type: "action", entity, active_value: "x" }] }, h);
      const seen = watch(el);
      press(el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!);
      await el.updateComplete;
      expect(h.calls).toEqual([]);
      expect(seen).toEqual([["more-info", entity]]);
      // Details opened, nothing was chosen: no highlight.
      expect(el.shadowRoot!.querySelector('[role="button"]')!.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("a chip still runs a script and toggles a switch", async () => {
    const h = h0();
    const el = await mountCard("chips", { chips: [{ type: "action", entity: "script.gate" }, { type: "action", entity: "switch.s" }] }, h);
    el.shadowRoot!.querySelectorAll<HTMLElement>('[role="button"]').forEach(press);
    expect(h.calls).toEqual([
      ["script", "turn_on", {}, { entity_id: "script.gate" }],
      ["homeassistant", "toggle", {}, { entity_id: "switch.s" }],
    ]);
  });

  it("a sub-button: a lock and a script open details, a climate toggles", async () => {
    const h = h0();
    const el = await mountCard("entity", { entity: "binary_sensor.d", layout: "wide", sub_buttons: [{ entity: "lock.front" }, { entity: "climate.c" }, { entity: "script.gate" }] }, h);
    const seen = watch(el);
    el.shadowRoot!.querySelectorAll<HTMLElement>(".subbtns > [aria-disabled]").forEach(press);
    expect(seen).toEqual([
      ["action", { action: "more-info" }],
      ["action", { action: "toggle" }],
      ["action", { action: "more-info" }],
    ]);
    expect(JSON.stringify(seen)).not.toContain("unlock");
    expect(h.calls).toEqual([]);
  });
});

describe("button card: feedback without status_entity counts as no feedback", () => {
  const press = (el: HTMLElement) => {
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
  };

  it("no error card, a tap just runs, a hold opens the button's own details", async () => {
    vi.useFakeTimers();
    try {
      for (const feedback of [{}, { success_text: "Open" }, { status_entity: "" }, { status_entity: "", message_entity: "sensor.m" }, null]) {
        const h = mockHass([ent("script.gate", "off")]);
        const el = await mountCard("button", { entity: "script.gate", layout: "wide", feedback }, h);
        expect(el.shadowRoot!.querySelector('[role="alert"]'), JSON.stringify(feedback)).toBeNull();
        const row = el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!;
        press(row);
        await el.updateComplete;
        expect(h.calls).toEqual([["script", "turn_on", {}, { entity_id: "script.gate" }]]);
        expect(el.shadowRoot!.querySelector('[aria-busy="true"]')).toBeNull();
        const info: string[] = [];
        el.addEventListener("hass-more-info", (e) => info.push((e as CustomEvent).detail.entityId));
        row.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
        vi.advanceTimersByTime(600);
        row.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
        expect(info).toEqual(["script.gate"]);
        el.remove();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("with status_entity the card still waits for the answer", async () => {
    const h = mockHass([ent("script.gate", "off"), ent("sensor.s", "200")]);
    const el = await mountCard("button", { entity: "script.gate", layout: "wide", feedback: { status_entity: "sensor.s" } }, h);
    press(el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[aria-busy="true"]')).toBeTruthy();
    el.remove();
  });
});

describe("greeting card", () => {
  it("follows the clock, whatever the sun says", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 10, 4, 23, 0));
      // Sun already low in the afternoon of a Polish winter: no "Good night" at 16:30.
      const h = mockHass([ent("sun.sun", "below_horizon", { elevation: -20 })]);
      const late = await mountCard("greeting", {}, h);
      expect(late.shadowRoot!.textContent).toContain("Good night");
      vi.setSystemTime(new Date(2026, 10, 4, 16, 30));
      const day = await mountCard("greeting", {}, h);
      expect(day.shadowRoot!.textContent).toContain("Good afternoon");
      expect(day.shadowRoot!.textContent).not.toContain("Good night");
    } finally {
      vi.useRealTimers();
    }
  });

  it("no longer has a sun field", async () => {
    const cls = customElements.get("lumen-greeting-card") as unknown as { getConfigForm(): { schema: unknown[] } };
    expect(JSON.stringify(cls.getConfigForm().schema)).not.toContain("sun_entity");
  });
});

describe("small things every card does alike", () => {
  const PLUG = "power-plug-off";
  const html = (el: Card) => el.shadowRoot!.innerHTML;

  it("unavailable rows show the plug-off glyph", async () => {
    const h = mockHass([ent("binary_sensor.u", "unavailable"), ent("person.u", "unavailable"), ent("binary_sensor.k", "off"), ent("person.k", "home")]);
    const has = async (type: string, entity: string) => {
      const el = await mountCard(type, { entity, layout: "wide" }, h);
      const out = el.shadowRoot!.querySelector('[data-icon*="power-plug-off"], ha-icon[icon*="power-plug-off"]') !== null || html(el).includes(PLUG);
      el.remove();
      return out;
    };
    expect(await has("entity", "binary_sensor.u")).toBe(true);
    expect(await has("person", "person.u")).toBe(true);
    expect(await has("entity", "binary_sensor.k")).toBe(false);
    expect(await has("person", "person.k")).toBe(false);
  });

  it("cover buttons, a title and a reminder pill give haptic feedback", async () => {
    const h = mockHass([ent("cover.c", "open", { current_position: 50, supported_features: 15 }), ent("input_boolean.r", "on"), ent("sensor.s", "1")]);
    const buzz = (el: Card) => {
      const seen: string[] = [];
      el.addEventListener("haptic", (e) => seen.push((e as CustomEvent).detail));
      return seen;
    };
    const cover = await mountCard("cover", { entity: "cover.c" }, h);
    const c = buzz(cover);
    cover.shadowRoot!.querySelector<HTMLElement>("button.seg")!.click();
    expect(c.length).toBe(1);
    const title = await mountCard("title", { title: "T", entity: "sensor.s" }, h);
    const t = buzz(title);
    title.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!.click();
    expect(t.length).toBe(1);
    const rem = await mountCard("reminder", { entity: "input_boolean.r" }, h);
    await rem.updateComplete;
    (rem as unknown as { _open: boolean })._open = false;
    await rem.updateComplete;
    const r = buzz(rem);
    rem.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!.click();
    expect(r.length).toBe(1);
  });

  it("a person whose picture failed tries a new picture", async () => {
    const h = mockHass([ent("person.a", "home", { entity_picture: "/a.jpg" })]);
    const el = await mountCard("person", { entity: "person.a", layout: "wide" }, h);
    el.shadowRoot!.querySelector("img")!.dispatchEvent(new Event("error"));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("img")).toBeNull();
    el.hass = { ...h, states: { "person.a": ent("person.a", "home", { entity_picture: "/b.jpg" }) } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("img")?.getAttribute("src")).toBe("/b.jpg");
  });
});
