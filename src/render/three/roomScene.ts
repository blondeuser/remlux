// three.js content for the room's 3D view: heat-map floor, translucent walls, ceiling outline and
// downlights with beam cones and floor circles. Unlit materials only: the app shows calculated
// direct light, so nothing here may add shading of its own. Scene axes: see camera.ts.
import type * as THREE from 'three';
import type { Pt } from '../../engine/types';
import type { IsoLight } from '../iso';
import { toThree } from './camera';
import type { ThreeLib } from './layer';

export interface RoomSceneOptions {
  L: number;
  W: number;
  H: number;
  poly: Pt[] | null;
  heat: HTMLCanvasElement;
  lights: IsoLight[];
  showBeams: boolean;
  ink: string;
  mute: string;
  beam: string;
}

export function buildRoomScene(T: ThreeLib, o: RoomSceneOptions): THREE.Group {
  const { L, W, H } = o;
  const room: Pt[] = o.poly && o.poly.length >= 3 ? o.poly : [[0, 0], [L, 0], [L, W], [0, W]];
  const c = [L / 2, W / 2, H / 2] as const;
  const P = (x: number, y: number, z: number) => toThree(x, y, z, c);
  const root = new T.Group();

  // floor: the heat map, one texture pixel per sample cell, bilinear like the 2D view
  const tex = new T.CanvasTexture(o.heat);
  tex.colorSpace = T.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = T.LinearFilter;
  tex.magFilter = T.LinearFilter;
  const tris = T.ShapeUtils.triangulateShape(room.map(([x, y]) => new T.Vector2(x, y)), []);
  const pos: number[] = [], uv: number[] = [];
  for (const [x, y] of room) { pos.push(...P(x, y, 0)); uv.push(x / L, 1 - y / W); }
  const floorGeo = new T.BufferGeometry();
  floorGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  floorGeo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  floorGeo.setIndex(tris.flat());
  root.add(new T.Mesh(floorGeo, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, toneMapped: false })));

  const line = (pts: number[], color: string, opacity: number, loop = false) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    const m = new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    return loop ? new T.LineLoop(g, m) : new T.LineSegments(g, m);
  };
  root.add(line(room.flatMap(([x, y]) => P(x, y, 0.002)), o.ink, 1, true));
  root.add(line(room.flatMap(([x, y]) => P(x, y, H)), o.mute, 0.8, true));

  // walls: translucent panels (no depth write, so the floor and lights behind them stay visible) + edges
  const wallPos: number[] = [], edges: number[] = [];
  room.forEach(([ax, ay], i) => {
    const [bx, by] = room[(i + 1) % room.length];
    const a0 = P(ax, ay, 0), b0 = P(bx, by, 0), b1 = P(bx, by, H), a1 = P(ax, ay, H);
    wallPos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    edges.push(...a0, ...a1);
  });
  const wallGeo = new T.BufferGeometry();
  wallGeo.setAttribute('position', new T.Float32BufferAttribute(wallPos, 3));
  const wall = new T.Mesh(wallGeo, new T.MeshBasicMaterial({ color: o.mute, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false }));
  wall.renderOrder = 2;
  root.add(wall, line(edges, o.mute, 0.45));

  // downlights: one instanced mesh per (colour, radius, on/off) so hundreds of lights stay a few draw calls
  const groups = new Map<string, IsoLight[]>();
  for (const l of o.lights) {
    const k = `${l.col}|${o.showBeams ? l.rB : 0}|${l.on}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
  const flat = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)); // disc facing up
  const lampGeo = new T.CylinderGeometry(0.06, 0.06, 0.02, 20);
  const coneGeo = new T.ConeGeometry(1, 1, 40, 1, true); // unit cone, apex up, scaled per light
  const discGeo = new T.CircleGeometry(1, 40);
  const dropPts: number[] = [];
  for (const [key, ls] of groups) {
    const [col, rBs, on] = key.split('|');
    const rB = +rBs, k = on === 'true' ? 1 : 0.35;
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, place: (l: IsoLight, i: number) => void, order: number) => {
      const im = new T.InstancedMesh(geo, mat, ls.length);
      ls.forEach((l, i) => { place(l, i); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false; // the cull sphere is the geometry's, not the instances'
      im.renderOrder = order;
      root.add(im);
    };
    const mat = (opacity: number, depthWrite = false) => new T.MeshBasicMaterial({ color: col, transparent: opacity < 1, opacity, side: T.DoubleSide, depthWrite });
    if (rB > 0) {
      inst(coneGeo, mat(k * 0.12), (l) => {
        const [x, y, z] = P(l.x, l.y, H / 2); m4.compose(ps.set(x, y, z), q.identity(), sc.set(rB, H, rB));
      }, 1);
      inst(discGeo, mat(k * 0.18), (l) => {
        const [x, y, z] = P(l.x, l.y, 0.003); m4.compose(ps.set(x, y, z), flat, sc.set(rB, rB, 1));
      }, 1);
      const ring: number[] = [];
      for (const l of ls) for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2, b = ((i + 1) / 48) * Math.PI * 2;
        ring.push(...P(l.x + rB * Math.cos(a), l.y + rB * Math.sin(a), 0.004), ...P(l.x + rB * Math.cos(b), l.y + rB * Math.sin(b), 0.004));
      }
      root.add(line(ring, col, k * 0.85));
    }
    inst(lampGeo, mat(1, true), (l) => {
      const [x, y, z] = P(l.x, l.y, H - 0.01); m4.compose(ps.set(x, y, z), q.identity(), sc.set(1, 1, 1));
    }, 3);
    for (const l of ls) dropPts.push(...P(l.x, l.y, H), ...P(l.x, l.y, 0));
  }
  root.add(line(dropPts, o.mute, 0.35));
  for (const l of o.lights) if (l.selected) {
    const s = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), new T.MeshBasicMaterial({ color: o.beam }));
    s.position.set(...P(l.x, l.y, H - 0.02));
    s.renderOrder = 4;
    root.add(s);
  }
  return root;
}
