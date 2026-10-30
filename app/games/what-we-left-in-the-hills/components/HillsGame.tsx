"use client";

/* What We Left in The Hills — the shell around the engine: title screen,
   the stepped first-load tutorial, HUD (nightfall clock, pack, captions),
   mobile controls, end screens. The engine (lib/engine.ts) owns the world;
   this file owns everything a player reads. */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { HillsEngine, TRACES, type HudSnapshot } from "../lib/engine";
import { DIFFICULTIES, PERKS, levelForXp, perkById, xpForProgress, type DifficultyId, type PerkId } from "../lib/progression";

const GUIDE_KEY = "wwlith-guide-v1";
const BEST_KEY = "wwlith-best-v1";
const PROGRESS_KEY = "wwlith-progress-v2";
const SETTINGS_KEY = "wwlith-settings-v1";
const MOON = "#7fe7d2";
const GOLD = "#f0c060";
const CREAM = "#f3ead6";

interface Best {
  best: number;
  escapes: number;
  runs: number;
}
interface Progress {
  banked: number;
  escapes: number;
  runs: number;
  best: number;
  traces: string[];
}
function loadProgress(): Progress {
  const base = loadBest();
  const out: Progress = { banked: 0, escapes: base.escapes, runs: base.runs, best: base.best, traces: [] };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return { ...out, ...(JSON.parse(raw) as Progress) };
  } catch {
    /* ignore */
  }
  return out;
}
interface Settings {
  difficulty: DifficultyId;
  perkId: PerkId | null;
  reducedHallucinations: boolean;
  soundIndicator: boolean;
}
function loadSettings(): Settings {
  const out: Settings = { difficulty: "standard", perkId: null, reducedHallucinations: false, soundIndicator: true };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...out, ...(JSON.parse(raw) as Settings) };
  } catch {
    /* ignore */
  }
  return out;
}
function loadBest(): Best {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) return JSON.parse(raw) as Best;
  } catch {
    /* private mode etc. */
  }
  return { best: 0, escapes: 0, runs: 0 };
}

const STEPS = [
  {
    title: "Get out of the holler",
    body: "You start deep in the hills with a full pack, at the old homestead. The way out is the county road gap at the far end of the valley — follow the dirt path. You have until nightfall: seven minutes on the clock. Move with WASD or the stick; drag to look around.",
  },
  {
    title: "Your pack is loud",
    body: "Everything you carry has weight, and weight is noise. The ring around you is the sound you make — anything inside it comes to look. Walk slow to stay quiet; hustle (SHIFT, or the HUSTLE button) to move fast and loud. Drop the heaviest thing when you need to disappear — you can always pick it back up.",
  },
  {
    title: "The fog works on you",
    body: "Fog rolls in and out of the holler. It hides you — their eyes are short in it — but thick fog slows your steps, churns your noise wider, and shows you shapes that aren't there. When the fog is thick, trust the ring, not your eyes.",
  },
  {
    title: "Listen",
    body: "They make sounds. Louder means closer; left or right in your ears means that way. The line at the top of the screen says what your ears would tell you, so the game plays fair muted — headphones just make it worse, in the good way. Get out with as much as you can carry.",
  },
];

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.ceil(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function HillsGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HillsEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [mounted, setMounted] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideSeen, setGuideSeen] = useState(true);
  const [cinema, setCinema] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [best, setBest] = useState<Best>({ best: 0, escapes: 0, runs: 0 });
  const [progress, setProgress] = useState<Progress>({ banked: 0, escapes: 0, runs: 0, best: 0, traces: [] });
  const [settings, setSettings] = useState<Settings>({ difficulty: "standard", perkId: null, reducedHallucinations: false, soundIndicator: true });
  const [seed, setSeed] = useState("daily");
  const [paused, setPaused] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const recordedOutcome = useRef<object | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new HillsEngine(mountRef.current, (h) => setHud(h));
    engineRef.current = engine;
    setMounted(true);
    const seen = (() => {
      try {
        return !!localStorage.getItem(GUIDE_KEY);
      } catch {
        return true;
      }
    })();
    setGuideSeen(seen);
    if (!seen) {
      setGuideOpen(true);
      setGuideStep(0);
    }
    setBest(loadBest());
    setProgress(loadProgress());
    setSettings(loadSettings());
    const params = new URLSearchParams(window.location.search);
    const paramSeed = params.get("seed");
    setSeed(paramSeed && paramSeed.trim() ? paramSeed.trim() : `daily-${new Date().toLocaleDateString("en-CA")}`);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  /* record each finished run once */
  useEffect(() => {
    if (!hud || hud.phase !== "ended" || !hud.outcome) return;
    if (recordedOutcome.current === hud.outcome) return;
    recordedOutcome.current = hud.outcome;
    setProgress((prev) => {
      const next: Progress = {
        banked: prev.banked + (hud.outcome!.kind === "escaped" ? hud.outcome!.value : 0),
        escapes: prev.escapes + (hud.outcome!.kind === "escaped" ? 1 : 0),
        runs: prev.runs + 1,
        best: Math.max(prev.best, hud.outcome!.value),
        traces: [...new Set([...prev.traces, ...hud.outcome!.tracesFound])],
      };
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setBest((prev) => {
      const next: Best = {
        best: Math.max(prev.best, hud.outcome!.value),
        escapes: prev.escapes + (hud.outcome!.kind === "escaped" ? 1 : 0),
        runs: prev.runs + 1,
      };
      try {
        localStorage.setItem(BEST_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [hud]);

  /* traces found mid-run join the lifetime journal at once */
  useEffect(() => {
    if (!hud || hud.tracesFound.length === 0) return;
    setProgress((prev) => {
      const merged = [...new Set([...prev.traces, ...hud.tracesFound])];
      if (merged.length === prev.traces.length) return prev;
      const next = { ...prev, traces: merged };
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [hud]);

  const xp = xpForProgress(progress.banked, progress.escapes, progress.traces.length);
  const level = levelForXp(xp);
  const chosenPerk = perkById(settings.perkId);
  const effectivePerk: PerkId | null = chosenPerk && level >= chosenPerk.level ? chosenPerk.id : null;

  /* push run setup into the engine whenever it changes on the title */
  useEffect(() => {
    if (!mounted) return;
    engineRef.current?.configureRun({
      seed,
      difficulty: settings.difficulty,
      perkId: effectivePerk,
      reducedHallucinations: settings.reducedHallucinations,
      soundIndicator: settings.soundIndicator,
      knownTraceIds: progress.traces,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, seed, settings.difficulty, effectivePerk, settings.reducedHallucinations, settings.soundIndicator, progress.traces.join(",")]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const markGuideSeen = useCallback(() => {
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      /* ignore */
    }
    setGuideSeen(true);
  }, []);

  const closeGuide = useCallback(() => {
    markGuideSeen();
    setGuideOpen(false);
    setPaused(false);
    engineRef.current?.setPaused(false);
  }, [markGuideSeen]);

  const openGuide = useCallback(() => {
    setGuideStep(0);
    setGuideOpen(true);
    setPaused(true);
    engineRef.current?.setPaused(true);
  }, []);

  const startFromGuide = useCallback(() => {
    markGuideSeen();
    setGuideOpen(false);
    setPaused(false);
    engineRef.current?.setPaused(false);
    engineRef.current?.startRun();
  }, [markGuideSeen]);

  const startRun = useCallback(() => {
    setPaused(false);
    engineRef.current?.setPaused(false);
    engineRef.current?.startRun();
  }, []);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      engineRef.current?.setPaused(next);
      return next;
    });
  }, []);

  /* keyboard: C cinema · Esc closes the guide first, then exits cinema,
     then pauses · P pauses · Space drops · R restarts from an end screen */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyC") {
        setCinema((c) => !c);
      } else if (e.code === "Escape") {
        if (guideOpen) closeGuide();
        else if (cinema) setCinema(false);
        else if (hud?.phase === "playing") togglePause();
      } else if (e.code === "KeyP" && hud?.phase === "playing" && !guideOpen) {
        togglePause();
      } else if (e.code === "Space" && hud?.phase === "playing" && !guideOpen && !paused) {
        e.preventDefault();
        engineRef.current?.dropHeaviest();
      } else if (e.code === "KeyR" && hud?.phase === "ended") {
        startRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeGuide, guideOpen, hud?.phase, cinema, paused, togglePause, startRun]);

  const phase = hud?.phase ?? "idle";
  const heaviest = hud?.carried.find((i) => i.name === hud.heaviestName) ?? null;
  const statusFresh = hud && performance.now() - hud.statusAt < 4500 ? hud.statusLine : "";
  const timeProgress = hud ? 1 - hud.timeLeft / hud.totalTime : 0;

  return (
    <div className="relative h-[100dvh] w-full select-none overflow-hidden bg-[#0b100b] text-[#f3ead6]">
      {/* the world */}
      <div ref={mountRef} className="absolute inset-0 [&_canvas]:block" />

      {/* ── HUD ─────────────────────────────────────────── */}
      <div className={cinema ? "pointer-events-none opacity-0" : "transition-opacity duration-300"}>
        {phase === "playing" && hud && (
          <>
            {/* nightfall clock */}
            <div className="pointer-events-none absolute left-1/2 top-14 flex -translate-x-1/2 flex-col items-center sm:top-16">
              <div
                className="font-display text-4xl tracking-[0.2em] sm:text-5xl"
                style={{ color: hud.timeLeft < 60 ? "#e2703a" : CREAM, textShadow: "0 2px 14px rgba(0,0,0,0.8)" }}
              >
                {fmtTime(hud.timeLeft)}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60">to nightfall</div>
              <div className="mt-2 h-1 w-44 overflow-hidden rounded bg-white/15">
                <div className="h-full" style={{ width: `${timeProgress * 100}%`, background: "linear-gradient(90deg,#f0c060,#e2703a)" }} />
              </div>
              {hud.fogThick && (
                <div className="mt-2 rounded-full border border-white/20 bg-black/45 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  Fog is thick — it slows you, and it lies
                </div>
              )}
              <div className="mt-2 rounded-full border border-white/15 bg-black/40 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: MOON }}>
                {hud.zoneLine}
              </div>
              {hud.routeEventLine && (
                <div className="mt-2 max-w-xs rounded-full border border-[#f0c060]/40 bg-black/45 px-3 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                  Trailwise: {hud.routeEventLine}
                </div>
              )}
              {paused && (
                <div className="mt-3 rounded-full border border-white/30 bg-black/70 px-4 py-1 font-display text-sm tracking-[0.3em] text-white">
                  PAUSED — ESC OR P TO RESUME
                </div>
              )}
            </div>

            {/* the caption: what your ears would tell you */}
            {hud.caption && (
              <div className="pointer-events-none absolute left-1/2 top-[12.6rem] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 px-4 sm:top-[11.6rem]">
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/50 text-sm"
                  style={{ color: "#e88a75", transform: `rotate(${hud.captionBearingDeg ?? 0}deg)` }}
                  aria-hidden
                >
                  ↑
                </span>
                <span className="rounded-full bg-black/50 px-3 py-1 text-center font-serif text-sm italic text-[#efe6cf]">
                  {hud.caption}
                </span>
              </div>
            )}
            {settings.soundIndicator && hud.soundLevel > 0.04 && hud.soundBearingDeg !== null && (
              <div
                aria-hidden
                className="pointer-events-none absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1"
                style={{
                  [hud.soundBearingDeg >= 0 ? "right" : "left"]: 6,
                  opacity: 0.25 + hud.soundLevel * 0.75,
                } as CSSProperties}
              >
                <span
                  className="font-display text-2xl"
                  style={{ color: hud.monsterState === "chasing" ? "#e2703a" : "#e88a75", transform: `scale(${0.8 + hud.soundLevel * 0.7})` }}
                >
                  {hud.soundBearingDeg >= 0 ? "▶" : "◀"}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/70">sound</span>
              </div>
            )}
            {hud.latestTrace && performance.now() - hud.latestTrace.at < 6000 && (
              <div className="pointer-events-none absolute left-1/2 top-[18.3rem] w-full max-w-md -translate-x-1/2 px-4 text-center sm:top-[17.3rem]">
                <span className="rounded-lg border px-3 py-2 font-serif text-sm italic" style={{ borderColor: "rgba(240,192,96,0.5)", background: "rgba(20,16,6,0.78)", color: GOLD }}>
                  Trace — {hud.latestTrace.title}: {hud.latestTrace.short}
                </span>
              </div>
            )}
            {statusFresh && (
              <div className="pointer-events-none absolute left-1/2 top-[16.1rem] w-full max-w-md -translate-x-1/2 px-4 text-center sm:top-[14.9rem]">
                <span className="rounded bg-black/55 px-3 py-1 text-xs font-semibold tracking-wide" style={{ color: MOON }}>
                  {statusFresh}
                </span>
              </div>
            )}

            {/* help + cinema hints */}
            <div className="absolute right-3 top-14 flex gap-2 sm:top-16">
              <button
                type="button"
                onClick={openGuide}
                aria-label="How to play — reopen the guide"
                className="h-10 w-10 rounded-full border border-white/25 bg-black/50 font-display text-lg text-white/85 hover:bg-black/70"
              >
                ?
              </button>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-[11px] tracking-wide text-white/45 md:block">
              WASD move · SHIFT hustle · SPACE drop heaviest · drag to look · C cinema
            </div>
          </>
        )}

        {/* pack: desktop panel */}
        {phase === "playing" && hud && (
          <aside className="absolute right-3 top-28 hidden max-h-[calc(100dvh-9rem)] w-80 overflow-y-auto rounded-xl border border-white/12 bg-black/55 p-4 backdrop-blur-sm sm:block">
            <PackList
              hud={hud}
              onDropItem={(uid) => engineRef.current?.dropItem(uid)}
              onWrap={(uid) => engineRef.current?.wrapItem(uid)}
              onPlayFiddle={() => engineRef.current?.playFiddle()}
              onToggleLantern={() => engineRef.current?.toggleLantern()}
              onClearTree={() => engineRef.current?.clearFallenTree()}
            />
            <DropButton hud={hud} heaviest={heaviest} onDrop={() => engineRef.current?.dropHeaviest()} />
          </aside>
        )}

        {/* mobile controls */}
        {phase === "playing" && hud && (
          <div className="sm:hidden">
            <div className="pointer-events-none absolute bottom-5 right-3 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setPackOpen(true)}
                className="pointer-events-auto h-12 rounded-full border border-white/25 bg-black/60 px-4 text-xs font-bold tracking-wider text-white/90"
              >
                PACK · {hud.carried.length} · ${hud.carriedValue} · {hud.carriedWeight} KG
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.toggleHustle()}
                className={`pointer-events-auto h-14 rounded-full border px-5 font-display text-base tracking-widest ${hud.gait === "hustle" ? "border-[#e2703a] bg-[#e2703a]/25 text-[#ffb98a]" : "border-white/25 bg-black/60 text-white/85"}`}
              >
                {hud.gait === "hustle" ? "HUSTLING — FAST, LOUD" : "HUSTLE"}
              </button>
              <button
                type="button"
                disabled={!heaviest}
                onClick={() => engineRef.current?.dropHeaviest()}
                className="pointer-events-auto h-14 max-w-[16rem] rounded-full border px-4 text-left font-display text-sm tracking-wide disabled:opacity-40"
                style={{ borderColor: MOON, background: "rgba(10,30,28,0.72)", color: MOON }}
              >
                {heaviest ? `DROP ${heaviest.name.toUpperCase()} −$${heaviest.value}/−${heaviest.weightKg}KG` : "PACK EMPTY"}
              </button>
            </div>
            {/* the stick renders AFTER the button stack so where the two
                overlap at 375px, the stick wins the touch */}
            <Joystick onMove={(x, y) => engineRef.current?.setJoystick(x, y)} />
            {packOpen && (
              <div className="fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-[#101410]/97 p-4 pb-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display tracking-[0.25em] text-white/80">YOUR PACK</span>
                  <button type="button" onClick={() => setPackOpen(false)} className="h-10 w-10 rounded-full border border-white/25 text-lg" aria-label="Close pack">
                    ✕
                  </button>
                </div>
                <PackList
                  hud={hud}
                  onDropItem={(uid) => engineRef.current?.dropItem(uid)}
                  onWrap={(uid) => engineRef.current?.wrapItem(uid)}
                  onPlayFiddle={() => engineRef.current?.playFiddle()}
                  onToggleLantern={() => engineRef.current?.toggleLantern()}
                  onClearTree={() => engineRef.current?.clearFallenTree()}
                />
                <DropButton hud={hud} heaviest={heaviest} onDrop={() => engineRef.current?.dropHeaviest()} />
              </div>
            )}
          </div>
        )}
      </div>
      {cinema && <div className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-white/25" aria-hidden />}

      {/* ── title screen ─────────────────────────────────── */}
      {mounted && phase === "idle" && !guideOpen && (
        <div className="absolute inset-0 flex flex-col items-center justify-end overflow-y-auto bg-gradient-to-t from-black/70 via-transparent to-black/30 pb-8 pt-16 sm:justify-center sm:pb-0">
          <div className="px-4 text-center sm:px-6">
            <div className="mb-2 font-display text-xs tracking-[0.4em]" style={{ color: MOON }}>
              AN APPALACHIAN ESCAPE
            </div>
            <h1 className="font-serif text-5xl font-black leading-[0.95] sm:text-7xl" style={{ textShadow: "0 4px 30px rgba(0,0,0,0.85)" }}>
              What We Left
              <br />
              in The Hills
            </h1>
            <p className="mx-auto mt-4 max-w-md font-serif text-base italic leading-relaxed text-[#e8dcc3]">
              You came out of the holler carrying everything you could. The hills would like it back.
              Get to the county road before nightfall — and listen.
            </p>
            <button
              type="button"
              onClick={startRun}
              className="mt-7 min-h-[56px] rounded-full px-10 font-display text-xl tracking-[0.2em] text-[#0b100b] transition-transform hover:scale-[1.03]"
              style={{ background: MOON }}
            >
              START THE RUN
            </button>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/65">
              <button type="button" onClick={openGuide} className="underline underline-offset-4 hover:text-white">
                How to play
              </button>
              {best.runs > 0 && (
                <span>
                  Best haul ${best.best} · {best.escapes} escape{best.escapes === 1 ? "" : "s"} in {best.runs} run{best.runs === 1 ? "" : "s"}
                </span>
              )}
              {!guideSeen && <span className="text-white/45">(the guide opens first time)</span>}
            </div>

            {/* ── run setup: seed, difficulty, one perk, comfort, traces ── */}
            <div className="mx-auto mt-6 max-h-[46dvh] w-[min(94vw,44rem)] overflow-y-auto rounded-2xl border border-white/15 bg-[#0d120d]/92 p-4 text-left shadow-2xl backdrop-blur-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-xs tracking-[0.3em]" style={{ color: MOON }}>RUN SETUP</span>
                <span className="text-xs text-white/65">Seed <strong className="text-white">{seed}</strong> — same seed, same loot layout, route event and tempers</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSettings((prev) => ({ ...prev, difficulty: d.id }))}
                    className="min-h-[48px] rounded-lg border px-2 py-2 text-left"
                    style={{
                      borderColor: settings.difficulty === d.id ? MOON : "rgba(255,255,255,0.18)",
                      background: settings.difficulty === d.id ? "rgba(127,231,210,0.14)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span className="block font-display text-sm tracking-wider">{d.name.toUpperCase()}</span>
                    <span className="block text-[11px] leading-snug text-white/60">{d.effect}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-white/10 pt-3">
                <span className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>PERKS — LEVEL {level} · {xp} XP</span>
                <span className="text-[11px] text-white/55">XP = banked escape value + 100 per escape + 25 per Trace found. Pick one active perk.</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, perkId: null }))}
                  className="min-h-[48px] rounded-lg border px-3 py-2 text-left"
                  style={{ borderColor: settings.perkId === null ? MOON : "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="block text-sm font-semibold">No perk</span>
                  <span className="block text-[11px] text-white/60">Walk the hills as you are.</span>
                </button>
                {PERKS.map((perk) => {
                  const unlocked = level >= perk.level;
                  const selected = effectivePerk === perk.id;
                  return (
                    <button
                      key={perk.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => setSettings((prev) => ({ ...prev, perkId: perk.id }))}
                      className="min-h-[48px] rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45"
                      style={{
                        borderColor: selected ? GOLD : "rgba(255,255,255,0.18)",
                        background: selected ? "rgba(240,192,96,0.13)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <span className="block text-sm font-semibold">
                        {perk.name} <span className="text-[11px] font-normal text-white/50">· Level {perk.level}{unlocked ? "" : " — locked"}</span>
                      </span>
                      <span className="block text-[11px] leading-snug text-white/60">{perk.effect}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, soundIndicator: !prev.soundIndicator }))}
                  className="min-h-[48px] rounded-lg border border-white/18 px-3 py-2 text-left"
                  aria-pressed={settings.soundIndicator}
                >
                  <span className="block text-sm font-semibold">Visual sound indicator: {settings.soundIndicator ? "ON" : "OFF"}</span>
                  <span className="block text-[11px] text-white/60">An edge arrow swells with the loudest growl. Captions stay either way.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, reducedHallucinations: !prev.reducedHallucinations }))}
                  className="min-h-[48px] rounded-lg border border-white/18 px-3 py-2 text-left"
                  aria-pressed={settings.reducedHallucinations}
                >
                  <span className="block text-sm font-semibold">Reduced hallucinations: {settings.reducedHallucinations ? "ON" : "OFF"}</span>
                  <span className="block text-[11px] text-white/60">Phantoms and false growls come much less often in thick fog.</span>
                </button>
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => setJournalOpen((o) => !o)}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-lg border border-white/18 px-3 py-2 text-left"
                  aria-expanded={journalOpen}
                >
                  <span className="font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>TRACES — WHAT THE HILLS REMEMBER</span>
                  <span className="text-xs text-white/65">{progress.traces.length} of {TRACES.length} found {journalOpen ? "▲" : "▼"}</span>
                </button>
                {journalOpen && (
                  <div className="mt-2 space-y-3">
                    {TRACES.map((t) => {
                      const found = progress.traces.includes(t.id);
                      return (
                        <article key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <h3 className="font-serif text-base font-bold" style={{ color: found ? CREAM : "rgba(255,255,255,0.4)" }}>
                            {found ? t.title : "An unfound trace"}
                          </h3>
                          {found ? (
                            <p className="mt-1 text-sm leading-relaxed text-[#e8dcc3]">{t.text}</p>
                          ) : (
                            <p className="mt-1 text-sm italic text-white/40">Somewhere in the holler. Walk over it to learn who it belonged to.</p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── tutorial ─────────────────────────────────────── */}
      {guideOpen && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 p-4 pb-8 sm:items-center sm:pb-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#101410]/97 p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-display text-xs tracking-[0.3em]" style={{ color: MOON }}>
                HOW TO PLAY · {guideStep + 1} OF {STEPS.length}
              </span>
              <button type="button" onClick={closeGuide} aria-label="Skip the guide" className="text-xs font-semibold tracking-widest text-white/60 hover:text-white">
                SKIP ✕
              </button>
            </div>
            <div className="mb-4 flex gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className="h-1.5 flex-1 rounded" style={{ background: i <= guideStep ? MOON : "rgba(255,255,255,0.15)" }} />
              ))}
            </div>
            <h2 className="font-serif text-3xl font-bold">{STEPS[guideStep].title}</h2>
            <p className="mt-3 leading-relaxed text-[#e8dcc3]">{STEPS[guideStep].body}</p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={guideStep === 0}
                onClick={() => setGuideStep((s) => Math.max(0, s - 1))}
                className="min-h-[48px] rounded-full border border-white/25 px-5 font-display tracking-widest text-white/80 disabled:opacity-30"
              >
                BACK
              </button>
              {guideStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setGuideStep((s) => s + 1)}
                  className="min-h-[48px] rounded-full px-7 font-display tracking-widest text-[#0b100b]"
                  style={{ background: MOON }}
                >
                  NEXT
                </button>
              ) : phase === "playing" ? (
                <button
                  type="button"
                  onClick={closeGuide}
                  className="min-h-[48px] rounded-full px-7 font-display tracking-widest text-[#0b100b]"
                  style={{ background: MOON }}
                >
                  BACK TO THE RUN
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startFromGuide}
                  className="min-h-[48px] rounded-full px-7 font-display tracking-widest text-[#0b100b]"
                  style={{ background: MOON }}
                >
                  START THE RUN
                </button>
              )}
            </div>
            <p className="mt-4 text-center text-[11px] text-white/40">Reopen this anytime with the ? button. One idea at a time — skip whenever you&apos;re ready.</p>
          </div>
        </div>
      )}

      {/* ── end screen ───────────────────────────────────── */}
      {phase === "ended" && hud?.outcome && (
        <EndScreen hud={hud} best={best} totalTraces={progress.traces.length} onAgain={startRun} onTitle={() => engineRef.current?.backToTitle()} />
      )}
    </div>
  );
}

/* ── pack panel contents ─────────────────────────────────────────── */
function PackList({
  hud,
  onDropItem,
  onWrap,
  onPlayFiddle,
  onToggleLantern,
  onClearTree,
}: {
  hud: HudSnapshot;
  onDropItem: (uid: number) => void;
  onWrap: (uid: number) => void;
  onPlayFiddle: () => void;
  onToggleLantern: () => void;
  onClearTree: () => void;
}) {
  const quiltCarried = hud.carried.some((i) => i.id === "quilt");
  const actionBtn = "min-h-[48px] rounded-lg border px-3 py-2 text-left text-xs leading-snug disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display tracking-[0.25em] text-white/80">YOUR PACK</span>
        <span className="text-xs text-white/60">
          ${hud.carriedValue} · {hud.carriedWeight} KG
        </span>
      </div>
      {hud.carried.length === 0 && <p className="text-sm italic text-white/55">Empty. You travel light and quiet now.</p>}
      <ul className="space-y-2">
        {hud.carried.map((i) => (
          <li key={i.uid} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#efe6cf]">
                {i.name}
                {i.wrapped && <span className="ml-2 rounded-full border border-[#f0c060]/50 px-2 py-0.5 text-[10px] font-bold tracking-wider" style={{ color: GOLD }}>WRAPPED — HALF NOISE</span>}
              </span>
              <span className="shrink-0 text-xs text-white/60">
                ${i.value} · {i.weightKg} kg
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">{i.quirk}</p>
            <p className="mt-0.5 text-[11px] italic text-white/40">Gathered from the {i.origin} — this run’s seeded layout.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {i.id === "coins" && (
                <button type="button" onClick={() => onDropItem(i.uid)} className={actionBtn} style={{ borderColor: MOON, color: MOON }}>
                  DROP THE JAR — if you are chased, the coins burst as a decoy where they land
                </button>
              )}
              {i.id === "fiddle" && (
                <button type="button" onClick={onPlayFiddle} className={actionBtn} style={{ borderColor: MOON, color: MOON }}>
                  PLAY THE FIDDLE HERE — leave it sounding for 8 seconds to draw them off
                </button>
              )}
              {i.id === "lantern" && (
                <button type="button" onClick={onToggleLantern} className={actionBtn} style={{ borderColor: GOLD, color: GOLD }}>
                  {hud.lanternLit ? "SNUFF THE LANTERN — darker, but their sight shortens again" : "CARRY THE LANTERN LIT — fog tricks stop, but their sight reaches farther"}
                </button>
              )}
              {i.id === "tools" && hud.fallenTreeActive && (
                <button type="button" onClick={onClearTree} disabled={!hud.nearFallenTree} className={actionBtn} style={{ borderColor: MOON, color: MOON }}>
                  {hud.nearFallenTree ? "CLEAR THE FALLEN TREE — open the ridge shortcut with the iron tools" : "CLEAR THE FALLEN TREE — get to the tree on the ridge shortcut first"}
                </button>
              )}
              {quiltCarried && i.id !== "quilt" && (
                <button type="button" onClick={() => onWrap(i.uid)} className={actionBtn} style={{ borderColor: "rgba(240,192,96,0.6)", color: GOLD }}>
                  {i.wrapped ? `UNWRAP THE ${i.name.toUpperCase()} — it makes its full noise again` : `WRAP THE ${i.name.toUpperCase()} IN THE QUILT — halve the noise it makes`}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-white/50">
        {hud.noiseRadius > 0 ? (
          <>Weight slows you and widens the ring of noise around you (now ≈ {(hud.noiseRadius * 2).toFixed(1)} m across).</>
        ) : (
          <>Weight slows you and widens the ring of noise around you — but standing still you are silent: no ring, no noise.</>
        )}{" "}
        Dropped things stay where they fall — walk over them to pick them back up.
      </p>
    </div>
  );
}

function DropButton({ hud, heaviest, onDrop }: { hud: HudSnapshot; heaviest: { name: string; value: number; weightKg: number } | null; onDrop: () => void }) {
  return (
    <button
      type="button"
      disabled={!heaviest}
      onClick={onDrop}
      className="mt-3 min-h-[52px] w-full rounded-xl border px-4 py-2 text-left disabled:opacity-40"
      style={{ borderColor: MOON, background: "rgba(10,30,28,0.6)" }}
    >
      {heaviest ? (
        <>
          <span className="block font-display text-base tracking-wider" style={{ color: MOON }}>
            DROP THE {heaviest.name.toUpperCase()}
          </span>
          <span className="block text-xs text-white/70">
            Lose ${heaviest.value} if you don&apos;t come back for it · shed {heaviest.weightKg} kg · smaller noise ring · {hud.carried.length - 1} items left
          </span>
        </>
      ) : (
        <span className="font-display text-base tracking-wider text-white/60">PACK EMPTY — NOTHING TO DROP</span>
      )}
    </button>
  );
}

/* ── virtual joystick ────────────────────────────────────────────── */
function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const zone = zoneRef.current;
      const knob = knobRef.current;
      if (!zone || !knob) return;
      const r = zone.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (clientX - cx) / (r.width / 2);
      let dy = (clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      onMove(dx, -dy);
    },
    [onMove]
  );

  const end = useCallback(() => {
    active.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    onMove(0, 0);
  }, [onMove]);

  return (
    <div
      ref={zoneRef}
      className="absolute bottom-5 left-4 h-32 w-32 touch-none rounded-full border border-white/20 bg-black/35"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current === e.pointerId) update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (active.current === e.pointerId) end();
      }}
      onPointerCancel={end}
      aria-label="Move"
      role="application"
    >
      <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border border-white/35 bg-white/15" />
    </div>
  );
}

/* ── end screen ──────────────────────────────────────────────────── */
function EndScreen({ hud, best, totalTraces, onAgain, onTitle }: { hud: HudSnapshot; best: Best; totalTraces: number; onAgain: () => void; onTitle: () => void }) {
  const o = hud.outcome!;
  const droppedOnly = o.leftBehind.filter((l) => !o.carried.some((c) => c.name === l.name));
  const mins = Math.floor(o.secondsUsed / 60);
  const secs = (o.secondsUsed % 60).toString().padStart(2, "0");
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#101410]/97 p-6 shadow-2xl sm:p-8">
        {o.kind === "escaped" ? (
          <>
            <div className="font-display text-xs tracking-[0.35em]" style={{ color: MOON }}>
              THE COUNTY ROAD · {mins}:{secs}
            </div>
            <h2 className="mt-1 font-serif text-4xl font-black">You made it out.</h2>
            <p className="mt-2 leading-relaxed text-[#e8dcc3]">
              Asphalt under your feet and the holler going quiet behind you. You carried out{" "}
              <strong style={{ color: GOLD }}>${o.value}</strong> worth of the hills.
            </p>
          </>
        ) : o.kind === "caught" ? (
          <>
            <div className="font-display text-xs tracking-[0.35em] text-[#e2703a]">THE HOLLER · {mins}:{secs}</div>
            <h2 className="mt-1 font-serif text-4xl font-black">The hills keep you.</h2>
            <p className="mt-2 leading-relaxed text-[#e8dcc3]">
              It was never really about the loot. It was about the noise you made carrying it.
            </p>
          </>
        ) : (
          <>
            <div className="font-display text-xs tracking-[0.35em] text-[#e2703a]">NIGHTFALL · {mins}:{secs}</div>
            <h2 className="mt-1 font-serif text-4xl font-black">Dark came down.</h2>
            <p className="mt-2 leading-relaxed text-[#e8dcc3]">
              Whatever walks the holler after dark walks it with you now. The road was right there.
            </p>
          </>
        )}

        {o.carried.length > 0 && (
          <div className="mt-5">
            <div className="mb-1 font-display text-xs tracking-[0.3em] text-white/60">
              {o.kind === "escaped" ? "CARRIED OUT" : "STILL ON YOUR BACK WHEN IT ENDED"}
            </div>
            <ul className="space-y-1 text-sm">
              {o.carried.map((i) => (
                <li key={i.name} className="flex justify-between gap-3">
                  <span>{i.name}</span>
                  <span className="text-white/55">
                    ${i.value} · {i.weightKg} kg
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1 font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>
            WHAT YOU LEFT IN THE HILLS
          </div>
          {(o.kind === "escaped" ? o.leftBehind : droppedOnly).length === 0 ? (
            <p className="text-sm italic text-white/55">Nothing. Every last piece came out with you.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(o.kind === "escaped" ? o.leftBehind : droppedOnly).map((i) => (
                <li key={i.name} className="flex justify-between gap-3 text-white/80">
                  <span>{i.name}</span>
                  <span className="text-white/50">
                    ${i.value} · {i.weightKg} kg
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {o.kind === "escaped" && o.exitUsed && (
          <p className="mt-4 text-sm" style={{ color: MOON }}>
            Out by the {o.exitUsed}.
          </p>
        )}
        {o.kind === "caught" && o.gaveAway && (
          <div className="mt-5 rounded-lg border border-[#e2703a]/40 bg-[#e2703a]/10 p-3">
            <div className="font-display text-xs tracking-[0.3em] text-[#ffb98a]">WHAT GAVE YOU AWAY</div>
            <p className="mt-1 text-sm leading-relaxed text-[#f3e2d2]">{o.gaveAway}</p>
          </div>
        )}
        {o.kind !== "caught" && (
          <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.04] p-3">
            <div className="font-display text-xs tracking-[0.3em] text-white/60">YOUR LOUDEST MOMENT</div>
            <p className="mt-1 text-sm leading-relaxed text-[#e8dcc3]">{o.loudestMoment}</p>
          </div>
        )}
        <div className="mt-5">
          <div className="mb-1 font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>
            WHAT THE HILLS REMEMBER — {totalTraces} OF {TRACES.length}
          </div>
          {o.tracesFound.length === 0 ? (
            <p className="text-sm italic text-white/55">No new traces this run. Their stories are still out there.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {o.tracesFound.map((id) => {
                const t = TRACES.find((x) => x.id === id);
                return t ? (
                  <li key={id}>
                    <span className="text-[#efe6cf]">{t.title}</span> <span className="text-white/50">— {t.short}</span>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 border-t border-white/10 pt-3 text-xs text-white/55">
          Best haul ${best.best} · {best.escapes} escape{best.escapes === 1 ? "" : "s"} in {best.runs} run{best.runs === 1 ? "" : "s"} (this device) · Press R to run again
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onAgain}
            className="min-h-[52px] flex-1 rounded-full px-6 font-display text-lg tracking-[0.2em] text-[#0b100b]"
            style={{ background: MOON }}
          >
            RUN AGAIN
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="min-h-[52px] rounded-full border border-white/25 px-6 font-display text-lg tracking-[0.2em] text-white/85"
          >
            TITLE
          </button>
        </div>
      </div>
    </div>
  );
}
