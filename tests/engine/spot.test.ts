import { describe, expect, it } from 'vitest';
import { buildModel, illuminanceAt, pointIlluminance, rad, spotLuxAt, spotOnWall, type IntensityFn, type Vec3 } from '../../src/engine';

const iso: IntensityFn = c => (c > 0 ? 1000 : 0);
const gen = (angle: number, lumens: number) => buildModel({ phot: 'gen', ies: null, angle, lumens })!;

describe('pointIlluminance', () => {
  it('aimed straight down matches the downlight formula (E = I·cos³γ/h²)', () => {
    const md = gen(36, 800), S: Vec3 = [0, 0, 2.8], down: Vec3 = [0, 0, -1], up: Vec3 = [0, 0, 1];
    for (const r of [0, .5, 1.3, 3]) {
      expect(pointIlluminance(md.Iof, S, down, [r, 0, 0], up)).toBeCloseTo(illuminanceAt(md.Iof, 2.8, r), 6);
    }
  });

  it('square on to a wall: E = I0 / d², and doubling the distance quarters it', () => {
    const md = gen(24, 600), n = Math.log(.5) / Math.log(Math.cos(rad(12))), I0 = 600 * (n + 1) / (2 * Math.PI);
    const at = (d: number) => pointIlluminance(md.Iof, [1, d, 1.5], [0, -1, 0], [1, 0, 1.5], [0, 1, 0]);
    expect(at(2)).toBeCloseTo(I0 / 4, 0);
    expect(at(4) / at(2)).toBeCloseTo(.25, 3);
  });

  it('is zero behind the spot and behind the wall', () => {
    expect(pointIlluminance(iso, [0, 1, 0], [0, -1, 0], [0, 2, 0], [0, 1, 0])).toBe(0); // behind the beam
    expect(pointIlluminance(iso, [0, -1, 0], [0, 1, 0], [0, 0, 0], [0, 1, 0])).toBe(0); // light behind the wall
  });
});

describe('spotOnWall', () => {
  const md = gen(24, 600);
  const q = { wallW: 4, wallH: 2.8, pos: [2, 1, 2.7] as Vec3, aim: [2, 1.5] as [number, number], Iof: md.Iof, th: md.th, gF: md.gF };

  it('reports aim lux, throw and tilt', () => {
    const r = spotOnWall(q)!;
    expect(r.throw).toBeCloseTo(Math.hypot(1, 1.2), 6);
    expect(r.tilt).toBeCloseTo(90 - Math.atan2(1.2, 1) * 180 / Math.PI, 6); // 1.2 m down over 1 m out
    expect(r.atAim).toBeCloseTo(spotLuxAt(q, 2, 1.5), 6);
    expect(r.max).toBeGreaterThanOrEqual(r.atAim * .95);
  });

  it('beam footprint: square on, width = 2·d·tan(half-angle)', () => {
    const r = spotOnWall({ ...q, pos: [2, 2, 1.4], aim: [2, 1.4] }, 400)!;
    const want = 2 * 2 * Math.tan(md.th);
    expect(r.beam.w).toBeCloseTo(want, 1);
    expect(r.beam.h).toBeCloseTo(want, 1);
    expect(r.field.w).toBeGreaterThan(r.beam.w);
  });

  it('a tilted spot throws a taller, dimmer pool than a square-on one', () => {
    const flat = spotOnWall({ ...q, pos: [2, 1, 1.5], aim: [2, 1.5] })!, steep = spotOnWall(q)!;
    expect(steep.beam.h / steep.beam.w).toBeGreaterThan(1.2);
    expect(steep.atAim).toBeLessThan(flat.atAim);
  });

  it('rejects a spot on or behind the wall', () => {
    expect(spotOnWall({ ...q, pos: [2, 0, 2] })).toBeNull();
  });
});
