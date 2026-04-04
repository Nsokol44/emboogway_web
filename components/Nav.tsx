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
    { href: "/", label: "Home" },
    { href: "/games/the-dm", label: "The DM" },
    { href: "/games/geostory", label: "Geostory" },
    { href: "/studio", label: "Studio" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(15,11,6,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(201,150,58,0.15)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-9 h-9 rounded-sm flex items-center justify-center text-sm font-display transition-all duration-300 group-hover:scale-110"
            style={{
              background: "linear-gradient(135deg, #7a5e20, #c9963a)",
              color: "#0f0b06",
              fontSize: "16px",
              letterSpacing: "0.05em",
            }}
          >
            E
          </div>
          <span
            className="font-display text-xl tracking-widest hidden sm:block"
            style={{ color: "#f0c060" }}
          >
            EMBOOGWAY
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover-underline text-sm font-medium tracking-wide"
              style={{ color: "#e8dcc8", fontFamily: "'DM Sans', sans-serif" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#f0c060")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#e8dcc8")}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/games/the-dm#kickstarter"
            className="btn-gold px-5 py-2 rounded text-sm font-bold"
          >
            Back Us
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2"
          style={{ color: "#f0c060" }}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-5"
          style={{ background: "rgba(15,11,6,0.98)", borderTop: "1px solid rgba(201,150,58,0.15)" }}
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-display text-lg tracking-widest"
              style={{ color: "#e8dcc8" }}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/games/the-dm#kickstarter"
            className="btn-gold px-5 py-3 rounded text-center text-sm"
            onClick={() => setOpen(false)}
          >
            Back Us on Kickstarter
          </Link>
        </div>
      )}
    </nav>
  );
}
