// Per-viewport switch for the optional three.js renderer. The canvas-2D drawing stays the default
// and the fallback; when the switch is on, a WebGL layer shows the scene underneath and the 2D canvas
// only draws labels and handles. three.js is fetched the first time a switch is turned on.
import type * as THREE from 'three';
import type { IsoProj, IsoView } from '../render/iso';
import { ThreeLayer, type ThreeLib } from '../render/three/layer';

const KEY = 'remlux:three';

export interface ThreeViewport {
  /** true once the WebGL layer is ready: the 2D draw must then run in `threeMode` */
  readonly active: boolean;
  /** the scene content is out of date (data or colours changed); rebuilt on the next `present` */
  invalidate(): void;
  /** draw the three.js frame for the 2D view that was just drawn */
  present(view: IsoView, proj: IsoProj, w: number, h: number, build: (T: ThreeLib) => THREE.Object3D): void;
  /** hide the WebGL canvas (the viewport shows nothing or the plan) */
  hide(): void;
}

interface Options {
  /** key inside the saved switch states, one per viewport */
  id: string;
  button: HTMLElement | null;
  /** the 2D canvas of the viewport (the WebGL canvas is placed under it) */
  anchor: HTMLCanvasElement | null;
  /** redraw the viewport (called after the switch changes) */
  redraw: () => void;
  onError: (msg: string) => void;
}

const readSaved = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
};
const writeSaved = (id: string, on: boolean) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readSaved(), [id]: on })); } catch { /* private mode */ }
};

export function createThreeViewport(o: Options): ThreeViewport {
  let layer: ThreeLayer | null = null;
  let stale = true;
  let busy = false;
  const press = (on: boolean) => o.button?.setAttribute('aria-pressed', String(on));

  async function enable(): Promise<void> {
    if (!o.anchor || layer || busy) return;
    busy = true;
    press(true);
    try {
      layer = await ThreeLayer.create(o.anchor);
      layer.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('The 3D renderer lost its graphics context. Back to the standard view.'); });
      stale = true;
      writeSaved(o.id, true);
      o.redraw();
    } catch (err) {
      layer = null;
      fail(err instanceof Error && /webgl/i.test(err.message) ? 'WebGL is not available here. Staying on the standard view.' : 'Could not start the three.js renderer. Staying on the standard view.');
    } finally { busy = false; }
  }

  function disable(save = true): void {
    layer?.dispose();
    layer = null;
    press(false);
    if (save) writeSaved(o.id, false);
    o.redraw();
  }

  function fail(msg: string): void {
    disable(false);
    writeSaved(o.id, false);
    o.onError(msg);
  }

  o.button?.addEventListener('click', () => { if (layer) disable(); else void enable(); });
  if (readSaved()[o.id]) void enable();

  return {
    get active() { return !!layer; },
    invalidate() { stale = true; },
    present(view, proj, w, h, build) {
      if (!layer) return;
      try {
        if (stale || !layer.hasContent) { layer.setContent(build(layer.T)); stale = false; }
        layer.canvas.style.visibility = 'visible';
        layer.render(view, proj, w, h);
      } catch { fail('The 3D renderer failed. Back to the standard view.'); }
    },
    hide() { if (layer) layer.canvas.style.visibility = 'hidden'; },
  };
}
