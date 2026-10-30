import type { ReactiveController, ReactiveControllerHost } from "lit";

/** `styles` from the card config (Bubble Card style / card-mod), after the card's own CSS so it wins. */
export class UserStyles implements ReactiveController {
  private el?: HTMLStyleElement;

  constructor(
    private host: ReactiveControllerHost & { renderRoot: HTMLElement | DocumentFragment },
    private css: () => string,
  ) {
    host.addController(this);
  }

  hostUpdated(): void {
    const css = this.css();
    if (!css) {
      this.el?.remove();
      this.el = undefined;
      return;
    }
    if (!this.el) {
      this.el = document.createElement("style");
      this.el.className = "lumen-user-styles";
    }
    if (this.el.textContent !== css) this.el.textContent = css;
    if (this.el.parentNode !== this.host.renderRoot) this.host.renderRoot.appendChild(this.el);
  }
}
