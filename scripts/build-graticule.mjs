/**
 * Precomputes cartographic linework (graticule) in map coordinates using the
 * exact same projection as scripts/build-geodata.mjs.
 *
 * Run:  node scripts/build-graticule.mjs
 * Out:  app/games/geostory/lib/graticule.ts
 */
import { geoNaturalEarth1, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import { readFileSync, writeFileSync } from "node:fs";

const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/countries-110m.json", import.meta.url), "utf8"));
const fc = feature(topo, topo.objects.countries);
const proj = geoNaturalEarth1().fitExtent([[6, 26], [954, 494]], fc);
const path = geoPath(proj);

// fine graticule every 15 degrees + the graticule outline (sphere edge)
const grat = geoGraticule().step([15, 15]);
const fine = path(grat());
const outline = path(grat.outline());

const round = (s) => s.replace(/(\d+\.\d{2})\d+/g, "$1");
const out = `/** Precomputed cartographic linework in map coordinates (960x520),
 *  generated with the same Natural Earth projection as world.json.
 *  Regenerate with: node scripts/build-graticule.mjs */
export const GRATICULE_PATH = "${round(fine)}";
export const GRATICULE_OUTLINE = "${round(outline)}";
`;
writeFileSync(new URL("../app/games/geostory/lib/graticule.ts", import.meta.url), out);
console.log("fine path chars:", fine.length, "| outline chars:", outline.length);
