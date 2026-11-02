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

  it("has one numbered button per relay, and it switches only that relay", async () => {
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
