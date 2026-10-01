import type { Metadata } from "next";
import Link from "next/link";
import Particles from "@/components/Particles";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Waytable — AI-DM Tabletop RPG Platform",
  description:
    "Waytable by Emboogway is a browser/PWA tabletop RPG platform with an AI Dungeon Master. The host starts a table; friends and guests join free by code.",
};

const playUrl = "https://grimtable-gold.vercel.app";

export default function Waytable() {
  return (
    <>
      <ScrollReveal />

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 bg-ink">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(201,150,58,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,150,58,0.04) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(201,150,58,0.12) 0%, transparent 70%)",
          }}
        />
        <Particles count={22} />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6" style={{ animation: "fadeIn 1s ease forwards" }}>
            EMBOOGWAY · AI-DM TABLETOP PLATFORM · LIVE IN BROWSER
          </div>
          <h1
            className="font-display text-gold-light leading-none mb-5"
            style={{
              fontSize: "clamp(64px, 14vw, 160px)",
              letterSpacing: "0.05em",
              textShadow: "0 0 80px rgba(201,150,58,0.3), 0 4px 0 rgba(0,0,0,0.5)",
              animation: "fadeUp 0.8s ease 0.2s both",
            }}
          >
            WAYTABLE
          </h1>
          <p className="font-serif italic text-xl md:text-2xl text-cream-dim/80 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ animation: "fadeUp 0.8s ease 0.4s both" }}>
            What if your tabletop RPG could leave the table?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center" style={{ animation: "fadeUp 0.8s ease 0.6s both" }}>
            <a href={playUrl} target="_blank" rel="noreferrer" className="btn-shimmer px-8 py-4 rounded text-base font-bold">
              PLAY WAYTABLE
            </a>
            <a
              href="#how-it-works"
              className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 hover:border-gold transition-all duration-300"
            >
              HOW IT WORKS
            </a>
          </div>
        </div>
        <div className="animate-float absolute bottom-10 left-1/2 text-gold-dim text-2xl">↓</div>
      </section>

      {/* WHAT IT IS */}
      <section id="how-it-works" className="py-24 bg-ink">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-4">THE SHORT VERSION</div>
            <h2 className="font-display text-4xl md:text-5xl text-gold-light">AN AI DM. YOUR TABLE. ANYWHERE.</h2>
            <p className="leading-relaxed text-gold-dim max-w-2xl mx-auto mt-5">
              Waytable runs in the browser as a PWA — no installs, no books to haul. The host starts a table and shares a code. Friends and guests join free. The AI Dungeon Master keeps the story moving.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Host pays. Guests join free.",
                body: "One host starts the table; everyone else hops in with a code. No per-seat tollbooth for the whole party.",
              },
              {
                title: "Build your hero + Avi",
                body: "Create your character and a pixel Avi to match — then dress it in gear you actually earn.",
              },
              {
                title: "Adventures, your way",
                body: "Run classic campaigns or monster-collector adventures, with split parties and secret DM whispers when the table gets sneaky.",
              },
            ].map(({ title, body }, i) => (
              <div key={title} className="reveal rounded-xl border border-gold/15 bg-bark p-7 hover-lift" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="font-display text-xl text-gold-light mb-3">{title}</div>
                <p className="text-sm leading-relaxed text-cream-dim/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REAL-WORLD PLAY */}
      <section className="py-24 bg-bark/20 border-y border-gold-dim/10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="reveal-left">
              <div className="font-display text-xs tracking-widest text-gold-dim mb-4">OUT IN THE WORLD</div>
              <h2 className="font-display text-4xl md:text-5xl text-gold-light mb-6">WALK. LEVEL. GEAR UP.</h2>
              <p className="leading-relaxed text-gold-dim mb-4">
                Your Avi does not just live on the character sheet. Trace real walking routes to level it up, and keep an eye out for Power Spots — real places tied to exclusive gear.
              </p>
              <p className="leading-relaxed text-gold-dim">
                Exclusive pieces only appear when you are near their Power Spot, and earning one takes the venue code plus actually being there. Once earned, the gear is yours to keep wearing.
              </p>
            </div>
            <div className="reveal-right space-y-4">
              {[
                { title: "Route tracing", body: "Walk a route, resume where you left off, and turn real miles into Avi progress." },
                { title: "Power Spots", body: "Landmarks and local spots carry exclusive gear — visible nearby, earnable on site." },
                { title: "Earned means earned", body: "No buying your way past the map. Show up, check in, unlock the piece." },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 rounded-xl bg-ink border border-gold/15 hover-lift">
                  <div className="font-display text-base text-gold-light mb-1">{title}</div>
                  <p className="text-sm leading-relaxed text-cream-dim/60">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 px-6 text-center overflow-hidden bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(201,150,58,0.07) 0%, transparent 70%)" }} />
        <Particles count={14} />
        <div className="relative z-10 reveal">
          <h2 className="font-display text-4xl md:text-6xl text-gold-light mb-5">YOUR TABLE IS WAITING</h2>
          <p className="font-serif italic text-lg text-cream-dim/70 max-w-md mx-auto mb-10">
            Open Waytable in your browser, start a table, and send your friends the code.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={playUrl} target="_blank" rel="noreferrer" className="btn-shimmer px-8 py-4 rounded text-base font-bold">
              PLAY WAYTABLE
            </a>
            <Link
              href="/"
              className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 hover:border-gold transition-all duration-300"
            >
              BACK TO EMBOOGWAY
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
