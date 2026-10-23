"use client";

/**
 * The sky — an ambient weather layer that floats above the terrain and
 * the political washes, under the chart-room chrome. Pure presentation:
 * it READS the displayed year's chronicle (droughts, strait closures,
 * the Arctic opening) and dresses those places in weather; it never
 * writes to the simulation.
 *
 * Craft rules (Nick's bar): one palette with the atlas — clouds are
 * chart-room whites and navy shadows, dust is the map's own brass,
 * rain is pale slate. Clouds are pre-rendered sprites in three passes
 * (soft shadow, body, warm highlight) so edges stay blurred and the
 * per-frame cost is a handful of drawImage calls. All motion is slow
 * and eased: 2–6 s ambient cycles, fades over ~1.5 s, and effect gain
 * that only reaches full once the displayed year has settled — while
 * scrubbing, the sky stays quiet.
 */
import { useEffect, useMemo, useRef } from "react";
import { COUNTRIES, CODE_IDX, START_YEAR, WORLD } from "../lib/data";
import type { SimResult } from "../lib/engine";

type SpotKind = "drought" | "storm" | "arctic";
interface Spot { id: string; year: number; kind: SpotKind; x: number; y: number; r: number }

/* region membership mirrors engine.ts REGIONS (kept local so the sim
   module needs no new exports) */
const REGIONS: Record<string, string[]> = {
  sahel: ["MRT", "MLI", "BFA", "NER", "NGA", "TCD", "SDN", "SEN"],
  southasia: ["IND", "PAK", "BGD", "NPL", "LKA", "AFG"],
  horn: ["ETH", "SOM", "KEN", "SSD", "ERI", "DJI", "UGA"],
  med: ["ESP", "ITA", "GRC", "TUR", "SYR", "LBN", "ISR", "EGY", "LBY", "TUN", "DZA", "MAR"],
  centralamerica: ["GTM", "HND", "SLV", "NIC", "CRI", "PAN", "MEX"],
  seasia: ["MMR", "THA", "VNM", "KHM", "LAO", "MYS", "IDN", "PHL"],
  southernAfrica: ["ZAF", "MOZ", "ZWE", "ZMB", "BWA", "NAM", "AGO"],
};
/* the engine's prose names for those regions ("hammer the sahel belt") —
   its label maker only splits camelCase, so keys arrive as "southasia",
   "centralamerica", "seasia", "southern africa" */
const PROSE_TO_REGION: Record<string, string> = {
  "sahel": "sahel",
  "southasia": "southasia",
  "horn": "horn",
  "med": "med",
  "centralamerica": "centralamerica",
  "seasia": "seasia",
  "southern africa": "southernAfrica",
};
const STRAIT_ANCHOR: Record<string, string> = {
  "Strait of Hormuz": "IRN",
  "Suez Canal": "EGY",
  "Panama Canal": "PAN",
  "Strait of Malacca": "MYS",
};

function regionSpot(key: string): { x: number; y: number; r: number } | null {
  const codes = REGIONS[key];
  if (!codes) return null;
  let x = 0, y = 0, n = 0;
  for (const code of codes) {
    const i = CODE_IDX.get(code);
    if (i === undefined) continue;
    x += COUNTRIES[i].cx;
    y += COUNTRIES[i].cy;
    n++;
  }
  if (!n) return null;
  x /= n; y /= n;
  let spread = 0;
  for (const code of codes) {
    const i = CODE_IDX.get(code);
    if (i === undefined) continue;
    spread = Math.max(spread, Math.hypot(COUNTRIES[i].cx - x, COUNTRIES[i].cy - y));
  }
  return { x, y, r: Math.max(48, Math.min(120, spread * 0.95)) };
}

function deriveSpots(result: SimResult): Map<number, Spot[]> {
  const byYear = new Map<number, Spot[]>();
  const push = (s: Spot) => {
    const arr = byYear.get(s.year);
    if (arr) arr.push(s); else byYear.set(s.year, [s]);
  };
  for (const e of result.events) {
    if (e.text.includes("drought and hydroclimate stress")) {
      const m = e.text.match(/hammer the (.+?) belt/);
      const key = m ? PROSE_TO_REGION[m[1]] : undefined;
      const c = key ? regionSpot(key) : null;
      if (c) push({ id: `drought-${e.year}-${key}`, year: e.year, kind: "drought", ...c });
    } else if (e.text.includes(" closed — ")) {
      const label = e.text.split(" closed — ")[0];
      const anchor = STRAIT_ANCHOR[label];
      const i = anchor ? CODE_IDX.get(anchor) : undefined;
      if (i !== undefined) {
        push({ id: `storm-${e.year}-${label}`, year: e.year, kind: "storm", x: COUNTRIES[i].cx, y: COUNTRIES[i].cy, r: 36 });
      }
    } else if (e.text.startsWith("The Arctic opens")) {
      push({ id: `arctic-${e.year}`, year: e.year, kind: "arctic", x: WORLD.width / 2, y: 62, r: WORLD.width / 2 });
    }
  }
  return byYear;
}

/* ------------------------------------------------------------ sprites */
function mulberry(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One cloud, three passes baked in: navy shadow mass low, a soft body
    of overlapping radial puffs, and a warm highlight riding the top.
    Edges are pure gradient falloff — no hard shape anywhere. */
function makeCloudSprite(seed: number): HTMLCanvasElement {
  const W = 264, H = 132;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry(seed);
  /* clustered in an ellipse with one high cumulus puff — a cloud
     silhouette, never a horizontal bar */
  const puffs = [
    ...Array.from({ length: 6 }, (_, k) => ({
      x: W * (0.28 + 0.44 * (k / 5)) + (rnd() - 0.5) * 30,
      y: H * (0.52 + (rnd() - 0.5) * 0.34),
      r: 25 + rnd() * 27,
    })),
    { x: W * (0.44 + rnd() * 0.12), y: H * 0.3, r: 19 + rnd() * 10 },
  ];
  const blob = (dx: number, dy: number, stops: [number, string][]) => {
    for (const p of puffs) {
      const g = ctx.createRadialGradient(p.x + dx, p.y + dy, 0, p.x + dx, p.y + dy, p.r);
      for (const [o, col] of stops) g.addColorStop(o, col);
      ctx.fillStyle = g;
      ctx.fillRect(p.x + dx - p.r, p.y + dy - p.r, p.r * 2, p.r * 2);
    }
  };
  blob(0, 13, [[0, "rgba(7,22,40,0.16)"], [0.65, "rgba(7,22,40,0.06)"], [1, "rgba(7,22,40,0)"]]); // shadow
  blob(0, 0, [[0, "rgba(233,239,245,0.32)"], [0.55, "rgba(233,239,245,0.14)"], [1, "rgba(233,239,245,0)"]]); // body
  blob(-7, -11, [[0, "rgba(252,246,230,0.28)"], [0.5, "rgba(252,246,230,0.09)"], [1, "rgba(252,246,230,0)"]]); // highlight
  return c;
}

interface Cloud { sprite: number; x: number; y: number; w: number; speed: number; alpha: number; phase: number; aspect: number }
interface Twinkle { x: number; y: number; phase: number; big: boolean }
interface RainDrop { ox: number; oy: number; len: number; speed: number }
interface Mote { ang: number; rad: number; size: number; speed: number; phase: number }

const smooth = (t: number) => t * t * (3 - 2 * t);

export default function WeatherOverlay({
  result,
  yearIdx,
  getBox,
}: {
  result: SimResult;
  yearIdx: number;
  getBox: () => { x: number; y: number; w: number; h: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spotsByYear = useMemo(() => deriveSpots(result), [result]);
  const stateRef = useRef<{ yearIdx: number; spots: Map<number, Spot[]> }>({ yearIdx, spots: spotsByYear });
  useEffect(() => {
    stateRef.current = { yearIdx, spots: spotsByYear };
  }, [yearIdx, spotsByYear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sprites = [makeCloudSprite(11), makeCloudSprite(47), makeCloudSprite(83)];
    const rnd = mulberry(20261023);
    const clouds: Cloud[] = Array.from({ length: 22 }, (_, i) => ({
      sprite: i % 3,
      x: rnd() * (WORLD.width + 260) - 130,
      y: 18 + rnd() * (WORLD.height - 60),
      w: 95 + rnd() * 95,
      speed: 2.1 + rnd() * 2.6, // map units per second — a slow prevailing drift
      alpha: 0.3 + rnd() * 0.28,
      phase: rnd() * Math.PI * 2,
      aspect: 0.52 + rnd() * 0.18,
    }));
    const twinkles: Twinkle[] = Array.from({ length: 52 }, () => ({
      x: rnd() * WORLD.width,
      y: 6 + rnd() * 104,
      phase: rnd() * Math.PI * 2,
      big: rnd() > 0.82,
    }));
    const rain: RainDrop[] = Array.from({ length: 52 }, () => ({
      ox: (rnd() - 0.5) * 2,
      oy: (rnd() - 0.5) * 2,
      len: 5 + rnd() * 5,
      speed: 130 + rnd() * 90, // map units/sec, falls within the spot disc
    }));
    const motes: Mote[] = Array.from({ length: 16 }, () => ({
      ang: rnd() * Math.PI * 2,
      rad: 0.25 + rnd() * 0.7,
      size: 0.7 + rnd() * 1.1,
      speed: 0.05 + rnd() * 0.08,
      phase: rnd() * Math.PI * 2,
    }));

    let cw = 0, ch = 0;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      cw = Math.round(w * dpr);
      ch = Math.round(h * dpr);
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const fades = new Map<string, number>();
    let raf = 0;
    let last = performance.now();
    let lastYearChange = 0;
    let prevYear = stateRef.current.yearIdx;
    const boot = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = reduced ? 0 : (now - boot) / 1000;
      const dt = reduced ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const { yearIdx: yi, spots } = stateRef.current;
      if (yi !== prevYear) { prevYear = yi; lastYearChange = now; }
      /* the sky stays quiet while the year is still moving */
      const settle = reduced ? 1 : smooth(Math.min(1, (now - lastYearChange) / 1400));
      if (!cw || !ch) return;
      const box = getBox();
      const sx = cw / box.w;
      const sy = ch / box.h;
      const PX = (mx: number) => (mx - box.x) * sx;
      const PY = (my: number) => (my - box.y) * sy;

      ctx.clearRect(0, 0, cw, ch);

      /* ---- event weather for the displayed year, eased in/out ---- */
      const displayYear = START_YEAR + yi;
      const active = spots.get(displayYear) ?? [];
      const activeIds = new Set(active.map((s) => s.id));
      for (const s of active) if (!fades.has(s.id)) fades.set(s.id, 0);
      for (const [id, v] of [...fades]) {
        const target = activeIds.has(id) ? 1 : 0;
        const nv = v + (target - v) * (reduced ? 1 : 1 - Math.exp(-dt / 0.5));
        if (nv < 0.015 && target === 0) fades.delete(id); else fades.set(id, nv);
      }
      const spotOf = (id: string) => {
        for (const arr of spots.values()) for (const s of arr) if (s.id === id) return s;
        return null;
      };

      for (const [id, fade] of fades) {
        const s = spotOf(id);
        if (!s) continue;
        const a = fade * (0.35 + 0.65 * settle);
        if (s.kind === "drought") {
          const cx = PX(s.x), cy = PY(s.y), rr = s.r * sx;
          const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.45);
          halo.addColorStop(0, `rgba(219,158,66,${0.27 * a})`);
          halo.addColorStop(0.6, `rgba(224,178,92,${0.13 * a})`);
          halo.addColorStop(1, "rgba(224,178,92,0)");
          ctx.fillStyle = halo;
          ctx.fillRect(cx - rr * 1.45, cy - rr * 1.45, rr * 2.9, rr * 2.9);
          const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 0.7);
          core.addColorStop(0, `rgba(199,132,44,${0.18 * a})`);
          core.addColorStop(1, "rgba(199,132,44,0)");
          ctx.fillStyle = core;
          ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
          /* dust motes on a slow thermal rise */
          ctx.fillStyle = `rgba(238,205,138,${0.5 * a})`;
          for (const m of motes) {
            const ang = m.ang + t * m.speed * Math.PI * 2;
            const lift = 0.5 + 0.5 * Math.sin(t * 0.35 + m.phase);
            const mx = cx + Math.cos(ang) * rr * m.rad;
            const my = cy + Math.sin(ang) * rr * m.rad * 0.62 - lift * rr * 0.14;
            ctx.globalAlpha = (0.25 + 0.55 * lift) * a;
            ctx.beginPath();
            ctx.arc(mx, my, m.size * sx * 0.32, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (s.kind === "storm") {
          const cx = PX(s.x), cy = PY(s.y), rr = s.r * sx;
          /* dark heart under the spiral */
          const heart = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.15);
          heart.addColorStop(0, `rgba(10,26,46,${0.36 * a})`);
          heart.addColorStop(1, "rgba(10,26,46,0)");
          ctx.fillStyle = heart;
          ctx.fillRect(cx - rr * 1.2, cy - rr * 1.2, rr * 2.4, rr * 2.4);
          /* fine rain streaks, slanted by the wind, inside the disc */
          ctx.strokeStyle = `rgba(186,214,238,${0.55 * a})`;
          ctx.lineWidth = Math.max(1, sx * 0.28);
          ctx.beginPath();
          for (const d of rain) {
            const fall = reduced ? 0 : (t * d.speed) % (rr * 2.4);
            const py = cy - rr * 1.2 + fall + d.oy * rr * 0.4;
            const px = cx + d.ox * rr * 0.85 + (py - cy) * 0.18;
            if (Math.hypot(px - cx, py - cy) > rr * 1.05) continue;
            ctx.moveTo(px, py);
            ctx.lineTo(px - d.len * sx * 0.22, py + d.len * sy * 0.5);
          }
          ctx.stroke();
          /* the spiral itself: a wide soft arm + a bright core arm */
          const rot = t * 0.45;
          for (const [wMul, alpha, lw] of [[1, 0.22, 5.2], [0.62, 0.42, 2.1]] as const) {
            ctx.strokeStyle = `rgba(228,240,250,${alpha * a})`;
            ctx.lineWidth = Math.max(1.2, sx * lw * 0.42);
            ctx.beginPath();
            ctx.arc(cx, cy, rr * wMul, rot, rot + Math.PI * 1.45);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, rr * wMul * 0.66, rot + 2.2, rot + 2.2 + Math.PI * 1.2);
            ctx.stroke();
          }
          /* a cloud cap riding the strait */
          const spr = sprites[1];
          ctx.globalAlpha = 0.9 * a;
          const wpx = rr * 3.4;
          ctx.drawImage(spr, cx - wpx / 2, cy - wpx * 0.36, wpx, wpx * 0.6);
          ctx.globalAlpha = 1;
        }
        /* arctic handled below via the twinkle field's gain */
      }

      /* ---- ambient snow twinkle across the high latitudes ---- */
      const arcticOn = active.some((s) => s.kind === "arctic") ? 1 : 0;
      const arcticFade = fades.get(`arctic-${displayYear}`) ?? 0;
      const snowGain = 0.55 + 0.9 * arcticFade * arcticOn;
      for (const tw of twinkles) {
        if (arcticFade <= 0.01 && tw.y > 118) continue;
        const tw1 = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 2.8) + tw.phase);
        const alpha = smooth(tw1) * 0.5 * snowGain;
        if (alpha < 0.02) continue;
        const px = PX(tw.x), py = PY(tw.y);
        const arm = (tw.big ? 2.6 : 1.7) * (sx / 3);
        ctx.strokeStyle = `rgba(244,249,252,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - arm, py); ctx.lineTo(px + arm, py);
        ctx.moveTo(px, py - arm); ctx.lineTo(px, py + arm);
        ctx.stroke();
      }

      /* ---- the drifting cloud field, above everything ---- */
      for (const cl of clouds) {
        const drift = reduced ? 0 : t * cl.speed;
        let x = (cl.x + drift) % (WORLD.width + 280);
        if (x < 0) x += WORLD.width + 280;
        x -= 140;
        const bob = reduced ? 0 : Math.sin(t / 5.2 + cl.phase) * 1.6;
        const breathe = reduced ? 1 : 0.86 + 0.14 * Math.sin(t / 4.6 + cl.phase * 1.7);
        const wpx = cl.w * sx;
        const hpx = wpx * cl.aspect;
        const px = PX(x), py = PY(cl.y + bob);
        if (px + wpx < 0 || px > cw || py + hpx < 0 || py > ch) continue;
        ctx.globalAlpha = cl.alpha * breathe * 0.8;
        ctx.drawImage(sprites[cl.sprite], px - wpx / 2, py - hpx / 2, wpx, hpx);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [getBox]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
