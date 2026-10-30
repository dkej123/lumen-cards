import { LitElement, css, html, unsafeCSS, type CSSResultGroup, type PropertyValues } from "lit";
import { tokens } from "../design/tokens";
import type { HassEntity, HassLike } from "../hass/types";
import { setLanguage, setLocale, t } from "./i18n";
import { injectFonts } from "../design/fonts";
import { weather } from "../weather/engine";
import { haptic, openMoreInfo } from "./actions";
import { colorVars, cssColor, shared } from "./styles";
import "./form-editor";
import type { CardForm, LumenFormEditor } from "./form-editor";
import { editLabel, errorCard, sampleBadge, skeleton } from "./parts";
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
  /** Accent (scenes FAB, AC cool, focus ring). */
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

/** Narrow screen (phones, portrait tablets): sheets instead of dialogs, text scale, FAB auto mode. */
export const WIDE_PX = 1024;
const wideQuery: MediaQueryList | undefined = typeof matchMedia === "undefined" ? undefined : matchMedia(`(min-width: ${WIDE_PX}px)`);

// Fonts live next to the bundle (served at /hacsfiles/lumen-cards/).
if (typeof document !== "undefined") injectFonts(import.meta.url.replace(/[^/]*$/, ""));


/**
 * Base of every Lumen card: config validation hooks, `hass` gating (re-render only when the
 * card's own entities, the user, theme or language change), theme/variant/accent on the host,
 * weather surface registration and timers that die with the card.
 */
/** CSS max-width from `max_width` (+ unit): 320 → 320px, 80 + "%" → 80%, "80%" / "320px" as written; % is capped at 100. */
export function maxWidthCss(v: unknown, unit?: string): string | undefined {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(px|%)?\s*$/.exec(String(v ?? ""));
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  const u = m[2] ?? (unit === "%" ? "%" : "px");
  if (!(n > 0)) return undefined;
  return u === "%" ? `${Math.min(n, 100)}%` : `${n}px`;
}

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

  /**
   * Card width (px) below which the compact look becomes the icon tile (catalog C1), 0 = never.
   * Only cards that have an icon tile set it.
   */
  protected static iconBelow = 0;

  /** Height of the loading skeleton (section 15), 0 = none (background / text cards). */
  protected static skeletonHeight = 58;

  /**
   * Sample entity for the card picker preview when the entity of the stub config does not exist
   * (section 15, "Example" badge). Cards with an `entity` field override it.
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

  constructor() {
    super();
    // General states of every card (section 15) before the card's own render: config error,
    // loading skeleton, entity not found. Wrapping keeps every subclass' render() unchanged.
    const own = this.render;
    this.render = () => this.withEditLabel(this.generalState() ?? this.withBadge(own.call(this)));
  }

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
    if (!this.preview || !this.isConnected) return content;
    const conds = haConditions(this);
    if (!conds) return content;
    const labels = visibilityLabels(conds);
    const note = typeof this._config?.edit_note === "string" ? this._config.edit_note.trim() : "";
    if (!labels.length && !note) return content;
    return html`<div style="position:relative">${content}${editLabel(labels, note)}</div>`;
  }

  /** Inside HA's card picker (hui-card-picker), where previews may show sample data. */
  protected get inCardPicker(): boolean {
    if (!this.preview) return false;
    if (this._inPicker !== undefined) return this._inPicker;
    let n: Node | null = this;
    for (let i = 0; i < 16 && n; i++) {
      const parent: Node | null = n.parentNode;
      n = parent instanceof ShadowRoot ? parent.host : parent;
      if (n instanceof Element && n.localName === "hui-card-picker") return (this._inPicker = true);
    }
    // Only cached once the card is in the page (the picker attaches previews after creating them).
    if (this.isConnected) this._inPicker = false;
    return false;
  }

  private sampleFor(id: string): HassEntity | undefined {
    const make = (this.constructor as typeof LumenBaseCard).sample;
    return make && this.inCardPicker ? make(id) : undefined;
  }

  set hass(hass: HassLike) {
    const prev = this._hass;
    this._hass = hass;
    setLanguage(hass.locale?.language ?? hass.language);
    setLocale(hass.locale);
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
    if (!this._config) return false;
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

  /** Compact and narrower than `iconBelow`: only the icon (catalog C1). `layout: compact` never forces it. */
  get iconOnly(): boolean {
    const below = (this.constructor as typeof LumenBaseCard).iconBelow;
    return (this._config?.layout ?? "auto") === "auto" && this.compact && this._width > 0 && this._width < below;
  }

  /** Viewport narrower than WIDE_PX: overlays become bottom sheets, FABs in auto mode show. */
  get narrowScreen(): boolean {
    return !this._wide;
  }

  protected get dark(): boolean {
    const t = this._config?.color_scheme ?? "auto";
    return t === "auto" ? !!this._hass?.themes?.darkMode : t === "dark";
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

  /**
   * `--lumen-accent`, `-soft`, `-ink`, `-shadow`, `-fill-a`, `-fill-b`, `-glow` (and the same for
   * `--lumen-glow-*`) on the host from a user colour; removed when the option is cleared.
   */
  private userColor(name: string, c: string | undefined): void {
    const vars = colorVars(name, c ?? "transparent");
    for (const [k, v] of Object.entries(vars)) {
      if (c) this.style.setProperty(k, v);
      else this.style.removeProperty(k);
    }
  }

  /** setInterval that is cleared when the card leaves the DOM (re-added on reconnect by the caller). */
  protected every(ms: number, fn: () => void): void {
    this.timers.push(window.setInterval(fn, ms));
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute("data-lumen-theme", this.dark ? "dark" : "light");
    // User colours (section 16): one colour C → fill, glow, icon background, shadow and ink.
    this.userColor("accent", cssColor(this._config?.accent_color));
    this.userColor("glow", cssColor(this._config?.glow_color));
    this.toggleAttribute("data-wfx-card", this.effects);
    const mw = maxWidthCss(this._config?.max_width, this._config?.max_width_unit);
    if (mw) {
      this.style.maxWidth = mw;
      this.style.marginInline = "auto";
      // A grid cell with auto margins shrinks to the content: keep the full (capped) width.
      this.style.width = "100%";
    } else {
      this.style.removeProperty("max-width");
      this.style.removeProperty("margin-inline");
      this.style.removeProperty("width");
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.preview && haConditions(this)) editPreview.add(this);
    else editPreview.remove(this);
    this.applyUserStyles();
    weather.scan(this);
  }

  private userStyle?: HTMLStyleElement;

  /** `styles` from the config, after the card's own CSS (so it wins). */
  private applyUserStyles(): void {
    const css = typeof this._config?.styles === "string" ? this._config.styles : "";
    if (!css) {
      this.userStyle?.remove();
      this.userStyle = undefined;
      return;
    }
    if (!this.userStyle) {
      this.userStyle = document.createElement("style");
      this.userStyle.className = "lumen-user-styles";
    }
    if (this.userStyle.textContent !== css) this.userStyle.textContent = css;
    if (this.userStyle.parentNode !== this.renderRoot) this.renderRoot.appendChild(this.userStyle);
  }

  protected haptic(type = "light"): void {
    haptic(this, type);
  }

  protected moreInfo(entityId: string): void {
    openMoreInfo(this, entityId);
  }

  static styles: CSSResultGroup = [tokens, unsafeCSS(shared), css``];
}
