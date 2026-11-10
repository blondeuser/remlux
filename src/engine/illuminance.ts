// Direct illuminance: point-by-point lux from every fixture, on the work plane and on a wall.
import { crosses, edgeDist, inPoly, isConvex } from './geometry';
import type { IntensityFn, Poly } from './types';

/** A light in plan: [x, y, intensity function, ...anything else the caller keeps with it]. */
export type LightSource = readonly [number, number, IntensityFn, ...unknown[]];

/**
 * Horizontal illuminance (lx) on a plane h metres below one fixture, at horizontal distance r:
 * E = I(γ) · cos³γ / h²  (inverse square law with the cosine of incidence).
 */
export function illuminanceAt(Iof: IntensityFn, h: number, r: number): number {
  const c = h / Math.sqrt(h * h + r * r);
  return Iof(c) * c * c * c / (h * h);
}

/**
 * Direct illuminance (lx) at any point of the work plane from all lights, h metres above it.
 * In a non-convex room (L, T, U…) walls are full height, so a wall between a light and a point
 * blocks it. shape = null means a plain rectangle.
 */
export function directIlluminance(lights: readonly LightSource[], h: number, shape: Poly | null): (x: number, y: number) => number {
  const h2 = h * h, P = shape, NC = !!P && !isConvex(P);
  return (x, y) => {
    let s = 0;
    for (const [px, py, Io] of lights) {
      if (NC && crosses(px, py, x, y, P!)) continue;
      const d2 = h2 + (x - px) ** 2 + (y - py) ** 2, c = h / Math.sqrt(d2);
      s += Io(c) * c * c * c / h2;
    }
    return s;
  };
}

/** Wall zone actually used: the requested strip, never more than a quarter of the room. */
export const wallZoneWidth = (wz: number, L: number, W: number): number =>
  Math.max(0, Math.min(wz || 0, L / 4, W / 4));

export interface PlaneSample {
  /** Grid size in cells along x (length) and y (width). */
  cw: number;
  ch: number;
  /** Lux at each cell centre, row by row (index y * cw + x). */
  vals: Float32Array;
  /** Per cell: 0 outside the room, 1 inside, 2 inside and clear of the wall zone. */
  INS: Uint8Array;
  /** Statistics over the cells clear of the wall zone (EN 12464-1 task area). */
  min: number;
  max: number;
  avg: number;
  /** U₀ = Emin / Ē. */
  uniformity: number;
  /** Number of cells in the statistics (at least 1). */
  cnt: number;
  /** Highest lux anywhere inside the room, wall zone included. */
  peak: number;
}

/**
 * Sample lux over the work plane on a grid of up to 160 cells along the longer side,
 * and compute Ē, Emin, Emax and U₀ leaving out the wall zone.
 */
export function sampleWorkPlane(L: number, W: number, shape: Poly | null, wallZone: number, E: (x: number, y: number) => number): PlaneSample {
  const cw = Math.min(160, Math.max(40, Math.round(160 * Math.min(1, L / W)))), ch = Math.max(20, Math.round(cw * W / L));
  const vals = new Float32Array(cw * ch), INS = new Uint8Array(cw * ch), WZ = wallZone;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x, px = (x + .5) / cw * L, py = (y + .5) / ch * W;
    if (shape && !inPoly(px, py, shape)) continue;
    INS[i] = (shape ? edgeDist(px, py, shape) >= WZ : (px >= WZ && px <= L - WZ && py >= WZ && py <= W - WZ)) ? 2 : 1;
    vals[i] = E(px, py);
  }
  let mn = 1e9, mx = 0, mxi = 0, sum = 0, cnt = 0;
  for (let i = 0; i < vals.length; i++) {
    if (!INS[i]) continue;
    const v = vals[i];
    if (v > mx) mx = v;
    if (INS[i] === 2) { if (v < mn) mn = v; if (v > mxi) mxi = v; sum += v; cnt++; }
  }
  if (!cnt) { mn = 0; cnt = 1; }
  const avg = sum / cnt;
  return { cw, ch, vals, INS, min: mn, max: mxi, avg, uniformity: avg ? mn / avg : 0, cnt, peak: mx };
}

export interface WallScallopInput {
  /** Distance from the lights to the wall, m. */
  distance: number;
  /** Spacing between lights along the wall, m. */
  spacing: number;
  /** Number of lights (1–10). */
  count: number;
  /** Ceiling height, m (the wall elevation shown). */
  H: number;
  Iof: IntensityFn;
}

export interface WallScallops {
  /** Width of the wall shown, m. */
  Wd: number;
  /** Light positions along the wall, m. */
  ys: number[];
  cw: number;
  ch: number;
  /** Lux on the wall, row by row from the ceiling down (index row * cw + col). */
  vals: Float32Array;
  /** Highest lux on the wall. */
  peak: number;
}

/** Vertical illuminance on a wall from a row of downlights parallel to it, ceiling at the top. */
export function wallScallops({ distance: d, spacing: sp, count: nn, H, Iof }: WallScallopInput): WallScallops {
  const pad = Math.max(.6, sp * .75), Wd = (nn - 1) * sp + 2 * pad, ys: number[] = [];
  for (let i = 0; i < nn; i++) ys.push(pad + i * sp);
  const cw = 160, ch = Math.min(320, Math.max(40, Math.round(cw * H / Wd))), vals = new Float32Array(cw * ch);
  let mx = 0;
  for (let j = 0; j < ch; j++) {
    const z = (j + .5) / ch * H;
    for (let i = 0; i < cw; i++) {
      const y = (i + .5) / cw * Wd;
      let e = 0;
      for (const yi of ys) { const dy = y - yi, r2 = d * d + dy * dy + z * z, r = Math.sqrt(r2); e += Iof(z / r) * d / (r * r2); }
      vals[j * cw + i] = e;
      if (e > mx) mx = e;
    }
  }
  return { Wd, ys, cw, ch, vals, peak: mx };
}
