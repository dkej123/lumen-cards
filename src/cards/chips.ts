import { html, nothing } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { icon } from "../core/lumen-icon";
import { advanced, appearance, fabFields, form } from "../core/form";
import { t } from "../core/i18n";
import { fabBottom, fabSlot, LayerController, releaseFab } from "../core/layer";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { glass } from "../core/styles";
import { toast } from "../core/toast";
import type { HassLike } from "../hass/types";
import { isUnavailable } from "../hass/types";
import { LightsController, type LightItem } from "../lights/controller";

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
  /** Heading above the speed-dial items. Default "Scenes". */
  title?: string;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;
const TYPES = ["action", "light"];
/** Default tap of an action chip by domain. */
const RUN: Record<string, [string, string]> = {
  scene: ["scene", "turn_on"],
  script: ["script", "turn_on"],
  button: ["button", "press"],
  input_button: ["input_button", "press"],
  automation: ["automation", "trigger"],
};
const JUSTIFY = { start: "flex-start", center: "center", end: "flex-end", justify: "space-between" };

/** Structure the editor cannot show (it falls back to YAML); an empty list is fine while editing. */
export function assertChips(c: Partial<ChipsConfig>): void {
  if (c.chips !== undefined && !Array.isArray(c.chips)) throw new Error(t("card.chips.error.list"));
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
  static properties = { ...LumenBaseCard.properties, _fab: { state: true }, _pulse: { state: true } };
  private _fab = false;
  private _pulse: string | null = null;
  private pulseTimer?: number;
  private fabTimer?: number;
  private lights = new LightsController(this);
  private presses = new Presses((type) => this.haptic(type));

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

  private get useFab() {
    const c = this._config;
    return !!c && !!this._hass && !!c.fab && (c.fab_narrow_only === false || this.narrowScreen) && !this.preview && this.of("action").length > 0;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
    window.clearTimeout(this.pulseTimer);
    window.clearTimeout(this.fabTimer);
    releaseFab(this);
  }

  // ---------------------------------------------------------------- action chips

  private chipName(s: ActionChip) {
    return s.name || this.entity(s.entity)?.attributes.friendly_name || s.entity;
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
    return this.presses.handlers(
      `chip:${s.entity}`,
      () => this.run(s),
      () => (s.hold_action ? handleAction(this, s.hold_action, s.entity, "hold") : this.moreInfo(s.entity)),
      s.double_tap_action ? () => handleAction(this, s.double_tap_action, s.entity, "double_tap") : undefined,
    );
  }

  private actionChip(s: ActionChip) {
    const off = isUnavailable(this.entity(s.entity));
    return html`<div data-fx class="press" ${pressable(off ? undefined : this.chipHandlers(s))} aria-disabled=${off} aria-label=${this.chipName(s)}
      style="display:flex;align-items:center;gap:10px;min-height:48px;padding:4px 14px 4px 4px;box-sizing:border-box;border-radius:999px;border:1px solid var(--lumen-border);background:var(--lumen-surface);color:var(--lumen-text-1);font-family:inherit;cursor:${off ? "not-allowed" : "pointer"};opacity:${off ? 0.5 : 1};user-select:none;touch-action:pan-y;${glass};transition:background-color 400ms, border-color 400ms, transform 220ms var(--lumen-ease-spring);animation:${this._pulse === s.entity ? "lumenPop 560ms var(--lumen-ease-bounce)" : "none"}">${WFX}
      <span style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:19px;background:var(--lumen-surface-2);color:var(--lumen-text-2)">${icon(this.chipIcon(s))}</span>
      <span style="font-size:13px;font-weight:700;white-space:nowrap">${this.chipName(s)}</span>
    </div>`;
  }

  private renderFab() {
    const open = this._fab;
    const items = this.of("action");
    const bottom = fabBottom(fabSlot(this));
    return html`
      <div @click=${() => (this._fab = false)} style="position:absolute;inset:0;z-index:6;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:${open ? 1 : 0};pointer-events:${open ? "auto" : "none"};transition:opacity 320ms var(--lumen-ease-out)"></div>
      <div role=${open ? "dialog" : nothing} aria-label=${this._config.title || t("card.chips.scenes")} style="position:absolute;right:16px;bottom:calc(${bottom} + 78px);z-index:7;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:${open ? "auto" : "none"};visibility:${open ? "visible" : "hidden"};transition:visibility 0s ${open ? "0s" : "560ms"}">
        <div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;padding-right:8px;opacity:${open ? 1 : 0};transition:opacity 300ms;text-shadow:0 1px 8px rgba(0,0,0,.35)">${this._config.title || t("card.chips.scenes")}</div>
        ${items.map(
          (s, i) => html`<button @click=${() => {
            this.haptic();
            this.run(s);
            window.clearTimeout(this.fabTimer);
            this.fabTimer = window.setTimeout(() => (this._fab = false), 450);
          }} style="display:flex;align-items:center;gap:10px;min-height:52px;padding:5px 16px 5px 5px;border-radius:999px;border:1px solid var(--lumen-border);background:var(--lumen-surface-solid);color:var(--lumen-text-1);font-family:inherit;cursor:pointer;box-shadow:var(--lumen-shadow-2);transform:${open ? "translateY(0) scale(1)" : "translateY(22px) scale(.6)"};opacity:${open ? 1 : 0};transform-origin:right center;transition:transform 560ms var(--lumen-ease-spring), opacity 260ms var(--lumen-ease-out);transition-delay:${(items.length - 1 - i) * 45}ms">
            <span style="width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:21px;background:var(--lumen-surface-2);color:var(--lumen-text-2);animation:${this._pulse === s.entity ? "lumenPop 560ms var(--lumen-ease-bounce)" : "none"}">${icon(this.chipIcon(s))}</span>
            <span style="font-size:14px;font-weight:700;white-space:nowrap">${this.chipName(s)}</span>
          </button>`,
        )}
      </div>
      <button class="press" @click=${() => {
        this.haptic();
        this._fab = !open;
      }} aria-label=${this._config.title || t("card.chips.scenes")} aria-expanded=${open} style="position:absolute;right:16px;bottom:${bottom};z-index:8;width:64px;height:64px;padding:0;border-radius:50%;border:0;background:var(--lumen-accent);color:var(--lumen-on-accent);font-size:28px;cursor:pointer;pointer-events:auto;box-shadow:0 14px 34px -10px color-mix(in srgb, var(--lumen-accent) 75%, transparent), var(--lumen-shadow-1);transition:transform 260ms var(--lumen-ease-spring)">
        <span style="position:absolute;inset:0;opacity:${open ? 0 : 1};transition:opacity 300ms;pointer-events:none"><span style="position:absolute;inset:0;border-radius:50%;border:2px solid var(--lumen-accent);animation:lumenHalo 3.2s var(--lumen-ease-out) infinite"></span></span>
        <span style="position:absolute;inset:0;display:grid;place-items:center;transform:${open ? "rotate(135deg)" : "rotate(0deg)"};transition:transform 560ms var(--lumen-ease-spring)">
          ${icon("mdi:creation", `position:absolute;opacity:${open ? 0 : 1};transition:opacity 200ms;animation:lumenTwinkle 4.5s ease-in-out infinite`)}
          ${icon("mdi:plus", `position:absolute;font-size:30px;opacity:${open ? 1 : 0};transition:opacity 200ms`)}
        </span>
      </button>`;
  }

  // ---------------------------------------------------------------- render

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (!this.useFab) releaseFab(this);
    // Nothing in the row (all chips in the FAB): take no space – except while the dashboard is
    // being edited, so the card can still be found. Not the `hidden` attribute: HA would take the
    // card out of the page, and its FAB with it.
    this.style.display = this._config && !this.editMode && !this.preview && this.shown().length === 0 ? "none" : "";
  }

  private shown(): Chip[] {
    const fab = this.useFab;
    return (this._config.chips ?? []).filter((x) => x.type !== "action" || !fab);
  }

  render() {
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
    const items = shown.map((x) => (x.type === "action" ? this.actionChip(x) : this.lights.pill(x, compact)));
    // Colour presets of a light pill cover the whole row: one pill is too narrow for four.
    const ct = this.of("light").find((i) => i.entity === this.lights.ctOpen && this.lights.light(i).on && this.lights.light(i).ct);
    const gap = onlyActions ? 10 : compact ? 6 : 8;
    const justify = JUSTIFY[c.alignment ?? "start"] ?? "flex-start";
    return html`<div style="position:relative;display:flex;flex-wrap:wrap;justify-content:${justify};gap:${gap}px">${items}${ct ? this.lights.ctOverlay(ct.entity, this.lights.light(ct).k, compact, true) : nothing}</div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: "full", rows: "auto" };
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
          schema: [...fabFields(), { name: "title", selector: { text: {} } }],
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
