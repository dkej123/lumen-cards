import type { HassEntity } from "../hass/types";

/**
 * Reminder dialog (e.g. "Bike to charge"): shown once per occurrence while the dashboard is open.
 * The key is the entity's `last_changed`, so every new occurrence (condition gone and back)
 * has a new key; the panel forgets the seen keys on every entry (owner, A37).
 * Returns the key to show the dialog for, or null.
 */
export function alertToShow(entity: HassEntity | undefined, state: string, seen: string | undefined): string | null {
  if (entity?.state !== state) return null;
  const key = `${entity.entity_id}@${entity.last_changed}`;
  return key === seen ? null : key;
}
