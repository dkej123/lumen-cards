// Subset of the `hass` object Home Assistant injects into cards and panels.
// Standalone and mock modes build an object of the same shape, so components
// never know where they run.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  last_reported?: string;
  context?: { id: string; parent_id: string | null; user_id: string | null };
}

export type HassEntities = Record<string, HassEntity>;

export interface HassUser {
  id: string;
  name: string;
  is_admin: boolean;
}

export interface HassLike {
  states: HassEntities;
  user?: HassUser;
  themes?: { darkMode?: boolean };
  config?: { location_name?: string; latitude?: number; longitude?: number };
  /** WebSocket connection (subscriptions such as dom_panel/labels/subscribe). */
  connection?: {
    subscribeMessage<T>(callback: (message: T) => void, msg: { type: string; [key: string]: unknown }): Promise<() => Promise<void>>;
  };
  language?: string;
  locale?: { language?: string; number_format?: string; time_format?: string };
  /** HA's own state formatting (translations, units). */
  formatEntityState?(entity: HassEntity, state?: string): string;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ): Promise<unknown>;
  callWS<T>(msg: { type: string; [key: string]: unknown }): Promise<T>;
}

export const UNAVAILABLE_STATES = new Set(["unavailable", "unknown"]);

export const isUnavailable = (entity?: HassEntity): boolean =>
  !entity || UNAVAILABLE_STATES.has(entity.state);
