import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import WaitlistForm from "@/components/WaitlistForm";
import { articles } from "./articles";

export const metadata: Metadata = {
  title: "Devlog — Emboogway",
  description: "Follow Emboogway's development journey. Real build notes on Waytable, The DM, and the indie game building process.",
};

export default function Devlog() {
  const [featured, ...rest] = articles;

  return (
    <>
      <ScrollReveal />
      <section className="relative min-h-64 flex flex-col items-center justify-center pt-32 pb-16 text-center bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.08) 0%, transparent 60%)" }} />
        <div className="relative z-10 px-6">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">BUILDING IN PUBLIC</div>
          <h1 className="font-display text-gold-light" style={{ fontSize: "clamp(48px, 10vw, 100px)", letterSpacing: "0.08em" }}>DEVLOG</h1>
          <p className="font-serif italic text-xl mt-4 text-cream-dim/60 max-w-lg mx-auto">
            Follow the build. Real notes, no vapor.
          </p>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-4xl mx-auto px-6">
          {/* Featured post */}
          <Link href={`/devlog/${featured.slug}`} className="reveal mb-8 block">
            <div className="rounded-xl border border-gold/25 bg-bark p-8 md:p-12 hover-lift relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,150,58,0.06) 0%, transparent 70%)" }} />
              <div className="flex items-center gap-3 mb-4">
                <span className="font-display text-xs tracking-widest px-2 py-1 rounded"
                  style={{ background: `${featured.tagColor}20`, color: featured.tagColor }}>
                  {featured.tag}
                </span>
                <span className="text-xs text-gold-dim">{featured.date}</span>
                <span className="text-xs text-gold-dim">· {featured.readTime}</span>
                <span className="font-display text-xs tracking-widest px-2 py-0.5 rounded bg-gold/15 text-gold-light">LATEST</span>
              </div>
              <h2 className="font-display text-2xl md:text-4xl text-gold-light mb-4 leading-tight">{featured.title}</h2>
              <p className="leading-relaxed text-cream-dim/60 mb-6 max-w-2xl">{featured.excerpt}</p>
              <span className="font-display text-sm tracking-widest text-gold">
                READ FULL POST <span>→</span>
              </span>
            </div>
          </Link>

          {/* Post grid */}
          <div className="space-y-4">
            {rest.map((post, i) => (
              <Link key={post.slug} href={`/devlog/${post.slug}`} className="reveal block" style={{ transitionDelay: `${i * 80}ms` }}>
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
                  <span className="font-display text-sm tracking-widest text-gold flex-shrink-0 flex items-center gap-2">
                    READ <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-16 text-center reveal">
            <div className="font-display text-xs tracking-widest text-gold-dim mb-6">NEVER MISS A POST</div>
            <h3 className="font-display text-3xl text-gold-light mb-4">GET DEVLOG UPDATES</h3>
            <WaitlistForm source="devlog" cta="SUBSCRIBE" />
          </div>
        </div>
      </section>
    </>
  );
}
