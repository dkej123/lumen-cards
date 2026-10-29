import type { HassLike } from "../hass/types";
import { num } from "../logic/format";
import { sparkPath, type Point } from "../logic/spark";

/**
 * 24 h history for sparklines (design loadHistory/spark), shared by every card on the page:
 * entities asked for in the same tick go out as one `history_during_period` call, an entity is
 * reloaded at most every 10 min, and live changes are appended in between (dashboards stay
 * open all day).
 */
const RELOAD_MS = 10 * 60_000;
const DAY_MS = 24 * 3_600_000;

const points = new Map<string, Point[]>();
const loadedAt = new Map<string, number>();
const listeners = new Set<() => void>();
let queue = new Set<string>();
let flushHass: HassLike | undefined;

async function flush() {
  const ids = [...queue];
  queue = new Set();
  const hass = flushHass;
  if (!hass || !ids.length) return;
  try {
    const result = await hass.callWS<Record<string, { s: string; lu: number }[]>>({
      type: "history/history_during_period",
      start_time: new Date(Date.now() - DAY_MS).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
    });
    for (const id of ids) {
      let lu = 0;
      points.set(id, (result[id] ?? []).map((p) => ({ t: (lu = p.lu ?? lu) * 1000, v: Number(p.s) })).filter((p) => !Number.isNaN(p.v)));
    }
    listeners.forEach((l) => l());
  } catch {
    // History is decorative; keep the last data and retry on the next round.
    ids.forEach((id) => loadedAt.delete(id));
  }
}

export class History {
  constructor(private onLoad: () => void) {}

  /** Start receiving loads (connectedCallback). */
  connect() {
    listeners.add(this.onLoad);
  }

  disconnect() {
    listeners.delete(this.onLoad);
  }

  has(entity: string) {
    return points.has(entity);
  }

  last(entity: string): Point | undefined {
    return points.get(entity)?.at(-1);
  }

  /** Queue a (re)load of entities whose data is missing or older than 10 min. */
  load(hass: HassLike | undefined, ids: (string | undefined)[]) {
    if (!hass) return;
    const now = Date.now();
    const due = ids.filter((id): id is string => !!id && now - (loadedAt.get(id) ?? 0) > RELOAD_MS);
    if (!due.length) return;
    due.forEach((id) => {
      loadedAt.set(id, now);
      queue.add(id);
    });
    flushHass = hass;
    if (queue.size === due.length) queueMicrotask(flush);
  }

  /** Append the live state as a point and drop points older than 24 h (willUpdate, not render). */
  track(hass: HassLike | undefined, entity: string) {
    const list = points.get(entity);
    if (!list) return;
    const e = hass?.states[entity];
    const current = num(e);
    const at = e ? Date.parse(e.last_changed) : NaN;
    const last = list.at(-1);
    if (current !== null && Number.isFinite(at) && (!last || at > last.t)) list.push({ t: at, v: current });
    const keep = list.findIndex((p) => p.t > Date.now() - DAY_MS);
    if (keep > 1) points.set(entity, list.slice(keep - 1));
  }

  /** Time-axis sparkline of the last `hours` (pure). */
  spark(entity: string, hours: number, w: number, h: number, minSpan = 0) {
    const list = points.get(entity);
    if (!list) return { line: "", area: "" };
    const now = Date.now();
    return sparkPath(list, now - hours * 3_600_000, now, w, h, minSpan);
  }
}
