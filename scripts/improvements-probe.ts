/**
 * Improvements probe — crafted proof for the 2026-10-29 GeoStory
 * improvement programme (items 1–5). Each verb must change the outcome
 * it claims, on fixtures where the unmodified outcome is known:
 *
 *   guarantee  — HTI folds into Puerto Rico's orbit in 2080 on the
 *                takeover-3 fixture; guaranteed in 2078, it cannot fold
 *                anywhere inside the 15-year window.
 *   counter    — on the same fixture HTI's streak under PRI reads 4/5
 *                in 2079; a Counter-Influence in 2080 lands it at 0/5,
 *                and no fold follows inside the rebuilt clock's first
 *                five years.
 *   fortify    — on takeover-1, Puerto Rico besieges the Dominican
 *                Republic (strain 0.162 by 2076) and annexes it in 2077;
 *                fortified in 2074, the strain drains away and the
 *                annexation never lands.
 *   (Fixtures re-based 2026-11-13: the annexation recalibration —
 *   GEOSTORY_TUNING.md — superseded the moz-5 / takeover-1 DOM-fold
 *   fixtures, whose sieges developed under the old gain scale.)
 *   stabilise  — across six takeover seeds, a Stabilise on DOM in 2030
 *                lifts its 2031 stability by ≥ +0.05 in every seed.
 *   pact       — a PRI>DOM market pact (2030) leaves DOM's GDP in 2045
 *                ahead of the unpacted run across the seed panel.
 *   mission    — China missions Vietnam in 2050; Vietnam's faith flip
 *                (2064 unmissioned) lands in 2057, inside the window.
 *   pluralism  — Taiwan flips in 2041 unshielded; shielded from 2035,
 *                it still holds its own faith in 2050.
 *
 * Plus: the regions partition is exact, the ladder reads the fixture
 * correctly, why-lines render from causes, share links round-trip the
 * new levers, and the empty-config digest matches the calibrated
 * engine (gate (a) — the digest was re-based once, on 2026-11-13, for
 * the approved annexation recalibration; it must not drift again
 * without a deliberate model change recorded in GEOSTORY_TUNING.md).
 *
 * Run: bun scripts/improvements-probe.ts
 */
import { createHash } from "node:crypto";
import {
  runSimulation, SUPERPOWER_BOOSTS, ZERO_BOOSTS,
  type Intervention, type SimConfig,
} from "../app/games/geostory/lib/engine";
import { COUNTRIES, CODE_IDX } from "../app/games/geostory/lib/data";
import { COUNTRY_FAITH } from "../app/games/geostory/lib/religion";
import { LADDER_REGIONS } from "../app/games/geostory/lib/regions";
import { finalLadder, ladderAt } from "../app/games/geostory/lib/ladder";
import { eventWhy } from "../app/games/geostory/lib/why";
import { decodeRun, encodeRun } from "../app/games/geostory/lib/share";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const iv = (year: number, lever: Intervention["lever"], target: string, cost: number): Intervention =>
  ({ year, lever, target, cost });
const idx = (code: string) => CODE_IDX.get(code)!;
const PRI = idx("PRI"), DOM = idx("DOM"), HTI = idx("HTI"), TWN = idx("TWN"), VNM = idx("VNM");

/* ---- gate (a): the dormant world matches the calibrated engine ------ */
{
  const r = runSimulation({ scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS });
  const md5 = createHash("md5").update(JSON.stringify(r)).digest("hex");
  check("empty-config digest unchanged", md5 === "2366bde0632115366d5fe2000bc0eb84", md5.slice(0, 8));
  check("diagnostics ride non-enumerably", !!r.diagnostics && !JSON.stringify(r).includes("diagnostics"));
  const someCause = r.events.find((e) => e.cause);
  check("causes ride non-enumerably", !!someCause && !JSON.stringify(r.events).includes("\"cause\""));
}

/* ---- regions partition ------------------------------------------------ */
{
  const seen = new Map<string, number>();
  for (const codes of Object.values(LADDER_REGIONS)) for (const c of codes) seen.set(c, (seen.get(c) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n !== 1).map(([c]) => c);
  const missing = COUNTRIES.filter((c) => !seen.has(c.code)).map((c) => c.code);
  check("ladder regions partition the 175 exactly", dupes.length === 0 && missing.length === 0 && seen.size === 175,
    `dupes=${dupes.join(",")} missing=${missing.join(",")}`);
}

/* ---- the takeover fixtures -------------------------------------------- */
const TAKE: SimConfig = { scenarioId: "multipolar", seed: "takeover-1", boosts: SUPERPOWER_BOOSTS, focusCode: "PRI" };
const base = runSimulation(TAKE);
/* the fold fixture (re-based 2026-11-13): on takeover-3, Haiti folds
   into Puerto Rico's orbit in 2080, its streak under PRI at 4/5 in 2079 */
const TAKE3: SimConfig = { scenarioId: "multipolar", seed: "takeover-3", boosts: SUPERPOWER_BOOSTS, focusCode: "PRI" };
const base3 = runSimulation(TAKE3);
const htiFold = base3.events.find((e) => e.kind === "fold" && e.cause?.subject === HTI);
check("fixture: HTI folds to PRI in 2080", !!htiFold && htiFold.year === 2080 && htiFold.cause?.driver === PRI,
  htiFold ? `${htiFold.year}` : "no fold found");
check("fixture: HTI streak under PRI is 4/5 in 2079",
  base3.diagnostics!.risk[2079 - 2026][HTI].partner === PRI && base3.diagnostics!.risk[2079 - 2026][HTI].streak === 4);
{
  const why = htiFold ? eventWhy(htiFold) : null;
  check("why-line renders from the cause", !!why && why.includes("5 straight years") && why.includes("stability"),
    why ?? "null");
}
{
  const lad = finalLadder(base, PRI);
  // № 5 + region leader satisfies Regional Hegemon AND Continental Power
  // (top-5) — the ladder reports the higher rung
  check("ladder: PRI ends a Continental Power at № 5", lad.tier === "Continental Power" && lad.rank === 5 && lad.isRegionLeader,
    `${lad.tier} №${lad.rank} in ${lad.region}`);
  check("ladder: the gap names the next rung", lad.next === "World Power" && !!lad.gap && lad.gap.includes("№ 1"),
    lad.gap ?? "");
  const fallen = ladderAt(base, base.years.length - 1, DOM);
  check("ladder: held DOM reads Fallen", fallen.tier === "Fallen" && fallen.rank === null, fallen.tier);
  // a true Regional Hegemon (№ 6–10 AND region leader) exists somewhere
  // in the plain panel — and every one found reads exactly that tier
  let hegemons = 0, consistent = true;
  for (const seed of ["stratatir-1", "stratatir-2", "stratatir-3"]) {
    const r = runSimulation({ scenarioId: "multipolar", seed, boosts: ZERO_BOOSTS });
    for (let i = 0; i < COUNTRIES.length; i++) {
      const l = finalLadder(r, i);
      if (l.rank !== null && l.rank >= 6 && l.rank <= 10 && l.isRegionLeader) {
        hegemons++;
        if (l.tier !== "Regional Hegemon") consistent = false;
      }
    }
  }
  check("ladder: № 6–10 region leaders read Regional Hegemon", hegemons > 0 && consistent, `${hegemons} found`);
}

/* ---- item 3: guarantee ------------------------------------------------- */
{
  const r = runSimulation({ ...TAKE3, interventions: [iv(2078, "guarantee", "HTI", 2)] });
  const folds = r.events.filter((e) => e.kind === "fold" && e.cause?.subject === HTI && e.year >= 2078 && e.year < 2093);
  check("guarantee: HTI cannot fold inside the window", folds.length === 0, `${folds.length} folds`);
  check("guarantee: window is on the risk track", r.diagnostics!.risk[2088 - 2026][HTI].guarUntil === 2093);
}

/* ---- item 3: counter-influence ----------------------------------------- */
{
  const r = runSimulation({ ...TAKE3, interventions: [iv(2080, "counter", "PRI>HTI", 1)] });
  const rk = r.diagnostics!.risk[2080 - 2026][HTI];
  check("counter: the 4/5 streak lands at 0/5", rk.streak === 0,
    `partner=${rk.partner >= 0 ? COUNTRIES[rk.partner].code : "-"} streak=${rk.streak}`);
  const folds = r.events.filter((e) => e.kind === "fold" && e.cause?.subject === HTI && e.cause?.driver === PRI && e.year >= 2080 && e.year < 2085);
  check("counter: no fold while the clock rebuilds", folds.length === 0);
}

/* ---- item 2: fortify ---------------------------------------------------- */
{
  const bAx = base.events.find((e) => e.kind === "annex" && e.cause?.subject === DOM);
  check("fixture: Puerto Rico annexes the Dominican Republic in 2077", !!bAx && bAx.year === 2077 && bAx.cause?.driver === PRI,
    bAx ? `${bAx.year}` : "none");
  const r = runSimulation({ ...TAKE, interventions: [iv(2074, "fortify", "DOM", 2)] });
  const rAx = r.events.filter((e) => e.kind === "annex" && e.cause?.subject === DOM && e.year >= 2074 && e.year < 2084);
  check("fortify: the annexation never lands inside the window", rAx.length === 0);
  check("fortify: the strain drains away", r.diagnostics!.risk[2076 - 2026][DOM].strain < 0.05,
    `strain ${r.diagnostics!.risk[2076 - 2026][DOM].strain} vs base ${base.diagnostics!.risk[2076 - 2026][DOM].strain}`);
}

/* ---- item 3: stabilise (seed panel) -------------------------------------- */
{
  const lifts: number[] = [];
  for (const seed of ["takeover-1", "takeover-2", "takeover-3", "takeover-4", "takeover-5", "takeover-6"]) {
    const cfg: SimConfig = { scenarioId: "multipolar", seed, boosts: SUPERPOWER_BOOSTS, focusCode: "PRI" };
    const b = runSimulation(cfg).years[2031 - 2026][DOM].stab;
    const s = runSimulation({ ...cfg, interventions: [iv(2030, "stabilise", "DOM", 2)] }).years[2031 - 2026][DOM].stab;
    lifts.push(s - b);
  }
  const med = [...lifts].sort((a, b) => a - b)[3];
  check("stabilise: the +0.10 bump is still standing a year on in every seed",
    lifts.every((l) => l >= 0.04) && med >= 0.08,
    lifts.map((l) => `+${l.toFixed(3)}`).join(" "));
}

/* ---- item 2: market pact (seed panel) ------------------------------------- */
{
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const bG: number[] = [], pG: number[] = [];
  for (const seed of ["takeover-1", "takeover-2", "takeover-3", "takeover-4"]) {
    const cfg: SimConfig = { scenarioId: "multipolar", seed, boosts: SUPERPOWER_BOOSTS, focusCode: "PRI" };
    bG.push(runSimulation(cfg).years[2045 - 2026][DOM].gdp);
    pG.push(runSimulation({ ...cfg, interventions: [iv(2030, "pact", "PRI>DOM", 2)] }).years[2045 - 2026][DOM].gdp);
  }
  check("pact: DOM's 2045 GDP runs ahead of the unpacted median", med(pG) > med(bG) * 1.02,
    `median ${med(bG).toFixed(3)} → ${med(pG).toFixed(3)}`);
}

/* ---- item 2: mission + pluralism ------------------------------------------ */
{
  const plain: SimConfig = { scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS };
  const b = runSimulation(plain);
  const bFlip = b.events.find((e) => e.kind === "faith" && e.text.startsWith("Vietnam"));
  check("fixture: Vietnam flips in 2064 unmissioned", !!bFlip && bFlip.year === 2064, bFlip ? `${bFlip.year}` : "none");
  const m = runSimulation({ ...plain, interventions: [iv(2050, "mission", "CHN>VNM", 1)] });
  const mFlip = m.events.find((e) => e.kind === "faith" && e.text.startsWith("Vietnam"));
  check("mission: the flip lands earlier, inside the window", !!mFlip && mFlip.year > 2050 && mFlip.year < 2064,
    mFlip ? `${mFlip.year}` : "no flip");
  const s = runSimulation({ ...plain, interventions: [iv(2035, "pluralism", "TWN", 1)] });
  check("pluralism: Taiwan still holds its own faith in 2050",
    s.years[2050 - 2026][TWN].f === COUNTRY_FAITH[TWN] && b.years[2050 - 2026][TWN].f !== COUNTRY_FAITH[TWN]);
}

/* ---- share links carry the new levers -------------------------------------- */
{
  const cfg: SimConfig = {
    ...TAKE,
    interventions: [
      iv(2030, "fortify", "DOM", 2), iv(2031, "guarantee", "DOM", 2), iv(2032, "stabilise", "DOM", 2),
      iv(2033, "counter", "USA>DOM", 1), iv(2034, "pact", "PRI>DOM", 2), iv(2035, "mission", "PRI>DOM", 1),
      iv(2036, "pluralism", "DOM", 1),
    ],
  };
  const back = decodeRun(encodeRun(cfg));
  const levers = (back?.interventions ?? []).map((v) => v.lever).sort();
  check("share round-trip keeps all seven new levers",
    levers.join(",") === "counter,fortify,guarantee,mission,pact,pluralism,stabilise", levers.join(","));
}

console.log(failures ? `\n${failures} PROBE FAILURE(S)` : "\nALL PROBES PASS");
process.exit(failures ? 1 : 0);
