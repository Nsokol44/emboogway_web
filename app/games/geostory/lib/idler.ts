/**
 * The Idler — GeoStory's living-world (Director) layer for the web sim.
 *
 * The engine is deterministic and computes the whole century up front, so
 * "the world kept turning while you were away" needs no simulation at all:
 * elapsed real time converts to a number of years at the saved pace, and
 * the playback position simply lands further along the same history.
 * Wall-clock time never enters the engine — it only moves the playhead.
 *
 * Everything here is presentation/persistence: paces, ranks read off the
 * precomputed snapshots, headline ranking for the Away card, and the
 * localStorage record that lets a claimed world resume on a return visit.
 */
import { CODE_IDX, COUNTRIES } from "./data";
import { simKey, SUPERPOWER_BOOSTS, type Boosts, type SimConfig, type SimEvent, type SimResult } from "./engine";

/* ------------------------------------------------------------------ paces */
export type PaceId = "paused" | "watchful" | "brisk";

export interface PaceDef {
  id: PaceId;
  label: string;
  short: string;
  /** years per real second while the page is open and the clock runs */
  yearsPerSecond: number;
  /** years accrued per real hour while the visitor is away */
  awayYearsPerHour: number;
  blurb: string;
}

export const PACES: PaceDef[] = [
  {
    id: "paused", label: "PAUSED", short: "❚❚", yearsPerSecond: 0, awayYearsPerHour: 0,
    blurb: "Time moves only when you step it.",
  },
  {
    id: "watchful", label: "WATCHFUL", short: "WATCH", yearsPerSecond: 0.1, awayYearsPerHour: 2,
    blurb: "A year every 10 seconds while you watch — and about two years an hour while you're away.",
  },
  {
    id: "brisk", label: "BRISK", short: "BRISK", yearsPerSecond: 2, awayYearsPerHour: 12,
    blurb: "Two years a second while you watch — and about twelve years an hour while you're away.",
  },
];

export const paceDef = (id: PaceId): PaceDef => PACES.find((p) => p.id === id) ?? PACES[0];

/** a returning world never fast-forwards past this many years at once */
export const AWAY_CAP_YEARS = 25;

/** the one-click "what if X became a superpower" preset — an ordinary run
 *  config (focus + all-in boosts beyond the slider range), so the take is
 *  deterministic, shareable and re-recordable like any other run */
/* the definition lives in engine.ts — the endowment rule keys off the
 * exact profile — and is re-exported here for existing importers */
export { SUPERPOWER_BOOSTS };

/* ------------------------------------------------------- run identity */
/** A claim anchors to a run's LINEAGE: the full sim key minus interventions.
 *  Spending influence steers the same world (the claim survives); changing
 *  seed/scenario/boosts/deck/modifiers starts a new century (it doesn't). */
export function lineageKey(cfg: SimConfig): string {
  return simKey({ ...cfg, interventions: [] });
}

/* ------------------------------------------------------------------ ranks */
/** 1-based rank among sovereign powers at a snapshot, by bloc power.
 *  null when the country is held by another power that year. */
export function rankAt(result: SimResult, yearIdx: number, idx: number): number | null {
  const row = result.years[yearIdx];
  if (!row) return null;
  const snap = row[idx];
  if (!snap || snap.bloc <= 0) return null;
  let rank = 1;
  for (const s of row) if (s.bloc > snap.bloc) rank++;
  return rank;
}

/* ------------------------------------------------------------- event sites */
const NAMES_BY_LENGTH: [string, number][] = COUNTRIES
  .map((c, i) => [c.name, i] as [string, number])
  .sort((a, b) => b[0].length - a[0].length);

function idxOfName(name: string): number | null {
  for (const [n, i] of NAMES_BY_LENGTH) if (n === name) return i;
  const j = COUNTRIES.findIndex((c) => c.name === name);
  return j >= 0 ? j : null;
}

/** Where a chronicle event happened, for map pulses and the cinema camera.
 *  Annexations point at the country that fell; everything else at the first
 *  country it names. Global events (crises, strait closures) have no site. */
export function eventSiteIdx(e: SimEvent): number | null {
  const annex = /takes control of (.+?) —/.exec(e.text);
  if (annex) return idxOfName(annex[1].trim());
  let best: number | null = null;
  let bestPos = Infinity;
  for (const [name, i] of NAMES_BY_LENGTH) {
    const pos = e.text.indexOf(name);
    if (pos >= 0 && pos < bestPos) { bestPos = pos; best = i; }
  }
  return best;
}

/* ------------------------------------------------------------ major events */
export const MAJOR_EVENT_KINDS = new Set<SimEvent["kind"]>(["annex", "overtake", "crisis"]);
export const isMajorEvent = (e: SimEvent): boolean => MAJOR_EVENT_KINDS.has(e.kind);

const KIND_WEIGHT: Record<string, number> = {
  annex: 5, overtake: 5, crisis: 4, fold: 4, breakaway: 3, faith: 3, shock: 2, focus: 2, intervention: 1,
};

/** Away-card ranking tier: 0 = touches the claim, 1 = touches a neighbour
 *  of the claim, 2 = the rest of the world. */
export function headlineTier(e: SimEvent, claimIdx: number): number {
  if (e.text.includes(COUNTRIES[claimIdx].name)) return 0;
  for (const code of COUNTRIES[claimIdx].adj) {
    const j = CODE_IDX.get(code);
    if (j !== undefined && e.text.includes(COUNTRIES[j].name)) return 1;
  }
  return 2;
}

export interface AwayHeadline { event: SimEvent; tier: number }

/** Pick the ≤max headlines of a catch-up window — the claim's news first,
 *  then its neighbours', then the world's biggest shocks — and present
 *  them in the order they happened. */
export function awayHeadlines(events: SimEvent[], fromYear: number, toYear: number, claimIdx: number, max = 5): AwayHeadline[] {
  const inWindow = events.filter((e) => e.year > fromYear && e.year <= toYear);
  const picked = [...inWindow]
    .sort((a, b) =>
      headlineTier(a, claimIdx) - headlineTier(b, claimIdx) ||
      (KIND_WEIGHT[b.kind] ?? 1) - (KIND_WEIGHT[a.kind] ?? 1) ||
      a.year - b.year)
    .slice(0, max);
  return picked
    .map((event) => ({ event, tier: headlineTier(event, claimIdx) }))
    .sort((a, b) => a.event.year - b.event.year);
}

/* ---------------------------------------------------------------- catch-up */
export interface CatchUp {
  years: number;
  /** the raw elapsed accrual exceeded the cap (the world "rested") */
  capped: boolean;
  fromYearIdx: number;
  toYearIdx: number;
}

export function computeCatchUp(savedYearIdx: number, savedAt: number, now: number, pace: PaceId, maxYearIdx: number): CatchUp {
  const rate = paceDef(pace).awayYearsPerHour;
  /* a clock that moved backwards counts as no time away, never negative */
  const elapsedHours = Math.max(0, (now - savedAt) / 3_600_000);
  const raw = Math.floor(elapsedHours * rate);
  const years = Math.max(0, Math.min(raw, AWAY_CAP_YEARS, maxYearIdx - savedYearIdx));
  return { years, capped: raw > AWAY_CAP_YEARS && years >= AWAY_CAP_YEARS, fromYearIdx: savedYearIdx, toYearIdx: savedYearIdx + years };
}

/* -------------------------------------------------------------- persistence */
export interface IdlerRecord {
  v: 1;
  claimCode: string | null;
  panelId: number | null;
  lineage: string | null;
  pace: PaceId;
  savedAt: number;
  savedYearIdx: number;
}

export const LS_IDLER = "geostory-idler-v1";

export function loadIdlerRecord(): IdlerRecord | null {
  try {
    const raw = localStorage.getItem(LS_IDLER);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<IdlerRecord>;
    if (o.v !== 1 || typeof o.savedAt !== "number" || typeof o.savedYearIdx !== "number") return null;
    if (o.pace !== "paused" && o.pace !== "watchful" && o.pace !== "brisk") return null;
    return {
      v: 1,
      claimCode: typeof o.claimCode === "string" ? o.claimCode : null,
      panelId: typeof o.panelId === "number" ? o.panelId : null,
      lineage: typeof o.lineage === "string" ? o.lineage : null,
      pace: o.pace,
      savedAt: o.savedAt,
      savedYearIdx: o.savedYearIdx,
    };
  } catch {
    return null;
  }
}

export function saveIdlerRecord(r: IdlerRecord): void {
  try {
    localStorage.setItem(LS_IDLER, JSON.stringify(r));
  } catch {
    /* storage full/blocked — the idler is a convenience, never fatal */
  }
}
