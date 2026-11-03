// Action chip of lumen-chips-card: whether it shows as the active choice.
import type { HassEntity } from "../hass/types";

/** Active while the entity's state (or `active_attribute`) equals `active_value`, ignoring case. */
export function chipActive(chip: { active_value?: string; active_attribute?: string }, e: HassEntity | undefined): boolean {
  if (chip.active_value === undefined || !e) return false;
  const current = chip.active_attribute ? e.attributes[chip.active_attribute] : e.state;
  return current !== undefined && current !== null && String(current).toLowerCase() === String(chip.active_value).toLowerCase();
}
