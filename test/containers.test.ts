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

describe("floating scene list", () => {
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
});
