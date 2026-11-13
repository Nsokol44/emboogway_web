// Byte-identity gate for engine speed-ups: md5 of the full JSON result for
// a fixed 16-config panel. A performance change must leave EXPECTED intact;
// a deliberate model change updates EXPECTED in the same commit.
// EXPECTED updated 2026-11-13 for the approved annexation recalibration
// (STRAIN_RATE/GAIN_CAP 0.06→0.02, STRAIN_HEAL 0.08→0.14, digestion 3→6y;
// panel annexations 620→246, back on the documented baseline — see
// GEOSTORY_TUNING.md "2026-11-13 recalibration").
// Run: npx tsx scripts/sim-fingerprint.ts
const EXPECTED = "2366bde06321 01714f27e467 0c4df3809138 e21cd7533590 8a9483f559e2 1e903541ad67 ab354b31c930 4501b3b1ed08 133feb885aac 41fb912647d1 8ffee629249a 09103dae684b 41503467aa69 1bc3b3e6ce31 6339b0c7e987 e0f1a93dd2fc";
import { runSimulation, ZERO_BOOSTS, DEFAULT_DECK, type SimConfig } from "../app/games/geostory/lib/engine";
import { createHash } from "node:crypto";
const cfgs: SimConfig[] = [
  ...[["multipolar","stratatir-1"],["chokepoint","hormuz-7"],["hydroclimate","rain-3"],["techrace","chip-9"],["sandbox","base-0"],["arctic","pole-2"],["nigeria","lagos-5"],["malacca","strait-4"],["sahel","sand-8"],["andes","lithium-6"]].map(([scenarioId, seed]) => ({ scenarioId, seed, boosts: ZERO_BOOSTS })),
  { scenarioId: "rise", seed: "stratatir-1", focusCode: "NGA", boosts: { growth: 90, tech: 85, military: 70, resources: 80 } },
  { scenarioId: "rise", seed: "run-2", boosts: { growth: 55, tech: 60, military: 50, resources: 45 } },
  { scenarioId: "multipolar", seed: "x", focusCode: "MDG", boosts: { growth: 100, tech: 100, military: 100, resources: 100 } },
  { scenarioId: "multipolar", seed: "riv", boosts: ZERO_BOOSTS, rivals: [{ code: "BRA", boosts: { growth: 60, tech: 40, military: 30, resources: 50 } }], deck: { ...DEFAULT_DECK, chaos: 1.6 } },
  { scenarioId: "sandbox", seed: "inv", focusCode: "IND", boosts: { growth: 20, tech: 70, military: 10, resources: 30 }, interventions: [] },
  { scenarioId: "techrace", seed: "chip-2", focusCode: "KOR", boosts: { growth: 40, tech: 90, military: 20, resources: 10 } },
];
const t0 = performance.now();
const out: string[] = [];
for (const c of cfgs) out.push(createHash("md5").update(JSON.stringify(runSimulation(c))).digest("hex").slice(0, 12));
console.log(out.join(" "));
console.log(out.join(" ") === EXPECTED ? "fingerprint: IDENTICAL ✓" : "fingerprint: CHANGED ✗ — the century is not the same");
if (out.join(" ") !== EXPECTED) process.exitCode = 1;
console.log(`avg ${((performance.now() - t0) / cfgs.length).toFixed(0)} ms/run`);
