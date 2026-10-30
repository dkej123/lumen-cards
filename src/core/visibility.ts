// HA visibility conditions around a card, as labels for the dashboard edit mode.

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
 * Visibility conditions of the hui-card wrappers and the hui-section around a card that sits
 * directly in a dashboard view (not inside a Lumen bar / pop-up), or undefined elsewhere
 * (card editor dialog, card picker).
 */
export function haConditions(host: Element): unknown[] | undefined {
  if (host.parentElement?.localName !== "hui-card") return undefined;
  const found: unknown[] = [];
  let n: Node | null = host;
  for (let i = 0; i < 40 && n; i++) {
    const parent: Node | null = n.parentNode;
    n = parent instanceof ShadowRoot ? parent.host : parent;
    if (!(n instanceof HTMLElement)) continue;
    if (n.localName === "hui-card" || n.localName === "hui-section") {
      const v = (n as HTMLElement & { config?: { visibility?: unknown } }).config?.visibility;
      if (Array.isArray(v)) found.push(...v);
    }
    if (/^hui-.*-view$/.test(n.localName)) return found;
  }
  return undefined;
}
