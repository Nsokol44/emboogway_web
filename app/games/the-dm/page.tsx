import type { Metadata } from "next";
import Link from "next/link";
import Particles from "@/components/Particles";
import ScrollReveal from "@/components/ScrollReveal";
import ClassSelector from "@/components/ClassSelector";
import RoadmapTracker from "@/components/RoadmapTracker";

export const metadata: Metadata = {
  title: "The DM — 2D Action RPG",
  description: "The DM is a 2D action-RPG where one player becomes the Dungeon Master. 13 D&D classes, asymmetric multiplayer, 5-act campaign. Coming to Kickstarter from Emboogway.",
};

const tiers = [
  { name: "Apprentice", price: "$10", rewards: ["Digital thank-you scroll", "Name in credits"], popular: false },
  { name: "Adventurer", price: "$25", rewards: ["Game copy", "Digital artbook", "Soundtrack"], popular: false },
  { name: "Champion", price: "$60", rewards: ["Everything above", "Early access beta", "Exclusive cosmetic armor set"], popular: true },
  { name: "Guild Master", price: "$120", rewards: ["Everything above", "Physical artbook", "Signed poster", "DM Mode alpha access"], popular: false },
  { name: "Archmage", price: "$300", rewards: ["Everything above", "Design a dungeon room", "Your name as an in-game NPC"], popular: false },
  { name: "The DM", price: "$1,000", rewards: ["Everything above", "Voice-acted NPC", "Private Q&A with dev team", "Legendary backer cosmetics"], popular: false },
];

export default function TheDM() {
  return (
    <>
      <ScrollReveal />

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 bg-ink">
        <div className="ring-1-spin" />
        <div className="ring-2-spin" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 80%, rgba(139,26,26,0.2) 0%, transparent 60%)" }} />
        <Particles count={20} />

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <div className="font-display text-xs tracking-widest text-ember mb-6" style={{ animation: "fadeIn 1s ease forwards" }}>EMBOOGWAY · 2D ACTION RPG</div>
          <h1 className="font-display text-gold-light leading-none mb-4"
            style={{ fontSize: "clamp(80px, 16vw, 180px)", letterSpacing: "0.05em", textShadow: "0 0 100px rgba(196,62,28,0.4), 0 0 40px rgba(201,150,58,0.3)", animation: "fadeUp 0.8s ease 0.2s both" }}>
            THE DM
          </h1>
          <div className="font-display text-lg tracking-widest text-gold mb-6" style={{ animation: "fadeUp 0.8s ease 0.35s both" }}>THE DUNGEON MASTER</div>
          <p className="font-serif italic text-xl text-cream-dim/80 max-w-lg mx-auto mb-10" style={{ animation: "fadeUp 0.8s ease 0.5s both" }}>
            One player wields the dungeon. Everyone else fights to survive it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center" style={{ animation: "fadeUp 0.8s ease 0.65s both" }}>
            <a href="#kickstarter" className="btn-shimmer px-8 py-4 rounded text-base">BACK ON KICKSTARTER</a>
            <a href="#classes" className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 transition-all">EXPLORE CLASSES</a>
          </div>
        </div>
        <div className="animate-float absolute bottom-10 left-1/2 text-gold-dim text-2xl">↓</div>
      </section>

      {/* WHAT IS IT */}
      <section id="features" className="py-24 bg-ink">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="reveal-left">
              <div className="font-display text-xs tracking-widest text-ember mb-4">WHAT IS THE DM?</div>
              <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-6">THE DUNGEON FIGHTS BACK</h2>
              <p className="leading-relaxed text-gold-dim mb-4">
                One player takes the role of the Dungeon Master — controlling enemies, placing traps, reshaping rooms in real time while everyone else fights to survive.
              </p>
              <p className="leading-relaxed text-gold-dim mb-8">
                In solo mode, an adaptive AI DM learns your patterns across sessions and punishes your habits. A player who always dashes left will eventually face enemies placed to stop that.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "13 Playable Classes", sub: "Full D&D roster", icon: "⚔️" },
                  { label: "5-Act Campaign", sub: "40+ hours of story", icon: "📖" },
                  { label: "Asymmetric DM Mode", sub: "Human or AI DM", icon: "🎲" },
                  { label: "Gear Forge", sub: "Craft & customize", icon: "🔨" },
                ].map(({ label, sub, icon }) => (
                  <div key={label} className="p-4 rounded-lg bg-bark border border-gold/15 hover-lift flex items-start gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <div className="font-display text-sm tracking-wide text-gold-light">{label}</div>
                      <div className="text-xs mt-0.5 text-gold-dim">{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature highlights */}
            <div className="reveal-right space-y-4">
              {[
                { title: "The Human DM", body: "One player gets a god-mode overhead view of the dungeon. They spawn enemies, trigger traps, seal doors, and whisper taunts to players. It's the most fun you'll have without actually playing.", icon: "👁️" },
                { title: "The AI DM", body: "Solo players face an adaptive AI that tracks every habit, every route preference, every combat pattern — and builds the dungeon against you personally.", icon: "🧠" },
                { title: "Gear Forge", body: "Salvage enemy drops, combine gear in the forge, and craft equipment tuned to your playstyle. Every class has unique forge recipes.", icon: "⚒️" },
              ].map(({ title, body, icon }) => (
                <div key={title} className="p-5 rounded-xl bg-bark border border-gold/15 hover-lift">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{icon}</span>
                    <div className="font-display text-base text-gold-light">{title}</div>
                  </div>
                  <p className="text-sm leading-relaxed text-cream-dim/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE CLASS SELECTOR */}
      <section id="classes" className="py-24 bg-bark/20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12 reveal">
            <div className="font-display text-xs tracking-widest text-ember mb-4">CHOOSE YOUR DESTINY</div>
            <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-4">13 CLASSES</h2>
            <p className="text-sm text-gold-dim max-w-lg mx-auto">Click any class to see their stats, role, and playstyle. Every class has a unique ability system and gear forge recipes.</p>
          </div>
          <div className="reveal">
            <ClassSelector />
          </div>
        </div>
      </section>

      {/* KICKSTARTER */}
      <section id="kickstarter" className="py-24 bg-ink">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <div className="font-display text-xs tracking-widest text-gold mb-4">KICKSTARTER CAMPAIGN</div>
            <h2 className="font-display text-4xl md:text-6xl text-gold-light mb-4">BACK THE DUNGEON</h2>
            <p className="font-serif italic text-gold-dim">Help us bring The DM to life. Every backer shapes what gets built.</p>
          </div>

          {/* Funding goals */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {[
              { label: "Minimum Viable", amount: "$85,000", desc: "Single player story (Acts I–II), 6 classes, DM Mode alpha, PC release", badge: "MVP", badgeColor: "text-forest-bright bg-forest/20 border-forest/30" },
              { label: "Full Vision", amount: "$250,000", desc: "Full 5-Act campaign, all 13 classes, co-op, console ports", badge: "V1.0", badgeColor: "text-gold-light bg-gold/20 border-gold/30" },
              { label: "Stretch: Campaign Creator", amount: "$400,000", desc: "Community module tools, Steam Workshop, advanced DM AI", badge: "STRETCH", badgeColor: "text-ember bg-ember/10 border-ember/30" },
              { label: "Stretch: Mobile", amount: "$550,000", desc: "iOS/Android port, cross-play, mobile DM Mode UI", badge: "STRETCH", badgeColor: "text-ember bg-ember/10 border-ember/30" },
            ].map(({ label, amount, desc, badge, badgeColor }, i) => (
              <div key={label} className="p-6 rounded-xl bg-bark border border-gold/15 hover-lift reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="font-display text-sm tracking-wide text-cream-dim">{label}</div>
                  <span className={`text-xs px-2 py-1 rounded font-display tracking-widest border ${badgeColor}`}>{badge}</span>
                </div>
                <div className="font-display text-3xl text-gold-light mb-3">{amount}</div>
                <p className="text-sm leading-relaxed text-gold-dim">{desc}</p>
              </div>
            ))}
          </div>

          {/* Backer tiers */}
          <h3 className="font-display text-2xl md:text-3xl text-center text-gold-light mb-8 reveal">BACKER TIERS</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {tiers.map((t, i) => (
              <div key={t.name} className={`relative p-6 rounded-xl border hover-lift reveal ${t.popular ? "bg-gradient-to-br from-bark to-bark-light border-gold shadow-lg" : "bg-bark border-gold/15"}`}
                style={{ transitionDelay: `${i * 60}ms`, boxShadow: t.popular ? "0 0 40px rgba(201,150,58,0.1)" : undefined }}>
                {t.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-light text-ink font-display text-xs tracking-widest px-3 py-1 rounded animate-pulse-glow">
                    MOST POPULAR
                  </div>
                )}
                <div className="font-display text-xl text-gold mb-1">{t.name}</div>
                <div className="font-display text-4xl text-gold-light mb-4">{t.price}</div>
                <ul className="space-y-2">
                  {t.rewards.map(r => (
                    <li key={r} className="text-sm flex items-start gap-2 text-cream-dim/70">
                      <span className="text-gold flex-shrink-0">✓</span> {r}
                    </li>
                  ))}
                </ul>
                <button className={`w-full mt-6 py-3 rounded font-display text-sm tracking-widest transition-all duration-200 hover:-translate-y-0.5 ${t.popular ? "bg-gold-light text-ink hover:opacity-90" : "border border-gold text-gold hover:bg-gold/10"}`}>
                  PLEDGE {t.price}
                </button>
              </div>
            ))}
          </div>

          {/* Budget */}
          <div className="bg-bark border border-gold/15 rounded-xl p-10 reveal">
            <h3 className="font-display text-2xl text-center text-gold-light mb-8">BUDGET BREAKDOWN (at $250K)</h3>
            <div className="space-y-5">
              {[
                { label: "Art & Animation", amount: "$80,000", pct: 32 },
                { label: "Engineering", amount: "$60,000", pct: 24 },
                { label: "Game Design & Level Design", amount: "$35,000", pct: 14 },
                { label: "Audio (music, SFX, voice acting)", amount: "$30,000", pct: 12 },
                { label: "QA, Porting & Certification", amount: "$20,000", pct: 8 },
                { label: "Marketing, PR & Fulfillment", amount: "$15,000", pct: 6 },
                { label: "Legal, Business & Contingency", amount: "$10,000", pct: 4 },
              ].map(({ label, amount, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-cream-dim">{label}</span>
                    <span className="font-display text-gold-light tracking-wide">{amount}</span>
                  </div>
                  <div className="h-1.5 bg-bark-light rounded-full">
                    <div className="progress-bar h-full rounded-full" data-width={`${pct}%`}
                      style={{ background: `linear-gradient(90deg, #7a5e20, #c9963a)` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="py-24 bg-bark/20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12 reveal">
            <div className="font-display text-xs tracking-widest text-ember mb-4">LIVE PROGRESS</div>
            <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-4">ROADMAP</h2>
            <p className="text-sm text-gold-dim">Updated as we hit milestones. Watch the game get built in real time.</p>
          </div>
          <div className="reveal">
            <RoadmapTracker />
          </div>
        </div>
      </section>

      <section className="relative py-24 px-6 text-center overflow-hidden bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(196,62,28,0.07) 0%, transparent 70%)" }} />
        <Particles count={12} />
        <div className="relative z-10 reveal">
          <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-4">READY TO ENTER THE DUNGEON?</h2>
          <p className="font-serif italic text-cream-dim/60 mb-8">The DM is watching. Back us and shape what comes next.</p>
          <a href="#kickstarter" className="inline-block btn-shimmer px-10 py-4 rounded text-base">BACK THE DM NOW</a>
        </div>
      </section>
    </>
  );
}
