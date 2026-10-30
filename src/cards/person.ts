import { html, nothing } from "lit";
import { actions, advanced, appearance, entityStub, form } from "../core/form";
import { SubButtons, subButtonLimit } from "../core/sub-buttons";
import { t } from "../core/i18n";
import type { ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { entityName } from "../core/call";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { colorOr, glass } from "../core/styles";
import { WFX } from "../core/parts";
import { NEUTRAL, UNAVAILABLE, UNKNOWN, rowTile } from "../core/tile";
import type { HassEntity } from "../hass/types";
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
    const d = compact ? 11 : 10;
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

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const compact = this.compact;
    const key = c.entity ?? c.presence_entity ?? "";
    const name = entityName(c.name, this.entity(c.entity), key);
    const s = presence(this.sensor(), this.entity(c.entity), Date.now());
    const h = this.actions(`person:${key}`, c, key);
    if (compact) {
      // The 44 px pill of the Dom panel (catalog correction 2026-10-30), not the catalog's square tile.
      return html`<div data-fx ${pressable(h)} class="press" aria-label="${name} · ${s.status}"
        style="display:flex;align-items:center;gap:8px;height:44px;padding:0 10px 0 7px;border-radius:16px;box-sizing:border-box;background:var(--lumen-surface);border:${s.unavailable ? "1.5px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};${glass};cursor:pointer;min-width:0;user-select:none;touch-action:pan-y;transition:transform 220ms var(--lumen-ease-spring)">${WFX}
        ${this.avatar(name, s, true)}
        <div style="min-width:0;display:flex;flex-direction:column;white-space:nowrap">${c.show_name !== false ? html`<span style="font-size:12px;font-weight:700;line-height:14px;overflow:hidden;text-overflow:ellipsis">${name}</span>` : nothing}${c.show_status !== false ? html`<span style="font-size:11px;font-weight:600;line-height:14px;color:var(--lumen-text-2);overflow:hidden;text-overflow:ellipsis">${s.short}</span>` : nothing}</div>
        <span style="margin-left:auto"></span>${c.sub_buttons?.length ? html`<span style="flex:none;display:flex;margin-right:-4px">${this.subs.render(c.sub_buttons, { compact: true, max: 1 })}</span>` : nothing}
      </div>`;
    }
    const badge = c.presence_entity && !s.unavailable ? (c.presence_badge ?? "BLE") : "";
    const opts = {
      title: name,
      sub: s.label,
      meta: s.since,
      badge,
      look: s.unavailable ? UNAVAILABLE : s.unknown ? UNKNOWN : NEUTRAL,
      lead: this.avatar(name, s, false),
      handlers: h,
      label: `${name} · ${s.status}`,
      showTitle: c.show_name !== false,
      showSub: c.show_status !== false,
      trailing: this.subs.render(c.sub_buttons, { compact, max: subButtonLimit(compact, this._width) }),
    };
    return rowTile(opts);
  }

  static getStubConfig = entityStub("person", "person.example");

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
