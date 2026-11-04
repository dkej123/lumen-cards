import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { advanced, appearance, form } from "../core/form";
import { t } from "../core/i18n";
import { activate } from "../core/press";
import { registerCard } from "../core/register";
import { listOf } from "../core/validate";
import { temp } from "../logic/format";
import { sensorValue } from "./sensor";

/** A value next to the title (HA heading-card badge): an entity's state or one of its attributes. */
export interface TitleBadge {
  entity: string;
  /** "state" (default) or an attribute name. */
  state_content?: string;
  /** Text before the value ("TV thermostat"). */
  name?: string;
}

export interface TitleConfig extends BaseConfig {
  title?: string;
  /**
   * overline: small caps label; section: large section title (small label when compact);
   * room: room header with the values on the right.
   */
  heading_style?: "overline" | "section" | "room";
  /** Values after the title, joined with " · ". */
  badges?: (TitleBadge | string)[];
  /** Tapping the title: more-info of this entity (with a chevron) or the tap action. */
  entity?: string;
  tap_action?: ActionConfig;
}

/** Structure the editor cannot show; an empty title is fine while editing. */
export function assertTitle(c: Partial<TitleConfig>): void {
  if (c.badges !== undefined && !Array.isArray(c.badges)) throw new Error(t("card.title.error.list"));
}

export function validateTitle(c: Partial<TitleConfig>): void {
  if (c.badges !== undefined && !Array.isArray(c.badges)) throw new Error(t("card.title.error.list"));
  (c.badges ?? []).forEach((x, i) => {
    if (!x || (typeof x !== "string" && !x.entity)) throw new Error(t("card.title.error.entity", { i }));
  });
}

const OVERLINE = "font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)";

/**
 * Section headings (overline, section title, room header) – the community pattern of a title card with entity values.
 */
export class LumenTitleCard extends LumenBaseCard<TitleConfig> {
  protected static grid = GRID.full;
  protected static skeletonHeight = 0;
  protected entityIds() {
    return [...this.items().map((x) => x.entity), this._config.entity];
  }

  protected validate(c: TitleConfig) {
    validateTitle(c);
  }

  private items(): TitleBadge[] {
    return listOf<TitleBadge | string>(this._config.badges).map((x) => (typeof x === "string" ? { entity: x } : x));
  }

  private meta(): string {
    return this.items()
      .map((x) => {
        const e = this.entity(x.entity);
        const attr = x.state_content && x.state_content !== "state" ? x.state_content : undefined;
        const v = attr ? (e?.attributes[attr] === undefined ? null : attr.includes("temperature") ? temp(e?.attributes[attr]) : String(e?.attributes[attr])) : sensorValue(e, this._hass);
        return v === null ? null : x.name ? `${x.name} ${v}` : v;
      })
      .filter((v) => v !== null)
      .join(" · ");
  }

  private get tappable() {
    return !!(this._config.entity || this._config.tap_action);
  }

  private tap = () => {
    const c = this._config;
    this.haptic();
    if (c.tap_action) handleAction(this, c.tap_action, c.entity);
    else if (c.entity) this.moreInfo(c.entity);
  };

  protected renderCard() {
    if (!this._config) return nothing;
    const c = this._config;
    const mobile = this.compact;
    const meta = this._hass ? this.meta() : "";
    const a = this.tappable ? activate(this.tap) : undefined;
    const cursor = a ? "cursor:pointer;" : "";
    const title = c.title ?? "";
    const style = c.heading_style ?? "overline";
    if (style === "room") {
      return html`<div role=${a ? "button" : "heading"} aria-level=${a ? nothing : 3} tabindex=${a ? 0 : nothing} @click=${a?.click} @keydown=${a?.key} style="display:flex;align-items:center;gap:6px;min-height:${mobile ? 24 : 28}px;padding:0 ${mobile ? 2 : 4}px;min-width:0;${cursor}">
        <span style="min-width:0;font-size:${mobile ? 13 : 14}px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>
        ${c.entity ? icon("mdi:chevron-right", "flex:none;font-size:16px;color:var(--lumen-text-3)") : nothing}
        <span style="margin-left:auto;flex:none;font-size:${mobile ? 12 : 13}px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${meta}</span>
      </div>`;
    }
    if (style === "section" && !mobile) {
      return html`<div role=${a ? "button" : "heading"} aria-level=${a ? nothing : 2} tabindex=${a ? 0 : nothing} @click=${a?.click} @keydown=${a?.key} style="display:flex;align-items:center;gap:12px;min-height:48px;${cursor}"><div style="display:flex;align-items:baseline;gap:10px;margin-right:auto;min-width:0"><span style="font-size:22px;font-weight:750;letter-spacing:-0.025em">${title}</span>${meta
        ? html`<span style="font-size:13px;font-weight:600;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${meta}</span>`
        : nothing}</div></div>`;
    }
    if (style === "section") {
      return html`<div role=${a ? "button" : "heading"} aria-level=${a ? nothing : 2} tabindex=${a ? 0 : nothing} @click=${a?.click} @keydown=${a?.key} style="display:flex;align-items:center;gap:10px;min-height:20px;padding:0 2px;margin-bottom:-2px;${cursor}"><div style="display:flex;align-items:baseline;gap:8px;min-width:0;margin-right:auto;white-space:nowrap"><span style="${OVERLINE}">${title}</span>${meta
        ? html`<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:600;color:var(--lumen-text-3);font-variant-numeric:tabular-nums">${meta}</span>`
        : nothing}</div></div>`;
    }
    return html`<div role=${a ? "button" : "heading"} aria-level=${a ? nothing : 2} tabindex=${a ? 0 : nothing} @click=${a?.click} @keydown=${a?.key} style="${OVERLINE};padding:0 2px;${cursor}">${title}${meta ? html`<span style="margin-left:8px;letter-spacing:0;text-transform:none;font-weight:600">${meta}</span>` : nothing}</div>`;
  }

  static getStubConfig() {
    return { title: t("card.title.stub"), heading_style: "overline" };
  }

  static getConfigForm() {
    return form(
      [
        { name: "title", selector: { text: {} } },
        {
          name: "heading_style",
          default: "overline",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                { value: "overline", label: t("card.title.style.overline") },
                { value: "section", label: t("card.title.name") },
                { value: "room", label: t("card.title.style.room") },
              ],
            },
          },
        },
        {
          name: "badges",
          selector: {
            object: {
              multiple: true,
              label_field: "name",
              description_field: "entity",
              fields: {
                entity: { label: t("editor.entity"), required: true, selector: { entity: {} } },
                state_content: { label: t("card.title.state_content"), selector: { text: {} } },
                name: { label: t("card.title.badge_name"), selector: { text: {} } },
              },
            },
          },
        },
        { name: "entity", selector: { entity: {} } },
        { name: "tap_action", selector: { ui_action: {} } },
        advanced([], { haptics: false }),
        appearance({ effects: false, layout: "screen", accent: false }),
      ],
      (c) => assertTitle(c as Partial<TitleConfig>),
      (c) => (Array.isArray(c.badges) ? { ...c, badges: c.badges.map((x) => (typeof x === "string" ? { entity: x } : x)) } : c),
    );
  }
}

registerCard("lumen-title-card", LumenTitleCard, {
  name: "card.title.name",
  description: "card.title.description",
});

