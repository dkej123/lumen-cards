import type { ReactiveController, ReactiveControllerHost } from "lit";
import { colorVars } from "../styles";

/** What the card's host element shows of its config: theme, user colours, effects, max width. */
export interface Look {
  dark: boolean;
  accent?: string;
  glow?: string;
  effects: boolean;
  maxWidth?: string;
  /** Where a card narrower than its place (maxWidth) sits; default centre. */
  align?: "start" | "center" | "end";
}

/**
 * Theme attribute, user colours (section 16: one colour → fill, glow, icon background, shadow,
 * ink as `--lumen-accent-*` / `--lumen-glow-*`), the weather-effects flag and `max_width` on the
 * host – written only when they change.
 */
export class HostLook implements ReactiveController {
  private last?: string;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    private look: () => Look,
  ) {
    host.addController(this);
  }

  hostUpdate(): void {
    const l = this.look();
    const key = JSON.stringify(l);
    if (key === this.last) return;
    this.last = key;
    const h = this.host;
    h.setAttribute("data-lumen-theme", l.dark ? "dark" : "light");
    this.userColor("accent", l.accent);
    this.userColor("glow", l.glow);
    h.toggleAttribute("data-wfx-card", l.effects);
    if (l.maxWidth) {
      h.style.maxWidth = l.maxWidth;
      h.style.marginLeft = l.align === "start" ? "0" : "auto";
      h.style.marginRight = l.align === "end" ? "0" : "auto";
      // A grid cell with auto margins shrinks to the content: keep the full (capped) width.
      h.style.width = "100%";
    } else {
      h.style.removeProperty("max-width");
      h.style.removeProperty("margin-left");
      h.style.removeProperty("margin-right");
      h.style.removeProperty("width");
    }
  }

  private userColor(name: string, c: string | undefined): void {
    for (const [k, v] of Object.entries(colorVars(name, c ?? "transparent"))) {
      if (c) this.host.style.setProperty(k, v);
      else this.host.style.removeProperty(k);
    }
  }
}
