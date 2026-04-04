import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Emboogway",
  description: "Contact Emboogway. Press kit, partnerships, and general inquiries for the indie game studio behind The DM and Geostory.",
};

export default function About() {
  return (
    <>
      <section className="relative min-h-96 flex flex-col items-center justify-center pt-32 pb-16 text-center bg-ink">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(201,150,58,0.06) 0%, transparent 60%)" }} />
        <div className="relative z-10 px-6">
          <div className="font-display text-xs tracking-widest text-gold-dim mb-6">CONTACT & PRESS</div>
          <h1 className="font-display text-gold-light leading-none" style={{ fontSize: "clamp(48px, 10vw, 100px)", letterSpacing: "0.08em" }}>ABOUT</h1>
          <p className="font-serif italic text-xl mt-6 max-w-xl mx-auto text-cream-dim/70">We&apos;re a small team with big ideas. Let&apos;s talk.</p>
        </div>
      </section>

      <section className="py-20 bg-ink">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="p-8 rounded-xl bg-bark border border-gold/20">
              <div className="font-display text-xs tracking-widest text-gold mb-4">GENERAL INQUIRIES</div>
              <h2 className="font-display text-2xl text-gold-light mb-4">SAY HELLO</h2>
              <p className="text-sm leading-relaxed text-cream-dim/60 mb-6">For questions, partnerships, or just to say hi — our inbox is always open.</p>
              <a href="mailto:hello@emboogway.com" className="inline-block bg-gradient-to-r from-gold-dim via-gold to-gold-light text-ink font-display tracking-widest px-6 py-3 rounded text-sm hover:opacity-90 transition-opacity">
                hello@emboogway.com
              </a>
            </div>
            <div className="p-8 rounded-xl bg-bark border border-gold/20">
              <div className="font-display text-xs tracking-widest text-gold mb-4">PRESS & MEDIA</div>
              <h2 className="font-display text-2xl text-gold-light mb-4">PRESS KIT</h2>
              <p className="text-sm leading-relaxed text-cream-dim/60 mb-6">Journalists, YouTubers, streamers — logos, screenshots, bios, and game descriptions all in one place.</p>
              <a href="mailto:press@emboogway.com" className="inline-block border border-gold/50 text-gold-light font-display tracking-widest px-6 py-3 rounded text-sm hover:bg-gold/10 transition-all">
                press@emboogway.com
              </a>
            </div>
          </div>

          <div className="p-8 rounded-xl bg-bark border border-gold/20 mb-16">
            <div className="font-display text-xs tracking-widest text-gold mb-4">STAY CONNECTED</div>
            <h2 className="font-display text-2xl text-gold-light mb-6">JOIN THE COMMUNITY</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Twitter/X", handle: "@Emboogway", color: "#c9963a" },
                { label: "Discord", handle: "discord.gg/emboogway", color: "#7acc6a" },
                { label: "Kickstarter", handle: "Follow Us", color: "#c43e1c" },
              ].map(({ label, handle, color }) => (
                <div key={label} className="p-4 rounded-lg text-center bg-ink border" style={{ borderColor: `${color}22` }}>
                  <div className="font-display text-sm mb-1" style={{ color }}>{label}</div>
                  <div className="text-xs text-gold-dim">{handle}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent mb-12" />
            <div className="font-display text-xs tracking-widest text-gold-dim mb-6">OUR GAMES</div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/games/the-dm" className="bg-gradient-to-r from-gold-dim via-gold to-gold-light text-ink font-display tracking-widest px-8 py-4 rounded text-sm hover:opacity-90 transition-opacity">
                THE DM — VIEW CAMPAIGN
              </Link>
              <Link href="/games/geostory" className="border border-gold/50 text-gold-light font-display tracking-widest px-8 py-4 rounded text-sm hover:bg-gold/10 transition-all">
                GEOSTORY — VIEW CAMPAIGN
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
