import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { PadOptions } from "../parts";

type PadState<X> = X & { code: string; error?: string; shake: number; busy: boolean };

/**
 * State of a card's code pad (catalog PAD): the code typed so far, a sent attempt, the error of
 * a failed one (code cleared, the dots shake). `X` is what the card needs to send (command, mode).
 */
export class CodePad<X extends object> implements ReactiveController {
  state: PadState<X> | null = null;

  constructor(private host: ReactiveControllerHost) {
    host.addController(this);
  }

  show(extra: X): void {
    this.set({ ...extra, code: "", shake: 0, busy: false });
  }

  close(): void {
    this.set(null);
  }

  /** Change the card's own part (e.g. the arm mode). */
  patch(extra: Partial<X>): void {
    if (this.state) this.set({ ...this.state, ...extra });
  }

  /** The attempt is on its way. */
  sending(): void {
    if (this.state) this.set({ ...this.state, busy: true, error: undefined });
  }

  /** HA refused it: clear the code, show `error`, shake the dots. */
  failed(error: string): void {
    if (this.state) this.set({ ...this.state, busy: false, code: "", error, shake: this.state.shake + 1 });
  }

  /** The pad's own part of the codePad() options (the code, its error and the key handlers). */
  props(): Pick<PadOptions, "code" | "error" | "shakeKey" | "busy" | "onKey" | "onText"> {
    const p = this.state;
    return {
      code: p?.code ?? "",
      error: p?.error,
      shakeKey: p?.shake,
      busy: p?.busy,
      // Read the live state: several key presses may land before the next render.
      onKey: (k) => {
        const cur = this.state;
        if (!cur) return;
        const code = cur.error ? "" : cur.code;
        this.set({ ...cur, error: undefined, code: k === "bk" ? code.slice(0, -1) : code.length < 12 ? code + k : code });
      },
      onText: (v) => this.state && this.set({ ...this.state, error: undefined, code: v }),
    };
  }

  private set(s: PadState<X> | null): void {
    this.state = s;
    this.host.requestUpdate();
  }

  hostDisconnected(): void {
    this.state = null;
  }
}
