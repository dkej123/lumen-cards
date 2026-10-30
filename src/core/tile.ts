import { html, nothing, type TemplateResult } from "lit";
import { iconBox, surfaceStyle, titleSub, unplugged, WFX, type TileLook } from "./parts";
import { pressable, spinnerStyle, type PressHandlers } from "./press";

// Row tile of the Lumen Cards catalog (`R`), shared by the entity, button and person cards.
// Colours come in as a `TileLook` (parts.ts) so each card keeps its own state logic.

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


const spinner = (o: TileOpts) => (o.busy ? html`<span style=${spinnerStyle(10, "position:absolute;top:7px;right:7px")}></span>` : nothing);

/** Full-width row (catalog `R`): icon 34, title 14/700, second line 13/650 with a muted meta. */
export function rowTile(o: TileOpts) {
  const label = o.label ?? [o.title, o.sub].filter(Boolean).join(" · ");
  return html`<div data-fx ${pressable(o.handlers)} class=${o.handlers ? "press" : ""} aria-label=${label} aria-busy=${o.busy ? "true" : nothing}
    style="position:relative;display:flex;align-items:center;gap:10px;min-width:0;padding:11px 12px;box-sizing:border-box;border-radius:20px;${surfaceStyle(o.look, !!o.handlers)}">${WFX}
    <div style="position:relative;display:flex;align-items:center;gap:10px;min-height:34px;flex:1;min-width:0">
      ${typeof o.lead === "string" ? iconBox(o.lead, o.look, o.iconAnim) : (o.lead ?? nothing)}
      ${titleSub(o.title, o.sub, { subC: o.look.subC, meta: o.meta, badge: o.badge, showTitle: o.showTitle, showSub: o.showSub !== false && !!(o.sub || o.meta) })}
      ${o.trailing ?? nothing}
      ${o.plug ? unplugged() : nothing}
    </div>
    ${spinner(o)}
  </div>`;
}

