import { css, html, nothing, unsafeCSS } from "lit";
import type { ActionConfig } from "../core/actions";
import { GRID, LumenBaseCard, type BaseConfig } from "../core/base-card";
import { callOrToast, entityName } from "../core/call";
import { actions, advanced, appearance, entityStub, form, hide, nameIcon } from "../core/form";
import { t } from "../core/i18n";
import { icon } from "../core/lumen-icon";
import { WFX } from "../core/parts";
import { pressable } from "../core/press";
import { registerCard } from "../core/register";
import { SlideDrag, TILE_CSS, sliderTile, thinBar } from "../core/slider-tile";
import { glass, stop } from "../core/styles";
import { StepChaser } from "../core/step-chaser";
import { requireEntity } from "../core/validate";
import { stateText } from "../logic/format";
import { MEDIA, formatTrackTime, mediaDuration, mediaInfo, mediaOff, mediaPlaying, mediaPosition, mediaSupports, snapToStep, volumeButtons, volumeIcon, volumeLevel } from "../logic/media";

export interface MediaConfig extends BaseConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** Track progress row (default true). */
  show_progress?: boolean;
  /** Volume bar (default true). */
  show_volume?: boolean;
  /** Player name / last source line (default true). */
  show_source?: boolean;
  /** Only a volume slider tile: no artwork or track title (default false). */
  volume_only?: boolean;
  /** `volume_only` on a player with volume keys only: how much one key changes, in percent (default 4). */
  volume_step?: number;
  /** `volume_only`: previous, play/pause and next on the tile (default true); mute stays. */
  show_playback?: boolean;
  /** Android TV Remote `remote.*` of this player: many volume keys go out as one fast command. */
  volume_remote?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

const DEFAULT_VOLUME_STEP = 4;
/** Level commands while dragging: often enough to hear it, not enough to flood a device. */
const LIVE_SET_MS = 300;

/** Artwork stand-in (design `ART`). */
const ART = "linear-gradient(135deg, oklch(0.64 0.17 35), oklch(0.46 0.16 300))";

export function validateMedia(c: Partial<MediaConfig>): void {
  requireEntity(c);
}

/**
 * media_player (catalog section 14): artwork 64 px, title / artist / player, progress, previous ·
 * play/pause · next and a draggable volume bar; compact = one row with a play button. Off and
 * unavailable players dim the controls (play turns the player on when it can).
 */
export class LumenMediaCard extends LumenBaseCard<MediaConfig> {
  protected static grid = { ...GRID.row, min_columns: 6 };
  protected static cardSize = 3;
  static properties = { ...LumenBaseCard.properties, _artFailed: { state: true } };
  static styles = [LumenBaseCard.styles, css`${unsafeCSS(TILE_CSS)}.mbtn:active:not(:disabled){transform:scale(.9)}.mbtn{transition:transform 220ms var(--lumen-ease-spring), opacity 300ms}`];
  protected static compactBelow = 280;
  private _artFailed = "";

  private vol = new SlideDrag(this, {
    enabled: () => !mediaOff(this.player) && (mediaSupports(this.player, MEDIA.VOLUME_SET) || this.keysOnly),
    source: () => this.player,
    tapSets: true,
    threshold: 3,
    ends: true,
    // The whole `volume_only` tile holds like the other slider tiles; the thin bar of the full card is only a bar.
    hold: () => this.holdAction(this._config, this._config.entity)(),
    holdEnabled: () => !!this._config?.volume_only,
    live: (f) => this.followFinger(f),
    commit: (f) => (this.keysOnly ? this.keys.to(f) : this.call("volume_set", { volume_level: Math.round(f * 100) / 100 })),
    step: (d, big) => this.keysOnly ? this.call(d > 0 ? "volume_up" : "volume_down") : this.call("volume_set", { volume_level: Math.max(0, Math.min(1, Math.round(((volumeLevel(this.player) ?? 0) + d * (big ? 0.1 : 0.05)) * 100) / 100)) }),
  });

  /** Volume keys for a `volume_only` tile on a player that cannot be set to a level. */
  private keys = new StepChaser(
    this,
    (dir, count) => this.sendKeys(dir, count),
    () => volumeLevel(this.player),
    () => (this._config.volume_step ?? DEFAULT_VOLUME_STEP) / 100,
    120,
    () => !!this._config.volume_remote,
  );
  private lastLiveSet = 0;

  private sendKeys(dir: 1 | -1, count: number) {
    const remote = this._config.volume_remote;
    if (!remote) return this.call(dir > 0 ? "volume_up" : "volume_down");
    return callOrToast(this, this._hass, "remote", "send_command", { command: dir > 0 ? "VOLUME_UP" : "VOLUME_DOWN", num_repeats: count, delay_secs: 0 }, remote).then((ok) => {
      if (!ok) this.vol.clear();
    });
  }

  private get keysOnly(): boolean {
    return !!this._config?.volume_only && !mediaSupports(this.player, MEDIA.VOLUME_SET) && mediaSupports(this.player, MEDIA.VOLUME_STEP);
  }

  /** `volume_only`: the volume follows the drag; level commands are spaced, the release sends the final one. */
  private followFinger(f: number) {
    if (!this._config.volume_only) return;
    if (this.keysOnly) {
      this.keys.to(f);
      return;
    }
    const now = Date.now();
    if (now - this.lastLiveSet < LIVE_SET_MS) return;
    this.lastLiveSet = now;
    this.call("volume_set", { volume_level: Math.round(f * 100) / 100 });
  }

  private seek = new SlideDrag(this, {
    enabled: () => mediaPlaying(this.player) || this.player?.state === "paused" ? mediaSupports(this.player, MEDIA.SEEK) && mediaDuration(this.player) !== null : false,
    source: () => this.player,
    tapSets: true,
    threshold: 3,
    commit: (f) => this.call("media_seek", { seek_position: Math.round(f * (mediaDuration(this.player) ?? 0)) }),
    step: (d, big) => {
      const pos = mediaPosition(this.player) ?? 0;
      this.call("media_seek", { seek_position: Math.max(0, Math.min(mediaDuration(this.player) ?? 0, Math.round(pos + d * (big ? 60 : 10)))) });
    },
  });

  protected entityIds() {
    return [this._config.entity];
  }

  protected validate(c: MediaConfig) {
    validateMedia(c);
  }

  connectedCallback(): void {
    super.connectedCallback();
    // The progress moves on with the clock while playing.
    this.every(1000, () => {
      if (mediaPlaying(this.player) && this._config?.show_progress !== false && !this.compact) this.requestUpdate();
    });
  }

  private get player() {
    return this.entity(this._config.entity);
  }

  private call(service: string, data: Record<string, unknown> = {}) {
    return callOrToast(this, this._hass, "media_player", service, data, this._config.entity).then((ok) => {
      if (!ok) {
        this.vol.clear();
        this.seek.clear();
      }
      this.requestUpdate();
    });
  }

  private playPause() {
    const e = this.player;
    if (!e || e.state === "unavailable") return;
    this.haptic();
    if (mediaOff(e)) {
      if (mediaSupports(e, MEDIA.TURN_ON)) this.call("turn_on");
      return;
    }
    if (mediaPlaying(e)) this.call(mediaSupports(e, MEDIA.PAUSE) ? "media_pause" : "media_stop");
    else this.call("media_play");
  }

  private canPlay(): boolean {
    const e = this.player;
    if (!e || e.state === "unavailable") return false;
    if (mediaOff(e)) return mediaSupports(e, MEDIA.TURN_ON);
    return mediaPlaying(e) ? mediaSupports(e, MEDIA.PAUSE) || mediaSupports(e, MEDIA.STOP) : mediaSupports(e, MEDIA.PLAY) || mediaSupports(e, MEDIA.PAUSE);
  }

  private art(size: number, radius: number, off: boolean, picture?: string) {
    const c = this._config;
    const showPic = !off && picture && this._artFailed !== picture;
    const glyph = off ? "mdi:speaker-off" : c.icon || "mdi:music-note";
    return html`<span aria-hidden="true" style="position:relative;flex:none;width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden;background:${off ? "var(--lumen-surface-2)" : ART};display:grid;place-items:center;color:${off ? "var(--lumen-text-3)" : "rgba(255,255,255,.9)"};font-size:${Math.round(size * 0.4)}px">
      ${showPic ? html`<img src=${picture} alt="" @error=${() => (this._artFailed = picture!)} style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />` : size >= 48 || off ? icon(glyph, "display:block") : nothing}
    </span>`;
  }

  private ctl(ic: string, label: string, enabled: boolean, click: () => void) {
    return html`<button class="mbtn" aria-label=${label} title=${label} ?disabled=${!enabled} @click=${(ev: Event) => {
      ev.stopPropagation();
      this.haptic();
      click();
    }} style="flex:none;width:44px;height:44px;border:0;border-radius:14px;background:transparent;display:grid;place-items:center;font-size:22px;color:var(--lumen-text-2);padding:0;cursor:pointer">${icon(ic, "display:block")}</button>`;
  }

  private playButton(size: number, playing: boolean) {
    const label = playing ? t("card.media.pause") : t("card.media.play");
    const ok = this.canPlay();
    return html`<button class="mbtn" aria-label=${label} title=${label} ?disabled=${!ok} @pointerdown=${stop} @pointerup=${stop} @keydown=${stop} @click=${(ev: Event) => {
      ev.stopPropagation();
      this.playPause();
    }} style="flex:none;width:${size}px;height:${size}px;border:0;border-radius:50%;display:grid;place-items:center;font-size:${size >= 52 ? 26 : 22}px;background:var(--lumen-text-1);color:var(--lumen-bg);padding:0;cursor:pointer">${icon(playing ? "mdi:pause" : "mdi:play", "display:block")}</button>`;
  }

  /** The `volume_only` tile has its own rule: it stays full down to 200 px (design). */
  override get compact(): boolean {
    if (!this._config?.volume_only || (this._config.layout ?? "auto") !== "auto") return super.compact;
    return this._width > 0 && this._width < 200;
  }

  /** A 36 px button of the `volume_only` tile; pointer events stay out of the slider underneath. */
  private tileButton(ic: string, label: string, color: string, enabled: boolean, click: () => void, opts: { pressed?: boolean; dim?: boolean; gap?: boolean } = {}) {
    return html`<button class="mbtn" aria-label=${label} title=${label} aria-pressed=${opts.pressed ?? nothing} ?disabled=${!enabled} @pointerdown=${stop} @pointerup=${stop} @keydown=${stop} @click=${(ev: Event) => {
      ev.stopPropagation();
      this.haptic();
      click();
    }} style="flex:none;width:36px;height:36px;margin-left:${opts.gap ? "6px" : "0"};border:0;border-radius:12px;background:transparent;padding:0;display:grid;place-items:center;font-size:18px;color:${color};opacity:${opts.dim ? 0.38 : 1};cursor:${enabled ? "pointer" : "default"}">${icon(ic, "display:block")}</button>`;
  }

  /** `volume_only` (design section 14): the whole tile is the volume slider, playback buttons on the right. */
  private volumeTile() {
    const c = this._config;
    const e = this.player;
    const una = !e || e.state === "unavailable";
    const off = mediaOff(e);
    const vl = volumeLevel(e);
    const raw = this.vol.value() ?? this.keys.pending ?? (off ? 0 : (vl ?? 0));
    // Keys move in levels: show the level the device will really land on, not the finger's exact spot.
    const vf = this.keysOnly ? snapToStep(raw, (c.volume_step ?? DEFAULT_VOLUME_STEP) / 100) : raw;
    const muted = !!e?.attributes.is_volume_muted;
    const name = entityName(c.name, e, c.entity);
    const known = !off && (vl !== null || this.vol.dragging);
    const percent = `${Math.round(vf * 100)}%`;
    const sub = una ? t("common.unavailable") : off ? t("card.media.off") : known ? percent : "";
    const b = volumeButtons(e, this._width, c.show_playback !== false);
    const playing = mediaPlaying(e);
    const buttons = [
      b.previous ? this.tileButton("mdi:skip-previous", t("card.media.previous"), "var(--lumen-text-2)", !b.skipDimmed, () => this.call("media_previous_track"), { dim: b.skipDimmed }) : nothing,
      b.play ? this.tileButton(playing ? "mdi:pause" : "mdi:play", playing ? t("card.media.pause") : t("card.media.play"), "var(--lumen-text-1)", true, () => this.call(playing ? (mediaSupports(e, MEDIA.PAUSE) ? "media_pause" : "media_stop") : "media_play")) : nothing,
      b.next ? this.tileButton("mdi:skip-next", t("card.media.next"), "var(--lumen-text-2)", !b.skipDimmed, () => this.call("media_next_track"), { dim: b.skipDimmed }) : nothing,
      b.mute
        ? this.tileButton(muted ? "mdi:volume-off" : "mdi:volume-high", muted ? t("card.media.unmute") : t("card.media.mute"), muted ? "var(--lumen-accent)" : "var(--lumen-text-3)", true, () => this.call("volume_mute", { is_volume_muted: !muted }), { pressed: muted, gap: b.previous || b.play || b.next })
        : nothing,
    ];
    return sliderTile(
      {
        title: name,
        sub,
        icon: c.icon || volumeIcon(vl, muted),
        iconBg: "var(--lumen-surface-2)",
        iconFg: off ? "var(--lumen-text-3)" : "var(--lumen-accent)",
        fill: off ? null : Math.round(vf * 100),
        fillColor: "var(--lumen-accent)",
        una,
        compact: this.compact,
        label: `${t("card.media.volume")} · ${name}`,
        keys: "ArrowLeft ArrowRight Shift+Enter",
        slider: { now: Math.round(vf * 100), text: muted ? `${t("card.media.muted")}, ${percent}` : percent },
        trailing: off ? undefined : html`<div style="flex:none;display:flex;align-items:center;gap:6px">${buttons}</div>`,
      },
      this.vol,
      !una && !off,
    );
  }

  protected renderCard() {
    if (!this._config || !this._hass) return nothing;
    const c = this._config;
    if (c.volume_only) return this.volumeTile();
    const e = this.player;
    const una = !e || e.state === "unavailable";
    const off = mediaOff(e);
    const playing = mediaPlaying(e);
    const name = entityName(c.name, e, c.entity);
    const hasMedia = !off && !!(e?.attributes.media_title || e?.attributes.media_series_title);
    const info = mediaInfo(e, name);
    const stateLabel = una ? t("common.unavailable") : off ? t("card.media.off") : stateText(this._hass, e, e!.state);
    const title = hasMedia ? info.title : name;
    const artist = hasMedia ? info.artist : stateLabel;
    const last = String(e?.attributes.app_name || e?.attributes.source || "");
    const src = off ? (last ? t("card.media.last", { x: last }) : "") : hasMedia ? name : last;
    const h = this.actions(`media:${c.entity}`, c, c.entity);

    if (this.compact) {
      return html`<div data-fx ${pressable(h)} class="ltile" aria-label="${name} · ${title}${artist ? ` · ${artist}` : ""}"
        style="position:relative;display:flex;align-items:center;gap:10px;min-height:52px;padding:8px 8px 8px 10px;box-sizing:border-box;border-radius:20px;background:${una ? "var(--lumen-surface-2)" : "var(--lumen-surface)"};border:${una ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};box-shadow:${una ? "none" : "var(--lumen-shadow-1)"};${glass};cursor:pointer;user-select:none;touch-action:pan-y;transition:transform 240ms var(--lumen-ease-spring)">${WFX}
        ${this.art(36, 11, off, info.picture)}
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div><div style="font-size:12px;font-weight:650;line-height:16px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${artist}</div></div>
        <span style="opacity:${off ? 0.38 : 1};display:contents">${this.playButton(40, playing)}</span>
      </div>`;
    }

    const op = off ? 0.38 : 1;
    const dur = mediaDuration(e);
    const sf = this.seek.value();
    const pos = sf !== null && dur ? sf * dur : mediaPosition(e);
    const progF = dur && pos !== null ? pos / dur : 0;
    const vl = volumeLevel(e);
    const vf = this.vol.value() ?? (off ? 0 : (vl ?? 0));
    const muted = !!e?.attributes.is_volume_muted;
    const canMute = !off && mediaSupports(e, MEDIA.VOLUME_MUTE);
    const showVol = c.show_volume !== false && (mediaSupports(e, MEDIA.VOLUME_SET) || mediaSupports(e, MEDIA.VOLUME_MUTE) || off);
    return html`<div data-fx class="ltile" style="position:relative;display:flex;flex-direction:column;gap:12px;padding:14px;box-sizing:border-box;border-radius:22px;background:${una ? "var(--lumen-surface-2)" : "var(--lumen-surface)"};border:${una ? "1px dashed var(--lumen-border-strong)" : "1px solid var(--lumen-border)"};box-shadow:${una ? "none" : "var(--lumen-shadow-1)"};${glass};color:var(--lumen-text-1)">${WFX}
      <div ${pressable(h)} aria-label="${name} · ${title}${artist ? ` · ${artist}` : ""}" style="display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;touch-action:pan-y;border-radius:14px">
        ${this.art(64, 14, off, info.picture)}
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:750;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>
          <div style="font-size:13px;font-weight:600;line-height:18px;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${artist}</div>
          ${c.show_source !== false && src ? html`<div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-3);white-space:nowrap;overflow:hidden"><span style="flex:none;display:grid">${icon("mdi:speaker", "font-size:14px")}</span><span style="overflow:hidden;text-overflow:ellipsis">${src}</span></div>` : nothing}
        </div>
        ${una ? icon("mdi:power-plug-off-outline", "flex:none;font-size:18px;color:var(--lumen-text-3)") : nothing}
      </div>
      ${c.show_progress !== false
        ? html`<div style="display:flex;align-items:center;gap:8px;font:600 11px var(--lumen-font);color:var(--lumen-text-3);font-variant-numeric:tabular-nums;opacity:${op}">
            <span>${formatTrackTime(off ? null : pos)}</span>
            <div style="flex:1;min-width:0">${thinBar({ drag: this.seek, frac: off ? 0 : progF, color: "var(--lumen-text-1)", height: 4, name: t("card.media.progress"), valueText: `${formatTrackTime(pos)} / ${formatTrackTime(dur)}`, disabled: !mediaSupports(e, MEDIA.SEEK) || off, now: Math.round(pos ?? 0), max: Math.round(dur ?? 0) })}</div>
            <span>${formatTrackTime(off ? null : dur)}</span>
          </div>`
        : nothing}
      <div style="display:flex;align-items:center;gap:6px;opacity:${op}">
        ${this.ctl("mdi:skip-previous", t("card.media.previous"), !off && mediaSupports(e, MEDIA.PREVIOUS_TRACK), () => this.call("media_previous_track"))}
        ${this.playButton(52, playing)}
        ${this.ctl("mdi:skip-next", t("card.media.next"), !off && mediaSupports(e, MEDIA.NEXT_TRACK), () => this.call("media_next_track"))}
        <span style="flex:1"></span>
        ${showVol
          ? html`<button class="mbtn" aria-label=${muted ? t("card.media.unmute") : t("card.media.mute")} aria-pressed=${muted} ?disabled=${!canMute} @click=${() => {
                this.haptic();
                this.call("volume_mute", { is_volume_muted: !muted });
              }} style="flex:none;width:32px;height:44px;margin-right:-4px;border:0;background:transparent;padding:0;display:grid;place-items:center;font-size:18px;color:var(--lumen-text-3);cursor:${canMute ? "pointer" : "default"}">${icon(volumeIcon(off ? null : vl, muted), "display:block")}</button>
              ${thinBar({ drag: this.vol, frac: vf, color: "var(--lumen-accent)", width: "76px", name: t("card.media.volume"), valueText: `${Math.round(vf * 100)}%`, disabled: off || !mediaSupports(e, MEDIA.VOLUME_SET) })}`
          : nothing}
      </div>
    </div>`;
  }

  static getStubConfig = entityStub("media_player", "media_player.example");

  static getConfigForm() {
    return form((c) =>
      hide(
        c,
        [
          { name: "entity", required: true, selector: { entity: { domain: "media_player" } } },
          nameIcon(),
          actions(true, false),
          advanced([["volume_only", false], ["show_playback"], ["show_progress"], ["show_volume"], ["show_source"]], {
            extra: [
              { name: "volume_remote", helper: "volume_remote", selector: { entity: { domain: "remote" } } },
              { name: "volume_step", helper: "volume_step", selector: { number: { min: 1, max: 25, step: 1, mode: "box", unit_of_measurement: "%" } } },
            ],
          }),
          appearance({ layout: "width" }),
        ],
        [
          [!!c?.volume_only, ["tap_action", "show_progress", "show_volume", "show_source"]],
          [!c?.volume_only, ["show_playback", "volume_remote", "volume_step"]],
        ],
      ),
    );
  }
}

registerCard("lumen-media-card", LumenMediaCard, {
  name: "card.media.name",
  description: "card.media.description",
  domains: ["media_player"],
});

