// media_player state of the media card: what plays, how far, which controls exist.
import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";

/** MediaPlayerEntityFeature bits. */
export const MEDIA = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  VOLUME_STEP: 1024,
  STOP: 4096,
  PLAY: 16384,
} as const;

export const mediaSupports = (e: HassEntity | undefined, feature: number): boolean => ((Number(e?.attributes.supported_features) || 0) & feature) !== 0;

/** Off-like states: no media info, controls dimmed. */
export const mediaOff = (e: HassEntity | undefined): boolean => !e || isUnavailable(e) || e.state === "off" || e.state === "standby";

export const mediaPlaying = (e: HassEntity | undefined): boolean => e?.state === "playing";

/**
 * Playback position in seconds: `media_position` was taken at `media_position_updated_at`, so
 * while playing it moves on with the clock. Null without a position.
 */
export function mediaPosition(e: HassEntity | undefined, now: number = Date.now()): number | null {
  const pos = Number(e?.attributes.media_position);
  if (e?.attributes.media_position === undefined || e?.attributes.media_position === null || !Number.isFinite(pos)) return null;
  const dur = Number(e.attributes.media_duration);
  let p = pos;
  if (mediaPlaying(e) && e.attributes.media_position_updated_at) {
    const at = Date.parse(String(e.attributes.media_position_updated_at));
    if (Number.isFinite(at)) p += Math.max(0, (now - at) / 1000);
  }
  return Number.isFinite(dur) && dur > 0 ? Math.min(p, dur) : p;
}

export const mediaDuration = (e: HassEntity | undefined): number | null => {
  const d = Number(e?.attributes.media_duration);
  return Number.isFinite(d) && d > 0 ? d : null;
};

/** "2:14", "1:02:09". */
export function formatTrackTime(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return "–";
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export interface MediaInfo {
  title: string;
  artist: string;
  /** Artwork URL (HA's proxied `entity_picture`), if any. */
  picture?: string;
}

/** Title and second line: track + artist, else album / series / app name. */
export function mediaInfo(e: HassEntity | undefined, fallbackTitle: string): MediaInfo {
  const a = e?.attributes ?? {};
  const title = String(a.media_title || a.media_series_title || a.app_name || fallbackTitle);
  const artist = String(a.media_artist || a.media_album_artist || a.media_album_name || (a.media_title ? a.app_name || "" : "") || "");
  const picture = typeof a.entity_picture === "string" && a.entity_picture ? a.entity_picture : undefined;
  return { title, artist, picture };
}

/** Volume glyph for 0–1 (muted or 0 = off). */
export function volumeIcon(level: number | null, muted: boolean): string {
  if (muted || level === 0) return "mdi:volume-off";
  if (level === null) return "mdi:volume-medium";
  return level < 0.34 ? "mdi:volume-low" : level < 0.67 ? "mdi:volume-medium" : "mdi:volume-high";
}

export const volumeLevel = (e: HassEntity | undefined): number | null => {
  const v = Number(e?.attributes.volume_level);
  return e?.attributes.volume_level === undefined || e?.attributes.volume_level === null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1, v));
};
