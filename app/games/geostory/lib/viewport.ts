/* Pan/zoom viewport math for the world map — pure functions, probed by
 * scripts/map-viewport-probe.ts.
 *
 * The map plate exactly fills its container at scale 1 (SimPanel cuts
 * the plate box to the plate's 960:520 aspect), so a view is a scale
 * plus a pixel translation, applied as a CSS transform with
 * transform-origin 0 0 on a wrapper around the plate. At scale 1 the
 * view is the identity — the familiar full-map framing is the default
 * and nothing about the un-zoomed layout changes.
 *
 * On a portrait phone the plate is fitted by width and sits in a
 * taller stage; zooming to (stage height / plate height) lets the
 * plate cover the stage's full height, cropping the sides — the pan
 * clamps below keep the scaled plate covering its box on both axes,
 * so any part of the world stays reachable and the plate can never be
 * dragged into empty space. */

export interface MapView { s: number; tx: number; ty: number }

export const MAP_MIN_SCALE = 1;
export const MAP_MAX_SCALE = 6;
export const IDENTITY_VIEW: MapView = { s: 1, tx: 0, ty: 0 };

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Clamp a view for a container of (cw, ch) whose content at scale 1 is
 *  exactly (cw, ch): scale into [MIN, MAX]; on each axis, if the scaled
 *  content is larger than the container the translation ranges over
 *  [container − content, 0] (content always covers the container);
 *  if it is smaller or equal, the content is centred on that axis. */
export function clampMapView(v: MapView, cw: number, ch: number): MapView {
  const s = clampN(v.s, MAP_MIN_SCALE, MAP_MAX_SCALE);
  const axis = (t: number, c: number) => {
    const span = c * s;
    if (span <= c) return (c - span) / 2;
    return clampN(t, c - span, 0);
  };
  return { s, tx: axis(v.tx, cw), ty: axis(v.ty, ch) };
}

/** Zoom by `factor` around the container point (px, py): the content
 *  point under that point stays under it (subject to clamping). */
export function zoomMapAt(v: MapView, cw: number, ch: number, px: number, py: number, factor: number): MapView {
  const s2 = clampN(v.s * factor, MAP_MIN_SCALE, MAP_MAX_SCALE);
  const cx = (px - v.tx) / v.s;
  const cy = (py - v.ty) / v.s;
  return clampMapView({ s: s2, tx: px - cx * s2, ty: py - cy * s2 }, cw, ch);
}

/** Translate by (dx, dy) pixels, clamped. */
export function panMapBy(v: MapView, cw: number, ch: number, dx: number, dy: number): MapView {
  return clampMapView({ s: v.s, tx: v.tx + dx, ty: v.ty + dy }, cw, ch);
}

/** The scale at which a plate rendered at (plateW × plateH) covers a
 *  stage of height `stageH` — how far a portrait phone must zoom for
 *  the map to fill its stage vertically. */
export function fillScale(plateH: number, stageH: number): number {
  return stageH / plateH;
}
