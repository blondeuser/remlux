// Floor plan image: a CAD screenshot shown in its own card, scaled from a printed dimension, as a
// reference for tracing the room with the draw / edit tool. The image never leaves the browser and is not saved
// (only the traced polygon is). Maths lives in src/engine/calibrate.ts.
import { insideLength, isSimple, polyArea, pxDist, scaleError, scaleFromPoints, snapOrtho, tracedPoly, type DimBasis, type Pt } from '../engine';

export interface PlanImageOptions {
  /** Resize the room box to the image's real size. Returns false when it declined (a traced shape exists). */
  fitRoom: (L: number, W: number) => boolean;
  /** Use the traced outline (metres) as the room shape. */
  setRoom: (poly: Pt[]) => void;
}

type Step = 'idle' | 'a' | 'b' | 't';

export function initPlanImage(o: PlanImageOptions): void {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const file = $<HTMLInputElement>('imgFile'), msg = $('imgMsg');
  const len = $<HTMLInputElement>('imgLen'), basis = $<HTMLSelectElement>('imgBasis'), wall = $<HTMLInputElement>('imgWall');
  const bCal = $('imgCal'), bSet = $('imgSet'), bChk = $('imgChk'), bTrace = $('imgTrace'), bClr = $('imgClear'), tools = $('imgTools');

  const view = $('imgView');
  const img = document.createElement('img');
  img.alt = 'Floor plan image';
  img.draggable = false;
  img.className = 'block w-full h-auto select-none';
  view.append(img);
  const dots: HTMLElement[] = [0, 1].map(() => {
    const d = document.createElement('i');
    d.className = 'absolute size-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-paper bg-bad pointer-events-none';
    d.hidden = true;
    view.append(d);
    return d;
  });

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'pointer-events-none absolute inset-0 size-full');
  view.append(svg);

  let url = '', wPx = 0, hPx = 0, mpp = 0;
  let step: Step = 'idle', purpose: 'cal' | 'chk' = 'cal';
  let pts: Pt[] = [];
  let scaled = false;
  let trace: Pt[] = [];

  const say = (t: string, bad = false) => { msg.textContent = t; msg.classList.toggle('text-bad', bad); };
  function layout() {
    view.hidden = !url;
    dots.forEach((d, i) => {
      const p = pts[i];
      d.hidden = !p;
      if (p) { d.style.left = `${p[0] / wPx * 100}%`; d.style.top = `${p[1] / hPx * 100}%`; }
    });
  }

  function drawTrace() {
    svg.setAttribute('viewBox', `0 0 ${wPx || 1} ${hPx || 1}`);
    const r = wPx * 0.007, pl = trace.map(p => p.join(',')).join(' ');
    svg.innerHTML = trace.length
      ? `<polyline points="${pl}${trace.length > 2 && step !== 't' ? ' ' + trace[0].join(',') : ''}" fill="${step !== 't' ? 'var(--accent)' : 'none'}" fill-opacity=".18" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`
        + trace.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? r * 1.5 : r}" fill="${i === 0 ? 'var(--beam)' : 'var(--accent)'}" stroke="var(--paper)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`).join('')
      : '';
  }

  function sync() {
    drawTrace();
    bTrace.hidden = !url || !scaled;
    bTrace.textContent = step === 't' ? (trace.length >= 3 ? 'Finish room' : 'Cancel trace') : 'Trace room';
    bTrace.setAttribute('aria-pressed', String(step === 't'));
    const has = !!url;
    tools.hidden = !has;
    bClr.hidden = !has;
    bChk.hidden = !has || !scaled;
    bCal.setAttribute('aria-pressed', String(step !== 'idle' && purpose === 'cal'));
    bChk.setAttribute('aria-pressed', String(step !== 'idle' && purpose === 'chk'));
    view.style.cursor = step === 'idle' ? '' : 'crosshair';
  }

  function stop() { step = 'idle'; pts = []; trace = []; layout(); sync(); }

  function begin(p: 'cal' | 'chk') {
    trace = [];
    if (step !== 'idle' && purpose === p) { stop(); say(scaled ? 'Scale set.' : 'Cancelled.'); return; }
    purpose = p; step = 'a'; pts = []; layout(); sync();
    say(p === 'cal' ? 'Click one end of a printed dimension.' : 'Click one end of another printed dimension.');
  }

  const typedLength = () => {
    const v = +len.value;
    return v > 0 ? insideLength(v, basis.value as DimBasis, +wall.value || 0) : NaN;
  };

  function finishTrace() {
    if (trace.length < 3) { say('Trace at least 3 corners.', true); return; }
    const P = tracedPoly(trace, mpp);
    const a = Math.abs(polyArea(P));
    if (!isSimple(P)) { say('The outline crosses itself. Cancel and trace again.', true); return; }
    if (a < 0.25) { say('That outline is too small. Cancel and trace again.', true); return; }
    o.setRoom(P);
    step = 'idle'; trace = []; sync();
    say(`Room created: ${P.length} corners, ${a.toFixed(1)} m². Adjust corners with Draw / edit on the plan.`);
  }

  view.addEventListener('pointerdown', e => {
    if (step === 'idle' || !url) return;
    e.preventDefault();
    const r = view.getBoundingClientRect();
    if (step === 't') {
      let p: Pt = [(e.clientX - r.left) / r.width * wPx, (e.clientY - r.top) / r.height * hPx];
      if (trace.length >= 3 && pxDist(p, trace[0]) <= wPx * 0.015) { finishTrace(); return; }   // click the first corner to close
      if (trace.length) p = snapOrtho(trace[trace.length - 1], p);
      trace.push(p);
      say(trace.length < 3 ? `Corner ${trace.length}. Click the next corner along the wall.` : `Corner ${trace.length}. Click the first (amber) corner or Finish room to close.`);
      sync();
      return;
    }
    pts.push([(e.clientX - r.left) / r.width * wPx, (e.clientY - r.top) / r.height * hPx]);
    if (step === 'a') { step = 'b'; say('Now click the other end.'); }
    else {
      step = 'idle';
      if (purpose === 'cal') say('Type the printed length, then press Set scale.');
      else say('Type that printed length, then press Check again.');
      len.focus();
    }
    layout(); sync();
  });

  function setScale() {
    const real = typedLength();
    if (pts.length < 2) { say('Pick two points first.', true); return; }
    const m = scaleFromPoints(pts[0], pts[1], real);
    if (m === null) { say('Enter a length above zero.', true); return; }
    mpp = m;
    scaled = true;
    const w = wPx * mpp, h = hPx * mpp;
    const fit = o.fitRoom(Math.min(100, Math.ceil(w * 10 - 1e-6) / 10), Math.min(100, Math.ceil(h * 10 - 1e-6) / 10));
    pts = []; layout(); sync();
    say(`Scale set: image is ${w.toFixed(1)} × ${h.toFixed(1)} m${fit ? ', room box matched to it' : ''}. Check a second dimension, or press Trace room.`);
  }

  function check() {
    const real = typedLength();
    if (pts.length < 2) { say('Pick two points first.', true); return; }
    const err = scaleError(pts[0], pts[1], mpp, real);
    if (err === null) { say('Enter a length above zero.', true); return; }
    const pct = err * 100, ok = Math.abs(pct) <= 2;
    say(`${ok ? 'Good' : 'Off'}: image measures ${(pxDist(pts[0], pts[1]) * mpp).toFixed(2)} m against ${real.toFixed(2)} m (${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %).${ok ? '' : ' Recalibrate with a longer dimension.'}`, !ok);
    pts = []; layout();
  }

  function load(f: File) {
    if (!/^image\/(png|jpeg)$/.test(f.type)) { say('Use a PNG or JPG image.', true); return; }
    const u = URL.createObjectURL(f), probe = new Image();
    probe.onload = () => {
      if (url) URL.revokeObjectURL(url);
      url = u; wPx = probe.naturalWidth; hPx = probe.naturalHeight; img.src = u;
      mpp = 0; scaled = false; step = 'idle'; pts = []; trace = [];
      layout(); sync();
      say('Pick two points on a printed dimension (Set scale), type its length, then press Trace room.');
    };
    probe.onerror = () => { URL.revokeObjectURL(u); say('Could not read that image.', true); };
    probe.src = u;
  }

  function clear() {
    if (url) URL.revokeObjectURL(url);
    url = ''; img.removeAttribute('src'); scaled = false; step = 'idle'; pts = []; trace = [];
    file.value = ''; layout(); sync(); say('');
  }

  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) load(f); });
  bCal.addEventListener('click', () => begin('cal'));
  bChk.addEventListener('click', () => { if (purpose === 'chk' && step === 'idle' && pts.length === 2) check(); else begin('chk'); });
  bSet.addEventListener('click', setScale);
  bTrace.addEventListener('click', () => {
    if (step === 't') { if (trace.length >= 3) finishTrace(); else { stop(); say('Trace cancelled.'); } return; }
    step = 't'; trace = []; pts = []; layout(); sync();
    say('Click each inside corner of the room in order. Segments snap to horizontal / vertical.');
  });
  bClr.addEventListener('click', clear);
  sync();
}
