// @vitest-environment happy-dom
// Catalog 2026-10-29, sections 01–04, 07, 08: light, entity, button, person, reminder, chips / FAB.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setLanguage } from "../src/core/i18n";
import { FAB_ORDER, fabBottom, fabRight, fabSize, fabSlot, releaseFab } from "../src/core/layer";
import { subButtonLimit } from "../src/core/sub-buttons";
import type { HassEntity, HassLike } from "../src/hass/types";
import { hsToRgb, hueName, miredPresets, mixedGroup, swatchIndex, whiteGradient } from "../src/logic/light";
import { avatarColor, presence } from "../src/logic/presence";

const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, ago = 600_000): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id.split(".")[1], ...attributes },
  last_changed: new Date(Date.now() - ago).toISOString(),
  last_updated: new Date(Date.now() - ago).toISOString(),
});

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

type Hass = HassLike & { calls: unknown[][] };
const hass = (states = STATES): Hass => {
  const calls: unknown[][] = [];
  return {
    calls,
    states: Object.fromEntries(states.map((e) => [e.entity_id, e])),
    user: { id: "u1", name: "Ann", is_admin: true },
    language: "en",
    locale: { language: "en" },
    themes: { darkMode: false },
    formatEntityState: (e) => e.state,
    callService: async (...args) => {
      calls.push(args);
      return undefined;
    },
    callWS: async () => ({}) as never,
  };
};

type Card = HTMLElement & { setConfig(c: unknown): void; hass: HassLike; updateComplete: Promise<boolean>; preview: boolean };

const mount = async (type: string, config: Record<string, unknown>, h: HassLike = hass()) => {
  const el = document.createElement(`lumen-${type}-card`) as Card;
  el.setConfig({ type: `custom:lumen-${type}-card`, ...config });
  el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};
const text = (el: Card) => el.shadowRoot!.textContent!.replace(/\s+/g, " ");

beforeAll(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
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

  it("compact is the low 52 px tile (owner: no square tiles)", async () => {
    const el = await mount("light", { entity: "light.c", layout: "compact" });
    expect(text(el)).toContain("Off");
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    expect(tile.getAttribute("style")).toContain("52px");
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
    // Compact entity = access bar cell: no room for sub-buttons.
    expect(compact.shadowRoot!.querySelectorAll(".subbtns > [aria-disabled]").length).toBe(0);
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
});

describe("chips and floating buttons", () => {
  it("the scene activated last is the active chip", async () => {
    const { activeScene } = await import("../src/cards/chips");
    const h = hass();
    expect(activeScene([{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.evening" }], h.states)).toBe("scene.evening");
  });

  it("stack from the bottom: scenes 64, then 48 px every 12 px, centred", () => {
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
    expect(fabRight(48)).toContain("+ 8px");
    [climate, scenes, alarm].forEach(releaseFab);
  });
});
