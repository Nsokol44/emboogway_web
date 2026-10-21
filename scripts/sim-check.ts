import { DEFAULT_DECK, runSimulation, ZERO_BOOSTS } from "../app/games/geostory/lib/engine";
import { createHash } from "node:crypto";

for (const [scenarioId, seed] of [["multipolar", "stratatir-1"], ["chokepoint", "hormuz-7"], ["hydroclimate", "rain-3"], ["techrace", "chip-9"], ["sandbox", "base-0"], ["arctic", "pole-2"], ["nigeria", "lagos-5"], ["malacca", "strait-4"], ["sahel", "sand-8"], ["andes", "lithium-6"]] as const) {
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

// place scenario with protagonist focus: Nigeria must outgrow its no-focus self
const ngaPlain = runSimulation({ scenarioId: "nigeria", seed: "lagos-5", boosts: ZERO_BOOSTS });
const ngaFocus = runSimulation({ scenarioId: "nigeria", seed: "lagos-5", focusCode: "NGA", boosts: { growth: 80, tech: 70, military: 40, resources: 60 } });
const rankOf = (r: typeof ngaPlain, code: string) => r.leaders[74].findIndex((l) => l.code === code) + 1;
console.log(`\nnigeria/NGA: 2100 rank plain=${rankOf(ngaPlain, "NGA")} boosted=${rankOf(ngaFocus, "NGA")}; scripted events present: ${ngaPlain.events.some((e) => e.text.includes("Investment boom in Nigeria"))}`);

// rivals + shock deck: deterministic, and changing the deck must change history
const customCfg = {
  scenarioId: "sandbox", seed: "rival-1",
  focusCode: "NGA", boosts: { growth: 70, tech: 60, military: 50, resources: 50 },
  rivals: [
    { code: "ZAF", boosts: { growth: 65, tech: 55, military: 45, resources: 40 } },
    { code: "EGY", boosts: { growth: 60, tech: 50, military: 60, resources: 35 } },
  ],
  deck: { ...DEFAULT_DECK, pandemics: false, chaos: 1.6 },
};
const r1 = runSimulation(customCfg);
const r2 = runSimulation(customCfg);
const hr1 = createHash("md5").update(JSON.stringify(r1)).digest("hex");
const hr2 = createHash("md5").update(JSON.stringify(r2)).digest("hex");
console.log(`rivals+deck determinism: ${hr1 === hr2 ? "IDENTICAL ✓" : "MISMATCH ✗"}`);
const rCalm = runSimulation({ ...customCfg, deck: { ...customCfg.deck, chaos: 0 } });
console.log(`chaos 0 differs from chaos 1.6: ${createHash("md5").update(JSON.stringify(rCalm)).digest("hex") !== hr1 ? "yes ✓" : "NO ✗"}`);
const rNoClimate = runSimulation({ ...customCfg, deck: { ...customCfg.deck, climate: false } });
console.log(`climate off differs: ${createHash("md5").update(JSON.stringify(rNoClimate)).digest("hex") !== hr1 ? "yes ✓" : "NO ✗"}`);
const climateEvents = rCalm.events.filter((e) => e.text.startsWith("Climate shock") || e.text.startsWith("Megadrought")).length;
console.log(`chaos 0 → random climate events (scripted only expected): ${climateEvents}`);
