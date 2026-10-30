import { html, nothing } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Tweens } from "../core/controllers/tween";
import { icon } from "../core/lumen-icon";
import { advanced, appearance, form } from "../core/form";
import { History } from "../core/history";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import type { HassLike } from "../hass/types";
import { AIR_LEVELS, AQI, PM10, PM25, type AirReading, airQuality, airReading } from "../logic/air";
import { formatAgo, formatClock, formatNumber } from "../logic/time";

export interface AirQualityConfig extends BaseConfig {
  /** At least one of pm25 / pm10 / aqi_entity. */
  pm25?: string;
  pm10?: string;
  /** Air quality index sensor (US EPA scale 0–500). */
  aqi_entity?: string;
  /** Own wording of the six levels (YAML): [{ title, hint }, …]. */
  levels?: { title?: string; hint?: string }[];
  show_values?: boolean;
  show_bar?: boolean;
  /** Footer of the details sheet (sensor location, source). */
  footer?: string;
  /** No valid reading for this long = stale (dashed card, "Outdated data"). */
  stale_hours?: number;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

export function validateAirQuality(c: Partial<AirQualityConfig>): void {
  if (!c.pm25 && !c.pm10 && !c.aqi_entity) throw new Error(t("card.air_quality.error.sensor"));
}

/** Air quality (design): 6 levels + stale, PM2.5 / PM10 / AQI with tweened numbers, 24 h sheet. */
export class LumenAirQualityCard extends LumenBaseCard<AirQualityConfig> {
  static properties = { ...LumenBaseCard.properties, _sheet: { state: true } };
  private _sheet: { closing: boolean } | null = null;
  private sheetOpenedAt = 0;
  private history = new History(this, () => (this._config ? this.ids : []), () => {
    if (!this._config) return;
    for (const id of this.ids) {
      const last = this.history.last(id);
      if (last && !this.lastAir.has(id)) this.lastAir.set(id, { value: last.v, at: new Date(last.t).toISOString() });
    }
    this.requestUpdate();
  });
  private lastAir = new Map<string, AirReading>();
  private tweens = new Tweens(this);

  private closeTimer?: number;

  protected layer = new LayerController(this, () => (this._sheet && !this.preview ? this.sheet() : nothing), () => this.closeSheet());

  private get ids(): string[] {
    const c = this._config;
    return [c.pm25, c.pm10, c.aqi_entity].filter((x): x is string => !!x);
  }

  protected entityIds() {
    return this.ids;
  }

  protected validate(c: AirQualityConfig) {
    validateAirQuality(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(30_000, () => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.closeTimer);
    this._sheet = null;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (!this._config || !this._hass) return;
    this.tweens.to("pm25", this.air(this._config.pm25)?.value ?? null);
    this.tweens.to("pm10", this.air(this._config.pm10)?.value ?? null);
    this.tweens.to("aqi", this.air(this._config.aqi_entity)?.value ?? null);
  }

  /** Live PM reading, or the last valid one while the sensor is `unknown`. */
  private air(entity: string | undefined): AirReading | undefined {
    if (!entity) return undefined;
    const reading = airReading(this.entity(entity), this.lastAir.get(entity));
    if (reading) this.lastAir.set(entity, reading);
    return reading;
  }

  private quality() {
    const c = this._config;
    const now = Date.now();
    const q = airQuality(this.air(c.pm25), this.air(c.pm10), Number(c.stale_hours ?? 2), now, this.air(c.aqi_entity));
    const stale = q.stale || q.level === null;
    const l = q.level ?? 0;
    const col = stale ? "var(--lumen-unavailable)" : `var(--lumen-aq-${l})`;
    const lvl = AIR_LEVELS[l];
    const own = Array.isArray(c.levels) ? c.levels[l] : undefined;
    const pm25 = this.tweens.get("pm25");
    const pm10 = this.tweens.get("pm10");
    const aqi = this.tweens.get("aqi");
    const f0 = (v?: number) => (v === undefined ? "—" : formatNumber(v, 0));
    const parts = [c.pm25 ? `PM2.5 ${f0(pm25)}` : "", c.pm10 ? `PM10 ${f0(pm10)}` : "", c.aqi_entity ? `AQI ${f0(aqi)}` : ""].filter(Boolean);
    return {
      c: col,
      stale,
      // Outdated (catalog section 11): grey dot, dashed frame on surface-2, the age in the warning colour.
      title: stale ? t("card.air_quality.stale") : `${lvl.emoji} ${typeof own?.title === "string" ? own.title : t(lvl.title)}`,
      sub: stale ? t("card.air_quality.last_reading_ago", { x: formatAgo(q.readAt, now) }) : typeof own?.hint === "string" ? own.hint : t(lvl.hint),
      age: q.readAt ? formatAgo(q.readAt, now) : "",
      ageC: stale ? "var(--lumen-warning)" : "var(--lumen-text-3)",
      bg: stale ? "var(--lumen-surface-2)" : `color-mix(in srgb, ${col} 15%, var(--lumen-surface-solid))`,
      border: stale ? "1px dashed var(--lumen-border-strong)" : `1px solid color-mix(in srgb, ${col} 38%, transparent)`,
      level: l,
      pmShort: c.show_values === false ? "" : parts.join(" · "),
      pm25,
      pm10,
      aqi,
      readAt: q.readAt,
    };
  }

  private openSheet() {
    this.haptic();
    this.sheetOpenedAt = performance.now();
    this._sheet = { closing: false };
  }

  private scrimClose = () => {
    if (performance.now() - this.sheetOpenedAt > 400) this.closeSheet();
  };

  private closeSheet = () => {
    if (!this._sheet || this._sheet.closing) return;
    this._sheet = { closing: true };
    this.closeTimer = window.setTimeout(() => (this._sheet = null), 250);
  };

  private sheet() {
    const sh = this._sheet!;
    const isSheet = this.narrowScreen;
    const anim = sh.closing
      ? isSheet ? "lumenSheetOut 250ms var(--lumen-ease-in-out) forwards" : "lumenModalOut 220ms ease forwards"
      : isSheet ? "lumenSheetIn 560ms var(--lumen-ease-spring) both" : "lumenModalIn 460ms var(--lumen-ease-spring) both";
    const aq = this.quality();
    const { pm25, pm10, aqi_entity, footer } = this._config;
    const chart = (name: string, entity: string | undefined, value: number | undefined, thresholds: number[], unit = " µg/m³") => {
      if (!entity) return nothing;
      const sp = this.history.spark(entity, 24, 300, 90);
      const lvl = value === undefined ? 0 : thresholds.filter((x) => value >= x).length;
      return html`<div style="display:flex;flex-direction:column;gap:8px;color:var(--lumen-aq-${lvl})">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:14px;font-weight:800;color:var(--lumen-text-1)">${name}</span><span style="font-size:13px;font-weight:700;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${t("card.air_quality.now")} ${value === undefined ? "—" : formatNumber(value, 0)}${unit}</span></div>
        <svg viewBox="0 0 300 90" preserveAspectRatio="none" style="width:100%;height:110px;overflow:visible"><path d=${sp.area} fill="currentColor" opacity="0.14"></path><path d=${sp.line} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path></svg>
        <div style="display:flex;justify-content:space-between;font:500 10.5px var(--lumen-mono);color:var(--lumen-text-3)"><span>−24 h</span><span>−12 h</span><span>${t("card.air_quality.now")}</span></div>
      </div>`;
    };
    return html`<div style="position:absolute;inset:0;z-index:50;display:flex;align-items:${isSheet ? "flex-end" : "center"};justify-content:center;padding:${isSheet ? "0" : "24px"};box-sizing:border-box;font-family:var(--lumen-font);color:var(--lumen-text-1)">
      <div @click=${this.scrimClose} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:${sh.closing ? "lumenFadeOut 250ms forwards" : "lumenFadeIn 300ms both"}"></div>
      <div role="dialog" aria-modal="true" aria-label=${t("card.air_quality.name")} style="position:relative;width:100%;max-width:${isSheet ? "520px" : "560px"};animation:${anim}">
        <div style="background:var(--lumen-surface-solid);border-radius:${isSheet ? "30px 30px 0 0" : "28px"};box-shadow:var(--lumen-shadow-2);border:1px solid var(--lumen-border);padding:6px 20px calc(28px + ${isSheet ? "env(safe-area-inset-bottom)" : "0px"});max-height:86vh;overflow:auto;overscroll-behavior:contain;box-sizing:border-box">
          ${isSheet ? html`<div style="display:flex;justify-content:center;padding:8px 0 10px"><span style="width:40px;height:5px;border-radius:3px;background:var(--lumen-border-strong)"></span></div>` : nothing}
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0 16px">
            <div style="width:44px;height:44px;border-radius:15px;display:grid;place-items:center;font-size:24px;background:color-mix(in srgb, ${aq.c} 18%, transparent);color:${aq.c}">${icon("mdi:air-filter")}</div>
            <div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800;letter-spacing:-0.02em">${t("card.air_quality.name")}</div><div style="font:500 11px var(--lumen-mono);color:var(--lumen-text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.ids.join(" · ")}</div></div>
            <button aria-label=${t("common.close")} @click=${this.closeSheet} style="width:44px;height:44px;border-radius:50%;border:0;background:var(--lumen-surface-2);color:var(--lumen-text-2);font-size:20px;cursor:pointer;display:grid;place-items:center">${icon("mdi:close")}</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:18px">
            <div style="padding:14px 16px;border-radius:18px;background:${aq.bg};border:${aq.border}"><div style="font-size:16px;font-weight:800">${aq.title}</div><div style="font-size:13px;font-weight:600;color:var(--lumen-text-2)">${aq.sub}</div></div>
            ${chart("PM2.5", pm25, aq.pm25, PM25)}
            ${chart("PM10", pm10, aq.pm10, PM10)}
            ${chart("AQI", aqi_entity, aq.aqi, AQI, "")}
            <div style="font-size:12px;font-weight:600;color:var(--lumen-text-3);border-top:1px solid var(--lumen-border);padding-top:12px">${footer ? `${footer} · ` : ""}${t("card.air_quality.last_reading")} ${aq.readAt ? formatClock(aq.readAt) : "—"}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const aq = this.quality();
    const h = this.presses.handlers("aq", () => (this.preview ? undefined : this.openSheet()), () => this.moreInfo(this.ids[0]));
    if (this.compact) {
      return html`<div data-fx ${pressable(h)} aria-label="${t("card.air_quality.name")}: ${aq.title}" class="press"
        style="position:relative;flex:none;height:36px;padding:0 12px;box-sizing:border-box;border-radius:14px;background:${aq.bg};border:${aq.border};display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;touch-action:pan-y;transition:background-color 700ms, transform 220ms var(--lumen-ease-spring)">${WFX}
        <span style="flex:none;width:8px;height:8px;border-radius:50%;background:${aq.c};transition:background-color 700ms"></span><span style="flex:0 0 auto;max-width:60%;font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${aq.title}</span><span style="margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums;white-space:nowrap">${aq.pmShort}${aq.stale && aq.age ? html` · <span style="color:${aq.ageC}">${aq.age}</span>` : nothing}</span>
        <div style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;display:${this._config.show_bar === false ? "none" : "block"}"><div style="position:absolute;left:0;right:0;bottom:0;display:flex;gap:2px;height:3px">${[0, 1, 2, 3, 4, 5].map(
          (i) => html`<span style="flex:1;background:${aq.stale ? "var(--lumen-unavailable)" : `var(--lumen-aq-${i})`};opacity:${aq.stale ? 0.25 : i === aq.level ? 1 : 0.28};transition:opacity 500ms"></span>`,
        )}</div></div>
      </div>`;
    }
    return html`<div data-fx ${pressable(h)} aria-label="${t("card.air_quality.name")}: ${aq.title}" class="press"
      style="padding:10px 12px;border-radius:18px;background:${aq.bg};border:${aq.border};display:flex;flex-direction:column;gap:7px;cursor:pointer;user-select:none;touch-action:pan-y;transition:background-color 700ms, transform 220ms var(--lumen-ease-spring)">${WFX}
      <div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="flex:none;width:8px;height:8px;border-radius:50%;background:${aq.c};transition:background-color 700ms"></span><span style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${aq.title}</span><span style="margin-left:auto;flex:none;font-size:11px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${aq.pmShort}</span></div>
      <div style="display:${this._config.show_bar === false ? "none" : "flex"};align-items:center;gap:10px"><div style="flex:1;display:flex;align-items:center;gap:3px;height:8px">${[0, 1, 2, 3, 4, 5].map(
        (i) => html`<span style="flex:1;height:${!aq.stale && i === aq.level ? 8 : 5}px;border-radius:3px;background:${aq.stale ? "var(--lumen-unavailable)" : `var(--lumen-aq-${i})`};opacity:${aq.stale ? 0.3 : i === aq.level ? 1 : 0.28};transition:opacity 500ms, height 500ms var(--lumen-ease-spring)"></span>`,
      )}</div><span style="flex:none;font-size:11px;font-weight:600;color:${aq.ageC}">${aq.age}</span></div>
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }

  static getStubConfig(hass?: HassLike) {
    const ids = Object.keys(hass?.states ?? {});
    const by = (dc: string) => ids.find((id) => hass?.states[id]?.attributes.device_class === dc);
    const pm25 = by("pm25");
    const pm10 = by("pm10");
    const aqi = by("aqi");
    if (!pm25 && !pm10 && aqi) return { aqi_entity: aqi };
    return { pm25: pm25 ?? "sensor.pm2_5", pm10: pm10 ?? "sensor.pm10" };
  }

  static getConfigForm() {
    return form([
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "pm25", selector: { entity: { domain: "sensor" } } },
          { name: "pm10", selector: { entity: { domain: "sensor" } } },
        ],
      },
      { name: "aqi_entity", selector: { entity: { domain: "sensor" } } },
      { name: "footer", selector: { text: {} } },
      { name: "stale_hours", default: 2, selector: { number: { min: 0.25, max: 24, step: 0.25, mode: "box", unit_of_measurement: "h" } } },
      advanced([["show_values"], ["show_bar"]]),
      appearance({ accent: false }),
    ]);
  }
}

registerCard("lumen-air-quality-card", LumenAirQualityCard, {
  name: "card.air_quality.name",
  description: "card.air_quality.description",
  domains: ["sensor"],
  suggest: (e) => ["pm25", "pm10", "aqi"].includes(String(e.attributes.device_class)),
  config: (e) => ({ [({ pm25: "pm25", pm10: "pm10", aqi: "aqi_entity" } as Record<string, string>)[String(e.attributes.device_class)]]: e.entity_id }),
});
