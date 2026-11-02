// @vitest-environment happy-dom
// Generator and drift guard of docs/agents/cards.md, the card reference for AI agents (see AGENTS.md).
// Regenerate: npm run docs:agents. Everything comes from the running code except SUPPLEMENT below.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { setLanguage } from "../src/core/i18n";
import "../src/lumen-cards";

const OUT = join(import.meta.dirname, "../docs/agents/cards.md");
const GUIDE = join(import.meta.dirname, "../AGENTS.md");

type Selector = Record<string, Record<string, unknown> | null | undefined>;
type Field = {
  name?: string;
  title?: string;
  label?: string;
  type?: string;
  flatten?: boolean;
  required?: boolean;
  default?: unknown;
  description?: string;
  helper?: string;
  schema?: Field[];
  selector?: Selector;
};
type Form = { schema: Field[]; computeLabel(s: Field): string | undefined; computeHelper(s: Field): string | undefined };
type Suggestion = (hass: unknown, id: string) => unknown;
type Entry = { type: string; name: string; description: string; getEntitySuggestion?: Suggestion };
type CardClass = CustomElementConstructor & {
  getConfigForm?: () => Form;
  getConfigElement?: () => unknown;
  getStubConfig?: () => unknown;
  compactBelow?: number | "screen";
  grid?: Record<string, unknown>;
};
type CardElement = HTMLElement & { setConfig(c: unknown): void; defaults?(): Record<string, unknown>; _configError?: { title: string } };

/** A key the form does not list; read from the card's source. */
type Extra = { key: string; type: string; note: string; default?: string };
/** Hand-kept: what the running form cannot tell. A key listed here must not also be in the form (tested). */
type Supplement = { yaml?: Extra[]; notes?: string[] };

const CARDS_KEY_NOTE = "`cards` is a list of complete card configs (any HA card, each with its own `type`), not one object as its selector suggests.";
const STACK_NOTES = [CARDS_KEY_NOTE, "Editor: own `getConfigElement`: `title` and `cards` are edited in HA's stack editor, the other fields above it.", "Inner cards keep their own `visibility`."];

const SUPPLEMENT: Record<string, Supplement> = {
  "lumen-air-quality-card": { yaml: [{ key: "levels", type: "{title?, hint?}[]", note: "Own texts of the six levels, best to worst" }] },
  "lumen-bar-card": {
    notes: [CARDS_KEY_NOTE, "Inner Lumen cards always get `layout: compact`, and `weather_effects: false` unless they set it."],
  },
  "lumen-chips-card": {
    yaml: [
      { key: "chips[].hold_action", type: "action", note: "HA action" },
      { key: "chips[].double_tap_action", type: "action", note: "HA action" },
    ],
    notes: ["With `fab`, only `type: action` chips float; `type: light` chips stay in the row."],
  },
  "lumen-fab-sheet-card": {
    notes: [
      CARDS_KEY_NOTE,
      "Inner `custom:lumen-climate-card` cards get `layout: compact` unless they set it, and always `fab: false`.",
      "Inner cards are built only while the sheet is open. Inner Lumen cards get `weather_effects: false` unless they set it.",
    ],
  },
  "lumen-horizontal-stack-card": { notes: STACK_NOTES },
  "lumen-light-card": { yaml: [{ key: "height", type: "number", note: "Tile height in px, at least 40", default: "64; compact 44" }] },
  "lumen-popup-card": {
    notes: [CARDS_KEY_NOTE, "Inner cards are built only while the sheet is open. Inner Lumen cards get `weather_effects: false` unless they set it. Open it with a link to `hash`, e.g. `navigate` with `navigation_path: \"#living-room\"`."],
  },
  "lumen-title-card": { notes: ["An item of `badges` may also be a plain entity id string."] },
  "lumen-vertical-stack-card": { notes: STACK_NOTES },
  "lumen-weather-card": { yaml: [{ key: "sun_entity", type: "entity", note: "Day and night icons", default: "sun.sun" }] },
};

/** Domains probed against each card's picker suggestion (`getEntitySuggestion`). */
const DOMAINS = [
  "alarm_control_panel", "automation", "binary_sensor", "button", "calendar", "camera", "climate", "cover", "device_tracker", "fan", "group", "humidifier",
  "input_boolean", "input_button", "input_datetime", "input_number", "input_select", "input_text", "light", "lock", "media_player", "number", "person", "remote",
  "scene", "script", "select", "sensor", "siren", "sun", "switch", "text", "todo", "update", "vacuum", "valve", "water_heater", "weather",
];

const cell = (s: unknown) => String(s ?? "").replace(/\s*\n\s*/g, " ").replaceAll("|", "\\|");
const code = (v: unknown) => (v === undefined ? "" : `\`${typeof v === "string" ? v : JSON.stringify(v)}\``);

/** `entity (domain: light)`, `entity[]`, `number (min: 0, max: 600, unit: px)`… */
function selectorText(selector: Selector | undefined, fallback?: string): { kind: string; values: string } {
  const [kind, raw] = Object.entries(selector ?? {})[0] ?? [fallback ?? "", undefined];
  const o = (raw ?? {}) as Record<string, unknown>;
  if (kind === "select") {
    const options = (o.options ?? []) as (string | { value: string; label?: string })[];
    const values = options.map((x) => (typeof x === "string" ? code(x) : `${code(x.value)} (${x.label ?? x.value})`)).join(", ");
    return { kind: o.multiple ? "select[]" : "select", values };
  }
  const params: string[] = [];
  if (o.domain) params.push(`domain: ${[o.domain].flat().join(", ")}`);
  if (o.device_class) params.push(`device_class: ${[o.device_class].flat().join(", ")}`);
  for (const k of ["min", "max", "step"]) if (o[k] !== undefined) params.push(`${k}: ${o[k]}`);
  if (o.unit_of_measurement) params.push(`unit: ${o.unit_of_measurement}`);
  if (o.multiline) params.push("multiline");
  return { kind: `${kind}${o.multiple ? "[]" : ""}${params.length ? ` (${params.join("; ")})` : ""}`, values: "" };
}

type Row = { name: string; required: boolean; selector: string; values: string; def: string; label: string; help: string };

/** Every field of a form, nested too: `group.field` for a named section, `list[].field` for list items. */
function rows(form: Form, codeDefaults: Record<string, unknown>): Row[] {
  const out: Row[] = [];
  const add = (f: Field, path: string, listItem: boolean) => {
    const { kind, values } = selectorText(f.selector, f.type && `group: ${f.type}`);
    const def = f.default ?? (listItem ? undefined : codeDefaults[path]);
    out.push({
      name: path,
      required: !!f.required,
      selector: kind,
      values,
      def: code(def),
      label: f.label ?? form.computeLabel(f) ?? "",
      // HA's object selector shows no helpers on its list fields.
      help: f.description ?? (listItem ? "" : (form.computeHelper(f) ?? "")),
    });
    const object = f.selector?.object as { fields?: Record<string, Field>; multiple?: boolean } | undefined;
    for (const [name, sub] of Object.entries(object?.fields ?? {})) add({ ...sub, name }, `${path}${object?.multiple ? "[]" : ""}.${name}`, true);
  };
  const walk = (list: Field[], prefix: string) => {
    for (const f of list) {
      if (f.name) add(f, `${prefix}${f.name}`, false);
      if (f.schema) walk(f.schema, f.name && !f.flatten ? `${prefix}${f.name}.` : prefix);
    }
  };
  walk(form.schema, "");
  return out;
}

/** The field names of a form (`rows`), with no supplement. */
function formKeys(tag: string): string[] {
  const form = (customElements.get(tag) as CardClass).getConfigForm?.();
  return form ? rows(form, {}).map((r) => r.name) : [];
}

function suggestedDomains(entry: Entry): string[] {
  if (!entry.getEntitySuggestion) return [];
  return DOMAINS.filter((d) => {
    const id = `${d}.x`;
    const attributes = { device_class: "pm25", unit_of_measurement: "x" };
    const hass = { states: { [id]: { entity_id: id, state: "on", attributes } }, language: "en" };
    return !!entry.getEntitySuggestion!(hass, id);
  });
}

function compactRule(rule: CardClass["compactBelow"]): string {
  if (rule === "screen" || rule === undefined) return "screen < 1024 px";
  return rule > 0 ? `card < ${rule} px` : "never (only `layout: compact`)";
}

function card(entry: Entry): string {
  const tag = entry.type;
  const ctor = customElements.get(tag) as CardClass;
  const el = document.createElement(tag) as CardElement;
  el.setConfig({ type: `custom:${tag}` });
  const emptyError = el._configError?.title;
  const extra = SUPPLEMENT[tag];
  const form = ctor.getConfigForm?.();
  const fields = form ? rows(form, el.defaults?.() ?? {}) : [];
  const lines = [`## \`${tag}\``, "", `${entry.name}: ${entry.description}`, ""];

  const facts: [string, string][] = [
    ["YAML", `\`type: custom:${tag}\``],
    ["Picker suggests it for", suggestedDomains(entry).map(code).join(", ")],
    ["`layout: auto` is compact when", fields.some((r) => r.name === "layout") ? compactRule(ctor.compactBelow) : ""],
    ["Default `grid_options`", code(ctor.grid)],
    ["Config error with no options", emptyError ? `"${emptyError}"` : ""],
    ["Starting config", code(ctor.getStubConfig?.())],
  ];
  for (const [k, v] of facts) if (v) lines.push(`- ${k}: ${v}`);
  for (const note of extra?.notes ?? []) lines.push(`- ${note}`);

  lines.push("", "| Field | Req | Selector | Allowed values | Default | Label | Help |", "|---|---|---|---|---|---|---|");
  for (const r of fields) {
    lines.push(`| \`${r.name}\` | ${r.required ? "yes" : ""} | ${cell(r.selector)} | ${cell(r.values)} | ${cell(r.def)} | ${cell(r.label)} | ${cell(r.help)} |`);
  }
  for (const x of extra?.yaml ?? []) lines.push(`| \`${x.key}\` |  | ${cell(x.type)} (YAML only) |  | ${cell(x.default)} | | ${cell(x.note)} |`);
  lines.push("");
  return lines.join("\n");
}

function entries(): Entry[] {
  const list = (window as unknown as { customCards: Entry[] }).customCards;
  return [...list].sort((a, b) => (a.type < b.type ? -1 : 1));
}

const BLOCK = /(<!-- compact-table:begin[^\n]*-->\n)[\s\S]*?(<!-- compact-table:end -->)/;

/** The thresholds table of AGENTS.md, from the same code. */
function compactTable(): string {
  const withLayout = entries().filter((e) => formKeys(e.type).includes("layout"));
  const rule = (e: Entry) => (customElements.get(e.type) as CardClass).compactBelow;
  const width = withLayout.filter((e) => rule(e) !== "screen");
  const screen = withLayout.filter((e) => rule(e) === "screen");
  return [
    "| Card | `layout: auto` is compact when |",
    "|---|---|",
    ...width.map((e) => `| \`${e.type}\` | ${compactRule(rule(e))} |`),
    ...screen.map((e) => `| \`${e.type}\` | ${compactRule(rule(e))} |`),
    "",
  ].join("\n");
}

function build(): string {
  setLanguage("en");
  const list = entries();
  const head = [
    "<!-- GENERATED by test/agent-docs.test.ts from the running code. Do not edit. Regenerate: npm run docs:agents -->",
    "",
    "# Lumen Cards: card reference",
    "",
    "One section per entry of `window.customCards`, sorted by tag. Guide: [AGENTS.md](../../AGENTS.md).",
    "",
    "Reading the tables:",
    "",
    "- Fields are in the order of the visual editor. `list[].field` is a field of each list item; `group.field` is nested under the key `group`.",
    "- Starting config: `getStubConfig()` with no entities in reach; its entity ids are examples only, they do not exist on a real system.",
    "- Default: only what the form or the card's `defaults()` declares. Empty does not mean no behaviour: the code may still fall back, e.g. to the entity's name or to a theme colour. Fallbacks: tables in README.md, \"Settings of every card\".",
    "- `(YAML only)`: not in the visual editor, hand-kept from the source.",
    "- Req: required by the form. \"Config error with no options\" shows what `validate()` rejects at runtime.",
    "- Any card also takes Home Assistant's own `grid_options` and `visibility`.",
    "- The base class reads `color_scheme`, `accent_color`, `glow_color`, `max_width`, `max_width_unit`, `weather_effects`, `styles`, `edit_note` and `haptics` on every card, also where the card's form omits them. Only the listed ones are meant for that card.",
    "- `ui_color` takes a Home Assistant colour name, hex or rgb.",
    "- `action` selectors (`ui_action`) take a Home Assistant action: `action` is one of `toggle`, `more-info`, `perform-action`, `call-service`, `navigate`, `url`, `assist`, `none`.",
    "",
    `## Index (${list.length})`,
    "",
    "| Tag | Name | Picker suggests it for |",
    "|---|---|---|",
    ...list.map((e) => `| [\`${e.type}\`](#${e.type}) | ${cell(e.name)} | ${suggestedDomains(e).join(", ")} |`),
    "",
  ];
  return `${head.join("\n")}\n${list.map(card).join("\n")}`;
}

describe("agent docs", () => {
  it("every card has documented fields", () => {
    setLanguage("en");
    const empty = entries()
      .map((e) => e.type)
      .filter((tag) => !formKeys(tag).length && !SUPPLEMENT[tag]?.yaml?.length);
    expect(empty).toEqual([]);
  });

  it("the supplement is not stale", () => {
    setLanguage("en");
    const tags = entries().map((e) => e.type);
    expect(Object.keys(SUPPLEMENT).filter((tag) => !tags.includes(tag))).toEqual([]);
    const listed = Object.entries(SUPPLEMENT).flatMap(([tag, s]) => (s.yaml ?? []).filter((x) => formKeys(tag).includes(x.key)).map((x) => `${tag}: ${x.key}`));
    expect(listed).toEqual([]);
  });

  it("docs/agents/cards.md matches the code", () => {
    const text = build();
    if (process.env.WRITE_AGENT_DOCS) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, text);
      return;
    }
    const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (current !== text) throw new Error("docs/agents/cards.md is out of date with the card code. Regenerate it: npm run docs:agents");
  });

  it("the thresholds in AGENTS.md match the code", () => {
    setLanguage("en");
    const guide = readFileSync(GUIDE, "utf8");
    expect(BLOCK.test(guide)).toBe(true);
    const updated = guide.replace(BLOCK, (_m, begin: string, end: string) => `${begin}${compactTable()}${end}`);
    if (process.env.WRITE_AGENT_DOCS) writeFileSync(GUIDE, updated);
    else if (updated !== guide) throw new Error("The compact table of AGENTS.md is out of date with the card code. Regenerate it: npm run docs:agents");
  });

  it("AGENTS.md names only cards that exist", () => {
    const tags = new Set(entries().map((e) => e.type));
    const unknown = [...readFileSync(GUIDE, "utf8").matchAll(/lumen-[a-z-]+-card/g)].map((m) => m[0]).filter((tag) => !tags.has(tag));
    expect(unknown).toEqual([]);
  });
});
