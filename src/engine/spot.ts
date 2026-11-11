// Standalone spotlight on a wall: direct illuminance from one aimed fixture onto a vertical plane.
// Wall coordinates: x along the wall (from its left edge), z height above the floor. The spot sits
// y metres out from the wall (y > 0) and is aimed at a point on the wall.
import type { IntensityFn } from './types';

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Illuminance (lx) at point P on a plane with unit normal n (pointing toward the light side)
 * from a source at S whose beam axis is the unit vector axis:
 * E = I(γ) · cos(incidence) / d², γ measured from the beam axis.
 * Zero behind the source (γ ≥ 90°) and when the light reaches the plane from behind.
 */
export function pointIlluminance(Iof: IntensityFn, S: Vec3, axis: Vec3, P: Vec3, n: Vec3): number {
  const v = sub(P, S), d2 = dot(v, v);
  if (d2 <= 0) return 0;
  const d = Math.sqrt(d2), cg = dot(v, axis) / d, ci = -dot(v, n) / d;
  if (cg <= 0 || ci <= 0) return 0;
  return Iof(cg) * ci / d2;
}

export interface SpotInput {
  /** Wall width and height, m. */
  wallW: number;
  wallH: number;
  /** Spot position: x along the wall, y out from the wall (> 0), z above the floor, m. */
  pos: Vec3;
  /** Aim point on the wall: [x, z], m. */
  aim: [number, number];
  Iof: IntensityFn;
  /** Beam (50%) and field (10%) half-angles, radians (from buildModel). */
  th: number;
  gF: number;
}

export interface SpotResult {
  /** Grid size along the wall (cw) and up it (ch); vals row 0 is the top of the wall. */
  cw: number;
  ch: number;
  vals: Float32Array;
  /** Off-axis angle cos γ at each cell (same layout), for the beam / field outlines. */
  cosG: Float32Array;
  /** Peak lux on the wall and where it is ([x, z]). */
  max: number;
  maxAt: [number, number];
  /** Lux at the aim point. */
  atAim: number;
  /** Average lux inside the beam (50%) footprint, 0 when the beam misses the wall. */
  beamAvg: number;
  /** Beam (50%) and field (10%) footprint on the wall: width × height, m (0 when absent). */
  beam: { w: number; h: number };
  field: { w: number; h: number };
  /** Spot to aim point, m. */
  throw: number;
  /** Tilt of the beam axis from straight down, degrees (90 = horizontal). */
  tilt: number;
  /** Angle between the beam axis and the wall normal, degrees (0 = square on). */
  incidence: number;
  /** Average lux over the whole wall. */
  wallAvg: number;
}

/** Direct lux on the wall from one aimed spot, sampled on a grid of about `res` cells along the longer side. */
export function spotOnWall(q: SpotInput, res = 160): SpotResult | null {
  const { wallW: W, wallH: H, pos: S, Iof } = q;
  if (!(W > 0 && H > 0 && S[1] > 0)) return null;
  const n: Vec3 = [0, 1, 0], target: Vec3 = [q.aim[0], 0, q.aim[1]];
  const axis = unit(sub(target, S));
  const cw = Math.max(20, Math.round(res * Math.min(1, W / H))), ch = Math.max(20, Math.round(cw * H / W));
  const vals = new Float32Array(cw * ch), cosG = new Float32Array(cw * ch);
  const cB = Math.cos(q.th), cF = Math.cos(q.gF), dx = W / cw, dz = H / ch;
  let max = 0, mi = 0, sum = 0, bSum = 0, bCnt = 0;
  const box = () => ({ x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity });
  const bb = box(), fb = box();
  const grow = (b: ReturnType<typeof box>, x: number, z: number) => {
    b.x0 = Math.min(b.x0, x - dx / 2); b.x1 = Math.max(b.x1, x + dx / 2); b.z0 = Math.min(b.z0, z - dz / 2); b.z1 = Math.max(b.z1, z + dz / 2);
  };
  for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) {
    const i = r * cw + c, x = (c + .5) * dx, z = H - (r + .5) * dz, P: Vec3 = [x, 0, z];
    const e = pointIlluminance(Iof, S, axis, P, n);
    const v = sub(P, S), cg = dot(v, axis) / Math.hypot(v[0], v[1], v[2]);
    vals[i] = e; cosG[i] = cg; sum += e;
    if (e > max) { max = e; mi = i; }
    if (cg >= cB) { grow(bb, x, z); bSum += e; bCnt++; }
    if (cg >= cF) grow(fb, x, z);
  }
  const size = (b: ReturnType<typeof box>) => b.x1 > b.x0 ? { w: b.x1 - b.x0, h: b.z1 - b.z0 } : { w: 0, h: 0 };
  const tv = sub(target, S), thr = Math.hypot(tv[0], tv[1], tv[2]);
  return {
    cw, ch, vals, cosG, max,
    maxAt: [((mi % cw) + .5) * dx, H - (Math.floor(mi / cw) + .5) * dz],
    atAim: pointIlluminance(Iof, S, axis, target, n),
    beamAvg: bCnt ? bSum / bCnt : 0,
    beam: size(bb), field: size(fb),
    throw: thr,
    tilt: Math.acos(Math.max(-1, Math.min(1, -axis[2]))) * 180 / Math.PI,
    incidence: Math.acos(Math.max(-1, Math.min(1, -axis[1]))) * 180 / Math.PI,
    wallAvg: sum / (cw * ch),
  };
}

/** Lux at one wall point [x, z] (for the cursor readout). */
export function spotLuxAt(q: Pick<SpotInput, 'pos' | 'aim' | 'Iof'>, x: number, z: number): number {
  const axis = unit(sub([q.aim[0], 0, q.aim[1]], q.pos));
  return pointIlluminance(q.Iof, q.pos, axis, [x, 0, z], [0, 1, 0]);
}
