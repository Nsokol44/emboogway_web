import type { Metadata } from "next";
import WaitlistForm from "@/components/WaitlistForm";
import SimulatorApp from "./components/SimulatorApp";

export const metadata: Metadata = {
  title: "GeoStory Simulator — What If a New World Power Rose?",
  description: "The GeoStory Simulator: an Emboogway × Stratatir hex-map toy model of 21st-century geopolitics. Pick a country, bend the century, and watch territory, influence and economic dominance shift year by year, 2026–2100.",
};

/** engraved compass rose for the masthead lockup */
function CompassMark({ size = 54 }: { size?: number }) {
  const spikes = Array.from({ length: 8 }, (_, k) => {
    const a = (Math.PI / 4) * k - Math.PI / 2;
    const long = k % 2 === 0;
    const len = long ? 21 : 12;
    const wdt = long ? 3.4 : 2.2;
    const px = 27 + Math.cos(a) * len, py = 27 + Math.sin(a) * len;
    const bx = 27 + Math.cos(a + Math.PI / 2) * wdt, by = 27 + Math.sin(a + Math.PI / 2) * wdt;
    const bx2 = 27 + Math.cos(a - Math.PI / 2) * wdt, by2 = 27 + Math.sin(a - Math.PI / 2) * wdt;
    return <polygon key={k} points={`${bx},${by} ${px},${py} ${bx2},${by2}`} fill={long ? "#f0c060" : "rgba(240,192,96,0.45)"} />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden>
      <circle cx="27" cy="27" r="25.5" fill="none" stroke="rgba(240,192,96,0.55)" strokeWidth="1" />
      <circle cx="27" cy="27" r="19.5" fill="none" stroke="rgba(240,192,96,0.3)" strokeWidth="0.7" />
      {spikes}
      <circle cx="27" cy="27" r="2.6" fill="#f0c060" />
    </svg>
  );
}

const GOLD = "#f0c060";
const GOLD_DEEP = "#c9963a";
const CREAM = "#f7f0e3";
const PARCH = "#cdbfa5";
const MUTED = "#93a7bd";

export default function Geostory() {
  return (
    <div style={{ background: "#050f1d" }}>
      {/* MASTHEAD */}
      <section className="relative overflow-hidden px-4 pb-6 pt-24 text-center"
        style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(23,58,99,0.55) 0%, transparent 60%), radial-gradient(ellipse at 85% 10%, rgba(201,150,58,0.08) 0%, transparent 45%), #050f1d" }}>
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(rgba(127,176,224,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(127,176,224,0.045) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-3 flex justify-center"><CompassMark /></div>
          <div className="mb-2 font-display text-xs tracking-[0.38em]" style={{ color: GOLD }}>
            EMBOOGWAY × STRATATIR
          </div>
          <h1 className="leading-none">
            <span className="block font-serif font-black" style={{ fontSize: "clamp(52px, 10vw, 108px)", color: CREAM, textShadow: "0 6px 34px rgba(13,47,82,0.9), 0 2px 0 rgba(0,0,0,0.6)" }}>
              GeoStory
            </span>
            <span className="mt-2 flex items-center justify-center gap-4">
              <span className="h-px w-14 sm:w-24" style={{ background: "linear-gradient(90deg, transparent, #c9963a)" }} />
              <span className="font-display" style={{ fontSize: "clamp(26px, 5vw, 50px)", letterSpacing: "0.34em", color: GOLD, paddingLeft: "0.34em" }}>
                SIMULATOR
              </span>
              <span className="h-px w-14 sm:w-24" style={{ background: "linear-gradient(90deg, #c9963a, transparent)" }} />
            </span>
          </h1>
          <p className="mx-auto mb-5 mt-4 max-w-2xl font-serif text-lg italic leading-relaxed" style={{ color: PARCH }}>
            What if a new world power rose? Run the century on a hex map — territory, influence,
            markets and technology, driven by real-world dynamics and very unreal what-ifs.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] tracking-wide">
            <span className="rounded-full border px-3 py-1" style={{ borderColor: "rgba(201,150,58,0.5)", color: GOLD, background: "rgba(201,150,58,0.08)" }}>
              ⚠ A toy model for entertainment — not a forecast.
            </span>
            <span className="rounded-full border px-3 py-1" style={{ borderColor: "rgba(147,167,189,0.35)", color: MUTED }}>
              Baseline data: approximate 2024–26 values, for play
            </span>
            <a href="https://stratatir.substack.com" target="_blank" rel="noreferrer"
              className="rounded-full border px-3 py-1 underline-offset-2 hover:underline"
              style={{ borderColor: "rgba(147,167,189,0.35)", color: GOLD }}>
              Scenario thinking by Stratatir ↗
            </a>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-xs leading-relaxed" style={{ color: MUTED }}>
            Under the hood: GCEIA-style receptivity decides where influence lands; market-access gravity lets
            big economies dominate neighbours before borders ever move; and a Stratatir shock deck — Hormuz and
            Malacca closures, hydroclimate stress, lithium rushes, Arctic openings — keeps reshuffling the century.
            Every run is deterministic: same seed, same history.
          </p>
          <div className="mx-auto mt-6 max-w-xl">
            <div style={{ borderTop: `1px solid ${GOLD_DEEP}` }} />
            <div className="mt-[3px]" style={{ borderTop: "1px solid rgba(201,150,58,0.35)" }} />
          </div>
        </div>
      </section>

      {/* THE TOOL */}
      <SimulatorApp />

      {/* FROM TOY TO GAME */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border p-8"
            style={{ background: "linear-gradient(140deg, #081c33, #0a2547)", borderColor: "rgba(201,150,58,0.30)" }}>
            <div className="mb-3 font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>WHY THIS EXISTS</div>
            <h2 className="mb-4 font-serif text-3xl font-bold md:text-4xl" style={{ color: CREAM }}>A playable sketch of the game to come.</h2>
            <p className="mb-3 leading-relaxed" style={{ color: PARCH }}>
              Geostory the game — fast turns, real geography, branching history — is in development at Emboogway.
              This simulator is its world-model, opened up as a toy: the same instincts about how power actually
              moves (markets first, influence second, borders last) that the full game is being built on, developed
              with the geopolitics research published at{" "}
              <a href="https://stratatir.substack.com" target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: GOLD }}>Stratatir</a>.
            </p>
            <p className="leading-relaxed" style={{ color: PARCH }}>
              Led by a PhD geographer. Rivers, climate, soil, chokepoints — they actually matter here.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {["PhD Geography", "GIS & Remote Sensing", "Geocomputational AI", "Climate Modelling", "Hex-Map Strategy"].map((tag) => (
                <span key={tag} className="rounded-full border px-3 py-1 text-xs"
                  style={{ background: "rgba(13,47,82,0.5)", color: GOLD, borderColor: "rgba(201,150,58,0.35)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="waitlist" className="px-6 pb-20 pt-4 text-center">
        <div className="mb-6 font-display text-xs tracking-[0.3em]" style={{ color: GOLD }}>GEOSTORY — KICKSTARTER WAITLIST</div>
        <h2 className="mb-4 font-display text-4xl md:text-5xl" style={{ color: GOLD }}>READY TO REWRITE HISTORY?</h2>
        <p className="mx-auto mb-8 max-w-md font-serif italic" style={{ color: PARCH }}>
          The full game is coming to Kickstarter (not live yet). Leave your email and we&apos;ll tell you the moment it launches.
        </p>
        <WaitlistForm source="geostory" cta="JOIN THE WAITLIST" />
      </section>
    </div>
  );
}
