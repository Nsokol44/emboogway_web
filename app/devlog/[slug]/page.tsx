import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ScrollReveal from "@/components/ScrollReveal";
import { articles, getArticle } from "../articles";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Not found — Emboogway Devlog" };
  return {
    title: `${article.title} — Emboogway Devlog`,
    description: article.excerpt,
  };
}

export default async function DevlogArticle({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <>
      <ScrollReveal />
      <section className="pt-40 pb-16 bg-ink">
        <div className="max-w-3xl mx-auto px-6">
          <Link href="/devlog" className="font-display text-xs tracking-widest text-gold hover:text-gold-light transition-colors">
            ← ALL POSTS
          </Link>
          <div className="flex items-center gap-3 mt-8 mb-5">
            <span
              className="font-display text-xs tracking-widest px-2 py-1 rounded"
              style={{ background: `${article.tagColor}20`, color: article.tagColor }}
            >
              {article.tag}
            </span>
            <span className="text-xs text-gold-dim">{article.date}</span>
            <span className="text-xs text-gold-dim">· {article.readTime}</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl text-gold-light leading-tight mb-6">{article.title}</h1>
          <p className="font-serif italic text-lg text-cream-dim/70 mb-10">{article.excerpt}</p>
          <div className="space-y-6">
            {article.body.map((para, i) => (
              <p key={i} className="leading-relaxed text-cream-dim/80 text-lg">
                {para}
              </p>
            ))}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent my-12" />
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/games/waytable" className="btn-shimmer px-8 py-4 rounded text-base font-bold text-center">
              PLAY WAYTABLE
            </Link>
            <Link
              href="/games/the-dm#waitlist"
              className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-base hover:bg-gold/10 text-center"
            >
              THE DM WAITLIST
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
