import { COUNTRIES } from "../app/games/geostory/lib/data";
import { powerColor } from "../app/games/geostory/lib/scenarios";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function dist(a: [number, number, number], b: [number, number, number]): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const colours = COUNTRIES.map((c) => powerColor(c.code));
const nonHex = COUNTRIES.filter((c, i) => !/^#[0-9a-f]{6}$/i.test(colours[i]));
console.log(`countries=${COUNTRIES.length} nonHex=${nonHex.length}`);
const seen = new Map<string, string[]>();
COUNTRIES.forEach((c, i) => { const k = colours[i]; seen.set(k, [...(seen.get(k) ?? []), c.code]); });
const dupes = [...seen.entries()].filter(([, v]) => v.length > 1);
console.log(`distinctColours=${seen.size} duplicateColours=${dupes.length}`, dupes.slice(0, 6).map(([k, v]) => `${k}:${v.join("+")}`).join(" "));

let worst: { a: string; b: string; d: number } | null = null;
let pairs = 0, under60 = 0, under80 = 0;
const dists: number[] = [];
for (const c of COUNTRIES) {
  for (const n of c.adj) {
    if (n <= c.code) continue; // each unordered pair once (codes sort consistently enough for a check)
    const i = COUNTRIES.findIndex((x) => x.code === c.code);
    const j = COUNTRIES.findIndex((x) => x.code === n);
    if (j < 0) continue;
    pairs++;
    const d = dist(hexToRgb(colours[i]), hexToRgb(colours[j]));
    dists.push(d);
    if (d < 60) under60++;
    if (d < 80) under80++;
    if (!worst || d < worst.d) worst = { a: c.code, b: n, d };
  }
}
dists.sort((a, b) => a - b);
console.log(`adjacentPairs=${pairs} min=${worst ? worst.d.toFixed(1) : "-"} (${worst?.a}-${worst?.b}) p5=${dists[Math.floor(dists.length * 0.05)]?.toFixed(1)} median=${dists[Math.floor(dists.length / 2)]?.toFixed(1)} under60=${under60} under80=${under80}`);
const claim: [number, number, number] = [0x22, 0xd3, 0xee];
let worstClaim = { code: "", d: Infinity };
COUNTRIES.forEach((c, i) => { const d = dist(hexToRgb(colours[i]), claim); if (d < worstClaim.d) worstClaim = { code: c.code, d }; });
console.log(`closestToClaimCyan=${worstClaim.code} d=${worstClaim.d.toFixed(1)} colour=${powerColor(worstClaim.code)}`);
const gold: [number, number, number] = [0xf0, 0xc0, 0x60];
let worstGold = { code: "", d: Infinity };
COUNTRIES.forEach((c, i) => { const d = dist(hexToRgb(colours[i]), gold); if (d < worstGold.d) worstGold = { code: c.code, d }; });
console.log(`closestToSelectionGold=${worstGold.code} d=${worstGold.d.toFixed(1)} colour=${powerColor(worstGold.code)}`);
