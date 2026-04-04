import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Lore — Emboogway",
  description: "Explore the worlds of The DM and Geostory. Lore, world-building, and historical deep-dives from Emboogway.",
};

export default function Lore() {
  return (
    <>
      <ScrollReveal />
      <section className="relative min-h-64 flex flex-col items-center justify-center pt-32 pb-16 text-center bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.08) 0%, transparent 60%)" }} />
        <div className="relative z-10 px-6">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">THE WORLDS</div>
          <h1 className="font-display text-gold-light" style={{ fontSize: "clamp(48px, 10vw, 100px)", letterSpacing: "0.08em" }}>LORE</h1>
          <p className="font-serif italic text-xl mt-4 text-cream-dim/60">Every great game has a world worth getting lost in.</p>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-5xl mx-auto px-6">

          {/* THE DM LORE */}
          <div className="mb-20 reveal">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-ember/30" />
              <div className="font-display text-xs tracking-widest text-ember">THE DM — WORLD</div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-ember/30" />
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="rounded-xl border border-ember/20 bg-bark p-8 hover-lift">
                <div className="text-3xl mb-4">🌑</div>
                <h3 className="font-display text-2xl text-gold-light mb-4">THE SHATTERED REALM</h3>
                <p className="text-sm leading-relaxed text-cream-dim/60 mb-4">
                  The Shattered Realm is what remains of the world after The Sundering — an event no scholar fully understands but every survivor remembers. Continents cracked. Magic became unstable. The dungeons appeared overnight, impossibly deep, impossibly old.
                </p>
                <p className="text-sm leading-relaxed text-cream-dim/60">
                  Nobody built them. They were simply there, as if the world had always been hollow underneath.
                </p>
              </div>
              <div className="rounded-xl border border-ember/20 bg-bark p-8 hover-lift">
                <div className="text-3xl mb-4">👁️</div>
                <h3 className="font-display text-2xl text-gold-light mb-4">THE DUNGEON MASTERS</h3>
                <p className="text-sm leading-relaxed text-cream-dim/60 mb-4">
                  Some claim they were born inside the dungeons. Others say they made pacts with whatever lives below. All anyone knows is that the Dungeon Masters are real, they are watching, and they do not lose often.
                </p>
                <p className="text-sm leading-relaxed text-cream-dim/60">
                  A party that descends without a strategy is a party that becomes part of the dungeon.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gold/15 bg-bark p-8 reveal">
              <h3 className="font-display text-xl text-gold-light mb-6">THE FIVE FACTIONS</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "The Ironveil", desc: "Mercenary guild that sells dungeon-clearing as a service. Professional, ruthless, and increasingly powerful.", icon: "⚔️" },
                  { name: "The Luminary Order", desc: "Clerics and Paladins who believe the dungeons are divine tests. They descend to prove faith, not seek treasure.", icon: "☀️" },
                  { name: "The Veil Thieves", desc: "Rogues and Sorcerers who believe the dungeons contain the knowledge that was lost in The Sundering.", icon: "🌙" },
                  { name: "The Verdant Circle", desc: "Druids and Rangers who argue the dungeons are living creatures. They seek to communicate, not conquer.", icon: "🌿" },
                  { name: "The Forgeborn", desc: "Artificers and Fighters who strip dungeons for resources. Practical to a fault. Extremely well-armed.", icon: "⚙️" },
                  { name: "The Unaffiliated", desc: "Everyone else. Some are adventurers. Some are desperate. Some are the most dangerous of all.", icon: "🎲" },
                ].map(({ name, desc, icon }) => (
                  <div key={name} className="p-4 rounded-lg bg-ink border border-gold/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{icon}</span>
                      <div className="font-display text-sm text-gold-light">{name}</div>
                    </div>
                    <p className="text-xs leading-relaxed text-cream-dim/50">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* GEOSTORY LORE */}
          <div className="reveal">
            <div className="flex items-center gap-4 mb-10">
              <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, rgba(45,90,39,0.4))" }} />
              <div className="font-display text-xs tracking-widest text-forest-light">GEOSTORY — WORLD</div>
              <div className="h-px flex-1" style={{ background: "linear-gradient(to left, transparent, rgba(45,90,39,0.4))" }} />
            </div>

            <div className="rounded-xl border p-8 mb-8 hover-lift"
              style={{ background: "linear-gradient(135deg, #0c1a0a, #122010)", borderColor: "rgba(45,90,39,0.3)" }}>
              <h3 className="font-display text-2xl mb-4" style={{ color: "#7acc6a" }}>THE CORE THESIS</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#7a9070" }}>
                Geography doesn&apos;t just influence history — it <em className="text-forest-bright">is</em> history. The rivers that became trade routes. The mountains that stopped invasions. The soil that fed armies or starved them. The climate that broke empires and built others.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#7a9070" }}>
                Geostory is built on a single conviction: if you want to understand why history happened the way it did, you have to understand the ground it happened on.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Real Geographic Data", desc: "Geostory uses actual elevation data, historical climate records, and documented soil composition for every map. The Sahara was greener in 3000 BCE. The maps will show that.", icon: "🗺️", color: "#4a9a3e" },
                { title: "Documented Leaders", desc: "Every historical leader has stats drawn from documented behavior — not game-balance guesswork. Hannibal's tactical genius is real. Napoleon's overconfidence is real. Caesar's adaptability is real.", icon: "👑", color: "#7acc6a" },
                { title: "Scenario Authenticity", desc: "Our historians review every official scenario. If the Battle of Thermopylae is in the game, the terrain, troop numbers, and tactical situation match the historical record.", icon: "📜", color: "#4a9a3e" },
                { title: "The Future Scenarios", desc: "Our near-future scenarios (2050–2150) use current geopolitical models, climate projections, and resource distribution data to extrapolate plausible futures. Not sci-fi — speculative realism.", icon: "🌐", color: "#7acc6a" },
              ].map(({ title, desc, icon, color }) => (
                <div key={title} className="p-6 rounded-xl border hover-lift"
                  style={{ background: "#0c1a0a", borderColor: "rgba(45,90,39,0.2)" }}>
                  <div className="text-2xl mb-3">{icon}</div>
                  <div className="font-display text-base mb-2" style={{ color }}>{title}</div>
                  <p className="text-sm leading-relaxed" style={{ color: "#5a7850" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 text-center reveal">
            <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent mb-12" />
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/games/the-dm" className="btn-shimmer px-8 py-4 rounded text-sm font-display tracking-widest">
                EXPLORE THE DM
              </Link>
              <Link href="/games/geostory" className="border border-forest/50 font-display tracking-widest px-8 py-4 rounded text-sm transition-all"
                style={{ color: "#7acc6a", borderColor: "rgba(45,90,39,0.5)" }}>
                EXPLORE GEOSTORY
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
