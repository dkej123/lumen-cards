// HA visibility conditions around a card, as labels for the dashboard edit mode.
import { composedAncestors, isHaView, type HuiWrapper } from "./dom";

/** One HA visibility condition (card or section `visibility`). */
interface Condition {
  condition?: string;
  media_query?: string;
  conditions?: Condition[];
}

/** What an edit-mode label says about one visibility condition. */
export interface VisibilityLabel {
  kind: "narrow" | "wide" | "screen" | "user" | "other";
  min?: number;
  max?: number;
  text?: string;
  /** The condition is on the section around the card, not on the card itself. */
  section?: boolean;
}

/**
 * Edit-mode labels for HA visibility conditions: screen queries become "phone up to N px" /
 * "computer from N px" / a range, users and the rest a short note; `and` / `or` are flattened.
 */
export function visibilityLabels(conds: unknown): VisibilityLabel[] {
  const out: VisibilityLabel[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list as Condition[]) {
      if (!c || typeof c !== "object") continue;
      if (c.condition === "and" || c.condition === "or") walk(c.conditions);
      else if (c.condition === "screen") {
        const q = String(c.media_query ?? "");
        const min = /min-width:\s*(\d+)px/.exec(q)?.[1];
        const max = /max-width:\s*(\d+)px/.exec(q)?.[1];
        const lo = min !== undefined && Number(min) > 0 ? Number(min) : undefined;
        const hi = max !== undefined ? Number(max) : undefined;
        if (lo === undefined && hi !== undefined) out.push({ kind: "narrow", max: hi });
        else if (lo !== undefined && hi === undefined) out.push({ kind: "wide", min: lo });
        else if (lo !== undefined && hi !== undefined) out.push({ kind: "screen", min: lo, max: hi });
        else if (q) out.push({ kind: "screen", text: q });
      } else if (c.condition === "user") out.push({ kind: "user" });
      else out.push({ kind: "other" });
    }
  };
  walk(conds);
  return out;
}

/**
 * Visibility conditions of the hui-card wrappers (card, stacks) and of the hui-section around a
 * card that sits directly in a dashboard view (not inside a Lumen bar / pop-up), or undefined
 * elsewhere (card editor dialog, card picker).
 */
export function haConditions(host: Element): { card: unknown[]; section: unknown[] } | undefined {
  if (host.parentElement?.localName !== "hui-card") return undefined;
  const found = { card: [] as unknown[], section: [] as unknown[] };
  for (const el of composedAncestors(host)) {
    if (isHaView(el)) return found;
    if (el.localName === "hui-card" || el.localName === "hui-section") {
      const v = (el as HuiWrapper).config?.visibility;
      if (Array.isArray(v)) found[el.localName === "hui-card" ? "card" : "section"].push(...v);
    }
  }
  return undefined;
}

/**
 * Whether HA's visibility conditions would show the card at a screen `width` (edit-mode preview).
 * Only screen queries with min / max width are evaluated; every other condition counts as met.
 */
export function visibleAt(conds: unknown, width: number): boolean {
  if (!Array.isArray(conds)) return true;
  const one = (c: Condition): boolean => {
    if (!c || typeof c !== "object") return true;
    if (c.condition === "and") return (c.conditions ?? []).every(one);
    if (c.condition === "or") return !c.conditions?.length || c.conditions.some(one);
    if (c.condition !== "screen") return true;
    const q = String(c.media_query ?? "");
    const min = /min-width:\s*(\d+)px/.exec(q)?.[1];
    const max = /max-width:\s*(\d+)px/.exec(q)?.[1];
    return (min === undefined || width >= Number(min)) && (max === undefined || width <= Number(max));
  };
  return (conds as Condition[]).every(one);
}
