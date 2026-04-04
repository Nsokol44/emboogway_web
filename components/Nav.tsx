"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/games/the-dm", label: "The DM" },
    { href: "/games/geostory", label: "Geostory" },
    { href: "/devlog", label: "Devlog" },
    { href: "/lore", label: "Lore" },
    { href: "/studio", label: "Studio" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-ink/95 backdrop-blur-md border-b border-gold-dim/20" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded bg-gradient-to-br from-gold-dim to-gold flex items-center justify-center font-display text-base text-ink group-hover:scale-110 transition-transform duration-300">
            E
          </div>
          <span className="font-display text-xl tracking-widest text-gold-light hidden sm:block">EMBOOGWAY</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-cream-dim hover:text-gold-light transition-colors duration-200 tracking-wide">
              {l.label}
            </Link>
          ))}
          <Link href="/games/the-dm#kickstarter" className="btn-shimmer px-5 py-2 rounded text-sm">
            Back Us
          </Link>
        </div>

        <button className="md:hidden p-2 text-gold-light" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-5 bg-ink/98 border-t border-gold-dim/20">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="font-display text-lg tracking-widest text-cream-dim hover:text-gold-light transition-colors" onClick={() => setOpen(false)}>
              {l.label}
            </Link>
          ))}
          <Link href="/games/the-dm#kickstarter" className="btn-shimmer px-5 py-3 rounded text-center text-sm" onClick={() => setOpen(false)}>
            Back Us on Kickstarter
          </Link>
        </div>
      )}
    </nav>
  );
}
