#!/usr/bin/env node
/**
 * build-waterways.mjs — the GeoStory waterway legibility pass.
 *
 * Nick (2026-10-23): "In the Earth map, the Suez Canal and the Mediterranean
 * are not represented well. Can you expand them (and other waterways like
 * them)." Design doc §6.6 (geostory-godot-design-and-prototype-plan.md).
 *
 * WHAT THIS DOES
 * The Earth map's 3,239 hexes are land-only: every hex belongs to a country,
 * so narrow seas and straits are tiled over wherever two coasts nearly meet
 * (the Mediterranean was a land bridge at Gibraltar, the Aegean, Sicily,
 * the Adriatic…; the Suez and Panama canals did not exist). This script
 * RECLASSIFIES a small, documented set of coastal land hexes as water:
 *
 *   "o" — open-water hex (widened sea / guaranteed strait)
 *   "c" — canal hex (Suez, Panama)
 *
 * HARD CONSTRAINT — RECLASSIFY ONLY. Hex count, hex order, adjacency and
 * country assignment never change; a waterway hex keeps its country (a
 * canal hex is still Egypt's / Panama's — the web renderer keeps the
 * owner's hairline border on canal hexes). Determinism, saved games and
 * the terrain↔world index correspondence (terrain string index i =
 * WORLD.hexes[i]) are untouched.
 *
 * METHOD
 * Each waterway is defined below as a lon/lat corridor (polyline + half
 * width in map units) projected with the SAME d3.geoNaturalEarth1 fit the
 * original geodata bake used (fitExtent [[6,26],[954,494]] over
 * world-atlas countries-110m). Land hexes whose centroids fall inside the
 * corridor are candidates; hand-tuned exclusions (each with a written
 * reason) keep major coastal hexes as land. The script asserts that
 * corridor − exclusions equals the documented `expect` set exactly — if
 * the source data ever changes, this fails loudly instead of silently
 * producing a different map.
 *
 * RULES APPLIED THROUGHOUT
 * - Sole-hex rule: NEVER reclassify a country's only hex (it would erase
 *   the country from the terrain view). This is why Denmark (918), Kuwait
 *   (1898), Albania (1517), Belgium (1151), Djibouti (2354) and the
 *   Bahamas (1990) keep their hexes even where a corridor crosses them.
 * - Stacked-position rule: never reclassify a hex that shares its exact
 *   position with another country's hex (the source bake snapped a few
 *   small countries onto a neighbour's lattice point).
 * - Shores stay: a strait cut takes the fairway hexes; at least one shore
 *   hex remains land on each side wherever the lattice allows it.
 *
 * VERIFICATION (all asserted in-script, run on every execution)
 * - terrain length == world hex count == 3,239.
 * - Every country keeps at least one land hex.
 * - Land-bridge table: the country pairs that must have NO adjacent
 *   land–land hex pair after the pass, plus the three documented residual
 *   contacts (GBR–IRL Celtic diagonal, USA–BHS and CUB–BHS touching the
 *   Bahamas' sole hex) which must be EXACTLY the listed pairs.
 * - Water connectivity on the hex lattice itself: open-water anchors
 *   (lon/lat) on both sides of every through-strait must be connected
 *   through water nodes (empty lattice slots + reclassified hexes);
 *   terminus seas (Persian Gulf, Adriatic, Bohai) must connect open
 *   water to their head hex. The Danish limitation is asserted as a
 *   NEGATIVE check (Skagerrak cannot reach the Baltic — Denmark's sole
 *   hex walls the last mile; see WATERWAYS.md).
 *
 * OUTPUTS (all committed; the Godot build consumes the same files)
 * - app/games/geostory/lib/data/terrain.json   (legend gains o/c)
 * - app/games/geostory/lib/data/waterways.json (hex index → waterway id)
 * - ~/workspace/geostory-live-demo/terrain_by_hex.json (shared demo asset)
 * - scripts/WATERWAYS.md (human-readable canonical list, generated)
 *
 * Rerunnable and deterministic: `node scripts/build-waterways.mjs`.
 * A rerun on an already-processed terrain.json is a no-op for the data
 * (assertions still run; prev-code column in the MD then reads o/c).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";
import countriesTopo from "world-atlas/countries-110m.json" with { type: "json" };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORLD_P = path.join(ROOT, "app/games/geostory/lib/data/world.json");
const TERRAIN_P = path.join(ROOT, "app/games/geostory/lib/data/terrain.json");
const WATERWAYS_P = path.join(ROOT, "app/games/geostory/lib/data/waterways.json");
const MD_P = path.join(ROOT, "scripts/WATERWAYS.md");
const DEMO_P = "/home/hatch/workspace/geostory-live-demo/terrain_by_hex.json";

const world = JSON.parse(fs.readFileSync(WORLD_P, "utf8"));
const terrainJson = JSON.parse(fs.readFileSync(TERRAIN_P, "utf8"));
const HEXES = world.hexes; // [cx, cy, countryIndex]
const CCODE = world.countries.map((c) => c.code);
const CNAME = world.countries.map((c) => c.name);
const N = HEXES.length;

/* The bake's exact projection (verified: scale 167.0755, translate
   [480, 256.353] — identical to scripts/build-geodata.mjs). */
const land = feature(countriesTopo, countriesTopo.objects.countries);
const proj = geoNaturalEarth1().fitExtent([[6, 26], [954, 494]], land);

/* ------------------------------------------------------------- geometry */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function corridorDist(x, y, corridor) {
  const pts = corridor.map(([lon, lat]) => proj([lon, lat]));
  let best = Infinity;
  for (let s = 0; s < pts.length - 1; s++) {
    best = Math.min(best, segDist(x, y, pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]));
  }
  return best;
}

/* ------------------------------------------------------------ waterways */
/* expect = the exact hex indices reclassified. exclude = corridor hits
   kept as land, each with its reason. checks = lattice-BFS verifications:
   {a:[lon,lat], b:[lon,lat]} open-water anchors, {aHex, b} hex targets,
   {a, bHex}, or {a, b, mustFail:true} for documented limitations. */
const WATERWAYS = [
  {
    id: "suez-canal", name: "Suez Canal", kind: "canal", code: "c",
    note: "Port Said (1832) → Suez (1892): a two-hex canal chain down Egypt's isthmus axis, joining the Mediterranean to the Gulf of Suez water at 1950. The chain is two hexes because the isthmus is two lattice rows deep here; both hexes keep Egypt as owner.",
    corridor: [[32.30, 31.35], [32.33, 30.60], [32.45, 30.05], [32.55, 29.90]], hw: 5.0,
    expect: [1832, 1892],
    exclude: { 1833: "Egypt's north Sinai coast hex — the canal chain runs along the isthmus axis west of it." },
    checks: [], // verified by the combined suez + red-sea check below
  },
  {
    id: "panama-canal", name: "Panama Canal", kind: "canal", code: "c",
    note: "A two-hex chain: 2367 (the isthmus waist — its two open slots face the Caribbean) and 2407 (Panama's Pacific terminus hex, opening to the Gulf of Panama slots). Together they cut the isthmus; both hexes keep Panama as owner.",
    corridor: [[-79.72, 9.85], [-79.62, 9.35], [-79.55, 8.85], [-79.75, 7.7]], hw: 3.8,
    expect: [2367, 2407],
    exclude: {},
    checks: [{ a: [-79.9, 10.9], b: [-80.35, 7.55] }],
  },
  {
    id: "gibraltar", name: "Strait of Gibraltar", kind: "strait", code: "o",
    note: "Cut through the two Moroccan hexes (1700 strait proper, 1701 Alboran mouth); Spain keeps both north-bank hexes, so the strait reads as a full water hex between two real shores.",
    corridor: [[-5.95, 35.95], [-5.5, 35.95], [-4.9, 35.8], [-4.2, 35.6]], hw: 5.2,
    expect: [1700, 1701],
    exclude: {
      1636: "Cádiz — Spain's Atlantic shore stays as the strait's north bank.",
      1637: "Spain's Costa del Sol shore stays as the north bank.",
    },
    checks: [{ a: [-7.6, 35.0], b: [-0.9, 36.75] }],
  },
  {
    id: "bosphorus-dardanelles", name: "Bosphorus & Dardanelles", kind: "strait", code: "o",
    note: "Two Turkish hexes (1520 Dardanelles/Bosphorus axis, 1521 Bosphorus north) — with the Aegean cut below they form one continuous chain from the Aegean to the Black Sea.",
    corridor: [[26.4, 40.25], [27.6, 40.6], [28.9, 41.05], [29.9, 41.6]], hw: 5.2,
    expect: [1520, 1521],
    exclude: {
      1519: "Greek Thrace stays land; the strait cut runs through the Turkish hexes.",
      1583: "Counted under aegean — one waterway owns each hex; the chain runs through it either way.",
    },
    checks: [], // verified by the combined aegean -> black sea check below
  },
  {
    id: "aegean", name: "Aegean Sea", kind: "sea", code: "o",
    note: "The Aegean was fully tiled over between Greece and Turkey. The widening takes the two Turkish fairway hexes (1583 Çanakkale approaches, 1644 the Rhodes-side exit whose south slots open to the Mediterranean), so the sea reads from Crete to the Dardanelles; Greece keeps its mainland and island hexes.",
    corridor: [[25.7, 40.2], [25.8, 39.0], [26.2, 37.6], [26.6, 36.6]], hw: 5.2,
    expect: [1583, 1644],
    exclude: {
      1519: "Greek mainland shore stays; the fairway runs down the Turkish coast.",
      1520: "Counted under bosphorus-dardanelles — same chain.",
    },
    checks: [{ a: [22.94, 34.58], b: [29.8, 43.1] }],
  },
  {
    id: "messina", name: "Strait of Messina", kind: "strait", code: "o",
    note: "Hex 1579 sits in the strait between Calabria (1580) and Sicily (1642); as water it makes Sicily a true island in the tiling.",
    corridor: [[15.55, 38.25], [15.7, 37.9]], hw: 4.6,
    expect: [1579],
    exclude: {},
    checks: [], // structural: the sicily land-path assertion in GLOBAL_CHECKS
  },
  {
    id: "sicily-channel", name: "Sicily Channel", kind: "strait", code: "o",
    note: "The channel's west mouth was walled by a single gate hex (1640, labeled DZA by the source bake though its centroid sits on Tunisia's Cap Bon narrows) plus 1641 on the Tunisian shore. Both become water; Sicily (1642) and Sardinia (1578) stay whole.",
    corridor: [[9.3, 36.9], [10.9, 36.8], [11.9, 36.95], [12.6, 36.9]], hw: 5.2,
    expect: [1640, 1641],
    exclude: {
      1578: "Sardinia's south tip stays land — islands stay whole; the channel's gate is the Cap Bon hex.",
      1642: "Sicily stays land; the channel cut takes the Tunisian-side hexes.",
    },
    checks: [{ a: [3.23, 38.55], b: [16.0, 36.56] }],
  },
  {
    id: "adriatic", name: "Adriatic Sea", kind: "sea", code: "o",
    note: "The Adriatic was filled shore-to-shore along its whole length. The carve takes the two mid-Adriatic axis hexes (1446 off Ancona, 1516 off Puglia — both centroids sit in open water) so a continuous sea runs from the Ionian to the gulf head; every shore hex stays.",
    corridor: [[14.2, 41.9], [15.2, 41.2], [16.0, 40.6]], hw: 5.2,
    expect: [1446, 1516],
    exclude: { 1515: "Italy's Abruzzo shore stays; the carve takes the mid-Adriatic axis hexes." },
    checks: [{ a: [4.71, 40.54], bHex: 1446 }],
  },
  {
    id: "ionian-otranto", name: "Strait of Otranto (Ionian mouth)", kind: "strait", code: "o",
    note: "Hex 1581 (Corfu-side Greek hex) widens the Adriatic's mouth on the Greek side; its south slot opens to the Ionian.",
    corridor: [[19.3, 40.3], [18.9, 39.6], [19.4, 38.9]], hw: 5.0,
    expect: [1581],
    exclude: {
      1517: "Albania's ONLY hex — the sole-hex rule.",
      1580: "Calabria's toe stays land (also the Strait of Messina's south bank).",
    },
    checks: [],
  },
  {
    id: "red-sea", name: "Red Sea", kind: "sea", code: "o",
    note: "Widened by the African-shore row: a verified diagonal chain of ten hexes from the Gulf of Suez (1950) down through Egypt, Sudan and Eritrea to Bab el-Mandeb (2309) and out along Yemen's Gulf of Aden exit (2310, 2311). Arabia's coast stays as the sea's east bank along its whole length.",
    corridor: [[33.0, 28.6], [34.2, 26.8], [35.2, 24.6], [36.4, 22.2], [37.6, 19.8], [38.8, 17.4], [40.2, 15.2], [41.8, 13.6], [43.2, 12.35], [44.6, 12.3], [46.2, 12.2]], hw: 5.6,
    expect: [1950, 2009, 2069, 2125, 2179, 2226, 2270, 2309, 2310, 2311],
    exclude: {
      1892: "Counted under suez-canal as a canal hex — same chain.",
      1893: "Saudi Arabia's Red Sea coast stays as the sea's east bank.",
      1951: "Saudi Arabia's Red Sea coast stays as the sea's east bank.",
      2010: "Saudi Arabia's Red Sea coast stays as the sea's east bank.",
      2070: "Saudi Arabia's Red Sea coast stays as the sea's east bank.",
      2225: "Sudan's inland shore hex, one row behind the fairway.",
      2269: "Eritrea's inland shore hex, one row behind the fairway.",
      2271: "Yemen's Bab el-Mandeb shore (Perim side) stays as the strait's east bank.",
      2353: "Ethiopia's Gulf of Aden shore, south of the strait; it also shares its position with Djibouti's only hex.",
      2354: "Djibouti's ONLY hex — the sole-hex rule.",
      2355: "Somaliland's Aden shore stays; the sea reaches the Gulf of Aden through YEM 2311's open slot.",
    },
    checks: [{ a: [32.2, 32.4], b: [47.8, 12.0] }], // Mediterranean -> Gulf of Aden, the full Suez/Red Sea system
  },
  {
    id: "hormuz-persian-gulf", name: "Strait of Hormuz & Persian Gulf", kind: "strait + gulf", code: "o",
    note: "The gulf was tiled shore-to-shore. The fairway runs along the Iranian side: Musandam (2018) and Oman's Al Batinah gate hex (2078) open the mouth, 2019/1959/1958/1957 carry the strait and gulf axis, 1899 and 1839 reach the head. Kuwait's sole hex stays as the head's south shore; the gulf is a terminus sea, so the check runs open water -> head hex.",
    corridor: [[60.1, 24.1], [59.3, 24.6], [58.6, 25.2], [57.2, 26.0], [56.35, 26.45], [54.6, 26.6], [52.6, 26.9], [51.0, 27.4], [49.6, 28.6], [48.6, 29.7]], hw: 5.6,
    expect: [1839, 1899, 1957, 1958, 1959, 2018, 2019, 2078],
    exclude: {
      1838: "Iraq's Fao coast stays as the gulf head's north shore.",
      1898: "Kuwait's ONLY hex — the sole-hex rule; it becomes the gulf head's south shore.",
      1956: "Saudi Arabia's Gulf coast stays; the fairway runs along the Iranian side.",
      2020: "Pakistan's Makran shore stays; the strait mouth turns south along Oman.",
    },
    checks: [{ a: [63.06, 22.71], bHex: 1839 }],
  },
  {
    id: "malacca", name: "Strait of Malacca", kind: "strait", code: "o",
    note: "A four-hex fairway alternating shores (2478 Sumatra side, 2479 + 2511 Malay side, 2543 the Singapore exit), each adjacent to the next, with open slots at both ends (Andaman Sea / Singapore Strait).",
    corridor: [[98.4, 5.9], [99.9, 5.3], [101.4, 4.5], [102.7, 3.4], [103.7, 2.2], [104.45, 1.35]], hw: 5.2,
    expect: [2478, 2479, 2511, 2543],
    exclude: {
      2441: "Thailand's Kra shore stays as the mouth's north bank.",
      2480: "Malaysia's peninsula shore stays; the fairway takes the strait's mid-line hexes.",
      2512: "Malaysia's Johor shore stays at the Singapore exit.",
    },
    checks: [{ a: [97.3, 6.8], b: [104.9, 1.6] }],
  },
  {
    id: "danish-straits", name: "Danish Straits (Kattegat–Øresund)", kind: "strait", code: "o",
    note: "The cut takes the two Swedish-shore hexes (919 Kattegat, 920 Øresund/Baltic exit), severing every Sweden–continent land contact. LIMITATION: Denmark's only hex (918) cannot be reclassified (sole-hex rule), so the last Skagerrak mile stays walled — the fairway is guaranteed from the Kattegat to the Baltic, not from the North Sea. Asserted as a negative check below.",
    corridor: [[10.2, 57.4], [10.8, 56.6], [11.2, 55.5], [12.3, 55.3], [13.1, 55.6]], hw: 5.2,
    expect: [919, 920],
    exclude: {
      833: "Norway's Skagerrak shore stays.",
      918: "Denmark's ONLY hex — the sole-hex rule (see the limitation in this entry's note).",
      996: "Germany's Jutland-side shore stays.",
      997: "Germany's Baltic shore stays; the fairway runs along the Swedish coast.",
    },
    checks: [
      { aHex: 919, b: [17.88, 56.96] },
      { a: [5.17, 56.96], b: [17.88, 56.96], mustFail: true, why: "documented limitation: Denmark's sole hex walls the Skagerrak's last mile" },
    ],
  },
  {
    id: "english-channel", name: "English Channel", kind: "strait", code: "o",
    note: "Four hexes whose centroids sit in the Channel itself: 1224 (Brittany's offshore north-shore hex), 1148 + 1149 (mid-Channel / Dover Strait, British side) and 1074 (North Sea exit off Norfolk). Cornwall and Calais stay as the two banks; every Britain–continent land contact in the tiling is severed.",
    corridor: [[-4.9, 49.9], [-4.2, 49.6], [-3.0, 49.9], [-1.2, 50.3], [0.6, 50.95], [1.35, 50.95], [2.2, 51.05]], hw: 5.0,
    expect: [1074, 1148, 1149, 1224],
    exclude: {
      1147: "Cornwall (Land's End) stays as the mouth's north bank.",
      1150: "Calais stays as the strait's south bank; it also shares its position with Belgium's only hex.",
      1151: "Belgium's ONLY hex — the sole-hex rule.",
      1225: "Normandy's shore stays; the cut takes the offshore hexes.",
    },
    checks: [{ a: [-5.6, 49.2], b: [3.4, 52.6] }],
  },
  {
    id: "irish-sea", name: "Irish Sea & North Channel", kind: "strait", code: "o",
    note: "994 is the North Channel bridge hex (its centroid sits in the channel) and 1072 the Irish Sea's mid-sea hex. One diagonal contact remains across the Celtic Sea (GBR 1147 Cornwall ↔ IRL 1071 Dublin coast) — both are genuine shore hexes of major coasts; documented, not cut.",
    corridor: [[-5.9, 55.2], [-5.5, 54.9], [-5.1, 54.6], [-5.3, 53.6], [-5.2, 52.9]], hw: 5.0,
    expect: [994, 1072],
    exclude: { 1071: "Ireland's Dublin coast stays; the cut takes the British-side and mid-sea hexes." },
    checks: [{ a: [-6.9, 56.2], b: [-8.76, 50.67] }],
  },
  {
    id: "taiwan-strait", name: "Taiwan Strait", kind: "strait", code: "o",
    note: "Hex 2041's centroid sits mid-strait; as water it separates Taiwan's two hexes from the mainland coast (which keeps 2040 as its shore).",
    corridor: [[118.6, 23.6], [119.6, 24.6], [120.4, 25.8]], hw: 5.0,
    expect: [2041],
    exclude: {},
    checks: [{ a: [117.6, 22.3], b: [121.9, 26.6] }],
  },
  {
    id: "florida-strait", name: "Straits of Florida", kind: "strait", code: "o",
    note: "Hex 1989 (Florida's strait hex) was the only USA–Cuba land bridge; as water the strait runs Gulf -> Atlantic around the Bahamas' sole hex, which keeps open slots on three sides.",
    corridor: [[-82.2, 24.6], [-81.0, 24.2], [-79.9, 24.0], [-78.8, 24.6]], hw: 5.2,
    expect: [1989],
    exclude: {
      1990: "The Bahamas' ONLY hex — the sole-hex rule; open water already flows around it.",
      2048: "Cuba's north coast stays as the strait's south bank.",
      2049: "Cuba's north coast stays as the strait's south bank.",
    },
    checks: [{ a: [-85.18, 20.73], b: [-77.6, 26.3] }],
  },
  {
    id: "torres-strait", name: "Torres Strait", kind: "strait", code: "o",
    note: "Hex 2780 was the only Australia–Papua land contact in the tiling; its centroid sits in the strait and it carries four open slots, so as water the Coral Sea -> Gulf of Carpentaria lane reads cleanly.",
    corridor: [[141.8, -10.2], [142.8, -10.35], [144.0, -10.5], [145.2, -10.9]], hw: 5.0,
    expect: [2780],
    exclude: { 2749: "Papua's south shore stays; the cut takes the strait's mid-line hex." },
    checks: [{ a: [147.9, -10.6], b: [140.82, -11.09] }],
  },
  {
    id: "bass-strait", name: "Bass Strait", kind: "strait", code: "o",
    note: "The whole strait row (3185, 3186, 3187) between the Victoria coast and Tasmania becomes water — Tasmania was fused to the mainland at three contacts; all three hexes' centroids sit in the strait.",
    corridor: [[143.4, -38.0], [144.8, -38.4], [146.2, -38.8], [147.6, -39.2]], hw: 6.0,
    expect: [3185, 3186, 3187],
    exclude: {
      3173: "Victoria's coast stays as the strait's north bank.",
      3174: "Victoria's coast stays as the strait's north bank.",
      3197: "Tasmania stays land; the cut takes the strait row north of it.",
    },
    checks: [{ a: [139.55, -38.84], b: [150.3, -37.9] }],
  },
  {
    id: "sunda-strait", name: "Sunda Strait", kind: "strait", code: "o",
    note: "Hex 2666 was the only Sumatra–Java land contact; its centroid sits in the strait, with open slots west (Indian Ocean side) and east (Java Sea side).",
    corridor: [[105.2, -5.6], [105.85, -5.95], [106.5, -6.3]], hw: 5.0,
    expect: [2666],
    exclude: { 2705: "Java stays land; the strait hex is 2666." },
    checks: [{ a: [102.55, -5.12], b: [106.89, -5.12] }],
  },
  {
    id: "bohai", name: "Bohai Sea & Strait", kind: "sea", code: "o",
    note: "An enclosed-gulf courtesy cut of the Persian Gulf class: 1615 is the strait mouth hex (centroid in the strait, one open slot to the Yellow Sea) and 1614 the bay-interior hex west of it, so the Bohai reads as a sea instead of filled land. The Shandong peninsula stays.",
    corridor: [[120.9, 38.6], [120.2, 38.5], [119.4, 38.7], [118.6, 39.0]], hw: 5.2,
    expect: [1614, 1615],
    exclude: { 1551: "The Liaodong shore stays; the cut takes the bay's mouth and interior hexes." },
    checks: [{ a: [122.7, 38.2], bHex: 1614 }],
  },
  {
    id: "cook-strait", name: "Cook Strait", kind: "strait", code: "o",
    note: "The cut takes the two Marlborough Sounds hexes (3199, 3200) — drowned-valley coast whose centroids sit in the strait's water — severing every North Island–South Island land contact. Wellington's and Golden Bay's shore hexes stay.",
    corridor: [[172.2, -41.15], [174.0, -40.85], [176.9, -40.85], [178.6, -41.0]], hw: 5.0,
    expect: [3199, 3200],
    exclude: { 3198: "The South Island's Golden Bay shore stays; the cut takes the Sounds-side hexes." },
    checks: [{ a: [173.1, -40.9], b: [178.6, -40.9] }],
  },
];

/* pairs that must have NO land-land adjacency after the pass */
const NO_CONTACT = [
  ["ESP", "MAR"], ["GBR", "FRA"], ["GBR", "BEL"], ["GBR", "NLD"], ["GBR", "DEU"],
  ["ITA", "TUN"], ["CHN", "TWN"], ["USA", "CUB"], ["AUS", "PNG"],
  ["SWE", "DEU"], ["SWE", "DNK"],
];
/* documented residual contacts — must be EXACTLY these pairs, no more */
const RESIDUAL_CONTACTS = [
  { pair: ["GBR", "IRL"], expect: [[1147, 1071]], why: "Celtic Sea diagonal: Cornwall (1147) and Ireland's Dublin coast (1071) are both genuine shore hexes; the North Channel and Irish Sea proper are cut." },
  { pair: ["USA", "BHS"], expect: [[1932, 1990]], why: "The Bahamas' sole hex (1990) touches Florida's coast hex; it cannot be reclassified (sole-hex rule) and open water flows around it on three sides." },
  { pair: ["CUB", "BHS"], expect: [[2049, 1990]], why: "Same sole-hex contact, Cuban side." },
];
/* land-path severances (hex a must not reach hex b over land) */
const NO_LAND_PATH = [
  { a: 2624, b: 2705, why: "Sumatra -> Java (Sunda Strait)" },
  { a: 3174, b: 3196, why: "mainland -> Tasmania (Bass Strait)" },
  { a: 3189, b: 3198, why: "North Island -> South Island (Cook Strait)" },
  { a: 1642, b: 1580, why: "Sicily -> Calabria (Strait of Messina)" },
];

const CHECKED_OPEN = [
  "Korea Strait — verified already open in the source classification: no KOR/PRK–JPN land adjacency anywhere in the strait (the shores sit two water slots apart). No change.",
  "Luzon Strait (Taiwan–Philippines), Yucatán Channel (Mexico–Cuba), Mozambique Channel, Drake Passage, Skagerrak — scanned for land bridges; none exist in the tiling. No change.",
  "Eastern Mediterranean basin around Cyprus — already open water around Cyprus's hex (1708) on two sides; the pass widens its Aegean exit (1644) and turns the Port Said hex into the canal head (1832), so the basin reads as sea from Crete to Port Said.",
];
const NOT_CUT = [
  "Palk Strait (India–Sri Lanka) — land-bridged in the tiling, deliberately NOT cut: the real crossing is Adam's Bridge, ~10 m shallows that are not a navigable sea lane, and severing it would cost two genuine coastal hexes (IND 2360, IND 2400).",
  "Strait of Magellan — bridged at hex scale (CHL 3234) but sub-hex in reality and not the primary lane (the Drake Passage is open); the candidate hexes are genuine shore land.",
  "Cyprus — its single hex (1708) necessarily touches Turkey/Syria/Lebanon in the tiling; it cannot be severed without erasing Cyprus (sole-hex rule class). The sea reads around it via its two open slots.",
  "Kerch Strait / Sea of Azov, Tsugaru and Soya straits (Japan), Qiongzhou Strait (Hainan), Gulf of Aqaba / Tiran — sub-hex, intra-country, or minor enclosed lanes at this scale; left as classified.",
  "Bering Strait — lies on the antimeridian seam: Chukotka renders at the plate's right edge and the Seward Peninsula at its left, both shores already ending at open ocean. (Two RUS–USA lattice adjacencies in the far north are a pre-existing wrap artifact of the source bake, outside this pass's reclassify-only mandate.)",
];

/* ------------------------------------------------------------ selection */
const fail = (msg) => { console.error("FAIL:", msg); process.exit(1); };
if (N !== 3239) fail(`expected 3,239 hexes, world.json has ${N}`);
const codes = terrainJson.terrain.split("");
if (codes.length !== N) fail(`terrain string length ${codes.length} != hex count ${N}`);
const LAND_CODES = new Set(Object.keys(terrainJson.legend).filter((k) => k !== "o" && k !== "c"));

const posCount = new Map();
HEXES.forEach(([x, y]) => posCount.set(`${x},${y}`, (posCount.get(`${x},${y}`) ?? 0) + 1));
const countryHexCount = new Map();
HEXES.forEach(([, , ci]) => countryHexCount.set(ci, (countryHexCount.get(ci) ?? 0) + 1));

const claimed = new Map(); // idx -> waterway
const prevCode = new Map();
/* on a rerun the terrain already carries o/c — recover each hex's original
   land code from the previous run's waterways.json so outputs are stable */
const prevWas = new Map();
if (fs.existsSync(WATERWAYS_P)) {
  try {
    const prev = JSON.parse(fs.readFileSync(WATERWAYS_P, "utf8"));
    for (const [i, v] of Object.entries(prev.hexes ?? {})) if (v.was) prevWas.set(Number(i), v.was);
  } catch { /* first run */ }
}
for (const w of WATERWAYS) {
  const selected = [];
  HEXES.forEach(([x, y], i) => { if (corridorDist(x, y, w.corridor) <= w.hw) selected.push(i); });
  const excluded = selected.filter((i) => i in w.exclude);
  const finalSel = selected.filter((i) => !(i in w.exclude));
  const missingExcl = Object.keys(w.exclude).map(Number).filter((i) => !selected.includes(i));
  if (missingExcl.length) fail(`${w.id}: exclusions not selected by corridor (stale doc): ${missingExcl.join(",")}`);
  const missing = w.expect.filter((i) => !finalSel.includes(i));
  const extra = finalSel.filter((i) => !w.expect.includes(i));
  if (missing.length || extra.length) {
    fail(`${w.id}: corridor-exclusions != expect. missing=${missing.join(",")} extra=${extra.join(",")}`);
  }
  for (const i of w.expect) {
    if (claimed.has(i)) fail(`hex ${i} claimed by both ${claimed.get(i).id} and ${w.id}`);
    claimed.set(i, w);
    const [x, y, ci] = HEXES[i];
    if (posCount.get(`${x},${y}`) > 1) fail(`hex ${i} (${w.id}) shares its position with another hex`);
    if (countryHexCount.get(ci) === 1) fail(`hex ${i} (${w.id}) is ${CCODE[ci]}'s only hex`);
    const cur = codes[i];
    if (!LAND_CODES.has(cur) && cur !== w.code) fail(`hex ${i} currently '${cur}', expected a land code or '${w.code}'`);
    prevCode.set(i, LAND_CODES.has(cur) ? cur : (prevWas.get(i) ?? cur));
  }
  w._excludedApplied = excluded;
}

/* apply */
const newCodes = codes.slice();
for (const [i, w] of claimed) newCodes[i] = w.code;
const isWater = (i) => newCodes[i] === "o" || newCodes[i] === "c";

/* every country keeps at least one land hex */
{
  const landLeft = new Map();
  HEXES.forEach(([, , ci], i) => { if (!isWater(i)) landLeft.set(ci, (landLeft.get(ci) ?? 0) + 1); });
  for (let ci = 0; ci < world.countries.length; ci++) {
    if (countryHexCount.get(ci) > 0 && !landLeft.get(ci)) fail(`country ${CCODE[ci]} erased (no land hex left)`);
  }
}

/* --------------------------------------------------- adjacency (tiling) */
const adj = HEXES.map(() => new Set());
{
  const cell = 7;
  const buckets = new Map();
  HEXES.forEach(([x, y], i) => {
    const k = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  HEXES.forEach(([x, y], i) => {
    const bx = Math.floor(x / cell), by = Math.floor(y / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      for (const j of buckets.get(`${bx + a},${by + b}`) ?? []) {
        if (j <= i) continue;
        const d = Math.hypot(x - HEXES[j][0], y - HEXES[j][1]);
        if (d >= 6.2 && d <= 7.3) { adj[i].add(j); adj[j].add(i); }
      }
    }
  });
}
function countryPairs(a, b) {
  const out = [];
  HEXES.forEach((h, i) => {
    if (CCODE[h[2]] !== a || isWater(i)) return;
    for (const j of adj[i]) if (CCODE[HEXES[j][2]] === b && !isWater(j)) out.push([i, j]);
  });
  return out;
}
function landPath(a, b) {
  const seen = new Set([a]);
  const q = [a];
  while (q.length) {
    const cur = q.pop();
    if (cur === b) return true;
    for (const n of adj[cur]) if (!isWater(n) && !seen.has(n)) { seen.add(n); q.push(n); }
  }
  return false;
}
for (const [a, b] of NO_CONTACT) {
  const p = countryPairs(a, b);
  if (p.length) fail(`land bridge remains: ${a}-${b} pairs ${JSON.stringify(p)}`);
}
for (const r of RESIDUAL_CONTACTS) {
  const p = countryPairs(r.pair[0], r.pair[1]).map(([i, j]) => [Math.min(i, j), Math.max(i, j)]).sort();
  const e = r.expect.map(([i, j]) => [Math.min(i, j), Math.max(i, j)]).sort();
  if (JSON.stringify(p) !== JSON.stringify(e)) fail(`residual contact ${r.pair.join("-")} changed: got ${JSON.stringify(p)}, documented ${JSON.stringify(e)}`);
}
for (const c of NO_LAND_PATH) {
  if (landPath(c.a, c.b)) fail(`land path remains: ${c.why}`);
}

/* ------------------------------------------- lattice water connectivity */
const HW = 6.7552, HV = 5.85;
const nodePos = new Map();
for (let k = 0; ; k++) {
  const y = 14 + k * HV;
  if (y > 514) break;
  const off = k % 2 === 1 ? HW / 2 : 0;
  for (let j = 0; ; j++) {
    const x = 8 + off + j * HW;
    if (x > 954) break;
    nodePos.set(`${j},${k}`, [x, y]);
  }
}
const hexNode = new Array(N);
HEXES.forEach(([x, y], i) => {
  let best = null, bd = Infinity;
  for (const [key, [nx, ny]] of nodePos) {
    const d = Math.hypot(x - nx, y - ny);
    if (d < bd) { bd = d; best = key; }
  }
  hexNode[i] = best;
});
const landNode = new Set();
HEXES.forEach((h, i) => { if (!isWater(i)) landNode.add(hexNode[i]); });
function nodeNeighbors(key) {
  const [j, k] = key.split(",").map(Number);
  const odd = k % 2 === 1;
  const offs = [[1, 0], [-1, 0], [0, -1], [0, 1], odd ? [1, -1] : [-1, -1], odd ? [1, 1] : [-1, 1]];
  return offs.map(([dj, dk]) => `${j + dj},${k + dk}`).filter((kk) => nodePos.has(kk));
}
function waterComponent(startKey) {
  const seen = new Set([startKey]);
  const q = [startKey];
  while (q.length) {
    const cur = q.pop();
    for (const n of nodeNeighbors(cur)) {
      if (!seen.has(n) && !landNode.has(n)) { seen.add(n); q.push(n); }
    }
  }
  return seen;
}
function anchorKey(lonlat, label) {
  const [px, py] = proj(lonlat);
  let best = null, bd = Infinity;
  for (const [key, [nx, ny]] of nodePos) {
    const d = Math.hypot(px - nx, py - ny);
    if (d < bd) { bd = d; best = key; }
  }
  if (bd > 4.6) fail(`anchor ${label} (${lonlat}) snaps ${bd.toFixed(2)} units from its lattice node — too far`);
  if (landNode.has(best)) fail(`anchor ${label} (${lonlat}) lands on a land node`);
  return best;
}
let checkCount = 0;
for (const w of WATERWAYS) {
  for (const chk of w.checks) {
    checkCount++;
    const aKey = chk.aHex !== undefined ? hexNode[chk.aHex] : anchorKey(chk.a, `${w.id} A`);
    const bKey = chk.bHex !== undefined ? hexNode[chk.bHex] : anchorKey(chk.b, `${w.id} B`);
    if (landNode.has(aKey) || landNode.has(bKey)) fail(`${w.id}: check endpoint is a land node`);
    const connected = waterComponent(aKey).has(bKey);
    if (chk.mustFail && connected) fail(`${w.id}: limitation check FAILED — the documented limitation no longer holds (${chk.why})`);
    if (!chk.mustFail && !connected) fail(`${w.id}: water chain broken between check anchors`);
  }
}

/* -------------------------------------------------------------- outputs */
const legend = { ...terrainJson.legend, o: "water", c: "canal" };
const outTerrain = { legend, terrain: newCodes.join("") };

/* the demo asset must currently be identical to the web one — refuse to
   clobber a diverged shared asset */
if (fs.existsSync(DEMO_P)) {
  const demo = JSON.parse(fs.readFileSync(DEMO_P, "utf8"));
  if (demo.terrain !== terrainJson.terrain) fail("demo terrain_by_hex.json has diverged from the web terrain.json — reconcile manually before running");
}

fs.writeFileSync(TERRAIN_P, JSON.stringify(outTerrain) + "\n");
if (fs.existsSync(DEMO_P)) fs.writeFileSync(DEMO_P, JSON.stringify(outTerrain) + "\n");

const waterwaysJson = { version: 1, hexes: {} };
for (const [i, w] of [...claimed.entries()].sort((a, b) => a[0] - b[0])) {
  waterwaysJson.hexes[i] = { waterway: w.id, code: w.code, was: prevCode.get(i) };
}
fs.writeFileSync(WATERWAYS_P, JSON.stringify(waterwaysJson, null, 1) + "\n");

/* WATERWAYS.md */
const nO = [...claimed.values()].filter((w) => w.code === "o").length;
const nC = [...claimed.values()].filter((w) => w.code === "c").length;
const md = [];
md.push("# GeoStory waterways — the canonical list");
md.push("");
md.push("Generated by `scripts/build-waterways.mjs` — rerunning that script regenerates this file and re-applies the pass. Do not edit by hand; edit the corridors/exclusions in the script.");
md.push("");
md.push("Nick (2026-10-23): “In the Earth map, the Suez Canal and the Mediterranean are not represented well. Can you expand them (and other waterways like them).” Design doc §6.6.");
md.push("");
md.push(`**${claimed.size} hexes reclassified** — ${nO} open-water (\`o\`), ${nC} canal (\`c\`) — across ${WATERWAYS.length} waterways. Reclassify only: hex count (3,239), order, adjacency and country assignment are unchanged; every waterway hex keeps its country (canal hexes keep their owner's identity in the renderer). Index \`i\` below is \`WORLD.hexes[i]\` / terrain-string position \`i\`, shared verbatim by the web simulator and the Godot build.`);
md.push("");
md.push("Rules: (1) sole-hex rule — a country's only hex is never reclassified; (2) stacked-position rule — a hex sharing its exact position with another country's hex is never reclassified; (3) at least one shore hex stays land on each side wherever the lattice allows.");
md.push("");
for (const w of WATERWAYS) {
  md.push(`## ${w.name} — \`${w.id}\` (${w.kind}, code \`${w.code}\`)`);
  md.push("");
  md.push(w.note);
  md.push("");
  md.push(`Corridor (lon/lat): ${w.corridor.map(([a, b]) => `(${a}, ${b})`).join(" → ")} · half-width ${w.hw} map units.`);
  md.push("");
  md.push("| Hex | Country | Was | Now |");
  md.push("|----:|---------|-----|-----|");
  for (const i of w.expect) {
    md.push(`| ${i} | ${CNAME[HEXES[i][2]]} (${CCODE[HEXES[i][2]]}) | \`${prevCode.get(i)}\` | \`${w.code}\` |`);
  }
  md.push("");
  const excl = Object.entries(w.exclude);
  if (excl.length) {
    md.push("Corridor hits kept as land (judgment calls):");
    md.push("");
    for (const [i, why] of excl) md.push(`- Hex ${i} (${CCODE[HEXES[Number(i)][2]]}) — ${why}`);
    md.push("");
  }
}
md.push("## Checked — already open, no change");
md.push("");
for (const s of CHECKED_OPEN) md.push(`- ${s}`);
md.push("");
md.push("## Checked — deliberately not cut");
md.push("");
for (const s of NOT_CUT) md.push(`- ${s}`);
md.push("");
md.push("## Documented residual contacts (asserted in the script)");
md.push("");
for (const r of RESIDUAL_CONTACTS) md.push(`- ${r.pair.join("–")} ${JSON.stringify(r.expect)} — ${r.why}`);
md.push("");
md.push(`Verification: ${checkCount} lattice water-connectivity checks passed in-script, the no-contact table (${NO_CONTACT.length} country pairs) is empty, and ${NO_LAND_PATH.length} land-path severances hold. Every country keeps at least one land hex.`);
md.push("");
fs.writeFileSync(MD_P, md.join("\n"));

console.log(`waterways: ${WATERWAYS.length} · hexes reclassified: ${claimed.size} (o=${nO}, c=${nC})`);
console.log(`checks: ${checkCount} connectivity + ${NO_CONTACT.length} no-contact + ${RESIDUAL_CONTACTS.length} residual + ${NO_LAND_PATH.length} land-path — all passed`);
console.log(`wrote: ${path.relative(ROOT, TERRAIN_P)}, ${path.relative(ROOT, WATERWAYS_P)}, ${path.relative(ROOT, MD_P)}${fs.existsSync(DEMO_P) ? ", demo terrain_by_hex.json" : ""}`);
