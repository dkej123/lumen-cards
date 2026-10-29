import { html, nothing } from "lit";
import { icon } from "./lumen-icon";
import { t } from "./i18n";
import type { PressHandlers } from "./press";
import { activate, pressable, spinnerStyle } from "./press";
import { glass, prevent, tone } from "./styles";
import type { Status } from "../logic/status";

const WFX = html`<canvas class="wfx" aria-hidden="true"></canvas>`;

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

/**
 * Compact phone cell (design access bar B7, one item per card): a 52 px glass frame with the
 * tinted icon cell inside. Several of these side by side in the HA grid make up the bar.
 */
export function compactCell(o: { title: string; color: string; body: unknown; handlers?: PressHandlers; onClick?: () => void; disabled?: boolean; alert?: boolean }) {
  const h = o.handlers;
  const action = !!(h || o.onClick);
  const click = o.onClick ? activate(o.onClick) : undefined;
  return html`<div data-fx style="height:52px;padding:4px;box-sizing:border-box;border-radius:18px;background:var(--lumen-surface);border:1px solid var(--lumen-border);${glass};animation:${o.alert ? "lumenAlarmPulse 1.1s ease-in-out infinite" : "none"}">${WFX}
    <div ${pressable(h)} role=${action ? "button" : nothing} tabindex=${action ? 0 : nothing} class=${action ? "acc" : ""} title=${o.title} aria-label=${o.title} aria-disabled=${o.disabled ?? nothing}
      @click=${click?.click} @keydown=${click?.key} @contextmenu=${prevent}
      style="position:relative;height:100%;display:grid;place-items:center;border-radius:14px;background:color-mix(in srgb, ${o.color} ${action ? 16 : 14}%, transparent);color:${o.color};font-size:24px;cursor:${action ? "pointer" : "default"};user-select:none;touch-action:pan-y;transition:opacity 200ms, background-color 400ms, transform 220ms var(--lumen-ease-spring)">${o.body}</div>
  </div>`;
}
