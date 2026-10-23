/**
 * GeoStory simulation engine — deterministic, seeded, client-side.
 *
 * One tick = one year, 2026–2100. The full history is computed up front so
 * playback / scrubbing is pure lookup and a restart with the same seed and
 * config reproduces the identical history.
 *
 * Model themes (from Emboogway × Stratatir research):
 *  - Receptivity (GCEIA-style): influence lands where receptivity is high
 *    and stability is low.
 *  - Market access / gravity: economic dominance decays with distance, so
 *    big economies dominate their neighbourhood first.
 *  - Shocks reshuffle relative power: hydroclimate stress, chokepoint
 *    closures, resource finds, tech breakthroughs.
 *  - Territory is the last step: sustained influence + a big power gap +
 *    adjacency + local instability can flip control — rarely.
 */
import { BASELINE, COUNTRIES, CODE_IDX, DIST, START_YEAR, END_YEAR } from "./data";
import { Rng } from "./rng";
import { getScenario, type ScenarioMods } from "./scenarios";

export interface Boosts {
  growth: number; // 0..100 slider
  tech: number;
  military: number;
  resources: number;
}
export const ZERO_BOOSTS: Boosts = { growth: 0, tech: 0, military: 0, resources: 0 };

/** A second (or third) hand-boosted country, set up as a rival to the focus. */
export interface RivalBoost {
  code: string;
  boosts: Boosts;
}

/** Player-tunable shock deck. Defaults reproduce the original deck exactly. */
export interface DeckControls {
  chokepoints: boolean;
  climate: boolean;
  pandemics: boolean;
  rushes: boolean;
  chaos: number; // 0..2 shock-frequency multiplier
}
export const DEFAULT_DECK: DeckControls = { chokepoints: true, climate: true, pandemics: true, rushes: true, chaos: 1 };

/** P1a — a light intervention: one lever, spent at one year, folded into the
 *  run config so the run reproduces exactly (and can be shared as a link).
 *  target: country code (tech/stability), "AAA>BBB" toward / "AAA!BBB" away
 *  (trade), strait id (chokepoint), region key (crisis). */
export type LeverId = "tech" | "trade" | "chokepoint" | "crisis" | "stability";
export interface Intervention { year: number; lever: LeverId; target: string; cost: number }
export const INFLUENCE_POOL = 6;
export const LEVERS: { id: LeverId; name: string; cost: number; blurb: string; target: "country" | "trade" | "strait" | "region" }[] = [
  { id: "tech", name: "Accelerate Tech", cost: 2, blurb: "+tech momentum for one power, 10 years", target: "country" },
  { id: "trade", name: "Trade Realignment", cost: 2, blurb: "tilt one market toward / away from another power, 15 years", target: "trade" },
  { id: "chokepoint", name: "Invest in a Chokepoint", cost: 1, blurb: "harden one strait — closures bite 65% less, 20 years", target: "strait" },
  { id: "crisis", name: "Trigger Regional Crisis", cost: 1, blurb: "a bounded instability shock across one region", target: "region" },
  { id: "stability", name: "Shore Up Stability", cost: 1, blurb: "a stability floor under one power, 10 years", target: "country" },
];
/** P4a — starting world modifiers (ids; display metadata lives in scenarios.ts). */
export const MODIFIER_IDS = ["china-slow", "europe-rearm", "andes-lithium", "hormuz-perma", "sahel-dry"] as const;

/** intervention target pickers (keys match the engine's REGIONS / straits) */
export const CRISIS_REGIONS: { key: string; label: string }[] = [
  { key: "sahel", label: "The Sahel" },
  { key: "southasia", label: "South Asia" },
  { key: "horn", label: "Horn of Africa" },
  { key: "med", label: "The Mediterranean" },
  { key: "centralamerica", label: "Central America" },
  { key: "seasia", label: "Southeast Asia" },
  { key: "southernAfrica", label: "Southern Africa" },
];
export const STRAITS: { id: string; label: string }[] = [
  { id: "hormuz", label: "Strait of Hormuz" },
  { id: "suez", label: "Suez Canal" },
  { id: "panama", label: "Panama Canal" },
  { id: "malacca", label: "Strait of Malacca" },
];

/** Canonical intervention list: validated + sorted, so equal inputs always
 *  produce the same key and the same application order. */
export function canonicalInterventions(list?: Intervention[] | null): Intervention[] {
  if (!Array.isArray(list)) return [];
  const ok = list.filter((v) =>
    v && LEVERS.some((l) => l.id === v.lever) &&
    Number.isFinite(v.year) && v.year >= 2027 && v.year <= 2100 &&
    typeof v.target === "string" && v.target.length > 0 && typeof v.cost === "number");
  return ok
    .map((v) => ({ year: Math.round(v.year), lever: v.lever, target: v.target, cost: v.cost }))
    .sort((a, b) => a.year - b.year || a.lever.localeCompare(b.lever) || a.target.localeCompare(b.target));
}
export function canonicalModifiers(list?: string[] | null): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((m) => (MODIFIER_IDS as readonly string[]).includes(m)))].sort();
}

export interface SimConfig {
  scenarioId: string;
  seed: string;
  focusCode?: string;
  boosts: Boosts;
  rivals?: RivalBoost[];
  deck?: DeckControls;
  /** P4a — starting world modifiers (empty/absent = legacy-identical key). */
  modifiers?: string[];
  /** P1a — spent interventions (empty/absent = legacy-identical key). */
  interventions?: Intervention[];
}

/** The exact seed string a config simulates from. New input families
 *  (modifiers, interventions) append ONLY when non-empty, so a legacy
 *  config's key — and therefore its history — is bit-identical to before. */
export function simKey(cfg: SimConfig): string {
  const deck: DeckControls = cfg.deck ?? DEFAULT_DECK;
  const rivals = [...(cfg.rivals ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  const parts: (string | number)[] = [
    cfg.seed, cfg.scenarioId, cfg.focusCode ?? "",
    cfg.boosts.growth, cfg.boosts.tech, cfg.boosts.military, cfg.boosts.resources,
    rivals.map((r) => `${r.code}:${r.boosts.growth},${r.boosts.tech},${r.boosts.military},${r.boosts.resources}`).join(";"),
    [deck.chokepoints, deck.climate, deck.pandemics, deck.rushes, deck.chaos].join(","),
  ];
  const mods = canonicalModifiers(cfg.modifiers);
  if (mods.length) parts.push("M:" + mods.join(","));
  const invs = canonicalInterventions(cfg.interventions);
  if (invs.length) parts.push("I:" + invs.map((v) => `${v.year}.${v.lever}.${v.target}.${v.cost}`).join(";"));
  return parts.join("|");
}

export interface CountrySnap {
  c: number; // controller country index
  i: number; // top influencer index
  e: number; // top economic-dominant index
  gdp: number;
  pop: number;
  tech: number;
  mil: number;
  stab: number;
  pow: number; // own power score
  bloc: number; // bloc power score (0 if not sovereign)
}

export type EventKind = "shock" | "annex" | "breakaway" | "overtake" | "focus" | "crisis" | "intervention";
export interface SimEvent {
  year: number;
  kind: EventKind;
  text: string;
}

/** P1b — per-country, per-year attribution, computed from the engine's real
 *  terms during the run (never decorative): who influences this country and
 *  how hard, who dominates its market and how hard, its tech gap to the
 *  frontier, and the net growth shock (in growth points) applied this year. */
export interface AttribSnap {
  i: number;  // top influencer index
  iv: number; // influencer gravity value
  sv: number; // own-gravity baseline (own power × 1.15) — what foreign pull must beat
  e: number;  // top economic-dominant index
  ev: number; // market gravity value
  tg: number; // tech gap to the world frontier
  sh: number; // net shock delta applied to growth this year (points)
}

export interface SimResult {
  years: CountrySnap[][]; // [yearIdx][countryIdx]
  events: SimEvent[];
  leaders: { code: string; power: number }[][]; // top 10 per year
  attrib: AttribSnap[][]; // [yearIdx][countryIdx], parallel to years
}

const N = COUNTRIES.length;
const YEARS = END_YEAR - START_YEAR + 1;
const ADJ: number[][] = COUNTRIES.map((c) => c.adj.map((a) => CODE_IDX.get(a)!).filter((x) => x !== undefined));
const IS_AFRICA = COUNTRIES.map((c) => c.lon >= -18 && c.lon <= 43 && c.lat >= -35 && c.lat <= 31);

const REGIONS: Record<string, string[]> = {
  sahel: ["MRT", "MLI", "BFA", "NER", "NGA", "TCD", "SDN", "SEN"],
  southasia: ["IND", "PAK", "BGD", "NPL", "LKA", "AFG"],
  horn: ["ETH", "SOM", "KEN", "SSD", "ERI", "DJI", "UGA"],
  med: ["ESP", "ITA", "GRC", "TUR", "SYR", "LBN", "ISR", "EGY", "LBY", "TUN", "DZA", "MAR"],
  centralamerica: ["GTM", "HND", "SLV", "NIC", "CRI", "PAN", "MEX"],
  seasia: ["MMR", "THA", "VNM", "KHM", "LAO", "MYS", "IDN", "PHL"],
  southernAfrica: ["ZAF", "MOZ", "ZWE", "ZMB", "BWA", "NAM", "AGO"],
};
const GULF = ["SAU", "ARE", "QAT", "KWT", "OMN", "IRQ", "IRN"];

interface CState {
  gdp: number; pop: number; tech: number; stab: number;
  energy: number; minerals: number; food: number;
  milShare: number; baseShare: number; growthAdd: number;
  growthMod: number; techMod: number;
  ctrl: number; pressure: number; pressureFrom: number; yearsCtrl: number;
  /* intervention state — all neutral by default, so legacy runs never move */
  techPush: number; techPushUntil: number;
  alignTo: number; alignMult: number; alignUntil: number;
  stabMin: number; stabMinUntil: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ownPower(gdp: number, mil: number, tech: number, stab: number): number {
  return Math.pow(Math.max(gdp, 0.001), 0.6) *
    Math.pow(Math.max(mil, 0.05) * (0.4 + tech / 125), 0.4) * (0.72 + 0.28 * stab);
}

export function runSimulation(cfg: SimConfig): SimResult {
  const scenario = getScenario(cfg.scenarioId);
  const mods: ScenarioMods = scenario.mods;
  const deck: DeckControls = cfg.deck ?? DEFAULT_DECK;
  const chaos = clamp(deck.chaos, 0, 2.5);
  const rivals = [...(cfg.rivals ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  const modSet = new Set(canonicalModifiers(cfg.modifiers));
  const invs = canonicalInterventions(cfg.interventions);
  const rng = new Rng(simKey(cfg));
  const focusIdx = cfg.focusCode ? CODE_IDX.get(cfg.focusCode) : undefined;

  /* ---------------------------------------------------------- init state */
  const st: CState[] = COUNTRIES.map((geo, i) => {
    const b = BASELINE[geo.code];
    const share = b.gdp > 0 ? b.mil / (b.gdp * 1000) : 0.01;
    return {
      gdp: b.gdp, pop: b.pop, tech: b.tech, stab: b.stability,
      energy: b.energy, minerals: b.minerals, food: b.food,
      milShare: share, baseShare: share, growthAdd: 0,
      growthMod: 0, techMod: 0,
      ctrl: i, pressure: 0, pressureFrom: -1, yearsCtrl: 0,
      techPush: 0, techPushUntil: 0,
      alignTo: -1, alignMult: 1, alignUntil: 0,
      stabMin: -1, stabMinUntil: 0,
    };
  });
  const applyBoostMap = (map: Record<string, { growth?: number; tech?: number; resources?: number; minerals?: number; milMult?: number }>) => {
    for (const [code, m] of Object.entries(map)) {
      const i = CODE_IDX.get(code);
      if (i === undefined) continue;
      if (m.growth) st[i].growthAdd += m.growth;
      if (m.tech) { st[i].tech = clamp(st[i].tech + m.tech, 5, 100); st[i].techMod += m.tech * 0.02; }
      if (m.resources) {
        st[i].energy = clamp(st[i].energy + m.resources, 0, 100);
        st[i].minerals = clamp(st[i].minerals + m.resources, 0, 100);
        st[i].food = clamp(st[i].food + m.resources * 0.7, 0, 100);
      }
      if (m.minerals) st[i].minerals = clamp(st[i].minerals + m.minerals, 0, 100);
      if (m.milMult) { st[i].milShare *= m.milMult; st[i].baseShare *= m.milMult; }
    }
  };
  applyBoostMap(mods.boosts);
  const applyHandBoosts = (idx: number, b: Boosts) => {
    st[idx].growthAdd += (b.growth / 100) * 3.2;
    st[idx].tech = clamp(st[idx].tech + (b.tech / 100) * 14, 5, 100);
    st[idx].techMod += (b.tech / 100) * 0.22;
    st[idx].milShare *= 1 + (b.military / 100) * 1.6;
    st[idx].baseShare *= 1 + (b.military / 100) * 1.6;
    const r = (b.resources / 100) * 42;
    st[idx].energy = clamp(st[idx].energy + r, 0, 100);
    st[idx].minerals = clamp(st[idx].minerals + r, 0, 100);
    st[idx].food = clamp(st[idx].food + r * 0.7, 0, 100);
  };
  if (focusIdx !== undefined) applyHandBoosts(focusIdx, cfg.boosts);
  for (const r of rivals) {
    const ri = CODE_IDX.get(r.code);
    if (ri !== undefined && ri !== focusIdx) applyHandBoosts(ri, r.boosts);
  }
  /* P4a — starting world modifiers, applied through the same boost-map
   * machinery as scenario mods (perma/sahel-dry act inside the year loop). */
  if (modSet.has("china-slow")) applyBoostMap({ CHN: { growth: -1.0 } });
  if (modSet.has("europe-rearm")) applyBoostMap({ DEU: { milMult: 1.6 }, FRA: { milMult: 1.6 }, GBR: { milMult: 1.6 }, ITA: { milMult: 1.5 }, ESP: { milMult: 1.5 }, POL: { milMult: 1.7 } });
  if (modSet.has("andes-lithium")) applyBoostMap({ CHL: { minerals: 30, growth: 0.5 }, BOL: { minerals: 34, growth: 0.5 }, ARG: { minerals: 24, growth: 0.4 } });

  const events: SimEvent[] = [];
  const years: CountrySnap[][] = [];
  const leaders: { code: string; power: number }[][] = [];
  const attrib: AttribSnap[][] = [];
  /** net growth shock applied per country this year (attribution only) */
  const yrShock = new Array(N).fill(0);
  /** chokepoint hardening from interventions: strait id → year it lapses */
  const hardenUntil: Record<string, number> = {};
  const name = (i: number) => COUNTRIES[i].name;
  let prevTop: string[] = [];
  let focusBestRank = 999;
  const lastAnnexYear = new Map<number, number>();
  /* previous-year derived arrays, kept so the year-0 snapshot can be the
   * pristine opening state while later snapshots reuse the computed values */
  let lastMil: number[] = [];
  let lastPow: number[] = [];
  let lastInfl: number[] = COUNTRIES.map((_, i) => i);
  let lastEcon: number[] = COUNTRIES.map((_, i) => i);
  let lastInflVal: number[] = new Array(N).fill(0);
  let lastEconVal: number[] = new Array(N).fill(0);

  /* ------------------------------------------------------------ helpers */
  const hydroHit = (region: string, mult: number, label: string, year: number) => {
    const codes = REGIONS[region] ?? [];
    for (const code of codes) {
      const i = CODE_IDX.get(code);
      if (i === undefined) continue;
      const gd = rng.range(1.0, 2.6) * mult;
      st[i].growthMod -= gd; yrShock[i] -= gd;
      st[i].stab = clamp(st[i].stab - rng.range(0.02, 0.055) * mult, 0.04, 0.97);
      st[i].food = clamp(st[i].food - rng.range(2, 6) * mult, 0, 100);
    }
    events.push({ year, kind: "shock", text: `${label} — drought and hydroclimate stress hammer the ${region.replace(/([A-Z])/g, " $1").toLowerCase()} belt; harvests, growth and stability all slip.` });
  };
  const chokepointHit = (which: "hormuz" | "suez" | "panama" | "malacca", mult: number, year: number) => {
    const label = which === "hormuz" ? "Strait of Hormuz" : which === "suez" ? "Suez Canal" : which === "panama" ? "Panama Canal" : "Strait of Malacca";
    // an invested-in strait shrugs off most of a closure (defensive lever only)
    const hardened = year < (hardenUntil[which] ?? 0);
    const m = hardened ? mult * 0.35 : mult;
    const bump = (i: number, d: number) => { st[i].growthMod += d; yrShock[i] += d; };
    for (let i = 0; i < N; i++) {
      const isGulf = GULF.includes(COUNTRIES[i].code);
      if (which === "hormuz" && isGulf) { bump(i, -1.5 * m); continue; }
      if (which === "malacca") {
        // the strait's keepers and alternative routes cash in; the workshop
        // economies that ship through it stall
        if (["MYS", "IDN", "SGP"].includes(COUNTRIES[i].code)) { bump(i, 0.9 * m); continue; }
        if (REGIONS.seasia.includes(COUNTRIES[i].code)) { bump(i, -1.1 * m); continue; }
        if (st[i].tech > 70 && st[i].energy < 40) { bump(i, -0.85 * m); continue; }
      }
      if (st[i].energy < 35) bump(i, -(which === "hormuz" ? 1.3 : 0.9) * m);
      if (st[i].energy > 75 && !isGulf) bump(i, 0.85 * m); // alternative suppliers cash in
      if (which !== "hormuz" && st[i].tech > 72 && st[i].energy < 40) bump(i, -0.7 * m);
    }
    events.push({ year, kind: "shock", text: `${label} closed — energy and trade shock ripples worldwide; importers stall while rival exporters cash in.${hardened ? " Years of hardening blunt the blow." : ""}` });
  };
  const findHit = (code: string, year: number, lithium = false) => {
    const i = CODE_IDX.get(code);
    if (i === undefined) return;
    if (lithium) {
      st[i].minerals = clamp(st[i].minerals + 26, 0, 100);
      st[i].growthMod += 1.1; yrShock[i] += 1.1;
      events.push({ year, kind: "shock", text: `Lithium boom in ${name(i)} — the battery age has a new capital, and the money arrives faster than the institutions.` });
      return;
    }
    if (rng.chance(0.5)) st[i].minerals = clamp(st[i].minerals + 20, 0, 100);
    else st[i].energy = clamp(st[i].energy + 20, 0, 100);
    st[i].growthMod += 1.3; yrShock[i] += 1.3;
    events.push({ year, kind: "shock", text: `Major resource discovery in ${name(i)} — a boom begins and the region's maths changes overnight.` });
  };
  const boomHit = (code: string, year: number) => {
    const i = CODE_IDX.get(code);
    if (i === undefined) return;
    st[i].growthMod += 2.2; yrShock[i] += 2.2;
    st[i].stab = clamp(st[i].stab + 0.03, 0.04, 0.97);
    events.push({ year, kind: "shock", text: `Investment boom in ${name(i)} — ports, grids and industrial parks rise on a wave of foreign money and domestic nerve.` });
  };
  const breakthroughHit = (code: string, year: number) => {
    const i = CODE_IDX.get(code);
    if (i === undefined) return;
    st[i].tech = clamp(st[i].tech + 5, 5, 100);
    st[i].growthMod += 0.55; yrShock[i] += 0.55;
    events.push({ year, kind: "shock", text: `Tech breakthrough in ${name(i)} — a leap in capability the rest of the world must now answer.` });
  };
  const arcticHit = (year: number) => {
    for (let i = 0; i < N; i++) {
      if (COUNTRIES[i].lat < 52) continue;
      st[i].energy = clamp(st[i].energy + 5, 0, 100);
      st[i].minerals = clamp(st[i].minerals + 4, 0, 100);
      st[i].growthMod += 0.5; yrShock[i] += 0.5;
    }
    events.push({ year, kind: "shock", text: `The Arctic opens another season — polar routes shorten, northern ports boom, and the high-latitude resource frontier moves again.` });
  };
  const pickHydroRegion = (): string => {
    const keys = Object.keys(REGIONS);
    const bias = mods.regionBias;
    if (!bias) return rng.pick(keys);
    let total = 0;
    const weights = keys.map((k) => { const w = bias[k] ?? 1; total += w; return w; });
    let rollW = rng.next() * total;
    for (let k = 0; k < keys.length; k++) { rollW -= weights[k]; if (rollW <= 0) return keys[k]; }
    return keys[keys.length - 1];
  };

  /* ------------------------------------------------- P1a: interventions */
  const REGION_LABELS: Record<string, string> = {
    sahel: "the Sahel", southasia: "South Asia", horn: "the Horn of Africa",
    med: "the Mediterranean", centralamerica: "Central America",
    seasia: "Southeast Asia", southernAfrica: "Southern Africa",
  };
  const STRAIT_LABELS: Record<string, string> = {
    hormuz: "Strait of Hormuz", suez: "Suez Canal", panama: "Panama Canal", malacca: "Strait of Malacca",
  };
  /** Interventions are time-bounded modifier terms on the same state the
   *  boosts and deck already steer — no parallel machinery, no RNG draws. */
  const applyIntervention = (inv: Intervention, year: number) => {
    if (inv.lever === "tech" || inv.lever === "stability") {
      const i = CODE_IDX.get(inv.target);
      if (i === undefined) return;
      if (inv.lever === "tech") {
        st[i].techPush = 0.38; st[i].techPushUntil = year + 10;
        events.push({ year, kind: "intervention", text: `⚑ Directed research drive — ${name(i)}'s laboratories surge on a decade of focused funding.` });
      } else {
        st[i].stab = clamp(st[i].stab + 0.05, 0.04, 0.97);
        st[i].stabMin = st[i].stab; st[i].stabMinUntil = year + 10;
        events.push({ year, kind: "intervention", text: `⚑ Stability compact — ${name(i)}'s institutions are underwritten for a decade.` });
      }
    } else if (inv.lever === "trade") {
      const toward = inv.target.includes(">");
      const [a, b] = inv.target.split(toward ? ">" : "!");
      const ia = CODE_IDX.get(a), ib = CODE_IDX.get(b);
      if (ia === undefined || ib === undefined || ia === ib) return;
      st[ia].alignTo = ib; st[ia].alignMult = toward ? 1.7 : 0.4; st[ia].alignUntil = year + 15;
      events.push({ year, kind: "intervention", text: `⚑ Trade realignment — ${name(ia)} tilts its markets ${toward ? "toward" : "away from"} ${name(ib)}.` });
    } else if (inv.lever === "chokepoint") {
      if (!(inv.target in STRAIT_LABELS)) return;
      hardenUntil[inv.target] = year + 20;
      events.push({ year, kind: "intervention", text: `⚑ ${STRAIT_LABELS[inv.target]} hardened — escorts, dredging and deep stockpiles blunt any closure for twenty years.` });
    } else if (inv.lever === "crisis") {
      const codes = REGIONS[inv.target];
      if (!codes) return;
      for (const code of codes) {
        const i = CODE_IDX.get(code);
        if (i === undefined) continue;
        st[i].growthMod -= 1.4; yrShock[i] -= 1.4;
        st[i].stab = clamp(st[i].stab - 0.05, 0.04, 0.97);
      }
      events.push({ year, kind: "intervention", text: `⚑ Regional crisis in ${REGION_LABELS[inv.target] ?? inv.target} — unrest spills across borders and every neighbour pays.` });
    }
  };

  /* ------------------------------------------------------------ main loop */
  for (let yi = 0; yi < YEARS; yi++) {
    const year = START_YEAR + yi;

    if (yi > 0) {
      yrShock.fill(0);
      /* ---- scripted scenario events ---- */
      for (const s of mods.scripted) {
        if (s.year !== year) continue;
        if (s.kind === "hormuz") chokepointHit("hormuz", 1.8, year);
        else if (s.kind === "suez") chokepointHit("suez", 1.5, year);
        else if (s.kind === "malacca") chokepointHit("malacca", 1.5, year);
        else if (s.kind === "arctic") arcticHit(year);
        else if (s.kind.startsWith("drought:")) hydroHit(s.kind.slice(8), 1.5, "Megadrought", year);
        else if (s.kind.startsWith("find:")) findHit(s.kind.slice(5), year);
        else if (s.kind.startsWith("lithium:")) findHit(s.kind.slice(8), year, true);
        else if (s.kind.startsWith("boom:")) boomHit(s.kind.slice(5), year);
        else if (s.kind.startsWith("breakthrough:")) breakthroughHit(s.kind.slice(13), year);
      }
      /* ---- P1a interventions scheduled for this year ---- */
      for (const inv of invs) if (inv.year === year) applyIntervention(inv, year);
      /* ---- P4a perma-modifiers: recurring scripted pressure ---- */
      if (modSet.has("hormuz-perma") && year >= 2032 && (year - 2032) % 6 === 0) chokepointHit("hormuz", 1.1, year);
      if (modSet.has("sahel-dry") && (year === 2031 || year === 2033 || year === 2035 || year === 2037 || year === 2039)) hydroHit("sahel", 1.2, "Megadrought", year);
      /* ---- Stratatir event deck (random shocks, player-tunable) ---- */
      const roll = rng.next();
      const hydroP = deck.climate ? 0.15 * mods.hydroFreq * chaos : 0;
      const energyP = deck.chokepoints ? 0.09 * mods.energyVol * chaos : 0;
      const findP = 0.11 * chaos;
      const leapP = 0.11 * chaos;
      const crisisP = 0.07 * chaos;
      if (roll < hydroP) {
        hydroHit(pickHydroRegion(), 1, "Climate shock", year);
      } else if (roll < hydroP + energyP) {
        chokepointHit(rng.pick(["hormuz", "suez", "panama"] as const), 1, year);
      } else if (roll < hydroP + energyP + findP) {
        const cand: number[] = [];
        for (let i = 0; i < N; i++) if ((st[i].minerals > 45 || st[i].energy > 45) && st[i].gdp < 3.2) cand.push(i);
        if (cand.length) {
          const i = rng.pick(cand);
          if (rng.chance(0.5)) st[i].minerals = clamp(st[i].minerals + 20, 0, 100);
          else st[i].energy = clamp(st[i].energy + 20, 0, 100);
          st[i].growthMod += 1.3; yrShock[i] += 1.3;
          events.push({ year, kind: "shock", text: `Major resource discovery in ${name(i)} — a boom begins and the region's maths changes overnight.` });
        }
      } else if (roll < hydroP + energyP + findP + leapP) {
        const byTech = [...Array(N).keys()].sort((a, b) => st[b].tech - st[a].tech).slice(0, 12);
        const i = rng.pick(byTech);
        st[i].tech = clamp(st[i].tech + rng.range(3.5, 6.5), 5, 100);
        st[i].growthMod += 0.55; yrShock[i] += 0.55;
        events.push({ year, kind: "shock", text: `Tech breakthrough in ${name(i)} — a leap in capability the rest of the world must now answer.` });
      } else if (roll < hydroP + energyP + findP + leapP + crisisP) {
        for (let i = 0; i < N; i++) { st[i].growthMod -= 1.05; yrShock[i] -= 1.05; if (st[i].stab < 0.6) st[i].stab = clamp(st[i].stab - 0.02, 0.04, 0.97); }
        events.push({ year, kind: "shock", text: `Global financial crisis — credit seizes up and growth stalls almost everywhere at once.` });
      } else if (roll < 0.97 && deck.rushes && rng.chance(0.10 * chaos)) {
        const rich: number[] = [];
        for (let i = 0; i < N; i++) if (st[i].minerals >= 72) rich.push(i);
        for (const i of rich) { st[i].growthMod += 0.8; yrShock[i] += 0.8; }
        if (rich.length) events.push({ year, kind: "shock", text: `Critical-minerals rush — the battery age bids up every mineral-rich state on the map.` });
      }

      /* ---- growth / tech / population / stability ---- */
      let pandemic = false;
      if (deck.pandemics && rng.chance(0.028 * chaos)) { pandemic = true; events.push({ year, kind: "crisis", text: `Pandemic year — borders close, output dips, and every capital is distracted at once.` }); }
      for (let i = 0; i < N; i++) {
        const s = st[i];
        const base = BASELINE[COUNTRIES[i].code];
        const gdppcK = (s.gdp * 1000) / Math.max(s.pop, 0.05); // GDP per capita, $k
        const resScore = (s.energy + s.minerals + s.food) / 300;
        // convergence: the richer a country gets, the harder fast growth becomes
        const convergence = Math.min(2.2, Math.max(0, gdppcK - 3) * 0.035);
        let g = base.growth + s.growthAdd + (s.tech - 55) * 0.012 + resScore * 0.9 -
          (1 - s.stab) * 2.2 + s.growthMod - convergence + rng.range(-0.7, 0.7);
        if (s.ctrl !== i) g -= 0.7; // extraction drag on held territory
        if (pandemic) { g -= 1.6; yrShock[i] -= 1.6; }
        if (s.stab < 0.2) g -= 1.8; // state failure trap
        s.gdp = Math.max(0.001, s.gdp * (1 + g / 100));
        let pr = clamp(1.5 - gdppcK * 0.02 + (IS_AFRICA[i] ? 0.55 : 0) + (s.stab < 0.4 ? 0.25 : 0), -0.5, 2.8);
        if (pandemic) pr -= 0.5;
        s.pop = Math.max(0.05, s.pop * (1 + pr / 100));
        // tech: own research + diffusion from ahead neighbours
        let diffusion = 0;
        for (const j of ADJ[i]) if (st[j].tech > s.tech + 6) diffusion = Math.max(diffusion, (st[j].tech - s.tech) * 0.02);
        s.tech = clamp(s.tech + ((0.22 + gdppcK * 0.006 + s.techMod + (year < s.techPushUntil ? s.techPush : 0)) * mods.techMult + diffusion) * (1 - s.tech / 135), 5, 100);
        s.milShare += (s.baseShare - s.milShare) * 0.05;
        // stability reverts toward the country's own institutional anchor —
        // slow growth alone doesn't dissolve a state, shocks do
        s.stab = clamp(s.stab + (base.stability - s.stab) * 0.05 + (g - 2.0) * 0.003 - (s.ctrl !== i ? 0.004 : 0) + rng.range(-0.012, 0.012), 0.04, 0.97);
        if (s.stabMin >= 0 && year < s.stabMinUntil) s.stab = Math.max(s.stab, s.stabMin); // intervention floor
        s.growthMod *= 0.55; // shocks fade
        if (s.ctrl !== i) s.yearsCtrl++;
      }

      /* ---- power, influence, dominance ---- */
      const mil = st.map((s) => s.gdp * 1000 * s.milShare);
      const pow = st.map((s, i) => ownPower(s.gdp, mil[i], s.tech, s.stab));
      const effGdp = new Array(N).fill(0), effMil = new Array(N).fill(0);
      for (let i = 0; i < N; i++) { effGdp[st[i].ctrl] += st[i].gdp * (st[i].ctrl === i ? 1 : 0.38); effMil[st[i].ctrl] += mil[i] * (st[i].ctrl === i ? 1 : 0.25); }
      const blocPow = st.map((s, i) => (s.ctrl === i ? ownPower(effGdp[i], Math.max(effMil[i], mil[i]), s.tech, s.stab) : 0));
      const sovereigns = [...Array(N).keys()].filter((i) => st[i].ctrl === i).sort((a, b) => blocPow[b] - blocPow[a]);
      const topPowers = sovereigns.slice(0, 14);
      const blocAdj = (p: number, c: number) => ADJ[c].some((j) => st[j].ctrl === p);

      const infl = new Array(N).fill(0), econ = new Array(N).fill(0);
      const inflVal = new Array(N).fill(0), econVal = new Array(N).fill(0);
      for (let c = 0; c < N; c++) {
        const cand = new Set<number>(topPowers);
        for (const j of ADJ[c]) cand.add(st[j].ctrl);
        cand.delete(c);
        let bestI = c, bestIV = pow[c] * 1.15;
        let bestE = c, bestEV = effGdp[c];
        for (const p of cand) {
          if (st[p].ctrl !== p) continue;
          const d = DIST[c * N + p];
          const adjB = blocAdj(p, c) ? 1.7 : 1;
          // an active trade realignment bends this country's gravity toward
          // (or away from) one chosen power — and only that pairing
          const am = st[c].alignTo === p && year < st[c].alignUntil ? st[c].alignMult : 1;
          const iv = (blocPow[p] * (0.3 + 0.7 * BASELINE[COUNTRIES[c].code].receptivity)) / (1 + Math.pow(d / 1700, 1.5)) * (adjB > 1 ? 1.45 : 1) * am;
          if (iv > bestIV) { bestIV = iv; bestI = p; }
          const ev = effGdp[p] / (1 + Math.pow(d / 1400, 1.3)) * (adjB > 1 ? 1.5 : 1) * am;
          if (ev > bestEV) { bestEV = ev; bestE = p; }
        }
        infl[c] = bestI; econ[c] = bestE;
        inflVal[c] = bestIV; econVal[c] = bestEV;
      }
      lastInflVal = inflVal; lastEconVal = econVal;

      /* ---- territorial change: influence + a wide gap + adjacency + deep
         instability, sustained over years. Deliberately rare — influence and
         market dominance are the normal outcomes; annexation is the exception. */
      const rankOf = new Map(sovereigns.map((sIdx, r) => [sIdx, r + 1]));
      for (let c = 0; c < N; c++) {
        const ctrl = st[c].ctrl;
        let bestP = -1, bestRatio = 0;
        const candP = new Set<number>();
        for (const j of ADJ[c]) candP.add(st[j].ctrl);
        for (const p of candP) {
          if (p === ctrl || p === c) continue;
          const ratio = blocPow[p] / (blocPow[ctrl] * 0.55 + pow[c] * 0.8 + 1);
          if (ratio > bestRatio) { bestRatio = ratio; bestP = p; }
        }
        // majors and top-5 homelands are far harder to swallow than minor states
        const isMajor = BASELINE[COUNTRIES[c].code].major;
        const protectedCore = ctrl === c && (rankOf.get(c) ?? 99) <= 5;
        const ratioNeeded = protectedCore ? 3.2 : isMajor ? 2.6 : 1.9;
        const digesting = bestP >= 0 && year - (lastAnnexYear.get(bestP) ?? -99) < 3; // empires need time to digest
        if (!digesting && bestP >= 0 && infl[c] === bestP && st[c].stab < 0.50 && bestRatio > ratioNeeded && blocPow[bestP] > pow[c] * 3) {
          if (st[c].pressureFrom !== bestP) { st[c].pressureFrom = bestP; st[c].pressure = 0; }
          st[c].pressure += (bestRatio - ratioNeeded) * (0.55 - st[c].stab) * 0.95;
          if (st[c].pressure > 7) {
            const old = ctrl;
            st[c].ctrl = bestP; st[c].pressure = 0; st[c].pressureFrom = -1; st[c].yearsCtrl = 0;
            lastAnnexYear.set(bestP, year);
            st[c].stab = clamp(st[c].stab - 0.07, 0.04, 0.97); st[c].growthMod -= 1.1; yrShock[c] -= 1.1;
            events.push({ year, kind: "annex", text: `${name(bestP)} takes control of ${name(c)} — years of influence, a wide power gap and local instability finally flip the border${old !== c ? ` (from ${name(old)})` : ""}.` });
          }
        } else {
          st[c].pressure *= 0.8;
        }
        // breakaway
        if (st[c].ctrl !== c && st[c].yearsCtrl > 5 && st[c].stab > 0.66 && rng.chance(0.04)) {
          const old = st[c].ctrl;
          st[c].ctrl = c; st[c].yearsCtrl = 0;
          events.push({ year, kind: "breakaway", text: `${name(c)} breaks away from ${name(old)} — the cost of holding it finally exceeded the prize.` });
        }
      }

      /* ---- overtakes & focus milestones ---- */
      const topCodes = sovereigns.slice(0, 5).map((i) => COUNTRIES[i].code);
      if (prevTop.length && topCodes[0] !== prevTop[0]) {
        events.push({ year, kind: "overtake", text: `${name(CODE_IDX.get(topCodes[0])!)} overtakes ${name(CODE_IDX.get(prevTop[0])!)} to become the world's #1 power.` });
      }
      for (let r = 0; r < Math.min(3, topCodes.length); r++) {
        if (!prevTop.slice(0, 3).includes(topCodes[r]) && prevTop.length) {
          events.push({ year, kind: "overtake", text: `${name(CODE_IDX.get(topCodes[r])!)} breaks into the top 3 world powers.` });
        }
      }
      if (focusIdx !== undefined) {
        const rank = sovereigns.indexOf(focusIdx) + 1;
        if (rank > 0 && rank <= 10 && rank < focusBestRank) {
          const prev = focusBestRank;
          focusBestRank = rank;
          if (prev > 10 || rank === 1 || rank <= 3 || prev > 5) {
            events.push({ year, kind: "focus", text: `${name(focusIdx)} climbs to #${rank} in the world power rankings${rank === 1 ? " — a new world power!" : ""}.` });
          }
        }
      }
      prevTop = topCodes;
      lastPow = pow; lastMil = mil; lastInfl = infl; lastEcon = econ;
    }

    /* ---- snapshot (year 0 = opening state) ---- */
    const milNow = yi === 0 ? st.map((s) => s.gdp * 1000 * s.milShare) : lastMil;
    const powNow = yi === 0 ? st.map((s, i) => ownPower(s.gdp, milNow[i], s.tech, s.stab)) : lastPow;
    const effG = new Array(N).fill(0), effM = new Array(N).fill(0);
    for (let i = 0; i < N; i++) { effG[st[i].ctrl] += st[i].gdp * (st[i].ctrl === i ? 1 : 0.38); effM[st[i].ctrl] += milNow[i] * (st[i].ctrl === i ? 1 : 0.25); }
    const blocNow = st.map((s, i) => (s.ctrl === i ? ownPower(effG[i], Math.max(effM[i], milNow[i]), s.tech, s.stab) : 0));
    const sovNow = [...Array(N).keys()].filter((i) => st[i].ctrl === i).sort((a, b) => blocNow[b] - blocNow[a]);
    years.push(st.map((s, i) => ({
      c: s.ctrl,
      i: yi === 0 ? i : lastInfl[i],
      e: yi === 0 ? i : lastEcon[i],
      gdp: Math.round(s.gdp * 1000) / 1000,
      pop: Math.round(s.pop * 10) / 10,
      tech: Math.round(s.tech * 10) / 10,
      mil: Math.round(milNow[i] * 10) / 10,
      stab: Math.round(s.stab * 1000) / 1000,
      pow: Math.round(powNow[i] * 100) / 100,
      bloc: Math.round(blocNow[i] * 100) / 100,
    })));
    leaders.push(sovNow.slice(0, 10).map((i) => ({ code: COUNTRIES[i].code, power: Math.round(blocNow[i] * 10) / 10 })));
    const maxTechNow = Math.max(...st.map((s) => s.tech));
    attrib.push(st.map((s, i) => ({
      i: yi === 0 ? i : lastInfl[i],
      iv: Math.round((yi === 0 ? powNow[i] * 1.15 : lastInflVal[i]) * 10) / 10,
      sv: Math.round(powNow[i] * 1.15 * 10) / 10,
      e: yi === 0 ? i : lastEcon[i],
      ev: Math.round((yi === 0 ? effG[i] : lastEconVal[i]) * 10) / 10,
      tg: Math.round((maxTechNow - s.tech) * 10) / 10,
      sh: Math.round(yrShock[i] * 100) / 100,
    })));
  }

  return { years, events, leaders, attrib };
}
