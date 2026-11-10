import { describe, expect, it } from 'vitest';
import {
  buildModel, directIlluminance, illuminanceAt, rectPoly, sampleWorkPlane, wallScallops, wallZoneWidth, type IntensityFn, type Poly,
} from '../../src/engine';

const L_ROOM: Poly = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 6], [0, 6]];
const iso: IntensityFn = () => 1000; // 1000 cd in every direction: easy to check by hand

describe('point illuminance', () => {
  it('directly below: E = I / h²', () => {
    expect(illuminanceAt(iso, 2, 0)).toBeCloseTo(1000 / 4);
    expect(illuminanceAt(iso, 2.8, 0)).toBeCloseTo(1000 / 2.8 ** 2);
  });

  it('off-axis: E = I · cos³γ / h²', () => {
    // 45°: cos γ = 1/√2
    expect(illuminanceAt(iso, 2, 2)).toBeCloseTo(1000 * Math.SQRT1_2 ** 3 / 4);
  });

  it('a 36° 800 lm downlight at 2.8 m gives 241 lx below it', () => {
    const md = buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 800 })!;
    expect(Math.round(illuminanceAt(md.Iof, 2.8, 0))).toBe(241);
  });
});

describe('directIlluminance', () => {
  it('adds the light of every fixture', () => {
    const one = directIlluminance([[1, 1, iso]], 2, null), two = directIlluminance([[1, 1, iso], [3, 1, iso]], 2, null);
    expect(two(2, 1)).toBeCloseTo(2 * one(2, 1));
    expect(one(1, 1)).toBeCloseTo(250);
  });

  it('in a non-convex room, walls block light between the arms', () => {
    const E = directIlluminance([[7, 1, iso]], 2, L_ROOM);
    expect(E(2, 5)).toBe(0); // round the inside corner of the L
    expect(E(6, 2)).toBeGreaterThan(0);
    expect(directIlluminance([[7, 1, iso]], 2, null)(2, 5)).toBeGreaterThan(0); // no walls in a plain box
  });
});

describe('wall zone', () => {
  it('is never more than a quarter of the room, and never negative', () => {
    expect(wallZoneWidth(0.5, 6, 4)).toBe(0.5);
    expect(wallZoneWidth(2, 6, 4)).toBe(1);
    expect(wallZoneWidth(-1, 6, 4)).toBe(0);
    expect(wallZoneWidth(NaN, 6, 4)).toBe(0);
  });
});

describe('sampleWorkPlane', () => {
  it('a uniform field gives Ē = Emin = Emax and U₀ = 1', () => {
    const s = sampleWorkPlane(6, 4.5, null, 0.5, () => 300);
    expect([s.avg, s.min, s.max, s.peak, s.uniformity]).toEqual([300, 300, 300, 300, 1]);
    expect(s.cw).toBe(160);
    expect(s.ch).toBe(120);
  });

  it('leaves the wall zone out of the statistics but not out of the peak', () => {
    // bright strip along the left wall only
    const s = sampleWorkPlane(6, 4, null, 0.5, x => (x < 0.5 ? 1000 : 100));
    expect(s.avg).toBe(100);
    expect(s.max).toBe(100);
    expect(s.peak).toBe(1000);
    const inside = Array.from(s.INS).filter(v => v === 2).length;
    expect(s.cnt).toBe(inside);
    expect(inside / (s.cw * s.ch)).toBeCloseTo((5 * 3) / (6 * 4), 1);
  });

  it('marks cells outside a shaped room and never samples them', () => {
    const s = sampleWorkPlane(8, 6, L_ROOM, 0, (x, y) => { if (x > 4.05 && y > 3.05) throw Error('sampled outside'); return 50; });
    const outside = Array.from(s.INS).filter(v => v === 0).length / (s.cw * s.ch);
    expect(outside).toBeCloseTo(12 / 48, 1);
    expect(s.avg).toBe(50);
  });

  it('matches a rectangle given as a polygon', () => {
    const md = buildModel({ phot: 'gen', ies: null, angle: 60, lumens: 1000 })!;
    const lights = [[2, 2, md.Iof], [4, 2, md.Iof]] as const;
    const a = sampleWorkPlane(6, 4, null, 0, directIlluminance(lights, 2.5, null));
    const b = sampleWorkPlane(6, 4, rectPoly(6, 4), 0, directIlluminance(lights, 2.5, rectPoly(6, 4)));
    expect(b.avg).toBeCloseTo(a.avg, 3);
  });
});

describe('wallScallops', () => {
  const md = buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 800 })!;
  const w = wallScallops({ distance: 0.3, spacing: 1.2, count: 5, H: 2.8, Iof: md.Iof });

  it('places the lights along the wall with margins at both ends', () => {
    expect(w.ys).toHaveLength(5);
    expect(w.ys[1] - w.ys[0]).toBeCloseTo(1.2);
    expect(w.Wd).toBeCloseTo(4 * 1.2 + 2 * 0.9);
  });

  it('peaks at 405 lx and is symmetric about the middle light', () => {
    expect(Math.round(w.peak)).toBe(405);
    const row = Math.round(w.ch * 0.6) * w.cw;
    for (let i = 0; i < w.cw / 2; i++) expect(w.vals[row + i]).toBeCloseTo(w.vals[row + w.cw - 1 - i], 1);
  });

  it('gets no light at the ceiling line and more light lower down below each fixture', () => {
    expect(w.vals[0]).toBeLessThan(w.peak * 0.01);
  });
});
