// 3D view of the room with a free orthographic camera (orbit, pan, zoom): floor heat map,
// walls, ceiling and downlight beams. Pure drawing + input handling, no app state of its own.
import type { Pt } from '../engine/types';

export interface IsoLight {
  x: number;
  y: number;
  /** floor radius of the 50% beam, metres */
  rB: number;
  /** group colour (CSS colour) */
  col: string;
  /** false for a group that is switched off */
  on: boolean;
  selected?: boolean;
}

/** Camera. yaw/pitch in degrees; zoom 0 means "fit the room" (resolved on the next draw). */
export interface IsoView {
  yaw: number;
  /** elevation above the floor: 0 = side-on, 90 = straight down */
  pitch: number;
  zoom: number;
  /** pan in CSS pixels */
  panX: number;
  panY: number;
}

export interface IsoOptions {
  /** room bounding box and ceiling height, metres */
  L: number;
  W: number;
  H: number;
  /** room outline, or null for a plain L × W rectangle */
  poly: Pt[] | null;
  /** the 2D heat map (one pixel per sample cell, covering L × W) */
  heat: HTMLCanvasElement;
  lights: IsoLight[];
  showBeams: boolean;
  view: IsoView;
  /** CSS colours for lines and text */
  ink: string;
  mute: string;
  beam: string;
  /** CSS pixel size of the drawing */
  width: number;
  height: number;
  /** a three.js layer draws the scene underneath: draw only the labels on this canvas */
  threeMode?: boolean;
}

/** Resolved screen projection of a draw: pixels per metre and the screen position of the view centre. */
export interface IsoProj {
  s: number;
  ox: number;
  oy: number;
}

/** True isometric: 45° around, 35.264° up (all three axes foreshortened equally). */
export const ISO_YAW = 45;
export const ISO_PITCH = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI;

export const newIsoView = (): IsoView => ({ yaw: ISO_YAW, pitch: ISO_PITCH, zoom: 0, panX: 0, panY: 0 });

const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Resize the backing store only when the size changed (assigning width/height reallocates it and clears it every frame). */
export function sizeCanvas(cv: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw) cv.width = bw;
  if (cv.height !== bh) cv.height = bh;
  const sw = w + 'px', sh = h + 'px';
  if (cv.style.width !== sw) cv.style.width = sw;
  if (cv.style.height !== sh) cv.style.height = sh;
}

export function drawIso(cv: HTMLCanvasElement, o: IsoOptions): IsoProj {
  const { L, W, H, view } = o;
  const room: Pt[] = o.poly && o.poly.length >= 3 ? o.poly : [[0, 0], [L, 0], [L, W], [0, W]];
  const cy = Math.cos(view.yaw * RAD);
  const sy = Math.sin(view.yaw * RAD);
  const cp = Math.cos(view.pitch * RAD);
  const sp = Math.sin(view.pitch * RAD);

  // world metres -> camera space: x right, y towards the viewer (screen down), z up
  const cam = (x: number, y: number, z: number): [number, number, number] => {
    const dx = x - L / 2;
    const dy = y - W / 2;
    const rx = dx * cy - dy * sy;
    const ry = dx * sy + dy * cy;
    return [rx, ry, z - H / 2];
  };
  // orthographic: screen X = rx, screen Y = ry·sin(pitch) − z·cos(pitch)
  const flat = (x: number, y: number, z: number): Pt => {
    const [rx, ry, rz] = cam(x, y, z);
    return [rx, ry * sp - rz * cp];
  };

  // fit: scale the room's projected box into the canvas (only when zoom is 0)
  const pad = 20;
  if (!(view.zoom > 0)) {
    const pts: Pt[] = [];
    for (const [x, y] of room) pts.push(flat(x, y, 0), flat(x, y, H));
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const fit = Math.min(
      (o.width - 2 * pad) / Math.max(1e-6, Math.max(...xs) - Math.min(...xs)),
      (o.height - 2 * pad) / Math.max(1e-6, Math.max(...ys) - Math.min(...ys)),
    );
    view.zoom = fit;
    view.panX = 0;
    view.panY = 0;
  }
  const s = view.zoom;
  const ox = o.width / 2 + view.panX;
  const oy = o.height / 2 + view.panY;
  const S = (x: number, y: number, z: number): Pt => {
    const [px, py] = flat(x, y, z);
    return [ox + px * s, oy + py * s];
  };
  const depth = (x: number, y: number) => cam(x, y, 0)[1];
  const proj: IsoProj = { s, ox, oy };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  sizeCanvas(cv, o.width, o.height, dpr);
  const g = cv.getContext('2d');
  if (!g) return proj;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, o.width, o.height);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  const path = (pts: Pt[]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };

  // walls: which ones face the camera (outward normal points towards the viewer, +y in camera space)
  const rp = room.map(([x, y]) => cam(x, y, 0));
  const ccx = rp.reduce((a, p) => a + p[0], 0) / rp.length;
  const ccy = rp.reduce((a, p) => a + p[1], 0) / rp.length;
  const walls = room.map((a, i) => {
    const b = room[(i + 1) % room.length];
    const [ax, ay] = rp[i];
    const [bx, by] = rp[(i + 1) % rp.length];
    let nx = by - ay;
    let ny = -(bx - ax);
    if (nx * ((ax + bx) / 2 - ccx) + ny * ((ay + by) / 2 - ccy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { a, b, front: ny > 0, depth: (ay + by) / 2 };
  });
  walls.sort((p, q) => p.depth - q.depth);

  const drawWall = (w: { a: Pt; b: Pt; front: boolean }) => {
    path([S(w.a[0], w.a[1], 0), S(w.b[0], w.b[1], 0), S(w.b[0], w.b[1], H), S(w.a[0], w.a[1], H)]);
    g.fillStyle = o.mute;
    g.globalAlpha = w.front ? 0.05 : 0.14;
    g.fill();
    g.globalAlpha = w.front ? 0.35 : 0.6;
    g.strokeStyle = o.mute;
    g.lineWidth = 1;
    g.stroke();
    g.globalAlpha = 1;
  };

  const drawScene = () => {
    walls.filter(w => !w.front).forEach(drawWall);

    // floor: the heat map mapped onto the floor plane
    const floor = room.map(([x, y]) => S(x, y, 0));
    g.save();
    path(floor);
    g.clip();
    const p0 = S(0, 0, 0);
    const pu = S(1, 0, 0);
    const pv = S(0, 1, 0);
    const cw = o.heat.width || 1;
    const ch = o.heat.height || 1;
    g.transform(
      ((pu[0] - p0[0]) * L) / cw,
      ((pu[1] - p0[1]) * L) / cw,
      ((pv[0] - p0[0]) * W) / ch,
      ((pv[1] - p0[1]) * W) / ch,
      p0[0],
      p0[1],
    );
    g.imageSmoothingEnabled = true;
    g.drawImage(o.heat, 0, 0);
    g.restore();
    path(floor);
    g.strokeStyle = o.ink;
    g.lineWidth = 2;
    g.stroke();

    // ceiling outline
    path(room.map(([x, y]) => S(x, y, H)));
    g.setLineDash([5, 4]);
    g.strokeStyle = o.mute;
    g.globalAlpha = 0.8;
    g.lineWidth = 1;
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;

    // downlights: far ones first so near ones overlap them
    const lights = [...o.lights].sort((p, q) => depth(p.x, p.y) - depth(q.x, q.y));
    for (const l of lights) {
      const top = S(l.x, l.y, H);
      const foot = S(l.x, l.y, 0);
      const base = l.on ? 1 : 0.35;
      if (o.showBeams && l.rB > 0) {
        const ring: Pt[] = [];
        for (let i = 0; i < 48; i++) {
          const t = (i / 48) * Math.PI * 2;
          ring.push(S(l.x + l.rB * Math.cos(t), l.y + l.rB * Math.sin(t), 0));
        }
        // cone: the two tangent lines from the lamp to the floor ellipse
        let lo = Infinity;
        let hi = -Infinity;
        let pl = ring[0];
        let ph = ring[0];
        for (const r of ring) {
          const ang = Math.atan2(r[1] - top[1], r[0] - top[0]);
          if (ang < lo) { lo = ang; pl = r; }
          if (ang > hi) { hi = ang; ph = r; }
        }
        g.beginPath();
        g.moveTo(top[0], top[1]);
        g.lineTo(pl[0], pl[1]);
        g.lineTo(ph[0], ph[1]);
        g.closePath();
        g.fillStyle = l.col;
        g.globalAlpha = base * 0.12;
        g.fill();
        path(ring);
        g.globalAlpha = base * 0.18;
        g.fill();
        g.globalAlpha = base * 0.85;
        g.strokeStyle = l.col;
        g.lineWidth = 1.2;
        g.stroke();
      }
      g.globalAlpha = base * 0.5;
      g.setLineDash([2, 3]);
      g.strokeStyle = l.col;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(top[0], top[1]);
      g.lineTo(foot[0], foot[1]);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = base;
      g.beginPath();
      g.arc(top[0], top[1], l.selected ? 5 : 3.5, 0, Math.PI * 2);
      g.fillStyle = l.col;
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = l.selected ? o.beam : '#16161e';
      g.stroke();
      g.globalAlpha = 1;
    }

    walls.filter(w => w.front).forEach(drawWall);
  };
  if (!o.threeMode) drawScene();

  // size labels on the two floor edges that meet at the corner nearest the camera
  if (!o.poly) {
    g.font = '600 11px "JetBrains Mono", monospace';
    g.fillStyle = o.ink;
    g.textAlign = 'center';
    const near = ([[0, 0], [L, 0], [L, W], [0, W]] as Pt[]).reduce((a, b) => (depth(b[0], b[1]) > depth(a[0], a[1]) ? b : a));
    const ax = near[0] === 0 ? L : 0;
    const ay = near[1] === 0 ? W : 0;
    const label = (a: Pt, b: Pt, txt: string) => g.fillText(txt, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 14);
    label(S(near[0], near[1], 0), S(ax, near[1], 0), `${+L.toFixed(2)} m`);
    label(S(near[0], near[1], 0), S(near[0], ay, 0), `${+W.toFixed(2)} m`);
    const h0 = S(near[0], near[1], 0);
    const h1 = S(near[0], near[1], H);
    g.textAlign = 'left';
    g.fillStyle = o.mute;
    g.fillText(`${+H.toFixed(2)} m`, h0[0] + 8, (h0[1] + h1[1]) / 2);
  }
  return proj;
}

/**
 * Mouse and touch controls, like a 3D modeller:
 * left drag = orbit, middle or right drag (or Shift + left drag) = pan, wheel = zoom,
 * double click = reset (to `home`, true isometric by default). Buttons with data-nav="orbit|pan|zoom" inside `host` do the same when
 * dragged, and data-nav="reset" resets the view.
 */
export function attachIsoControls(host: HTMLElement, canvas: HTMLElement, view: IsoView, onChangeNow: () => void, home: () => IsoView = newIsoView): void {
  // pointer events can fire faster than the screen refreshes: draw at most once per frame
  let queued = false;
  const onChange = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; onChangeNow(); });
  };
  type Mode = 'orbit' | 'pan' | 'zoom';
  let mode: Mode | null = null;
  let lastX = 0;
  let lastY = 0;
  const reset = () => {
    Object.assign(view, home());
    onChange();
  };

  const start = (e: PointerEvent, m: Mode, target: Element) => {
    mode = m;
    lastX = e.clientX;
    lastY = e.clientY;
    target.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!mode) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (mode === 'orbit') {
      view.yaw = (view.yaw - dx * 0.4 + 360) % 360;
      view.pitch = clamp(view.pitch + dy * 0.4, 4, 90);
    } else if (mode === 'pan') {
      view.panX += dx;
      view.panY += dy;
    } else {
      view.zoom = clamp(view.zoom * Math.exp(-dy * 0.01), 5, 600);
    }
    onChange();
  };
  const end = () => {
    mode = null;
  };

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', e => {
    const pe = e as PointerEvent;
    const m: Mode = pe.button === 1 || pe.button === 2 || pe.shiftKey ? 'pan' : pe.ctrlKey ? 'zoom' : 'orbit';
    start(pe, m, canvas);
  });
  canvas.addEventListener('pointermove', e => move(e as PointerEvent));
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('dblclick', reset);
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      view.zoom = clamp(view.zoom * Math.exp(-(e as WheelEvent).deltaY * 0.0015), 5, 600);
      onChange();
    },
    { passive: false },
  );

  host.querySelectorAll<HTMLElement>('[data-nav]').forEach(b => {
    const kind = b.dataset.nav;
    b.style.touchAction = 'none';
    if (kind === 'reset') {
      b.addEventListener('click', reset);
      return;
    }
    b.addEventListener('pointerdown', e => start(e as PointerEvent, kind as Mode, b));
    b.addEventListener('pointermove', e => move(e as PointerEvent));
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
  });
}
