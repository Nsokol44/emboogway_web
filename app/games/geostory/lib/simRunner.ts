"use client";
/* ── Running centuries without freezing the page ─────────────────────────
   A full 2026–2100 run is ~0.3 s on a desktop and ~1 s on a mid-range
   phone. Three rules keep the page responsive:

   1. CACHE BY simKey. A config's key fixes its history exactly, so a run
      is computed once per key and reused — editing one comparison sim
      never re-runs the others, and re-committing an unchanged slider is
      free.
   2. EDITS RUN IN A WORKER. When a panel's config changes, it keeps
      showing its previous century (flagged `pending`) while the new one
      is computed off the main thread; it swaps in when ready.
   3. FIRST PAINT STAYS SYNCHRONOUS. A panel with no previous century
      (first load, a new comparison sim) computes on the main thread, so
      server render and hydration see the same history.

   Nothing here touches the model: same engine, same inputs, same century. */
import { useEffect, useReducer, useRef } from "react";
import { runSimulation, simKey, type SimConfig, type SimResult } from "./engine";

const CACHE_MAX = 6; // a run is a few MB in memory; 4 panels + a little history
const cache = new Map<string, SimResult>();

function cachePut(key: string, r: SimResult) {
  cache.delete(key);
  cache.set(key, r);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}
function cacheGet(key: string): SimResult | undefined {
  const r = cache.get(key);
  if (r) { cache.delete(key); cache.set(key, r); } // LRU touch
  return r;
}

/** Synchronous run through the cache — for first paint and for callers
 *  that need a history right now (the Away card on return). Seeding the
 *  cache here means the panels never compute the same century twice. */
export function runCached(cfg: SimConfig): SimResult {
  const key = simKey(cfg);
  const hit = cacheGet(key);
  if (hit) return hit;
  const r = runSimulation(cfg);
  cachePut(key, r);
  return r;
}

/* ---- the worker client: one worker, de-duplicated requests ------------- */
let worker: Worker | null = null;
let workerBroken = false;
const inflight = new Set<string>();
const listeners = new Set<() => void>();

function getWorker(): Worker | null {
  if (workerBroken || typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ key: string; result?: SimResult; error?: string }>) => {
      const { key, result } = e.data;
      inflight.delete(key);
      if (result) cachePut(key, result);
      else workerBroken = true; // fall back to main-thread runs from here on
      listeners.forEach((l) => l());
    };
    worker.onerror = () => {
      workerBroken = true;
      inflight.clear();
      listeners.forEach((l) => l());
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function request(key: string, cfg: SimConfig) {
  if (inflight.has(key) || cache.has(key)) return;
  const w = getWorker();
  if (!w) return;
  inflight.add(key);
  w.postMessage({ key, cfg });
}

export interface PanelRun { result: SimResult; pending: boolean }

/** One history per panel. A panel whose config changed keeps its previous
 *  century, `pending: true`, until the worker hands back the new one. */
export function useSimResults(panels: { id: number; cfg: SimConfig }[]): PanelRun[] {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const shown = useRef(new Map<number, SimResult>());

  useEffect(() => {
    listeners.add(bump);
    return () => { listeners.delete(bump); };
  }, []);

  const runs: PanelRun[] = [];
  const want: { key: string; cfg: SimConfig }[] = [];
  for (const p of panels) {
    const key = simKey(p.cfg);
    const hit = cacheGet(key);
    const prev = shown.current.get(p.id);
    if (hit) {
      shown.current.set(p.id, hit);
      runs.push({ result: hit, pending: false });
    } else if (prev && !workerBroken && typeof Worker !== "undefined") {
      want.push({ key, cfg: p.cfg });
      runs.push({ result: prev, pending: true });
    } else {
      const r = runCached(p.cfg);
      shown.current.set(p.id, r);
      runs.push({ result: r, pending: false });
    }
  }
  // forget panels that were removed
  for (const id of [...shown.current.keys()]) if (!panels.some((p) => p.id === id)) shown.current.delete(id);

  const wantSig = want.map((w) => w.key).join("|");
  useEffect(() => {
    for (const w of want) request(w.key, w.cfg);
    // a worker that broke mid-flight: re-render, the fallback runs inline
    if (want.length && workerBroken) bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantSig]);

  return runs;
}
