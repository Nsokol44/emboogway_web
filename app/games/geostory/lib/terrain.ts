/**
 * Pixel-art terrain bake for the atlas — the Civ-style ground under the
 * political washes. Terrain per hex comes from lib/data/terrain.json
 * (index i = WORLD.hexes[i]; the bake classified each real hex from its
 * latitude, climate belt and named ranges). The art itself is drawn in
 * code onto an offscreen canvas ONCE (module-cached, shared by every
 * compare panel) and composited into the map as an SVG <image>, so the
 * per-year tint layers above it never pay for a terrain redraw.
 *
 * Palette discipline: the demo terrain palette, deepened a step so it
 * sits inside the chart-room world (deep-navy ocean, gold reserved for
 * UI emphasis) and still reads when a translucent power wash lies over
 * it. Four tones per terrain — deep / base / light / highlight — give
 * every hex a lit-from-above feel instead of a flat fill.
 */
import terrainJson from "./data/terrain.json";
import { WORLD } from "./data";

export type TerrainName =
  | "grass" | "plains" | "steppe" | "desert" | "forest"
  | "taiga" | "jungle" | "tundra" | "ice" | "mountain";

const LEGEND = terrainJson.legend as Record<string, TerrainName>;
export const TERRAIN_BY_HEX: TerrainName[] = (() => {
  const s = terrainJson.terrain;
  const out = new Array<TerrainName>(s.length);
  for (let i = 0; i < s.length; i++) out[i] = LEGEND[s[i]] ?? "grass";
  return out;
})();

/** each country's most common terrain — for dossier colour in Terrain view */
export const DOMINANT_TERRAIN: TerrainName[] = (() => {
  const counts = new Map<number, Map<TerrainName, number>>();
  WORLD.hexes.forEach(([, , ci], hi) => {
    let m = counts.get(ci);
    if (!m) { m = new Map(); counts.set(ci, m); }
    const t = TERRAIN_BY_HEX[hi];
    m.set(t, (m.get(t) ?? 0) + 1);
  });
  return WORLD.countries.map((_, ci) => {
    const m = counts.get(ci);
    if (!m) return "grass" as TerrainName;
    let best: TerrainName = "grass", bn = -1;
    for (const [t, n] of m) if (n > bn) { best = t; bn = n; }
    return best;
  });
})();

export const TERRAIN_LABEL: Record<TerrainName, string> = {
  grass: "Grassland", plains: "Plains", steppe: "Steppe", desert: "Desert",
  forest: "Forest", taiga: "Taiga", jungle: "Jungle", tundra: "Tundra",
  ice: "Ice", mountain: "Mountains",
};

/** [deep, base, light, highlight] per terrain */
export const TERRAIN_PALETTE: Record<TerrainName, [string, string, string, string]> = {
  grass:   ["#4e7d38", "#679e48", "#82b85c", "#a6cf80"],
  plains:  ["#998751", "#b0a15e", "#c4b874", "#dcd198"],
  steppe:  ["#87824d", "#9c9656", "#b0aa68", "#c6c280"],
  desert:  ["#c4a264", "#dec07c", "#eccf94", "#f6e2ac"],
  forest:  ["#38662f", "#528741", "#6da653", "#8cbe6c"],
  taiga:   ["#436345", "#5a7d52", "#739168", "#92aa82"],
  jungle:  ["#245138", "#32703c", "#45884a", "#5ea25c"],
  tundra:  ["#8b8e80", "#a5a89c", "#b9bcb0", "#cfd1c2"],
  ice:     ["#b4c5d6", "#dfe9f0", "#ecf3f8", "#ffffff"],
  mountain:["#5b534a", "#7d7468", "#9a9182", "#e6edf4"],
};

const SHELF = "#2f6d99";      // shallow-water shelf around coasts
const SHELF_DEEP = "#26597f"; // shelf outer step, melts into the navy

/** swatches for the map legend (subset that reads at a glance) */
export const TERRAIN_SWATCHES: { name: string; color: string }[] = [
  { name: "Grassland", color: TERRAIN_PALETTE.grass[1] },
  { name: "Plains & steppe", color: TERRAIN_PALETTE.plains[1] },
  { name: "Forest", color: TERRAIN_PALETTE.forest[1] },
  { name: "Jungle", color: TERRAIN_PALETTE.jungle[1] },
  { name: "Desert", color: TERRAIN_PALETTE.desert[1] },
  { name: "Mountains", color: TERRAIN_PALETTE.mountain[1] },
  { name: "Tundra & ice", color: TERRAIN_PALETTE.ice[1] },
];

/* ------------------------------------------------------------ seeded rng */
/** mulberry32 — same family as the sim's Rng, seeded per hex index so
    every hex's texture is stable across panels, reloads and frames. */
function rngFor(seed: number): () => number {
  let a = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- drawing */
const SCALE = 3; // canvas px per map unit (2880×1560 plate)
const R = WORLD.hexR;

function hexPathCtx(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 30) * Math.PI) / 180;
    const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** one pixel-art pine: ground shadow, trunk, two canopy tiers, lit tip */
function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, deep: string, base: string, hi: string) {
  ctx.fillStyle = "rgba(6,20,10,0.20)";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.52, s * 0.52, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5d4630";
  ctx.fillRect(x - s * 0.07, y + s * 0.28, s * 0.14, s * 0.34);
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.62);
  ctx.lineTo(x - s * 0.52, y + s * 0.34);
  ctx.lineTo(x + s * 0.52, y + s * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.62);
  ctx.lineTo(x - s * 0.33, y + s * 0.05);
  ctx.lineTo(x + s * 0.33, y + s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hi;
  ctx.fillRect(x - s * 0.05, y - s * 0.66, s * 0.1, s * 0.1);
}

/** a mountain: shaded facets, a smaller shoulder peak, jagged snow cap */
function peak(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pal: [string, string, string, string]) {
  const [deep, base, light, snow] = pal;
  // shoulder peak behind
  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.42, y - s * 0.28);
  ctx.lineTo(x + s * 0.05, y + s * 0.42);
  ctx.lineTo(x + s * 0.82, y + s * 0.42);
  ctx.closePath();
  ctx.fill();
  // main peak: lit left facet, shadowed right facet
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.15, y - s * 0.78);
  ctx.lineTo(x - s * 0.72, y + s * 0.46);
  ctx.lineTo(x - s * 0.15, y + s * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.15, y - s * 0.78);
  ctx.lineTo(x - s * 0.15, y + s * 0.46);
  ctx.lineTo(x + s * 0.48, y + s * 0.46);
  ctx.closePath();
  ctx.fill();
  // snow cap with a jagged lower edge
  ctx.fillStyle = snow;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.15, y - s * 0.78);
  ctx.lineTo(x - s * 0.36, y - s * 0.34);
  ctx.lineTo(x - s * 0.24, y - s * 0.42);
  ctx.lineTo(x - s * 0.15, y - s * 0.28);
  ctx.lineTo(x - s * 0.05, y - s * 0.44);
  ctx.lineTo(x + s * 0.05, y - s * 0.34);
  ctx.closePath();
  ctx.fill();
}

function drawTerrainPlate(ctx: CanvasRenderingContext2D) {
  const hexes = WORLD.hexes;
  ctx.clearRect(0, 0, WORLD.width * SCALE, WORLD.height * SCALE);
  ctx.save();
  ctx.scale(SCALE, SCALE);

  /* pass 1 — the coastal shelf: two soft steps down into the navy */
  for (const [x, y] of hexes) {
    hexPathCtx(ctx, x, y, R * 1.3);
    ctx.fillStyle = SHELF_DEEP;
    ctx.fill();
  }
  for (const [x, y] of hexes) {
    hexPathCtx(ctx, x, y, R * 1.18);
    ctx.fillStyle = SHELF;
    ctx.fill();
  }

  /* pass 2 — hex bodies with per-hex seeded texture + glyphs */
  const dot = 0.55; // speckle grain in map units (snapped = pixel crunch)
  for (let i = 0; i < hexes.length; i++) {
    const [x, y] = hexes[i];
    const t = TERRAIN_BY_HEX[i];
    const pal = TERRAIN_PALETTE[t];
    const [deep, base, light, hi] = pal;
    const rnd = rngFor(i);

    hexPathCtx(ctx, x, y, R * 1.07);
    ctx.fillStyle = base;
    ctx.fill();

    /* lit-from-above: soft highlight toward the top, shade at the foot */
    ctx.save();
    hexPathCtx(ctx, x, y, R * 1.07);
    ctx.clip();
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.17;
    ctx.fillRect(x - R, y - R, R * 2, R * 0.9);
    ctx.fillStyle = deep;
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x - R, y + R * 0.35, R * 2, R * 0.75);
    ctx.globalAlpha = 1;

    /* seeded speckles, snapped to the pixel grain */
    const speck = (color: string, n: number, alpha: number) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2;
        const rr = rnd() * R * 0.8;
        const sx = Math.round((x + rr * Math.cos(a)) / dot) * dot;
        const sy = Math.round((y + rr * Math.sin(a)) / dot) * dot;
        ctx.fillRect(sx, sy, dot, dot);
      }
      ctx.globalAlpha = 1;
    };
    speck(deep, 10, 0.45);
    speck(light, 9, 0.5);
    speck(hi, 4, 0.6);

    /* terrain glyphs */
    if (t === "forest" || t === "taiga") {
      const n = t === "forest" ? 3 : 2;
      for (let k = 0; k < n; k++) {
        tree(ctx, x + (rnd() - 0.5) * 3.4, y + (rnd() - 0.5) * 3.0, (t === "forest" ? 1.55 : 1.3) + rnd() * 0.5, deep, t === "forest" ? base : deep, hi);
      }
    } else if (t === "jungle") {
      // layered canopy: clustered blobs under two pines
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? light : deep;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x + (rnd() - 0.5) * 3.6, y + (rnd() - 0.5) * 3.0, 0.75 + rnd() * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let k = 0; k < 2; k++) {
        tree(ctx, x + (rnd() - 0.5) * 3.0, y + (rnd() - 0.5) * 2.6, 1.8 + rnd() * 0.5, deep, base, hi);
      }
    } else if (t === "mountain") {
      peak(ctx, x + (rnd() - 0.5) * 0.8, y + (rnd() - 0.5) * 0.6, 2.5 + rnd() * 0.5, pal);
      speck(deep, 6, 0.5);
    } else if (t === "desert") {
      // twin dune crests: shadow arc under a lit arc
      for (let k = 0; k < 2; k++) {
        const dy = (rnd() - 0.5) * 3.4;
        ctx.strokeStyle = deep;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(x, y + dy + 0.5, 2.1, Math.PI * 1.12, Math.PI * 1.62);
        ctx.stroke();
        ctx.strokeStyle = hi;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y + dy, 2.1, Math.PI * 1.12, Math.PI * 1.62);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (t === "ice") {
      // pale fracture lines + bright drift speckle
      ctx.strokeStyle = "#a9c2da";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.35;
      for (let k = 0; k < 2; k++) {
        const sx = x + (rnd() - 0.5) * 3.4, sy = y + (rnd() - 0.5) * 3.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rnd() - 0.5) * 2.2, sy + (rnd() - 0.5) * 2.2);
        ctx.lineTo(sx + (rnd() - 0.5) * 3.4, sy + (rnd() - 0.5) * 3.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      speck(hi, 12, 0.8);
    } else if (t === "tundra") {
      speck("#eef1ea", 9, 0.75); // snow patches
      speck(deep, 6, 0.5);       // moss and stone
    }
    ctx.restore();
  }

  /* pass 3 — a whisper of print grain over the whole plate */
  const grnd = rngFor(987654);
  ctx.fillStyle = "#ffffff";
  for (let k = 0; k < 2600; k++) {
    ctx.globalAlpha = 0.028;
    ctx.fillRect(grnd() * WORLD.width, grnd() * WORLD.height, 0.5, 0.5);
  }
  ctx.fillStyle = "#000000";
  for (let k = 0; k < 1800; k++) {
    ctx.globalAlpha = 0.03;
    ctx.fillRect(grnd() * WORLD.width, grnd() * WORLD.height, 0.5, 0.5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

let platePromise: Promise<string | null> | null = null;

/** The terrain plate as an object URL — drawn once per page load and
    shared by every map instance (compare panels included). */
export function getTerrainPlateURL(): Promise<string | null> {
  if (platePromise) return platePromise;
  platePromise = new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = WORLD.width * SCALE;
      canvas.height = WORLD.height * SCALE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      drawTerrainPlate(ctx);
      canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), "image/png");
    } catch {
      resolve(null);
    }
  });
  return platePromise;
}
