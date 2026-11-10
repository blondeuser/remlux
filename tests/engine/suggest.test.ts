import { describe, expect, it } from 'vitest';
import { buildModel, SUGGEST_MIN_UNIFORMITY, suggestGrid, type Poly } from '../../src/engine';

const md = buildModel({ phot: 'gen', ies: null, angle: 36, lumens: 800 })!;
const base = { L: 6, W: 4.5, h: 2.8, target: 300, form: 'grid' as const, Iof: md.Iof, shape: null, wallZone: 0.5 };

describe('suggestGrid', () => {
  it('finds 4 × 3 for 300 lx in the default room', () => {
    const s = suggestGrid(base)!;
    expect([s.x, s.y, s.N]).toEqual([4, 3, 12]);
    expect(Math.round(s.avg)).toBe(332);
    expect([s.sx, s.sy]).toEqual([1.5, 1.5]);
  });

  it('always meets the target and the minimum uniformity', () => {
    for (const target of [100, 200, 400, 600]) for (const form of ['grid', 'stagger', 'hex'] as const) {
      const s = suggestGrid({ ...base, target, form });
      if (!s) continue;
      expect(s.avg).toBeGreaterThanOrEqual(target);
      expect(s.uni).toBeGreaterThanOrEqual(SUGGEST_MIN_UNIFORMITY);
    }
  });

  it('needs more fixtures for a higher target', () => {
    expect(suggestGrid({ ...base, target: 500 })!.N).toBeGreaterThan(suggestGrid({ ...base, target: 150 })!.N);
  });

  it('returns null when no layout up to 12 × 12 can reach the target', () => {
    expect(suggestGrid({ ...base, target: 100000 })).toBeNull();
  });

  it('works in a shaped room', () => {
    const L_ROOM: Poly = [[0, 0], [8, 0], [8, 3], [4, 3], [4, 6], [0, 6]];
    const s = suggestGrid({ ...base, L: 8, W: 6, target: 200, shape: L_ROOM })!;
    expect(s).not.toBeNull();
    expect(s.avg).toBeGreaterThanOrEqual(200);
  });
});
