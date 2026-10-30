/**
 * Victory ladder (improvements item 4) — NO engine changes: tiers are
 * computed from live snapshots after the fact, for the claimed country.
 *
 *   Fallen             not sovereign (held by another power)
 *   Survivor           sovereign at the year in question
 *   Regional Power     top-25 in the world OR the largest power in its region
 *   Regional Hegemon   top-10 AND the largest power in its region
 *   Continental Power  top-5 in the world
 *   World Power        № 1 — or its faith is the world's № 1 while it sits top-3
 *
 * Regions: lib/regions (a complete partition of the 175). Thresholds are
 * documented in GEOSTORY_TUNING.md.
 */
import { COUNTRIES } from "./data";
import type { SimResult } from "./engine";
import { FAITH_IDX } from "./religion";
import { REGION_OF } from "./regions";

export const LADDER_TIERS = ["Fallen", "Survivor", "Regional Power", "Regional Hegemon", "Continental Power", "World Power"] as const;
export type LadderTierName = (typeof LADDER_TIERS)[number];

export interface LadderStatus {
  tier: LadderTierName;
  tierIdx: number; // index into LADDER_TIERS
  next: LadderTierName | null;
  gap: string | null; // exact plain-language gap to the next tier (null at the top)
  region: string;
  regionLeaderName: string | null;
  isRegionLeader: boolean;
  rank: number | null; // world rank among sovereigns by bloc power; null when held
  faithLed: boolean; // this country's dominant faith is the world's leading faith
}

const nm = (i: number): string => COUNTRIES[i]?.name ?? "?";

export function ladderAt(result: SimResult, yearIdx: number, idx: number): LadderStatus {
  const snaps = result.years[yearIdx];
  const me = snaps[idx];
  const region = REGION_OF[idx];
  const sovereigns = snaps
    .map((s, i) => ({ i, bloc: s.bloc }))
    .filter((x) => x.bloc > 0)
    .sort((a, b) => b.bloc - a.bloc);
  const regionLeader = sovereigns.find((x) => REGION_OF[x.i] === region) ?? null;
  const isRegionLeader = regionLeader !== null && regionLeader.i === idx;
  const rank = me.c === idx ? sovereigns.findIndex((x) => x.i === idx) + 1 : null;
  const topFaith = result.faithLeaders[yearIdx]?.[0];
  const faithLed = topFaith !== undefined && FAITH_IDX.get(topFaith.faith) === me.f;

  let tierIdx = 0;
  if (rank !== null) {
    tierIdx = 1;
    if (rank <= 25 || isRegionLeader) tierIdx = 2;
    if (rank <= 10 && isRegionLeader) tierIdx = 3;
    if (rank <= 5) tierIdx = 4;
    if (rank === 1 || (faithLed && rank <= 3)) tierIdx = 5;
  }

  const leaderName = regionLeader ? nm(regionLeader.i) : null;
  let gap: string | null = null;
  if (tierIdx === 0) {
    gap = `regain sovereignty — ${nm(me.c)} holds the country now`;
  } else if (tierIdx === 1) {
    gap = `needs top 25, or the largest bloc in ${region} — you are № ${rank}${leaderName ? `; ${leaderName} leads ${region}` : ""}`;
  } else if (tierIdx === 2) {
    if (rank !== null && rank > 10 && !isRegionLeader) gap = `needs top 10 AND the largest bloc in ${region} — you are № ${rank}, and ${leaderName} leads ${region}`;
    else if (rank !== null && rank > 10) gap = `needs top 10 — you are № ${rank} (you already lead ${region})`;
    else gap = `needs the largest bloc in ${region} — ${leaderName} leads it; you are № ${rank}`;
  } else if (tierIdx === 3) {
    gap = `needs top 5 — you are № ${rank}`;
  } else if (tierIdx === 4) {
    gap = `needs № 1 — or the world's leading faith while in the top 3 — you are № ${rank}`;
  }

  return {
    tier: LADDER_TIERS[tierIdx],
    tierIdx,
    next: tierIdx < LADDER_TIERS.length - 1 ? LADDER_TIERS[tierIdx + 1] : null,
    gap,
    region,
    regionLeaderName: leaderName,
    isRegionLeader,
    rank,
    faithLed,
  };
}

/** the ladder at the run's final year — the end-of-century verdict */
export function finalLadder(result: SimResult, idx: number): LadderStatus {
  return ladderAt(result, result.years.length - 1, idx);
}

/** world rank by year for one country (null in years it was held) —
 *  the recap card's rank-trajectory sparkline source */
export function rankByYear(result: SimResult, idx: number): (number | null)[] {
  return result.years.map((snaps) => {
    if (snaps[idx].c !== idx) return null;
    let r = 1;
    for (const s of snaps) if (s.bloc > snaps[idx].bloc) r++;
    return r;
  });
}
