import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-ink border-t border-gold-dim/20">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Image src="/emboogway-wordmark-light.png" alt="Emboogway" width={2720} height={427} className="h-9 w-auto mb-4" />
            <p className="text-sm leading-relaxed text-gold-dim mb-4">
              An indie game studio making bold, original games. Knoxville, TN.
            </p>
            <div className="flex gap-4 items-center flex-wrap">
              <a href="https://www.instagram.com/emboogway/" target="_blank" rel="noreferrer" className="text-xs font-display tracking-widest text-gold hover:text-gold-light transition-colors">Follow us on Instagram</a>
            </div>
          </div>
          <div>
            <div className="font-display text-xs tracking-widest text-gold mb-4">GAMES</div>
            <div className="flex flex-col gap-3">
              <Link href="/games/waytable" className="text-sm text-cream-dim hover:text-gold-light transition-colors">Waytable</Link>
              <Link href="/games/the-dm" className="text-sm text-cream-dim hover:text-gold-light transition-colors">The DM</Link>
              <Link href="/games/geostory" className="text-sm text-cream-dim hover:text-gold-light transition-colors">Geostory</Link>
              <Link href="/games/the-dm#waitlist" className="text-sm text-gold hover:text-gold-light transition-colors font-medium">→ Join the waitlist</Link>
            </div>
          </div>
          <div>
            <div className="font-display text-xs tracking-widest text-gold mb-4">EXPLORE</div>
            <div className="flex flex-col gap-3">
              <Link href="/devlog" className="text-sm text-cream-dim hover:text-gold-light transition-colors">Devlog</Link>
              <Link href="/lore" className="text-sm text-cream-dim hover:text-gold-light transition-colors">Lore</Link>
              <Link href="/studio" className="text-sm text-cream-dim hover:text-gold-light transition-colors">Studio</Link>
              <Link href="/about" className="text-sm text-cream-dim hover:text-gold-light transition-colors">About</Link>
            </div>
          </div>
          <div>
            <div className="font-display text-xs tracking-widest text-gold mb-4">CONTACT</div>
            <div className="flex flex-col gap-3">
              <a href="mailto:hello@emboogway.com" className="text-sm text-cream-dim hover:text-gold-light transition-colors">hello@emboogway.com</a>
              <a href="mailto:press@emboogway.com" className="text-sm text-cream-dim hover:text-gold-light transition-colors">press@emboogway.com</a>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent mb-6" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gold-dim/50">© {new Date().getFullYear()} Emboogway. All rights reserved.</p>
          <p className="text-xs font-serif italic text-gold-dim/50">Made with obsession in Knoxville, TN</p>
        </div>
      </div>
    </footer>
  );
}
