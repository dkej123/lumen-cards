// Floating panel (lumen-fab-sheet-card, catalog section 19): what the FAB, the trigger row and the
// sheet header say about the cards inside – how many heat, the average room temperature, a
// battery / availability warning and whether the "All" preset segment makes sense.

import { language, t } from "../core/i18n";
import type { HassEntities, HassEntity } from "../hass/types";
import { BATTERY_LOW, batteryLevel } from "./battery";
import { formatNumber } from "./time";

type CardCfg = Record<string, unknown>;

const isId = (v: unknown): v is string => typeof v === "string" && /^[a-z_]+\.[\w-]+$/i.test(v);

/** Entities of the inner cards: `entity`, `entities` (ids or { entity }) and nested `cards`. */
export function cardEntities(cards: unknown): string[] {
  const out = new Set<string>();
  const walk = (c: unknown, depth: number) => {
    if (!c || typeof c !== "object" || depth > 4) return;
    const cfg = c as CardCfg;
    if (isId(cfg.entity)) out.add(cfg.entity);
    if (Array.isArray(cfg.entities))
      for (const x of cfg.entities) {
        if (isId(x)) out.add(x);
        else if (x && typeof x === "object" && isId((x as CardCfg).entity)) out.add((x as CardCfg).entity as string);
      }
    if (Array.isArray(cfg.cards)) for (const x of cfg.cards) walk(x, depth + 1);
    if (cfg.card) walk(cfg.card, depth + 1);
  };
  if (Array.isArray(cards)) for (const c of cards) walk(c, 0);
  return [...out];
}

/** Climate entities among the cards' entities, in card order. */
export const thermostatIds = (ids: string[]) => ids.filter((id) => id.startsWith("climate."));

const unavailable = (e?: HassEntity) => !e || e.state === "unavailable" || e.state === "unknown";

/** Heating now: hvac_action heating (or preheating). */
export const isHeating = (e?: HassEntity) => !unavailable(e) && e!.state !== "off" && ["heating", "preheating"].includes(String(e!.attributes.hvac_action ?? ""));

/**
 * Active for the FAB badge: climate entities when heating, others when on (or open / home /
 * playing). `badge` empty = the cards' climate entities.
 */
export function isActive(e?: HassEntity): boolean {
  if (!e || unavailable(e)) return false;
  if (e.entity_id.startsWith("climate.")) return isHeating(e);
  return ["on", "open", "home", "playing", "heat", "cool"].includes(e.state);
}

/** Number on the FAB badge (0 = hidden). */
export function badgeCount(badge: string[] | undefined, cardIds: string[], states: HassEntities): number {
  const ids = badge?.length ? badge : thermostatIds(cardIds);
  return ids.filter((id) => isActive(states[id])).length;
}

/** Plural form for counted labels: one / few (Polish 2–4, not 12–14) / many. */
export function plural(n: number): "one" | "few" | "many" {
  if (n === 1) return "one";
  if (language() === "pl") {
    const d = n % 10, h = n % 100;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "few";
  }
  return "many";
}

/** "20,6°" (one decimal, locale separator; whole numbers without it). */
const deg = (v: number) => `${Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : formatNumber(Math.round(v * 10) / 10)}°`;

/**
 * Sheet subtitle / trigger row text: "2 of 3 heating · avg 20.6°", 1 → "1 of 3 heating", 0 →
 * "Nothing is heating"; the average of the available thermostats' room temperatures. Without
 * thermostats: the number of cards.
 */
export function panelSummary(cardIds: string[], states: HassEntities, cardCount: number, withAverage = true): string {
  const th = thermostatIds(cardIds);
  if (!th.length) return cardCount ? t(`card.fab_sheet.cards_${plural(cardCount)}`, { n: cardCount }) : t("card.fab_sheet.no_cards");
  const heating = th.filter((id) => isHeating(states[id])).length;
  const head = heating === 0 ? t("card.fab_sheet.heating_none") : t(`card.fab_sheet.heating_${plural(heating)}`, { n: heating, total: th.length });
  const temps = th
    .map((id) => states[id])
    .filter((e) => !unavailable(e) && typeof e!.attributes.current_temperature === "number")
    .map((e) => e!.attributes.current_temperature as number);
  if (!withAverage || !temps.length) return head;
  return `${head} · ${t("card.fab_sheet.average", { t: deg(temps.reduce((a, b) => a + b, 0) / temps.length) })}`;
}

export interface PanelWarning {
  kind: "battery" | "unavailable";
  icon: string;
  /** "Battery 9% · Bathroom" / "Unavailable · Bathroom". */
  text: string;
}

const nameOf = (e: HassEntity | undefined, id: string) => String(e?.attributes.friendly_name ?? id);

/**
 * Warning corner of the FAB: a thermostat with a low battery (below its card's `battery_low`,
 * default 15 %), else an unavailable entity among the cards' entities. null = all fine.
 */
export function panelWarning(cards: unknown, cardIds: string[], states: HassEntities): PanelWarning | null {
  const cfgs = Array.isArray(cards) ? (cards as CardCfg[]) : [];
  const cfgFor = (id: string) => cfgs.find((c) => c && c.entity === id);
  // The card's own `name` (as shown in the sheet), else the entity's friendly name.
  const label = (id: string) => (typeof cfgFor(id)?.name === "string" && cfgFor(id)!.name ? String(cfgFor(id)!.name) : nameOf(states[id], id));
  let low: { pct: number | null; id: string } | null = null;
  for (const id of thermostatIds(cardIds)) {
    const cfg = cfgFor(id);
    if (cfg?.show_battery === false) continue;
    const b = batteryLevel(states[id], isId(cfg?.battery_entity) ? states[cfg!.battery_entity as string] : undefined, Number(cfg?.battery_low) || BATTERY_LOW);
    if (b?.low && (!low || (b.pct ?? 0) < (low.pct ?? 0))) low = { pct: b.pct, id };
  }
  if (low) {
    const what = low.pct === null ? t("card.climate.battery_low") : t("card.climate.battery_pct", { pct: Math.round(low.pct) });
    return { kind: "battery", icon: "mdi:battery-alert-variant-outline", text: `${what} · ${label(low.id)}` };
  }
  const gone = cardIds.filter((id) => !states[id] || states[id].state === "unavailable");
  if (gone.length) return { kind: "unavailable", icon: "mdi:alert-circle-outline", text: `${t("common.unavailable")} · ${gone.map(label).join(", ")}` };
  return null;
}

/** Options of the "All" segment, in this order (those the thermostats share). */
export const BULK_PRESETS = ["comfort", "eco"] as const;

export interface Bulk {
  /** Thermostats it sets (available ones). */
  ids: string[];
  /** Presets offered (comfort / eco among the shared preset_modes), then off. */
  presets: string[];
  /** Selected option: a preset, "off", or null when mixed. */
  selected: string | null;
}

/**
 * "All: Comfort / Eco / Off" – only when at least 2 cards are thermostats with the same
 * preset_modes (that include comfort or eco). Mixed state → nothing selected.
 */
export function bulkSegment(cardIds: string[], states: HassEntities): Bulk | null {
  const th = thermostatIds(cardIds).map((id) => states[id]).filter((e): e is HassEntity => !!e && !unavailable(e));
  if (th.length < 2) return null;
  const key = (e: HassEntity) => [...((e.attributes.preset_modes as string[] | undefined) ?? [])].sort().join("|");
  const first = key(th[0]);
  if (!first || th.some((e) => key(e) !== first)) return null;
  const shared = (th[0].attributes.preset_modes as string[]) ?? [];
  const presets = BULK_PRESETS.filter((p) => shared.includes(p));
  if (!presets.length) return null;
  const all = (f: (e: HassEntity) => boolean) => th.every(f);
  const selected = all((e) => e.state === "off")
    ? "off"
    : (presets.find((p) => all((e) => e.state !== "off" && e.attributes.preset_mode === p)) ?? null);
  return { ids: th.map((e) => e.entity_id), presets: [...presets], selected };
}
