import { html, nothing, type ReactiveController, type ReactiveControllerHost } from "lit";
import type { HassEntity } from "../hass/types";
import { fractionAt } from "../logic/slider";
import { DragTicks, haptic } from "./actions";
import { Pending } from "./controllers/pending";
import { icon } from "./lumen-icon";
import { WFX } from "./parts";
import { spinnerStyle } from "./press";
import { glass, prevent, stop } from "./styles";

// Slider tiles of the catalog (section 14: cover, fan, number) and the thin bars (cover tilt,
// media volume / progress). Behaviour from the handoff ("Zachowanie"): pointerdown, then a
// horizontal move > 6 px sets the value from the finger (setPointerCapture, touch-action
// pan-y); without a move it is a tap. Buttons inside stop the pointer events.


export interface SlideOpts {
  /** Dragging allowed (entity available and settable). */
  enabled: () => boolean;
  /** Final value 0..1 on release (or on a tap with `tapSets`). */
  commit: (f: number) => void;
  /** Every position while dragging, for controls that follow the finger. */
  live?: (f: number) => void;
  /** Entity the value belongs to: the committed value shows until HA sends a new state object. */
  source?: () => HassEntity | undefined;
  /** Pointer up without a drag (tiles); ignored with `tapSets`. */
  tap?: () => void;
  /** 500 ms press without a move. */
  hold?: () => void;
  /** Whether a hold counts now (default: always). */
  holdEnabled?: () => boolean;
  /** A tap sets the value under the finger (thin bars). */
  tapSets?: boolean;
  /** Arrow keys (±1) and Page Up / Down (big). */
  step?: (dir: 1 | -1, big: boolean) => void;
  /** Home and End commit 0 and 1. */
  ends?: boolean;
  /** Drag threshold in px (default 6). */
  threshold?: number;
}

interface Press { x0: number; y0: number; rect: DOMRect; el: HTMLElement; id: number; dragging: boolean; held: boolean; moved: boolean }

/** Pointer + keyboard logic of one slider; the card keeps one per slider. */
export class SlideDrag implements ReactiveController {
  /** Live fraction while dragging. */
  frac: number | null = null;
  private press: Press | null = null;
  private holdTimer?: number;
  /** The committed fraction until the entity answers (or 10 s). */
  private pend: Pending<number>;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private opts: SlideOpts,
  ) {
    host.addController(this);
    this.pend = new Pending<number>(host, () => this.opts.source?.());
  }

  hostDisconnected(): void {
    this.dispose();
  }

  get dragging(): boolean {
    return !!this.press?.dragging;
  }

  /** Value to show: the finger while dragging, then the committed value until the entity changes. */
  value(): number | null {
    if (this.press?.dragging && this.frac !== null) return this.frac;
    return this.pend.value ?? null;
  }


  private haptic(type = "light") {
    haptic(this.host, type);
  }

  /** Gentle ticks every 1 % while the value is dragged. */
  private ticks = new DragTicks(1);

  private finish(f: number) {
    this.pend.set(f);
    this.haptic();
    this.opts.commit(f);
  }

  /** The command failed: show the entity's own value again. */
  clear(): void {
    this.pend.clear();
  }

  dispose(): void {
    window.clearTimeout(this.holdTimer);
    this.press = null;
    this.frac = null;
  }

  private get holds(): boolean {
    return !!this.opts.hold && (this.opts.holdEnabled?.() ?? true);
  }

  readonly handlers = {
    down: (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      this.press = { x0: e.clientX, y0: e.clientY, rect: el.getBoundingClientRect(), el, id: e.pointerId, dragging: false, held: false, moved: false };
      window.clearTimeout(this.holdTimer);
      if (this.holds)
        this.holdTimer = window.setTimeout(() => {
          const p = this.press;
          if (!p || p.moved) return;
          p.held = true;
          this.press = null;
          this.haptic("medium");
          this.opts.hold!();
        }, 500);
    },
    move: (e: PointerEvent) => {
      const p = this.press;
      if (!p) return;
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      if (!p.dragging) {
        // A vertical swipe is a scroll: give the gesture back to the page.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          window.clearTimeout(this.holdTimer);
          this.press = null;
          return;
        }
        if (Math.abs(dx) <= (this.opts.threshold ?? 6)) return;
        p.moved = true;
        window.clearTimeout(this.holdTimer);
        if (!this.opts.enabled()) return;
        p.dragging = true;
        this.ticks.start(fractionAt(e.clientX, p.rect) * 100);
        try {
          p.el.setPointerCapture(p.id);
        } catch {
          /* ignore */
        }
      }
      this.frac = fractionAt(e.clientX, p.rect);
      this.ticks.move(this.host as unknown as EventTarget, Math.round(this.frac * 100), 0, 100);
      this.opts.live?.(this.frac);
      this.host.requestUpdate();
    },
    up: (e: PointerEvent) => {
      const p = this.press;
      window.clearTimeout(this.holdTimer);
      if (!p) return;
      this.press = null;
      if (p.dragging) {
        this.ticks.end();
        const f = this.frac ?? fractionAt(e.clientX, p.rect);
        this.frac = null;
        this.finish(f);
      } else if (!p.moved && !p.held) {
        if (this.opts.tapSets) {
          if (this.opts.enabled()) this.finish(fractionAt(e.clientX, p.rect));
        } else if (this.opts.tap) {
          this.haptic();
          this.opts.tap();
        }
      }
      this.host.requestUpdate();
    },
    cancel: () => {
      window.clearTimeout(this.holdTimer);
      this.press = null;
      this.frac = null;
      this.host.requestUpdate();
    },
    key: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget || e.repeat) return;
      const o = this.opts;
      if (this.holds && (e.key === "ContextMenu" || (e.key === "Enter" && e.shiftKey))) {
        e.preventDefault();
        o.hold!();
      } else if ((e.key === "Enter" || e.key === " ") && o.tap) {
        e.preventDefault();
        this.haptic();
        o.tap();
      } else if (o.ends && o.enabled() && (e.key === "Home" || e.key === "End")) {
        e.preventDefault();
        o.commit(e.key === "End" ? 1 : 0);
      } else if (o.step && o.enabled() && ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) {
        e.preventDefault();
        o.step(e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp" ? 1 : -1, e.key.startsWith("Page"));
      }
    },
  };
}

export interface SliderLook {
  title: string;
  sub: string;
  /** Second, quieter part of the value line (design `meta`). */
  meta?: string;
  subColor?: string;
  icon: string;
  iconBg: string;
  iconFg: string;
  iconAnim?: string;
  /** Fill 0–100 (null = none). */
  fill: number | null;
  fillColor: string;
  /** Lit look (design `lit()`): glow, tinted border and shadow. */
  lit?: boolean;
  una?: boolean;
  /** Small spinner in the top-right corner (command on its way / moving). */
  spin?: boolean;
  compact: boolean;
  /** Name for screen readers. */
  label: string;
  pressed?: boolean;
  /** Pick button, sub-buttons… on the right of the first row. */
  trailing?: unknown;
  /** Second row (cover buttons, tilt bar); hidden when compact. */
  below?: unknown;
  /** The tile is a slider, not a button (0–100, with spoken value). */
  slider?: { now: number; text: string };
  /** Keyboard hint (aria-keyshortcuts). */
  keys?: string;
  /** Border override (e.g. the open select). */
  border?: string;
}

/** Row tile of the catalog (design `R()`), wide or compact. */
export function sliderTile(look: SliderLook, drag: SlideDrag | undefined, interactive = true) {
  const h = drag?.handlers;
  const c = look.compact;
  const fill = look.fill === null ? 0 : Math.max(0, Math.min(100, look.fill));
  const col = look.fillColor;
  const border = look.border ?? (look.una ? "1px dashed var(--lumen-border-strong)" : look.lit ? `1px solid color-mix(in srgb, ${col} 40%, var(--lumen-border))` : "1px solid var(--lumen-border)");
  const shadow = look.una ? "none" : look.lit ? `0 10px 30px -14px color-mix(in srgb, ${col} 70%, transparent), var(--lumen-shadow-1)` : "var(--lumen-shadow-1)";
  const tr = drag?.dragging ? "width 60ms linear" : "width 620ms var(--lumen-ease-spring)";
  return html`<div data-fx class="ltile" role=${!interactive ? nothing : look.slider ? "slider" : "button"} tabindex=${interactive ? 0 : nothing} aria-label="${look.label}" aria-valuemin=${look.slider && interactive ? 0 : nothing} aria-valuemax=${look.slider && interactive ? 100 : nothing} aria-valuenow=${look.slider && interactive ? look.slider.now : nothing} aria-valuetext=${look.slider && interactive ? look.slider.text : nothing} aria-pressed=${look.slider ? nothing : (look.pressed ?? nothing)} aria-disabled=${look.una ? "true" : nothing} aria-keyshortcuts=${look.keys ?? nothing}
    @pointerdown=${h?.down} @pointermove=${h?.move} @pointerup=${h?.up} @pointercancel=${h?.cancel} @keydown=${h?.key} @contextmenu=${prevent}
    style="position:relative;isolation:isolate;display:flex;flex-direction:column;gap:10px;min-height:${c ? 52 : 58}px;padding:${c ? "6px 8px 6px 8px" : "11px 12px"};box-sizing:border-box;border-radius:${c ? 18 : 20}px;background:${look.una ? "var(--lumen-surface-2)" : "var(--lumen-surface)"};border:${border};box-shadow:${shadow};${glass};color:var(--lumen-text-1);cursor:${interactive && !look.una ? "pointer" : "default"};touch-action:pan-y;user-select:none;-webkit-user-select:none;transition:box-shadow 700ms var(--lumen-ease-out), border-color 400ms, transform 240ms var(--lumen-ease-spring)">${WFX}
    <div style="position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none">
      <div style="position:absolute;inset:0 auto 0 0;width:${fill}%;background:linear-gradient(90deg, color-mix(in srgb, ${col} var(--lumen-fill-a), transparent), color-mix(in srgb, ${col} var(--lumen-fill-b), transparent));mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);-webkit-mask-image:linear-gradient(90deg, #000 calc(100% - 36px), transparent);transition:${tr}"></div>
      <div style="position:absolute;top:-70%;right:-35%;width:120%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle, color-mix(in srgb, ${col} 55%, transparent) 0%, transparent 62%);opacity:${look.lit ? 1 : 0};transition:opacity 800ms var(--lumen-ease-out)"></div>
    </div>
    <div style="position:relative;display:flex;align-items:center;gap:${c ? 8 : 10}px;min-height:${c ? 30 : 34}px">
      <div style="flex:none;width:${c ? 30 : 34}px;height:${c ? 30 : 34}px;border-radius:${c ? 10 : 12}px;display:grid;place-items:center;font-size:${c ? 17 : 19}px;background:${look.iconBg};color:${look.iconFg};transition:background-color 500ms, color 500ms">${icon(look.icon, `display:block;animation:${look.iconAnim ?? "none"}`)}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
        <div style="font-size:${c ? 12 : 14}px;font-weight:700;${c ? "line-height:14px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere" : "letter-spacing:-0.01em;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"}">${look.title}</div>
        ${look.sub || look.meta
          ? html`<div style="font-size:${c ? 11 : 13}px;line-height:${c ? 14 : 17}px;font-weight:650;color:${look.subColor ?? "var(--lumen-text-2)"};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${look.sub}${look.meta ? html`<span style="margin-left:${look.sub ? 8 : 0}px;color:var(--lumen-text-3);font-weight:600">${look.meta}</span>` : nothing}</div>`
          : nothing}
      </div>
      ${look.trailing ?? nothing}
      ${look.una ? icon("mdi:power-plug-off-outline", "flex:none;font-size:18px;color:var(--lumen-text-3)") : nothing}
    </div>
    ${!c && look.below ? look.below : nothing}
    ${look.spin ? html`<span aria-hidden="true" style=${spinnerStyle(10, "position:absolute;top:7px;right:7px")}></span>` : nothing}
  </div>`;
}

export interface SegButton {
  icon: string;
  label: string;
  on?: boolean;
  disabled?: boolean;
  spin?: boolean;
  click: () => void;
}

/** Segment row of buttons (design `btnRow`): pointer events stay out of the tile. */
export function segButtons(btns: SegButton[], label: string) {
  return html`<div role="group" aria-label=${label} @pointerdown=${stop} @pointerup=${stop} @keydown=${stop} style="position:relative;display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--lumen-surface-2)">
    ${btns.map(
      (b) => html`<button class="seg" aria-pressed=${!!b.on} ?disabled=${!!b.disabled} @click=${(e: Event) => {
        e.stopPropagation();
        b.click();
      }} style="flex:1;min-width:0;min-height:40px;padding:0 8px;box-sizing:border-box;border:0;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:5px;background:${b.on ? "var(--lumen-surface-solid)" : "transparent"};color:${b.on ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};box-shadow:${b.on ? "var(--lumen-shadow-1)" : "none"};font:700 12px var(--lumen-font);white-space:nowrap;cursor:pointer;transition:background-color 250ms, color 250ms, box-shadow 250ms, transform 220ms var(--lumen-ease-spring)">${icon(b.spin ? "mdi:loading" : b.icon, `display:block;font-size:16px;animation:${b.spin ? "lumenSpin 900ms linear infinite" : "none"}`)}<span style="overflow:hidden;text-overflow:ellipsis">${b.label}</span></button>`,
    )}
  </div>`;
}

/**
 * Thin draggable bar (cover tilt, media volume / progress): track 6 px inside a 44 px-high touch
 * area, tap or drag sets the value. `label` is shown on the right when given.
 */
export function thinBar(o: { drag: SlideDrag; frac: number; color: string; name: string; valueText: string; label?: string; width?: string; height?: number; disabled?: boolean; min?: number; max?: number; now?: number }) {
  const h = o.drag.handlers;
  const pct = Math.max(0, Math.min(100, o.frac * 100));
  return html`<div style="position:relative;display:flex;align-items:center;gap:10px;${o.width ? `flex:none;width:${o.width}` : ""}" @pointerdown=${stop} @pointerup=${stop}>
    <div role="slider" tabindex=${o.disabled ? -1 : 0} aria-label=${o.name} aria-valuemin=${o.min ?? 0} aria-valuemax=${o.max ?? 100} aria-valuenow=${o.now ?? Math.round(pct)} aria-valuetext=${o.valueText} aria-disabled=${o.disabled ? "true" : nothing}
      @pointerdown=${h.down} @pointermove=${h.move} @pointerup=${h.up} @pointercancel=${h.cancel} @keydown=${h.key}
      style="flex:1;min-width:0;padding:${Math.max(0, (Math.min(44, 20) - (o.height ?? 6)) / 2)}px 0;margin:-4px 0;cursor:${o.disabled ? "default" : "pointer"};touch-action:pan-y;outline-offset:2px;border-radius:6px">
      <div style="height:${o.height ?? 6}px;border-radius:${(o.height ?? 6) / 2}px;background:var(--lumen-surface-2);overflow:hidden">
        <div style="width:${pct}%;height:100%;border-radius:inherit;background:${o.color};transition:${o.drag.dragging ? "none" : "width 400ms var(--lumen-ease-out)"}"></div>
      </div>
    </div>
    ${o.label !== undefined ? html`<span style="flex:none;font-size:12px;font-weight:650;color:var(--lumen-text-2);font-variant-numeric:tabular-nums">${o.label}</span>` : nothing}
  </div>`;
}

/** Card CSS of the slider tiles: pressed scale only when the press is not on a button inside. */
export const TILE_CSS = `
.ltile:active:not(:has(button:active, [role="slider"]:active, .pick:active)) { transform: scale(0.985); }
.ltile[aria-disabled="true"] { cursor: not-allowed; }
`;
