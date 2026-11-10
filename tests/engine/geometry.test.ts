import { describe, expect, it } from 'vitest';
import {
  crosses, edgeDist, inPoly, insetPoly, inwardN, isConvex, isSimple, normalizePoly, polyArea, polyPerim, rectPoly, segDist, shapePreset, type Poly,
} from '../../src/engine';

const L_ROOM: Poly = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 6], [0, 6]]; // 8 × 6 box, top-right 4 × 3 cut away

describe('polygon measures', () => {
  it('area and perimeter of a rectangle and an L-shaped room', () => {
    expect(Math.abs(polyArea(rectPoly(6, 4.5)))).toBeCloseTo(27);
    expect(polyPerim(rectPoly(6, 4.5))).toBeCloseTo(21);
    expect(Math.abs(polyArea(L_ROOM))).toBeCloseTo(48 - 12);
    expect(polyPerim(L_ROOM)).toBeCloseTo(28);
  });

  it('area does not depend on winding direction', () => {
    expect(Math.abs(polyArea([...L_ROOM].reverse()))).toBeCloseTo(36);
  });
});

describe('inside / outside', () => {
  it('knows which points are in the L', () => {
    expect(inPoly(2, 2, L_ROOM)).toBe(true);
    expect(inPoly(6, 1.5, L_ROOM)).toBe(true);
    expect(inPoly(6, 4.5, L_ROOM)).toBe(false); // the cut-away corner
    expect(inPoly(-1, 1, L_ROOM)).toBe(false);
  });

  it('measures distance to the nearest wall', () => {
    expect(segDist(1, 1, 0, 0, 4, 0)).toBeCloseTo(1);
    expect(segDist(-3, 4, 0, 0, 4, 0)).toBeCloseTo(5); // beyond the segment end
    expect(edgeDist(2, 2, rectPoly(6, 4))).toBeCloseTo(2);
    expect(edgeDist(5, 2.5, L_ROOM)).toBeCloseTo(0.5); // the inner wall at y = 3
  });
});

describe('shape checks', () => {
  it('convexity', () => {
    expect(isConvex(rectPoly(5, 3))).toBe(true);
    expect(isConvex(L_ROOM)).toBe(false);
  });

  it('simple outline vs walls crossing (bow tie)', () => {
    expect(isSimple(L_ROOM)).toBe(true);
    expect(isSimple([[0, 0], [4, 4], [4, 0], [0, 4]])).toBe(false);
  });

  it('a wall blocks a line of sight across the inside corner of an L', () => {
    // from the right arm (7, 1) to the top arm (2, 5): the straight line leaves the room
    expect(crosses(7, 1, 2, 5, L_ROOM)).toBe(true);
    // exactly through the inside corner (4, 3) only touches it: not blocked
    expect(crosses(6, 1, 2, 5, L_ROOM)).toBe(false);
    expect(crosses(1, 1, 3, 5, L_ROOM)).toBe(false);
    expect(crosses(1, 1, 7, 2, L_ROOM)).toBe(false);
  });

  it('inward normals point into the room', () => {
    const r = rectPoly(4, 2);
    expect(inwardN(r, 0)).toEqual([expect.closeTo(0), expect.closeTo(1)]); // top wall → +y
    expect(inwardN(r, 1)).toEqual([expect.closeTo(-1), expect.closeTo(0)]); // right wall → −x
    expect(inwardN([...r].reverse(), 0)[0]).toBeCloseTo(0); // winding does not matter
  });
});

describe('insetPoly', () => {
  it('moves every wall of a rectangle inward', () => {
    const q = insetPoly(rectPoly(6, 4), 0.5);
    const xs = q.map(p => p[0]).sort((a, b) => a - b), ys = q.map(p => p[1]).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0.5); expect(xs[3]).toBeCloseTo(5.5);
    expect(ys[0]).toBeCloseTo(0.5); expect(ys[3]).toBeCloseTo(3.5);
    expect(Math.abs(polyArea(q))).toBeCloseTo(5 * 3);
  });

  it('insets an L-shape including its inside corner', () => {
    const q = insetPoly(L_ROOM, 0.5);
    expect(q).toHaveLength(6);
    expect(q).toContainEqual([expect.closeTo(3.5), expect.closeTo(2.5)]); // inside corner moves diagonally
    // every new corner is 0.5 m from the walls, except the inside one: √2 × 0.5 m from the corner it came from
    q.forEach(p => expect(edgeDist(p[0], p[1], L_ROOM)).toBeCloseTo(p[0] === 3.5 && p[1] === 2.5 ? 0.5 * Math.SQRT2 : 0.5));
  });
});

describe('shape presets', () => {
  it('builds L, T and U rooms inside the L × W box', () => {
    for (const k of ['L', 'T', 'U']) {
      const P = shapePreset(k, 10, 8)!;
      expect(isSimple(P)).toBe(true);
      expect(isConvex(P)).toBe(false);
      P.forEach(([x, y]) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(10); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(8); });
    }
    expect(Math.abs(polyArea(shapePreset('L', 10, 8)!))).toBeCloseTo(80 - 5 * 4);
    expect(shapePreset('rect', 10, 8)).toBeNull();
  });

  it('rounds corners to the centimetre', () => {
    expect(shapePreset('T', 7, 5)!.flat().every(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9)).toBe(true);
  });
});

describe('normalizePoly', () => {
  it('shifts the outline to start at 0,0 and reports the new overall size', () => {
    const n = normalizePoly([[1, 2], [5.5, 2], [5.5, 6], [1, 6]]);
    expect(n.P).toEqual([[0, 0], [4.5, 0], [4.5, 4], [0, 4]]);
    expect([n.x0, n.y0, n.L, n.W]).toEqual([1, 2, 4.5, 4]);
  });
});
