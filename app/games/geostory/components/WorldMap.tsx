"use client";

/**
 * Hex-tile world map (Civilization-style), dressed as a chart-room atlas:
 * deep-navy ocean with a real graticule and faint contour linework.
 *
 * Highlight language (playtest-settled, do not muddy it):
 * - CYAN (#22d3ee) means exactly one thing — the player's claim: a
 *   persistent outline tracing the claim's CURRENT borders (homeland +
 *   everything it currently holds), a pennant on the homeland, and a
 *   slight cyan lift in its territory fill.
 * - GOLD is transient only: the player's selection and hover.
 * - The leading power gets NO map outline at all (it is crowned in the
 *   standings, not on the atlas) — a gold #1 outline read as "owned".
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
import { COUNTRIES, WORLD, fmtGdp, START_YEAR } from "../lib/data";
import type { SimResult } from "../lib/engine";
import { GRATICULE_OUTLINE, GRATICULE_PATH } from "../lib/graticule";
import { powerColor, shade, techColor, type LayerId } from "../lib/scenarios";
import { FAITHS } from "../lib/religion";
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
/** the claim's colour — cyan means "mine", everywhere in the app */
export const CLAIM_HEX = "#22d3ee";

function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-f]{6})$/i.exec(a);
  const pb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!pa || !pb) return a;
  const ca = parseInt(pa[1], 16), cb = parseInt(pb[1], 16);
  const r = Math.round(((ca >> 16) & 255) * (1 - t) + ((cb >> 16) & 255) * t);
  const g = Math.round(((ca >> 8) & 255) * (1 - t) + ((cb >> 8) & 255) * t);
  const bl = Math.round((ca & 255) * (1 - t) + (cb & 255) * t);
  return `rgb(${r} ${g} ${bl})`;
}

export function countryFill(result: SimResult, yearIdx: number, idx: number, layer: LayerId, claimIdx: number = -1): string {
  const snap = result.years[yearIdx][idx];
  if (layer === "religion") {
    // dominant faith enamel; held territory reads darker, as with territory
    const base = FAITHS[snap.f]?.color ?? "#8a93a3";
    return snap.c === idx ? base : shade(base, 0.68);
  }
  if (layer === "tech") {
    return snap.c === idx ? techColor(snap.tech) : shade(techColor(snap.tech), 0.72);
  }
  const src = layer === "territory" ? snap.c : layer === "influence" ? snap.i : snap.e;
  const base = powerColor(COUNTRIES[src].code);
  if (layer === "territory") {
    // the claim's land gets a slight cyan lift so it is findable at
    // full-world zoom; held territory otherwise reads darker
    if (claimIdx >= 0 && snap.c === claimIdx) return mixHex(base, CLAIM_HEX, src === idx ? 0.14 : 0.20);
    if (src !== idx) return shade(base, 0.62);
    return base;
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

/* ------------------------------------------------------- war spectacle */
/** a parsed war: an annexation event whose text names both actors
 *  ("X takes control of Y …"). Presentation only — the pair comes from
 *  the chronicle's own words; an event without a parseable pair gets a
 *  site pulse from the major-event machinery, never an invented arc. */
export interface WarBeat { year: number; atk: number; tgt: number; key: string }
const NAME_IDX = COUNTRIES.map((c, i) => ({ name: c.name, i })).sort((a, b) => b.name.length - a.name.length);
export function parseWars(result: SimResult): WarBeat[] {
  const out: WarBeat[] = [];
  for (const e of result.events) {
    if (e.kind !== "annex") continue;
    const atk = NAME_IDX.find((x) => e.text.startsWith(`${x.name} takes control of `));
    if (!atk) continue;
    const rest = e.text.slice(atk.name.length + " takes control of ".length);
    const tgt = NAME_IDX.find((x) => rest.startsWith(x.name));
    if (!tgt || tgt.i === atk.i) continue;
    out.push({ year: e.year, atk: atk.i, tgt: tgt.i, key: `${e.year}:${atk.i}:${tgt.i}` });
  }
  return out;
}

function arcPath(a: { cx: number; cy: number }, b: { cx: number; cy: number }): string {
  const d = Math.max(1, Math.hypot(b.cx - a.cx, b.cy - a.cy));
  const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
  return `M${a.cx} ${a.cy} Q${mx.toFixed(1)} ${(my - (d * 0.24 + 8)).toFixed(1)} ${b.cx} ${b.cy}`;
}

function orbitPath(c: { cx: number; cy: number }, r: number): string {
  return `M${c.cx - r} ${c.cy} A${r} ${(r * 0.42).toFixed(1)} 0 1 1 ${c.cx + r} ${c.cy} A${r} ${(r * 0.42).toFixed(1)} 0 1 1 ${c.cx - r} ${c.cy}`;
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
  /** the Idler's anchor — a persistent CYAN outline of its current
      borders + pennant (gold is selection/hover only) */
  claimIdx?: number | null;
  /** spectacle pulse at a major event's site (key re-triggers the ring) */
  pulse?: { idx: number; key: number } | null;
  /** notification markers — small boxes over the countries the live
      inbox concerns (anchor items in cyan, the rest in gold) */
  markers?: { idx: number; key: string; anchor: boolean }[] | null;
  /** war spectacle (missile arcs, drones, flashes) — the ANIMATIONS
      toggle; reduced-motion visitors get impact pulses only */
  animations?: boolean;
  /** the cinema director camera's current shot (overrides framing) */
  shot?: { idx: number; key: number } | null;
  /** cinema presentation: richer washes, slower camera glides */
  cinema?: boolean;
}

export default function WorldMap({ result, yearFloat, layer, selectedIdx, onSelect, uid, framing = "world", frameIdx = null, diffResult = null, terrainArt = true, weather = true, flowIdx = null, claimIdx = null, pulse = null, shot = null, cinema = false, markers = null, animations = true }: Props) {
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const flips = useMemo(() => computeFlips(result), [result]);

  /* the claim's CURRENT territory — the cyan outline follows the
     frontier as it moves, not just the homeland's borders */
  const claimTerritory = useMemo(() => {
    if (claimIdx === null || claimIdx < 0) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < COUNTRIES.length; i++) if (result.years[yearIdx][i].c === claimIdx) out.push(i);
    return out;
  }, [result, yearIdx, claimIdx]);

  /* war spectacle state: parsed wars + the reduced-motion preference */
  const wars = useMemo(() => parseWars(result), [result]);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const on = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const calFloat = START_YEAR + yearFloat;
  const activeWars = animations
    ? wars.filter((w) => calFloat >= w.year && calFloat < w.year + 1.6).sort((a, b) => b.year - a.year)
    : [];

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
          fill={countryFill(result, yearIdx, idx, layer, claimIdx ?? -1)}
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
      {layer !== "terrain" && layer !== "religion" && activeFlips.map((f) => {
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
        const newFill = countryFill(result, yearIdx, f.country, layer, claimIdx ?? -1);
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

      {/* selection outline — bright gold over a soft halo */}
      {selectedIdx !== null && (
        <>
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#f0c060" strokeWidth="4" opacity="0.28" pointerEvents="none" />
          <path d={COUNTRIES[selectedIdx].path} fill="none" stroke="#ffd977" strokeWidth="1.5" pointerEvents="none" />
        </>
      )}

      {/* the Idler's anchor — CYAN, the claim's alone: a persistent
          outline tracing its CURRENT borders (every country it holds,
          redrawn as the frontier moves), a soft halo, and the pennant
          on the homeland. Drawn over everything, in every layer, in
          normal view and cinema alike — "cyan = mine" is learned once */}
      {claimIdx !== null && claimIdx >= 0 && (
        <g pointerEvents="none">
          <path d={COUNTRIES[claimIdx].path} fill="none" stroke={CLAIM_HEX} strokeWidth="4.4" opacity="0.20" />
          {claimTerritory.map((idx) => (
            <path key={`claim-${COUNTRIES[idx].code}`} d={COUNTRIES[idx].path} fill="none" stroke={CLAIM_HEX} strokeWidth={idx === claimIdx ? 1.9 : 1.4} opacity="0.95" />
          ))}
          <line x1={COUNTRIES[claimIdx].cx} y1={COUNTRIES[claimIdx].cy} x2={COUNTRIES[claimIdx].cx} y2={COUNTRIES[claimIdx].cy - 13} stroke={CLAIM_HEX} strokeWidth="1.3" />
          <polygon points={`${COUNTRIES[claimIdx].cx},${COUNTRIES[claimIdx].cy - 13} ${COUNTRIES[claimIdx].cx + 8},${COUNTRIES[claimIdx].cy - 10.4} ${COUNTRIES[claimIdx].cx},${COUNTRIES[claimIdx].cy - 7.8}`} fill={CLAIM_HEX} />
        </g>
      )}

      {/* ── war spectacle (presentation only; the ANIMATIONS toggle and
          the spectacle budget live here): missile arcs from the
          attacker's land to the target's, an impact burst on arrival,
          a drone working the contested country while its war year is
          live, and its border flashing hot. Budget: at most 2 wars get
          arcs (6 arcs + 6 heads), 2 impact bursts, 2 drones, 3 border
          flashes — ~21 live elements, under the 24 cap; older beats
          drop first. Reduced motion: impact bursts only. ── */}
      {activeWars.length > 0 && (
        <g pointerEvents="none">
          {activeWars.slice(0, 3).map((w) => (
            <path key={`flash-${w.key}`} d={COUNTRIES[w.tgt].path} fill="none" stroke="#ff5a3c" strokeWidth="2" opacity={reducedMotion ? 0.45 : undefined}>
              {!reducedMotion && <animate attributeName="opacity" values="0.9;0.25;0.9" dur="1.1s" repeatCount="indefinite" />}
            </path>
          ))}
          {!reducedMotion && activeWars.slice(0, 2).map((w) => {
            const a = COUNTRIES[w.atk], b = COUNTRIES[w.tgt];
            const d = arcPath(a, b);
            return [0, 1, 2].map((k) => {
              const begin = (k * 0.28).toFixed(2);
              return (
                <g key={`arc-${w.key}-${k}`}>
                  <path d={d} fill="none" stroke="#ffb03a" strokeWidth="1.5" strokeDasharray="7 6" opacity="0">
                    <animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.15;0.8;1" dur="1.15s" begin={`${begin}s`} repeatCount="1" />
                    <animate attributeName="stroke-dashoffset" from="52" to="0" dur="1.15s" begin={`${begin}s`} repeatCount="1" />
                  </path>
                  <circle r="2.7" fill="#ffd977" opacity="0">
                    <animateMotion dur="0.95s" begin={`${begin}s`} repeatCount="1" path={d} />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="0.95s" begin={`${begin}s`} repeatCount="1" />
                  </circle>
                </g>
              );
            });
          })}
          {activeWars.slice(0, 2).map((w) => {
            const b = COUNTRIES[w.tgt];
            const begin = reducedMotion ? "0" : "0.85";
            return (
              <g key={`impact-${w.key}`}>
                <circle cx={b.cx} cy={b.cy} r="4" fill="none" stroke="#ff7a4d" strokeWidth="2.4">
                  <animate attributeName="r" from="4" to="46" dur="1.2s" begin={`${begin}s`} repeatCount="1" />
                  <animate attributeName="opacity" from="0.95" to="0" dur="1.2s" begin={`${begin}s`} repeatCount="1" />
                </circle>
                <circle cx={b.cx} cy={b.cy} r="3" fill="none" stroke="#ffd977" strokeWidth="1.8">
                  <animate attributeName="r" from="3" to="30" dur="1.05s" begin={`${begin}s`} repeatCount="1" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="1.05s" begin={`${begin}s`} repeatCount="1" />
                </circle>
              </g>
            );
          })}
          {!reducedMotion && activeWars.slice(0, 2).map((w) => {
            const b = COUNTRIES[w.tgt];
            const d = orbitPath(b, 15);
            return (
              <g key={`drone-${w.key}`} opacity="0.9">
                <animateMotion dur="7s" repeatCount="indefinite" path={d} rotate="auto" />
                <g stroke="#e8f6ff" strokeWidth="1.1" fill="none">
                  <line x1="-4.5" y1="-4.5" x2="4.5" y2="4.5" />
                  <line x1="-4.5" y1="4.5" x2="4.5" y2="-4.5" />
                  <circle cx="-4.5" cy="-4.5" r="1.7" />
                  <circle cx="4.5" cy="-4.5" r="1.7" />
                  <circle cx="-4.5" cy="4.5" r="1.7" />
                  <circle cx="4.5" cy="4.5" r="1.7" />
                  <circle cx="0" cy="0" r="1.6" fill="#e8f6ff" stroke="none" />
                </g>
              </g>
            );
          })}
        </g>
      )}

      {/* notification markers — a small box over each country the live
          inbox concerns; cyan when it concerns the anchor */}
      {markers && markers.map((m) => (
        <g key={m.key} pointerEvents="none" transform={`translate(${COUNTRIES[m.idx].cx} ${COUNTRIES[m.idx].cy - 16})`}>
          <rect x="-7.5" y="-5.5" width="15" height="11" rx="2.5" fill="rgba(4,16,30,0.9)" stroke={m.anchor ? CLAIM_HEX : "#f0c060"} strokeWidth="1.2" />
          <polygon points="0,-2.8 2.4,2 0,1 -2.4,2" fill={m.anchor ? CLAIM_HEX : "#f0c060"} />
          <polygon points="-3,5.5 3,5.5 0,9.5" fill="rgba(4,16,30,0.9)" />
        </g>
      ))}

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
          <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: layer === "terrain" ? TERRAIN_PALETTE[DOMINANT_TERRAIN[hoverIdx]][1] : layer === "religion" ? (FAITHS[hoverSnap.f]?.color ?? "#8a93a3") : powerColor(COUNTRIES[hoverIdx].code) }} />
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
          {layer === "religion" && (
            <>Dominant faith <strong style={{ color: FAITHS[hoverSnap.f]?.color ?? "#f0c060" }}>{FAITHS[hoverSnap.f]?.name}</strong>
              {(() => { const st = result.faithLeaders[yearIdx].find((x) => x.faith === FAITHS[hoverSnap.f]?.id); return st ? <> · {st.popShare.toFixed(1)}% of humanity</> : null; })()}
            </>
          )}
          {layer === "terrain" && <>Terrain: <strong style={{ color: "#f0c060" }}>{TERRAIN_LABEL[DOMINANT_TERRAIN[hoverIdx]]}</strong> heartland{(COUNTRY_WATERWAYS.get(hoverIdx) ?? []).length > 0 && <> · <strong style={{ color: "#9fd0ee" }}>{(COUNTRY_WATERWAYS.get(hoverIdx) ?? []).join(" · ")}</strong></>}</>}
          <span style={{ color: "#93a7bd" }}> · GDP {fmtGdp(hoverSnap.gdp)}</span>
        </div>
      </div>
    )}
    </div>
  );
}
