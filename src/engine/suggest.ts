// "Suggest a grid for a target": the fewest fixtures that reach a target average with U₀ ≥ 0.5.
import { crosses, edgeDist, inPoly, isConvex, rectPoly } from './geometry';
import { placeLights } from './layout';
import type { Formation, IntensityFn, Poly } from './types';

export interface SuggestInput {
  L: number;
  W: number;
  /** Fixture height above the work plane, m. */
  h: number;
  /** Target average lux. */
  target: number;
  form: Formation;
  Iof: IntensityFn;
  /** Room outline, or null for a plain L × W rectangle. */
  shape: Poly | null;
  /** Wall zone left out of min and average, m. */
  wallZone: number;
}

export interface Suggestion {
  /** Number of fixtures. */
  N: number;
  /** Columns and rows of the formation. */
  x: number;
  y: number;
  avg: number;
  uni: number;
  sx: number;
  sy: number;
}

/** Minimum U₀ a suggestion must reach. */
export const SUGGEST_MIN_UNIFORMITY = 0.5;

/**
 * Try every formation up to 12 × 12 whose cells are roughly square (aspect 0.6–1.67),
 * fewest fixtures first, on a coarse 24 × 24 sample. Returns the first that reaches the
 * target with enough uniformity, or null.
 */
export function suggestGrid({ L, W, h, target: T, form: fm, Iof, shape, wallZone: WZ }: SuggestInput): Suggestion | null {
  const h2 = h * h, G = 24, P = shape ?? rectPoly(L, W), NC = !isConvex(P);
  // sample points inside the room: [x, y, clear of the wall zone?]
  const S: [number, number, boolean][] = [];
  for (let u = 0; u < G; u++) for (let v = 0; v < G; v++) {
    const px = (u + .5) / G * L, py = (v + .5) / G * W;
    if (shape && !inPoly(px, py, P)) continue;
    S.push([px, py, shape ? edgeDist(px, py, P) >= WZ : (px >= WZ && px <= L - WZ && py >= WZ && py <= W - WZ)]);
  }
  const c: [number, number, number, ReturnType<typeof placeLights>][] = [];
  for (let x = 1; x <= 12; x++) for (let y = 1; y <= 12; y++) {
    const r = (L / x) / (W / y);
    if (r < .6 || r > 1.67 || (fm === 'perim' && (x < 2 || y < 2))) continue;
    const ly = placeLights(fm, x, y, L, W, false, 0, 0, shape);
    if (ly.pts.length) c.push([ly.pts.length, x, y, ly]);
  }
  const sk = (q: (typeof c)[number]) => Math.abs(Math.log((L / q[1]) / (W / q[2])));
  c.sort((p, q) => p[0] - q[0] || sk(p) - sk(q));
  for (const [N, x, y, ly] of c) {
    const pts = ly.pts;
    let sum = 0, mn = 1e9, cn = 0;
    for (const [px, py, z] of S) {
      let e = 0;
      for (const [qx, qy] of pts) {
        if (NC && crosses(qx, qy, px, py, P)) continue;
        const cc = h / Math.sqrt(h2 + (px - qx) ** 2 + (py - qy) ** 2);
        e += Iof(cc) * cc * cc * cc / h2;
      }
      if (z) { sum += e; cn++; if (e < mn) mn = e; }
    }
    if (!cn) continue;
    const avg = sum / cn;
    if (avg >= T && mn / avg >= SUGGEST_MIN_UNIFORMITY) return { N, x, y, avg, uni: mn / avg, sx: ly.sx, sy: ly.sy };
  }
  return null;
}
