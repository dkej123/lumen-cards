import { css, html, nothing, unsafeCSS } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Pending } from "../core/controllers/pending";
import { callOrToast, entityName } from "../core/call";
import { actions, advanced, appearance, firstOf, form, nameIcon, stub } from "../core/form";
import { t } from "../core/i18n";
import { LayerController } from "../core/layer";
import { icon } from "../core/lumen-icon";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, sliderTile } from "../core/slider-tile";
import { stop } from "../core/styles";
import { requireEntity } from "../core/validate";
import { isUnavailable, type HassEntity, type HassLike } from "../hass/types";
import { stateText } from "../logic/format";

export interface SelectConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Entity whose state is the second line (e.g. the vacuum's status next to its fan-speed select). */
  secondary_entity?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

export function validateSelect(c: Partial<SelectConfig>): void {
  requireEntity(c);
}

/** Options of an input_select / select entity. */
export const selectOptions = (e?: HassEntity): string[] => (Array.isArray(e?.attributes.options) ? (e!.attributes.options as unknown[]).map(String) : []);

const MENU_W = 200;

/**
 * input_select / select: the current option on a pick button, a tap opens
 * the option list under it (in the body layer, so it floats over the dashboard). The choice
 * calls select_option; Esc, a tap outside or scrolling closes the list.
 */
export class LumenSelectCard extends LumenBaseCard<SelectConfig> {
  static properties = { ...LumenBaseCard.properties, _menu: { state: true } };
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}.opt:hover{background:var(--lumen-surface-2)}.opt[aria-selected="true"]:hover{background:var(--lumen-accent-soft)}`];
  protected static compactBelow = 200;
  /** Open list: viewport position of its anchor. */
  private _menu: { top?: number; bottom?: number; right: number; width: number; maxH: number } | null = null;
  /** The option just chosen, shown until the entity answers (or 10 s). */
  private pending = new Pending<string>(this, () => this.sel);

  private press = new SlideDrag(this, {
    enabled: () => false,
    commit: () => undefined,
    tap: () => (this._config.tap_action ? handleAction(this, this._config.tap_action, this._config.entity, "tap") : this.toggleMenu()),
    hold: () => this.holdAction(this._config, this._config.entity)(),
  });

  protected layer = new LayerController(this, () => (this._menu ? this.menu() : nothing), () => this.closeMenu(true));

  protected entityIds() {
    return [this._config.entity, this._config.secondary_entity];
  }

  protected validate(c: SelectConfig) {
    validateSelect(c);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unlisten();
  }

  private get sel() {
    return this.entity(this._config.entity);
  }

  private onScroll = (e: Event) => {
    // Scrolling inside the list itself keeps it open.
    if (e.composedPath().some((n) => (n as HTMLElement).getAttribute?.("role") === "listbox")) return;
    this.closeMenu();
  };

  private unlisten() {
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("resize", this.onScroll);
  }

  private toggleMenu() {
    if (this._menu) {
      this.closeMenu(true);
      return;
    }
    // `unknown` has no current option, but one can be chosen.
    if (!this.sel || this.sel.state === "unavailable" || !selectOptions(this.sel).length || this.preview) return;
    const pick = this.renderRoot.querySelector<HTMLElement>(".pick");
    const card = this.renderRoot.querySelector<HTMLElement>(".ltile");
    if (!pick || !card) return;
    const r = pick.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const vh = window.innerHeight;
    const width = Math.min(MENU_W, Math.max(160, cr.width));
    const want = selectOptions(this.sel).length * 44 + 12;
    const below = vh - r.bottom - 14;
    const above = r.top - 14;
    const down = below >= Math.min(want, 220) || below >= above;
    this._menu = {
      ...(down ? { top: r.bottom + 6 } : { bottom: vh - r.top + 6 }),
      right: Math.max(8, window.innerWidth - cr.right),
      width,
      maxH: Math.max(120, Math.min(want, down ? below : above)),
    };
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("resize", this.onScroll);
  }

  private closeMenu(focusPick = false) {
    if (!this._menu) return;
    this._menu = null;
    this.unlisten();
    if (focusPick) requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>(".pick")?.focus({ preventScroll: true }));
  }

  private choose(option: string) {
    const c = this._config;
    this.closeMenu(true);
    if (option === this.current()) return;
    this.haptic();
    this.pending.set(option);
    const domain = c.entity.split(".")[0] === "select" ? "select" : "input_select";
    callOrToast(this, this._hass, domain, "select_option", { option }, c.entity).then((ok) => {
      if (!ok) this.pending.clear();
    });
  }

  private current(): string | undefined {
    return this.pending.value ?? (isUnavailable(this.sel) ? undefined : this.sel?.state);
  }

  /** HA's translated option label when it has one (select entities with translations). */
  private optionLabel(option: string): string {
    const e = this.sel;
    return e && this._hass?.formatEntityState ? this._hass.formatEntityState({ ...e, state: option }, option) : option;
  }

  private menuKey = (e: KeyboardEvent) => {
    const items = [...((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(e.target as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if ((e.key === "Enter" || e.key === " ") && i >= 0) {
      e.preventDefault();
      items[i].click();
    }
  };

  private menu() {
    const m = this._menu!;
    const cur = this.current();
    const name = entityName(this._config.name, this.sel, this._config.entity);
    return html`<div @click=${() => this.closeMenu()} @pointerdown=${stop} style="position:absolute;inset:0;z-index:20"></div>
      <div role="dialog" aria-label=${name} style="position:absolute;z-index:21;${m.top !== undefined ? `top:${m.top}px` : `bottom:${m.bottom}px`};right:${m.right}px;width:${m.width}px;animation:lumenModalIn 260ms var(--lumen-ease-spring) both;transform-origin:${m.top !== undefined ? "top right" : "bottom right"}">
        <div role="listbox" aria-label=${name} @keydown=${this.menuKey} class="lumen-noscroll" style="max-height:${m.maxH}px;overflow:auto;overscroll-behavior:contain;padding:6px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface-solid);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2)">
          ${selectOptions(this.sel).map((o) => {
            const on = o === cur;
            return html`<div class="opt" role="option" tabindex=${on ? 0 : -1} aria-selected=${on} @click=${() => this.choose(o)}
              style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 10px;border-radius:12px;background:${on ? "var(--lumen-accent-soft)" : "transparent"};color:var(--lumen-text-1);font:650 14px var(--lumen-font);cursor:pointer;outline-offset:-2px">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.optionLabel(o)}</span>${on ? icon("mdi:check", "font-size:18px;color:var(--lumen-accent)") : nothing}</div>`;
          })}
        </div>
      </div>`;
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // Focus the chosen option when the list opens (the layer focuses its first focusable otherwise).
    if (changed.has("_menu") && this._menu)
      requestAnimationFrame(() => this.layer.root?.querySelector<HTMLElement>('[role="option"][aria-selected="true"], [role="option"]')?.focus({ preventScroll: true }));
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.sel;
    const una = !e || e.state === "unavailable";
    const name = entityName(c.name, e, c.entity);
    const cur = this.current();
    const open = !!this._menu;
    const sec = c.secondary_entity ? this.entity(c.secondary_entity) : undefined;
    const sub = c.secondary_entity ? stateText(this._hass, sec, sec ? sec.state : t("common.no_data")) : "";
    const value = una ? t("common.unavailable") : cur === undefined ? t("common.no_data") : this.optionLabel(cur);
    const pick = una
      ? nothing
      : html`<button class="pick" aria-haspopup="listbox" aria-expanded=${open} aria-label="${name}: ${value}" @pointerdown=${stop} @pointerup=${stop} @keydown=${stop}
          @click=${(ev: Event) => {
            ev.stopPropagation();
            this.haptic();
            this.toggleMenu();
          }}
          style="flex:none;max-width:60%;display:flex;align-items:center;gap:4px;min-height:40px;padding:0 8px 0 12px;box-sizing:border-box;border:0;border-radius:12px;background:${open ? "var(--lumen-accent-soft)" : "var(--lumen-surface-2)"};color:${open ? "var(--lumen-accent)" : "var(--lumen-text-1)"};font:700 13px var(--lumen-font);cursor:pointer;transition:background-color 250ms, color 250ms">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${value}</span>${icon(open ? "mdi:chevron-up" : "mdi:chevron-down", `flex:none;font-size:18px;color:${open ? "inherit" : "var(--lumen-text-3)"}`)}</button>`;
    return sliderTile(
      {
        title: name,
        sub: una ? t("common.unavailable") : sub,
        subColor: una ? "var(--lumen-text-3)" : undefined,
        icon: c.icon || (e?.attributes.icon as string | undefined) || "mdi:format-list-bulleted",
        iconBg: una ? "transparent" : "var(--lumen-surface-2)",
        iconFg: una ? "var(--lumen-unavailable)" : "var(--lumen-text-2)",
        fill: null,
        fillColor: "transparent",
        una,
        compact: this.compact,
        label: `${name} · ${value}`,
        keys: "Shift+Enter",
        trailing: pick,
        border: open ? "1px solid color-mix(in srgb, var(--lumen-accent) 45%, var(--lumen-border))" : undefined,
      },
      this.press,
    );
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, ["input_select", "select"], entities, fallback) ?? firstOf(hass, "input_select", firstOf(hass, "select", "input_select.example")) };
  }

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: ["input_select", "select"] } } },
      nameIcon(),
      { name: "secondary_entity", selector: { entity: {} } },
      actions(true, false),
      advanced(),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-select-card", LumenSelectCard, {
  name: "card.select.name",
  description: "card.select.description",
  domains: ["input_select", "select"],
});
