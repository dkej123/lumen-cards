import { html, nothing } from "lit";
import { handleAction } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { appearance, type Schema } from "../core/form";
import { formX } from "../core/form-extra";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { registerCard } from "../core/register";
import { glass } from "../core/styles";
import { activeIndex } from "../logic/nav";

export interface NavItem {
  /** View path (`/lovelace/rooms`, `rooms` relative to the dashboard) or a `#hash` (pop-up). */
  navigation_path: string;
  name?: string;
  icon?: string;
}

export interface NavConfig extends BaseConfig {
  items: NavItem[];
  /** bottom: fixed over the bottom edge (default); inline: a normal card in the grid. */
  position?: "bottom" | "inline";
  /** Fixed bar only on a narrow screen (phones). */
  narrow_only?: boolean;
}

const BAR_H = 68;
const GAP = 12;
let fabOffsetOwner: object | null = null;

export function validateNav(c: Partial<NavConfig>): void {
  if (c.items !== undefined && !Array.isArray(c.items)) throw new Error(t("card.nav.error.items"));
}

/** Items that can be shown (the editor adds empty ones while the user types). */
export const navItems = (c: Partial<NavConfig>): NavItem[] =>
  (Array.isArray(c.items) ? c.items : []).filter((it) => it && typeof it === "object" && typeof it.navigation_path === "string" && it.navigation_path.trim());

/**
 * Bottom navigation bar between views (catalog section 14). Fixed above the safe area in a body
 * layer (so transformed dashboard ancestors cannot move it), with a spacer in the grid so the
 * last cards scroll above it; inline in the card editor. The item matching the current URL is
 * highlighted; a tap navigates like HA's own navigate action.
 */
export class LumenNavCard extends LumenBaseCard<NavConfig> {
  protected layer = new LayerController(this, () => (this.fixed ? this.bar(true) : nothing));

  protected entityIds() {
    return [];
  }

  protected validate(c: NavConfig) {
    validateNav(c);
  }

  protected defaults(): Partial<NavConfig> {
    return { items: [] };
  }

  private onLocation = () => this.requestUpdate();

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("location-changed", this.onLocation);
    window.addEventListener("popstate", this.onLocation);
    window.addEventListener("hashchange", this.onLocation);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this.onLocation);
    window.removeEventListener("popstate", this.onLocation);
    window.removeEventListener("hashchange", this.onLocation);
    this.fabOffset(false);
  }

  /** Shown as the fixed bar (not in the editor, preview or edit mode). */
  private get fixed(): boolean {
    const c = this._config;
    if (!c || !this._hass || this.preview || this.editMode || c.position === "inline" || !navItems(c).length) return false;
    return !c.narrow_only || this.narrowScreen;
  }

  /** Floating buttons of other cards move up over the bar while it shows (unless a theme placed them). */
  private fabOffset(on: boolean) {
    const root = document.documentElement.style;
    if (on && !fabOffsetOwner && !getComputedStyle(document.documentElement).getPropertyValue("--lumen-cards-fab-bottom").trim()) {
      fabOffsetOwner = this;
      root.setProperty("--lumen-cards-fab-bottom", `${BAR_H + GAP + 12}px`);
    } else if (!on && fabOffsetOwner === this) {
      fabOffsetOwner = null;
      root.removeProperty("--lumen-cards-fab-bottom");
    }
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    this.fabOffset(this.fixed);
  }

  private go(it: NavItem) {
    this.haptic("selection");
    handleAction(this, { action: "navigate", navigation_path: it.navigation_path }, undefined, "tap");
  }

  private bar(floating: boolean) {
    const items = navItems(this._config);
    const active = activeIndex(items, window.location);
    return html`<nav aria-label=${t("card.nav.name")} style="${floating ? `position:absolute;left:50%;bottom:calc(${GAP}px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(calc(100% - 24px), 520px);animation:lumenFadeIn 240ms both;` : ""}display:flex;justify-content:space-around;align-items:center;height:${BAR_H}px;padding:0 6px;box-sizing:border-box;border-radius:24px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};box-shadow:var(--lumen-shadow-2);font-family:var(--lumen-font);color:var(--lumen-text-1)">
      ${items.map((it, i) => {
        const on = i === active;
        const label = it.name || it.navigation_path;
        return html`<a href=${it.navigation_path} aria-current=${on ? "page" : nothing} class="navi"
          @click=${(e: MouseEvent) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            this.go(it);
          }}
          style="flex:1;min-width:0;max-width:96px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0;color:${on ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};font:700 11px var(--lumen-font);text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:16px">
          <span style="width:52px;height:30px;border-radius:15px;display:grid;place-items:center;font-size:20px;background:${on ? "var(--lumen-accent-soft)" : "transparent"};transition:background-color 300ms">${icon(it.icon || "mdi:circle-medium", "display:block")}</span>
          <span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
        </a>`;
      })}
    </nav>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    if (!navItems(c).length) return this.preview || this.editMode ? html`<div style="padding:16px;border-radius:20px;border:1px dashed var(--lumen-border-strong);font-size:13px;font-weight:650;color:var(--lumen-text-3)">${t("card.nav.empty")}</div>` : nothing;
    if (this.fixed) return html`<div aria-hidden="true" style="height:${BAR_H + GAP}px"></div>`;
    if (c.position !== "inline" && c.narrow_only && !this.narrowScreen && !this.preview && !this.editMode) return nothing;
    return this.bar(false);
  }

  getCardSize() {
    return 2;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  static getStubConfig() {
    return {
      items: [
        { navigation_path: "home", name: "Home", icon: "mdi:home-variant" },
        { navigation_path: "rooms", name: "Rooms", icon: "mdi:sofa-outline" },
        { navigation_path: "climate", name: "Climate", icon: "mdi:thermometer" },
        { navigation_path: "cameras", name: "Cameras", icon: "mdi:cctv" },
      ],
    };
  }

  static getConfigForm() {
    const items: Schema = {
      name: "items",
      selector: {
        object: {
          multiple: true,
          label_field: "name",
          description_field: "navigation_path",
          fields: {
            navigation_path: { label: t("editor.navigation_path"), required: true, selector: { navigation: {} } },
            name: { label: t("editor.name"), selector: { text: {} } },
            icon: { label: t("editor.icon"), selector: { icon: {} } },
          },
        },
      },
    };
    return formX([
      items,
      {
        name: "",
        type: "grid",
        flatten: true,
        schema: [
          { name: "position", selector: { select: { mode: "dropdown", options: [{ value: "bottom", label: t("editor.nav_position.bottom") }, { value: "inline", label: t("editor.nav_position.inline") }] } } },
          { name: "narrow_only", default: false, selector: { boolean: {} } },
        ],
      },
      appearance({ layout: false, effects: false }),
    ]);
  }
}

registerCard("lumen-nav-card", LumenNavCard, {
  name: "card.nav.name",
  description: "card.nav.description",
});
