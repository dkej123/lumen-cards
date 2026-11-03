import type { ReactiveController, ReactiveControllerHost } from "lit";
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
/** How far back an entity is kept, when a card wants more than a day. */
const spans = new Map<string, number>();
const spanOf = (id: string) => spans.get(id) ?? DAY_MS;
const loadedAt = new Map<string, number>();
const listeners = new Set<() => void>();
let queue = new Set<string>();
let flushHass: HassLike | undefined;

async function flush() {
  const ids = [...queue];
  queue = new Set();
  const hass = flushHass;
  if (!hass || !ids.length) return;
  await Promise.all([...new Set(ids.map(spanOf))].map((span) => fetchSpan(hass, ids.filter((id) => spanOf(id) === span), span)));
  listeners.forEach((l) => l());
}

async function fetchSpan(hass: HassLike, ids: string[], span: number) {
  try {
    const result = await hass.callWS<Record<string, { s: string; lu: number }[]>>({
      type: "history/history_during_period",
      start_time: new Date(Date.now() - span).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
    });
    for (const id of ids) {
      let lu = 0;
      points.set(id, (result[id] ?? []).map((p) => ({ t: (lu = p.lu ?? lu) * 1000, v: Number(p.s) })).filter((p) => !Number.isNaN(p.v)));
    }
  } catch {
    // History is decorative; keep the last data and retry on the next round.
    ids.forEach((id) => loadedAt.delete(id));
  }
}

/**
 * A card's view of the shared history. While the card is in the page it hears about loads,
 * asks for its entities on each update and every minute, and appends their live states.
 */
export class History implements ReactiveController {
  private timer?: number;

  constructor(
    private host: ReactiveControllerHost & { hass?: HassLike },
    /** The entities the card shows history for. */
    private ids: () => (string | undefined)[],
    private onLoad: () => void = () => host.requestUpdate(),
    /** Keep this many hours (more than the default day). */
    private hours = 24,
  ) {
    host.addController(this);
  }

  hostConnected() {
    listeners.add(this.onLoad);
    this.timer = window.setInterval(() => this.load(this.host.hass, this.ids()), 60_000);
  }

  hostUpdate() {
    const hass = this.host.hass;
    if (!hass) return;
    const ids = this.ids();
    this.load(hass, ids);
    ids.forEach((id) => id && this.track(hass, id));
  }

  hostDisconnected() {
    listeners.delete(this.onLoad);
    window.clearInterval(this.timer);
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
    const span = this.hours * 3_600_000;
    if (span > DAY_MS) {
      for (const id of ids) {
        if (id && spanOf(id) < span) {
          spans.set(id, span);
          loadedAt.delete(id);
        }
      }
    }
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
    const keep = list.findIndex((p) => p.t > Date.now() - spanOf(entity));
    if (keep > 1) points.set(entity, list.slice(keep - 1));
  }

  /** Hours of data there are, at most `hours`: a young sensor fills the sparkline instead of its right edge. */
  span(entity: string, hours: number): number {
    const first = points.get(entity)?.[0]?.t;
    if (first === undefined) return hours;
    return Math.max(0.25, Math.min(hours, (Date.now() - first) / 3_600_000));
  }

  /** Lowest and highest value of the last `hours`. */
  range(entity: string, hours: number): [number, number] | undefined {
    const from = Date.now() - hours * 3_600_000;
    const vs = (points.get(entity) ?? []).filter((p) => p.t > from).map((p) => p.v);
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : undefined;
  }

  /** Time-axis sparkline of the last `hours` (pure). */
  spark(entity: string, hours: number, w: number, h: number, minSpan = 0, range?: [number, number]) {
    const list = points.get(entity);
    if (!list) return { line: "", area: "" };
    const now = Date.now();
    return sparkPath(list, now - hours * 3_600_000, now, w, h, minSpan, range);
  }
}
