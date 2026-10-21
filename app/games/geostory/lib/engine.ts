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

export interface SimConfig {
  scenarioId: string;
  seed: string;
  focusCode?: string;
  boosts: Boosts;
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

export type EventKind = "shock" | "annex" | "breakaway" | "overtake" | "focus" | "crisis";
export interface SimEvent {
  year: number;
  kind: EventKind;
  text: string;
}

export interface SimResult {
  years: CountrySnap[][]; // [yearIdx][countryIdx]
  events: SimEvent[];
  leaders: { code: string; power: number }[][]; // top 10 per year
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
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function ownPower(gdp: number, mil: number, tech: number, stab: number): number {
  return Math.pow(Math.max(gdp, 0.001), 0.6) *
    Math.pow(Math.max(mil, 0.05) * (0.4 + tech / 125), 0.4) * (0.72 + 0.28 * stab);
}

export function runSimulation(cfg: SimConfig): SimResult {
  const scenario = getScenario(cfg.scenarioId);
  const mods: ScenarioMods = scenario.mods;
  const rng = new Rng([cfg.seed, cfg.scenarioId, cfg.focusCode ?? "", cfg.boosts.growth, cfg.boosts.tech, cfg.boosts.military, cfg.boosts.resources].join("|"));
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
    };
  });
  const applyBoostMap = (map: Record<string, { growth?: number; tech?: number; resources?: number; milMult?: number }>) => {
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
      if (m.milMult) { st[i].milShare *= m.milMult; st[i].baseShare *= m.milMult; }
    }
  };
  applyBoostMap(mods.boosts);
  if (focusIdx !== undefined) {
    const b = cfg.boosts;
    st[focusIdx].growthAdd += (b.growth / 100) * 3.2;
    st[focusIdx].tech = clamp(st[focusIdx].tech + (b.tech / 100) * 14, 5, 100);
    st[focusIdx].techMod += (b.tech / 100) * 0.22;
    st[focusIdx].milShare *= 1 + (b.military / 100) * 1.6;
    st[focusIdx].baseShare *= 1 + (b.military / 100) * 1.6;
    const r = (b.resources / 100) * 42;
    st[focusIdx].energy = clamp(st[focusIdx].energy + r, 0, 100);
    st[focusIdx].minerals = clamp(st[focusIdx].minerals + r, 0, 100);
    st[focusIdx].food = clamp(st[focusIdx].food + r * 0.7, 0, 100);
  }

  const events: SimEvent[] = [];
  const years: CountrySnap[][] = [];
  const leaders: { code: string; power: number }[][] = [];
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

  /* ------------------------------------------------------------ helpers */
  const hydroHit = (region: string, mult: number, label: string, year: number) => {
    const codes = REGIONS[region] ?? [];
    for (const code of codes) {
      const i = CODE_IDX.get(code);
      if (i === undefined) continue;
      st[i].growthMod -= rng.range(1.0, 2.6) * mult;
      st[i].stab = clamp(st[i].stab - rng.range(0.02, 0.055) * mult, 0.04, 0.97);
      st[i].food = clamp(st[i].food - rng.range(2, 6) * mult, 0, 100);
    }
    events.push({ year, kind: "shock", text: `${label} — drought and hydroclimate stress hammer the ${region.replace(/([A-Z])/g, " $1").toLowerCase()} belt; harvests, growth and stability all slip.` });
  };
  const chokepointHit = (which: "hormuz" | "suez" | "panama", mult: number, year: number) => {
    const label = which === "hormuz" ? "Strait of Hormuz" : which === "suez" ? "Suez Canal" : "Panama Canal";
    for (let i = 0; i < N; i++) {
      const isGulf = GULF.includes(COUNTRIES[i].code);
      if (which === "hormuz" && isGulf) { st[i].growthMod -= 1.5 * mult; continue; }
      if (st[i].energy < 35) st[i].growthMod -= (which === "hormuz" ? 1.3 : 0.9) * mult;
      if (st[i].energy > 75 && !isGulf) st[i].growthMod += 0.85 * mult; // alternative suppliers cash in
      if (which !== "hormuz" && st[i].tech > 72 && st[i].energy < 40) st[i].growthMod -= 0.7 * mult;
    }
    events.push({ year, kind: "shock", text: `${label} closed — energy and trade shock ripples worldwide; importers stall while rival exporters cash in.` });
  };

  /* ------------------------------------------------------------ main loop */
  for (let yi = 0; yi < YEARS; yi++) {
    const year = START_YEAR + yi;

    if (yi > 0) {
      /* ---- scripted scenario events ---- */
      for (const s of mods.scripted) {
        if (s.year !== year) continue;
        if (s.kind === "hormuz") chokepointHit("hormuz", 1.8, year);
        else if (s.kind === "suez") chokepointHit("suez", 1.5, year);
        else if (s.kind.startsWith("drought:")) hydroHit(s.kind.slice(8), 1.5, "Megadrought", year);
      }
      /* ---- Stratatir event deck (random shocks) ---- */
      const roll = rng.next();
      const hydroP = 0.15 * mods.hydroFreq;
      if (roll < hydroP) {
        hydroHit(rng.pick(Object.keys(REGIONS)), 1, "Climate shock", year);
      } else if (roll < hydroP + 0.09 * mods.energyVol) {
        chokepointHit(rng.pick(["hormuz", "suez", "panama"] as const), 1, year);
      } else if (roll < hydroP + 0.09 * mods.energyVol + 0.11) {
        const cand: number[] = [];
        for (let i = 0; i < N; i++) if ((st[i].minerals > 45 || st[i].energy > 45) && st[i].gdp < 3.2) cand.push(i);
        if (cand.length) {
          const i = rng.pick(cand);
          if (rng.chance(0.5)) st[i].minerals = clamp(st[i].minerals + 20, 0, 100);
          else st[i].energy = clamp(st[i].energy + 20, 0, 100);
          st[i].growthMod += 1.3;
          events.push({ year, kind: "shock", text: `Major resource discovery in ${name(i)} — a boom begins and the region's maths changes overnight.` });
        }
      } else if (roll < hydroP + 0.09 * mods.energyVol + 0.22) {
        const byTech = [...Array(N).keys()].sort((a, b) => st[b].tech - st[a].tech).slice(0, 12);
        const i = rng.pick(byTech);
        st[i].tech = clamp(st[i].tech + rng.range(3.5, 6.5), 5, 100);
        st[i].growthMod += 0.55;
        events.push({ year, kind: "shock", text: `Tech breakthrough in ${name(i)} — a leap in capability the rest of the world must now answer.` });
      } else if (roll < hydroP + 0.09 * mods.energyVol + 0.29) {
        for (let i = 0; i < N; i++) { st[i].growthMod -= 1.05; if (st[i].stab < 0.6) st[i].stab = clamp(st[i].stab - 0.02, 0.04, 0.97); }
        events.push({ year, kind: "shock", text: `Global financial crisis — credit seizes up and growth stalls almost everywhere at once.` });
      } else if (roll < 0.97 && rng.chance(0.10)) {
        const rich: number[] = [];
        for (let i = 0; i < N; i++) if (st[i].minerals >= 72) rich.push(i);
        for (const i of rich) st[i].growthMod += 0.8;
        if (rich.length) events.push({ year, kind: "shock", text: `Critical-minerals rush — the battery age bids up every mineral-rich state on the map.` });
      }

      /* ---- growth / tech / population / stability ---- */
      let pandemic = false;
      if (rng.chance(0.028)) { pandemic = true; events.push({ year, kind: "crisis", text: `Pandemic year — borders close, output dips, and every capital is distracted at once.` }); }
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
        if (pandemic) g -= 1.6;
        if (s.stab < 0.2) g -= 1.8; // state failure trap
        s.gdp = Math.max(0.001, s.gdp * (1 + g / 100));
        let pr = clamp(1.5 - gdppcK * 0.02 + (IS_AFRICA[i] ? 0.55 : 0) + (s.stab < 0.4 ? 0.25 : 0), -0.5, 2.8);
        if (pandemic) pr -= 0.5;
        s.pop = Math.max(0.05, s.pop * (1 + pr / 100));
        // tech: own research + diffusion from ahead neighbours
        let diffusion = 0;
        for (const j of ADJ[i]) if (st[j].tech > s.tech + 6) diffusion = Math.max(diffusion, (st[j].tech - s.tech) * 0.02);
        s.tech = clamp(s.tech + ((0.22 + gdppcK * 0.006 + s.techMod) * mods.techMult + diffusion) * (1 - s.tech / 135), 5, 100);
        s.milShare += (s.baseShare - s.milShare) * 0.05;
        // stability reverts toward the country's own institutional anchor —
        // slow growth alone doesn't dissolve a state, shocks do
        s.stab = clamp(s.stab + (base.stability - s.stab) * 0.05 + (g - 2.0) * 0.003 - (s.ctrl !== i ? 0.004 : 0) + rng.range(-0.012, 0.012), 0.04, 0.97);
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
          const iv = (blocPow[p] * (0.3 + 0.7 * BASELINE[COUNTRIES[c].code].receptivity)) / (1 + Math.pow(d / 1700, 1.5)) * (adjB > 1 ? 1.45 : 1);
          if (iv > bestIV) { bestIV = iv; bestI = p; }
          const ev = effGdp[p] / (1 + Math.pow(d / 1400, 1.3)) * (adjB > 1 ? 1.5 : 1);
          if (ev > bestEV) { bestEV = ev; bestE = p; }
        }
        infl[c] = bestI; econ[c] = bestE;
      }

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
            st[c].stab = clamp(st[c].stab - 0.07, 0.04, 0.97); st[c].growthMod -= 1.1;
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
  }

  return { years, events, leaders };
}
