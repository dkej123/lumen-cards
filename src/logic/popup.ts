// Pop-up card: which #hash opens it and how wide each inner card is in its 12-column grid.

/** "salon", "#salon", " #salon " → "#salon"; empty → "". */
export function normalizeHash(h: unknown): string {
  const s = typeof h === "string" ? h.trim().replace(/^#+/, "") : "";
  return s ? `#${s}` : "";
}

/** The location's hash opens the pop-up (decoded, so "#caf%C3%A9" matches "#café"). */
export function hashMatches(locationHash: string, hash: string): boolean {
  if (!hash) return false;
  let h = locationHash;
  try {
    h = decodeURIComponent(locationHash);
  } catch {
    /* keep the raw hash */
  }
  return h === hash || locationHash === hash;
}

/**
 * Columns (of 12) an inner card spans: its `grid_options.columns` from the config, else the card's
 * own getGridOptions(); "full" and anything unknown take the whole row.
 */
export function cardSpan(config: { grid_options?: { columns?: unknown } } | undefined, own?: { columns?: unknown }): number {
  const c = config?.grid_options?.columns ?? own?.columns;
  const n = Number(c);
  return c === "full" || !Number.isFinite(n) || n <= 0 ? 12 : Math.min(12, Math.max(1, Math.round(n)));
}

/** Inner Lumen cards draw no weather in the sheet (it is a layer over the background) unless asked to. */
export function innerConfig<T extends Record<string, unknown>>(c: T): T {
  const type = typeof c.type === "string" ? c.type : "";
  return type.startsWith("custom:lumen-") && c.weather_effects === undefined ? { ...c, weather_effects: false } : c;
}

/** A container's `color_scheme` reaches its inner Lumen cards, unless they set their own. */
export function withScheme<T extends Record<string, unknown>>(c: T, scheme: unknown): T {
  const type = typeof c.type === "string" ? c.type : "";
  return (scheme === "light" || scheme === "dark") && type.startsWith("custom:lumen-") && c.color_scheme === undefined ? { ...c, color_scheme: scheme } : c;
}
