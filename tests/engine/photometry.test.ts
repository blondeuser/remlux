import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, deg, iesIntensity, parseIES, parseLDT, parsePhotometry, rad, type FixtureModel } from '../../src/engine';

const fixture = (name: string) => readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');

/** Total flux (lm) of an intensity curve: Φ = 2π ∫ I(γ) sin γ dγ over the lower hemisphere. */
function fluxOf(md: FixtureModel): number {
  let F = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) { const g = (i + .5) / N * Math.PI / 2; F += 2 * Math.PI * md.Iof(Math.cos(g)) * Math.sin(g) * (Math.PI / 2 / N); }
  return F;
}

describe('angle helpers', () => {
  it('converts degrees and radians', () => {
    expect(rad(180)).toBeCloseTo(Math.PI);
    expect(deg(Math.PI / 2)).toBeCloseTo(90);
  });
});

describe('generic cosⁿ beam', () => {
  for (const angle of [10, 24, 36, 60, 90, 120]) {
    it(`${angle}° beam: 50% at half the beam angle, 10% at the field edge, flux conserved`, () => {
      const md = buildModel({ phot: 'gen', ies: null, angle, lumens: 800 })!;
      const I0 = md.Iof(1);
      expect(md.ang).toBeCloseTo(angle, 6);
      expect(md.Iof(Math.cos(rad(angle / 2))) / I0).toBeCloseTo(0.5, 2);
      expect(md.Iof(Math.cos(md.gF)) / I0).toBeCloseTo(0.1, 2);
      expect(md.gF).toBeGreaterThan(md.th);
      // the distribution carries exactly the lumens put in (within the lookup-table error)
      expect(fluxOf(md) / 800).toBeCloseTo(1, 2);
      expect(md.up).toBe(0);
      expect(md.lm).toBe(800);
    });
  }

  it('scales linearly with lumens', () => {
    const a = buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 500 })!;
    const b = buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 1000 })!;
    expect(b.Iof(1) / a.Iof(1)).toBeCloseTo(2, 6);
  });

  it('rejects beam angles outside 5–120° and non-positive lumens', () => {
    expect(buildModel({ phot: 'gen', ies: null, angle: 4, lumens: 800 })).toBeNull();
    expect(buildModel({ phot: 'gen', ies: null, angle: 121, lumens: 800 })).toBeNull();
    expect(buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 0 })).toBeNull();
    expect(buildModel({ phot: 'gen', ies: null, angle: 36, lumens: NaN })).toBeNull();
  });
});

describe('IES parsing', () => {
  it('reads a single C-plane downlight', () => {
    const P = parseIES(fixture('downlight-1plane.ies'), 'downlight-1plane.ies');
    expect(P.name).toBe('Test Downlight 30');
    expect(P.watts).toBe(12);
    expect(P.v).toEqual([0, 15, 30, 45, 60, 75, 90]);
    expect(P.c).toEqual([800, 760, 600, 300, 80, 10, 0]);
    expect(P.up).toBe(0);
    expect(P.flux).toBeGreaterThan(0);
  });

  it('averages C-planes (trapezoid weights), applies multiplier × ballast factor, and finds upward light', () => {
    const P = parseIES(fixture('uplight-2planes.ies'), 'uplight-2planes.ies');
    expect(P.name).toBe('UP-2C');
    // planes 0° and 90° get equal weight; multiplier 2 × ballast factor 0.5 = 1
    expect(P.c).toEqual([200, 100, 50]);
    expect(P.watts).toBe(0);
    expect(P.up).toBeGreaterThan(0);
    expect(P.up).toBeLessThan(1);
  });

  it('falls back to the file name when the file has no luminaire name', () => {
    const txt = fixture('downlight-1plane.ies').replace(/\[LUMINAIRE\].*\n/, '');
    expect(parseIES(txt, 'My Light.IES').name).toBe('My Light');
  });

  it('interpolates intensity between measured angles and returns 0 outside them', () => {
    const P = parseIES(fixture('downlight-1plane.ies'), 'x.ies');
    expect(iesIntensity(P, 7.5)).toBeCloseTo(780);
    expect(iesIntensity(P, 37.5)).toBeCloseTo(450);
    expect(iesIntensity(P, 95)).toBe(0);
    expect(iesIntensity(P, -1)).toBe(0);
  });

  it('rejects files it cannot use, with a readable message', () => {
    expect(() => parseIES('hello', 'a.ies')).toThrow(/TILT/);
    expect(() => parseIES(fixture('downlight-1plane.ies').replace('1 1000 1 7 1 1 2', '1 1000 1 7 1 2 2'), 'b.ies')).toThrow(/Type B/);
    expect(() => parseIES(fixture('downlight-1plane.ies').replace('800 760 600 300 80 10 0', '800 760'), 'c.ies')).toThrow(/incomplete/);
    expect(() => parseIES(fixture('downlight-1plane.ies').replace('800 760 600 300 80 10 0', '0 0 0 0 0 0 0'), 'd.ies')).toThrow(/no downward/);
  });
});

describe('IES fixture model', () => {
  const ies = parseIES(fixture('downlight-1plane.ies'), 'downlight-1plane.ies');
  const md = buildModel({ phot: 'ies', ies, angle: 999, lumens: 1 })!;

  it('uses the file flux and curve, ignoring the on-screen angle and lumens', () => {
    expect(md.lm).toBeCloseTo(ies.flux);
    expect(md.Iof(1)).toBeCloseTo(800, 0);
    expect(fluxOf(md) / ies.flux).toBeCloseTo(1, 2);
  });

  it('finds the 50% and 10% edges on the curve', () => {
    // 50% of 800 = 400, between 30° (600) and 45° (300): 40°
    expect(deg(md.th)).toBeCloseTo(40, 0);
    // 10% of 800 = 80 is reached at 60°
    expect(deg(md.gF)).toBeCloseTo(60, 0);
    expect(md.ang).toBeCloseTo(80, 0);
  });

  it('falls back to the generic beam when IES is chosen but no file is loaded', () => {
    expect(buildModel({ phot: 'ies', ies: null, angle: 36, lumens: 800 })!.ang).toBeCloseTo(36);
  });
});

describe('LDT (EULUMDAT)', () => {
  it('gives the same curve, flux and watts as the matching IES file', () => {
    const ies = parseIES(fixture('downlight-1plane.ies'), 'a.ies');
    const ldt = parseLDT(fixture('downlight-1plane.ldt'), 'a.ldt');
    expect(ldt.v).toEqual(ies.v);
    ldt.c.forEach((x, i) => expect(x).toBeCloseTo(ies.c[i], 6));
    expect(ldt.flux).toBeCloseTo(ies.flux, 3);
    expect(ldt.watts).toBe(12);
    expect(ldt.brand).toBe('Test');
    expect(ldt.name).toBe('Test Downlight 30');
  });
  it('reads the manufacturer from an IES file', () => {
    expect(parseIES(fixture('downlight-1plane.ies'), 'a.ies').brand).toBe('Test');
  });
  it('parsePhotometry picks the parser from the extension, then the content', () => {
    expect(parsePhotometry(fixture('downlight-1plane.ldt'), 'x.ldt').watts).toBe(12);
    expect(parsePhotometry(fixture('downlight-1plane.ies'), 'x.txt').name).toBe('Test Downlight 30');
  });
  it('rejects a truncated file with a readable message', () => {
    expect(() => parseLDT('Test\n1\n1\n', 'x.ldt')).toThrow(/incomplete/);
  });
});
