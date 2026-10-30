import type { ReactiveController, ReactiveControllerHost } from "lit";

/** How long a sent command waits for Home Assistant's answer before the card shows the state again. */
export const PENDING_MS = 10_000;

/**
 * Optimistic value of a command the card sent: shown until the entity answers (any new state
 * object of `source`) or PENDING_MS pass. Checked before each update, expiry re-renders the card.
 */
export class Pending<T = true> implements ReactiveController {
  private p?: { value: T; from: unknown };
  private timer?: number;

  constructor(
    private host: ReactiveControllerHost,
    /** The entity whose next state ends the wait. */
    private source: () => unknown,
  ) {
    host.addController(this);
  }

  /** The value sent, while waiting. */
  get value(): T | undefined {
    return this.p?.value;
  }

  get active(): boolean {
    return !!this.p;
  }

  set(value: T): void {
    window.clearTimeout(this.timer);
    this.p = { value, from: this.source() };
    this.timer = window.setTimeout(() => this.clear(), PENDING_MS);
    this.host.requestUpdate();
  }

  /** Stop waiting (failed call, or the user cancelled). */
  clear(): void {
    if (!this.p) return;
    window.clearTimeout(this.timer);
    this.p = undefined;
    this.host.requestUpdate();
  }

  hostUpdate(): void {
    // the entity answered: from now on its own state counts
    if (this.p && this.source() !== this.p.from) {
      window.clearTimeout(this.timer);
      this.p = undefined;
    }
  }

  hostDisconnected(): void {
    window.clearTimeout(this.timer);
    this.p = undefined;
  }
}
