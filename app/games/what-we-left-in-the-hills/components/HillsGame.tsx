"use client";

/* What We Left in The Hills — the shell around the engine: title screen,
   the stepped first-load tutorial, HUD (nightfall clock, pack, captions),
   mobile controls, end screens. The engine (lib/engine.ts) owns the world;
   this file owns everything a player reads. */

import { useCallback, useEffect, useRef, useState } from "react";
import { HillsEngine, type HudSnapshot } from "../lib/engine";

const GUIDE_KEY = "wwlith-guide-v1";
const BEST_KEY = "wwlith-best-v1";
const MOON = "#7fe7d2";
const GOLD = "#f0c060";
const CREAM = "#f3ead6";

interface Best {
  best: number;
  escapes: number;
  runs: number;
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
    engineRef.current?.setPaused(false);
  }, [markGuideSeen]);

  const openGuide = useCallback(() => {
    setGuideStep(0);
    setGuideOpen(true);
    engineRef.current?.setPaused(true);
  }, []);

  const startFromGuide = useCallback(() => {
    markGuideSeen();
    setGuideOpen(false);
    engineRef.current?.setPaused(false);
    engineRef.current?.startRun();
  }, [markGuideSeen]);

  const startRun = useCallback(() => {
    engineRef.current?.startRun();
  }, []);

  /* keyboard: C = cinema, Esc = close guide / exit cinema, Space = drop */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyC") {
        setCinema((c) => !c);
      } else if (e.code === "Escape") {
        if (guideOpen) closeGuide();
        else setCinema(false);
      } else if (e.code === "Space" && hud?.phase === "playing" && !guideOpen) {
        e.preventDefault();
        engineRef.current?.dropHeaviest();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeGuide, guideOpen, hud?.phase]);

  const phase = hud?.phase ?? "idle";
  const heaviest = hud?.carried.find((i) => i.name === hud.heaviestName) ?? null;
  const statusFresh = hud && performance.now() - hud.statusAt < 4500 ? hud.statusLine : "";
  const progress = hud ? 1 - hud.timeLeft / hud.totalTime : 0;

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
                <div className="h-full" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg,#f0c060,#e2703a)" }} />
              </div>
              {hud.fogThick && (
                <div className="mt-2 rounded-full border border-white/20 bg-black/45 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  Fog is thick — it slows you, and it lies
                </div>
              )}
            </div>

            {/* the caption: what your ears would tell you */}
            {hud.caption && (
              <div className="pointer-events-none absolute left-1/2 top-[8.7rem] flex w-full max-w-md -translate-x-1/2 items-center justify-center gap-2 px-4 sm:top-40">
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
            {statusFresh && (
              <div className="pointer-events-none absolute left-1/2 top-[11.5rem] w-full max-w-md -translate-x-1/2 px-4 text-center sm:top-[12.5rem]">
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
          <aside className="absolute right-3 top-28 hidden w-72 rounded-xl border border-white/12 bg-black/55 p-4 backdrop-blur-sm sm:block">
            <PackList hud={hud} />
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
                <PackList hud={hud} />
                <DropButton hud={hud} heaviest={heaviest} onDrop={() => engineRef.current?.dropHeaviest()} />
              </div>
            )}
          </div>
        )}
      </div>
      {cinema && <div className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-white/25" aria-hidden />}

      {/* ── title screen ─────────────────────────────────── */}
      {mounted && phase === "idle" && !guideOpen && (
        <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/70 via-transparent to-black/30 pb-14 sm:justify-center sm:pb-0">
          <div className="px-6 text-center">
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
        <EndScreen hud={hud} best={best} onAgain={startRun} onTitle={() => engineRef.current?.backToTitle()} />
      )}
    </div>
  );
}

/* ── pack panel contents ─────────────────────────────────────────── */
function PackList({ hud }: { hud: HudSnapshot }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display tracking-[0.25em] text-white/80">YOUR PACK</span>
        <span className="text-xs text-white/60">
          ${hud.carriedValue} · {hud.carriedWeight} KG
        </span>
      </div>
      {hud.carried.length === 0 && <p className="text-sm italic text-white/55">Empty. You travel light and quiet now.</p>}
      <ul className="space-y-1.5">
        {hud.carried.map((i) => (
          <li key={i.uid} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-[#efe6cf]">{i.name}</span>
            <span className="shrink-0 text-xs text-white/60">
              ${i.value} · {i.weightKg} kg
            </span>
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
function EndScreen({ hud, best, onAgain, onTitle }: { hud: HudSnapshot; best: Best; onAgain: () => void; onTitle: () => void }) {
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

        <div className="mt-5 border-t border-white/10 pt-3 text-xs text-white/55">
          Best haul ${best.best} · {best.escapes} escape{best.escapes === 1 ? "" : "s"} in {best.runs} run{best.runs === 1 ? "" : "s"} (this device)
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
