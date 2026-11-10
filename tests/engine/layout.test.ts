import { describe, expect, it } from 'vitest';
import { areaOf, edgeDist, inPoly, layout, placeIn, placeLights, type Poly } from '../../src/engine';

const L_ROOM: Poly = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 6], [0, 6]];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('grid', () => {
  it('spreads lights evenly with half a spacing to the walls', () => {
    const ly = layout('grid', 4, 3, 6, 4.5, false, 0, 0);
    expect(ly.pts).toHaveLength(12);
    expect([ly.sx, ly.sy, ly.offx, ly.offy]).toEqual([1.5, 1.5, 0.75, 0.75]);
    expect(ly.pts[0]).toEqual([0.75, 0.75]);
    expect(ly.pts[11]).toEqual([5.25, 3.75]);
    expect(ly.labs.slice(0, 4)).toEqual(['A1', 'A2', 'A3', 'B1']);
  });

  it('with a set distance, keeps the spacing and centres the grid', () => {
    const ly = layout('grid', 5, 3, 7, 5, true, 1.2, 1.4);
    expect([ly.sx, ly.sy]).toEqual([1.2, 1.4]);
    expect(ly.offx).toBeCloseTo((7 - 4 * 1.2) / 2);
    expect(ly.offy).toBeCloseTo((5 - 2 * 1.4) / 2);
  });
});

describe('staggered and honeycomb', () => {
  it('staggered: alternate rows offset by half a spacing, one light fewer', () => {
    const ly = layout('stagger', 4, 3, 6, 4.5, false, 0, 0);
    expect(ly.pts).toHaveLength(4 + 3 + 4);
    const row2 = ly.pts.filter(p => Math.abs(p[1] - 2.25) < 1e-9).map(p => p[0]).sort((a, b) => a - b);
    expect(row2).toEqual([1.5, 3, 4.5]);
  });

  it('honeycomb: every light is the same distance from its neighbours', () => {
    const ly = layout('hex', 5, 4, 8, 6, false, 0, 0);
    expect(ly.sy).toBeCloseTo(ly.sx * Math.sqrt(3) / 2);
    const nn = ly.pts.map(p => Math.min(...ly.pts.filter(q => q !== p).map(q => dist(p, q))));
    nn.forEach(d => expect(d).toBeCloseTo(ly.sx));
  });
});

describe('perimeter', () => {
  it('keeps only the outer ring in a rectangle', () => {
    expect(layout('perim', 4, 3, 6, 4.5, false, 0, 0).pts).toHaveLength(10);
    expect(layout('perim', 5, 4, 8, 6, false, 0, 0).pts).toHaveLength(14);
  });

  it('follows the walls of a shaped room, half a spacing in', () => {
    const ly = placeLights('perim', 5, 4, 8, 6, false, 0, 0, L_ROOM);
    expect(ly.pts.length).toBeGreaterThan(0);
    const d = Math.min(ly.sx, ly.sy) / 2;
    ly.pts.forEach(p => {
      expect(inPoly(p[0], p[1], L_ROOM)).toBe(true);
      // d from the walls; up to √2·d at the inside corner of the L
      const e = edgeDist(p[0], p[1], L_ROOM);
      expect(e).toBeGreaterThanOrEqual(d - 1e-9);
      expect(e).toBeLessThanOrEqual(d * Math.SQRT2 + 1e-9);
    });
    expect(ly.pts.filter(p => Math.abs(edgeDist(p[0], p[1], L_ROOM) - d) < 1e-9).length).toBeGreaterThan(ly.pts.length / 2);
    expect(ly.labs[0]).toBe('P1');
  });
});

describe('clipping to the room shape', () => {
  it('a plain rectangle (shape = null) is not clipped', () => {
    expect(placeLights('grid', 4, 3, 8, 6, false, 0, 0, null).pts).toHaveLength(12);
  });

  it('drops lights in the cut-away part of an L, or too close to a wall', () => {
    const ly = placeLights('grid', 4, 4, 8, 6, false, 0, 0, L_ROOM);
    expect(ly.pts.length).toBeLessThan(16);
    ly.pts.forEach(p => { expect(inPoly(p[0], p[1], L_ROOM)).toBe(true); expect(edgeDist(p[0], p[1], L_ROOM)).toBeGreaterThanOrEqual(0.1); });
    expect(ly.labs).toHaveLength(ly.pts.length);
  });
});

describe('placement area', () => {
  it('lays the formation out inside the area, offset from the room corner', () => {
    const ly = placeIn('grid', 3, 1, 8, 6, false, 0, 0, null, { x: 2, y: 2, w: 4, h: 1.5 });
    expect(ly.pts.map(p => p.map(v => +v.toFixed(3)))).toEqual([[2.667, 2.75], [4, 2.75], [5.333, 2.75]]);
    expect(ly.offx).toBeCloseTo(2 + 4 / 6);
  });

  it('drops lights of the area that fall outside the room', () => {
    const ly = placeIn('grid', 4, 1, 6, 4, false, 0, 0, null, { x: 4, y: 1, w: 4, h: 1 });
    ly.pts.forEach(p => expect(p[0]).toBeLessThanOrEqual(6));
    expect(ly.pts).toHaveLength(2);
  });

  it('no area means the whole room', () => {
    expect(placeIn('grid', 4, 3, 6, 4.5, false, 0, 0, null, null)).toEqual(layout('grid', 4, 3, 6, 4.5, false, 0, 0));
  });

  it('areaOf reads the inputs and ignores an empty or switched-off area', () => {
    expect(areaOf(true, { ax: '1.5', ay: '', aw: '3', ah: '2.25' })).toEqual({ x: 1.5, y: 0, w: 3, h: 2.25 });
    expect(areaOf(false, { ax: 1, ay: 1, aw: 3, ah: 2 })).toBeNull();
    expect(areaOf(true, { ax: 1, ay: 1, aw: 0, ah: 2 })).toBeNull();
  });
});
