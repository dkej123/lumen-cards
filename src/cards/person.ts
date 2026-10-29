import { html, nothing } from "lit";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Presses, pressable } from "../core/press";
import { registerCard } from "../core/register";
import { colorOr, glass } from "../core/styles";
import type { HassEntity, HassLike } from "../hass/types";
import { presence } from "../logic/presence";

export interface PersonConfig extends BaseConfig {
  /** person.* – zone shown when away; picture and name by default. */
  entity?: string;
  /** Presence sensor (binary_sensor on = home, e.g. BLE beacon, or a device_tracker); default: the person's home zone. */
  presence_entity?: string;
  name?: string;
  /** Picture URL; default: the person's entity_picture. */
  picture?: string;
  /** Background behind the initial (no picture): HA colour name or hex. */
  avatar_color?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  show_name?: boolean;
  show_status?: boolean;
}

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

export function validatePerson(c: Partial<PersonConfig>): void {
  if (!c.entity && !c.presence_entity) throw new Error(t("card.person.error.entity"));
}

/** One household member: avatar, presence dot with a pulse, since when. */
export class LumenPersonCard extends LumenBaseCard<PersonConfig> {
  protected static compactBelow = 240;
  private failed = false;
  private presses = new Presses((type) => this.haptic(type));
  private subs = new SubButtons(this);

  protected entityIds() {
    return [this._config.entity, this._config.presence_entity, ...(this._config.sub_buttons ?? []).map((b) => b.entity)];
  }

  protected validate(c: PersonConfig) {
    validatePerson(c);
  }

  setConfig(config: PersonConfig): void {
    super.setConfig(config);
    this.failed = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.every(30_000, () => this.requestUpdate());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.presses.dispose();
    this.subs.dispose();
  }

  /** The presence sensor, or the person's / tracker's own state, as on/off (home = on). */
  private sensor(): HassEntity | undefined {
    const c = this._config;
    const e = this.entity(c.presence_entity ?? c.entity);
    if (!e || ["unknown", "unavailable"].includes(e.state) || e.entity_id.startsWith("binary_sensor.")) return e;
    return { ...e, state: e.state === "home" ? "on" : "off" };
  }

  private avatar(name: string, size: number, home: boolean, fontSize?: number) {
    const c = this._config;
    const src = c.picture || this.entity(c.entity)?.attributes.entity_picture;
    const failed = !src || this.failed;
    return html`<div style="width:${size}px;height:${size}px;${fontSize ? `font-size:${fontSize}px;` : ""}border-radius:50%;overflow:hidden;background:${colorOr(c.avatar_color, "#ffdfbf")};display:grid;place-items:center;font-weight:800;color:#3A2A1A;filter:${home ? "none" : "saturate(.35) opacity(.85)"};transition:filter 600ms">
      ${failed
        ? html`<span>${name[0] ?? "?"}</span>`
        : html`<img src=${src} alt="" style="width:100%;height:100%;object-fit:cover" @error=${() => {
            this.failed = true;
            this.requestUpdate();
          }} />`}
    </div>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const mobile = this.compact;
    const key = c.entity ?? c.presence_entity ?? "";
    const name = c.name || this.entity(c.entity)?.attributes.friendly_name || key;
    const s = presence(this.sensor(), this.entity(c.entity), Date.now());
    const dot = s.unknown ? "var(--lumen-warning)" : s.home ? "var(--lumen-ok)" : "var(--lumen-unavailable)";
    const size = mobile ? 26 : 44;
    const d = mobile ? 10 : 14;
    const off = mobile ? -2 : -1;
    const h = this.presses.handlers(
      `person:${key}`,
      () => (c.tap_action ? handleAction(this, c.tap_action, key) : this.moreInfo(key)),
      () => (c.hold_action ? handleAction(this, c.hold_action, key, "hold") : this.moreInfo(key)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, key, "double_tap") : undefined,
    );
    return html`<div data-fx ${pressable(h)} class="press" aria-label="${name} · ${s.status}"
      style="display:flex;align-items:center;${mobile ? "gap:7px;height:36px;padding:0 10px 0 5px;border-radius:14px" : "gap:12px;min-height:64px;padding:10px 14px 10px 10px;border-radius:20px"};box-sizing:border-box;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};cursor:pointer;min-width:0;user-select:none;touch-action:pan-y;transition:transform 220ms var(--lumen-ease-spring)">${WFX}
      <div style="position:relative;width:${size}px;height:${size}px;flex:none">
        ${this.avatar(name, size, s.home, mobile ? 12 : undefined)}
        <span style="position:absolute;right:${off}px;bottom:${off}px;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${dot};border:${mobile ? 2 : 2.5}px solid var(--lumen-surface-solid)">
          ${s.home && !s.unknown ? html`<span style="position:absolute;inset:-${mobile ? 2 : 2.5}px;border-radius:50%;background:color-mix(in srgb,var(--lumen-ok) 55%,transparent);animation:lumenDotRing 2.4s ease-out infinite;pointer-events:none"></span>` : nothing}
        </span>
      </div>
      ${mobile
        ? html`<div style="min-width:0;display:flex;flex-direction:column;white-space:nowrap">${c.show_name !== false ? html`<span style="font-size:11px;font-weight:700;line-height:13px;overflow:hidden;text-overflow:ellipsis">${name}</span>` : nothing}${c.show_status !== false ? html`<span style="font-size:10px;font-weight:600;line-height:12px;color:var(--lumen-text-2);overflow:hidden;text-overflow:ellipsis">${s.short}</span>` : nothing}</div>`
        : html`<div style="min-width:0;flex:1">${c.show_name !== false ? html`<div style="font-size:14px;font-weight:700">${name}</div>` : nothing}${c.show_status !== false ? html`<div style="font-size:12px;font-weight:600;color:var(--lumen-text-2);text-wrap:pretty">${s.status}</div>` : nothing}</div>${this.subs.render(c.sub_buttons)}`}
    </div>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 3 };
  }

  static getStubConfig(hass?: HassLike, entities?: string[], fallback?: string[]) {
    return { entity: stub(hass, "person", entities, fallback) ?? firstOf(hass, "person", "person.example") };
  }

  static getConfigForm() {
    return form([
      { name: "entity", selector: { entity: { domain: "person" } } },
      { name: "presence_entity", selector: { entity: { domain: ["binary_sensor", "device_tracker"] } } },
      { name: "", type: "grid", flatten: true, schema: [{ name: "name", selector: { text: {} } }, { name: "avatar_color", selector: { ui_color: {} } }] },
      { name: "picture", selector: { text: { type: "url" } } },
      actions(),
      advanced([["show_name"], ["show_status"]], { subButtons: true }),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-person-card", LumenPersonCard, {
  name: "card.person.name",
  description: "card.person.description",
  domains: ["person"],
});
