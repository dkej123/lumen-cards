// Bottom navigation bar: which item is the current view.

export interface NavTarget {
  /** `/lovelace/home`, `home` (relative to the dashboard), `#hash` or a full URL path with a query. */
  navigation_path?: string;
}

/** Absolute path of an item, relative paths resolved against the dashboard (first path segment). */
export function resolvePath(path: string, pathname: string): string {
  const p = path.trim();
  if (!p || p.startsWith("#")) return p;
  if (p.startsWith("/")) return p.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const dashboard = pathname.split("/").filter(Boolean)[0] ?? "lovelace";
  return `/${dashboard}/${p.split(/[?#]/)[0].replace(/\/+$/, "")}`;
}

/**
 * Index of the active item: an exact path match, else the longest path the current one starts
 * with (a sub-view keeps its parent active), hash items match the current hash; -1 if none.
 */
export function activeIndex(items: NavTarget[], loc: { pathname: string; hash?: string }): number {
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  let best = -1;
  let bestLen = -1;
  items.forEach((it, i) => {
    const raw = it.navigation_path ?? "";
    if (raw.startsWith("#")) {
      if (loc.hash && loc.hash === raw && 10_000 > bestLen) {
        best = i;
        bestLen = 10_000;
      }
      return;
    }
    const target = resolvePath(raw, loc.pathname);
    if (!target) return;
    const len = path === target ? 5_000 + target.length : path.startsWith(`${target}/`) ? target.length : -1;
    if (len > bestLen) {
      best = i;
      bestLen = len;
    }
  });
  return best;
}
