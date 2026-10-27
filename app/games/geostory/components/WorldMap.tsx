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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, WORLD, fmtGdp } from "../lib/data";
import type { SimResult } from "../lib/engine";
import { GRATICULE_OUTLINE, GRATICULE_PATH } from "../lib/graticule";
import { powerColor, shade, techColor, type LayerId } from "../lib/scenarios";
import { COUNTRY_WATERWAYS, DOMINANT_TERRAIN, TERRAIN_LABEL, TERRAIN_PALETTE, WATERWAY_HEXES, getTerrainPlateURL } from "../lib/terrain";
import WeatherOverlay from "./WeatherOverlay";

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

export const COMPOUND_PATH: string[] = HEXES_BY_COUNTRY.map((hexes) => hexes.map((h) => hexPath(h.x, h.y)).join(""));

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
export function countryFill(result: SimResult, yearIdx: number, idx: number, layer: LayerId, leaderIdx: number): string {
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

/** the director camera's shot: a tighter frame centred on the action.
 *  Clamped inside the plate, so the site stays in the middle band of the
 *  frame — the band a 9:16 crop keeps — wherever geography allows. */
function shotBox(idx: number): Box {
  const c = COUNTRIES[idx];
  const w = WORLD.width * 0.40;
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
  /** when set (compare mode), countries whose controller differs from this
      reference run at the current year get a pulsing cream outline */
  diffResult?: SimResult | null;
  /** pixel-art terrain plate under the political washes (default on) */
  terrainArt?: boolean;
  /** ambient weather overlay — the sky (default on) */
  weather?: boolean;
  /** P1b — when set, draw influence-flow arcs into this power from the
      countries it pulls hardest (thickness ∝ the engine's gravity value) */
  flowIdx?: number | null;
  /** the Idler's anchor — a persistent gold-dashed outline + pennant */
  claimIdx?: number | null;
  /** spectacle pulse at a major event's site (key re-triggers the ring) */
  pulse?: { idx: number; key: number } | null;
  /** the cinema director camera's current shot (overrides framing) */
  shot?: { idx: number; key: number } | null;
  /** cinema presentation: richer washes, slower camera glides */
  cinema?: boolean;
}

export default function WorldMap({ result, yearFloat, layer, selectedIdx, onSelect, uid, framing = "world", frameIdx = null, diffResult = null, terrainArt = true, weather = true, flowIdx = null, claimIdx = null, pulse = null, shot = null, cinema = false }: Props) {
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const flips = useMemo(() => computeFlips(result), [result]);
  const leaderCode = result.leaders[yearIdx]?.[0]?.code;
  const leaderIdx = leaderCode ? COUNTRIES.findIndex((c) => c.code === leaderCode) : -1;

  /* P1b influence flow: the selected power's strongest inbound pulls */
  const flowArcs = useMemo(() => {
    if (flowIdx === null || flowIdx < 0) return [];
    const row = result.attrib[yearIdx];
    if (!row) return [];
    const inbound: { c: number; iv: number }[] = [];
    for (let c = 0; c < COUNTRIES.length; c++) {
      if (c !== flowIdx && row[c].i === flowIdx) inbound.push({ c, iv: row[c].iv });
    }
    inbound.sort((a, b) => b.iv - a.iv);
    return inbound.slice(0, 10);
  }, [result, yearIdx, flowIdx]);

  /* compare-mode divergence: controller here vs controller in the reference sim */
  const diffIdxs = useMemo(() => {
    if (!diffResult) return null;
    const out: number[] = [];
    for (let i = 0; i < COUNTRIES.length; i++) {
      if (diffResult.years[yearIdx][i].c !== result.years[yearIdx][i].c) out.push(i);
    }
    return out;
  }, [diffResult, result, yearIdx]);

  /* hover tooltip (desktop): name + the layer's headline value, no click needed.
     Position is written straight to the DOM node so mousemove never re-renders
     the 175 paths; React state only tracks WHICH country is hovered. */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const positionTip = (e: React.MouseEvent) => {
    const tip = tipRef.current;
    const host = (e.currentTarget as Element).closest("svg")?.parentElement;
    if (!tip || !host) return;
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.style.transform = x > r.width * 0.68 ? "translate(calc(-100% - 14px), 14px)" : "translate(14px, 14px)";
  };
  const hoverSnap = hoverIdx !== null ? result.years[yearIdx][hoverIdx] : null;

  const activeFlips = flips.filter((f) => yearFloat >= f.year && yearFloat < f.year + 2);

  /* animated viewBox (glide between world and region framing; a cinema
     shot overrides both, and cinema moves take their time — a slow ease
     reads as a camera, a fast one as a jump cut) */
  const [box, setBox] = useState<Box>(WORLD_BOX);
  const boxRef = useRef<Box>(WORLD_BOX);
  useEffect(() => {
    const target = shot
      ? shotBox(shot.idx)
      : framing === "region" && frameIdx !== null && frameIdx >= 0 ? regionBox(frameIdx) : WORLD_BOX;
    const from = { ...boxRef.current };
    if (from.x === target.x && from.y === target.y && from.w === target.w) return;
    const duration = cinema ? 1200 : 450;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
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
  }, [framing, frameIdx, shot, cinema]);

  const compassR = box.w * 0.030;
  const compassX = box.x + box.w - compassR * 2.1;
  const compassY = box.y + compassR * 2.3;

  /* pixel-art terrain plate: drawn once (module cache), laid under the
     political fills, which turn into translucent washes over it */
  const [terrainUrl, setTerrainUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!terrainArt) return;
    let on = true;
    getTerrainPlateURL().then((u) => { if (on) setTerrainUrl(u); });
    return () => { on = false; };
  }, [terrainArt]);
  const showTerrain = terrainArt && terrainUrl !== null;
  /** fill opacity for the country washes: 1 = today's flat atlas;
      with terrain beneath, power reads as a wash and the ground shows.
      Cinema runs the washes richer so footage reads saturated. */
  const washOpacity = layer === "terrain" ? 0
    : !showTerrain ? 1
    : layer === "territory" ? (cinema ? 0.8 : 0.58)
    : layer === "tech" ? (cinema ? 0.78 : 0.6)
    : (cinema ? 0.8 : 0.62);

  /* the spectacle pulse lives ~1.7s per trigger, then clears itself */
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  useEffect(() => {
    if (!pulse) return;
    setPulseKey(pulse.key);
    const t = setTimeout(() => setPulseKey((k) => (k === pulse.key ? null : k)), 1700);
    return () => clearTimeout(t);
  }, [pulse]);
  const getBox = useCallback(() => boxRef.current, []);

  return (
    <div className="relative">
    <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="block h-auto w-full" role="application" aria-label="World simulation map"
      onMouseMove={positionTip} onMouseLeave={() => setHoverIdx(null)}>
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

      {/* the pixel-art terrain plate — ground truth under every wash */}
      {showTerrain && (
        <image href={terrainUrl} x={0} y={0} width={WORLD.width} height={WORLD.height}
          preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} pointerEvents="none" />
      )}

      {/* land tiles, one compound path per country */}
      {COUNTRIES.map((c, idx) => (
        <path
          key={c.code}
          d={COMPOUND_PATH[idx]}
          fill={countryFill(result, yearIdx, idx, layer, leaderIdx)}
          fillOpacity={washOpacity}
          stroke="rgba(3,10,20,0.55)"
          strokeWidth="0.4"
          style={{ cursor: "pointer", transition: "fill 0.45s ease, fill-opacity 0.45s ease" }}
          onClick={() => onSelect(idx)}
          onMouseOver={() => setHoverIdx(idx)}
        >
          <title>{c.name}</title>
        </path>
      ))}

      {/* annexation waves: flipping tiles sweep from the annexer's side */}
      {layer !== "terrain" && activeFlips.map((f) => {
        const hexes = HEXES_BY_COUNTRY[f.country];
        const ax = COUNTRIES[f.to].cx, ay = COUNTRIES[f.to].cy;
        let maxD = 1;
        const ds = hexes.map((h) => {
          const d = Math.hypot(h.x - ax, h.y - ay);
          if (d > maxD) maxD = d;
          return d;
        });
        const rawProgress = (yearFloat - f.year) / 2; // 0..1 over two years
        /* ease-out: the wave breaks quickly at the border, then settles
           across the interior — conquest ripples, it doesn't pop */
        const progress = 1 - Math.pow(1 - rawProgress, 2);
        const newFill = countryFill(result, yearIdx, f.country, layer, leaderIdx);
        const oldSnap = result.years[Math.max(0, f.year - 1)][f.country];
        const oldSrc = layer === "territory" ? oldSnap.c : layer === "influence" ? oldSnap.i : layer === "economic" ? oldSnap.e : f.country;
        const oldFill = layer === "tech" ? techColor(oldSnap.tech) : shade(powerColor(COUNTRIES[oldSrc].code), oldSrc === f.country ? 1 : 0.62);
        return (
          <g key={`${f.country}-${f.year}`} pointerEvents="none">
            {hexes.map((h, hi) => (
              <path key={hi} d={hexPath(h.x, h.y)} fill={ds[hi] / maxD <= progress ? newFill : oldFill} fillOpacity={washOpacity} stroke="rgba(3,10,20,0.55)" strokeWidth="0.4" />
            ))}
          </g>
        );
      })}

      {/* country borders for definition — aged parchment hairlines */}
      {COUNTRIES.map((c) => (
        <path key={`b-${c.code}`} d={c.path} fill="none" stroke="rgba(240,220,170,0.09)" strokeWidth="0.5" pointerEvents="none" />
      ))}

      {/* waterways — geography, not data: the widened seas, straits and
          canals are drawn ABOVE every wash as water insets, the way real
          maps cut water through land. A canal hex keeps a hairline border
          in its owner's colour so Egypt/Panama ownership still reads.
          Shown only with Terrain Art on — off restores the flat atlas. */}
      {terrainArt && (
        <g pointerEvents="none">
          {WATERWAY_HEXES.map((h) => (
            <g key={`ww-${h.i}`}>
              <path d={h.d} fill="#2f6d99" stroke="rgba(3,10,20,0.45)" strokeWidth="0.4" />
              <path d={h.d} fill="#478cb3" opacity="0.38" stroke="none"
                transform={`translate(${h.x} ${h.y - 0.5}) scale(0.7) translate(${-h.x} ${-h.y})`} />
              {h.code === "c" && h.locks.map(([x1, y1, x2, y2], li) => (
                <line key={li} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8f2fa" strokeWidth="0.5" opacity="0.92" />
              ))}
              {h.code === "c" && (
                <path d={h.d} fill="none" stroke={powerColor(COUNTRIES[h.ci].code)} strokeWidth="0.8" opacity="0.9" />
              )}
            </g>
          ))}
        </g>
      )}

      {/* P1b influence flow — soft gold arcs into the selected power from
          the countries in its orbit, thickness ∝ gravity pull */}
      {flowIdx !== null && flowIdx >= 0 && flowArcs.length > 0 && (
        <g pointerEvents="none">
          {flowArcs.map(({ c, iv }) => {
            const a = COUNTRIES[c], b = COUNTRIES[flowIdx];
            const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
            const dx = b.cx - a.cx, dy = b.cy - a.cy;
            const dist = Math.hypot(dx, dy) || 1;
            const lift = Math.min(46, dist * 0.22);
            const cxp = mx + (-dy / dist) * lift, cyp = my + (dx / dist) * lift;
            const maxIv = flowArcs[0].iv || 1;
            return (
              <g key={`flow-${c}`}>
                <path d={`M${a.cx} ${a.cy} Q${cxp.toFixed(1)} ${cyp.toFixed(1)} ${b.cx} ${b.cy}`}
                  fill="none" stroke={powerColor(COUNTRIES[flowIdx].code)}
                  strokeWidth={0.8 + (iv / maxIv) * 3} strokeLinecap="round" opacity={0.42 + 0.45 * (iv / maxIv)} />
                <circle cx={a.cx} cy={a.cy} r={1.6 + (iv / maxIv) * 1.8} fill={powerColor(COUNTRIES[flowIdx].code)} opacity="0.85" />
              </g>
            );
          })}
          <circle cx={COUNTRIES[flowIdx].cx} cy={COUNTRIES[flowIdx].cy} r="3.4" fill="none" stroke={powerColor(COUNTRIES[flowIdx].code)} strokeWidth="1.2" opacity="0.9" />
        </g>
      )}

      {/* compare-mode divergence: countries ruled by a different power here
          than in the reference sim get a pulsing cream dash */}
      {diffIdxs && diffIdxs.map((idx) => (
        <g key={`diff-${COUNTRIES[idx].code}`} pointerEvents="none">
          <path d={COUNTRIES[idx].path} fill="rgba(240,192,96,0.10)" stroke="none" />
          <path d={COUNTRIES[idx].path} fill="none" stroke="#f7f0e3" strokeWidth="1.7" strokeDasharray="6 3.5" className="gs-diff-outline" />
        </g>
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

      {/* the Idler's anchor — a dashed gold frontier and a small pennant,
          so a claimed nation can be followed at a glance (and on footage) */}
      {claimIdx !== null && claimIdx >= 0 && (
        <g pointerEvents="none">
          <path d={COUNTRIES[claimIdx].path} fill="none" stroke="#f0c060" strokeWidth="1.7" strokeDasharray="7 4" opacity="0.95" />
          <line x1={COUNTRIES[claimIdx].cx} y1={COUNTRIES[claimIdx].cy} x2={COUNTRIES[claimIdx].cx} y2={COUNTRIES[claimIdx].cy - 13} stroke="#f0c060" strokeWidth="1.3" />
          <polygon points={`${COUNTRIES[claimIdx].cx},${COUNTRIES[claimIdx].cy - 13} ${COUNTRIES[claimIdx].cx + 8},${COUNTRIES[claimIdx].cy - 10.4} ${COUNTRIES[claimIdx].cx},${COUNTRIES[claimIdx].cy - 7.8}`} fill="#f0c060" />
        </g>
      )}

      {/* spectacle: a major event's site rings outward — an eye-catcher
          that reads on footage without a word of text */}
      {pulse && pulseKey === pulse.key && (
        <g key={pulse.key} pointerEvents="none">
          <circle cx={COUNTRIES[pulse.idx].cx} cy={COUNTRIES[pulse.idx].cy} r="5" fill="none" stroke="#ffd977" strokeWidth="2.2">
            <animate attributeName="r" from="5" to="54" dur="1.5s" begin="0s" repeatCount="1" />
            <animate attributeName="opacity" from="0.95" to="0" dur="1.5s" begin="0s" repeatCount="1" />
          </circle>
          <circle cx={COUNTRIES[pulse.idx].cx} cy={COUNTRIES[pulse.idx].cy} r="4" fill="none" stroke="#f0c060" strokeWidth="1.6">
            <animate attributeName="r" from="4" to="38" dur="1.4s" begin="0.3s" repeatCount="1" />
            <animate attributeName="opacity" from="0.85" to="0" dur="1.4s" begin="0.3s" repeatCount="1" />
          </circle>
          <circle cx={COUNTRIES[pulse.idx].cx} cy={COUNTRIES[pulse.idx].cy} r="3.4" fill="#ffd977">
            <animate attributeName="opacity" from="0.95" to="0" dur="1.1s" begin="0s" repeatCount="1" />
          </circle>
        </g>
      )}

      <CompassRose cx={compassX} cy={compassY} r={compassR} />

      {/* generous tap targets for small countries */}
      {COUNTRIES.map((c, idx) => (
        <circle key={`hit-${c.code}`} cx={c.cx} cy={c.cy} r="10" fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelect(idx)} onMouseOver={() => setHoverIdx(idx)}>
          <title>{c.name}</title>
        </circle>
      ))}
    </svg>

    {/* screen-level emphasis on a major event — a breath of gold at the
        frame's edge, timed with the site ring inside the map */}
    {pulse && pulseKey === pulse.key && (
      <div key={`flash-${pulse.key}`} className="gs-flash pointer-events-none absolute inset-0 z-10" aria-hidden />
    )}

    {/* the sky — ambient weather above the washes, below the chrome */}
    {weather && <WeatherOverlay result={result} yearIdx={yearIdx} getBox={getBox} />}

    {/* hover tooltip — follows the cursor, positioned imperatively */}
    {hoverIdx !== null && hoverSnap && (
      <div ref={tipRef} className="pointer-events-none absolute left-0 top-0 z-20 min-w-[150px] rounded-md border px-2.5 py-1.5"
        style={{ background: "rgba(4,16,30,0.94)", borderColor: "rgba(240,192,96,0.5)", boxShadow: "0 8px 22px rgba(0,0,0,0.55)" }}
        aria-hidden>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: layer === "terrain" ? TERRAIN_PALETTE[DOMINANT_TERRAIN[hoverIdx]][1] : powerColor(COUNTRIES[hoverIdx].code) }} />
          <span className="text-xs font-semibold" style={{ color: "#f7f0e3" }}>{COUNTRIES[hoverIdx].name}</span>
        </div>
        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "#cdbfa5" }}>
          {layer === "territory" && (
            hoverSnap.c === hoverIdx
              ? <>Sovereign · power <strong style={{ color: "#f0c060" }}>{(hoverSnap.bloc > 0 ? hoverSnap.bloc : hoverSnap.pow).toFixed(0)}</strong></>
              : <>Held by <strong style={{ color: powerColor(COUNTRIES[hoverSnap.c].code) }}>{COUNTRIES[hoverSnap.c].name}</strong></>
          )}
          {layer === "influence" && (
            hoverSnap.i === hoverIdx
              ? <>Holds its own orbit</>
              : <>In the orbit of <strong style={{ color: powerColor(COUNTRIES[hoverSnap.i].code) }}>{COUNTRIES[hoverSnap.i].name}</strong></>
          )}
          {layer === "economic" && (
            hoverSnap.e === hoverIdx
              ? <>Dominates its own market</>
              : <>Market ruled by <strong style={{ color: powerColor(COUNTRIES[hoverSnap.e].code) }}>{COUNTRIES[hoverSnap.e].name}</strong></>
          )}
          {layer === "tech" && <>Technology <strong style={{ color: "#f0c060" }}>{hoverSnap.tech.toFixed(0)}</strong> / 100</>}
          {layer === "terrain" && <>Terrain: <strong style={{ color: "#f0c060" }}>{TERRAIN_LABEL[DOMINANT_TERRAIN[hoverIdx]]}</strong> heartland{(COUNTRY_WATERWAYS.get(hoverIdx) ?? []).length > 0 && <> · <strong style={{ color: "#9fd0ee" }}>{(COUNTRY_WATERWAYS.get(hoverIdx) ?? []).join(" · ")}</strong></>}</>}
          <span style={{ color: "#93a7bd" }}> · GDP {fmtGdp(hoverSnap.gdp)}</span>
        </div>
      </div>
    )}
    </div>
  );
}
