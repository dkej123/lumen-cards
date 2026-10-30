/**
 * Per-device settings in localStorage under `prefix` + key (last arm mode, last AC mode, the
 * edit-mode layout): a convenience only, so blocked storage (private mode) reads null and
 * silently forgets.
 */
export const deviceStore = (prefix: string) => ({
  get(key = ""): string | null {
    try {
      return localStorage.getItem(prefix + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(prefix + key, value);
    } catch {
      /* not remembered */
    }
  },
});
