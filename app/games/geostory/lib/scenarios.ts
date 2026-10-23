/** Scenario presets + power colours. Pure data — the engine interprets it. */

export interface ScenarioMods {
  /** per-country adjustments: growth %/yr add, tech points, resource points, military multiplier */
  boosts: Record<string, { growth?: number; tech?: number; resources?: number; milMult?: number }>;
  techMult: number; // global technology growth multiplier
  hydroFreq: number; // hydroclimate shock frequency multiplier
  energyVol: number; // chokepoint / energy shock frequency multiplier
  scripted: { year: number; kind: string }[];
  /** weights for the random hydro-shock region draw (default 1 per region) */
  regionBias?: Record<string, number>;
}

export interface ScenarioDef {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  mods: ScenarioMods;
  /** protagonist country code for place-focused scenarios (map framing + chronicle focus) */
  focus?: string;
  /** short label for the framed region, e.g. "WEST AFRICA" */
  place?: string;
}

const BASE: ScenarioMods = { boosts: {}, techMult: 1, hydroFreq: 1, energyVol: 1, scripted: [] };

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "multipolar",
    name: "Multipolar Century",
    tagline: "Many suns rise at once",
    desc: "India, Brazil, Indonesia, Nigeria, Türkiye and a rearming Europe all surge together while the two giants cool slightly. No single hegemon — a crowded century of rival centres of power.",
    mods: {
      ...BASE,
      boosts: {
        IND: { growth: 0.9, tech: 5 }, BRA: { growth: 0.8, tech: 4 }, IDN: { growth: 0.9, tech: 4 },
        NGA: { growth: 1.0, tech: 3 }, TUR: { growth: 0.7, tech: 4 }, DEU: { growth: 0.4, tech: 5, milMult: 1.5 },
        FRA: { growth: 0.4, tech: 4, milMult: 1.3 }, MEX: { growth: 0.7, tech: 3 },
        USA: { growth: -0.25 }, CHN: { growth: -0.2 },
      },
    },
  },
  {
    id: "chokepoint",
    name: "Chokepoint Shock",
    tagline: "The straits close",
    desc: "In 2030 the Strait of Hormuz shuts and stays dangerous. Energy importers stall, alternative exporters boom, and the map of power is redrawn by whoever holds the oil, gas and the routes around them.",
    mods: {
      ...BASE,
      energyVol: 1.7,
      boosts: {
        USA: { resources: 8, growth: 0.3 }, CAN: { resources: 8, growth: 0.3 },
        NOR: { resources: 8, growth: 0.3 }, BRA: { resources: 6, growth: 0.25 }, KAZ: { resources: 8, growth: 0.3 },
      },
      scripted: [{ year: 2030, kind: "hormuz" }],
    },
  },
  {
    id: "hydroclimate",
    name: "Hydroclimate Reshuffle",
    tagline: "The rains move; so does power",
    desc: "Megadroughts strike the Sahel, South Asia and the Mediterranean. Food-secure temperate exporters — Canada, Russia, Argentina, Australia, Ukraine — gain leverage every dry year. Stratatir's hydroclimate research, playable.",
    mods: {
      ...BASE,
      hydroFreq: 2.3,
      boosts: {
        CAN: { resources: 10, growth: 0.35 }, RUS: { resources: 10, growth: 0.3 },
        ARG: { resources: 10, growth: 0.35 }, AUS: { resources: 8, growth: 0.3 }, UKR: { resources: 10, growth: 0.3 },
      },
      scripted: [
        { year: 2032, kind: "drought:sahel" },
        { year: 2040, kind: "drought:southasia" },
        { year: 2051, kind: "drought:med" },
      ],
    },
  },
  {
    id: "techrace",
    name: "Tech Singularity Race",
    tagline: "Compute is destiny",
    desc: "Research compounds twice as fast. Chip-and-AI powers — Korea, Taiwan, Israel, Japan, the US and China — sprint; everyone else fights for a seat at the table before the gap becomes permanent.",
    mods: {
      ...BASE,
      techMult: 1.7,
      boosts: {
        KOR: { tech: 8 }, TWN: { tech: 8 }, ISR: { tech: 7 }, JPN: { tech: 5 },
        USA: { tech: 4 }, CHN: { tech: 5 }, IND: { tech: 4 }, DEU: { tech: 4 },
      },
    },
  },
  /* ------------------------------------------------ place-focused scenarios */
  {
    id: "arctic",
    name: "Scramble for the Arctic",
    tagline: "The top of the world thaws open",
    desc: "The ice retreats and the polar map becomes a prize: northern energy, minerals and the Northeast Passage. Canada, Russia, Norway, Denmark and the US pour money into the high latitudes while the rest of the world watches the roof melt.",
    focus: "CAN",
    place: "THE HIGH NORTH",
    mods: {
      ...BASE,
      energyVol: 1.4,
      boosts: {
        CAN: { resources: 10, growth: 0.3 }, RUS: { resources: 10, growth: 0.25 },
        NOR: { resources: 8, growth: 0.25 }, DNK: { resources: 8, tech: 3 },
        USA: { resources: 6, growth: 0.15 }, ISL: { resources: 5 }, FIN: { tech: 3 }, SWE: { tech: 3 },
      },
      scripted: [
        { year: 2031, kind: "arctic" },
        { year: 2038, kind: "find:CAN" },
        { year: 2045, kind: "arctic" },
        { year: 2053, kind: "find:RUS" },
      ],
    },
  },
  {
    id: "nigeria",
    name: "Nigeria: Giant of Africa",
    tagline: "Two hundred million people, one century to claim",
    desc: "Africa's demographic giant gets its act together: power grid, ports, tech hubs in Lagos. But the Sahel is drying on its northern border and every neighbour's fate is entangled with its own. The map frames West Africa; the century is Nigeria's to win or waste.",
    focus: "NGA",
    place: "WEST AFRICA",
    mods: {
      ...BASE,
      hydroFreq: 1.25,
      regionBias: { sahel: 2.6, horn: 0.7 },
      boosts: {
        NGA: { growth: 1.15, tech: 6, resources: 8 },
        GHA: { growth: 0.5, tech: 3 }, CIV: { growth: 0.45 }, SEN: { growth: 0.4, resources: 4 },
        CMR: { growth: 0.35 }, ETH: { growth: 0.6, tech: 3 },
      },
      scripted: [
        { year: 2033, kind: "boom:NGA" },
        { year: 2037, kind: "drought:sahel" },
        { year: 2046, kind: "find:NGA" },
        { year: 2055, kind: "breakthrough:NGA" },
      ],
    },
  },
  {
    id: "malacca",
    name: "Malacca Chokepoint",
    tagline: "One strait, a quarter of world trade",
    desc: "Everything between the Indian Ocean and the Pacific squeezes past Malaysia and Indonesia. When the strait closes — twice — the region's keepers cash in while the workshop economies of East Asia scramble for another way around.",
    focus: "MYS",
    place: "SOUTHEAST ASIA",
    mods: {
      ...BASE,
      energyVol: 1.5,
      regionBias: { seasia: 2.2 },
      boosts: {
        MYS: { growth: 0.8, tech: 5, resources: 5 }, IDN: { growth: 0.85, resources: 6 },
        VNM: { growth: 0.85, tech: 4 }, THA: { growth: 0.5 }, PHL: { growth: 0.55, tech: 3 },
      },
      scripted: [
        { year: 2034, kind: "malacca" },
        { year: 2043, kind: "breakthrough:MYS" },
        { year: 2052, kind: "malacca" },
      ],
    },
  },
  {
    id: "sahel",
    name: "Sahel Crossroads",
    tagline: "Uranium, gold and a moving desert",
    desc: "The band between Sahara and savanna holds uranium, gold and three hundred million people's future — and the rains are failing. Niger and Mali bet everything on what lies under the sand while the climate deck keeps dealing drought.",
    focus: "NER",
    place: "THE SAHEL",
    mods: {
      ...BASE,
      hydroFreq: 1.7,
      regionBias: { sahel: 3.2 },
      boosts: {
        NER: { resources: 10, growth: 0.8 }, MLI: { resources: 8, growth: 0.6 },
        TCD: { resources: 6, growth: 0.4 }, BFA: { resources: 5 }, MRT: { resources: 5, growth: 0.3 },
        NGA: { growth: 0.4 },
      },
      scripted: [
        { year: 2030, kind: "drought:sahel" },
        { year: 2036, kind: "find:NER" },
        { year: 2044, kind: "boom:MLI" },
        { year: 2050, kind: "drought:sahel" },
      ],
    },
  },
  {
    id: "andes",
    name: "Andes Lithium Rush",
    tagline: "The battery age digs in the high desert",
    desc: "The salt flats of Chile, Bolivia and Argentina hold the lithium the century runs on. The Andean states ride the rush — if they can turn white gold into schools, grids and leverage before the boom moves on.",
    focus: "CHL",
    place: "THE ANDES",
    mods: {
      ...BASE,
      boosts: {
        CHL: { resources: 10, growth: 0.6 }, BOL: { resources: 10, growth: 0.7 },
        ARG: { resources: 8, growth: 0.5 }, PER: { resources: 6, growth: 0.4 },
      },
      scripted: [
        { year: 2029, kind: "lithium:CHL" },
        { year: 2037, kind: "lithium:BOL" },
        { year: 2046, kind: "boom:ARG" },
        { year: 2054, kind: "breakthrough:CHL" },
      ],
    },
  },
  {
    id: "rise",
    name: "Rise of a Chosen Power",
    tagline: "Pick a country. Make it a giant.",
    desc: "Your scenario: click any country on the map, push the boost sliders — growth, technology, military, resources — and watch whether your chosen power can fight its way to the top of the world by 2100. Add up to two rivals to make it a race.",
    mods: { ...BASE },
  },
  {
    id: "sandbox",
    name: "Open Sandbox",
    tagline: "No script. Just the world system.",
    desc: "Baseline dynamics only — gravity, receptivity, drift and the random shock deck. Tune the deck below: silence the straits, calm the climate, or turn the chaos up. The control run against which every other scenario is measured.",
    mods: { ...BASE },
  },
];

export function getScenario(id: string): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/* ------------------------------------------------------- world modifiers
 * P4a — named starting conditions layered over any scenario. The engine
 * applies the effects by id (lib/engine.ts); this table is display data.
 * `selectable` ones appear as pre-run toggles; the rest arrive via the
 * what-if templates. */
export interface WorldModifier { id: string; name: string; desc: string; selectable: boolean }
export const WORLD_MODIFIERS: WorldModifier[] = [
  { id: "china-slow", name: "China grows 1% slower", desc: "−1 growth point a year, all century", selectable: true },
  { id: "europe-rearm", name: "Europe re-arms harder", desc: "military share ×1.5–1.7 for the big European powers", selectable: true },
  { id: "andes-lithium", name: "Lithium boom in the Andes", desc: "Chile, Bolivia and Argentina strike white gold early", selectable: true },
  { id: "hormuz-perma", name: "Hormuz stays shut", desc: "the strait closes again every six years", selectable: false },
  { id: "sahel-dry", name: "A dry decade for the Sahel", desc: "megadrought every other year, 2031–2039", selectable: false },
];

/* ------------------------------------------------------------ power colours
 * Aged-atlas palette: curated, slightly desaturated — enamel and old ink
 * rather than neon. Countries stay distinguishable; gold is reserved for
 * emphasis (selection, the #1 power, key numbers), never a country fill. */
const CURATED: Record<string, string> = {
  USA: "#4a7fb5", CHN: "#b84a42", IND: "#cf7f3f", RUS: "#7d6fa8", JPN: "#c47d9a",
  DEU: "#b3a04b", GBR: "#6f83b8", FRA: "#4fae9d", BRA: "#5da864", CAN: "#a55ea0",
  AUS: "#4d9db8", KOR: "#93ad4e",
};

export function powerColor(code: string): string {
  const c = CURATED[code];
  if (c) return c;
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hue = ((h >>> 0) % 360);
  return `hsl(${hue} 42% 50%)`;
}

/** darken/lighten a #hex or hsl() colour by factor (for held-territory shading) */
export function shade(color: string, f: number): string {
  if (color.startsWith("hsl")) {
    return color.replace(/(\d+)%\)$/, (_, l: string) => `${Math.max(8, Math.min(88, Math.round(parseInt(l) * f)))}%)`);
  }
  const n = parseInt(color.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r} ${g} ${b})`;
}

export type LayerId = "territory" | "influence" | "economic" | "tech" | "terrain";
export const LAYERS: { id: LayerId; name: string; blurb: string }[] = [
  { id: "territory", name: "Territory", blurb: "Who actually controls each country" },
  { id: "influence", name: "Influence", blurb: "Whose orbit each country drifts in (receptivity × gravity)" },
  { id: "economic", name: "Economic dominance", blurb: "Whose market gravity dominates — the takeover before the takeover" },
  { id: "tech", name: "Technology", blurb: "Each country's own technology level" },
  { id: "terrain", name: "Terrain", blurb: "The land itself — pixel-art ground under every border" },
];

/** 6-step tech scale: chart-room navy → slate → teal → sage → brass → gold */
export function techColor(tech: number): string {
  const stops = ["#1d2f47", "#33566b", "#2a7f76", "#6f9a52", "#c9a53f", "#ecd27a"];
  const idx = Math.max(0, Math.min(5, Math.floor((tech / 100) * 6)));
  return stops[idx];
}
