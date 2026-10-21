/** Scenario presets + power colours. Pure data — the engine interprets it. */

export interface ScenarioMods {
  /** per-country adjustments: growth %/yr add, tech points, resource points, military multiplier */
  boosts: Record<string, { growth?: number; tech?: number; resources?: number; milMult?: number }>;
  techMult: number; // global technology growth multiplier
  hydroFreq: number; // hydroclimate shock frequency multiplier
  energyVol: number; // chokepoint / energy shock frequency multiplier
  scripted: { year: number; kind: string }[];
}

export interface ScenarioDef {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  mods: ScenarioMods;
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
        USA: { tech: 4 }, CHN: { tech: 5 }, IND: { tech: 4 }, DEU: { tech: 4 }, SGP: { tech: 8 },
      },
    },
  },
  {
    id: "rise",
    name: "Rise of a Chosen Power",
    tagline: "Pick a country. Make it a giant.",
    desc: "Your scenario: click any country on the map, push the boost sliders — growth, technology, military, resources — and watch whether your chosen power can fight its way to the top of the world by 2100.",
    mods: { ...BASE },
  },
  {
    id: "sandbox",
    name: "Open Sandbox",
    tagline: "No script. Just the world system.",
    desc: "Baseline dynamics only — gravity, receptivity, drift and the random shock deck. The control run against which every other scenario is measured.",
    mods: { ...BASE },
  },
];

export function getScenario(id: string): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

/* ------------------------------------------------------------ power colours */
const CURATED: Record<string, string> = {
  USA: "#2f7df6", CHN: "#e63b3b", IND: "#f97e2c", RUS: "#9d7bfa", JPN: "#ef6fb0",
  DEU: "#f2c230", GBR: "#7d8ff0", FRA: "#2ec4a6", BRA: "#43d95e", CAN: "#d946ef",
  AUS: "#35b6e8", KOR: "#9ee62e",
};

export function powerColor(code: string): string {
  const c = CURATED[code];
  if (c) return c;
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hue = ((h >>> 0) % 360);
  return `hsl(${hue} 62% 55%)`;
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

export type LayerId = "territory" | "influence" | "economic" | "tech";
export const LAYERS: { id: LayerId; name: string; blurb: string }[] = [
  { id: "territory", name: "Territory", blurb: "Who actually controls each country" },
  { id: "influence", name: "Influence", blurb: "Whose orbit each country drifts in (receptivity × gravity)" },
  { id: "economic", name: "Economic dominance", blurb: "Whose market gravity dominates — the takeover before the takeover" },
  { id: "tech", name: "Technology", blurb: "Each country's own technology level" },
];

/** 6-step tech scale: deep slate → steel teal → signal gold */
export function techColor(tech: number): string {
  const stops = ["#27354d", "#275d6b", "#1f7a6d", "#3d9a50", "#8fb52e", "#e8c832"];
  const idx = Math.max(0, Math.min(5, Math.floor((tech / 100) * 6)));
  return stops[idx];
}
