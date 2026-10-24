"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaitlistForm from "@/components/WaitlistForm";
import { CODE_IDX, END_YEAR, START_YEAR } from "../lib/data";
import { ZERO_BOOSTS, runSimulation, type SimConfig } from "../lib/engine";
import { LAYERS, type LayerId } from "../lib/scenarios";
import { decodeRun } from "../lib/share";
import SimPanel from "./SimPanel";

const SPEEDS = [0.5, 1, 2, 4];
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
  { icon: "▶", title: "Watch the century", text: "Press play — 175 countries, 75 years, one deterministic history. Same seed, same century, every time." },
  { icon: "⚑", title: "Spend influence at turning points", text: "Each decade, and after big shocks, the run pauses. Bend one thing: a research drive, a trade realignment, a hardened strait." },
  { icon: "🔗", title: "Share your run", text: "The export kit carries a challenge link — anyone who opens it replays your exact century, interventions included." },
];

/** P1c — the model, on one card. Short on purpose. */
const MODEL_SECTIONS: { head: string; body: string }[] = [
  { head: "RECEPTIVITY", body: "Influence lands where a country is open to it. A power's pull on a neighbour is its bloc power × the neighbour's receptivity ÷ distance — open, unstable places drift first; closed, stable ones barely move." },
  { head: "MARKET GRAVITY", body: "Trade follows the biggest nearby economy. Market dominance usually arrives years before political influence does — the takeover before the takeover." },
  { head: "CHOKEPOINTS & SHOCKS", body: "A handful of straits carry the world's energy and goods. Close one and importers stall while rival exporters cash in. Droughts, finds, breakthroughs and crises reshuffle the same way: relative power, suddenly repriced." },
  { head: "THE TERRITORY RULE", body: "Borders move last, and rarely. A flip needs sustained influence from one power, a wide power gap, a shared border and deep local instability, held for years. Most of history is orbits and markets, not annexations." },
  { head: "YOUR INFLUENCE", body: "You hold 6 influence points. At each decade — and after major shocks — you may spend them on one lever: research, realignment, a hardened strait, a crisis, a stability compact. Small nudges, honestly priced." },
];

export default function SimulatorApp() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [yearFloat, setYearFloat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [layer, setLayer] = useState<LayerId>("territory");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(CODE_IDX.get("USA") ?? 0);
  const [showDiff, setShowDiff] = useState(false);
  const [terrainArt, setTerrainArt] = useState(true);
  const [weatherOn, setWeatherOn] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [challenge, setChallenge] = useState(false);
  /* the full-screen stage shows ONE panel at a time — the bottom deck's
     switcher picks which; the rest stay mounted (state intact) but hidden */
  const [activeId, setActiveId] = useState(1);
  const challengeRef = useRef(false);
  const [engaged, setEngaged] = useState(false);
  const [ctaGone, setCtaGone] = useState(true); // revealed by effect only pre-engagement checks pass
  const rafRef = useRef<number | null>(null);
  const saveArmedRef = useRef(false);
  const displayArmedRef = useRef(false);

  /* full deterministic histories, computed here so panels can be diffed */
  const results = useMemo(() => panels.map((p) => runSimulation(p.cfg)), [panels]);

  /* ---- persistence: restore the visitor's panels, then keep them saved.
     A challenge link (?run=…) wins over saved panels — and while one is
     loaded, the visitor's own saved panels are left untouched. */
  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get("run");
      const linked = param ? decodeRun(param) : null;
      if (linked) {
        challengeRef.current = true;
        setChallenge(true);
        setPanels([{ id: 1, cfg: linked }]);
        nextId = 2;
      } else {
        const raw = localStorage.getItem(LS_PANELS);
        if (raw) {
          const arr: unknown = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length >= 1 && arr.length <= 4 && arr.every(validCfg)) {
            setPanels(arr.map((cfg, i) => ({ id: i + 1, cfg: cfg as SimConfig })));
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
    } catch { /* private mode etc. — the defaults are fine */ }
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
  const pausePlayback = useCallback(() => setPlaying(false), []);
  const togglePlay = () => {
    if (yearFloat >= MAX_YEAR_IDX) setYearFloat(0);
    setPlaying((p) => !p);
  };

  /* ---- keyboard: space play/pause, arrows step a year, 1–5 layers,
         Esc closes the guide / model overlays (the sheet has its own) ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "Escape") {
        setModelOpen(false);
        setGuideOpen(false);
        return;
      }
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
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
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
  const activePanel = panels.find((p) => p.id === activeId) ?? panels[0];

  /* shared transport, handed to the active panel's bottom deck */
  const transport = {
    playing,
    onTogglePlay: togglePlay,
    onReset: () => { setPlaying(false); setYearFloat(0); },
    year,
    yearFloat,
    maxYearIdx: MAX_YEAR_IDX,
    onScrub: (v: number) => { setPlaying(false); setYearFloat(v); },
    speed,
    onSpeed: setSpeed,
    speeds: SPEEDS,
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
      {/* ══ THE STAGE — the whole screen is the world map. Every panel
          stays mounted (its state intact); only the active one shows.
          The bottom deck — transport strip + tabbed sheet — is rendered
          by the active panel, docked over the map's lower edge. ══ */}
      <section className="relative w-full overflow-hidden" style={{ height: "100dvh", background: "radial-gradient(ellipse at 50% 42%, #0d2f52 0%, #081f38 55%, #040f1e 100%)" }} aria-label="GeoStory Simulator">
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
            playing={playing}
            onPauseRequest={pausePlayback}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            active={p.id === activePanel.id}
            transport={transport}
            panelSwitcher={panelSwitcher}
            challengeChip={challengeChip}
            onRemove={panels.length > 1 ? () => removePanel(p.id) : undefined}
            onDuplicate={panels.length < 4 ? () => duplicatePanel(p) : undefined}
          />
        ))}

        {/* first-run hint — floats over the map, gone once the century moves.
            PORTRAIT: the map zone is pinned under the header and the hint
            moves to the top of the UI zone below it (48px header clearance +
            the map's exact height, 100vw × 520/960, + an 8px gap) */}
        {atStart && (
          <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-3 max-sm:top-[calc(54.1667vw_+_56px)]">
            <span className="rounded-full border px-3.5 py-1.5 font-display text-[13px] tracking-[0.16em]"
              style={{ background: "rgba(4,16,30,0.78)", borderColor: "rgba(240,192,96,0.5)", color: GOLD, backdropFilter: "blur(6px)" }}>
              PRESS ▶ TO RUN THE CENTURY
            </span>
          </div>
        )}

        {/* contextual waitlist CTA — earned by playing; floats top-center
            under the header overlay, dismissible, never covers mid-map.
            PORTRAIT: same UI-zone-top anchor as the hint (it may overlay the
            UI zone, never the map; the deck out-ranks it at z-30, so an open
            sheet or Turning Point still wins the space) */}
        {showCta && (
          <div className="absolute inset-x-0 top-14 z-20 flex justify-center px-3 max-sm:top-[calc(54.1667vw_+_56px)]">
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
              Keys: <span style={{ color: PARCH }}>space</span> play/pause · <span style={{ color: PARCH }}>← →</span> step a year · <span style={{ color: PARCH }}>1–5</span> layers
            </p>
          </div>
        </div>
      )}

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
