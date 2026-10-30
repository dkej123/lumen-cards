import { LumenBaseCard, type BaseConfig } from "./base-card";
import { t } from "./i18n";
import { InnerCards, type CardConfig } from "./sheet";
import type { HassLike } from "../hass/types";

/** Config of a card that holds other cards. */
export interface ContainerConfig extends BaseConfig {
  cards?: CardConfig[];
}

/** `cards`, when given, must be a list. */
export function assertCards(c: { cards?: unknown }): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("error.cards"));
}

/**
 * Base of the cards that hold other cards (bar, stacks, pop-up, floating panel): the inner cards
 * are built from `cards` (again when the list changes) and get every `hass`. Cards inside a sheet
 * build only while it is open (`cardsShown`).
 */
export abstract class LumenContainerCard<C extends ContainerConfig> extends LumenBaseCard<C> {
  /** Each inner card in HA's hui-card wrapper (visibility conditions, edit mode), as HA's stacks do. */
  protected static wrapCards = false;

  protected inner = new InnerCards(this, (c) => this.prepare(c), { wrap: (this.constructor as typeof LumenContainerCard).wrapCards });

  /** The config an inner card is built with. */
  protected prepare(c: CardConfig): CardConfig {
    return c;
  }

  /** The inner cards are on screen (a sheet: only while open). */
  protected get cardsShown(): boolean {
    return true;
  }

  protected get cards(): CardConfig[] {
    const list = this._config?.cards;
    return Array.isArray(list) ? list : [];
  }

  protected get hasCards(): boolean {
    return this.cards.length > 0;
  }

  /** Build (again) now: a sheet being opened. */
  protected buildCards(): void {
    this.inner.build(this.cards);
  }

  protected entityIds(): readonly (string | undefined)[] {
    return [];
  }

  protected validate(c: C): void {
    assertCards(c);
  }

  setConfig(config: C): void {
    super.setConfig(config);
    if (this.inner.invalidate(this._config.cards) && this.cardsShown) this.buildCards();
  }

  protected onHass(hass: HassLike): void {
    this.inner.setHass(hass);
  }
}
