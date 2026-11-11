// three.js content for the Spot on wall view: the wall carrying the lux / lighting image, a floor
// strip with a 0.5 m grid, the spot body, its beam cone and the 50% / 10% outlines on the wall.
// Unlit materials only (the wall image already holds the calculated light). Axes: see camera.ts.
import type * as THREE from 'three';
import { coneOnWall, spotDepth, type V3 } from '../spot3d';
import { toThree } from './camera';
import type { ThreeLib } from './layer';

export interface SpotSceneOptions {
  W: number;
  H: number;
  S: V3;
  aim: [number, number];
  th: number;
  gF: number;
  size: number;
  tex: HTMLCanvasElement;
  colors: { ink: string; mute: string; beam: string; panel: string; rule: string };
}

export function buildSpotScene(T: ThreeLib, o: SpotSceneOptions): THREE.Group {
  const { W, H, S, aim, colors: C } = o;
  const D = spotDepth(W, H, S);
  const c = [W / 2, D / 2, H / 2] as const;
  const P = (x: number, y: number, z: number) => toThree(x, y, z, c);
  const root = new T.Group();
  const v = (a: readonly number[]) => new T.Vector3(a[0], a[1], a[2]);
  const lineOf = (pts: number[], color: string, opacity = 1, loop = false, dashed = false) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    const m = dashed
      ? new T.LineDashedMaterial({ color, transparent: opacity < 1, opacity, dashSize: 0.06, gapSize: 0.05 })
      : new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const l = loop ? new T.LineLoop(g, m) : new T.Line(g, m);
    if (dashed) l.computeLineDistances();
    return l;
  };

  // wall (front shows the image, the back a plain panel) and its outline
  const tex = new T.CanvasTexture(o.tex);
  tex.colorSpace = T.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = T.LinearFilter;
  tex.magFilter = T.LinearFilter;
  const wallGeo = new T.PlaneGeometry(W, H);
  const front = new T.Mesh(wallGeo, new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
  front.position.set(...P(W / 2, 0, H / 2));
  const back = new T.Mesh(wallGeo, new T.MeshBasicMaterial({ color: C.panel, side: T.BackSide }));
  back.position.copy(front.position);
  root.add(front, back, lineOf([...P(0, 0, 0), ...P(W, 0, 0), ...P(W, 0, H), ...P(0, 0, H)], C.ink, 1, true));

  // floor strip + 0.5 m grid
  const floor = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshBasicMaterial({ color: C.mute, transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(...P(W / 2, D / 2, 0));
  const grid: number[] = [];
  for (let x = 0.5; x < W - 1e-6; x += 0.5) grid.push(...P(x, 0, 0.001), ...P(x, D, 0.001));
  for (let y = 0.5; y < D - 1e-6; y += 0.5) grid.push(...P(0, y, 0.001), ...P(W, y, 0.001));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(grid, 3));
  root.add(floor, new T.LineSegments(g, new T.LineBasicMaterial({ color: C.rule })),
    lineOf([...P(0, 0, 0.001), ...P(W, 0, 0.001), ...P(W, D, 0.001), ...P(0, D, 0.001)], C.mute, 0.7, true));

  // beam axis and spot body (three axes)
  const ax = (() => { const a = [aim[0] - S[0], -S[1], aim[1] - S[2]]; const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; })();
  const axT = v([ax[0], ax[2], ax[1]]); // app (x, y, z) -> three (x, z, y)
  const sp = v(P(S[0], S[1], S[2]));
  const orient = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), axT);
  const r = Math.max(0.02, o.size / 2), len = Math.max(0.05, o.size * 1.3);
  const body = new T.Mesh(new T.CylinderGeometry(r, r, len, 28), new T.MeshBasicMaterial({ color: C.panel }));
  body.quaternion.copy(orient);
  body.position.copy(sp).addScaledVector(axT, -len / 2);
  const edge = new T.LineSegments(new T.EdgesGeometry(body.geometry, 30), new T.LineBasicMaterial({ color: C.ink }));
  edge.quaternion.copy(body.quaternion); edge.position.copy(body.position);
  const lens = new T.Mesh(new T.CircleGeometry(r * 0.96, 28), new T.MeshBasicMaterial({ color: C.beam, side: T.DoubleSide }));
  lens.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), axT);
  lens.position.copy(sp).addScaledVector(axT, 0.002);
  root.add(body, edge, lens);

  // beam cone: apex at the spot, clipped by the wall plane
  const wallClip = new T.Plane(new T.Vector3(0, 0, 1), D / 2); // keep Z ≥ -D/2 (the side the spot is on)
  const tHit = ax[1] < -1e-3 ? S[1] / -ax[1] : 2;
  const Lc = tHit * 2.5;
  const coneGeo = new T.ConeGeometry(Math.tan(Math.min(o.th, 1.5)) * Lc, Lc, 48, 1, true);
  coneGeo.translate(0, -Lc / 2, 0); // apex at the origin, opening along -Y
  const cone = new T.Mesh(coneGeo, new T.MeshBasicMaterial({ color: C.beam, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false, clippingPlanes: [wallClip] }));
  cone.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), axT);
  cone.position.copy(sp);
  cone.renderOrder = 2;
  root.add(cone);

  // 50% / 10% outlines on the wall, clipped to the wall rectangle
  const rectClip = [new T.Plane(new T.Vector3(1, 0, 0), W / 2), new T.Plane(new T.Vector3(-1, 0, 0), W / 2), new T.Plane(new T.Vector3(0, 1, 0), H / 2), new T.Plane(new T.Vector3(0, -1, 0), H / 2)];
  const lim = 6 * Math.max(W, H, 1);
  const outline = (runs: [number, number][][], dashed: boolean) => {
    for (const run of runs) {
      if (run.length < 2) continue;
      const l = lineOf(run.flatMap(([x, z]) => P(x, 0.004, z)), '#ffffff', 0.9, false, dashed);
      (l.material as THREE.Material).clippingPlanes = rectClip;
      l.renderOrder = 3;
      root.add(l);
    }
  };
  outline(coneOnWall(S, aim, o.gF, lim), true);
  outline(coneOnWall(S, aim, o.th, lim), false);
  return root;
}
