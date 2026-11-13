/// <reference lib="webworker" />
/* The century, off the main thread. Same engine module, same inputs, so
   the same history as a main-thread run — determinism is a property of
   the engine (seeded RNG, no clock, no Math.random), not of the thread.
   Protocol: { key, cfg } in → { key, result } or { key, error } out. */
import { runSimulation, type SimConfig } from "./engine";

self.onmessage = (e: MessageEvent<{ key: string; cfg: SimConfig }>) => {
  const { key, cfg } = e.data;
  try {
    (self as unknown as Worker).postMessage({ key, result: runSimulation(cfg) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ key, error: String(err) });
  }
};
