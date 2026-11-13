// Annexation-rate measurement — GEOSTORY_TUNING.md's own metric:
// annex events (kind === "annex") across the 10 scripts/sim-check.ts
// scenario/seed configs, unboosted (ZERO_BOOSTS). Also reports fold
// events and held-in-2100 per run for context.
// Run: npx tsx scripts/annex-measure.ts
import { runSimulation, ZERO_BOOSTS } from "../app/games/geostory/lib/engine";

const PANEL = [["multipolar", "stratatir-1"], ["chokepoint", "hormuz-7"], ["hydroclimate", "rain-3"], ["techrace", "chip-9"], ["sandbox", "base-0"], ["arctic", "pole-2"], ["nigeria", "lagos-5"], ["malacca", "strait-4"], ["sahel", "sand-8"], ["andes", "lithium-6"]] as const;

let totalAnnex = 0;
let totalFold = 0;
const heldRange: number[] = [];
for (const [scenarioId, seed] of PANEL) {
  const r = runSimulation({ scenarioId, seed, boosts: ZERO_BOOSTS });
  const annex = r.events.filter((e) => e.kind === "annex").length;
  const fold = r.events.filter((e) => e.kind === "fold").length;
  const held = r.years[74].filter((s, i) => s.c !== i).length;
  totalAnnex += annex;
  totalFold += fold;
  heldRange.push(held);
  console.log(`${scenarioId}/${seed}: annex=${annex} fold=${fold} held-in-2100=${held}`);
}
console.log(`\nPANEL TOTAL: annex=${totalAnnex} fold=${totalFold} held range=${Math.min(...heldRange)}–${Math.max(...heldRange)}`);
console.log(`per-run annex mean=${(totalAnnex / PANEL.length).toFixed(1)}`);
