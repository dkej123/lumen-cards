/** Default tap by domain: the service that runs a script, scene, button or automation (HA button card / Mushroom behaviour). */
export const RUN: Record<string, [string, string]> = {
  script: ["script", "turn_on"],
  scene: ["scene", "turn_on"],
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  automation: ["automation", "trigger"],
};

/** Actions that send a command to a device (others only open or navigate): worth a spinner until the entity answers. */
const COMMANDS = new Set(["toggle", "perform-action", "call-service"]);
export const sendsCommand = (action: string | undefined): boolean => !!action && COMMANDS.has(action);
