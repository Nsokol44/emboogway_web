import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geostory — Historical Strategy Game",
  description: "Geostory is a fast-paced historical strategy game combining deep geography, realism, and customizable scenarios. Coming to Kickstarter from Emboogway.",
};

const backerTiers = [
  { name: "Cartographer", price: "$10", rewards: ["Name in credits", "Digital map art print"], popular: false },
  { name: "Historian", price: "$30", rewards: ["Game copy", "Digital artbook", "Soundtrack"], popular: false },
  { name: "Strategist", price: "$65", rewards: ["Everything above", "Early beta access", "Exclusive civilization skin"], popular: true },
  { name: "General", price: "$130", rewards: ["Everything above", "Physical art map print", "Design an in-game leader name"], popular: false },
  { name: "Architect of Empires", price: "$350", rewards: ["Everything above", "Design a civilization with dev team", "Named as founding advisor"], popular: false },
  { name: "The Chronicler", price: "$1,000", rewards: ["Everything above", "Voice credit as narrator", "Exclusive backer scenario", "Private dev Q&A"], popular: false },
];

export default function Geostory() {
  return (
    <>
      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20"
        style={{ background: "radial-gradient(ellipse at 30% 60%, rgba(45,90,39,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(201,150,58,0.06) 0%, transparent 50%), #0f0b06" }}>
        {/* Map grid */}
        <div className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(rgba(45,90,39,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,90,39,0.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="font-display text-xs tracking-widest text-forest-light mb-6">EMBOOGWAY · HISTORICAL STRATEGY</div>
          <h1 className="font-display leading-none mb-4"
            style={{ fontSize: "clamp(60px, 13vw, 150px)", letterSpacing: "0.08em", color: "#7acc6a", textShadow: "0 0 80px rgba(45,90,39,0.5), 0 4px 0 rgba(0,0,0,0.5)" }}>
            GEOSTORY
          </h1>
          <div className="font-display text-base tracking-widest text-forest-light mb-6">WHERE GEOGRAPHY MEETS DESTINY</div>
          <p className="font-serif italic text-xl max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "#9ab890" }}>
            The strategy game Civilization fans have been waiting for. Fast turns. Deep realism. True history — or better.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#kickstarter"
              className="font-display tracking-widest px-8 py-4 rounded text-base hover:opacity-90 transition-all text-ink"
              style={{ background: "linear-gradient(135deg, #2d5a27, #4a9a3e, #7acc6a)", boxShadow: "0 4px 20px rgba(45,90,39,0.4)" }}>
              BACK ON KICKSTARTER
            </a>
            <a href="#features"
              className="font-display tracking-widest px-8 py-4 rounded text-base transition-all border"
              style={{ borderColor: "rgba(45,90,39,0.5)", color: "#7acc6a", background: "transparent" }}>
              LEARN MORE
            </a>
          </div>
        </div>
      </section>

      {/* THE GAP */}
      <section id="features" className="py-24 bg-ink">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="font-display text-xs tracking-widest text-forest-light mb-4">THE PROBLEM</div>
            <h2 className="font-display text-4xl md:text-5xl mb-6" style={{ color: "#7acc6a" }}>CIV IS GREAT.<br />IT COULD BE GREATER.</h2>
            <p className="leading-relaxed max-w-2xl mx-auto text-cream-dim/60">
              Nobody has nailed the sweet spot: <strong style={{ color: "#7acc6a" }}>fast, deep, and historically grounded</strong> in one package. Geostory does all three.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "⚡", title: "Fast Turns", desc: "Every decision is weighty without being tedious. You'll always want one more turn." },
              { icon: "🗺️", title: "Historical Realism", desc: "Real leaders, real geography, real constraints. History that actually feels like history." },
              { icon: "🔀", title: "Branching History", desc: "Play the Peloponnesian War exactly as it happened — or diverge it entirely." },
              { icon: "🌍", title: "True Geography", desc: "Built by a PhD geographer. Rivers, climate, soil — they actually matter here." },
              { icon: "🏛️", title: "Scenario Editor", desc: "Design and share custom historical scenarios with the community." },
              { icon: "🤝", title: "Multiplayer", desc: "Compete or cooperate across history with the speed your sessions deserve." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-6 rounded-xl border hover:-translate-y-1 transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #0c1a0a, #122010)", borderColor: "rgba(45,90,39,0.25)" }}>
                <div className="text-3xl mb-3">{icon}</div>
                <div className="font-display text-lg mb-2" style={{ color: "#7acc6a" }}>{title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#5a7850" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDER EDGE */}
      <section className="py-20 bg-ink/50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="p-10 rounded-xl border"
            style={{ background: "linear-gradient(135deg, #0c1a0a, #1a2e10)", borderColor: "rgba(45,90,39,0.3)" }}>
            <div className="font-display text-xs tracking-widest text-forest-light mb-4">WHY WE CAN BUILD THIS</div>
            <h3 className="font-display text-3xl md:text-4xl mb-6" style={{ color: "#7acc6a" }}>BUILT BY A GEOGRAPHER.</h3>
            <p className="leading-relaxed mb-4" style={{ color: "#7a9070" }}>
              Geostory is led by a PhD Geographer with expertise in atmospheric science, geocomputational AI, GIS, and satellite remote sensing. We don&apos;t just reference historical maps — we understand the systems that shaped history.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {["PhD Geography", "GIS Expert", "Machine Learning", "Data Science", "Climate Modeling", "UAV/Satellite Imagery"].map(tag => (
                <span key={tag} className="text-xs px-3 py-1 rounded-full border"
                  style={{ background: "rgba(45,90,39,0.2)", color: "#4a9a3e", borderColor: "rgba(45,90,39,0.3)" }}>{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENARIOS */}
      <section className="py-20 bg-ink">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="font-display text-xs tracking-widest text-forest-light mb-4">PLAY HISTORY. CHANGE IT.</div>
            <h2 className="font-display text-4xl md:text-5xl" style={{ color: "#7acc6a" }}>SCENARIOS</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { era: "3000 BCE", name: "Rise of Mesopotamia", desc: "Control the Fertile Crescent. Build the first cities. Dominate ancient trade routes." },
              { era: "490 BCE", name: "The Persian Wars", desc: "Athens vs Persia. Recreate Marathon, Thermopylae, Salamis — or rewrite them." },
              { era: "218 BCE", name: "Hannibal's March", desc: "Lead Carthage across the Alps into the heart of Rome — or stop him." },
              { era: "1337 CE", name: "The Hundred Years War", desc: "France vs England across a generation. Feudal politics, plague, and gunpowder." },
              { era: "1939 CE", name: "The World at War", desc: "Full WWII theater with authentic leadership, resources, and geography." },
              { era: "2085 CE", name: "The Fractured Earth", desc: "Near-future geopolitics — climate refugees, megacities, and a new Cold War." },
            ].map(({ era, name, desc }) => (
              <div key={name} className="p-5 rounded-xl border hover:-translate-y-1 transition-all duration-200"
                style={{ background: "#0c1a0a", borderColor: "rgba(45,90,39,0.2)" }}>
                <div className="font-display text-xs tracking-widest text-forest-light mb-2">{era}</div>
                <div className="font-display text-lg mb-2" style={{ color: "#7acc6a" }}>{name}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#5a7850" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KICKSTARTER */}
      <section id="kickstarter" className="py-24 bg-ink/80">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="font-display text-xs tracking-widest text-forest-light mb-4">KICKSTARTER CAMPAIGN</div>
            <h2 className="font-display text-4xl md:text-6xl mb-4" style={{ color: "#7acc6a" }}>FUND THE FUTURE</h2>
            <p className="font-serif italic" style={{ color: "#7a9070" }}>Back Geostory and help build the strategy game geography always deserved.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {[
              { label: "Core Game", amount: "$120,000", desc: "20 civilizations, 10 scenarios, core gameplay, PC release", badge: "MVP" },
              { label: "Full Vision", amount: "$300,000", desc: "50 civilizations, scenario editor, multiplayer, modding tools, console ports", badge: "V1.0" },
              { label: "Stretch: Future Scenarios", amount: "$450,000", desc: "Near-future geopolitical scenarios (2050–2150), speculative tech trees", badge: "STRETCH" },
              { label: "Stretch: Community Atlas", amount: "$600,000", desc: "Full community scenario workshop, real-world geographic data integration", badge: "STRETCH" },
            ].map(({ label, amount, desc, badge }) => (
              <div key={label} className="p-6 rounded-xl border"
                style={{ background: "#0c1a0a", borderColor: "rgba(45,90,39,0.25)" }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="font-display text-sm tracking-wide" style={{ color: "#9ab890" }}>{label}</div>
                  <span className="text-xs px-2 py-1 rounded font-display tracking-widest border"
                    style={{
                      background: badge === "MVP" ? "rgba(45,90,39,0.3)" : badge === "V1.0" ? "rgba(201,150,58,0.2)" : "rgba(196,62,28,0.15)",
                      color: badge === "MVP" ? "#7acc6a" : badge === "V1.0" ? "#f0c060" : "#c43e1c",
                      borderColor: badge === "MVP" ? "rgba(45,90,39,0.4)" : badge === "V1.0" ? "rgba(201,150,58,0.3)" : "rgba(196,62,28,0.3)",
                    }}>{badge}</span>
                </div>
                <div className="font-display text-3xl mb-3" style={{ color: "#7acc6a" }}>{amount}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#4a7040" }}>{desc}</p>
              </div>
            ))}
          </div>

          <h3 className="font-display text-2xl text-center mb-8" style={{ color: "#7acc6a" }}>BACKER TIERS</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {backerTiers.map((t) => (
              <div key={t.name} className="relative p-6 rounded-xl border hover:-translate-y-1 transition-all"
                style={{
                  background: t.popular ? "linear-gradient(135deg, #0c1a0a, #162510)" : "#0c1a0a",
                  borderColor: t.popular ? "#7acc6a" : "rgba(45,90,39,0.2)",
                  boxShadow: t.popular ? "0 0 30px rgba(122,204,106,0.1)" : "none",
                }}>
                {t.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 font-display text-xs tracking-widest px-3 py-1 rounded text-ink"
                    style={{ background: "#7acc6a" }}>MOST POPULAR</div>
                )}
                <div className="font-display text-xl mb-1 text-forest-light">{t.name}</div>
                <div className="font-display text-4xl mb-4" style={{ color: "#7acc6a" }}>{t.price}</div>
                <ul className="space-y-2">
                  {t.rewards.map(r => (
                    <li key={r} className="text-sm flex items-start gap-2" style={{ color: "#7a9070" }}>
                      <span className="text-forest-light flex-shrink-0">✓</span> {r}
                    </li>
                  ))}
                </ul>
                <button className="w-full mt-6 py-3 rounded font-display text-sm tracking-widest border transition-all"
                  style={{
                    background: t.popular ? "#7acc6a" : "transparent",
                    color: t.popular ? "#0f0b06" : "#7acc6a",
                    borderColor: "#7acc6a",
                  }}>PLEDGE {t.price}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 text-center bg-ink">
        <h2 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#7acc6a" }}>READY TO REWRITE HISTORY?</h2>
        <p className="font-serif italic mb-8" style={{ color: "#7a9070" }}>Join the Geostory community. Shape what gets built.</p>
        <a href="#kickstarter" className="inline-block font-display tracking-widest px-10 py-4 rounded text-base text-ink hover:opacity-90 transition-opacity"
          style={{ background: "linear-gradient(135deg, #2d5a27, #4a9a3e)", boxShadow: "0 4px 20px rgba(45,90,39,0.4)" }}>
          BACK GEOSTORY NOW
        </a>
      </section>
    </>
  );
}
