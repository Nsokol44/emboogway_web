/**
 * Challenge links — the FULL run config (scenario, seed, deck, boosts,
 * rivals, modifiers, interventions) encoded into one URL parameter, so a
 * shared link replays the exact same deterministic century.
 *
 * Encoding: JSON → base64url. Decoding is paranoid: every field is
 * re-validated and clamped, and unknown values are dropped, so a tampered
 * link degrades to the closest valid run instead of crashing the sim.
 */
import { CODE_IDX } from "./data";
import {
  CRISIS_REGIONS, DEFAULT_DECK, STRAITS, ZERO_BOOSTS,
  canonicalInterventions, canonicalModifiers,
  type Boosts, type DeckControls, type SimConfig,
} from "./engine";
import { SCENARIOS } from "./scenarios";

const clampN = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;

function validBoosts(b: unknown): Boosts {
  const o = (b ?? {}) as Record<string, unknown>;
  return {
    growth: clampN(o.growth, 0, 100, 0),
    tech: clampN(o.tech, 0, 100, 0),
    military: clampN(o.military, 0, 100, 0),
    resources: clampN(o.resources, 0, 100, 0),
  };
}

export function encodeRun(cfg: SimConfig): string {
  const json = JSON.stringify(cfg);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRun(param: string): SimConfig | null {
  try {
    const b64 = param.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    if (typeof o.scenarioId !== "string" || !SCENARIOS.some((s) => s.id === o.scenarioId)) return null;
    if (typeof o.seed !== "string" || o.seed.length === 0 || o.seed.length > 80) return null;

    const cfg: SimConfig = {
      scenarioId: o.scenarioId,
      seed: o.seed,
      boosts: o.boosts ? validBoosts(o.boosts) : { ...ZERO_BOOSTS },
    };
    if (typeof o.focusCode === "string" && CODE_IDX.has(o.focusCode)) cfg.focusCode = o.focusCode;
    if (Array.isArray(o.rivals)) {
      cfg.rivals = o.rivals
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && typeof (r as Record<string, unknown>).code === "string" && CODE_IDX.has((r as Record<string, unknown>).code as string))
        .slice(0, 4)
        .map((r) => ({ code: r.code as string, boosts: validBoosts(r.boosts) }));
    }
    if (o.deck && typeof o.deck === "object") {
      const d = o.deck as Record<string, unknown>;
      const deck: DeckControls = {
        chokepoints: typeof d.chokepoints === "boolean" ? d.chokepoints : DEFAULT_DECK.chokepoints,
        climate: typeof d.climate === "boolean" ? d.climate : DEFAULT_DECK.climate,
        pandemics: typeof d.pandemics === "boolean" ? d.pandemics : DEFAULT_DECK.pandemics,
        rushes: typeof d.rushes === "boolean" ? d.rushes : DEFAULT_DECK.rushes,
        chaos: clampN(d.chaos, 0, 2, DEFAULT_DECK.chaos),
      };
      cfg.deck = deck;
    }
    const mods = canonicalModifiers(Array.isArray(o.modifiers) ? (o.modifiers as string[]) : undefined);
    if (mods.length) cfg.modifiers = mods;
    const invs = canonicalInterventions(Array.isArray(o.interventions) ? (o.interventions as never[]) : undefined)
      .filter((v) => {
        if (v.lever === "tech" || v.lever === "stability") return CODE_IDX.has(v.target);
        if (v.lever === "chokepoint") return STRAITS.some((s) => s.id === v.target);
        if (v.lever === "crisis") return CRISIS_REGIONS.some((r) => r.key === v.target);
        // trade: "AAA>BBB" / "AAA!BBB" between two real, different countries
        const sep = v.target.includes(">") ? ">" : "!";
        const [a, b] = v.target.split(sep);
        return a !== b && CODE_IDX.has(a) && CODE_IDX.has(b);
      });
    if (invs.length) cfg.interventions = invs;
    return cfg;
  } catch {
    return null;
  }
}

/** absolute challenge URL for captions and shares */
export function challengeUrl(cfg: SimConfig, origin = "https://www.emboogway.com"): string {
  return `${origin}/games/geostory?run=${encodeRun(cfg)}`;
}
