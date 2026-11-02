// Shared test helpers: entities, a recording hass mock, mounting cards, the body-level layer.
import type { HassEntity, HassLike } from "../src/hass/types";

/** An entity; `changed` = ms ago (default 10 min) or a fixed ISO time. */
export const ent = (entity_id: string, state: string, attributes: Record<string, unknown> = {}, changed: number | string = 600_000): HassEntity => {
  const at = typeof changed === "string" ? changed : new Date(Date.now() - changed).toISOString();
  return { entity_id, state, attributes: { friendly_name: entity_id.split(".")[1], ...attributes }, last_changed: at, last_updated: at };
};

export type MockHass = HassLike & {
  /** Every callService call, as its argument list. */
  calls: unknown[][];
  /** Paths requested through callApi. */
  api: string[];
  /** Make callService throw for these calls (set or replace at any time). */
  fail?: (args: unknown[]) => boolean;
};

/** A hass object (user Ann, English, light theme) that records service calls. */
export const mockHass = (
  states: HassEntity[] | Record<string, HassEntity> = [],
  opts: { api?: (path: string) => unknown; locale?: Record<string, unknown> } = {},
): MockHass => {
  const h: MockHass = {
    calls: [],
    api: [],
    states: Array.isArray(states) ? Object.fromEntries(states.map((e) => [e.entity_id, e])) : states,
    user: { id: "u1", name: "Ann", is_admin: true },
    language: "en",
    locale: { language: "en", ...opts.locale },
    themes: { darkMode: false },
    formatEntityState: (e) => e.state,
    callService: async (...args) => {
      h.calls.push(args);
      if (h.fail?.(args)) throw new Error("Invalid alarm code provided");
      return undefined;
    },
    callWS: async () => ({}) as never,
  };
  if (opts.api) Object.assign(h, { callApi: async (_m: string, path: string) => (h.api.push(path), opts.api!(path)) });
  return h;
};

export type Card = HTMLElement & {
  requestUpdate(): void;
  setConfig(c: unknown): void;
  hass: HassLike;
  updateComplete: Promise<boolean>;
  preview: boolean;
  editMode: boolean;
  getGridOptions(): Record<string, unknown>;
};

/** `lumen-<type>-card` with `config`, in the page; `setup` runs before hass is set. */
export const mount = async (type: string, config: Record<string, unknown>, h?: HassLike, setup?: (el: Card) => void): Promise<Card> => {
  const el = document.createElement(`lumen-${type}-card`) as Card;
  el.setConfig({ type: `custom:lumen-${type}-card`, ...config });
  setup?.(el);
  if (h) el.hass = h;
  document.body.append(el);
  await el.updateComplete;
  return el;
};

/** The body-level layer (FABs, dialogs, sheets). */
export const layer = () => document.querySelector("lumen-cards-layer")?.shadowRoot ?? null;

/** Let timers queued by the last update run, then wait for the card. */
export const settle = async (el: Card) => {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};
