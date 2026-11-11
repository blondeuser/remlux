// Fixture photometry: IES LM-63 parsing and the intensity model used by every calculation.
import type { IntensityFn } from './types';

export const rad = (d: number) => d * Math.PI / 180;
export const deg = (r: number) => r * 180 / Math.PI;

/** A parsed IES file, reduced to one rotationally symmetric intensity curve. */
export interface IesPhotometry {
  /** Luminaire name from [LUMINAIRE] / [LUMCAT] (IES) or the luminaire line (LDT), or the file name. */
  name: string;
  /** Manufacturer from [MANUFAC] (IES) or the first line (LDT); '' when the file does not say. */
  brand: string;
  file: string;
  /** Vertical angles γ in degrees (0 = straight down). */
  v: number[];
  /** Intensity in cd at each angle in v, averaged over the C-planes. */
  c: number[];
  /** Input watts from the file, 0 if not given. */
  watts: number;
  /** Total luminous flux (lm) integrated from the curve. */
  flux: number;
  /** Fraction of the flux going upward (γ > 90°). */
  up: number;
}

/** Intensity (cd) at vertical angle gammaDeg, linearly interpolated; 0 outside the measured range. */
export function iesIntensity(P: Pick<IesPhotometry, 'v' | 'c'>, gammaDeg: number): number {
  const v = P.v, c = P.c, n = v.length;
  if (n === 1) return gammaDeg === v[0] ? c[0] : 0;
  if (gammaDeg < v[0] || gammaDeg > v[n - 1]) return 0;
  let i = 1;
  while (i < n - 1 && v[i] < gammaDeg) i++;
  const a = v[i - 1], b = v[i], t = b > a ? (gammaDeg - a) / (b - a) : 0;
  return c[i - 1] + (c[i] - c[i - 1]) * t;
}

/**
 * Average C-planes into one rotationally symmetric curve (trapezoid weights over the plane angles)
 * and integrate its flux. `data` holds one row of `v.length` values per plane, already in cd.
 * Shared by the IES and LDT parsers. Throws when there is no downward light.
 */
export function reducePlanes(v: number[], hz: number[], data: number[], k: number): { c: number[]; flux: number; up: number } {
  const nv = v.length, nh = hz.length, c: number[] = new Array(nv).fill(0);
  const wt = hz.map((h, j) => nh === 1 ? 1 : ((j < nh - 1 ? hz[j + 1] - h : 0) + (j > 0 ? h - hz[j - 1] : 0)) / 2);
  const ws = wt.reduce((s, x) => s + x, 0) || 1;
  for (let j = 0; j < nh; j++) for (let q = 0; q < nv; q++) c[q] += data[j * nv + q] * k * wt[j] / ws;
  const curve = { v, c };
  let Fd = 0, Fu = 0;
  for (let s = 0; s < 1800; s++) {
    const g = (s + .5) * .1, dF = 2 * Math.PI * iesIntensity(curve, g) * Math.sin(rad(g)) * rad(.1);
    if (g < 90) Fd += dF; else Fu += dF;
  }
  if (Fd <= 0) throw Error('This file has no downward light.');
  return { c, flux: Fd + Fu, up: Fu / (Fd + Fu) };
}

/**
 * Parse an IES LM-63 file (Type C photometry only).
 * C-planes are averaged with trapezoid weights into one rotationally symmetric curve.
 * Throws an Error with a user-facing message when the file can't be used.
 */
export function parseIES(txt: string, file: string): IesPhotometry {
  const lines = txt.split(/\r?\n/);
  let i = 0, name = '', brand = '';
  for (; i < lines.length; i++) {
    const l = lines[i].trim(), m = l.match(/^\[(LUMINAIRE|LUMCAT)\]\s*(.*)/i);
    if (m && !name && m[2]) name = m[2].trim();
    const mb = l.match(/^\[MANUFAC\]\s*(.*)/i);
    if (mb && !brand) brand = mb[1].trim();
    if (/^TILT\s*=/i.test(l)) break;
  }
  if (i >= lines.length) throw Error('No TILT= line found, so this does not look like an IES file.');
  const tilt = lines[i].split('=')[1].trim().toUpperCase();
  const N = lines.slice(i + 1).join(' ').split(/[\s,]+/).filter(Boolean).map(Number);
  let p = 0;
  if (tilt === 'INCLUDE') p = 2 + 2 * N[1];
  const need = (k: number) => {
    if (N.length < p + k || N.slice(p, p + k).some(isNaN)) throw Error('The IES file looks incomplete or damaged.');
  };
  need(13);
  const [, , mult, nv, nh, ptype, , , , , bf, , watts] = N.slice(p, p + 13);
  p += 13;
  if (ptype !== 1) throw Error('Only Type C photometry is supported (normal for downlights). This file is Type ' + (ptype === 2 ? 'B' : 'A') + '.');
  need(nv + nh + nv * nh);
  const v = N.slice(p, p + nv); p += nv;
  const hz = N.slice(p, p + nh); p += nh;
  const k = mult * (bf > 0 ? bf : 1);
  const { c, flux, up } = reducePlanes(v, hz, N.slice(p, p + nh * nv), k);
  return { name: name || file.replace(/\.ies$/i, ''), brand, file, v, c, watts: watts > 0 ? watts : 0, flux, up };
}

export interface FixtureInput {
  /** 'ies' uses the loaded file; anything else uses the generic cosⁿ beam. */
  phot: string;
  ies: IesPhotometry | null;
  /** Beam angle in degrees (generic beam only, 5–120). */
  angle: number;
  /** Lumens per fixture (generic beam only; IES uses the file's flux). */
  lumens: number;
}

export interface FixtureModel {
  /** Intensity (cd) vs cos γ, from a fast lookup table. */
  Iof: IntensityFn;
  /** Beam half-angle (50% of peak), radians. */
  th: number;
  /** Field half-angle (10% of peak), radians. */
  gF: number;
  /** Flux per fixture after light loss factor, lm. */
  F1: number;
  /** Upward flux fraction. */
  up: number;
  /** Full beam angle, degrees. */
  ang: number;
  /** Light loss factor (currently always 1). */
  llf: number;
  /** Lumens per fixture. */
  lm: number;
}

/**
 * Build the intensity model for one fixture: an IES curve scaled to its flux, or a cosⁿ
 * distribution fitted so intensity falls to 50% at half the beam angle.
 * Returns null for invalid input (no lumens, or a generic beam outside 5–120°).
 */
export function buildModel(q: FixtureInput): FixtureModel | null {
  const IE = q.phot === 'ies' ? q.ies : null;
  const lm = IE ? IE.flux : +q.lumens, llf = 1, a = +q.angle, F1 = lm * llf;
  if (!(lm > 0)) return null;
  let Ig: (g: number) => number, th: number, gF: number, up = 0;
  if (IE) {
    const k = F1 / IE.flux;
    Ig = g => k * iesIntensity(IE, deg(g));
    up = IE.up;
    let Im = 0, gm = 0;
    for (let d = 0; d <= 90; d += .05) { const x = Ig(rad(d)); if (x > Im) { Im = x; gm = d; } }
    const edge = (fr: number) => {
      for (let d = gm; d <= 90; d += .05) if (Ig(rad(d)) < fr * Im) return rad(Math.max(.05, d));
      return rad(89.9);
    };
    th = edge(.5); gF = edge(.1);
  } else {
    if (!(a >= 5 && a <= 120)) return null;
    th = rad(a / 2);
    const n = Math.log(.5) / Math.log(Math.cos(th)), I0 = F1 * (n + 1) / (2 * Math.PI);
    Ig = g => g >= Math.PI / 2 ? 0 : I0 * Math.pow(Math.cos(g), n);
    gF = Math.acos(Math.pow(.1, 1 / n));
  }
  // table indexed by t = sqrt(1 - cos γ): dense near the axis, so narrow beams stay accurate
  const M = 2048, T = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) { const t = i / M; T[i] = Ig(Math.acos(1 - t * t)); }
  const Iof: IntensityFn = c => {
    const t = Math.sqrt(Math.max(0, 1 - c)) * M, i = t | 0;
    return i >= M ? T[M] : T[i] + (T[i + 1] - T[i]) * (t - i);
  };
  return { Iof, th, gF, F1, up, ang: 2 * deg(th), llf, lm };
}
