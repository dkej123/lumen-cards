import type { ReactiveController, ReactiveControllerHost } from "lit";
import { stepsNeeded } from "../logic/media";

/** After this long without a command the entity's own reading is trusted again. */
const TRUST_READING_MS = 2000;

/**
 * Follows a moving target with up / down commands, for devices that only have volume keys.
 * One command at a time with a gap, so a fast drag cannot flood the device; a new target simply
 * redirects the loop. With `batch` one command carries every key still needed, so a long jump
 * takes one call. The level is tracked here, because the device reports it later.
 */
export class StepChaser implements ReactiveController {
  private target: number | null = null;
  private level = 0;
  private lastSent = 0;
  private loop?: Promise<void>;
  private stopped = false;

  constructor(
    host: ReactiveControllerHost,
    private send: (dir: 1 | -1, count: number) => Promise<unknown> | undefined,
    private read: () => number | null,
    private stepSize: () => number,
    private gapMs = 120,
    private batch: () => boolean = () => false,
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    this.stopped = true;
    this.target = null;
  }

  hostConnected(): void {
    this.stopped = false;
  }

  /** Where the level is heading, while commands are still going out. */
  get pending(): number | null {
    return this.loop ? this.target : null;
  }

  to(target: number): void {
    this.target = target;
    if (this.loop) return;
    if (Date.now() - this.lastSent > TRUST_READING_MS) this.level = this.read() ?? target;
    this.loop = this.run().finally(() => (this.loop = undefined));
  }

  private async run(): Promise<void> {
    while (!this.stopped && this.target !== null) {
      const step = this.stepSize();
      const dir = stepsNeeded(this.level, this.target, step);
      if (!dir) return;
      const count = this.batch() ? Math.max(1, Math.round(Math.abs(this.target - this.level) / step)) : 1;
      this.level = Math.max(0, Math.min(1, this.level + dir * step * count));
      this.lastSent = Date.now();
      await this.send(dir, count);
      await new Promise((r) => setTimeout(r, this.gapMs));
    }
  }
}
