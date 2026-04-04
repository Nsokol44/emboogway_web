import Link from "next/link";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#0a0704",
        borderTop: "1px solid rgba(201,150,58,0.15)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="font-display text-3xl tracking-widest mb-3" style={{ color: "#f0c060" }}>
              EMBOOGWAY
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#7a6a50" }}>
              An indie game studio making bold, original games that don&apos;t play it safe.
              Based in Knoxville, TN.
            </p>
            <div className="mt-4 flex gap-4">
              {["Twitter/X", "Discord", "Kickstarter"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-xs font-medium hover-underline"
                  style={{ color: "#c9963a" }}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Games */}
          <div>
            <div className="font-display text-sm tracking-widest mb-4" style={{ color: "#c9963a" }}>
              GAMES
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/games/the-dm" className="text-sm hover-underline" style={{ color: "#e8dcc8" }}>
                The DM — 2D Action RPG
              </Link>
              <Link href="/games/geostory" className="text-sm hover-underline" style={{ color: "#e8dcc8" }}>
                Geostory — Historical Strategy
              </Link>
            </div>
          </div>

          {/* Studio */}
          <div>
            <div className="font-display text-sm tracking-widest mb-4" style={{ color: "#c9963a" }}>
              STUDIO
            </div>
            <div className="flex flex-col gap-3">
              <Link href="/studio" className="text-sm hover-underline" style={{ color: "#e8dcc8" }}>Studio</Link>
              <Link href="/about" className="text-sm hover-underline" style={{ color: "#e8dcc8" }}>About</Link>
              <a href="mailto:hello@emboogway.com" className="text-sm hover-underline" style={{ color: "#e8dcc8" }}>
                hello@emboogway.com
              </a>
            </div>
          </div>
        </div>

        <div className="divider-gold mb-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs" style={{ color: "#4a3e2e" }}>
            © {new Date().getFullYear()} Emboogway. All rights reserved.
          </p>
          <p className="text-xs font-serif italic" style={{ color: "#4a3e2e" }}>
            Made with obsession in Knoxville, TN
          </p>
        </div>
      </div>
    </footer>
  );
}
