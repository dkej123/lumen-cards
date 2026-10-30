import { html, nothing, render, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from "lit";
import { tokens } from "../design/tokens";
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
 * Renders `content()` into a body-level layer after every host update; removed when empty.
 * A `[role=dialog]` in the layer gets dialog behaviour: focus moves into it, Tab stays inside,
 * Escape calls `close`, and focus returns to where it was when the dialog goes away.
 */
export class LayerController implements ReactiveController {
  private el?: LumenLayerElement;
  private dialog?: HTMLElement;
  private returnFocus?: HTMLElement | null;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private content: () => Content,
    private close?: () => void,
  ) {
    host.addController(this);
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
    this.el.style.cssText = vars.join(";") + (this.dialog ? ";z-index:7" : "");
    render(html`<div class="root">${tpl}</div>`, this.el.shadowRoot!, { host: this.host });
    this.syncDialog();
  }

  hostDisconnected(): void {
    this.teardown();
  }

  private teardown(): void {
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


// Floating buttons of several cards stack upwards from the bottom-right corner instead of
// covering each other (catalog A10): the lowest FAB is 64 px (right 24, bottom 24 + safe area),
// every next one 48 px, 12 px above the previous one and centred on the axis of the first.
// Order from the bottom: scenes, climate / floating panels, alarm (`FAB_ORDER`), then the order of
// registration (the dashboard's order).
type FabOwner = { requestUpdate(): void };
const fabs: { owner: FabOwner; order: number }[] = [];

export const FAB_ORDER = { scenes: 0, climate: 1, panels: 1, alarm: 2 } as const;
/** Size (px) of the lowest FAB and of the ones stacked above it. */
export const FAB_MAIN = 64;
export const FAB_SMALL = 48;
const FAB_GAP = 12;

/** Slot (0 = lowest) of a FAB owner; registers it on first use. */
export function fabSlot(owner: FabOwner, order: number = FAB_ORDER.climate): number {
  let i = fabs.findIndex((f) => f.owner === owner);
  if (i === -1 || fabs[i].order !== order) {
    if (i !== -1) fabs.splice(i, 1);
    let at = fabs.findIndex((f) => f.order > order);
    if (at === -1) at = fabs.length;
    fabs.splice(at, 0, { owner, order });
    // The ones above moved up a slot.
    fabs.slice(at + 1).forEach((f) => f.owner.requestUpdate());
    i = at;
  }
  return i;
}

/** The owner's FAB is gone: the ones above move down. */
export function releaseFab(owner: FabOwner): void {
  const i = fabs.findIndex((f) => f.owner === owner);
  if (i === -1) return;
  fabs.splice(i, 1);
  fabs.slice(i).forEach((f) => f.owner.requestUpdate());
}

/** Size (px) of the FAB in `slot`. */
export const fabSize = (slot: number) => (slot === 0 ? FAB_MAIN : FAB_SMALL);

/** `bottom:` of a FAB in `slot`; themes move the stack with --lumen-cards-fab-bottom. */
export const fabBottom = (slot: number) =>
  `calc(var(--lumen-cards-fab-bottom, 24px) + ${slot === 0 ? 0 : FAB_MAIN + FAB_GAP + (slot - 1) * (FAB_SMALL + FAB_GAP)}px + env(safe-area-inset-bottom))`;

/** `right:` of a FAB of `size` px, centred on the axis of the lowest (64 px) one. */
export const fabRight = (size: number) => `calc(var(--lumen-cards-fab-right, 24px) + ${(FAB_MAIN - size) / 2}px)`;
