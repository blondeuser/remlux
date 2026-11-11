import { describe, expect, it } from 'vitest';
import { imageExtent, insideLength, planToPx, pxDist, pxToPlan, scaleError, scaleFromPoints } from '../../src/engine';

describe('calibration', () => {
  it('measures pixel distance', () => {
    expect(pxDist([0, 0], [3, 4])).toBe(5);
  });

  it('metres per pixel from two points and a real length', () => {
    expect(scaleFromPoints([100, 50], [500, 50], 4)).toBeCloseTo(0.01, 10);
    expect(scaleFromPoints([0, 0], [300, 400], 5)).toBeCloseTo(0.01, 10); // diagonal pick
  });

  it('rejects unusable input', () => {
    expect(scaleFromPoints([1, 1], [1, 1], 4)).toBeNull();
    expect(scaleFromPoints([0, 0], [10, 0], 0)).toBeNull();
    expect(scaleFromPoints([0, 0], [10, 0], NaN)).toBeNull();
    expect(scaleFromPoints([0, 0], [10, 0], -2)).toBeNull();
  });

  it('corrects printed dimensions to the inside face', () => {
    expect(insideLength(5, 'inside', 0.2)).toBe(5);
    expect(insideLength(5, 'centre', 0.2)).toBeCloseTo(4.8);
    expect(insideLength(5, 'outside', 0.2)).toBeCloseTo(4.6);
    expect(insideLength(5, 'outside', -1)).toBe(5); // negative thickness ignored
  });

  it('converts between pixels and plan metres both ways', () => {
    const mpp = 0.02, off: [number, number] = [-1, 2];
    const m = pxToPlan([100, 50], mpp, off);
    expect(m).toEqual([1, 3]);
    const p = planToPx(m, mpp, off);
    expect(p[0]).toBeCloseTo(100, 9);
    expect(p[1]).toBeCloseTo(50, 9);
  });

  it('reports the error of a second dimension against the scale', () => {
    // 400 px at 0.01 m/px = 4.00 m; label says 4.08 m -> image is 1.96 % short
    expect(scaleError([0, 0], [400, 0], 0.01, 4.08)).toBeCloseTo(4 / 4.08 - 1, 10);
    expect(scaleError([0, 0], [400, 0], 0.01, 4)).toBeCloseTo(0, 10);
    expect(scaleError([0, 0], [400, 0], 0, 4)).toBeNull();
  });

  it('gives the image extent in metres', () => {
    expect(imageExtent(1000, 500, 0.01)).toEqual({ w: 10, h: 5 });
  });
});

import { snapOrtho, tracedPoly } from '../../src/engine';
describe('tracing helpers', () => {
  it('snaps near-axis segments and leaves diagonals alone', () => {
    expect(snapOrtho([100, 100], [103, 400])).toEqual([100, 400]);
    expect(snapOrtho([100, 100], [500, 104])).toEqual([500, 100]);
    expect(snapOrtho([100, 100], [300, 250])).toEqual([300, 250]);
  });
  it('converts traced pixels to metres', () => {
    expect(tracedPoly([[100, 100], [900, 100], [900, 600]], 0.01)).toEqual([[1, 1], [9, 1], [9, 6]]);
  });
});
