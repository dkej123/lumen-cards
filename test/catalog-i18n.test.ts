import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { SECTIONS, sectionCards } from "../dev/catalog-data";
import { EN, GUIDE_EN, translated } from "../dev/catalog-en";
import { GUIDE } from "../dev/catalog-guide";
import { PAGE_PL } from "../dev/catalog-page-pl";

const TEXT_KEYS = new Set(["name", "label", "hint", "lead", "group", "labels", "title"]);
const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

function strings(v: unknown, key = "", out: [string, string][] = []): [string, string][] {
  if (typeof v === "string") out.push([key, v]);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, key, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, k, out);
  return out;
}

describe("catalog page languages", () => {
  it("every text of the sections has an English version", () => {
    const missing = strings(SECTIONS).filter(([k, s]) => (TEXT_KEYS.has(k) || POLISH.test(s)) && !/^\d+$/.test(s) && !(s in EN));
    expect(missing).toEqual([]);
  });

  it("no Polish letters are left after translating", () => {
    expect(strings(translated(SECTIONS)).filter(([, s]) => POLISH.test(s))).toEqual([]);
  });

  it("translating keeps the shape and the technical values", () => {
    const light = translated(SECTIONS).find((s) => s.id === "swiatlo")!;
    expect(light.card).toBe("light");
    expect(light.variants[0].config.entity).toBe("light.sofa");
    expect(light.name).toBe("Light");
  });

  it("the English guide matches the Polish one, gesture by gesture", () => {
    expect(Object.keys(GUIDE_EN).sort()).toEqual(Object.keys(GUIDE).sort());
    for (const id of Object.keys(GUIDE)) {
      expect(GUIDE_EN[id].controls.map(([g]) => g), id).toEqual(GUIDE[id].controls.map(([g]) => g));
      expect(strings(GUIDE_EN[id]).filter(([, s]) => POLISH.test(s)), id).toEqual([]);
    }
  });

  it("every section links to an agent file that exists", () => {
    const files = readdirSync("docs/agents/cards");
    expect(SECTIONS.map((s) => `lumen-${s.card}-card.md`).filter((f) => !files.includes(f))).toEqual([]);
  });

  it("the page shows every card, so its count and \"every card\" are true", () => {
    const shown = [...new Set(SECTIONS.flatMap(sectionCards))].map((c) => `lumen-${c}-card.md`).sort();
    expect(shown).toEqual(readdirSync("docs/agents/cards").sort());
  });

  it("a tab's own card is a real card with its own YAML type", () => {
    const stacks = SECTIONS.find((s) => s.id === "stosy")!;
    expect(stacks.variants.find((v) => v.label === "Poziomy")!.card).toBe("horizontal-stack");
  });

  it("every section has a guide entry", () => {
    for (const s of SECTIONS) expect(GUIDE_EN[s.id], s.id).toBeTruthy();
  });

  it("the page's static texts have Polish versions, and the page is English by default", () => {
    const html = readFileSync("site/index.html", "utf8");
    const keys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(30);
    expect(keys.filter((k) => !(k in PAGE_PL))).toEqual([]);
    expect(Object.keys(PAGE_PL).filter((k) => !keys.includes(k))).toEqual([]);
    expect(html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "")).not.toMatch(POLISH);
    expect(html).toContain('<html lang="en">');
  });
});
