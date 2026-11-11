import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { orthoParams, toThree } from '../src/render/three/camera';
import type { IsoView } from '../src/render/iso';

// the canvas-2D projection (same formulas as drawIso / drawSpot3D)
const RAD = Math.PI / 180;
function project2d(v: IsoView, s: number, ox: number, oy: number, c: [number, number, number], p: [number, number, number]) {
  const dx = p[0] - c[0], dy = p[1] - c[1], rz = p[2] - c[2];
  const rx = dx * Math.cos(v.yaw * RAD) - dy * Math.sin(v.yaw * RAD);
  const ry = dx * Math.sin(v.yaw * RAD) + dy * Math.cos(v.yaw * RAD);
  return [ox + rx * s, oy + (ry * Math.sin(v.pitch * RAD) - rz * Math.cos(v.pitch * RAD)) * s];
}

describe('three.js camera matches the canvas-2D projection', () => {
  const c: [number, number, number] = [2.5, 1.8, 1.4];
  const pts: [number, number, number][] = [[0, 0, 0], [5, 0, 2.8], [5, 3.6, 0], [1.2, 2.2, 2.8], [3.3, 0.4, 1.1]];
  for (const view of [
    { yaw: 45, pitch: 35.264, zoom: 0, panX: 0, panY: 0 },
    { yaw: -28, pitch: 16, zoom: 0, panX: 0, panY: 0 },
    { yaw: 200, pitch: 70, zoom: 0, panX: 0, panY: 0 },
    { yaw: 10, pitch: 90, zoom: 0, panX: 0, panY: 0 },
  ]) {
    it(`yaw ${view.yaw}, pitch ${view.pitch}, off-centre pan`, () => {
      const w = 700, h = 480, s = 87, ox = w / 2 + 31, oy = h / 2 - 17;
      const p = orthoParams(view, { s, ox, oy }, w, h);
      const cam = new THREE.OrthographicCamera(p.left, p.right, p.top, p.bottom, 0.1, 4000);
      cam.position.set(p.eye[0] * 1000, p.eye[1] * 1000, p.eye[2] * 1000);
      cam.up.set(...p.up);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      for (const pt of pts) {
        const n = new THREE.Vector3(...toThree(pt[0], pt[1], pt[2], c)).project(cam);
        const [sx, sy] = project2d(view, s, ox, oy, c, pt);
        expect((n.x + 1) / 2 * w).toBeCloseTo(sx, 4);
        expect((1 - n.y) / 2 * h).toBeCloseTo(sy, 4);
      }
    });
  }
});
