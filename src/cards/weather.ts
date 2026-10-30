import { css, html, nothing, svg, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { advanced, appearance, form, stub } from "../core/form";
import { locale, t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { WFX } from "../core/parts";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { Sheet } from "../core/sheet";
import { glass } from "../core/styles";
import type { HassEntity, HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import {
  activeWarnings,
  cardColumns,
  COL_W,
  conditionIcon,
  dayStart,
  daySummaries,
  deg,
  FORECAST_DAILY,
  FORECAST_HOURLY,
  FORECAST_TWICE_DAILY,
  hourStart,
  hoursOf,
  isNightHour,
  stripChart,
  stripMarks,
  sunTimes,
  tempColor,
  todayHours,
  todayRange,
  uvLevel,
  warningTone,
  windDirIndex,
  type ForecastItem,
  type Hour,
  type Warning,
} from "../logic/forecast";
import { formatClock, formatNumber, weekday } from "../logic/time";

export interface WeatherConfig extends BaseConfig {
  entity: string;
  /** Sensor with a `warnings` list attribute (e.g. IMGW-PIB Monitor). */
  warnings_entity?: string;
  sun_entity?: string;
  /** Hourly columns on the card (4–8, default 6; only as many as fit at 44 px). */
  hours?: number;
  show_feels?: boolean;
  show_minmax?: boolean;
  show_hours?: boolean;
  show_warnings?: boolean;
}

type Forecasts = { hourly?: ForecastItem[]; twice?: ForecastItem[]; daily?: ForecastItem[] };
type SunDay = { rise: number; set: number } | null;

/** Line below this card width, card from it (layout auto). */
const LINE_BELOW = 240;
/** Line narrower than this: icon + temperature only. */
const TINY_BELOW = 120;
/** A forecast type that never answers must not keep the skeleton forever. */
const FORECAST_TIMEOUT_MS = 8000;

export function validateWeather(c: Partial<WeatherConfig>): void {
  if (!c.entity || !String(c.entity).startsWith("weather.")) throw new Error(t("card.forecast.error.entity"));
}

const pad = (v: number) => String(v).padStart(2, "0");
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const condLabel = (cond: string) => {
  const key = `card.forecast.cond.${cond}`;
  const s = t(key);
  return s === key ? cond : s;
};

/** Mouse drag of the hour strips (pointer capture); touch scrolls natively. Never reaches the sheet. */
class StripDrag {
  private d: { el: HTMLElement; x: number; sl: number } | null = null;
  down = (e: PointerEvent) => {
    e.stopPropagation();
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget as HTMLElement;
    this.d = { el, x: e.clientX, sl: el.scrollLeft };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  move = (e: PointerEvent) => {
    if (this.d) this.d.el.scrollLeft = this.d.sl - (e.clientX - this.d.x);
  };
  up = () => (this.d = null);
}

/** Initial horizontal position of a strip, applied once per element. */
const scrollTo = (key: string, x: number) =>
  ref((el) => {
    const e = el as HTMLElement | undefined;
    if (e && e.dataset.k !== key) {
      e.dataset.k = key;
      requestAnimationFrame(() => (e.scrollLeft = x));
    }
  });

/**
 * Weather (catalog section 20): the Dom panel's weather line (A27) and details sheet (B6) for any
 * `weather.*` entity. Line (44 px), icon + temperature, or card with an hourly row; tap opens the
 * shared bottom sheet with Now, Today hourly (chart of temperature and apparent temperature),
 * the next days (expandable), warnings and sources. Forecasts come from `weather/subscribe_forecast`.
 */
export class LumenWeatherCard extends LumenBaseCard<WeatherConfig> {
  protected static compactBelow = LINE_BELOW;
  static properties = { ...LumenBaseCard.properties, _fc: { state: true }, _openDay: { state: true } };
  static styles = [
    LumenBaseCard.styles,
    css`
      .wxmini { transition: transform 220ms var(--lumen-ease-spring), background-color 160ms; }
      .wxmini:hover, .wxmini:active { background: var(--lumen-surface-2); }
      .wxmini:active { transform: scale(0.9); }
      .wxday { transition: transform 220ms var(--lumen-ease-spring); }
      .wxday[role="button"]:active { transform: scale(0.98); }
    `,
  ];

  private _fc?: Forecasts;
  private _openDay: number | null = null;
  private subs: Promise<() => Promise<void>>[] = [];
  private subKey?: string;
  private subTimer?: number;
  private presses = new Presses((type) => this.haptic(type));
  private drag = new StripDrag();
  private sheetView = new Sheet(this, () => this.close());
  protected layer = new LayerController(this, () => (this.sheetView.open && !this.preview ? this.sheet() : nothing), () => this.close());

  protected entityIds() {
    const c = this._config;
    return [c.entity, c.warnings_entity, c.sun_entity ?? "sun.sun"];
  }

  protected validate(c: WeatherConfig) {
    validateWeather(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Warnings move from "in 3 h" to "active" and the "Now" hour changes without a state change.
    this.every(60_000, () => this.requestUpdate());
    if (this._hass && this._config && !this._configError) this.subscribe(this._hass);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe();
    this.presses.dispose();
    this.sheetView.dispose();
  }

  protected onHass(hass: HassLike): void {
    if (this._config && !this._configError) this.subscribe(hass);
  }

  // ------------------------------------------------------------- forecasts

  private subscribe(hass: HassLike) {
    const e = hass.states[this._config.entity];
    const features = n(e?.attributes.supported_features) ?? 0;
    const key = `${this._config.entity}|${features}|${!!hass.connection}`;
    if (key === this.subKey || !this.isConnected) return;
    this.unsubscribe();
    this.subKey = key;
    const types = ([["hourly", FORECAST_HOURLY], ["twice_daily", FORECAST_TWICE_DAILY], ["daily", FORECAST_DAILY]] as const).filter(([, bit]) => features & bit);
    if (!e || !hass.connection || !types.length) {
      this._fc = e ? {} : undefined;
      return;
    }
    this._fc = undefined;
    const got: Forecasts = {};
    const field = (type: string): keyof Forecasts => (type === "twice_daily" ? "twice" : (type as "hourly" | "daily"));
    for (const [type] of types) {
      const p = hass.connection.subscribeMessage<{ forecast?: ForecastItem[] | null }>(
        (m) => {
          got[field(type)] = m.forecast ?? [];
          if (types.every(([x]) => got[field(x)] !== undefined)) this._fc = { ...got };
          else if (this._fc) this._fc = { ...this._fc, ...got };
        },
        { type: "weather/subscribe_forecast", entity_id: this._config.entity, forecast_type: type },
      );
      p.catch(() => (got[field(type)] = []));
      this.subs.push(p);
    }
    this.subTimer = window.setTimeout(() => {
      if (!this._fc) this._fc = { ...got };
    }, FORECAST_TIMEOUT_MS);
  }

  private unsubscribe() {
    window.clearTimeout(this.subTimer);
    for (const p of this.subs) p.then((u) => u()).catch(() => undefined);
    this.subs = [];
    this.subKey = undefined;
  }

  setConfig(config: WeatherConfig): void {
    const prev = this._config?.entity;
    super.setConfig(config);
    if (prev !== this._config.entity) {
      this.unsubscribe();
      if (this._hass && !this._configError) this.subscribe(this._hass);
    }
  }

  // ------------------------------------------------------------- data

  private get weatherEntity(): HassEntity | undefined {
    return this.entity(this._config.entity);
  }

  private get location() {
    const c = this._hass?.config;
    return typeof c?.latitude === "number" && typeof c?.longitude === "number" ? { lat: c.latitude, lon: c.longitude } : null;
  }

  private sunCache = new Map<number, SunDay>();
  private sunOfDay(day: number): SunDay {
    const loc = this.location;
    if (!loc) return null;
    if (!this.sunCache.has(day)) this.sunCache.set(day, sunTimes(day + 12 * 3_600_000, loc.lat, loc.lon));
    return this.sunCache.get(day)!;
  }
  private sunOf = (h: Hour) => this.sunOfDay(dayStart(h.t));

  /** Night now: sun.sun below the horizon, else the computed sunrise / sunset. */
  private get nightNow(): boolean {
    const sun = this.entity(this._config.sun_entity ?? "sun.sun");
    if (sun && !isUnavailable(sun)) return sun.state === "below_horizon";
    return isNightHour(Date.now() - 1_800_000, this.sunOfDay(dayStart(Date.now())));
  }

  private current() {
    const e = this.weatherEntity;
    const a = e?.attributes ?? {};
    const cond = e?.state ?? "cloudy";
    const una = isUnavailable(e);
    return {
      una,
      cond,
      label: una ? t("common.unavailable") : condLabel(cond),
      icon: una ? "mdi:cloud-off-outline" : conditionIcon(cond, this.nightNow),
      temp: una ? null : n(a.temperature),
      feels: n(a.apparent_temperature),
      wind: n(a.wind_speed),
      gust: n(a.wind_gust_speed),
      bearing: n(a.wind_bearing),
      humidity: n(a.humidity),
      pressure: n(a.pressure),
      uv: n(a.uv_index),
      visibility: n(a.visibility),
      windUnit: String(a.wind_speed_unit ?? "km/h"),
      pressureUnit: String(a.pressure_unit ?? "hPa"),
      visUnit: String(a.visibility_unit ?? "km"),
      mmUnit: String(a.precipitation_unit ?? "mm"),
    };
  }

  private warnings(): Warning[] {
    const c = this._config;
    if (c.show_warnings === false || !c.warnings_entity) return [];
    return activeWarnings(this.entity(c.warnings_entity)?.attributes.warnings, Date.now());
  }

  /** "", "tomorrow " or a weekday before a clock time that is not today. */
  private dayPrefix(ms: number, now = Date.now()): string {
    const d = Math.round((dayStart(ms) - dayStart(now)) / 86_400_000);
    return d === 0 ? "" : d === 1 ? `${t("card.forecast.tomorrow_lc")} ` : `${weekday(new Date(ms).getDay())} `;
  }

  private dayName(d: number): string {
    return d === 0 ? t("card.forecast.today") : d === 1 ? t("card.forecast.tomorrow") : weekday(new Date(dayStart(Date.now(), d)).getDay());
  }

  private warningShort(w: Warning, now = Date.now()): string {
    const lvl = t("card.forecast.level", { n: w.level });
    const at = w.from > now ? t("card.forecast.from", { x: `${this.dayPrefix(w.from)}${formatClock(w.from)}` }) : Number.isFinite(w.to) ? t("card.forecast.to", { x: `${this.dayPrefix(w.to)}${formatClock(w.to)}` }) : "";
    return ` · ${lvl}${at ? ` · ${at}` : ""}`;
  }

  // ------------------------------------------------------------- sheet

  private openSheet = () => {
    if (this.preview || this.editMode) return;
    if (isUnavailable(this.weatherEntity)) return this.moreInfo(this._config.entity);
    this._openDay = null;
    this.sheetView.show();
  };

  close = () => this.sheetView.hide();

  // ------------------------------------------------------------- card looks

  private get look(): "line" | "card" | "icon" {
    const l = this._config.layout ?? "auto";
    if (l === "icon") return "icon";
    if (l === "compact") return "line";
    if (l === "wide") return "card";
    return this._width > 0 && this._width < LINE_BELOW ? "line" : "card";
  }

  private handlers() {
    const c = this._config;
    return this.presses.handlers(`weather:${c.entity}`, this.openSheet, () => this.moreInfo(c.entity));
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const look = this.look;
    if (look === "icon") return this.renderIcon();
    return look === "line" ? this.renderLine() : this.renderFull();
  }

  private renderIcon() {
    const now = this.current();
    const w = this.warnings()[0];
    const label = `${now.temp === null ? "—" : deg(now.temp)} · ${now.label}`;
    return html`<div style="display:flex;justify-content:flex-end"><div class="wxmini" ${pressable(this.handlers())} role="button" aria-label=${label} title=${label}
      style="position:relative;display:inline-flex;align-items:center;gap:4px;height:40px;padding:0 8px;border-radius:12px;color:var(--lumen-text-1);cursor:pointer;user-select:none;-webkit-user-select:none">
      ${icon(now.icon, `font-size:24px;color:${now.una ? "var(--lumen-unavailable)" : "var(--lumen-text-2)"}`)}
      <span style="font:700 16px var(--lumen-font);font-variant-numeric:tabular-nums">${now.temp === null ? "—" : deg(now.temp)}</span>
      ${w ? html`<span style="position:absolute;top:6px;left:22px;width:9px;height:9px;border-radius:50%;background:${warningTone(w.level).c};box-shadow:0 0 0 2px var(--lumen-bg)"></span>` : nothing}
    </div></div>`;
  }

  private frame(una: boolean) {
    return una ? "background:var(--lumen-surface-2);border:1px dashed var(--lumen-border-strong)" : `background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass}`;
  }

  private renderLine() {
    const now = this.current();
    const w = this.warnings()[0];
    const tiny = this._width > 0 && this._width < TINY_BELOW;
    const label = `${t("card.forecast.name")} · ${now.temp === null ? "—" : deg(now.temp)} · ${now.label}`;
    return html`<div data-fx class="press" ${pressable(this.handlers())} role="button" aria-label=${label} title=${t("card.forecast.details")}
      style="position:relative;display:flex;align-items:center;gap:8px;height:44px;padding:0 8px 0 10px;box-sizing:border-box;border-radius:16px;${this.frame(now.una)};box-shadow:var(--lumen-shadow-1);cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:pan-y">${WFX}
      ${icon(now.icon, `flex:none;font-size:22px;color:${now.una ? "var(--lumen-unavailable)" : "var(--lumen-text-2)"}`)}
      <span style="flex:none;font:700 16px var(--lumen-font);font-variant-numeric:tabular-nums">${now.temp === null ? "—" : deg(now.temp)}</span>
      ${tiny
        ? html`<span style="flex:1"></span>`
        : html`<span style="flex:1;min-width:0;font:600 14px var(--lumen-font);color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">· ${now.label}</span>`}
      ${w && !tiny
        ? html`<span title=${`${w.name}${this.warningShort(w)}`} style="flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:13px;background:${warningTone(w.level).c};color:${warningTone(w.level).fg}">${icon(w.icon, "display:block")}</span>`
        : nothing}
      ${tiny ? nothing : icon("mdi:chevron-right", "flex:none;margin-left:-4px;font-size:16px;color:var(--lumen-text-3)")}
    </div>`;
  }

  private renderFull() {
    const c = this._config;
    const now = this.current();
    const width = this._width || 340;
    const narrow = width < LINE_BELOW;
    const fc = this._fc;
    const nowMs = Date.now();
    const range = c.show_minmax === false || !fc ? null : todayRange({ now: nowMs, ...fc }, now.temp);
    const sub = now.una
      ? c.entity
      : [c.show_feels !== false && now.feels !== null ? t("card.forecast.feels", { x: deg(now.feels) }) : "", range ? `${deg(range.min)} / ${deg(range.max)}` : ""].filter(Boolean).join(" · ");
    const desc = html`<div style="font-size:14px;font-weight:700;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${now.label}</div>
      ${sub ? html`<div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${sub}</div>` : nothing}`;
    const chev = icon("mdi:chevron-right", "flex:none;font-size:18px;color:var(--lumen-text-3)");
    const warns = this.warnings();
    const hoursOn = c.show_hours !== false && !narrow && !now.una;
    return html`<div data-fx class="press" ${pressable(this.handlers())} role="button" aria-label=${`${t("card.forecast.name")} · ${now.temp === null ? "—" : deg(now.temp)} · ${now.label}`}
      style="position:relative;display:flex;flex-direction:column;gap:12px;padding:14px;box-sizing:border-box;border-radius:22px;${this.frame(now.una)};box-shadow:var(--lumen-shadow-1);cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:pan-y">${WFX}
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <span style="flex:none;width:44px;height:44px;border-radius:14px;display:${width < 170 ? "none" : "grid"};place-items:center;font-size:26px;background:${now.una ? "var(--lumen-surface)" : "var(--lumen-accent-soft)"};color:${now.una ? "var(--lumen-unavailable)" : "var(--lumen-accent)"}">${icon(now.icon, "display:block")}</span>
        <span style="flex:none;font-size:40px;font-weight:300;letter-spacing:-0.04em;line-height:1;font-variant-numeric:tabular-nums">${now.temp === null ? "—" : deg(now.temp)}</span>
        ${narrow ? html`<span style="flex:1"></span>${chev}` : html`<div style="flex:1;min-width:0">${desc}</div>${chev}`}
      </div>
      ${narrow ? html`<div style="min-width:0;margin-top:-4px">${desc}</div>` : nothing}
      ${warns.length
        ? html`<div style="display:flex;flex-wrap:wrap;gap:6px;min-width:0">${this.warnPill(warns[0])}${warns.length > 1
            ? html`<span style="display:inline-flex;align-items:center;height:26px;padding:0 9px;border-radius:999px;background:var(--lumen-surface-2);font:700 12px var(--lumen-font);color:var(--lumen-text-2)">+${warns.length - 1}</span>`
            : nothing}</div>`
        : nothing}
      ${hoursOn ? this.cardHours(width, now) : nothing}
    </div>`;
  }

  private warnPill(w: Warning) {
    const tone = warningTone(w.level);
    return html`<span style="display:inline-flex;align-items:center;gap:6px;height:26px;max-width:100%;padding:0 10px 0 4px;box-sizing:border-box;border-radius:999px;background:color-mix(in srgb, ${tone.c} 16%, var(--lumen-surface-solid));border:1px solid color-mix(in srgb, ${tone.c} 35%, transparent);font:700 12px var(--lumen-font);white-space:nowrap;overflow:hidden">
      <span style="flex:none;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:${tone.c};color:${tone.fg}">${icon(w.icon, "display:block")}</span>
      <span style="overflow:hidden;text-overflow:ellipsis">${w.name || t("card.forecast.warning")}<span style="font-weight:600;color:var(--lumen-text-2)">${this.warningShort(w)}</span></span>
    </span>`;
  }

  private cardHours(width: number, now: ReturnType<LumenWeatherCard["current"]>) {
    const top = "padding-top:10px;border-top:1px solid var(--lumen-border)";
    if (!this._fc)
      return html`<div aria-busy="true" style="display:grid;grid-template-columns:repeat(6, minmax(0,1fr));gap:6px;${top};animation:lumenSkel 1.4s ease-in-out infinite">${[0, 1, 2, 3, 4, 5].map(
        () => html`<span style="height:66px;border-radius:12px;background:var(--lumen-surface-2)"></span>`,
      )}</div>`;
    const nowMs = Date.now();
    const hours = hoursOf({ now: nowMs, ...this._fc });
    if (!hours.length) return nothing;
    const cols = cardColumns(Number(this._config.hours ?? 6), width);
    // "Now" is always the current conditions; the forecast of the current hour only lends its chance.
    const cur = hours[0].t === hourStart(nowMs) ? hours[0] : undefined;
    const later = hours.filter((h) => h.t > hourStart(nowMs));
    if (!cur && !later.length) return nothing;
    const list = now.temp === null ? hours.slice(0, cols) : [cur ?? { ...later[0], pp: null }, ...later.slice(0, cols - 1)];
    const cell = (label: string, isNow: boolean, ico: string, temp: number, pp: number | null) =>
      html`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0">
        <span style="font:${isNow ? 800 : 700} 11px/14px var(--lumen-font);color:${isNow ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};white-space:nowrap">${label}</span>
        ${icon(ico, "font-size:20px;color:var(--lumen-text-2)")}
        <span style="font:700 14px/18px var(--lumen-font);font-variant-numeric:tabular-nums">${deg(temp)}</span>
        <span style="height:13px;font:700 10px/13px var(--lumen-font);color:${(pp ?? 0) >= 20 ? "var(--lumen-info)" : "var(--lumen-text-3)"};font-variant-numeric:tabular-nums">${pp === null ? "" : `${Math.round(pp)}%`}</span>
      </div>`;
    return html`<div style="display:grid;grid-template-columns:repeat(${list.length}, minmax(0,1fr));gap:2px;${top}">
      ${list.map((h, i) =>
        i === 0 && now.temp !== null
          ? cell(t("card.forecast.now"), true, now.icon, now.temp, h.pp)
          : cell(pad(h.h), false, conditionIcon(h.cond, isNightHour(h.t, this.sunOf(h))), h.temp, h.pp),
      )}
    </div>`;
  }

  // ------------------------------------------------------------- sheet content

  private strip(hours: Hour[], today: boolean, key: string, now?: ReturnType<LumenWeatherCard["current"]>) {
    // "Now" shows current conditions: icon, temperature and apparent temperature from the entity.
    // Only when the strip starts at the current hour (a forecast may start later).
    const nowCol = today && !!now && now.temp !== null && hours[0]?.t === hourStart(Date.now());
    const vals = hours.map((h, i) => (nowCol && i === 0 ? { ...h, temp: now!.temp!, feel: now!.feels, cond: now!.cond } : h));
    // A short strip fills the sheet (max 520 px, 18 px spacers); a long one keeps 52 px columns and scrolls.
    const col = Math.max(COL_W, Math.floor((Math.min(520, window.innerWidth) - 36) / Math.max(1, vals.length)));
    const chart = stripChart(vals.map((h) => h.temp), vals.map((h) => h.mm), vals.map((h) => h.feel), col);
    const marks = stripMarks(vals, this.sunOf, col);
    const six = vals.findIndex((h) => h.h === 6);
    const x0 = today ? 0 : Math.max(0, Math.min(six > 0 ? six : 0, vals.length - 6)) * col;
    const mmUnit = now?.mmUnit ?? this.current().mmUnit;
    const head = vals.map((h, i) => {
      const isNow = nowCol && i === 0;
      const ico = isNow && now ? now.icon : conditionIcon(h.cond, isNightHour(h.t, this.sunOf(h)));
      return html`<div style="flex:none;width:${col}px;display:flex;flex-direction:column;align-items:center">
        <span style="height:22px;display:flex;align-items:flex-end;font-size:12px;font-weight:${isNow ? 800 : 700};color:${isNow ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};font-variant-numeric:tabular-nums">${isNow ? t("card.forecast.now") : formatClock(h.t)}</span>
        <span style="height:30px;display:grid;place-items:center;font-size:22px;color:var(--lumen-text-2)">${icon(ico, "display:block")}</span>
        <span style="height:20px;font:700 15px/20px var(--lumen-font);font-variant-numeric:tabular-nums">${deg(h.temp)}</span>
      </div>`;
    });
    const foot = vals.map(
      (h) => html`<div style="flex:none;width:${col}px;display:flex;flex-direction:column;align-items:center;font-variant-numeric:tabular-nums">
        <span style="height:16px;font:700 11px/16px var(--lumen-font);color:${(h.pp ?? 0) >= 20 ? "var(--lumen-info)" : "var(--lumen-text-3)"}">${h.pp === null ? "" : `${Math.round(h.pp)}%`}</span>
        <span style="height:16px;font:600 11px/16px var(--lumen-font);color:var(--lumen-text-3);white-space:nowrap">${h.mm > 0 ? `${formatNumber(h.mm)} ${mmUnit}` : ""}</span>
      </div>`,
    );
    return html`<div class="lumen-noscroll" ${scrollTo(key, x0)} @pointerdown=${this.drag.down} @pointermove=${this.drag.move} @pointerup=${this.drag.up} @pointercancel=${this.drag.up}
        style="display:flex;margin:0 -18px;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-x pan-y;scrollbar-width:none;cursor:grab;user-select:none;-webkit-user-select:none;${today ? "" : "padding:2px 0 14px"}">
      <div style="flex:none;width:18px"></div>
      <div style="position:relative;flex:none;width:${chart.w}px">
        ${nowCol ? html`<div style="position:absolute;left:0;top:0;bottom:0;width:${col}px;border-radius:14px;background:var(--lumen-surface-2)"></div>` : nothing}
        <div style="position:relative;display:flex">${head}</div>
        <svg width=${chart.w} height="52" viewBox="0 0 ${chart.w} 52" style="display:block;position:relative;overflow:visible;color:var(--lumen-orange)">
          ${svg`<path d=${chart.area} fill="currentColor" opacity="0.14"></path>
          <path d=${chart.bars} fill="var(--lumen-info)" opacity="0.45"></path>
          <path d=${chart.feel} fill="none" stroke="var(--lumen-info)" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"></path>
          <path d=${chart.line} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
          ${nowCol ? svg`<circle cx=${col / 2} cy=${chart.firstY} r="3.5" fill="var(--lumen-surface-solid)" stroke="currentColor" stroke-width="2"></circle>` : nothing}`}
        </svg>
        <div style="position:relative;display:flex">${foot}</div>
        ${marks.map(
          (m) => html`<div style="position:absolute;left:${m.left}px;top:72px;height:52px;border-left:1px ${m.style} var(--lumen-border-strong);pointer-events:none">
            <span style="position:absolute;top:-4px;left:3px;display:inline-flex;align-items:center;gap:3px;padding:0 4px;border-radius:6px;background:var(--lumen-surface-solid);font:500 10.5px/16px var(--lumen-mono);color:var(--lumen-text-2);white-space:nowrap">${m.icon ? icon(m.icon, "font-size:12px") : nothing}${m.at !== undefined ? formatClock(m.at) : this.dayName(m.day ?? 1).toLowerCase()}</span>
          </div>`,
        )}
      </div>
      <div style="flex:none;width:18px"></div>
    </div>`;
  }

  private sheetSkeleton() {
    const b = (h: number, r: number, extra = "") => html`<span style="display:block;height:${h}px;border-radius:${r}px;background:var(--lumen-surface-2);${extra}"></span>`;
    return html`<div aria-busy="true" style="display:flex;flex-direction:column;gap:12px;animation:lumenSkel 1.4s ease-in-out infinite">
      <div style="display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:8px">${b(88, 18)}${b(88, 18)}${b(88, 18)}</div>
      ${b(80, 16)}${b(13, 6, "width:120px;margin-top:8px")}${b(152, 18)}${b(13, 6, "width:120px;margin-top:8px")}${b(48, 14)}${b(48, 14)}${b(48, 14)}
    </div>`;
  }

  private sheetWarnings(list: Warning[], nowMs: number) {
    return html`<div style="display:flex;flex-direction:column;gap:8px">${list.map((w) => {
      const tone = warningTone(w.level);
      const active = w.from <= nowMs;
      const when = t("card.forecast.range", {
        a: `${this.dayPrefix(w.from) || (w.from > nowMs ? `${t("card.forecast.today_lc")} ` : "")}${formatClock(w.from)}`,
        b: Number.isFinite(w.to) ? `${this.dayPrefix(w.to)}${formatClock(w.to)}` : "…",
      });
      return html`<div style="display:flex;align-items:flex-start;gap:10px;min-height:52px;padding:8px 12px 8px 8px;box-sizing:border-box;border-radius:16px;background:color-mix(in srgb, ${tone.c} 14%, var(--lumen-surface-solid));border:1px solid color-mix(in srgb, ${tone.c} 32%, transparent)">
        <span style="flex:none;width:32px;height:32px;margin-top:2px;border-radius:50%;display:grid;place-items:center;font-size:18px;background:${tone.c};color:${tone.fg}">${icon(w.icon, "display:block")}</span>
        <div style="flex:1;min-width:0;padding-top:1px">
          <div style="font-size:14px;font-weight:750;line-height:18px">${w.name || t("card.forecast.warning")}<span style="font-weight:600;color:var(--lumen-text-2)"> · ${t("card.forecast.level", { n: w.level })}</span></div>
          <div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${when}</div>
          ${w.text ? html`<div style="margin-top:4px;font-size:12px;font-weight:500;line-height:1.45;color:var(--lumen-text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty">${w.text}</div>` : nothing}
        </div>
        <span style="flex:none;padding-top:3px;font:700 11px var(--lumen-font);letter-spacing:.04em;text-transform:uppercase;color:${active ? tone.c : "var(--lumen-text-2)"};white-space:nowrap">${active ? t("card.forecast.active") : t("card.forecast.in_h", { n: Math.max(1, Math.round((w.from - nowMs) / 3_600_000)) })}</span>
      </div>`;
    })}</div>`;
  }

  private nowSection(now: ReturnType<LumenWeatherCard["current"]>) {
    const tiles: TemplateResult[] = [];
    const tile = (label: string, value: string, unit: string, sub: unknown) =>
      html`<div style="min-width:0;display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:18px;background:var(--lumen-surface-2)">
        <span style="font-size:11px;font-weight:700;line-height:14px;color:var(--lumen-text-3)">${label}</span>
        <span style="white-space:nowrap"><span style="font-size:24px;font-weight:700;letter-spacing:-0.02em;font-variant-numeric:tabular-nums">${value}</span><span style="font-size:13px;font-weight:700;color:var(--lumen-text-2)">${unit}</span></span>
        <span style="display:flex;align-items:flex-start;gap:3px;font-size:11px;font-weight:600;line-height:14px;color:var(--lumen-text-2)">${sub}</span>
      </div>`;
    if (now.feels !== null && now.temp !== null) {
      const d = Math.round(now.feels) - Math.round(now.temp);
      const cap = d === 0 ? t("card.forecast.feels_same") : d < 0 ? t("card.forecast.feels_colder", { x: -d }) : t("card.forecast.feels_warmer", { x: d });
      tiles.push(tile(t("card.forecast.feels_tile"), deg(now.feels), "", html`<span style="min-width:0;text-wrap:pretty">${cap}</span>`));
    }
    if (now.wind !== null) {
      const dir = now.bearing === null ? "" : t(`card.forecast.dir.${windDirIndex(now.bearing)}`);
      const gust = now.gust === null ? "" : t("card.forecast.gusts", { x: Math.round(now.gust) });
      tiles.push(
        tile(t("card.forecast.wind"), String(Math.round(now.wind)), ` ${now.windUnit}`, html`${now.bearing === null ? nothing : icon("mdi:navigation", `flex:none;font-size:12px;margin-top:1px;transform:rotate(${now.bearing + 180}deg)`)}<span style="min-width:0;text-wrap:pretty">${[dir, gust].filter(Boolean).join(" · ")}</span>`),
      );
    }
    if (now.humidity !== null) tiles.push(tile(t("card.forecast.humidity"), String(Math.round(now.humidity)), "%", html`<span>${t("card.forecast.relative")}</span>`));
    const rows: [string, string, string][] = [];
    if (now.pressure !== null) rows.push(["mdi:gauge", t("card.forecast.pressure"), `${Math.round(now.pressure)} ${now.pressureUnit}`]);
    if (now.uv !== null) rows.push(["mdi:sun-wireless-outline", t("card.forecast.uv"), `${Math.round(now.uv)} · ${t(`card.forecast.uv.${uvLevel(now.uv)}`)}`]);
    if (now.visibility !== null) rows.push(["mdi:eye-outline", t("card.forecast.visibility"), `${formatNumber(now.visibility, now.visibility < 10 ? 1 : 0)} ${now.visUnit}`]);
    const sun = this.sunOfDay(dayStart(Date.now()));
    if (sun) rows.push(["mdi:weather-sunset", t("card.forecast.sun"), `${formatClock(sun.rise)} – ${formatClock(sun.set)}`]);
    if (!tiles.length && !rows.length) return nothing;
    return html`<div style="display:flex;flex-direction:column;gap:10px">
      <span style="font-size:13px;font-weight:700;color:var(--lumen-text-2)">${t("card.forecast.now")}</span>
      ${tiles.length ? html`<div style="display:grid;grid-template-columns:repeat(${tiles.length}, minmax(0,1fr));gap:8px">${tiles}</div>` : nothing}
      ${rows.length
        ? html`<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:0 16px">${rows.map(
            ([ico, label, value]) => html`<div style="display:flex;align-items:center;gap:8px;min-height:40px;min-width:0;border-top:1px solid var(--lumen-border)">
              ${icon(ico, "flex:none;font-size:16px;color:var(--lumen-text-3)")}
              <span style="flex:none;font-size:13px;font-weight:600;color:var(--lumen-text-2);white-space:nowrap">${label}</span>
              <span style="flex:1;min-width:0;text-align:right;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap">${value}</span>
            </div>`,
          )}</div>`
        : nothing}
    </div>`;
  }

  private toggleDay(i: number) {
    this.haptic("selection");
    this._openDay = this._openDay === i ? null : i;
  }

  private forecastSections(now: ReturnType<LumenWeatherCard["current"]>, fc: Forecasts, nowMs: number) {
    const hours = hoursOf({ now: nowMs, ...fc });
    const td = todayHours(hours);
    const days = daySummaries(hours, fc.daily, nowMs);
    if (!td.length && !days.length)
      return html`<div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:18px;background:var(--lumen-surface-2)">
        ${icon("mdi:cloud-off-outline", "flex:none;font-size:24px;color:var(--lumen-text-3)")}
        <div><div style="font-size:14px;font-weight:750">${t("card.forecast.no_forecast")}</div><div style="font-size:12px;font-weight:600;line-height:1.5;color:var(--lumen-text-2);text-wrap:pretty">${t("card.forecast.no_forecast_text")}</div></div>
      </div>`;
    // Common scale of the range bars: today's strip + the next days.
    const all = [...td.map((h) => h.temp), ...days.flatMap((d) => [d.min, d.max])];
    const gmin = Math.min(...all);
    const rg = Math.max(...all) - gmin || 1;
    const last = td.at(-1);
    const mmUnit = now.mmUnit;
    const windUnit = now.windUnit;
    return html`
      ${td.length
        ? html`<div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span style="font-size:13px;font-weight:700;color:var(--lumen-text-2)">${t("card.forecast.today_hourly")}</span><span style="font-size:12px;font-weight:650;color:var(--lumen-text-3);font-variant-numeric:tabular-nums">${formatClock(td[0].t)} – ${last!.d > 0 ? `${t("card.forecast.tomorrow_lc")} ` : ""}${formatClock(last!.t)}</span></div>
            ${this.strip(td, true, `t${td[0].t}`, now)}
            <div style="display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;font-weight:600;color:var(--lumen-text-3)">
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;border-radius:1px;background:var(--lumen-orange)"></span>${t("card.forecast.legend_temp")}</span>
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;border-radius:1px;background:var(--lumen-info)"></span>${t("card.forecast.legend_feels")}</span>
              <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:color-mix(in srgb, var(--lumen-info) 45%, transparent)"></span>${t("card.forecast.legend_precip")}</span>
            </div>
          </div>`
        : nothing}
      ${days.length
        ? html`<div style="display:flex;flex-direction:column">
            <span style="font-size:13px;font-weight:700;color:var(--lumen-text-2);margin-bottom:10px">${t("card.forecast.next_days")}</span>
            ${days.map((d, i) => {
              const has = d.hours.length > 0;
              const open = has && this._openDay === i;
              const date = new Date(d.date);
              const lo = Math.round(d.min);
              const hi = Math.round(d.max);
              const lastH = d.hours.at(-1);
              return html`<div style="border-top:1px solid var(--lumen-border)">
                <div class="wxday" role=${has ? "button" : nothing} tabindex=${has ? 0 : nothing} aria-expanded=${has ? String(open) : nothing} title=${has ? "" : t("card.forecast.no_hours")}
                  @click=${has ? () => this.toggleDay(i) : nothing} @keydown=${has ? (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this.toggleDay(i)) : nothing}
                  style="cursor:${has ? "pointer" : "default"};display:grid;grid-template-columns:46px 24px 40px 32px minmax(16px,1fr) 32px 36px 18px;gap:6px;align-items:center;min-height:56px;user-select:none;-webkit-user-select:none">
                  <div style="min-width:0"><div style="font-size:14px;font-weight:700;line-height:18px;white-space:nowrap">${this.dayName(d.d)}</div><div style="font-size:11px;font-weight:600;line-height:14px;color:var(--lumen-text-3);font-variant-numeric:tabular-nums">${new Intl.DateTimeFormat(locale(), { day: "numeric", month: "numeric" }).format(date)}</div></div>
                  <span title=${condLabel(d.cond)} style="font-size:24px;color:var(--lumen-text-2)">${icon(conditionIcon(d.cond), "display:block")}</span>
                  <div style="text-align:center;font-variant-numeric:tabular-nums"><div style="font-size:12px;font-weight:700;line-height:15px;color:${(d.pp ?? 0) >= 20 ? "var(--lumen-info)" : "var(--lumen-text-3)"}">${d.pp === null ? "" : `${Math.round(d.pp)}%`}</div><div style="font-size:10.5px;font-weight:600;line-height:13px;color:var(--lumen-text-3);white-space:nowrap">${d.mm === null || d.mm < 0.1 ? "" : `${formatNumber(d.mm)} ${mmUnit}`}</div></div>
                  <span style="text-align:right;font-size:14px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${deg(d.min)}</span>
                  <div style="position:relative;height:6px;border-radius:3px;background:var(--lumen-surface-2)"><span style="position:absolute;top:0;bottom:0;left:${(((lo - gmin) / rg) * 100).toFixed(1)}%;width:${((Math.max(0.5, hi - lo) / rg) * 100).toFixed(1)}%;border-radius:3px;background:linear-gradient(90deg, ${tempColor(d.min)}, ${tempColor(d.max)})"></span></div>
                  <span style="font-size:14px;font-weight:750;font-variant-numeric:tabular-nums">${deg(d.max)}</span>
                  <div style="text-align:center;font-variant-numeric:tabular-nums">${d.wind === null ? nothing : html`<div style="font-size:12px;font-weight:700;line-height:15px">${Math.round(d.wind)}</div><div style="font-size:10.5px;font-weight:600;line-height:13px;color:var(--lumen-text-3);white-space:nowrap">${windUnit}</div>`}</div>
                  ${icon("mdi:chevron-down", `visibility:${has ? "visible" : "hidden"};font-size:18px;color:var(--lumen-text-3);transform:rotate(${open ? 180 : 0}deg);transition:transform 420ms var(--lumen-ease-spring)`)}
                </div>
                ${has
                  ? html`<div style="display:grid;grid-template-rows:${open ? "1fr" : "0fr"};opacity:${open ? 1 : 0};transition:grid-template-rows 460ms var(--lumen-ease-spring), opacity 220ms var(--lumen-ease-out)">
                      <div style="min-height:0;overflow:hidden">${open
                        ? html`${this.strip(d.hours, false, `d${d.date}`)}${d.partial && lastH
                            ? html`<div style="display:flex;align-items:center;gap:6px;margin-top:-6px;padding-bottom:14px;font-size:11px;font-weight:600;color:var(--lumen-text-3)">${icon("mdi:clock-end", "flex:none;font-size:14px")}${t("card.forecast.partial", { from: formatClock(d.hours[0].t), to: formatClock(lastH.t + 3_600_000) })}</div>`
                            : nothing}`
                        : nothing}</div>
                    </div>`
                  : nothing}
              </div>`;
            })}
          </div>`
        : nothing}`;
  }

  private sheet() {
    const c = this._config;
    const now = this.current();
    const e = this.weatherEntity;
    const nowMs = Date.now();
    const warns = this.warnings();
    const place = String(e?.attributes.friendly_name ?? this._hass?.config?.location_name ?? "");
    const head = html`<div style="display:flex;align-items:center;gap:14px;padding:10px 0 14px">
      <span style="flex:none;width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-size:32px;background:var(--lumen-accent-soft);color:var(--lumen-accent)">${icon(now.icon, "display:block")}</span>
      <span style="flex:none;font-size:32px;font-weight:600;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums">${now.temp === null ? "—" : deg(now.temp)}</span>
      <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700;line-height:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${now.label}</div><div style="font:500 11px/15px var(--lumen-mono);color:var(--lumen-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[place, t("card.forecast.now_lc"), c.entity].filter(Boolean).join(" · ")}</div></div>
      <button aria-label=${t("common.close")} @click=${this.sheetView.closeHandler} style="flex:none;width:40px;height:40px;border:0;padding:0;border-radius:50%;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-2);color:var(--lumen-text-2);cursor:pointer">${icon("mdi:close", "display:block")}</button>
    </div>`;
    const fc = this._fc;
    const warnSrc = c.warnings_entity ? String(this.entity(c.warnings_entity)?.attributes.attribution ?? this.entity(c.warnings_entity)?.attributes.friendly_name ?? c.warnings_entity) : "";
    const updated = e?.last_updated ? formatClock(e.last_updated) : "";
    const foot = [
      t("card.forecast.source", { x: String(e?.attributes.attribution ?? c.entity) }),
      e?.attributes.attribution ? c.entity : "",
      warnSrc ? t("card.forecast.warnings_source", { x: warnSrc }) : "",
      updated ? t("card.forecast.updated", { x: updated }) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const body = fc
      ? html`${warns.length ? this.sheetWarnings(warns, nowMs) : nothing}${this.nowSection(now)}${this.forecastSections(now, fc, nowMs)}
          <div style="padding-top:12px;border-top:1px solid var(--lumen-border);font-size:12px;font-weight:600;line-height:1.5;color:var(--lumen-text-3);text-wrap:pretty">${foot}</div>`
      : this.sheetSkeleton();
    return this.sheetView.render({ title: t("card.forecast.details") }, body, nothing, {
      head,
      body: "gap:20px;padding:16px 18px calc(20px + env(safe-area-inset-bottom))",
      maxHeight: "88%",
    });
  }

  getCardSize() {
    return this.look === "card" ? 3 : 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "weather", entities, fallback) ?? Object.keys(hass?.states ?? {}).find((x) => x.startsWith("weather.")) ?? "weather.home" };
  }

  static getConfigForm() {
    const select = (options: [string, string][]) => ({ select: { mode: "dropdown", options: options.map(([value, label]) => ({ value, label: t(label) })) } });
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
      { name: "warnings_entity", selector: { entity: { domain: ["sensor", "binary_sensor"] } } },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "layout", default: "auto", selector: select([["auto", "common.auto"], ["compact", "card.forecast.look.line"], ["wide", "card.forecast.look.card"], ["icon", "card.forecast.look.icon"]]) },
          { name: "hours", title: "editor.weather_hours", helper: "weather_hours", default: 6, selector: { number: { min: 4, max: 8, step: 1, mode: "slider" } } },
        ],
      },
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [["show_feels"], ["show_minmax"], ["show_hours"], ["show_warnings"]].map(([name]) => ({ name, default: true, selector: { boolean: {} } })),
      },
      advanced(),
      appearance({ layout: false }),
    ]);
  }
}

registerCard("lumen-weather-card", LumenWeatherCard, {
  name: "card.forecast.name",
  description: "card.forecast.description",
  domains: ["weather"],
});
