"use client";

/**
 * Hex-tile world map (Civilization-style).
 *
 * Land tiles were precomputed from the real country geometries
 * (scripts/build-geodata.mjs). Every layer colours tiles by country-level
 * state, so tiles are drawn as one compound path per country (fast), EXCEPT
 * during the ~2 years after an annexation, when the flipping country's
 * tiles are drawn individually and sweep to the new controller in order of
 * distance from the annexing power — border tiles first.
 */
import { useMemo } from "react";
import { COUNTRIES, WORLD } from "../lib/data";
import type { SimResult } from "../lib/engine";
import { powerColor, shade, techColor, type LayerId } from "../lib/scenarios";

/* ------------------------------------------------------------ hex geometry */
const R = WORLD.hexR;
const CORNERS: [number, number][] = Array.from({ length: 6 }, (_, k) => {
  const a = ((60 * k - 30) * Math.PI) / 180;
  return [R * Math.cos(a), R * Math.sin(a)];
});
function hexPath(x: number, y: number): string {
  let d = "";
  for (let k = 0; k < 6; k++) {
    d += `${k === 0 ? "M" : "L"}${(x + CORNERS[k][0]).toFixed(1)} ${(y + CORNERS[k][1]).toFixed(1)}`;
  }
  return d + "Z";
}

/** tiles grouped by country index */
export const HEXES_BY_COUNTRY: { x: number; y: number }[][] = (() => {
  const arr: { x: number; y: number }[][] = COUNTRIES.map(() => []);
  for (const [x, y, ci] of WORLD.hexes) arr[ci].push({ x, y });
  return arr;
})();

const COMPOUND_PATH: string[] = HEXES_BY_COUNTRY.map((hexes) => hexes.map((h) => hexPath(h.x, h.y)).join(""));

interface Flip { country: number; year: number; from: number; to: number }

function computeFlips(result: SimResult): Flip[] {
  const flips: Flip[] = [];
  for (let y = 1; y < result.years.length; y++) {
    for (let c = 0; c < COUNTRIES.length; c++) {
      const before = result.years[y - 1][c].c;
      const after = result.years[y][c].c;
      if (before !== after) flips.push({ country: c, year: y, from: before, to: after });
    }
  }
  return flips;
}

/* ------------------------------------------------------------------- fills */
function countryFill(result: SimResult, yearIdx: number, idx: number, layer: LayerId, leaderIdx: number): string {
  const snap = result.years[yearIdx][idx];
  if (layer === "tech") {
    return snap.c === idx ? techColor(snap.tech) : shade(techColor(snap.tech), 0.72);
  }
  const src = layer === "territory" ? snap.c : layer === "influence" ? snap.i : snap.e;
  const base = powerColor(COUNTRIES[src].code);
  if (layer === "territory") {
    if (src !== idx) return shade(base, 0.62); // held territory reads darker
    return src === leaderIdx ? shade(base, 1.14) : base; // the leader glows a touch brighter
  }
  // influence / economic: self-orbit countries are dimmed so foreign orbits pop
  return src === idx ? shade(base, 0.55) : shade(base, 0.96);
}

interface Props {
  result: SimResult;
  yearFloat: number;
  layer: LayerId;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  uid: string;
}

export default function WorldMap({ result, yearFloat, layer, selectedIdx, onSelect, uid }: Props) {
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const flips = useMemo(() => computeFlips(result), [result]);
  const leaderCode = result.leaders[yearIdx]?.[0]?.code;
  const leaderIdx = leaderCode ? COUNTRIES.findIndex((c) => c.code === leaderCode) : -1;

  const activeFlips = flips.filter((f) => yearFloat >= f.year && yearFloat < f.year + 2);

  return (
    <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className="block h-auto w-full" role="application" aria-label="World simulation map">
      <defs>
        <radialGradient id={`${uid}-ocean`} cx="50%" cy="42%" r="80%">
          <stop offset="0%" stopColor="#10395e" />
          <stop offset="55%" stopColor="#0a2745" />
          <stop offset="100%" stopColor="#051729" />
        </radialGradient>
        <pattern id={`${uid}-hexgrid`} width="14" height="24" patternUnits="userSpaceOnUse">
          <path d="M7 1 L13 4.5 V11.5 L7 15 L1 11.5 V4.5 Z M7 15 L13 18.5 V24 M7 15 L1 18.5 V24" fill="none" stroke="#7fb2e5" strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* deep ocean + faint hex texture */}
      <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${uid}-ocean)`} />
      <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${uid}-hexgrid)`} opacity="0.05" />

      {/* land tiles, one compound path per country */}
      {COUNTRIES.map((c, idx) => (
        <path
          key={c.code}
          d={COMPOUND_PATH[idx]}
          fill={countryFill(result, yearIdx, idx, layer, leaderIdx)}
          stroke="rgba(4,12,22,0.55)"
          strokeWidth="0.4"
          style={{ cursor: "pointer", transition: "fill 0.45s ease" }}
          onClick={() => onSelect(idx)}
        >
          <title>{c.name}</title>
        </path>
      ))}

      {/* annexation waves: flipping tiles sweep from the annexer's side */}
      {activeFlips.map((f) => {
        const hexes = HEXES_BY_COUNTRY[f.country];
        const ax = COUNTRIES[f.to].cx, ay = COUNTRIES[f.to].cy;
        let maxD = 1;
        const ds = hexes.map((h) => {
          const d = Math.hypot(h.x - ax, h.y - ay);
          if (d > maxD) maxD = d;
          return d;
        });
        const progress = (yearFloat - f.year) / 2; // 0..1 over two years
        const newFill = countryFill(result, yearIdx, f.country, layer, leaderIdx);
        const oldSnap = result.years[Math.max(0, f.year - 1)][f.country];
        const oldSrc = layer === "territory" ? oldSnap.c : layer === "influence" ? oldSnap.i : layer === "economic" ? oldSnap.e : f.country;
        const oldFill = layer === "tech" ? techColor(oldSnap.tech) : shade(powerColor(COUNTRIES[oldSrc].code), oldSrc === f.country ? 1 : 0.62);
        return (
          <g key={`${f.country}-${f.year}`} pointerEvents="none">
            {hexes.map((h, hi) => (
              <path key={hi} d={hexPath(h.x, h.y)} fill={ds[hi] / maxD <= progress ? newFill : oldFill} stroke="rgba(4,12,22,0.55)" strokeWidth="0.4" />
            ))}
          </g>
        );
      })}

      {/* country borders for definition */}
      {COUNTRIES.map((c) => (
        <path key={`b-${c.code}`} d={c.path} fill="none" stroke="rgba(190,220,255,0.10)" strokeWidth="0.5" pointerEvents="none" />
      ))}

      {/* leading power glow outline */}
      {leaderIdx >= 0 && (
        <>
          <path d={COUNTRIES[leaderIdx].path} fill="none" stroke="#f0c060" strokeWidth="4.5" opacity="0.22" pointerEvents="none" />
          <path d={COUNTRIES[leaderIdx].path} fill="none" stroke="#f0c060" strokeWidth="1.3" opacity="0.85" pointerEvents="none" />
        </>
      )}

      {/* selection outline */}
      {selectedIdx !== null && (
        <>
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#f7f0e3" strokeWidth="3.6" opacity="0.3" pointerEvents="none" />
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#f7f0e3" strokeWidth="1.4" pointerEvents="none" />
        </>
      )}

      {/* generous tap targets for small countries */}
      {COUNTRIES.map((c, idx) => (
        <circle key={`hit-${c.code}`} cx={c.cx} cy={c.cy} r="10" fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelect(idx)}>
          <title>{c.name}</title>
        </circle>
      ))}
    </svg>
  );
}
