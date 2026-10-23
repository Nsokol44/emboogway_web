"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  /* prerendered pages bake the standard nav (usePathname is null at
     prerender), so the slim overlay swaps in only after mount — server
     HTML and first client render always agree */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/games/waytable", label: "Waytable" },
    { href: "/games/the-dm", label: "The DM" },
    { href: "/games/geostory", label: "Geostory" },
    { href: "/devlog", label: "Devlog" },
    { href: "/lore", label: "Lore" },
    { href: "/studio", label: "Studio" },
  ];

  /* GeoStory: the simulator is a full-screen stage, so the site header
     shrinks to a slim translucent overlay — logo + links, click-through
     everywhere except on the links themselves. */
  if (mounted && pathname === "/games/geostory") {
    return (
      <nav className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-[#030b16]/85 via-[#030b16]/45 to-transparent">
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href="/" className="pointer-events-auto flex items-center gap-3" aria-label="Emboogway home">
            <Image
              src="/emboogway-wordmark-light.png"
              alt="Emboogway"
              width={2720}
              height={427}
              priority
              className="h-5 w-auto sm:h-6"
            />
          </Link>
          <div className="pointer-events-auto hidden items-center gap-5 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-xs font-medium tracking-wide text-cream-dim transition-colors duration-200 hover:text-gold-light">
                {l.label}
              </Link>
            ))}
            <Link href="/games/the-dm#waitlist" className="btn-shimmer rounded px-4 py-1.5 text-xs">
              Waitlist
            </Link>
          </div>
          <Link href="/" className="pointer-events-auto text-xs font-medium tracking-wide text-cream-dim transition-colors hover:text-gold-light md:hidden">
            Home
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-ink/95 backdrop-blur-md border-b border-gold-dim/20" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" aria-label="Emboogway home">
          <Image
            src="/emboogway-wordmark-light.png"
            alt="Emboogway"
            width={2720}
            height={427}
            priority
            className="h-7 w-auto group-hover:scale-[1.03] transition-transform duration-300 sm:h-8"
          />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-cream-dim hover:text-gold-light transition-colors duration-200 tracking-wide">
              {l.label}
            </Link>
          ))}
          <Link href="/games/the-dm#waitlist" className="btn-shimmer px-5 py-2 rounded text-sm">
            Waitlist
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
          <Link href="/games/the-dm#waitlist" className="btn-shimmer px-5 py-3 rounded text-center text-sm" onClick={() => setOpen(false)}>
            Join the Waitlist
          </Link>
        </div>
      )}
    </nav>
  );
}
