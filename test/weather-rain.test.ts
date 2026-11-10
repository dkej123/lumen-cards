import { afterEach, describe, expect, it } from "vitest";
import { drawSurf, drawSurfInc } from "../src/weather/fx";

/** Canvas 2D stand-in that counts drawing calls; geometry is not rasterized here (pixels are compared in a browser). */
function fakeCtx() {
  const calls = { draw: 0, clear: 0 };
  const noop = () => {};
  const ctx = new Proxy(
    { calls },
    {
      get(_target, key) {
        if (key === "calls") return calls;
        if (key === "fill" || key === "stroke") return () => calls.draw++;
        if (key === "clearRect") return () => calls.clear++;
        if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop: noop });
        return noop;
      },
      set: () => true,
    },
  );
  return ctx as unknown as CanvasRenderingContext2D & { calls: typeof calls };
}

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const random = Math.random;
afterEach(() => {
  Math.random = random;
});

type Shape = { x?: number; y?: number; u?: number; r: number; vy?: number; age?: number; life?: number; a?: number };
type State = { drops: Shape[]; flakes: Shape[]; pel: Shape[]; snowH: number };
const pick = ({ x, y, u, r, vy, age, life, a }: Shape) => ({ x, y, u, r, vy, age, life, a: u === undefined ? undefined : a });
/** Everything the drawing depends on: drops, flakes, hailstones and the snow depth. */
const drops = (st: WeakMap<object, State>, el: object) => {
  const s = st.get(el)!;
  return { drops: s.drops.map(pick), flakes: s.flakes.map(pick), pel: s.pel.map(pick), snowH: s.snowH };
};

describe("drawSurfInc", () => {
  for (const cond of ["rainy", "pouring", "lightning-rainy", "snowy", "snowy-rainy", "hail"]) {
    it(`${cond}: same shapes as drawSurf, tick after tick, with fewer drawing calls`, () => {
      const card = { x: 4, y: 16, w: 300, h: 150, r: 22 };
      const a = fakeCtx();
      const b = fakeCtx();
      const elA = {};
      const elB = {};
      const stA = new WeakMap<object, State>();
      const stB = new WeakMap<object, State>();
      const ra = seeded(11);
      const rb = seeded(11);
      for (let k = 0; k < 400; k++) {
        Math.random = ra;
        drawSurf(a, 308, 170, [{ el: elA, ...card }], stA, k * 33, cond, "day", false, 1, 1);
        Math.random = rb;
        drawSurfInc(b, 308, 170, { el: elB, ...card }, stB, cond, false, 1, 1, 2, k === 0);
        expect(drops(stB, elB)).toEqual(drops(stA, elA));
      }
      expect(b.calls.draw).toBeLessThan(a.calls.draw / 2);
    });
  }

  it.each(["rainy", "snowy", "hail"])("%s: leaves the canvas alone when nothing moves", (cond) => {
    const ctx = fakeCtx();
    const el = {};
    const st = new WeakMap();
    const card = { el, x: 4, y: 16, w: 200, h: 100, r: 16 };
    expect(drawSurfInc(ctx, 208, 120, card, st, cond, true, 0, 1, 2, true)).toBe(true);
    const after = { ...ctx.calls };
    expect(drawSurfInc(ctx, 208, 120, card, st, cond, true, 0, 1, 2, false)).toBe(false);
    expect(ctx.calls).toEqual(after);
  });
});
