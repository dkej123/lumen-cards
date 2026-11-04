// @vitest-environment happy-dom
// Floating panel, compact heights, battery.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ent, layer, mockHass, mount as mountCard, settle, type Card } from "./helpers";
import { plural, setLanguage } from "../src/core/i18n";
import { FAB_ORDER } from "../src/core/layer";
import type { HassLike } from "../src/hass/types";
import { batteryLevel } from "../src/logic/battery";
import { badgeCount, bulkSegment, cardEntities, panelSummary, panelWarning } from "../src/logic/fab-sheet";

const TH = { hvac_modes: ["heat", "off"], preset_modes: ["comfort", "eco", "away"], min_temp: 5, max_temp: 30, target_temp_step: 0.5 };
const STATES = [
  ent("climate.salon", "heat", { ...TH, friendly_name: "Salon", hvac_action: "heating", temperature: 21, current_temperature: 20.4, preset_mode: "comfort" }),
  ent("climate.bedroom", "heat", { ...TH, friendly_name: "Bedroom", hvac_action: "idle", temperature: 19, current_temperature: 19.6, preset_mode: "comfort" }),
  ent("climate.bath", "heat", { ...TH, friendly_name: "Bath", hvac_action: "heating", temperature: 23, current_temperature: 21.8, preset_mode: "comfort", batteries: '{"a": {"battery": 9}, "b": {"battery": 70}}' }),
  ent("climate.ac", "cool", { hvac_modes: ["off", "cool"], preset_modes: ["none", "eco"], temperature: 22, current_temperature: 23 }),
  ent("climate.gone", "unavailable"),
  ent("binary_sensor.door", "off", { device_class: "door" }),
  ent("input_boolean.x", "on"),
  ent("person.ann", "home"),
  ent("alarm_control_panel.home", "disarmed"),
  ent("script.gate", "off"),
  ent("light.desk", "on", { brightness: 128, supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 3000, min_color_temp_kelvin: 2700, max_color_temp_kelvin: 6500 }),
];
const S = Object.fromEntries(STATES.map((e) => [e.entity_id, e]));
const card = (entity: string) => ({ type: "custom:lumen-climate-card", entity });
const THREE = [card("climate.salon"), card("climate.bedroom"), card("climate.bath")];

const hass = (states = S) => mockHass(states);

const mount = (type: string, config: Record<string, unknown>, h: HassLike = hass(), setup?: (el: Card) => void) => mountCard(type, config, h, setup);

beforeAll(async () => {
  await import("../src/lumen-cards");
  setLanguage("en");
});

afterEach(() => {
  document.body.innerHTML = "";
  setLanguage("en");
});

describe("floating panel logic", () => {
  const ids = cardEntities(THREE);
  it("entities of the cards (entity, entities, nested cards)", () => {
    expect(ids).toEqual(["climate.salon", "climate.bedroom", "climate.bath"]);
    expect(cardEntities([{ type: "entities", entities: ["light.desk", { entity: "person.ann" }] }, { type: "vertical-stack", cards: [{ entity: "script.gate" }] }])).toEqual(["light.desk", "person.ann", "script.gate"]);
  });
  it("summary: n of total heating with the average, one, none, no thermostats", () => {
    expect(panelSummary(ids, S, 3)).toBe("2 of 3 heating · avg 20.6°");
    expect(panelSummary(ids, S, 3, false)).toBe("2 of 3 heating");
    expect(panelSummary(["climate.salon", "climate.bedroom"], S, 2)).toBe("1 of 2 heating · avg 20°");
    expect(panelSummary(["climate.bedroom", "climate.gone"], S, 2)).toBe("Nothing is heating · avg 19.6°");
    expect(panelSummary(["light.desk"], S, 1)).toBe("1 card");
    setLanguage("pl");
    expect(panelSummary(ids, S, 3)).toBe("2 z 3 grzeją · śr. 20,6°");
    expect(panelSummary(["climate.salon"], S, 1)).toMatch(/^1 z 1 grzeje/);
    expect(panelSummary(["climate.bedroom"], S, 1)).toMatch(/^Nic nie grzeje/);
    expect(plural(5)).toBe("many");
    expect(plural(22)).toBe("few");
    expect(plural(12)).toBe("many");
  });
  it("badge count: heating thermostats, or the given entities (on = active)", () => {
    expect(badgeCount(undefined, ids, S)).toBe(2);
    expect(badgeCount([], ["climate.bedroom"], S)).toBe(0);
    expect(badgeCount(["climate.salon", "input_boolean.x", "binary_sensor.door"], ids, S)).toBe(2);
  });
  it("warning: low battery (< 15 %) first, then an unavailable entity", () => {
    expect(panelWarning(THREE, ids, S)).toMatchObject({ kind: "battery", icon: "mdi:battery-alert-variant-outline", text: "Battery 9% · Bath" });
    expect(panelWarning([card("climate.bath")], ["climate.bath"], { ...S, "climate.bath": ent("climate.bath", "heat", { batteries: '{"a": {"battery": 15}}' }) })).toBeNull();
    expect(panelWarning([card("climate.bath"), { ...card("climate.bath"), show_battery: false }].slice(1), ["climate.bath"], S)).toBeNull();
    expect(panelWarning([card("climate.salon"), card("climate.gone")], ["climate.salon", "climate.gone"], S)).toMatchObject({ kind: "unavailable", icon: "mdi:alert-circle-outline" });
    expect(panelWarning([card("climate.salon")], ["climate.salon"], S)).toBeNull();
  });
  it("'All' segment: ≥ 2 thermostats with the same preset_modes; mixed = nothing selected", () => {
    expect(bulkSegment(ids, S)).toEqual({ ids, presets: ["comfort", "eco"], selected: "comfort" });
    expect(bulkSegment(["climate.salon"], S)).toBeNull();
    expect(bulkSegment(["climate.salon", "climate.ac"], S)).toBeNull();
    const mixed = { ...S, "climate.bath": { ...S["climate.bath"], attributes: { ...S["climate.bath"].attributes, preset_mode: "eco" } } };
    expect(bulkSegment(ids, mixed)?.selected).toBeNull();
    const off = Object.fromEntries(ids.map((id) => [id, { ...S[id], state: "off" }]));
    expect(bulkSegment(ids, off)?.selected).toBe("off");
  });
  it("battery threshold: low below 15 % by default", () => {
    expect(batteryLevel(ent("climate.x", "heat", { battery_level: 14 }), undefined)).toEqual({ pct: 14, low: true });
    expect(batteryLevel(ent("climate.x", "heat", { battery_level: 15 }), undefined)).toEqual({ pct: 15, low: false });
  });
  it("FAB order: scenes, panels, alarm", () => {
    expect(FAB_ORDER.scenes).toBeLessThan(FAB_ORDER.panels);
    expect(FAB_ORDER.panels).toBeLessThan(FAB_ORDER.alarm);
  });
});

describe("floating panel card", () => {
  it("FAB with count and warning; tap opens the sheet with the cards and the 'All' segment; the FAB hides", async () => {
    const h = hass();
    const el = await mount("fab-sheet", { title: "Heating", icon: "mdi:radiator", cards: THREE, narrow_only: false }, h);
    expect(el.shadowRoot!.textContent!.trim()).toBe("");
    const fab = layer()!.querySelector<HTMLButtonElement>("button.acfab")!;
    expect(fab.getAttribute("style")).toContain("width:64px");
    expect(fab.getAttribute("style")).toContain("lumenPendingPulse");
    expect(fab.textContent).toContain("2");
    expect(fab.getAttribute("aria-label")).toContain("Battery 9% · Bath");
    fab.click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const root = layer()!;
    const dlg = root.querySelector('[role="dialog"]')!;
    expect(dlg.getAttribute("aria-label")).toBe("Heating");
    expect((dlg as HTMLElement).style.maxWidth).toBe("520px");
    expect(dlg.textContent).toContain("2 of 3 heating · avg 20.6°");
    expect(root.querySelectorAll("lumen-climate-card").length).toBe(3);
    expect(root.querySelector<HTMLButtonElement>("button.acfab")!.style.opacity).toBe("0");
    const segs = [...root.querySelectorAll<HTMLButtonElement>('[role="group"] button')];
    expect(segs.map((b) => b.textContent!.trim())).toEqual(["Comfort", "Eco", "Off"]);
    expect(segs[0].getAttribute("aria-pressed")).toBe("true");
    segs[1].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(h.calls.at(-1)).toEqual(["climate", "set_preset_mode", { preset_mode: "eco" }, { entity_id: ["climate.salon", "climate.bedroom", "climate.bath"] }]);
    segs[2].click();
    await new Promise((r) => setTimeout(r, 0));
    expect(h.calls.at(-1)).toEqual(["climate", "set_hvac_mode", { hvac_mode: "off" }, { entity_id: ["climate.salon", "climate.bedroom", "climate.bath"] }]);
    // Inner climate cards are the compact 56 px thermostat row.
    const row = (root.querySelector("lumen-climate-card") as Card).shadowRoot!.querySelector<HTMLElement>("[data-fx]")!;
    expect(row.getAttribute("style")).toContain("min-height:56px");
    root.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    await new Promise((r) => setTimeout(r, 300));
    await el.updateComplete;
    expect(layer()!.querySelector('[role="dialog"]')).toBeNull();
    el.remove();
  });

  it("wide screen with narrow_only: the 52 px trigger row; edit mode: dashed row with the note", async () => {
    const el = await mount("fab-sheet", { title: "Heating", cards: THREE });
    const row = el.shadowRoot!.querySelector<HTMLElement>(".trow")!;
    expect(row.getAttribute("style")).toContain("height:52px");
    expect(row.textContent).toContain("2 of 3 heating");
    expect(layer()).toBeNull();
    const ed = await mount("fab-sheet", { title: "Heating", cards: THREE, narrow_only: false }, hass(), (x) => (x.editMode = true));
    const erow = ed.shadowRoot!.querySelector<HTMLElement>(".trow")!;
    expect(erow.getAttribute("style")).toContain("dashed");
    expect(erow.textContent).toContain("FAB on every screen");
    expect(ed.getGridOptions()).toMatchObject({ rows: "auto" });
  });

  it("no cards: nothing outside edit mode; the sheet shows the empty state", async () => {
    const el = await mount("fab-sheet", { title: "Heating", narrow_only: false });
    expect(el.shadowRoot!.textContent!.trim()).toBe("");
    expect(layer()).toBeNull();
    const ed = await mount("fab-sheet", { title: "Heating" }, hass(), (x) => (x.editMode = true));
    (ed as unknown as { open(): void }).open();
    await ed.updateComplete;
    expect(layer()!.textContent).toContain("No cards in the panel");
  });

  it("the editor is the panel's fields above HA's stack editor; the fallback form still holds the cards", () => {
    const ctor = customElements.get("lumen-fab-sheet-card") as unknown as { getConfigElement(): HTMLElement & { form: { schema: { name?: string }[] }; fallback: { schema: unknown } } };
    const el = ctor.getConfigElement();
    expect(el.localName).toBe("lumen-stack-editor");
    const names = JSON.stringify(el.form.schema);
    expect(names).toContain('"icon"');
    expect(names).not.toContain('"name":"cards"');
    expect(names).not.toContain('"name":"title"');
    expect(JSON.stringify(el.fallback.schema)).toContain('"cards"');
  });

  it("the open panel may grow to the top of the screen", async () => {
    const el = await mount("fab-sheet", { title: "Heating", cards: THREE }, hass(), (x) => (x.editMode = true));
    (el as unknown as { open(): void }).open();
    await el.updateComplete;
    const style = layer()!.querySelector('[role="dialog"]')!.getAttribute("style")!;
    const norm = style.replace(/\s+/g, "");
    expect(norm).toContain("max-height:calc(100%-env(safe-area-inset-top)-12px)");
    expect(norm).not.toContain("max-height:85%");
  });

  it("editor preview: the real cards in a static sheet, and no taps reach them", async () => {
    const el = await mount("fab-sheet", { title: "Heating", cards: THREE }, hass(), (x) => (x.preview = true));
    await vi.waitFor(() => expect(el.shadowRoot!.querySelectorAll("lumen-climate-card").length).toBe(3));
    const t = el.shadowRoot!.textContent!.replace(/\s+/g, " ");
    expect(t).toContain("Heating");
    const inner = el.shadowRoot!.querySelector("lumen-climate-card")!;
    await (inner as unknown as Card).updateComplete;
    expect(inner.shadowRoot!.textContent).toContain("Salon");
    expect(el.shadowRoot!.querySelector<HTMLElement>("[aria-label]")!.getAttribute("style")).toContain("pointer-events:none");
  });
});

describe("compact looks: 44 px, rows auto", () => {
  const sub = [{ entity: "input_boolean.x", icon: "mdi:power" }];
  it("entity / button / alarm cell 44 px with one 30 px sub-button; lock cell 44 px", async () => {
    for (const [type, entity] of [["entity", "binary_sensor.door"], ["button", "script.gate"], ["alarm", "alarm_control_panel.home"]]) {
      const el = await mount(type, { entity, layout: "compact", sub_buttons: sub });
      const cell = el.shadowRoot!.querySelector<HTMLElement>("[data-fx]")!;
      expect(cell.getAttribute("style"), type).toContain("height:44px");
      expect(cell.querySelector<HTMLElement>(".acc")!.getAttribute("style")).toContain("height:44px");
      expect(cell.querySelector<HTMLElement>(".subbtns > div")!.getAttribute("style")).toContain("height:30px");
      expect(el.getGridOptions()).toMatchObject({ rows: "auto" });
    }
  });
  it("person pill 44 px with a 30 px avatar", async () => {
    const el = await mount("person", { entity: "person.ann", layout: "compact" });
    const pill = el.shadowRoot!.querySelector<HTMLElement>("[data-fx]")!;
    expect(pill.getAttribute("style")).toContain("height:44px");
    expect(pill.innerHTML).toContain("width:30px;height:30px");
  });
  it("alarm cell: hold 500 ms = the main command (arm opens the pad)", async () => {
    vi.useFakeTimers();
    const el = await mount("alarm", { entity: "alarm_control_panel.home", layout: "compact" });
    const cell = el.shadowRoot!.querySelector<HTMLElement>(".acc")!;
    cell.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    vi.advanceTimersByTime(600);
    cell.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    vi.useRealTimers();
    await el.updateComplete;
    expect(layer()?.querySelector('[role="dialog"]')).toBeTruthy();
  });
  it("climate compact row: 56 px, battery chip with %, off disables −/+", async () => {
    const el = await mount("climate", { entity: "climate.bath", layout: "compact" });
    const row = el.shadowRoot!.querySelector<HTMLElement>("[data-fx]")!;
    expect(row.getAttribute("style")).toContain("min-height:56px");
    expect(row.textContent).toContain("9%");
    expect(row.textContent).toContain("Heating");
    const off = await mount("climate", { entity: "climate.salon", layout: "compact" }, hass({ ...S, "climate.salon": { ...S["climate.salon"], state: "off" } }));
    const btns = [...off.shadowRoot!.querySelectorAll<HTMLButtonElement>("button[aria-label]")].filter((b) => b.disabled);
    expect(btns.length).toBe(2);
    expect(off.shadowRoot!.textContent).toContain("Off");
  });
});

describe("hiddenByHa", () => {
  it("a card inside a hidden hui-card / hui-section has no layer", async () => {
    const { hiddenByHa } = await import("../src/core/layer");
    const view = document.createElement("hui-sections-view");
    const section = document.createElement("hui-section");
    const wrap = document.createElement("hui-card");
    const card = document.createElement("div");
    wrap.append(card);
    section.append(wrap);
    view.append(section);
    document.body.append(view);
    expect(hiddenByHa(card)).toBe(false);
    section.hidden = true;
    expect(hiddenByHa(card)).toBe(true);
    section.hidden = false;
    wrap.hidden = true;
    expect(hiddenByHa(card)).toBe(true);
    view.remove();
  });
});

describe("lumen-bar-card", () => {
  it("inner Lumen cards are compact cells without their own weather effects", async () => {
    const { barInner } = await import("../src/cards/bar");
    expect(barInner({ type: "custom:lumen-entity-card", entity: "binary_sensor.d", layout: "wide" })).toEqual({ type: "custom:lumen-entity-card", entity: "binary_sensor.d", layout: "compact", weather_effects: false });
    expect(barInner({ type: "tile", entity: "light.x" })).toEqual({ type: "tile", entity: "light.x" });
  });
});

describe("climate mode order", () => {
  it("hvac_modes / fan_modes keep the configured order", async () => {
    await import("../src/lumen-cards");
    const el = document.createElement("lumen-climate-card") as HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<boolean> };
    el.setConfig({ type: "custom:lumen-climate-card", entity: "climate.ac", layout: "wide", hvac_modes: ["off", "heat", "cool"], fan_modes: ["auto", "low", "high"] });
    el.hass = {
      states: { "climate.ac": { entity_id: "climate.ac", state: "off", attributes: { hvac_modes: ["cool", "heat", "off", "dry"], fan_modes: ["high", "low", "auto", "turbo"], fan_mode: "low", temperature: 22 }, last_changed: "", last_updated: "" } },
      language: "en", callService: async () => undefined, callWS: async () => undefined,
    };
    document.body.append(el);
    await el.updateComplete;
    const labels = (sel: string) => [...el.shadowRoot!.querySelectorAll(sel)].map((b) => b.textContent!.trim());
    const all = labels("button");
    for (const l of ["Off", "Heat", "Cool", "Auto", "Low", "High"]) expect(all).toContain(l);
    expect(all.indexOf("Off")).toBeLessThan(all.indexOf("Heat"));
    expect(all.indexOf("Heat")).toBeLessThan(all.indexOf("Cool"));
    expect(all.indexOf("Auto")).toBeLessThan(all.indexOf("High"));
    el.remove();
  });
});

describe("lumen stacks", () => {
  it("validate cards / align; the whole stack capped at 80 % aligned left; horizontal = a row", async () => {
    const { validateStack } = await import("../src/cards/stack");
    expect(() => validateStack({ cards: "x" as never })).toThrow();
    expect(() => validateStack({ align: "middle" as never })).toThrow();
    expect(() => validateStack({ card_width: "auto" as never })).toThrow();
    expect(() => validateStack({ card_width: "content" })).not.toThrow();
    await import("../src/lumen-cards");
    type El = HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<boolean> };
    const hass = { states: {}, language: "en", callService: async () => undefined, callWS: async () => undefined };
    const v = document.createElement("lumen-vertical-stack-card") as El;
    v.setConfig({ type: "custom:lumen-vertical-stack-card", cards: [], title: "Group", max_width: 80, max_width_unit: "%", align: "start" });
    v.hass = hass;
    document.body.append(v);
    await v.updateComplete;
    expect(v.style.maxWidth).toBe("80%");
    expect(v.style.marginLeft).toBe("0px");
    expect(v.shadowRoot!.textContent).toContain("Group");
    expect(v.shadowRoot!.textContent).toContain("Add cards");
    v.remove();
    expect(customElements.get("lumen-horizontal-stack-card")).toBeTruthy();
  });
});

describe("climate floating button", () => {
  const unit = (extra: Record<string, unknown> = {}) =>
    ent("climate.ac", "cool", { hvac_modes: ["off", "cool", "heat"], temperature: 22, swing_modes: ["off", "on"], swing_mode: "off", preset_modes: ["eco", "boost"], preset_mode: "eco", fan_modes: ["low"], ...extra });
  const fabEl = () => layer()!.querySelector<HTMLElement>(".acfab")!;
  const down = () => fabEl().dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, bubbles: true, composed: true }));
  const open = async (el: Card) => {
    fabEl().click();
    await settle(el);
    return layer()!.querySelector<HTMLElement>('[role="dialog"]')!;
  };

  it("takes the size of its slot: 64 px at the bottom", async () => {
    const h = mockHass([unit(), ent("climate.b", "cool", { temperature: 20 })]);
    const a = await mountCard("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false }, h);
    await settle(a);
    const first = fabEl().getAttribute("style")!;
    expect(first).toContain("width:64px");
    expect(first).toContain("height:64px");
    a.remove();
  });

  it("the 48 px size above another button", async () => {
    const h = mockHass([unit(), ent("climate.b", "cool", { temperature: 20 })]);
    const a = await mountCard("climate", { entity: "climate.b", fab: true, fab_narrow_only: false }, h);
    const b = await mountCard("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false }, h);
    await settle(a);
    await settle(b);
    const sizes = [...document.querySelectorAll("lumen-cards-layer")].map((l) => l.shadowRoot!.querySelector<HTMLElement>(".acfab")!.style.width);
    expect(sizes).toEqual(["64px", "48px"]);
    a.remove();
    b.remove();
  });

  it("a hold takes 500 ms like everywhere, a scroll cancels it, the keyboard can do it", async () => {
    vi.useFakeTimers();
    try {
      const h = mockHass([unit()]);
      const el = await mountCard("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false }, h);
      await vi.advanceTimersByTimeAsync(0);
      await el.updateComplete;
      down();
      vi.advanceTimersByTime(499);
      expect(h.calls.length).toBe(0);
      vi.advanceTimersByTime(2);
      expect(h.calls.at(-1)?.[1]).toBe("turn_off");
      fabEl().dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
      // The click that ends a hold does not open the window.
      fabEl().dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
      expect(layer()!.querySelector('[role="dialog"]')).toBeNull();

      await vi.advanceTimersByTimeAsync(11_000);
      await el.updateComplete;
      h.calls.length = 0;
      down();
      fabEl().dispatchEvent(new PointerEvent("pointermove", { clientX: 0, clientY: 40, bubbles: true, composed: true }));
      vi.advanceTimersByTime(600);
      expect(h.calls.length).toBe(0);
      fabEl().dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, composed: true }));

      fabEl().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));
      expect(h.calls.at(-1)?.[1]).toBe("turn_off");
    } finally {
      vi.useRealTimers();
    }
  });

  it("its window has what the card has: swing, presets, the battery warning", async () => {
    const h = mockHass([unit({ battery_level: 5 })]);
    const el = await mountCard("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false }, h);
    await settle(el);
    const dlg = await open(el);
    expect(dlg.querySelector('[role="group"][aria-label="Swing"]')).not.toBeNull();
    expect(dlg.textContent).toContain("Boost");
    expect(dlg.querySelector('[role="status"]')?.textContent).toContain("5%");
    [...dlg.querySelectorAll("button")].find((b) => b.textContent!.includes("Boost"))!.click();
    expect(h.calls.at(-1)).toEqual(["climate", "set_preset_mode", { preset_mode: "boost" }, { entity_id: "climate.ac" }]);
    el.remove();
  });

  it("show_swing and show_presets hide them there too", async () => {
    const el = await mountCard("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false, show_swing: false, show_presets: false }, mockHass([unit()]));
    await settle(el);
    const dlg = await open(el);
    expect(dlg.querySelector('[role="group"][aria-label="Swing"]')).toBeNull();
    expect(dlg.textContent).not.toContain("Boost");
    el.remove();
  });
});

describe("climate card while unavailable or off", () => {
  const step = (r: ParentNode) => [...r.querySelectorAll<HTMLButtonElement>("button")].filter((b) => ["Lower", "Raise", "Decrease", "Increase"].some((w) => b.getAttribute("aria-label")?.includes(w)));

  it("the full card looks like the compact row: dashed, no glass, nothing to press", async () => {
    const h = mockHass([ent("climate.u", "unavailable", { hvac_modes: ["heat", "off"] })]);
    const el = await mountCard("climate", { entity: "climate.u", layout: "wide" }, h);
    const frame = el.shadowRoot!.querySelector<HTMLElement>("[data-fx]")!.getAttribute("style")!;
    expect(frame).toContain("dashed");
    expect(frame).not.toContain("backdrop-filter");
    const all = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")];
    expect(all.length).toBeGreaterThan(2);
    expect(all.every((b) => b.disabled)).toBe(true);
    el.remove();
  });

  it("off: − and + are disabled, power and modes still work", async () => {
    const el = await mountCard("climate", { entity: "climate.o", layout: "wide" }, mockHass([ent("climate.o", "off", { hvac_modes: ["heat", "off"], temperature: 20 })]));
    const s = step(el.shadowRoot!);
    expect(s.length).toBe(2);
    expect(s.every((b) => b.disabled)).toBe(true);
    expect(el.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!.disabled).toBe(false);
    el.remove();
  });
});

describe("floating panel options", () => {
  it("does not offer an accent colour it has no use for", async () => {
    const cls = customElements.get("lumen-fab-sheet-card") as unknown as { getConfigForm(): { schema: unknown[] } };
    expect(JSON.stringify(cls.getConfigForm().schema)).not.toContain("accent_color");
  });
});

describe('the "All" segment', () => {
  it("a choice the thermostats never follow goes away by itself after 10 s", async () => {
    vi.useFakeTimers();
    try {
      const c = (id: string) => ent(id, "heat", { hvac_modes: ["heat", "off"], preset_modes: ["comfort", "eco"], preset_mode: "comfort" });
      const h = mockHass([c("climate.a"), c("climate.b")]);
      const el = await mountCard("fab-sheet", { narrow_only: false, cards: [{ type: "custom:lumen-climate-card", entity: "climate.a" }, { type: "custom:lumen-climate-card", entity: "climate.b" }] }, h);
      await vi.advanceTimersByTimeAsync(0);
      layer()!.querySelector<HTMLElement>(".acfab")!.click();
      await vi.advanceTimersByTimeAsync(0);
      const row = () => [...layer()!.querySelectorAll<HTMLButtonElement>('[role="group"] button.seg')];
      const eco = () => row().find((b) => b.textContent!.includes("Eco"))!;
      eco().click();
      await vi.advanceTimersByTimeAsync(1);
      expect(eco().getAttribute("aria-pressed")).toBe("true");
      await vi.advanceTimersByTimeAsync(10_100);
      expect(eco().getAttribute("aria-pressed")).toBe("false");
      el.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
