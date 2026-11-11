import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brandLabel, buildEntries } from '../src/library';
import { mountLibraryPicker } from '../src/ui/libraryPicker';

const txt = (n: string) => readFileSync(resolve(__dirname, 'fixtures', n), 'utf8');
const src = {
  '/library/erco/track-lights/b-spot.ldt': async () => txt('downlight-1plane.ldt'),
  '/library/iGuzzini/linear/a-laser.ies': async () => txt('downlight-1plane.ies'),
  '/library/erco/downlights/a-wash.ies': async () => txt('downlight-1plane.ies'),
  '/library/stray.ies': async () => '',
  '/library/erco/loose.ies': async () => txt('downlight-1plane.ies'),
};

describe('library entries', () => {
  it('derives brand and name from the path, sorted by brand then name, ignoring files outside a brand folder', () => {
    const e = buildEntries(src);
    expect(e.map(x => `${x.brand}/${x.type}/${x.name}`)).toEqual([
      'Erco/Downlights/a-wash', 'Erco/Other/loose', 'Erco/Track lights/b-spot', 'iGuzzini/Linear/a-laser']);
  });
  it('loads and parses either format on demand', async () => {
    const e = buildEntries(src);
    expect((await e[2].load()).watts).toBe(12);
    expect((await e[0].load()).flux).toBeGreaterThan(0);
  });
  it('brandLabel capitalises lowercase folders only', () => {
    expect(brandLabel('erco')).toBe('Erco');
    expect(brandLabel('iGuzzini')).toBe('iGuzzini');
    expect(brandLabel('luce_light')).toBe('Luce light');
  });
});

describe('library picker', () => {
  const col = (n: string) => [...document.querySelectorAll(`[data-col=${n}] button`)] as HTMLButtonElement[];
  const names = (n: string) => col(n).map(b => b.querySelector('span')!.textContent);
  it('drills down brand > type > fixture like a column view, and returns the parsed fixture on click', async () => {
    document.body.innerHTML = '<div id="h"></div>';
    let got = '';
    const p = mountLibraryPicker(document.getElementById('h')!, (ph, en) => { got = en.brand + ':' + ph.name; }, buildEntries(src));
    p.toggle();
    expect(p.isOpen()).toBe(true);
    expect(names('brand')).toEqual(['Erco', 'iGuzzini']);
    expect(col('type').length).toBe(0);            // no brand picked yet
    expect(col('fixture').length).toBe(4);         // everything until narrowed
    col('brand')[0].click();                       // Erco
    expect(names('type')).toEqual(['Downlights', 'Other', 'Track lights']);
    expect(col('fixture').length).toBe(3);
    col('type')[0].click();                        // Downlights
    expect(names('fixture')).toEqual(['a-wash']);
    col('type')[0].click();                        // click again clears the type
    expect(col('fixture').length).toBe(3);
    col('brand')[0].click();                       // click again clears the brand
    expect(col('fixture').length).toBe(4);
    const s = document.getElementById('libSearch') as HTMLInputElement;
    s.value = 'laser'; s.dispatchEvent(new Event('input'));
    expect(names('brand')).toEqual(['iGuzzini']);
    col('fixture')[0].click();
    await new Promise(r => setTimeout(r, 0));
    expect(got).toBe('iGuzzini:Test Downlight 30');
  });
  it('explains how to add files when the library is empty', () => {
    document.body.innerHTML = '<div id="h"></div>';
    mountLibraryPicker(document.getElementById('h')!, () => {}, []);
    expect(document.getElementById('h')!.textContent).toMatch(/library\/<brand>\/<type>/);
  });
});
