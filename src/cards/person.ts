import { html, nothing } from "lit";
import { actions, advanced, appearance, firstOf, form, stub } from "../core/form";
import { SubButtons, subButtonLimit } from "../core/sub-buttons";
import { t } from "../core/i18n";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Presses } from "../core/press";
import { registerCard } from "../core/register";
import { colorOr } from "../core/styles";
import { NEUTRAL, UNAVAILABLE, UNKNOWN, rowTile, squareTile } from "../core/tile";
import type { HassEntity, HassLike } from "../hass/types";
import { avatarColor, presence, type Presence } from "../logic/presence";

export interface PersonConfig extends BaseConfig {
  /** person.* – zone shown when away; picture and name by default. */
  entity?: string;
  /** Presence sensor (binary_sensor on = home, e.g. BLE beacon, or a device_tracker); default: the person's home zone. */
  presence_entity?: string;
  name?: string;
  /** Picture URL; default: the person's entity_picture. */
  picture?: string;
  /** Background behind the initial (no picture): HA colour name or hex. Default: picked from the name. */
  avatar_color?: string;
  /** Badge next to the name while presence comes from `presence_entity` (default "BLE"; "" hides it). */
  presence_badge?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  show_name?: boolean;
  show_status?: boolean;
}

export function validatePerson(c: Partial<PersonConfig>): void {
  if (!c.entity && !c.presence_entity) throw new Error(t("card.person.error.entity"));
}

/** One household member: avatar (picture or initial), presence dot with a pulse, zone and time since the change. */
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

  private avatar(name: string, s: Presence, compact: boolean) {
    const c = this._config;
    const size = compact ? 30 : 34;
    const d = compact ? 9 : 10;
    const src = c.picture || this.entity(c.entity)?.attributes.entity_picture;
    const failed = !src || this.failed;
    const bg = s.unavailable ? "var(--lumen-unavailable)" : colorOr(c.avatar_color, avatarColor(name));
    const dot = s.unavailable ? "transparent" : s.unknown ? "var(--lumen-warning)" : s.home ? "var(--lumen-ok)" : "var(--lumen-text-3)";
    return html`<div style="position:relative;flex:none;width:${size}px;height:${size}px">
      <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:${bg};color:#fff;font:800 ${compact ? 13 : 14}px var(--lumen-font)">
        ${failed
          ? html`<span>${(name[0] ?? "?").toUpperCase()}</span>`
          : html`<img src=${src} alt="" style="width:100%;height:100%;object-fit:cover" @error=${() => {
              this.failed = true;
              this.requestUpdate();
            }} />`}
      </div>
      <span style="position:absolute;right:-2px;bottom:-2px;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${dot};border:2px solid ${s.unavailable ? "transparent" : "var(--lumen-surface-solid)"}">
        ${s.home ? html`<span style="position:absolute;inset:-2px;border-radius:50%;background:color-mix(in srgb,var(--lumen-ok) 55%,transparent);animation:lumenDotRing 2.4s ease-out infinite;pointer-events:none"></span>` : nothing}
      </span>
    </div>`;
  }

  render() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const compact = this.compact;
    const key = c.entity ?? c.presence_entity ?? "";
    const name = c.name || this.entity(c.entity)?.attributes.friendly_name || key;
    const s = presence(this.sensor(), this.entity(c.entity), Date.now());
    const h = this.presses.handlers(
      `person:${key}`,
      () => (c.tap_action ? handleAction(this, c.tap_action, key) : this.moreInfo(key)),
      () => (c.hold_action ? handleAction(this, c.hold_action, key, "hold") : this.moreInfo(key)),
      c.double_tap_action ? () => handleAction(this, c.double_tap_action, key, "double_tap") : undefined,
    );
    const badge = c.presence_entity && !s.unavailable ? (c.presence_badge ?? "BLE") : "";
    const opts = {
      title: name,
      sub: compact ? s.short : s.label,
      meta: compact ? "" : s.since,
      badge: compact ? "" : badge,
      look: s.unavailable ? UNAVAILABLE : s.unknown ? UNKNOWN : NEUTRAL,
      lead: this.avatar(name, s, compact),
      handlers: h,
      label: `${name} · ${s.status}`,
      showTitle: c.show_name !== false,
      showSub: c.show_status !== false,
      trailing: this.subs.render(c.sub_buttons, { compact, max: subButtonLimit(compact, this._width) }),
    };
    return compact ? squareTile(opts) : rowTile(opts);
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
      { name: "presence_badge", selector: { text: {} } },
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
