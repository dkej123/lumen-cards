import { SURF, WCFG, drawMist, drawRainSurf, drawSurf, drawWeather, drawWind } from "./fx";

// Weather renderer as a page-wide singleton:
// every Lumen card registers here, the lumen-weather-background-card card provides the scene and the
// two full-screen canvases. Drawing and timing rules are unchanged (docs: plan-optymalizacji P1).

export interface WeatherScene {
  /** Raw HA weather state (fx knows aliases like pouring/partlycloudy). */
  cond: string;
  phase: string;
  dark: boolean;
  /** Motion on and no prefers-reduced-motion. */
  animate: boolean;
  /** Weather background. */
  background: boolean;
  /** Weather on cards. */
  surface: boolean;
  /** 0–1: how established the weather is (snow depth, wetness). */
  level: number;
}

interface CardSurface {
  card: HTMLElement;
  visible: boolean;
  radius?: number;
  w?: number;
  h?: number;
  drawnSig?: string;
  /** Canvas size + scene of the last full repaint: rain repaints only what changed while it matches. */
  fullSig?: string;
  lit?: boolean;
  /** Card without glass (no backdrop blur, opaque surface): effects only on the edge. */
  edge?: boolean;
}

/**
 * A card without glass: no backdrop blur, or an opaque background
 * (surface-solid). Weather on it stays on the edge: drops, frost and the snow cap.
 */
export function isSolidCard(cs: { backdropFilter?: string; webkitBackdropFilter?: string; backgroundColor?: string; backgroundImage?: string }): boolean {
  const blur = cs.backdropFilter || cs.webkitBackdropFilter || "none";
  if (blur === "none") return true;
  const bg = cs.backgroundColor ?? "";
  const m = /rgba?\(([^)]+)\)/.exec(bg);
  if (!m || (cs.backgroundImage && cs.backgroundImage !== "none")) return false;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length < 4 || Number(parts[3]) >= 1;
}

interface Layers {
  bg: HTMLCanvasElement;
  fx: HTMLCanvasElement;
}

type Host = HTMLElement & { renderRoot: ParentNode & { getAnimations?: () => Animation[] } };

/** Room around the card for snow piled on the top edge (and drop shadows). */
export const BLEED = { x: 4, top: 16, bottom: 4 };

const TICK = 1000 / 30;
const SURF_TICKS: Record<string, number> = { rain: 1, hail: 1, snow: 2, glint: 1, fog: 0, mist: 0, wind: 0 };
const GLINT_PERIOD = 9000;
const GLINT_ACTIVE = 0.16;
const MOBILE_PX = 768;
const CLOCKED = new Set(["lumenDotRing", "lumenHalo", "lumenTwinkle", "lumenAlarmPulse", "lumenShake", "lumenAlarmBg", "lumenAlarmRing"]);

/** Effect switches, stored per device (localStorage `lumen-effects`). */
export interface EffectSettings {
  motion: boolean;
  background: boolean;
  surface: boolean;
}
export const SETTINGS_KEY = "lumen-effects";
export const readSettings = (): EffectSettings => {
  const defaults = { motion: true, background: true, surface: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return defaults;
  }
};

const OFF: WeatherScene = { cond: "cloudy", phase: "day", dark: false, animate: false, background: false, surface: false, level: 1 };

export class WeatherEngine {
  scene: WeatherScene = OFF;

  private hosts = new Set<Host>();
  private layers?: Layers;
  private layersOwner?: object;
  private raf = 0;
  private timer = 0;
  private tickNo = 0;
  private scrollUntil = 0;
  private listening = false;
  /** Pulses are stepped by the loop instead of running natively. */
  private sampled = false;

  private bg = { sig: "", st: {} as Record<string, unknown>, drawn: false, visible: true, last: 0 };
  private surf = { sig: "", st: new WeakMap<object, unknown>(), last: 0, dirty: true, hidden: false };
  private float = {
    sig: "",
    drawn: 0,
    last: 0,
    empty: false,
    rects: new Map<HTMLElement, { x: number; y: number; w: number; h: number; r: number }>(),
    rectsAt: 0,
    rectsDirty: true,
    sway: new Set<HTMLElement>(),
    mist: null as { puffs: unknown[] } | null,
    wind: null as Record<string, unknown> | null,
  };
  private surfaces = new Map<HTMLCanvasElement, CardSurface>();
  private swayEls = new Map<Host, HTMLElement[]>();
  private clocked = new Map<Host, Animation[]>();
  private clockStart = typeof performance === "undefined" ? 0 : performance.now();
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;

  // ------------------------------------------------------------- registration

  register(host: Host): void {
    this.hosts.add(host);
    this.listen();
    this.wake();
  }

  unregister(host: Host): void {
    this.hosts.delete(host);
    for (const [c, s] of this.surfaces) {
      if (s.card.getRootNode() === host.renderRoot || !s.card.isConnected) this.dropSurface(c);
    }
    this.clocked.get(host)?.forEach((a) => a.play());
    this.clocked.delete(host);
    for (const e of this.swayEls.get(host) ?? []) this.unsway(e);
    this.swayEls.delete(host);
    this.float.rectsDirty = true;
  }

  /** After a card rendered: pick up its weather canvases, sway targets and clocked animations. */
  scan(host: Host): void {
    if (!this.hosts.has(host)) return;
    const root = host.renderRoot;
    const on = host.hasAttribute("data-wfx-card");
    const seen = new Set<HTMLCanvasElement>();
    if (on) {
      root.querySelectorAll<HTMLCanvasElement>("canvas.wfx").forEach((c) => {
        seen.add(c);
        if (!this.surfaces.has(c) && c.parentElement) {
          this.surfaces.set(c, { card: c.parentElement, visible: false });
          this.io?.observe(c);
          this.ro?.observe(c.parentElement);
          this.surf.dirty = true;
        }
      });
    }
    for (const [c, s] of this.surfaces) {
      if (s.card.getRootNode() === root && !seen.has(c)) this.dropSurface(c);
    }
    this.swayEls.set(host, on ? [...root.querySelectorAll<HTMLElement>("[data-fx]")] : []);
    host.toggleAttribute("data-wfx-off", this.surf.hidden);
    this.collectAnimations(host);
    this.float.rectsDirty = true;
    this.wake();
  }

  /** The background card's full-screen canvases; the last registered owner wins. */
  setLayers(owner: object, layers: Layers | undefined): void {
    if (!layers) {
      if (this.layersOwner !== owner) return;
      this.layers = undefined;
      this.layersOwner = undefined;
      this.scene = OFF;
      this.resetSway();
      this.surf.dirty = true;
      this.wake();
      return;
    }
    this.layersOwner = owner;
    if (this.layers?.bg !== layers.bg) {
      if (this.layers) this.io?.unobserve(this.layers.bg);
      this.io?.observe(layers.bg);
      this.bg = { sig: "", st: {}, drawn: false, visible: true, last: 0 };
    }
    this.layers = layers;
    this.wake();
  }

  setScene(owner: object, scene: WeatherScene): void {
    if (this.layersOwner && this.layersOwner !== owner) return;
    this.scene = scene;
    this.wake();
  }

  private dropSurface(c: HTMLCanvasElement) {
    const s = this.surfaces.get(c);
    this.io?.unobserve(c);
    if (s) this.ro?.unobserve(s.card);
    this.surfaces.delete(c);
  }

  private listen() {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const target = e.target as HTMLCanvasElement;
        if (target === this.layers?.bg) this.bg.visible = e.isIntersecting;
        const s = this.surfaces.get(target);
        if (s) s.visible = e.isIntersecting;
      }
      this.surf.dirty = true;
      this.wake();
    });
    this.ro = new ResizeObserver(() => {
      this.surf.dirty = true;
      this.float.rectsDirty = true;
      this.wake();
    });
    document.addEventListener("visibilitychange", this.wake);
    // Dashboard scroll: hold the background, halve card redraws.
    document.addEventListener("scroll", this.onScroll, { capture: true, passive: true });
  }

  private onScroll = () => {
    this.scrollUntil = performance.now() + 200;
    this.float.rectsDirty = true;
    this.wake();
  };

  // ------------------------------------------------------------- clock

  wake = (): void => {
    if (this.raf || typeof requestAnimationFrame === "undefined") return;
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.raf = requestAnimationFrame(this.loop);
  };

  private schedule(ms: number) {
    if (!Number.isFinite(ms) || !this.hosts.size) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.raf = requestAnimationFrame(this.loop);
    }, Math.max(0, ms - 8));
  }

  private loop = (t: number) => {
    this.raf = 0;
    if (document.hidden || !this.hosts.size) return;
    this.tickNo++;
    const scrolling = t < this.scrollUntil;
    const needs = [
      this.drawSurfaces(t, scrolling),
      this.layers ? this.drawFloat(t, this.layers.fx) : false,
      scrolling ? true : this.drawBackground(t, this.layers?.bg),
    ];
    const animating = needs.some(Boolean);
    this.sampleClocked(animating ? t : undefined);
    if (animating) this.schedule(TICK);
  };

  // ------------------------------------------------------------- CSS animations

  /**
   * Endless pulses (presence dot, alarm, FAB halo) of every card share one clock origin, so
   * cards rendered at different times pulse in phase. While the weather loop runs, the pulses
   * are stepped on its 30 Hz tick: a pulse running natively makes a frame on every display
   * refresh (60 or 120 Hz), and every frame blurs all glass cards again, although the weather
   * changes only 30 times a second. When the loop stops, the browser runs them natively.
   */
  private collectAnimations(host: Host) {
    const all = host.renderRoot.getAnimations?.() ?? [];
    const next = all.filter(
      (a) => a instanceof CSSAnimation && CLOCKED.has(a.animationName) && a.effect?.getComputedTiming().iterations === Infinity,
    );
    for (const a of next) {
      if (this.sampled) {
        if (a.playState !== "paused") a.pause();
        a.currentTime = performance.now() - this.clockStart;
      } else if (a.startTime !== this.clockStart && a.playState === "running") a.startTime = this.clockStart;
    }
    this.clocked.set(host, next);
  }

  /** `t`: step every pulse to this tick. `undefined`: hand them back to the browser. */
  private sampleClocked(t: number | undefined) {
    if (t === undefined) {
      if (!this.sampled) return;
      this.sampled = false;
      for (const list of this.clocked.values()) {
        for (const a of list) {
          a.play();
          a.startTime = this.clockStart;
        }
      }
      return;
    }
    this.sampled = true;
    const time = t - this.clockStart;
    for (const list of this.clocked.values()) {
      for (const a of list) {
        if (a.playState !== "paused") a.pause();
        a.currentTime = time;
      }
    }
  }

  // ------------------------------------------------------------- background

  private drawBackground(t: number, bg: HTMLCanvasElement | undefined): boolean {
    if (!bg) return false;
    const s = this.scene;
    if (!s.background || !this.bg.visible) return false;
    const cf = (WCFG as Record<string, Record<string, number>>)[s.cond] ?? {};
    const every = cf.rain || cf.snow || cf.hail || cf.flash ? 1 : 2;
    const sig = s.cond + s.phase + s.dark;
    const w = Math.max(1, Math.round(bg.clientWidth / 2));
    const h = Math.max(1, Math.round(bg.clientHeight / 2));
    const k = bg.clientWidth < MOBILE_PX ? 2 : 1;
    const resized = bg.width !== Math.round(w * k) || bg.height !== Math.round(h * k);
    if (resized) {
      bg.width = Math.round(w * k);
      bg.height = Math.round(h * k);
      this.bg.st = {};
    }
    const ctx = bg.getContext("2d")!;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (this.bg.sig !== sig) {
      this.bg.sig = sig;
      this.bg.st = {};
      this.bg.drawn = false;
    }
    if (!s.animate) {
      if (this.bg.drawn && !resized) return false;
      drawWeather(ctx, w, h, this.bg.st, t, s.cond, s.phase, s.dark, false);
      this.bg.drawn = true;
      return false;
    }
    if (this.bg.drawn && this.tickNo % every !== 0) return true;
    const dt = this.bg.last ? Math.min(12, (t - this.bg.last) / 40) : 1;
    this.bg.last = t;
    drawWeather(ctx, w, h, this.bg.st, t, s.cond, s.phase, s.dark, true, dt);
    this.bg.drawn = true;
    return true;
  }

  // ------------------------------------------------------------- card surfaces

  private setSurfacesHidden(hidden: boolean) {
    if (this.surf.hidden === hidden) return;
    this.surf.hidden = hidden;
    for (const h of this.hosts) h.toggleAttribute("data-wfx-off", hidden);
  }

  private drawSurfaces(t: number, scrolling: boolean): boolean {
    const s = this.scene;
    const fx = (SURF as Record<string, Record<string, number>>)[s.cond] ?? {};
    const glint = !!fx.glint && (s.phase !== "day" || !s.animate) ? false : !!fx.glint;
    const kinds = Object.keys(fx).filter((k) => k !== "glint" || glint);
    const drawsOnCards = s.background && s.surface && kinds.some((k) => k !== "mist" && k !== "wind");
    const sig = (drawsOnCards ? s.cond : "none") + s.dark + s.phase + s.animate;
    if (this.surf.sig !== sig) {
      this.surf.sig = sig;
      this.surf.st = new WeakMap();
      this.surf.dirty = true;
      for (const surface of this.surfaces.values()) surface.drawnSig = undefined;
    }
    if (!drawsOnCards) {
      if (this.surf.dirty) {
        for (const [canvas] of this.surfaces) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        this.surf.dirty = false;
      }
      this.setSurfacesHidden(true);
      return false;
    }
    this.setSurfacesHidden(false);
    const every = Math.max(0, ...kinds.map((k) => SURF_TICKS[k] ?? 1));
    const animated = s.animate && every > 0;
    if (!animated && !this.surf.dirty) return false;
    if (animated && !this.surf.dirty && this.tickNo % (every * (scrolling ? 2 : 1)) !== 0) return true;
    const dt = this.surf.last ? Math.min(3, (t - this.surf.last) / 40) : 1;
    this.surf.last = t;
    this.surf.dirty = false;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const onlyGlint = kinds.length === 1 && glint;
    const onlyRain = kinds.length === 1 && kinds[0] === "rain";
    for (const [canvas, surface] of this.surfaces) {
      if (!surface.visible) continue;
      const card = surface.card;
      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      surface.w = cw;
      surface.h = ch;
      const drawnSig = `${cw}x${ch}|${sig}|${s.level.toFixed(2)}`;
      if (!animated && surface.drawnSig === drawnSig) continue;
      if (onlyGlint && animated) {
        const x = canvas.getBoundingClientRect();
        const ph = ((t + (x.left + BLEED.x) * 5 + (x.top + BLEED.top) * 3) % GLINT_PERIOD) / GLINT_PERIOD;
        if (ph >= GLINT_ACTIVE) {
          if (surface.lit) {
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            surface.lit = false;
          }
          continue;
        }
        surface.lit = true;
      }
      surface.drawnSig = drawnSig;
      const w = cw + 2 * BLEED.x;
      const h = ch + BLEED.top + BLEED.bottom;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (surface.radius === undefined) {
        const cs = getComputedStyle(card);
        surface.radius = parseFloat(cs.borderTopLeftRadius) || 0;
        surface.edge = isSolidCard(cs as unknown as Parameters<typeof isSolidCard>[0]);
      }
      const r = Math.min(surface.radius, ch / 2, cw / 2);
      const area = { el: card, x: BLEED.x, y: BLEED.top, w: cw, h: ch, r, edge: surface.edge };
      if (onlyRain) {
        // A resized canvas comes back cleared, a new scene has new drops: both need a full repaint.
        const fullSig = `${canvas.width}x${canvas.height}|${sig}`;
        drawRainSurf(ctx, w, h, area, this.surf.st, s.cond, s.dark, animated ? dt : 0, s.level, dpr, surface.fullSig !== fullSig);
        surface.fullSig = fullSig;
      } else {
        surface.fullSig = undefined;
        drawSurf(ctx, w, h, [area], this.surf.st, t, s.cond, s.phase, s.dark, animated ? dt : 0, s.level);
      }
    }
    return animated;
  }

  // ------------------------------------------------------------- float layer (fixed, viewport coordinates)

  private unsway(e: HTMLElement) {
    e.style.scale = "";
    e.style.rotate = "";
    e.style.translate = "";
    e.style.transformOrigin = "";
    this.float.sway.delete(e);
  }

  private resetSway() {
    [...this.float.sway].forEach((e) => this.unsway(e));
  }

  private cardRects(t: number) {
    const o = this.float;
    if (!o.rectsDirty && t - o.rectsAt < 1000) return o.rects;
    o.rectsDirty = false;
    o.rectsAt = t;
    const next = new Map<HTMLElement, { x: number; y: number; w: number; h: number; r: number }>();
    for (const list of this.swayEls.values()) {
      for (const e of list) {
        const w = e.offsetWidth;
        const h = e.offsetHeight;
        if (w <= 60 || h <= 30 || !e.isConnected) continue;
        const b = e.getBoundingClientRect();
        const tx = parseFloat(e.style.translate) || 0;
        const prev = o.rects.get(e);
        next.set(e, { x: b.left - tx, y: b.top, w, h, r: prev?.r ?? (parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0) });
      }
    }
    o.rects = next;
    return next;
  }

  private drawFloat(t: number, el: HTMLCanvasElement): boolean {
    const s = this.scene;
    const o = this.float;
    const surf = (SURF as Record<string, Record<string, number>>)[s.cond] ?? {};
    const on = s.background && s.surface && s.animate && !!(surf.mist || surf.wind);
    const w = el.clientWidth;
    const h = el.clientHeight;
    const dpr = surf.wind ? 1 : 0.5;
    const sig = (on ? s.cond : "none") + s.dark + s.phase;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr) || o.sig !== sig) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      o.sig = sig;
      o.mist = null;
      o.wind = null;
      o.drawn = 0;
      o.empty = false;
    }
    if (!on) {
      if (o.sway.size) this.resetSway();
      if (!o.drawn) {
        el.getContext("2d")!.clearRect(0, 0, el.width, el.height);
        o.drawn = t || 1;
      }
      return false;
    }
    const dt = o.last ? Math.min(12, (t - o.last) / 40) : 1;
    if (o.last && t - o.last < TICK - 4) return true;
    o.last = t;
    const ctx = el.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (surf.mist) {
      o.mist = o.mist || { puffs: [] };
      if (o.mist.puffs.length || !o.empty) ctx.clearRect(0, 0, w, h);
      drawMist(ctx, w, h, o.mist, t, dt, s.dark, surf.mist);
      o.empty = o.mist.puffs.length === 0;
    } else ctx.clearRect(0, 0, w, h);
    if (surf.wind) {
      const cards = [...this.cardRects(t)]
        .map(([e, r]) => ({ el: e, ...r, r: Math.min(r.r, r.h / 2, r.w / 2) }))
        .filter((c) => c.y < h && c.y + c.h > 0);
      o.wind = o.wind || { gusts: [], leaves: [], streaks: [], cs: new WeakMap(), sw: o.sway };
      drawWind(ctx, w, h, o.wind, cards, t, dt, s.dark);
    } else if (o.sway.size) this.resetSway();
    o.drawn = t;
    return true;
  }
}

/** One engine per page, shared by every copy of the bundle (HACS + a dev build). */
export const weather: WeatherEngine = ((globalThis as Record<string, unknown>).__lumenCardsWeather ??= new WeatherEngine()) as WeatherEngine;
