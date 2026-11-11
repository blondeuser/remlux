// Fixture library: every .ies / .ldt file under library/<brand>/<type>/ becomes an entry.
// Vite finds the files at build time (add a file, restart `npm run dev`) and loads each one only
// when it is picked, so a big library does not slow down startup.
import { parsePhotometry, type IesPhotometry } from '../engine';

export interface LibraryEntry {
  /** Path inside the project, e.g. /library/erco/quintessence.ldt. */
  id: string;
  /** Brand as written on the folder ("iGuzzini"); all-lowercase folder names get a capital. */
  brand: string;
  /** Lighting type from the sub folder ("Downlights", "Track lights"); 'Other' for files directly in the brand folder. */
  type: string;
  /** File name without extension. */
  name: string;
  /** File name with extension. */
  file: string;
  /** Fetch and parse the photometry. Rejects with a readable message when the file is unusable. */
  load: () => Promise<IesPhotometry>;
}

import { sources } from './sources';

/** "erco" -> "Erco", "iGuzzini" stays, "track-lights" -> "Track lights". */
export function brandLabel(folder: string): string {
  const s = folder.replace(/[-_]+/g, ' ').trim();
  return s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Turn a glob result into entries, sorted by brand and then name. Exported for tests. */
export function buildEntries(src: Record<string, () => Promise<string>>): LibraryEntry[] {
  return Object.keys(src).flatMap(id => {
    const parts = id.replace(/^\/library\//, '').split('/');
    if (parts.length < 2) return []; // files must sit in a brand folder
    const file = parts[parts.length - 1];
    return [{
      id, brand: brandLabel(parts[0]), type: parts.length > 2 ? brandLabel(parts[1]) : 'Other', file, name: file.replace(/\.(ies|ldt)$/i, ''),
      load: async () => parsePhotometry(await src[id](), file),
    }];
  }).sort((a, b) => a.brand.localeCompare(b.brand) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export const libraryEntries: LibraryEntry[] = buildEntries(sources);
