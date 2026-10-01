import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Particles from "@/components/Particles";
import ScrollReveal from "@/components/ScrollReveal";
import WaitlistForm from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: "Emboogway | Indie Game Studio",
  description: "Emboogway is a bold indie game studio crafting Waytable, The DM, and Geostory. Waytable is live in the browser; our flagship games and Godot prototypes are in active development. Made in Knoxville, TN.",
};

export default function Home() {
  return (
    <>
      <ScrollReveal />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 bg-ink">
        {/* Grid */}
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(201,150,58,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,150,58,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Radial glow */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(201,150,58,0.1) 0%, transparent 70%)" }} />
        {/* Particles */}
        <Particles count={25} />

        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8" style={{ animation: "fadeIn 1s ease forwards" }}>
            <div className="h-px w-10 bg-gold-dim" />
            <span className="font-display text-xs tracking-widest text-gold-dim">INDIE GAME STUDIO — KNOXVILLE, TN</span>
            <div className="h-px w-10 bg-gold-dim" />
          </div>

          <div className="mb-6 flex justify-center" style={{ animation: "fadeUp 0.8s ease 0.2s both" }}>
            <Image
              src="/emboogway-wordmark-gold.png"
              alt="Emboogway"
              width={2720}
              height={427}
              priority
              className="w-[min(88vw,880px)] h-auto drop-shadow-[0_0_45px_rgba(201,150,58,0.28)]"
            />
          </div>
          <h1 className="sr-only">Emboogway</h1>

          <p className="font-serif italic text-xl md:text-2xl text-cream-dim/80 max-w-lg mx-auto mb-12 leading-relaxed"
            style={{ animation: "fadeUp 0.8s ease 0.4s both" }}>
            We make games that don&apos;t exist yet.<br />Bold, original, and built to be remembered.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center" style={{ animation: "fadeUp 0.8s ease 0.6s both" }}>
            <a href="https://grimtable-gold.vercel.app" target="_blank" rel="noreferrer" className="btn-shimmer px-8 py-4 rounded text-base font-bold">
              WAYTABLE — Play in Browser
            </a>
            <Link href="/games/the-dm"
              className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 hover:border-gold transition-all duration-300">
              THE DM — Coming to Kickstarter
            </Link>
            <Link href="/games/geostory"
              className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 hover:border-gold transition-all duration-300">
              GEOSTORY — Wishlist Now
            </Link>
          </div>
        </div>

        {/* Scroll arrow */}
        <div className="animate-float absolute bottom-10 left-1/2 text-gold-dim text-2xl">↓</div>
      </section>

      {/* ── GAMES ── */}
      <section className="py-28 bg-ink">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20 reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-4">OUR GAMES & PLATFORMS</div>
            <h2 className="font-display text-5xl md:text-6xl text-gold-light">WHAT WE&apos;RE BUILDING</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Waytable */}
            <Link href="/games/waytable" className="group block reveal-left">
              <div className="relative rounded-xl overflow-hidden border border-gold/30 bg-bark p-12 hover-lift h-full">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,150,58,0.16) 0%, transparent 70%)" }} />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-gold/40 group-hover:border-gold-light transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-gold/40 group-hover:border-gold-light transition-colors duration-300" />

                <div className="font-display text-xs tracking-widest text-gold-light mb-4">AI-DM TABLETOP PLATFORM · LIVE IN BROWSER</div>
                <h3 className="font-display text-gold-light leading-none mb-4" style={{ fontSize: "clamp(40px, 6vw, 72px)" }}>WAYTABLE</h3>
                <p className="text-sm leading-relaxed text-gold-dim mb-8">
                  Tabletop RPG that leaves the table. An AI Dungeon Master runs the session in your browser — the host starts a table, friends and guests join free by code, and your pixel Avi can level up when you walk the real world.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {["Browser / PWA", "AI DM", "Join by Code", "Power Spots", "Host Pays · Guests Free"].map(tag => (
                    <span key={tag} className="tag text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">{tag}</span>
                  ))}
                </div>
                <div className="font-display text-sm tracking-widest text-gold group-hover:text-gold-light transition-colors flex items-center gap-2">
                  PLAY WAYTABLE <span className="group-hover:translate-x-2 transition-transform duration-300 inline-block">→</span>
                </div>
              </div>
            </Link>

            {/* The DM */}
            <Link href="/games/the-dm" className="group block reveal-left">
              <div className="relative rounded-xl overflow-hidden border border-gold/20 bg-bark p-12 hover-lift">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(196,62,28,0.1) 0%, transparent 70%)" }} />
                {/* Animated corner accent */}
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-ember/40 group-hover:border-ember transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-ember/40 group-hover:border-ember transition-colors duration-300" />

                <div className="font-display text-xs tracking-widest text-ember mb-4">2D ACTION RPG · KICKSTARTER</div>
                <h3 className="font-display text-gold-light leading-none mb-4" style={{ fontSize: "clamp(40px, 6vw, 72px)" }}>THE DM</h3>
                <p className="text-sm leading-relaxed text-gold-dim mb-8">
                  An asymmetric 2D action-RPG where one player becomes the Dungeon Master — controlling enemies, placing traps, reshaping the dungeon in real time. 13 D&D classes. 5-act campaign. Endless chaos.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {["Godot 4", "13 Classes", "DM Mode", "Co-op", "PC"].map(tag => (
                    <span key={tag} className="tag text-xs px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">{tag}</span>
                  ))}
                </div>
                <div className="font-display text-sm tracking-widest text-gold group-hover:text-gold-light transition-colors flex items-center gap-2">
                  VIEW CAMPAIGN <span className="group-hover:translate-x-2 transition-transform duration-300 inline-block">→</span>
                </div>
              </div>
            </Link>

            {/* Geostory */}
            <Link href="/games/geostory" className="group block reveal-right">
              <div className="relative rounded-xl overflow-hidden border border-forest/30 p-12 hover-lift"
                style={{ background: "linear-gradient(135deg, #0c1a0a, #122010)" }}>
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(45,90,39,0.15) 0%, transparent 70%)" }} />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-forest/40 group-hover:border-forest-bright transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-forest/40 group-hover:border-forest-bright transition-colors duration-300" />

                <div className="font-display text-xs tracking-widest text-forest-light mb-4">HISTORICAL STRATEGY · KICKSTARTER</div>
                <h3 className="font-display text-forest-bright leading-none mb-4" style={{ fontSize: "clamp(40px, 6vw, 72px)" }}>GEOSTORY</h3>
                <p className="text-sm leading-relaxed mb-8" style={{ color: "#7a9070" }}>
                  The strategy game Civilization fans have been waiting for. Fast turns, deep historical realism, true scenario recreation from ancient empires to near-future geopolitics. Geography meets destiny.
                </p>
                <div className="flex flex-wrap gap-2 mb-8">
                  {["4X Strategy", "Historical", "Fast Turns", "Scenarios", "PC"].map(tag => (
                    <span key={tag} className="tag text-xs px-3 py-1 rounded-full font-medium border"
                      style={{ background: "rgba(45,90,39,0.15)", color: "#4a9a3e", borderColor: "rgba(45,90,39,0.3)" }}>{tag}</span>
                  ))}
                </div>
                <div className="font-display text-sm tracking-widest text-forest-light group-hover:text-forest-bright transition-colors flex items-center gap-2">
                  VIEW CAMPAIGN <span className="group-hover:translate-x-2 transition-transform duration-300 inline-block">→</span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── IN THE WORKSHOP ── */}
      <section className="py-28 bg-bark/20 border-y border-gold-dim/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-4">IN THE WORKSHOP</div>
            <h2 className="font-display text-4xl md:text-5xl text-gold-light">MORE WORLDS IN PROGRESS</h2>
            <p className="text-sm leading-relaxed text-cream-dim/60 max-w-2xl mx-auto mt-5">
              Alongside Waytable, The DM, and Geostory, we keep a bench of Godot prototypes — small, strange, and built to find the fun fast.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: "Beat Knight", status: "Godot prototype", desc: "A rhythm-combat side-scroller where stages sync to the music and your combo raises the intensity." },
              { name: "Mage of Tharad Zur", status: "Godot prototype", desc: "An endless runner where you draw sigils on screen to cast spells — power builds corruption, and corruption bites back." },
              { name: "Minotaur Rampage", status: "Godot prototype", desc: "A 3D kaiju rampage for 1–4 minotaurs: smash the city, earn gold, upgrade, and smash it harder." },
              { name: "Harvest Ledger", status: "Godot prototype", desc: "A farming-and-ledger experiment in active development." },
              { name: "Twerk Monster", status: "Godot prototype", desc: "A monster prototype in active development. Yes, really. That is the name." },
            ].map(({ name, status, desc }, i) => (
              <div key={name} className="reveal rounded-xl border border-gold/15 bg-ink p-6 hover-lift" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="font-display text-xs tracking-widest text-gold mb-3">{status}</div>
                <h3 className="font-display text-2xl text-gold-light mb-3">{name}</h3>
                <p className="text-sm leading-relaxed text-cream-dim/60">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ANIMATED STATS ── */}
      <section className="py-20 border-y border-gold-dim/10" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(201,150,58,0.04) 0%, transparent 70%), #0a0704" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: 566, prefix: "$", suffix: "K+", label: "In Grants Secured" },
              { num: 10, prefix: "", suffix: "+ Yrs", label: "Research Experience" },
              { num: 8, prefix: "", suffix: "", label: "Projects in Development" },
              { num: 13, prefix: "", suffix: "", label: "Playable Classes" },
            ].map(({ num, prefix, suffix, label }) => (
              <div key={label} className="reveal-scale">
                <div
                  className="font-display text-4xl md:text-6xl text-gold-light mb-2"
                  data-count={String(num)}
                  data-prefix={prefix}
                  data-suffix={suffix}
                >
                  {prefix}0{suffix}
                </div>
                <div className="text-xs tracking-widest font-display text-gold-dim">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEVLOG PREVIEW ── */}
      <section className="py-28 bg-ink">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-16 reveal">
            <div>
              <div className="font-display text-xs tracking-widest text-gold-dim mb-4">DEVLOG</div>
              <h2 className="font-display text-4xl md:text-5xl text-gold-light">BUILDING IN PUBLIC</h2>
            </div>
            <Link href="/devlog" className="font-display text-sm tracking-widest text-gold hover:text-gold-light transition-colors hidden md:flex items-center gap-2">
              ALL POSTS <span>→</span>
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { date: "Apr 2026", tag: "THE DM", title: "Why We Chose Godot 4 Over Unity", excerpt: "After months of evaluation, we made the call. Here's exactly why Godot 4 won — and what we gave up to get there.", color: "#c43e1c" },
              { date: "Mar 2026", tag: "GEOSTORY", title: "The Problem With Civ's Geography", excerpt: "A PhD geographer's honest breakdown of everything Civilization gets wrong about how terrain shapes civilization — and how we're fixing it.", color: "#4a9a3e" },
              { date: "Mar 2026", tag: "STUDIO", title: "Emboogway: Why That Name", excerpt: "The question we get asked most. Here's the real answer — and what it tells you about how we approach everything.", color: "#c9963a" },
            ].map(({ date, tag, title, excerpt, color }, i) => (
              <Link key={title} href="/devlog" className="group block reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="rounded-xl border border-gold/12 bg-bark p-6 hover-lift h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-display text-xs tracking-widest px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>{tag}</span>
                    <span className="text-xs text-gold-dim">{date}</span>
                  </div>
                  <h3 className="font-display text-lg text-gold-light mb-3 group-hover:text-gold transition-colors leading-tight flex-1">{title}</h3>
                  <p className="text-sm leading-relaxed text-cream-dim/50 mb-4">{excerpt}</p>
                  <div className="font-display text-xs tracking-widest text-gold-dim group-hover:text-gold transition-colors flex items-center gap-1">
                    READ MORE <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8 md:hidden reveal">
            <Link href="/devlog" className="font-display text-sm tracking-widest text-gold">ALL POSTS →</Link>
          </div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className="py-28 bg-bark/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-4">WHY EMBOOGWAY</div>
            <h2 className="font-display text-4xl md:text-5xl text-gold-light">NOT YOUR AVERAGE STUDIO</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "🎓", title: "PhD-Level Design", desc: "Geostory is built by an actual PhD geographer. The rivers, climate zones, and historical accuracy aren't guesswork — they're modeled correctly.", delay: 0 },
              { icon: "💡", title: "Gaps, Not Genres", desc: "We don't make another RPG or another strategy game. We make games that fill genuine holes — experiences that players want but can't find anywhere.", delay: 100 },
              { icon: "🤝", title: "Community Shaped", desc: "No pay-to-win. No loot boxes. All content earnable. Backers shape stretch goals. We build in public and take feedback seriously.", delay: 200 },
            ].map(({ icon, title, desc, delay }) => (
              <div key={title} className="reveal-scale" style={{ transitionDelay: `${delay}ms` }}>
                <div className="rounded-xl border border-gold/15 bg-bark p-8 hover-lift text-center h-full">
                  <div className="text-4xl mb-4">{icon}</div>
                  <div className="font-display text-xl text-gold-light mb-4">{title}</div>
                  <p className="text-sm leading-relaxed text-cream-dim/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-32 px-6 text-center overflow-hidden bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(201,150,58,0.07) 0%, transparent 70%)" }} />
        <Particles count={15} />
        <div className="relative z-10 reveal">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">GET INVOLVED</div>
          <h2 className="font-display text-4xl md:text-6xl text-gold-light mb-6">BE PART OF THE STORY</h2>
          <p className="font-serif italic text-lg text-cream-dim/70 max-w-md mx-auto mb-10">
            Join the waitlist. Be first to know when our Kickstarters go live — and get devlog drops in between.
          </p>
          <WaitlistForm source="homepage" cta="JOIN THE WAITLIST" />
        </div>
      </section>
    </>
  );
}
