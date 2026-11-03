// Sparklines on a time axis (temperatures 5 h, air quality 24 h).

export interface Point {
  t: number;
  v: number;
}

/** y of `value` on a fixed `range` in a box `h` high, the axis of `sparkPath` with that range. */
export const sparkY = (value: number, range: [number, number], h: number): number => {
  const span = range[1] - range[0] || 1;
  return h / 2 - ((value - (range[0] + range[1]) / 2) / span) * (h - 6);
};

/**
 * Line and area paths for `points` between `from` and `to` (ms) in a w × h box.
 * x is time (now at the right edge); the value before `from` is held from the left edge.
 * The curve is monotone cubic (Fritsch–Carlson): smooth between sparse readings, never overshooting them.
 * `minSpan` keeps small wobbles from filling the whole height. `range` fixes the value axis, so
 * lines drawn with `sparkY` match the curve.
 */
export function sparkPath(points: Point[], from: number, to: number, w: number, h: number, minSpan = 0, range?: [number, number]) {
  const before = points.filter((p) => p.t <= from).at(-1);
  const inside = points.filter((p) => p.t > from && p.t <= to);
  const pts = [...(before ? [{ t: from, v: before.v }] : []), ...inside];
  const last = pts.at(-1);
  if (last && last.t < to) pts.push({ t: to, v: last.v });
  if (pts.length < 2) return { line: "", area: "" };
  const vs = pts.map((p) => p.v);
  const lo = range ? range[0] : Math.min(...vs);
  const hi = range ? range[1] : Math.max(...vs);
  const span = Math.max(hi - lo, minSpan) || 1;
  const mid = (lo + hi) / 2;
  const xy = pts.map((p) => [((p.t - from) / (to - from)) * w, h / 2 - ((p.v - mid) / span) * (h - 6)] as const);
  const n = xy.length;
  // Fritsch–Carlson tangents.
  const d = xy.slice(1).map((p, i) => (p[1] - xy[i][1]) / (p[0] - xy[i][0] || 1e-9));
  const m = xy.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  const f = (v: number) => +v.toFixed(1);
  let line = `M${f(xy[0][0])} ${f(xy[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (xy[i + 1][0] - xy[i][0]) / 3;
    line += ` C${f(xy[i][0] + dx)} ${f(xy[i][1] + m[i] * dx)} ${f(xy[i + 1][0] - dx)} ${f(xy[i + 1][1] - m[i + 1] * dx)} ${f(xy[i + 1][0])} ${f(xy[i + 1][1])}`;
  }
  return { line, area: `${line} L${w} ${h} L${f(xy[0][0])} ${h} Z` };
}
