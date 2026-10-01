import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Emboogway | Indie Game Studio", template: "%s | Emboogway" },
  description: "Emboogway is an indie game studio crafting bold, original games: Waytable, the browser AI-DM tabletop platform; The DM, a 2D action-RPG with asymmetric DM gameplay; and Geostory, the fast-paced historical strategy game.",
  keywords: ["indie game studio", "Waytable", "AI DM", "tabletop RPG platform", "The DM game", "Geostory game", "Kickstarter games", "2D action RPG", "historical strategy game", "Emboogway"],
  authors: [{ name: "Emboogway" }],
  creator: "Emboogway",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://emboogway.com",
    siteName: "Emboogway",
    title: "Emboogway | Indie Game Studio",
    description: "Crafting bold, original games. Waytable is live in the browser; The DM & Geostory are in development.",
    images: [{ url: "/emboogway-wordmark-dark.png", width: 2720, height: 427, alt: "Emboogway" }],
  },
  robots: { index: true, follow: true },
  metadataBase: new URL("https://emboogway.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
