import type { Metadata } from "next";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Devlog — Emboogway",
  description: "Follow Emboogway's development journey. Weekly devlogs on The DM, Geostory, and the indie game building process.",
};

const posts = [
  {
    slug: "why-godot-4",
    date: "April 2, 2026",
    tag: "THE DM",
    tagColor: "#c43e1c",
    title: "Why We Chose Godot 4 Over Unity",
    excerpt: "After months of evaluation, we made the call. Here's exactly why Godot 4 won — and what we gave up to get there. Spoiler: the 2D physics engine sealed it.",
    readTime: "6 min read",
  },
  {
    slug: "civs-geography-problem",
    date: "March 22, 2026",
    tag: "GEOSTORY",
    tagColor: "#4a9a3e",
    title: "The Problem With Civ's Geography",
    excerpt: "A PhD geographer's honest breakdown of everything Civilization gets wrong about how terrain shapes civilization — and how Geostory is fixing it with real data.",
    readTime: "9 min read",
  },
  {
    slug: "why-emboogway",
    date: "March 10, 2026",
    tag: "STUDIO",
    tagColor: "#c9963a",
    title: "Emboogway: Why That Name",
    excerpt: "The question we get asked most. The real answer — and what it tells you about how we approach everything we build.",
    readTime: "3 min read",
  },
  {
    slug: "dm-mode-design",
    date: "February 28, 2026",
    tag: "THE DM",
    tagColor: "#c43e1c",
    title: "Designing DM Mode: When the Dungeon Thinks",
    excerpt: "The hardest design problem in The DM isn't the combat — it's making the Dungeon Master role genuinely fun and fair at the same time. Here's how we solved it.",
    readTime: "8 min read",
  },
  {
    slug: "historical-accuracy-vs-fun",
    date: "February 14, 2026",
    tag: "GEOSTORY",
    tagColor: "#4a9a3e",
    title: "Historical Accuracy vs. Fun: Where's the Line?",
    excerpt: "If plague kills half your population in 1348, is that good gameplay or bad? We worked through exactly where realism serves the game and where it fights it.",
    readTime: "7 min read",
  },
  {
    slug: "kickstarter-lessons",
    date: "January 30, 2026",
    tag: "STUDIO",
    tagColor: "#c9963a",
    title: "What I Learned Raising $566K in Research Grants (And How It Applies to Kickstarter)",
    excerpt: "Federal grant writing and crowdfunding have more in common than you'd think. The frameworks that win DOE funding translate directly to Kickstarter strategy.",
    readTime: "10 min read",
  },
];

export default function Devlog() {
  return (
    <>
      <ScrollReveal />
      <section className="relative min-h-64 flex flex-col items-center justify-center pt-32 pb-16 text-center bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.08) 0%, transparent 60%)" }} />
        <div className="relative z-10 px-6">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">BUILDING IN PUBLIC</div>
          <h1 className="font-display text-gold-light" style={{ fontSize: "clamp(48px, 10vw, 100px)", letterSpacing: "0.08em" }}>DEVLOG</h1>
          <p className="font-serif italic text-xl mt-4 text-cream-dim/60 max-w-lg mx-auto">
            Follow the build. Watch us figure it out in real time.
          </p>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-4xl mx-auto px-6">
          {/* Featured post */}
          <div className="reveal mb-8">
            <div className="rounded-xl border border-gold/25 bg-bark p-8 md:p-12 hover-lift relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)" }} />
              <div className="flex items-center gap-3 mb-4">
                <span className="font-display text-xs tracking-widest px-2 py-1 rounded"
                  style={{ background: `${posts[0].tagColor}20`, color: posts[0].tagColor }}>
                  {posts[0].tag}
                </span>
                <span className="text-xs text-gold-dim">{posts[0].date}</span>
                <span className="text-xs text-gold-dim">· {posts[0].readTime}</span>
                <span className="font-display text-xs tracking-widest px-2 py-0.5 rounded bg-gold/15 text-gold-light">LATEST</span>
              </div>
              <h2 className="font-display text-2xl md:text-4xl text-gold-light mb-4 leading-tight">{posts[0].title}</h2>
              <p className="leading-relaxed text-cream-dim/60 mb-6 max-w-2xl">{posts[0].excerpt}</p>
              <button className="font-display text-sm tracking-widest text-gold hover:text-gold-light transition-colors flex items-center gap-2">
                READ FULL POST <span>→</span>
              </button>
            </div>
          </div>

          {/* Post grid */}
          <div className="space-y-4">
            {posts.slice(1).map((post, i) => (
              <div key={post.slug} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="rounded-xl border border-gold/12 bg-bark p-6 hover-lift flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-display text-xs tracking-widest px-2 py-0.5 rounded"
                        style={{ background: `${post.tagColor}20`, color: post.tagColor }}>{post.tag}</span>
                      <span className="text-xs text-gold-dim">{post.date}</span>
                      <span className="text-xs text-gold-dim">· {post.readTime}</span>
                    </div>
                    <h3 className="font-display text-lg md:text-xl text-gold-light mb-2 leading-tight">{post.title}</h3>
                    <p className="text-sm text-cream-dim/50 leading-relaxed">{post.excerpt}</p>
                  </div>
                  <button className="font-display text-sm tracking-widest text-gold hover:text-gold-light transition-colors flex-shrink-0 flex items-center gap-2">
                    READ <span>→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-6">NEVER MISS A POST</div>
            <h3 className="font-display text-3xl text-gold-light mb-4">GET DEVLOG UPDATES</h3>
            <form className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <input type="email" placeholder="your@email.com"
                className="flex-1 px-4 py-3 rounded text-sm bg-bark border border-gold/30 text-cream placeholder-gold-dim/50 outline-none focus:border-gold transition-colors" />
              <button type="submit" className="btn-shimmer px-6 py-3 rounded text-sm">SUBSCRIBE</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
