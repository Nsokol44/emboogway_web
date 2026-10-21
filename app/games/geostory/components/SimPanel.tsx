"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, START_YEAR, fmtGdp, fmtPop } from "../lib/data";
import { runSimulation, ZERO_BOOSTS, type Boosts, type SimConfig, type SimEvent } from "../lib/engine";
import { SCENARIOS, getScenario, powerColor, type LayerId } from "../lib/scenarios";
import WorldMap from "./WorldMap";

const KIND_STYLE: Record<SimEvent["kind"], string> = {
  annex: "#e5484d",
  shock: "#f0c060",
  overtake: "#5aa9fa",
  breakaway: "#2ec4a6",
  focus: "#7acc6a",
  crisis: "#c084fc",
};

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => `${((i / (series.length - 1)) * 100).toFixed(1)},${(26 - ((v - min) / span) * 24).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function SliderRow({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-20 shrink-0 tracking-wide" style={{ color: "#9ab890" }}>{label}</span>
      <input
        type="range" min="0" max="100" value={draft}
        onChange={(e) => setDraft(parseInt(e.target.value))}
        onPointerUp={() => onCommit(draft)}
        onKeyUp={() => onCommit(draft)}
        onBlur={() => onCommit(draft)}
        className="min-w-0 flex-1 accent-[#7acc6a]"
      />
      <span className="w-8 shrink-0 text-right font-mono" style={{ color: "#f0c060" }}>{draft}</span>
    </label>
  );
}

interface Props {
  cfg: SimConfig;
  onCfg: (cfg: SimConfig) => void;
  yearFloat: number;
  layer: LayerId;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  uid: string;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

export default function SimPanel({ cfg, onCfg, yearFloat, layer, selectedIdx, onSelect, uid, onRemove, onDuplicate }: Props) {
  const result = useMemo(() => runSimulation(cfg), [cfg]);
  const [seedDraft, setSeedDraft] = useState(cfg.seed);
  useEffect(() => setSeedDraft(cfg.seed), [cfg.seed]);
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const calYear = START_YEAR + yearIdx;
  const leaders = result.leaders[yearIdx];
  const feed = result.events.filter((e) => e.year <= calYear).slice(-9).reverse();
  const scenario = getScenario(cfg.scenarioId);
  const focusIdx = cfg.focusCode ? COUNTRIES.findIndex((c) => c.code === cfg.focusCode) : -1;

  const sel = selectedIdx !== null ? result.years[yearIdx][selectedIdx] : null;
  const sel0 = selectedIdx !== null ? result.years[0][selectedIdx] : null;
  const selGeo = selectedIdx !== null ? COUNTRIES[selectedIdx] : null;
  const selRank = sel ? (sel.bloc > 0 ? 1 + result.years[yearIdx].filter((s) => s.bloc > sel.bloc).length : null) : null;
  const selSeries = useMemo(() => {
    if (selectedIdx === null) return [];
    return result.years.map((y) => { const s = y[selectedIdx]; return s.bloc > 0 ? s.bloc : s.pow; });
  }, [result, selectedIdx]);

  const setBoost = (key: keyof Boosts) => (v: number) => onCfg({ ...cfg, boosts: { ...cfg.boosts, [key]: v } });

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border"
      style={{ background: "linear-gradient(160deg, #171208 0%, #100c07 70%)", borderColor: "rgba(201,150,58,0.28)", boxShadow: "0 18px 50px rgba(0,0,0,0.5)" }}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
        <select
          value={cfg.scenarioId}
          onChange={(e) => onCfg({ ...cfg, scenarioId: e.target.value })}
          className="max-w-full rounded-md border px-2 py-1.5 font-display text-sm tracking-wider"
          style={{ background: "#0f0b06", color: "#f0c060", borderColor: "rgba(201,150,58,0.4)" }}
          aria-label="Scenario"
        >
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="hidden text-xs italic sm:inline" style={{ color: "#9ab890" }}>{scenario.tagline}</span>
        <span className="ml-auto flex items-center gap-2">
          {onDuplicate && <button onClick={onDuplicate} className="rounded border px-2 py-1 text-[11px] tracking-wide hover:opacity-80" style={{ borderColor: "rgba(201,150,58,0.35)", color: "#cbb27a" }}>DUPLICATE</button>}
          {onRemove && <button onClick={onRemove} className="rounded border px-2 py-1 text-[11px] tracking-wide hover:opacity-80" style={{ borderColor: "rgba(196,62,28,0.5)", color: "#e88" }}>REMOVE</button>}
        </span>
      </div>
      <p className="px-4 pt-1 text-[11px] leading-snug" style={{ color: "#77875f" }}>{scenario.desc}</p>

      {/* seed row */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2">
        <label className="text-[11px] tracking-widest" style={{ color: "#9ab890" }}>SEED</label>
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onCfg({ ...cfg, seed: seedDraft }); }}
          className="w-32 min-w-0 rounded border px-2 py-1 font-mono text-xs"
          style={{ background: "#0f0b06", color: "#f7f0e3", borderColor: "rgba(201,150,58,0.3)" }}
          aria-label="Random seed"
        />
        <button onClick={() => onCfg({ ...cfg, seed: seedDraft })} className="rounded px-2 py-1 text-[11px] font-semibold tracking-wide" style={{ background: "#2d5a27", color: "#eaf5e4" }}>RUN</button>
        <span className="text-[11px]" style={{ color: "#77875f" }}>same seed + settings = same history</span>
      </div>

      {/* map */}
      <div className="px-2 pt-2">
        <WorldMap result={result} yearFloat={yearFloat} layer={layer} selectedIdx={selectedIdx} onSelect={onSelect} uid={uid} />
      </div>

      {/* leaderboard + feed */}
      <div className="grid grid-cols-1 gap-3 px-4 pt-1 sm:grid-cols-2">
        <div>
          <div className="mb-1 font-display text-xs tracking-widest" style={{ color: "#f0c060" }}>TOP POWERS — {calYear}</div>
          <ol className="space-y-0.5">
            {leaders.map((l, i) => {
              const gi = COUNTRIES.findIndex((c) => c.code === l.code);
              return (
                <li key={l.code}>
                  <button onClick={() => onSelect(gi)} className="flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-xs hover:bg-white/5" style={{ color: "#e8dcc8" }}>
                    <span className="w-4 font-mono" style={{ color: "#9ab890" }}>{i + 1}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: powerColor(l.code) }} />
                    <span className="truncate">{COUNTRIES[gi].name}</span>
                    <span className="ml-auto font-mono" style={{ color: "#f0c060" }}>{l.power.toFixed(0)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <div className="mb-1 font-display text-xs tracking-widest" style={{ color: "#f0c060" }}>CHRONICLE</div>
          <ul className="space-y-1">
            {feed.length === 0 && <li className="text-xs" style={{ color: "#77875f" }}>The world holds its breath… press play.</li>}
            {feed.map((e, i) => (
              <li key={`${e.year}-${i}`} className="flex gap-2 text-[11px] leading-snug" style={{ color: "#cdbfa5" }}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_STYLE[e.kind] }} />
                <span><strong style={{ color: "#f0c060" }}>{e.year}</strong> — {e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* inspector */}
      {sel && selGeo && sel0 && (
        <div className="mx-4 mt-3 rounded-xl border px-3 py-2.5" style={{ background: "rgba(45,90,39,0.10)", borderColor: "rgba(122,204,106,0.3)" }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-display text-lg tracking-wide" style={{ color: "#f7f0e3" }}>{selGeo.name.toUpperCase()}</span>
            <span className="text-[11px]" style={{ color: "#9ab890" }}>
              {sel.c === selectedIdx ? (selRank ? `World rank #${selRank}` : "Sovereign") : <>Controlled by <strong style={{ color: powerColor(COUNTRIES[sel.c].code) }}>{COUNTRIES[sel.c].name}</strong></>}
              {" · "}influence: <strong style={{ color: powerColor(COUNTRIES[sel.i].code) }}>{COUNTRIES[sel.i].name}</strong>
              {" · "}market: <strong style={{ color: powerColor(COUNTRIES[sel.e].code) }}>{COUNTRIES[sel.e].name}</strong>
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              ["GDP", fmtGdp(sel.gdp), `${sel.gdp >= sel0.gdp ? "+" : ""}${Math.round(((sel.gdp - sel0.gdp) / Math.max(sel0.gdp, 0.001)) * 100)}%`],
              ["POP", fmtPop(sel.pop), `${sel.pop >= sel0.pop ? "+" : ""}${Math.round(((sel.pop - sel0.pop) / Math.max(sel0.pop, 0.05)) * 100)}%`],
              ["TECH", sel.tech.toFixed(0), `${sel.tech >= sel0.tech ? "+" : ""}${(sel.tech - sel0.tech).toFixed(0)} pts`],
              ["MILITARY", `$${sel.mil.toFixed(0)}B`, ""],
              ["STABILITY", `${Math.round(sel.stab * 100)}%`, ""],
              ["POWER", (sel.bloc > 0 ? sel.bloc : sel.pow).toFixed(0), ""],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-md px-1 py-1" style={{ background: "rgba(15,11,6,0.55)" }}>
                <div className="text-[9px] tracking-widest" style={{ color: "#9ab890" }}>{k}</div>
                <div className="font-mono text-sm" style={{ color: "#f7f0e3" }}>{v}</div>
                {d && <div className="font-mono text-[10px]" style={{ color: d.startsWith("+") ? "#7acc6a" : "#e88" }}>{d}</div>}
              </div>
            ))}
          </div>
          <div className="mt-1.5">
            <div className="text-[9px] tracking-widest" style={{ color: "#9ab890" }}>POWER TRAJECTORY 2026–2100</div>
            <Sparkline series={selSeries} color={powerColor(selGeo.code)} />
          </div>
          {focusIdx !== selectedIdx && (
            <button
              onClick={() => onCfg({ ...cfg, focusCode: selGeo.code, boosts: cfg.boosts === ZERO_BOOSTS ? { growth: 55, tech: 60, military: 50, resources: 45 } : cfg.boosts })}
              className="mt-2 rounded px-2.5 py-1.5 text-[11px] font-semibold tracking-wide"
              style={{ background: "#c9963a", color: "#0f0b06" }}
            >
              ⚑ BOOST {selGeo.name.toUpperCase()} IN THIS SIM
            </button>
          )}
        </div>
      )}

      {/* focus / boosts */}
      <div className="px-4 pb-4 pt-3">
        {focusIdx >= 0 ? (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(201,150,58,0.3)", background: "rgba(201,150,58,0.06)" }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-display text-xs tracking-widest" style={{ color: "#f0c060" }}>RISING POWER: {COUNTRIES[focusIdx].name.toUpperCase()}</span>
              <button onClick={() => onCfg({ ...cfg, focusCode: undefined, boosts: ZERO_BOOSTS })} className="ml-auto text-[11px] underline" style={{ color: "#9ab890" }}>clear</button>
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
              <SliderRow label="Growth" value={cfg.boosts.growth} onCommit={setBoost("growth")} />
              <SliderRow label="Technology" value={cfg.boosts.tech} onCommit={setBoost("tech")} />
              <SliderRow label="Military" value={cfg.boosts.military} onCommit={setBoost("military")} />
              <SliderRow label="Resources" value={cfg.boosts.resources} onCommit={setBoost("resources")} />
            </div>
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: "#77875f" }}>
            {cfg.scenarioId === "rise"
              ? "Click any country on the map, then hit “Boost” to start its rise."
              : "Tip: click a country to inspect it — then boost it to rewrite its century."}
          </p>
        )}
      </div>
    </section>
  );
}
