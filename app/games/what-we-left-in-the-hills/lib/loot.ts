/* The haul — what a scavenger would actually carry out of an Appalachian
   holler. Each item has a dollar value and a weight in kilograms. Weight is
   the cost of everything: speed, noise, safety. */

export interface LootDef {
  id: string;
  name: string;
  value: number; // dollars
  weightKg: number;
  blurb: string;
  quirk: string;
}

export const LOOT: LootDef[] = [
  { id: "coins", name: "Jar of old coins", value: 180, weightKg: 3, blurb: "Mercury dimes and a few Morgan dollars, in creek mud.", quirk: "Quirk: drop it while chased and the coins burst in a clang — a costly decoy at the drop point." },
  { id: "fiddle", name: "Fiddle", value: 150, weightKg: 3, blurb: "Hand-carved, spruce top. Somebody's grandfather played this.", quirk: "Quirk: play it and leave it sounding for 8 seconds; things nearby go to the music." },
  { id: "ginseng", name: "Ginseng bundle", value: 120, weightKg: 2, blurb: "Wild 'sang, dried right. Worth more than gold per ounce, near enough.", quirk: "Quirk: light for its value — the quietest money in the pack." },
  { id: "tools", name: "Iron tools", value: 95, weightKg: 7, blurb: "Wrenches, a drawknife, a brace. Heavy as sin.", quirk: "Quirk: at a fallen tree, use these to clear the ridge shortcut once." },
  { id: "lantern", name: "Railroad lantern", value: 85, weightKg: 3, blurb: "L&N red globe, still sound. Collectors pay for these.", quirk: "Quirk: carry it lit to suppress fog tricks; their sight reaches farther toward the light." },
  { id: "kettle", name: "Brass kettle", value: 70, weightKg: 4, blurb: "Dented, verdigris in the seams. Solid brass all the same.", quirk: "Quirk: solid and awkward — no trick, just honest brass weight." },
  { id: "copper", name: "Copper coil", value: 60, weightKg: 4, blurb: "Stripped out of the old mine office. Scrap price, honest weight.", quirk: "Quirk: scrap dealers ask no questions; monsters ask with their ears." },
  { id: "quilt", name: "Patchwork quilt", value: 45, weightKg: 2, blurb: "Feed-sack cotton, wedding-ring pattern. Light, and somebody loved it.", quirk: "Quirk: wrap one other carried item to halve the noise that item makes." },
];

export const TOTAL_VALUE = LOOT.reduce((s, i) => s + i.value, 0);
export const TOTAL_WEIGHT = LOOT.reduce((s, i) => s + i.weightKg, 0);

export interface CarriedItem extends LootDef {
  uid: number;
}

let uidSeq = 1;
export function freshHaul(): CarriedItem[] {
  return LOOT.map((d) => ({ ...d, uid: uidSeq++ }));
}

export function heaviestOf(items: CarriedItem[]): CarriedItem | null {
  let best: CarriedItem | null = null;
  for (const it of items) {
    if (!best || it.weightKg > best.weightKg) best = it;
  }
  return best;
}
