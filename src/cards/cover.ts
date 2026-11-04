import { css, html, nothing, unsafeCSS } from "lit";
import { handleAction, type ActionConfig } from "../core/actions";
import { LumenBaseCard, type BaseConfig } from "../core/base-card";
import { Pending } from "../core/controllers/pending";
import { callOrToast, entityName } from "../core/call";
import { actions, advanced, appearance, entityStub, form, nameIcon } from "../core/form";
import { t } from "../core/i18n";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, segButtons, sliderTile, thinBar } from "../core/slider-tile";
import { requireEntity } from "../core/validate";
import { COVER, activeButton, coverIcon, coverState, coverSupports, tiltDegrees } from "../logic/cover";

export interface CoverConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Open / Stop / Close row (default true). */
  show_buttons?: boolean;
  /** Slat bar of tilting blinds (default true). */
  show_tilt?: boolean;
  /** Value line (default true). */
  show_state?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

export function validateCover(c: Partial<CoverConfig>): void {
  requireEntity(c);
}

/**
 * Roller shutter / blind (catalog section 14): the tile fill is the position, a horizontal drag
 * sets it (set_cover_position on release), Open / Stop / Close in a second row, a separate slat
 * bar for tilting blinds. Tap toggles, hold opens more-info.
 */
export class LumenCoverCard extends LumenBaseCard<CoverConfig> {
  protected static cardSize = 2;
  protected static compactBelow = 200;
  /** The pressed command (position %; open / close show Opening… / Closing…) until HA sends a new state (or 10 s). */
  private target = new Pending<number>(this, () => this.cover);

  private pos = new SlideDrag(this, {
    enabled: () => this.canSetPosition,
    source: () => this.cover,
    commit: (f) => this.setPosition(Math.round(f * 100)),
    ends: true,
    tap: () => this.tap(),
    hold: () => this.holdAction(this._config, this._config.entity)(),
    step: (d, big) => {
      const f = this.pos.value();
      const p = f !== null ? f * 100 : (coverState(this.cover).position ?? 0);
      const next = Math.max(0, Math.min(100, Math.round(p) + d * (big ? 25 : 10)));
      this.pos.show(next / 100);
      this.setPosition(next);
    },
  });

  private tilt = new SlideDrag(this, {
    enabled: () => !this.offline,
    source: () => this.cover,
    tapSets: true,
    commit: (f) => this.call("set_cover_tilt_position", { tilt_position: Math.round(f * 100) }),
    step: (d, big) => {
      const shown = this.tilt.value();
      const cur = shown !== null ? Math.round(shown * 100) : (coverState(this.cover).tilt ?? 0);
      const next = Math.max(0, Math.min(100, cur + d * (big ? 25 : 10)));
      this.tilt.show(next / 100);
      this.call("set_cover_tilt_position", { tilt_position: next });
    },
  });

  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}`];

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: CoverConfig) {
    validateCover(c);
  }

  private get cover() {
    return this.entity(this._config.entity);
  }

  private get offline() {
    return !this.cover || this.cover.state === "unavailable";
  }

  private get canSetPosition() {
    return !this.offline && coverSupports(this.cover, COVER.SET_POSITION);
  }

  private call(service: string, data: Record<string, unknown> = {}) {
    this.requestUpdate();
    return callOrToast(this, this._hass, "cover", service, data, this._config.entity).then((ok) => {
      if (!ok) {
        this.target.clear();
        this.pos.clear();
        this.tilt.clear();
      }
      this.requestUpdate();
    });
  }

  private setPosition(p: number) {
    this.target.set(p);
    this.call("set_cover_position", { position: p });
  }

  private open() {
    this.target.set(100);
    this.call("open_cover");
  }

  private close() {
    this.target.set(0);
    this.call("close_cover");
  }

  private stop() {
    this.target.clear();
    this.call("stop_cover");
  }

  private tap() {
    const c = this._config;
    if (this.offline && !c.tap_action) return;
    handleAction(this, c.tap_action ?? { action: "toggle" }, c.entity, "tap");
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    const e = this.cover;
    const s = coverState(e, this.target.value ?? null);
    const una = s.key === "unavailable";
    const name = entityName(c.name, e, c.entity);
    const dragged = this.pos.value();
    const pos = dragged !== null ? Math.round(dragged * 100) : s.position;
    const tilting = !una && coverSupports(e, COVER.SET_TILT_POSITION) && s.tilt !== null && c.show_tilt !== false;
    const slats = tilting && s.key === "closed";
    const tiltF = this.tilt.value() ?? (s.tilt ?? 0) / 100;
    const meta = una ? "" : slats ? t("card.cover.slats", { deg: tiltDegrees(Math.round(tiltF * 100)) }) : pos !== null ? `${pos}%` : "";
    const active = activeButton(s);
    const showButtons = !una && c.show_buttons !== false && (coverSupports(e, COVER.OPEN) || coverSupports(e, COVER.CLOSE));
    const buttons = showButtons
      ? segButtons(
          [
            { icon: "mdi:arrow-up", label: t("card.cover.open_btn"), on: active === "open", click: () => this.open() },
            ...(coverSupports(e, COVER.STOP) ? [{ icon: "mdi:stop", label: t("card.cover.stop"), on: active === "stop", click: () => this.stop() }] : []),
            { icon: "mdi:arrow-down", label: t("card.cover.close_btn"), on: active === "close", click: () => this.close() },
          ],
          name,
        )
      : nothing;
    const tiltBar = tilting
      ? thinBar({ drag: this.tilt, frac: tiltF, color: "var(--lumen-accent)", name: t("card.cover.tilt"), valueText: `${tiltDegrees(Math.round(tiltF * 100))}°`, label: `${tiltDegrees(Math.round(tiltF * 100))}°` })
      : nothing;
    const below = buttons === nothing && tiltBar === nothing ? undefined : html`${buttons}${tiltBar}`;
    const showState = c.show_state !== false;
    return sliderTile(
      {
        title: name,
        sub: showState ? s.label : "",
        meta: showState ? meta : "",
        subColor: una || s.key === "unknown" ? "var(--lumen-text-3)" : undefined,
        icon: c.icon || (e?.attributes.icon as string | undefined) || coverIcon(e, s),
        iconBg: una ? "transparent" : "var(--lumen-accent-soft)",
        iconFg: una ? "var(--lumen-unavailable)" : s.key === "unknown" ? "var(--lumen-text-3)" : "var(--lumen-accent)",
        fill: una || slats ? 0 : pos,
        fillColor: "var(--lumen-accent)",
        una,
        spin: s.moving,
        compact: this.compact,
        label: `${name} · ${s.label}${meta ? ` ${meta}` : ""}`,
        slider: this.canSetPosition ? { now: pos ?? 0, text: `${s.label}${meta ? ` ${meta}` : ""}` } : undefined,
        keys: this.canSetPosition ? "ArrowLeft ArrowRight Shift+Enter" : "Shift+Enter",
        below,
      },
      this.pos,
    );
  }

  static getStubConfig = entityStub("cover", "cover.example");

  static getConfigForm() {
    return form([
      { name: "entity", required: true, selector: { entity: { domain: "cover" } } },
      nameIcon(),
      actions(true, false),
      advanced([["show_state"], ["show_buttons"], ["show_tilt"]], { ticks: true }),
      appearance({ layout: "width" }),
    ]);
  }
}

registerCard("lumen-cover-card", LumenCoverCard, {
  name: "card.cover.name",
  description: "card.cover.description",
  domains: ["cover"],
});
