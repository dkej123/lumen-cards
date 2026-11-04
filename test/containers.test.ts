// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InnerCards } from "../src/core/sheet";
import type { LumenStackEditor } from "../src/core/stack-editor";
import { ent, layer, mockHass, mount, settle } from "./helpers";

beforeAll(async () => {
  await import("../src/lumen-cards");
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const host = () => ({ addController: vi.fn(), removeController: vi.fn(), requestUpdate: vi.fn(), updateComplete: Promise.resolve(true) });

describe("InnerCards", () => {
  const cfgs = [{ type: "custom:lumen-fan-card", entity: "fan.f" }];

  it("builds once per list, passes hass on, rebuilds after invalidate", async () => {
    const h = host();
    const inner = new InnerCards(h, (c) => ({ ...c, name: "Fan" }));
    const hass = mockHass([ent("fan.f", "on")]);
    inner.setHass(hass);
    await inner.build(cfgs);
    expect(inner.cards).toHaveLength(1);
    expect(inner.cards[0].localName).toBe("lumen-fan-card");
    expect(inner.cards[0].hass).toBe(hass);
    const first = inner.cards[0];
    await inner.build(cfgs);
    expect(inner.cards[0]).toBe(first);
    expect(inner.invalidate(cfgs)).toBe(false);
    expect(inner.invalidate([...cfgs])).toBe(true);
    expect(inner.cards).toHaveLength(0);
  });

  it("ll-rebuild replaces the card, also a second time", async () => {
    const inner = new InnerCards(host(), (c) => c);
    await inner.build(cfgs);
    const first = inner.cards[0];
    first.dispatchEvent(new Event("ll-rebuild"));
    await tick();
    const second = inner.cards[0];
    expect(second).not.toBe(first);
    second.dispatchEvent(new Event("ll-rebuild"));
    await tick();
    expect(inner.cards[0]).not.toBe(second);
  });

  it("a cards value that is not a list builds nothing", async () => {
    const inner = new InnerCards(host(), (c) => c);
    await inner.build("x" as never);
    expect(inner.cards).toEqual([]);
  });
});

describe("Lumen stack editor", () => {
  type Fake = HTMLElement & { config?: unknown; setConfig(c: unknown): void };
  beforeAll(() => {
    // HA's stack editor, as HA loads it: hui-vertical-stack-card.getConfigElement()
    customElements.define("fake-stack-editor", class extends HTMLElement { config?: unknown; setConfig(c: unknown) { this.config = c; } });
    customElements.define("hui-vertical-stack-card", class extends HTMLElement { static async getConfigElement() { return document.createElement("fake-stack-editor"); } });
  });

  it("feeds HA's editor a plain stack and merges both parts back", async () => {
    const ctor = customElements.get("lumen-vertical-stack-card") as unknown as { getConfigElement(): LumenStackEditor };
    const ed = ctor.getConfigElement();
    const cfg = { type: "custom:lumen-vertical-stack-card", max_width: 80, max_width_unit: "%", title: "A", cards: [{ type: "tile", entity: "sun.sun" }] };
    ed.setConfig(cfg);
    const out: Record<string, unknown>[] = [];
    ed.addEventListener("config-changed", (e) => out.push((e as CustomEvent).detail.config));
    document.body.append(ed);
    await tick();
    await tick();
    await ed.updateComplete;
    const stack = ed.shadowRoot!.querySelector("fake-stack-editor") as Fake;
    expect(stack.config).toEqual({ type: "vertical-stack", cards: cfg.cards, title: "A" });
    // HA's editor: new cards and title, the Lumen fields stay
    stack.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { type: "vertical-stack", title: "B", cards: [] } }, bubbles: true, composed: true }));
    expect(out.at(-1)).toEqual({ type: "custom:lumen-vertical-stack-card", max_width: 80, max_width_unit: "%", title: "B", cards: [] });
    // the Lumen fields: new width, the cards and title stay
    const fields = ed.shadowRoot!.querySelector("lumen-form-editor")!;
    fields.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { type: "custom:lumen-vertical-stack-card", max_width: 50 } }, bubbles: true, composed: true }));
    expect(out.at(-1)).toEqual({ type: "custom:lumen-vertical-stack-card", max_width: 50, title: "B", cards: [] });
    ed.remove();
  });

  const open = async (card: string, cfg: Record<string, unknown>) => {
    const ctor = customElements.get(`lumen-${card}-card`) as unknown as { getConfigElement(): LumenStackEditor };
    const ed = ctor.getConfigElement();
    expect(ed.localName).toBe("lumen-stack-editor");
    ed.setConfig(cfg);
    const out: Record<string, unknown>[] = [];
    ed.addEventListener("config-changed", (e) => out.push((e as CustomEvent).detail.config));
    document.body.append(ed);
    await tick();
    await tick();
    await ed.updateComplete;
    const stack = ed.shadowRoot!.querySelector("fake-stack-editor") as Fake;
    const change = (config: unknown) => stack.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
    const fields = ed.shadowRoot!.querySelector("lumen-form-editor") as HTMLElement & { form: { schema: unknown[] } };
    return { ed, out, stack, change, fields };
  };

  it("the bar gets the cards from HA's editor and never writes a title", async () => {
    const cards = [{ type: "tile", entity: "sun.sun" }];
    const { ed, out, stack, change, fields } = await open("bar", { type: "custom:lumen-bar-card", cards, color_scheme: "dark" });
    expect(stack.config).toEqual({ type: "vertical-stack", cards });
    change({ type: "vertical-stack", title: "Typed", cards: [] });
    expect(out.at(-1)).toEqual({ type: "custom:lumen-bar-card", color_scheme: "dark", cards: [] });
    fields.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { type: "custom:lumen-bar-card", color_scheme: "light" } }, bubbles: true, composed: true }));
    expect(out.at(-1)).toEqual({ type: "custom:lumen-bar-card", color_scheme: "light", cards: [] });
    ed.remove();
  });

  it("HA's title field is taken away on the bar", async () => {
    const proto = customElements.get("fake-stack-editor")!.prototype as { _schema?: unknown };
    proto._schema = [{ name: "title" }];
    const { ed, stack } = await open("bar", { type: "custom:lumen-bar-card", cards: [] });
    expect((stack as unknown as { _schema: unknown })._schema).toEqual([]);
    delete proto._schema;
    ed.remove();
  });

  it("the pop-up's name is HA's title; hash and its other fields stay above and are kept", async () => {
    const cards = [{ type: "tile", entity: "sun.sun" }];
    const cfg = { type: "custom:lumen-popup-card", hash: "#room", name: "Room", auto_close: 5, cards };
    const { ed, out, stack, change, fields } = await open("popup", cfg);
    expect(stack.config).toEqual({ type: "vertical-stack", cards, title: "Room" });
    const own = JSON.stringify(fields.form.schema);
    for (const k of ["hash", "icon", "show_trigger", "auto_close"]) expect(own).toContain(`"name":"${k}"`);
    expect(own).not.toContain('"name":"name"');
    expect(own).not.toContain('"name":"cards"');
    change({ type: "vertical-stack", title: "Lounge", cards: [] });
    expect(out.at(-1)).toEqual({ type: "custom:lumen-popup-card", hash: "#room", auto_close: 5, name: "Lounge", cards: [] });
    expect(out.at(-1)).not.toHaveProperty("title");
    change({ type: "vertical-stack", cards: [] });
    expect(out.at(-1)).not.toHaveProperty("name");
    fields.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { type: "custom:lumen-popup-card", hash: "#other" } }, bubbles: true, composed: true }));
    expect(out.at(-1)).toEqual({ type: "custom:lumen-popup-card", hash: "#other", cards: [] });
    ed.remove();
  });

  it("without HA's editor the bar and the pop-up fall back to the full form", () => {
    for (const card of ["bar", "popup"]) {
      const ed = (customElements.get(`lumen-${card}-card`) as unknown as { getConfigElement(): LumenStackEditor }).getConfigElement();
      expect(JSON.stringify(ed.fallback.schema)).toContain('"name":"cards"');
    }
  });
});

describe("scene chips", () => {
  it("highlights no scene: a scene has no on state, only the time it last ran", async () => {
    const h = mockHass({ "scene.movie": ent("scene.movie", "2026-10-30T08:00:00+00:00"), "scene.bed": ent("scene.bed", "2026-11-01T23:00:00+00:00") });
    const el = await mount("chips", { fab: true, fab_narrow_only: false, chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.bed" }] }, h);
    await settle(el);
    const list = [...layer()!.querySelectorAll('[role] button, div > button')].filter((b) => !b.classList.contains("acfab")) as HTMLElement[];
    expect(list.length).toBe(2);
    for (const b of list) {
      expect(b.style.background).toBe("transparent");
      expect(b.hasAttribute("aria-pressed")).toBe(false);
    }
    el.remove();
  });

  it("the row of chips highlights no scene either", async () => {
    const h = mockHass({ "scene.movie": ent("scene.movie", "2026-10-30T08:00:00+00:00"), "scene.bed": ent("scene.bed", "2026-11-01T23:00:00+00:00") });
    const el = await mount("chips", { chips: [{ type: "action", entity: "scene.movie" }, { type: "action", entity: "scene.bed" }] }, h);
    const row = [...el.shadowRoot!.querySelectorAll("[data-fx]")] as HTMLElement[];
    expect(row.length).toBe(2);
    expect(new Set(row.map((c) => c.getAttribute("style"))).size).toBe(1);
    for (const c of row) expect(c.hasAttribute("aria-pressed")).toBe(false);
    el.remove();
  });
});

describe("switching dashboard tabs", () => {
  it("a card put back on the page shows its floating button again without any state change", async () => {
    const h = mockHass({ "scene.movie": ent("scene.movie", "2026-10-30T08:00:00+00:00") });
    const el = await mount("chips", { fab: true, fab_narrow_only: false, chips: [{ type: "action", entity: "scene.movie" }] }, h);
    await settle(el);
    expect(layer()?.querySelector(".acfab")).toBeTruthy();
    const parent = el.parentElement!;
    el.remove();
    await settle(el);
    expect(document.querySelector("lumen-cards-layer")).toBeNull();
    parent.append(el);
    await settle(el);
    expect(layer()?.querySelector(".acfab")).toBeTruthy();
    el.remove();
  });
});

describe("light behind a relay", () => {
  const hallway = () =>
    mockHass({
      "light.group": ent("light.group", "on", { brightness: 171, supported_color_modes: ["brightness"] }),
      "light.relay": ent("light.relay", "off", { supported_color_modes: ["onoff"] }),
    });
  const slide = async (h: ReturnType<typeof mockHass>) => {
    const el = await mount("light", { entity: "light.group", power_entity: "light.relay", layout: "wide" }, h);
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    tile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 64, right: 200, bottom: 64, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const ev = (type: string, x: number) => tile.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 20, button: 0, bubbles: true, pointerId: 1 }));
    ev("pointerdown", 20);
    ev("pointermove", 120);
    ev("pointerup", 120);
    return el;
  };

  it("a slide with the relay off switches the relay on, then sets the brightness", async () => {
    vi.useFakeTimers();
    try {
      const h = hallway();
      const el = await slide(h);
      expect(h.calls).toEqual([["homeassistant", "turn_on", {}, { entity_id: "light.relay" }]]);
      vi.advanceTimersByTime(6000);
      expect(h.calls.at(-1)).toEqual(["light", "turn_on", { brightness_pct: 60 }, { entity_id: "light.group" }]);
      el.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a slide with the relay on only sets the brightness", async () => {
    const h = hallway();
    h.states["light.relay"] = ent("light.relay", "on", { supported_color_modes: ["onoff"] });
    const el = await slide(h);
    expect(h.calls).toEqual([["light", "turn_on", { brightness_pct: 60 }, { entity_id: "light.group" }]]);
    el.remove();
  });
});

describe("light behind several relays", () => {
  const bath = (a = "on", b = "off") =>
    mockHass({
      "light.group": ent("light.group", "on", { brightness: 128, color_temp_kelvin: 2700, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 4000, supported_color_modes: ["color_temp"], color_mode: "color_temp" }),
      "light.relay1": ent("light.relay1", a, { supported_color_modes: ["onoff"] }),
      "light.relay2": ent("light.relay2", b, { supported_color_modes: ["onoff"] }),
    });
  const card = async (h: ReturnType<typeof mockHass>) => {
    const el = await mount("light", { entity: "light.group", power_entities: ["light.relay1", "light.relay2"], layout: "wide" }, h);
    const tile = el.shadowRoot!.querySelector<HTMLElement>(".tile")!;
    tile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 64, right: 200, bottom: 64, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const ev = (type: string, x: number) => tile.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 20, button: 0, bubbles: true, pointerId: 1 }));
    return { el, tile, ev };
  };

  it("a tap on the card does nothing", async () => {
    const h = bath();
    const { el, ev } = await card(h);
    ev("pointerdown", 20);
    ev("pointerup", 20);
    expect(h.calls).toEqual([]);
    el.remove();
  });

  it("with any relay on a slide sets the brightness of the group, and no relay changes", async () => {
    const h = bath();
    const { el, ev } = await card(h);
    ev("pointerdown", 20);
    ev("pointermove", 120);
    ev("pointerup", 120);
    expect(h.calls).toEqual([["light", "turn_on", { brightness_pct: 60 }, { entity_id: "light.group" }]]);
    el.remove();
  });

  it("with all relays off a slide does nothing, whatever the bulbs still report", async () => {
    const h = bath("off", "off");
    const { el, tile, ev } = await card(h);
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    ev("pointerdown", 20);
    ev("pointermove", 120);
    ev("pointerup", 120);
    expect(h.calls).toEqual([]);
    el.remove();
  });

  it("has one button per relay, and it switches only that relay", async () => {
    const h = bath();
    const { el, tile } = await card(h);
    const buttons = [...tile.querySelectorAll<HTMLElement>(".subbtns > div")];
    expect(buttons.length).toBe(2);
    const fired: string[] = [];
    el.addEventListener("hass-action", (e) => fired.push(JSON.stringify((e as CustomEvent).detail)));
    const b = buttons[1];
    b.dispatchEvent(new PointerEvent("pointerdown", { clientX: 1, clientY: 1, button: 0, bubbles: true, composed: true }));
    b.dispatchEvent(new PointerEvent("pointerup", { clientX: 1, clientY: 1, button: 0, bubbles: true, composed: true }));
    expect(fired.length).toBe(1);
    expect(fired[0]).toContain("light.relay2");
    expect(fired[0]).toContain("toggle");
    expect(h.calls).toEqual([]);
    el.remove();
  });

  it("its buttons take a soft tint of the light, not the solid accent", async () => {
    const { el, tile } = await card(bath());
    const [on, off] = [...tile.querySelectorAll<HTMLElement>(".subbtns > div")].map((b) => b.getAttribute("style") ?? "");
    expect(on).toContain("color-mix");
    expect(on).not.toContain("--lumen-on-accent");
    expect(off).toContain("transparent");
    el.remove();
  });

  it("shows how many relays are on", async () => {
    const h = bath();
    const { el, tile } = await card(h);
    expect(tile.getAttribute("aria-label")).toMatch(/1 .*2/);
    el.remove();
  });
});

describe("light card editor", () => {
  it("offers the relays and the extra buttons", async () => {
    const form = (customElements.get("lumen-light-card") as unknown as { getConfigForm(): { schema: { name?: string; selector?: Record<string, Record<string, unknown>> }[] } }).getConfigForm();
    const relays = form.schema.find((f) => f.name === "power_entities");
    expect(relays?.selector?.entity.multiple).toBe(true);
    expect(form.schema.some((f) => f.name === "sub_buttons")).toBe(true);
  });
});

describe("a card off the page", () => {
  const chips = () => mockHass({ "scene.movie": ent("scene.movie", "2026-10-30T08:00:00+00:00") });
  const cfg = { fab: true, fab_narrow_only: false, chips: [{ type: "action", entity: "scene.movie" }] };

  it("an update queued before leaving the page leaves no floating button behind", async () => {
    const el = await mount("chips", cfg, chips());
    await settle(el);
    el.requestUpdate();
    el.remove();
    await settle(el);
    expect(document.querySelectorAll("lumen-cards-layer").length).toBe(0);
  });

  it("an update after leaving the page shows no floating button", async () => {
    const el = await mount("chips", cfg, chips());
    await settle(el);
    el.remove();
    await settle(el);
    el.requestUpdate();
    await settle(el);
    expect(document.querySelectorAll("lumen-cards-layer").length).toBe(0);
  });

  it("HA rebuilding a view leaves one floating button, not two", async () => {
    const old = await mount("chips", cfg, chips());
    await settle(old);
    old.remove();
    old.requestUpdate();
    await settle(old);
    const fresh = await mount("chips", cfg, chips());
    await settle(fresh);
    expect(document.querySelectorAll("lumen-cards-layer").length).toBe(1);
    fresh.remove();
    await settle(fresh);
    document.querySelectorAll("lumen-cards-layer").forEach((l) => l.remove());
  });
});

describe("spacer card", () => {
  const heightOf = (el: HTMLElement) => el.shadowRoot!.querySelector<HTMLElement>("div")?.style.height ?? null;
  const fab = () => mount("chips", { fab: true, fab_narrow_only: false, chips: [{ type: "action", entity: "scene.movie" }] }, mockHass({ "scene.movie": ent("scene.movie", "2026-10-30T08:00:00+00:00") }));

  it("takes no space without floating buttons", async () => {
    const el = await mount("spacer", {}, mockHass());
    await settle(el);
    expect(el.shadowRoot!.querySelector("div")).toBeNull();
    el.remove();
  });

  it("follows the floating buttons as they come and go", async () => {
    const el = await mount("spacer", {}, mockHass());
    const button = await fab();
    await settle(button);
    await settle(el);
    expect(heightOf(el)).toContain("64px");
    button.remove();
    await settle(button);
    await settle(el);
    expect(el.shadowRoot!.querySelector("div")).toBeNull();
    el.remove();
  });

  it("a fixed height ignores them", async () => {
    const el = await mount("spacer", { height: 100 }, mockHass());
    const button = await fab();
    await settle(button);
    await settle(el);
    expect(heightOf(el)).toBe("100px");
    button.remove();
    await settle(button);
    el.remove();
  });

  it("shows an error for a wrong height", async () => {
    const el = await mount("spacer", { height: "x" }, mockHass());
    expect(el.shadowRoot!.textContent).toContain("≥ 0");
    el.remove();
  });
});

describe("air conditioner window", () => {
  const ac = () => mockHass({ "climate.ac": ent("climate.ac", "cool", { hvac_modes: ["cool", "heat", "off"], temperature: 22, current_temperature: 23, friendly_name: "AC" }) });

  it("opens as the shared sheet: handle and a round close button; the first button is still the power", async () => {
    const h = ac();
    const el = await mount("climate", { entity: "climate.ac", fab: true, fab_narrow_only: false }, h);
    await settle(el);
    layer()!.querySelector<HTMLElement>(".acfab")!.click();
    await settle(el);
    const dlg = layer()!.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dlg.textContent).toContain("AC");
    expect(dlg.style.left).toBe("0px");
    const buttons = [...dlg.querySelectorAll("button")];
    expect(buttons[0].getAttribute("style")).toContain("44px");
    const close = buttons.find((b) => b.getAttribute("aria-label") === "Close")!;
    expect(close.getAttribute("style")).toContain("50%");
    el.remove();
  });
});

describe("light chip", () => {
  it("off, it has the glass surface of the other cards", async () => {
    const el = await mount("chips", { chips: [{ type: "light", entity: "light.a" }] }, mockHass({ "light.a": ent("light.a", "off") }));
    const style = el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!.getAttribute("style") ?? "";
    expect(style).toContain("--lumen-surface");
    expect(style).not.toContain("--lumen-surface-2");
    expect(style).toContain("blur(22px)");
    el.remove();
  });
});

describe("purifier card", () => {
  const fan = (attrs: Record<string, unknown> = {}, state = "on") => ent("fan.air", state, { friendly_name: "Air", supported_features: 57, percentage_step: 20, preset_modes: ["auto", "manual"], preset_mode: "auto", percentage: 40, ...attrs });
  const texts = (el: HTMLElement) => el.shadowRoot!.textContent ?? "";
  const btn = (el: HTMLElement, label: string) => [...el.shadowRoot!.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!;

  it("shows errors for a missing entity and another domain", async () => {
    const a = await mount("purifier", {}, mockHass());
    expect(texts(a)).toContain("entity");
    const b = await mount("purifier", { entity: "light.x" }, mockHass());
    expect(texts(b)).toContain("fan");
    a.remove();
    b.remove();
  });

  it("works on a bare fan: no PM block, filters or humidity", async () => {
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, mockHass({ "fan.air": ent("fan.air", "on", { friendly_name: "Air" }) }));
    expect(texts(el)).toContain("Air");
    expect(texts(el)).not.toContain("PM2.5");
    expect(btn(el, "Manual")).toBeUndefined();
    el.remove();
  });

  it("follows the fan's own speed step and presets, and hides what the features do not allow", async () => {
    const h = mockHass({ "fan.air": fan({ percentage_step: 33.33, preset_modes: ["Silent", "Auto"], preset_mode: "Auto" }) });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    expect(el.shadowRoot!.querySelectorAll('[role="group"]')[1].querySelectorAll("button").length).toBe(3);
    expect(btn(el, "Silent")).toBeTruthy();
    el.remove();
    const none = await mount("purifier", { entity: "fan.air", send_delay: 0 }, mockHass({ "fan.air": fan({ supported_features: 48 }) }));
    expect(none.shadowRoot!.querySelectorAll('[role="group"]').length).toBe(0);
    none.remove();
  });

  it("maps every fan action to its service", async () => {
    const h = mockHass({ "fan.air": fan() });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    btn(el, "Manual").click();
    expect(h.calls.at(-1)).toEqual(["fan", "set_preset_mode", { preset_mode: "manual" }, { entity_id: "fan.air" }]);
    btn(el, "3").click();
    expect(h.calls.at(-1)).toEqual(["fan", "set_percentage", { percentage: 60 }, { entity_id: "fan.air" }]);
    el.shadowRoot!.querySelector<HTMLElement>('[aria-label="Power"]')!.click();
    expect(h.calls.at(-1)).toEqual(["fan", "turn_off", {}, { entity_id: "fan.air" }]);
    el.remove();
  });

  it("off: a preset or a speed turns the fan on with it", async () => {
    const h = mockHass({ "fan.air": fan({}, "off") });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    btn(el, "Auto").click();
    expect(h.calls.at(-1)).toEqual(["fan", "turn_on", { preset_mode: "auto" }, { entity_id: "fan.air" }]);
    el.remove();
  });

  it("a speed shows Manual at once, only when the fan has that preset", async () => {
    const h = mockHass({ "fan.air": fan() });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    btn(el, "3").click();
    await settle(el);
    expect(btn(el, "Manual").getAttribute("aria-pressed")).toBe("true");
    el.remove();
    const h2 = mockHass({ "fan.air": fan({ preset_modes: ["auto"] }) });
    const el2 = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h2);
    btn(el2, "3").click();
    await settle(el2);
    expect(btn(el2, "Auto").getAttribute("aria-pressed")).toBe("true");
    el2.remove();
  });

  it("twelve quick taps on + send one command with the last value, and show every step at once", async () => {
    vi.useFakeTimers();
    try {
      const h = mockHass({ "fan.air": fan({ timer: 0 }) });
      const el = await mount("purifier", { entity: "fan.air", controls: [{ name: "Timer", attribute: "timer", service: "my.set_timer", field: "hours", min: 0, max: 12 }] }, h);
      (el as unknown as { sheet: { show(): void } }).sheet.show();
      await el.updateComplete;
      const plus = () => layer()!.querySelector<HTMLElement>('[aria-label="More"]')!;
      for (let i = 0; i < 12; i++) {
        plus().click();
        await el.updateComplete;
        vi.advanceTimersByTime(100);
      }
      expect(h.calls).toEqual([]);
      expect(layer()!.textContent).toContain("12");
      vi.advanceTimersByTime(900);
      expect(h.calls).toEqual([["my", "set_timer", { hours: 12 }, { entity_id: "fan.air" }]]);
      el.remove();
      document.querySelector("lumen-cards-toaster")?.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("different settings go out at least a second apart; a waiting change is sent when the card leaves", async () => {
    vi.useFakeTimers();
    try {
      const h = mockHass({ "fan.air": fan() });
      const el = await mount("purifier", { entity: "fan.air" }, h);
      btn(el, "Manual").click();
      btn(el, "3").click();
      vi.advanceTimersByTime(850);
      expect(h.calls.length).toBe(1);
      vi.advanceTimersByTime(1100);
      expect(h.calls.length).toBe(2);
      btn(el, "Auto").click();
      el.remove();
      expect(h.calls.length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a change HA does not confirm is undone with a retry; a confirmed one stays", async () => {
    vi.useFakeTimers();
    try {
      const h = mockHass({ "fan.air": fan() });
      const el = await mount("purifier", { entity: "fan.air", confirm_timeout: 45, send_delay: 0 }, h);
      btn(el, "Manual").click();
      await el.updateComplete;
      expect(btn(el, "Manual").getAttribute("aria-pressed")).toBe("true");
      vi.advanceTimersByTime(45_100);
      await el.updateComplete;
      expect(btn(el, "Manual").getAttribute("aria-pressed")).toBe("false");
      const toast = document.querySelector("lumen-cards-toaster") as HTMLElement & { items: { action?: { run(): void } }[] };
      expect(toast.items.at(-1)?.action).toBeTruthy();
      toast.items.at(-1)!.action!.run();
      expect(h.calls.filter((c) => c[1] === "set_preset_mode").length).toBe(2);
      vi.advanceTimersByTime(45_100);
      el.remove();
      toast.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a failed call is undone right away", async () => {
    const h = mockHass({ "fan.air": fan() });
    h.callService = () => Promise.reject(new Error("nope"));
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    btn(el, "Manual").click();
    await settle(el);
    await settle(el);
    expect(btn(el, "Manual").getAttribute("aria-pressed")).toBe("false");
    el.remove();
    document.querySelector("lumen-cards-toaster")?.remove();
  });

  it("reads sensors by device class on the same device, with attributes as the fallback", async () => {
    const h = mockHass({ "fan.air": fan({ pm25: 99 }), "sensor.weird_name": ent("sensor.weird_name", "7", { device_class: "pm25" }) });
    h.entities = { "fan.air": { device_id: "d" }, "sensor.weird_name": { device_id: "d" } };
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, h);
    expect(texts(el)).toContain("7");
    expect(texts(el)).not.toContain("99");
    el.remove();
    const attr = await mount("purifier", { entity: "fan.air", send_delay: 0 }, mockHass({ "fan.air": fan({ pm25: 99 }) }));
    expect(texts(attr)).toContain("99");
    attr.remove();
  });

  it("warns about water and a worn filter, in the unit the device uses", async () => {
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, mockHass({ "fan.air": fan({ humidity: 40, target_humidity: 50, water_level: 15, filter_life_remaining: 4 }) }));
    expect(texts(el)).toContain("Refill water");
    expect(texts(el)).toContain("Replace filter");
    el.remove();
  });

  it("a configured service control sends its field and shows the value at once", async () => {
    const h = mockHass({ "fan.air": fan({ child_lock: false }) });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0, controls: [{ name: "Lock", attribute: "child_lock", service: "my.set_lock", field: "lock" }] }, h);
    (el as unknown as { sheet: { show(): void } }).sheet.show();
    await settle(el);
    const row = layer()!.querySelector<HTMLElement>('[role="switch"]')!;
    row.click();
    expect(h.calls.at(-1)).toEqual(["my", "set_lock", { lock: true }, { entity_id: "fan.air" }]);
    await settle(el);
    expect(layer()!.querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("true");
    el.remove();
  });

  it("a humidifier entity uses the standard service", async () => {
    const h = mockHass({ "fan.air": fan(), "humidifier.air": ent("humidifier.air", "on", { current_humidity: 40, humidity: 50 }) });
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0, humidifier_entity: "humidifier.air", humidity_targets: [40, 60] }, h);
    btn(el, "60%").click();
    expect(h.calls.at(-1)).toEqual(["humidifier", "set_humidity", { humidity: 60 }, { entity_id: "humidifier.air" }]);
    el.remove();
  });

  it("one footer tile opens the details and names the worst filter", async () => {
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0, filters: [{ name: "Pre", attribute: "pre", unit: "h" }, { name: "HEPA", attribute: "hepa", unit: "h" }] }, mockHass({ "fan.air": fan({ pre: 318, hepa: 1941 }) }));
    const buttons = [...el.shadowRoot!.querySelectorAll("button")];
    const tile = buttons.at(-1)!;
    expect(tile.textContent).toContain("More options");
    expect(tile.textContent).toContain("Pre");
    expect(tile.textContent).toContain("318 h");
    buttons.at(-1)!.click();
    await settle(el);
    expect(layer()!.querySelector('[role="dialog"]')).toBeTruthy();
    el.remove();
  });

  it("unavailable: only the header", async () => {
    const el = await mount("purifier", { entity: "fan.air", send_delay: 0 }, mockHass({ "fan.air": ent("fan.air", "unavailable", { friendly_name: "Air" }) }));
    expect(el.shadowRoot!.querySelector('[aria-label="Power"]')).toBeNull();
    expect(el.shadowRoot!.querySelectorAll('[role="group"]').length).toBe(0);
    el.remove();
  });
});

describe("light chip: entities it reads", () => {
  it("re-renders when a relay of power_entities or a group member changes", async () => {
    const group = ent("light.g", "on", { brightness: 200, entity_id: ["light.a", "light.b"] });
    const states = [group, ent("light.a", "on", { brightness: 200 }), ent("light.b", "off"), ent("switch.r1", "on"), ent("switch.r2", "off")];
    const h = mockHass(states);
    const el = await mount("chips", { chips: [{ type: "light", entity: "light.g", power_entities: ["switch.r1", "switch.r2"] }, { type: "light", entity: "light.g" }] }, h);
    const update = vi.spyOn(el, "requestUpdate");
    for (const id of ["switch.r2", "light.b"]) {
      update.mockClear();
      el.hass = { ...h, states: { ...h.states, [id]: ent(id, "on") } };
      expect(update, id).toHaveBeenCalled();
    }
    el.remove();
  });
});

describe("the floating list of action chips", () => {
  const items = () => [...layer()!.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')];
  const press = (b: HTMLElement) => {
    b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
    b.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
  };
  const open = async (chips: unknown[], states: ReturnType<typeof ent>[]) => {
    const h = mockHass(states);
    const el = await mount("chips", { fab: true, fab_narrow_only: false, chips }, h);
    await settle(el);
    layer()!.querySelector<HTMLElement>(".acfab")!.click();
    await settle(el);
    return { h, el };
  };

  it("an unavailable chip is disabled and does not run", async () => {
    const { h, el } = await open([{ type: "action", entity: "scene.a" }], [ent("scene.a", "unavailable")]);
    expect(items()[0].disabled).toBe(true);
    press(items()[0]);
    items()[0].click();
    expect(h.calls).toEqual([]);
    el.remove();
  });

  it("the active choice shows like in the row", async () => {
    const { el } = await open([{ type: "action", entity: "input_select.m", active_value: "eco", tap_action: { action: "none" } }, { type: "action", entity: "input_select.m", active_value: "boost", tap_action: { action: "none" } }], [ent("input_select.m", "eco")]);
    expect(items().map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    el.remove();
  });

  it("a press runs it once; hold and double tap work", async () => {
    vi.useFakeTimers();
    try {
      const h = mockHass([ent("script.a", "off"), ent("script.b", "off")]);
      const el = await mount("chips", { fab: true, fab_narrow_only: false, chips: [{ type: "action", entity: "script.a", hold_action: { action: "navigate", navigation_path: "/h" } }, { type: "action", entity: "script.b", double_tap_action: { action: "navigate", navigation_path: "/d" } }] }, h);
      await vi.advanceTimersByTimeAsync(0);
      layer()!.querySelector<HTMLElement>(".acfab")!.click();
      await vi.advanceTimersByTimeAsync(0);
      const fired: string[] = [];
      el.addEventListener("hass-action", (e) => fired.push((e as CustomEvent).detail.action));
      const [a, b] = items();
      press(a);
      a.dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
      expect(h.calls.length).toBe(1);
      a.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, composed: true }));
      vi.advanceTimersByTime(600);
      a.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true, composed: true }));
      expect(fired).toEqual(["hold"]);
      press(b);
      press(b);
      expect(fired).toEqual(["hold", "double_tap"]);
      expect(h.calls.length).toBe(1);
      el.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});
