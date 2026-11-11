// "Spot on wall" page: one aimed spotlight in front of a wall, standalone (not linked to the room
// or the lighting groups). 3D view of the lit wall (lux map or rendered look), side view, results.
// Saved in localStorage under remlux:spot.
import { buildModel, parsePhotometry, spotLuxAt, spotOnWall, type FixtureModel, type IesPhotometry, type SpotResult, type Vec3 } from '../engine';
import { kelvinRGB, ramp } from '../render/ramp';
import { attachIsoControls } from '../render/iso';
import { drawSpot3D, spotHomeView, type Spot3DCamera } from '../render/spot3d';
import { buildSpotScene } from '../render/three/spotScene';
import { createThreeViewport, type ThreeViewport } from './threeViewport';

const KEY = 'remlux:spot';
const NUM = ['spAng', 'spLm', 'spPw', 'spSz', 'spCct', 'spX', 'spY', 'spZ', 'spAx', 'spAz', 'spWW', 'spWH'] as const;
type NumId = typeof NUM[number];
const ANG = [8, 10, 15, 24, 36, 45, 60];
const SCALES = ['auto', 100, 200, 500, 1000, 2000] as const;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const f = (v: number, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en', { maximumFractionDigits: d });
const fl = (v: number) => v >= 100 ? f(v, 0) : v >= 10 ? f(v, 1) : f(v, 2);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

interface Saved { vals: Partial<Record<NumId, string>>; view: 'lux' | 'look'; scale: string; phot: 'gen' | 'file'; ies: IesPhotometry | null }

let view: Saved['view'] = 'look';
let scale: string = 'auto';
let phot: Saved['phot'] = 'gen';
let ies: IesPhotometry | null = null;
let fileErr = '';
let secGeo = { pad: 34, k: 100, VH: 300 };
const view3 = spotHomeView();
let cam3: Spot3DCamera | null = null;
let vp: ThreeViewport | null = null; // optional three.js renderer for the 3D view
const tex = document.createElement('canvas'); // wall image, one pixel per sample cell
/** Default input values, read from the markup at start-up (for Reset). */
const defaults: Partial<Record<NumId, string>> = {};
let last: { r: SpotResult; md: FixtureModel; W: number; H: number; S: Vec3; aim: [number, number] } | null = null;

const num = (id: NumId) => +($(id) as HTMLInputElement).value;
const setNum = (id: NumId, v: number) => { ($(id) as HTMLInputElement).value = String(Math.round(v * 100) / 100); };

let saveTimer = 0;
/** localStorage writes (the saved IES curve can be large) are batched while dragging. */
function save() { clearTimeout(saveTimer); saveTimer = window.setTimeout(saveNow, 250); }
function saveNow() {
  const vals: Saved['vals'] = {};
  NUM.forEach(id => { vals[id] = ($(id) as HTMLInputElement).value; });
  try { localStorage.setItem(KEY, JSON.stringify({ vals, view, scale, phot, ies } satisfies Saved)); } catch { /* private mode */ }
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null;
    if (!s) return;
    NUM.forEach(id => { const v = s.vals?.[id]; if (v != null && v !== '') ($(id) as HTMLInputElement).value = v; });
    if (s.view === 'lux' || s.view === 'look') view = s.view;
    if (SCALES.map(String).includes(String(s.scale))) scale = String(s.scale);
    if (s.ies && Array.isArray(s.ies.v) && Array.isArray(s.ies.c)) { ies = s.ies; phot = s.phot === 'file' ? 'file' : 'gen'; }
  } catch { /* ignore a damaged save */ }
}

function chips() {
  const pressed = (b: boolean) => `aria-pressed="${b}"`;
  $('spPhot').innerHTML = `<button class="chip" type="button" data-spp="gen" ${pressed(phot === 'gen')}>Generic beam</button>`
    + (ies ? `<button class="chip" type="button" data-spp="file" ${pressed(phot === 'file')}>${esc(ies.name.slice(0, 28))}</button>` : '')
    + `<button class="chip" type="button" data-spp="load">Load IES / LDT</button>`;
  const a = num('spAng');
  $('spAngChips').innerHTML = phot === 'file' ? '' : ANG.map(v => `<button class="chip" type="button" data-spa="${v}" ${pressed(a === v)}>${v}°</button>`).join('');
  $('spView').innerHTML = `<button class="chip" type="button" data-spv="look" ${pressed(view === 'look')}>Lighting effect</button><button class="chip" type="button" data-spv="lux" ${pressed(view === 'lux')}>Lux map</button>`;
  $('spScale').innerHTML = `<span class="note m-0 self-center">${view === 'look' ? 'Exposure' : 'Colour scale'}</span>`
    + SCALES.map(v => `<button class="chip" type="button" data-sps="${v}" ${pressed(scale === String(v))}>${v === 'auto' ? 'Auto' : v + ' lx'}</button>`).join('');
  const locked = phot === 'file' && !!ies;
  (['spAng', 'spLm'] as const).forEach(id => { ($(id) as HTMLInputElement).disabled = locked; });
}

function model(): FixtureModel | null {
  return buildModel({ phot: phot === 'file' ? 'ies' : 'gen', ies, angle: num('spAng'), lumens: num('spLm') });
}

/** Recalculate and redraw everything. */
function calc() {
  chips();
  const md = model(), W = num('spWW'), H = num('spWH');
  const S: Vec3 = [num('spX'), num('spY'), num('spZ')], aim: [number, number] = [num('spAx'), num('spAz')];
  if (phot === 'file' && ies && md) {
    setNum('spAng', md.ang); setNum('spLm', md.lm);
    if (ies.watts > 0) setNum('spPw', ies.watts);
  }
  $('spInfo').textContent = fileErr || (phot === 'file' && ies ? `${ies.brand ? ies.brand + ' · ' : ''}${ies.name}: beam ${f(md?.ang ?? 0, 0)}°, ${f(ies.flux, 0)} lm from the file` : '');
  let err = '';
  if (!md) err = 'Beam angle must be 5–120° and lumens above 0.';
  else if (!(W > 0 && H > 0)) err = 'Wall width and height must be above 0.';
  else if (!(S[1] > 0)) err = 'The spot must be in front of the wall (y above 0).';
  const r = err ? null : spotOnWall({ wallW: W, wallH: H, pos: S, aim, Iof: md!.Iof, th: md!.th, gF: md!.gF }, 200);
  if (!r || !md) { last = null; $('spOut').innerHTML = `<div class="panel"><p class="err">${err || 'Nothing to show.'}</p></div>`; clearDraw(); save(); return; }
  if (last && (last.W !== W || last.H !== H)) view3.zoom = 0; // wall resized: fit the 3D view again
  last = { r, md, W, H, S, aim };
  results();
  draw();
  save();
}

function results() {
  if (!last) return;
  const { r, md } = last, pw = num('spPw'), cd = md.Iof(1);
  const offWall = r.beam.w === 0 ? '<span class="text-bad">beam misses the wall</span>' : '';
  const card = (b: string, s: string, hero = false) => `<div class="res${hero ? ' hero' : ''}"><b>${b}</b><span>${s}</span></div>`;
  $('spOut').innerHTML = `<div class="results">`
    + card(`${fl(r.atAim)} lx`, `at the aim point (${f(last.aim[0])}, ${f(last.aim[1])} m) ${offWall}`, true)
    + card(`${fl(r.max)} lx`, `peak on the wall`)
    + card(r.beamAvg ? `${fl(r.beamAvg)} lx` : '–', 'average inside the beam')
    + card(r.beam.w ? `${f(r.beam.w)} × ${f(r.beam.h)} m` : '–', 'beam (50%) w × h')
    + card(r.field.w ? `${f(r.field.w)} × ${f(r.field.h)} m` : '–', 'field (10%) w × h')
    + card(`${f(r.throw)} m`, `throw · tilt ${f(r.tilt, 0)}° from down`)
    + card(`${f(cd, 0)} cd`, `centre beam · ${f(md.ang, 0)}° beam`)
    + card(pw > 0 ? `${f(md.lm / pw, 0)} lm/W` : '–', pw > 0 ? `${f(md.lm, 0)} lm · ${f(pw, 1)} W` : `${f(md.lm, 0)} lm · no power given`)
    + card(`${f(r.incidence, 0)}°`, 'beam to wall normal')
    + `</div>`;
}

function clearDraw() {
  $('spSec').innerHTML = '';
  const c = $('sp3d') as HTMLCanvasElement, g = c.getContext('2d'); if (g) g.clearRect(0, 0, c.width, c.height);
  cam3 = null;
  vp?.hide();
}

const topLux = () => !last ? 1 : scale === 'auto' ? Math.max(1e-6, last.r.max) : +scale;

/** Wall image (mapped onto the wall in 3D): false-colour lux, or the wall as it would look (warm-white surface, tone-mapped lux, light colour from CCT). */
function drawCanvas() {
  if (!last) return;
  const { r } = last, cv = tex, g = cv.getContext('2d');
  if (!g) return;
  cv.width = r.cw; cv.height = r.ch;
  const im = g.createImageData(r.cw, r.ch), top = topLux();
  const tint = kelvinRGB(num('spCct') || 3000), wall = [.92, .9, .86], k = top * .55;
  for (let i = 0; i < r.vals.length; i++) {
    const e = r.vals[i];
    let c: number[];
    if (view === 'lux') c = ramp(e / top);
    else {
      const t = 1 - Math.exp(-e / k), amb = .05;
      c = wall.map((w, j) => 255 * Math.pow(Math.min(1, w * (amb + (1 - amb) * t * (tint[j] * .85 + .15))), 1 / 1.6));
    }
    im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  $('spLegend').hidden = view !== 'lux';
  $('spLgMax').textContent = scale === 'auto' ? `${fl(r.max)} lx` : `${scale} lx+`;
}

/** 3D view: wall with the image above, spot, beam cone and outlines; free camera. */
function draw3d() {
  if (!last) return;
  const wrap = $('spWrap'), w = wrap.clientWidth;
  if (!w) return;
  const cs = getComputedStyle(document.documentElement), v = (n: string) => cs.getPropertyValue(n).trim();
  const h = Math.round(Math.max(300, Math.min(620, w * .66)));
  const colors = { ink: v('--ink'), mute: v('--mute'), beam: v('--beam'), panel: v('--panel'), rule: v('--rule') };
  const { W, H, S, aim, md } = last, size = 1e-3 * num('spSz'), three = !!vp?.active;
  cam3 = drawSpot3D($('sp3d') as HTMLCanvasElement, {
    W, H, S, aim, th: md.th, gF: md.gF, size, tex, peak: last.r.maxAt, view: view3, width: w, height: h, colors, threeMode: three,
  });
  if (three) vp!.present(view3, cam3.proj, w, h, T => buildSpotScene(T, { W, H, S, aim, th: md.th, gF: md.gF, size, tex, colors }));
}

/** Side view: the plane through the spot, square to the wall (aim offset along the wall is projected). */
function drawSection() {
  if (!last) return;
  const { md, H, S, aim } = last;
  // drawn in CSS pixels so text stays readable on phones; the floor runs as far as the width allows
  const VW = Math.max(260, $('spSec').clientWidth || 640), pad = 34, Z = Math.max(H, S[2] + .3);
  const k = Math.min(Math.min(320, VW * .75) / Z, (VW - 2 * pad) / (S[1] + .6)), Y = (VW - 2 * pad) / k, VH = Z * k + 2 * pad - 6;
  secGeo = { pad, k, VH };
  const px = (y: number) => pad + y * k, pz = (z: number) => VH - pad + 6 - z * k;
  const alpha = Math.atan2(aim[1] - S[2], -S[1]);
  const hit = (ang: number): [number, number] => {
    const dy = Math.cos(ang), dz = Math.sin(ang);
    let t = Infinity;
    if (dy < -1e-6) t = Math.min(t, -S[1] / dy);
    if (dz < -1e-6) t = Math.min(t, -S[2] / dz);
    if (dz > 1e-6) t = Math.min(t, (Z - S[2]) / dz);
    if (!isFinite(t)) t = Y * 2;
    return [S[1] + t * dy, S[2] + t * dz];
  };
  const ray = (ang: number, dash: string, w: number) => { const [y, z] = hit(ang); return `<line x1="${px(S[1])}" y1="${pz(S[2])}" x2="${px(y)}" y2="${pz(z)}" stroke="var(--beam)" stroke-width="${w}" ${dash}/>`; };
  const [b1y, b1z] = hit(alpha + md.th), [b2y, b2z] = hit(alpha - md.th);
  const fix = Math.max(.04, 1e-3 * num('spSz')), deg = alpha * 180 / Math.PI;
  const skew = Math.abs(aim[0] - S[0]) > .005;
  $('spSecCap').textContent = skew ? `aim is ${f(Math.abs(aim[0] - S[0]))} m to the side: shown projected` : '';
  $('spSec').innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" class="block h-auto w-full select-none" role="img" aria-label="Side view of the spot and its beam">
    <polygon points="${px(S[1])},${pz(S[2])} ${px(b1y)},${pz(b1z)} ${px(0)},${pz(Math.min(b1z, b2z))} ${px(b2y)},${pz(b2z)}" fill="var(--beam)" fill-opacity=".14"/>
    ${ray(alpha + md.gF, 'stroke-dasharray="4 4" stroke-opacity=".7"', 1)}${ray(alpha - md.gF, 'stroke-dasharray="4 4" stroke-opacity=".7"', 1)}
    ${ray(alpha + md.th, '', 1.5)}${ray(alpha - md.th, '', 1.5)}
    <line x1="${px(S[1])}" y1="${pz(S[2])}" x2="${px(0)}" y2="${pz(aim[1])}" stroke="var(--ink)" stroke-dasharray="2 4" stroke-opacity=".6"/>
    <line x1="${px(0)}" y1="${pz(0)}" x2="${px(Y)}" y2="${pz(0)}" stroke="var(--ink)" stroke-width="2"/>
    <line x1="${px(0)}" y1="${pz(0)}" x2="${px(0)}" y2="${pz(H)}" stroke="var(--ink)" stroke-width="4"/>
    ${H < Z ? `<line x1="${px(0)}" y1="${pz(H)}" x2="${px(0)}" y2="${pz(Z)}" stroke="var(--rule)" stroke-dasharray="3 4" stroke-width="2"/>` : ''}
    <path d="M${px(0) - 7} ${pz(aim[1])}h14M${px(0)} ${pz(aim[1]) - 7}v14" stroke="var(--beam)" stroke-width="2"/>
    <g data-spdrag="side" style="cursor:grab"><circle cx="${px(S[1])}" cy="${pz(S[2])}" r="18" fill="transparent"/>
      <rect x="${px(S[1]) - fix * k / 2 - 3}" y="${pz(S[2]) - 6}" width="${fix * k + 6}" height="12" rx="3" fill="var(--panel)" stroke="var(--ink)" stroke-width="1.5" transform="rotate(${-(deg + 90)} ${px(S[1])} ${pz(S[2])})"/>
      <circle cx="${px(S[1])}" cy="${pz(S[2])}" r="3" fill="var(--beam)"/><title>Spot: drag to move out from the wall and up or down</title></g>
    <g fill="var(--mute)" font-size="12" font-family="inherit">
      <line x1="${px(0)}" y1="${pz(0) + 14}" x2="${px(S[1])}" y2="${pz(0) + 14}" stroke="var(--mute)"/>
      <text x="${(px(0) + px(S[1])) / 2}" y="${pz(0) + 27}" text-anchor="middle">y ${f(S[1])} m</text>
      <text x="${px(S[1]) + 12}" y="${pz(S[2]) - 10}">z ${f(S[2])} m</text>
      <text x="${px(0) + 10}" y="${pz(aim[1]) + 4}">aim ${f(aim[1])} m</text>
      <text x="${px(Y) - 4}" y="${pz(0) - 6}" text-anchor="end">floor</text>
      <text x="${px(0) - 8}" y="${pz(H / 2)}" text-anchor="end" transform="rotate(-90 ${px(0) - 8} ${pz(H / 2)})">wall</text>
    </g></svg>`;
}

function draw() {
  if (!last || $('pg-spot').hidden) return;
  drawCanvas(); vp?.invalidate(); draw3d(); drawSection();
  $('spCap').textContent = idleCap();
}

// ---------------------------------------------------------------------------------------------
// Dragging on the elevation (aim cross, spot x/z) and the side view (spot y/z), plus a lux readout.
const snap = (v: number) => Math.round(v / .05) * .05;

const idleCap = () => last ? `wall average ${fl(last.r.wallAvg)} lx · peak ${fl(last.r.max)} lx` : '';

function attachDrag() {
  let mode: 'aim' | 'spot' | 'spotH' | 'foot' | 'side' | null = null;
  const cv = $('sp3d') as HTMLCanvasElement;
  const local = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] as const; };
  // Spot body: drag = x / z (parallel to the wall, y kept); Shift + drag = x / y (horizontal, z kept).
  // Floor dot under the spot: drag = x / y on the floor (z kept).
  const handle = (e: PointerEvent): 'aim' | 'spot' | 'spotH' | 'foot' | null => {
    if (!cam3 || !last) return null;
    const [x, y] = local(e), near = (p: [number, number], r: number) => Math.hypot(p[0] - x, p[1] - y) <= r;
    if (near(cam3.S(last.aim[0], 0, last.aim[1]), 14)) return 'aim';
    if (near(cam3.S(last.S[0], last.S[1], last.S[2]), 16)) return e.shiftKey ? 'spotH' : 'spot';
    if (near(cam3.S(last.S[0], last.S[1], 0), 12)) return 'foot';
    return null;
  };
  // a drag recalculates at most once per frame
  let pending: (() => void) | null = null;
  const later = (fn: () => void) => { if (!pending) requestAnimationFrame(() => { const f = pending; pending = null; f?.(); }); pending = fn; };
  // registered before the camera controls, so grabbing a handle does not orbit the view
  cv.addEventListener('pointerdown', e => {
    const h = handle(e);
    if (!h) return;
    mode = h; cv.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation();
  });
  cv.addEventListener('pointermove', e => {
    if (!cam3 || !last) return;
    const [x, y] = local(e), W = last.W, H = last.H;
    if (mode === 'aim' || mode === 'spot') {
      const [px, pz] = cam3.onPlaneY(x, y, mode === 'aim' ? 0 : last.S[1]);
      const cx = snap(Math.max(0, Math.min(W, px))), cz = snap(Math.max(0, Math.min(H, pz)));
      if (mode === 'aim') { setNum('spAx', cx); setNum('spAz', cz); } else { setNum('spX', cx); setNum('spZ', cz); }
      later(calc); e.stopImmediatePropagation();
    } else if (mode === 'spotH' || mode === 'foot') {
      const [px, py] = cam3.onPlaneZ(x, y, mode === 'foot' ? 0 : last.S[2]);
      setNum('spX', snap(Math.max(0, Math.min(W, px)))); setNum('spY', Math.max(.05, snap(Math.min(py, 20))));
      later(calc); e.stopImmediatePropagation();
    } else cv.style.cursor = handle(e) ? 'grab' : '';
    if (!last || !cam3) return;
    const [wx, wz] = cam3.onPlaneY(x, y, 0);
    $('spCap').textContent = wx >= 0 && wx <= W && wz >= 0 && wz <= H
      ? `x ${f(wx)} · z ${f(wz)} m: ${fl(spotLuxAt({ pos: last.S, aim: last.aim, Iof: last.md.Iof }, wx, wz))} lx`
      : idleCap();
  });
  const end = () => { if (mode !== 'side') mode = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!mode) $('spCap').textContent = idleCap(); });

  const sec = $('spSec');
  sec.addEventListener('pointerdown', e => {
    if (!(e.target as Element).closest('[data-spdrag="side"]')) return;
    mode = 'side'; sec.setPointerCapture(e.pointerId); e.preventDefault();
  });
  sec.addEventListener('pointermove', e => {
    if (mode !== 'side') return;
    const svg = sec.querySelector('svg'), m = svg?.getScreenCTM();
    if (!svg || !m || !last) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const { pad, k, VH } = secGeo, y = (pt.x - pad) / k, z = (VH - pad + 6 - pt.y) / k;
    setNum('spY', Math.max(.05, snap(y))); setNum('spZ', Math.max(0, snap(z)));
    later(calc);
  });
  const endS = () => { if (mode === 'side') mode = null; };
  sec.addEventListener('pointerup', endS); sec.addEventListener('pointercancel', endS);
}

function onFile(file: File) {
  const rd = new FileReader();
  rd.onload = () => {
    try { ies = parsePhotometry(String(rd.result), file.name); phot = 'file'; fileErr = ''; }
    catch (err) { fileErr = (err as Error).message; }
    calc();
  };
  rd.readAsText(file);
}

/** Wire the Spot on wall page. Safe to call once at start-up. */
export function initSpot(): void {
  if (!document.getElementById('pg-spot')) return;
  NUM.forEach(id => { defaults[id] = ($(id) as HTMLInputElement).defaultValue; });
  load();
  NUM.forEach(id => $(id).addEventListener('input', calc));
  $('pg-spot').addEventListener('click', e => {
    const t = e.target as HTMLElement, b = t.closest<HTMLElement>('button');
    if (!b) return;
    const d = b.dataset;
    if (d.spa) setNum('spAng', +d.spa);
    if (d.spv) view = d.spv as Saved['view'];
    if (d.sps) scale = d.sps;
    if (d.spp === 'gen') phot = 'gen';
    if (d.spp === 'file' && ies) phot = 'file';
    if (d.spp === 'load') { ($('spFile') as HTMLInputElement).click(); return; }
    if (b.id === 'spSquare') { setNum('spAx', num('spX')); setNum('spAz', Math.max(0, Math.min(num('spWH'), num('spZ')))); }
    if (b.id === 'spReset') {
      NUM.forEach(id => { ($(id) as HTMLInputElement).value = defaults[id] ?? ''; });
      view = 'look'; scale = 'auto'; phot = 'gen'; ies = null; fileErr = '';
      Object.assign(view3, spotHomeView());
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    }
    if (b.id === 'spResetT') {
      // position and aim only: the wall, the light and the camera stay as they are
      (['spX', 'spY', 'spZ', 'spAx', 'spAz'] as const).forEach(id => { ($(id) as HTMLInputElement).value = defaults[id] ?? ''; });
    }
    if (b.id === 'spCentre') { setNum('spX', num('spWW') / 2); setNum('spAx', num('spWW') / 2); setNum('spAz', num('spWH') / 2); }
    calc();
  });
  $('spFile').addEventListener('change', e => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0];
    if (file) onFile(file);
    inp.value = '';
  });
  attachDrag();
  attachIsoControls($('spWrap'), $('sp3d'), view3, () => draw3d(), spotHomeView);
  vp = createThreeViewport({
    id: 'spot', button: $('spRender'), anchor: $('sp3d') as HTMLCanvasElement, redraw: () => draw(),
    onError: msg => { $('spCap').textContent = msg; },
  });
  window.addEventListener('themechange', draw);
  // redraw when the page is shown or its width changes (not on height changes the drawing itself causes)
  let lastW = -1;
  const onSize = () => { const w = $('pg-spot').clientWidth; if (w !== lastW) { lastW = w; requestAnimationFrame(draw); } };
  try { new ResizeObserver(onSize).observe($('pg-spot')); } catch { addEventListener('resize', onSize); }
  calc();
}
