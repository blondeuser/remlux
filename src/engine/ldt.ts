// EULUMDAT (.ldt) parsing. Reduces the file to the same rotationally symmetric curve as parseIES,
// so the rest of the engine does not care which format a fixture came from.
import { parseIES, reducePlanes, type IesPhotometry } from './photometry';

/** Number of C-plane rows stored in the file for each symmetry indicator (Isym), given Mc. */
function storedPlanes(isym: number, mc: number): number {
  if (isym === 0) return mc;
  if (isym === 1) return 1;
  if (isym === 2 || isym === 3) return Math.floor(mc / 2) + 1;
  return Math.floor(mc / 4) + 1;
}

/**
 * Parse a EULUMDAT file. Intensities are cd per 1000 lm of lamp flux and are scaled by the total
 * lamp flux and the conversion factor. Tilt data is ignored. Throws an Error with a user-facing
 * message when the file can't be used.
 */
export function parseLDT(txt: string, file: string): IesPhotometry {
  // Blank lines are meaningful (empty text fields), so keep them while reading the header.
  const L = txt.split(/\r?\n/).map(s => s.trim());
  const bad = () => Error('The LDT file looks incomplete or damaged.');
  if (L.length < 30) throw bad();
  const num = (i: number) => { const x = parseFloat((L[i] ?? '').replace(',', '.')); if (isNaN(x)) throw bad(); return x; };
  const isym = num(2), mc = num(3), ng = num(5), conv = L[23] === '' ? 1 : num(23);
  if (![0, 1, 2, 3, 4].includes(isym)) throw Error('Unknown symmetry indicator in the LDT file.');
  if (!(ng >= 1) || !(mc >= 1)) throw bad();
  const nSets = Math.max(0, Math.round(num(25)));
  let flux = 0, watts = 0, i = 26;
  for (let s = 0; s < nSets; s++, i += 6) { flux += num(i + 2); watts += num(i + 5); }
  i += 10; // direct ratios for room indices k = 0.6 … 5
  const nc = storedPlanes(isym, mc);
  const N = L.slice(i).join(' ').split(/\s+/).filter(Boolean).map(s => parseFloat(s.replace(',', '.')));
  if (N.length < nc + ng + nc * ng || N.slice(0, nc + ng + nc * ng).some(isNaN)) throw bad();
  const hz = N.slice(0, nc), v = N.slice(nc, nc + ng), data = N.slice(nc + ng, nc + ng + nc * ng);
  if (!(flux > 0)) throw Error('The LDT file gives no lamp flux, so the intensities cannot be scaled.');
  const { c, flux: out, up } = reducePlanes(v, hz, data, conv * flux / 1000);
  return {
    name: L[8] || file.replace(/\.ldt$/i, ''), brand: L[0] || '', file, v, c,
    watts: watts > 0 ? watts : 0, flux: out, up,
  };
}

/** Parse an IES or LDT file, chosen by file extension and then by content. */
export function parsePhotometry(txt: string, file: string): IesPhotometry {
  const isIes = /\.ies$/i.test(file) ? true : /\.ldt$/i.test(file) ? false : /TILT\s*=/i.test(txt);
  return isIes ? parseIES(txt, file) : parseLDT(txt, file);
}
