// Fixture placement: formations in a box, clipped to the room shape or to a group's own area.
import { edgeDist, inPoly, insetPoly } from './geometry';
import type { Formation, Poly, Pt } from './types';

const HX = Math.sqrt(3) / 2;

export interface Layout {
  pts: Pt[];
  /** Label per light: column letter + row number (A1, B1…), or P1… along a shaped perimeter. */
  labs: string[];
  /** Centre-to-centre spacing along x and y. */
  sx: number;
  sy: number;
  /** Distance from the box edge to the first light along x and y. */
  offx: number;
  offy: number;
}

/** A rectangle inside the room, in metres from the top-left corner. */
export interface Area { x: number; y: number; w: number; h: number }

/**
 * Positions for a formation in an L × W box.
 * fixed = false spreads nx × ny evenly with half a spacing to the walls;
 * fixed = true uses dx / dy as centre-to-centre spacing, centred in the box.
 */
export function layout(fm: Formation, nx: number, ny: number, L: number, W: number, fixed: boolean, dx: number, dy: number): Layout {
  const st = fm === 'stagger' || fm === 'hex';
  let sx: number, sy: number;
  if (fm === 'hex') { sx = fixed ? dx : Math.min(L / nx, ny > 1 ? W / (ny * HX) : Infinity); sy = sx * HX; }
  else if (fixed) { sx = dx; sy = dy; }
  else { sx = L / nx; sy = W / ny; }
  const offx = (L - (nx - 1) * sx) / 2, offy = (W - (ny - 1) * sy) / 2, pts: Pt[] = [], labs: string[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (fm === 'perim' && !(i === 0 || i === nx - 1 || j === 0 || j === ny - 1)) continue;
    let x = offx + i * sx;
    // offset rows sit midway between the lights above, one fewer per row, so both ends stay symmetric
    if (st && j % 2 && nx > 1) { if (i === nx - 1) continue; x += sx / 2; }
    pts.push([x, offy + j * sy]);
    labs.push(String.fromCharCode(65 + i % 26) + (j + 1));
  }
  return { pts, labs, sx, sy, offx, offy };
}

/**
 * A formation over the whole room. shape = null means a plain L × W rectangle (no clipping);
 * otherwise lights outside the outline or within 0.1 m of a wall are dropped, and a
 * perimeter formation follows the walls instead.
 */
export function placeLights(fm: Formation, nx: number, ny: number, L: number, W: number, fixed: boolean, dx: number, dy: number, shape: Poly | null): Layout {
  const ly = layout(fm, nx, ny, L, W, fixed, dx, dy);
  if (!shape) return ly;
  if (fm === 'perim') {
    const s = ly.sx, Q = insetPoly(shape, Math.min(ly.sx, ly.sy) / 2), pts: Pt[] = [], labs: string[] = [];
    Q.forEach((a, i) => {
      const b = Q[(i + 1) % Q.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(len / s));
      for (let j = 0; j < k; j++) { pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); labs.push('P' + pts.length); }
    });
    return { ...ly, pts, labs };
  }
  const pts: Pt[] = [], labs: string[] = [];
  ly.pts.forEach((q, i) => { if (inPoly(q[0], q[1], shape) && edgeDist(q[0], q[1], shape) >= .1) { pts.push(q); labs.push(ly.labs[i]); } });
  return { ...ly, pts, labs };
}

/**
 * A formation either over the whole room (area = null) or inside a group's own rectangle.
 * Lights that end up outside the room box, or outside a shaped room, are dropped.
 */
export function placeIn(fm: Formation, nx: number, ny: number, L: number, W: number, fixed: boolean, dx: number, dy: number, shape: Poly | null, area: Area | null): Layout {
  if (!area) return placeLights(fm, nx, ny, L, W, fixed, dx, dy, shape);
  const ly = layout(fm, nx, ny, area.w, area.h, fixed, dx, dy), pts: Pt[] = [], labs: string[] = [];
  ly.pts.forEach((q, i) => {
    const x = q[0] + area.x, y = q[1] + area.y;
    if (x < 0 || y < 0 || x > L || y > W) return;
    if (shape && !(inPoly(x, y, shape) && edgeDist(x, y, shape) >= .1)) return;
    pts.push([x, y]); labs.push(ly.labs[i]);
  });
  return { ...ly, pts, labs, offx: ly.offx + area.x, offy: ly.offy + area.y };
}

type AreaInputs = { ax: string | number; ay: string | number; aw: string | number; ah: string | number };

/** The group's placement rectangle from its inputs, or null when off or empty. */
export const areaOf = (on: boolean, v: AreaInputs): Area | null =>
  on && +v.aw > 0 && +v.ah > 0 ? { x: +v.ax || 0, y: +v.ay || 0, w: +v.aw, h: +v.ah } : null;
