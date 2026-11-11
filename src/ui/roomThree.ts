// The room's 3D view with the optional three.js renderer (see threeViewport.ts).
import { drawIso, type IsoOptions } from '../render/iso';
import { buildRoomScene } from '../render/three/roomScene';
import { createThreeViewport } from './threeViewport';

let vp: ReturnType<typeof createThreeViewport> | null = null;
let redraw: () => void = () => {};

/** Called once by the legacy script with its redraw function. */
export function initRoomThree(redrawRoom: () => void): void {
  redraw = redrawRoom;
  vp = createThreeViewport({
    id: 'room',
    button: document.getElementById('isoRender'),
    anchor: document.getElementById('iso') as HTMLCanvasElement | null,
    redraw: () => redraw(),
    onError: msg => { const c = document.getElementById('planCap'); if (c) c.textContent = msg; },
  });
  window.addEventListener('themechange', () => vp?.invalidate());
}

/** Draw the room's 3D view: canvas 2D alone, or labels on top of a three.js render. */
export function drawRoom3D(cv: HTMLCanvasElement, o: IsoOptions): void {
  const threeMode = !!vp?.active;
  const proj = drawIso(cv, { ...o, threeMode });
  if (threeMode) vp!.present(o.view, proj, o.width, o.height, T => buildRoomScene(T, o));
}

/** The heat map or the lights changed: the three.js floor texture and lights must be rebuilt. */
export const invalidateRoom3D = (): void => vp?.invalidate();
export const hideRoom3D = (): void => vp?.hide();
