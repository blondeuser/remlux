// The photometry files under library/, loaded lazily. The "share" build swaps this module for sources.empty.ts.
export const sources = import.meta.glob('/library/**/*.{ies,IES,ldt,LDT}', { query: '?raw', import: 'default' }) as
  Record<string, () => Promise<string>>;
