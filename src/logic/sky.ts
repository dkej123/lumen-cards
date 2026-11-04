import type { HassEntity } from "../hass/types";
import { COND, COND_ALIAS } from "../weather/fx";

export type Phase = "dawn" | "day" | "dusk" | "night";

/** Day phase from sun.sun (elevation, rising). */
export function phaseFromSun(sun: HassEntity | undefined, now = new Date()): Phase {
  const elevation = sun?.attributes.elevation;
  if (typeof elevation !== "number") {
    const h = now.getHours();
    return h < 5 || h >= 22 ? "night" : h < 8 ? "dawn" : h < 18 ? "day" : "dusk";
  }
  if (elevation < -6) return "night";
  if (elevation < 10) return sun!.attributes.rising ? "dawn" : "dusk";
  return "day";
}

/** UI condition (8 states) for label/icon; drawing uses the raw HA state. */
export function weatherCondition(weather: HassEntity | undefined): { ui: string; raw: string; label: string; icon: string } {
  const raw = weather?.state ?? "cloudy";
  const ui = (COND as Record<string, unknown>)[raw] ? raw : ((COND_ALIAS as Record<string, string>)[raw] ?? "cloudy");
  const [, icon] = (COND as unknown as Record<string, [string, string]>)[ui];
  return { ui, raw: ui === raw || raw in COND_ALIAS ? raw : "cloudy", label: `weather.${ui}`, icon: icon.replace("mdi-", "mdi:") };
}
