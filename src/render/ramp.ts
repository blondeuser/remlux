// False-colour lux scale, the same stops as the floor plan (`STOPS` / `ramp` in src/legacy/app.js).
// Fixed in both themes on purpose (see CLAUDE.md, Styling).
const STOPS: [number, [number, number, number]][] = [[0, [22, 22, 30]], [.35, [61, 89, 161]], [.7, [224, 175, 104]], [1, [255, 244, 220]]];

/** RGB for t in 0…1 (clamped). */
export function ramp(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (t - a) / (b - a);
      return ca.map((v, j) => Math.round(v + (cb[j] - v) * k)) as [number, number, number];
    }
  }
  return STOPS[3][1];
}

/** Approximate RGB (0…1) of a black body at `k` kelvin, normalised so the brightest channel is 1. */
export function kelvinRGB(k: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = [r, g, b].map(v => Math.max(0, Math.min(255, v)) / 255), m = Math.max(...c) || 1;
  return [c[0] / m, c[1] / m, c[2] / m];
}
