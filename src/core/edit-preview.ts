import { html, render } from "lit";
import { viewOf, type HuiWrapper } from "./dom";
import { t } from "./i18n";
import { icon } from "./lumen-icon";
import { visibleAt } from "./visibility";

/**
 * Dashboard edit mode: HA shows every card and section, also the copies its screen conditions
 * hide. A switch at the bottom of the view (All / Phone / Computer) hides the copies of the
 * other screen size, so each layout can be edited on its own. Only while editing; the choice is
 * remembered on this device.
 */
export type PreviewMode = "all" | "narrow" | "wide";
const WIDTH: Record<Exclude<PreviewMode, "all">, number> = { narrow: 390, wide: 1440 };
const KEY = "lumen-edit-preview";

/** Outermost wrapper that holds only `el` (edit-mode frame, grid cell), in the same root. */
function frameOf(el: HTMLElement): HTMLElement {
  let n = el;
  for (let i = 0; i < 6 && n.parentElement && n.parentElement.children.length === 1; i++) n = n.parentElement;
  return n;
}

/** hui-section / hui-card elements of a view, through the shadow roots of HA's own elements. */
function wrappers(root: Element | ShadowRoot, out: HTMLElement[] = []): HTMLElement[] {
  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    if (el.localName === "hui-section" || el.localName === "hui-card") out.push(el);
    // HA's elements and Lumen stacks (their cards sit in hui-card wrappers too)
    if (el.shadowRoot && (el.localName.startsWith("hui-") || /^lumen-.*-stack-card$/.test(el.localName))) wrappers(el.shadowRoot, out);
  }
  return out;
}

class EditPreview {
  private cards = new Set<Element>();
  private mode: PreviewMode = "all";
  private bar?: HTMLElement;
  private timer?: number;
  private hidden = new Set<HTMLElement>();
  /** The view given room at the bottom for the switch. */
  private padded?: HTMLElement;

  constructor() {
    try {
      const m = localStorage.getItem(KEY);
      if (m === "narrow" || m === "wide") this.mode = m;
    } catch {
      /* storage blocked: start with "all" */
    }
  }

  /**
   * A card in a dashboard view in edit mode, after each of its updates: HA re-renders the cards
   * when the dashboard changes, so the hidden copies are worked out again then.
   */
  add(card: Element): void {
    if (!this.cards.size) window.addEventListener("resize", this.onResize);
    this.cards.add(card);
    this.syncTimer();
    this.schedule();
  }

  remove(card: Element): void {
    if (!this.cards.delete(card)) return;
    if (!this.cards.size) {
      window.removeEventListener("resize", this.onResize);
      this.syncTimer();
      this.restore();
      this.padded?.style.removeProperty("padding-bottom");
      this.padded = undefined;
      this.bar?.remove();
      this.bar = undefined;
    }
  }

  private onResize = () => this.schedule();

  /**
   * While a layout is picked, a slow check catches cards HA adds without any Lumen card
   * updating (e.g. a plain HA card dropped into a section); "all" hides nothing and needs none.
   */
  private syncTimer(): void {
    const want = this.cards.size > 0 && this.mode !== "all";
    if (want && !this.timer) this.timer = window.setInterval(() => this.apply(), 3000);
    if (!want && this.timer) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private queued = false;
  private schedule(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.apply();
    });
  }

  private set(mode: PreviewMode): void {
    this.mode = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* not remembered */
    }
    this.syncTimer();
    this.apply();
  }

  private restore(): void {
    for (const el of this.hidden) if (el.style.getPropertyPriority("display") === "important") el.style.removeProperty("display");
    this.hidden.clear();
  }

  private apply(): void {
    const card = [...this.cards].find((c) => c.isConnected);
    const view = card && viewOf(card);
    if (!view) return;
    const hide = new Set<HTMLElement>();
    if (this.mode !== "all") {
      const w = WIDTH[this.mode];
      for (const el of wrappers(view.shadowRoot ?? view)) {
        const v = (el as HuiWrapper).config?.visibility;
        if (!visibleAt(v, w)) hide.add(frameOf(el));
      }
    }
    for (const el of this.hidden) if (!hide.has(el) && el.style.getPropertyPriority("display") === "important") el.style.removeProperty("display");
    for (const el of hide) if (el.style.getPropertyPriority("display") !== "important") el.style.setProperty("display", "none", "important");
    this.hidden = hide;
    this.renderBar(view);
  }

  private renderBar(view: Element): void {
    if (!this.bar) {
      this.bar = document.createElement("div");
      this.bar.className = "lumen-edit-preview";
      document.body.appendChild(this.bar);
    }
    // room under the last row, so the switch does not cover HA's own buttons there
    if (view instanceof HTMLElement && this.padded !== view) {
      this.padded?.style.removeProperty("padding-bottom");
      view.style.setProperty("padding-bottom", "72px");
      this.padded = view;
    }
    const r = view.getBoundingClientRect();
    const seg = (m: PreviewMode, ico: string, label: string) => {
      const on = this.mode === m;
      return html`<button type="button" aria-pressed=${on} @click=${() => this.set(m)}
        style="display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:0;border-radius:18px;cursor:pointer;font:600 13px/1 var(--ha-font-family-body, Roboto, sans-serif);background:${on ? "var(--primary-color, #03a9f4)" : "transparent"};color:${on ? "var(--text-primary-color, #fff)" : "var(--primary-text-color, #212121)"}">${icon(ico, "display:block;font-size:18px")}${label}</button>`;
    };
    render(
      html`<div role="group" aria-label=${t("edit.preview")} style="position:fixed;z-index:5;bottom:16px;left:${Math.round(r.left + r.width / 2)}px;transform:translateX(-50%);display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--card-background-color, #fff);box-shadow:0 4px 16px rgba(0,0,0,.18), 0 0 0 1px var(--divider-color, rgba(0,0,0,.12))">
        ${seg("all", "mdi:view-dashboard-outline", t("edit.all"))}${seg("narrow", "mdi:cellphone", t("edit.narrow"))}${seg("wide", "mdi:monitor", t("edit.wide"))}
      </div>`,
      this.bar,
    );
  }
}

export const editPreview = new EditPreview();
