import type { ReactiveController, ReactiveControllerHost } from "lit";
import { t } from "../i18n";
import { toast } from "../toast";

/** How long a device that refreshes slowly gets to confirm a change. */
export const CONFIRM_MS = 45_000;

/** A change on its way to the device: values shown at once, by "entity|attribute" path. */
interface Change {
  expected: Record<string, unknown>;
  /** Paths that settle the change once HA reports them. */
  confirm: string[];
  label: string;
  run: () => void;
  timer: number;
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
 * Optimistic values: a change shows at once and stays until HA reports it. After `timeout` it is
 * undone with a toast offering a retry; a failed call undoes it right away. A new change of the
 * same key replaces the old one and starts the time again.
 */
export class Optimistic implements ReactiveController {
  private changes = new Map<string, Change>();

  constructor(
    private host: ReactiveControllerHost & HTMLElement,
    /** The value HA reports now. */
    private live: (path: string) => unknown,
    private timeout: () => number = () => CONFIRM_MS,
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
    const run = () => this.apply(o);
    const timer = window.setTimeout(() => {
      this.drop(o.key);
      this.fail(t("card.purifier.msg.error", { action: o.label }), t("card.purifier.msg.no_answer"), run);
    }, this.timeout());
    this.changes.set(o.key, { expected: o.expected, confirm: o.confirm ?? Object.keys(o.expected), label: o.label, run, timer });
    this.host.requestUpdate();
    o.send().catch((err: Error) => {
      if (this.changes.get(o.key)?.timer !== timer) return;
      this.drop(o.key);
      this.fail(t("card.purifier.msg.error", { action: o.label }), err?.message ?? String(err), run);
    });
  }

  private fail(title: string, text: string, run: () => void) {
    toast(this.host, { icon: "mdi:alert-circle", tone: "danger", title, text, action: { label: t("card.purifier.msg.retry"), run } });
    this.host.requestUpdate();
  }

  private drop(key: string) {
    const c = this.changes.get(key);
    if (c) window.clearTimeout(c.timer);
    this.changes.delete(key);
  }

  hostUpdate(): void {
    for (const [key, c] of this.changes) {
      if (c.confirm.every((path) => this.live(path) === c.expected[path])) this.drop(key);
    }
  }

  hostDisconnected(): void {
    [...this.changes.keys()].forEach((k) => this.drop(k));
  }
}
