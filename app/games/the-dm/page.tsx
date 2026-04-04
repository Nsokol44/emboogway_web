import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The DM — 2D Action RPG",
  description: "The DM is a 2D action-RPG where one player becomes the Dungeon Master. 13 D&D classes, asymmetric multiplayer, 5-act campaign. Coming to Kickstarter from Emboogway.",
  keywords: ["The DM game", "2D RPG Kickstarter", "dungeon master game", "asymmetric multiplayer", "indie RPG", "D&D video game"],
};

const classes = [
  { name: "Fighter", role: "Tank", icon: "⚔️" },
  { name: "Rogue", role: "Stealth", icon: "🗡️" },
  { name: "Wizard", role: "Arcane", icon: "✨" },
  { name: "Cleric", role: "Healer", icon: "☀️" },
  { name: "Ranger", role: "Scout", icon: "🏹" },
  { name: "Paladin", role: "Holy", icon: "🛡️" },
  { name: "Barbarian", role: "Berserker", icon: "🪓" },
  { name: "Druid", role: "Nature", icon: "🌿" },
  { name: "Bard", role: "Support", icon: "🎶" },
  { name: "Warlock", role: "Dark", icon: "🔮" },
  { name: "Monk", role: "Agile", icon: "👊" },
  { name: "Sorcerer", role: "Wild", icon: "⚡" },
  { name: "Artificer", role: "Inventor", icon: "⚙️" },
];

const tiers = [
  { name: "Apprentice", price: "$10", rewards: ["Digital thank-you scroll", "Name in credits"], color: "#7a5e20" },
  { name: "Adventurer", price: "$25", rewards: ["Game copy", "Digital artbook", "Soundtrack"], color: "#c9963a", popular: false },
  { name: "Champion", price: "$60", rewards: ["Everything above", "Early access beta", "Exclusive cosmetic armor set"], color: "#f0c060", popular: true },
  { name: "Guild Master", price: "$120", rewards: ["Everything above", "Physical artbook", "Signed poster", "DM Mode alpha access"], color: "#c9963a" },
  { name: "Archmage", price: "$300", rewards: ["Everything above", "Design a dungeon room", "Your name as an in-game NPC"], color: "#c43e1c" },
  { name: "The DM", price: "$1,000", rewards: ["Everything above", "Voice-acted NPC in game", "Private Q&A with dev team", "Legendary backer cosmetics"], color: "#f0c060" },
];

export default function TheDM() {
  return (
    <>
      {/* HERO */}
      <section style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 80%, rgba(139,26,26,0.2) 0%, rgba(42,21,5,0.8) 50%, #0f0b06 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden", paddingTop: "80px", paddingBottom: "60px",
      }}>
        {/* Rune rings */}
        <div style={{
          position: "absolute", width: "700px", height: "700px",
          border: "1px solid rgba(201,150,58,0.07)", borderRadius: "50%",
          top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          animation: "spin 80s linear infinite",
        }} />
        <div style={{
          position: "absolute", width: "500px", height: "500px",
          border: "1px solid rgba(201,150,58,0.05)", borderRadius: "50%",
          top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          animation: "spin 50s linear infinite reverse",
        }} />
        <style>{`@keyframes spin { to { transform: translate(-50%,-50%) rotate(360deg); } }`}</style>

        <div className="relative z-10 text-center px-6" style={{ maxWidth: "800px" }}>
          <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#c43e1c" }}>
            EMBOOGWAY · 2D ACTION RPG
          </div>
          <h1 className="font-display" style={{
            fontSize: "clamp(80px, 16vw, 180px)", lineHeight: 0.9, color: "#f0c060",
            textShadow: "0 0 100px rgba(196,62,28,0.4), 0 0 40px rgba(201,150,58,0.3)",
            letterSpacing: "0.05em", marginBottom: "24px",
          }}>
            THE DM
          </h1>
          <div className="font-display text-lg tracking-widest mb-6" style={{ color: "#c9963a" }}>
            THE DUNGEON MASTER
          </div>
          <p className="font-serif italic text-xl mb-10" style={{ color: "#c8b898", maxWidth: "560px", margin: "0 auto 40px" }}>
            One player wields the dungeon. Everyone else fights to survive it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#kickstarter" className="btn-gold px-8 py-4 rounded text-base font-bold">
              BACK ON KICKSTARTER
            </a>
            <a href="#features" className="btn-outline px-8 py-4 rounded text-base">
              LEARN MORE
            </a>
          </div>
        </div>
      </section>

      {/* WHAT IS IT */}
      <section id="features" style={{ padding: "100px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c43e1c" }}>WHAT IS THE DM?</div>
              <h2 className="font-display text-4xl md:text-5xl mb-6" style={{ color: "#f0c060" }}>
                THE DUNGEON FIGHTS BACK
              </h2>
              <p className="leading-relaxed mb-4" style={{ color: "#a89070" }}>
                The DM is a 2D action-RPG where one player takes the role of the Dungeon Master — 
                controlling enemies, placing traps, reshaping rooms, and orchestrating chaos in real time 
                while other players fight through the dungeon.
              </p>
              <p className="leading-relaxed mb-8" style={{ color: "#a89070" }}>
                In solo mode, an adaptive AI DM handles the role — learning your patterns and punishing 
                your habits. No two runs are the same.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "13 Playable Classes", sub: "Full D&D roster" },
                  { label: "5-Act Campaign", sub: "40+ hours of story" },
                  { label: "DM Mode", sub: "Asymmetric multiplayer" },
                  { label: "Gear Forge", sub: "Craft & customize gear" },
                ].map(({ label, sub }) => (
                  <div key={label} style={{ padding: "16px", background: "#1c1408", borderRadius: "8px", border: "1px solid rgba(201,150,58,0.15)" }}>
                    <div className="font-display text-sm tracking-wide" style={{ color: "#f0c060" }}>{label}</div>
                    <div className="text-xs mt-1" style={{ color: "#7a5e20" }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              background: "linear-gradient(135deg, #1c1408, #2a1f0e)",
              border: "1px solid rgba(201,150,58,0.2)",
              borderRadius: "12px",
              padding: "48px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "80px", marginBottom: "16px" }}>⚔️</div>
              <div className="font-display text-3xl mb-3" style={{ color: "#f0c060" }}>GODOT 4</div>
              <p className="text-sm" style={{ color: "#7a5e20" }}>Built on Godot 4 — open source, cross-platform, and built for indie speed.</p>
              <div className="divider-gold my-6" />
              <div className="grid grid-cols-3 gap-3 text-center">
                {["PC", "Mac", "Console"].map(p => (
                  <div key={p}>
                    <div className="font-display text-lg" style={{ color: "#c9963a" }}>{p}</div>
                    <div className="text-xs" style={{ color: "#4a3e2e" }}>Target</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CLASSES */}
      <section style={{ padding: "80px 0", background: "#0a0704" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-12">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c43e1c" }}>CHOOSE YOUR DESTINY</div>
            <h2 className="font-display text-4xl md:text-5xl" style={{ color: "#f0c060" }}>13 CLASSES</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {classes.map((c) => (
              <div
                key={c.name}
                className="card-hover text-center p-4 rounded-lg cursor-pointer"
                style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.12)" }}
              >
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>{c.icon}</div>
                <div className="font-display text-xs tracking-wide" style={{ color: "#f0c060" }}>{c.name}</div>
                <div style={{ fontSize: "10px", color: "#7a5e20", fontFamily: "'DM Sans',sans-serif", marginTop: "2px" }}>{c.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KICKSTARTER */}
      <section id="kickstarter" style={{ padding: "100px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-16">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>KICKSTARTER CAMPAIGN</div>
            <h2 className="font-display text-4xl md:text-6xl mb-4" style={{ color: "#f0c060" }}>BACK THE DUNGEON</h2>
            <p className="font-serif italic" style={{ color: "#a89070" }}>
              Help us bring The DM to life. Every backer shapes what gets built.
            </p>
          </div>

          {/* Funding goals */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {[
              { label: "Minimum Viable", amount: "$85,000", desc: "Single player story (Acts I–II), 6 classes, DM Mode alpha, PC release", badge: "MVP" },
              { label: "Full Vision", amount: "$250,000", desc: "Full 5-Act campaign, all 13 classes, co-op, console ports", badge: "V1.0" },
              { label: "Stretch: Campaign Creator", amount: "$400,000", desc: "Community module tools, Steam Workshop, advanced DM AI behavior", badge: "STRETCH" },
              { label: "Stretch: Mobile", amount: "$550,000", desc: "iOS/Android port, cross-play, mobile DM Mode UI", badge: "STRETCH" },
            ].map(({ label, amount, desc, badge }) => (
              <div
                key={label}
                className="p-6 rounded-lg"
                style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.15)" }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-display text-sm tracking-wide" style={{ color: "#c8b898" }}>{label}</div>
                  <span
                    className="text-xs px-2 py-1 rounded font-display tracking-widest"
                    style={{
                      background: badge === "MVP" ? "rgba(45,90,39,0.2)" : badge === "V1.0" ? "rgba(201,150,58,0.2)" : "rgba(196,62,28,0.2)",
                      color: badge === "MVP" ? "#4a9a3e" : badge === "V1.0" ? "#f0c060" : "#c43e1c",
                      border: `1px solid ${badge === "MVP" ? "rgba(45,90,39,0.3)" : badge === "V1.0" ? "rgba(201,150,58,0.3)" : "rgba(196,62,28,0.3)"}`,
                    }}
                  >
                    {badge}
                  </span>
                </div>
                <div className="font-display text-3xl mb-3" style={{ color: "#f0c060" }}>{amount}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#7a5e20" }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Backer tiers */}
          <h3 className="font-display text-2xl md:text-3xl text-center mb-8" style={{ color: "#f0c060" }}>BACKER TIERS</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {tiers.map((t) => (
              <div
                key={t.name}
                className="card-hover p-6 rounded-lg relative"
                style={{
                  background: t.popular ? "linear-gradient(135deg, #2a1a06, #3d2810)" : "#1c1408",
                  border: `1px solid ${t.popular ? t.color : "rgba(201,150,58,0.15)"}`,
                  boxShadow: t.popular ? `0 0 30px rgba(240,192,96,0.15)` : "none",
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
                <div className="font-display text-4xl mb-4" style={{ color: "#f0c060" }}>{t.price}</div>
                <ul className="space-y-2">
                  {t.rewards.map(r => (
                    <li key={r} className="text-sm flex items-start gap-2" style={{ color: "#a89070" }}>
                      <span style={{ color: t.color, flexShrink: 0 }}>✓</span> {r}
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full mt-6 py-3 rounded font-display text-sm tracking-widest transition-all duration-200"
                  style={{
                    background: t.popular ? `${t.color}` : "transparent",
                    color: t.popular ? "#0f0b06" : t.color,
                    border: `1px solid ${t.color}`,
                  }}
                >
                  PLEDGE {t.price}
                </button>
              </div>
            ))}
          </div>

          {/* Budget */}
          <div style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.15)", borderRadius: "12px", padding: "40px" }}>
            <h3 className="font-display text-2xl mb-8 text-center" style={{ color: "#f0c060" }}>BUDGET BREAKDOWN (at $250K)</h3>
            <div className="space-y-4">
              {[
                { label: "Art & Animation", amount: "$80,000", pct: 32 },
                { label: "Engineering", amount: "$60,000", pct: 24 },
                { label: "Game Design & Level Design", amount: "$35,000", pct: 14 },
                { label: "Audio (music, SFX, voice acting)", amount: "$30,000", pct: 12 },
                { label: "QA, Porting & Platform Certification", amount: "$20,000", pct: 8 },
                { label: "Marketing, PR & Fulfillment", amount: "$15,000", pct: 6 },
                { label: "Legal, Business & Contingency", amount: "$10,000", pct: 4 },
              ].map(({ label, amount, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-2" style={{ color: "#c8b898" }}>
                    <span>{label}</span>
                    <span style={{ color: "#f0c060", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{amount}</span>
                  </div>
                  <div style={{ height: "4px", background: "#2a1f0e", borderRadius: "2px" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #7a5e20, #c9963a)", borderRadius: "2px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section style={{ padding: "80px 0", background: "#0a0704" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-12">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c43e1c" }}>DEVELOPMENT</div>
            <h2 className="font-display text-4xl md:text-5xl" style={{ color: "#f0c060" }}>ROADMAP</h2>
          </div>
          <div className="space-y-4">
            {[
              { phase: "Pre-Production", duration: "2 months", desc: "GDD lock, art bible, prototype controls, Kickstarter launch" },
              { phase: "Alpha", duration: "6 months", desc: "Act I complete, 6 classes, DM Mode v1, backer beta access" },
              { phase: "Beta", duration: "6 months", desc: "Acts II–III, all 13 classes, co-op network, community iteration" },
              { phase: "Gold / Launch", duration: "4 months", desc: "Acts IV–V, console certification, Steam Deck verification" },
              { phase: "Post-Launch", duration: "Ongoing", desc: "Seasonal content, Campaign Creator tools, community marketplace" },
            ].map(({ phase, duration, desc }, i) => (
              <div
                key={phase}
                className="flex gap-6 p-5 rounded-lg"
                style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.12)" }}
              >
                <div
                  className="font-display text-2xl w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background: "rgba(201,150,58,0.15)", color: "#f0c060", fontSize: "14px" }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="flex flex-wrap gap-4 mb-1">
                    <span className="font-display tracking-wide" style={{ color: "#f0c060" }}>{phase}</span>
                    <span className="text-xs mt-1" style={{ color: "#7a5e20" }}>{duration}</span>
                  </div>
                  <p className="text-sm" style={{ color: "#a89070" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 32px", textAlign: "center", background: "radial-gradient(ellipse at 50% 50%, rgba(196,62,28,0.08) 0%, transparent 70%), #0f0b06" }}>
        <h2 className="font-display text-4xl md:text-5xl mb-4" style={{ color: "#f0c060" }}>READY TO ENTER THE DUNGEON?</h2>
        <p className="font-serif italic mb-8" style={{ color: "#a89070" }}>The DM is watching. Back us on Kickstarter and shape what comes next.</p>
        <a href="#kickstarter" className="btn-gold px-10 py-4 rounded text-base inline-block">
          BACK THE DM NOW
        </a>
      </section>
    </>
  );
}
