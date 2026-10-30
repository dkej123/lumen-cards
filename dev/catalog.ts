// Catalog page: every Lumen card with its variants – the YAML on the left (editable, re-renders
// the card as you type), the live card on the demo home on the right, the card's options below.
// Built to one module next to the fonts (see the page in the catalog artifact); js-yaml comes
// from the page as the global `jsyaml`.
import {
  mdiAirPurifier,
  mdiBicycleElectric,
  mdiBoomGateOutline,
  mdiCar,
  mdiCeilingLight,
  mdiLedStripVariant,
  mdiLightbulbGroup,
  mdiLockOutline,
  mdiMovieOpenOutline,
  mdiPowerSocketEu,
  mdiRobotVacuum,
  mdiSofa,
  mdiWashingMachine,
  mdiWindowOpenVariant,
} from "@mdi/js";
import type { HassLike } from "../src/hass/types";
import { SECTIONS, type Section, type Variant } from "./catalog-data";
import { createDemoHome } from "./mock-hass";

declare const jsyaml: { load(text: string): unknown; dump(value: unknown, opts?: Record<string, unknown>): string };

// Weather effects off: the page is the background here.
try {
  localStorage.setItem("lumen-effects", JSON.stringify({ motion: false, background: false, surface: false }));
} catch {
  /* effects stay on */
}

// HA's <ha-icon> stand-in for the icons the examples pick (Lumen bundles only its own).
const EXTRA: Record<string, string> = {
  "mdi:air-purifier": mdiAirPurifier,
  "mdi:bicycle-electric": mdiBicycleElectric,
  "mdi:boom-gate-outline": mdiBoomGateOutline,
  "mdi:car": mdiCar,
  "mdi:ceiling-light": mdiCeilingLight,
  "mdi:led-strip-variant": mdiLedStripVariant,
  "mdi:lightbulb-group": mdiLightbulbGroup,
  "mdi:lock-outline": mdiLockOutline,
  "mdi:movie-open-outline": mdiMovieOpenOutline,
  "mdi:power-socket-eu": mdiPowerSocketEu,
  "mdi:robot-vacuum": mdiRobotVacuum,
  "mdi:sofa": mdiSofa,
  "mdi:washing-machine": mdiWashingMachine,
  "mdi:window-open-variant": mdiWindowOpenVariant,
};
customElements.define(
  "ha-icon",
  class extends HTMLElement {
    set icon(name: string) {
      this.innerHTML = `<svg viewBox="0 0 24 24" style="display:block;width:1em;height:1em;fill:currentColor"><path d="${EXTRA[name] ?? ""}"/></svg>`;
    }
  },
);

await import("../src/lumen-cards");
// The option tables read their labels before any card has set the language from hass.
const { setLanguage } = await import("../src/core/i18n");
setLanguage("pl");

type Card = HTMLElement & { hass: HassLike; setConfig(c: unknown): void };
type Field = { name?: string; title?: string; type?: string; default?: unknown; required?: boolean; selector?: Record<string, Record<string, unknown> | null>; schema?: Field[] };
type CardForm = { schema: Field[]; computeLabel(f: Field): string | undefined; computeHelper(f: Field): string | undefined };

const root = document.documentElement;
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const home = createDemoHome({ lang: "pl", dark: isDark() });
const cards = new Set<Card>();
home.listen((h) => cards.forEach((c) => (c.hass = h)));
const syncTheme = () => home.setDark(isDark());
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);
new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

const tagOf = (s: Section) => `custom:lumen-${s.card}-card`;
const yamlOf = (s: Section, v: Variant) => jsyaml.dump({ type: tagOf(s), ...v.config }, { lineWidth: 96, noRefs: true, quotingType: '"' }).trimEnd();

/** YAML with spans for keys, strings, numbers, booleans, list dashes and comments. */
function highlight(src: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const value = (v: string) => {
    if (/^\s*$/.test(v)) return esc(v);
    const lead = v.match(/^\s*/)![0];
    const body = v.slice(lead.length);
    if (/^(true|false|null)$/.test(body)) return `${lead}<span class="t-bool">${body}</span>`;
    if (/^-?\d+(\.\d+)?$/.test(body)) return `${lead}<span class="t-num">${body}</span>`;
    if (/^custom:/.test(body)) return `${lead}<span class="t-type">${esc(body)}</span>`;
    return `${lead}<span class="t-str">${esc(body)}</span>`;
  };
  return src
    .split("\n")
    .map((line) => {
      const c = line.match(/^(\s*)(#.*)$/);
      if (c) return `${c[1]}<span class="t-com">${esc(c[2])}</span>`;
      const m = line.match(/^(\s*)(- )?([A-Za-z_][\w-]*)(:)(.*)$/);
      if (m) return `${m[1]}${m[2] ? '<span class="t-dash">- </span>' : ""}<span class="t-key">${m[3]}</span><span class="t-punct">:</span>${value(m[5])}`;
      const d = line.match(/^(\s*)(- )(.*)$/);
      if (d) return `${d[1]}<span class="t-dash">- </span>${value(d[3])}`;
      return esc(line);
    })
    .join("\n");
}

/** One-line description of a field's value (its selector). */
function kind(f: Field): string {
  const [name, s] = Object.entries(f.selector ?? {})[0] ?? ["", null];
  const opt = s ?? {};
  switch (name) {
    case "entity": {
      const d = opt.domain ?? (opt.filter as { domain?: unknown } | undefined)?.domain;
      return d ? `encja · ${[d].flat().join(", ")}` : "encja";
    }
    case "select": {
      const options = (opt.options as { value: string }[] | string[] | undefined) ?? [];
      return options.map((o) => (typeof o === "string" ? o : o.value)).join(" · ") || "lista";
    }
    case "number": {
      const range = opt.min !== undefined && opt.max !== undefined ? ` ${opt.min}–${opt.max}` : "";
      return `liczba${range}${opt.unit_of_measurement ? ` ${opt.unit_of_measurement}` : ""}`;
    }
    case "boolean":
      return "tak / nie";
    case "text":
      return opt.multiline ? "tekst (CSS)" : "tekst";
    case "icon":
      return "ikona";
    case "ui_color":
      return "kolor";
    case "ui_action":
      return "akcja";
    case "object":
      return "lista (YAML)";
    default:
      return name || "";
  }
}

/** The card's options from its visual editor: name, label, what it takes, default, help. */
function optionsTable(s: Section): HTMLElement | null {
  const ctor = customElements.get(`lumen-${s.card}-card`) as unknown as { getConfigForm?(): CardForm } | undefined;
  const form = ctor?.getConfigForm?.();
  if (!form) return null;
  const wrap = el("div", "options");
  const table = el("table");
  table.innerHTML = "<thead><tr><th>Opcja</th><th>Co to jest</th><th>Wartości</th><th>Domyślnie</th></tr></thead>";
  const body = el("tbody");
  const walk = (list: Field[], group?: string) => {
    for (const f of list) {
      if (f.schema) {
        walk(f.schema, f.title ?? group);
        continue;
      }
      if (!f.name || !f.selector) continue;
      const tr = el("tr");
      const name = el("td", "opt-name");
      name.append(el("code", "", f.name));
      if (group) name.append(el("span", "opt-group", group));
      const what = el("td", "opt-what");
      what.append(el("span", "opt-label", form.computeLabel(f) ?? ""));
      const help = form.computeHelper(f);
      if (help) what.append(el("span", "opt-help", help));
      const def = f.default === undefined ? "—" : typeof f.default === "boolean" ? (f.default ? "tak" : "nie") : String(f.default);
      tr.append(name, what, el("td", "opt-kind", kind(f)), el("td", "opt-def", def));
      body.append(tr);
    }
  };
  walk(form.schema);
  table.append(body);
  const scroller = el("div", "table-scroll");
  scroller.append(table);
  const head = el("div", "options-head");
  head.append(el("h3", "", "Opcje"), el("span", "muted", `${body.children.length} pól z edytora wizualnego`));
  wrap.append(head, scroller);
  return wrap;
}

/** The live card of a variant on the demo home. */
function makeCard(s: Section, cfg: Record<string, unknown>): Card {
  const card = document.createElement(`lumen-${s.card}-card`) as Card;
  card.setConfig({ ...cfg, type: tagOf(s) });
  card.hass = home.hass();
  cards.add(card);
  return card;
}

function sectionView(s: Section): HTMLElement {
  const sec = el("section", "card-section");
  sec.id = s.id;
  const head = el("header", "sec-head");
  const title = el("div", "sec-title");
  title.append(el("span", "eyebrow", s.group), el("h2", "", s.name));
  const tag = el("code", "sec-tag", tagOf(s));
  head.append(title, tag);
  const lead = el("p", "lead", s.lead);

  const tabs = el("div", "tabs");
  tabs.setAttribute("role", "tablist");
  const work = el("div", "work");

  // editor
  const editor = el("div", "editor");
  const bar = el("div", "editor-bar");
  const file = el("span", "file", `${s.card}.yaml`);
  const reset = el("button", "ghost", "Przywróć");
  const copy = el("button", "ghost", "Kopiuj");
  bar.append(file, reset, copy);
  const codeWrap = el("div", "code");
  const pre = el("pre");
  pre.setAttribute("aria-hidden", "true");
  const ta = el("textarea");
  ta.id = `yaml-${s.id}`;
  ta.spellcheck = false;
  ta.setAttribute("aria-label", `YAML karty ${s.name}`);
  ta.autocapitalize = "off";
  codeWrap.append(pre, ta);
  const err = el("div", "err");
  err.setAttribute("role", "status");
  editor.append(bar, codeWrap, err);

  // preview
  const preview = el("div", "preview");
  const pbar = el("div", "preview-bar");
  const live = el("span", "live", "Na żywo");
  const sizes = el("div", "seg");
  sizes.setAttribute("role", "group");
  sizes.setAttribute("aria-label", "Szerokość podglądu");
  const stage = el("div", "stage");
  const grid = el("div", "stage-grid");
  stage.append(grid);
  const hint = el("p", "hint");
  for (const [w, label] of [["wide", "Komputer"], ["narrow", "Telefon"]] as const) {
    const b = el("button", "", label);
    b.dataset.w = w;
    b.setAttribute("aria-pressed", String(w === "wide"));
    b.addEventListener("click", () => {
      stage.dataset.w = w;
      sizes.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    sizes.append(b);
  }
  stage.dataset.w = "wide";
  pbar.append(live, sizes);
  preview.append(pbar, stage, hint);
  work.append(editor, preview);

  let current: Variant = s.variants[0];
  let card: Card | undefined;
  let timer = 0;
  const show = (text: string) => {
    pre.innerHTML = highlight(text) + "\n";
    codeWrap.style.setProperty("--lines", String(Math.max(4, text.split("\n").length)));
  };
  const apply = (text: string) => {
    let cfg: unknown;
    try {
      cfg = jsyaml.load(text);
    } catch (e) {
      err.textContent = `YAML: ${(e as Error).message.split("\n")[0]}`;
      return;
    }
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
      err.textContent = "Konfiguracja karty to mapa kluczy, np. entity: light.sofa";
      return;
    }
    err.textContent = "";
    const c = cfg as Record<string, unknown>;
    if (c.type !== undefined && c.type !== tagOf(s)) err.textContent = `Ta sekcja pokazuje ${tagOf(s)}; type zostaje.`;
    if (card) {
      card.setConfig({ ...c, type: tagOf(s) });
      card.hass = home.hass();
    } else {
      card = makeCard(s, c);
      grid.append(card);
    }
  };
  const select = (v: Variant, btn: HTMLButtonElement) => {
    current = v;
    tabs.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", String(x === btn)));
    if (card) {
      cards.delete(card);
      card.remove();
      card = undefined;
    }
    const text = yamlOf(s, v);
    ta.value = text;
    show(text);
    grid.style.setProperty("--span", String(v.span ?? 12));
    hint.textContent = v.hint ?? "";
    hint.hidden = !v.hint;
    apply(text);
  };
  s.variants.forEach((v, i) => {
    const b = el("button", "tab", v.label);
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => select(v, b));
    tabs.append(b);
    if (i === 0) queueMicrotask(() => select(v, b));
  });
  ta.addEventListener("input", () => {
    show(ta.value);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => apply(ta.value), 250);
  });
  ta.addEventListener("scroll", () => {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  });
  ta.addEventListener("keydown", (e) => {
    // Tab indents (two spaces) instead of leaving the editor; Esc then Tab leaves it.
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b } = ta;
    ta.setRangeText("  ", a, b, "end");
    ta.dispatchEvent(new Event("input"));
  });
  reset.addEventListener("click", () => {
    const btn = [...tabs.querySelectorAll("button")].find((x) => x.getAttribute("aria-selected") === "true") as HTMLButtonElement;
    select(current, btn);
  });
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(ta.value).then(
      () => {
        copy.textContent = "Skopiowano";
        window.setTimeout(() => (copy.textContent = "Kopiuj"), 1600);
      },
      () => {
        ta.focus();
        ta.select();
      },
    );
  });

  sec.append(head, lead, tabs, work);
  const opts = optionsTable(s);
  if (opts) sec.append(opts);
  return sec;
}

function nav(): HTMLElement {
  const n = el("nav", "toc");
  n.setAttribute("aria-label", "Karty");
  const groups = new Map<string, Section[]>();
  for (const s of SECTIONS) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  for (const [g, list] of groups) {
    const box = el("div", "toc-group");
    box.append(el("span", "toc-label", g));
    for (const s of list) {
      const a = el("a", "", s.name);
      a.href = `#${s.id}`;
      a.dataset.id = s.id;
      box.append(a);
    }
    n.append(box);
  }
  return n;
}

const main = document.getElementById("cards")!;
const side = document.getElementById("side")!;
side.append(nav());
document.getElementById("count")!.textContent = String(SECTIONS.length);
document.getElementById("variants")!.textContent = String(SECTIONS.reduce((n, s) => n + s.variants.length, 0));
for (const s of SECTIONS) main.append(sectionView(s));
document.body.classList.add("ready");

// Highlight the section in view in the side list.
const links = new Map([...side.querySelectorAll<HTMLAnchorElement>("a[data-id]")].map((a) => [a.dataset.id!, a]));
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.dataset.id === (e.target as HTMLElement).id));
  },
  { rootMargin: "-30% 0px -60% 0px" },
);
main.querySelectorAll("section").forEach((s) => io.observe(s));
const target = location.hash.slice(1);
if (target && document.getElementById(target)) document.getElementById(target)!.scrollIntoView();
