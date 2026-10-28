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
import { COUNTRY_FAITH, FAITH_SHARE, FAITH_TUNING, FAITHS, FAITH_COUNT, FAITH_IDX } from "./religion";

export interface Boosts {
  growth: number; // 0..100 slider
  tech: number;
  military: number;
  resources: number;
}
export const ZERO_BOOSTS: Boosts = { growth: 0, tech: 0, military: 0, resources: 0 };

/** The one-click "what if X became a superpower" preset (lib/idler.ts
 *  re-exports it). Defined here, not in the idler, because the engine's
 *  small-nation endowment rule keys off this exact profile. */
export const SUPERPOWER_BOOSTS: Boosts = { growth: 150, tech: 140, military: 170, resources: 140 };

export function isSuperpowerBoosts(b: Boosts): boolean {
  return b.growth === SUPERPOWER_BOOSTS.growth && b.tech === SUPERPOWER_BOOSTS.tech &&
    b.military === SUPERPOWER_BOOSTS.military && b.resources === SUPERPOWER_BOOSTS.resources;
}

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

/* ---- small-nation endowment (deliberate fantasy lever) ----------------
 * Boosts multiply growth RATES, so on a micro base they compound a speck
 * into a slightly larger speck: a max-boosted Puerto Rico (starting GDP
 * $3B in the old stub data, $105B after the 2026-10-28 data correction)
 * finished ~#60 of 175 with zero annexations — the fantasy failed only
 * because the base was three orders of magnitude down. So on a Superpower
 * run (focus + the exact SUPERPOWER_BOOSTS profile) a claimed nation
 * starting below ENDOW_GDP_MAX has its starting GDP lifted to
 * ENDOW_GDP_TARGET — the band where boosted starts are proven to contend
 * (Philippines, $0.44T, reaches #1 in 5/5 seeds). A pure function of the
 * config and the baseline table: deterministic, carried by share links,
 * never applied to AI nations or unclaimed runs. Disclosed in the claim
 * picker and in the run's own chronicle. See GEOSTORY_TUNING.md. */
export const ENDOW_GDP_MAX = 0.15; // claimed nations starting under $150B…
export const ENDOW_GDP_TARGET = 0.45; // …start from a $450B economic base

export function endowmentFor(cfg: SimConfig): { code: string; from: number; to: number } | null {
  if (!cfg.focusCode) return null;
  if (CODE_IDX.get(cfg.focusCode) === undefined) return null;
  if (!isSuperpowerBoosts(cfg.boosts)) return null;
  const gdp = BASELINE[cfg.focusCode].gdp;
  if (gdp >= ENDOW_GDP_MAX) return null;
  return { code: cfg.focusCode, from: gdp, to: ENDOW_GDP_TARGET };
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
  f: number; // dominant faith index (religion layer — parallel track, feeds nothing else)
}

/** One year's religion standings: share of world population living in
 *  countries where this faith is dominant, plus the country count. */
export interface FaithStanding {
  faith: string; // faith id (lib/religion FAITHS)
  name: string;
  popShare: number; // percent of world population, 1dp
  countries: number;
}

export type EventKind = "shock" | "annex" | "breakaway" | "overtake" | "focus" | "crisis" | "intervention" | "faith" | "fold";
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
  faithLeaders: FaithStanding[][]; // religion standings per year, largest first
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
  /* sustained-pressure strain (annexation tuning — see GEOSTORY_TUNING.md):
     a dominant adjacent bloc grinds a neighbour's effective stability down
     over years instead of the pressure resetting annually */
  strain: number; strainFrom: number; siegeBase: number;
  /* catch-up momentum (small-nation package): a temporary dividend paid
     on annexation / fold-in — growth points and an influence-gravity
     bonus, both decaying ~20%/yr. Zero unless the country has recently
     taken territory, so dormant arithmetic is untouched until then */
  mom: number; momGrav: number;
  /* intervention state — all neutral by default, so legacy runs never move */
  techPush: number; techPushUntil: number;
  alignTo: number; alignMult: number; alignUntil: number;
  stabMin: number; stabMinUntil: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ---- sustained-pressure strain (deliberate balance change) -------------
 * The annexation gate needs effective stability < 0.50 SUSTAINED, but base
 * stability mean-reverts to each country's institutional anchor (~0.72 for
 * Mozambique) and the old pressure meter only ran once the gate was already
 * open — so no small state could ever crack a stable neighbour, no matter
 * the boosts (verified: 186+ diagnostic runs, zero annexations of stable
 * targets; a max-boosted Madagascar pressing Mozambique for 75 years
 * changed nothing). Now a challenger that could take the target BUT FOR
 * its stability — adjacent, ratio within reach of the gate's own bar, and
 * bloc power > 3× the target's own power — builds strain on it each year:
 * the grind of a determined neighbour, not background geopolitics. Strain
 * decays slowly (×0.96/yr, only in years with no presser) and mostly
 * evaporates when the presser changes, so it takes SUSTAINED dominance by
 * ONE presser — roughly a decade — to ground a stable state down. The
 * gate reads effective stability = base − strain. Where strain is 0
 * every number is the pre-change engine's. (First cut — a universal
 * ratio floor of 1.0 — put nearly every border on Earth under "pressure"
 * and dissolved the baseline world, 245 → 1,446 annexations across the
 * standard panel; the qualifying conditions above are what keep this a
 * siege mechanic rather than a solvent.) Full rationale + measured
 * effects: GEOSTORY_TUNING.md.
 *
 * The dynamics matter as much as the gate: against a micro-state a great
 * power's local ratio is 10–100×, so strain is an EQUILIBRIUM, not a
 * ratchet — it heals ×(1 − STRAIN_HEAL) every year while the presser's
 * grind (sub-linear in its ratio excess, hard-capped per year) is added
 * on top, and the grind is divided across every siege the presser is
 * running at once. Steady background dominance equilibrates at low
 * strain and never cracks a stable state; a focused neighbour whose
 * grip keeps strengthening equilibrates high and, after roughly a
 * decade, brings its target to the gate. */
const STRAIN_FLOOR_MARGIN = 0.3; // presser ratio must clear ratioNeeded − this to start the grind
const STRAIN_RATE = 0.06; // strain per year per unit of (ratio excess)^0.7 above that floor
const STRAIN_GAIN_CAP = 0.06; // max strain any target can gain in one year, before siege dilution
const STRAIN_MAX = 0.45; // a state can be ground down at most this far below its anchor
const STRAIN_HEAL = 0.08; // fraction of strain that heals every year, besieged or not
const STRAIN_INHERIT = 0.25; // fraction of strain kept when the presser changes
const STRAIN_INFLUENCE = 0.2; // strain at which the presser counts as the dominant influence for the gate, and annexation pressure may pre-accumulate

/* ---- catch-up momentum (small-nation package) --------------------------
 * On every annexation and fold-in the presser banks a TEMPORARY dividend:
 * extra growth points and extra influence gravity, decaying ×0.78/yr
 * (a ~5-year tail). The award fades linearly to ZERO as the presser's
 * share of world bloc power approaches MOM_SHARE_SCALE: a micro-state
 * snowballs at full strength; a hegemon — 10%+ of a fragmented world's
 * power is already hegemony — gets nothing. This is deliberately NOT the
 * permanent per-annexation growth dividend measured and rejected in the
 * strain tuning (that one compounded forever, fed the biggest annexers
 * most, and pushed the dormant panel 565 → 730 annexations with top
 * blocs at 5,400–12,600), and the share scale is load-bearing, not
 * decoration: a naive (1 − share) factor still pays a 30%-share leader
 * 65% strength, which the dormant panel showed balloons its top bloc
 * 2.5–5×. Temporary + share-scaled-to-zero + capped is the whole design;
 * the dormant panel is the guard. Formula:
 *   f = clamp(1 − share / 0.10, 0, 1),  share = blocPow[p] / Σ blocPow
 *   award_growth = min(CAP, mom + 3.2 × f)
 *   award_gravity = min(CAP, momGrav + 0.5 × f)                      */
const MOM_GROW_PER_EVENT = 3.2; // growth points banked per take, at zero world share
const MOM_GROW_CAP = 4.5; // hard cap on banked growth points
const MOM_GRAV_PER_EVENT = 0.5; // influence-gravity fraction banked per take, at zero share
const MOM_GRAV_CAP = 0.65; // hard cap on banked gravity bonus
const MOM_SHARE_SCALE = 0.1; // award fades to zero at this share of world bloc power
const MOM_DECAY = 0.78; // yearly retention — a ~5-year tail

/* ---- influence fold-in (small-nation package) ---------------------------
 * The peaceful path below the war gate — the first-domino mechanic for a
 * rising small power, which usually cannot besiege anyone for decades.
 * All conditions must hold (checked yearly, after the annexation pass):
 * the same power has been the target's #1 influencer for FOLD_STREAK_YEARS
 * consecutive years; the target's (raw) stability is under FOLD_STAB_MAX;
 * the presser's bloc power is at least FOLD_POWER_RATIO × the target's;
 * the target is neither a top-10 power nor a flagged major; and the
 * presser has not folded anyone in the last FOLD_COOLDOWN_YEARS years.
 * The fold is annexation-shaped for controller/bloc accounting but is
 * not a war: no strain, no stability shock, its own event kind, and it
 * pays momentum like a take. Clients (non-sovereigns) never fold others:
 * the presser must be sovereign and is judged on its own bloc power. */
const FOLD_STREAK_YEARS = 5;
const FOLD_STAB_MAX = 0.5;
const FOLD_POWER_RATIO = 1.5;
const FOLD_COOLDOWN_YEARS = 3;

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
      strain: 0, strainFrom: -1, siegeBase: 0,
      mom: 0, momGrav: 0,
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
  /* small-nation endowment: applied to the starting state before the
   * first year ticks, so the year-0 snapshot already shows the lifted
   * base (mil follows automatically — it is derived from GDP each year).
   * A deterministic function of the config (see endowmentFor), so share
   * links and replays carry it exactly. Announced in the chronicle. */
  const endow = endowmentFor(cfg);
  if (endow && focusIdx !== undefined) {
    st[focusIdx].gdp = endow.to;
    events.push({
      year: START_YEAR, kind: "focus",
      text: `🚀 Small-nation endowment — ${COUNTRIES[focusIdx].name} starts with a great-power economic base (≈$${Math.round(endow.to * 1000)}B), not its own $${Math.round(endow.from * 1000)}B. On a Superpower run, the fantasy is the base as well as the boosts.`,
    });
  }
  const years: CountrySnap[][] = [];
  const leaders: { code: string; power: number }[][] = [];
  const attrib: AttribSnap[][] = [];
  /* religion track state — separate arrays, never written back into the
     power state, and the religion step below draws no RNG, so every
     pre-religion field of every run stays exactly as the engine without
     this layer would produce it */
  const faithDom: number[] = [...COUNTRY_FAITH];
  const faithPress: number[][] = COUNTRIES.map(() => new Array(FAITH_COUNT).fill(0));
  const faithLastFlip: number[] = COUNTRIES.map(() => -99);
  const faithLeaders: FaithStanding[][] = [];
  let prevTopFaith = -1;
  let focusFaithLed = false;
  /** net growth shock applied per country this year (attribution only) */
  const yrShock = new Array(N).fill(0);
  /** chokepoint hardening from interventions: strait id → year it lapses */
  const hardenUntil: Record<string, number> = {};
  const name = (i: number) => COUNTRIES[i].name;
  let prevTop: string[] = [];
  let focusBestRank = 999;
  const lastAnnexYear = new Map<number, number>();
  /* fold-in state: per-country #1-influencer streaks + per-power cooldown */
  const inflStreakWho = new Int32Array(N).fill(-1);
  const inflStreakYears = new Int32Array(N).fill(0);
  const lastFoldYear = new Map<number, number>();
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
          (1 - s.stab) * 2.2 + s.growthMod - convergence + rng.range(-0.7, 0.7) + s.mom;
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
        s.mom *= MOM_DECAY; s.momGrav *= MOM_DECAY; // momentum fades (~5-year tail)
        if (s.ctrl !== i) s.yearsCtrl++;
      }

      /* ---- power, influence, dominance ---- */
      const mil = st.map((s) => s.gdp * 1000 * s.milShare);
      const pow = st.map((s, i) => ownPower(s.gdp, mil[i], s.tech, s.stab));
      const effGdp = new Array(N).fill(0), effMil = new Array(N).fill(0);
      for (let i = 0; i < N; i++) { effGdp[st[i].ctrl] += st[i].gdp * (st[i].ctrl === i ? 1 : 0.38); effMil[st[i].ctrl] += mil[i] * (st[i].ctrl === i ? 1 : 0.25); }
      const blocPow = st.map((s, i) => (s.ctrl === i ? ownPower(effGdp[i], Math.max(effMil[i], mil[i]), s.tech, s.stab) : 0));
      /* catch-up momentum: the award scales with (1 − the presser's
       * share of world bloc power) and is hard-capped — see the momentum
       * constants. Zero for everyone until a take happens. */
      const worldPow = blocPow.reduce((a, b) => a + b, 0);
      const awardMomentum = (p: number) => {
        const share = worldPow > 0 ? blocPow[p] / worldPow : 0;
        const f = clamp(1 - share / MOM_SHARE_SCALE, 0, 1);
        st[p].mom = Math.min(MOM_GROW_CAP, st[p].mom + MOM_GROW_PER_EVENT * f);
        st[p].momGrav = Math.min(MOM_GRAV_CAP, st[p].momGrav + MOM_GRAV_PER_EVENT * f);
      };
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
          const iv = (blocPow[p] * (0.3 + 0.7 * BASELINE[COUNTRIES[c].code].receptivity)) / (1 + Math.pow(d / 1700, 1.5)) * (adjB > 1 ? 1.45 : 1) * am * (1 + st[p].momGrav);
          if (iv > bestIV) { bestIV = iv; bestI = p; }
          const ev = effGdp[p] / (1 + Math.pow(d / 1400, 1.3)) * (adjB > 1 ? 1.5 : 1) * am;
          if (ev > bestEV) { bestEV = ev; bestE = p; }
        }
        infl[c] = bestI; econ[c] = bestE;
        inflVal[c] = bestIV; econVal[c] = bestEV;
      }
      lastInflVal = inflVal; lastEconVal = econVal;
      /* fold-in bookkeeping: consecutive years each country has spent
       * under the same dominant partner. The partner is the attrib
       * track's #1 influencer — EXCEPT where a neighbour's sustained
       * siege has already made it the decisive relationship: strain at
       * or beyond STRAIN_INFLUENCE deems the besieger the influencer
       * for this purpose, the same attribution the annexation gate's
       * influenceOk already uses (global gravity otherwise keeps
       * distant giants as every border state's "top influencer"
       * forever, and no rising neighbour could ever build the streak —
       * measured: a spec-literal streak hands the claimant's first
       * domino to a giant, e.g. DOM folds to the USA in 2037 while an
       * endowed Puerto Rico is still besieging it). The attrib track
       * itself stays raw gravity; only the fold streak is deemed. */
      for (let c = 0; c < N; c++) {
        let who = infl[c];
        if (st[c].strainFrom >= 0 && st[c].strain >= STRAIN_INFLUENCE &&
          st[c].strainFrom !== c && st[st[c].strainFrom].ctrl === st[c].strainFrom) {
          who = st[c].strainFrom;
        }
        if (who === inflStreakWho[c]) inflStreakYears[c]++;
        else { inflStreakWho[c] = who; inflStreakYears[c] = 1; }
      }

      /* ---- territorial change: influence + a wide gap + adjacency + deep
         instability, sustained over years. Deliberately rare — influence and
         market dominance are the normal outcomes; annexation is the exception. */
      const rankOf = new Map(sovereigns.map((sIdx, r) => [sIdx, r + 1]));
      /* strain pre-pass (start-of-year dispositions): which challenger, if
         any, is besieging each country this year, and how many sieges each
         presser is running at once. A bloc's grind is divided across its
         ACTIVE sieges, so a focused neighbour presses one target far
         harder than an empire pressing ten borders at once */
      const presser0 = new Int32Array(N).fill(-1);
      const ratio0 = new Float64Array(N);
      const floor0 = new Float64Array(N);
      const activeSieges = new Map<number, number>();
      for (let c0 = 0; c0 < N; c0++) {
        const ctrl0 = st[c0].ctrl;
        let bP = -1, bR = 0;
        const cand0 = new Set<number>();
        for (const j of ADJ[c0]) cand0.add(st[j].ctrl);
        for (const p of cand0) {
          if (p === ctrl0 || p === c0) continue;
          const ratio = blocPow[p] / (blocPow[ctrl0] * 0.55 + pow[c0] * 0.8 + 1);
          if (ratio > bR) { bR = ratio; bP = p; }
        }
        const needed0 = (ctrl0 === c0 && (rankOf.get(c0) ?? 99) <= 5) ? 3.2 : BASELINE[COUNTRIES[c0].code].major ? 2.6 : 1.9;
        const floor = needed0 - STRAIN_FLOOR_MARGIN;
        ratio0[c0] = bR; floor0[c0] = floor;
        const digesting0 = bP >= 0 && year - (lastAnnexYear.get(bP) ?? -99) < 3;
        if (bP >= 0 && !digesting0 && bR > floor && blocPow[bP] > pow[c0] * 3) {
          presser0[c0] = bP;
          activeSieges.set(bP, (activeSieges.get(bP) ?? 0) + 1);
        }
      }
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
        /* sustained pressure accumulates as strain (see tuning constants),
           judged on the start-of-year pre-pass: strain HEALS a little
           every year and the besieger's grind is added on top — an
           equilibrium, not a ratchet. Steady background dominance stalls
           at low strain; only a presser whose grip keeps strengthening,
           and who is not dividing it across many sieges, grinds a stable
           state down to the gate */
        const presser = presser0[c];
        st[c].strain *= 1 - STRAIN_HEAL;
        if (presser >= 0) {
          if (st[c].strainFrom !== presser) {
            st[c].strain *= STRAIN_INHERIT; st[c].strainFrom = presser;
            st[c].siegeBase = ratio0[c]; // the dominance this siege started from
          }
          /* strain grows only from TIGHTENING: the presser's dominance
             beyond both the floor and the level this siege started at
             (siegeBase). A state that has always lived beside a giant is
             adapted to that fact — steady dominance equilibrates at low
             strain — but a neighbour rapidly outgrowing it cracks it.
             The grind also widens as it deepens (×(1 + strain)): fresh
             pressure is shrugged off, entrenched pressure cracks
             institutions progressively */
          const excess = Math.max(0, ratio0[c] - Math.max(floor0[c], st[c].siegeBase));
          const gain = Math.min(STRAIN_GAIN_CAP, STRAIN_RATE * Math.pow(excess, 0.7)) *
            (1 + st[c].strain) / Math.max(1, activeSieges.get(presser) ?? 1);
          st[c].strain = Math.min(STRAIN_MAX, st[c].strain + gain);
        } else if (st[c].strain < 0.005) { st[c].strain = 0; st[c].strainFrom = -1; st[c].siegeBase = 0; }
        const effStab = st[c].stab - st[c].strain;
        /* the presser counts as the dominant influence once its grind is
           decisive (strain >= STRAIN_INFLUENCE): global gravity rankings
           otherwise keep distant giants as a border state's "top
           influencer" forever, and no neighbour could ever press a claim
           home — the exact wall this tuning removes */
        const influenceOk = infl[c] === bestP || (st[c].strainFrom === bestP && st[c].strain >= STRAIN_INFLUENCE);
        const canPress = !digesting && bestP >= 0 && influenceOk && bestRatio > ratioNeeded && blocPow[bestP] > pow[c] * 3;
        /* pressure accrues once the gate's stability condition is met — or,
           under a deep grind (strain >= STRAIN_INFLUENCE), just before it:
           the border slips while the state is being ground down, so the
           fall comes soon after effective stability cracks, not a further
           decade later. The flip itself still requires effStab < 0.50. */
        if (canPress && (effStab < 0.50 || st[c].strain >= STRAIN_INFLUENCE)) {
          if (st[c].pressureFrom !== bestP) { st[c].pressureFrom = bestP; st[c].pressure = 0; }
          st[c].pressure += (bestRatio - ratioNeeded) * (0.55 - effStab) * 0.95 * (1 + 6 * st[c].strain);
          if (effStab < 0.50 && st[c].pressure > 7) {
            const old = ctrl;
            st[c].ctrl = bestP; st[c].pressure = 0; st[c].pressureFrom = -1; st[c].yearsCtrl = 0;
            st[c].strain = 0; st[c].strainFrom = -1; st[c].siegeBase = 0;
            lastAnnexYear.set(bestP, year);
            awardMomentum(bestP);
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

      /* ---- influence fold-in: the peaceful path below the war gate.
         A sovereign state that has orbited the same #1 influencer for
         FOLD_STREAK_YEARS straight years, whose (raw) stability has
         slipped under FOLD_STAB_MAX, and which is outmatched by at least
         FOLD_POWER_RATIO× folds into that power's bloc as a client —
         the first domino a rising small power can actually reach, since
         it needs gravity, not a siege. Not a war: no strain, no
         stability shock, its own event kind; it pays momentum like a
         take. Majors and top-10 powers never fold; the presser must be
         sovereign (clients fold nobody) and observes a cooldown. */
      for (let c = 0; c < N; c++) {
        if (st[c].ctrl !== c) continue;
        const a = inflStreakWho[c];
        if (a < 0 || a === c || st[a].ctrl !== a) continue;
        if (inflStreakYears[c] < FOLD_STREAK_YEARS) continue;
        if (st[c].stab >= FOLD_STAB_MAX) continue;
        if (BASELINE[COUNTRIES[c].code].major) continue;
        if ((rankOf.get(c) ?? 99) <= 10) continue;
        if (blocPow[a] < FOLD_POWER_RATIO * blocPow[c]) continue;
        if (year - (lastFoldYear.get(a) ?? -99) < FOLD_COOLDOWN_YEARS) continue;
        /* contested states do not fold to a third party: a country under
         * active siege this year by a power other than the streak holder
         * is fighting over its future, not drifting into an orbit (the
         * siege's own deemed streak is building in the meantime) */
        if (presser0[c] >= 0 && presser0[c] !== a) continue;
        st[c].ctrl = a; st[c].yearsCtrl = 0;
        st[c].pressure = 0; st[c].pressureFrom = -1;
        st[c].strain = 0; st[c].strainFrom = -1; st[c].siegeBase = 0;
        lastFoldYear.set(a, year);
        awardMomentum(a);
        events.push({ year, kind: "fold", text: `${name(c)} folds into ${name(a)}'s orbit — ${FOLD_STREAK_YEARS} years as its closest partner, a wobbling state and a wide power gap end with a client flag, not a war.` });
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

      /* ---- religion: a parallel dominance track (v1). Faith pressure is
         receptivity × gravity over DISTANCE — faiths cross oceans with
         migration and trade, so no country is structurally locked out.
         Pure function of current state: no RNG draws, and faith never
         feeds power, influence, economy or annexation. ---- */
      {
        const T = FAITH_TUNING;
        // radiation per country: adherents × soft power (tech) × ascendancy
        // (a country that has risen far above its starting GDP radiates
        // its culture — and its faith — harder)
        const rad = st.map((s, i) => {
          const asc = clamp((s.tech - 55) / 45, 0, 1) *
            clamp(Math.log10(Math.max(s.gdp, 0.001) / Math.max(BASELINE[COUNTRIES[i].code].gdp, 0.001)), 0, 1);
          return Math.pow(s.pop * FAITH_SHARE[i], T.radiationExponent) * (0.55 + 0.45 * (s.tech / 100)) * (1 + 0.5 * asc);
        });
        const members: number[][] = FAITHS.map(() => []);
        for (let j = 0; j < N; j++) members[faithDom[j]].push(j);
        for (let c = 0; c < N; c++) {
          const inc = faithDom[c];
          const scores = new Array(FAITH_COUNT).fill(0);
          for (let f = 0; f < FAITH_COUNT; f++) {
            // root-sum-square aggregation: exposure follows the strongest
            // channels with diminishing returns from extra sources — a
            // faith with 51 homelands must not win everywhere by headcount
            let sumSq = 0;
            for (const j of members[f]) {
              const d = j === c ? 0 : DIST[c * N + j];
              const v = rad[j] / (1 + Math.pow(d / T.distScaleKm, T.distExponent));
              sumSq += v * v;
            }
            const g0 = Math.sqrt(sumSq);
            if (g0 === 0) continue;
            let g = g0;
            if (f !== inc && ADJ[c].some((j) => faithDom[j] === f)) g *= T.neighbourBonus;
            if (faithDom[infl[c]] === f) g *= T.influencerBonus;
            if (faithDom[st[c].ctrl] === f) g *= T.controllerBonus;
            scores[f] = g * FAITHS[f].spread;
          }
          // the home faith defends itself: institutions and transmission.
          // A small nation's religious identity is NOT proportionally
          // weaker than a giant's — the defence has a per-country base
          scores[inc] += Math.pow(st[c].pop * FAITH_SHARE[c], T.radiationExponent) * 1.2 + T.homeBase * FAITH_SHARE[c];
          for (let f = 0; f < FAITH_COUNT; f++) faithPress[c][f] *= T.pressureDecay;
          let best = -1, bestScore = 0;
          for (let f = 0; f < FAITH_COUNT; f++) {
            if (f !== inc && scores[f] > bestScore) { bestScore = scores[f]; best = f; }
          }
          const incScore = scores[inc];
          if (best >= 0 && bestScore > incScore && incScore > 0) {
            faithPress[c][best] += Math.min((bestScore / incScore - 1) * T.pressureRate, T.pressureCap);
          }
          /* conversion channel: if the country's top influencer is a
             genuinely dominant power of another faith — and that faith
             already has a real presence here — its pressure builds
             generationally. Empire and orbit convert, as they did
             historically, but only where the faith has already landed */
          const p = infl[c];
          if (p !== c && faithDom[p] !== inc && scores[faithDom[p]] >= T.conversionPresence * incScore) {
            const r = blocPow[p] / (pow[c] + 1);
            if (r > T.conversionThreshold) {
              faithPress[c][faithDom[p]] += Math.min(r - T.conversionThreshold, T.conversionCapRatio) * T.conversionRate;
            }
          }
          /* flip check: highest accumulated pressure wins the country */
          let flipTo = -1, flipPress = 0;
          for (let f = 0; f < FAITH_COUNT; f++) {
            if (f !== inc && faithPress[c][f] > flipPress) { flipPress = faithPress[c][f]; flipTo = f; }
          }
          if (flipTo >= 0 && flipPress > T.flipPressure && year - faithLastFlip[c] >= T.flipCooldownYears) {
            const old = inc;
            faithDom[c] = flipTo;
            faithPress[c].fill(0);
            faithLastFlip[c] = year;
            if (st[c].pop >= 15 || c === focusIdx || flipTo === prevTopFaith || old === prevTopFaith) {
              events.push({ year, kind: "faith", text: `${name(c)}'s dominant faith becomes ${FAITHS[flipTo].name} — a generation of migration, trade and cultural gravity outweighs the old incumbent, ${FAITHS[old].name}.` });
            }
          }
        }
      }
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
      f: faithDom[i],
    })));
    leaders.push(sovNow.slice(0, 10).map((i) => ({ code: COUNTRIES[i].code, power: Math.round(blocNow[i] * 10) / 10 })));
    /* religion standings for the year (parallel track — read-only) */
    {
      const totalPop = st.reduce((a, s) => a + s.pop, 0);
      const standings: FaithStanding[] = FAITHS.map((fd, fi) => {
        let pop = 0, n = 0;
        for (let i = 0; i < N; i++) if (faithDom[i] === fi) { pop += st[i].pop; n++; }
        return { faith: fd.id, name: fd.name, popShare: Math.round((pop / Math.max(totalPop, 0.001)) * 1000) / 10, countries: n };
      }).filter((x) => x.countries > 0).sort((a, b) => b.popShare - a.popShare);
      faithLeaders.push(standings);
      const topFaith = FAITH_IDX.get(standings[0].faith)!;
      if (yi > 0 && prevTopFaith >= 0 && topFaith !== prevTopFaith) {
        events.push({ year, kind: "faith", text: `${standings[0].name} becomes the world's largest faith — ${standings[0].popShare.toFixed(1)}% of humanity now lives under its banner.` });
      }
      if (focusIdx !== undefined && topFaith === faithDom[focusIdx] && !focusFaithLed) {
        focusFaithLed = true;
        if (yi > 0) {
          events.push({ year, kind: "faith", text: `The faith of ${name(focusIdx)} — ${standings[0].name} — now leads the world, the heartland's gravity made global.` });
        }
      }
      prevTopFaith = topFaith;
    }
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

  return { years, events, leaders, attrib, faithLeaders };
}
