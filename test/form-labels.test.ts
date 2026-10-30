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
});
