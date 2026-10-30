import { html, nothing, type TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { icon } from "./lumen-icon";
import type { VisibilityLabel } from "./visibility";
import { t } from "./i18n";
import type { PressHandlers } from "./press";
import { pressable } from "./press";
import { glass, prevent, stop } from "./styles";

// Building blocks of the Lumen Cards catalog (2026-10-29): the row card (R), the compact tile (C),
// the icon tile (I), segment buttons (B), the countdown bar, the code pad (PAD) and the general
// states of section 15 (error card, loading skeleton, sample badge).

export const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;
const DASH = "1px dashed var(--lumen-border-strong)";

/** Look of a row / tile: the catalog's `R` / `C` fields. */
export interface Look {
  icon: string;
  /** Status line. */
  sub: string;
  /** Status line colour (default text-2). */
  subC?: string;
  /** Muted extra after the status ("5 min"). */
  meta?: string;
  iconBg?: string;
  iconFg?: string;
  iconAnim?: string;
  bg?: string;
  fg?: string;
  border?: string;
  shadow?: string;
  anim?: string;
  /** Unavailable: dashed frame, plug-off glyph, actions off. */
  una?: boolean;
}

/** `tone(C)` of the catalog: icon on C 16 %, status line in C. */
export const toned = (c: string): Pick<Look, "iconBg" | "iconFg" | "subC"> => ({ iconBg: `color-mix(in srgb, ${c} 16%, transparent)`, iconFg: c, subC: c });

/** Section 15: unavailable = dashed frame on surface-2, unavailable-coloured icon, "Unavailable". */
export const unavailableLook = (ic: string): Look => ({
  icon: ic,
  sub: t("common.unavailable"),
  subC: "var(--lumen-text-3)",
  border: DASH,
  bg: "var(--lumen-surface-2)",
  shadow: "none",
  iconBg: "transparent",
  iconFg: "var(--lumen-unavailable)",
  una: true,
});

/** Red frame of open / jammed / error states. */
export const dangerBorder = "1px solid color-mix(in srgb, var(--lumen-danger) 40%, var(--lumen-border))";

/** A segment button of the catalog (`B`). */
export interface Seg {
  icon: string;
  label: string;
  /** Current state: raised on surface-solid. */
  on?: boolean;
  /** Command on its way: spinner instead of the icon. */
  spin?: boolean;
  /** Not available right now (opacity .38). */
  off?: boolean;
  /** Text colour override (e.g. white on the red triggered row). */
  color?: string;
  tap?: () => void;
  aria?: string;
}

/** Segment group: inline at the right of a row, or a full-width second row (`row`). */
export function segs(list: Seg[], row: boolean, cls = "") {
  return html`<div class=${cls} role="group" style="${row ? "position:relative;" : "flex:none;"}display:flex;gap:2px;padding:3px;border-radius:14px;background:var(--lumen-surface-2)">${list.map(
    (b) => html`<button class="seg" aria-label=${b.aria ?? b.label} aria-pressed=${b.on ? "true" : "false"} ?disabled=${!!b.off || !b.tap}
      @click=${(e: Event) => {
        e.stopPropagation();
        b.tap?.();
      }} @pointerdown=${stop} @contextmenu=${prevent}
      style="${row ? "flex:1;min-width:0;padding:0 8px;" : "min-width:40px;padding:0 10px;"}min-height:40px;box-sizing:border-box;border:0;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:5px;background:${b.on ? "var(--lumen-surface-solid)" : "transparent"};color:${b.color ?? (b.on ? "var(--lumen-text-1)" : "var(--lumen-text-2)")};box-shadow:${b.on ? "var(--lumen-shadow-1)" : "none"};opacity:${b.off ? 0.38 : 1};font:700 12px var(--lumen-font);white-space:nowrap;cursor:${b.off || !b.tap ? "default" : "pointer"};transition:opacity 300ms, background-color 200ms, transform 200ms var(--lumen-ease-spring)">${icon(b.spin ? "mdi:loading" : b.icon, `display:block;font-size:16px;animation:${b.spin ? "lumenSpin 900ms linear infinite" : "none"}`)}<span style="overflow:hidden;text-overflow:ellipsis">${b.label}</span></button>`,
  )}</div>`;
}

/** Countdown bar under a row: `pct` 0–100, or null = indeterminate (time unknown). */
export function countdown(pct: number | null, color: string, label: string, labelColor = color) {
  const fill = pct === null
    ? html`<div style="width:40%;height:100%;border-radius:3px;background:${color};animation:lumenIndeterminate 1.6s var(--lumen-ease-in-out) infinite"></div>`
    : html`<div style="width:${Math.max(0, Math.min(100, pct))}%;height:100%;border-radius:3px;background:${color};transition:width 1s linear"></div>`;
  return html`<div style="position:relative;display:flex;align-items:center;gap:10px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct === null ? nothing : Math.round(pct)}>
    <div style="flex:1;height:6px;border-radius:3px;background:var(--lumen-surface-2);overflow:hidden">${fill}</div>${label ? html`<span style="flex:none;font-size:12px;font-weight:650;color:${labelColor};font-variant-numeric:tabular-nums">${label}</span>` : nothing}
  </div>`;
}

/** Icon box of a row (34 px, radius 12). */
export const rowIcon = (l: Look) =>
  html`<div style="flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:${l.iconBg ?? "var(--lumen-surface-2)"};color:${l.iconFg ?? "var(--lumen-text-2)"};transition:background-color 400ms, color 400ms">${icon(l.icon, `display:block;animation:${l.iconAnim ?? "none"}`)}</div>`;

/** Title + status line of a row. */
export const rowText = (title: string, l: Look, showSub = true) =>
  html`<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
    <span style="font-size:14px;font-weight:700;letter-spacing:-0.01em;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>
    ${showSub ? html`<div style="font-size:13px;line-height:17px;font-weight:650;color:${l.subC ?? "var(--lumen-text-2)"};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.sub}${l.meta ? html`<span style="margin-left:8px;color:var(--lumen-text-3);font-weight:600">${l.meta}</span>` : nothing}</div>` : nothing}
  </div>`;

/** Frame style of the row card (`R`). */
export const rowFrame = (l: Look, pointer: boolean) =>
  `position:relative;display:flex;flex-direction:column;gap:10px;padding:11px 12px;box-sizing:border-box;border-radius:20px;background:${l.bg ?? "var(--lumen-surface)"};border:${l.border ?? "1px solid var(--lumen-border)"};box-shadow:${l.shadow ?? "var(--lumen-shadow-1)"};${l.una ? "" : glass + ";"}color:${l.fg ?? "var(--lumen-text-1)"};animation:${l.anim ?? "none"};cursor:${pointer ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:background-color 500ms, border-color 500ms, color 500ms, transform 220ms var(--lumen-ease-spring)`;

/** Plug-off glyph at the right of an unavailable row. */
export const unplugged = () => icon("mdi:power-plug-off-outline", "flex:none;font-size:18px;color:var(--lumen-text-3)");

/**
 * Compact tile (`C`, 2 grid rows = 120 px): icon top left, name + status at the bottom.
 * `tap` makes the whole tile a button.
 */
export function compactTile(o: { title: string; look: Look; handlers?: PressHandlers; label?: string }) {
  const l = o.look;
  const action = !!o.handlers;
  return html`<div data-fx ${pressable(o.handlers)} role=${action ? "button" : nothing} tabindex=${action ? 0 : nothing} aria-label=${o.label ?? `${o.title} · ${l.sub}`} title=${o.label ?? `${o.title} · ${l.sub}`} class=${action ? "press" : ""}
    style="position:relative;height:120px;padding:10px;box-sizing:border-box;border-radius:18px;background:${l.bg ?? "var(--lumen-surface)"};border:${l.border ?? "1px solid var(--lumen-border)"};box-shadow:${l.shadow ?? "var(--lumen-shadow-1)"};${l.una ? "" : glass + ";"}color:${l.fg ?? "var(--lumen-text-1)"};animation:${l.anim ?? "none"};display:flex;flex-direction:column;justify-content:space-between;cursor:${action ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:background-color 500ms, transform 220ms var(--lumen-ease-spring)">${WFX}
    <div style="width:30px;height:30px;border-radius:11px;display:grid;place-items:center;font-size:17px;background:${l.iconBg ?? "var(--lumen-surface-2)"};color:${l.iconFg ?? "var(--lumen-text-2)"}">${icon(l.icon, `display:block;animation:${l.iconAnim ?? "none"}`)}</div>
    <div style="min-width:0">
      <div style="font-size:12px;font-weight:700;line-height:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${o.title}</div>
      <div style="font-size:11px;font-weight:600;line-height:14px;color:${l.subC ?? "var(--lumen-text-2)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${l.sub}</div>
    </div>
  </div>`;
}

/** Icon tile (`I`, under 100 px of card width): only the 40 px icon; the name goes to aria-label and the tooltip. */
export function iconTile(o: { title: string; look: Look; handlers?: PressHandlers }) {
  const l = o.look;
  const action = !!o.handlers;
  const label = `${o.title} · ${l.sub}`;
  return html`<div data-fx ${pressable(o.handlers)} role=${action ? "button" : nothing} tabindex=${action ? 0 : nothing} aria-label=${label} title=${label} class=${action ? "press" : ""}
    style="position:relative;height:84px;border-radius:18px;background:${l.bg ?? "var(--lumen-surface)"};border:${l.border ?? "1px solid var(--lumen-border)"};box-shadow:${l.shadow ?? "var(--lumen-shadow-1)"};${l.una ? "" : glass + ";"}animation:${l.anim ?? "none"};display:grid;place-items:center;cursor:${action ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:transform 220ms var(--lumen-ease-spring)">${WFX}
    <div style="width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:${l.iconBg ?? "var(--lumen-surface-2)"};color:${l.iconFg ?? "var(--lumen-text-2)"}">${icon(l.icon, `display:block;animation:${l.iconAnim ?? "none"}`)}</div>
  </div>`;
}

/** Section 15: configuration error in Lumen style instead of HA's error card. */
export const errorCard = (title: string, detail: string) =>
  html`<div role="alert" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:20px;background:color-mix(in srgb, var(--lumen-danger) 7%, var(--lumen-surface));border:1px dashed color-mix(in srgb, var(--lumen-danger) 50%, transparent)">
    <div style="flex:none;width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:color-mix(in srgb, var(--lumen-danger) 16%, transparent);color:var(--lumen-danger)">${icon("mdi:alert-circle-outline")}</div>
    <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;line-height:18px">${title}</div><div style="font:500 12px/16px var(--lumen-mono);color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${detail}</div></div>
  </div>`;

/** Section 15: loading skeleton in the card's size, pulsing every 1.4 s. */
export const skeleton = (height = 58) =>
  html`<div aria-busy="true" aria-label=${t("common.loading")} style="display:flex;align-items:center;gap:10px;height:${height}px;padding:0 12px;box-sizing:border-box;border-radius:20px;background:var(--lumen-surface);border:1px solid var(--lumen-border);animation:lumenSkel 1.4s ease-in-out infinite"><span style="flex:none;width:34px;height:34px;border-radius:12px;background:var(--lumen-surface-2)"></span><div style="flex:1;display:flex;flex-direction:column;gap:6px"><span style="width:55%;height:12px;border-radius:6px;background:var(--lumen-surface-2)"></span><span style="width:32%;height:10px;border-radius:5px;background:var(--lumen-surface-2)"></span></div></div>`;

/** Section 15: "Example" badge of a card picker preview that shows sample data. */
export const sampleBadge = () =>
  html`<span style="position:absolute;top:8px;right:10px;z-index:4;padding:1px 6px;border-radius:6px;background:var(--lumen-surface-2);font:500 10px/14px var(--lumen-mono);color:var(--lumen-text-2);pointer-events:none">${t("common.example")}</span>`;

/** Dashboard edit mode: where the card shows (HA visibility) and its `edit_note`, top left. */
export const editLabel = (labels: VisibilityLabel[], note: string) => {
  const text = (l: VisibilityLabel) =>
    l.kind === "narrow" ? t("edit.narrow", { px: l.max! + 1 })
    : l.kind === "wide" ? t("edit.wide", { px: l.min! })
    : l.kind === "screen" ? (l.text ?? t("edit.screen", { min: l.min!, max: l.max! }))
    : t(`edit.${l.kind}`);
  const ico = labels.some((l) => l.kind === "narrow") ? "mdi:cellphone" : labels.some((l) => l.kind === "wide") ? "mdi:monitor" : "mdi:eye-outline";
  const parts = [...labels.map(text), ...(note ? [note] : [])];
  return html`<span style="position:absolute;top:-6px;left:8px;z-index:5;display:flex;align-items:center;gap:4px;max-width:calc(100% - 16px);padding:2px 7px 2px 5px;box-sizing:border-box;border-radius:8px;background:var(--lumen-info);color:#fff;box-shadow:var(--lumen-shadow-1);font:700 10px/14px var(--lumen-font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${icon(labels.length ? ico : "mdi:note-text-outline", "display:block;flex:none;font-size:12px")}<span style="overflow:hidden;text-overflow:ellipsis">${parts.join(" · ")}</span></span>`;
};

/** A choice above the code pad (alarm modes). */
export interface PadMode {
  icon: string;
  label: string;
  active: boolean;
  on: () => void;
}

export interface PadOptions {
  title: string;
  sub: string;
  icon: string;
  color: string;
  modes?: PadMode[];
  /** pin = digit keys, text = text field (code_format "text"), none = only the action button. */
  kind: "pin" | "text" | "none";
  code: string;
  /** Error text under the dots (wrong code). */
  error?: string;
  /** Changes on every failed attempt: replays the 500 ms shake. */
  shakeKey?: number;
  busy?: boolean;
  act: string;
  narrow: boolean;
  onKey: (key: string) => void;
  onText: (value: string) => void;
  submit: () => void;
  close: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "bk"];

/** Code pad dialog (catalog `PAD`) for the layer: bottom sheet on a narrow screen, centred dialog otherwise. */
export function codePad(o: PadOptions): TemplateResult {
  const n = Math.max(4, Math.min(8, o.code.length));
  const err = !!o.error;
  const dots = Array.from({ length: err ? 4 : n }, (_, i) => {
    const filled = err || i < o.code.length;
    const c = err ? "var(--lumen-danger)" : "var(--lumen-text-1)";
    return html`<span style="width:14px;height:14px;border-radius:50%;background:${filled ? c : "transparent"};box-shadow:inset 0 0 0 2px ${filled ? c : "var(--lumen-border-strong)"};transition:background-color 150ms"></span>`;
  });
  const keydown = (e: KeyboardEvent) => {
    if (o.kind !== "pin") return;
    if (/^\d$/.test(e.key)) o.onKey(e.key);
    else if (e.key === "Backspace") o.onKey("bk");
    else if (e.key === "Enter") o.submit();
    else return;
    e.preventDefault();
  };
  const submitText = (e: Event) => {
    e.preventDefault();
    o.submit();
  };
  const pos = o.narrow
    ? "position:absolute;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom));margin:0 auto;max-width:400px;animation:lumenSheetIn 460ms var(--lumen-ease-spring) both"
    : "position:absolute;left:50%;top:50%;width:340px;transform:translate(-50%,-50%);animation:lumenFadeIn 200ms both";
  return html`
    <div @click=${o.close} style="position:absolute;inset:0;z-index:20;background:var(--lumen-scrim);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:lumenFadeIn 240ms both"></div>
    <div role="dialog" aria-modal="true" aria-label=${o.title} @keydown=${keydown}
      style="${pos};z-index:21;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;padding:20px 18px 16px;border-radius:28px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);font-family:var(--lumen-font)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="flex:none;width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb, ${o.color} 16%, transparent);color:${o.color}">${icon(o.icon)}</span>
        <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800">${o.title}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.sub}</div></div>
        <button class="press" @click=${o.close} aria-label=${t("common.close")} style="flex:none;width:40px;height:40px;border-radius:50%;border:0;display:grid;place-items:center;font-size:20px;background:var(--lumen-surface-2);color:var(--lumen-text-2);cursor:pointer">${icon("mdi:close")}</button>
      </div>
      ${o.modes?.length
        ? html`<div role="radiogroup" aria-label=${t("card.alarm.mode")} style="display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--lumen-surface-2)">${o.modes.map(
            (m) => html`<button role="radio" aria-checked=${m.active ? "true" : "false"} @click=${m.on} style="flex:1;min-width:0;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border:0;border-radius:12px;background:${m.active ? "var(--lumen-surface-solid)" : "transparent"};color:${m.active ? "var(--lumen-text-1)" : "var(--lumen-text-2)"};box-shadow:${m.active ? "var(--lumen-shadow-1)" : "none"};font:700 11px var(--lumen-font);cursor:pointer">${icon(m.icon, "font-size:17px;line-height:18px")}<span style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.label}</span></button>`,
          )}</div>`
        : nothing}
      ${o.kind === "pin"
        ? html`${keyed(o.shakeKey ?? 0, html`<div aria-hidden="true" style="display:flex;justify-content:center;gap:14px;padding:4px 0;animation:${err ? "lumenNudge 500ms ease-in-out" : "none"}">${dots}</div>`)}`
        : nothing}
      ${o.kind === "text"
        ? html`<form @submit=${submitText} style="display:flex;flex-direction:column"><input name="code" type="password" autocomplete="off" aria-label=${t("card.lock.code")} placeholder=${t("card.lock.code")} .value=${o.code}
            @input=${(e: Event) => o.onText((e.target as HTMLInputElement).value)}
            style="height:52px;border-radius:16px;border:1px solid ${err ? "var(--lumen-danger)" : "var(--lumen-border)"};background:var(--lumen-surface-2);color:var(--lumen-text-1);font:700 20px var(--lumen-font);text-align:center;letter-spacing:.2em;outline:none;animation:${err ? "lumenNudge 500ms ease-in-out" : "none"}" /></form>`
        : nothing}
      ${err ? html`<div role="alert" style="margin-top:-8px;text-align:center;font-size:12px;font-weight:700;color:var(--lumen-danger)">${o.error}</div>` : nothing}
      ${o.kind === "pin"
        ? html`<div style="display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:8px">${KEYS.map((k) =>
            k === ""
              ? html`<span></span>`
              : html`<button class="press" aria-label=${k === "bk" ? t("card.alarm.backspace") : k} @click=${() => o.onKey(k)} style="min-height:52px;border-radius:16px;border:0;display:flex;align-items:center;justify-content:center;background:var(--lumen-surface-2);color:var(--lumen-text-1);font:600 22px var(--lumen-font);font-variant-numeric:tabular-nums;cursor:pointer">${k === "bk" ? icon("mdi:backspace-outline", "font-size:22px") : k}</button>`,
          )}</div>`
        : nothing}
      <button class="press" ?disabled=${!!o.busy} @click=${o.submit} style="min-height:48px;border-radius:16px;border:0;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--lumen-text-1);color:var(--lumen-bg);font:750 14px var(--lumen-font);cursor:pointer">${o.busy ? icon("mdi:loading", "font-size:18px;animation:lumenSpin 900ms linear infinite") : nothing}${o.act}</button>
    </div>`;
}
