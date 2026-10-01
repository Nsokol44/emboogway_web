export type Article = {
  slug: string;
  date: string;
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  readTime: string;
  body: string[];
};

export const articles: Article[] = [
  {
    slug: "the-dm-playable-today",
    date: "October 1, 2026",
    tag: "THE DM",
    tagColor: "#c43e1c",
    title: "The DM, playable today: 4 classes, 4 missions, 1–4 players",
    excerpt:
      "No more renders and roadmaps without a build. Here is exactly what the playable prototype of The DM does right now — and what it doesn't do yet.",
    readTime: "4 min read",
    body: [
      "The DM is the public name for the game we've been developing under the working title DnD Action Adventure. Same game, same codebase — one project, not two.",
      "What runs today: a real-time action RPG for 1–4 players on one machine. Four classes — Warrior, Rogue, Mage, Cleric — each with distinct abilities. Four missions, each with three stages: The Missing Child, Terror of the Vale, Bandit Troubles, and The Restless Dead. You pick a class, get a mission briefing, fight through real-time arena combat, and spend earned points on upgrades between runs.",
      "What it isn't yet: the 13-class roster, the 5-act campaign, and the human-versus-party DM mode are the campaign vision, not the current build. We're being explicit about that because we'd rather you judge the real thing than a wishlist.",
      "The next milestones are human playtests for feel and balance, real art and audio passes, and export builds. If you want to know the day the Kickstarter goes live, join the waitlist on The DM page — we'll email you once, when there's something real to back.",
    ],
  },
  {
    slug: "waytable-is-live",
    date: "October 1, 2026",
    tag: "WAYTABLE",
    tagColor: "#c9963a",
    title: "Waytable is live: an AI Dungeon Master in your browser",
    excerpt:
      "Our first playable release is out now. Start a table, share a code, and let the AI DM run the session — no installs, no books to haul.",
    readTime: "3 min read",
    body: [
      "Waytable is live and playable in the browser right now. It's a tabletop RPG platform with an AI Dungeon Master: the host starts a table and shares a code, and friends and guests join free. One host pays; the rest of the party just shows up.",
      "You build a hero and a pixel Avi to match, then run classic campaigns or monster-collector adventures — with split parties and secret DM whispers for when the table gets sneaky.",
      "The part we're proudest of: Waytable leaves the table. Trace real walking routes to level your Avi, and watch for Power Spots — real places tied to exclusive gear. The gear only appears when you're near its spot, and earning it takes the venue code plus actually being there. No buying your way past the map.",
      "It's the first Emboogway project you can play today, and it's the fastest way to see what we're about. Open it in your browser and send your friends the code.",
    ],
  },
  {
    slug: "why-a-prototype-bench",
    date: "October 1, 2026",
    tag: "STUDIO",
    tagColor: "#c9963a",
    title: "Why Emboogway keeps a bench of strange little prototypes",
    excerpt:
      "Beat Knight, Mage of Tharad Zur, Minotaur Rampage, Harvest Ledger, Twerk Monster. Here's why a tiny studio keeps five weird prototypes next to its flagships.",
    readTime: "3 min read",
    body: [
      "Alongside Waytable, The DM, and Geostory, we keep a bench of Godot prototypes. They're small, strange, and built to find the fun fast — rhythm combat, drawn-sigil spellcasting, kaiju rampages, farming ledgers, and yes, a game called Twerk Monster.",
      "The rule is simple: a prototype has to prove one fun idea, or it gets shelved. Beat Knight tests whether rhythm combat can carry a side-scroller. Mage of Tharad Zur tests whether drawing sigils on screen is a spellcasting system or a gimmick. Minotaur Rampage tests pure destruction joy for up to four minotaurs.",
      "Harvest Ledger is the serious one — a farming-and-ledger experiment about the economics of growing things. Twerk Monster is the party-game bet. Not all of them will survive, and that's the point: the bench is how a small studio takes big swings cheaply.",
      "We'll write about whichever ones earn it. The ones that find the fun graduate; the rest become good stories.",
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
