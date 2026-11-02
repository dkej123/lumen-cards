import { html, nothing, render, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from "lit";
import { tokens } from "../design/tokens";
import { composedAncestors, isHaView, viewOf } from "./dom";
import { shared } from "./styles";

// Sheets, dialogs, FABs and the brightness HUD of the design are positioned in the
// panel frame (`position:absolute; inset:0`). A Lovelace card is small and its ancestors
// may be transformed (sections grid, edit mode, wind sway), so these pieces render into
// a full-screen layer on <body> instead: same templates, the viewport is the frame.

const LAYER_CSS = `
:host { position: fixed; inset: 0; z-index: 6; pointer-events: none; display: block; font-family: var(--lumen-font); color: var(--lumen-text-1); -webkit-font-smoothing: antialiased; }
.root > * { pointer-events: auto; }
`;

let sheets: CSSStyleSheet[] | undefined;
const styleSheets = (): CSSStyleSheet[] => {
  if (!sheets) {
    const extra = new CSSStyleSheet();
    extra.replaceSync(shared + LAYER_CSS);
    sheets = [tokens.styleSheet!, extra];
  }
  return sheets;
};

export class LumenLayerElement extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.adoptedStyleSheets = styleSheets();
  }
}
if (typeof customElements !== "undefined" && !customElements.get("lumen-cards-layer")) customElements.define("lumen-cards-layer", LumenLayerElement);

type Content = TemplateResult | typeof nothing;

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focused element across shadow roots. */
const deepActive = (): HTMLElement | null => {
  let a = document.activeElement as HTMLElement | null;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
  return a;
};

/**
 * HA hides a card or a whole section with a visibility condition (e.g. screen width) by
 * `hidden` on its hui-card / hui-section wrapper, but keeps it connected: its floating button
 * must not show then (one copy of a card per screen size).
 */
export function hiddenByHa(host: Element): boolean {
  for (const el of composedAncestors(host)) {
    if (el instanceof HTMLElement && el.localName.startsWith("hui-") && el.hidden) return true;
    if (isHaView(el)) return false;
  }
  return false;
}

/**
 * Renders `content()` into a body-level layer after every host update; removed when empty.
 * A `[role=dialog]` in the layer gets dialog behaviour: focus moves into it, Tab stays inside,
 * Escape calls `close`, and focus returns to where it was when the dialog goes away.
 */
export class LayerController implements ReactiveController {
  private el?: LumenLayerElement;
  /** The dashboard view the card is in: FABs keep to its edges (not over HA's sidebar). */
  private view?: Element;
  private viewRo?: ResizeObserver;
  private dialog?: HTMLElement;
  private returnFocus?: HTMLElement | null;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private content: () => Content,
    private close?: () => void,
  ) {
    host.addController(this);
  }

  /** First path segment of the dashboard the card was shown on (HA keeps other dashboards alive). */
  private home?: string;
  private onNavigate = () => this.host.requestUpdate();

  hostConnected(): void {
    window.addEventListener("location-changed", this.onNavigate);
    window.addEventListener("popstate", this.onNavigate);
  }

  /**
   * The card is really on screen: its dashboard is the open one and its view is laid out. HA keeps
   * a dashboard you left connected in the background – without this its floating buttons and
   * dialogs (in a body-level layer) would show over the next dashboard.
   */
  private onScreen(): boolean {
    // An update can still run after the card left the page: its layer would stay behind for good.
    if (!this.host.isConnected || hiddenByHa(this.host)) return false;
    const seg = location.pathname.split("/")[1] ?? "";
    const view = this.view?.isConnected ? this.view : viewOf(this.host);
    if (view) {
      const r = view.getBoundingClientRect();
      if (!r.width && !r.height) return false;
    }
    if (this.home === undefined) this.home = seg;
    return seg === this.home;
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.dialog) return;
    if (e.key === "Escape" && this.close) {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = [...this.dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const active = this.el?.shadowRoot?.activeElement;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (active === first || !this.dialog.contains(active ?? null))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !this.dialog.contains(active ?? null))) {
      e.preventDefault();
      first.focus();
    }
  };

  private syncDialog(): void {
    const dlg = this.el?.shadowRoot?.querySelector<HTMLElement>('[role="dialog"]') ?? undefined;
    if (dlg === this.dialog) return;
    if (dlg && !this.dialog) this.returnFocus = deepActive();
    this.dialog = dlg;
    // An open dialog sits above every other card's layer (floating buttons included).
    if (this.el) this.el.style.zIndex = dlg ? "7" : "";
    if (dlg) {
      if (!dlg.hasAttribute("tabindex")) dlg.setAttribute("tabindex", "-1");
      // The dialog itself takes focus (no ring on the close button when opened by touch); Tab goes inside.
      dlg.style.outline = "none";
      requestAnimationFrame(() => dlg.focus({ preventScroll: true }));
    } else this.restoreFocus();
  }

  private restoreFocus(): void {
    const back = this.returnFocus;
    this.returnFocus = undefined;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }

  /** The layer's root (for querying rendered elements), if shown. */
  get root(): ShadowRoot | undefined {
    return this.el?.shadowRoot ?? undefined;
  }

  hostUpdated(): void {
    if (!this.onScreen()) {
      // Off screen: no layer, and its FAB slot goes to the cards that are shown.
      releaseFab(this.host);
      this.teardown();
      return;
    }
    const tpl = this.content();
    if (tpl === nothing) {
      this.teardown();
      return;
    }
    if (!this.el) {
      this.el = document.createElement("lumen-cards-layer") as LumenLayerElement;
      this.el.addEventListener("keydown", this.onKey);
      document.body.append(this.el);
    }
    // Theme and per-card overrides (accent) follow the card.
    this.el.setAttribute("data-lumen-theme", this.host.getAttribute("data-lumen-theme") ?? "light");
    // Only custom properties: the host itself may be hidden (display:none) while its layer shows.
    const vars: string[] = [];
    for (let i = 0; i < this.host.style.length; i++) {
      const name = this.host.style.item(i);
      if (name.startsWith("--")) vars.push(`${name}:${this.host.style.getPropertyValue(name)}`);
    }
    vars.push(...this.viewEdges());
    this.el.style.cssText = vars.join(";") + (this.dialog ? ";z-index:7" : "");
    render(html`<div class="root">${tpl}</div>`, this.el.shadowRoot!, { host: this.host });
    this.syncDialog();
  }

  hostDisconnected(): void {
    window.removeEventListener("location-changed", this.onNavigate);
    window.removeEventListener("popstate", this.onNavigate);
    this.teardown();
  }

  /** `--lumen-fab-view-left/right`: distance of the view's edges from the window's (HA sidebar etc.). */
  private viewEdges(): string[] {
    if (!this.view?.isConnected) {
      this.viewRo?.disconnect();
      this.view = viewOf(this.host);
      if (this.view && typeof ResizeObserver !== "undefined") {
        // The sidebar opening / closing moves the view without a window resize.
        this.viewRo = new ResizeObserver(() => this.host.requestUpdate());
        this.viewRo.observe(this.view);
      }
    }
    if (!this.view) return [];
    const r = this.view.getBoundingClientRect();
    if (!r.width) return [];
    const right = Math.max(0, document.documentElement.clientWidth - r.right);
    return [`--lumen-fab-view-left:${Math.max(0, Math.round(r.left))}px`, `--lumen-fab-view-right:${Math.round(right)}px`];
  }

  private teardown(): void {
    this.viewRo?.disconnect();
    this.viewRo = undefined;
    this.view = undefined;
    if (!this.el) return;
    render(nothing, this.el.shadowRoot!, { host: this.host });
    this.el.removeEventListener("keydown", this.onKey);
    this.el.remove();
    this.el = undefined;
    if (this.dialog) {
      this.dialog = undefined;
      this.restoreFocus();
    }
  }
}


// Floating buttons of several cards stack upwards from a bottom corner instead of covering each
// other (catalog A10): the lowest FAB is 64 px, every next one 48 px, 12 px above the previous one,
// all with the same outer edge (owner: aligned to the screen edge, 16 px from it). Each card picks
// its side (`fab_side`, for left-handed use); every side is its own stack. Order from the bottom:
// scenes, climate / floating panels, alarm (`FAB_ORDER`), then the order of registration.
type FabOwner = { requestUpdate(): void };
export type FabSide = "right" | "left";
const fabs: { owner: FabOwner; order: number; side: FabSide }[] = [];

export const FAB_ORDER = { scenes: 0, climate: 1, panels: 1, alarm: 2 } as const;
/** Size (px) of the lowest FAB and of the ones stacked above it. */
export const FAB_MAIN = 64;
export const FAB_SMALL = 48;
const FAB_GAP = 12;

const refreshFrom = (i: number, side: FabSide) => fabs.slice(i).forEach((f) => f.side === side && f.owner.requestUpdate());

/** Slot (0 = lowest) of a FAB owner in the stack of its side; registers it on first use. */
export function fabSlot(owner: FabOwner, order: number = FAB_ORDER.climate, side: FabSide = "right"): number {
  let i = fabs.findIndex((f) => f.owner === owner);
  if (i === -1 || fabs[i].order !== order || fabs[i].side !== side) {
    if (i !== -1) {
      const old = fabs[i];
      fabs.splice(i, 1);
      refreshFrom(i, old.side);
    }
    let at = fabs.findIndex((f) => f.order > order);
    if (at === -1) at = fabs.length;
    fabs.splice(at, 0, { owner, order, side });
    // The ones above moved up a slot.
    refreshFrom(at + 1, side);
    i = at;
  }
  return fabs.slice(0, i).filter((f) => f.side === side).length;
}

/** The owner's FAB is gone: the ones above move down. */
export function releaseFab(owner: FabOwner): void {
  const i = fabs.findIndex((f) => f.owner === owner);
  if (i === -1) return;
  const [gone] = fabs.splice(i, 1);
  refreshFrom(i, gone.side);
}

/** Size (px) of the FAB in `slot`. */
export const fabSize = (slot: number) => (slot === 0 ? FAB_MAIN : FAB_SMALL);

/** `bottom:` of a FAB in `slot`; themes move the stack with --lumen-cards-fab-bottom. */
export const fabBottom = (slot: number) =>
  `calc(var(--lumen-cards-fab-bottom, 24px) + ${slot === 0 ? 0 : FAB_MAIN + FAB_GAP + (slot - 1) * (FAB_SMALL + FAB_GAP)}px + env(safe-area-inset-bottom))`;

/** Distance of every FAB's outer edge from the screen edge (themes: --lumen-cards-fab-right / -left). */
export const fabInset = (side: FabSide = "right") => `calc(var(--lumen-fab-view-${side}, 0px) + var(--lumen-cards-fab-${side}, 16px))`;

/** `right:` / `left:` declaration of a FAB on `side`. */
export const fabEdge = (side: FabSide = "right") => `${side}:${fabInset(side)}`;

/** `fab_side` from a card config. */
export const fabSideOf = (c: { fab_side?: unknown } | undefined): FabSide => (c?.fab_side === "left" ? "left" : "right");

/**
 * A card's floating button in the stack of its side: `place()` gives its slot and position while
 * the card shows it; the slot is given back when the card stops showing it or leaves the page.
 */
export class FabController implements ReactiveController {
  constructor(
    private host: ReactiveControllerHost,
    private order: number,
    /** The card shows its FAB now. */
    private shown: () => boolean,
    private side: () => FabSide,
  ) {
    host.addController(this);
  }

  /** Slot (0 = lowest), side, `bottom:` and edge (`right:` / `left:`) declarations, size for the slot. */
  place() {
    const side = this.side();
    const slot = fabSlot(this.host, this.order, side);
    return { side, slot, bottom: fabBottom(slot), edge: fabEdge(side), size: fabSize(slot) };
  }

  hostUpdated(): void {
    if (!this.shown()) releaseFab(this.host);
  }

  hostDisconnected(): void {
    releaseFab(this.host);
  }
}
