import { html, nothing, type TemplateResult } from "lit";
import { icon } from "./lumen-icon";
import { WFX } from "./parts";
import { pressable, spinnerStyle, type PressHandlers } from "./press";
import { glass } from "./styles";

// Row and compact square tiles of the Lumen Cards catalog (`R` and `C`), shared by the entity,
// button and person cards. Colours come in as a `TileLook` so each card keeps its own state logic.


export interface TileLook {
  /** Icon cell background / glyph colour. */
  iconBg: string;
  iconFg: string;
  /** Second line colour. */
  subC: string;
  border?: string;
  bg?: string;
  shadow?: string;
}

/** Neutral (off, idle). */
export const NEUTRAL: TileLook = { iconBg: "var(--lumen-surface-2)", iconFg: "var(--lumen-text-2)", subC: "var(--lumen-text-2)" };
/** On / active: accent glyph on 16 % accent. */
export const ACCENT: TileLook = { iconBg: "var(--lumen-accent-soft)", iconFg: "var(--lumen-accent)", subC: "var(--lumen-text-2)" };
/** unknown: "No data", actions stay. */
export const UNKNOWN: TileLook = { iconBg: "var(--lumen-surface-2)", iconFg: "var(--lumen-text-3)", subC: "var(--lumen-text-3)" };
/** unavailable: dashed frame on surface-2, no shadow. */
export const UNAVAILABLE: TileLook = {
  iconBg: "transparent",
  iconFg: "var(--lumen-unavailable)",
  subC: "var(--lumen-text-3)",
  border: "1px dashed var(--lumen-border-strong)",
  bg: "var(--lumen-surface-2)",
  shadow: "none",
};

/** A semantic tone (`var(--lumen-ok)`…): glyph on 16 %, second line in the tone. */
export const toneLook = (c: string, border?: string): TileLook => ({ iconBg: `color-mix(in srgb, ${c} 16%, transparent)`, iconFg: c, subC: c, border });

/** `1px solid` tone mixed into the border (waiting / error frames). */
export const toneBorder = (c: string, pct: number) => `1px solid color-mix(in srgb, ${c} ${pct}%, var(--lumen-border))`;

export interface TileOpts {
  title: string;
  sub?: string;
  /** Muted text after the second line ("3 h"). */
  meta?: string;
  /** Small mono badge after the title ("BLE"). */
  badge?: string;
  look: TileLook;
  /** Icon name, or a ready template (avatar). */
  lead?: string | TemplateResult;
  /** Glyph animation (spin, breath). */
  iconAnim?: string;
  /** Right side: sub-buttons. */
  trailing?: unknown;
  handlers?: PressHandlers;
  /** Spinner in the top-right corner. */
  busy?: boolean;
  /** Plug-off glyph on the right (unavailable). */
  plug?: boolean;
  /** Accessible name; default "title · sub". */
  label?: string;
  showTitle?: boolean;
  showSub?: boolean;
}

const leadCell = (o: TileOpts, size: number, radius: number, font: number) =>
  typeof o.lead === "string"
    ? html`<div style="flex:none;width:${size}px;height:${size}px;border-radius:${radius}px;display:grid;place-items:center;font-size:${font}px;background:${o.look.iconBg};color:${o.look.iconFg};transition:background-color 500ms, color 500ms">${icon(o.lead, `display:block;animation:${o.iconAnim ?? "none"}`)}</div>`
    : (o.lead ?? nothing);

const frame = (o: TileOpts) => {
  const l = o.look;
  return `background:${l.bg ?? "var(--lumen-surface)"};border:${l.border ?? "1px solid var(--lumen-border)"};box-shadow:${l.shadow ?? "var(--lumen-shadow-1)"};${l.bg ? "" : glass};cursor:${o.handlers ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:background-color 500ms, border-color 500ms, transform 220ms var(--lumen-ease-spring)`;
};

const spinner = (o: TileOpts) => (o.busy ? html`<span style=${spinnerStyle(10, "position:absolute;top:7px;right:7px")}></span>` : nothing);

/** Full-width row (catalog `R`): icon 34, title 14/700, second line 13/650 with a muted meta. */
export function rowTile(o: TileOpts) {
  const label = o.label ?? [o.title, o.sub].filter(Boolean).join(" · ");
  return html`<div data-fx ${pressable(o.handlers)} class=${o.handlers ? "press" : ""} aria-label=${label} aria-busy=${o.busy ? "true" : nothing}
    style="position:relative;display:flex;align-items:center;gap:10px;min-width:0;padding:11px 12px;box-sizing:border-box;border-radius:20px;${frame(o)}">${WFX}
    <div style="position:relative;display:flex;align-items:center;gap:10px;min-height:34px;flex:1;min-width:0">
      ${leadCell(o, 34, 12, 19)}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
        ${o.showTitle !== false
          ? html`<div style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:14px;font-weight:700;letter-spacing:-0.01em;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.title}</span>${o.badge
              ? html`<span style="flex:none;padding:1px 6px;border-radius:6px;background:var(--lumen-surface-2);font:500 10px/14px var(--lumen-mono);color:var(--lumen-text-2)">${o.badge}</span>`
              : nothing}</div>`
          : nothing}
        ${o.showSub !== false && (o.sub || o.meta)
          ? html`<div style="font-size:13px;line-height:17px;font-weight:650;color:${o.look.subC};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.sub}${o.meta ? html`<span style="margin-left:8px;color:var(--lumen-text-3);font-weight:600">${o.meta}</span>` : nothing}</div>`
          : nothing}
      </div>
      ${o.trailing ?? nothing}
      ${o.plug ? icon("mdi:power-plug-off-outline", "flex:none;font-size:18px;color:var(--lumen-text-3)") : nothing}
    </div>
    ${spinner(o)}
  </div>`;
}

