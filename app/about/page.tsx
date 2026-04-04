import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Emboogway",
  description: "Get in touch with Emboogway. Press kit, partnerships, and contact information for the indie game studio behind The DM and Geostory.",
};

export default function About() {
  return (
    <>
      <section style={{
        minHeight: "60vh",
        background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.08) 0%, transparent 60%), #0f0b06",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        paddingTop: "120px", paddingBottom: "60px", textAlign: "center",
      }}>
        <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#7a5e20" }}>CONTACT & PRESS</div>
        <h1 className="font-display" style={{ fontSize: "clamp(48px, 10vw, 100px)", color: "#f0c060", letterSpacing: "0.08em" }}>
          ABOUT
        </h1>
        <p className="font-serif italic text-xl mt-6 max-w-xl mx-auto px-6" style={{ color: "#c8b898" }}>
          We&apos;re a small team with big ideas. Let&apos;s talk.
        </p>
      </section>

      <section style={{ padding: "80px 0", background: "#0f0b06" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 32px" }}>
          <div className="grid md:grid-cols-2 gap-10">

            <div className="p-8 rounded-xl" style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.2)" }}>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>GENERAL INQUIRIES</div>
              <h2 className="font-display text-2xl mb-4" style={{ color: "#f0c060" }}>SAY HELLO</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#a89070" }}>
                For general questions, partnership opportunities, or just to say hi — our inbox is always open.
              </p>
              <a
                href="mailto:hello@emboogway.com"
                className="btn-gold px-6 py-3 rounded text-sm inline-block"
              >
                hello@emboogway.com
              </a>
            </div>

            <div className="p-8 rounded-xl" style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.2)" }}>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>PRESS & MEDIA</div>
              <h2 className="font-display text-2xl mb-4" style={{ color: "#f0c060" }}>PRESS KIT</h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "#a89070" }}>
                Journalists, YouTubers, and streamers — our press kit has everything you need: 
                logos, screenshots, game descriptions, and founder bio.
              </p>
              <a
                href="mailto:press@emboogway.com"
                className="btn-outline px-6 py-3 rounded text-sm inline-block"
              >
                press@emboogway.com
              </a>
            </div>

            <div className="p-8 rounded-xl md:col-span-2" style={{ background: "#1c1408", border: "1px solid rgba(201,150,58,0.2)" }}>
              <div className="font-display text-xs tracking-widest mb-4" style={{ color: "#c9963a" }}>STAY CONNECTED</div>
              <h2 className="font-display text-2xl mb-6" style={{ color: "#f0c060" }}>JOIN THE COMMUNITY</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Twitter/X", handle: "@Emboogway", color: "#c9963a" },
                  { label: "Discord", handle: "discord.gg/emboogway", color: "#7acc6a" },
                  { label: "Kickstarter", handle: "Follow Us", color: "#c43e1c" },
                ].map(({ label, handle, color }) => (
                  <div key={label} className="p-4 rounded-lg text-center" style={{ background: "#2a1f0e", border: `1px solid ${color}22` }}>
                    <div className="font-display text-sm mb-2" style={{ color }}>{label}</div>
                    <div className="text-xs" style={{ color: "#7a5e20" }}>{handle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div className="divider-gold mb-12" />
            <div className="font-display text-xs tracking-widest mb-6" style={{ color: "#7a5e20" }}>OUR GAMES</div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/games/the-dm" className="btn-gold px-8 py-4 rounded text-sm">
                THE DM — VIEW CAMPAIGN
              </Link>
              <Link href="/games/geostory" className="btn-outline px-8 py-4 rounded text-sm">
                GEOSTORY — VIEW CAMPAIGN
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
