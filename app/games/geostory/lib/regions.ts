/**
 * Ladder regions (improvements item 4): a COMPLETE partition of the 175
 * countries into 16 regions, used only by the victory ladder ("largest
 * power in its region"). The engine's own REGIONS are crisis geographies
 * (partial, overlapping); where one of them is geographically coherent
 * it is carried over whole — the Sahel is exactly the engine's `sahel`,
 * and South / Southeast Asia, the Horn and Southern Africa start from
 * the engine's lists — and the rest of the world is completed with
 * continent buckets. Every country sits in exactly one region; the
 * improvements probe asserts the partition (175 codes, no dupes).
 */
import { COUNTRIES } from "./data";

export const LADDER_REGIONS: Record<string, string[]> = {
  "North America": ["CAN", "USA", "GRL"],
  "Central America & the Caribbean": ["MEX", "GTM", "HND", "SLV", "NIC", "CRI", "PAN", "BLZ", "CUB", "DOM", "HTI", "JAM", "PRI", "BHS", "TTO"],
  "South America": ["ARG", "CHL", "URY", "BRA", "BOL", "PER", "COL", "VEN", "GUY", "SUR", "ECU", "PRY", "FLK"],
  "Western & Northern Europe": ["FRA", "NOR", "DEU", "CHE", "LUX", "BEL", "NLD", "PRT", "ESP", "IRL", "ITA", "DNK", "GBR", "ISL", "AUT", "FIN", "SWE"],
  "Eastern Europe & the Caucasus": ["RUS", "BLR", "UKR", "POL", "HUN", "MDA", "ROU", "LTU", "LVA", "EST", "BGR", "GRC", "ALB", "HRV", "SVN", "SVK", "CZE", "BIH", "MKD", "SRB", "MNE", "KOS", "ARM", "AZE", "GEO"],
  "Middle East": ["ISR", "LBN", "PSE", "JOR", "ARE", "QAT", "KWT", "IRQ", "OMN", "IRN", "SYR", "TUR", "YEM", "SAU", "CYP", "NCY"],
  "North Africa": ["TUN", "DZA", "MAR", "EGY", "LBY", "ESH"],
  "Sahel": ["MRT", "MLI", "BFA", "NER", "NGA", "TCD", "SDN", "SEN"],
  "Central & West Africa": ["BEN", "CMR", "TGO", "GHA", "CIV", "GIN", "GNB", "LBR", "SLE", "CAF", "COG", "GAB", "GNQ", "GMB", "COD"],
  "Horn & East Africa": ["SOM", "KEN", "ETH", "DJI", "ERI", "UGA", "RWA", "BDI", "SSD", "TZA"],
  "Southern Africa": ["ZAF", "LSO", "ZWE", "BWA", "NAM", "ZMB", "MWI", "MOZ", "SWZ", "AGO", "MDG"],
  "Central Asia": ["KAZ", "UZB", "TJK", "KGZ", "TKM"],
  "South Asia": ["IND", "BGD", "BTN", "NPL", "PAK", "AFG", "LKA"],
  "Southeast Asia": ["IDN", "TLS", "KHM", "THA", "LAO", "MMR", "VNM", "PHL", "MYS", "BRN"],
  "East Asia": ["PRK", "KOR", "MNG", "CHN", "TWN", "JPN"],
  "Oceania": ["FJI", "PNG", "VUT", "NCL", "SLB", "NZL", "AUS", "SOL"],
};

/** region name per country index (parallel to COUNTRIES) */
export const REGION_OF: string[] = COUNTRIES.map((c) => {
  for (const [region, codes] of Object.entries(LADDER_REGIONS)) {
    if (codes.includes(c.code)) return region;
  }
  return "Unassigned";
});

/** region name for a country code */
export function regionOfCode(code: string): string {
  const i = COUNTRIES.findIndex((c) => c.code === code);
  return i >= 0 ? REGION_OF[i] : "Unassigned";
}
