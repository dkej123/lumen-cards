import { html, nothing } from "lit";
import { icon } from "./lumen-icon";
import { t } from "./i18n";
import type { PressHandlers } from "./press";
import { activate, pressable, spinnerStyle } from "./press";
import { glass, prevent, tone } from "./styles";
import type { Status } from "../logic/status";
import { WFX } from "./parts";


/** Alarm status row (design `statusRow`). */
export function statusRow(s: Status, title: string, opts: { pending?: boolean; handlers?: PressHandlers; showState?: boolean; extra?: unknown } = {}) {
  const c = tone(s.tone);
  const trig = !!s.alert;
  const h = opts.handlers;
  return html`<div data-fx ${pressable(h)} aria-label="${title} · ${s.label}"
    class="press" style="display:flex;align-items:center;gap:12px;min-height:60px;padding:10px 14px 10px 10px;box-sizing:border-box;border-radius:20px;background:${trig ? "color-mix(in srgb, var(--lumen-danger) 16%, var(--lumen-surface-solid))" : "var(--lumen-surface)"};border:${trig ? "1px solid var(--lumen-danger)" : "1px solid var(--lumen-border)"};${glass};cursor:${h ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:background-color 500ms, border-color 500ms, transform 220ms var(--lumen-ease-spring);animation:${trig ? "lumenAlarmPulse 1.1s ease-in-out infinite" : "none"}">${WFX}
    <div style="width:40px;height:40px;flex:none;border-radius:14px;display:grid;place-items:center;font-size:22px;background:color-mix(in srgb, ${c} 16%, transparent);color:${c};transition:background-color 500ms, color 500ms">${icon(s.icon, `display:block;animation:${trig ? "lumenShake 900ms ease-in-out infinite" : s.busy ? "lumenBreath 2400ms ease-in-out infinite" : "none"}`)}</div>
    <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;line-height:19px">${title}</div>${opts.showState !== false ? html`<div style="font-size:12px;font-weight:600;line-height:16px;color:var(--lumen-text-2)">${s.label}</div>` : nothing}</div>
    ${opts.pending ? html`<span style=${spinnerStyle(16)}></span>` : nothing}${opts.extra ?? nothing}
  </div>`;
}

/** Alarm banner while the alarm is triggered (design `alarmBanner`). */
export function alarmBanner(mobile: boolean, text: string, onTap?: () => void) {
  const a = onTap ? activate(onTap) : undefined;
  return html`<div role=${a ? "button" : "alert"} tabindex=${a ? 0 : nothing} @click=${a?.click} @keydown=${a?.key} style="display:flex;align-items:center;gap:${mobile ? 12 : 14}px;padding:${mobile ? "12px 14px 12px 12px" : "14px 18px 14px 14px"};border-radius:22px;color:#fff;cursor:${a ? "pointer" : "default"};background:var(--lumen-danger);animation:lumenAlarmBg 1.2s ease-in-out infinite">
    <div style="width:${mobile ? 42 : 44}px;height:${mobile ? 42 : 44}px;border-radius:${mobile ? 14 : 15}px;display:grid;place-items:center;font-size:${mobile ? 24 : 26}px;background:rgba(0,0,0,.18);color:oklch(0.9 0.16 95)">${icon("mdi:alarm-light", "display:block;animation:lumenShake 900ms ease-in-out infinite")}</div>
    <div style="flex:1"><div style="font-size:${mobile ? 16 : 17}px;font-weight:800">${text}</div>${a ? html`<div style="font-size:${mobile ? 12 : 13}px;font-weight:600;opacity:.9">${t("card.alarm.banner_hint")}</div>` : nothing}</div>
  </div>`;
}

/** Pulsing red ring around the whole screen while the alarm is triggered. */
export const alarmRing = () => html`<div style="position:absolute;inset:0;z-index:5;pointer-events:none;animation:lumenAlarmRing 1.2s ease-in-out infinite"></div>`;

/** Height (px) of every compact look (catalog correction 2026-10-30): equal in a row, touch minimum. */
export const COMPACT_H = 44;

/**
 * Compact phone cell (design access bar B7, one item per card): a 44 px tinted cell (r14) with a
 * 22 px glyph in the state's tone. Several of these side by side in the HA grid make up the bar.
 * `extra` (one sub-button, owner decision) sits beside the cell in the same 44 px row.
 */
export function compactCell(o: { title: string; color: string; body: unknown; handlers?: PressHandlers; onClick?: () => void; disabled?: boolean; alert?: boolean; unavailable?: boolean; extra?: unknown }) {
  const h = o.handlers;
  const action = !!(h || o.onClick);
  const click = o.onClick ? activate(o.onClick) : undefined;
  // Triggered alarm: danger background with a pulse, white glyph.
  const bg = o.alert ? "var(--lumen-danger)" : o.unavailable ? "var(--lumen-surface-2)" : `color-mix(in srgb, ${o.color} 14%, transparent)`;
  const fg = o.alert ? "#fff" : o.color;
  return html`<div data-fx style="display:flex;align-items:center;gap:4px;height:${COMPACT_H}px">${WFX}
    <div ${pressable(h)} role=${action ? "button" : nothing} tabindex=${action ? 0 : nothing} class=${action ? "acc" : ""} title=${o.title} aria-label=${o.title} aria-disabled=${o.disabled ?? nothing}
      @click=${click?.click} @keydown=${click?.key} @contextmenu=${prevent}
      style="position:relative;flex:1;min-width:0;height:${COMPACT_H}px;box-sizing:border-box;display:grid;place-items:center;border-radius:14px;border:${o.unavailable ? "1px dashed var(--lumen-border-strong)" : "1px solid transparent"};background:${bg};color:${fg};font-size:22px;cursor:${action && !o.disabled ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:opacity 200ms, background-color 400ms, transform 200ms var(--lumen-ease-spring);animation:${o.alert ? "lumenAlarmBg 1.2s ease-in-out infinite" : "none"}">${o.body}</div>${o.extra ?? nothing}
  </div>`;
}
