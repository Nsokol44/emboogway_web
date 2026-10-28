"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaitlistForm from "@/components/WaitlistForm";
import { CODE_IDX, COUNTRIES, END_YEAR, START_YEAR } from "../lib/data";
import { ZERO_BOOSTS, endowmentFor, runSimulation, type SimConfig, type SimEvent } from "../lib/engine";
import {
  SUPERPOWER_BOOSTS, awayHeadlines, computeCatchUp, lineageKey, loadIdlerRecord,
  paceDef, rankAt, saveIdlerRecord, type PaceId,
} from "../lib/idler";
import { LAYERS, powerColor, type LayerId } from "../lib/scenarios";
import { decodeRun } from "../lib/share";
import SimPanel, { type IdlerProps } from "./SimPanel";

const MAX_YEAR_IDX = END_YEAR - START_YEAR;

const LS_PANELS = "geostory-panels-v1";
const LS_GUIDE = "geostory-guide-v1";
const LS_DISPLAY = "geostory-display-v1";
const SS_CTA = "geostory-cta-shown";

let nextId = 2;
/** first-ever visit: ONE sim — compare mode is one click away, not the default */
const DEFAULT_PANELS: { id: number; cfg: SimConfig }[] = [
  { id: 1, cfg: { scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS } },
];

const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";
const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MUTED = "#93a7bd";
const FAINT = "#5f748c";

function validCfg(c: unknown): c is SimConfig {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  const b = o.boosts as Record<string, unknown> | undefined;
  return (
    typeof o.scenarioId === "string" &&
    typeof o.seed === "string" &&
    !!b &&
    ["growth", "tech", "military", "resources"].every((k) => typeof b[k] === "number")
  );
}

/* the first-load tutorial — four steps, one idea each, in the game's own
   vocabulary. Shown once (LS_GUIDE), reopenable anytime from the "?" key. */
const GUIDE_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: "🌍", title: "A living century", text: "This is a simulated world: 175 countries, 2026 to 2100. Press ▶ and history plays out — the same seed always replays the same century. The pace is yours, in the strip below: Paused, Watchful (a year every 10 seconds) or Brisk (two years a second)." },
  { icon: "⚑", title: "Claim a nation", text: "Tap ⚑ CLAIM A NATION and pick one country. It becomes your anchor — outlined in cyan, its fortunes are your score — and you never hold its leash: it lives its own life while you watch and nudge. Your claim is saved on this device, and the world keeps turning at your pace while you're away. Come back to a “While you were away” card." },
  { icon: "🔔", title: "Turning Points, no interruptions", text: "Each decade, and after big shocks, a Turning Point lands in the notifications rail — the run never pauses for it. While its year is live you can spend influence on a lever (a research drive, a trade realignment, a hardened strait), or simply let the moment pass. You hold 6 influence; the ledger in the rail always shows what you've earned and spent." },
  { icon: "🎬", title: "Cinema mode", text: "Tap 🎬 CINEMA (or press C) and every panel bows out — just the world, full screen, with a director camera that drifts to where history is happening. It's the clean view: the one to watch, and the one to record. Esc brings the controls back." },
];

/** The tutorial card — stepped, dismissible at any point (Skip, backdrop,
 *  Esc), and it never traps: one dismiss and the visitor is playing. */
function GuideCard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === GUIDE_STEPS.length - 1;
  const s = GUIDE_STEPS[step];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="How to play the GeoStory Simulator"
      style={{ background: "rgba(3,10,20,0.72)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border px-5 py-5"
        style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 78%)", borderColor: "rgba(201,150,58,0.5)", boxShadow: "0 24px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(240,192,96,0.16)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD_DEEP }}>HOW TO PLAY · {step + 1} OF {GUIDE_STEPS.length}</div>
          <button onClick={onClose} className="ml-auto shrink-0 rounded-md px-2 py-1 font-display text-[11px] tracking-[0.18em] hover:opacity-75" style={{ color: MUTED }} aria-label="Skip the tutorial">
            SKIP ✕
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <span className="font-display text-3xl leading-none" aria-hidden style={{ color: GOLD }}>{s.icon}</span>
          <div className="min-w-0">
            <h2 className="font-serif text-2xl font-bold leading-tight" style={{ color: CREAM }}>{s.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: PARCH }}>{s.text}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-1.5" aria-hidden>
          {GUIDE_STEPS.map((g, i) => (
            <span key={g.title} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 22 : 8, background: i === step ? GOLD : "rgba(201,150,58,0.3)" }} />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}
            className="rounded border px-4 py-2.5 font-display text-sm tracking-[0.18em] disabled:invisible"
            style={{ borderColor: "rgba(201,150,58,0.45)", color: PARCH }}>
            BACK
          </button>
          {last ? (
            <button onClick={onClose}
              className="flex-1 rounded px-4 py-2.5 font-display text-base tracking-[0.2em]"
              style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.4)" }}>
              START PLAYING
            </button>
          ) : (
            <button onClick={() => setStep((v) => Math.min(GUIDE_STEPS.length - 1, v + 1))}
              className="flex-1 rounded px-4 py-2.5 font-display text-base tracking-[0.2em]"
              style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.4)" }}>
              NEXT
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>
          {last ? (
            <>Reopen this anytime with the <span style={{ color: PARCH }}>?</span> below. Keys: <span style={{ color: PARCH }}>space</span> play/pause · <span style={{ color: PARCH }}>← →</span> step a year · <span style={{ color: PARCH }}>1–6</span> layers · <span style={{ color: PARCH }}>C</span> cinema</>
          ) : (
            <>One idea at a time — skip whenever you're ready to play.</>
          )}
        </p>
      </div>
    </div>
  );
}

/** P1c — the model, on one card. Short on purpose. */
const MODEL_SECTIONS: { head: string; body: string }[] = [
  { head: "RECEPTIVITY", body: "Influence lands where a country is open to it. A power's pull on a neighbour is its bloc power × the neighbour's receptivity ÷ distance — open, unstable places drift first; closed, stable ones barely move." },
  { head: "MARKET GRAVITY", body: "Trade follows the biggest nearby economy. Market dominance usually arrives years before political influence does — the takeover before the takeover." },
  { head: "CHOKEPOINTS & SHOCKS", body: "A handful of straits carry the world's energy and goods. Close one and importers stall while rival exporters cash in. Droughts, finds, breakthroughs and crises reshuffle the same way: relative power, suddenly repriced." },
  { head: "THE TERRITORY RULE", body: "Borders move last, and rarely. A flip needs sustained influence from one power, a wide power gap, a shared border and deep local instability, held for years. Most of history is orbits and markets, not annexations." },
  { head: "YOUR INFLUENCE", body: "You hold 6 influence points. At each decade — and after major shocks — you may spend them on one lever: research, realignment, a hardened strait, a crisis, a stability compact. Small nudges, honestly priced." },
];

/* ------------------------------------------------------------- the Idler */
export interface Claim { code: string; idx: number; panelId: number; lineage: string }
export interface AnchorLine { id: number; year: number; text: string }

interface AwayData {
  years: number;
  capped: boolean;
  reachedEnd: boolean;
  fromYear: number;
  toYear: number;
  claimName: string;
  controllerName: string | null;
  rankFrom: number | null;
  rankTo: number | null;
  headlines: { event: SimEvent; tier: number }[];
}

/** The Away card — one screen, one decision (Continue), completable with
 *  one thumb. Headlines were ranked claim-first when the card was built. */
function AwayCard({ away, onContinue }: { away: AwayData; onContinue: () => void }) {
  const move = away.rankFrom !== null && away.rankTo !== null ? away.rankFrom - away.rankTo : null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="While you were away"
      style={{ background: "rgba(3,10,20,0.78)" }}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-xl border px-5 py-5"
        style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 78%)", borderColor: "rgba(201,150,58,0.55)", boxShadow: "0 24px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(240,192,96,0.16)" }}>
        <div className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD_DEEP }}>THE WORLD KEPT TURNING</div>
        <h2 className="mt-1 font-serif text-2xl font-bold leading-tight" style={{ color: CREAM }}>
          {away.capped ? "Your world rested after 25 years" : away.reachedEnd ? "The century ran its course" : "While you were away"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: PARCH }}>
          <strong style={{ color: GOLD }}>{away.years} years</strong> passed · {away.fromYear} → {away.toYear}
          {away.capped && <span style={{ color: MUTED }}> — a world left longer than that is a world you'd miss.</span>}
        </p>

        <div className="mt-3.5 rounded-lg border px-3.5 py-2.5" style={{ borderColor: "rgba(240,192,96,0.45)", background: "rgba(201,150,58,0.08)" }}>
          {away.rankTo === null ? (
            <p className="text-sm leading-snug" style={{ color: CREAM }}>
              ⚑ Your anchor, <strong>{away.claimName}</strong>, fell while you were away
              {away.controllerName ? <> — <strong style={{ color: GOLD }}>{away.controllerName}</strong> holds it now.</> : "."}
            </p>
          ) : away.rankFrom === null ? (
            <p className="text-sm leading-snug" style={{ color: CREAM }}>
              ⚑ Your anchor, <strong>{away.claimName}</strong>, stands on its own feet again — <strong style={{ color: GOLD }}>№ {away.rankTo}</strong> in the world.
            </p>
          ) : (
            <p className="text-sm leading-snug" style={{ color: CREAM }}>
              ⚑ Your anchor, <strong>{away.claimName}</strong>: № {away.rankFrom} → <strong style={{ color: GOLD }}>№ {away.rankTo}</strong>{" "}
              {move !== null && move > 0 && <span style={{ color: "#7fb069" }}>▲ climbed {move}</span>}
              {move !== null && move < 0 && <span style={{ color: "#d1603d" }}>▼ slipped {Math.abs(move)}</span>}
              {move === 0 && <span style={{ color: MUTED }}>━ held its place</span>}
            </p>
          )}
        </div>

        {away.headlines.length > 0 && (
          <ul className="mt-3.5 space-y-1.5">
            {away.headlines.map(({ event, tier }, i) => (
              <li key={`${event.year}-${i}`} className="flex gap-2 text-xs leading-snug" style={{ color: tier === 0 ? CREAM : PARCH }}>
                <span className="w-8 shrink-0 font-display text-[13px] leading-none" style={{ color: GOLD }}>{event.year}</span>
                <span className="shrink-0" aria-hidden style={{ color: tier === 0 ? GOLD : FAINT }}>{tier === 0 ? "⚑" : "·"}</span>
                <span>{event.text}</span>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onContinue}
          className="mt-5 w-full rounded px-4 py-3 font-display text-base tracking-[0.2em]"
          style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.4)" }}>
          CONTINUE — {away.toYear}
        </button>
      </div>
    </div>
  );
}

/** The claim picker — every nation, ranked as of today in this run.
 *  ⚑ claims it as your anchor; 🚀 starts a one-click Superpower run on it. */
function ClaimPicker({ panelNo, yearIdx, result, currentClaimCode, onPick, onSuperpower, onClose }: {
  panelNo: number;
  yearIdx: number;
  result: ReturnType<typeof runSimulation>;
  currentClaimCode: string | null;
  onPick: (idx: number) => void;
  onSuperpower: (idx: number) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const arr = COUNTRIES.map((c, idx) => ({
      idx, code: c.code, name: c.name,
      rank: rankAt(result, yearIdx, idx),
      holder: result.years[yearIdx][idx].c,
    }));
    arr.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name));
    return arr;
  }, [result, yearIdx]);
  const shown = q.trim() ? rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())) : rows;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Claim a nation"
      style={{ background: "rgba(3,10,20,0.78)" }} onClick={onClose}>
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-xl border px-5 py-5"
        style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 78%)", borderColor: "rgba(201,150,58,0.55)", boxShadow: "0 24px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(240,192,96,0.16)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div>
            <div className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD_DEEP }}>THE IDLER · SIM {panelNo}</div>
            <h2 className="mt-1 font-serif text-2xl font-bold leading-tight" style={{ color: CREAM }}>Claim a nation</h2>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md px-2 py-1 text-sm leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Close the claim picker">✕</button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: PARCH }}>
          Anchor this run to one nation. Its fortunes are the score; its leash is not held — you watch,
          nudge at turning points, and set the pace. Your claim, your pace and your place in the century
          are saved on this device: leave, and the world keeps turning at your pace.
        </p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 175 nations…"
          className="mt-3 w-full rounded border px-3 py-2 text-sm"
          style={{ background: "#04101e", color: CREAM, borderColor: "rgba(201,150,58,0.4)" }}
          aria-label="Search nations" />
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <ul className="space-y-1">
            {shown.map((r) => {
              const mine = r.code === currentClaimCode;
              return (
                <li key={r.code} className="flex items-center gap-2 rounded-md border px-2.5 py-2"
                  style={{ borderColor: mine ? "rgba(240,192,96,0.65)" : "rgba(147,167,189,0.16)", background: mine ? "rgba(201,150,58,0.10)" : "rgba(3,12,24,0.35)" }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: powerColor(r.code) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ color: CREAM }}>{r.name}</span>
                    <span className="block text-[10px] tracking-wide" style={{ color: MUTED }}>
                      {r.rank !== null ? `№ ${r.rank} IN THE WORLD` : `HELD BY ${COUNTRIES[r.holder].name.toUpperCase()}`}
                    </span>
                  </span>
                  {mine ? (
                    <span className="shrink-0 font-display text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>⚑ YOUR ANCHOR</span>
                  ) : (
                    <>
                      <button onClick={() => onPick(r.idx)}
                        className="shrink-0 rounded px-2.5 py-1.5 text-[11px] font-bold tracking-wider"
                        style={{ background: GOLD_DEEP, color: "#081426" }}>
                        ⚑ CLAIM
                      </button>
                      <button onClick={() => onSuperpower(r.idx)} title="One-click what-if: this nation gets everything — growth, tech, arms, resources — and the run restarts at Brisk"
                        className="shrink-0 rounded border px-2.5 py-1.5 text-[11px] font-semibold tracking-wider"
                        style={{ borderColor: "rgba(240,192,96,0.5)", color: GOLD }}>
                        🚀 SUPERPOWER
                      </button>
                    </>
                  )}
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-1 py-2 text-xs" style={{ color: FAINT }}>No nation matches that search.</li>}
          </ul>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: FAINT }}>
          Prefer the map? Tap any country, then ⚑ CLAIM in its dossier. A 🚀 Superpower run restarts this
          sim at 2026 with the boost applied — same seed, same settings, fully reproducible.
          Small-nation endowment: a Superpower run on a nation starting under $150B also lifts it to a
          great-power economic base (≈$450B) at 2026 — the fantasy is the base, not just the boosts.
        </p>
      </div>
    </div>
  );
}

export default function SimulatorApp() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [yearFloat, setYearFloat] = useState(0);
  /* the world's clock: a pace, not a play state. "paused" freezes time
     (here and while away); watchful/brisk flow at their own rates. */
  const [pace, setPace] = useState<PaceId>("paused");
  const [layer, setLayer] = useState<LayerId>("territory");
  /* no preset anchor, no pre-picked country: a fresh visitor starts with
     nothing selected and nothing claimed — the map is blank until THEY
     choose. (A returning visitor's saved claim restores its selection in
     the mount effect below; that is their choice coming back, not ours.) */
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [terrainArt, setTerrainArt] = useState(true);
  const [weatherOn, setWeatherOn] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [challenge, setChallenge] = useState(false);
  /* the full-screen stage shows ONE panel at a time — the bottom deck's
     switcher picks which; the rest stay mounted (state intact) but hidden */
  const [activeId, setActiveId] = useState(1);
  /* ── the Idler ── */
  const [claim, setClaim] = useState<Claim | null>(null);
  const [anchorLog, setAnchorLog] = useState<AnchorLine[]>([]);
  const [away, setAway] = useState<AwayData | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [autoCam, setAutoCam] = useState(true);
  const [holdMajors, setHoldMajors] = useState(false);
  const [restored, setRestored] = useState(false);
  const challengeRef = useRef(false);
  const lastPaceRef = useRef<PaceId>("brisk");
  const awayPaceRef = useRef<PaceId | null>(null);
  const holdUntilRef = useRef(0);
  const anchorIdRef = useRef(0);
  const [engaged, setEngaged] = useState(false);
  const [ctaGone, setCtaGone] = useState(true); // revealed by effect only pre-engagement checks pass
  const rafRef = useRef<number | null>(null);
  const saveArmedRef = useRef(false);
  const displayArmedRef = useRef(false);

  const flowing = pace !== "paused" && yearFloat < MAX_YEAR_IDX;

  const pushAnchor = useCallback((year: number, text: string) => {
    anchorIdRef.current += 1;
    const id = anchorIdRef.current;
    setAnchorLog((l) => [...l.slice(-39), { id, year, text }]);
  }, []);

  /* full deterministic histories, computed here so panels can be diffed */
  const results = useMemo(() => panels.map((p) => runSimulation(p.cfg)), [panels]);
  const activePanel = panels.find((p) => p.id === activeId) ?? panels[0];
  const activeResult = results[panels.findIndex((p) => p.id === activePanel.id)] ?? results[0];

  /* ---- restore: panels, display, guide — and the visitor's claimed world.
     A challenge link (?run=…) wins over saved panels — and while one is
     loaded, the visitor's own saved world is left entirely untouched. */
  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get("run");
      const linked = param ? decodeRun(param) : null;
      let restoredPanels = DEFAULT_PANELS;
      if (linked) {
        challengeRef.current = true;
        setChallenge(true);
        restoredPanels = [{ id: 1, cfg: linked }];
        setPanels(restoredPanels);
        nextId = 2;
      } else {
        const raw = localStorage.getItem(LS_PANELS);
        if (raw) {
          const arr: unknown = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length >= 1 && arr.length <= 4 && arr.every(validCfg)) {
            restoredPanels = arr.map((cfg, i) => ({ id: i + 1, cfg: cfg as SimConfig }));
            setPanels(restoredPanels);
            nextId = arr.length + 1;
          }
        }
      }
      const disp = localStorage.getItem(LS_DISPLAY);
      if (disp) {
        const d = JSON.parse(disp) as { terrainArt?: unknown; weather?: unknown };
        if (typeof d.terrainArt === "boolean") setTerrainArt(d.terrainArt);
        if (typeof d.weather === "boolean") setWeatherOn(d.weather);
      }
      if (!localStorage.getItem(LS_GUIDE)) setGuideOpen(true);
      setCtaGone(sessionStorage.getItem(SS_CTA) === "1");

      /* the Idler: resume the claimed world, fast-forwarded by the time
         away at its saved pace (capped — see lib/idler.ts) */
      if (!linked) {
        const rec = loadIdlerRecord();
        if (rec && rec.claimCode && rec.lineage) {
          const claimIdx = CODE_IDX.get(rec.claimCode) ?? -1;
          const panel =
            restoredPanels.find((p) => p.id === rec.panelId && lineageKey(p.cfg) === rec.lineage) ??
            restoredPanels.find((p) => lineageKey(p.cfg) === rec.lineage);
          if (panel && claimIdx >= 0) {
            const result = runSimulation(panel.cfg);
            const fromYi = Math.max(0, Math.min(MAX_YEAR_IDX, rec.savedYearIdx));
            const cu = computeCatchUp(fromYi, rec.savedAt, Date.now(), rec.pace, MAX_YEAR_IDX);
            setClaim({ code: rec.claimCode, idx: claimIdx, panelId: panel.id, lineage: rec.lineage });
            setActiveId(panel.id);
            setSelectedIdx(claimIdx);
            setYearFloat(cu.toYearIdx);
            if (rec.pace !== "paused") lastPaceRef.current = rec.pace;
            if (cu.years >= 1) {
              /* the Away card gates the resumption of the world's clock */
              awayPaceRef.current = rec.pace;
              const endSnap = result.years[cu.toYearIdx][claimIdx];
              setAway({
                years: cu.years,
                capped: cu.capped,
                reachedEnd: cu.toYearIdx >= MAX_YEAR_IDX,
                fromYear: START_YEAR + cu.fromYearIdx,
                toYear: START_YEAR + cu.toYearIdx,
                claimName: COUNTRIES[claimIdx].name,
                controllerName: endSnap.c !== claimIdx ? COUNTRIES[endSnap.c].name : null,
                rankFrom: rankAt(result, cu.fromYearIdx, claimIdx),
                rankTo: rankAt(result, cu.toYearIdx, claimIdx),
                headlines: awayHeadlines(result.events, START_YEAR + cu.fromYearIdx, START_YEAR + cu.toYearIdx, claimIdx),
              });
            } else {
              setPace(rec.pace); // nothing to report — their clock simply resumes
            }
          }
        }
      }
    } catch { /* private mode etc. — the defaults are fine */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!displayArmedRef.current) { displayArmedRef.current = true; return; }
    try {
      localStorage.setItem(LS_DISPLAY, JSON.stringify({ terrainArt, weather: weatherOn }));
    } catch { /* non-fatal */ }
  }, [terrainArt, weatherOn]);

  useEffect(() => {
    /* skip the mount run: the restore above may still be applying, and the
       defaults must never overwrite a returning visitor's saved panels */
    if (!saveArmedRef.current) { saveArmedRef.current = true; return; }
    if (challengeRef.current) return; // a visiting challenge run is not ours to save over
    try {
      localStorage.setItem(LS_PANELS, JSON.stringify(panels.map((p) => p.cfg)));
    } catch { /* storage full/blocked — non-fatal */ }
  }, [panels]);

  /* ---- the Idler record: claim + pace + playhead, restamped whenever any
     of them move, so a later visit can accrue time away from exactly here.
     If the claimed panel's lineage changes (seed/scenario/boosts edited),
     the century it anchored is gone — the claim is released, on the record. */
  const yearIdxNow = Math.floor(yearFloat);
  useEffect(() => {
    if (!restored || challengeRef.current) return;
    if (claim) {
      const panel = panels.find((p) => p.id === claim.panelId);
      if (!panel || lineageKey(panel.cfg) !== claim.lineage) {
        pushAnchor(START_YEAR + yearIdxNow, "The world was rewritten — your anchor was released with the old century. Claim again when ready.");
        setClaim(null);
        saveIdlerRecord({ v: 1, claimCode: null, panelId: null, lineage: null, pace, savedAt: Date.now(), savedYearIdx: yearIdxNow });
        return;
      }
    }
    saveIdlerRecord({
      v: 1,
      claimCode: claim?.code ?? null,
      panelId: claim?.panelId ?? null,
      lineage: claim?.lineage ?? null,
      pace,
      savedAt: Date.now(),
      savedYearIdx: yearIdxNow,
    });
  }, [restored, claim, pace, yearIdxNow, panels, pushAnchor]);

  /* ---- anchor milestones: rank movements enter the chronicle in the
     brief's voice ("Your anchor, Egypt, slipped to № 14") ---------------- */
  const prevClaimRankRef = useRef<{ key: string; rank: number | null } | null>(null);
  useEffect(() => {
    if (!claim || claim.panelId !== activePanel.id) { prevClaimRankRef.current = null; return; }
    const rank = rankAt(activeResult, yearIdxNow, claim.idx);
    const key = `${claim.panelId}:${claim.code}`;
    const prev = prevClaimRankRef.current;
    prevClaimRankRef.current = { key, rank };
    if (!prev || prev.key !== key || prev.rank === rank) return;
    const name = COUNTRIES[claim.idx].name;
    const yr = START_YEAR + yearIdxNow;
    if (rank === null) pushAnchor(yr, `Your anchor, ${name}, has fallen — it flies another flag now. Its fortunes were the score.`);
    else if (prev.rank === null) pushAnchor(yr, `Your anchor, ${name}, is sovereign again — № ${rank} in the world.`);
    else if (rank < prev.rank) pushAnchor(yr, `Your anchor, ${name}, climbed to № ${rank} in the world.`);
    else pushAnchor(yr, `Your anchor, ${name}, slipped to № ${rank} in the world.`);
  }, [claim, activePanel.id, activeResult, yearIdxNow, pushAnchor]);

  /* ---- playback: the pace IS the clock. A "hold on majors" beat (cinema)
     freezes the playhead briefly without touching the pace. ------------- */
  useEffect(() => {
    if (pace === "paused") return;
    const rate = paceDef(pace).yearsPerSecond;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (now >= holdUntilRef.current) {
        setYearFloat((y) => {
          const n = y + dt * rate;
          if (n >= MAX_YEAR_IDX) {
            setPace("paused");
            return MAX_YEAR_IDX;
          }
          return n;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pace]);

  /* engagement: 25+ years played in any session of this visit */
  useEffect(() => { if (yearFloat >= 25) setEngaged(true); }, [yearFloat]);

  const year = START_YEAR + Math.floor(yearFloat);
  const pausePlayback = useCallback(() => setPace("paused"), []);
  const holdRequest = useCallback((ms: number) => {
    holdUntilRef.current = Math.max(holdUntilRef.current, performance.now() + ms);
  }, []);
  const choosePace = useCallback((p: PaceId) => {
    if (p !== "paused") lastPaceRef.current = p;
    setPace(p);
  }, []);
  const togglePlay = useCallback(() => {
    if (pace !== "paused") { setPace("paused"); return; }
    if (yearFloat >= MAX_YEAR_IDX) setYearFloat(0);
    setPace(lastPaceRef.current);
  }, [pace, yearFloat]);
  const stepYear = useCallback(() => {
    setPace("paused");
    setYearFloat((y) => Math.min(MAX_YEAR_IDX, Math.floor(y) + 1));
  }, []);

  /* ---- cinema: the site nav bows out (see globals.css body.gs-cinema),
     the grade warms up, and holds on majors switch on -------------------- */
  useEffect(() => {
    document.body.classList.toggle("gs-cinema", cinema);
    if (cinema) setHoldMajors(true);
    return () => { document.body.classList.remove("gs-cinema"); };
  }, [cinema]);

  /* closing the tutorial marks it seen — Esc, Skip, the backdrop and
     START PLAYING all count as seen; it never reappears uninvited
     (the "?" in the transport reopens it on demand) */
  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    try { localStorage.setItem(LS_GUIDE, "1"); } catch { /* non-fatal */ }
  }, []);

  /* ---- keyboard: space play/pause, arrows step a year, 1–N layers (N =
         LAYERS.length — Religion is № 6),
         C cinema, Esc closes overlays (the sheet has its own) ----------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Escape") {
        if (cinema) { setCinema(false); return; }
        setModelOpen(false);
        closeGuide();
        setPickerOpen(false);
        return;
      }
      if (e.code === "Space" && t && t.tagName === "BUTTON") return; // a focused button activates natively
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        setPace("paused");
        setYearFloat((y) => Math.min(MAX_YEAR_IDX, y + 1));
      } else if (e.key === "ArrowLeft") {
        setPace("paused");
        setYearFloat((y) => Math.max(0, y - 1));
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= LAYERS.length) {
        setLayer(LAYERS[Number(e.key) - 1].id);
      } else if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setCinema((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setCfg = (id: number) => (cfg: SimConfig) => {
    const boosted =
      cfg.boosts.growth + cfg.boosts.tech + cfg.boosts.military + cfg.boosts.resources > 0 ||
      (cfg.rivals?.length ?? 0) > 0;
    if (boosted) setEngaged(true);
    setPanels((ps) => ps.map((p) => (p.id === id ? { ...p, cfg } : p)));
  };
  const addPanel = () => {
    if (panels.length >= 4) return;
    const id = nextId++;
    setPanels((ps) => [...ps, { id, cfg: { scenarioId: "rise", seed: `run-${id}`, boosts: { growth: 55, tech: 60, military: 50, resources: 45 } } }]);
    setActiveId(id);
  };
  const duplicatePanel = (p: { id: number; cfg: SimConfig }) => {
    if (panels.length >= 4) return;
    const id = nextId++;
    setPanels((ps) => [...ps, { id, cfg: { ...p.cfg, boosts: { ...p.cfg.boosts }, rivals: p.cfg.rivals?.map((r) => ({ ...r, boosts: { ...r.boosts } })), deck: p.cfg.deck ? { ...p.cfg.deck } : undefined, modifiers: p.cfg.modifiers ? [...p.cfg.modifiers] : undefined, interventions: p.cfg.interventions?.map((v) => ({ ...v })) } }]);
    setActiveId(id);
  };
  const removePanel = (id: number) => {
    setPanels((ps) => {
      const next = ps.filter((x) => x.id !== id);
      if (id === activeId && next.length > 0) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  /* ---- the Idler's verbs — all on the active panel's run ---------------- */
  const claimNation = useCallback((idx: number) => {
    const code = COUNTRIES[idx].code;
    const yr = START_YEAR + Math.floor(yearFloat);
    if (claim && claim.code !== code) {
      pushAnchor(yr, `Your anchor is now ${COUNTRIES[idx].name} — you released ${COUNTRIES[claim.idx].name}. The switch is on the record.`);
    } else if (!claim) {
      pushAnchor(yr, `You claimed ${COUNTRIES[idx].name} as your anchor. Its fortunes are the score; its leash is not held.`);
    }
    setClaim({ code, idx, panelId: activePanel.id, lineage: lineageKey(activePanel.cfg) });
    setSelectedIdx(idx);
    setPickerOpen(false);
  }, [claim, activePanel, yearFloat, pushAnchor]);

  const releaseClaim = useCallback(() => {
    if (!claim) return;
    pushAnchor(START_YEAR + Math.floor(yearFloat), `You released your anchor, ${COUNTRIES[claim.idx].name}. The world turns on, unwatched.`);
    setClaim(null);
  }, [claim, yearFloat, pushAnchor]);

  /** one-click superpower: an ordinary config (focus + all-in boosts), so
   *  the take is deterministic — claim it, restart it, run it at Brisk */
  const superpowerRun = useCallback((idx: number) => {
    const code = COUNTRIES[idx].code;
    const cfg: SimConfig = { ...activePanel.cfg, focusCode: code, boosts: { ...SUPERPOWER_BOOSTS }, interventions: [] };
    setCfg(activePanel.id)(cfg);
    setClaim({ code, idx, panelId: activePanel.id, lineage: lineageKey(cfg) });
    setSelectedIdx(idx);
    setYearFloat(0);
    lastPaceRef.current = "brisk";
    setPace("brisk");
    setPickerOpen(false);
    const endow = endowmentFor(cfg);
    pushAnchor(START_YEAR, `🚀 SUPERPOWER RUN — ${COUNTRIES[idx].name} gets everything: growth, tech, arms, resources, all-in. Same seed, same world — watch it climb.${endow ? ` Small-nation endowment: it starts under $150B, so it also begins from a great-power economic base (≈$450B).` : ""}`);
  }, [activePanel, pushAnchor]);

  const jumpToClaim = useCallback(() => {
    if (!claim) return;
    setActiveId(claim.panelId);
    setSelectedIdx(claim.idx);
  }, [claim]);

  const continueAway = useCallback(() => {
    setAway(null);
    if (awayPaceRef.current && awayPaceRef.current !== "paused") {
      lastPaceRef.current = awayPaceRef.current;
      setPace(awayPaceRef.current);
    }
    awayPaceRef.current = null;
  }, []);

  /* shared transport, handed to the active panel's bottom deck */
  const transport = {
    playing: flowing,
    onTogglePlay: togglePlay,
    onStep: stepYear,
    onReset: () => { setPace("paused"); setYearFloat(0); },
    year,
    yearFloat,
    maxYearIdx: MAX_YEAR_IDX,
    onScrub: (v: number) => { setPace("paused"); setYearFloat(v); },
    pace,
    onPace: choosePace,
    layer,
    onLayer: setLayer,
    terrainArt,
    onTerrainArt: () => setTerrainArt((v) => !v),
    weatherOn,
    onWeather: () => setWeatherOn((v) => !v),
    showDiff: panels.length > 1 ? showDiff : null,
    onToggleDiff: () => setShowDiff((d) => !d),
    onModelOpen: () => setModelOpen(true),
    onGuideOpen: () => setGuideOpen(true),
  };

  const idlerFor = (panelId: number): IdlerProps => ({
    claimHere: claim && claim.panelId === panelId ? { code: claim.code, idx: claim.idx } : null,
    claimElsewhere: claim && claim.panelId !== panelId
      ? { code: claim.code, name: COUNTRIES[claim.idx].name, panelNo: Math.max(1, panels.findIndex((x) => x.id === claim.panelId) + 1) }
      : null,
    onClaim: claimNation,
    onReleaseClaim: releaseClaim,
    onOpenPicker: () => setPickerOpen(true),
    onJumpToClaim: jumpToClaim,
    onSuperpower: superpowerRun,
    anchorLog,
    cinema,
    onToggleCinema: () => setCinema((v) => !v),
    autoCam,
    onToggleAutoCam: () => setAutoCam((v) => !v),
    holdMajors,
    onToggleHoldMajors: () => setHoldMajors((v) => !v),
    onHoldRequest: holdRequest,
  });

  /* panel switcher for the collapsed strip */
  const panelSwitcher = (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Comparison sims">
      {panels.map((p, i) => (
        <button key={p.id} onClick={() => setActiveId(p.id)} aria-pressed={p.id === activePanel.id}
          className="rounded-md border px-2 py-1.5 font-display text-[11px] tracking-wider"
          style={{
            borderColor: p.id === activePanel.id ? "rgba(240,192,96,0.7)" : "rgba(201,150,58,0.3)",
            color: p.id === activePanel.id ? GOLD : "#cbb27a",
            background: p.id === activePanel.id ? "rgba(201,150,58,0.16)" : "transparent",
          }}>
          SIM {i + 1}
        </button>
      ))}
      <button onClick={addPanel} disabled={panels.length >= 4}
        className="rounded-md border px-2 py-1.5 text-[11px] tracking-wider disabled:opacity-40"
        style={{ borderColor: "rgba(201,150,58,0.45)", color: GOLD }}
        aria-label={`Add a comparison sim (${panels.length} of 4)`}>
        ＋
      </button>
    </div>
  );

  /* the challenge chip that rides in the collapsed strip */
  const challengeChip = challenge ? (
    <span className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5"
      style={{ borderColor: "rgba(240,192,96,0.55)", background: "rgba(201,150,58,0.10)" }}
      title="This exact century arrived by link — same config, same history.">
      <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>⚔ CHALLENGE RUN</span>
      <button onClick={() => setChallenge(false)} className="text-xs leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Dismiss the challenge notice">✕</button>
    </span>
  ) : null;
  const dismissCta = () => {
    setCtaGone(true);
    try { sessionStorage.setItem(SS_CTA, "1"); } catch { /* non-fatal */ }
  };
  const showCta = engaged && !ctaGone && !cinema;
  const atStart = !flowing && yearFloat === 0 && !cinema;

  return (
    <div className="geostory-ui">
      {/* ══ THE STAGE — the whole screen is the world map. Every panel
          stays mounted (its state intact); only the active one shows.
          The bottom deck — transport strip + tabbed sheet — is rendered
          by the active panel, docked at the screen's lower edge (in flow
          under the stage on portrait phones).
          CINEMA: the stage pins over the whole viewport and every other
          element on the page bows out — this is the recording surface. ══ */}
      <section className={`w-full overflow-hidden ${cinema ? "fixed inset-0 z-[70]" : "relative"}`} style={{ height: "100dvh", background: "radial-gradient(ellipse at 50% 42%, #0d2f52 0%, #081f38 55%, #040f1e 100%)" }} aria-label="GeoStory Simulator">
        {panels.map((p, i) => (
          <SimPanel
            key={p.id}
            uid={`sim-${p.id}`}
            cfg={p.cfg}
            onCfg={setCfg(p.id)}
            result={results[i]}
            diffResult={showDiff && i > 0 ? results[0] : null}
            yearFloat={yearFloat}
            layer={layer}
            terrainArt={terrainArt}
            weather={weatherOn}
            playing={flowing}
            onPauseRequest={pausePlayback}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            active={p.id === activePanel.id}
            transport={transport}
            idler={idlerFor(p.id)}
            panelSwitcher={panelSwitcher}
            challengeChip={challengeChip}
            onRemove={panels.length > 1 ? () => removePanel(p.id) : undefined}
            onDuplicate={panels.length < 4 ? () => duplicatePanel(p) : undefined}
          />
        ))}

        {/* first-run hint — floats over the map, gone once the century moves.
            PORTRAIT: the plate is centred in a flex-1 stage under the 48px
            header clearance, so the hint rides at the top of the stage,
            over the ocean band above the plate */}
        {atStart && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-3 max-sm:top-16">
            <span className="rounded-full border px-3.5 py-1.5 font-display text-[13px] tracking-[0.16em]"
              style={{ background: "rgba(4,16,30,0.78)", borderColor: "rgba(240,192,96,0.5)", color: GOLD, backdropFilter: "blur(6px)" }}>
              PRESS ▶ TO RUN THE CENTURY — OR ⚑ CLAIM A NATION
            </span>
          </div>
        )}

        {/* contextual waitlist CTA — earned by playing; floats top-center
            under the header overlay, dismissible, never covers mid-map.
            PORTRAIT: same stage-top anchor as the hint (the deck out-ranks
            it at z-30, so an open sheet or Turning Point still wins) */}
        {showCta && (
          <div className="absolute inset-x-0 top-14 z-20 flex justify-center px-3 max-sm:top-16">
            <div className="relative w-full max-w-xl rounded-xl border px-4 py-3.5 backdrop-blur-md"
              style={{ background: "linear-gradient(150deg, rgba(23,52,88,0.72), rgba(6,20,38,0.88))", borderColor: "rgba(201,150,58,0.45)", boxShadow: "0 18px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(240,192,96,0.15)" }}>
              <button onClick={dismissCta} className="absolute right-2.5 top-2 text-sm leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Dismiss this message">✕</button>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="min-w-[230px] flex-1">
                  <div className="font-display text-sm tracking-[0.18em]" style={{ color: GOLD }}>LIKED STEERING THE CENTURY?</div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: PARCH }}>
                    In the full game you play every turn yourself. Join the Kickstarter waitlist — we&apos;ll email you at launch.
                  </p>
                </div>
                <div className="w-full min-w-[260px] flex-1 sm:w-auto">
                  <WaitlistForm source="geostory-sim" cta="JOIN THE WAITLIST" />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* the Away card — a claimed world that moved while you were gone */}
      {away && <AwayCard away={away} onContinue={continueAway} />}

      {/* the claim picker — the idler's front door */}
      {pickerOpen && (
        <ClaimPicker
          panelNo={Math.max(1, panels.findIndex((p) => p.id === activePanel.id) + 1)}
          yearIdx={Math.floor(yearFloat)}
          result={activeResult}
          currentClaimCode={claim && claim.panelId === activePanel.id ? claim.code : null}
          onPick={claimNation}
          onSuperpower={superpowerRun}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* the tutorial — first load only (LS_GUIDE), reopenable via "?" */}
      {guideOpen && <GuideCard onClose={closeGuide} />}

      {/* P1c — how the model works, one click from the transport */}
      {modelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="How the GeoStory model works"
          style={{ background: "rgba(3,10,20,0.72)" }} onClick={() => setModelOpen(false)}>
          <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-xl border px-5 py-5"
            style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 78%)", borderColor: "rgba(201,150,58,0.5)", boxShadow: "0 24px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(240,192,96,0.16)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD_DEEP }}>EMBOOGWAY × STRATATIR</div>
            <h2 className="mt-1 font-serif text-2xl font-bold" style={{ color: CREAM }}>How the model works</h2>
            <div className="mt-4 space-y-3.5">
              {MODEL_SECTIONS.map((s) => (
                <div key={s.head}>
                  <div className="font-display text-xs tracking-[0.22em]" style={{ color: GOLD }}>{s.head}</div>
                  <p className="mt-0.5 text-xs leading-relaxed" style={{ color: PARCH }}>{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t pt-3 text-xs italic leading-relaxed" style={{ borderColor: "rgba(201,150,58,0.25)", color: MUTED }}>
              A transparent toy model of power dynamics — built for thinking with, not forecasting. Every run is
              deterministic: the same seed and settings replay the same century, so arguments are about the model,
              never about the dice.
            </p>
            <button onClick={() => setModelOpen(false)}
              className="mt-4 w-full rounded px-4 py-2.5 font-display text-base tracking-[0.2em]"
              style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.4)" }}>
              BACK TO THE CENTURY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
