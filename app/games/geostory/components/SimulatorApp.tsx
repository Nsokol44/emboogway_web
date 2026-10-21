"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WaitlistForm from "@/components/WaitlistForm";
import { CODE_IDX, END_YEAR, START_YEAR } from "../lib/data";
import { ZERO_BOOSTS, runSimulation, type SimConfig } from "../lib/engine";
import { LAYERS, type LayerId } from "../lib/scenarios";
import SimPanel from "./SimPanel";

const SPEEDS = [0.5, 1, 2, 4];
const MAX_YEAR_IDX = END_YEAR - START_YEAR;

const LS_PANELS = "geostory-panels-v1";
const LS_GUIDE = "geostory-guide-v1";
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

const GUIDE_STEPS: { icon: string; title: string; text: string }[] = [
  { icon: "▶", title: "Press Play", text: "Run the century from 2026 to 2100 — or drag the year slider and scrub history yourself." },
  { icon: "◎", title: "Click any country", text: "Its dossier opens: GDP, technology, who holds it, whose market it feeds — and buttons to boost it or set it as a rival." },
  { icon: "▦", title: "Switch layers", text: "Territory, Influence, Economic dominance and Technology are four different maps of power. Watch how they disagree." },
  { icon: "⧉", title: "Duplicate & bend it", text: "Clone a sim, change its seed or shock deck, and compare two centuries side by side. Same seed + settings = same history, every time." },
];

export default function SimulatorApp() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [yearFloat, setYearFloat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [layer, setLayer] = useState<LayerId>("territory");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(CODE_IDX.get("USA") ?? 0);
  const [showDiff, setShowDiff] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [ctaGone, setCtaGone] = useState(true); // revealed by effect only pre-engagement checks pass
  const rafRef = useRef<number | null>(null);
  const saveArmedRef = useRef(false);

  /* full deterministic histories, computed here so panels can be diffed */
  const results = useMemo(() => panels.map((p) => runSimulation(p.cfg)), [panels]);

  /* ---- persistence: restore the visitor's panels, then keep them saved -- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PANELS);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length >= 1 && arr.length <= 4 && arr.every(validCfg)) {
          setPanels(arr.map((cfg, i) => ({ id: i + 1, cfg: cfg as SimConfig })));
          nextId = arr.length + 1;
        }
      }
      if (!localStorage.getItem(LS_GUIDE)) setGuideOpen(true);
      setCtaGone(sessionStorage.getItem(SS_CTA) === "1");
    } catch { /* private mode etc. — the defaults are fine */ }
  }, []);

  useEffect(() => {
    /* skip the mount run: the restore above may still be applying, and the
       defaults must never overwrite a returning visitor's saved panels */
    if (!saveArmedRef.current) { saveArmedRef.current = true; return; }
    try {
      localStorage.setItem(LS_PANELS, JSON.stringify(panels.map((p) => p.cfg)));
    } catch { /* storage full/blocked — non-fatal */ }
  }, [panels]);

  /* ---- playback ---------------------------------------------------------- */
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setYearFloat((y) => {
        const n = y + dt * speed;
        if (n >= MAX_YEAR_IDX) {
          setPlaying(false);
          return MAX_YEAR_IDX;
        }
        return n;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed]);

  /* engagement: 25+ years played in any session of this visit */
  useEffect(() => { if (yearFloat >= 25) setEngaged(true); }, [yearFloat]);

  const year = START_YEAR + Math.floor(yearFloat);
  const togglePlay = () => {
    if (yearFloat >= MAX_YEAR_IDX) setYearFloat(0);
    setPlaying((p) => !p);
  };

  /* ---- keyboard: space play/pause, arrows step a year, 1–4 layers ------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.code === "Space" && t && t.tagName === "BUTTON") return; // a focused button activates natively
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        setPlaying(false);
        setYearFloat((y) => Math.min(MAX_YEAR_IDX, y + 1));
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        setYearFloat((y) => Math.max(0, y - 1));
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        setLayer(LAYERS[Number(e.key) - 1].id);
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
  };
  const closeGuide = () => {
    setGuideOpen(false);
    try { localStorage.setItem(LS_GUIDE, "1"); } catch { /* non-fatal */ }
  };
  const dismissCta = () => {
    setCtaGone(true);
    try { sessionStorage.setItem(SS_CTA, "1"); } catch { /* non-fatal */ }
  };
  const showCta = engaged && !ctaGone;
  const atStart = !playing && yearFloat === 0;

  return (
    <div className="geostory-ui">
      {/* transport bar — sticks BELOW the fixed site nav: its offset is the
          nav's own height (--nav-h in globals.css, matched to Nav.tsx) plus
          a breathing gap, and it sits under the nav in z-order on an opaque
          navy plate, so the two can never overlap at any width. */}
      <div className="sticky z-30 mx-auto max-w-[1500px] px-3" style={{ top: "calc(var(--nav-h) + 10px)" }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2"
          style={{ background: "rgba(5,17,32,0.96)", borderColor: "rgba(201,150,58,0.40)", boxShadow: "0 14px 34px rgba(0,0,0,0.6), inset 0 1px 0 rgba(240,192,96,0.14)" }}>
          <button
            onClick={togglePlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg"
            style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.45)" }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            onClick={() => { setPlaying(false); setYearFloat(0); }}
            className="shrink-0 rounded-md border px-2 py-1.5 text-[11px] tracking-wider hover:opacity-80"
            style={{ borderColor: "rgba(201,150,58,0.4)", color: "#cbb27a" }}
            aria-label="Reset to 2026"
          >
            ⟲ 2026
          </button>
          <div className="shrink-0 text-center">
            <div className="font-display text-3xl leading-none" style={{ color: GOLD }}>{year}</div>
            <div className="text-[9px] tracking-[0.22em]" style={{ color: MUTED }}>YEAR</div>
          </div>
          <input
            type="range" min="0" max={MAX_YEAR_IDX} step="0.05" value={yearFloat}
            onChange={(e) => { setPlaying(false); setYearFloat(parseFloat(e.target.value)); }}
            className="gs-range min-w-[110px] flex-1"
            aria-label="Year scrubber"
          />
          <div className="flex shrink-0 overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }} role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className="px-2 py-1.5 font-mono text-[11px]"
                style={{ background: speed === s ? "#c9963a" : "transparent", color: speed === s ? "#081426" : "#cbb27a" }}
                aria-label={`Playback speed ${s} times`}
                aria-pressed={speed === s}>
                {s}×
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }} role="group" aria-label="Map layer">
            {LAYERS.map((l) => (
              <button key={l.id} onClick={() => setLayer(l.id)} className="px-2 py-1.5 text-[11px] tracking-wide"
                style={{ background: layer === l.id ? "#c9963a" : "transparent", color: layer === l.id ? "#081426" : "#cdbfa5" }}
                title={l.blurb}
                aria-label={`Layer: ${l.name}`}
                aria-pressed={layer === l.id}>
                {l.name.toUpperCase()}
              </button>
            ))}
          </div>
          {panels.length > 1 && (
            <button
              onClick={() => setShowDiff((d) => !d)}
              className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
              style={{
                borderColor: showDiff ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)",
                color: showDiff ? GOLD : "#cbb27a",
                background: showDiff ? "rgba(201,150,58,0.12)" : "transparent",
              }}
              aria-pressed={showDiff}
              aria-label="Highlight countries whose controlling power differs from the first sim"
            >
              ◐ DIFFS vs SIM 1
            </button>
          )}
          <button
            onClick={addPanel}
            disabled={panels.length >= 4}
            className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider disabled:opacity-40"
            style={{ borderColor: "rgba(201,150,58,0.45)", color: GOLD }}
            aria-label={`Add a comparison sim (${panels.length} of 4)`}
          >
            ＋ COMPARE SIM ({panels.length}/4)
          </button>
          <button
            onClick={() => setGuideOpen(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold"
            style={{ borderColor: "rgba(201,150,58,0.45)", color: GOLD }}
            aria-label="How to play — reopen the guide"
          >
            ?
          </button>
        </div>
        <p className="px-1 pt-1.5 text-center text-[11px]" style={{ color: "#5f748c", textShadow: "0 1px 6px rgba(3,10,20,0.9)" }}>
          {atStart ? (
            <span className="font-display text-[13px] tracking-[0.14em]" style={{ color: GOLD }}>PRESS ▶ TO RUN THE CENTURY</span>
          ) : (
            <>{LAYERS.find((l) => l.id === layer)?.blurb} · click any tile or country to inspect it · playback is synchronised across all sims</>
          )}
        </p>
      </div>

      {/* contextual waitlist CTA — earned by playing, never an overlay */}
      {showCta && (
        <div className="mx-auto max-w-[1500px] px-3 pt-3">
          <div className="relative rounded-xl border px-4 py-3.5"
            style={{ background: "linear-gradient(150deg, rgba(23,52,88,0.55), rgba(6,20,38,0.8))", borderColor: "rgba(201,150,58,0.45)", boxShadow: "inset 0 1px 0 rgba(240,192,96,0.15)" }}>
            <button onClick={dismissCta} className="absolute right-2.5 top-2 text-sm leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Dismiss this message">✕</button>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-[230px] flex-1">
                <div className="font-display text-sm tracking-[0.18em]" style={{ color: GOLD }}>LIKED STEERING THE CENTURY?</div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: PARCH }}>
                  In the full GeoStory game you play every turn yourself — every alliance, every shock, every border.
                  Join the Kickstarter waitlist and we&apos;ll email you the day it launches.
                </p>
              </div>
              <div className="w-full min-w-[260px] flex-1 sm:w-auto">
                <WaitlistForm source="geostory-sim" cta="JOIN THE WAITLIST" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* panels */}
      <div className={`mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-3 pb-4 pt-2 ${panels.length > 1 ? "min-[1100px]:grid-cols-2" : ""}`}>
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
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            onRemove={panels.length > 1 ? () => setPanels((ps) => ps.filter((x) => x.id !== p.id)) : undefined}
            onDuplicate={panels.length < 4 ? () => {
              const id = nextId++;
              setPanels((ps) => [...ps, { id, cfg: { ...p.cfg, boosts: { ...p.cfg.boosts }, rivals: p.cfg.rivals?.map((r) => ({ ...r, boosts: { ...r.boosts } })), deck: p.cfg.deck ? { ...p.cfg.deck } : undefined } }]);
            } : undefined}
          />
        ))}
      </div>

      {/* first-visit guide — shown once per browser, reopenable via "?" */}
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="How to play the GeoStory Simulator"
          style={{ background: "rgba(3,10,20,0.72)" }} onClick={closeGuide}>
          <div className="w-full max-w-md rounded-xl border px-5 py-5"
            style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 78%)", borderColor: "rgba(201,150,58,0.5)", boxShadow: "0 24px 70px rgba(0,0,0,0.7), inset 0 1px 0 rgba(240,192,96,0.16)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD_DEEP }}>EMBOOGWAY × STRATATIR</div>
            <h2 className="mt-1 font-serif text-2xl font-bold" style={{ color: CREAM }}>Try this</h2>
            <ol className="mt-4 space-y-3.5">
              {GUIDE_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="font-display text-xl leading-none" style={{ color: GOLD }}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: CREAM }}>
                      <span aria-hidden className="mr-1.5" style={{ color: GOLD }}>{s.icon}</span>
                      {s.title}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed" style={{ color: PARCH }}>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button onClick={closeGuide}
              className="mt-5 w-full rounded px-4 py-2.5 font-display text-base tracking-[0.2em]"
              style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.4)" }}>
              START PLAYING
            </button>
            <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>
              Keys: <span style={{ color: PARCH }}>space</span> play/pause · <span style={{ color: PARCH }}>← →</span> step a year · <span style={{ color: PARCH }}>1–4</span> layers
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
