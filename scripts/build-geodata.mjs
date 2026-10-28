/**
 * Precomputes GeoStory map geometry + baseline country data.
 *
 * Run:  node scripts/build-geodata.mjs
 * Out:  app/games/geostory/lib/data/world.json   (paths, centroids, adjacency)
 *       app/games/geostory/lib/data/baseline.json (per-country starting stats)
 *
 * Adjacency is derived from shared TopoJSON arcs (real land borders) plus a
 * small hand list of strait crossings so island powers can play.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { geoNaturalEarth1, geoPath, geoCentroid, geoContains, geoBounds } from "d3-geo";
import { feature } from "topojson-client";

const OUT_DIR = new URL("../app/games/geostory/lib/data/", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

/* ------------------------------------------------------------------ codes */
const NUM2ISO = {
  "004": "AFG", "008": "ALB", "012": "DZA", "024": "AGO", "032": "ARG", "051": "ARM",
  "036": "AUS", "040": "AUT", "031": "AZE", "044": "BHS", "050": "BGD", "112": "BLR",
  "056": "BEL", "084": "BLZ", "204": "BEN", "064": "BTN", "068": "BOL", "070": "BIH",
  "072": "BWA", "076": "BRA", "096": "BRN", "100": "BGR", "854": "BFA", "108": "BDI",
  "116": "KHM", "120": "CMR", "124": "CAN", "140": "CAF", "148": "TCD", "152": "CHL",
  "156": "CHN", "170": "COL", "178": "COG", "180": "COD", "188": "CRI", "191": "HRV",
  "192": "CUB", "196": "CYP", "203": "CZE", "384": "CIV", "208": "DNK", "262": "DJI",
  "214": "DOM", "218": "ECU", "818": "EGY", "222": "SLV", "226": "GNQ", "232": "ERI",
  "233": "EST", "748": "SWZ", "231": "ETH", "242": "FJI", "246": "FIN", "250": "FRA",
  "266": "GAB", "270": "GMB", "268": "GEO", "276": "DEU", "288": "GHA", "300": "GRC",
  "304": "GRL", "320": "GTM", "324": "GIN", "624": "GNB", "328": "GUY", "332": "HTI",
  "340": "HND", "348": "HUN", "352": "ISL", "356": "IND", "360": "IDN", "364": "IRN",
  "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA", "388": "JAM", "392": "JPN",
  "400": "JOR", "398": "KAZ", "404": "KEN", "414": "KWT", "417": "KGZ", "418": "LAO",
  "428": "LVA", "422": "LBN", "426": "LSO", "430": "LBR", "434": "LBY", "440": "LTU",
  "442": "LUX", "807": "MKD", "450": "MDG", "454": "MWI", "458": "MYS", "466": "MLI",
  "478": "MRT", "484": "MEX", "498": "MDA", "496": "MNG", "499": "MNE", "504": "MAR",
  "508": "MOZ", "104": "MMR", "516": "NAM", "524": "NPL", "528": "NLD", "540": "NCL",
  "554": "NZL", "558": "NIC", "562": "NER", "566": "NGA", "408": "PRK", "578": "NOR",
  "512": "OMN", "586": "PAK", "275": "PSE", "591": "PAN", "598": "PNG", "600": "PRY",
  "604": "PER", "608": "PHL", "616": "POL", "620": "PRT", "630": "PRI", "634": "QAT",
  "642": "ROU", "643": "RUS", "646": "RWA", "728": "SSD", "682": "SAU", "686": "SEN",
  "688": "SRB", "694": "SLE", "703": "SVK", "705": "SVN", "090": "SLB", "706": "SOM",
  "710": "ZAF", "410": "KOR", "724": "ESP", "144": "LKA", "729": "SDN", "740": "SUR",
  "752": "SWE", "756": "CHE", "760": "SYR", "158": "TWN", "762": "TJK", "834": "TZA",
  "764": "THA", "626": "TLS", "768": "TGO", "780": "TTO", "788": "TUN", "792": "TUR",
  "795": "TKM", "800": "UGA", "804": "UKR", "784": "ARE", "826": "GBR", "840": "USA",
  "858": "URY", "860": "UZB", "548": "VUT", "862": "VEN", "704": "VNM", "732": "ESH",
  "887": "YEM", "894": "ZMB", "716": "ZWE", "238": "FLK",
};
const NAME2ISO = { Kosovo: "KOS", "N. Cyprus": "NCY", Somaliland: "SOL" };

/* ------------------------------------------------------- majors (approx.) */
// gdp $T, pop M, mil $B, tech 0-100, energy/minerals/food 0-100, growth %/yr,
// receptivity 0-1 (how open to foreign influence), stability 0-1
const MAJORS = {
  USA: [29.2, 340, 997, 96, 88, 72, 92, 1.9, 0.45, 0.72], CHN: [18.5, 1410, 314, 84, 62, 78, 74, 4.2, 0.30, 0.78],
  IND: [3.9, 1450, 86, 58, 38, 55, 78, 6.3, 0.62, 0.62], JPN: [4.0, 124, 55, 90, 12, 30, 40, 0.8, 0.35, 0.86],
  DEU: [4.7, 84, 89, 90, 18, 35, 62, 0.6, 0.40, 0.88], GBR: [3.6, 68, 82, 89, 30, 28, 50, 1.0, 0.48, 0.80],
  FRA: [3.2, 66, 65, 88, 34, 30, 72, 0.9, 0.42, 0.80], ITA: [2.4, 59, 38, 80, 14, 26, 58, 0.5, 0.45, 0.74],
  BRA: [2.2, 216, 21, 55, 66, 82, 95, 2.4, 0.66, 0.55], CAN: [2.2, 41, 29, 85, 95, 88, 80, 1.4, 0.44, 0.88],
  RUS: [2.2, 144, 149, 68, 98, 94, 76, 1.2, 0.28, 0.60], KOR: [1.9, 52, 48, 93, 10, 24, 42, 1.6, 0.38, 0.84],
  AUS: [1.8, 27, 34, 82, 86, 96, 84, 1.8, 0.46, 0.90], ESP: [1.7, 48, 24, 78, 16, 24, 66, 1.6, 0.46, 0.80],
  MEX: [1.85, 130, 12, 52, 58, 60, 66, 1.8, 0.58, 0.52], IDN: [1.4, 284, 11, 50, 64, 78, 82, 4.8, 0.68, 0.64],
  NLD: [1.23, 18, 22, 91, 26, 20, 70, 1.0, 0.40, 0.90], TUR: [1.3, 86, 25, 62, 22, 40, 72, 3.4, 0.52, 0.58],
  SAU: [1.07, 33, 80, 66, 99, 45, 12, 2.4, 0.30, 0.74], CHE: [0.95, 9, 6, 94, 20, 18, 46, 1.0, 0.34, 0.95],
  POL: [0.92, 37, 47, 70, 30, 42, 74, 2.6, 0.48, 0.76], ARE: [0.51, 9.5, 22, 74, 96, 30, 10, 3.6, 0.36, 0.82],
  ARG: [0.63, 46, 3, 52, 62, 64, 97, 1.8, 0.58, 0.48], NGA: [0.25, 232, 2, 30, 78, 60, 68, 3.2, 0.74, 0.38],
  EGY: [0.33, 112, 5, 46, 52, 38, 60, 3.6, 0.60, 0.55], PAK: [0.37, 250, 9, 42, 30, 30, 70, 3.4, 0.66, 0.42],
  BGD: [0.46, 173, 5, 44, 16, 18, 74, 5.2, 0.70, 0.55], VNM: [0.48, 101, 7, 55, 30, 36, 80, 6.0, 0.60, 0.70],
  PHL: [0.44, 114, 6, 50, 20, 34, 64, 5.4, 0.66, 0.60], THA: [0.53, 72, 6, 58, 18, 26, 84, 2.2, 0.56, 0.62],
  MYS: [0.42, 34, 4, 60, 62, 44, 62, 4.0, 0.58, 0.68], IRN: [0.44, 91, 10, 58, 97, 66, 54, 2.6, 0.30, 0.52],
  IRQ: [0.26, 46, 6, 40, 95, 30, 36, 3.0, 0.62, 0.36], ISR: [0.54, 10, 34, 95, 14, 16, 44, 2.4, 0.36, 0.66],
  ZAF: [0.40, 63, 3, 52, 48, 84, 58, 1.6, 0.64, 0.50], ETH: [0.21, 129, 2, 26, 20, 34, 72, 6.0, 0.72, 0.40],
  KEN: [0.13, 56, 2, 38, 18, 30, 66, 5.0, 0.72, 0.52], UKR: [0.18, 38, 65, 55, 34, 48, 88, 1.0, 0.44, 0.45],
  SWE: [0.61, 10.5, 12, 92, 36, 52, 54, 1.4, 0.38, 0.92], NOR: [0.58, 5.5, 11, 90, 94, 44, 40, 1.2, 0.36, 0.94],
  CHL: [0.34, 19.6, 5, 58, 30, 92, 64, 2.2, 0.50, 0.66], COL: [0.42, 52, 6, 48, 52, 46, 70, 2.6, 0.60, 0.50],
  PER: [0.29, 34, 2, 46, 44, 88, 68, 3.0, 0.60, 0.52], KAZ: [0.29, 20, 2, 52, 92, 90, 66, 3.4, 0.40, 0.66],
  UZB: [0.11, 36, 1, 40, 60, 62, 64, 5.6, 0.46, 0.66], DZA: [0.27, 46, 18, 42, 94, 40, 30, 2.8, 0.42, 0.58],
  AGO: [0.09, 37, 2, 30, 90, 66, 48, 3.4, 0.62, 0.52], MAR: [0.15, 37, 5, 46, 8, 44, 62, 3.4, 0.56, 0.66],
  TWN: [0.80, 23, 16, 96, 6, 20, 34, 2.6, 0.36, 0.86],
};
// secondary economies: [gdp $T, pop M] — other stats derived in the engine data step
const SECONDARY = {
  BEL: [0.66, 11.7], AUT: [0.53, 9.1], IRL: [0.60, 5.3], DNK: [0.43, 5.9], FIN: [0.30, 5.6],
  PRT: [0.29, 10.6], GRC: [0.25, 10.4], CZE: [0.33, 10.9], ROU: [0.38, 19], HUN: [0.22, 9.6],
  SVK: [0.14, 5.4], HRV: [0.09, 3.9], SVN: [0.07, 2.1], LTU: [0.08, 2.9], LVA: [0.045, 1.9],
  EST: [0.045, 1.4], ISL: [0.033, 0.39], CYP: [0.036, 1.3], SRB: [0.09, 6.6], BIH: [0.03, 3.2],
  ALB: [0.027, 2.8], MKD: [0.016, 1.8], MNE: [0.008, 0.6], BLR: [0.076, 9.2], MDA: [0.018, 2.5],
  GEO: [0.034, 3.7], ARM: [0.026, 2.8], AZE: [0.08, 10.4], QAT: [0.22, 2.9], KWT: [0.16, 4.3],
  OMN: [0.11, 5.3], LBY: [0.05, 6.9], TUN: [0.05, 12.2], JOR: [0.055, 11.3], LBN: [0.02, 5.8],
  SYR: [0.01, 23], YEM: [0.02, 34], AFG: [0.017, 41], PRK: [0.03, 26], MMR: [0.07, 54],
  KHM: [0.05, 17], LAO: [0.015, 7.7], NPL: [0.04, 30], LKA: [0.09, 22], MNG: [0.02, 3.4],
  TJK: [0.012, 10.4], KGZ: [0.017, 7], TKM: [0.06, 7], NZL: [0.26, 5.3], PNG: [0.031, 10.6],
  CUB: [0.10, 11], DOM: [0.13, 11.4], GTM: [0.11, 18], ECU: [0.12, 18], BOL: [0.05, 12.4],
  PRY: [0.04, 6.8], URY: [0.08, 3.4], CRI: [0.09, 5.1], PAN: [0.09, 4.5], HTI: [0.02, 11.8],
  SLV: [0.035, 6.3], HND: [0.037, 10.6], NIC: [0.018, 7.0], JAM: [0.019, 2.8], TTO: [0.026, 1.5],
  GUY: [0.02, 0.8], SUR: [0.004, 0.6], VEN: [0.12, 28.5], SDN: [0.03, 50], SSD: [0.006, 11],
  SOM: [0.012, 18], GHA: [0.082, 34], CIV: [0.087, 29], CMR: [0.053, 29], TZA: [0.08, 68],
  UGA: [0.055, 49], ZMB: [0.026, 21], ZWE: [0.027, 16], MOZ: [0.022, 34], MDG: [0.016, 31],
  MLI: [0.019, 23], BFA: [0.021, 23], NER: [0.017, 27], TCD: [0.013, 19], SEN: [0.032, 18],
  GIN: [0.024, 14.5], BEN: [0.021, 13.7], RWA: [0.014, 14.2], MRT: [0.011, 4.9], TGO: [0.010, 9],
  COD: [0.07, 105], COG: [0.015, 6.2], GAB: [0.021, 2.4], NAM: [0.013, 3.0], BWA: [0.019, 2.5],
  MWI: [0.013, 21], TLS: [0.002, 1.4], BRN: [0.016, 0.45],
  /* small-nation data correction (2026-10-28): these rows were NOT in any
     table, so the hash fallback below invented their GDP/pop (PRI got
     $3B and no army; Luxembourg got $3B too; Bulgaria 0.9M people).
     Figures are real ~2024 nominal GDP / population (World Bank unless
     noted) — see GEOSTORY_TUNING.md "Small-nation package" for sources
     and the rows deliberately left alone (ESH, SOL, FLK). */
  PRI: [0.105, 3.2], LUX: [0.093, 0.7], BGR: [0.113, 6.4], KOS: [0.011, 1.7],
  PSE: [0.014, 5.5], BHS: [0.014, 0.4], NCL: [0.010, 0.3], SLE: [0.008, 8.6],
  GNQ: [0.007, 1.9], FJI: [0.006, 0.9], SWZ: [0.005, 1.2], LBR: [0.005, 5.6],
  DJI: [0.004, 1.2], BLZ: [0.003, 0.4], BTN: [0.003, 0.8], GRL: [0.003, 0.06],
  CAF: [0.003, 5.5], BDI: [0.003, 13.7], GMB: [0.002, 2.7], GNB: [0.002, 2.2],
  LSO: [0.002, 2.4], SLB: [0.002, 0.8], VUT: [0.001, 0.3], ERI: [0.002, 3.7],
  NCY: [0.007, 0.4],
};
// resource overrides for non-majors: [energy, minerals, food]
const RES_OVERRIDES = {
  COD: [25, 95, 60], GUY: [88, 40, 55], PNG: [55, 78, 60], ZMB: [30, 85, 62], GIN: [20, 80, 55],
  TCD: [72, 25, 40], COG: [78, 30, 45], GNQ: [82, 20, 40], GAB: [76, 60, 42], MOZ: [68, 58, 58],
  MRT: [58, 52, 35], LBY: [92, 30, 25], VEN: [96, 40, 55], QAT: [98, 25, 8], KWT: [97, 25, 10],
  OMN: [90, 30, 30], PRK: [35, 55, 45], BOL: [70, 72, 60], TKM: [90, 30, 45], AZE: [88, 35, 50],
};

/* ------------------------------------------------------------- helpers */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}
const round1 = (n) => Math.round(n * 10) / 10;

/* ----------------------------------------------------------------- main */
const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8"));
const fc = feature(topo, topo.objects.countries);

const proj = geoNaturalEarth1().fitExtent([[6, 26], [954, 494]], fc);
const pathGen = geoPath(proj);

function roundPath(d) {
  return d.replace(/-?\d+\.\d+/g, (m) => String(Math.round(parseFloat(m) * 10) / 10));
}

/* adjacency from shared arcs */
const geoms = topo.objects.countries.geometries;
const arcOwners = new Map();
function collectArcs(arcs, idx) {
  for (const a of arcs) {
    if (Array.isArray(a)) collectArcs(a, idx);
    else {
      const key = a < 0 ? ~a : a;
      if (!arcOwners.has(key)) arcOwners.set(key, new Set());
      arcOwners.get(key).add(idx);
    }
  }
}
geoms.forEach((g, i) => collectArcs(g.arcs ?? [], i));
const adjIdx = geoms.map(() => new Set());
for (const owners of arcOwners.values()) {
  const arr = [...owners];
  for (const a of arr) for (const b of arr) if (a !== b) adjIdx[a].add(b);
}

const countries = [];
const keptFeatures = [];
const skipped = [];
fc.features.forEach((f, i) => {
  const name = f.properties.name;
  if (name === "Antarctica" || name === "Fr. S. Antarctic Lands") { skipped.push(name); return; }
  const num = String(f.id).padStart(3, "0");
  const code = NUM2ISO[num] ?? NAME2ISO[name];
  if (!code) { skipped.push(`${name} (${f.id})`); return; }
  const c = geoCentroid(f);
  const [cx, cy] = proj(c);
  keptFeatures.push(f);
  countries.push({
    code, name,
    path: roundPath(pathGen(f)),
    cx: round1(cx), cy: round1(cy),
    lon: round1(c[0]), lat: round1(c[1]),
    adj: [...adjIdx[i]].map((j) => {
      const g = geoms[j]; const n2 = g.properties.name;
      return NUM2ISO[String(g.id).padStart(3, "0")] ?? NAME2ISO[n2];
    }).filter(Boolean),
  });
});

/* strait / short-sea adjacencies so island powers can expand */
const STRAITS = [["GBR", "FRA"], ["ESP", "MAR"], ["RUS", "USA"], ["JPN", "KOR"], ["CUB", "USA"], ["IDN", "AUS"], ["DNK", "GBR"], ["ITA", "TUN"], ["GRC", "CYP"], ["MYS", "SGP"],
  /* island nations must be able to expand too — every country needs a maritime neighbour */
  ["MDG", "MOZ"], ["MDG", "TZA"], ["NZL", "AUS"], ["PHL", "MYS"], ["PHL", "TWN"], ["PHL", "VNM"], ["LKA", "IND"], ["TWN", "CHN"],
  ["ISL", "GBR"], ["ISL", "GRL"], ["GRL", "CAN"], ["JAM", "CUB"], ["JAM", "HTI"], ["BHS", "CUB"], ["BHS", "USA"], ["PRI", "DOM"],
  ["TTO", "VEN"], ["FJI", "SLB"], ["FJI", "VUT"], ["VUT", "NCL"], ["VUT", "SLB"], ["NCL", "AUS"], ["SLB", "PNG"], ["FLK", "ARG"]];
const byCode = Object.fromEntries(countries.map((c) => [c.code, c]));
for (const [a, b] of STRAITS) {
  if (byCode[a] && byCode[b]) {
    if (!byCode[a].adj.includes(b)) byCode[a].adj.push(b);
    if (!byCode[b].adj.includes(a)) byCode[b].adj.push(a);
  }
}
for (const c of countries) c.adj.sort();

/* ------------------------------------------------------------- baseline */
const baseline = {};
for (const c of countries) {
  const m = MAJORS[c.code];
  if (m) {
    baseline[c.code] = {
      gdp: m[0], pop: m[1], mil: m[2], tech: m[3],
      energy: m[4], minerals: m[5], food: m[6],
      growth: m[7], receptivity: m[8], stability: m[9], major: true,
    };
    continue;
  }
  const s = SECONDARY[c.code];
  const h1 = hashStr(c.code + "a"), h2 = hashStr(c.code + "b"), h3 = hashStr(c.code + "c"), h4 = hashStr(c.code + "d");
  const gdp = s ? s[0] : 0.002 + h1 * 0.015;
  const pop = s ? s[1] : 0.1 + h2 * 2.5;
  const gdppc = (gdp * 1e6) / pop; // $ thousands per capita... (gdp $T / pop M = $k)
  const tech = Math.max(14, Math.min(90, 16 + 30 * Math.log10(gdppc / 1000 + 1) + (h3 - 0.5) * 8));
  const res = RES_OVERRIDES[c.code];
  baseline[c.code] = {
    gdp: Math.round(gdp * 1000) / 1000,
    pop: Math.round(pop * 10) / 10,
    mil: Math.round(gdp * 1000 * (0.008 + h4 * 0.024) * 10) / 10,
    tech: Math.round(tech),
    energy: res ? res[0] : Math.round(8 + h1 * 55),
    minerals: res ? res[1] : Math.round(8 + h2 * 55),
    food: res ? res[2] : Math.round(25 + h3 * 60),
    growth: Math.round((1.6 + (gdppc < 3 ? 2.6 : gdppc < 12 ? 1.8 : 0.8) * h4 + (h1 - 0.5)) * 10) / 10,
    receptivity: Math.round((0.34 + h2 * 0.44) * 100) / 100,
    stability: Math.round((0.34 + h3 * 0.5) * 100) / 100,
    major: false,
  };
}

/* ------------------------------------------------------------- hex grid */
/* Pointy-top hexes in projected pixel space. Only LAND hexes are stored
 * ([x, y, countryIndex]); the client rebuilds the full grid (incl. ocean)
 * from these constants. */
const HEX_R = 3.9;
const HEX_W = Math.sqrt(3) * HEX_R; // horizontal spacing
const HEX_V = 1.5 * HEX_R;          // vertical spacing
const bounds = keptFeatures.map((f) => geoBounds(f));
const hexes = [];
const hexCount = new Array(countries.length).fill(0);
/* sample the centre + a ring of 6 sub-points so thin/diagonal countries
 * (JPN, GBR, KOR) still claim the hexes they overlap; majority wins */
const SAMPLE_OFFS = [[0, 0]];
for (let k = 0; k < 6; k++) {
  const a = (Math.PI / 3) * k;
  SAMPLE_OFFS.push([Math.cos(a) * HEX_R * 0.62, Math.sin(a) * HEX_R * 0.62]);
}
let row = 0;
for (let y = 14; y <= 512; y += HEX_V, row++) {
  const xOff = row % 2 ? HEX_W / 2 : 0;
  for (let x = 8 + xOff; x <= 956; x += HEX_W) {
    const lonlat = proj.invert([x, y]);
    if (!lonlat) continue;
    let best = -1, bestHits = 0;
    for (let ci = 0; ci < keptFeatures.length; ci++) {
      const b = bounds[ci];
      const wrapped = b[1][0] < b[0][0]; // antimeridian-crossing (RUS, FJI, USA, NZL)
      const lonOk = wrapped
        ? lonlat[0] >= b[0][0] - 3 || lonlat[0] <= b[1][0] + 3
        : lonlat[0] >= b[0][0] - 3 && lonlat[0] <= b[1][0] + 3;
      if (!lonOk || lonlat[1] < b[0][1] - 3 || lonlat[1] > b[1][1] + 3) continue;
      let hits = 0;
      for (const [dx, dy] of SAMPLE_OFFS) {
        const p = proj.invert([x + dx, y + dy]);
        if (p && geoContains(keptFeatures[ci], p)) hits++;
      }
      if (hits > bestHits) { bestHits = hits; best = ci; }
    }
    if (best >= 0) {
      hexes.push([round1(x), round1(y), best]);
      hexCount[best]++;
    }
  }
}
/* every country gets at least one tile: snap its centroid to the grid */
countries.forEach((c, ci) => {
  if (hexCount[ci] > 0) return;
  const r = Math.round((c.cy - 14) / HEX_V);
  const xOff = r % 2 ? HEX_W / 2 : 0;
  const col = Math.round((c.cx - 8 - xOff) / HEX_W);
  hexes.push([round1(8 + xOff + col * HEX_W), round1(14 + r * HEX_V), ci]);
  hexCount[ci]++;
});
hexes.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

const world = { width: 960, height: 520, hexR: HEX_R, hexW: round1(HEX_W * 100) / 100, hexV: HEX_V, hexX0: 8, hexY0: 14, hexes, countries: countries.map(({ code, name, path, cx, cy, lon, lat, adj }) => ({ code, name, path, cx, cy, lon, lat, adj })) };
writeFileSync(new URL("world.json", OUT_DIR), JSON.stringify(world));
writeFileSync(new URL("baseline.json", OUT_DIR), JSON.stringify(baseline, null, 1));

/* --------------------------------------------------------------- report */
console.log(`countries: ${countries.length}`);
console.log(`skipped: ${skipped.join(", ") || "none"}`);
const missingMajors = Object.keys(MAJORS).filter((k) => !byCode[k]);
console.log(`missing majors: ${missingMajors.join(", ") || "none"}`);
for (const probe of ["USA", "FRA", "CHN", "GBR", "JPN", "AUS"]) {
  console.log(`${probe} adj: ${byCode[probe]?.adj.join(" ")}`);
}
const size = JSON.stringify(world).length + JSON.stringify(baseline).length;
console.log(`total data size: ${(size / 1024).toFixed(0)} KB`);
console.log(`land hexes: ${hexes.length}; countries with 1 hex: ${hexCount.filter((n) => n === 1).length}; max hexes (${countries[hexCount.indexOf(Math.max(...hexCount))].code}): ${Math.max(...hexCount)}`);
