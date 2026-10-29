import { setLanguage, t } from "./i18n";

export const DOCS = "https://github.com/dkej123/lumen-cards";

interface CardInfo {
  name: string;
  description: string;
  /** Entity domains the card is suggested for in HA's "by entity" card picker. */
  domains?: string[];
  /** Extra condition for the suggestion (e.g. only PM sensors). */
  suggest?: (entity: { entity_id: string; attributes: Record<string, unknown> }) => boolean;
  /** Config of the suggestion; default { entity }. */
  config?: (entity: { entity_id: string; attributes: Record<string, unknown> }) => Record<string, unknown>;
}

type HassLite = { states?: Record<string, { entity_id: string; attributes: Record<string, unknown> }>; language?: string; locale?: { language?: string } };

/** The card picker asks before any card got `hass`: read the language from the app itself. */
const syncLanguage = (hass?: HassLite) => {
  const h = hass ?? (document.querySelector("home-assistant") as unknown as { hass?: HassLite } | null)?.hass;
  if (h) setLanguage(h.locale?.language ?? h.language);
};

/** customElements.define + card picker entry (window.customCards), idempotent. */
export function registerCard(tag: string, element: CustomElementConstructor, info: CardInfo): void {
  if (!customElements.get(tag)) customElements.define(tag, element);
  const cards = ((window as unknown as { customCards?: object[] }).customCards ??= []) as Record<string, unknown>[];
  if (cards.some((c) => c.type === tag)) return;
  const entry: Record<string, unknown> = {
    type: tag,
    get name() {
      syncLanguage();
      return `Lumen · ${t(info.name)}`;
    },
    get description() {
      syncLanguage();
      return t(info.description);
    },
    preview: true,
    documentationURL: `${DOCS}#${tag}`,
  };
  if (info.domains) {
    entry.getEntitySuggestion = (hass: HassLite, entityId: string) => {
      const e = hass?.states?.[entityId];
      if (!e || !info.domains!.includes(entityId.split(".")[0]) || (info.suggest && !info.suggest(e))) return null;
      syncLanguage(hass);
      return [{ label: `Lumen · ${t(info.name)}`, config: { type: `custom:${tag}`, ...(info.config ? info.config(e) : { entity: entityId }) } }];
    };
  }
  cards.push(entry);
}
