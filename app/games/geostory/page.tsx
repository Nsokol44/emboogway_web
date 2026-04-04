import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Geostory — Historical Strategy Game",
  description: "Geostory is a fast-paced historical strategy game combining deep geography, realism, and customizable scenarios. Recreate ancient empires or forge new futures. Kickstarter coming soon.",
  keywords: ["Geostory", "historical strategy game", "Civilization alternative", "4X strategy", "fast turn strategy", "Kickstarter strategy game"],
};

const fundingGoals = [
  { label: "Core Game", amount: "$120,000", desc: "Base game with 20 historical civilizations, 10 scenarios spanning ancient to modern era, core gameplay loop, PC release", badge: "MVP" },
  { label: "Full Vision", amount: "$300,000", desc: "50 civilizations, scenario editor, multiplayer, modding tools, console ports", badge: "V1.0" },
  { label: "Stretch: Future Scenarios", amount: "$450,000", desc: "Near-future geopolitical scenarios (2050–2150), speculative tech trees, AI-generated events", badge: "STRETCH" },
  { label: "Stretch: Community Atlas", amount: "$600,000", desc: "Full community scenario workshop, real-world geographic data integration, living map updates", badge: "STRETCH" },
];

const backerTiers = [
  { name: "Cartographer", price: "$10", rewards: ["Name in credits", "Digital map of the world (art print)"], color: "#4a9a3e" },
  { name: "Historian", price: "$30", rewards: ["Game copy", "Digital artbook", "Soundtrack"], color: "#4a9a3e" },
  { name: "Strategist", price: "$65", rewards: ["Everything above", "Early beta access", "Exclusive civilization skin"], color: "#7acc6a", popular: true },
  { name: "General", price: "$130", rewards: ["Everything above", "Physical art map print", "Design an in-game leader name"], color: "#4a9a3e" },
  { name: "Architect of Empires", price: "$350", rewards: ["Everything above", "Design a civilization (with dev team)", "Named in game as founding advisor"], color: "#c9963a" },
  { name: "The Chronicler", price: "$1,000", rewards: ["Everything above", "Voice credit as an in-game narrator", "Exclusive backer scenario", "Private dev Q&A"], color: "#f0c060" },
];

export default function Geostory() {
  return (
    <>
      {/* HERO */}
      <section style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 30% 60%, rgba(45,90,39,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(201,150,58,0.08) 0%, transparent 50%), #0f0b06",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden", paddingTop: "80px",
      }}>
        {/* Grid map pattern */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(45,90,39,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(45,90,39,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        {/* Meridian lines */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(ellipse 100% 60% at 50% 50%, transparent 39%, rgba(45,90,39,0.06) 40%, transparent 41%), radial-gradient(ellipse 60% 100% at 50% 50%, transparent 39%, rgba(45,90,39,0.06) 40%, transparent 41%)",
        }} />

        <div className="relative z-10 text-center px-6" style={{ maxWidth: "900px" }}>
          <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#4a9a3e" }}>
            EMBOOGWAY · HISTORICAL STRATEGY
          </div>
          <h1 className="font-display" style={{
            fontSize: "clamp(64px, 13vw, 160px)", lineHeight: 0.9,
            color: "#7acc6a",
            textShadow: "0 0 80px rgba(45,90,39,0.5), 0 4px 0 rgba(0,0,0,0.5)",
            letterSpacing: "0.08em", marginBottom: "24px",
          }}>
            GEOSTORY
          </h1>
          <div className="font-display text-base tracking-widest mb-6" style={{ color: "#4a9a3e" }}>
            WHERE GEOGRAPHY MEETS DESTINY
          </div>
          <p className="font-serif italic text-xl mb-10" style={{ color: "#9ab890", maxWidth: "600px", margin: "0 auto 40px" }}>
            The strategy game Civilization fans have been waiting for. Fast turns. Deep realism. 
            True history — or better.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#kickstarter" className="py-4 px-8 rounded font-display text-sm tracking-widest transition-all duration-200 cursor-pointer"
              style={{ background: "linear-gradient(135deg, #2d5a27, #4a9a3e, #7acc6a, #4a9a3e)", backgroundSize: "300% auto", color: "#0f0b06", boxShadow: "0 4px 20px rgba(45,90,39,0.4)" }}>
              BACK ON KICKSTARTER
            </a>
            <a href="#features" className="btn-outline py-4 px-8 rounded text-sm" style={{ borderColor: "rgba(45,90,39,0.5)", color: "#7acc6a" }}>
              LEARN MORE
            </a>
          </div>
        </div>
      </section>

      {/* THE GAP IN THE MARKET */}
      <section id="features" style={{ padding: "100px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-16">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#4a9a3e" }}>THE PROBLEM</div>
            <h2 className="font-display text-4xl md:text-5xl mb-6" style={{ color: "#7acc6a" }}>
              CIV IS GREAT.<br />IT COULD BE GREATER.
            </h2>
            <p className="leading-relaxed max-w-2xl mx-auto" style={{ color: "#7a9070" }}>
              Civilization moves quickly but sacrifices realism. Victoria and Hearts of Iron go deep 
              but punish new players with slow, painful learning curves. Nobody has nailed the sweet spot: 
              <strong style={{ color: "#7acc6a" }}> fast, deep, and historically grounded in one package.</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "⚡",
                title: "Fast Turns",
                desc: "Every turn feels meaningful without bogging down. Decisions are weighty but never tedious. You'll always want one more turn."
              },
              {
                icon: "🗺️",
                title: "Historical Realism",
                desc: "Leaders with documented personalities, real geographic constraints, historically accurate resource distribution and terrain effects."
              },
              {
                icon: "🔀",
                title: "Branching History",
                desc: "Play the Peloponnesian War exactly as it happened, or diverge it. Recreate WWII or prevent it. Jump to 2150 with extrapolated geopolitics."
              },
              {
                icon: "🌍",
                title: "True Geography",
                desc: "Built by a PhD geographer. Rivers, mountains, climate zones, and soil types actually matter to your civilization's growth and strategy."
              },
              {
                icon: "🏛️",
                title: "Scenario Editor",
                desc: "Design custom historical scenarios and share them with the community. Play community-made recreations of any era you can imagine."
              },
              {
                icon: "🤝",
                title: "Multiplayer",
                desc: "Compete or cooperate with friends across history. Form alliances, wage wars, trade routes — all with the speed your sessions deserve."
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="card-hover p-6 rounded-lg"
                style={{ background: "linear-gradient(135deg, #0c1a0a, #122010)", border: "1px solid rgba(45,90,39,0.25)" }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{icon}</div>
                <div className="font-display text-lg mb-3" style={{ color: "#7acc6a" }}>{title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#5a7850" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE FOUNDER'S EDGE */}
      <section style={{ padding: "80px 0", background: "#0a0704" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div
            className="p-10 rounded-xl"
            style={{ background: "linear-gradient(135deg, #0c1a0a, #1a2e10)", border: "1px solid rgba(45,90,39,0.3)", position: "relative", overflow: "hidden" }}
          >
            <div style={{
              position: "absolute", top: 0, right: 0, width: "300px", height: "300px",
              background: "radial-gradient(circle, rgba(45,90,39,0.12) 0%, transparent 70%)",
            }} />
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#4a9a3e" }}>
              WHY WE CAN BUILD THIS
            </div>
            <h3 className="font-display text-3xl md:text-4xl mb-6" style={{ color: "#7acc6a" }}>
              BUILT BY A GEOGRAPHER. DESIGNED FOR EVERYONE.
            </h3>
            <p className="leading-relaxed mb-4" style={{ color: "#7a9070" }}>
              Geostory is led by a PhD Geographer with a decade of expertise in atmospheric science, 
              geocomputational AI, GIS, and satellite remote sensing. We don&apos;t just reference 
              historical maps — we understand the systems that shaped history.
            </p>
            <p className="leading-relaxed" style={{ color: "#7a9070" }}>
              From real soil data to authentic climate models to documented leader behavior, 
              Geostory will be the most geographically authentic strategy game ever made — 
              without sacrificing a single second of fun.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {["PhD in Geography", "GIS Expert", "Machine Learning", "Data Science", "Climate Modeling", "UAV/Satellite Imagery"].map(tag => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: "rgba(45,90,39,0.2)", color: "#4a9a3e", border: "1px solid rgba(45,90,39,0.3)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCENARIOS */}
      <section style={{ padding: "80px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-12">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#4a9a3e" }}>PLAY HISTORY. CHANGE IT.</div>
            <h2 className="font-display text-4xl md:text-5xl" style={{ color: "#7acc6a" }}>SCENARIOS</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { era: "3000 BCE", name: "Rise of Mesopotamia", desc: "Control the Fertile Crescent. Build the first cities. Dominate ancient trade routes." },
              { era: "490 BCE", name: "The Persian Wars", desc: "Athens vs Persia. Recreate Marathon, Thermopylae, and Salamis — or rewrite them." },
              { era: "218 BCE", name: "Hannibal's March", desc: "Lead Carthage across the Alps into the heart of Rome — or stop him." },
              { era: "1337 CE", name: "The Hundred Years War", desc: "France vs England across a generation. Feudal politics, plague, and gunpowder." },
              { era: "1939 CE", name: "The World at War", desc: "The full WWII theater with authentic leadership, resources, and geography." },
              { era: "2085 CE", name: "The Fractured Earth", desc: "Near-future geopolitics — climate refugees, megacities, and a new Cold War." },
            ].map(({ era, name, desc }) => (
              <div
                key={name}
                className="card-hover p-5 rounded-lg"
                style={{ background: "#0c1a0a", border: "1px solid rgba(45,90,39,0.2)" }}
              >
                <div className="font-display text-xs tracking-widest mb-2" style={{ color: "#4a9a3e" }}>{era}</div>
                <div className="font-display text-lg mb-2" style={{ color: "#7acc6a" }}>{name}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#5a7850" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KICKSTARTER */}
      <section id="kickstarter" style={{ padding: "100px 0", background: "#0a0704" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-16">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#4a9a3e" }}>KICKSTARTER CAMPAIGN</div>
            <h2 className="font-display text-4xl md:text-6xl mb-4" style={{ color: "#7acc6a" }}>FUND THE FUTURE</h2>
            <p className="font-serif italic" style={{ color: "#7a9070" }}>
              Back Geostory and help us build the strategy game geography always deserved.
            </p>
          </div>

          {/* Funding goals */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {fundingGoals.map(({ label, amount, desc, badge }) => (
              <div
                key={label}
                className="p-6 rounded-lg"
                style={{ background: "#0c1a0a", border: "1px solid rgba(45,90,39,0.25)" }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-display text-sm tracking-wide" style={{ color: "#9ab890" }}>{label}</div>
                  <span
                    className="text-xs px-2 py-1 rounded font-display tracking-widest"
                    style={{
                      background: badge === "MVP" ? "rgba(45,90,39,0.3)" : badge === "V1.0" ? "rgba(201,150,58,0.2)" : "rgba(196,62,28,0.15)",
                      color: badge === "MVP" ? "#7acc6a" : badge === "V1.0" ? "#f0c060" : "#c43e1c",
                      border: `1px solid ${badge === "MVP" ? "rgba(45,90,39,0.4)" : badge === "V1.0" ? "rgba(201,150,58,0.3)" : "rgba(196,62,28,0.3)"}`,
                    }}
                  >
                    {badge}
                  </span>
                </div>
                <div className="font-display text-3xl mb-3" style={{ color: "#7acc6a" }}>{amount}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#4a7040" }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Backer tiers */}
          <h3 className="font-display text-2xl md:text-3xl text-center mb-8" style={{ color: "#7acc6a" }}>BACKER TIERS</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {backerTiers.map((t: { name: string; price: string; rewards: string[]; color: string; popular?: boolean }) => (
              <div
                key={t.name}
                className="card-hover p-6 rounded-lg relative"
                style={{
                  background: t.popular ? "linear-gradient(135deg, #0c1a0a, #162510)" : "#0c1a0a",
                  border: `1px solid ${t.popular ? t.color : "rgba(45,90,39,0.2)"}`,
                  boxShadow: t.popular ? `0 0 30px rgba(122,204,106,0.12)` : "none",
                }}
              >
                {t.popular && (
                  <div
                    className="absolute -top-3 left-1/2 font-display text-xs tracking-widest px-3 py-1 rounded"
                    style={{ transform: "translateX(-50%)", background: t.color, color: "#0f0b06" }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <div className="font-display text-xl mb-1" style={{ color: t.color }}>{t.name}</div>
                <div className="font-display text-4xl mb-4" style={{ color: "#7acc6a" }}>{t.price}</div>
                <ul className="space-y-2">
                  {t.rewards.map((r: string) => (
                    <li key={r} className="text-sm flex items-start gap-2" style={{ color: "#7a9070" }}>
                      <span style={{ color: t.color, flexShrink: 0 }}>✓</span> {r}
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full mt-6 py-3 rounded font-display text-sm tracking-widest transition-all duration-200"
                  style={{
                    background: t.popular ? t.color : "transparent",
                    color: t.popular ? "#0f0b06" : t.color,
                    border: `1px solid ${t.color}`,
                  }}
                >
                  PLEDGE {t.price}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 32px", textAlign: "center", background: "radial-gradient(ellipse at 50% 50%, rgba(45,90,39,0.08) 0%, transparent 70%), #0f0b06" }}>
        <h2 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#7acc6a" }}>READY TO REWRITE HISTORY?</h2>
        <p className="font-serif italic mb-8" style={{ color: "#7a9070" }}>Join the Geostory community. Shape what gets built.</p>
        <a href="#kickstarter" className="inline-block py-4 px-10 rounded font-display text-sm tracking-widest"
          style={{ background: "linear-gradient(135deg, #2d5a27, #4a9a3e)", color: "#0f0b06", boxShadow: "0 4px 20px rgba(45,90,39,0.4)" }}>
          BACK GEOSTORY NOW
        </a>
      </section>
    </>
  );
}
