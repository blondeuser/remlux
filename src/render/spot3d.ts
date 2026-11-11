// 3D view of the Spot on wall page: the lit wall (lux map or rendered look), a floor strip in front
// of it, the spot body, its beam cone and the 50% / 10% outlines on the wall. Free orthographic
// camera with the same IsoView / controls as the room's 3D view.
// World axes: x along the wall, y out from the wall (wall at y = 0), z up.
import type { Pt } from '../engine/types';
import { sizeCanvas, type IsoProj, type IsoView } from './iso';

export type V3 = [number, number, number];

export interface Spot3DOptions {
  /** wall width and height, metres */
  W: number;
  H: number;
  /** spot position and aim point on the wall [x, z] */
  S: V3;
  aim: [number, number];
  /** beam / field half-angles, radians */
  th: number;
  gF: number;
  /** spot body diameter, metres */
  size: number;
  /** wall image: one pixel per sample cell, row 0 at the top of the wall */
  tex: HTMLCanvasElement;
  /** peak position on the wall [x, z] */
  peak: [number, number];
  view: IsoView;
  colors: { ink: string; mute: string; beam: string; panel: string; rule: string };
  width: number;
  height: number;
  /** a three.js layer draws the scene underneath: draw only labels, handles and guide lines here */
  threeMode?: boolean;
}

/** Camera returned by a draw, for picking: world → screen, and screen → a plane. */
export interface Spot3DCamera {
  /** resolved screen projection (for a three.js camera that must match) */
  proj: IsoProj;
  S: (x: number, y: number, z: number) => Pt;
  /** Screen point → [x, z] on the vertical plane y = y0 (exact under the orthographic camera). */
  onPlaneY: (sx: number, sy: number, y0: number) => [number, number];
  /** Screen point → [x, y] on the horizontal plane z = z0 (exact under the orthographic camera). */
  onPlaneZ: (sx: number, sy: number, z0: number) => [number, number];
}

/** Depth of the floor strip shown in front of the wall, metres (shared with the three.js scene). */
export const spotDepth = (W: number, H: number, S: V3): number => Math.max(S[1] + .8, Math.min(W, H) * .6, 1.2);

/** Default camera: in front of the wall, a little to the side and above. */
export const spotHomeView = (): IsoView => ({ yaw: -28, pitch: 16, zoom: 0, panX: 0, panY: 0 });

const RAD = Math.PI / 180;
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];

/** Where the cone of half-angle `ang` around the axis S→aim meets the wall plane y = 0: runs of [x, z]. */
export function coneOnWall(S: V3, aim: [number, number], ang: number, lim: number): [number, number][][] {
  const ax = norm([aim[0] - S[0], -S[1], aim[1] - S[2]]);
  const u = norm(cross(ax, Math.abs(ax[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), v = cross(ax, u);
  const ca = Math.cos(ang), sa = Math.sin(ang), runs: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (let s = 0; s <= 360; s += 3) {
    const p = s * RAD, d = [0, 1, 2].map(j => ca * ax[j] + sa * (Math.cos(p) * u[j] + Math.sin(p) * v[j]));
    if (d[1] > -1e-4) { if (cur.length) runs.push(cur); cur = []; continue; }
    const t = -S[1] / d[1], x = S[0] + t * d[0], z = S[2] + t * d[2];
    if (Math.abs(x) > lim || Math.abs(z) > lim) { if (cur.length) runs.push(cur); cur = []; continue; }
    cur.push([x, z]);
  }
  if (cur.length) runs.push(cur);
  // a closed loop that was split at 0° / 360° is one run
  if (runs.length > 1) {
    const a = runs[0], b = runs[runs.length - 1];
    if (Math.hypot(a[0][0] - b[b.length - 1][0], a[0][1] - b[b.length - 1][1]) < 1e-6) { runs[0] = b.concat(a); runs.pop(); }
  }
  return runs;
}

export function drawSpot3D(cv: HTMLCanvasElement, o: Spot3DOptions): Spot3DCamera {
  const { W, H, S, aim, view, colors: C } = o;
  const D = spotDepth(W, H, S); // floor strip depth shown in front of the wall
  const cy = Math.cos(view.yaw * RAD), sy = Math.sin(view.yaw * RAD), cp = Math.cos(view.pitch * RAD), sp = Math.sin(view.pitch * RAD);
  const cx0 = W / 2, cy0 = D / 2, cz0 = H / 2;
  // world → camera: x right, y towards the viewer, z up; orthographic screen = (rx, ry·sin p − z·cos p)
  const cam = (x: number, y: number, z: number): V3 => {
    const dx = x - cx0, dy = y - cy0;
    return [dx * cy - dy * sy, dx * sy + dy * cy, z - cz0];
  };
  const flat = (x: number, y: number, z: number): Pt => { const [rx, ry, rz] = cam(x, y, z); return [rx, ry * sp - rz * cp]; };

  // fit margins: room for the height label on the left and the view buttons on the right
  const pad = 26, padL = 52, padR = 64;
  if (!(view.zoom > 0)) {
    const pts: Pt[] = [];
    for (const x of [0, W]) for (const y of [0, D]) for (const z of [0, H]) pts.push(flat(x, y, z));
    pts.push(flat(S[0], S[1], S[2]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    view.zoom = Math.min((o.width - padL - padR) / Math.max(1e-6, Math.max(...xs) - Math.min(...xs)), (o.height - 2 * pad) / Math.max(1e-6, Math.max(...ys) - Math.min(...ys)));
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
    view.panX = -mx * view.zoom + (padL - padR) / 2; view.panY = -my * view.zoom;
  }
  const s = view.zoom, ox = o.width / 2 + view.panX, oy = o.height / 2 + view.panY;
  const P = (x: number, y: number, z: number): Pt => { const [a, b] = flat(x, y, z); return [ox + a * s, oy + b * s]; };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  sizeCanvas(cv, o.width, o.height, dpr);
  const g = cv.getContext('2d')!;
  const camera: Spot3DCamera = {
    proj: { s, ox, oy },
    S: P,
    onPlaneY: (qx, qy, y0) => {
      // P(x, y0, z) = p0 + x·ex + z·ez (affine), solve the 2 × 2 system
      const p0 = P(0, y0, 0), ex = P(1, y0, 0), ez = P(0, y0, 1);
      const a = ex[0] - p0[0], b = ez[0] - p0[0], c = ex[1] - p0[1], d = ez[1] - p0[1], det = a * d - b * c || 1e-9;
      const rx = qx - p0[0], ry = qy - p0[1];
      return [(d * rx - b * ry) / det, (a * ry - c * rx) / det];
    },
    onPlaneZ: (qx, qy, z0) => {
      const p0 = P(0, 0, z0), ex = P(1, 0, z0), ey = P(0, 1, z0);
      const a = ex[0] - p0[0], b = ey[0] - p0[0], c = ex[1] - p0[1], d = ey[1] - p0[1], det = a * d - b * c || 1e-9;
      const rx = qx - p0[0], ry = qy - p0[1];
      return [(d * rx - b * ry) / det, (a * ry - c * rx) / det];
    },
  };
  if (!g) return camera;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, o.width, o.height);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const poly = (pts: Pt[], close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
  const line = (a: Pt, b: Pt) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  const wallFacing = cy > 0; // wall normal +y towards the viewer
  const above = sp > 0;      // looking down at the floor

  const tm = !!o.threeMode;
  // floor strip with a 0.5 m grid
  const floorQ = [P(0, 0, 0), P(W, 0, 0), P(W, D, 0), P(0, D, 0)];
  if (!tm) {
    poly(floorQ); g.fillStyle = C.mute; g.globalAlpha = above ? .07 : .03; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = C.rule; g.lineWidth = 1;
    for (let x = .5; x < W - 1e-6; x += .5) line(P(x, 0, 0), P(x, D, 0));
    for (let y = .5; y < D - 1e-6; y += .5) line(P(0, y, 0), P(W, y, 0));
    poly(floorQ); g.strokeStyle = C.mute; g.globalAlpha = .7; g.stroke(); g.globalAlpha = 1;
  }

  const wallQ = [P(0, 0, H), P(W, 0, H), P(W, 0, 0), P(0, 0, 0)];
  const drawWall = () => {
    g.save(); poly(wallQ); g.clip();
    if (wallFacing) {
      const p0 = P(0, 0, H), pu = P(W, 0, H), pv = P(0, 0, 0), tw = o.tex.width || 1, th = o.tex.height || 1;
      g.transform((pu[0] - p0[0]) / tw, (pu[1] - p0[1]) / tw, (pv[0] - p0[0]) / th, (pv[1] - p0[1]) / th, p0[0], p0[1]);
      g.imageSmoothingEnabled = true; g.drawImage(o.tex, 0, 0);
    } else { g.fillStyle = C.panel; g.fill(); g.fillStyle = C.mute; g.globalAlpha = .25; g.fill(); }
    g.restore();
    poly(wallQ); g.strokeStyle = C.ink; g.lineWidth = 2; g.globalAlpha = 1; g.stroke();
  };
  if (wallFacing && !tm) drawWall();

  // beam / field outlines on the wall (clipped to it) and the beam cone
  const lim = 6 * Math.max(W, H, 1);
  const beamRuns = coneOnWall(S, aim, o.th, lim), fieldRuns = coneOnWall(S, aim, o.gF, lim);
  const top = P(S[0], S[1], S[2]);
  // cone: spot to the extreme screen angles of the beam outline (drawn under the outlines)
  const ring = beamRuns.flat().filter(([x, z]) => x >= -.01 && x <= W + .01 && z >= -.01 && z <= H + .01).map(([x, z]) => P(x, 0, z));
  if (!tm && ring.length > 2) {
    const ang = ring.map(r => Math.atan2(r[1] - top[1], r[0] - top[0]));
    const ref = ang[0];
    const rel = ang.map(a => { let d = a - ref; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; });
    const lo = ring[rel.indexOf(Math.min(...rel))], hi = ring[rel.indexOf(Math.max(...rel))];
    poly([top, lo, hi]); g.fillStyle = C.beam; g.globalAlpha = .13; g.fill();
    g.globalAlpha = .7; g.strokeStyle = C.beam; g.lineWidth = 1.2; line(top, lo); line(top, hi); g.globalAlpha = 1;
  }
  if (!tm) { g.save(); poly(wallQ); g.clip(); }
  const runs = (rs: [number, number][][], dash: number[], w: number) => {
    g.setLineDash(dash); g.lineWidth = w;
    for (const r of rs) { if (r.length > 1) { poly(r.map(([x, z]) => P(x, 0, z)), false); g.stroke(); } }
    g.setLineDash([]);
  };
  if (!tm) {
    g.strokeStyle = '#16161e'; g.globalAlpha = .5; runs(fieldRuns, [5, 4], 2.6); runs(beamRuns, [], 3);
    g.strokeStyle = '#fff'; g.globalAlpha = .85; runs(fieldRuns, [5, 4], 1.1); runs(beamRuns, [], 1.5);
    g.globalAlpha = 1; g.restore();
  }

  // axis to the aim point, peak dot, aim cross
  const A = P(aim[0], 0, aim[1]);
  g.strokeStyle = C.beam; g.setLineDash([2, 4]); g.lineWidth = 1; line(top, A); g.setLineDash([]);
  const pk = P(o.peak[0], 0, o.peak[1]);
  g.beginPath(); g.arc(pk[0], pk[1], 2.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  for (const [col, w] of [['#16161e', 4], ['#e0af68', 2]] as const) {
    g.strokeStyle = col; g.lineWidth = w; line([A[0] - 9, A[1]], [A[0] + 9, A[1]]); line([A[0], A[1] - 9], [A[0], A[1] + 9]);
  }

  // drop lines: spot → floor → wall base (reads position in depth)
  const F = P(S[0], S[1], 0), B = P(S[0], 0, 0);
  g.strokeStyle = C.mute; g.setLineDash([3, 4]); g.lineWidth = 1; line(top, F); line(F, B); g.setLineDash([]);
  g.beginPath(); g.arc(F[0], F[1], 4, 0, Math.PI * 2); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.beam; g.lineWidth = 1.5; g.stroke();

  // spot body: a short cylinder along the beam axis (back ring → lens), as the hull of the two rings
  const ax = norm([aim[0] - S[0], -S[1], aim[1] - S[2]]);
  const u = norm(cross(ax, Math.abs(ax[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), v = cross(ax, u);
  const r = Math.max(.02, o.size / 2), len = Math.max(.05, o.size * 1.3);
  const ringAt = (k: number) => Array.from({ length: 24 }, (_, i) => {
    const t = i / 24 * 2 * Math.PI;
    return P(S[0] + k * ax[0] + r * (Math.cos(t) * u[0] + Math.sin(t) * v[0]), S[1] + k * ax[1] + r * (Math.cos(t) * u[1] + Math.sin(t) * v[1]), S[2] + k * ax[2] + r * (Math.cos(t) * u[2] + Math.sin(t) * v[2]));
  });
  const back = ringAt(-len), lens = ringAt(0), hull = convexHull([...back, ...lens]);
  if (tm) {
    // the three.js layer draws the body; keep a small ring here as the grab handle
    g.beginPath(); g.arc(top[0], top[1], 4, 0, Math.PI * 2); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.beam; g.lineWidth = 1.5; g.stroke();
  } else {
    poly(hull); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.stroke();
    // the lens shows when the spot faces the camera
    const lensFacing = cam(S[0] + ax[0], S[1] + ax[1], S[2] + ax[2])[1] - cam(S[0], S[1], S[2])[1] > -.2;
    poly(lens); g.fillStyle = lensFacing ? C.beam : C.panel; g.fill(); g.stroke();
  }

  if (!wallFacing && !tm) drawWall();

  // labels
  g.font = '600 11px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillStyle = C.ink;
  const mid = (a: Pt, b: Pt, dy = 0) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + dy] as Pt;
  const t1 = mid(P(0, 0, H), P(W, 0, H), -8); g.fillText(`${+W.toFixed(2)} m`, t1[0], t1[1]);
  g.textAlign = 'right'; const t2 = mid(P(0, 0, 0), P(0, 0, H)); g.fillText(`${+H.toFixed(2)} m`, t2[0] - 8, t2[1]);
  g.fillStyle = C.mute; g.textAlign = 'left';
  const t3 = mid(F, B, 14); g.fillText(`y ${+S[1].toFixed(2)}`, t3[0] + 4, t3[1]);
  const t4 = mid(top, F); g.fillText(`z ${+S[2].toFixed(2)}`, t4[0] + 8, t4[1]);
  return camera;
}

/** Monotone chain convex hull of screen points. */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
