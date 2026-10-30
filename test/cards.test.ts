// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { HassEntity, HassLike } from "../src/hass/types";

const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id.split(".")[1], ...attributes },
  last_changed: new Date(Date.now() - 600_000).toISOString(),
  last_updated: new Date(Date.now() - 600_000).toISOString(),
});

const STATES = [
  ent("light.desk", "on", { brightness: 128, supported_color_modes: ["color_temp"], color_temp_kelvin: 3000, min_color_temp_kelvin: 2700, max_color_temp_kelvin: 6500 }),
  ent("lock.door", "locked", { supported_features: 1 }),
  ent("alarm_control_panel.home", "armed_home"),
  ent("person.ann", "home"),
  ent("binary_sensor.door", "off", { device_class: "door" }),
  ent("sensor.temp", "21.5", { unit_of_measurement: "°C", device_class: "temperature" }),
  ent("sensor.pm25", "12", { unit_of_measurement: "µg/m³", device_class: "pm25" }),
  ent("climate.ac", "cool", { hvac_modes: ["off", "cool", "heat"], fan_modes: ["auto", "low"], temperature: 22, current_temperature: 23, min_temp: 16, max_temp: 30 }),
  ent("weather.home", "rainy"),
  ent("sun.sun", "above_horizon", { elevation: 30 }),
  ent("script.gate", "off"),
  ent("scene.movie", "2026-10-29T10:00:00Z"),
  ent("input_boolean.bike", "on"),
];

const hass = (): HassLike & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    states: Object.fromEntries(STATES.map((e) => [e.entity_id, e])),
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

type CardClass = CustomElementConstructor & {
  getStubConfig?(h: HassLike, entities?: string[], fallback?: string[]): Record<string, unknown>;
  getConfigForm?(): { schema: unknown[]; assertConfig?(c: Record<string, unknown>): void };
};
type Card = HTMLElement & { setConfig(c: unknown): void; hass: HassLike; updateComplete: Promise<boolean>; getGridOptions?(): unknown };
type Entry = { type: string; name: string; getEntitySuggestion?(h: HassLike, id: string): { config: Record<string, unknown> }[] | null };

let entries: Entry[] = [];

beforeAll(async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  await import("../src/lumen-cards");
  entries = (window as unknown as { customCards: Entry[] }).customCards;
});

describe("every card", () => {
  it("is registered with an English picker name", () => {
    expect(entries.length).toBeGreaterThanOrEqual(14);
    for (const e of entries) expect(e.name).toMatch(/^Lumen · [A-Z]/);
  });

  it("renders its stub config, wide and compact, without errors", async () => {
    for (const e of entries) {
      const cls = customElements.get(e.type) as CardClass;
      const h = hass();
      const stub = cls.getStubConfig?.(h, Object.keys(h.states), []) ?? {};
      for (const layout of ["wide", "compact"]) {
        const el = document.createElement(e.type) as Card;
        el.setConfig({ type: `custom:${e.type}`, ...stub, layout });
        el.hass = h;
        document.body.append(el);
        await el.updateComplete;
        expect(el.shadowRoot, e.type).toBeTruthy();
        el.remove();
      }
    }
  });

  it("editor form: no YAML fallback for an empty or stub config", () => {
    for (const e of entries) {
      const cls = customElements.get(e.type) as CardClass;
      const form = cls.getConfigForm?.();
      expect(form, e.type).toBeTruthy();
      expect(() => form!.assertConfig?.({ type: `custom:${e.type}` }), e.type).not.toThrow();
      expect(() => form!.assertConfig?.({ type: `custom:${e.type}`, ...cls.getStubConfig?.(hass()) }), e.type).not.toThrow();
      expect(() => JSON.stringify(form!.schema)).not.toThrow();
    }
  });

  it("suggestions by entity use the card's own keys", () => {
    const h = hass();
    const byType = (t: string) => entries.find((e) => e.type === t)!;
    expect(byType("lumen-light-card").getEntitySuggestion!(h, "light.desk")![0].config).toMatchObject({ type: "custom:lumen-light-card", entity: "light.desk" });
    expect(byType("lumen-air-quality-card").getEntitySuggestion!(h, "sensor.pm25")![0].config).toMatchObject({ pm25: "sensor.pm25" });
    expect(byType("lumen-air-quality-card").getEntitySuggestion!(h, "sensor.temp")).toBeNull();
    expect(byType("lumen-weather-background-card").getEntitySuggestion!(h, "weather.home")![0].config).toMatchObject({ weather_entity: "weather.home" });
  });
});

describe("keyboard", () => {
  it("Enter on the alarm row runs the tap action", async () => {
    const el = document.createElement("lumen-alarm-card") as Card;
    el.setConfig({ type: "custom:lumen-alarm-card", entity: "alarm_control_panel.home", layout: "wide", tap_action: { action: "toggle" } });
    el.hass = hass();
    document.body.append(el);
    await el.updateComplete;
    const fired: unknown[] = [];
    el.addEventListener("hass-action", (e) => fired.push((e as CustomEvent).detail));
    const row = el.shadowRoot!.querySelector<HTMLElement>('[role="button"]')!;
    expect(row.getAttribute("tabindex")).toBe("0");
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(fired).toEqual([{ config: { entity: "alarm_control_panel.home", tap_action: { action: "toggle" } }, action: "tap" }]);
    el.remove();
  });

  it("lock shows its state and disables the current command", async () => {
    const el = document.createElement("lumen-lock-card") as Card;
    el.setConfig({ type: "custom:lumen-lock-card", entity: "lock.door", layout: "wide" });
    el.hass = hass();
    document.body.append(el);
    await el.updateComplete;
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain("locked");
    const lockBtn = el.shadowRoot!.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')!;
    expect(lockBtn.disabled).toBe(true);
    expect(el.shadowRoot!.querySelectorAll(".lockbtns button").length).toBe(3);
    el.remove();
  });
});

describe("climate", () => {
  it("°F thermostat is not clamped to the 16–30 °C design range", async () => {
    const h = hass();
    h.states["climate.f"] = ent("climate.f", "heat", { hvac_modes: ["off", "heat"], temperature: 68, min_temp: 45, max_temp: 95, target_temp_step: 1 });
    const el = document.createElement("lumen-climate-card") as Card & { step(d: number): void };
    el.setConfig({ type: "custom:lumen-climate-card", entity: "climate.f" });
    el.hass = h;
    document.body.append(el);
    await el.updateComplete;
    vi.useFakeTimers();
    el.step(1);
    vi.advanceTimersByTime(900);
    vi.useRealTimers();
    expect(h.calls.at(-1)).toEqual(["climate", "set_temperature", { temperature: 69 }, { entity_id: "climate.f" }]);
    el.remove();
  });
});
