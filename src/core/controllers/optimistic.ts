import type { ReactiveController, ReactiveControllerHost } from "lit";
import { t } from "../i18n";
import { toast } from "../toast";

/** How long a device that refreshes slowly gets to confirm a change. */
export const CONFIRM_MS = 45_000;

/** Quiet time after the last tap before a change goes out: tapping − / + sends one value, not twelve. */
export const SEND_DELAY_MS = 800;
/** Least time between two commands to the device, even of different settings. */
const SEND_GAP_MS = 1000;

/** A change on its way to the device: values shown at once, by "entity|attribute" path. */
interface Change {
  expected: Record<string, unknown>;
  /** Paths that settle the change once HA reports them. */
  confirm: string[];
  send: () => void;
  /** Waiting to be sent. */
  sendTimer?: number;
  /** Waiting for HA to confirm. */
  timer?: number;
}

export interface OptimisticChange {
  key: string;
  expected: Record<string, unknown>;
  confirm?: string[];
  /** Name of the action in the error toast. */
  label: string;
  send: () => Promise<unknown>;
}

/**
 * Optimistic values: a change shows at once, goes out after a moment of quiet (a new change of the
 * same key replaces it and waits again) and stays until HA reports it. Without an answer in
 * `timeout` it is undone with a toast offering a retry; a failed call undoes it right away.
 */
export class Optimistic implements ReactiveController {
  private changes = new Map<string, Change>();
  private lastSent = -Infinity;

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    /** The value HA reports now. */
    private live: (path: string) => unknown,
    private timeout: () => number = () => CONFIRM_MS,
    private delay: () => number = () => SEND_DELAY_MS,
  ) {
    host.addController(this);
  }

  /** Value to show for a path, the pending one first (the newest change wins). */
  value(path: string): unknown {
    for (const c of [...this.changes.values()].reverse()) if (path in c.expected) return c.expected[path];
    return this.live(path);
  }

  /** A change of this key is waiting. */
  pending(key: string): boolean {
    return this.changes.has(key);
  }

  apply(o: OptimisticChange): void {
    this.drop(o.key);
    const retry = () => this.apply(o);
    const title = t("card.purifier.msg.error", { action: o.label });
    const change: Change = {
      expected: o.expected,
      confirm: o.confirm ?? Object.keys(o.expected),
      send: () => {
        change.sendTimer = undefined;
        this.lastSent = Date.now();
        change.timer = window.setTimeout(() => {
          this.drop(o.key);
          this.fail(title, t("card.purifier.msg.no_answer"), retry);
        }, this.timeout());
        o.send().catch((err: Error) => {
          if (this.changes.get(o.key) !== change) return;
          this.drop(o.key);
          this.fail(title, err?.message ?? String(err), retry);
        });
      },
    };
    this.changes.set(o.key, change);
    this.host.requestUpdate();
    const delay = this.delay();
    if (delay > 0) this.schedule(change, delay);
    else change.send();
  }

  /** After `wait`, or later if another command has just gone out. */
  private schedule(change: Change, wait: number) {
    change.sendTimer = window.setTimeout(() => {
      const left = this.lastSent + SEND_GAP_MS - Date.now();
      if (left > 0) this.schedule(change, left);
      else change.send();
    }, wait);
  }

  private fail(title: string, text: string, run: () => void) {
    toast(this.host, { icon: "mdi:alert-circle", tone: "danger", title, text, action: { label: t("card.purifier.msg.retry"), run } });
    this.host.requestUpdate();
  }

  private drop(key: string) {
    const c = this.changes.get(key);
    if (c) {
      window.clearTimeout(c.sendTimer);
      window.clearTimeout(c.timer);
    }
    this.changes.delete(key);
  }

  hostUpdate(): void {
    for (const [key, c] of this.changes) {
      if (c.confirm.every((path) => this.live(path) === c.expected[path])) this.drop(key);
    }
  }

  hostDisconnected(): void {
    // A change still waiting is sent: the user chose it.
    for (const c of this.changes.values()) if (c.sendTimer !== undefined) c.send();
    [...this.changes.keys()].forEach((k) => this.drop(k));
  }
}
