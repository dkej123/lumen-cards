import type { HassEntity } from "../hass/types";

/** Live entity lookup + change notifications (the card feeds every new `hass`). */
export interface EntitySource {
  entity(id?: string): HassEntity | undefined;
  subscribe(fn: () => void): () => void;
}

export interface ResponseResult {
  ok: boolean;
  code: string | null;
  body: string | null;
}

export interface ResponseSource {
  /** Entity that was run (script: its `last_triggered` ends the wait too). */
  script: string;
  status: string;
  body?: string;
  /** Status state that means success. */
  success?: string;
}

const after = (iso: unknown, since: number): boolean =>
  typeof iso === "string" && Date.parse(iso) >= since;

/**
 * Waits for the answer to a gate/barrier press.
 *
 * Done when the status sensor changed after the click, or when the script that
 * writes it was triggered after the click and has finished. The second case
 * matters: an identical response ("200" again) does not produce a state change
 * in the frontend, so waiting for the sensor alone would time out.
 */
export function waitForResponse(
  store: EntitySource,
  source: ResponseSource,
  since: number,
  timeoutMs = 10_000,
): Promise<ResponseResult | null> {
  return new Promise((resolve) => {
    let timer: number | undefined;
    let unsubscribe = () => {};
    const finish = (result: ResponseResult | null) => {
      unsubscribe();
      window.clearTimeout(timer);
      resolve(result);
    };
    const check = () => {
      const status = store.entity(source.status);
      const script = store.entity(source.script);
      const statusChanged = after(status?.last_updated, since);
      const scriptDone = script?.state === "off" && after(script.attributes.last_triggered, since);
      if (!statusChanged && !scriptDone) return;
      const code = status?.state ?? null;
      finish({ ok: code === (source.success ?? "200"), code, body: store.entity(source.body)?.state ?? null });
    };
    unsubscribe = store.subscribe(check);
    timer = window.setTimeout(() => finish(null), timeoutMs);
    check();
  });
}
