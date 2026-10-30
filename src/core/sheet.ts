import { html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from "lit";
import type { HassLike } from "../hass/types";
import { cardSpan } from "../logic/popup";
import { t } from "./i18n";
import { icon } from "./lumen-icon";

// Bottom sheet shared by the pop-up and the floating panel (catalog sections 14 and 19): from
// the bottom on every width, centred and at most 520 px wide, 85 % of the screen high, radius
// 28 28 0 0. The handle and the header stay, only the list scrolls. Closes on ✕, a tap on the
// scrim, Escape (LayerController) or a drag of the header down by more than 40 px.

export type CardConfig = Record<string, unknown> & { type?: string };
export type CardEl = HTMLElement & { hass?: HassLike; setConfig?(c: unknown): void; getGridOptions?(): { columns?: unknown }; preview?: boolean };
type Helpers = { createCardElement(c: CardConfig): CardEl };
declare global {
  interface Window {
    loadCardHelpers?: () => Promise<Helpers>;
  }
}

/** Header drag (px) that closes the sheet. */
export const SHEET_CLOSE_DRAG = 40;
const CLOSE_MS = 250;

/** HA's card helpers (its card factory), or undefined outside HA. */
export const cardHelpers = (): Promise<Helpers | undefined> => window.loadCardHelpers?.().catch(() => undefined) ?? Promise.resolve(undefined);

/** An inner card: HA's own card factory, or (outside HA) a custom element created directly. */
export async function createCard(cfg: CardConfig): Promise<CardEl> {
  const helpers = await cardHelpers();
  if (helpers) return helpers.createCardElement(cfg);
  const type = String(cfg.type ?? "");
  const el = document.createElement(type.startsWith("custom:") ? type.slice(7) : `hui-${type}-card`) as CardEl;
  try {
    el.setConfig?.(cfg);
  } catch (err) {
    const box = document.createElement("div") as CardEl;
    box.textContent = String((err as Error)?.message ?? err);
    return box;
  }
  return el;
}

/** The cards inside a sheet: built once per `cards` list, `hass` passed on, `ll-rebuild` honoured. */
export class InnerCards {
  cards: CardEl[] = [];
  private builtFor?: unknown;
  private building = false;
  private hass?: HassLike;

  /**
   * `wrap`: each card in HA's own hui-card wrapper, as HA's stacks do – its visibility
   * conditions apply and the dashboard edit mode treats it like any card (not in sheets / bar).
   */
  constructor(
    private host: ReactiveControllerHost & { preview?: boolean },
    private prepare: (c: CardConfig) => CardConfig,
    private opts: { wrap?: boolean } = {},
  ) {}

  private create(cfg: CardConfig): Promise<CardEl> {
    const Wrapper = this.opts.wrap ? customElements.get("hui-card") : undefined;
    if (!Wrapper) return createCard(cfg);
    const el = new Wrapper() as CardEl & { config?: CardConfig; load(): void };
    if (this.hass) el.hass = this.hass;
    el.preview = !!this.host.preview;
    el.config = cfg;
    el.load();
    return Promise.resolve(el);
  }

  setHass(hass: HassLike): void {
    this.hass = hass;
    for (const c of this.cards) c.hass = hass;
  }

  /** The config list changed: drop the old cards (built again on the next `build`). */
  invalidate(cfgs: unknown): boolean {
    if (this.builtFor === cfgs) return false;
    this.cards = [];
    this.builtFor = undefined;
    return true;
  }

  async build(cfgs: CardConfig[]): Promise<void> {
    if (this.builtFor === cfgs || this.building) return;
    this.building = true;
    try {
      // a config that failed validation (cards: "x") builds nothing instead of throwing
      const list = Array.isArray(cfgs) ? cfgs : [];
      const els = await Promise.all(list.map((c) => this.create(this.prepare(c ?? {}))));
      els.forEach((el, i) => this.wire(el, list[i]));
      this.cards = els;
      this.builtFor = cfgs;
    } finally {
      this.building = false;
      this.host.requestUpdate();
    }
  }

  /** hass for a new card, and `ll-rebuild` (HA's "build me again") replacing it – also the replacement. */
  private wire(el: CardEl, cfg: CardConfig | undefined): void {
    if (this.hass) el.hass = this.hass;
    el.addEventListener("ll-rebuild", (ev) => {
      ev.stopPropagation();
      this.create(this.prepare(cfg ?? {})).then((fresh) => {
        this.wire(fresh, cfg);
        this.cards = this.cards.map((x) => (x === el ? fresh : x));
        this.host.requestUpdate();
      });
    });
  }

  /** The 12-column grid of the cards (each spans its grid_options.columns, default the whole row). */
  grid(cfgs: CardConfig[] | undefined) {
    return html`<div style="display:grid;grid-template-columns:repeat(12, minmax(0, 1fr));gap:8px">${this.cards.map(
      (el, i) => html`<div style="grid-column:span ${cardSpan(cfgs?.[i] as { grid_options?: { columns?: unknown } }, el.getGridOptions?.())};min-width:0">${el}</div>`,
    )}</div>`;
  }
}

export interface SheetHead {
  title: string;
  icon?: string;
  iconBg?: string;
  iconFg?: string;
  /** Second line under the title. */
  sub?: unknown;
  /** Second line in the mono font (the pop-up's #hash). */
  subMono?: boolean;
}

/** Open / closing state, the header drag and the look of the sheet. The host decides what closing means. */
export class Sheet implements ReactiveController {
  open = false;
  closing = false;
  private dy = 0;
  private grabY: number | null = null;
  private openedAt = 0;
  private timer?: number;

  constructor(
    private host: ReactiveControllerHost,
    /** ✕, scrim, Escape or a drag down asked to close. */
    private requestClose: () => void,
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    this.dispose();
  }

  show(): void {
    window.clearTimeout(this.timer);
    this.open = true;
    this.closing = false;
    this.dy = 0;
    this.grabY = null;
    this.openedAt = performance.now();
    this.host.requestUpdate();
  }

  /** Slide out, then remove. */
  hide(): void {
    if (!this.open || this.closing) return;
    this.closing = true;
    this.host.requestUpdate();
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.open = false;
      this.closing = false;
      this.dy = 0;
      this.host.requestUpdate();
    }, CLOSE_MS);
  }

  dispose(): void {
    window.clearTimeout(this.timer);
    this.open = false;
    this.closing = false;
    this.dy = 0;
    this.grabY = null;
  }

  /** The tap that opened the sheet must not land on the scrim. */
  private scrim = () => {
    if (performance.now() - this.openedAt > 350) this.requestClose();
  };

  private close = () => this.requestClose();

  private grab = {
    down: (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      this.grabY = e.clientY;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    move: (e: PointerEvent) => {
      if (this.grabY === null) return;
      this.dy = Math.max(0, e.clientY - this.grabY);
      this.host.requestUpdate();
    },
    up: () => {
      if (this.grabY === null) return;
      this.grabY = null;
      if (this.dy > SHEET_CLOSE_DRAG) this.requestClose();
      else this.dy = 0;
      this.host.requestUpdate();
    },
  };

  /** The header row (also used by the static editor previews). */
  static header(h: SheetHead, close?: () => void) {
    return html`<div style="display:flex;align-items:center;gap:12px;min-width:0">
      ${h.icon
        ? html`<span style="flex:none;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:${h.iconBg ?? "var(--lumen-surface-2)"};color:${h.iconFg ?? "var(--lumen-text-2)"};transition:background-color 400ms, color 400ms">${icon(h.icon, "display:block")}</span>`
        : nothing}
      <div style="flex:1;min-width:0">
        <div style="font-size:17px;font-weight:800;letter-spacing:-0.01em;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.title}</div>
        ${h.sub
          ? html`<div style="${h.subMono ? "font:500 11px/16px var(--lumen-mono);color:var(--lumen-text-3)" : "font-size:12px;font-weight:650;line-height:16px;color:var(--lumen-text-2);font-variant-numeric:tabular-nums"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h.sub}</div>`
          : nothing}
      </div>
      ${close
        ? html`<button aria-label=${t("common.close")} @click=${close} style="flex:none;width:40px;height:40px;border:0;padding:0;border-radius:50%;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-2);color:var(--lumen-text-2);cursor:pointer">${icon("mdi:close", "display:block")}</button>`
        : nothing}
    </div>`;
  }

  /** ✕ of a custom header (see `render` opts.head). */
  get closeHandler() {
    return this.close;
  }

  /**
   * Scrim + sheet for the body-level layer. `extra` sits between the header and the list (fixed).
   * `opts.head` replaces the header row (weather sheet), `opts.body` the list padding / gap.
   */
  render(h: SheetHead, body: unknown, extra: unknown = nothing, opts: { head?: unknown; body?: string; maxHeight?: string } = {}): TemplateResult {
    const closing = this.closing;
    const dragging = this.grabY !== null;
    return html`<div style="position:absolute;inset:0;z-index:40">
      <div @click=${this.scrim} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:${closing ? `lumenFadeOut ${CLOSE_MS}ms forwards` : "lumenFadeIn 200ms ease-out both"}"></div>
      <div role="dialog" aria-modal="true" aria-label=${h.title} style="position:absolute;left:0;right:0;bottom:0;margin:0 auto;max-width:520px;max-height:${opts.maxHeight ?? "85%"};display:flex;flex-direction:column;animation:${closing ? `lumenSheetOut ${CLOSE_MS}ms var(--lumen-ease-in-out) forwards` : "lumenSheetIn 280ms cubic-bezier(.2,.8,.2,1) both"}">
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;border-radius:28px 28px 0 0;background:var(--lumen-surface-solid);color:var(--lumen-text-1);box-shadow:var(--lumen-shadow-2);transform:translateY(${this.dy}px);transition:${dragging ? "none" : "transform 320ms cubic-bezier(.2,.8,.2,1)"}">
          <div @pointerdown=${this.grab.down} @pointermove=${this.grab.move} @pointerup=${this.grab.up} @pointercancel=${this.grab.up}
            style="flex:none;display:flex;flex-direction:column;${opts.head ? "padding:10px 18px 0;border-bottom:1px solid var(--lumen-border)" : "gap:10px;padding:10px 14px 0"};touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab">
            <span style="align-self:center;width:36px;height:5px;border-radius:3px;background:var(--lumen-border-strong)"></span>
            ${opts.head ?? Sheet.header(h, this.close)}
          </div>
          ${extra}
          <div class="lumen-noscroll" style="--lumen-sheet-row-shadow:none;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;${opts.body ?? "gap:8px;padding:12px 14px calc(16px + env(safe-area-inset-bottom))"}">${body}</div>
        </div>
      </div>
    </div>`;
  }
}

/** Empty state of a sheet without cards (catalog section 19). */
export const emptySheet = (title: string, text: string) =>
  html`<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 18px 22px;text-align:center">
    <span style="width:52px;height:52px;border-radius:18px;display:grid;place-items:center;font-size:26px;background:var(--lumen-surface-2);color:var(--lumen-text-3)">${icon("mdi:card-plus-outline", "display:block")}</span>
    <div style="font-size:15px;font-weight:750">${title}</div>
    <div style="max-width:240px;font-size:13px;font-weight:500;line-height:1.5;color:var(--lumen-text-2);text-wrap:pretty">${text}</div>
  </div>`;

/**
 * Window of the light details and the air quality chart: a bottom sheet on a narrow screen, a
 * centred modal (`wideWidth`) otherwise, over a 6 px blurred scrim. `panel` is the card's own box.
 */
export function adaptiveSheet(o: { narrow: boolean; closing: boolean; label: string; wideWidth: number; onScrim: () => void; panel: unknown }) {
  const anim = o.closing
    ? o.narrow ? "lumenSheetOut 250ms var(--lumen-ease-in-out) forwards" : "lumenModalOut 220ms ease forwards"
    : o.narrow ? "lumenSheetIn 560ms var(--lumen-ease-spring) both" : "lumenModalIn 460ms var(--lumen-ease-spring) both";
  return html`<div style="position:absolute;inset:0;z-index:50;display:flex;align-items:${o.narrow ? "flex-end" : "center"};justify-content:center;padding:${o.narrow ? "0" : "24px"};box-sizing:border-box;font-family:var(--lumen-font);color:var(--lumen-text-1)">
    <div @click=${o.onScrim} style="position:absolute;inset:0;background:var(--lumen-scrim);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:${o.closing ? "lumenFadeOut 250ms forwards" : "lumenFadeIn 300ms both"}"></div>
    <div role="dialog" aria-modal="true" aria-label=${o.label} style="position:relative;width:100%;max-width:${o.narrow ? "520px" : `${o.wideWidth}px`};animation:${anim}">${o.panel}</div>
  </div>`;
}
