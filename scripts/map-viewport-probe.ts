/* Map viewport probe — geometry checks for lib/viewport.ts, the pan/zoom
 * math behind WorldMap's portrait-phone fix. No DOM: the plate box is
 * cut to the plate's aspect (960×520) at the phone's width, the stage
 * is the space between the 48px header clearance and the deck.
 * Run: npx tsx scripts/map-viewport-probe.ts */
import { clampMapView, fillScale, IDENTITY_VIEW, MAP_MAX_SCALE, panMapBy, zoomMapAt, type MapView } from "../app/games/geostory/lib/viewport";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const near = (a: number, b: number, eps = 0.51) => Math.abs(a - b) <= eps;

/* phone portrait geometries: width, a representative 100dvh, deck height */
const PHONES = [
  { w: 375, dvh: 667, deck: 212 },
  { w: 390, dvh: 844, deck: 236 },
  { w: 430, dvh: 932, deck: 248 },
];
const PLATE_AR = 520 / 960;

for (const p of PHONES) {
  const cw = p.w;
  const ch = cw * PLATE_AR; // plate box height at this width
  const stageH = p.dvh - 48 - p.deck;

  // default view is the identity — the familiar full-map framing
  const id = clampMapView(IDENTITY_VIEW, cw, ch);
  check(`${p.w}px: default view is identity`, id.s === 1 && id.tx === 0 && id.ty === 0);

  // the zoom needed to fill the stage height exists inside the limits,
  // and at that scale the plate's rendered height covers the stage
  const fs = fillScale(ch, stageH);
  check(`${p.w}px: fill scale ${fs.toFixed(2)} within [1, ${MAP_MAX_SCALE}]`, fs >= 1 && fs <= MAP_MAX_SCALE);
  const filled = zoomMapAt(IDENTITY_VIEW, cw, ch, cw / 2, ch / 2, fs);
  check(`${p.w}px: at fill scale the plate covers the stage height`, ch * filled.s >= stageH - 0.01,
    `rendered ${(ch * filled.s).toFixed(0)}px vs stage ${stageH}px`);

  // zoom keeps the anchored content point fixed (before clamping bites)
  const v = zoomMapAt(IDENTITY_VIEW, cw, ch, cw * 0.3, ch * 0.4, 2);
  check(`${p.w}px: zoom anchors the tapped point`,
    near((cw * 0.3 - v.tx) / v.s, cw * 0.3) && near((ch * 0.4 - v.ty) / v.s, ch * 0.4));

  // pan clamps: the scaled plate always covers the box on both axes
  let w: MapView = zoomMapAt(IDENTITY_VIEW, cw, ch, cw / 2, ch / 2, 3);
  w = panMapBy(w, cw, ch, -99999, -99999);
  check(`${p.w}px: pan clamps at the far corner`, near(w.tx, cw - cw * 3) && near(w.ty, ch - ch * 3));
  w = panMapBy(w, cw, ch, 99999, 99999);
  check(`${p.w}px: pan clamps back at the origin`, w.tx === 0 && w.ty === 0);

  // scale clamps at both ends
  check(`${p.w}px: zoom clamps at max`, zoomMapAt(IDENTITY_VIEW, cw, ch, 0, 0, 100).s === MAP_MAX_SCALE);
  check(`${p.w}px: zoom clamps at min (identity framing)`, (() => { const z = zoomMapAt(w, cw, ch, 10, 10, 0.001); return z.s === 1 && z.tx === 0 && z.ty === 0; })());
}

/* desktop: a wide stage — default framing untouched, zoom still sane */
{
  const cw = 1440, ch = 1440 * PLATE_AR;
  const id = clampMapView(IDENTITY_VIEW, cw, ch);
  check("desktop: default view is identity", id.s === 1 && id.tx === 0 && id.ty === 0);
  const v = zoomMapAt(IDENTITY_VIEW, cw, ch, cw / 2, ch / 2, 1.5);
  check("desktop: centre zoom keeps centre fixed", near((cw / 2 - v.tx) / v.s, cw / 2) && near((ch / 2 - v.ty) / v.s, ch / 2));
}

console.log(failures ? `\n${failures} PROBE FAILURE(S)` : "\nALL VIEWPORT CHECKS PASS");
process.exit(failures ? 1 : 0);
