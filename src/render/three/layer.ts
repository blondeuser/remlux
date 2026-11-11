// A WebGL canvas that sits under a 2D canvas and shows the same scene through three.js.
// The camera is derived from the app's IsoView (see camera.ts), so orbit / pan / zoom, picking and
// the 2D overlay (labels, handles) keep working unchanged. Rendering is on demand, never a loop.
import type * as THREE from 'three';
import { orthoParams } from './camera';
import type { IsoProj, IsoView } from '../iso';

export type ThreeLib = typeof THREE;
let lib: Promise<ThreeLib> | null = null;
/** three.js is a separate chunk: it is fetched the first time a viewport switches to it. */
export const loadThree = (): Promise<ThreeLib> => (lib ??= import('three').catch(e => { lib = null; throw e; }));

/** Free the GPU resources of a subtree (geometries, materials and their textures). */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
      for (const v of Object.values(mat)) if ((v as THREE.Texture | undefined)?.isTexture) (v as THREE.Texture).dispose();
      mat.dispose();
    }
  });
}

export class ThreeLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private content: THREE.Object3D | null = null;
  private size = '';

  private constructor(readonly T: ThreeLib, private readonly anchor: HTMLCanvasElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'absolute', zIndex: '0', pointerEvents: 'none' });
    // throws when WebGL is unavailable: the caller stays on the 2D view
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = T.NoToneMapping; // the colours are already lux colours: show them as they are
    this.renderer.localClippingEnabled = true;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
    anchor.before(this.canvas);
    anchor.style.position = 'relative';
    anchor.style.zIndex = '1'; // the 2D canvas (labels, handles) stays on top
  }

  static async create(anchor: HTMLCanvasElement): Promise<ThreeLayer> {
    return new ThreeLayer(await loadThree(), anchor);
  }

  /** Replace the scene content (the previous one is disposed). */
  setContent(group: THREE.Object3D): void {
    if (this.content) { this.scene.remove(this.content); disposeTree(this.content); }
    this.content = group;
    this.scene.add(group);
  }

  get hasContent(): boolean { return !!this.content; }

  /** Draw one frame with the camera of the 2D view that was just drawn. */
  render(view: IsoView, proj: IsoProj, w: number, h: number): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${w}x${h}@${dpr}`;
    if (key !== this.size) { // resizing reallocates the drawing buffer: only when it changed
      this.size = key;
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
    }
    this.canvas.style.left = this.anchor.offsetLeft + 'px';
    this.canvas.style.top = this.anchor.offsetTop + 'px';
    const p = orthoParams(view, proj, w, h), c = this.camera;
    c.left = p.left; c.right = p.right; c.top = p.top; c.bottom = p.bottom;
    c.position.set(p.eye[0] * 1000, p.eye[1] * 1000, p.eye[2] * 1000);
    c.up.set(p.up[0], p.up[1], p.up[2]);
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
    this.renderer.render(this.scene, c);
  }

  dispose(): void {
    if (this.content) { this.scene.remove(this.content); disposeTree(this.content); this.content = null; }
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // browsers cap the number of live WebGL contexts
    this.canvas.remove();
    this.anchor.style.position = '';
    this.anchor.style.zIndex = '';
  }
}
