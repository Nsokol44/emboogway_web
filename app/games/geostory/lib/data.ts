import worldJson from "./data/world.json";
import baselineJson from "./data/baseline.json";

export interface CountryGeo {
  code: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
  lon: number;
  lat: number;
  adj: string[];
}

export interface CountryBase {
  gdp: number; // $ trillions
  pop: number; // millions
  mil: number; // $ billions / yr
  tech: number; // 0..100
  energy: number; // 0..100 endowment
  minerals: number; // 0..100
  food: number; // 0..100
  growth: number; // baseline %/yr
  receptivity: number; // 0..1 — GCEIA-style openness to outside influence
  stability: number; // 0..1
  major: boolean;
}

export const WORLD = worldJson as {
  width: number;
  height: number;
  hexR: number;
  hexW: number;
  hexV: number;
  hexX0: number;
  hexY0: number;
  hexes: [number, number, number][]; // [cx, cy, countryIndex]
  countries: CountryGeo[];
};
export const BASELINE = baselineJson as Record<string, CountryBase>;
export const COUNTRIES = WORLD.countries;
export const CODE_IDX = new Map(COUNTRIES.map((c, i) => [c.code, i]));
export const START_YEAR = 2026;
export const END_YEAR = 2100;

/** Great-circle distance in km between two country centroids. */
export function distanceKm(a: CountryGeo, b: CountryGeo): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Precomputed pairwise distances (index order = COUNTRIES order). */
export const DIST: Float32Array = (() => {
  const n = COUNTRIES.length;
  const m = new Float32Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = distanceKm(COUNTRIES[i], COUNTRIES[j]);
      m[i * n + j] = d;
      m[j * n + i] = d;
    }
  return m;
})();

export function fmtGdp(t: number): string {
  return t >= 1 ? `$${t.toFixed(2)}T` : `$${Math.round(t * 1000)}B`;
}
export function fmtPop(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)}B` : `${Math.round(m)}M`;
}
