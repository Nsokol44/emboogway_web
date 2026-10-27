# GeoStory Religion Layer (v1)

A parallel dominance track: every country has a dominant faith, faiths
spread by cultural gravity, and a per-year religion leaderboard sits
beside the power leaderboard. Faith is **mechanics-only and respectful
by design** — named real-world traditions, no caricatures, and in v1
religion **never feeds** power, influence, economic or annexation
formulas. All pre-religion fields of every legacy run stay bit-identical
(verified field-by-field against the pre-religion engine).

## Faiths

Christianity · Islam · Hinduism · Buddhism · Judaism · Sikhism ·
Chinese folk religion · Folk / indigenous traditions · Unaffiliated.

Each faith has a **proselytism coefficient** (`spread` in
`lib/religion.ts`): missionary traditions (Christianity, Islam,
Buddhism) project their gravity in full; traditions that do not seek
converts in their modern form (Hinduism 0.3, Judaism 0.15, folk 0.3)
mostly hold their heartlands. Unaffiliated spreads at 0.9 — secular
drift is a real current in the model. Sikhism starts with **no
heartland country**: no sovereign state in the dataset (or the real
world) has a Sikh majority or plurality, so in v1 it is a diaspora
faith that cannot become dominant anywhere. That is a fact of the
starting map, documented here rather than papered over.

## Starting state

`lib/data/religion.json`: dominant faith + that faith's population
share for all 175 countries, authored from Pew Research Center
world-religion majorities (2020-era estimates). Judgement calls:
China = Unaffiliated plurality (Pew counts most Chinese practice as
unaffiliated, with folk religion second); Taiwan = Chinese folk
plurality; Vietnam = folk plurality; Japan = folk (Shinto/Buddhist
practice); France/Germany/UK = Christian pluralities per Pew.

## Mechanics (lib/engine.ts, religion step; tuning in lib/religion.ts)

Faith pressure is **receptivity × gravity over distance** — faiths jump
oceans via migration and trade, so no country is structurally locked
out (the universal-adjacency fix is not what gates faith; distance
never zeroes out).

- **Radiation** per country: `adherents^0.75 × soft power (tech) ×
  ascendancy`. The 0.75 compression keeps organised projection
  sub-linear in population, so a 2B-adherent giant does not swamp
  every small neighbour. Ascendancy rewards countries that have risen
  far above their starting GDP — rising powers export their culture.
- **Score** per faith at a country: root-sum-square of distance-decayed
  radiation from every country where the faith is dominant (strongest
  channels dominate; a 51-homeland faith must not win by headcount),
  × the faith's `spread`, × neighbour (1.3) / top-influencer (1.15) /
  controller (1.25) bonuses.
- **Home defence**: the incumbent adds its own radiation at home plus
  `130 × share` (institutions, clergy, family transmission). A small
  nation's religious identity is not proportionally weaker than a
  giant's.
- **Flips**: a challenger whose score beats the incumbent accumulates
  pressure (capped per year, decaying ×0.9); past 8.0 sustained, the
  country's dominant faith flips (max once per 5 years).
- **Conversion channel**: if a country's top influencer is a dominant
  power (bloc power > 0.5 × the country's own power) of another faith,
  and that faith already scores ≥ 55% of the incumbent locally, its
  pressure also builds at a capped generational rate. Empire and
  orbit convert — but only where the faith has already landed.
- **Chronicle**: `faith` events for major flips, changes of the
  world's largest faith, and a focus-country milestone when the focus
  country's faith first leads the world.
- **Standings**: `result.faithLeaders[year]` — every faith's share of
  world population living under its dominance + country count, exposed
  exactly like `leaders`. The map gains a **Religion layer**
  (`LAYERS` in `lib/scenarios.ts`), a legend, hover readouts, and a
  "Faiths of the World" table in the Powers tab.

## What the verification showed (2026-10-27)

- Legacy scenarios: ~5 faith flips and ~2 chronicle faith events per
  run; 2100 standings drift plausibly (Christianity ≈ 33→36%, Islam
  ≈ 24→32% mostly on differential population growth).
- Island/small heartlands are full participants: boosted **Madagascar**
  or **Iceland** runs end with their faith (Christianity) world #1 at
  ≈ 35.5%; boosted **Indonesia** lifts Islam 23.9% → ≈ 31%; boosted
  **Sri Lanka** holds Buddhism's heartlands (2.2%, 4 of 7 countries)
  against Indian and Chinese gravity.
- **v1 boundary, stated plainly**: a minor faith (Buddhism at 2.2%,
  Judaism, Chinese folk) cannot reach world #1 within 75 years — the
  giants' adherent mass is insurmountable without a faith-follows-the-
  flag annexation channel, which v1 deliberately excludes. If Nick
  wants that outcome reachable, the lever is a controller-faith term
  on annexed territory (religion reading power, never feeding it) —
  a v2 design decision.
