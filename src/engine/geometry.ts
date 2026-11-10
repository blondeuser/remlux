// Room polygon geometry, in plan metres.
import type { Poly, Pt } from './types';

export const rectPoly = (L: number, W: number): Poly => [[0, 0], [L, 0], [L, W], [0, W]];

/** Even-odd point-in-polygon test. */
export function inPoly(x: number, y: number, P: Poly): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Signed area (shoelace); take Math.abs for the floor area. */
export function polyArea(P: Poly): number {
  let a = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]);
  return a / 2;
}

/** Total wall length. */
export const polyPerim = (P: Poly): number =>
  P.reduce((s, a, i) => { const b = P[(i + 1) % P.length]; return s + Math.hypot(b[0] - a[0], b[1] - a[1]); }, 0);

export function isConvex(P: Poly): boolean {
  let sg = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-9) continue;
    if (sg && Math.sign(cr) !== sg) return false;
    sg = Math.sign(cr);
  }
  return true;
}

/** Distance from (x, y) to the segment a→b. */
export function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Distance from (x, y) to the nearest wall. */
export function edgeDist(x: number, y: number, P: Poly): number {
  let m = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], d = segDist(x, y, a[0], a[1], b[0], b[1]);
    if (d < m) m = d;
  }
  return m;
}

/** Does the segment a→b pass through a wall? Touching at an end does not count. */
export function crosses(ax: number, ay: number, bx: number, by: number, P: Poly): boolean {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const c = P[i], d = P[(i + 1) % n];
    const o1 = (bx - ax) * (c[1] - ay) - (by - ay) * (c[0] - ax), o2 = (bx - ax) * (d[1] - ay) - (by - ay) * (d[0] - ax);
    if (o1 * o2 >= -1e-12) continue;
    const o3 = (d[0] - c[0]) * (ay - c[1]) - (d[1] - c[1]) * (ax - c[0]), o4 = (d[0] - c[0]) * (by - c[1]) - (d[1] - c[1]) * (bx - c[0]);
    if (o3 * o4 < -1e-12) return true;
  }
  return false;
}

/** Unit normal of wall i (P[i]→P[i+1]) pointing into the room. */
export function inwardN(P: Poly, i: number): Pt {
  const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l, ny = dx / l;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, e = Math.min(1e-3, l / 10);
  if (!inPoly(mx + nx * e, my + ny * e, P)) { nx = -nx; ny = -ny; }
  return [nx, ny];
}

/** The outline moved inward by d metres (each wall offset, corners re-intersected). */
export function insetPoly(P: Poly, d: number): Poly {
  const n = P.length;
  const Ls = P.map((a, i) => {
    const b = P[(i + 1) % n], [nx, ny] = inwardN(P, i);
    return [a[0] + nx * d, a[1] + ny * d, b[0] - a[0], b[1] - a[1]];
  });
  return Ls.map((l1, i): Pt => {
    const l0 = Ls[(i - 1 + n) % n], den = l0[2] * l1[3] - l0[3] * l1[2];
    if (Math.abs(den) < 1e-12) return [l1[0], l1[1]];
    const t = ((l1[0] - l0[0]) * l1[3] - (l1[1] - l0[1]) * l1[2]) / den;
    return [l0[0] + l0[2] * t, l0[1] + l0[3] * t];
  });
}

/** True when no two walls cross each other. */
export function isSimple(P: Poly): boolean {
  const n = P.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    const a = P[i], b = P[(i + 1) % n];
    if (crosses(a[0], a[1], b[0], b[1], [P[j], P[(j + 1) % n]])) return false;
  }
  return true;
}

export type ShapeKey = 'L' | 'T' | 'U';

/** Preset room outlines scaled to an L × W box, corners rounded to the centimetre. */
export function shapePreset(k: string, L: number, W: number): Poly | null {
  const r = (v: number) => Math.round(v * 100) / 100;
  const S: Record<ShapeKey, Poly> = {
    L: [[0, 0], [L, 0], [L, W * .5], [L * .5, W * .5], [L * .5, W], [0, W]],
    T: [[0, 0], [L, 0], [L, W * .45], [L * .67, W * .45], [L * .67, W], [L * .33, W], [L * .33, W * .45], [0, W * .45]],
    U: [[0, 0], [L * .35, 0], [L * .35, W * .6], [L * .65, W * .6], [L * .65, 0], [L, 0], [L, W], [0, W]],
  };
  const s = S[k as ShapeKey];
  return s ? s.map(([x, y]): Pt => [r(x), r(y)]) : null;
}

/**
 * Shift an outline so its bounding box starts at 0,0 (corners rounded to the millimetre).
 * Returns the shift applied and the new overall length and width.
 */
export function normalizePoly(P: Poly): { P: Poly; x0: number; y0: number; L: number; W: number } {
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  return {
    P: P.map(([x, y]): Pt => [Math.round((x - x0) * 1000) / 1000, Math.round((y - y0) * 1000) / 1000]),
    x0, y0, L: x1 - x0, W: y1 - y0,
  };
}
