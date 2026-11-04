// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { setLanguage } from "../src/core/i18n";
import "../src/lumen-cards";

type Field = { name?: string; title?: string; label?: string; type?: string; schema?: Field[]; selector?: Record<string, unknown> };
type Form = { schema: Field[]; computeLabel(s: Field): string | undefined };

/** Every field of every card's visual editor: [card tag, field name]. */
function fields(): [string, Field, Form][] {
  const out: [string, Field, Form][] = [];
  const cards = (window as unknown as { customCards: { type: string }[] }).customCards;
  for (const { type } of cards) {
    const ctor = customElements.get(type) as unknown as { getConfigForm?: () => Form } | undefined;
    const form = ctor?.getConfigForm?.();
    if (!form) continue;
    const walk = (list: Field[]) => {
      for (const f of list) {
        if (f.schema) walk(f.schema);
        if (f.name && f.selector) out.push([type, f, form]);
      }
    };
    walk(form.schema);
  }
  return out;
}

describe("visual editors", () => {
  it.each(["pl", "en"])("every field has a label (%s)", (lang) => {
    setLanguage(lang);
    const missing = fields()
      .filter(([, f, form]) => !f.label && !form.computeLabel(f))
      .map(([tag, f]) => `${tag}: ${f.name}`);
    expect(missing).toEqual([]);
    setLanguage("en");
  });

  // HA prints an expandable's `title` as it stands, without computeLabel.
  it.each(["pl", "en"])("every group has a translated title (%s)", (lang) => {
    setLanguage(lang);
    const bad: string[] = [];
    const cards = (window as unknown as { customCards: { type: string }[] }).customCards;
    for (const { type } of cards) {
      const walk = (list: Field[]) => {
        for (const f of list) {
          if (f.type === "expandable" && (!f.title || /^[a-z_]+(\.[a-z_]+)+$/.test(f.title))) bad.push(`${type}: ${f.title}`);
          if (f.schema) walk(f.schema);
        }
      };
      walk((customElements.get(type) as unknown as { getConfigForm?: () => Form }).getConfigForm?.().schema ?? []);
    }
    expect(bad).toEqual([]);
    setLanguage("en");
  });
});
