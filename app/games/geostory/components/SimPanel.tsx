"use client";

import { useEffect, useMemo, useState } from "react";
import { CODE_IDX, COUNTRIES, START_YEAR, fmtGdp, fmtPop } from "../lib/data";
import { DEFAULT_DECK, ZERO_BOOSTS, type Boosts, type DeckControls, type SimConfig, type SimEvent, type SimResult } from "../lib/engine";
import { SCENARIOS, getScenario, powerColor, type LayerId } from "../lib/scenarios";
import ExportPanel from "./ExportPanel";
import MapLegend from "./MapLegend";
import WorldMap, { type Framing } from "./WorldMap";
import { copyText } from "./exportKit";

/* aged-atlas event colours — muted enamel, no neon */
const KIND_STYLE: Record<SimEvent["kind"], string> = {
  annex: "#d1603d",
  shock: "#e0b34e",
  overtake: "#6fa8cf",
  breakaway: "#5fb3a1",
  focus: "#a8c256",
  crisis: "#a58fd0",
};

const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MUTED = "#93a7bd";
const FAINT = "#5f748c";
const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";
const PANEL_BORDER = "rgba(201,150,58,0.30)";

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
      <span className="w-20 shrink-0 tracking-wide" style={{ color: PARCH }}>{label}</span>
      <input
        type="range" min="0" max="100" value={draft}
        onChange={(e) => setDraft(parseInt(e.target.value))}
        onPointerUp={() => onCommit(draft)}
        onKeyUp={() => onCommit(draft)}
        onBlur={() => onCommit(draft)}
        className="gs-range min-w-0 flex-1"
      />
      <span className="w-8 shrink-0 text-right font-mono" style={{ color: GOLD }}>{draft}</span>
    </label>
  );
}

function ChaosSlider({ chaos, onCommit }: { chaos: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(Math.round(chaos * 100));
  useEffect(() => setDraft(Math.round(chaos * 100)), [chaos]);
  return (
    <label className="mt-3 flex items-center gap-3 text-xs">
      <span className="w-20 shrink-0 tracking-wide" style={{ color: PARCH }}>Chaos</span>
      <input
        type="range" min="0" max="200" step="5" value={draft}
        onChange={(e) => setDraft(parseInt(e.target.value))}
        onPointerUp={() => onCommit(draft / 100)}
        onKeyUp={() => onCommit(draft / 100)}
        onBlur={() => onCommit(draft / 100)}
        className="gs-range min-w-0 flex-1"
        aria-label="Chaos — shock frequency"
      />
      <span className="w-10 shrink-0 text-right font-mono" style={{ color: GOLD }}>×{(draft / 100).toFixed(2).replace(/0$/, "")}</span>
    </label>
  );
}

function SectionHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="font-display text-xs tracking-[0.18em]" style={{ color: GOLD }}>{children}</span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,150,58,0.45), rgba(201,150,58,0.05))" }} />
      {right}
    </div>
  );
}

function BoostSliders({ boosts, onSet }: { boosts: Boosts; onSet: (key: keyof Boosts) => (v: number) => void }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
      <SliderRow label="Growth" value={boosts.growth} onCommit={onSet("growth")} />
      <SliderRow label="Technology" value={boosts.tech} onCommit={onSet("tech")} />
      <SliderRow label="Military" value={boosts.military} onCommit={onSet("military")} />
      <SliderRow label="Resources" value={boosts.resources} onCommit={onSet("resources")} />
    </div>
  );
}

interface Props {
  cfg: SimConfig;
  onCfg: (cfg: SimConfig) => void;
  /** the panel's full deterministic history, computed by SimulatorApp so
      compare mode can diff panels against each other */
  result: SimResult;
  /** reference run for the divergence overlay (the first panel), if enabled */
  diffResult?: SimResult | null;
  yearFloat: number;
  layer: LayerId;
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  uid: string;
  onRemove?: () => void;
  onDuplicate?: () => void;
}

export default function SimPanel({ cfg, onCfg, result, diffResult = null, yearFloat, layer, selectedIdx, onSelect, uid, onRemove, onDuplicate }: Props) {
  const [seedDraft, setSeedDraft] = useState(cfg.seed);
  const [seedCopied, setSeedCopied] = useState(false);
  useEffect(() => setSeedDraft(cfg.seed), [cfg.seed]);
  const yearIdx = Math.max(0, Math.min(result.years.length - 1, Math.floor(yearFloat)));
  const calYear = START_YEAR + yearIdx;
  const leaders = result.leaders[yearIdx];
  const scenario = getScenario(cfg.scenarioId);
  const focusIdx = cfg.focusCode ? COUNTRIES.findIndex((c) => c.code === cfg.focusCode) : -1;
  const rivals = cfg.rivals ?? [];
  const deck: DeckControls = cfg.deck ?? DEFAULT_DECK;

  /* place framing: region view follows the scenario protagonist (or the
     player's focus), full world is one tap away */
  const [framing, setFraming] = useState<Framing>(scenario.focus ? "region" : "world");
  const [frameOverride, setFrameOverride] = useState<number | null>(null);
  const [regionOnly, setRegionOnly] = useState<boolean>(!!scenario.focus);
  const [deckOpen, setDeckOpen] = useState<boolean>(cfg.scenarioId === "sandbox");
  useEffect(() => {
    const sc = getScenario(cfg.scenarioId);
    setFraming(sc.focus ? "region" : "world");
    setRegionOnly(!!sc.focus);
    setFrameOverride(null);
  }, [cfg.scenarioId]);
  const frameIdx = frameOverride ?? (focusIdx >= 0 ? focusIdx : selectedIdx);

  /* chronicle: region mode keeps events naming the protagonist, a
     neighbour, or a rival — toggle shows the whole world's diary */
  const watchedNames = useMemo(() => {
    const names = new Set<string>();
    if (focusIdx >= 0) {
      names.add(COUNTRIES[focusIdx].name);
      for (const code of COUNTRIES[focusIdx].adj) {
        const j = CODE_IDX.get(code);
        if (j !== undefined) names.add(COUNTRIES[j].name);
      }
    }
    for (const r of rivals) {
      const j = CODE_IDX.get(r.code);
      if (j !== undefined) names.add(COUNTRIES[j].name);
    }
    return names;
  }, [focusIdx, rivals]);
  const feedAll = result.events.filter((e) => e.year <= calYear);
  const feedRegional = watchedNames.size
    ? feedAll.filter((e) => { for (const n of watchedNames) if (e.text.includes(n)) return true; return false; })
    : [];
  const feed = (regionOnly && feedRegional.length > 0 ? feedRegional : feedAll).slice(-9).reverse();

  const sel = selectedIdx !== null ? result.years[yearIdx][selectedIdx] : null;
  const sel0 = selectedIdx !== null ? result.years[0][selectedIdx] : null;
  const selGeo = selectedIdx !== null ? COUNTRIES[selectedIdx] : null;
  const selRank = sel ? (sel.bloc > 0 ? 1 + result.years[yearIdx].filter((s) => s.bloc > sel.bloc).length : null) : null;
  const selSeries = useMemo(() => {
    if (selectedIdx === null) return [];
    return result.years.map((y) => { const s = y[selectedIdx]; return s.bloc > 0 ? s.bloc : s.pow; });
  }, [result, selectedIdx]);

  const setBoost = (key: keyof Boosts) => (v: number) => onCfg({ ...cfg, boosts: { ...cfg.boosts, [key]: v } });
  const setRivalBoost = (code: string) => (key: keyof Boosts) => (v: number) =>
    onCfg({ ...cfg, rivals: rivals.map((r) => (r.code === code ? { ...r, boosts: { ...r.boosts, [key]: v } } : r)) });
  const setDeck = (patch: Partial<DeckControls>) => onCfg({ ...cfg, deck: { ...deck, ...patch } });
  const onScenario = (id: string) => {
    const sc = getScenario(id);
    onCfg({ ...cfg, scenarioId: id, focusCode: sc.focus, boosts: ZERO_BOOSTS });
  };

  const selIsFocus = selGeo !== null && focusIdx === selectedIdx;
  const selIsRival = selGeo !== null && rivals.some((r) => r.code === selGeo.code);
  const deckSummary = `${[deck.chokepoints && "straits", deck.climate && "climate", deck.pandemics && "plague", deck.rushes && "rushes"].filter(Boolean).length}/4 decks · chaos ×${deck.chaos.toFixed(1)}`;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border"
      style={{ background: "linear-gradient(165deg, #0b2138 0%, #06182c 72%)", borderColor: PANEL_BORDER, boxShadow: "0 18px 50px rgba(0,0,0,0.55)" }}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5">
        <select
          value={cfg.scenarioId}
          onChange={(e) => onScenario(e.target.value)}
          className="max-w-full rounded-md border px-2 py-1.5 font-display text-sm tracking-wider"
          style={{ background: "#04101e", color: GOLD, borderColor: "rgba(201,150,58,0.45)" }}
          aria-label="Scenario"
        >
          {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {scenario.place && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] tracking-[0.14em]"
            style={{ borderColor: "rgba(240,192,96,0.5)", color: GOLD, background: "rgba(201,150,58,0.10)" }}>
            ◉ {scenario.place}
          </span>
        )}
        <span className="hidden font-serif text-xs italic lg:inline" style={{ color: MUTED }}>{scenario.tagline}</span>
        <span className="ml-auto flex items-center gap-2">
          {onDuplicate && <button onClick={onDuplicate} className="rounded border px-2 py-1 text-[11px] tracking-wide hover:opacity-80" style={{ borderColor: "rgba(201,150,58,0.35)", color: "#cbb27a" }}>DUPLICATE</button>}
          {onRemove && <button onClick={onRemove} className="rounded border px-2 py-1 text-[11px] tracking-wide hover:opacity-80" style={{ borderColor: "rgba(209,96,61,0.45)", color: "#e09a83" }}>REMOVE</button>}
        </span>
      </div>
      <p className="px-4 pt-1.5 text-[11px] leading-snug" style={{ color: FAINT }}>{scenario.desc}</p>

      {/* seed row */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2.5">
        <label className="text-[11px] tracking-[0.18em]" style={{ color: MUTED }}>SEED</label>
        <input
          value={seedDraft}
          onChange={(e) => setSeedDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onCfg({ ...cfg, seed: seedDraft }); }}
          className="w-32 min-w-0 rounded border px-2 py-1 font-mono text-xs"
          style={{ background: "#04101e", color: CREAM, borderColor: "rgba(201,150,58,0.3)" }}
          aria-label="Random seed"
        />
        <button onClick={() => onCfg({ ...cfg, seed: seedDraft })} className="rounded px-2.5 py-1 text-[11px] font-bold tracking-wider" style={{ background: GOLD_DEEP, color: "#081426" }}>RUN</button>
        <button
          onClick={async () => { if (await copyText(cfg.seed)) { setSeedCopied(true); setTimeout(() => setSeedCopied(false), 1600); } }}
          className="rounded border px-2 py-1 text-[11px] tracking-wide hover:opacity-80"
          style={{ borderColor: "rgba(201,150,58,0.35)", color: "#cbb27a" }}
          aria-label={`Copy seed ${cfg.seed} to the clipboard`}
        >
          {seedCopied ? "✓ COPIED" : "⧉ COPY SEED"}
        </button>
        <span className="text-[11px]" style={{ color: FAINT }}>same seed + settings = same history</span>
      </div>

      {/* map + framing toggle */}
      <div className="relative px-2 pt-2">
        <WorldMap result={result} yearFloat={yearFloat} layer={layer} selectedIdx={selectedIdx} onSelect={onSelect} uid={uid} framing={framing} frameIdx={frameIdx} diffResult={diffResult} />
        <MapLegend layer={layer} />
        <button
          onClick={() => setFraming(framing === "region" ? "world" : "region")}
          className="absolute left-3.5 top-3.5 rounded border px-2 py-1 text-[10px] font-semibold tracking-[0.14em] backdrop-blur-sm"
          style={{ background: "rgba(4,16,30,0.82)", borderColor: "rgba(240,192,96,0.5)", color: GOLD }}
          aria-label={framing === "region" ? "Zoom back to the full world" : "Frame the region"}
        >
          {framing === "region" ? "🌐 FULL WORLD" : `◎ FRAME ${scenario.place ?? "REGION"}`}
        </button>
      </div>

      {/* leaderboard + chronicle */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 px-4 pt-2 sm:grid-cols-2">
        <div>
          <SectionHead>TOP POWERS — {calYear}</SectionHead>
          <ol className="space-y-0.5">
            {leaders.map((l, i) => {
              const gi = COUNTRIES.findIndex((c) => c.code === l.code);
              return (
                <li key={l.code}>
                  <button onClick={() => onSelect(gi)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-[3px] text-left text-xs hover:bg-white/5"
                    style={{
                      color: CREAM,
                      background: i === 0 ? "rgba(201,150,58,0.10)" : undefined,
                      borderLeft: i === 0 ? "2px solid #f0c060" : "2px solid transparent",
                    }}>
                    <span className="w-5 shrink-0 font-display text-sm" style={{ color: i === 0 ? GOLD : MUTED }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: powerColor(l.code) }} />
                    <span className="truncate">{COUNTRIES[gi].name}</span>
                    <span className="ml-auto font-mono" style={{ color: GOLD }}>{l.power.toFixed(0)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <SectionHead right={watchedNames.size > 0 ? (
            <button onClick={() => setRegionOnly(!regionOnly)} className="rounded border px-1.5 py-0.5 text-[9px] tracking-[0.14em]"
              style={{ borderColor: "rgba(201,150,58,0.4)", color: regionOnly ? GOLD : MUTED }}
              title="Toggle between region events and all events">
              {regionOnly ? "◉ REGION" : "○ ALL EVENTS"}
            </button>
          ) : undefined}>
            CHRONICLE
          </SectionHead>
          <ul className="space-y-1.5">
            {feed.length === 0 && <li className="text-xs" style={{ color: FAINT }}>The world holds its breath… press play.</li>}
            {feed.map((e, i) => (
              <li key={`${e.year}-${i}`} className="flex gap-2 text-[11px] leading-snug" style={{ color: PARCH }}>
                <span className="w-8 shrink-0 font-display text-[13px] leading-none" style={{ color: GOLD }}>{e.year}</span>
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_STYLE[e.kind] }} />
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* inspector — the dossier card */}
      {sel && selGeo && sel0 && (
        <div className="mx-4 mt-3.5 rounded-lg border px-3.5 py-3"
          style={{ background: "linear-gradient(160deg, rgba(23,52,88,0.5), rgba(6,20,38,0.65))", borderColor: "rgba(201,150,58,0.35)", boxShadow: "inset 0 1px 0 rgba(240,192,96,0.15)" }}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-xl font-bold leading-none" style={{ color: CREAM }}>{selGeo.name}</span>
            {sel.c === selectedIdx && selRank !== null && (
              <span className="rounded border px-1.5 py-0.5 font-display text-[11px] tracking-[0.14em]"
                style={{ borderColor: "rgba(240,192,96,0.55)", color: GOLD, background: "rgba(201,150,58,0.10)" }}>
                № {selRank} IN THE WORLD
              </span>
            )}
            <span className="text-[11px]" style={{ color: MUTED }}>
              {sel.c === selectedIdx
                ? (selRank ? "Sovereign power" : "Sovereign")
                : <>Held by <strong style={{ color: powerColor(COUNTRIES[sel.c].code) }}>{COUNTRIES[sel.c].name}</strong></>}
              {" · "}influence: <strong style={{ color: powerColor(COUNTRIES[sel.i].code) }}>{COUNTRIES[sel.i].name}</strong>
              {" · "}market: <strong style={{ color: powerColor(COUNTRIES[sel.e].code) }}>{COUNTRIES[sel.e].name}</strong>
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              ["GDP", fmtGdp(sel.gdp), `${sel.gdp >= sel0.gdp ? "+" : ""}${Math.round(((sel.gdp - sel0.gdp) / Math.max(sel0.gdp, 0.001)) * 100)}%`],
              ["POP", fmtPop(sel.pop), `${sel.pop >= sel0.pop ? "+" : ""}${Math.round(((sel.pop - sel0.pop) / Math.max(sel0.pop, 0.05)) * 100)}%`],
              ["TECH", sel.tech.toFixed(0), `${sel.tech >= sel0.tech ? "+" : ""}${(sel.tech - sel0.tech).toFixed(0)} pts`],
              ["MILITARY", `$${sel.mil.toFixed(0)}B`, ""],
              ["STABILITY", `${Math.round(sel.stab * 100)}%`, ""],
              ["POWER", (sel.bloc > 0 ? sel.bloc : sel.pow).toFixed(0), ""],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded px-1 py-1.5" style={{ background: "rgba(3,12,24,0.6)", border: "1px solid rgba(147,167,189,0.12)" }}>
                <div className="text-[9px] tracking-[0.18em]" style={{ color: MUTED }}>{k}</div>
                <div className="font-display text-lg leading-tight" style={{ color: k === "POWER" ? GOLD : CREAM }}>{v}</div>
                {d && <div className="font-mono text-[10px]" style={{ color: d.startsWith("+") ? "#7fb069" : "#d1603d" }}>{d}</div>}
              </div>
            ))}
          </div>
          <div className="mt-2">
            <div className="text-[9px] tracking-[0.18em]" style={{ color: MUTED }}>POWER TRAJECTORY 2026–2100</div>
            <Sparkline series={selSeries} color={powerColor(selGeo.code)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {!selIsFocus && (
              <button
                onClick={() => onCfg({ ...cfg, focusCode: selGeo.code, boosts: cfg.boosts === ZERO_BOOSTS ? { growth: 55, tech: 60, military: 50, resources: 45 } : cfg.boosts })}
                className="rounded px-2.5 py-1.5 text-[11px] font-bold tracking-wider"
                style={{ background: GOLD_DEEP, color: "#081426" }}
              >
                ⚑ BOOST {selGeo.name.toUpperCase()} IN THIS SIM
              </button>
            )}
            {!selIsFocus && !selIsRival && rivals.length < 2 && focusIdx >= 0 && (
              <button
                onClick={() => onCfg({ ...cfg, rivals: [...rivals, { code: selGeo.code, boosts: { growth: 55, tech: 55, military: 55, resources: 55 } }] })}
                className="rounded border px-2.5 py-1.5 text-[11px] font-semibold tracking-wider"
                style={{ borderColor: "rgba(240,192,96,0.5)", color: GOLD }}
              >
                ⚔ SET AS RIVAL
              </button>
            )}
            {selectedIdx !== frameIdx && (
              <button
                onClick={() => { setFrameOverride(selectedIdx); setFraming("region"); }}
                className="rounded border px-2.5 py-1.5 text-[11px] font-semibold tracking-wider"
                style={{ borderColor: "rgba(147,167,189,0.4)", color: PARCH }}
              >
                ◎ FRAME ON MAP
              </button>
            )}
          </div>
        </div>
      )}

      {/* the hand of history: focus + rivals */}
      <div className="space-y-2.5 px-4 pb-2 pt-3.5">
        {focusIdx >= 0 ? (
          <div className="rounded-lg border px-3.5 py-2.5" style={{ borderColor: "rgba(201,150,58,0.30)", background: "rgba(201,150,58,0.05)" }}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-display text-xs tracking-[0.18em]" style={{ color: GOLD }}>⚑ RISING POWER — {COUNTRIES[focusIdx].name.toUpperCase()}</span>
              <button onClick={() => onCfg({ ...cfg, focusCode: undefined, boosts: ZERO_BOOSTS })} className="ml-auto text-[11px] underline" style={{ color: MUTED }}>clear</button>
            </div>
            <BoostSliders boosts={cfg.boosts} onSet={setBoost} />
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: FAINT }}>
            {cfg.scenarioId === "rise"
              ? "Click any country on the map, then hit “Boost” to start its rise — then set up to two rivals against it."
              : "Tip: click a country to inspect it — then boost it, or set it as a rival to a boosted power."}
          </p>
        )}
        {rivals.map((r) => {
          const gi = CODE_IDX.get(r.code);
          if (gi === undefined) return null;
          return (
            <div key={r.code} className="rounded-lg border px-3.5 py-2.5" style={{ borderColor: "rgba(111,131,184,0.35)", background: "rgba(111,131,184,0.05)" }}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: powerColor(r.code) }} />
                <span className="font-display text-xs tracking-[0.18em]" style={{ color: PARCH }}>⚔ RIVAL — {COUNTRIES[gi].name.toUpperCase()}</span>
                <button onClick={() => onCfg({ ...cfg, rivals: rivals.filter((x) => x.code !== r.code) })} className="ml-auto text-[11px] underline" style={{ color: MUTED }}>remove</button>
              </div>
              <BoostSliders boosts={r.boosts} onSet={setRivalBoost(r.code)} />
            </div>
          );
        })}
      </div>

      {/* shock deck controls */}
      <div className="px-4 pb-4">
        <button onClick={() => setDeckOpen(!deckOpen)} className="flex w-full items-center gap-2 text-left" aria-expanded={deckOpen}>
          <span className="font-display text-xs tracking-[0.18em]" style={{ color: GOLD }}>☰ SHOCK DECK</span>
          <span className="text-[11px]" style={{ color: FAINT }}>{deckSummary}</span>
          <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(201,150,58,0.35), rgba(201,150,58,0.04))" }} />
          <span className="text-xs" style={{ color: MUTED }}>{deckOpen ? "▾" : "▸"}</span>
        </button>
        {deckOpen && (
          <div className="pt-2.5">
            <div className="flex flex-wrap gap-1.5">
              {([
                ["chokepoints", "⛓ Chokepoint closures"],
                ["climate", "🌦 Climate shocks"],
                ["pandemics", "☣ Pandemics"],
                ["rushes", "⛏ Resource rushes"],
              ] as [keyof DeckControls, string][]).map(([key, label]) => {
                const on = deck[key] as boolean;
                return (
                  <button key={key} onClick={() => setDeck({ [key]: !on })}
                    className="rounded-full border px-2.5 py-1 text-[11px] tracking-wide"
                    style={{
                      borderColor: on ? "rgba(240,192,96,0.6)" : "rgba(147,167,189,0.3)",
                      color: on ? GOLD : FAINT,
                      background: on ? "rgba(201,150,58,0.12)" : "transparent",
                    }}>
                    {on ? "●" : "○"} {label}
                  </button>
                );
              })}
            </div>
            <ChaosSlider chaos={deck.chaos} onCommit={(v) => setDeck({ chaos: v })} />
            <p className="pt-1 text-[11px]" style={{ color: FAINT }}>How often the world misbehaves. ×0 silences the random deck entirely (scripted scenario events still fire).</p>
          </div>
        )}
      </div>

      {/* share kit — exports derive from this panel's finished history */}
      <div className="mx-4 mb-4 border-t pt-3" style={{ borderColor: "rgba(201,150,58,0.22)" }}>
        <ExportPanel cfg={cfg} result={result} />
      </div>
    </section>
  );
}
