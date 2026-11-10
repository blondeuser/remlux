// Boots the whole app in jsdom with default inputs and checks the headline numbers.
// These are a regression guard while the legacy script is split into modules:
// if a refactor changes any of them, the maths changed, not just the code layout.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const text = (id: string) => (document.getElementById(id)?.textContent ?? '').replace(/\s+/g, ' ').trim();

beforeAll(async () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script'));
  // jsdom has no canvas; the app only needs these two calls
  HTMLCanvasElement.prototype.getContext = (() => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.scrollTo = () => {};
  localStorage.clear();
  await import('../src/legacy/app.js');
});

describe('REMLUX default room (6 × 4.5 × 2.8 m, 4 × 3 grid, 800 lm, 36°)', () => {
  it('shows the headline result', () => {
    expect(text('kpi')).toBe('330 lx avg · U 0.74 · 12 lights');
  });

  it('writes the expected spec summary lines', () => {
    const sum = (document.getElementById('sumTxt') as HTMLTextAreaElement).value;
    expect(sum).toContain('Room: 6 x 4.5 m, ceiling 2.8 m, calculated at 0 m above floor');
    expect(sum).toContain('Spread on plane: beam (50%) diameter 1.82 m, field (10%) diameter 3.52 m');
    expect(sum).toContain('Lux (direct light only): average 330, min 244, max 378, uniformity 0.74');
  });

  it('computes the wall scallop peak', () => {
    expect(text('wMax')).toBe('405 lx peak');
  });

  it('suggests a 4 × 3 grid for 300 lx', () => {
    document.getElementById('sugBtn')!.click();
    expect(text('sug')).toContain('4 × 3 grid (12 fixtures) gives about 332 lx');
  });
});
