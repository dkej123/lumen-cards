// Shared CSS of every card: the host look and the interaction states of the design
// minus the prototype frame.

export const shared = `
/* Tone tokens of the catalog (section 16) and the accent's ink; a user colour overrides them on the host. */
:host { --lumen-tone-k: 78%; --lumen-tone-mix: #000; --lumen-on-tone: #FFFFFF; --lumen-accent-ink: var(--lumen-accent); }
:host([data-lumen-theme=dark]) { --lumen-tone-k: 82%; --lumen-tone-mix: #fff; --lumen-on-tone: #14110E; }
@keyframes lumenPendingPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--lumen-orange) 50%, transparent), var(--lumen-shadow-1); } 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--lumen-orange) 0%, transparent), var(--lumen-shadow-1); } }
@keyframes lumenNudge { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(2px); } }
@keyframes lumenIndeterminate { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
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

const TONES = new Set(["ok", "warning", "danger", "info", "unavailable", "accent", "orange", "text-3"]);

/** Semantic colour token; unknown names fall back to the accent (never raw config into CSS). */
export const tone = (t: string) => `var(--lumen-${TONES.has(t) ? t : "accent"})`;

export const prevent = (e: Event) => e.preventDefault();
export const stop = (e: Event) => e.stopPropagation();

// HA's named colours (the `ui_color` selector), as in frontend src/common/color/compute-color.ts.
// Values are HA's defaults, used as the var() fallback outside HA (gallery, other dashboards' themes).
const HA_COLORS = new Map([
  ["primary", "#03a9f4"], ["accent", "#ff9800"], ["red", "#f44336"], ["pink", "#e91e63"], ["purple", "#926bc7"],
  ["deep-purple", "#6e41ab"], ["indigo", "#3f51b5"], ["blue", "#2196f3"], ["light-blue", "#03a9f4"], ["cyan", "#00bcd4"],
  ["teal", "#009688"], ["green", "#4caf50"], ["light-green", "#8bc34a"], ["lime", "#cddc39"], ["yellow", "#ffeb3b"],
  ["amber", "#ffc107"], ["orange", "#ff9800"], ["deep-orange", "#ff6f22"], ["brown", "#795548"], ["light-grey", "#bdbdbd"],
  ["grey", "#9e9e9e"], ["dark-grey", "#606060"], ["blue-grey", "#607d8b"], ["black", "#000000"], ["white", "#ffffff"],
  ["disabled", "#bdbdbd"],
]);

/**
 * A colour from the config: an HA colour name (`ui_color` selector), a hex / rgb() string or an
 * RGB triple (`color_rgb`). Anything else (e.g. CSS declarations) is rejected → undefined.
 */
export function cssColor(c: unknown): string | undefined {
  if (Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(Number(v)))) return `rgb(${c.map(Number).join(",")})`;
  if (typeof c !== "string" || !c) return undefined;
  if (c === "none" || c === "state") return undefined;
  if (HA_COLORS.has(c)) return `var(--${c}-color, ${HA_COLORS.get(c)})`;
  if (/^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl|oklch)a?\([\d\s.,%/-]+\)$/i.test(c)) return c;
  // Lumen's own tokens (exact Dom tones: var(--lumen-danger), var(--lumen-info)…).
  if (/^var\(--lumen-[a-z0-9-]+\)$/.test(c)) return c;
  return undefined;
}

export const colorOr = (c: unknown, fallback: string): string => cssColor(c) ?? fallback;

/** Icon / text colour of a user colour C (section 16): 78 % C with black (light), 82 % with white (dark). */
export const ink = (c: string) => `color-mix(in oklch, ${c} var(--lumen-tone-k), var(--lumen-tone-mix))`;

/**
 * The whole set derived from one user colour C (catalog section 16), the same in both themes:
 * fill C at --lumen-fill-a → --lumen-fill-b, glow C 55 %, icon background C 16 %,
 * shadow 0 10px 30px -14px C 70 %, icon / text ink(C).
 */
export function colorSet(c: string) {
  const fillA = `color-mix(in srgb, ${c} var(--lumen-fill-a), transparent)`;
  const fillB = `color-mix(in srgb, ${c} var(--lumen-fill-b), transparent)`;
  return {
    fillA,
    fillB,
    fill: `linear-gradient(90deg, ${fillA}, ${fillB})`,
    glow: `radial-gradient(circle, color-mix(in srgb, ${c} 55%, transparent) 0%, transparent 62%)`,
    iconBg: `color-mix(in srgb, ${c} 16%, transparent)`,
    shadow: `0 10px 30px -14px color-mix(in srgb, ${c} 70%, transparent)`,
    ink: ink(c),
    border: `color-mix(in srgb, ${c} 40%, var(--lumen-border))`,
  };
}

/** Host custom properties of a user colour: `--lumen-<name>` plus -soft, -ink, -shadow, -fill-a/-b, -glow. */
export function colorVars(name: string, c: string): Record<string, string> {
  const s = colorSet(c);
  return {
    [`--lumen-${name}`]: c,
    [`--lumen-${name}-soft`]: s.iconBg,
    [`--lumen-${name}-ink`]: s.ink,
    [`--lumen-${name}-shadow`]: s.shadow,
    [`--lumen-${name}-fill-a`]: s.fillA,
    [`--lumen-${name}-fill-b`]: s.fillB,
    [`--lumen-${name}-glow`]: s.glow,
  };
}
