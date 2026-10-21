"use client";

/**
 * Hex-tile world map (Civilization-style), dressed as a chart-room atlas:
 * deep-navy ocean with a real graticule, faint contour linework, a compass
 * rose, and gold reserved for emphasis — the leading power's glow and the
 * player's selection.
 *
 * Land tiles were precomputed from the real country geometries
 * (scripts/build-geodata.mjs). Every layer colours tiles by country-level
 * state, so tiles are drawn as one compound path per country (fast), EXCEPT
 * during the ~2 years after an annexation, when the flipping country's
 * tiles are drawn individually and sweep to the new controller in order of
 * distance from the annexing power — border tiles first.
 *
 * Framing: "world" shows the whole atlas plate; "region" glides the
 * viewBox to the protagonist's neighbourhood (and back) over ~0.45s.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, WORLD } from "../lib/data";
import type { SimResult } from "../lib/engine";
import { GRATICULE_OUTLINE, GRATICULE_PATH } from "../lib/graticule";
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

/* ----------------------------------------------------------------- framing */
export type Framing = "world" | "region";
interface Box { x: number; y: number; w: number; h: number }
const WORLD_BOX: Box = { x: 0, y: 0, w: WORLD.width, h: WORLD.height };
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function regionBox(idx: number): Box {
  const c = COUNTRIES[idx];
  const w = WORLD.width * 0.54;
  const h = (w * WORLD.height) / WORLD.width;
  return {
    x: clampN(c.cx - w / 2, 0, WORLD.width - w),
    y: clampN(c.cy - h / 2, 0, WORLD.height - h),
    w, h,
  };
}

/** small engraved compass rose, drawn in map coordinates */
function CompassRose({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const spikes = Array.from({ length: 8 }, (_, k) => {
    const a = (Math.PI / 4) * k - Math.PI / 2;
    const long = k % 2 === 0;
    const len = long ? r : r * 0.58;
    const wdt = long ? r * 0.16 : r * 0.11;
    const px = cx + Math.cos(a) * len, py = cy + Math.sin(a) * len;
    const bx = cx + Math.cos(a + Math.PI / 2) * wdt, by = cy + Math.sin(a + Math.PI / 2) * wdt;
    const bx2 = cx + Math.cos(a - Math.PI / 2) * wdt, by2 = cy + Math.sin(a - Math.PI / 2) * wdt;
    return <polygon key={k} points={`${bx},${by} ${px},${py} ${bx2},${by2}`} fill={long ? "rgba(240,192,96,0.85)" : "rgba(240,192,96,0.4)"} />;
  });
  return (
    <g pointerEvents="none" opacity="0.9">
      <circle cx={cx} cy={cy} r={r * 1.18} fill="rgba(4,16,30,0.55)" stroke="rgba(240,192,96,0.5)" strokeWidth={r * 0.045} />
      <circle cx={cx} cy={cy} r={r * 0.92} fill="none" stroke="rgba(240,192,96,0.3)" strokeWidth={r * 0.03} />
      {spikes}
      <circle cx={cx} cy={cy} r={r * 0.13} fill="#f0c060" />
      <text x={cx} y={cy - r * 1.38} textAnchor="middle" fontSize={r * 0.52} fill="#f0c060" fontFamily="'Bebas Neue', sans-serif" letterSpacing="0.08em">N</text>
    </g>
  );
}

interface Props {
  result: SimResult;
  yearFloat: number;
  layer: LayerId;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  uid: string;
  framing?: Framing;
  frameIdx?: number | null;
}

export default function WorldMap({ result, yearFloat, layer, selectedIdx, onSelect, uid, framing = "world", frameIdx = null }: Props) {
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const flips = useMemo(() => computeFlips(result), [result]);
  const leaderCode = result.leaders[yearIdx]?.[0]?.code;
  const leaderIdx = leaderCode ? COUNTRIES.findIndex((c) => c.code === leaderCode) : -1;

  const activeFlips = flips.filter((f) => yearFloat >= f.year && yearFloat < f.year + 2);

  /* animated viewBox (glide between world and region framing) */
  const [box, setBox] = useState<Box>(WORLD_BOX);
  const boxRef = useRef<Box>(WORLD_BOX);
  useEffect(() => {
    const target = framing === "region" && frameIdx !== null && frameIdx >= 0 ? regionBox(frameIdx) : WORLD_BOX;
    const from = { ...boxRef.current };
    if (from.x === target.x && from.y === target.y && from.w === target.w) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      const e = 1 - Math.pow(1 - t, 3);
      const b: Box = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        w: from.w + (target.w - from.w) * e,
        h: from.h + (target.h - from.h) * e,
      };
      boxRef.current = b;
      setBox(b);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [framing, frameIdx]);

  const compassR = box.w * 0.030;
  const compassX = box.x + box.w - compassR * 2.1;
  const compassY = box.y + compassR * 2.3;

  return (
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block h-auto w-full" role="application" aria-label="World simulation map">
      <defs>
        <radialGradient id={`${uid}-ocean`} cx="50%" cy="42%" r="80%">
          <stop offset="0%" stopColor="#0d2f52" />
          <stop offset="55%" stopColor="#081f38" />
          <stop offset="100%" stopColor="#040f1e" />
        </radialGradient>
        <pattern id={`${uid}-hexgrid`} width="14" height="24" patternUnits="userSpaceOnUse">
          <path d="M7 1 L13 4.5 V11.5 L7 15 L1 11.5 V4.5 Z M7 15 L13 18.5 V24 M7 15 L1 18.5 V24" fill="none" stroke="#8fb6dd" strokeWidth="0.5" />
        </pattern>
        <pattern id={`${uid}-contours`} width="190" height="150" patternUnits="userSpaceOnUse">
          <path d="M-20 40 C 40 15, 90 70, 150 45 S 230 30, 260 60" fill="none" stroke="#7fb0e0" strokeWidth="0.8" />
          <path d="M-20 75 C 45 50, 100 105, 160 80 S 235 65, 260 95" fill="none" stroke="#7fb0e0" strokeWidth="0.7" />
          <path d="M-20 112 C 50 90, 110 140, 175 115 S 240 105, 260 128" fill="none" stroke="#7fb0e0" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* deep-navy ocean, graticule, contour ghosts, faint hex texture */}
      <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${uid}-ocean)`} />
      <path d={GRATICULE_PATH} fill="none" stroke="rgba(150,190,230,0.055)" strokeWidth="0.7" pointerEvents="none" />
      <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${uid}-contours)`} opacity="0.05" pointerEvents="none" />
      <rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${uid}-hexgrid)`} opacity="0.04" pointerEvents="none" />
      <path d={GRATICULE_OUTLINE} fill="none" stroke="rgba(201,150,58,0.18)" strokeWidth="0.9" pointerEvents="none" />

      {/* land tiles, one compound path per country */}
      {COUNTRIES.map((c, idx) => (
        <path
          key={c.code}
          d={COMPOUND_PATH[idx]}
          fill={countryFill(result, yearIdx, idx, layer, leaderIdx)}
          stroke="rgba(3,10,20,0.55)"
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
              <path key={hi} d={hexPath(h.x, h.y)} fill={ds[hi] / maxD <= progress ? newFill : oldFill} stroke="rgba(3,10,20,0.55)" strokeWidth="0.4" />
            ))}
          </g>
        );
      })}

      {/* country borders for definition — aged parchment hairlines */}
      {COUNTRIES.map((c) => (
        <path key={`b-${c.code}`} d={c.path} fill="none" stroke="rgba(240,220,170,0.09)" strokeWidth="0.5" pointerEvents="none" />
      ))}

      {/* leading power glow outline — gold, the atlas's one loud colour */}
      {leaderIdx >= 0 && (
        <>
          <path d={COUNTRIES[leaderIdx].path} fill="none" stroke="#f0c060" strokeWidth="4.5" opacity="0.22" pointerEvents="none" />
          <path d={COUNTRIES[leaderIdx].path} fill="none" stroke="#f0c060" strokeWidth="1.3" opacity="0.85" pointerEvents="none" />
        </>
      )}

      {/* selection outline — bright gold over a soft halo */}
      {selectedIdx !== null && (
        <>
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#f0c060" strokeWidth="4" opacity="0.28" pointerEvents="none" />
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#ffd977" strokeWidth="1.5" pointerEvents="none" />
        </>
      )}

      <CompassRose cx={compassX} cy={compassY} r={compassR} />

      {/* generous tap targets for small countries */}
      {COUNTRIES.map((c, idx) => (
        <circle key={`hit-${c.code}`} cx={c.cx} cy={c.cy} r="10" fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelect(idx)}>
          <title>{c.name}</title>
        </circle>
      ))}
    </svg>
  );
}
