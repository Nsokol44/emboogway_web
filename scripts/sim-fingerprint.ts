// Byte-identity gate for engine speed-ups: md5 of the full JSON result for
// a fixed 16-config panel. A performance change must leave EXPECTED intact;
// a deliberate model change updates EXPECTED in the same commit.
// Run: npx tsx scripts/sim-fingerprint.ts
const EXPECTED = "53149b3914a1 1802b8eab78b 5a98725a7c17 fa86540c83db fac54e8e9c5c e457ca6e0a0f 5159a428579c ad30502204d4 763d25a463b4 cc168e1c69bc ad050da21e2c 8ff79f124215 58ec0f3453f3 1a4cb61427e0 d60dcfc0a89e f900baad1d15";
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
