// Shared types for the REMLUX calculation engine.
// Units: metres for positions and heights, candela for intensity, lux for illuminance, lumens for flux.
// Plan coordinates: x along the room length, y along the width, origin at the top-left corner.

/** A point in plan, [x, y] in metres. */
export type Pt = [number, number];

/** A room outline in plan: corners in order around the room. */
export type Poly = Pt[];

/**
 * Luminous intensity (cd) as a function of cos γ, where γ is the angle from straight down.
 * cos γ = 1 is the beam axis; cos γ = 0 is horizontal.
 */
export type IntensityFn = (cosGamma: number) => number;

/** Layout pattern for a group of downlights. */
export type Formation = 'grid' | 'stagger' | 'hex' | 'perim';
