import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — Emboogway Game Studio",
  description: "Learn about Emboogway, the indie game studio behind The DM and Geostory. Led by Dr. Nicholas Sokol, a scientist and entrepreneur with $566K+ in research grants.",
};

export default function Studio() {
  return (
    <>
      {/* HERO */}
      <section style={{
        minHeight: "60vh",
        background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.1) 0%, transparent 60%), #0f0b06",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        paddingTop: "120px", paddingBottom: "60px", textAlign: "center",
      }}>
        <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#7a5e20" }}>ABOUT US</div>
        <h1 className="font-display" style={{ fontSize: "clamp(48px, 10vw, 100px)", color: "#f0c060", letterSpacing: "0.08em", lineHeight: 1 }}>
          THE STUDIO
        </h1>
        <p className="font-serif italic text-xl mt-6 max-w-xl mx-auto px-6" style={{ color: "#c8b898" }}>
          Bold games, strange name, zero apologies.
        </p>
      </section>

      {/* ORIGIN */}
      <section style={{ padding: "80px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>THE NAME</div>
              <h2 className="font-display text-4xl mb-6" style={{ color: "#f0c060" }}>WHY EMBOOGWAY?</h2>
              <p className="leading-relaxed mb-4" style={{ color: "#a89070" }}>
                Because it&apos;s completely ours. There&apos;s no other Emboogway. 
                No trademark conflict, no confusion, no dilution. Just a name that&apos;s weird, 
                fun, and impossible to forget.
              </p>
              <p className="leading-relaxed" style={{ color: "#a89070" }}>
                Great game studios don&apos;t need safe names. Mojang, Supergiant, Devolver — 
                odd names that became legends. We plan to earn that too.
              </p>
            </div>
            <div>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>THE MISSION</div>
              <h2 className="font-display text-4xl mb-6" style={{ color: "#f0c060" }}>WHAT WE BUILD</h2>
              <p className="leading-relaxed mb-4" style={{ color: "#a89070" }}>
                We make games that don&apos;t exist yet. Games born from the question: 
                &ldquo;Why hasn&apos;t anyone built this?&rdquo;
              </p>
              <p className="leading-relaxed" style={{ color: "#a89070" }}>
                The DM asks: what if the dungeon fought back with a real player&apos;s intelligence? 
                Geostory asks: what if a strategy game actually understood geography? 
                These are the kinds of gaps we live to fill.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section style={{ padding: "80px 0", background: "#0a0704" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div className="font-display text-xs tracking-widest mb-8 text-center" style={{ color: "#c9963a" }}>
            STUDIO LEAD
          </div>
          <div
            className="p-10 rounded-xl"
            style={{ background: "linear-gradient(135deg, #1c1408, #2a1f0e)", border: "1px solid rgba(201,150,58,0.2)", position: "relative", overflow: "hidden" }}
          >
            <div style={{
              position: "absolute", top: 0, right: 0, width: "300px", height: "300px",
              background: "radial-gradient(circle, rgba(201,150,58,0.07) 0%, transparent 70%)",
            }} />
            <div className="md:flex gap-10 items-start">
              <div className="flex-shrink-0 mb-6 md:mb-0">
                <div
                  className="w-28 h-28 rounded-xl flex items-center justify-center font-display text-4xl"
                  style={{ background: "linear-gradient(135deg, #7a5e20, #c9963a)", color: "#0f0b06" }}
                >
                  NS
                </div>
              </div>
              <div>
                <h3 className="font-display text-3xl md:text-4xl mb-1" style={{ color: "#f0c060" }}>
                  Dr. Nicholas J. Sokol
                </h3>
                <div className="font-display text-sm tracking-widest mb-6" style={{ color: "#c9963a" }}>
                  FOUNDER & STUDIO LEAD · PhD, Geography
                </div>
                <p className="leading-relaxed mb-4" style={{ color: "#a89070" }}>
                  Nick is an interdisciplinary scientist, entrepreneur, and educator with over 10 years 
                  of experience spanning atmospheric science, geocomputational AI, and environmental 
                  remediation. He holds a PhD in Geography from the University of South Carolina, 
                  where he researched computational models of concurrent drought-precipitation events 
                  across the United States.
                </p>
                <p className="leading-relaxed mb-6" style={{ color: "#a89070" }}>
                  As founder and CEO of Algaeo, Nick secured over $500,000 in competitive federal 
                  grant funding from the Department of Energy&apos;s Innovation Crossroads program — 
                  proof that he knows how to build real things that get funded. He brings that same 
                  rigor and ambition to Emboogway.
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    "PhD Geography · UofSC",
                    "MS Physical Geography · LSU",
                    "BS Geography & Env. Planning · Towson",
                    "$566K+ Grants Secured",
                    "DOE Innovation Crossroads",
                    "Machine Learning",
                    "GIS & Remote Sensing",
                    "UAV / Drone (Part 107)",
                    "Data Science",
                    "University Instructor",
                  ].map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full"
                      style={{ background: "rgba(201,150,58,0.1)", color: "#c9963a", border: "1px solid rgba(201,150,58,0.2)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="divider-gold my-8" />

            {/* Why his background matters */}
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "🌍",
                  title: "Geostory's Authenticity",
                  desc: "A PhD geographer built Geostory's geographic systems. The rivers, climate zones, and terrain aren't guesses — they're modeled correctly."
                },
                {
                  icon: "🎮",
                  title: "AI-Driven Gameplay",
                  desc: "Machine learning and predictive modeling experience feeds directly into The DM's adaptive AI Dungeon Master that learns your habits."
                },
                {
                  icon: "💰",
                  title: "Proven Fundraiser",
                  desc: "Over half a million in competitive grants. Nick knows how to pitch big ideas, earn trust, and deliver on promises."
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ padding: "16px", background: "#2a1f0e", borderRadius: "8px" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
                  <div className="font-display text-sm mb-2" style={{ color: "#f0c060" }}>{title}</div>
                  <p className="text-xs leading-relaxed" style={{ color: "#7a5e20" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PUBLICATIONS */}
      <section style={{ padding: "80px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div className="font-display text-xs tracking-widest mb-8 text-center" style={{ color: "#c9963a" }}>
            RESEARCH PUBLICATIONS
          </div>
          <div className="space-y-4">
            {[
              {
                title: "Community Adaptation to Microgrid Alternative Energy Sources: The Case of Puerto Rico",
                pub: "Democratizing Energy", year: "2020"
              },
              {
                title: "Land Cover, Lightning Frequency, and Turbulent Fluxes over Southern Louisiana",
                pub: "Applied Geography", year: "2018"
              },
              {
                title: "Spatial Distributions of Tropical Cyclone Tornadoes by Intensity and Size Characteristics",
                pub: "Atmosphere", year: "2017"
              },
              {
                title: "Tropical Cyclone Ivan's tornado cluster in the Mid-Atlantic Region",
                pub: "Physical Geography", year: "2016"
              },
            ].map(({ title, pub, year }) => (
              <div
                key={title}
                className="p-5 rounded-lg flex gap-4"
                style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.1)" }}
              >
                <div className="font-display text-sm" style={{ color: "#c9963a", flexShrink: 0 }}>{year}</div>
                <div>
                  <div className="text-sm mb-1" style={{ color: "#e8dcc8" }}>{title}</div>
                  <div className="text-xs font-serif italic" style={{ color: "#7a5e20" }}>{pub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section style={{ padding: "80px 32px", background: "#0a0704" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", textAlign: "center" }}>
          <div className="font-display text-xs tracking-widest mb-8" style={{ color: "#c9963a" }}>HOW WE OPERATE</div>
          <h2 className="font-display text-4xl md:text-5xl mb-12" style={{ color: "#f0c060" }}>STUDIO VALUES</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "No Pay-to-Win. Ever.", desc: "Premium purchase model. Cosmetic-only DLC. All gameplay content earnable through play." },
              { title: "Community First", desc: "Backers shape what gets built. Stretch goals, feedback loops, and transparent development logs." },
              { title: "Authentic by Default", desc: "We don't cut corners on realism or design. If we build a history game, we consult history." },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="p-8 rounded-lg card-hover"
                style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.15)" }}
              >
                <div className="font-display text-xl mb-4" style={{ color: "#f0c060" }}>{title}</div>
                <p className="text-sm leading-relaxed" style={{ color: "#7a5e20" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
