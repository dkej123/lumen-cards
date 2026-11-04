import { css, unsafeCSS } from "lit";

// Design tokens of the cards. Theme is set with data-lumen-theme on the host.

const TOKENS = `:host{--lumen-font:'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;--lumen-mono:'IBM Plex Mono',ui-monospace,monospace;--lumen-s-1:4px;--lumen-s-2:8px;--lumen-s-3:12px;--lumen-s-4:16px;--lumen-s-5:20px;--lumen-s-6:24px;--lumen-s-8:32px;--lumen-s-10:40px;--lumen-s-12:48px;--lumen-s-16:64px;--lumen-r-xs:8px;--lumen-r-sm:12px;--lumen-r-md:16px;--lumen-r-lg:22px;--lumen-r-xl:28px;--lumen-r-pill:999px;--lumen-touch:48px;--lumen-blur:22px;--lumen-dur-1:120ms;--lumen-dur-2:220ms;--lumen-dur-3:420ms;--lumen-dur-4:700ms;--lumen-dur-breath:2400ms;--lumen-ease-out:cubic-bezier(.2,.8,.2,1);--lumen-ease-in-out:cubic-bezier(.65,0,.35,1);--lumen-ease-spring:linear(0,0.006,0.025 2.8%,0.101 6.1%,0.539 18.9%,0.721 25.3%,0.849 31.5%,0.937 38.1%,0.968 41.8%,0.991 45.7%,1.006 50.1%,1.015 55%,1.017 63.9%,1.001 85.9%,1);--lumen-ease-bounce:linear(0,0.009,0.035 2.1%,0.141,0.281 6.7%,0.723 12.9%,0.938 16.7%,1.017,1.077,1.121,1.149 24.3%,1.159,1.163,1.161,1.154 29.9%,1.129 32.8%,1.051 39.6%,1.017 43.1%,0.991,0.977 51%,0.974 53.8%,0.975 57.1%,0.997 69.8%,1.003 76.9%,1);--lumen-aq-0:oklch(0.66 0.15 152);--lumen-aq-1:oklch(0.74 0.16 135);--lumen-aq-2:oklch(0.82 0.17 115);--lumen-aq-3:oklch(0.74 0.16 58);--lumen-aq-4:oklch(0.62 0.21 27);--lumen-aq-5:oklch(0.52 0.18 312)}
:host,[data-lumen-theme=light]{color-scheme:light;--lumen-bg:#F2F0EC;--lumen-surface:rgba(255,255,255,.66);--lumen-surface-solid:#FFFFFF;--lumen-surface-2:rgba(28,24,20,.055);--lumen-sunken:#E8E5E0;--lumen-border:rgba(28,24,20,.08);--lumen-border-strong:rgba(28,24,20,.22);--lumen-text-1:#1B1916;--lumen-text-2:#57524B;--lumen-text-3:#7B756C;--lumen-accent:oklch(0.55 0.13 255);--lumen-accent-soft:oklch(0.55 0.13 255 / .12);--lumen-on-accent:#FFFFFF;--lumen-light-on:oklch(0.82 0.13 72);--lumen-light-ink:#3B2709;--lumen-fill-a:62%;--lumen-fill-b:36%;--lumen-ok:oklch(0.58 0.14 155);--lumen-warning:oklch(0.70 0.15 80);--lumen-orange:oklch(0.66 0.17 52);--lumen-danger:oklch(0.57 0.19 27);--lumen-info:oklch(0.58 0.12 240);--lumen-unavailable:#9C968D;--lumen-shadow-1:0 1px 2px rgba(40,30,20,.05),0 6px 20px -8px rgba(40,30,20,.10);--lumen-shadow-2:0 2px 6px rgba(40,30,20,.06),0 30px 70px -20px rgba(40,30,20,.30);--lumen-scrim:rgba(30,25,20,.28)}
:host([data-lumen-theme=dark]),[data-lumen-theme=dark]{color-scheme:dark;--lumen-bg:#121110;--lumen-surface:rgba(36,34,31,.62);--lumen-surface-solid:#1D1C1A;--lumen-surface-2:rgba(255,248,240,.065);--lumen-sunken:#0C0B0A;--lumen-border:rgba(255,248,240,.085);--lumen-border-strong:rgba(255,248,240,.24);--lumen-text-1:#F2EEE8;--lumen-text-2:#B4ADA3;--lumen-text-3:#8D877E;--lumen-accent:oklch(0.74 0.11 255);--lumen-accent-soft:oklch(0.74 0.11 255 / .16);--lumen-on-accent:#0E1420;--lumen-light-on:oklch(0.82 0.13 72);--lumen-light-ink:#2A1C06;--lumen-fill-a:36%;--lumen-fill-b:16%;--lumen-ok:oklch(0.76 0.14 155);--lumen-warning:oklch(0.82 0.14 85);--lumen-orange:oklch(0.76 0.15 58);--lumen-danger:oklch(0.70 0.17 25);--lumen-info:oklch(0.74 0.11 240);--lumen-unavailable:#6E6962;--lumen-shadow-1:inset 0 1px 0 rgba(255,255,255,.04),0 8px 24px -10px rgba(0,0,0,.6);--lumen-shadow-2:inset 0 1px 0 rgba(255,255,255,.05),0 30px 80px -20px rgba(0,0,0,.8);--lumen-scrim:rgba(0,0,0,.5)}
@keyframes lumenRise{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
@keyframes lumenSpin{to{transform:rotate(360deg)}}
@keyframes lumenBreath{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.9)}}
@keyframes lumenSheetIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes lumenSheetOut{from{transform:translateY(0)}to{transform:translateY(100%)}}
@keyframes lumenModalIn{from{opacity:0;transform:translateY(18px) scale(.95)}to{opacity:1;transform:none}}
@keyframes lumenModalOut{from{opacity:1;transform:none}to{opacity:0;transform:translateY(10px) scale(.97)}}
@keyframes lumenFadeIn{from{opacity:0}to{opacity:1}}
@keyframes lumenFadeOut{from{opacity:1}to{opacity:0}}
@keyframes lumenToastIn{from{opacity:0;transform:translateY(-18px) scale(.94)}to{opacity:1;transform:none}}
@keyframes lumenPop{0%{transform:scale(1)}28%{transform:scale(.9)}100%{transform:scale(1)}}
@keyframes lumenAlarmPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--lumen-danger) 50%,transparent)}50%{box-shadow:0 0 0 9px color-mix(in srgb,var(--lumen-danger) 0%,transparent)}}
@keyframes lumenShake{0%,100%{transform:rotate(0)}15%{transform:rotate(-14deg)}30%{transform:rotate(12deg)}45%{transform:rotate(-8deg)}60%{transform:rotate(5deg)}75%{transform:rotate(0)}}
@keyframes lumenAlarmBg{0%,100%{background-color:var(--lumen-danger)}50%{background-color:color-mix(in srgb,var(--lumen-danger) 72%,#000)}}
@keyframes lumenAlarmRing{0%,100%{box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--lumen-danger) 80%,transparent),inset 0 0 80px color-mix(in srgb,var(--lumen-danger) 28%,transparent)}50%{box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--lumen-danger) 25%,transparent),inset 0 0 20px transparent}}
@keyframes lumenTwinkle{0%,84%,100%{transform:rotate(0) scale(1)}89%{transform:rotate(-14deg) scale(1.18)}94%{transform:rotate(8deg) scale(.94)}}
@keyframes lumenHalo{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.7);opacity:0}}
@keyframes lumenDot{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--lumen-ok) 55%,transparent)}60%{box-shadow:0 0 0 6px transparent}}
@keyframes lumenDotRing{0%{transform:scale(1);opacity:.55}60%,100%{transform:scale(2);opacity:0}}
@keyframes lumenSkel{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
:host([data-lumen-motion=off]) *,:host([data-lumen-motion=off]) *::before{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
.lumen-noscroll{scrollbar-width:none}.lumen-noscroll::-webkit-scrollbar{display:none}`;

export const tokens = css`${unsafeCSS(TOKENS)}`;
