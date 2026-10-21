import { runSimulation, ZERO_BOOSTS } from "../app/games/geostory/lib/engine";
import { createHash } from "node:crypto";

for (const [scenarioId, seed] of [["multipolar", "stratatir-1"], ["chokepoint", "hormuz-7"], ["hydroclimate", "rain-3"], ["techrace", "chip-9"], ["sandbox", "base-0"]] as const) {
  const t0 = Date.now();
  const r = runSimulation({ scenarioId, seed, boosts: ZERO_BOOSTS });
  const ms = Date.now() - t0;
  const annex = r.events.filter((e) => e.kind === "annex").length;
  const over = r.events.filter((e) => e.kind === "overtake").length;
  const top26 = r.leaders[0].slice(0, 3).map((l) => `${l.code} ${l.power}`).join(", ");
  const top100 = r.leaders[74].slice(0, 5).map((l) => `${l.code} ${l.power}`).join(", ");
  const held = r.years[74].filter((s, i) => s.c !== i).length;
  console.log(`\n${scenarioId} (${ms}ms) events=${r.events.length} annex=${annex} overtake=${over} held-in-2100=${held}`);
  console.log(`  2026 top: ${top26}`);
  console.log(`  2100 top: ${top100}`);
}

// custom rise: boost Nigeria hard in 'rise'
const rise = runSimulation({ scenarioId: "rise", seed: "stratatir-1", focusCode: "NGA", boosts: { growth: 90, tech: 85, military: 70, resources: 80 } });
const nga26 = rise.leaders[0].findIndex((l) => l.code === "NGA");
const nga100 = rise.leaders[74].slice(0, 6).map((l) => l.code).join(", ");
console.log(`\nrise/NGA: 2100 top6 = ${nga100}; focus events: ${rise.events.filter((e) => e.kind === "focus").length}`);
console.log(rise.events.filter((e) => e.kind === "focus").slice(0, 3).map((e) => `${e.year}: ${e.text}`).join("\n"));

// determinism: same config twice → identical JSON
const a = runSimulation({ scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS });
const b = runSimulation({ scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS });
const ha = createHash("md5").update(JSON.stringify(a)).digest("hex");
const hb = createHash("md5").update(JSON.stringify(b)).digest("hex");
console.log(`\ndeterminism: ${ha === hb ? "IDENTICAL ✓" : "MISMATCH ✗"} (${ha.slice(0, 8)})`);
const c = runSimulation({ scenarioId: "multipolar", seed: "other-seed", boosts: ZERO_BOOSTS });
console.log(`different seed differs: ${createHash("md5").update(JSON.stringify(c)).digest("hex") !== ha ? "yes ✓" : "NO ✗"}`);
