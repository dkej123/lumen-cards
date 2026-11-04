import { LitElement, html, unsafeCSS, type CSSResultGroup, type PropertyValues } from "lit";
import { tokens } from "../design/tokens";
import type { HassEntity, HassLike } from "../hass/types";
import { setLanguage, setLocale, t } from "./i18n";
import { injectFonts } from "../design/fonts";
import { weather } from "../weather/engine";
import { handleAction, haptic, openMoreInfo, type ActionConfig } from "./actions";
import { cssColor, shared } from "./styles";
import { findAncestor } from "./dom";
import { HostLook } from "./controllers/host-look";
import { UserStyles } from "./controllers/user-styles";
import "./form-editor";
import type { CardForm, LumenFormEditor } from "./form-editor";
import { editLabel, errorCard, sampleBadge, skeleton } from "./parts";
import { Presses } from "./press";
import { haConditions, visibilityLabels } from "./visibility";
import { editPreview } from "./edit-preview";
import type { SubButton } from "./sub-buttons";

/** Options every card has (editor section "Appearance"). */
export interface BaseConfig {
  type: string;
  /**
   * auto: compact when the card itself is narrow (or, for text cards, on a narrow screen);
   * wide / compact force one look; icon = icon + value without a background (weather card).
   */
  layout?: "auto" | "wide" | "compact" | "icon";
  color_scheme?: "auto" | "light" | "dark";
  /** Glow / fill of lit lights: HA colour name, hex or RGB triple. Default: from the light. */
  glow_color?: string | [number, number, number];
  /** Accent (scenes FAB, AC dry and fan modes, focus ring). */
  accent_color?: string | [number, number, number];
  /** Weather effects drawn on this card (needs a lumen-weather-background-card card in the view). */
  weather_effects?: boolean;
  /** The card is never wider than this and stays centred in its grid cell (`max_width_unit`, or "80%" / "320px"). */
  max_width?: number | string;
  /** Unit of a numeric `max_width`: px (default) or % of the grid cell. */
  max_width_unit?: "px" | "%";
  /** Floating button side (cards with a FAB): right (default) or left. */
  fab_side?: "right" | "left";
  /** Vibration feedback on taps, holds and drags (default on). */
  haptics?: boolean;
  /** Haptic type of the drag ticks (default selection, light at the ends). */
  haptic_tick?: string;
  /** Extra CSS inside the card (advanced, like Bubble Card `styles` / card-mod). */
  styles?: string;
  /** Note shown on the card only while the dashboard is being edited (e.g. "phone copy"). */
  edit_note?: string;
  /** Small extra buttons on the right (cards that have room for them). */
  sub_buttons?: SubButton[];
}

/** The tap / hold / double-tap options of a card (or of one item in it, e.g. a chip). */
export interface CardActions {
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/** Sizes in HA's sections grid: half a section (6 of 12 columns), a row (12), or the whole section. */
export const GRID = {
  half: { columns: 6, rows: "auto", min_columns: 3 },
  row: { columns: 12, rows: "auto", min_columns: 3 },
  full: { columns: "full", rows: "auto" },
} as const;

/** Narrow screen (phones, portrait tablets): sheets instead of dialogs, text scale, FAB auto mode. */
export const WIDE_PX = 1024;
const wideQuery: MediaQueryList | undefined = typeof matchMedia === "undefined" ? undefined : matchMedia(`(min-width: ${WIDE_PX}px)`);

/** Picker preview of a card with no sample of its own: says "No data" rather than invent a device's values. */
const exampleEntity = (id: string): HassEntity => {
  const now = new Date().toISOString();
  return { entity_id: id, state: "unknown", attributes: { friendly_name: t("common.example") }, last_changed: now, last_updated: now };
};

/** CSS max-width from `max_width` (+ unit): 320 → 320px, 80 + "%" → 80%, "80%" / "320px" as written; % is capped at 100. */
export function maxWidthCss(v: unknown, unit?: string): string | undefined {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(px|%)?\s*$/.exec(String(v ?? ""));
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  const u = m[2] ?? (unit === "%" ? "%" : "px");
  if (!(n > 0)) return undefined;
  return u === "%" ? `${Math.min(n, 100)}%` : `${n}px`;
}

/**
 * Base of every Lumen card: config validation hooks, `hass` gating (re-render only when the
 * card's own entities, the user, theme or language change), theme/variant/accent on the host,
 * weather surface registration and timers that die with the card.
 */
export abstract class LumenBaseCard<C extends BaseConfig = BaseConfig> extends LitElement {
  static properties = {
    preview: { type: Boolean },
    _config: { state: true },
    _wide: { state: true },
    _width: { state: true },
    editMode: { type: Boolean },
  };

  /**
   * `layout: auto` rule: card width (px) below which the card is compact, or "screen" for cards
   * whose two looks are a text scale (greeting, titles) – compact on a narrow screen.
   */
  protected static compactBelow: number | "screen" = "screen";

  /** Default size in the sections grid (getGridOptions). */
  protected static grid: Record<string, unknown> = GRID.row;

  /** Height in masonry rows of 50 px (getCardSize), when it does not depend on the state. */
  protected static cardSize = 1;

  getGridOptions(): Record<string, unknown> {
    return { ...(this.constructor as typeof LumenBaseCard).grid };
  }

  getCardSize(): number {
    return (this.constructor as typeof LumenBaseCard).cardSize;
  }

  /** Height of the loading skeleton (section 15), 0 = none (background / text cards). */
  protected static skeletonHeight = 58;

  /**
   * Sample entity for the card picker preview when the entity of the stub config does not exist
   * (section 15, "Example" badge). Without one the preview is a nameless entity without data.
   */
  protected static sample?: (entityId: string) => HassEntity | undefined;

  /** Visual editor: the card's getConfigForm() schema in a form that shows the defaults. */
  static getConfigElement(): HTMLElement | undefined {
    const form = (this as unknown as { getConfigForm?: () => CardForm }).getConfigForm?.();
    if (!form) return undefined;
    const el = document.createElement("lumen-form-editor") as LumenFormEditor;
    el.form = form;
    return el;
  }

  protected readonly hostLook = new HostLook(this, () => ({
    dark: this.dark,
    accent: cssColor(this._config?.accent_color),
    glow: cssColor(this._config?.glow_color),
    effects: this.effects,
    maxWidth: maxWidthCss(this._config?.max_width, this._config?.max_width_unit),
    align: this.align,
  }));
  protected readonly userStyles = new UserStyles(this, () => (typeof this._config?.styles === "string" ? this._config.styles : ""));
  /** HA visibility conditions around the card while the dashboard is edited (worked out once per update). */
  private editConds?: ReturnType<typeof haConditions>;

  /** Tap / hold / double-tap state of the card's pressable parts (timers die with the card). */
  protected presses = new Presses((type) => this.haptic(type), this);

  /** Set by HA in the card editor / picker preview. */
  preview = false;
  /** Set by HA while the dashboard is being edited. */
  editMode = false;
  protected _config!: C;
  protected _wide = wideQuery?.matches ?? true;
  protected _width = 0;
  private resize?: ResizeObserver;
  protected _hass?: HassLike;
  private timers: number[] = [];
  /** Config the card cannot work with (section 15): shown as the Lumen error card instead of HA's. */
  protected _configError?: { title: string; detail: string };
  private _inPicker?: boolean;

  /**
   * General states of every card (section 15) come before the card's own content: config error,
   * loading skeleton, entity not found; then the example badge and the edit-mode label.
   */
  render() {
    return this.withEditLabel(this.generalState() ?? this.withBadge(this.renderCard()));
  }

  /** The card's own content (render() adds the general states around it). */
  protected abstract renderCard(): unknown;

  /** Entities whose state changes re-render the card. */
  protected abstract entityIds(): readonly (string | undefined)[];

  /** Throw an Error with a readable message when the config is invalid. */
  protected validate(_config: C): void {}

  /** Defaults merged under the user's config. */
  protected defaults(): Partial<C> {
    return {};
  }

  /**
   * Invalid configs no longer throw (HA would show its own red error card): the card keeps the
   * config and renders the Lumen error card with the reason and the card type.
   */
  setConfig(config: C): void {
    if (!config || typeof config !== "object") {
      this._configError = { title: t("error.invalid_config"), detail: "" };
      this._config = { type: "" } as C;
      this.requestUpdate();
      return;
    }
    try {
      this.validate(config);
      this._configError = undefined;
    } catch (err) {
      this._configError = { title: (err as Error)?.message ?? String(err), detail: `type: ${config.type ?? ""}` };
    }
    this._config = { ...this.defaults(), ...config } as C;
    this.requestUpdate();
  }

  /** Main entity of the card (the `entity` option): "entity not found" when it does not exist. */
  protected mainEntity(): string | undefined {
    const id = (this._config as { entity?: unknown } | undefined)?.entity;
    return typeof id === "string" && id ? id : undefined;
  }

  /** The card shows an error card: an invalid config, or a main entity that does not exist. What lives outside the card (floating buttons) must not show then, and the card must not hide itself. */
  protected get hasError(): boolean {
    if (this._configError) return true;
    const id = this.mainEntity();
    return !!id && !!this._hass && !this._hass.states[id] && !this.sampleFor(id);
  }

  /** Section 15 states shared by every card, or undefined when the card renders itself. */
  private generalState() {
    if (this._configError) {
      // Re-read the reason: setConfig may run before `hass` set the user's language.
      let title = this._configError.title;
      try {
        if (this._config?.type) this.validate(this._config);
      } catch (err) {
        title = (err as Error)?.message ?? title;
      }
      return errorCard(title, this._configError.detail);
    }
    if (!this._config) return undefined;
    const ctor = this.constructor as typeof LumenBaseCard;
    if (!this._hass) return ctor.skeletonHeight ? skeleton(ctor.skeletonHeight) : undefined;
    const id = this.mainEntity();
    if (id && !this._hass.states[id] && !this.sampleFor(id)) return errorCard(t("error.entity_not_found"), id);
    return undefined;
  }

  private withBadge(content: unknown) {
    const id = this.mainEntity();
    if (!id || !this._hass || this._hass.states[id] || !this.sampleFor(id)) return content;
    return html`<div style="position:relative">${content}${sampleBadge()}</div>`;
  }

  /**
   * Dashboard edit mode: HA shows every card, also the ones its visibility conditions hide (one
   * copy per screen size), without telling them apart – label them, plus the card's `edit_note`.
   */
  private withEditLabel(content: unknown) {
    const conds = this.editConds;
    if (!conds) return content;
    const labels = [...visibilityLabels(conds.card), ...visibilityLabels(conds.section).map((l) => ({ ...l, section: true }))];
    const note = typeof this._config?.edit_note === "string" ? this._config.edit_note.trim() : "";
    if (!labels.length && !note) return content;
    return html`<div style="position:relative">${content}${editLabel(labels, note)}</div>`;
  }

  /** Inside HA's card picker (hui-card-picker), where previews may show sample data. */
  protected get inCardPicker(): boolean {
    if (!this.preview) return false;
    if (this._inPicker !== undefined) return this._inPicker;
    if (findAncestor(this, (el) => el.localName === "hui-card-picker", 16)) return (this._inPicker = true);
    // Only cached once the card is in the page (the picker attaches previews after creating them).
    if (this.isConnected) this._inPicker = false;
    return false;
  }

  private sampleFor(id: string): HassEntity | undefined {
    if (!this.inCardPicker) return undefined;
    const make = (this.constructor as typeof LumenBaseCard).sample;
    return make ? make(id) : exampleEntity(id);
  }

  set hass(hass: HassLike) {
    const prev = this._hass;
    this._hass = hass;
    if (!prev || prev.language !== hass.language || prev.locale !== hass.locale) {
      setLanguage(hass.locale?.language ?? hass.language);
      setLocale(hass.locale);
    }
    this.onHass(hass);
    if (!prev || this.changed(prev, hass)) this.requestUpdate();
  }

  /** Every new `hass` (before the render gate). */
  protected onHass(_hass: HassLike): void {}

  get hass(): HassLike | undefined {
    return this._hass;
  }

  private changed(prev: HassLike, next: HassLike): boolean {
    if (
      prev.user?.id !== next.user?.id ||
      prev.themes?.darkMode !== next.themes?.darkMode ||
      prev.language !== next.language ||
      prev.locale !== next.locale ||
      prev.formatEntityState !== next.formatEntityState
    )
      return true;
    // The error card reads no entities (and a broken config may not have the lists entityIds() expects).
    if (!this._config || this._configError) return false;
    return this.entityIds().some((id) => id && prev.states[id] !== next.states[id]);
  }

  protected entity(id?: string): HassEntity | undefined {
    if (!id) return undefined;
    return this._hass?.states[id] ?? (id === this.mainEntity() ? this.sampleFor(id) : undefined);
  }

  /** Wide or compact look (`layout`). */
  get compact(): boolean {
    const v = this._config?.layout ?? "auto";
    if (v !== "auto") return v === "compact";
    const rule = (this.constructor as typeof LumenBaseCard).compactBelow;
    return rule === "screen" ? !this._wide : this._width > 0 && this._width < rule;
  }

  /** Viewport narrower than WIDE_PX: overlays become bottom sheets, FABs in auto mode show. */
  get narrowScreen(): boolean {
    return !this._wide;
  }

  protected get dark(): boolean {
    const t = this._config?.color_scheme ?? "auto";
    return t === "auto" ? !!this._hass?.themes?.darkMode : t === "dark";
  }

  /** Where the card sits when `max_width` makes it narrower than its place (cards with an `align` option). */
  protected get align(): "start" | "center" | "end" | undefined {
    return undefined;
  }

  /** Glow colour of lit lights: the configured one, a theme-wide override, else `auto`. */
  glowColor(auto: string): string {
    return cssColor(this._config?.glow_color) ?? `var(--lumen-cards-glow-color, ${auto})`;
  }

  protected get effects(): boolean {
    return this._config?.weather_effects !== false && !this.preview;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Back on the page (HA keeps a view's cards when you switch tabs): what lives outside the card
    // (floating buttons, dialogs, the weather background) was removed on leaving, render it again.
    this.requestUpdate();
    // Fonts live next to the bundle (served at /hacsfiles/lumen-cards/); injected once.
    injectFonts(import.meta.url.replace(/[^/]*$/, ""));
    wideQuery?.addEventListener("change", this.onWide);
    this._wide = wideQuery?.matches ?? true;
    weather.register(this);
    if (typeof (this.constructor as typeof LumenBaseCard).compactBelow === "number" && typeof ResizeObserver !== "undefined") {
      this.resize = new ResizeObserver(([e]) => {
        const w = Math.round(e.contentRect.width);
        if (w > 0 && w !== this._width) this._width = w;
      });
      this.resize.observe(this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    wideQuery?.removeEventListener("change", this.onWide);
    weather.unregister(this);
    editPreview.remove(this);
    this.resize?.disconnect();
    this.resize = undefined;
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
  }

  private onWide = () => {
    this._wide = wideQuery?.matches ?? true;
    // HA's own screen conditions (hidden cards / sections) switch on the same width: look again after them.
    requestAnimationFrame(() => this.requestUpdate());
  };

  /** setInterval that is cleared when the card leaves the DOM (re-added on reconnect by the caller). */
  protected every(ms: number, fn: () => void): void {
    this.timers.push(window.setInterval(fn, ms));
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.editConds = this.preview && this.isConnected ? haConditions(this) : undefined;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.editConds) editPreview.add(this);
    else editPreview.remove(this);
    weather.scan(this);
  }

  /**
   * Press handlers of `cfg`'s actions on `entity`. Tap: `o.tap` when given (the card runs
   * `tap_action` itself), else the configured action, else more-info (`o.tap: null` = none).
   * Hold: the configured action, else `o.hold`, else more-info. Double tap only when configured.
   */
  protected actions(key: string, cfg: CardActions, entity: string, o: { tap?: (() => void) | null; hold?: () => void } = {}) {
    const tap = o.tap ?? (cfg.tap_action ? () => handleAction(this, cfg.tap_action, entity, "tap") : o.tap === null ? undefined : () => this.moreInfo(entity));
    return this.presses.handlers(key, tap, this.holdAction(cfg, entity, o.hold), cfg.double_tap_action ? () => handleAction(this, cfg.double_tap_action, entity, "double_tap") : undefined);
  }

  /** The configured hold action on `entity`, else `fallback` (default more-info). */
  protected holdAction(cfg: CardActions, entity: string, fallback?: () => void): () => void {
    return () => (cfg.hold_action ? handleAction(this, cfg.hold_action, entity, "hold") : (fallback ?? (() => this.moreInfo(entity)))());
  }

  protected haptic(type = "light"): void {
    haptic(this, type);
  }

  protected moreInfo(entityId: string): void {
    openMoreInfo(this, entityId);
  }

  static styles: CSSResultGroup = [tokens, unsafeCSS(shared)];
}
