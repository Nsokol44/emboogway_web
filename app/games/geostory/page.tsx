import type { Metadata } from "next";
import WaitlistForm from "@/components/WaitlistForm";
import SimulatorApp from "./components/SimulatorApp";

export const metadata: Metadata = {
  title: "Geostory Simulator — What If a New World Power Rose?",
  description: "The Geostory Simulator: an Emboogway × Stratatir hex-map toy model of 21st-century geopolitics. Pick a country, bend the century, and watch territory, influence and economic dominance shift year by year, 2026–2100.",
};

export default function Geostory() {
  return (
    <>
      {/* HEADER */}
      <section className="relative overflow-hidden px-4 pb-5 pt-24 text-center"
        style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(45,90,39,0.22) 0%, transparent 55%), radial-gradient(ellipse at 80% 0%, rgba(201,150,58,0.10) 0%, transparent 50%), #0f0b06" }}>
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(rgba(45,90,39,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,90,39,0.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-3 font-display text-xs tracking-widest text-forest-light">EMBOOGWAY × STRATATIR PRESENT</div>
          <h1 className="mb-2 font-display leading-none"
            style={{ fontSize: "clamp(44px, 9vw, 104px)", letterSpacing: "0.06em", color: "#7acc6a", textShadow: "0 0 60px rgba(45,90,39,0.5), 0 4px 0 rgba(0,0,0,0.5)" }}>
            GEOSTORY SIMULATOR
          </h1>
          <p className="mx-auto mb-4 max-w-2xl font-serif text-lg italic leading-relaxed" style={{ color: "#9ab890" }}>
            What if a new world power rose? Run the century on a hex map — territory, influence,
            markets and technology, driven by real-world dynamics and very unreal what-ifs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] tracking-wide">
            <span className="rounded-full border px-3 py-1" style={{ borderColor: "rgba(201,150,58,0.45)", color: "#f0c060", background: "rgba(201,150,58,0.08)" }}>
              ⚠ A toy model for entertainment — not a forecast.
            </span>
            <span className="rounded-full border px-3 py-1" style={{ borderColor: "rgba(122,204,106,0.35)", color: "#9ab890" }}>
              Baseline data: approximate 2024–26 values, for play
            </span>
            <a href="https://stratatir.substack.com" target="_blank" rel="noreferrer"
              className="rounded-full border px-3 py-1 underline-offset-2 hover:underline"
              style={{ borderColor: "rgba(122,204,106,0.35)", color: "#7acc6a" }}>
              Scenario thinking by Stratatir ↗
            </a>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed" style={{ color: "#77875f" }}>
            Under the hood: GCEIA-style receptivity decides where influence lands; market-access gravity lets
            big economies dominate neighbours before borders ever move; and a Stratatir shock deck — Hormuz
            closures, hydroclimate stress, resource finds, tech breakthroughs — keeps reshuffling the deck.
            Every run is deterministic: same seed, same century.
          </p>
        </div>
      </section>

      {/* THE TOOL */}
      <SimulatorApp />

      {/* FROM TOY TO GAME */}
      <section className="bg-ink px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border p-8"
            style={{ background: "linear-gradient(135deg, #0c1a0a, #1a2e10)", borderColor: "rgba(45,90,39,0.3)" }}>
            <div className="mb-3 font-display text-xs tracking-widest text-forest-light">WHY THIS EXISTS</div>
            <h2 className="mb-4 font-display text-3xl md:text-4xl" style={{ color: "#7acc6a" }}>A PLAYABLE SKETCH OF THE GAME TO COME.</h2>
            <p className="mb-3 leading-relaxed" style={{ color: "#7a9070" }}>
              Geostory the game — fast turns, real geography, branching history — is in development at Emboogway.
              This simulator is its world-model, opened up as a toy: the same instincts about how power actually
              moves (markets first, influence second, borders last) that the full game is being built on, developed
              with the geopolitics research published at{" "}
              <a href="https://stratatir.substack.com" target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: "#7acc6a" }}>Stratatir</a>.
            </p>
            <p className="leading-relaxed" style={{ color: "#7a9070" }}>
              Led by a PhD geographer. Rivers, climate, soil, chokepoints — they actually matter here.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {["PhD Geography", "GIS & Remote Sensing", "Geocomputational AI", "Climate Modelling", "Hex-Map Strategy"].map((tag) => (
                <span key={tag} className="rounded-full border px-3 py-1 text-xs"
                  style={{ background: "rgba(45,90,39,0.2)", color: "#4a9a3e", borderColor: "rgba(45,90,39,0.3)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="waitlist" className="bg-ink px-6 pb-20 pt-4 text-center">
        <div className="mb-6 font-display text-xs tracking-widest text-forest-light">GEOSTORY — KICKSTARTER WAITLIST</div>
        <h2 className="mb-4 font-display text-4xl md:text-5xl" style={{ color: "#7acc6a" }}>READY TO REWRITE HISTORY?</h2>
        <p className="mx-auto mb-8 max-w-md font-serif italic" style={{ color: "#7a9070" }}>
          The full game is coming to Kickstarter (not live yet). Leave your email and we&apos;ll tell you the moment it launches.
        </p>
        <WaitlistForm source="geostory" cta="JOIN THE WAITLIST" />
      </section>
    </>
  );
}
