// Fixture library picker, laid out like Finder's column view: Brand | Lighting type | Fixture.
// Picking a brand lists its types, picking a type lists its fixtures, clicking a fixture loads it
// into the Fixture page. Click a selected brand or type again to clear it. The search box narrows all columns.
import { libraryEntries, type LibraryEntry } from '../library';
import type { IesPhotometry } from '../engine';

export interface LibraryPicker {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const ROW = 'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left';
const ON = ' bg-accent text-paper';
const OFF = ' hover:bg-raise';

/** Mount the picker into `host` (hidden until toggled). `onPick` gets the parsed photometry and its entry. */
export function mountLibraryPicker(
  host: HTMLElement,
  onPick: (ph: IesPhotometry, entry: LibraryEntry) => void,
  entries: LibraryEntry[] = libraryEntries,
  onToggle: () => void = () => {},
): LibraryPicker {
  let brand = '', type = '', query = '';
  host.hidden = true;
  host.className = 'mt-3';

  if (!entries.length) {
    host.append(el('p', 'note', 'The library is empty. Add .ies or .ldt files in library/<brand>/<type>/ (one folder per brand, one sub folder per lighting type, e.g. downlights, track-lights, linear) and restart the dev server.'));
  } else {
    const search = el('input'); search.id = 'libSearch'; search.type = 'text'; search.autocomplete = 'off';
    search.placeholder = 'e.g. quintessence'; search.setAttribute('aria-label', 'Search the library');
    const cols = el('div', 'mt-2 grid grid-cols-3 overflow-hidden rounded-md border border-rule');
    const column = (name: string, label: string) => {
      const c = el('div', 'max-h-64 min-w-0 overflow-y-auto border-r border-rule last:border-r-0');
      c.dataset.col = name; c.setAttribute('role', 'listbox'); c.setAttribute('aria-label', label);
      return c;
    };
    const cBrand = column('brand', 'Brand'), cType = column('type', 'Lighting type'), cFix = column('fixture', 'Fixture');
    cols.append(cBrand, cType, cFix);
    const msg = el('p', 'note'); msg.setAttribute('aria-live', 'polite');
    host.append(el('label', 'mt-0', 'Library'), search, cols, msg);

    const row = (text: string, selected: boolean, onclick: () => void, chevron: boolean, sub = '') => {
      const b = el('button', ROW + (selected ? ON : OFF)); b.type = 'button';
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(selected));
      b.append(el('span', 'truncate', text));
      if (sub) b.append(el('small', 'shrink-0 ' + (selected ? '' : 'text-mute'), sub));
      if (chevron) { const c = el('span', 'shrink-0', '›'); c.setAttribute('aria-hidden', 'true'); b.append(c); }
      b.onclick = onclick;
      return b;
    };
    const hint = (t: string) => el('p', 'note px-2.5', t);

    const draw = () => {
      const q = query.trim().toLowerCase();
      const found = entries.filter(e => (e.brand + ' ' + e.type + ' ' + e.name).toLowerCase().includes(q));
      const brands = [...new Set(found.map(e => e.brand))];
      if (brand && !brands.includes(brand)) { brand = ''; type = ''; }
      const types = brand ? [...new Set(found.filter(e => e.brand === brand).map(e => e.type))] : [];
      if (type && !types.includes(type)) type = '';
      const fixtures = found.filter(e => (!brand || e.brand === brand) && (!type || e.type === type));

      cBrand.replaceChildren(...brands.map(b => row(b, b === brand, () => { brand = b === brand ? '' : b; type = ''; draw(); }, true)));
      if (!brands.length) cBrand.append(hint('No match.'));
      cType.replaceChildren(...types.map(t => row(t, t === type, () => { type = t === type ? '' : t; draw(); }, true)));
      if (!brand) cType.append(hint('Pick a brand.'));
      cFix.replaceChildren(...fixtures.map(e => row(e.name, false, async () => {
        msg.textContent = 'Loading…';
        try { const ph = await e.load(); msg.textContent = ''; onPick(ph, e); }
        catch (err) { msg.replaceChildren(el('span', 'err', (err as Error).message)); }
      }, false, brand ? (type ? '' : e.type) : e.brand)));
      if (!fixtures.length) cFix.append(hint('No fixture matches.'));
    };
    search.oninput = () => { query = search.value; draw(); };
    draw();
  }

  return {
    toggle() { host.hidden = !host.hidden; onToggle(); if (!host.hidden) host.querySelector<HTMLInputElement>('input')?.focus(); },
    close() { if (!host.hidden) { host.hidden = true; onToggle(); } },
    isOpen: () => !host.hidden,
  };
}
