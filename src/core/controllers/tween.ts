import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * Numbers that glide to a new value (450 ms, ease-out cubic), one per key: the card shows
 * `get(key)` and calls `to(key, value)` when the value changes. A first value, or reduced motion,
 * jumps straight there.
 */
export class Tweens implements ReactiveController {
  private shown = new Map<string, number>();
  private target = new Map<string, number>();
  private frames = new Map<string, number>();

  constructor(
    private host: ReactiveControllerHost,
    private ms = 450,
  ) {
    host.addController(this);
  }

  get(key: string): number | undefined {
    return this.shown.get(key);
  }

  to(key: string, value: number | null): void {
    if (value === null) {
      this.stop(key);
      this.shown.delete(key);
      return;
    }
    if (this.target.get(key) === value) return;
    this.stop(key);
    this.target.set(key, value);
    const from = this.shown.get(key);
    if (from === undefined || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.shown.set(key, value);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / this.ms);
      this.shown.set(key, from + (value - from) * (1 - Math.pow(1 - p, 3)));
      this.host.requestUpdate();
      if (p < 1) this.frames.set(key, requestAnimationFrame(step));
      else this.frames.delete(key);
    };
    this.frames.set(key, requestAnimationFrame(step));
  }

  private stop(key: string): void {
    cancelAnimationFrame(this.frames.get(key) ?? 0);
    this.frames.delete(key);
    this.target.delete(key);
  }

  /** Off the page: no frames; the shown values stay, a new value then starts from them. */
  hostDisconnected(): void {
    for (const key of [...this.frames.keys()]) this.stop(key);
    this.target.clear();
  }
}
