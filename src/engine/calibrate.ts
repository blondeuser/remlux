import type { Pt } from './types';

/**
 * Scale calibration for a floor plan image.
 * The user clicks two points on the image (pixels) and types the real distance between them (metres).
 * Everything here is pure maths: no DOM, no image decoding.
 */

/** Distance in pixels between two image points. */
export function pxDist(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Metres per pixel from two picked points and the real distance between them.
 * Returns null when the points coincide or the length is not a positive number.
 */
export function scaleFromPoints(a: Pt, b: Pt, realMetres: number): number | null {
  const d = pxDist(a, b);
  if (!(d > 0) || !Number.isFinite(realMetres) || !(realMetres > 0)) return null;
  return realMetres / d;
}

/**
 * Wall-thickness correction. CAD plans print dimensions to the inside face, the wall centre line or
 * the outside face. The room polygon is always the inside (lit) space, so a measured length is
 * corrected by the wall thickness t (m): inside 0, centre -t, outside -2t.
 */
export type DimBasis = 'inside' | 'centre' | 'outside';
export function insideLength(printed: number, basis: DimBasis, wallThickness: number): number {
  const t = Math.max(0, wallThickness || 0);
  return basis === 'inside' ? printed : basis === 'centre' ? printed - t : printed - 2 * t;
}

/** Image pixel -> plan metres. `off` is where the image's top-left pixel sits in the plan (m). */
export function pxToPlan(p: Pt, mpp: number, off: Pt): Pt {
  return [off[0] + p[0] * mpp, off[1] + p[1] * mpp];
}

/** Plan metres -> image pixel. */
export function planToPx(p: Pt, mpp: number, off: Pt): Pt {
  return [(p[0] - off[0]) / mpp, (p[1] - off[1]) / mpp];
}

/**
 * Check a second printed dimension against the calibrated scale: the relative error (signed, 0.02 = the
 * image measures 2 % longer than the label says). Null when the inputs are unusable.
 */
export function scaleError(a: Pt, b: Pt, mpp: number, realMetres: number): number | null {
  if (!(mpp > 0) || !(realMetres > 0)) return null;
  const d = pxDist(a, b) * mpp;
  return d / realMetres - 1;
}

/** Image size (m) at a scale: the box the image covers in plan coordinates. */
export function imageExtent(wPx: number, hPx: number, mpp: number): { w: number; h: number } {
  return { w: wPx * mpp, h: hPx * mpp };
}

/**
 * Tracing helper: snap a new corner to the previous one when the segment is nearly horizontal or vertical
 * (CAD plans are axis-aligned). `tol` is the allowed sideways drift as a fraction of the segment length.
 */
export function snapOrtho(prev: Pt, p: Pt, tol = 0.06): Pt {
  const dx = Math.abs(p[0] - prev[0]), dy = Math.abs(p[1] - prev[1]);
  if (dx <= dy * tol) return [prev[0], p[1]];
  if (dy <= dx * tol) return [p[0], prev[1]];
  return p;
}

/** Traced image pixels -> room polygon in metres (origin at the image corner, 1 mm resolution). */
export function tracedPoly(px: Pt[], mpp: number): Pt[] {
  const r = (v: number) => Math.round(v * mpp * 1000) / 1000;
  return px.map(([x, y]) => [r(x), r(y)] as Pt);
}
