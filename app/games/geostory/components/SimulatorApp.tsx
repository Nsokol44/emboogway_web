"use client";

import { useEffect, useRef, useState } from "react";
import { CODE_IDX, END_YEAR, START_YEAR } from "../lib/data";
import { ZERO_BOOSTS, type SimConfig } from "../lib/engine";
import { LAYERS, type LayerId } from "../lib/scenarios";
import SimPanel from "./SimPanel";

const SPEEDS = [0.5, 1, 2, 4];
const MAX_YEAR_IDX = END_YEAR - START_YEAR;

let nextId = 3;
const DEFAULT_PANELS: { id: number; cfg: SimConfig }[] = [
  { id: 1, cfg: { scenarioId: "multipolar", seed: "stratatir-1", boosts: ZERO_BOOSTS } },
  { id: 2, cfg: { scenarioId: "chokepoint", seed: "hormuz-7", boosts: ZERO_BOOSTS } },
];

export default function SimulatorApp() {
  const [panels, setPanels] = useState(DEFAULT_PANELS);
  const [yearFloat, setYearFloat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [layer, setLayer] = useState<LayerId>("territory");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(CODE_IDX.get("USA") ?? 0);
  const rafRef = useRef<number | null>(null);

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

  const year = START_YEAR + Math.floor(yearFloat);
  const setCfg = (id: number) => (cfg: SimConfig) => setPanels((ps) => ps.map((p) => (p.id === id ? { ...p, cfg } : p)));
  const addPanel = () => {
    if (panels.length >= 4) return;
    const id = nextId++;
    setPanels((ps) => [...ps, { id, cfg: { scenarioId: "rise", seed: `run-${id}`, boosts: { growth: 55, tech: 60, military: 50, resources: 45 } } }]);
  };

  return (
    <div>
      {/* transport bar */}
      <div className="sticky top-[76px] z-40 mx-auto max-w-[1500px] px-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-3 py-2.5 backdrop-blur-md"
          style={{ background: "rgba(15,11,6,0.88)", borderColor: "rgba(201,150,58,0.35)", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}>
          <button
            onClick={() => { if (yearFloat >= MAX_YEAR_IDX) setYearFloat(0); setPlaying((p) => !p); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg"
            style={{ background: "linear-gradient(135deg,#2d5a27,#4a9a3e)", color: "#eaf5e4", boxShadow: "0 4px 16px rgba(45,90,39,0.5)" }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            onClick={() => { setPlaying(false); setYearFloat(0); }}
            className="shrink-0 rounded-md border px-2 py-1.5 text-[11px] tracking-wider hover:opacity-80"
            style={{ borderColor: "rgba(201,150,58,0.4)", color: "#cbb27a" }}
          >
            ⟲ 2026
          </button>
          <div className="shrink-0 text-center">
            <div className="font-display text-3xl leading-none" style={{ color: "#f0c060" }}>{year}</div>
            <div className="text-[9px] tracking-widest" style={{ color: "#9ab890" }}>YEAR</div>
          </div>
          <input
            type="range" min="0" max={MAX_YEAR_IDX} step="0.05" value={yearFloat}
            onChange={(e) => { setPlaying(false); setYearFloat(parseFloat(e.target.value)); }}
            className="min-w-[120px] flex-1 accent-[#c9963a]"
            aria-label="Year scrubber"
          />
          <div className="flex shrink-0 overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className="px-2 py-1.5 font-mono text-[11px]"
                style={{ background: speed === s ? "#c9963a" : "transparent", color: speed === s ? "#0f0b06" : "#cbb27a" }}>
                {s}×
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap overflow-hidden rounded-md border" style={{ borderColor: "rgba(122,204,106,0.35)" }}>
            {LAYERS.map((l) => (
              <button key={l.id} onClick={() => setLayer(l.id)} className="px-2 py-1.5 text-[11px] tracking-wide"
                style={{ background: layer === l.id ? "#2d5a27" : "transparent", color: layer === l.id ? "#eaf5e4" : "#9ab890" }}
                title={l.blurb}>
                {l.name.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={addPanel}
            disabled={panels.length >= 4}
            className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider disabled:opacity-40"
            style={{ borderColor: "rgba(201,150,58,0.4)", color: "#f0c060" }}
          >
            ＋ COMPARE SIM ({panels.length}/4)
          </button>
        </div>
        <p className="px-1 pt-1.5 text-center text-[11px]" style={{ color: "#77875f" }}>
          {LAYERS.find((l) => l.id === layer)?.blurb} · click any tile or country to inspect it · playback is synchronised across all sims
        </p>
      </div>

      {/* panels */}
      <div className={`mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-3 pb-4 pt-2 ${panels.length > 1 ? "min-[1100px]:grid-cols-2" : ""}`}>
        {panels.map((p) => (
          <SimPanel
            key={p.id}
            uid={`sim-${p.id}`}
            cfg={p.cfg}
            onCfg={setCfg(p.id)}
            yearFloat={yearFloat}
            layer={layer}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            onRemove={panels.length > 1 ? () => setPanels((ps) => ps.filter((x) => x.id !== p.id)) : undefined}
            onDuplicate={panels.length < 4 ? () => { const id = nextId++; setPanels((ps) => [...ps, { id, cfg: { ...p.cfg, boosts: { ...p.cfg.boosts } } }]); } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
