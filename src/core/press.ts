import { noChange, type ReactiveController, type ReactiveControllerHost } from "lit";
import { Directive, directive, PartType, type ElementPart, type PartInfo } from "lit/directive.js";

// Generic tap / hold (500 ms) / double tap with scroll protection – design `pressHandlers`
// (prototype `ph`). Keyboard: Enter / Space = tap, Shift+Enter or the context-menu key = hold.

interface Press { key: string; el: HTMLElement; x: number; y: number; moved: boolean; held: boolean; t?: number }

const DOUBLE_MS = 250;

/** Tap / hold / double tap state of a card; with a host it clears its timers when the card leaves the page. */
export class Presses implements ReactiveController {
  private press: Press | null = null;
  private lastTap?: { key: string; t: number };

  constructor(
    private haptic: (type?: string) => void,
    host?: ReactiveControllerHost,
  ) {
    host?.addController(this);
  }

  hostDisconnected(): void {
    this.dispose();
  }

  handlers(key: string, tap?: (el: HTMLElement) => void, hold?: (el: HTMLElement) => void, double?: (el: HTMLElement) => void) {
    const fireTap = (el: HTMLElement) => {
      if (!tap && !double) return;
      if (!double) {
        this.haptic();
        tap!(el);
        return;
      }
      const prev = this.lastTap;
      if (prev && prev.key === key) {
        window.clearTimeout(prev.t);
        this.lastTap = undefined;
        this.haptic();
        double(el);
        return;
      }
      this.lastTap = {
        key,
        t: window.setTimeout(() => {
          this.lastTap = undefined;
          if (tap) {
            this.haptic();
            tap(el);
          }
        }, DOUBLE_MS),
      };
    };
    return {
      down: (e: PointerEvent) => {
        if (e.button !== 0) return;
        const el = e.currentTarget as HTMLElement;
        this.press = { key, el, x: e.clientX, y: e.clientY, moved: false, held: false };
        if (hold) {
          this.press.t = window.setTimeout(() => {
            const p = this.press;
            if (p && p.key === key && !p.moved) {
              p.held = true;
              this.haptic("medium");
              hold(el);
            }
          }, 500);
        }
      },
      move: (e: PointerEvent) => {
        const p = this.press;
        if (p && p.key === key && (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10)) {
          p.moved = true;
          window.clearTimeout(p.t);
        }
      },
      up: () => {
        const p = this.press;
        if (!p || p.key !== key) return;
        window.clearTimeout(p.t);
        this.press = null;
        if (!p.moved && !p.held) fireTap(p.el);
      },
      cancel: () => {
        if (this.press) window.clearTimeout(this.press.t);
        this.press = null;
      },
      key: (e: KeyboardEvent) => {
        if (e.target !== e.currentTarget || e.repeat) return;
        const el = e.currentTarget as HTMLElement;
        if (hold && (e.key === "ContextMenu" || (e.key === "Enter" && e.shiftKey))) {
          e.preventDefault();
          this.haptic("medium");
          hold(el);
        } else if ((e.key === "Enter" || e.key === " ") && (tap || double)) {
          e.preventDefault();
          this.haptic();
          (tap ?? double)!(el);
        }
      },
    };
  }

  /** Pending timers (hold, double-tap wait) – call when the owner leaves the DOM. */
  dispose(): void {
    if (this.press) window.clearTimeout(this.press.t);
    if (this.lastTap) window.clearTimeout(this.lastTap.t);
    this.press = null;
    this.lastTap = undefined;
  }
}

export type PressHandlers = ReturnType<Presses["handlers"]>;

const EVENTS = [
  ["pointerdown", "down"],
  ["pointermove", "move"],
  ["pointerup", "up"],
  ["pointercancel", "cancel"],
  ["keydown", "key"],
] as const;

/**
 * `<div ${pressable(handlers)}>`: binds the pointer + keyboard handlers, suppresses the long-press
 * context menu and (unless the element is already focusable) makes it a focusable button.
 */
class PressableDirective extends Directive {
  private h?: PressHandlers;
  private el?: HTMLElement;

  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.ELEMENT) throw new Error("pressable() is an element directive");
  }

  render(_h: PressHandlers | undefined) {
    return noChange;
  }

  update(part: ElementPart, [h]: [PressHandlers | undefined]) {
    this.h = h;
    const el = part.element as HTMLElement;
    if (this.el !== el) {
      this.el = el;
      for (const [type, name] of EVENTS) el.addEventListener(type, (e) => (this.h?.[name] as ((e: Event) => void) | undefined)?.(e));
      el.addEventListener("contextmenu", (e) => this.h && e.preventDefault());
    }
    if (h && el.localName !== "button") {
      if (!el.hasAttribute("role")) el.setAttribute("role", "button");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    }
    return noChange;
  }
}

export const pressable = directive(PressableDirective);

export const spinnerStyle = (size: number, extra = "") =>
  `width:${size}px;height:${size}px;flex:none;box-sizing:border-box;border-radius:50%;border:2px solid var(--lumen-border-strong);border-top-color:var(--lumen-text-1);animation:lumenSpin 800ms linear infinite;${extra}`;

/** Click + Enter/Space for small interactive elements that are not buttons (alert pills, titles). */
export const activate = (fn: () => void) => ({
  click: () => fn(),
  key: (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  },
});
