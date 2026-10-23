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
import { getScenario, powerColor } from "../lib/scenarios";
import { challengeUrl } from "../lib/share";
import { WATERWAY_HEXES } from "../lib/terrain";
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
  focusLine: string | null;
}

const KIND_PRIORITY: Record<string, number> = { overtake: 0, annex: 1, crisis: 2, shock: 3, breakaway: 4, focus: 5, intervention: 6 };

export function buildRecap(result: SimResult, cfg: SimConfig): RecapData {
  const last = result.years.length - 1;
  const leaders = result.leaders[last];
  const w = leaders[0];
  const wIdx = COUNTRIES.findIndex((c) => c.code === w.code);
  const shocks = [...result.events]
    .sort((a, b) => (KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]) || (b.year - a.year))
    .slice(0, 3)
    .sort((a, b) => a.year - b.year)
    .map((e) => ({ year: e.year, text: e.text.length > 168 ? `${e.text.slice(0, 165).trimEnd()}…` : e.text }));

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

export function buildCaption(result: SimResult, cfg: SimConfig): string {
  const last = result.years.length - 1;
  const leaders = result.leaders[last];
  const winner = leaders[0];
  const winnerName = COUNTRIES[COUNTRIES.findIndex((c) => c.code === winner.code)].name;
  const scenario = getScenario(cfg.scenarioId);
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
    `Replay this exact century — challenge link: ${challengeUrl(cfg)}`,
    `A toy model for entertainment — not a forecast.`,
    ``,
    `#GeoStory #Geopolitics #StrategyGame #WhatIf #AlternateHistory`,
  ].join("\n");
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

/** static recap card — the whole century on one branded plate */
export async function renderRecapCard(result: SimResult, cfg: SimConfig, format: "1:1" | "9:16"): Promise<Blob> {
  await ensureFonts();
  const W = 1080;
  const H = format === "1:1" ? 1080 : 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const d = buildRecap(result, cfg);
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
  /* the square card's rail has no room for a share line, so it rides the
     chips row — but only when that row is short enough to hold it */
  if (format === "1:1" && d.crowns <= 1 && d.interventions === 0) {
    drawChip(ctx, cx, chipsY, `WINNER HOLDS ${d.winnerShare.toFixed(1)}% OF WORLD GDP`, `20px ${SANS}`);
  }

  const mapY = chipsY + 62;
  if (format === "1:1") {
    /* map left, winner rail right */
    const mapW = 618;
    drawMapPlate(ctx, result, last, M, mapY, mapW);
    const railX = M + mapW + 30;
    const railW = W - M - railX;
    let ry = mapY + 30;
    kicker(ctx, railX, ry, "№ 1 IN 2100", 24);
    ry += 14;
    ctx.fillStyle = CREAM;
    ctx.font = `900 46px ${SERIF}`;
    for (const ln of wrapLines(ctx, d.winner.name, railW, 2)) { ry += 47; ctx.fillText(ln, railX, ry); }
    ry += 34;
    ctx.fillStyle = GOLD;
    ctx.font = `22px ${DISPLAY}`;
    ctx.fillText(`POWER ${d.winner.power.toFixed(0)} · GDP ${fmtGdp(d.winner.gdp)}`, railX, ry);
    ry += 26;
    ctx.fillStyle = "rgba(201,150,58,0.4)";
    ctx.fillRect(railX, ry, railW, 1);
    ry += 40;
    kicker(ctx, railX, ry, "TOP FIVE", 22);
    d.top5.forEach((t, i) => {
      const y = ry + 30 + i * 34;
      ctx.fillStyle = powerColor(t.code);
      ctx.fillRect(railX, y - 13, 13, 13);
      ctx.fillStyle = i === 0 ? GOLD : MUTED;
      ctx.font = `22px ${DISPLAY}`;
      ctx.fillText(String(i + 1).padStart(2, "0"), railX + 22, y);
      ctx.fillStyle = CREAM;
      ctx.font = `20px ${SANS}`;
      const name = t.name.length > 15 ? `${t.name.slice(0, 14)}…` : t.name;
      ctx.fillText(name, railX + 54, y);
      ctx.fillStyle = GOLD;
      ctx.font = `20px ${DISPLAY}`;
      ctx.textAlign = "right";
      ctx.fillText(t.power.toFixed(0), railX + railW, y);
      ctx.textAlign = "left";
    });

    let sy = mapY + (WORLD.height * mapW) / WORLD.width + 44;
    if (d.focusLine) {
      ctx.fillStyle = PARCH;
      ctx.font = `italic 23px ${SERIF}`;
      ctx.fillText(d.focusLine, M, sy);
      sy += 40;
    }
    kicker(ctx, M, sy, "BIGGEST SHOCKS OF THE CENTURY", 23);
    sy += 12;
    d.shocks.forEach((s) => {
      ctx.fillStyle = GOLD;
      ctx.font = `26px ${DISPLAY}`;
      ctx.fillText(String(s.year), M, sy + 24);
      ctx.fillStyle = PARCH;
      ctx.font = `20px ${SANS}`;
      const ls = wrapLines(ctx, s.text, CW - 76, 2);
      ls.forEach((ln, i) => ctx.fillText(ln, M + 76, sy + 24 + i * 25));
      sy += 24 + ls.length * 25 + 12;
    });
  } else {
    /* 9:16 — generous vertical rhythm, budgeted so the shocks never
       reach the fixed footer (checked against a 3-shock, 2-line worst case) */
    const mapW = CW;
    drawMapPlate(ctx, result, last, M, mapY, mapW);
    let y = mapY + (WORLD.height * mapW) / WORLD.width + 58;
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
    kicker(ctx, M, y, "BIGGEST SHOCKS OF THE CENTURY", 25);
    y += 10;
    d.shocks.forEach((s) => {
      ctx.fillStyle = GOLD;
      ctx.font = `32px ${DISPLAY}`;
      ctx.fillText(String(s.year), M, y + 26);
      ctx.fillStyle = PARCH;
      ctx.font = `24px ${SANS}`;
      const ls = wrapLines(ctx, s.text, CW - 92, 2);
      ls.forEach((ln, i) => ctx.fillText(ln, M + 92, y + 26 + i * 27));
      y += 26 + ls.length * 27 + 12;
    });
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
