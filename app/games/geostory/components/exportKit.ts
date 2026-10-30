/**
 * GeoStory export kit — turns a finished deterministic run into clean,
 * social-ready artifacts: a recap card PNG and an animated timelapse video,
 * plus a copy-paste caption. Everything renders client-side on canvas from
 * the panel's already-computed SimResult; nothing here touches sim state,
 * and the same seed + settings always produce the same artifacts.
 *
 * Branding is the Stratatir chart-room identity only — deep navy, gold,
 * cream. No page UI chrome ever enters the frame.
 */
import { COUNTRIES, END_YEAR, START_YEAR, WORLD, fmtGdp } from "../lib/data";
import type { SimConfig, SimResult } from "../lib/engine";
import { GRATICULE_OUTLINE, GRATICULE_PATH } from "../lib/graticule";
import { finalLadder, rankByYear } from "../lib/ladder";
import { getScenario, powerColor } from "../lib/scenarios";
import { challengeUrl } from "../lib/share";
import { WATERWAY_HEXES } from "../lib/terrain";
import { eventWhy } from "../lib/why";
import { COMPOUND_PATH, HEXES_BY_COUNTRY, countryFill } from "./WorldMap";

export const GOLD = "#f0c060";
export const GOLD_DEEP = "#c9963a";
export const CREAM = "#f7f0e3";
export const PARCH = "#cdbfa5";
export const MUTED = "#93a7bd";
export const INK = "#081426";

const DISPLAY = `"Bebas Neue", "Arial Narrow", sans-serif`;
const SERIF = `"Playfair Display", Georgia, serif`;
const SANS = `"DM Sans", system-ui, sans-serif`;

/* ------------------------------------------------------------ small helpers */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "run";
}

/** clipboard copy with a textarea fallback for older / non-secure contexts */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function videoExportSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load(`64px "Playfair Display"`),
      document.fonts.load(`32px "Bebas Neue"`),
      document.fonts.load(`20px "DM Sans"`),
      document.fonts.ready,
    ]);
  } catch { /* fall back to system fonts */ }
}

/* ------------------------------------------------------------- map drawing
 * The atlas plate, redrawn on canvas with the same geometry + fills as the
 * on-page SVG map. Path2D objects are built once and cached — the source
 * path strings never change. */
let compoundCache: Path2D[] | null = null;
let borderCache: Path2D[] | null = null;
let graticuleCache: Path2D | null = null;
let outlineCache: Path2D | null = null;
let waterwayCache: Path2D[] | null = null;

function paths() {
  if (!compoundCache) compoundCache = COMPOUND_PATH.map((d) => new Path2D(d));
  if (!borderCache) borderCache = COUNTRIES.map((c) => new Path2D(c.path));
  if (!graticuleCache) graticuleCache = new Path2D(GRATICULE_PATH);
  if (!outlineCache) outlineCache = new Path2D(GRATICULE_OUTLINE);
  if (!waterwayCache) waterwayCache = WATERWAY_HEXES.map((h) => new Path2D(h.d));
  return { compound: compoundCache, borders: borderCache, grat: graticuleCache, outline: outlineCache, waterways: waterwayCache };
}

function drawCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4,16,30,0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(240,192,96,0.5)";
  ctx.lineWidth = r * 0.045;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(240,192,96,0.3)";
  ctx.lineWidth = r * 0.03;
  ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (Math.PI / 4) * k - Math.PI / 2;
    const long = k % 2 === 0;
    const len = long ? r : r * 0.58;
    const wdt = long ? r * 0.16 : r * 0.11;
    const px = cx + Math.cos(a) * len, py = cy + Math.sin(a) * len;
    const bx = cx + Math.cos(a + Math.PI / 2) * wdt, by = cy + Math.sin(a + Math.PI / 2) * wdt;
    const bx2 = cx + Math.cos(a - Math.PI / 2) * wdt, by2 = cy + Math.sin(a - Math.PI / 2) * wdt;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(px, py);
    ctx.lineTo(bx2, by2);
    ctx.closePath();
    ctx.fillStyle = long ? "rgba(240,192,96,0.85)" : "rgba(240,192,96,0.4)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.font = `${r * 0.52}px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cy - r * 1.38 + r * 0.4);
  ctx.restore();
}

/** draw the full atlas plate with its top-left corner at (dx, dy), width dw */
export function drawMapPlate(
  ctx: CanvasRenderingContext2D,
  result: SimResult,
  yearIdx: number,
  dx: number,
  dy: number,
  dw: number,
) {
  const p = paths();
  const s = dw / WORLD.width;
  const dh = WORLD.height * s;
  const leaderCode = result.leaders[yearIdx]?.[0]?.code;
  const leaderIdx = leaderCode ? COUNTRIES.findIndex((c) => c.code === leaderCode) : -1;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(s, s);
  const ocean = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  ocean.addColorStop(0, "#0d2f52");
  ocean.addColorStop(0.55, "#081f38");
  ocean.addColorStop(1, "#040f1e");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = "rgba(150,190,230,0.07)";
  ctx.lineWidth = 0.7;
  ctx.stroke(p.grat);
  for (let i = 0; i < COUNTRIES.length; i++) {
    ctx.fillStyle = countryFill(result, yearIdx, i, "territory", leaderIdx);
    ctx.fill(p.compound[i]);
    ctx.strokeStyle = "rgba(3,10,20,0.55)";
    ctx.lineWidth = 0.4;
    ctx.stroke(p.compound[i]);
  }
  /* waterways cut through the fills as water insets, as on the page map;
     canal hexes get their lock lines and the owner's hairline border */
  WATERWAY_HEXES.forEach((h, wi) => {
    const hp = p.waterways[wi];
    ctx.fillStyle = "#2f6d99";
    ctx.fill(hp);
    ctx.strokeStyle = "rgba(3,10,20,0.45)";
    ctx.lineWidth = 0.4;
    ctx.stroke(hp);
    if (h.code === "c") {
      ctx.strokeStyle = "rgba(232,242,250,0.92)";
      ctx.lineWidth = 0.5;
      for (const [x1, y1, x2, y2] of h.locks) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.strokeStyle = powerColor(COUNTRIES[h.ci].code);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 0.8;
      ctx.stroke(hp);
      ctx.globalAlpha = 1;
    }
  });
  ctx.strokeStyle = "rgba(240,220,170,0.10)";
  ctx.lineWidth = 0.5;
  for (const b of p.borders) ctx.stroke(b);
  if (leaderIdx >= 0) {
    ctx.strokeStyle = "rgba(240,192,96,0.22)";
    ctx.lineWidth = 4.5;
    ctx.stroke(p.borders[leaderIdx]);
    ctx.strokeStyle = "rgba(240,192,96,0.85)";
    ctx.lineWidth = 1.3;
    ctx.stroke(p.borders[leaderIdx]);
  }
  ctx.strokeStyle = "rgba(201,150,58,0.18)";
  ctx.lineWidth = 0.9;
  ctx.stroke(p.outline);
  ctx.restore();
  // compass in device pixels, mirroring the on-page map's corner placement
  drawCompass(ctx, dx + dw * 0.935, dy + dh * 0.115, dw * 0.030);
}

/* ------------------------------------------------------------ text helpers */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 99): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) return lines;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, font: string): number {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width + 28;
  const h = 34;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 17);
  ctx.fillStyle = "rgba(201,150,58,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(240,192,96,0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 14, y + h / 2 + 1);
  ctx.restore();
  return w;
}

function kicker(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, size = 26) {
  ctx.save();
  ctx.font = `${size}px ${DISPLAY}`;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "5px"; } catch { /* older canvas */ }
  ctx.fillStyle = GOLD;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ------------------------------------------------------------- recap data */
export interface RecapShock { year: number; text: string }
export interface RecapWhy { year: number; text: string; why: string }
/** the card's subject: the player's claim when there is one, else the
 *  boosted focus power — its ladder tier and rank trajectory ride the card */
export interface RecapSubject {
  code: string;
  name: string;
  isClaim: boolean;
  tier: string;
  tierLine: string;
  ranks: (number | null)[];
}
export interface RecapData {
  scenarioName: string;
  seed: string;
  winner: { code: string; name: string; power: number; gdp: number };
  /** winner's GDP as a share of the whole world's, % */
  winnerShare: number;
  /** how many different powers held № 1 across the century */
  crowns: number;
  interventions: number;
  top5: { code: string; name: string; power: number }[];
  shocks: RecapShock[];
  /** top-3 WHY moments: the highest-impact caused events, with their
   *  engine why-lines (item 5c) */
  whyMoments: RecapWhy[];
  subject: RecapSubject | null;
  focusLine: string | null;
}

const KIND_PRIORITY: Record<string, number> = { overtake: 0, annex: 1, crisis: 2, shock: 3, breakaway: 4, focus: 5, intervention: 6 };
const WHY_KIND_SCORE: Record<string, number> = { annex: 5, fold: 4, overtake: 5 };

const trunc = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 3).trimEnd()}…` : t);

export function buildRecap(result: SimResult, cfg: SimConfig, subjectCode?: string): RecapData {
  const last = result.years.length - 1;
  const leaders = result.leaders[last];
  const w = leaders[0];
  const wIdx = COUNTRIES.findIndex((c) => c.code === w.code);
  const shocks = [...result.events]
    .sort((a, b) => (KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]) || (b.year - a.year))
    .slice(0, 3)
    .sort((a, b) => a.year - b.year)
    .map((e) => ({ year: e.year, text: trunc(e.text, 168) }));

  /* WHY moments: caused events only (annex / fold / overtake), scored by
     kind weight + the bloc mass involved, top 3, told chronologically */
  const whyMoments: RecapWhy[] = result.events
    .filter((e) => e.cause && eventWhy(e))
    .map((e) => ({
      e,
      why: eventWhy(e)!,
      score: (WHY_KIND_SCORE[e.kind] ?? 0) * 100000 + (e.cause!.driverBloc ?? 0) * 10 + (e.cause!.subjectBloc ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.e.year - b.e.year)
    .map(({ e, why }) => ({ year: e.year, text: trunc(e.text, 168), why }));

  let focusLine: string | null = null;
  if (cfg.focusCode) {
    const fi = COUNTRIES.findIndex((c) => c.code === cfg.focusCode);
    if (fi >= 0) {
      const snap = result.years[last][fi];
      const name = COUNTRIES[fi].name;
      if (snap.bloc > 0) {
        const rank = 1 + result.years[last].filter((s) => s.bloc > snap.bloc).length;
        focusLine = rank === 1
          ? `${name} — the boosted power — ends the century ruling the world.`
          : `${name} — the boosted power — finishes the century at № ${rank} in the world.`;
      } else {
        focusLine = `${name} — the boosted power — ends the century held by ${COUNTRIES[snap.c].name}.`;
      }
    }
  }

  /* the subject: claim first (what the player steered), else the focus */
  let subject: RecapSubject | null = null;
  const subjCode = subjectCode ?? cfg.focusCode;
  if (subjCode) {
    const si = COUNTRIES.findIndex((c) => c.code === subjCode);
    if (si >= 0) {
      const lad = finalLadder(result, si);
      const snap = result.years[last][si];
      const name = COUNTRIES[si].name;
      const tierLine = lad.tier === "Fallen"
        ? `${name} ended the century held by ${COUNTRIES[snap.c].name} — Fallen on the victory ladder.`
        : `${name} finished as a ${lad.tier} — № ${lad.rank} in the world${lad.isRegionLeader ? `, the largest power in ${lad.region}` : `, in ${lad.region}`}${lad.faithLed ? ", its faith leading the world" : ""}.`;
      subject = {
        code: subjCode,
        name,
        isClaim: subjectCode !== undefined,
        tier: lad.tier,
        tierLine,
        ranks: rankByYear(result, si),
      };
    }
  }

  const worldGdp = result.years[last].reduce((s, c) => s + c.gdp, 0);
  const crowns = new Set(result.leaders.map((l) => l[0]?.code).filter(Boolean)).size;
  return {
    scenarioName: getScenario(cfg.scenarioId).name,
    seed: cfg.seed,
    winner: { code: w.code, name: COUNTRIES[wIdx].name, power: w.power, gdp: result.years[last][wIdx].gdp },
    winnerShare: worldGdp > 0 ? (result.years[last][wIdx].gdp / worldGdp) * 100 : 0,
    crowns,
    interventions: cfg.interventions?.length ?? 0,
    top5: leaders.slice(0, 5).map((l) => ({ code: l.code, name: COUNTRIES[COUNTRIES.findIndex((c) => c.code === l.code)].name, power: l.power })),
    shocks,
    whyMoments,
    subject,
    focusLine,
  };
}

/* ISO 3166 alpha-3 → alpha-2 for flag emoji (majors + scenario focuses) */
const ISO2: Record<string, string> = {
  USA: "US", CHN: "CN", IND: "IN", RUS: "RU", JPN: "JP", DEU: "DE", GBR: "GB", FRA: "FR", BRA: "BR",
  CAN: "CA", AUS: "AU", KOR: "KR", NGA: "NG", IDN: "ID", TUR: "TR", MEX: "MX", NOR: "NO", DNK: "DK",
  MYS: "MY", NER: "NE", MLI: "ML", CHL: "CL", BOL: "BO", ARG: "AR", PER: "PE", GHA: "GH", ZAF: "ZA",
  EGY: "EG", TWN: "TW", ISR: "IL", KAZ: "KZ", UKR: "UA", SAU: "SA", IRN: "IR", PAK: "PK", VNM: "VN",
  THA: "TH", PHL: "PH", ETH: "ET", KEN: "KE", ESP: "ES", ITA: "IT", POL: "PL", NLD: "NL", SWE: "SE",
  FIN: "FI", ISL: "IS", CIV: "CI", SEN: "SN", CMR: "CM", TCD: "TD", BFA: "BF", MRT: "MR", SDN: "SD",
  MAR: "MA", DZA: "DZ", TUN: "TN", GRC: "GR", SGP: "SG", BGD: "BD", CHE: "CH", AUT: "AT", NZL: "NZ",
};
export function flagEmoji(code3: string): string {
  const a2 = ISO2[code3];
  if (!a2) return "";
  return String.fromCodePoint(...[...a2].map((ch) => 127397 + ch.charCodeAt(0)));
}

export function buildCaption(result: SimResult, cfg: SimConfig, subjectCode?: string): string {
  const last = result.years.length - 1;
  const leaders = result.leaders[last];
  const winner = leaders[0];
  const winnerName = COUNTRIES[COUNTRIES.findIndex((c) => c.code === winner.code)].name;
  const scenario = getScenario(cfg.scenarioId);
  /* the subject's ladder verdict rides the caption (item 4) */
  let ladderLine: string | null = null;
  const subjCode = subjectCode ?? cfg.focusCode;
  if (subjCode) {
    const si = COUNTRIES.findIndex((c) => c.code === subjCode);
    if (si >= 0) {
      const lad = finalLadder(result, si);
      ladderLine = lad.tier === "Fallen"
        ? `Victory ladder: ${COUNTRIES[si].name} — Fallen, held at the century's end.`
        : `Victory ladder: ${COUNTRIES[si].name} — ${lad.tier}${lad.rank ? ` (№ ${lad.rank} of 175)` : ""}.`;
    }
  }
  let hook: string;
  if (cfg.focusCode) {
    const fi = COUNTRIES.findIndex((c) => c.code === cfg.focusCode);
    const snap = fi >= 0 ? result.years[last][fi] : null;
    if (fi >= 0 && snap && snap.bloc > 0) {
      const rank = 1 + result.years[last].filter((s) => s.bloc > snap.bloc).length;
      hook = `In my GeoStory run, ${COUNTRIES[fi].name} finished #${rank} in the world by 2100 ${flagEmoji(cfg.focusCode)}`.trim();
    } else if (fi >= 0 && snap) {
      hook = `In my GeoStory run, ${COUNTRIES[fi].name} ended the century inside ${COUNTRIES[snap.c].name}'s orbit — while ${winnerName} ruled the world ${flagEmoji(winner.code)}`.trim();
    } else {
      hook = `${winnerName} ruled the world by 2100 in my GeoStory run ${flagEmoji(winner.code)}`.trim();
    }
  } else {
    const second = leaders[1];
    const secondName = second ? COUNTRIES[COUNTRIES.findIndex((c) => c.code === second.code)].name : null;
    hook = `${winnerName} ruled the world by 2100 in my GeoStory run${secondName ? ` — ${secondName} came second` : ""} ${flagEmoji(winner.code)}`.trim();
  }
  const invCount = cfg.interventions?.length ?? 0;
  return [
    hook,
    ``,
    `${scenario.name} · seed "${cfg.seed}"${invCount ? ` · ${invCount} intervention${invCount > 1 ? "s" : ""} spent` : ""} · the full deterministic century, 2026–2100, on a hex map of 175 countries.`,
    ...(ladderLine ? [ladderLine] : []),
    `Replay this exact century — challenge link: ${challengeUrl(cfg)}`,
    `A toy model for entertainment — not a forecast.`,
    ``,
    `#GeoStory #Geopolitics #StrategyGame #WhatIf #AlternateHistory`,
  ].join("\n");
}

/** the full chronicle as a downloadable text file (item 5c): every event
 *  of the century with the engine's why under the events that carry one,
 *  the top-3 WHY moments up top, and the subject's ladder verdict */
export function buildChronicleText(result: SimResult, cfg: SimConfig, subjectCode?: string): string {
  const d = buildRecap(result, cfg, subjectCode);
  const scenario = getScenario(cfg.scenarioId);
  const out: string[] = [];
  out.push(`GEOSTORY — THE CHRONICLE OF A CENTURY`);
  out.push(`${scenario.name} · seed "${cfg.seed}" · ${START_YEAR}–${END_YEAR}`);
  out.push(`№ 1 in ${END_YEAR}: ${d.winner.name} (power ${d.winner.power.toFixed(0)} · GDP ${fmtGdp(d.winner.gdp)} · ${d.winnerShare.toFixed(1)}% of world GDP)`);
  if (d.subject) out.push(`Victory ladder: ${d.subject.tierLine}`);
  if (d.interventions) out.push(`Interventions spent: ${d.interventions}`);
  out.push(``);
  if (d.whyMoments.length) {
    out.push(`— THE MOMENTS THAT MADE THE CENTURY —`);
    for (const m of d.whyMoments) {
      out.push(`${m.year} — ${m.text}`);
      out.push(`   ${m.why}`);
    }
    out.push(``);
  }
  out.push(`— THE CHRONICLE —`);
  for (const e of result.events) {
    out.push(`${e.year} — ${e.text}`);
    const why = eventWhy(e);
    if (why) out.push(`   ${why}`);
  }
  out.push(``);
  out.push(`A toy model for entertainment — not a forecast.`);
  out.push(`Replay this exact century: ${challengeUrl(cfg)}`);
  return out.join("\n");
}

/* ------------------------------------------------------------- card canvas */
function cardBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, "#0d2f52");
  g.addColorStop(0.55, "#081f38");
  g.addColorStop(1, "#040f1e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(150,190,230,0.05)";
  ctx.lineWidth = 1;
  for (let x = 90; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 90; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.strokeStyle = "rgba(201,150,58,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(33, 33, W - 66, H - 66);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"),
  );
}

/** the before/after pair (item 5b): two small plates side by side,
 *  captioned. Returns the y of the plates' bottom edge. */
function drawMapPair(
  ctx: CanvasRenderingContext2D,
  result: SimResult,
  dx: number,
  y: number,
  plateW: number,
  gap: number,
): number {
  const last = result.years.length - 1;
  const plateH = (WORLD.height * plateW) / WORLD.width;
  ctx.save();
  ctx.font = `20px ${DISPLAY}`;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "3px"; } catch { /* older canvas */ }
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${START_YEAR} — AS IT BEGAN`, dx + 2, y + 16);
  ctx.fillStyle = GOLD;
  ctx.textAlign = "right";
  ctx.fillText(`${END_YEAR} — AS IT ENDED`, dx + plateW * 2 + gap - 2, y + 16);
  ctx.restore();
  drawMapPlate(ctx, result, 0, dx, y + 26, plateW);
  drawMapPlate(ctx, result, last, dx + plateW + gap, y + 26, plateW);
  return y + 26 + plateH;
}

/** rank-trajectory sparkline (item 5a): № 1 at the top; years the
 *  subject was held show as red ticks along the floor */
function drawRankSpark(
  ctx: CanvasRenderingContext2D,
  ranks: (number | null)[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const vals = ranks.filter((r): r is number => r !== null);
  if (!vals.length) return;
  const maxR = Math.max(10, ...vals);
  const X = (i: number) => x + (i / (ranks.length - 1)) * w;
  const Y = (r: number) => y + ((r - 1) / (maxR - 1)) * h;
  ctx.save();
  ctx.strokeStyle = "rgba(147,167,189,0.30)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, Y(1)); ctx.lineTo(x + w, Y(1)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, Y(maxR)); ctx.lineTo(x + w, Y(maxR)); ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `14px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText(`№ ${maxR}`, x + w, y + h + 16);
  ctx.textAlign = "left";
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  ranks.forEach((r, i) => {
    if (r === null) { pen = false; return; }
    if (!pen) { ctx.moveTo(X(i), Y(r)); pen = true; } else ctx.lineTo(X(i), Y(r));
  });
  ctx.stroke();
  ctx.fillStyle = "rgba(209,96,61,0.85)";
  ranks.forEach((r, i) => { if (r === null) ctx.fillRect(X(i) - 1, y + h - 3, 2, 3); });
  const li = ranks.length - 1;
  if (ranks[li] !== null) {
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(X(li), Y(ranks[li]!), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** the subject block: ladder tier + rank sparkline (items 4/5a/5d).
 *  Returns the y below the block. */
function drawSubjectBlock(
  ctx: CanvasRenderingContext2D,
  s: RecapSubject,
  x: number,
  y: number,
  w: number,
  opts: { nameSize: number; sparkH: number; lineSize: number },
): number {
  ctx.save();
  ctx.font = `${opts.nameSize}px ${DISPLAY}`;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "2px"; } catch { /* older canvas */ }
  ctx.fillStyle = GOLD;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(trunc(`🏆 ${s.name} — ${s.tier}${s.isClaim ? " · YOUR ANCHOR" : ""}`.toUpperCase(), 72), x, y + opts.nameSize);
  ctx.restore();
  let cy = y + opts.nameSize + 10;
  if (opts.lineSize > 0) {
    ctx.fillStyle = PARCH;
    ctx.font = `italic ${opts.lineSize}px ${SERIF}`;
    const ls = wrapLines(ctx, s.tierLine, w, 2);
    ls.forEach((ln, i) => ctx.fillText(ln, x, cy + opts.lineSize * 0.9 + i * (opts.lineSize + 5)));
    cy += ls.length * (opts.lineSize + 5) + 8;
  }
  if (opts.sparkH > 0) {
    drawRankSpark(ctx, s.ranks, x, cy, w, opts.sparkH);
    return cy + opts.sparkH + 18;
  }
  return cy + 6;
}

/** WHY rows (item 5c): year, event text (≤2 lines), the engine's
 *  why-line (1 line) — falls back to the biggest shocks when a run
 *  somehow carries no caused events */
function drawWhyRows(
  ctx: CanvasRenderingContext2D,
  d: RecapData,
  x: number,
  y: number,
  w: number,
  opts: { yearSize: number; textSize: number; textLH: number; whySize: number; gap: number },
): number {
  const rows: RecapWhy[] = d.whyMoments.length
    ? d.whyMoments
    : d.shocks.map((s) => ({ year: s.year, text: s.text, why: "" }));
  let cy = y;
  for (const m of rows) {
    ctx.fillStyle = GOLD;
    ctx.font = `${opts.yearSize}px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillText(String(m.year), x, cy + opts.yearSize * 0.85);
    const tx = x + 78;
    const tw = w - 78;
    ctx.fillStyle = PARCH;
    ctx.font = `${opts.textSize}px ${SANS}`;
    const ls = wrapLines(ctx, m.text, tw, 2);
    ls.forEach((ln, i) => ctx.fillText(ln, tx, cy + opts.yearSize * 0.85 + i * opts.textLH));
    let bottom = cy + opts.yearSize * 0.85 + (ls.length - 1) * opts.textLH;
    if (m.why) {
      ctx.fillStyle = "#a9cbe4";
      ctx.font = `italic ${opts.whySize}px ${SERIF}`;
      const wl = wrapLines(ctx, m.why, tw, 1);
      let whyText = wl[0] ?? "";
      if (whyText && m.why.length > whyText.length) whyText = `${whyText.replace(/[\s;,.]+$/, "")}…`;
      bottom += opts.whySize + 6;
      ctx.fillText(whyText, tx, bottom);
    }
    cy = bottom + opts.gap;
  }
  return cy;
}

/** static recap card — the whole century on one branded plate */
export async function renderRecapCard(result: SimResult, cfg: SimConfig, format: "1:1" | "9:16", subjectCode?: string): Promise<Blob> {
  await ensureFonts();
  const W = 1080;
  const H = format === "1:1" ? 1080 : 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const d = buildRecap(result, cfg, subjectCode);
  const last = result.years.length - 1;
  const M = 64; // margin
  const CW = W - M * 2; // content width

  cardBackdrop(ctx, W, H);
  drawCompass(ctx, M + 30, 108, 30);
  kicker(ctx, M + 78, 120, "EMBOOGWAY × STRATATIR", 27);
  ctx.fillStyle = MUTED;
  ctx.font = `19px ${SANS}`;
  ctx.fillText("GEOSTORY SIMULATOR — ONE DETERMINISTIC CENTURY", M + 78, 148);

  ctx.fillStyle = CREAM;
  ctx.font = `900 ${format === "1:1" ? 56 : 66}px ${SERIF}`;
  const titleLines = wrapLines(ctx, d.scenarioName, CW, 2);
  titleLines.forEach((ln, i) => ctx.fillText(ln, M, 226 + i * (format === "1:1" ? 60 : 72)));
  const chipsY = 226 + titleLines.length * (format === "1:1" ? 60 : 72) + 14;
  let cx = M;
  cx += drawChip(ctx, cx, chipsY, `SEED "${d.seed}"`, `20px ${SANS}`) + 12;
  cx += drawChip(ctx, cx, chipsY, `${START_YEAR} → ${END_YEAR}`, `20px ${SANS}`) + 12;
  if (d.crowns > 1) cx += drawChip(ctx, cx, chipsY, `👑 ${d.crowns} POWERS HELD № 1`, `20px ${SANS}`) + 12;
  if (d.interventions > 0) cx += drawChip(ctx, cx, chipsY, `⚑ ${d.interventions} INTERVENTION${d.interventions > 1 ? "S" : ""}`, `20px ${SANS}`) + 12;
  /* the subject's ladder tier rides the chips row when it fits (item 5d) */
  if (d.subject) {
    const label = `🏆 ${d.subject.tier.toUpperCase()}`;
    ctx.font = `20px ${SANS}`;
    if (cx + ctx.measureText(label).width + 28 <= M + CW) {
      cx += drawChip(ctx, cx, chipsY, label, `20px ${SANS}`) + 12;
    }
  }
  /* the square card's rail has no room for a share line, so it rides the
     chips row — but only when that row is short enough to hold it */
  if (format === "1:1" && d.crowns <= 1 && d.interventions === 0) {
    drawChip(ctx, cx, chipsY, `WINNER HOLDS ${d.winnerShare.toFixed(1)}% OF WORLD GDP`, `20px ${SANS}`);
  }

  const mapY = chipsY + 62;
  const whyTitle = d.whyMoments.length ? "WHY IT HAPPENED — THE MOMENTS THAT MADE IT" : "BIGGEST SHOCKS OF THE CENTURY";
  if (format === "1:1") {
    /* the square card is tight: the pair runs small and centred, the
       winner and top five share one band, then the subject's ladder +
       sparkline, then the WHY moments. On a two-line scenario title the
       plates shrink and the sparkline yields (the tier still rides the
       chips row and the subject label). */
    const twoLineTitle = titleLines.length > 1;
    const plateW = twoLineTitle ? 372 : 384;
    const pairX = M + (CW - (plateW * 2 + 16)) / 2;
    let y = drawMapPair(ctx, result, pairX, mapY - 26, plateW, 16);
    /* winner (left) + top five (right) */
    const bandY = y + 22;
    kicker(ctx, M, bandY + 20, "№ 1 IN 2100", 22);
    ctx.fillStyle = CREAM;
    ctx.font = `900 40px ${SERIF}`;
    const nameLines = wrapLines(ctx, d.winner.name, 520, 2);
    nameLines.forEach((ln, i) => ctx.fillText(ln, M, bandY + 64 + i * 42));
    const statsY = bandY + 64 + nameLines.length * 42 + 8;
    ctx.fillStyle = GOLD;
    ctx.font = `20px ${DISPLAY}`;
    ctx.fillText(`POWER ${d.winner.power.toFixed(0)} · GDP ${fmtGdp(d.winner.gdp)} · ${d.winnerShare.toFixed(1)}% OF WORLD GDP`, M, statsY);
    const rx = M + 566;
    const rw = CW - 566;
    kicker(ctx, rx, bandY + 20, "TOP FIVE", 22);
    d.top5.forEach((t, i) => {
      const yy = bandY + 52 + i * 26;
      ctx.fillStyle = powerColor(t.code);
      ctx.fillRect(rx, yy - 11, 11, 11);
      ctx.fillStyle = i === 0 ? GOLD : MUTED;
      ctx.font = `19px ${DISPLAY}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), rx + 19, yy);
      ctx.fillStyle = CREAM;
      ctx.font = `17px ${SANS}`;
      ctx.fillText(trunc(t.name, 16), rx + 46, yy);
      ctx.fillStyle = GOLD;
      ctx.font = `17px ${DISPLAY}`;
      ctx.textAlign = "right";
      ctx.fillText(t.power.toFixed(0), rx + rw, yy);
      ctx.textAlign = "left";
    });
    y = Math.max(statsY + 6, bandY + 52 + 5 * 26) + 10;
    ctx.fillStyle = "rgba(201,150,58,0.4)";
    ctx.fillRect(M, y, CW, 1);
    y += 18;
    if (d.subject) {
      y = drawSubjectBlock(ctx, d.subject, M, y, CW, { nameSize: 20, sparkH: twoLineTitle ? 0 : 26, lineSize: 0 }) + 2;
    } else if (d.focusLine) {
      ctx.fillStyle = PARCH;
      ctx.font = `italic 21px ${SERIF}`;
      ctx.fillText(trunc(d.focusLine, 96), M, y + 20);
      y += 42;
    }
    kicker(ctx, M, y + 20, whyTitle, 20);
    /* the square card's footer is fixed at H-100: measure the WHY rows
       with the same wrap the drawer uses and drop the last row (never
       below one) if the stack would reach the footer — the 9:16 card
       and chronicle.txt always carry all three */
    let whyData = d;
    if (d.whyMoments.length > 1) {
      const rowsTop = y + 30;
      const est = (rows: RecapWhy[]) => rows.reduce((acc, m) => {
        ctx.font = `18px ${SANS}`;
        const lines = wrapLines(ctx, m.text, CW - 78, 2).length;
        return acc + 23 * 0.85 + (lines - 1) * 19 + (m.why ? 15 + 6 : 0) + 7;
      }, 0);
      let rows = d.whyMoments;
      while (rows.length > 1 && rowsTop + est(rows) > H - 104) rows = rows.slice(0, -1);
      if (rows.length !== d.whyMoments.length) whyData = { ...d, whyMoments: rows };
    }
    drawWhyRows(ctx, whyData, M, y + 30, CW, { yearSize: 23, textSize: 18, textLH: 19, whySize: 15, gap: 7 });
  } else {
    /* 9:16 — the pair replaces the single plate (and frees more room
       than it takes); winner, focus, subject ladder + sparkline, top
       five, then the WHY moments above the fixed footer */
    let y = drawMapPair(ctx, result, M, mapY - 26, (CW - 16) / 2, 16);
    y += 58;
    ctx.textAlign = "center";
    ctx.save();
    ctx.font = `26px ${DISPLAY}`;
    try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "6px"; } catch { /* noop */ }
    ctx.fillStyle = GOLD;
    ctx.fillText("№ 1 IN THE WORLD · 2100", W / 2, y);
    ctx.restore();
    y += 72;
    ctx.fillStyle = CREAM;
    ctx.font = `900 82px ${SERIF}`;
    for (const ln of wrapLines(ctx, d.winner.name, CW, 2)) { ctx.fillText(ln, W / 2, y); y += 80; }
    y += 6;
    ctx.fillStyle = GOLD;
    ctx.font = `38px ${DISPLAY}`;
    ctx.fillText(`POWER ${d.winner.power.toFixed(0)} · GDP ${fmtGdp(d.winner.gdp)} · ${d.winnerShare.toFixed(1)}% OF WORLD GDP`, W / 2, y);
    ctx.textAlign = "left";
    y += 52;
    if (d.focusLine) {
      ctx.fillStyle = PARCH;
      ctx.font = `italic 27px ${SERIF}`;
      ctx.textAlign = "center";
      ctx.fillText(d.focusLine, W / 2, y);
      ctx.textAlign = "left";
      y += 58;
    }
    if (d.subject) {
      y = drawSubjectBlock(ctx, d.subject, M, y, CW, { nameSize: 25, sparkH: 44, lineSize: 23 }) + 6;
    }
    ctx.fillStyle = "rgba(201,150,58,0.4)";
    ctx.fillRect(M, y, CW, 1);
    y += 44;
    kicker(ctx, M, y, "TOP FIVE IN 2100", 25);
    y += 18;
    d.top5.forEach((t, i) => {
      y += 46;
      ctx.fillStyle = powerColor(t.code);
      ctx.fillRect(M, y - 20, 20, 20);
      ctx.fillStyle = i === 0 ? GOLD : MUTED;
      ctx.font = `30px ${DISPLAY}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), M + 34, y);
      ctx.fillStyle = CREAM;
      ctx.font = `27px ${SANS}`;
      ctx.fillText(t.name, M + 84, y);
      ctx.fillStyle = GOLD;
      ctx.font = `28px ${DISPLAY}`;
      ctx.textAlign = "right";
      ctx.fillText(t.power.toFixed(0), M + CW, y);
      ctx.textAlign = "left";
    });
    y += 44;
    ctx.fillStyle = "rgba(201,150,58,0.4)";
    ctx.fillRect(M, y, CW, 1);
    y += 44;
    kicker(ctx, M, y, whyTitle, 25);
    y += 10;
    drawWhyRows(ctx, d, M, y, CW, { yearSize: 30, textSize: 23, textLH: 26, whySize: 21, gap: 11 });
  }

  /* footer — small print on every card */
  ctx.fillStyle = MUTED;
  ctx.font = `19px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText("A toy model for entertainment — not a forecast.", W / 2, H - 84);
  ctx.fillStyle = GOLD;
  ctx.font = `23px ${DISPLAY}`;
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "3px"; } catch { /* noop */ }
  ctx.fillText("RUN IT YOURSELF — EMBOOGWAY.COM/GAMES/GEOSTORY", W / 2, H - 52);
  ctx.textAlign = "left";

  return canvasBlob(canvas);
}

/* ---------------------------------------------------------- timelapse video */
export type TimelapseFormat = "9:16" | "1:1";
export interface TimelapseOpts {
  onProgress?: (frac: number) => void;
  cancelled?: () => boolean;
}

const TL_YEARS_MS = 12500;
const TL_END_MS = 3500;

function drawTimelapseFrame(
  ctx: CanvasRenderingContext2D,
  result: SimResult,
  cfg: SimConfig,
  format: TimelapseFormat,
  yearFloat: number,
) {
  const W = 1080;
  const H = format === "9:16" ? 1920 : 1080;
  const scenario = getScenario(cfg.scenarioId);
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const year = START_YEAR + yearIdx;

  cardBackdrop(ctx, W, H);
  const M = format === "9:16" ? 54 : 48;
  drawCompass(ctx, M + 26, M + 44, 26);
  kicker(ctx, M + 68, M + 56, "EMBOOGWAY × STRATATIR", 25);
  ctx.fillStyle = CREAM;
  ctx.font = `900 ${format === "9:16" ? 58 : 46}px ${SERIF}`;
  ctx.fillText(scenario.name, M, M + 128);
  ctx.fillStyle = MUTED;
  ctx.font = `21px ${SANS}`;
  ctx.fillText(`GeoStory Simulator · seed "${cfg.seed}" · same seed, same history`, M, M + 162);

  const mapY = M + 196;
  const mapW = W - M * 2;
  drawMapPlate(ctx, result, yearIdx, M, mapY, mapW);
  const mapH = (WORLD.height * mapW) / WORLD.width;

  if (format === "9:16") {
    const y = mapY + mapH + 150;
    ctx.textAlign = "center";
    ctx.fillStyle = GOLD;
    ctx.font = `170px ${DISPLAY}`;
    ctx.fillText(String(year), W / 2, y);
    ctx.textAlign = "left";
    /* top-3 ticker */
    let ty = y + 84;
    result.leaders[yearIdx].slice(0, 3).forEach((l, i) => {
      const gi = COUNTRIES.findIndex((c) => c.code === l.code);
      ctx.fillStyle = powerColor(l.code);
      ctx.fillRect(M + 190, ty - 21, 21, 21);
      ctx.fillStyle = i === 0 ? GOLD : MUTED;
      ctx.font = `30px ${DISPLAY}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), M + 224, ty);
      ctx.fillStyle = CREAM;
      ctx.font = `28px ${SANS}`;
      ctx.fillText(COUNTRIES[gi].name, M + 268, ty);
      ctx.fillStyle = GOLD;
      ctx.font = `28px ${DISPLAY}`;
      ctx.textAlign = "right";
      ctx.fillText(l.power.toFixed(0), W - M - 190, ty);
      ctx.textAlign = "left";
      ty += 50;
    });
    /* progress hairline */
    const pw = W - M * 2;
    ctx.fillStyle = "rgba(201,150,58,0.25)";
    ctx.fillRect(M, H - 150, pw, 3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(M, H - 150, pw * (yearIdx / (result.years.length - 1)), 3);
    ctx.fillStyle = MUTED;
    ctx.font = `20px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("A toy model for entertainment — not a forecast.", W / 2, H - 104);
    ctx.textAlign = "left";
  } else {
    /* 1:1 — year bottom-left, leader bottom-right over the plate's margin */
    ctx.fillStyle = GOLD;
    ctx.font = `120px ${DISPLAY}`;
    ctx.fillText(String(year), M, H - 56);
    const top = result.leaders[yearIdx][0];
    const gi = COUNTRIES.findIndex((c) => c.code === top.code);
    ctx.textAlign = "right";
    ctx.fillStyle = MUTED;
    ctx.font = `20px ${SANS}`;
    ctx.fillText("№ 1 IN THE WORLD", W - M, H - 108);
    ctx.fillStyle = CREAM;
    ctx.font = `700 40px ${SERIF}`;
    ctx.fillText(`${COUNTRIES[gi].name} · ${top.power.toFixed(0)}`, W - M, H - 60);
    ctx.textAlign = "left";
    void mapH;
  }
}

function drawEndCard(ctx: CanvasRenderingContext2D, result: SimResult, cfg: SimConfig, format: TimelapseFormat) {
  const W = 1080;
  const H = format === "9:16" ? 1920 : 1080;
  const d = buildRecap(result, cfg);
  cardBackdrop(ctx, W, H);
  const cy = H / 2;
  ctx.textAlign = "center";
  drawCompass(ctx, W / 2, cy - (format === "9:16" ? 330 : 250), 44);
  ctx.fillStyle = GOLD;
  ctx.font = `30px ${DISPLAY}`;
  ctx.fillText("2 1 0 0 — THE CENTURY ENDS", W / 2, cy - (format === "9:16" ? 190 : 130));
  ctx.fillStyle = CREAM;
  ctx.font = `900 ${format === "9:16" ? 96 : 76}px ${SERIF}`;
  const lines = wrapLines(ctx, d.winner.name, W - 160, 2);
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, cy - 60 + i * (format === "9:16" ? 100 : 82)));
  const after = cy - 60 + lines.length * (format === "9:16" ? 100 : 82) + 26;
  ctx.fillStyle = GOLD;
  ctx.font = `36px ${DISPLAY}`;
  ctx.fillText(`№ 1 IN THE WORLD · POWER ${d.winner.power.toFixed(0)}`, W / 2, after);
  ctx.fillStyle = PARCH;
  ctx.font = `italic 27px ${SERIF}`;
  ctx.fillText(`"${getScenario(cfg.scenarioId).name}" · seed "${cfg.seed}"`, W / 2, after + 56);
  ctx.fillStyle = GOLD;
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText("Run it yourself", W / 2, after + 150);
  ctx.font = `30px ${DISPLAY}`;
  ctx.fillText("EMBOOGWAY.COM/GAMES/GEOSTORY", W / 2, after + 196);
  ctx.fillStyle = MUTED;
  ctx.font = `19px ${SANS}`;
  ctx.fillText("A toy model for entertainment — not a forecast.", W / 2, H - 64);
  ctx.textAlign = "left";
}

/** records the full deterministic century to a webm/mp4 blob */
export async function recordTimelapse(
  result: SimResult,
  cfg: SimConfig,
  format: TimelapseFormat,
  opts: TimelapseOpts = {},
): Promise<{ blob: Blob; ext: string } | null> {
  if (!videoExportSupported()) return null;
  await ensureFonts();
  const W = 1080;
  const H = format === "9:16" ? 1920 : 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  drawTimelapseFrame(ctx, result, cfg, format, 0);

  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: format === "9:16" ? 9_000_000 : 7_000_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });

  const total = TL_YEARS_MS + TL_END_MS;
  const t0 = performance.now();
  rec.start(250);
  await new Promise<void>((resolve) => {
    const tick = () => {
      const el = performance.now() - t0;
      opts.onProgress?.(Math.min(1, el / total));
      if (opts.cancelled?.() || el >= total) { resolve(); return; }
      if (el < TL_YEARS_MS) {
        drawTimelapseFrame(ctx, result, cfg, format, (el / TL_YEARS_MS) * (result.years.length - 1));
      } else {
        drawEndCard(ctx, result, cfg, format);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const wasCancelled = opts.cancelled?.() ?? false;
  rec.stop();
  await stopped;
  if (wasCancelled) return null;
  const type = mime.startsWith("video/mp4") ? "video/mp4" : "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
}

/** hex-tile counts, exported for the export UI's fine print */
export const TILE_COUNT = HEXES_BY_COUNTRY.reduce((n, h) => n + h.length, 0);
