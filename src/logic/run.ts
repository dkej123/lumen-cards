/** Default tap by domain: the service that runs a script, scene, button or automation (HA button card / Mushroom behaviour). */
export const RUN: Record<string, [string, string]> = {
  script: ["script", "turn_on"],
  scene: ["scene", "turn_on"],
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  automation: ["automation", "trigger"],
};

/** Toggled with homeassistant.toggle. Never `lock`: a tap must not unlock anything without the lock card's code. */
const TOGGLE = new Set(["switch", "input_boolean", "light", "fan", "cover", "siren", "humidifier", "valve", "media_player", "climate", "group"]);

export type DefaultTap = { kind: "run"; domain: string; service: string } | { kind: "toggle" } | { kind: "more-info" };

/** A tap without a configured action, on a button, a chip or a sub-button: run, toggle, else details. */
export function defaultTap(entityId: string): DefaultTap {
  const domain = entityId.split(".")[0];
  const run = RUN[domain];
  if (run) return { kind: "run", domain: run[0], service: run[1] };
  return TOGGLE.has(domain) ? { kind: "toggle" } : { kind: "more-info" };
}

/** Actions that send a command to a device (others only open or navigate): worth a spinner until the entity answers. */
const COMMANDS = new Set(["toggle", "perform-action", "call-service"]);
export const sendsCommand = (action: string | undefined): boolean => !!action && COMMANDS.has(action);
