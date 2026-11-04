// Catalog page for Lumen users: a gallery of every card, then one section per card – the live card
// on the demo home with its looks, what it is for, how you use it, how to add it and what you can
// set (from the card's visual editor); the YAML only on request. Built to one module next to the
// fonts (site/index.html, deployed by .github/workflows/pages.yml); js-yaml comes from the page as the global `jsyaml`.
import {
  mdiAirPurifier,
  mdiBicycleElectric,
  mdiBoomGateOutline,
  mdiCar,
  mdiCeilingLight,
  mdiCheck,
  mdiChevronDown,
  mdiContentCopy,
  mdiCursorDefaultClickOutline,
  mdiEyeOutline,
  mdiGestureSwipeHorizontal,
  mdiGestureTap,
  mdiGestureTapHold,
  mdiLedStripVariant,
  mdiLightbulbGroup,
  mdiLockOutline,
  mdiMovieOpenOutline,
  mdiPowerSocketEu,
  mdiRobotVacuum,
  mdiSofa,
  mdiWallSconceFlat,
  mdiWashingMachine,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
  mdiWindowOpenVariant,
} from "@mdi/js";
import type { HassLike } from "../src/hass/types";
import overviewMd from "../docs/agents/overview.md?raw";
import { SECTIONS as SECTIONS_PL, sectionCards, type Section, type Variant } from "./catalog-data";
import { EN, GUIDE_EN, translated } from "./catalog-en";
import { GUIDE as GUIDE_PL, type Gesture } from "./catalog-guide";
import { PAGE_PL } from "./catalog-page-pl";
import { createDemoHome } from "./mock-hass";

declare const jsyaml: { dump(value: unknown, opts?: Record<string, unknown>): string };

// The page's inline script has picked the language: English unless the visitor chose Polish.
const lang = document.documentElement.lang === "pl" ? "pl" : "en";
const tr = (en: string, pl: string) => (lang === "pl" ? pl : en);
const SECTIONS = lang === "pl" ? SECTIONS_PL : translated(SECTIONS_PL);
const GUIDE = lang === "pl" ? GUIDE_PL : GUIDE_EN;
if (lang === "pl") {
  document.title = "Karty Lumen: szklane karty do Home Assistant";
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((n) => (n.innerHTML = PAGE_PL[n.dataset.i18n!]));
}
delete document.documentElement.dataset.translating;
// The switch keeps the place on the page.
document.querySelectorAll<HTMLAnchorElement>(".langs a").forEach((a) => a.addEventListener("click", () => (a.href = `?lang=${a.hreflang}${location.hash}`)));

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
  "mdi:wall-sconce-flat": mdiWallSconceFlat,
  "mdi:washing-machine": mdiWashingMachine,
  "mdi:window-open-variant": mdiWindowOpenVariant,
};
const svg = (path: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
customElements.define(
  "ha-icon",
  class extends HTMLElement {
    set icon(name: string) {
      this.innerHTML = `<svg viewBox="0 0 24 24" style="display:block;width:1em;height:1em;fill:currentColor"><path d="${EXTRA[name] ?? ""}"/></svg>`;
    }
  },
);

// The settings lists and the picker names read their labels before any card has set the language from hass.
const { plural, setLanguage } = await import("../src/core/i18n");
setLanguage(lang);
await import("../src/lumen-cards");

type Card = HTMLElement & { hass: HassLike; setConfig(c: unknown): void };
type Field = { name?: string; title?: string; selector?: Record<string, Record<string, unknown> | null>; schema?: Field[] };
type CardForm = { schema: Field[]; computeLabel(f: Field): string | undefined; computeHelper(f: Field): string | undefined };

const root = document.documentElement;
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const home = createDemoHome({ lang, dark: isDark() });
const cards = new Set<Card>();
home.listen((h) => cards.forEach((c) => (c.hass = h)));
const themeBtn = document.getElementById("theme") as HTMLButtonElement;
const syncTheme = () => {
  home.setDark(isDark());
  themeBtn.innerHTML = svg(isDark() ? mdiWhiteBalanceSunny : mdiWeatherNight);
  themeBtn.setAttribute("aria-label", isDark() ? tr("Light theme", "Jasny motyw") : tr("Dark theme", "Ciemny motyw"));
};
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncTheme);
new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
themeBtn.addEventListener("click", () => (root.dataset.theme = isDark() ? "light" : "dark"));
syncTheme();

// HA turns a card's toggle action into a service call; here the demo home does.
document.addEventListener("hass-action", (ev) => {
  const { config, action } = (ev as CustomEvent<{ config: Record<string, { action?: string } | string | undefined>; action: string }>).detail;
  const id = config.entity as string | undefined;
  if (!id || (config[`${action}_action`] as { action?: string } | undefined)?.action !== "toggle") return;
  home.hass().callService("homeassistant", home.hass().states[id]?.state === "on" ? "turn_off" : "turn_on", {}, { entity_id: id });
});

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

const tagOf = (card: string) => `custom:lumen-${card}-card`;
const yamlOf = (s: Section, v: Variant) => jsyaml.dump({ type: tagOf(v.card ?? s.card), ...v.config }, { lineWidth: 96, noRefs: true, quotingType: '"' }).trimEnd();

/** The card's name in HA's card picker ("Lumen · Światło"). */
function pickerName(card: string): string {
  const list = (window as unknown as { customCards?: { type: string; name: string }[] }).customCards ?? [];
  return list.find((c) => c.type === `lumen-${card}-card`)?.name ?? `Lumen · ${card}`;
}

/** A live card on the demo home. */
function makeCard(card: string, cfg: Record<string, unknown>): Card {
  const c = document.createElement(`lumen-${card}-card`) as Card;
  c.setConfig({ ...cfg, type: tagOf(card) });
  // The floating panel's button would float over the whole page on a phone: show its row instead.
  // The spacer shows nothing on a dashboard: show its outline from edit mode.
  // The weather background would take over the page: show its preview strip.
  if (card === "fab-sheet" || card === "spacer" || card === "weather-background") (c as Card & { preview: boolean }).preview = true;
  c.hass = home.hass();
  cards.add(c);
  return c;
}
const drop = (c: Card) => {
  cards.delete(c);
  c.remove();
};

/** YAML with spans for keys, values and list dashes. */
function highlight(src: string): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const value = (v: string) => {
    const lead = v.match(/^\s*/)![0];
    const body = v.slice(lead.length);
    if (!body) return esc(v);
    if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(body)) return `${lead}<span class="t-num">${body}</span>`;
    return `${lead}<span class="t-str">${esc(body)}</span>`;
  };
  return src
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)(- )?([A-Za-z_][\w-]*)(:)(.*)$/);
      if (m) return `${m[1]}${m[2] ? '<span class="t-dim">- </span>' : ""}<span class="t-key">${m[3]}</span><span class="t-dim">:</span>${value(m[5])}`;
      const d = line.match(/^(\s*)(- )(.*)$/);
      if (d) return `${d[1]}<span class="t-dim">- </span>${value(d[3])}`;
      return esc(line);
    })
    .join("\n");
}

const GESTURE: Record<Gesture, [string, string]> = {
  tap: [mdiGestureTap, tr("Tap", "Dotknij")],
  drag: [mdiGestureSwipeHorizontal, tr("Slide", "Przesuń")],
  hold: [mdiGestureTapHold, tr("Hold", "Przytrzymaj")],
  icon: [mdiCursorDefaultClickOutline, tr("Icon", "Ikona")],
  see: [mdiEyeOutline, tr("Look", "Spójrz")],
};

/** What the settings window of the card offers, in its own words (labels and help of its editor). */
function settings(s: Section): { count: number; body: HTMLElement } | null {
  // The horizontal stack's form is the vertical one's plus the card width.
  const ctor = customElements.get(`lumen-${s.card === "vertical-stack" ? "horizontal-stack" : s.card}-card`) as unknown as { getConfigForm?(): CardForm } | undefined;
  const form = ctor?.getConfigForm?.();
  if (!form) return null;
  const body = el("div", "settings");
  let count = 0;
  // an untitled row of fields (e.g. name + icon) belongs to the group around it
  const flat = (fields: Field[]): Field[] => fields.flatMap((f) => (f.schema && !f.title ? flat(f.schema) : [f]));
  const list = (title: string, fields: Field[]) => {
    const items: HTMLElement[] = [];
    const nested: [string, Field[]][] = [];
    for (const f of flat(fields)) {
      if (f.schema) {
        nested.push([f.title ?? "", f.schema]);
        continue;
      }
      if (!f.name || !f.selector) continue;
      const label = form.computeLabel(f);
      if (!label) continue;
      const li = el("li");
      li.append(el("b", "", label));
      const help = form.computeHelper(f);
      if (help) li.append(el("span", "", help));
      const options = f.selector.select?.options as ({ label: string } | string)[] | undefined;
      if (options?.length) {
        const opts = el("span", "choices");
        for (const o of options) opts.append(el("i", "", typeof o === "string" ? o : o.label));
        li.append(opts);
      }
      items.push(li);
      count++;
    }
    if (items.length) {
      const group = el("div", "set-group");
      if (title) group.append(el("h4", "", title));
      const ul = el("ul");
      ul.append(...items);
      group.append(ul);
      body.append(group);
    }
    for (const [t, f] of nested) list(t, f);
  };
  list("", form.schema);
  return count ? { count, body } : null;
}

/** A row that opens to show more: how to add, settings, YAML. */
function fold(title: string, note: string, content: HTMLElement): HTMLDetailsElement {
  const d = el("details", "fold");
  const sum = el("summary");
  sum.append(el("span", "fold-title", title));
  if (note) sum.append(el("span", "fold-note", note));
  sum.insertAdjacentHTML("beforeend", `<span class="chev">${svg(mdiChevronDown)}</span>`);
  d.append(sum, content);
  return d;
}

function howToAdd(s: Section): HTMLElement {
  const names = sectionCards(s).map(pickerName);
  const ol = el("ol", "steps");
  const step = (html: string) => {
    const li = el("li");
    li.innerHTML = html;
    ol.append(li);
  };
  step(tr("Open your dashboard and click the <b>pencil</b> in the top right corner.", "Otwórz dashboard i kliknij <b>ołówek</b> w prawym górnym rogu."));
  step(tr("Click <b>+ Add card</b>.", "Kliknij <b>+ Dodaj kartę</b>."));
  const picks = names.map((n) => `<span class="pill">${n}</span>`).join(tr(" or ", " albo "));
  step(tr(`Type <b>Lumen</b> in the search box and pick ${picks}.`, `Wpisz w wyszukiwarkę <b>Lumen</b> i wybierz ${picks}.`));
  step(
    s.card === "spacer"
      ? tr("Leave the height empty so the card matches the floating buttons, or enter a number of pixels. Click <b>Save</b>.", "Zostaw wysokość pustą, żeby karta dopasowała się do pływających przycisków, albo wpisz liczbę pikseli. Kliknij <b>Zapisz</b>.")
      : s.card === "title" || s.card === "greeting"
        ? tr("Type your text or keep the default, and click <b>Save</b>.", "Wpisz tekst albo zostaw domyślny i kliknij <b>Zapisz</b>.")
        : tr("Pick your device in the first field. The preview changes right away. Click <b>Save</b>.", "W pierwszym polu wybierz swoje urządzenie. Podgląd zmieni się od razu. Kliknij <b>Zapisz</b>."),
  );
  return ol;
}

function yamlBox(s: Section, get: () => Variant): HTMLElement {
  const box = el("div", "yaml");
  const bar = el("div", "yaml-bar");
  bar.append(el("span", "", tr("Paste it in the card's window: ⋮ → Edit in YAML", "Wklej w oknie karty: ⋮ → Edytuj w YAML")));
  const copy = el("button", "copy");
  const label = (ok: boolean) => (copy.innerHTML = `${svg(ok ? mdiCheck : mdiContentCopy)}<span>${ok ? tr("Copied", "Skopiowano") : tr("Copy", "Kopiuj")}</span>`);
  label(false);
  const pre = el("pre");
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(yamlOf(s, get())).then(
      () => {
        label(true);
        window.setTimeout(() => label(false), 1600);
      },
      () => getSelection()?.selectAllChildren(pre),
    );
  });
  bar.append(copy);
  box.append(bar, pre);
  return box;
}

const REPO_RAW = "https://raw.githubusercontent.com/dkej123/lumen-cards/main";
const CARD_DOCS = import.meta.glob<string>("../docs/agents/cards/*.md", { query: "?raw", import: "default", eager: true });

/** A Markdown file for agents, always in English: copy it, or open the file itself. */
function mdBox(file: string, text: string): HTMLElement {
  const box = el("div", "yaml md-box");
  const bar = el("div", "yaml-bar");
  bar.append(el("span", "", file.split("/").pop()!));
  const open = el("a", "copy", tr("Open .md", "Otwórz .md"));
  open.href = `${REPO_RAW}/${file}`;
  open.target = "_blank";
  open.rel = "noopener";
  const copy = el("button", "copy");
  const label = (ok: boolean) => (copy.innerHTML = `${svg(ok ? mdiCheck : mdiContentCopy)}<span>${ok ? tr("Copied", "Skopiowano") : tr("Copy", "Kopiuj")}</span>`);
  label(false);
  const pre = el("pre", "", text.replace(/^<!-- GENERATED[^\n]*\n\n/, ""));
  pre.tabIndex = 0;
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(text).then(
      () => {
        label(true);
        window.setTimeout(() => label(false), 1600);
      },
      () => getSelection()?.selectAllChildren(pre),
    );
  });
  bar.append(open, copy);
  box.append(bar, pre);
  return box;
}

function sectionView(s: Section): HTMLElement {
  const g = GUIDE[s.id];
  const sec = el("section", "card");
  sec.id = s.id;

  const head = el("header", "card-head");
  head.append(el("span", "eyebrow", s.group), el("h2", "", s.name), el("p", "tagline", g.tagline));

  // live preview with its looks
  const demo = el("div", "demo");
  const looks = el("div", "looks");
  looks.setAttribute("role", "tablist");
  looks.setAttribute("aria-label", tr(`Looks of the ${s.name} card`, `Wygląd karty ${s.name}`));
  const stage = el("div", "stage");
  const grid = el("div", "stage-grid");
  stage.append(grid);
  const hint = el("p", "hint");
  if (s.variants.length > 1) demo.append(looks);
  demo.append(stage, hint);

  // the words
  const text = el("div", "words");
  text.append(el("p", "about", g.about));
  const need = el("p", "need");
  need.append(el("span", "", tr("You need", "Potrzebujesz")), el("b", "", g.need));
  const how = el("ul", "how");
  for (const [k, t] of g.controls) {
    const li = el("li");
    li.innerHTML = `<span class="g-icon" title="${GESTURE[k][1]}">${svg(GESTURE[k][0])}</span>`;
    li.append(el("span", "", t));
    how.append(li);
  }
  const agentLink = el("a", "agent-link", tr("Every option, for AI agents", "Wszystkie opcje, dla agentów AI"));
  agentLink.href = `#agent-lumen-${s.card}-card`;
  agentLink.addEventListener("click", () => document.querySelector<HTMLDetailsElement>(agentLink.hash)?.setAttribute("open", ""));
  text.append(need, el("h3", "", tr("How to use it", "Jak używać")), how, agentLink);

  const body = el("div", "card-body");
  body.append(demo, text);

  let current = s.variants[0];
  let live: Card | undefined;
  const yaml = yamlBox(s, () => current);
  const pre = yaml.querySelector("pre")!;
  const select = (v: Variant, btn: HTMLButtonElement) => {
    current = v;
    looks.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", String(x === btn)));
    if (live) drop(live);
    live = makeCard(v.card ?? s.card, v.config);
    grid.style.setProperty("--span", String(v.span ?? 12));
    grid.append(live);
    hint.textContent = v.hint ?? "";
    hint.hidden = !v.hint;
    pre.innerHTML = highlight(yamlOf(s, v));
  };
  s.variants.forEach((v, i) => {
    const b = el("button", "look", v.label);
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => select(v, b));
    looks.append(b);
    if (i === 0) select(v, b);
  });

  const more = el("div", "more");
  more.append(fold(tr("How to add it to your dashboard", "Jak dodać na swój dashboard"), tr("4 steps, no code", "4 kroki, bez pisania kodu"), howToAdd(s)));
  const set = settings(s);
  if (set) more.append(fold(tr("What you can set", "Co możesz ustawić"), tr(`${set.count} ${set.count === 1 ? "setting" : "settings"} in the card's window`, `${set.count} ${({ one: "ustawienie", few: "ustawienia", many: "ustawień" })[plural(set.count)]} w oknie karty`), set.body));
  more.append(fold(tr("YAML code", "Kod YAML"), tr("for advanced users", "dla zaawansowanych"), yaml));

  sec.append(head, body, more);
  return sec;
}

/** Gallery tile: the card's full look, not clickable itself – the tile leads to the card's section. */
function tile(s: Section): HTMLElement {
  const a = el("a", "tile");
  a.href = `#${s.id}`;
  const prev = el("div", "tile-prev");
  prev.inert = true;
  const v = s.variants.find((x) => !x.config.layout) ?? s.variants[0];
  prev.append(makeCard(v.card ?? s.card, v.config));
  const words = el("div", "tile-words");
  words.append(el("b", "", s.name), el("span", "", GUIDE[s.id].tagline));
  a.append(prev, words);
  return a;
}

// Groups in the order of the page; sections keep their order inside a group.
const ORDER = ["Oświetlenie", "Dom", "Bezpieczeństwo", "Klimat", "Rozrywka", "Układ"].map((g) => (lang === "pl" ? g : EN[g]));
const groups = ORDER.map((name) => [name, SECTIONS.filter((s) => s.group === name)] as const).filter(([, list]) => list.length);

// for agents: the overview, then one file per card (all of them, also those without a section of their own)
document.getElementById("agents-overview")!.append(mdBox("docs/agents/overview.md", overviewMd));
const agentList = document.getElementById("agents-cards")!;
for (const [path, text] of Object.entries(CARD_DOCS).sort(([a], [b]) => (a < b ? -1 : 1))) {
  const file = path.split("/").pop()!;
  const row = fold(file.replace(/\.md$/, ""), "", mdBox(`docs/agents/cards/${file}`, text));
  row.id = `agent-${file.replace(/\.md$/, "")}`;
  agentList.append(row);
}

// hero: a small dashboard
const hero = document.getElementById("hero-cards")!;
for (const [card, cfg, span] of [
  ["greeting", { layout: "compact" }, 12],
  ["light", { entity: "light.sofa", icon: "mdi:sofa" }, 6],
  ["person", { entity: "person.alex", avatar_color: "light-blue" }, 6],
  ["climate", { entity: "climate.th_bathroom", layout: "compact" }, 12],
  ["weather", { entity: "weather.home", layout: "compact" }, 12],
] as const) {
  const c = makeCard(card, cfg);
  c.style.gridColumn = `span ${span}`;
  hero.append(c);
}

// gallery with a group filter
const filters = document.getElementById("filters")!;
const gallery = document.getElementById("gallery")!;
const tiles: [string, HTMLElement][] = [];
for (const [name, list] of groups) for (const s of list) tiles.push([name, gallery.appendChild(tile(s))]);
const ALL = tr("All", "Wszystkie");
for (const name of [ALL, ...groups.map(([n]) => n)]) {
  const b = el("button", "filter", name);
  b.setAttribute("aria-pressed", String(name === ALL));
  b.addEventListener("click", () => {
    filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    for (const [g, t] of tiles) t.hidden = name !== ALL && g !== name;
  });
  filters.append(b);
}
document.getElementById("count")!.textContent = String(new Set(SECTIONS.flatMap(sectionCards)).size);

// one section per card
const main = document.getElementById("cards")!;
for (const [name, list] of groups) {
  main.append(el("h2", "group-title", name));
  for (const s of list) main.append(sectionView(s));
}
document.body.classList.add("ready");

const target = location.hash.slice(1);
if (target && document.getElementById(target)) document.getElementById(target)!.scrollIntoView();
