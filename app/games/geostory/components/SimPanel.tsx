"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CODE_IDX, COUNTRIES, START_YEAR, fmtGdp, fmtPop } from "../lib/data";
import {
  CRISIS_REGIONS, DEFAULT_DECK, INFLUENCE_POOL, LEVERS, STRAITS, ZERO_BOOSTS,
  type Boosts, type DeckControls, type Intervention, type LeverId, type SimConfig, type SimEvent, type SimResult,
} from "../lib/engine";
import {
  PACES, eventSiteIdx, isMajorEvent, rankAt, type PaceId,
} from "../lib/idler";
import { LAYERS, SCENARIOS, WORLD_MODIFIERS, getScenario, powerColor, type LayerId } from "../lib/scenarios";
import { FAITHS } from "../lib/religion";
import { WHATIF_TEMPLATES } from "../lib/templates";
import ExportPanel from "./ExportPanel";
import MapLegend from "./MapLegend";
import WorldMap, { type Framing } from "./WorldMap";
import { copyText } from "./exportKit";

/* aged-atlas event colours — muted enamel, no neon. Keyed by string (not
   the engine's kind union) so new event kinds degrade to a dot, never a
   build break; kinds without an entry fall back at the render site. */
const KIND_STYLE: Record<string, string> = {
  annex: "#d1603d",
  shock: "#e0b34e",
  overtake: "#6fa8cf",
  breakaway: "#5fb3a1",
  focus: "#a8c256",
  crisis: "#a58fd0",
  intervention: "#f0c060",
  faith: "#c9a0dc",
};
/** chronicle entries that get the strong treatment */
const MAJOR_KINDS = new Set<SimEvent["kind"]>(["overtake", "annex", "crisis", "intervention"]);

const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MUTED = "#93a7bd";
const FAINT = "#5f748c";
const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";
const PANEL_BORDER = "rgba(201,150,58,0.30)";
/** cyan = the player's claim, app-wide ("cyan = mine"); gold is for
    transient emphasis (selection, hover) and readouts only */
const CLAIM = "#22d3ee";

/* ------------------------------------------------------ notifications */
/** One item in the live inbox. Turning Points carry an actionable
 *  intervention form while "open"; left behind by the playhead they
 *  resolve as "passed" and the item records that. Events are the
 *  century's loudest moments, newest first. The chronicle remains the
 *  permanent record — this is the inbox, and it never pauses the run. */
interface NoteItem {
  id: string;
  kind: "turning" | "event";
  year: number;
  title: string;
  siteIdx: number | null;
  anchor: boolean;
  status: "open" | "passed" | "spent" | "seen";
  winKey?: string;
  bornAt: number;
}

let sharedAudio: AudioContext | null = null;
/** a short, tasteful two-note chime for a fresh notification. Best
 *  effort only — silenced by the strip toggle, and skipped when the
 *  visitor prefers reduced motion (the detectable sensory proxy). */
function chime(enabled: boolean) {
  if (!enabled) return;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    sharedAudio ??= new AudioContext();
    if (sharedAudio.state === "suspended") void sharedAudio.resume();
    const t = sharedAudio.currentTime;
    const osc = sharedAudio.createOscillator();
    const gain = sharedAudio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(987.77, t);
    osc.frequency.setValueAtTime(1318.51, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(gain);
    gain.connect(sharedAudio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch { /* audio is a garnish, never a blocker */ }
}

function Sparkline({ series, color, currentIdx, marks }: { series: number[]; color: string; currentIdx?: number; marks?: number[] }) {
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const X = (i: number) => (i / (series.length - 1)) * 100;
  const Y = (v: number) => 26 - ((v - min) / span) * 24;
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" />
      {(marks ?? []).map((i) => (
        <circle key={i} cx={X(i)} cy={Y(series[i])} r="1.7" fill="#f0c060" stroke="#081426" strokeWidth="0.5" />
      ))}
      {currentIdx !== undefined && currentIdx >= 0 && currentIdx < series.length && (
        <>
          <line x1={X(currentIdx)} y1="1" x2={X(currentIdx)} y2="27" stroke="rgba(247,240,227,0.4)" strokeWidth="0.5" strokeDasharray="1.6 1.6" />
          <circle cx={X(currentIdx)} cy={Y(series[currentIdx])} r="2.1" fill="#f7f0e3" stroke={color} strokeWidth="1" />
        </>
      )}
    </svg>
  );
}

/** local extrema of a power series — the years its story turned */
function inflectionMarks(series: number[]): number[] {
  const out: number[] = [];
  const span = (Math.max(...series) - Math.min(...series)) || 1;
  for (let i = 2; i < series.length - 2; i++) {
    const w = [series[i - 2], series[i - 1], series[i], series[i + 1], series[i + 2]];
    const isMax = series[i] === Math.max(...w) && series[i] - Math.min(series[i - 1], series[i + 1]) > span * 0.03;
    const isMin = series[i] === Math.min(...w) && Math.max(series[i - 1], series[i + 1]) - series[i] > span * 0.03;
    if ((isMax || isMin) && (out.length === 0 || i - out[out.length - 1] > 4)) out.push(i);
  }
  return out.slice(0, 8);
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

/* P1a — the intervention bar: the actionable body of a Turning Point
   notification (each decade, and after major shocks). The run does NOT
   pause for it — the item lives in the notifications inbox until acted
   on or left behind. Spending writes an Intervention into the run
   config, so the altered history reproduces exactly. */
function InterventionBar({ year, pool, spent, options, selectedIdx, onSpend, onDone }: {
  year: number;
  pool: number;
  spent: number;
  options: { idx: number; code: string; name: string }[];
  selectedIdx: number | null;
  onSpend: (inv: Intervention) => void;
  onDone: () => void;
}) {
  const [leverId, setLeverId] = useState<LeverId>("tech");
  const lever = LEVERS.find((l) => l.id === leverId) ?? LEVERS[0];
  const [target, setTarget] = useState<string>(selectedIdx !== null ? COUNTRIES[selectedIdx].code : (options[0]?.code ?? "USA"));
  const [targetB, setTargetB] = useState<string>(options.find((o) => o.code !== target)?.code ?? "CHN");
  const [toward, setToward] = useState(true);
  const [strait, setStrait] = useState("hormuz");
  const [region, setRegion] = useState("sahel");
  useEffect(() => { if (selectedIdx !== null) setTarget(COUNTRIES[selectedIdx].code); }, [selectedIdx]);
  const canAfford = pool >= lever.cost;
  const selectCls = "rounded border px-2 py-1.5 text-xs";
  const selectStyle = { background: "#04101e", color: CREAM, borderColor: "rgba(201,150,58,0.4)" } as const;
  const spend = () => {
    let t = target;
    if (lever.id === "trade") t = `${target}${toward ? ">" : "!"}${targetB}`;
    else if (lever.id === "chokepoint") t = strait;
    else if (lever.id === "crisis") t = region;
    onSpend({ year, lever: lever.id, target: t, cost: lever.cost });
  };
  // the spend button states cost AND effect in plain words, generated
  // from the actual lever + target chosen — no unexplained numbers
  const nameOf = (code: string) => options.find((o) => o.code === code)?.name ?? (CODE_IDX.get(code) !== undefined ? COUNTRIES[CODE_IDX.get(code)!].name : code);
  const effect =
    lever.id === "tech" ? `give ${nameOf(target)} a decade of accelerated research` :
    lever.id === "stability" ? `hold ${nameOf(target)}'s stability up for a decade` :
    lever.id === "trade" ? `tilt ${nameOf(target)}'s trade ${toward ? `toward ${nameOf(targetB)}` : `away from ${nameOf(targetB)}`} for 15 years` :
    lever.id === "chokepoint" ? `harden the ${STRAITS.find((s) => s.id === strait)?.label ?? strait}, so closures bite 65% less for 20 years` :
    `unleash a bounded crisis across ${CRISIS_REGIONS.find((r) => r.key === region)?.label ?? region}`;
  return (
    <div className="rounded-lg border px-3.5 py-3 max-sm:px-3 max-sm:py-2.5" role="group" aria-label={`Intervention window, ${year}`}
      style={{ background: "linear-gradient(160deg, rgba(201,150,58,0.14), rgba(6,20,38,0.7))", borderColor: "rgba(240,192,96,0.65)", boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(240,192,96,0.25)" }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display text-sm tracking-[0.18em] max-sm:text-[13px]" style={{ color: GOLD }}>⚑ TURNING POINT — {year}</span>
        <span className="text-[11px]" style={{ color: PARCH }}>The run keeps turning — act here, or let the moment pass.</span>
        <button onClick={onDone} className="ml-auto rounded border px-2.5 py-1 text-[11px] font-semibold tracking-wider hover:opacity-80"
          style={{ borderColor: "rgba(147,167,189,0.45)", color: PARCH }}>LET IT PASS</button>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[10.5px]" style={{ color: MUTED }}>
        <span>Influence is this run&apos;s steering budget, earned once and spent at moments like this.</span>
        <span className="font-display tracking-[0.1em]" style={{ color: PARCH }}>EARNED {INFLUENCE_POOL} · SPENT {spent} · BALANCE {pool} ⚑</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5 max-sm:mt-2" role="group" aria-label="Choose a lever">
        {LEVERS.map((l) => {
          const on = l.id === leverId;
          const afford = pool >= l.cost;
          return (
            <button key={l.id} onClick={() => setLeverId(l.id)} disabled={!afford}
              className="rounded-full border px-2.5 py-1 text-[11px] tracking-wide disabled:opacity-40"
              style={{
                borderColor: on ? "rgba(240,192,96,0.75)" : "rgba(147,167,189,0.3)",
                color: on ? GOLD : afford ? PARCH : FAINT,
                background: on ? "rgba(201,150,58,0.16)" : "transparent",
              }}
              aria-pressed={on}>
              {l.name} · {l.cost}⚑
            </button>
          );
        })}
      </div>
      <p className="pt-1.5 text-[11px] max-sm:pt-1" style={{ color: MUTED }}>{lever.blurb}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 max-sm:mt-1">
        {(lever.target === "country") && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectCls} style={selectStyle} aria-label="Target country">
            {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        )}
        {lever.target === "trade" && (
          <>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectCls} style={selectStyle} aria-label="Country to realign">
              {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </select>
            <div className="flex overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.4)" }} role="group" aria-label="Direction">
              {([["toward", "→ TOWARD"], ["away", "✕ AWAY FROM"]] as const).map(([dir, label]) => (
                <button key={dir} onClick={() => setToward(dir === "toward")} className="px-2 py-1.5 text-[11px]"
                  style={{ background: (dir === "toward") === toward ? GOLD_DEEP : "transparent", color: (dir === "toward") === toward ? "#081426" : PARCH }}>
                  {label}
                </button>
              ))}
            </div>
            <select value={targetB} onChange={(e) => setTargetB(e.target.value)} className={selectCls} style={selectStyle} aria-label="Power to realign toward or away from">
              {options.filter((o) => o.code !== target).map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </select>
          </>
        )}
        {lever.target === "strait" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a strait">
            {STRAITS.map((s) => (
              <button key={s.id} onClick={() => setStrait(s.id)} className="rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: strait === s.id ? "rgba(240,192,96,0.75)" : "rgba(147,167,189,0.3)", color: strait === s.id ? GOLD : PARCH, background: strait === s.id ? "rgba(201,150,58,0.16)" : "transparent" }}
                aria-pressed={strait === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        {lever.target === "region" && (
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls} style={selectStyle} aria-label="Target region">
            {CRISIS_REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        )}
        <button onClick={spend} disabled={!canAfford}
          className="max-w-full rounded px-3 py-1.5 text-left text-[11px] font-bold leading-snug tracking-wider disabled:opacity-40"
          style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426" }}>
          SPEND {lever.cost} ⚑ — {effect}
        </button>
        {pool === 0 && <span className="text-[11px]" style={{ color: FAINT }}>The pool is spent — this century is on its own now.</span>}
      </div>
    </div>
  );
}

/** the notifications inbox list — shared by the desktop rail and the
 *  mobile NOTES sheet tab. Open Turning Points render their live
 *  intervention form; everything else is a record card (anchor items
 *  in cyan, newest first, list capped upstream). */
function NotesList({ notes, pool, spent, options, selectedIdx, onSpend, onPass, onFocus }: {
  notes: NoteItem[]; pool: number; spent: number;
  options: { idx: number; code: string; name: string }[];
  selectedIdx: number | null;
  onSpend: (note: NoteItem, inv: Intervention) => void;
  onPass: (note: NoteItem) => void;
  onFocus: (idx: number) => void;
}) {
  if (!notes.length) {
    return (
      <p className="px-1 py-2 text-[11px] leading-relaxed" style={{ color: FAINT }}>
        Nothing yet. Turning Points and the century&apos;s loudest moments arrive here — the run never
        pauses for them. Act on a Turning Point while its year is live, or let it pass and the item
        records that it did.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {notes.map((n) => n.kind === "turning" && n.status === "open" ? (
        <li key={n.id}>
          <InterventionBar year={n.year} pool={pool} spent={spent} options={options} selectedIdx={selectedIdx}
            onSpend={(inv) => onSpend(n, inv)} onDone={() => onPass(n)} />
        </li>
      ) : (
        <li key={n.id} className="rounded-lg border px-3 py-2"
          style={{ borderColor: n.anchor ? "rgba(34,211,238,0.55)" : "rgba(147,167,189,0.25)", background: n.anchor ? "rgba(34,211,238,0.07)" : "rgba(6,20,38,0.5)" }}>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[10px] tracking-[0.18em]" style={{ color: n.anchor ? CLAIM : MUTED }}>{n.year}</span>
            {n.anchor && <span className="font-display text-[9px] tracking-[0.14em]" style={{ color: CLAIM }}>⚑ YOUR ANCHOR</span>}
            <span className="ml-auto shrink-0 font-display text-[9px] tracking-[0.14em]" style={{ color: FAINT }}>
              {n.kind === "turning" ? (n.status === "spent" ? "INFLUENCE SPENT" : "LET IT PASS") : "EVENT"}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: n.status === "passed" ? MUTED : PARCH }}>
            {n.title}{n.kind === "turning" && n.status === "passed" ? " — the moment went by unacted." : ""}
          </p>
          {n.siteIdx !== null && (
            <button onClick={() => onFocus(n.siteIdx!)} className="mt-1 text-[10.5px] font-semibold tracking-wide hover:opacity-80"
              style={{ color: n.anchor ? CLAIM : GOLD }} aria-label={`Show ${COUNTRIES[n.siteIdx]?.name} on the map`}>
              ◎ SHOW ON THE MAP
            </button>
          )}
        </li>
      ))}
    </ol>
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

/* transport + shared chrome, owned by SimulatorApp and handed to whichever
   panel is active on the stage — the bottom deck renders from this */
export interface TransportProps {
  playing: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  year: number;
  yearFloat: number;
  maxYearIdx: number;
  onScrub: (v: number) => void;
  pace: PaceId;
  onPace: (p: PaceId) => void;
  layer: LayerId;
  onLayer: (l: LayerId) => void;
  terrainArt: boolean;
  onTerrainArt: () => void;
  weatherOn: boolean;
  onWeather: () => void;
  showDiff: boolean | null;
  onToggleDiff: () => void;
  onModelOpen: () => void;
  onGuideOpen: () => void;
}

/* the Idler (Director layer), owned by SimulatorApp and scoped per panel:
   claimHere is this panel's anchor; a claim living on another sim shows up
   as claimElsewhere so the chip can offer the jump */
export interface IdlerProps {
  claimHere: { code: string; idx: number } | null;
  claimElsewhere: { code: string; name: string; panelNo: number } | null;
  onClaim: (idx: number) => void;
  onReleaseClaim: () => void;
  onOpenPicker: () => void;
  onJumpToClaim: () => void;
  onSuperpower: (idx: number) => void;
  anchorLog: { id: number; year: number; text: string }[];
  cinema: boolean;
  onToggleCinema: () => void;
  autoCam: boolean;
  onToggleAutoCam: () => void;
  holdMajors: boolean;
  onToggleHoldMajors: () => void;
  onHoldRequest: (ms: number) => void;
}

type SheetTab = "powers" | "notes" | "dossier" | "chronicle" | "highlights" | "setup" | "export";

const SHEET_TABS: { id: SheetTab; label: string }[] = [
  { id: "powers", label: "POWERS" },
  { id: "notes", label: "NOTES" },
  { id: "dossier", label: "DOSSIER" },
  { id: "chronicle", label: "CHRONICLE" },
  { id: "highlights", label: "HIGHLIGHTS" },
  { id: "setup", label: "SETUP" },
  { id: "export", label: "EXPORT" },
];

/* short strip labels — full names + blurbs ride on the title tooltips */
const LAYER_SHORT: Record<LayerId, string> = {
  territory: "TERRITORY",
  influence: "INFLUENCE",
  economic: "ECONOMIC",
  tech: "TECH",
  terrain: "TERRAIN",
  religion: "RELIGION",
};

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
  /** display dressing owned by SimulatorApp: terrain plate + weather sky */
  terrainArt?: boolean;
  weather?: boolean;
  /** playback state, owned by SimulatorApp's shared transport */
  playing?: boolean;
  /** retained for API compatibility — notifications no longer pause
      the run, so the panel never calls this */
  onPauseRequest?: () => void;
  /** stage state: only the active panel shows; the deck renders for it */
  active: boolean;
  transport: TransportProps;
  idler: IdlerProps;
  panelSwitcher: ReactNode;
  challengeChip: ReactNode;
}

export default function SimPanel({ cfg, onCfg, result, diffResult = null, yearFloat, layer, selectedIdx, onSelect, uid, onRemove, onDuplicate, terrainArt = true, weather = true, playing = false, onPauseRequest, active, transport: tp, idler, panelSwitcher, challengeChip }: Props) {
  const cinema = idler.cinema;
  const claimIdx = idler.claimHere?.idx ?? null;
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
    if (claimIdx !== null) names.add(COUNTRIES[claimIdx].name);
    for (const r of rivals) {
      const j = CODE_IDX.get(r.code);
      if (j !== undefined) names.add(COUNTRIES[j].name);
    }
    return names;
  }, [focusIdx, rivals, claimIdx]);
  const feedAll = result.events.filter((e) => e.year <= calYear);
  const feedRegional = watchedNames.size
    ? feedAll.filter((e) => { for (const n of watchedNames) if (e.text.includes(n)) return true; return false; })
    : [];
  const feed = (regionOnly && feedRegional.length > 0 ? feedRegional : feedAll).slice(-9).reverse();
  /* the anchor's own chronicle lines (claims, switches, rank movements),
     written by SimulatorApp in the brief's voice — merged into the feed */
  const anchorFeed = claimIdx !== null
    ? idler.anchorLog.filter((a) => a.year <= calYear).map((a) => ({ year: a.year, text: a.text, anchor: true as const, kind: null as SimEvent["kind"] | null }))
    : [];
  const mergedFeed: { year: number; text: string; anchor: boolean; kind: SimEvent["kind"] | null }[] = [
    ...feed.map((e) => ({ year: e.year, text: e.text, anchor: false, kind: e.kind as SimEvent["kind"] | null })),
    ...anchorFeed,
  ].sort((a, b) => b.year - a.year).slice(0, 12);

  /* the claim's standing, for the chip, the standings pin and the dossier */
  const claimRankNow = claimIdx !== null ? rankAt(result, yearIdx, claimIdx) : null;
  const claimRankPrev = claimIdx !== null && yearIdx > 0 ? rankAt(result, yearIdx - 1, claimIdx) : null;
  const claimHolder = claimIdx !== null ? result.years[yearIdx][claimIdx].c : null;
  /* rank movement vs last year — shape AND colour, so it survives colourblindness */
  const claimMove = claimRankNow !== null && claimRankPrev !== null
    ? claimRankNow < claimRankPrev ? { sym: "▲", color: "#7fb069", word: "climbing" }
      : claimRankNow > claimRankPrev ? { sym: "▼", color: "#d1603d", word: "slipping" }
      : { sym: "━", color: MUTED, word: "steady" }
    : null;

  const sel = selectedIdx !== null ? result.years[yearIdx][selectedIdx] : null;
  const sel0 = selectedIdx !== null ? result.years[0][selectedIdx] : null;
  const selGeo = selectedIdx !== null ? COUNTRIES[selectedIdx] : null;
  const selRank = sel ? (sel.bloc > 0 ? 1 + result.years[yearIdx].filter((s) => s.bloc > sel.bloc).length : null) : null;
  const selSeries = useMemo(() => {
    if (selectedIdx === null) return [];
    return result.years.map((y) => { const s = y[selectedIdx]; return s.bloc > 0 ? s.bloc : s.pow; });
  }, [result, selectedIdx]);
  const selMarks = useMemo(() => inflectionMarks(selSeries), [selSeries]);

  /* ---- P2b: risers & fallers over the trailing decade ------------------- */
  const movers = useMemo(() => {
    const back = Math.max(0, yearIdx - 10);
    const rows: { idx: number; delta: number }[] = [];
    for (let i = 0; i < COUNTRIES.length; i++) {
      const n = result.years[yearIdx][i], t = result.years[back][i];
      rows.push({ idx: i, delta: (n.bloc > 0 ? n.bloc : n.pow) - (t.bloc > 0 ? t.bloc : t.pow) });
    }
    rows.sort((a, b) => b.delta - a.delta);
    return {
      since: START_YEAR + back,
      risers: rows.filter((r) => r.delta > 0.5).slice(0, 3),
      fallers: rows.filter((r) => r.delta < -0.5).slice(-3).reverse(),
    };
  }, [result, yearIdx]);

  /* ---- P1a: interventions + the influence pool ------------------------- */
  const interventions = cfg.interventions ?? [];
  const spentTotal = interventions.reduce((s, v) => s + v.cost, 0);
  const poolLeft = Math.max(0, INFLUENCE_POOL - spentTotal);
  const resolvedRef = useRef<Set<string>>(new Set());

  /* ---- notifications: the live inbox (playtest redesign). Turning
     Points and major events arrive as items; the run NEVER pauses for
     them and there is no modal. An open Turning Point the playhead
     leaves behind resolves as "let it pass", recorded on the item.
     The chronicle stays the permanent record; this is the inbox. */
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const notesRef = useRef<NoteItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [railOpen, setRailOpen] = useState(true);
  const [chimeOn, setChimeOn] = useState(() => { try { return localStorage.getItem("gs-chime") !== "off"; } catch { return true; } });
  const [animationsOn, setAnimationsOn] = useState(() => { try { return localStorage.getItem("gs-animations") !== "off"; } catch { return true; } });
  const setNotesBoth = useCallback((next: NoteItem[]) => { notesRef.current = next; setNotes(next); }, []);
  const pushNote = useCallback((n: NoteItem) => {
    const all = [n, ...notesRef.current];
    const open = all.filter((x) => x.kind === "turning" && x.status === "open");
    const rest = all.filter((x) => !(x.kind === "turning" && x.status === "open")).slice(0, Math.max(0, 30 - open.length));
    setNotesBoth([...open, ...rest]);
    setUnread((u) => u + 1);
  }, [setNotesBoth]);
  const markNote = useCallback((id: string, status: NoteItem["status"]) => {
    setNotesBoth(notesRef.current.map((n) => (n.id === id ? { ...n, status } : n)));
  }, [setNotesBoth]);
  const spendNote = useCallback((note: NoteItem, inv: Intervention) => {
    onCfg({ ...cfg, interventions: [...interventions, inv] });
    if (note.winKey) resolvedRef.current.add(note.winKey);
    markNote(note.id, "spent");
  }, [cfg, interventions, onCfg, markNote]);
  const passNote = useCallback((note: NoteItem) => {
    if (note.winKey) resolvedRef.current.add(note.winKey);
    markNote(note.id, "passed");
  }, [markNote]);
  const prevYearRef = useRef(calYear);
  const [banner, setBanner] = useState<{ key: string; text: string } | null>(null);
  const [flowOn, setFlowOn] = useState(false);

  /* BOTTOM DECK — the expanded sheet over the map; null = collapsed strip
     only. Picking a country opens its dossier. Notifications live in
     their own rail/tab and never take the deck over. */
  const [sheetTab, setSheetTab] = useState<SheetTab | null>(null);
  const prevSelRef = useRef<number | null>(selectedIdx);
  useEffect(() => {
    if (selectedIdx !== null && selectedIdx !== prevSelRef.current) {
      setSheetTab("dossier");
    }
    prevSelRef.current = selectedIdx;
  }, [selectedIdx]);
  /* Esc collapses the sheet (guide / model overlays are SimulatorApp's) */
  useEffect(() => {
    if (!active || sheetTab === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetTab(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, sheetTab]);
  useEffect(() => { resolvedRef.current = new Set(); setNotesBoth([]); setUnread(0); }, [cfg.scenarioId, cfg.seed, setNotesBoth]);
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner((b) => (b && b.key === banner.key ? null : b)), 4200);
    return () => clearTimeout(t);
  }, [banner]);
  useEffect(() => {
    const prev = prevYearRef.current;
    prevYearRef.current = calYear;
    if (calYear === prev) return;
    // a Turning Point the playhead has left behind resolves as passed —
    // the item records that its moment went by unacted
    const stale = notesRef.current.filter((n) => n.kind === "turning" && n.status === "open" && calYear > n.year + 1);
    if (stale.length) {
      for (const n of stale) if (n.winKey) resolvedRef.current.add(n.winKey);
      setNotesBoth(notesRef.current.map((n) => (n.kind === "turning" && n.status === "open" && calYear > n.year + 1 ? { ...n, status: "passed" as const } : n)));
    }
    if (playing) {
      const majors = result.events.filter((e) => e.year === calYear && MAJOR_KINDS.has(e.kind));
      if (majors.length) setBanner({ key: `${calYear}:${majors[0].text}`, text: majors[0].text });
      // major events also land in the inbox (at most two per year)
      let arrived = false;
      for (const e of majors.slice(0, 2)) {
        const site = eventSiteIdx(e);
        const anchor = claimIdx !== null && (site === claimIdx || (site !== null && result.years[yearIdx][site].c === claimIdx) || e.text.includes(COUNTRIES[claimIdx].name));
        pushNote({ id: `e${calYear}:${e.kind}:${e.text.slice(0, 24)}`, kind: "event", year: calYear, title: e.text, siteIdx: site, anchor, status: "seen", bornAt: Date.now() });
        arrived = true;
      }
      if (arrived) chime(chimeOn);
    }
    if (poolLeft <= 0) return;
    const decade = [2036, 2046, 2056, 2066, 2076, 2086, 2096].find((w) => prev < w && calYear >= w);
    let key: string | null = decade ? `d${decade}` : null;
    let winYear = decade ?? calYear;
    if (!key && playing && calYear >= 2031 && result.events.some((e) => e.year === calYear && (e.kind === "shock" || e.kind === "crisis" || e.kind === "overtake"))) {
      // the ≥6-year spacing counts still-open windows too, so a fresh
      // shock window never supersedes one the player just received
      const past = [...resolvedRef.current, ...notesRef.current.map((n) => n.winKey).filter((k): k is string => !!k)]
        .map((k) => parseInt(k.slice(1), 10)).filter(Number.isFinite);
      if (calYear - (past.length ? Math.max(...past) : 0) >= 6) { key = `s${calYear}`; winYear = calYear; }
    }
    if (key && !resolvedRef.current.has(key) && !notesRef.current.some((n) => n.winKey === key)) {
      // a still-open older Turning Point is superseded — its moment passes
      setNotesBoth(notesRef.current.map((n) => (n.kind === "turning" && n.status === "open" ? { ...n, status: "passed" as const } : n)));
      pushNote({ id: `t${key}`, kind: "turning", year: winYear, title: `Turning Point — ${winYear}`, siteIdx: selectedIdx, anchor: false, status: "open", winKey: key, bornAt: Date.now() });
      chime(chimeOn);
    }
  }, [calYear, playing, poolLeft, result, pushNote, setNotesBoth, chimeOn, claimIdx, selectedIdx, yearIdx]);

  /* ── spectacle: when a major event lands during playback, its site gets
     a pulse on the map. In CINEMA the beat also earns a hold (a clean cut
     point for an editor) and, with the director camera on, an eased move
     to the site — then the frame eases back out to the wider shot. All of
     it is presentation over the same event stream; the engine never knows. */
  const [pulse, setPulse] = useState<{ idx: number; key: number } | null>(null);
  const [shot, setShot] = useState<{ idx: number; key: number } | null>(null);
  const shotTimerRef = useRef<number | null>(null);
  const { cinema: cinemaOn, holdMajors, autoCam, onHoldRequest } = idler;
  useEffect(() => {
    if (!playing) return;
    const majors = result.events.filter((e) => e.year === calYear && isMajorEvent(e));
    if (!majors.length) return;
    const withSite = majors
      .map((e) => ({ e, site: eventSiteIdx(e) }))
      .find((x) => x.site !== null);
    if (withSite && withSite.site !== null) {
      setPulse({ idx: withSite.site, key: calYear });
      if (cinemaOn) {
        if (holdMajors) onHoldRequest(1500);
        if (autoCam) {
          setShot({ idx: withSite.site, key: calYear });
          if (shotTimerRef.current) window.clearTimeout(shotTimerRef.current);
          shotTimerRef.current = window.setTimeout(() => setShot(null), 4600);
        }
      }
    } else if (cinemaOn && holdMajors) {
      onHoldRequest(1200); // a world crisis has no single site — the beat still lands
    }
  }, [calYear, playing, result, cinemaOn, holdMajors, autoCam, onHoldRequest]);
  useEffect(() => () => { if (shotTimerRef.current) window.clearTimeout(shotTimerRef.current); }, []);

  /* cinema chrome: the minimal control cluster wakes on pointer activity
     and fades again, so a recording sees only the world */
  const [chromeUp, setChromeUp] = useState(true);
  const [cinemaYear, setCinemaYear] = useState(true);
  const chromeTimerRef = useRef<number | null>(null);
  const wakeChrome = useCallback(() => {
    setChromeUp(true);
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(() => setChromeUp(false), 2800);
  }, []);
  useEffect(() => {
    if (!cinemaOn) return;
    wakeChrome();
    return () => { if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current); };
  }, [cinemaOn, wakeChrome]);

  /* ── Highlights: the take plan. The century is deterministic, so every
     notable beat can be listed before a recording starts — majors, falls,
     breakaways, and anything that names the focus or the anchor. */
  const [hlAnchorOnly, setHlAnchorOnly] = useState(false);
  const highlights = useMemo(() => {
    const named = new Set<string>();
    if (focusIdx >= 0) named.add(COUNTRIES[focusIdx].name);
    if (claimIdx !== null) named.add(COUNTRIES[claimIdx].name);
    return result.events
      .filter((e) => isMajorEvent(e) || e.kind === "breakaway" || e.kind === "focus" || [...named].some((n) => e.text.includes(n)))
      .map((e) => ({ e, site: eventSiteIdx(e), mine: [...named].some((n) => e.text.includes(n)) }));
  }, [result, focusIdx, claimIdx]);
  const highlightsShown = hlAnchorOnly ? highlights.filter((h) => h.mine) : highlights;
  const powerOptions = useMemo(() => {
    const row = result.years[yearIdx];
    const idxs = COUNTRIES.map((_, i) => i).filter((i) => row[i].bloc > 0)
      .sort((a, b) => row[b].bloc - row[a].bloc).slice(0, 36);
    if (selectedIdx !== null && !idxs.includes(selectedIdx)) idxs.push(selectedIdx);
    return idxs.map((i) => ({ idx: i, code: COUNTRIES[i].code, name: COUNTRIES[i].name }));
  }, [result, yearIdx, selectedIdx]);

  /* ---- P1b: "why" — plain language over the engine's attribution ------- */
  const whyLines = useMemo(() => {
    if (selectedIdx === null) return [];
    const at = result.attrib[yearIdx][selectedIdx];
    const code = COUNTRIES[selectedIdx].code;
    const lines: { head: string; body: string; w: number }[] = [];
    if (at.sh <= -0.4) lines.push({ head: "SHOCKS", body: `This year's shocks cut ≈${Math.abs(at.sh).toFixed(1)} points off growth.`, w: Math.abs(at.sh) });
    else if (at.sh >= 0.6) lines.push({ head: "WINDFALL", body: `Booms and finds added ≈${at.sh.toFixed(1)} points to growth this year.`, w: at.sh });
    if (at.i !== selectedIdx) lines.push({
      head: "ORBIT",
      body: `${COUNTRIES[at.i].name} pulls hardest — gravity ${at.iv.toFixed(0)} against its own ${at.sv.toFixed(0)} (power × receptivity ÷ distance).`,
      w: at.sv > 0 ? at.iv / at.sv : 1,
    });
    if (at.e !== selectedIdx) lines.push({
      head: "MARKET",
      body: `${COUNTRIES[at.e].name} dominates its market gravity (${at.ev.toFixed(0)}) — trade follows the biggest nearby economy.`,
      w: 0.8,
    });
    if (at.tg >= 8) lines.push({
      head: "TECHNOLOGY",
      body: `${at.tg.toFixed(0)} points behind the frontier — diffusion from ahead neighbours helps, but the gap taxes everything.`,
      w: at.tg / 40,
    });
    for (const v of interventions) {
      const dur = v.lever === "trade" ? 15 : v.lever === "chokepoint" ? 20 : 10;
      if (calYear < v.year || calYear >= v.year + dur) continue;
      const mine = (v.lever === "tech" || v.lever === "stability") && v.target === code;
      const tradeMine = v.lever === "trade" && v.target.split(/[>!]/)[0] === code;
      if (mine || tradeMine) {
        lines.push({ head: "YOUR HAND", body: `${LEVERS.find((l) => l.id === v.lever)?.name} is still working — until ${v.year + dur}.`, w: 2 });
      }
    }
    return lines.sort((a, b) => b.w - a.w).slice(0, 3);
  }, [result, yearIdx, selectedIdx, interventions, calYear]);

  const setBoost = (key: keyof Boosts) => (v: number) => onCfg({ ...cfg, boosts: { ...cfg.boosts, [key]: v } });
  const setRivalBoost = (code: string) => (key: keyof Boosts) => (v: number) =>
    onCfg({ ...cfg, rivals: rivals.map((r) => (r.code === code ? { ...r, boosts: { ...r.boosts, [key]: v } } : r)) });
  const setDeck = (patch: Partial<DeckControls>) => onCfg({ ...cfg, deck: { ...deck, ...patch } });
  const onScenario = (id: string) => {
    const sc = getScenario(id);
    /* a new scenario is a new century — spent interventions belong to the old one */
    onCfg({ ...cfg, scenarioId: id, focusCode: sc.focus, boosts: ZERO_BOOSTS, interventions: [] });
  };
  const modifiers = cfg.modifiers ?? [];
  const toggleModifier = (id: string) =>
    onCfg({ ...cfg, modifiers: modifiers.includes(id) ? modifiers.filter((m) => m !== id) : [...modifiers, id] });
  const applyTemplate = (patch: Partial<SimConfig>) => {
    resolvedRef.current = new Set();
    setNotesBoth([]);
    setUnread(0);
    onCfg({
      scenarioId: patch.scenarioId ?? cfg.scenarioId,
      seed: cfg.seed,
      focusCode: patch.focusCode,
      boosts: patch.boosts ?? { ...ZERO_BOOSTS },
      rivals: patch.rivals ?? [],
      deck: patch.deck ? { ...patch.deck } : { ...DEFAULT_DECK },
      modifiers: patch.modifiers ?? [],
      interventions: [],
    });
  };

  const selIsFocus = selGeo !== null && focusIdx === selectedIdx;
  const selIsRival = selGeo !== null && rivals.some((r) => r.code === selGeo.code);
  const deckSummary = `${[deck.chokepoints && "straits", deck.climate && "climate", deck.pandemics && "plague", deck.rushes && "rushes"].filter(Boolean).length}/4 decks · chaos ×${deck.chaos.toFixed(1)}`;

  /* map markers for the inbox: open Turning Points and fresh events,
     capped at five, drawn over the country each one concerns */
  const mapMarkers = notes
    .filter((n) => n.siteIdx !== null && (n.status === "open" || calYear - n.year <= 1))
    .slice(0, 5)
    .map((n) => ({ idx: n.siteIdx!, key: n.id, anchor: n.anchor }));

  return (
    <div className={`absolute inset-0 ${active ? (cinema ? "" : "max-sm:flex max-sm:flex-col max-sm:pt-12") : "hidden"}`} aria-hidden={!active}>
      {/* ══ MAP STAGE — the world plate fitted to the screen: contain, never
          cropped; the stage's ocean gradient fills any slack, and the
          wrapper's exact viewBox aspect keeps the weather canvas 1:1.
          sm+: centered overlay. PORTRAIT: the root is a flex column and
          this wrapper is its first in-flow child — the MAP ZONE, pinned
          directly under the header overlay; the deck below is the UI zone
          and nothing in it ever overlaps the map ══ */}
      <div className={cinema
          ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-sm:relative max-sm:left-auto max-sm:top-auto max-sm:shrink-0 max-sm:translate-x-0 max-sm:translate-y-0"}
        style={{
          width: "min(100%, calc(100dvh * 960 / 520))", height: "min(100%, calc(100vw * 520 / 960))",
          /* cinema grade: the same atlas, richer — deeper contrast and
             warmer saturation for footage. Normal view is untouched. */
          filter: cinema ? "saturate(1.3) contrast(1.07) brightness(1.02)" : undefined,
        }}>
        <WorldMap result={result} yearFloat={yearFloat} layer={layer} selectedIdx={selectedIdx} onSelect={onSelect} uid={uid} framing={framing} frameIdx={frameIdx} diffResult={diffResult} terrainArt={terrainArt} weather={weather} flowIdx={flowOn ? selectedIdx : null} claimIdx={claimIdx} pulse={pulse} shot={shot} cinema={cinema} markers={mapMarkers} animations={animationsOn} />
        {!cinema && (
          <div className="pointer-events-none absolute bottom-1 left-1.5 z-10 max-w-[78%] rounded-md backdrop-blur-[2px] max-sm:max-w-[94%]"
            style={{ background: "rgba(4,15,29,0.52)" }}>
            <MapLegend layer={layer} />
          </div>
        )}
        {banner && !cinema && (
          <div key={banner.key} className="pointer-events-none absolute left-1/2 top-14 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-md border px-3 py-1.5 text-center max-sm:hidden"
            style={{ background: "rgba(4,16,30,0.92)", borderColor: "rgba(240,192,96,0.65)", boxShadow: "0 10px 28px rgba(0,0,0,0.6)" }}
            role="status">
            <span className="font-display text-[11px] tracking-[0.22em]" style={{ color: GOLD }}>⚡ HISTORY CHANGED</span>
            <span className="block truncate text-[11px]" style={{ color: CREAM }}>{banner.text}</span>
          </div>
        )}
        {/* framing toggle — offered only when there is something to frame:
            a scenario's place-focus, or a country the player picked. With
            neither (a fresh, blank start) the world plate simply shows. */}
        {!cinema && (framing === "region" || frameIdx !== null) && (
          <button
            onClick={() => setFraming(framing === "region" ? "world" : "region")}
            className="absolute left-2 top-12 z-10 rounded border px-2 py-1 text-[10px] font-semibold tracking-[0.14em] backdrop-blur-sm max-sm:top-2"
            style={{ background: "rgba(4,16,30,0.82)", borderColor: "rgba(240,192,96,0.5)", color: GOLD }}
            aria-label={framing === "region" ? "Zoom back to the full world" : "Frame the region"}
          >
            {framing === "region" ? "🌐 FULL WORLD" : `◎ FRAME ${scenario.place ?? "REGION"}`}
          </button>
        )}
      </div>

      {/* ══ CINEMA — the recording surface: no chrome but the world, a
          whisper of a year readout, and a control cluster that wakes on
          pointer activity and fades before it can spoil a take ══ */}
      {active && cinema && (
        <div className="absolute inset-0 z-30" onMouseMove={wakeChrome} onClick={wakeChrome} role="group" aria-label="Cinema controls">
          {cinemaYear && (
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 font-display text-2xl tracking-[0.34em]"
              style={{ color: "rgba(240,192,96,0.9)", textShadow: "0 2px 14px rgba(0,0,0,0.85)", paddingLeft: "0.34em" }}>
              {calYear}
            </div>
          )}
          <div className={`absolute bottom-4 right-3 flex flex-wrap items-center justify-end gap-1.5 transition-opacity duration-500 sm:right-4 ${chromeUp ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <button onClick={tp.onTogglePlay} className="flex h-10 w-10 items-center justify-center rounded-full border font-display text-base backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: "rgba(240,192,96,0.55)", color: GOLD }}
              aria-label={tp.playing ? "Pause" : "Play"}>
              {tp.playing ? "❚❚" : "▶"}
            </button>
            <button onClick={tp.onStep} className="flex h-10 w-10 items-center justify-center rounded-full border text-sm backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: "rgba(201,150,58,0.4)", color: PARCH }}
              aria-label="Step one year">
              ⏭
            </button>
            <div className="flex overflow-hidden rounded-full border backdrop-blur-md" style={{ borderColor: "rgba(201,150,58,0.4)", background: "rgba(4,16,30,0.72)" }} role="group" aria-label="Pace">
              {PACES.map((p) => (
                <button key={p.id} onClick={() => tp.onPace(p.id)} className="px-2.5 py-2 font-display text-[10px] tracking-wider"
                  style={{ background: tp.pace === p.id ? GOLD_DEEP : "transparent", color: tp.pace === p.id ? "#081426" : PARCH }}
                  aria-pressed={tp.pace === p.id} title={p.blurb}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={idler.onToggleAutoCam} className="rounded-full border px-2.5 py-2 font-display text-[10px] tracking-wider backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: autoCam ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)", color: autoCam ? GOLD : MUTED }}
              aria-pressed={autoCam} title="Director camera — eases toward the action as history happens">
              🎥 CAM {autoCam ? "ON" : "OFF"}
            </button>
            <button onClick={idler.onToggleHoldMajors} className="rounded-full border px-2.5 py-2 font-display text-[10px] tracking-wider backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: holdMajors ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)", color: holdMajors ? GOLD : MUTED }}
              aria-pressed={holdMajors} title="Hold a beat on major events — a clean cut point for the edit">
              ⏸ HOLD {holdMajors ? "ON" : "OFF"}
            </button>
            <button onClick={() => setCinemaYear((v) => !v)} className="rounded-full border px-2.5 py-2 font-display text-[10px] tracking-wider backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: cinemaYear ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)", color: cinemaYear ? GOLD : MUTED }}
              aria-pressed={cinemaYear} title="Show or hide the year readout">
              YEAR {cinemaYear ? "ON" : "OFF"}
            </button>
            <button onClick={idler.onToggleCinema} className="rounded-full border px-3 py-2 font-display text-[10px] tracking-wider backdrop-blur-md"
              style={{ background: "rgba(4,16,30,0.72)", borderColor: "rgba(240,192,96,0.55)", color: GOLD }}
              aria-label="Exit cinema (Esc or C)">
              ✕ EXIT
            </button>
          </div>
          {claimIdx !== null && (
            <div className={`pointer-events-none absolute bottom-4 left-3 transition-opacity duration-500 sm:left-4 ${chromeUp ? "opacity-100" : "opacity-0"}`}>
              <span className="rounded-full border px-2.5 py-1.5 font-display text-[10px] tracking-[0.16em] backdrop-blur-md"
                style={{ background: "rgba(4,16,30,0.66)", borderColor: "rgba(34,211,238,0.55)", color: CLAIM }}>
                ⚑ {COUNTRIES[claimIdx].name.toUpperCase()}{claimRankNow !== null ? ` · № ${claimRankNow}` : " · HELD"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* scrim — tapping the map while the sheet is open collapses it
          (sm+ only: on portrait the sheet lives in the UI zone, the map is
          never covered, and the sheet's own ▾ / PANELS toggle collapses it) */}
      {active && sheetTab !== null && !cinema && (
        <button onClick={() => setSheetTab(null)} className="absolute inset-0 z-20 cursor-default max-sm:hidden" aria-label="Collapse the panel" tabIndex={-1} />
      )}

      {/* ══ NOTIFICATIONS RAIL — the live inbox, desktop: Turning Points
          and major events arrive here while playback CONTINUES (no
          pause, no modal). On phones the same list is the NOTES sheet
          tab. Anchor-related items are cyan, like the claim itself. ══ */}
      {active && !cinema && railOpen && (
        <aside className="absolute right-2 top-16 z-30 hidden w-[322px] max-w-[86vw] lg:block" aria-label="Notifications">
          <div className="flex max-h-[74dvh] flex-col rounded-xl border backdrop-blur-md"
            style={{ background: "linear-gradient(180deg, rgba(10,28,50,0.92), rgba(4,15,29,0.96))", borderColor: PANEL_BORDER, boxShadow: "0 18px 44px rgba(0,0,0,0.55)" }}>
            <div className="flex items-center gap-2 px-3 pt-2.5">
              <span className="font-display text-[11px] tracking-[0.2em]" style={{ color: GOLD }}>🔔 NOTIFICATIONS</span>
              {unread > 0 && <span className="rounded-full px-1.5 py-0.5 font-display text-[9px] tracking-wider" style={{ background: GOLD_DEEP, color: "#081426" }}>{unread} NEW</span>}
              <button onClick={() => { setRailOpen(false); setUnread(0); }} className="ml-auto rounded px-1.5 py-1 text-[13px] leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Close the notifications rail">▾</button>
            </div>
            <div className="px-3 pb-1.5 pt-1 text-[10.5px]" style={{ color: MUTED }}>
              ⚑ INFLUENCE — earned {INFLUENCE_POOL} · spent {spentTotal} · balance {poolLeft}
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-2.5 pb-2.5">
              <NotesList notes={notes} pool={poolLeft} spent={spentTotal} options={powerOptions} selectedIdx={selectedIdx}
                onSpend={spendNote} onPass={passNote}
                onFocus={(idx) => { onSelect(idx); setSheetTab("dossier"); }} />
            </div>
          </div>
        </aside>
      )}

      {/* ══ BOTTOM DECK — tabbed sheet, transport strip ══ */}
      {active && !cinema && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col max-sm:relative max-sm:inset-auto max-sm:min-h-0 max-sm:flex-1">
          {/* PORTRAIT UI ZONE — on phones the deck is in-flow below the map
              zone (see the root), so the banner gets a slot of its own here:
              never over the map, never clipped behind the Turning Point card.
              Hidden on sm+ — the banner floats over the map there instead. */}
          {banner && (
            <div className="hidden px-3 pt-2 max-sm:block">
              <div className="rounded-md border px-3 py-1.5 text-center"
                style={{ background: "rgba(4,16,30,0.92)", borderColor: "rgba(240,192,96,0.65)", boxShadow: "0 10px 28px rgba(0,0,0,0.6)" }}
                role="status">
                <span className="font-display text-[11px] tracking-[0.22em]" style={{ color: GOLD }}>⚡ HISTORY CHANGED</span>
                <span className="block truncate text-[11px]" style={{ color: CREAM }}>{banner.text}</span>
              </div>
            </div>
          )}
          {/* EXPANDED SHEET — sm+: slides up over the map, capped at
              ~72dvh. PORTRAIT: flexes within the UI zone only (its content
              scrolls internally); the map stays pinned and fully visible */}
          {sheetTab !== null && (
            <div className="gs-sheet-in flex max-h-[72dvh] flex-col border-t backdrop-blur-md max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1"
              style={{ background: "linear-gradient(180deg, rgba(10,28,50,0.90), rgba(4,15,29,0.96))", borderColor: PANEL_BORDER, boxShadow: "0 -18px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(240,192,96,0.12)" }}>
              <div className="flex items-center px-2 pt-2 sm:px-3">
                <div className="flex min-w-0 items-center gap-1 overflow-x-auto" role="tablist" aria-label="Panel sections">
                {SHEET_TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={sheetTab === t.id}
                    onClick={() => { setSheetTab(t.id); if (t.id === "notes") setUnread(0); }}
                    className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 font-display text-[11px] tracking-[0.14em] sm:px-3"
                    style={{
                      background: sheetTab === t.id ? "rgba(201,150,58,0.20)" : "transparent",
                      color: sheetTab === t.id ? GOLD : "#cbb27a",
                      boxShadow: sheetTab === t.id ? "inset 0 0 0 1px rgba(240,192,96,0.45)" : "inset 0 0 0 1px rgba(201,150,58,0.18)",
                    }}>
                    {t.label}{t.id === "notes" && unread > 0 ? ` (${unread})` : ""}
                  </button>
                ))}
                </div>
                <button onClick={() => setSheetTab(null)} className="ml-auto shrink-0 rounded-md px-2 py-1.5 text-[13px] leading-none hover:opacity-75" style={{ color: MUTED }} aria-label="Collapse the panel">▾</button>
              </div>
              <div className="min-h-0 overflow-y-auto overscroll-contain">
                {sheetTab === "setup" && (
                  <div className="pb-2">
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

      {/* what-if forks + starting world modifiers — one swipeable strip on
          phones so the map stays near the first screen */}
      <div className="flex gap-4 overflow-x-auto px-4 pt-2.5 sm:block sm:space-y-1.5 sm:overflow-visible">
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:flex-wrap">
          <span className="text-[10px] tracking-[0.18em]" style={{ color: MUTED }}>WHAT-IF FORKS</span>
          {WHATIF_TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => applyTemplate(t.patch)} title={t.desc}
              className="rounded-full border px-2.5 py-1 text-[11px] tracking-wide hover:opacity-85"
              style={{ borderColor: "rgba(111,168,207,0.45)", color: "#a9cbe4", background: "rgba(111,168,207,0.07)" }}>
              ⑂ {t.name}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:flex-wrap">
          <span className="text-[10px] tracking-[0.18em]" style={{ color: MUTED }}>WORLD MODIFIERS</span>
          {WORLD_MODIFIERS.filter((m) => m.selectable).map((m) => {
            const on = modifiers.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggleModifier(m.id)} title={m.desc} aria-pressed={on}
                className="rounded-full border px-2.5 py-1 text-[11px] tracking-wide"
                style={{
                  borderColor: on ? "rgba(240,192,96,0.65)" : "rgba(147,167,189,0.3)",
                  color: on ? GOLD : FAINT,
                  background: on ? "rgba(201,150,58,0.13)" : "transparent",
                }}>
                {on ? "●" : "○"} {m.name}
              </button>
            );
          })}
          {WORLD_MODIFIERS.filter((m) => !m.selectable && modifiers.includes(m.id)).map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-wide"
              style={{ borderColor: "rgba(240,192,96,0.65)", color: GOLD, background: "rgba(201,150,58,0.13)" }} title={m.desc}>
              ● {m.name}
              <button onClick={() => toggleModifier(m.id)} aria-label={`Remove modifier ${m.name}`} className="leading-none hover:opacity-75">✕</button>
            </span>
          ))}
          {modifiers.length === 0 && <span className="text-[11px]" style={{ color: FAINT }}>none — the world as scripted</span>}
        </div>
      </div>

                  </div>
                )}

      {/* POWERS tab — leaderboard + movers */}
      {sheetTab === "notes" && (
        <div className="px-4 py-3">
          <p className="mb-2 text-[11px]" style={{ color: MUTED }}>
            ⚑ INFLUENCE — earned {INFLUENCE_POOL} · spent {spentTotal} · balance {poolLeft}. Turning Points never pause the run: act while their year is live, or they pass and the item says so.
          </p>
          <NotesList notes={notes} pool={poolLeft} spent={spentTotal} options={powerOptions} selectedIdx={selectedIdx}
            onSpend={spendNote} onPass={passNote}
            onFocus={(idx) => { onSelect(idx); setSheetTab("dossier"); }} />
        </div>
      )}
      {sheetTab === "powers" && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 lg:grid-cols-2">
          <div>
            <SectionHead>TOP POWERS — {calYear}</SectionHead>
          <ol className="space-y-0.5">
            {leaders.map((l, i) => {
              const gi = COUNTRIES.findIndex((c) => c.code === l.code);
              const mine = claimIdx !== null && COUNTRIES[claimIdx].code === l.code;
              return (
                <li key={l.code}>
                  <button onClick={() => onSelect(gi)}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-[3px] text-left text-xs hover:bg-white/5"
                    style={{
                      color: CREAM,
                      background: mine ? "rgba(34,211,238,0.13)" : i === 0 ? "rgba(201,150,58,0.10)" : undefined,
                      borderLeft: mine ? `2px solid ${CLAIM}` : i === 0 ? "2px solid #f0c060" : "2px solid transparent",
                    }}>
                    <span className="w-5 shrink-0 font-display text-sm" style={{ color: i === 0 ? GOLD : MUTED }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: powerColor(l.code) }} />
                    <span className="truncate">{COUNTRIES[gi].name}</span>
                    {mine && <span className="shrink-0 font-display text-[9px] tracking-[0.14em]" style={{ color: CLAIM }}>⚑ YOUR ANCHOR</span>}
                    <span className="ml-auto font-mono" style={{ color: GOLD }}>{l.power.toFixed(0)}</span>
                  </button>
                </li>
              );
            })}
            </ol>
            {claimIdx !== null && !leaders.some((l) => l.code === COUNTRIES[claimIdx].code) && (
              <button onClick={() => onSelect(claimIdx)}
                className="mt-1 flex w-full items-center gap-2 rounded border px-1.5 py-[5px] text-left text-xs"
                style={{ borderColor: "rgba(34,211,238,0.5)", background: "rgba(34,211,238,0.08)", color: CREAM }}>
                <span className="w-5 shrink-0 font-display text-sm" style={{ color: GOLD }}>{claimRankNow !== null ? String(claimRankNow).padStart(2, "0") : "——"}</span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: powerColor(COUNTRIES[claimIdx].code) }} />
                <span className="truncate">{COUNTRIES[claimIdx].name}</span>
                <span className="shrink-0 font-display text-[9px] tracking-[0.14em]" style={{ color: CLAIM }}>⚑ YOUR ANCHOR</span>
                <span className="ml-auto font-mono" style={{ color: GOLD }}>
                  {claimRankNow !== null
                    ? (result.years[yearIdx][claimIdx].bloc).toFixed(0)
                    : `HELD BY ${claimHolder !== null ? COUNTRIES[claimHolder].name.toUpperCase() : ""}`}
                </span>
              </button>
            )}
          </div>
          <div>
            {(movers.risers.length > 0 || movers.fallers.length > 0) && (
            <div>
              <div className="mb-1 font-display text-[10px] tracking-[0.18em]" style={{ color: MUTED }}>
                MOVERS — SINCE {movers.since}
              </div>
              <ul className="space-y-0.5">
                {[...movers.risers.map((r) => ({ ...r, up: true })), ...movers.fallers.map((r) => ({ ...r, up: false }))].map((r) => (
                  <li key={`${r.up ? "u" : "d"}-${r.idx}`}>
                    <button onClick={() => onSelect(r.idx)} className="flex w-full items-center gap-2 rounded px-1.5 py-[2px] text-left text-[11px] hover:bg-white/5" style={{ color: PARCH }}>
                      <span style={{ color: r.up ? "#7fb069" : "#d1603d" }}>{r.up ? "▲" : "▼"}</span>
                      <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: powerColor(COUNTRIES[r.idx].code) }} />
                      <span className="truncate">{COUNTRIES[r.idx].name}</span>
                      <span className="ml-auto font-mono" style={{ color: r.up ? "#7fb069" : "#d1603d" }}>
                        {r.delta > 0 ? "+" : "−"}{Math.abs(r.delta).toFixed(0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
              )}
          </div>
          <div className="lg:col-span-2">
            <SectionHead>FAITHS OF THE WORLD — {calYear}</SectionHead>
            <ol className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {result.faithLeaders[yearIdx].slice(0, 6).map((fl, i) => {
                const fd = FAITHS.find((x) => x.id === fl.faith);
                return (
                  <li key={fl.faith} className="flex items-center gap-2 rounded px-1.5 py-[3px] text-xs"
                    style={{
                      color: CREAM,
                      background: i === 0 ? "rgba(201,150,58,0.10)" : undefined,
                      borderLeft: i === 0 ? "2px solid #f0c060" : "2px solid transparent",
                    }}>
                    <span className="w-5 shrink-0 font-display text-sm" style={{ color: i === 0 ? GOLD : MUTED }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: fd?.color ?? "#8a93a3" }} />
                    <span className="truncate">{fl.name}</span>
                    <span className="ml-auto font-mono" style={{ color: GOLD }}>{fl.popShare.toFixed(1)}%</span>
                    <span className="w-14 shrink-0 text-right text-[10px]" style={{ color: MUTED }}>{fl.countries} nations</span>
                  </li>
                );
              })}
            </ol>
            <p className="px-1.5 pt-1 text-[10px] leading-snug" style={{ color: FAINT }}>
              Share of world population living under each dominant faith. A parallel track — faith feeds no power, influence or annexation formula.
            </p>
          </div>
        </div>
      )}
      {sheetTab === "chronicle" && (
        <div className="px-4 py-3">
          <div className="mx-auto max-w-3xl">
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
            {mergedFeed.length === 0 && <li className="text-xs" style={{ color: FAINT }}>The world holds its breath… press play.</li>}
            {mergedFeed.map((e, i) => {
              const major = e.kind !== null && MAJOR_KINDS.has(e.kind);
              return (
                <li key={`${e.year}-${i}`} className={`flex gap-2 text-[11px] leading-snug ${major || e.anchor ? "font-semibold" : ""}`}
                  style={{
                    color: major || e.anchor ? CREAM : PARCH,
                    borderLeft: e.anchor ? `2px solid ${CLAIM}` : e.kind === "intervention" ? "2px solid rgba(240,192,96,0.65)" : "2px solid transparent",
                    paddingLeft: e.anchor || e.kind === "intervention" ? 6 : 2,
                  }}>
                  <span className="w-8 shrink-0 font-display text-[13px] leading-none" style={{ color: GOLD }}>{e.year}</span>
                  {e.anchor
                    ? <span className="shrink-0 text-[10px] leading-[1.4]" style={{ color: CLAIM }} aria-hidden>⚑</span>
                    : <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.kind ? KIND_STYLE[e.kind] : FAINT }} />}
                  <span>{e.text}</span>
                </li>
              );
            })}
            </ul>
          </div>
        </div>
      )}

      {/* HIGHLIGHTS tab — the take plan: every notable beat of the century,
          listed up front because the run is deterministic. Jump the
          playhead to a beat, frame it in Cinema, record the take. */}
      {sheetTab === "highlights" && (
        <div className="px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <SectionHead right={(
              <button onClick={() => setHlAnchorOnly((v) => !v)} className="rounded border px-1.5 py-0.5 text-[9px] tracking-[0.14em]"
                style={{ borderColor: "rgba(201,150,58,0.4)", color: hlAnchorOnly ? GOLD : MUTED }}
                title="Show only the beats that name the boosted power or your anchor">
                {hlAnchorOnly ? "⚑ ANCHOR & FOCUS" : "○ ALL BEATS"}
              </button>
            )}>
              HIGHLIGHTS — {highlightsShown.length} BEATS
            </SectionHead>
            <p className="mb-2 text-[11px] leading-relaxed" style={{ color: FAINT }}>
              Same seed, same century — every beat below will happen, in this order. Jump to one,
              press C for Cinema, and record the take. 🎬 Cinema holds a beat on the majors for a clean cut.
            </p>
            <ul className="space-y-1">
              {highlightsShown.map(({ e, site, mine }, i) => {
                const reached = e.year <= calYear;
                return (
                  <li key={`${e.year}-${i}`} className="flex items-center gap-2 text-[11px] leading-snug"
                    style={{ color: reached ? PARCH : FAINT }}>
                    <span className="w-8 shrink-0 font-display text-[13px] leading-none" style={{ color: reached ? GOLD : FAINT }}>{e.year}</span>
                    <span className="mt-0 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_STYLE[e.kind] }} />
                    <span className={`min-w-0 flex-1 ${isMajorEvent(e) ? "font-semibold" : ""}`} style={{ color: isMajorEvent(e) && reached ? CREAM : undefined }}>
                      {mine && <span style={{ color: GOLD }}>⚑ </span>}{e.text}
                    </span>
                    <button onClick={() => { tp.onScrub(e.year - START_YEAR); if (site !== null) onSelect(site); }}
                      className="shrink-0 rounded border px-2 py-1 text-[10px] font-semibold tracking-wider hover:opacity-80"
                      style={{ borderColor: "rgba(240,192,96,0.5)", color: GOLD }}
                      aria-label={`Jump the timeline to ${e.year}`}>
                      ▶ JUMP
                    </button>
                  </li>
                );
              })}
              {highlightsShown.length === 0 && (
                <li className="text-xs" style={{ color: FAINT }}>No beats match — claim a nation or boost a power and its story will fill this list.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* DOSSIER tab — the inspector card */}
      {sheetTab === "dossier" && (
        <div className="px-3 pb-3 pt-1 sm:px-4">
          {sel && selGeo && sel0 ? (
            <div className="rounded-lg border px-3.5 py-3"
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
            <div className="text-[9px] tracking-[0.18em]" style={{ color: MUTED }}>POWER TRAJECTORY 2026–2100 · ◆ = TURNING YEARS</div>
            <Sparkline series={selSeries} color={powerColor(selGeo.code)} currentIdx={yearIdx} marks={selMarks} />
          </div>
          {/* P1b — why this country is where it is, from the engine's own terms */}
          <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(201,150,58,0.22)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[9px] tracking-[0.18em]" style={{ color: MUTED }}>WHY — {calYear}</span>
              <span className="h-px flex-1" style={{ background: "rgba(201,150,58,0.18)" }} />
              <button onClick={() => setFlowOn((v) => !v)} aria-pressed={flowOn}
                className="rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wider"
                style={{
                  borderColor: flowOn ? "rgba(240,192,96,0.7)" : "rgba(147,167,189,0.4)",
                  color: flowOn ? GOLD : MUTED,
                  background: flowOn ? "rgba(201,150,58,0.13)" : "transparent",
                }}
                title="Draw the selected power's strongest influence pulls on the map">
                🛰 INFLUENCE FLOW
              </button>
            </div>
            {whyLines.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {whyLines.map((l) => (
                  <li key={l.head} className="flex gap-2 text-[11px] leading-snug" style={{ color: PARCH }}>
                    <span className="w-[106px] shrink-0 font-display text-[10px] leading-[1.5] tracking-[0.14em]" style={{ color: GOLD }}>{l.head}</span>
                    <span>{l.body}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11px]" style={{ color: FAINT }}>Nothing unusual — its own weight, distance and drift explain this year.</p>
            )}
            {flowOn && (
              <p className="mt-1 text-[11px]" style={{ color: FAINT }}>
                The arcs are {selGeo.name}&apos;s strongest pulls — the countries inside its orbit at {calYear}, thickness ∝ gravity.
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {claimIdx === selectedIdx ? (
              <>
                <span className="flex items-center rounded border px-2.5 py-1.5 font-display text-[11px] tracking-[0.14em]"
                  style={{ borderColor: "rgba(34,211,238,0.65)", color: CLAIM, background: "rgba(34,211,238,0.10)" }}>
                  ⚑ YOUR ANCHOR
                </span>
                <button
                  onClick={idler.onReleaseClaim}
                  className="rounded border px-2.5 py-1.5 text-[11px] font-semibold tracking-wider hover:opacity-80"
                  style={{ borderColor: "rgba(147,167,189,0.4)", color: PARCH }}
                >
                  RELEASE
                </button>
              </>
            ) : (
              <button
                onClick={() => { if (selectedIdx !== null) idler.onClaim(selectedIdx); }}
                className="rounded border px-2.5 py-1.5 text-[11px] font-bold tracking-wider hover:opacity-85"
                style={{ borderColor: "rgba(34,211,238,0.7)", color: CLAIM, background: "rgba(34,211,238,0.12)" }}
                title="Anchor this run to this nation — its fortunes become the score, and the world keeps turning at your pace while you're away"
              >
                ⚑ CLAIM AS YOUR ANCHOR
              </button>
            )}
            <button
              onClick={() => { if (selectedIdx !== null) idler.onSuperpower(selectedIdx); }}
              className="rounded border px-2.5 py-1.5 text-[11px] font-semibold tracking-wider hover:opacity-85"
              style={{ borderColor: "rgba(240,192,96,0.55)", color: GOLD, background: "rgba(201,150,58,0.07)" }}
              title="One-click what-if: this nation gets everything — growth, tech, arms, resources — and the run restarts at 2026, running at Brisk"
            >
              🚀 SUPERPOWER RUN
            </button>
            {!selIsFocus && (
              <button
                onClick={() => onCfg({ ...cfg, focusCode: selGeo.code, boosts: cfg.boosts === ZERO_BOOSTS ? { growth: 55, tech: 60, military: 50, resources: 45 } : cfg.boosts })}
                className="rounded px-2.5 py-1.5 text-[11px] font-bold tracking-wider"
                style={{ background: GOLD_DEEP, color: "#081426" }}
              >
                ⚑ BOOST {selGeo.name.toUpperCase()}
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
          ) : (
            <p className="px-1 py-2 text-xs" style={{ color: FAINT }}>Click a country on the map to inspect it.</p>
          )}
      {/* the hand of history: focus + rivals */}
      <div className="space-y-2.5 pb-1 pt-3">
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
              ? "Click a country, hit “Boost” to start its rise — then set up to two rivals."
              : "Tip: click a country to inspect it — boost it, or make it a rival."}
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
        </div>
      )}

      {/* shock deck controls — SETUP tab, continued */}
      {sheetTab === "setup" && (
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
            <p className="pt-1 text-[11px]" style={{ color: FAINT }}>How often the world misbehaves. ×0 silences the random deck (scripted events still fire).</p>
          </div>
        )}
      </div>
      )}

      {/* EXPORT tab — share kit; exports derive from this panel's history */}
      {sheetTab === "export" && (
        <div className="px-4 pb-4 pt-1">
          <ExportPanel cfg={cfg} result={result} />
        </div>
      )}
              </div>
            </div>
          )}

          {/* ══ COLLAPSED STRIP — always visible: transport + view controls ══ */}
          <div className="border-t backdrop-blur-md max-sm:mt-auto"
            style={{ background: "linear-gradient(180deg, rgba(10,28,50,0.88), rgba(3,11,22,0.96))", borderColor: "rgba(201,150,58,0.45)", boxShadow: "0 -12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(240,192,96,0.14)" }}>
            <div className="flex flex-col gap-y-1.5 px-2.5 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:px-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:contents">
              <button
                onClick={tp.onTogglePlay}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg"
                style={{ background: "linear-gradient(150deg,#e8bc58,#c9963a)", color: "#081426", boxShadow: "0 4px 18px rgba(201,150,58,0.45)" }}
                aria-label={tp.playing ? "Pause" : "Play"}
              >
                {tp.playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={tp.onStep}
                className="shrink-0 rounded-md border px-2 py-1.5 text-[13px] leading-none hover:opacity-80"
                style={{ borderColor: "rgba(201,150,58,0.4)", color: "#cbb27a" }}
                aria-label="Step one year"
                title="Step one year"
              >
                ⏭
              </button>
              <button
                onClick={tp.onReset}
                className="shrink-0 rounded-md border px-2 py-1.5 text-[13px] leading-none hover:opacity-80"
                style={{ borderColor: "rgba(201,150,58,0.4)", color: "#cbb27a" }}
                aria-label="Reset to 2026"
                title="Reset to 2026"
              >
                ⟲
              </button>
              <div className="shrink-0 text-center">
                <div className="font-display text-3xl leading-none" style={{ color: GOLD }}>{tp.year}</div>
                <div className="text-[9px] tracking-[0.22em]" style={{ color: MUTED }}>YEAR</div>
              </div>
              <input
                type="range" min="0" max={tp.maxYearIdx} step="0.05" value={tp.yearFloat}
                onChange={(e) => tp.onScrub(parseFloat(e.target.value))}
                className="gs-range min-w-[64px] flex-1"
                aria-label="Year scrubber"
              />
              <div className="flex shrink-0 overflow-hidden rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }} role="group" aria-label="Pace — how fast time flows, here and while you're away">
                {PACES.map((p) => (
                  <button key={p.id} onClick={() => tp.onPace(p.id)} className="px-2 py-1.5 font-display text-[10px] tracking-wider"
                    style={{ background: tp.pace === p.id ? "#c9963a" : "transparent", color: tp.pace === p.id ? "#081426" : "#cbb27a" }}
                    title={p.blurb}
                    aria-label={`Pace: ${p.label}`}
                    aria-pressed={tp.pace === p.id}>
                    <span className="max-sm:hidden">{p.label}</span><span className="sm:hidden">{p.short}</span>
                  </button>
                ))}
              </div>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:contents sm:overflow-visible sm:pb-0">
              {idler.claimHere ? (
                <button onClick={() => { onSelect(idler.claimHere!.idx); setSheetTab("dossier"); }}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5"
                  style={{ borderColor: "rgba(34,211,238,0.7)", background: "rgba(34,211,238,0.12)" }}
                  title={`Your anchor — ${COUNTRIES[idler.claimHere.idx].name}. Tap to inspect it.`}
                  aria-label={`Your anchor, ${COUNTRIES[idler.claimHere.idx].name}${claimRankNow !== null ? `, ranked ${claimRankNow}` : ", held by another power"}`}>
                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: powerColor(idler.claimHere.code) }} />
                  <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: CLAIM }}>
                    ⚑ {COUNTRIES[idler.claimHere.idx].name.toUpperCase()} · {claimRankNow !== null ? `№ ${claimRankNow}` : "HELD"}
                  </span>
                  {claimMove && <span className="text-[10px]" style={{ color: claimMove.color }} aria-label={claimMove.word}>{claimMove.sym}</span>}
                </button>
              ) : idler.claimElsewhere ? (
                <button onClick={idler.onJumpToClaim}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5"
                  style={{ borderColor: "rgba(34,211,238,0.45)", background: "rgba(34,211,238,0.06)" }}
                  title={`Your anchor, ${idler.claimElsewhere.name}, anchors SIM ${idler.claimElsewhere.panelNo} — tap to go to that world`}
                  aria-label={`Your anchor ${idler.claimElsewhere.name} is in sim ${idler.claimElsewhere.panelNo} — jump to it`}>
                  <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: CLAIM }}>
                    ⚑ {idler.claimElsewhere.name.toUpperCase()} — SIM {idler.claimElsewhere.panelNo} →
                  </span>
                </button>
              ) : (
                <button onClick={idler.onOpenPicker}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5"
                  style={{ borderColor: "rgba(34,211,238,0.65)", background: "rgba(34,211,238,0.10)" }}
                  title="The Idler: anchor this run to one nation, set its pace, and the world keeps turning while you're away"
                  aria-label="Claim a nation — open the Idler">
                  <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: CLAIM }}>⚑ CLAIM A NATION</span>
                </button>
              )}
              <span className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5"
                style={{ borderColor: "rgba(240,192,96,0.5)", background: "rgba(201,150,58,0.10)" }}
                title="Influence — this run's steering budget. Spend it from Turning Point notifications: each decade, and after major shocks">
                <span className="font-display text-[11px] tracking-[0.14em]" style={{ color: GOLD }}>⚑ INFLUENCE {poolLeft}</span>
              </span>
              <button
                onClick={() => { setUnread(0); if (window.innerWidth >= 1024) setRailOpen((v) => !v); else setSheetTab("notes"); }}
                className="flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 font-display text-[11px] tracking-wider"
                style={{ borderColor: unread > 0 ? "rgba(240,192,96,0.75)" : "rgba(201,150,58,0.4)", color: GOLD, background: unread > 0 ? "rgba(201,150,58,0.16)" : "rgba(201,150,58,0.05)" }}
                aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
                title="Notifications — Turning Points and major events; the run never pauses for them">
                🔔 NOTES{unread > 0 ? ` (${unread})` : ""}
              </button>
              <button
                onClick={() => { const v = !chimeOn; setChimeOn(v); try { localStorage.setItem("gs-chime", v ? "on" : "off"); } catch { /* noop */ } }}
                className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 font-display text-[11px] tracking-wider"
                style={{ borderColor: "rgba(201,150,58,0.4)", color: chimeOn ? GOLD : FAINT, background: "rgba(201,150,58,0.05)" }}
                aria-pressed={chimeOn}
                aria-label={chimeOn ? "Notification chime on" : "Notification chime off"}
                title="A short chime when a notification arrives">
                ♪ {chimeOn ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => { const v = !animationsOn; setAnimationsOn(v); try { localStorage.setItem("gs-animations", v ? "on" : "off"); } catch { /* noop */ } }}
                className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 font-display text-[11px] tracking-wider"
                style={{ borderColor: "rgba(201,150,58,0.4)", color: animationsOn ? GOLD : FAINT, background: "rgba(201,150,58,0.05)" }}
                aria-pressed={animationsOn}
                aria-label={animationsOn ? "War animations on" : "War animations off"}
                title="War spectacle — missile arcs, drones and impact bursts on the map">
                ANIMATIONS {animationsOn ? "ON" : "OFF"}
              </button>
              {challengeChip}
              {panelSwitcher}
              <button
                onClick={() => setSheetTab(sheetTab === null ? (sel ? "dossier" : "powers") : null)}
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-display text-[11px] tracking-wider"
                style={{
                  borderColor: "rgba(240,192,96,0.6)",
                  color: GOLD,
                  background: sheetTab !== null ? "rgba(201,150,58,0.16)" : "rgba(201,150,58,0.06)",
                }}
                aria-expanded={sheetTab !== null}
                aria-label={sheetTab !== null ? "Collapse the panel" : "Expand the panel — powers, dossier, chronicle, setup, export"}
              >
                {sheetTab !== null ? "▾ PANELS" : "▴ PANELS"}
              </button>
              <div className="flex shrink-0 flex-nowrap overflow-x-auto rounded-md border" style={{ borderColor: "rgba(201,150,58,0.35)" }} role="group" aria-label="Map layer">
                {LAYERS.map((l) => (
                  <button key={l.id} onClick={() => tp.onLayer(l.id)} className="px-[7px] py-1.5 text-[11px] tracking-wide"
                    style={{ background: tp.layer === l.id ? "#c9963a" : "transparent", color: tp.layer === l.id ? "#081426" : "#cdbfa5" }}
                    title={`${l.name} — ${l.blurb}`}
                    aria-label={`Layer: ${l.name}`}
                    aria-pressed={tp.layer === l.id}>
                    {LAYER_SHORT[l.id]}
                  </button>
                ))}
              </div>
              {tp.showDiff !== null && (
                <button
                  onClick={tp.onToggleDiff}
                  className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
                  style={{
                    borderColor: tp.showDiff ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)",
                    color: tp.showDiff ? GOLD : "#cbb27a",
                    background: tp.showDiff ? "rgba(201,150,58,0.12)" : "transparent",
                  }}
                  aria-pressed={tp.showDiff}
                  aria-label="Highlight countries whose controlling power differs from the first sim"
                >
                  ◐ DIFFS vs SIM 1
                </button>
              )}
              <button
                onClick={tp.onTerrainArt}
                className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
                style={{
                  borderColor: tp.terrainArt ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)",
                  color: tp.terrainArt ? GOLD : "#cbb27a",
                  background: tp.terrainArt ? "rgba(201,150,58,0.12)" : "transparent",
                }}
                aria-pressed={tp.terrainArt}
                aria-label="Toggle the pixel-art terrain under the map"
              >
                ⛰ TERRAIN ART
              </button>
              <button
                onClick={tp.onWeather}
                className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
                style={{
                  borderColor: tp.weatherOn ? "rgba(240,192,96,0.65)" : "rgba(201,150,58,0.35)",
                  color: tp.weatherOn ? GOLD : "#cbb27a",
                  background: tp.weatherOn ? "rgba(201,150,58,0.12)" : "transparent",
                }}
                aria-pressed={tp.weatherOn}
                aria-label="Toggle the ambient weather overlay"
              >
                ☁ WEATHER
              </button>
              <button
                onClick={idler.onToggleCinema}
                className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
                style={{ borderColor: "rgba(240,192,96,0.55)", color: GOLD, background: "rgba(201,150,58,0.08)" }}
                aria-pressed={cinema}
                aria-label="Cinema view — hide all chrome and record the simulation (C)"
                title="Cinema view — the clean recording surface: no chrome, director camera, holds on the majors (C)"
              >
                🎬 CINEMA
              </button>
              <button
                onClick={tp.onModelOpen}
                className="shrink-0 rounded-md border px-2.5 py-1.5 text-[11px] tracking-wider"
                style={{ borderColor: "rgba(201,150,58,0.45)", color: GOLD }}
                aria-label="How the model works"
              >
                ⓘ THE MODEL
              </button>
              <button
                onClick={tp.onGuideOpen}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold"
                style={{ borderColor: "rgba(201,150,58,0.45)", color: GOLD }}
                aria-label="How to play — reopen the guide"
              >
                ?
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
