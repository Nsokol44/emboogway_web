import type { Metadata } from "next";
import HillsGame from "./components/HillsGame";

export const metadata: Metadata = {
  title: "What We Left in The Hills — Appalachian Survival Escape",
  description:
    "A third-person survival escape in a foggy Appalachian holler. You start loaded with loot; the hills want it back. Drop weight to move quiet, listen for what hunts you, and reach the county road before nightfall.",
  openGraph: {
    type: "website",
    url: "https://www.emboogway.com/games/what-we-left-in-the-hills",
    siteName: "Emboogway",
    title: "What We Left in The Hills | Emboogway",
    description:
      "Speed vs noise vs loot. A playable survival escape in one haunted holler — fog, monsters you hear before you see, and seven minutes to nightfall.",
  },
  twitter: {
    card: "summary_large_image",
    title: "What We Left in The Hills | Emboogway",
    description:
      "A survival escape in a foggy Appalachian holler. What you carry makes you loud. What you drop stays in the hills.",
  },
};

const GOLD = "#f0c060";
const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MOON = "#7fe7d2";

export default function WhatWeLeftInTheHills() {
  return (
    <div style={{ background: "#0b100b" }}>
      {/* THE GAME — a full-screen stage, like GeoStory's */}
      <HillsGame />

      {/* BELOW THE FOLD */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 font-display text-xs tracking-[0.3em]" style={{ color: MOON }}>
            WHY THIS EXISTS
          </div>
          <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl" style={{ color: CREAM }}>
            Every escape is an argument with your own pack.
          </h2>
          <p className="mb-3 leading-relaxed" style={{ color: PARCH }}>
            What We Left in The Hills is a short survival game about a trade nobody wins clean: the loot on
            your back is your score, your ballast, and your noise. Drop the iron tools and you can run quiet.
            Keep the fiddle and everybody in the holler knows where you are.
          </p>
          <p className="leading-relaxed" style={{ color: PARCH }}>
            The monsters are never named and never quite seen — tall shapes in the fog, known by sound. Their
            growls are real spatial audio: louder and to the left means closer and to the left. The fog rolls
            in and out, hides you, slows you, and lies to you. Seven minutes to nightfall.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {["Third Person", "Survival Escape", "Stealth by Ear", "Appalachia", "Single Player", "Free in Browser"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ background: "rgba(20,32,22,0.6)", color: MOON, borderColor: "rgba(127,231,210,0.3)" }}
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-8 text-sm" style={{ color: GOLD }}>
            Headphones recommended. Plays on phone or desktop — touch controls included.
          </p>
        </div>
      </section>
    </div>
  );
}
