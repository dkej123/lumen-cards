import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { icon } from "../core/lumen-icon";
import { advanced, appearance, fabFields, form } from "../core/form";
import { t } from "../core/i18n";
import { FAB_MAIN, FAB_ORDER, FabController, fabInset, fabSideOf, LayerController } from "../core/layer";
import { WFX } from "../core/parts";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { glass } from "../core/styles";
import { toast } from "../core/toast";
import type { HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { LightsController, type LightItem } from "../lights/controller";
import { RUN } from "../logic/run";

/** Runs something: scenes, scripts, buttons (default by domain) or any configured action. */
export interface ActionChip {
  type: "action";
  entity: string;
  name?: string;
  icon?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

/** Compact light pill: tap toggles, drag dims, hold opens brightness and colour. */
export interface LightChip extends LightItem {
  type: "light";
}

export type Chip = ActionChip | LightChip;

export interface ChipsConfig extends BaseConfig {
  chips: Chip[];
  alignment?: "start" | "center" | "end" | "justify";
  /** Action chips become a floating speed-dial button. */
  fab?: boolean;
  /** …only on narrow screens (default); off = always. */
  fab_narrow_only?: boolean;
  /** Heading of the speed-dial list. Default "Scenes". */
  title?: string;
  /** Icon of the floating button (default mdi:palette-outline). */
  fab_icon?: string;
}

const TYPES = ["action", "light"];
const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end", justify: "space-between" };

/** Structure the editor cannot show (it falls back to YAML); an empty list is fine while editing. */
export function assertChips(c: Partial<ChipsConfig>): void {
  if (c.chips !== undefined && !Array.isArray(c.chips)) throw new Error(t("card.chips.error.list"));
}

/**
 * The active action chip: the scene activated last (a scene's state is the time of its last
 * activation), only when it is the newest of the chips' scenes. Not for scripts or buttons.
 */
export function activeScene(chips: Chip[], states: Record<string, { state: string } | undefined>): string | null {
  let best: string | null = null;
  let at = 0;
  for (const x of chips) {
    if (x.type !== "action" || !x.entity.startsWith("scene.")) continue;
    const ms = Date.parse(states[x.entity]?.state ?? "");
    if (Number.isFinite(ms) && ms > at) {
      at = ms;
      best = x.entity;
    }
  }
  return best;
}

export function validateChips(c: Partial<ChipsConfig>): void {
  assertChips(c);
  (c.chips ?? []).forEach((x, i) => {
    if (!x || !TYPES.includes(x.type)) throw new Error(t("card.chips.error.type", { i }));
    if (!x.entity) throw new Error(t("card.chips.error.entity", { i }));
  });
}

/**
 * A row of small chips (the community "chips card" pattern): action chips (scenes, scripts…,
 * optionally as a floating speed-dial button) and the light pills of the design rooms.
 */
export class LumenChipsCard extends LumenBaseCard<ChipsConfig> {
  protected static grid = GRID.full;
  static properties = { ...LumenBaseCard.properties, _fab: { state: true }, _pulse: { state: true } };
  private _fab = false;
  private _pulse: string | null = null;
  private pulseTimer?: number;
  private fabTimer?: number;
  private lights = new LightsController(this);

  protected layer = new LayerController(
    this,
    () => (this.preview || !this.useFab ? nothing : this.renderFab()),
    () => (this._fab = false),
  );

  lightItems(): LightItem[] {
    return this.of("light");
  }

  protected entityIds() {
    return (this._config.chips ?? []).flatMap((x) => (x.type === "light" ? [x.entity, x.power_entity] : [x.entity]));
  }

  protected validate(c: ChipsConfig) {
    validateChips(c);
  }

  private of<T extends Chip["type"]>(type: T) {
    return (this._config.chips ?? []).filter((x) => x.type === type) as Extract<Chip, { type: T }>[];
  }

  private floating = new FabController(this, FAB_ORDER.scenes, () => this.useFab, () => fabSideOf(this._config));

  private get useFab() {
    const c = this._config;
    return !!c && !!this._hass && !!c.fab && (c.fab_narrow_only === false || this.narrowScreen) && !this.preview && this.of("action").length > 0;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.pulseTimer);
    window.clearTimeout(this.fabTimer);
  }

  // ---------------------------------------------------------------- action chips

  private chipName(s: ActionChip) {
    return entityName(s.name, this.entity(s.entity), s.entity);
  }

  private chipIcon(s: ActionChip) {
    return s.icon || this.entity(s.entity)?.attributes.icon || "mdi:palette";
  }

  private run(s: ActionChip) {
    this._pulse = s.entity;
    window.clearTimeout(this.pulseTimer);
    this.pulseTimer = window.setTimeout(() => (this._pulse = null), 600);
    if (s.tap_action) {
      handleAction(this, s.tap_action, s.entity, "tap");
      return;
    }
    const domain = s.entity.split(".")[0];
    const [d, service] = RUN[domain] ?? ["homeassistant", "toggle"];
    this._hass?.callService(d, service, {}, { entity_id: s.entity }).catch((err: Error) =>
      toast(this, { icon: "mdi:alert-circle", tone: "danger", title: t("common.error"), text: err.message ?? String(err) }),
    );
  }

  private chipHandlers(s: ActionChip) {
    return this.actions(`chip:${s.entity}`, s, s.entity, { tap: () => this.run(s) });
  }

  private get active(): string | null {
    return this._hass ? activeScene(this._config.chips ?? [], this._hass.states) : null;
  }

  /** Strong fill of the active chip and the FAB: inverted by default, the accent when accent_color is set. */
  private get strong() {
    return this._config.accent_color ? { bg: "var(--lumen-accent)", fg: "var(--lumen-on-accent)" } : { bg: "var(--lumen-text-1)", fg: "var(--lumen-bg)" };
  }

  /** Catalog chip: 44 px pill, glyph 18 + name; the active scene is inverted (text-1 background). */
  private actionChip(s: ActionChip, active: boolean) {
    const off = isUnavailable(this.entity(s.entity));
    const strong = this.strong;
    return html`<div data-fx class="press" ${pressable(off ? undefined : this.chipHandlers(s))} aria-disabled=${off} aria-pressed=${active} aria-label=${this.chipName(s)}
      style="display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px 0 12px;box-sizing:border-box;border-radius:999px;border:${active ? "1px solid transparent" : "1px solid var(--lumen-border)"};background:${active ? strong.bg : "var(--lumen-surface)"};color:${active ? strong.fg : "var(--lumen-text-1)"};box-shadow:${active ? "var(--lumen-shadow-1)" : "none"};font:700 13px var(--lumen-font);white-space:nowrap;cursor:${off ? "not-allowed" : "pointer"};opacity:${off ? 0.5 : 1};user-select:none;touch-action:pan-y;${active ? "" : glass};transition:background-color 400ms, color 400ms, border-color 400ms, transform 220ms var(--lumen-ease-spring);animation:${this._pulse === s.entity ? "lumenPop 560ms var(--lumen-ease-bounce)" : "none"}">${WFX}
      ${icon(this.chipIcon(s), "font-size:18px")}${this.chipName(s)}
    </div>`;
  }

  /** Floating button (catalog FAB): 64 px, inverted; tap opens the list with its heading above it. */
  private renderFab() {
    const open = this._fab;
    const items = this.of("action");
    const active = this.active;
    const { side, bottom, edge } = this.floating.place();
    const title = this._config.title || t("card.chips.scenes");
    return html`
      <div @click=${() => (this._fab = false)} style="position:absolute;inset:0;z-index:6;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:${open ? 1 : 0};pointer-events:${open ? "auto" : "none"};transition:opacity 320ms var(--lumen-ease-out)"></div>
      <div role=${open ? "dialog" : nothing} aria-label=${title} style="position:absolute;${side}:calc(${fabInset(side)} - 4px);bottom:calc(${bottom} + ${FAB_MAIN + 12}px);z-index:7;width:200px;max-height:calc(100% - ${FAB_MAIN + 60}px);overflow:auto;padding:10px;box-sizing:border-box;border-radius:22px;background:var(--lumen-surface-solid);box-shadow:var(--lumen-shadow-2);display:flex;flex-direction:column;gap:2px;transform-origin:bottom ${side};transform:${open ? "none" : "translateY(16px) scale(.92)"};opacity:${open ? 1 : 0};pointer-events:${open ? "auto" : "none"};visibility:${open ? "visible" : "hidden"};transition:transform 460ms var(--lumen-ease-spring), opacity 220ms var(--lumen-ease-out), visibility 0s ${open ? "0s" : "460ms"}">
        <div style="padding:4px 8px 6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lumen-text-3)">${title}</div>
        ${items.map((s) => {
          const on = s.entity === active;
          return html`<button @click=${() => {
            this.haptic();
            this.run(s);
            window.clearTimeout(this.fabTimer);
            this.fabTimer = window.setTimeout(() => (this._fab = false), 450);
          }} aria-pressed=${on} style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 10px;border:0;border-radius:14px;background:${on ? "var(--lumen-accent-soft)" : "transparent"};color:${on ? "var(--lumen-accent)" : "var(--lumen-text-1)"};font:700 13px var(--lumen-font);text-align:left;cursor:pointer;transition:background-color 300ms">
            ${icon(this.chipIcon(s), `font-size:18px;flex:none;animation:${this._pulse === s.entity ? "lumenPop 560ms var(--lumen-ease-bounce)" : "none"}`)}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this.chipName(s)}</span>
          </button>`;
        })}
      </div>
      <button class="acfab" @click=${() => {
        this.haptic();
        this._fab = !open;
      }} aria-label=${title} aria-expanded=${open} style="position:absolute;${edge};bottom:${bottom};z-index:8;width:${FAB_MAIN}px;height:${FAB_MAIN}px;padding:0;border-radius:50%;border:0;background:${this.strong.bg};color:${this.strong.fg};font-size:27px;cursor:pointer;pointer-events:auto;box-shadow:var(--lumen-shadow-2);display:grid;place-items:center;transition:transform 260ms var(--lumen-ease-spring)">
        <span style="position:absolute;inset:0;display:grid;place-items:center;transform:${open ? "rotate(90deg)" : "none"};transition:transform 460ms var(--lumen-ease-spring)">
          ${icon(this._config.fab_icon || "mdi:palette-outline", `position:absolute;opacity:${open ? 0 : 1};transition:opacity 200ms`)}
          ${icon("mdi:close", `position:absolute;opacity:${open ? 1 : 0};transition:opacity 200ms`)}
        </span>
      </button>`;
  }

  // ---------------------------------------------------------------- render

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // Nothing in the row (all chips in the FAB): take no space – except while the dashboard is
    // being edited, so the card can still be found. Not the `hidden` attribute: HA would take the
    // card out of the page, and its FAB with it.
    this.style.display = this._config && !this.editMode && !this.preview && this.shown().length === 0 ? "none" : "";
  }

  private shown(): Chip[] {
    const fab = this.useFab;
    return (this._config.chips ?? []).filter((x) => x.type !== "action" || !fab);
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const compact = this.compact;
    const shown = this.shown();
    if (!shown.length) {
      return this.editMode || this.preview
        ? html`<div style="padding:10px 14px;border-radius:14px;border:1.5px dashed var(--lumen-border-strong);font-size:12px;font-weight:650;color:var(--lumen-text-3)">${t("card.chips.in_fab")}</div>`
        : nothing;
    }
    const onlyActions = shown.every((x) => x.type === "action");
    const active = this.active;
    const items = shown.map((x) => (x.type === "action" ? this.actionChip(x, x.entity === active) : this.lights.pill(x, compact)));
    // Colour presets of a light pill cover the whole row: one pill is too narrow for four.
    const ct = this.of("light").find((i) => i.entity === this.lights.ctOpen && this.lights.light(i).on && this.lights.light(i).ct);
    const gap = onlyActions ? 8 : compact ? 6 : 8;
    const justify = JUSTIFY[c.alignment ?? "start"] ?? "flex-start";
    return html`<div style="position:relative;display:flex;flex-wrap:wrap;justify-content:${justify};gap:${gap}px">${items}${ct ? this.lights.ctOverlay(ct.entity, this.lights.light(ct).k, compact, true) : nothing}</div>`;
  }

  static getStubConfig(hass?: HassLike) {
    const scenes = Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("scene.")).slice(0, 3);
    return { chips: (scenes.length ? scenes : ["scene.example"]).map((entity) => ({ type: "action", entity })) };
  }

  static getConfigForm() {
    const types = [
      { value: "action", label: t("card.chips.type.action") },
      { value: "light", label: t("card.chips.type.light") },
    ];
    return form(
      [
        {
          name: "chips",
          selector: {
            object: {
              multiple: true,
              label_field: "name",
              description_field: "entity",
              fields: {
                type: { label: t("editor.type"), required: true, selector: { select: { mode: "dropdown", options: types } } },
                entity: { label: t("editor.entity"), required: true, selector: { entity: {} } },
                name: { label: t("editor.name"), selector: { text: {} } },
                icon: { label: t("editor.icon"), selector: { icon: {} } },
                tap_action: { label: t("card.chips.tap_action"), selector: { ui_action: {} } },
                power_entity: { label: t("card.chips.power_entity"), selector: { entity: { domain: ["switch", "light", "input_boolean"] } } },
              },
            },
          },
        },
        {
          name: "alignment",
          selector: {
            select: {
              mode: "dropdown",
              options: [
                ["start", "align.start"],
                ["center", "align.center"],
                ["end", "align.end"],
                ["justify", "align.justify"],
              ].map(([value, label]) => ({ value, label: t(label) })),
            },
          },
        },
        {
          name: "",
          type: "expandable",
          flatten: true,
          title: t("editor.fab"),
          icon: "mdi:gesture-tap-button",
          schema: [...fabFields(), { name: "", type: "grid", flatten: true, schema: [{ name: "fab_icon", selector: { icon: {} } }, { name: "title", selector: { text: {} } }] }],
        },
        advanced(),
        appearance({ layout: "screen" }),
      ],
      (c) => assertChips(c as Partial<ChipsConfig>),
    );
  }
}

registerCard("lumen-chips-card", LumenChipsCard, {
  name: "card.chips.name",
  description: "card.chips.description",
});
