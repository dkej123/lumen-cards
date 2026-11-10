import { afterEach, describe, expect, it } from "vitest";
import { drawRainSurf, drawSurf } from "../src/weather/fx";

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

type Drop = { x: number; y: number; r: number; vy: number; age: number; life: number };
const drops = (st: WeakMap<object, { drops: Drop[] }>, el: object) =>
  st.get(el)!.drops.map(({ x, y, r, vy, age, life }) => ({ x, y, r, vy, age, life }));

describe("drawRainSurf", () => {
  for (const cond of ["rainy", "pouring", "lightning-rainy"]) {
    it(`${cond}: same drops as drawSurf, tick after tick, with fewer drawing calls`, () => {
      const card = { x: 4, y: 16, w: 300, h: 150, r: 22 };
      const a = fakeCtx();
      const b = fakeCtx();
      const elA = {};
      const elB = {};
      const stA = new WeakMap();
      const stB = new WeakMap();
      const ra = seeded(11);
      const rb = seeded(11);
      for (let k = 0; k < 400; k++) {
        Math.random = ra;
        drawSurf(a, 308, 170, [{ el: elA, ...card }], stA, k * 33, cond, "day", false, 1, 1);
        Math.random = rb;
        drawRainSurf(b, 308, 170, { el: elB, ...card }, stB, cond, false, 1, 1, 2, k === 0);
        expect(drops(stB, elB)).toEqual(drops(stA, elA));
      }
      expect(b.calls.draw).toBeLessThan(a.calls.draw / 2);
    });
  }

  it("leaves the canvas alone when nothing moves", () => {
    const ctx = fakeCtx();
    const el = {};
    const st = new WeakMap();
    const card = { el, x: 4, y: 16, w: 200, h: 100, r: 16 };
    expect(drawRainSurf(ctx, 208, 120, card, st, "rainy", true, 0, 1, 2, true)).toBe(true);
    const after = { ...ctx.calls };
    expect(drawRainSurf(ctx, 208, 120, card, st, "rainy", true, 0, 1, 2, false)).toBe(false);
    expect(ctx.calls).toEqual(after);
  });
});
