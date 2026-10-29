// Shared CSS of every card: the host look and the interaction states of the design
// minus the prototype frame.

export const shared = `
:host {
  display: block;
  font-family: var(--lumen-font);
  color: var(--lumen-text-1);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  container-type: inline-size;
}
/* Narrower than the panel column (e.g. half a section): rows wrap instead of overlapping. */
@container (max-width: 319px) {
  .lockrow { flex-wrap: wrap; }
  .lockbtns { flex: 1 1 100% !important; }
  .lockbtns > button { flex: 1; justify-content: center; }
  .modes > button { flex-direction: column; gap: 2px !important; padding: 0 2px; font-size: 11px !important; }
}
[data-fx] { position: relative; }
/* Card weather surface: bleeds 16 px above for the snow cap (BLEED in the engine). */
.wfx {
  position: absolute;
  left: -4px;
  top: -16px;
  width: calc(100% + 8px);
  height: calc(100% + 20px);
  pointer-events: none;
  z-index: 3;
}
:host([data-wfx-off]) .wfx { visibility: hidden; }
:host(:not([data-wfx-card])) .wfx { display: none; }
button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
.press:active { transform: scale(0.97); }
.tile:active { transform: scale(0.97); }
.tile:has(.ctov:active) { transform: none; }
.ct:active { transform: scale(0.85); }
.acc { transition: transform 220ms var(--lumen-ease-spring); }
.acc:active:not([aria-disabled="true"]) { transform: scale(0.94); }
.acfab:active { transform: scale(0.9); }
.seg:hover, .seg:active { background: var(--lumen-surface-solid) !important; color: var(--lumen-text-1) !important; }
.seg:active { transform: scale(0.94); }
[role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--lumen-accent); outline-offset: 2px; }
`;

export const glass = "backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4)";

const TONES = new Set(["ok", "warning", "danger", "info", "unavailable", "accent", "orange"]);

/** Semantic colour token; unknown names fall back to the accent (never raw config into CSS). */
export const tone = (t: string) => `var(--lumen-${TONES.has(t) ? t : "accent"})`;

export const prevent = (e: Event) => e.preventDefault();
export const stop = (e: Event) => e.stopPropagation();

// HA's named colours (the `ui_color` selector), as in frontend src/common/color/compute-color.ts.
const HA_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue", "cyan", "teal",
  "green", "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown", "light-grey", "grey",
  "dark-grey", "blue-grey", "black", "white", "disabled",
]);

/**
 * A colour from the config: an HA colour name (`ui_color` selector), a hex / rgb() string or an
 * RGB triple (`color_rgb`). Anything else (e.g. CSS declarations) is rejected → undefined.
 */
export function cssColor(c: unknown): string | undefined {
  if (Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(Number(v)))) return `rgb(${c.map(Number).join(",")})`;
  if (typeof c !== "string" || !c) return undefined;
  if (c === "none" || c === "state") return undefined;
  if (HA_COLORS.has(c)) return `var(--${c}-color)`;
  if (/^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl|oklch)a?\([\d\s.,%/-]+\)$/i.test(c)) return c;
  return undefined;
}

export const colorOr = (c: unknown, fallback: string): string => cssColor(c) ?? fallback;
