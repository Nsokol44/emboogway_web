import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — Emboogway",
  description: "Learn about Emboogway, the indie game studio behind Waytable, The DM, and Geostory. Led by Dr. Nicholas Sokol, PhD Geographer and entrepreneur.",
};

export default function Studio() {
  return (
    <>
      <section className="relative min-h-96 flex flex-col items-center justify-center pt-32 pb-16 text-center bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.08) 0%, transparent 60%)" }} />
        <div className="relative z-10 px-6">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">ABOUT US</div>
          <h1 className="font-display text-gold-light leading-none" style={{ fontSize: "clamp(48px, 10vw, 100px)", letterSpacing: "0.08em" }}>THE STUDIO</h1>
          <p className="font-serif italic text-xl mt-6 max-w-xl mx-auto text-cream-dim/70">Bold games, strange name, zero apologies.</p>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-16">
          <div>
            <div className="font-display text-xs tracking-widest text-gold mb-4">THE NAME</div>
            <h2 className="font-display text-4xl text-gold-light mb-6">WHY EMBOOGWAY?</h2>
            <p className="leading-relaxed text-cream-dim/60 mb-4">Because it&apos;s completely ours. No trademark conflict, no confusion — just a name that&apos;s weird, fun, and impossible to forget.</p>
            <p className="leading-relaxed text-cream-dim/60">Mojang, Supergiant, Devolver — odd names that became legends. We plan to earn that too.</p>
          </div>
          <div>
            <div className="font-display text-xs tracking-widest text-gold mb-4">THE MISSION</div>
            <h2 className="font-display text-4xl text-gold-light mb-6">WHAT WE BUILD</h2>
            <p className="leading-relaxed text-cream-dim/60 mb-4">Games born from the question: &ldquo;Why hasn&apos;t anyone built this?&rdquo;</p>
            <p className="leading-relaxed text-cream-dim/60">Waytable asks: what if a tabletop RPG could leave the table? The DM asks: what if the dungeon fought back? Geostory asks: what if a strategy game actually understood geography? These are the gaps we live to fill.</p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-bark/20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="font-display text-xs tracking-widest text-gold mb-8 text-center">STUDIO LEAD</div>
          <div className="p-10 rounded-xl border border-gold/20 bg-bark relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,150,58,0.07) 0%, transparent 70%)" }} />
            <div className="md:flex gap-10 items-start relative z-10">
              <div className="flex-shrink-0 mb-6 md:mb-0">
                <div className="w-28 h-28 rounded-xl flex items-center justify-center font-display text-4xl bg-gradient-to-br from-gold-dim to-gold text-ink">NS</div>
              </div>
              <div>
                <h3 className="font-display text-3xl md:text-4xl text-gold-light mb-1">Dr. Nicholas J. Sokol</h3>
                <div className="font-display text-sm tracking-widest text-gold mb-6">FOUNDER & STUDIO LEAD · PhD, Geography</div>
                <p className="leading-relaxed text-cream-dim/60 mb-4">
                  An interdisciplinary scientist, entrepreneur, and educator with 10+ years across atmospheric science, geocomputational AI, and environmental remediation. PhD in Geography from the University of South Carolina.
                </p>
                <p className="leading-relaxed text-cream-dim/60 mb-6">
                  As founder and CEO of Algaeo, Nick secured over $500,000 from the Department of Energy&apos;s Innovation Crossroads program. He brings the same rigor and ambition to Emboogway.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["PhD Geography · UofSC", "MS Geography · LSU", "$566K+ Grants", "DOE Innovation Crossroads", "Machine Learning", "GIS & Remote Sensing", "UAV / Part 107", "Data Science"].map(tag => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent my-8" />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "🌍", title: "Geostory's Authenticity", desc: "A PhD geographer built Geostory's geographic systems. The rivers, climate zones, and terrain are modeled correctly." },
                { icon: "🎮", title: "AI-Driven Gameplay", desc: "ML and predictive modeling experience feeds into The DM's adaptive AI that learns your habits." },
                { icon: "💰", title: "Proven Fundraiser", desc: "Over half a million in competitive grants. Nick knows how to pitch big ideas and deliver." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="p-4 rounded-lg bg-bark-light">
                  <div className="text-2xl mb-2">{icon}</div>
                  <div className="font-display text-sm text-gold-light mb-2">{title}</div>
                  <p className="text-xs leading-relaxed text-gold-dim">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-3xl mx-auto px-6">
          <div className="font-display text-xs tracking-widest text-gold mb-8 text-center">RESEARCH PUBLICATIONS</div>
          <div className="space-y-4">
            {[
              { title: "Community Adaptation to Microgrid Alternative Energy Sources: The Case of Puerto Rico", pub: "Democratizing Energy", year: "2020" },
              { title: "Land Cover, Lightning Frequency, and Turbulent Fluxes over Southern Louisiana", pub: "Applied Geography", year: "2018" },
              { title: "Spatial Distributions of Tropical Cyclone Tornadoes by Intensity and Size Characteristics", pub: "Atmosphere", year: "2017" },
              { title: "Tropical Cyclone Ivan's tornado cluster in the Mid-Atlantic Region", pub: "Physical Geography", year: "2016" },
            ].map(({ title, pub, year }) => (
              <div key={title} className="p-5 rounded-xl bg-bark border border-gold/12 flex gap-4">
                <div className="font-display text-sm text-gold flex-shrink-0">{year}</div>
                <div>
                  <div className="text-sm text-cream-dim mb-1">{title}</div>
                  <div className="text-xs font-serif italic text-gold-dim">{pub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-bark/20 text-center">
        <div className="font-display text-xs tracking-widest text-gold mb-8">STUDIO VALUES</div>
        <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-12">HOW WE OPERATE</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { title: "No Pay-to-Win. Ever.", desc: "Premium purchase model. Cosmetic-only DLC. All gameplay content earnable through play." },
            { title: "Community First", desc: "Backers shape what gets built. Stretch goals, feedback loops, and transparent dev logs." },
            { title: "Authentic by Default", desc: "We don't cut corners on realism or design. If we build a history game, we consult history." },
          ].map(({ title, desc }) => (
            <div key={title} className="p-8 rounded-xl bg-bark border border-gold/15 hover:-translate-y-1 transition-all">
              <div className="font-display text-xl text-gold-light mb-4">{title}</div>
              <p className="text-sm leading-relaxed text-gold-dim">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
