import { describe, expect, it } from 'vitest';
import { coneOnWall, drawSpot3D } from '../src/render/spot3d';

describe('coneOnWall (beam outline drawn in the 3D view)', () => {
  it('square on: a closed circle of radius d·tan(half-angle) around the aim point', () => {
    const runs = coneOnWall([2, 2, 1.5], [2, 1.5], 12 * Math.PI / 180, 50);
    expect(runs).toHaveLength(1);
    const r = 2 * Math.tan(12 * Math.PI / 180);
    for (const [x, z] of runs[0]) expect(Math.hypot(x - 2, z - 1.5)).toBeCloseTo(r, 6);
  });

  it('grazing beam: rays that never reach the wall are left out', () => {
    // aimed almost along the wall: part of a 60° cone points away from it
    const runs = coneOnWall([0, .3, 1], [4, 1], 30 * Math.PI / 180, 100);
    const n = runs.reduce((s, r) => s + r.length, 0);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(121);
  });
});

describe('drawSpot3D picking planes', () => {
  it('onPlaneY / onPlaneZ invert the projection for any camera', () => {
    const cv = document.createElement('canvas');
    const tex = document.createElement('canvas');
    tex.width = tex.height = 4;
    const base = { W: 4, H: 3, S: [2, 1.5, 2] as [number, number, number], aim: [2, 1.5] as [number, number], th: .2, gF: .4, size: .1, tex, peak: [2, 1.5] as [number, number], width: 600, height: 400, colors: { ink: '#000', mute: '#888', beam: '#fa0', panel: '#fff', rule: '#ccc' } };
    for (const view of [{ yaw: -28, pitch: 16, zoom: 0, panX: 0, panY: 0 }, { yaw: 120, pitch: 50, zoom: 0, panX: 0, panY: 0 }]) {
      const cam = drawSpot3D(cv, { ...base, view });
      const [sx, sy] = cam.S(1.3, 0.7, 0);
      const [x, y] = cam.onPlaneZ(sx, sy, 0);
      expect(x).toBeCloseTo(1.3, 6); expect(y).toBeCloseTo(0.7, 6);
      const [px, py] = cam.S(1.3, 0, 2.1);
      const [x2, z2] = cam.onPlaneY(px, py, 0);
      expect(x2).toBeCloseTo(1.3, 6); expect(z2).toBeCloseTo(2.1, 6);
    }
  });
});
