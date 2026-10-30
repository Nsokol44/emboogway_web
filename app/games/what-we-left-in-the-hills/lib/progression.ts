/* Persistent progression for What We Left in The Hills: levels, perks,
   and the arithmetic that earns them. Play only — no currency, no store. */

export type DifficultyId = "story" | "standard" | "ruthless";
export type PerkId =
  | "soft-step"
  | "pack-mule"
  | "fog-sense"
  | "steady-hands"
  | "iron-lungs"
  | "light-sleeper"
  | "trailwise"
  | "second-wind";

export interface PerkDef {
  id: PerkId;
  level: number;
  name: string;
  effect: string;
}

export const PERKS: PerkDef[] = [
  { id: "soft-step", level: 1, name: "Soft Step", effect: "All noise you make is 10% smaller." },
  { id: "pack-mule", level: 2, name: "Pack Mule", effect: "The first 3 kg in your pack add no noise. They still slow you down." },
  { id: "fog-sense", level: 3, name: "Fog Sense", effect: "A caption warns you about 5 seconds before each fog bank arrives." },
  { id: "steady-hands", level: 4, name: "Steady Hands", effect: "The patchwork quilt can wrap two carried items instead of one." },
  { id: "iron-lungs", level: 5, name: "Iron Lungs", effect: "While hustling, your noise ring grows 25% more slowly toward its full size." },
  { id: "light-sleeper", level: 6, name: "Light Sleeper", effect: "False growls are captioned “…or maybe nothing” — the fog’s lies are easier to spot." },
  { id: "trailwise", level: 7, name: "Trailwise", effect: "The run’s route hazard is named on your HUD from the start." },
  { id: "second-wind", level: 8, name: "Second Wind", effect: "Once per run, the first grab breaks free if you immediately drop your heaviest item; the thing loses you for 3 seconds." },
];

export const LEVEL_XP = [0, 250, 600, 1000, 1500, 2200, 3000, 4000];

export function xpForProgress(bankedValue: number, escapes: number): number {
  return Math.max(0, Math.floor(bankedValue)) + escapes * 100;
}

export function levelForXp(xp: number): number {
  let level = 1;
  LEVEL_XP.forEach((threshold, i) => {
    if (xp >= threshold) level = i + 1;
  });
  return level;
}

export function perkById(id: string | null | undefined): PerkDef | null {
  return PERKS.find((p) => p.id === id) ?? null;
}

export const DIFFICULTIES: { id: DifficultyId; name: string; effect: string; seconds: number }[] = [
  { id: "story", name: "Story", effect: "Monsters are slower, their sight is shorter, and you have 8:00.", seconds: 480 },
  { id: "standard", name: "Standard", effect: "The original hunt: normal monsters and 7:00 to nightfall.", seconds: 420 },
  { id: "ruthless", name: "Ruthless", effect: "Monsters are faster and you have only 6:00.", seconds: 360 },
];
