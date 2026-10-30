/** Default tap by domain: the service that runs a script, scene, button or automation (HA button card / Mushroom behaviour). */
export const RUN: Record<string, [string, string]> = {
  script: ["script", "turn_on"],
  scene: ["scene", "turn_on"],
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  automation: ["automation", "trigger"],
};
