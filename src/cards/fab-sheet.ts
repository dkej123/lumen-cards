import { html, nothing } from "lit";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { PENDING_MS } from "../core/controllers/pending";
import { appearance, fabSideField, hapticsField } from "../core/form";
import { formX } from "../core/form-extra";
import { t } from "../core/i18n";
import { FAB_ORDER, FabController, fabSideOf, LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { activate } from "../core/press";
import { registerCard } from "../core/register";
import { emptySheet, InnerCards, Sheet, type CardConfig } from "../core/sheet";
import { glass, ink } from "../core/styles";
import { toast } from "../core/toast";
import type { HassEntity, HassLike } from "../hass/types";
import { badgeCount, bulkSegment, cardEntities, isHeating, panelSummary, panelWarning, type Bulk } from "../logic/fab-sheet";
import { innerConfig } from "../logic/popup";
import { formatNumber } from "../logic/time";

export interface FabSheetConfig extends BaseConfig {
  /** FAB / header icon, e.g. mdi:radiator. */
  icon?: string;
  /** Sheet title ("Heating"). */
  title?: string;
  /** Cards inside (any HA card; usually lumen-climate-card, compact by default here). */
  cards?: CardConfig[];
  /** FAB only on narrow screens (default); wider the card is a row in the grid. false = FAB always. */
  narrow_only?: boolean;
  /** Entities counted on the FAB badge. Empty = the cards' climate entities with hvac_action heating. */
  badge_entities?: string[];
}

export function validateFabSheet(c: Partial<FabSheetConfig>): void {
  if (c.cards !== undefined && !Array.isArray(c.cards)) throw new Error(t("card.popup.error.cards"));
  if (c.badge_entities !== undefined && !Array.isArray(c.badge_entities)) throw new Error(t("card.fab_sheet.error.badge_entities"));
}

/** Inner cards: no weather in the sheet; climate cards default to the compact thermostat row and never float. */
export function fabSheetInner(c: CardConfig): CardConfig {
  const out = innerConfig(c);
  if (out.type === "custom:lumen-climate-card") return { layout: "compact", ...out, fab: false };
  return out;
}

const BULK_ICON: Record<string, string> = { comfort: "mdi:sofa-outline", eco: "mdi:leaf", off: "mdi:power" };
const BULK_LABEL: Record<string, string> = { comfort: "card.climate.preset.comfort", eco: "card.climate.preset.eco", off: "common.off_short" };
const ORANGE = "var(--lumen-orange)";

/**
 * Floating panel (catalog section 19): one FAB in the shared stack that opens a bottom sheet with
 * any cards – typically all the thermostats in one place instead of a FAB each. The FAB counts
 * what is heating, warns about a low battery / an unavailable entity and hides under the open
 * sheet. Wider than a phone (with `narrow_only`) and while the dashboard is edited the card is a
 * 52 px row in the grid that opens the same sheet.
 */
export class LumenFabSheetCard extends LumenBaseCard<FabSheetConfig> {
  private inner = new InnerCards(this, fabSheetInner);
  private sheet = new Sheet(this, () => this.sheet.hide());
  private idsFor?: unknown;
  private idsCache: string[] = [];
  private bulkPending: { value: string; until: number } | null = null;

  protected layer = new LayerController(
    this,
    () => {
      const fab = this.useFab ? this.fab() : nothing;
      const sheet = this.sheet.open && !this.preview ? this.sheetView() : nothing;
      return fab === nothing && sheet === nothing ? nothing : html`${fab}${sheet}`;
    },
    () => this.sheet.hide(),
  );

  /** Entities of the inner cards (cached per `cards` list). */
  private get ids(): string[] {
    const cards = this._config?.cards;
    if (this.idsFor !== cards) {
      this.idsFor = cards;
      this.idsCache = cardEntities(cards);
    }
    return this.idsCache;
  }

  protected entityIds() {
    const batteries = (this._config.cards ?? []).map((c) => (typeof c?.battery_entity === "string" ? c.battery_entity : undefined));
    return [...this.ids, ...(this._config.badge_entities ?? []), ...batteries];
  }

  protected validate(c: FabSheetConfig) {
    validateFabSheet(c);
  }

  protected defaults(): Partial<FabSheetConfig> {
    return { cards: [] };
  }

  setConfig(config: FabSheetConfig): void {
    super.setConfig(config);
    if (this.inner.invalidate(this._config.cards) && this.sheet.open) this.inner.build(this._config.cards ?? []);
  }

  protected onHass(hass: HassLike): void {
    this.inner.setHass(hass);
  }

  private get hasCards(): boolean {
    return (this._config?.cards ?? []).length > 0;
  }

  private floating = new FabController(this, FAB_ORDER.panels, () => this.useFab, () => fabSideOf(this._config));

  /** FAB instead of the row: not in the editor, not without cards, narrow screens unless `narrow_only: false`. */
  get useFab(): boolean {
    const c = this._config;
    return !!c && !!this._hass && !this._configError && this.hasCards && !this.preview && !this.editMode && (c.narrow_only === false || this.narrowScreen);
  }

  /** Open the sheet (FAB, trigger row). */
  open = () => {
    if (this.preview) return;
    this.haptic();
    this.sheet.show();
    this.inner.build(this._config.cards ?? []);
  };

  private get panelTitle(): string {
    return this._config.title || t("card.fab_sheet.name");
  }

  private get panelIcon(): string {
    return this._config.icon || "mdi:dock-bottom";
  }

  /** Everything the FAB, the row and the header show, from the entities. */
  private status() {
    const states = this._hass?.states ?? {};
    const ids = this.ids;
    const n = (this._config.cards ?? []).length;
    const count = badgeCount(this._config.badge_entities, ids, states);
    return {
      count,
      heating: count > 0,
      summary: panelSummary(ids, states, n),
      short: panelSummary(ids, states, n, false),
      warning: panelWarning(this._config.cards, ids, states),
    };
  }

  /** The "All" segment, with a choice just sent shown until the thermostats follow. */
  private bulk(): Bulk | null {
    const b = bulkSegment(this.ids, this._hass?.states ?? {});
    if (!b) return null;
    const p = this.bulkPending;
    if (p && (p.until < Date.now() || b.selected === p.value)) this.bulkPending = null;
    return this.bulkPending ? { ...b, selected: this.bulkPending.value } : b;
  }

  private async setAll(b: Bulk, value: string) {
    const hass = this._hass;
    if (!hass) return;
    this.haptic();
    this.bulkPending = { value, until: Date.now() + PENDING_MS };
    this.requestUpdate();
    try {
      if (value === "off") {
        await hass.callService("climate", "set_hvac_mode", { hvac_mode: "off" }, { entity_id: b.ids });
        return;
      }
      // Thermostats that are off are turned on (heat) first: a preset alone does not wake them.
      const off = b.ids.filter((id) => hass.states[id]?.state === "off" && ((hass.states[id]?.attributes.hvac_modes as string[] | undefined) ?? ["heat"]).includes("heat"));
      if (off.length) await hass.callService("climate", "set_hvac_mode", { hvac_mode: "heat" }, { entity_id: off });
      await hass.callService("climate", "set_preset_mode", { preset_mode: value }, { entity_id: b.ids });
    } catch (err) {
      this.bulkPending = null;
      this.requestUpdate();
      toast(this, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: (err as Error)?.message ?? String(err) });
    }
  }

  /** Count (top right, orange) and warning (top left) corners of the FAB; `ring` = the background colour. */
  private corners(s: ReturnType<LumenFabSheetCard["status"]>, ring = "var(--lumen-bg)") {
    return html`${s.count
      ? html`<span aria-hidden="true" style="position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;display:grid;place-items:center;background:${ORANGE};color:var(--lumen-on-tone);font:800 11px/1 var(--lumen-font);font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px ${ring}">${s.count}</span>`
      : nothing}${s.warning
      ? html`<span aria-hidden="true" title=${s.warning.text} style="position:absolute;top:-4px;left:-4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:13px;background:var(--lumen-warning);color:var(--lumen-light-ink);box-shadow:0 0 0 2px ${ring}">${icon(s.warning.icon, "display:block")}</span>`
      : nothing}`;
  }

  private label(s: ReturnType<LumenFabSheetCard["status"]>) {
    return [this.panelTitle, s.summary, s.warning?.text].filter(Boolean).join(" · ");
  }

  /** The FAB: 48 px above the scenes FAB (64 px when it is the lowest), hidden under the open sheet. */
  private fab() {
    const s = this.status();
    const { size, bottom, edge } = this.floating.place();
    const open = this.sheet.open && !this.sheet.closing;
    return html`<button class="acfab" @click=${this.open} aria-label=${this.label(s)} title=${this.label(s)} aria-haspopup="dialog" aria-expanded=${open ? "true" : "false"} tabindex=${open ? -1 : 0}
      style="position:absolute;${edge};bottom:${bottom};z-index:5;width:${size}px;height:${size}px;padding:0;border:0;border-radius:50%;display:grid;place-items:center;font-size:${Math.round(size * 0.42)}px;background:var(--lumen-surface-solid);color:${s.heating ? ORANGE : "var(--lumen-text-1)"};box-shadow:var(--lumen-shadow-2);cursor:pointer;user-select:none;opacity:${open ? 0 : 1};pointer-events:${open ? "none" : "auto"};animation:${s.heating ? "lumenPendingPulse 2s ease-in-out infinite" : "none"};transition:opacity 200ms, color 400ms, transform 260ms var(--lumen-ease-spring)">
      ${icon(this.panelIcon, "display:block")}${this.corners(s)}
    </button>`;
  }

  /** The "All: Comfort / Eco / Off" segment under the header. */
  private bulkRow(b: Bulk) {
    const opts = [...b.presets, "off"];
    return html`<div style="flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px 0">
      <span style="flex:none;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)">${t("card.fab_sheet.all")}</span>
      <div role="group" aria-label=${t("card.fab_sheet.all")} style="flex:1;min-width:0;display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2)">
        ${opts.map((o) => {
          const on = b.selected === o;
          return html`<button class="seg" aria-pressed=${on ? "true" : "false"} @click=${() => this.setAll(b, o)}
            style="flex:1;min-width:0;min-height:40px;padding:0 6px;border:0;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:5px;background:${on ? "var(--lumen-surface-solid)" : "transparent"};color:${on ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};box-shadow:${on ? "var(--lumen-shadow-1)" : "none"};font:700 12px var(--lumen-font);white-space:nowrap;cursor:pointer;transition:background-color 250ms, color 250ms, box-shadow 250ms">${icon(BULK_ICON[o], "display:block;font-size:16px")}<span style="overflow:hidden;text-overflow:ellipsis">${t(BULK_LABEL[o])}</span></button>`;
        })}
      </div>
    </div>`;
  }

  private head(s: ReturnType<LumenFabSheetCard["status"]>) {
    return {
      title: this.panelTitle,
      icon: this.panelIcon,
      iconBg: s.heating ? `color-mix(in srgb, ${ORANGE} 16%, transparent)` : "var(--lumen-surface-2)",
      iconFg: s.heating ? ORANGE : "var(--lumen-text-2)",
      sub: this.hasCards ? s.summary : t("card.fab_sheet.no_cards"),
    };
  }

  private sheetView() {
    const s = this.status();
    const b = this.bulk();
    const body = this.hasCards ? this.inner.grid(this._config.cards) : emptySheet(t("card.fab_sheet.empty_title"), t("card.fab_sheet.empty_text"));
    return this.sheet.render(this.head(s), body, b ? this.bulkRow(b) : nothing);
  }

  /** 52 px row in the grid (wide screens with narrow_only, edit mode): opens the same sheet. */
  private triggerRow(edit: boolean) {
    const s = this.status();
    const a = activate(this.open);
    const sub = this.hasCards ? s.summary : t("card.fab_sheet.no_cards");
    const note = this._config.narrow_only === false ? t("card.fab_sheet.edit_note_always") : t("card.fab_sheet.edit_note");
    return html`<div data-fx role="button" tabindex="0" class="trow" aria-label=${this.label(s)} aria-haspopup="dialog" @click=${a.click} @keydown=${a.key}
      style="position:relative;display:flex;align-items:center;gap:10px;height:52px;padding:0 8px 0 9px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:${edit ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};${glass};box-shadow:var(--lumen-shadow-1);cursor:pointer;user-select:none;transition:transform 220ms var(--lumen-ease-spring)"><canvas class="wfx" aria-hidden="true"></canvas>
      <div style="flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:${s.heating ? `color-mix(in srgb, ${ORANGE} 16%, transparent)` : "var(--lumen-surface-2)"};color:${s.heating ? ORANGE : "var(--lumen-text-2)"};transition:background-color 400ms, color 400ms">${icon(this.panelIcon, "display:block")}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.panelTitle}</div>
        <div style="font-size:12px;font-weight:650;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${sub}</div>
      </div>
      ${edit ? html`<span style="flex:none;padding:2px 7px;border-radius:6px;background:var(--lumen-surface-2);font:500 10px/14px var(--lumen-mono);color:var(--lumen-text-2);white-space:nowrap">${note}</span>` : nothing}
      ${s.warning
        ? html`<span role="img" title=${s.warning.text} aria-label=${s.warning.text} style="flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:16px;background:color-mix(in srgb, var(--lumen-warning) 18%, transparent);color:${ink("var(--lumen-warning)")}">${icon(s.warning.icon, "display:block")}</span>`
        : nothing}
      ${icon("mdi:chevron-right", "flex:none;display:block;font-size:20px;color:var(--lumen-text-3)")}
    </div>`;
  }

  /** Editor preview: the FAB with its corners next to a static copy of the open sheet (like the reminder's). */
  private previewView() {
    const s = this.status();
    const states = this._hass?.states ?? {};
    const rows = this.ids.slice(0, 6).map((id) => states[id]).filter((e): e is HassEntity => !!e);
    const row = (e: HassEntity) => {
      const climate = e.entity_id.startsWith("climate.");
      const heat = isHeating(e);
      const una = e.state === "unavailable";
      const act = !climate
        ? (this._hass?.formatEntityState?.(e) ?? e.state)
        : una ? t("common.unavailable") : e.state === "off" ? t("common.off_short") : heat ? t("card.climate.action.heating") : t("card.climate.action.idle");
      const target = climate && typeof e.attributes.temperature === "number" ? `${formatNumber(e.attributes.temperature)}°`.replace(/[.,]0°$/, "°") : "";
      return html`<div style="display:flex;align-items:center;gap:8px;min-height:34px;padding:0 10px;border-radius:12px;background:var(--lumen-surface-2);font-size:12px;font-weight:700">
        <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.attributes.friendly_name ?? e.entity_id}</span>
        <span style="flex:none;color:${heat ? ORANGE : "var(--lumen-text-2)"};font-weight:650">${act}</span>
        ${target ? html`<span style="flex:none;min-width:30px;text-align:right;font-variant-numeric:tabular-nums">${target}</span>` : nothing}
      </div>`;
    };
    const h = this.head(s);
    return html`<div role="img" aria-label=${t("card.fab_sheet.preview")} style="display:flex;align-items:flex-end;gap:16px;padding:18px 16px;border-radius:22px;background:var(--lumen-sunken);border:1px solid var(--lumen-border);pointer-events:none">
      <span style="position:relative;flex:none;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-solid);color:${s.heating ? ORANGE : "var(--lumen-text-1)"};box-shadow:var(--lumen-shadow-2)">${icon(this.panelIcon, "display:block")}${this.corners(s, "var(--lumen-sunken)")}</span>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px 12px;border-radius:20px 20px 8px 8px;background:var(--lumen-surface-solid);box-shadow:var(--lumen-shadow-2)">
        <span style="align-self:center;width:28px;height:4px;border-radius:2px;background:var(--lumen-border-strong)"></span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="flex:none;width:30px;height:30px;border-radius:10px;display:grid;place-items:center;font-size:17px;background:${h.iconBg};color:${h.iconFg}">${icon(this.panelIcon, "display:block")}</span>
          <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.title}</div><div style="font-size:11px;font-weight:650;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${h.sub}</div></div>
        </div>
        ${rows.length ? rows.map(row) : html`<div style="padding:6px 2px;font-size:12px;font-weight:600;color:var(--lumen-text-3)">${t("card.fab_sheet.empty_text")}</div>`}
      </div>
    </div>`;
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    if (this.preview) return this.previewView();
    if (this.editMode) return this.triggerRow(true);
    if (!this.hasCards || this.useFab) return nothing;
    return this.triggerRow(false);
  }

  getCardSize() {
    return this.useFab || !this.hasCards ? 0 : 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike) {
    const ids = Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("climate.")).slice(0, 3);
    return {
      icon: "mdi:radiator",
      title: t("card.fab_sheet.stub_title"),
      cards: (ids.length ? ids : ["climate.example"]).map((entity) => ({ type: "custom:lumen-climate-card", entity, layout: "compact" })),
    };
  }

  static getConfigForm() {
    return formX([
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "icon", selector: { icon: {} } },
          { name: "title", selector: { text: {} } },
        ],
      },
      { name: "narrow_only", helper: "narrow_only_fab", default: true, selector: { boolean: {} } },
      fabSideField,
      { name: "badge_entities", selector: { entity: { multiple: true } } },
      { name: "cards", helper: "fab_sheet_cards", selector: { object: {} } },
      hapticsField,
      appearance({ layout: false, effects: false }),
    ]);
  }
}

registerCard("lumen-fab-sheet-card", LumenFabSheetCard, {
  name: "card.fab_sheet.name",
  description: "card.fab_sheet.description",
});
