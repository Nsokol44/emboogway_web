import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Emboogway | Indie Game Studio",
  description: "Emboogway is a bold indie game studio crafting The DM and Geostory. Two Kickstarter campaigns launching soon. Made in Knoxville, TN.",
};

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section
        style={{
          minHeight: "100vh",
          background: "radial-gradient(ellipse 120% 80% at 50% 110%, rgba(201,150,58,0.12) 0%, transparent 60%), radial-gradient(ellipse at 100% 0%, rgba(196,62,28,0.06) 0%, transparent 50%), #0f0b06",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          paddingTop: "80px",
        }}
      >
        {/* Decorative grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(rgba(201,150,58,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,150,58,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <div className="relative z-10 text-center px-6" style={{ maxWidth: "900px" }}>
          {/* Eyebrow */}
          <div
            className="font-display text-xs tracking-widest mb-8 inline-flex items-center gap-3"
            style={{ color: "#7a5e20" }}
          >
            <span style={{ width: "40px", height: "1px", background: "#7a5e20", display: "inline-block" }} />
            INDIE GAME STUDIO
            <span style={{ width: "40px", height: "1px", background: "#7a5e20", display: "inline-block" }} />
          </div>

          {/* Main title */}
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(72px, 14vw, 160px)",
              lineHeight: "0.9",
              color: "#f0c060",
              textShadow: "0 0 80px rgba(201,150,58,0.3), 0 4px 0 rgba(0,0,0,0.5)",
              letterSpacing: "0.08em",
              marginBottom: "24px",
            }}
          >
            EMBOOGWAY
          </h1>

          <p
            className="font-serif italic text-xl md:text-2xl mb-12 leading-relaxed"
            style={{ color: "#c8b898", maxWidth: "560px", margin: "0 auto 48px" }}
          >
            We make games that don&apos;t exist yet. Bold, original, and built to be remembered.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/games/the-dm" className="btn-gold px-8 py-4 rounded text-base font-bold">
              THE DM — Coming to Kickstarter
            </Link>
            <Link href="/games/geostory" className="btn-outline px-8 py-4 rounded text-base">
              GEOSTORY — Wishlist Now
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-10 left-1/2 float"
          style={{ transform: "translateX(-50%)", color: "#7a5e20", fontSize: "22px" }}
        >
          ↓
        </div>
      </section>

      {/* GAMES SECTION */}
      <section style={{ padding: "120px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
          <div className="text-center mb-20">
            <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#7a5e20" }}>
              OUR GAMES
            </div>
            <h2 className="font-display text-5xl md:text-6xl" style={{ color: "#f0c060" }}>
              TWO WORLDS. ONE STUDIO.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* The DM Card */}
            <Link href="/games/the-dm">
              <div
                className="card-hover rounded-lg overflow-hidden cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #1c1408, #2a1f0e)",
                  border: "1px solid rgba(201,150,58,0.2)",
                  padding: "48px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0, right: 0,
                    width: "200px", height: "200px",
                    background: "radial-gradient(circle, rgba(196,62,28,0.08) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="font-display text-xs tracking-widest mb-4"
                  style={{ color: "#c43e1c" }}
                >
                  2D ACTION RPG · KICKSTARTER
                </div>
                <h3
                  className="font-display mb-4"
                  style={{ fontSize: "clamp(40px, 6vw, 64px)", color: "#f0c060", lineHeight: 1 }}
                >
                  THE DM
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#a89070" }}>
                  An asymmetric 2D action-RPG where one player becomes the Dungeon Master — 
                  controlling enemies, placing traps, and reshaping the dungeon in real time. 
                  13 D&D classes. 5-act campaign. Endless chaos.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {["Godot 4", "13 Classes", "DM Mode", "Co-op", "PC"].map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: "rgba(201,150,58,0.1)", color: "#c9963a", border: "1px solid rgba(201,150,58,0.2)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="font-display text-sm tracking-widest" style={{ color: "#c9963a" }}>
                  VIEW CAMPAIGN →
                </div>
              </div>
            </Link>

            {/* Geostory Card */}
            <Link href="/games/geostory">
              <div
                className="card-hover rounded-lg overflow-hidden cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #0c1a0a, #122010)",
                  border: "1px solid rgba(45,90,39,0.3)",
                  padding: "48px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0, right: 0,
                    width: "200px", height: "200px",
                    background: "radial-gradient(circle, rgba(45,90,39,0.15) 0%, transparent 70%)",
                  }}
                />
                <div
                  className="font-display text-xs tracking-widest mb-4"
                  style={{ color: "#4a9a3e" }}
                >
                  HISTORICAL STRATEGY · KICKSTARTER
                </div>
                <h3
                  className="font-display mb-4"
                  style={{ fontSize: "clamp(40px, 6vw, 64px)", color: "#7acc6a", lineHeight: 1 }}
                >
                  GEOSTORY
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#7a9070" }}>
                  The strategy game that Civilization fans have been waiting for. Fast turns, 
                  deep historical realism, true scenario recreation from ancient empires to 
                  near-future geopolitics. Geography meets destiny.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {["4X Strategy", "Historical", "Fast Turns", "Scenarios", "PC"].map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: "rgba(45,90,39,0.15)", color: "#4a9a3e", border: "1px solid rgba(45,90,39,0.3)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="font-display text-sm tracking-widest" style={{ color: "#4a9a3e" }}>
                  VIEW CAMPAIGN →
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* STUDIO CRED */}
      <section style={{ padding: "80px 0", background: "#0a0704", borderTop: "1px solid rgba(201,150,58,0.08)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: "$566K+", label: "Grants Secured" },
              { num: "10+", label: "Years Research" },
              { num: "2", label: "Games in Dev" },
              { num: "13", label: "Playable Classes" },
            ].map(({ num, label }) => (
              <div key={label}>
                <div className="font-display text-4xl md:text-5xl mb-2" style={{ color: "#f0c060" }}>{num}</div>
                <div className="text-xs tracking-widest font-display" style={{ color: "#7a5e20" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section
        style={{
          padding: "100px 32px",
          background: "radial-gradient(ellipse at 50% 50%, rgba(201,150,58,0.08) 0%, transparent 70%), #0f0b06",
          textAlign: "center",
        }}
      >
        <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#7a5e20" }}>
          GET INVOLVED
        </div>
        <h2 className="font-display text-4xl md:text-6xl mb-6" style={{ color: "#f0c060" }}>
          BE PART OF THE STORY
        </h2>
        <p className="font-serif italic text-lg mb-10" style={{ color: "#a89070", maxWidth: "500px", margin: "0 auto 40px" }}>
          Join our newsletter and be first to know when our Kickstarters go live.
        </p>
        <form className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <input
            type="email"
            placeholder="your@email.com"
            className="flex-1 px-4 py-3 rounded text-sm"
            style={{
              background: "#1c1408",
              border: "1px solid rgba(201,150,58,0.3)",
              color: "#f7f0e3",
              outline: "none",
            }}
          />
          <button type="submit" className="btn-gold px-6 py-3 rounded text-sm font-bold">
            NOTIFY ME
          </button>
        </form>
      </section>
    </>
  );
}
