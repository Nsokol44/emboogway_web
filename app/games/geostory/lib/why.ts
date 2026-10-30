/**
 * Why-lines (improvements item 1a): one plain-language sentence under a
 * major event, built ONLY from the engine's structured cause terms
 * (lib/engine EventCause) — never invented. Returns null when the event
 * carries no cause (shocks, breakaways, older kinds), so callers render
 * the line only where the engine actually explained itself.
 */
import { COUNTRIES } from "./data";
import type { SimEvent } from "./engine";

const nm = (i: number): string => COUNTRIES[i]?.name ?? "?";
const ratioFmt = (r: number): string => (r >= 100 ? "over 100×" : `${r.toFixed(1)}×`);

export function eventWhy(e: SimEvent): string | null {
  const c = e.cause;
  if (!c) return null;
  if (e.kind === "fold") {
    const parts = [
      `${nm(c.driver)} was ${nm(c.subject)}'s dominant partner ${c.streak ?? 5} straight years`,
      `${nm(c.subject)} stability ${c.stability !== undefined ? c.stability.toFixed(2) : "?"} (fold line 0.50)`,
    ];
    if (c.ratio) parts.push(`bloc weight ${ratioFmt(c.ratio)} (needed 1.5×)`);
    if (c.momentum) parts.push(`${nm(c.driver)} banked +${c.momentum.toFixed(1)} momentum`);
    return `Why: ${parts.join("; ")}.`;
  }
  if (e.kind === "annex") {
    const parts: string[] = [];
    if (c.strain !== undefined && c.strain > 0.005) parts.push(`siege strain ${c.strain.toFixed(2)} ground ${nm(c.subject)} down`);
    if (c.stability !== undefined) parts.push(`effective stability ${c.stability.toFixed(2)} (bar 0.50)`);
    if (c.ratio !== undefined) parts.push(`siege ratio ${ratioFmt(c.ratio)}${c.ratioNeeded ? ` vs ${c.ratioNeeded.toFixed(1)} needed` : ""}`);
    if (c.momentum) parts.push(`${nm(c.driver)} banked +${c.momentum.toFixed(1)} momentum`);
    return parts.length ? `Why: ${parts.join("; ")}.` : null;
  }
  if (e.kind === "overtake") {
    if (c.subject !== c.driver && c.driverBloc && c.subjectBloc) {
      return `Why: ${nm(c.driver)}'s bloc (${c.driverBloc}) passed ${nm(c.subject)}'s (${c.subjectBloc}) on accumulated weight — GDP, arms and clients together.`;
    }
    if (c.driverBloc) return `Why: ${nm(c.driver)}'s bloc reached ${c.driverBloc} — top-three weight.`;
    return null;
  }
  return null;
}
