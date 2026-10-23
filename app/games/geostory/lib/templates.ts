/**
 * What-if templates — one-click named forks on the scenario screen.
 * Each is just a preset of the ordinary run inputs (scenario, boosts,
 * rivals, deck, world modifiers), so a forked run is still an ordinary
 * deterministic run: same config, same history, shareable as a link.
 */
import { DEFAULT_DECK, ZERO_BOOSTS, type SimConfig } from "./engine";

export interface WhatIfTemplate {
  id: string;
  name: string;
  desc: string;
  patch: Partial<SimConfig>;
}

export const WHATIF_TEMPLATES: WhatIfTemplate[] = [
  {
    id: "hormuz-forever",
    name: "Hormuz Closes for Good",
    desc: "The strait shuts in 2030 — and keeps shutting, every six years.",
    patch: {
      scenarioId: "chokepoint",
      focusCode: undefined,
      boosts: { ...ZERO_BOOSTS },
      rivals: [],
      deck: { ...DEFAULT_DECK, chaos: 1.4 },
      modifiers: ["hormuz-perma"],
    },
  },
  {
    id: "india-indonesia-leap",
    name: "India + Indonesia Tech Leap",
    desc: "Two giants get a decade of directed research, head to head.",
    patch: {
      scenarioId: "techrace",
      focusCode: "IND",
      boosts: { growth: 55, tech: 85, military: 25, resources: 40 },
      rivals: [{ code: "IDN", boosts: { growth: 60, tech: 85, military: 25, resources: 45 } }],
      deck: { ...DEFAULT_DECK },
      modifiers: [],
    },
  },
  {
    id: "europe-rearms",
    name: "Europe Re-arms",
    desc: "The old continent spends like it means it, all century.",
    patch: {
      scenarioId: "multipolar",
      focusCode: undefined,
      boosts: { ...ZERO_BOOSTS },
      rivals: [],
      deck: { ...DEFAULT_DECK },
      modifiers: ["europe-rearm"],
    },
  },
  {
    id: "dry-sahel",
    name: "A Dry Decade for the Sahel",
    desc: "Megadrought every other year through the 2030s.",
    patch: {
      scenarioId: "sahel",
      focusCode: "NER",
      boosts: { ...ZERO_BOOSTS },
      rivals: [],
      deck: { ...DEFAULT_DECK },
      modifiers: ["sahel-dry"],
    },
  },
];
