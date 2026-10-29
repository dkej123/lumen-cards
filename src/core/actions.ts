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

/** Companion-app haptics: success, warning, failure, light, medium, heavy, selection. */
export const haptic = (node: EventTarget, type: string): void => fireEvent(node, "haptic", type);

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
