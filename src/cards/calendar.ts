import { html, nothing } from "lit";
import type { ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { actions, advanced, appearance, entityStub, form, hide } from "../core/form";
import { t } from "../core/i18n";
import { icon } from "../core/lumen-icon";
import { WFX } from "../core/parts";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { glass, tone } from "../core/styles";
import { requireEntity } from "../core/validate";
import type { HassEntity, HassLike } from "../hass/types";
import { eventTime, eventTone, groupByDay, parseEvents, rangeQuery, type CalEvent } from "../logic/calendar";

export interface CalendarConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Days ahead to look (default 7). */
  days?: number;
  /** Events shown at most (default 5). */
  max_events?: number;
  /** Header with the calendar name (default true). */
  show_title?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

type HassApi = HassLike & { callApi?<T>(method: "GET", path: string): Promise<T> };

const REFRESH_MS = 5 * 60_000;

export function validateCalendar(c: Partial<CalendarConfig>): void {
  requireEntity(c);
  if (c.days !== undefined && !(Number(c.days) >= 1)) throw new Error(t("card.calendar.error.days"));
}

/**
 * Upcoming events of one calendar (catalog section 14): grouped by day ("Today · Thu 29.10"),
 * each event with a colour bar, title and time. Data from HA's calendar API, refreshed every
 * 5 minutes and whenever the calendar entity changes.
 */
export class LumenCalendarCard extends LumenBaseCard<CalendarConfig> {
  protected static grid = { ...GRID.row, min_columns: 4 };
  protected static cardSize = 3;
  static properties = { ...LumenBaseCard.properties, _events: { state: true }, _error: { state: true } };
  private _events: CalEvent[] | null = null;
  private _error = "";
  private fetchedFor?: HassEntity;
  private fetchedAt = 0;
  private loading = false;

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: CalendarConfig) {
    validateCalendar(c);
  }

  setConfig(config: CalendarConfig): void {
    const prev = this._config;
    super.setConfig(config);
    if (prev && (prev.entity !== config.entity || prev.days !== config.days)) {
      this._events = null;
      this.fetchedFor = undefined;
      this.fetchedAt = 0;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Day labels move at midnight; the list is fetched again every few minutes.
    this.every(60_000, () => {
      if (Date.now() - this.fetchedAt > REFRESH_MS) this.fetchedFor = undefined;
      this.load();
      this.requestUpdate();
    });
  }

  protected onHass(): void {
    this.load();
  }

  private async load() {
    const c = this._config;
    const h = this._hass as HassApi | undefined;
    if (!c || !h || this.loading) return;
    const e = this.entity(c.entity);
    if (this.fetchedAt && e === this.fetchedFor && Date.now() - this.fetchedAt < REFRESH_MS) return;
    if (typeof h.callApi !== "function") {
      this._events ??= [];
      return;
    }
    this.loading = true;
    this.fetchedFor = e;
    const { start, end } = rangeQuery(Date.now(), Number(c.days ?? 7));
    try {
      const raw = await h.callApi<unknown>("GET", `calendars/${c.entity}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      this._events = parseEvents(raw);
      this._error = "";
    } catch (err) {
      this._error = (err as { body?: { message?: string }; message?: string })?.body?.message ?? (err as Error)?.message ?? String(err);
      this._events ??= [];
    } finally {
      this.fetchedAt = Date.now();
      this.loading = false;
    }
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.entity(c.entity);
    const name = entityName(c.name, e, c.entity);
    const h = this.actions(`cal:${c.entity}`, c, c.entity);
    const days = this._events ? groupByDay(this._events, Date.now(), Math.max(1, Number(c.max_events ?? 5))) : null;
    const una = !e || e.state === "unavailable";
    const body = !days
      ? html`${[0, 1].map(
          (i) => html`<div aria-hidden="true" style="display:flex;flex-direction:column;gap:8px;animation:lumenSkel 1.4s ease-in-out infinite;animation-delay:${i * 200}ms">
            <span style="width:90px;height:10px;border-radius:5px;background:var(--lumen-surface-2)"></span>
            <span style="width:70%;height:30px;border-radius:8px;background:var(--lumen-surface-2)"></span>
          </div>`,
        )}`
      : this._error
      ? html`<div role="alert" style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:650;color:var(--lumen-danger)">${icon("mdi:alert-circle-outline", "font-size:18px")}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis">${t("card.calendar.error")}</span></div>`
      : !days.length
      ? html`<div style="font-size:13px;font-weight:650;color:var(--lumen-text-3)">${una ? t("common.unavailable") : t("card.calendar.empty", { n: Number(c.days ?? 7) })}</div>`
      : days.map(
          (d) => html`<div role="group" aria-label=${d.label} style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3);padding-top:2px">${d.label}</div>
            ${d.events.map(
              (ev) => html`<div style="display:flex;align-items:stretch;gap:10px">
                <span style="flex:none;width:3px;border-radius:2px;background:${tone(eventTone(ev.summary))}"></span>
                <div style="min-width:0">
                  <div style="font-size:14px;font-weight:700;line-height:18px;overflow-wrap:anywhere">${ev.summary}</div>
                  <div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${eventTime(ev)}${ev.location ? html`<span style="color:var(--lumen-text-3)"> · ${ev.location}</span>` : nothing}</div>
                </div>
              </div>`,
            )}
          </div>`,
        );
    return html`<div data-fx style="position:relative;display:flex;flex-direction:column;gap:10px;padding:14px 16px;box-sizing:border-box;border-radius:22px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};box-shadow:var(--lumen-shadow-1);color:var(--lumen-text-1)">${WFX}
      ${c.show_title !== false
        ? html`<div ${pressable(h)} aria-label=${name} style="display:flex;align-items:center;gap:8px;margin:-6px -8px -2px;padding:6px 8px;border-radius:12px;cursor:pointer;user-select:none;touch-action:pan-y">
            ${icon(c.icon || (e?.attributes.icon as string | undefined) || "mdi:calendar-blank-outline", "font-size:18px;color:var(--lumen-text-3)")}<span style="font-size:14px;font-weight:750;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
          </div>`
        : nothing}
      ${body}
    </div>`;
  }

  static getStubConfig = entityStub("calendar", "calendar.home");

  static getConfigForm() {
    // Name, icon and actions live on the header row: no header, nothing to set.
    return form((c) =>
      hide(c, [
        { name: "entity", required: true, selector: { entity: { domain: "calendar" } } },
        { name: "show_title", default: true, selector: { boolean: {} } },
        {
          name: "",
          type: "grid",
          flatten: true,
          schema: [
            { name: "name", selector: { text: {} } },
            { name: "icon", selector: { icon: {} }, context: { icon_entity: "entity" } },
            { name: "days", default: 7, selector: { number: { min: 1, max: 60, step: 1, mode: "box" } } },
            { name: "max_events", default: 5, selector: { number: { min: 1, max: 30, step: 1, mode: "box" } } },
          ],
        },
        actions(true, false),
        advanced(),
        appearance({ layout: false, accent: false }),
      ], [[c?.show_title === false, ["name", "icon", "tap_action", "hold_action"]]]),
    );
  }
}

registerCard("lumen-calendar-card", LumenCalendarCard, {
  name: "card.calendar.name",
  description: "card.calendar.description",
  domains: ["calendar"],
});
