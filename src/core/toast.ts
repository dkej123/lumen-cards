import { LitElement, html, nothing } from "lit";
import { tokens } from "../design/tokens";
import { icon } from "./lumen-icon";
import { tone } from "./styles";

export interface Toast {
  icon: string;
  tone: string;
  title: string;
  text: string;
  code?: string;
}

/** Page-wide toast stack (design `renderToasts`): max 3, 3.8 s each, top centre. */
class LumenToaster extends LitElement {
  static properties = { items: { state: true } };
  items: (Toast & { id: number })[] = [];

  static styles = [tokens];

  push(t: Toast) {
    const id = Math.random();
    this.items = [...this.items.slice(-2), { ...t, id }];
    window.setTimeout(() => (this.items = this.items.filter((x) => x.id !== id)), 3800);
  }

  render() {
    if (!this.items.length) return nothing;
    return html`<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:60;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(420px, calc(100% - 32px))">
      ${this.items.map((t) => {
        const c = tone(t.tone);
        return html`<div role="status" style="pointer-events:auto;width:100%;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 16px 12px 12px;border-radius:20px;background:var(--lumen-surface-solid);color:var(--lumen-text-1);border:1px solid var(--lumen-border);box-shadow:var(--lumen-shadow-2);font-family:var(--lumen-font);animation:lumenToastIn 520ms var(--lumen-ease-spring) both">
          <div style="width:38px;height:38px;flex:none;border-radius:13px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb, ${c} 16%, transparent);color:${c}">${icon(t.icon)}</div>
          <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:750">${t.title}</div><div style="font-size:12px;font-weight:600;color:var(--lumen-text-2);overflow:hidden;text-overflow:ellipsis">${t.text}</div></div>
          ${t.code ? html`<span style="padding:4px 8px;border-radius:8px;background:color-mix(in srgb, ${c} 16%, transparent);color:${c};font:600 12px var(--lumen-mono)">${t.code}</span>` : nothing}
        </div>`;
      })}
    </div>`;
  }
}
if (!customElements.get("lumen-cards-toaster")) customElements.define("lumen-cards-toaster", LumenToaster);

/** Show a toast; `from` gives the theme (the card that raised it). */
export function toast(from: HTMLElement, t: Toast): void {
  let el = document.querySelector<LumenToaster>("lumen-cards-toaster");
  if (!el) {
    el = document.createElement("lumen-cards-toaster") as LumenToaster;
    document.body.append(el);
  }
  el.setAttribute("data-lumen-theme", from.getAttribute("data-lumen-theme") ?? "light");
  el.style.cssText = `position:relative;z-index:60;font-family:var(--lumen-font);${from.style.cssText}`;
  el.push(t);
}
