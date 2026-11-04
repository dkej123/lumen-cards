// Cover (roller shutter, blind, curtain, garage door) state of the cover card.
import { t } from "../core/i18n";
import type { HassEntity } from "../hass/types";
import { isUnavailable } from "../hass/types";

/** CoverEntityFeature bits. */
export const COVER = { OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8, OPEN_TILT: 16, CLOSE_TILT: 32, STOP_TILT: 64, SET_TILT_POSITION: 128 } as const;

export const coverSupports = (e: HassEntity | undefined, feature: number): boolean => ((Number(e?.attributes.supported_features) || 0) & feature) !== 0;

export type CoverKey = "open" | "closed" | "partial" | "opening" | "closing" | "unavailable" | "unknown";

export interface CoverState {
  key: CoverKey;
  label: string;
  moving: boolean;
  /** 0–100, null when the cover reports no position and no end state. */
  position: number | null;
  /** 0–100 slat position, null without tilt. */
  tilt: number | null;
}

/** Position 0–100 from `current_position`, else 100 / 0 from the open / closed state. */
export function coverPosition(e: HassEntity | undefined): number | null {
  const p = Number(e?.attributes.current_position);
  if (e?.attributes.current_position !== undefined && e?.attributes.current_position !== null && Number.isFinite(p)) return Math.max(0, Math.min(100, p));
  if (e?.state === "open") return 100;
  if (e?.state === "closed") return 0;
  return null;
}

export function coverTilt(e: HassEntity | undefined): number | null {
  const p = Number(e?.attributes.current_tilt_position);
  return e?.attributes.current_tilt_position !== undefined && e?.attributes.current_tilt_position !== null && Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : null;
}

/**
 * State of the card. `target` is a command on its way (the button just pressed) and wins over
 * the resting state until HA reports something new.
 */
export function coverState(e: HassEntity | undefined, target?: number | null): CoverState {
  const position = coverPosition(e);
  const tilt = coverTilt(e);
  if (!e || e.state === "unavailable") return { key: "unavailable", label: t("common.unavailable"), moving: false, position: null, tilt: null };
  let key: CoverKey;
  if (target !== undefined && target !== null && position !== target) key = position !== null && target < position ? "closing" : target === 0 ? "closing" : "opening";
  else if (e.state === "opening") key = "opening";
  else if (e.state === "closing") key = "closing";
  else if (isUnavailable(e)) key = "unknown";
  else if (position !== null && position > 0 && position < 100) key = "partial";
  else if (e.state === "closed" || position === 0) key = "closed";
  else key = "open";
  const label = key === "unknown" ? t("common.no_data") : t(`card.cover.${key}`);
  return { key, label, moving: key === "opening" || key === "closing", position, tilt };
}

/** Button of the segment row shown as pressed: Stop while moving, else the end the cover rests at. */
export function activeButton(s: CoverState): "open" | "stop" | "close" | null {
  if (s.moving) return "stop";
  if (s.key === "open") return "open";
  if (s.key === "closed") return "close";
  return null;
}

/** Tilt 0–100 % as the slat angle ("45°" at 50 %). */
export const tiltDegrees = (pct: number): number => Math.round(pct * 0.9);

const ICONS: Record<string, [open: string, closed: string]> = {
  shutter: ["mdi:window-shutter-open", "mdi:window-shutter"],
  blind: ["mdi:blinds-horizontal", "mdi:blinds-horizontal-closed"],
  shade: ["mdi:roller-shade", "mdi:roller-shade-closed"],
  curtain: ["mdi:curtains", "mdi:curtains-closed"],
  garage: ["mdi:garage-open", "mdi:garage"],
  gate: ["mdi:gate-open", "mdi:gate"],
  door: ["mdi:door-open", "mdi:door-closed"],
  window: ["mdi:window-open", "mdi:window-closed"],
  awning: ["mdi:awning-outline", "mdi:awning-outline"],
  damper: ["mdi:circle-slice-8", "mdi:circle"],
};

/** Glyph by device class (blinds when the cover tilts and has no class), open or closed. */
export function coverIcon(e: HassEntity | undefined, s: CoverState): string {
  const dc = String(e?.attributes.device_class ?? "");
  const [open, closed] = ICONS[dc] ?? (s.tilt !== null ? ICONS.blind : ICONS.shutter);
  if (s.key === "unavailable") return closed;
  return s.key === "closed" ? closed : open;
}
