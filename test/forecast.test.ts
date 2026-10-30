// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "../src/core/i18n";
import "../src/lumen-cards";
import {
  activeWarnings,
  cardColumns,
  conditionIcon,
  daySummaries,
  deg,
  hoursOf,
  isNightHour,
  stripChart,
  todayHours,
  todayRange,
  warningIcon,
  windDirIndex,
  type ForecastItem,
} from "../src/logic/forecast";

const H = 3_600_000;
// 2026-10-30 15:20 local
const NOW = new Date(2026, 9, 30, 15, 20).getTime();
const at = (day: number, hour: number) => new Date(2026, 9, 30 + day, hour).toISOString();

const hourly = (from: number, count: number, extra: Partial<ForecastItem> = {}): ForecastItem[] =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(new Date(2026, 9, 30, 15).getTime() + (from + i) * H);
    return { datetime: d.toISOString(), condition: "cloudy", temperature: 10 - (i % 5), precipitation: 0, ...extra };
  });

afterEach(() => setLanguage("en"));

describe("weather card forecast", () => {
  it("hours start at the current hour and keep the entity's own values", () => {
    const hs = hoursOf({ now: NOW, hourly: hourly(0, 30, { apparent_temperature: 5, precipitation_probability: 40 }) });
    expect(hs[0].h).toBe(15);
    expect(hs[0].feel).toBe(5);
    expect(hs[0].pp).toBe(40);
    expect(hs.filter((h) => h.d === 0)).toHaveLength(9);
  });

  it("chance falls back to the daily forecast", () => {
    const hs = hoursOf({ now: NOW, hourly: hourly(0, 3), daily: [{ datetime: at(0, 0), temperature: 12, templow: 4, precipitation_probability: 70 }] });
    expect(hs[0].pp).toBe(70);
  });

  it("today strip: to 23:00, or 12 hours when fewer than 6 are left", () => {
    expect(todayHours(hoursOf({ now: NOW, hourly: hourly(0, 40) }))).toHaveLength(9);
    const late = new Date(2026, 9, 30, 20, 10).getTime();
    const hs = hoursOf({ now: late, hourly: hourly(5, 40) });
    expect(todayHours(hs)).toHaveLength(12);
  });

  it("days: from hours with ≥ 20 of them, else the daily forecast (partial when some hours exist)", () => {
    const hs = hoursOf({ now: NOW, hourly: hourly(0, 9 + 24 + 10) });
    const daily: ForecastItem[] = [1, 2, 3].map((d) => ({ datetime: at(d, 0), temperature: 13 + d, templow: 2 + d, condition: "sunny", wind_speed: 9 }));
    const days = daySummaries(hs, daily, NOW);
    expect(days).toHaveLength(3);
    expect(days[0]).toMatchObject({ d: 1, partial: false, min: 6, max: 10 });
    expect(days[1]).toMatchObject({ d: 2, partial: true, min: 4, max: 15 });
    expect(days[2]).toMatchObject({ d: 3, partial: false, hours: [] });
  });

  it("today's low / high: daily first, else the hours", () => {
    expect(todayRange({ now: NOW, daily: [{ datetime: at(0, 0), temperature: 12, templow: 5 }] }, 9)).toEqual({ min: 5, max: 12 });
    expect(todayRange({ now: NOW, hourly: hourly(0, 9) }, 11)).toEqual({ min: 6, max: 11 });
    expect(todayRange({ now: NOW }, 11)).toBeNull();
  });

  it("card columns: hours 4–8, at least 44 px each", () => {
    expect(cardColumns(6, 340)).toBe(6);
    expect(cardColumns(8, 340)).toBe(7);
    expect(cardColumns(8, 400)).toBe(8);
    expect(cardColumns(2, 400)).toBe(4);
  });

  it("chart keeps a 4° minimum span and both lines on one scale", () => {
    const c = stripChart([10, 10, 10], [0, 2, 0], [8, null, 8]);
    expect(c.w).toBe(156);
    expect(c.bars).toContain("M70 43h16");
    expect(c.feel).not.toBe(c.line);
  });

  it("icons: night variants, clear-night by day, unknown → cloudy", () => {
    expect(conditionIcon("sunny", true)).toBe("mdi:weather-night");
    expect(conditionIcon("partlycloudy", true)).toBe("mdi:weather-night-partly-cloudy");
    expect(conditionIcon("clear-night")).toBe("mdi:weather-sunny");
    expect(conditionIcon("whatever")).toBe("mdi:weather-cloudy");
    expect(isNightHour(new Date(2026, 9, 30, 18).getTime(), { rise: new Date(2026, 9, 30, 6, 40).getTime(), set: new Date(2026, 9, 30, 16, 31).getTime() })).toBe(true);
  });

  it("text helpers", () => {
    expect(deg(-1.4)).toBe("−1°");
    expect(deg(10.6)).toBe("11°");
    expect(windDirIndex(270)).toBe(6);
    expect(windDirIndex(350)).toBe(0);
  });

  it("warnings: active + next 24 h, highest level first, IMGW dates and icons", () => {
    const list = [
      { event: "Silny wiatr", level: 1, valid_from: "2026-10-30 22:00:00", valid_to: "2026-10-31 11:00:00" },
      { event: "Intensywne opady deszczu", level: 2, valid_from: "2026-10-30 18:00:00", valid_to: "2026-10-31 06:00:00" },
      { event: "Mróz", level: 3, valid_from: "2026-11-02 00:00:00", valid_to: "2026-11-02 08:00:00" },
      { event: "Gołoledź", level: 1, valid_from: "2026-10-29 00:00:00", valid_to: "2026-10-29 08:00:00" },
    ];
    const w = activeWarnings(list, NOW);
    expect(w.map((x) => x.name)).toEqual(["Intensywne opady deszczu", "Silny wiatr"]);
    expect(w[0].icon).toBe("mdi:weather-pouring");
    expect(w[1].icon).toBe("mdi:weather-windy");
    expect(warningIcon("Przymrozki")).toBe("mdi:snowflake-alert");
    expect(warningIcon("Opady śniegu")).toBe("mdi:weather-snowy-heavy");
    expect(warningIcon("???")).toBe("mdi:alert-outline");
    expect(activeWarnings("nope", NOW)).toEqual([]);
  });
});

describe("lumen-weather-card", () => {
  type Card = HTMLElement & { setConfig(c: unknown): void; hass: unknown; updateComplete: Promise<boolean>; shadowRoot: ShadowRoot };
  const hass = (attrs: Record<string, unknown> = {}, state = "rainy") => ({
    states: {
      "weather.home": { entity_id: "weather.home", state, attributes: { friendly_name: "Dom", temperature: 10.6, apparent_temperature: 8, supported_features: 0, ...attrs }, last_changed: "", last_updated: "" },
      "sun.sun": { entity_id: "sun.sun", state: "above_horizon", attributes: {}, last_changed: "", last_updated: "" },
    },
    language: "pl",
    callService: async () => undefined,
    callWS: async () => undefined,
  });

  it("rejects a non-weather entity", async () => {
    const el = document.createElement("lumen-weather-card") as Card;
    el.setConfig({ type: "custom:lumen-weather-card", entity: "sensor.x" });
    el.hass = hass();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("weather.*");
    el.remove();
  });

  it("line: temperature and condition label", async () => {
    const el = document.createElement("lumen-weather-card") as Card;
    el.setConfig({ type: "custom:lumen-weather-card", entity: "weather.home", layout: "compact" });
    el.hass = hass();
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("11°");
    expect(el.shadowRoot.textContent).toContain("Deszcz");
    el.remove();
  });

  it("card without forecast support: no hour row, feels-like caption", async () => {
    const el = document.createElement("lumen-weather-card") as Card;
    el.setConfig({ type: "custom:lumen-weather-card", entity: "weather.home", layout: "wide" });
    el.hass = hass();
    document.body.append(el);
    await el.updateComplete;
    const text = el.shadowRoot.textContent ?? "";
    expect(text).toContain("Odczuwalna 8°");
    expect(text).not.toContain("Teraz");
    expect(el.shadowRoot.querySelector("[aria-busy]")).toBeNull();
    el.remove();
  });
});
