import type { HassLike } from "../hass/types";
import { t } from "./i18n";
import { toast } from "./toast";

/** Service call on one entity; a failure shows the error toast. Resolves false on failure. */
export function callOrToast(host: HTMLElement, hass: HassLike | undefined, domain: string, service: string, data: Record<string, unknown>, entity?: string): Promise<boolean> {
  if (!hass) return Promise.resolve(false);
  return hass
    .callService(domain, service, data, entity ? { entity_id: entity } : undefined)
    .then(() => true)
    .catch((err: Error) => {
      toast(host, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: err?.message ?? String(err) });
      return false;
    });
}

/** Display name: config name, friendly name, entity id. */
export const entityName = (name: string | undefined, e: { attributes: Record<string, unknown> } | undefined, id: string): string =>
  name || String(e?.attributes.friendly_name ?? "") || id;
