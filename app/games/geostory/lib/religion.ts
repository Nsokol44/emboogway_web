/**
 * Religion layer — data + tuning for the parallel faith-dominance track.
 *
 * Starting state: each country's dominant faith and that faith's share of
 * the population, authored from Pew Research Center world-religion
 * majorities (2020-era estimates; see RELIGION.md for the source note and
 * the judgement calls). The sim's religion track is mechanics-only and
 * respectful by design: faiths are cultural gravity, never a power input.
 *
 * Sikhism is in the faith list (a major world religion with ~25M adherents)
 * but starts with no heartland country: no sovereign state in the dataset —
 * or the real world — has a Sikh majority or plurality, so in v1 it is a
 * diaspora faith that cannot become a country's dominant faith. Documented
 * in RELIGION.md, not a lockout bug.
 */
import religionJson from "./data/religion.json";
import { COUNTRIES } from "./data";

export interface FaithDef {
  id: string;
  name: string;
  /** enamel colour on the Religion map layer (chart-room palette) */
  color: string;
  /** proselytism coefficient — how actively the tradition seeks converts.
   *  Missionary traditions (Christianity, Islam, Buddhism) project their
   *  gravity in full; traditions that do not seek converts in their
   *  modern form (Hinduism, Judaism, folk traditions) mostly hold their
   *  heartlands instead of conquering new ones. Standard religious-
   *  demography modelling, applied mechanics-only */
  spread: number;
}

export const FAITHS: FaithDef[] = [
  { id: "christianity", name: "Christianity", color: "#d4af37", spread: 1.0 },
  { id: "islam", name: "Islam", color: "#1f9d74", spread: 1.0 },
  { id: "hinduism", name: "Hinduism", color: "#e25822", spread: 0.3 },
  { id: "buddhism", name: "Buddhism", color: "#9b3b54", spread: 0.85 },
  { id: "judaism", name: "Judaism", color: "#4a7dc9", spread: 0.15 },
  { id: "sikhism", name: "Sikhism", color: "#f5a623", spread: 0.4 },
  { id: "chinese_folk", name: "Chinese folk religion", color: "#c0392b", spread: 0.35 },
  { id: "folk", name: "Folk / indigenous traditions", color: "#7d8c5c", spread: 0.3 },
  { id: "unaffiliated", name: "Unaffiliated", color: "#8a93a3", spread: 0.9 },
];

export const FAITH_IDX = new Map(FAITHS.map((f, i) => [f.id, i]));
export const FAITH_COUNT = FAITHS.length;

interface ReligionRow { f: string; share: number }
const RELIGION = religionJson as Record<string, ReligionRow>;

const unaffiliatedIdx = FAITH_IDX.get("unaffiliated")!;

/** dominant faith index per country, aligned with COUNTRIES order */
export const COUNTRY_FAITH: number[] = COUNTRIES.map((c) => {
  const row = RELIGION[c.code];
  return row ? (FAITH_IDX.get(row.f) ?? unaffiliatedIdx) : unaffiliatedIdx;
});

/** dominant faith's population share per country (its rootedness), 0..1 */
export const FAITH_SHARE: number[] = COUNTRIES.map((c) => {
  const row = RELIGION[c.code];
  return row ? Math.max(0.05, Math.min(0.99, row.share)) : 0.4;
});

/**
 * Spread tuning (see RELIGION.md). Faith pressure is receptivity × gravity
 * over DISTANCE — faiths jump oceans via migration and trade, so no country
 * is structurally locked out, islands included. A challenger must sustain
 * a higher score than the incumbent until its accumulated pressure crosses
 * FLIP_PRESSURE (the annexation track's pressure idea, applied to belief).
 */
export const FAITH_TUNING = {
  /** gravity distance scale, km — ocean-crossing but regionally weighted */
  distScaleKm: 2000,
  distExponent: 1.5,
  /** score multiplier when the faith is already present across a border */
  neighbourBonus: 1.3,
  /** score multiplier when the country's top influencer holds this faith.
   *  Kept small: the world's #1 power is top influencer across whole
   *  continents, and at ×1.5 its faith (China → Unaffiliated) cascaded
   *  through every smaller neighbour faith within a generation */
  influencerBonus: 1.15,
  /** score multiplier when the country's controller holds this faith */
  controllerBonus: 1.25,
  /** radiation compression: a heartland radiates adherents^this, not raw
   *  adherents — organised projection (missions, media, migration)
   *  scales sub-linearly with population, so a 2B-adherent giant does
   *  not automatically swamp every small faith within range */
  radiationExponent: 0.75,
  /** incumbent defence: the home faith's institutions, clergy and family
   *  transmission add this × share to its score, on top of its own
   *  (compressed) radiation counted at home. Without it, one giant
   *  heartland would flip every small neighbouring faith within a
   *  generation, and no small or island heartland could hold its own */
  homeBase: 130,
  /** pressure gained per year ≈ (challenger/incumbent − 1) × this,
   *  capped per year so no flip is ever instant */
  pressureRate: 2.0,
  pressureCap: 0.9,
  /** pressure needed to flip a country's dominant faith */
  flipPressure: 8,
  /** all pressure decays × this each year — a challenger must SUSTAIN
   *  its lead for a generation, not spike it once */
  pressureDecay: 0.9,
  /** a country can flip at most once per this many years */
  flipCooldownYears: 5,
  /** conversion channel: sustained top-influence dominance converts —
   *  but only where the influencer's faith already has a real local
   *  presence (gravity ≥ this fraction of the incumbent's score), and
   *  at a capped generational rate. Without the presence gate, the
   *  world's #1 power's faith (China → Unaffiliated, r = 40–80 against
   *  small states) would convert the whole map by 2030 */
  conversionRate: 0.1,
  conversionCapRatio: 2,
  conversionThreshold: 0.5,
  conversionPresence: 0.55,
};
