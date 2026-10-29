import { LitElement, css, unsafeCSS, type CSSResultGroup, type PropertyValues } from "lit";
import { tokens } from "../design/tokens";
import type { HassEntity, HassLike } from "../hass/types";
import { setLanguage, setLocale, t } from "./i18n";
import { injectFonts } from "../design/fonts";
import { weather } from "../weather/engine";
import { haptic, openMoreInfo } from "./actions";
import { cssColor, shared } from "./styles";
import type { SubButton } from "./sub-buttons";

/** Options every card has (editor section "Appearance"). */
export interface BaseConfig {
  type: string;
  /**
   * auto: compact when the card itself is narrow (or, for text cards, on a narrow screen);
   * wide / compact force one look.
   */
  layout?: "auto" | "wide" | "compact";
  color_scheme?: "auto" | "light" | "dark";
  /** Glow / fill of lit lights: HA colour name, hex or RGB triple. Default: from the light. */
  glow_color?: string | [number, number, number];
  /** Accent (scenes FAB, AC cool, focus ring). */
  accent_color?: string | [number, number, number];
  /** Weather effects drawn on this card (needs a lumen-weather-background-card card in the view). */
  weather_effects?: boolean;
  /** The card is never wider than this (px) and stays centred in its grid cell. */
  max_width?: number;
  /** Extra CSS inside the card (advanced, like Bubble Card `styles` / card-mod). */
  styles?: string;
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

  /** Entities whose state changes re-render the card. */
  protected abstract entityIds(): readonly (string | undefined)[];

  /** Throw an Error with a readable message when the config is invalid. */
  protected validate(_config: C): void {}

  /** Defaults merged under the user's config. */
  protected defaults(): Partial<C> {
    return {};
  }

  setConfig(config: C): void {
    if (!config || typeof config !== "object") throw new Error(t("error.invalid_config"));
    this.validate(config);
    this._config = { ...this.defaults(), ...config } as C;
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
    return id ? this._hass?.states[id] : undefined;
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
    this.resize?.disconnect();
    this.resize = undefined;
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
  }

  private onWide = () => (this._wide = wideQuery?.matches ?? true);

  /** setInterval that is cleared when the card leaves the DOM (re-added on reconnect by the caller). */
  protected every(ms: number, fn: () => void): void {
    this.timers.push(window.setInterval(fn, ms));
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute("data-lumen-theme", this.dark ? "dark" : "light");
    const accent = cssColor(this._config?.accent_color);
    if (accent) {
      this.style.setProperty("--lumen-accent", accent);
      this.style.setProperty("--lumen-accent-soft", `color-mix(in srgb, ${accent} 14%, transparent)`);
    } else {
      this.style.removeProperty("--lumen-accent");
      this.style.removeProperty("--lumen-accent-soft");
    }
    this.toggleAttribute("data-wfx-card", this.effects);
    const mw = Number(this._config?.max_width);
    if (mw > 0) {
      this.style.maxWidth = `${mw}px`;
      this.style.marginInline = "auto";
    } else {
      this.style.removeProperty("max-width");
      this.style.removeProperty("margin-inline");
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
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
