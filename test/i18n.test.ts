import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/translations/en.json";
import pl from "../src/translations/pl.json";

const SRC = join(import.meta.dirname, "../src");
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) files.push(p);
  }
};
walk(SRC);
const KEY = /["'`]((?:card|editor|common|error|state|tone|align|time)\.[a-z0-9_.-]+)["'`]/g;

describe("translations", () => {
  const used = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(KEY)) used.add(m[1]);
  // Keys built at runtime.
  for (const c of ["sunny", "clear-night", "cloudy", "fog", "rainy", "lightning-rainy", "snowy", "windy"]) used.add(`weather.${c}`);

  it("every key used in the code exists in English and Polish", () => {
    const missing = [...used].filter((k) => !(k in en) || !(k in pl));
    expect(missing).toEqual([]);
  });
  it("both languages have the same keys", () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
  });
  it("no Polish text left in the code (outside translations)", () => {
    const polish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
    const offenders = files.filter((f) => polish.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("placeholders match between languages", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    const bad = Object.keys(en).filter((k) => vars((en as Record<string, string>)[k]) !== vars((pl as Record<string, string>)[k]));
    expect(bad).toEqual([]);
  });
});
