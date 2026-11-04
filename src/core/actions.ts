import type { HassLike } from "../hass/types";

/** HA-format action (tap_action / hold_action / double_tap_action), as the `ui_action` selector writes it. */
export interface ActionConfig {
  action: "toggle" | "more-info" | "perform-action" | "call-service" | "navigate" | "url" | "assist" | "none";
  perform_action?: string;
  service?: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  entity?: string;
  navigation_path?: string;
  url_path?: string;
  confirmation?: boolean | { text?: string };
}

export const fireEvent = (node: EventTarget, type: string, detail?: unknown): void => {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
};

/** Native HA more-info dialog. */
export const openMoreInfo = (node: EventTarget, entityId: string): void => fireEvent(node, "hass-more-info", { entityId });

/** Vibration (ms) in a plain mobile browser, where HA's `haptic` event does nothing. */
const VIBRATE: Record<string, number | number[]> = { selection: 3, light: 6, medium: 18, heavy: 28, success: [12, 40, 12], warning: [20, 60, 20], failure: [30, 60, 30] };

/** Running inside the HA companion app (it turns `haptic` events into native haptics). */
const inApp = () => {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { externalApp?: unknown; webkit?: { messageHandlers?: { externalBus?: unknown } } };
  return !!w.externalApp || !!w.webkit?.messageHandlers?.externalBus;
};

/**
 * Haptics: success, warning, failure, light, medium, heavy, selection. The companion app maps HA's
 * `haptic` event to native feedback; a mobile browser gets a short navigator.vibrate (Android).
 */
export const haptic = (node: EventTarget, type: string): void => {
  // `haptics: false` on the card (default on) silences it.
  if ((node as { _config?: { haptics?: boolean } })._config?.haptics === false) return;
  fireEvent(node, "haptic", type);
  if (!inApp() && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(VIBRATE[type] ?? 10);
    } catch {
      /* not allowed before a user gesture */
    }
  }
};

/**
 * Gentle ticks while a value is dragged (brightness, speed, position, volume…): the lightest
 * `selection` tick every `step` units (every 1 %), `light` at either end of the scale, and
 * at most one tick per 25 ms so a fast drag does not buzz.
 */
export class DragTicks {
  private last: number | null = null;
  private at = 0;
  constructor(private step = 1) {}

  /** The drag starts at `value` (no tick). */
  start(value: number): void {
    this.last = Math.round(value / this.step);
  }

  move(node: EventTarget, value: number, min = 0, max = 100): void {
    const bucket = Math.round(value / this.step);
    if (this.last === null) {
      this.last = bucket;
      return;
    }
    if (bucket === this.last) return;
    this.last = bucket;
    const end = value <= min || value >= max;
    const now = Date.now();
    if (!end && now - this.at < 25) return;
    this.at = now;
    // The card's `haptic_tick` picks the type (the HA app decides how strong each one is).
    const own = (node as { _config?: { haptic_tick?: string } })._config?.haptic_tick;
    haptic(node, own ?? (end ? "light" : "selection"));
  }

  end(): void {
    this.last = null;
  }
}

/**
 * A configured action goes to HA's own handler (`hass-action`), so confirmation, navigation,
 * assist and every future action type behave exactly like in built-in cards.
 */
export function handleAction(node: HTMLElement, action: ActionConfig | undefined, entity: string | undefined, kind: "tap" | "hold" | "double_tap" = "tap"): void {
  if (!action || action.action === "none") return;
  fireEvent(node, "hass-action", { config: { entity, [`${kind}_action`]: action }, action: kind });
}

/** Service call helper: "domain.service" + optional target entity. */
export function callService(hass: HassLike, service: string, data: Record<string, unknown> = {}, entity?: string): Promise<unknown> {
  const [domain, name] = service.split(".", 2);
  return hass.callService(domain, name, data, entity ? { entity_id: entity } : undefined);
}
