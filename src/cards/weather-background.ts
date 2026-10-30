import { html, nothing } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { appearance, firstOf, form, stub } from "../core/form";
import { icon } from "../core/lumen-icon";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { registerCard } from "../core/register";
import type { HassEntity, HassLike } from "../hass/types";
import { phaseFromSun, weatherCondition } from "../logic/sky";
import { readSettings, SETTINGS_KEY, weather, type EffectSettings } from "../weather/engine";
import { sky } from "../weather/fx";

export interface WeatherBackgroundConfig extends BaseConfig {
  weather_entity: string;
  sun_entity?: string;
  /** Per-device switches (background, effects on cards, animations) shown in the card. */
  show_controls?: boolean;
}

const LEVEL_FULL_MIN = 30;

export function validateWeatherBackground(c: Partial<WeatherBackgroundConfig>): void {
  if (!c.weather_entity || !String(c.weather_entity).startsWith("weather.")) throw new Error(t("card.weather.error.entity"));
}

/**
 * Weather background of the design for a whole dashboard view: sky gradient, the
 * background canvas (clouds, rain, snow, sun, stars, lightning) behind the cards and the
 * floating layer (mist, wind) above them. Also drives the per-card weather surfaces of
 * every Lumen card in the view. One per view; takes no space unless it shows its switches.
 */
export class LumenWeatherBackgroundCard extends LumenBaseCard<WeatherBackgroundConfig> {
  /** A full-screen layer, not a card in the grid: no loading skeleton. */
  protected static skeletonHeight = 0;
  static properties = { ...LumenBaseCard.properties, _settings: { state: true } };
  private _settings: EffectSettings = readSettings();
  private reducedMotion = typeof matchMedia === "undefined" ? undefined : matchMedia("(prefers-reduced-motion: reduce)");
  private bgEl?: HTMLElement;
  /** The dashboard view's top-left on screen (below the toolbar, right of the sidebar): the panel's frame. */
  private area = { top: 0, left: 0 };
  private ro?: ResizeObserver;

  // Float layer (mist, wind) above the cards, like `canvas.fx` (z-index 2) in the panel frame.
  private top = new LayerController(this, () =>
    this.preview || !this._config ? nothing : html`<canvas class="fx" style="position:absolute;left:${this.area.left}px;top:${this.area.top}px;right:0;bottom:0;width:calc(100% - ${this.area.left}px);height:calc(100% - ${this.area.top}px);pointer-events:none"></canvas>`,
  );

  protected entityIds() {
    return [this._config.weather_entity, this._config.sun_entity ?? "sun.sun"];
  }

  protected validate(c: WeatherBackgroundConfig) {
    validateWeatherBackground(c);
  }

  private get weatherEntity(): HassEntity | undefined {
    return this.entity(this._config.weather_entity);
  }

  private level(): number {
    const minutes = (Date.now() - Date.parse(this.weatherEntity?.last_changed ?? "")) / 60_000;
    return Number.isFinite(minutes) ? 0.25 + 0.75 * Math.min(1, Math.max(0, minutes) / LEVEL_FULL_MIN) : 1;
  }

  private setSettings(patch: Partial<EffectSettings>) {
    this._settings = { ...this._settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._settings));
    } catch {
      /* private mode: lasts for this session */
    }
    window.dispatchEvent(new CustomEvent("lumen-cards-effects"));
  }

  private onSettings = () => (this._settings = readSettings());

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("lumen-cards-effects", this.onSettings);
    // Level grows for 30 min after the weather changed.
    this.every(60_000, () => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("lumen-cards-effects", this.onSettings);
    weather.setLayers(this, undefined);
    this.ro?.disconnect();
    this.bgEl?.remove();
    this.bgEl = undefined;
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (this.preview || !this._config || !this._hass) return;
    const cond = weatherCondition(this.weatherEntity);
    const phase = phaseFromSun(this.entity(this._config.sun_entity ?? "sun.sun"));
    const fx = this._settings;
    this.mountBackground(sky(this.dark ? "dark" : "light", phase, cond.raw), fx.background);
    const fxCanvas = this.top.root?.querySelector<HTMLCanvasElement>("canvas.fx");
    const bg = this.bgEl?.shadowRoot?.querySelector<HTMLCanvasElement>("canvas.bg");
    if (bg && fxCanvas) weather.setLayers(this, { bg, fx: fxCanvas });
    weather.setScene(this, {
      cond: cond.raw,
      phase,
      dark: this.dark,
      animate: fx.motion && !this.reducedMotion?.matches,
      background: fx.background,
      surface: fx.surface,
      level: this.level(),
    });
  }

  /**
   * The background lives behind the dashboard: a fixed element placed first in the view's
   * container, so it paints under the cards (inside this card it would paint above earlier ones).
   */
  private mountBackground(gradient: string, visible: boolean) {
    if (!this.bgEl) {
      this.bgEl = document.createElement("div");
      this.bgEl.className = "lumen-cards-weather-bg";
      const root = this.bgEl.attachShadow({ mode: "open" });
      root.innerHTML = `<style>:host{position:fixed;inset:0;z-index:0;pointer-events:none;display:block}.sky,canvas{position:absolute;inset:0;width:100%;height:100%}.sky{transition:background 1200ms}canvas{transition:opacity 800ms;will-change:transform}</style><div class="sky"></div><canvas class="bg"></canvas>`;
      this.backgroundHost().prepend(this.bgEl);
      // Sidebar open/closed, window size: the view moves, the layers follow.
      this.ro = new ResizeObserver(() => this.requestUpdate());
      if (this.bgEl.parentElement) this.ro.observe(this.bgEl.parentElement);
    }
    // Start below the HA toolbar and right of the sidebar, where the view begins (the design's frame).
    const r = this.bgEl.parentElement?.getBoundingClientRect();
    const area = { top: Math.max(0, Math.round((r?.top ?? 0) + scrollY)), left: Math.max(0, Math.round(r?.left ?? 0)) };
    this.bgEl.style.top = `${area.top}px`;
    this.bgEl.style.left = `${area.left}px`;
    if (area.top !== this.area.top || area.left !== this.area.left) {
      this.area = area;
      this.requestUpdate();
    }
    const root = this.bgEl.shadowRoot!;
    (root.querySelector(".sky") as HTMLElement).style.background = gradient.replace("var(--lumen-bg)", this.dark ? "#121110" : "#F2F0EC");
    (root.querySelector("canvas") as HTMLElement).style.opacity = visible ? "1" : "0";
  }

  /** The view element of the dashboard this card is in (falls back to <body>). */
  private backgroundHost(): Element {
    let node: Node | null = this;
    while (node) {
      const el = node as Element;
      if (el.localName === "hui-view" || el.localName === "hui-panel-view" || el.localName === "hui-sections-view" || el.localName === "hui-masonry-view") {
        const parent = el.parentNode;
        if (parent instanceof Element || parent instanceof ShadowRoot) return parent as Element;
      }
      node = el.parentNode ?? (el.getRootNode() as ShadowRoot).host ?? null;
      if (node === el) break;
    }
    return document.body;
  }

  /** Effect switches of the design edit bar (web row style). */
  private switches() {
    const fx = this._settings;
    const sw = (label: string, on: boolean, toggle: () => void) =>
      html`<button class="press" role="switch" aria-checked=${on} @click=${toggle}
        style="${this.compact ? "flex-direction:column;justify-content:center;gap:6px;min-height:60px;padding:6px 4px;border-radius:14px;font:650 11px/1.2 var(--lumen-font);text-align:center" : "gap:8px;min-height:40px;padding:0 12px 0 8px;border-radius:13px;font:650 12px var(--lumen-font);white-space:nowrap"};display:flex;align-items:center;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-1);cursor:pointer">
        <span style="position:relative;width:30px;height:18px;flex:none;border-radius:999px;background:${on ? "var(--lumen-accent)" : "var(--lumen-border-strong)"};transition:background-color 220ms"><span style="position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transform:translateX(${on ? 12 : 0}px);transition:transform 320ms var(--lumen-ease-bounce)"></span></span>${label}</button>`;
    const items = [
      sw(t("card.weather.name"), fx.background, () => this.setSettings({ background: !fx.background })),
      sw(t("card.weather.surface"), fx.surface, () => this.setSettings({ surface: !fx.surface })),
      sw(t("card.weather.motion"), fx.motion, () => this.setSettings({ motion: !fx.motion })),
    ];
    const overline = "font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)";
    return this.compact
      ? html`<div style="display:flex;flex-direction:column;gap:10px"><div style="${overline};padding:0 4px;margin-bottom:-4px">${t("card.weather.this_device")}</div><div style="display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:6px">${items}</div></div>`
      : html`<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="${overline};line-height:13px;margin-right:4px">${t("card.weather.this_device")}</span>${items}</div>`;
  }

  protected renderCard() {
    if (!this._config) return nothing;
    if (this.preview || (this.editMode && !this._config.show_controls)) {
      const cond = weatherCondition(this.weatherEntity);
      return html`<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:18px;background:${sky(this.dark ? "dark" : "light", phaseFromSun(this.entity(this._config.sun_entity ?? "sun.sun")), cond.raw)};border:1px solid var(--lumen-border)">
        ${icon(cond.icon, "font-size:22px")}<span style="font-size:14px;font-weight:700">${t("card.weather.name")} · ${t(cond.label)}</span></div>`;
    }
    return this._config.show_controls ? this.switches() : nothing;
  }

  getCardSize() {
    return this._config?.show_controls ? 1 : 0;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { weather_entity: stub(hass, "weather", entities, fallback) ?? firstOf(hass, "weather", "weather.home") };
  }

  static getConfigForm() {
    return form([
      { name: "weather_entity", required: true, selector: { entity: { domain: "weather" } } },
      { name: "sun_entity", selector: { entity: { domain: "sun" } } },
      { name: "show_controls", selector: { boolean: {} } },
      appearance({ effects: false, layout: "screen" }),
    ]);
  }
}

registerCard("lumen-weather-background-card", LumenWeatherBackgroundCard, {
  name: "card.weather.name",
  description: "card.weather.description",
  domains: ["weather"],
  config: (e) => ({ weather_entity: e.entity_id }),
});
