# GeoStory annexation tuning — sustained-pressure strain

A deliberate balance change to `lib/engine.ts`, shipped with the
adjacency + religion merge (2026-10-27). This note records the problem,
the mechanic, the calibration evidence, and the honest limits. Every
number below comes from the compiled engine on this branch, not from
intuition.

## The wall

Three independent locks kept every stable country un-annexable forever,
no matter the boosts (186+ diagnostic runs on the pre-merge lines: zero
annexations of stable targets):

1. **The stability anchor.** Base stability mean-reverts to each
   country's institutional anchor (Mozambique: 0.72) at 5%/yr, while the
   annexation gate needs stability < 0.50 *sustained*. Nothing a
   neighbour does moves the anchor.
2. **The influence lock.** The gate also requires the challenger to be
   the target's *top influencer* — a global gravity ranking in which a
   neighbouring Madagascar pressing Mozambique loses to China and India
   for the entire century (measured: Mozambique's top influencer is the
   USA, then China, then India in every year of a max-boosted run).
3. **The late ratio.** A micro-state's bloc power compounds slowly
   (convergence-throttled growth), so even its local ratio against a
   mid-size neighbour only crosses the gate's bar in the 2070s.

China out-influencing a max-boosted Madagascar next door is honest
geography and stays. Locks 1 and 2 are what this tuning removes.

## The mechanic

A per-country **strain** accumulator (`CState.strain`, with
`strainFrom` / `siegeBase`), computed in a start-of-year pre-pass:

- **Qualification.** A challenger *besieges* a country when it could
  take it but for stability: strongest adjacent challenger, local ratio
  above `ratioNeeded − 0.3`, bloc power > 3× the target's own power,
  and not digesting a recent annexation.
- **Tightening, not presence.** Strain grows only from dominance
  *beyond the level the siege started at* (`siegeBase`). A state that
  has always lived beside a giant is adapted to it; a neighbour
  rapidly outgrowing it cracks it. Gain is sub-linear in the excess
  (`excess^0.7`), hard-capped per year, widened ×(1 + strain) as the
  crack deepens, and **divided across every siege the presser is
  running at once** — a focused neighbour presses one target far
  harder than an empire pressing ten borders.
- **Equilibrium, not ratchet.** Strain heals 8%/yr whether besieged or
  not. Steady background dominance equilibrates at low strain; only a
  grip that keeps strengthening equilibrates high. A change of presser
  keeps only 25% of accumulated strain.
- **The gate reads effective stability** = base stability − strain.
  Once strain ≥ 0.20 the presser counts as the target's dominant
  influence for the gate (removing lock 2), and annexation pressure
  may pre-accumulate, so the fall follows the crack by years, not by a
  further decade. The flip itself still requires effective stability
  < 0.50 and pressure > 7. Annexation resets the target's strain.
- Strain is ordinary sim state: seeded, deterministic, no wall-clock,
  no `Math.random`. Where strain is 0 the engine's arithmetic is the
  pre-change engine's.

## Calibration (measured on this branch)

Panel: the 10 `scripts/sim-check.ts` scenario/seed configs, unboosted.
Annexation event totals:

| engine | panel total | held in 2100 (per run) |
|---|---|---|
| origin (pre-merge, pre-adjacency) | 245 | 13–40 |
| merged, pre-tuning (adjacency + religion) | 246 | — |
| strain v1 (universal ratio floor) | 1,446 | 108–118 |
| strain v3 (+ log gain, yearly cap, perimeter dilution) | 1,296 | 99–115 |
| strain v4 (+ heal equilibrium, active-siege dilution) | 689 | 58–66 |
| strain v6 (+ tightening / siegeBase) | 545 | 47–64 |
| **strain v7 (shipped: RATE 0.06, pressure booster ×(1 + 6·strain))** | **565** | **47–65** |

The v1→v7 path is the point: a universal "pressure" term dissolves
the world (only ~60 of 175 countries sovereign by 2100). The shipped
form roughly doubles baseline annexations (245 → 565 across the panel)
— a more dynamic century in which tightening regional grips do
occasionally take a neighbour — while ~120 countries stay sovereign.

**Gate (a) — the video case.** Max-boosted Madagascar
(`SUPERPOWER_BOOSTS`, focus MDG, sandbox), 12 seeds: Mozambique falls
to Madagascar in **12/12** seeds, in **2089–2094** — 11–16 years after
Madagascar's local ratio crosses the annexation bar (~2078), i.e.
roughly a decade of sustained, tightening pressure. Pre-tuning: 0/12
in any year.

**Gate (c) — determinism.** Same config twice → identical full-result
digest, boosted and baseline configs alike. The religion layer's
non-interference property was verified *before* this tuning (every
pre-religion field bit-identical to the origin engine across 5
configs); the tuning then deliberately supersedes outcome-identity
wherever strain accumulates, and only there in kind — faith never
feeds the annexation track in either direction.

## The entertainment bar — investigated, with numbers

Playtest ask: a max-boosted Madagascar should be able to *take over
the world* — reach world #1 in a meaningful share of runs. Measured
on the shipped tuning (12 seeds): **#1 in 0/12, top-3 in 0/12**;
median final bloc power ≈ 11 vs the world's top ≈ 770. Madagascar's
honest ceiling in this model is regional hegemon (best rank 8) plus —
via the religion track — its faith #1 in the world (~36% of humanity).

The gap is not in the annexation gate; it is in scale. Madagascar
starts at $0.016T against China's ~$18T (a ~1000× head start), bloc
power scales with GDP, and a century of even doubled growth closes
only a fraction of that. Two snowball levers were built and measured
before being rejected:

- **Conquest dividend** (+0.25 permanent growth per annexation) +
  shockwave strain + integration efficiency (held GDP 0.38 → 0.60):
  baseline panel worsened 565 → **730**, and the dividend fed the
  biggest annexers most — world-top bloc power exploded ~770 →
  **5,400–12,600** while Madagascar still held 1–2 countries.
- **Shockwave alone** (+0.12 strain to the presser's other siege
  targets on a fall): baselines 565 → **684**, Madagascar unchanged
  (its next neighbours are never besieged before the century ends).

What does work, on the same tuning: the superpower fantasy at
plausible starts. Boosted **Indonesia, Brazil, Philippines and
Vietnam reach world #1 in 5/5 seeds each**; boosted Nigeria reaches
the top 3 in 5/5. The fantasy fails only for micro-starts whose GDP
is three orders of magnitude below the leader's. Making Madagascar
specifically reach #1 would require a lever that bends the growth
model itself for the annexer (e.g. a compounding per-annexation
growth multiplier) — measured above to super-charge great powers
even more — or a focus-only rule, which this project's tuning rules
forbid (the fix had to be genuinely in the game for every country).
That trade-off is the project owner's call, not a tuning constant.

## Small-nation package (2026-10-28)

Playtest ask: Nick claimed Puerto Rico on a Superpower run and found a
world takeover impossible. Diagnosis (measured): PRI's baseline row
was a hash-fallback stub — gdp 0.003, mil 0 — against a real ~$105B
economy. Max-boosted PRI finished rank 59–63 across 8 seeds, annexed
nothing, and ended ~1,500× below world #1. Four parts shipped:

**1. Data correction.** `baseline.json` is generated
(`scripts/build-geodata.mjs`); 28 of 175 countries were in neither the
MAJORS nor the SECONDARY table and had hash-invented GDP/population.
25 are now in SECONDARY with real ~2024 figures (World Bank nominal
GDP / population unless noted): PRI [0.105, 3.2] (its derived mil
comes out 1.7 — the JAM 0.2 / CUB 1.4 / DOM 2.8 neighbourhood), LUX
[0.093, 0.7] (was gdp 0.003!), BGR [0.113, 6.4] (was pop 0.9M), KOS,
PSE, BHS, NCL, SLE, GNQ, FJI, SWZ, LBR, DJI, BLZ, BTN, GRL, CAF, BDI
[0.003, 13.7] (was gdp 0.017 / pop 1.8M — wrong in both directions),
GMB, GNB, LSO, SLB, VUT, ERI (decade-stale official data; standard
estimates), NCY (TRNC-published figures, contested). Left alone, with
reasons: ESH and SOL (no justifiable GDP series exists), FLK (real
GDP ≈ 0.0003 is below the table's 0.001 resolution and its population
rounds to 0.0). The hand tables themselves audited clean — every
sub-$700 gdppc row is a genuinely poor or conflict state. The
sim-check digest changes with this build; that is the correction
working, not a regression.

**2. Endowment.** On a Superpower run (focus + the exact
SUPERPOWER_BOOSTS profile, now defined in engine.ts and re-exported
by idler.ts), a claimed nation starting under $150B has its starting
GDP lifted to $450B inside runSimulation's setup — deterministic in
the config, carried by share links, never applied to AI or unclaimed
runs, announced in the run's chronicle and disclosed in the claim
picker, the dossier button and the run's anchor message. Two
calibrations vs the original sketch, both forced by the data fix:
the gate is $150B, not $50B (the $50B figure was calibrated against
the $3B stub; real Puerto Rico is $105B and is the country the
package exists for), and the target is $450B, the top of the agreed
range — $300B measured short (below).

**3. Momentum.** On annexation and on fold-in the presser banks a
temporary dividend, decaying ×0.78/yr (~5-year tail):
`f = clamp(1 − share/0.10, 0, 1)` with share = the presser's bloc
share of world power; growth banked = min(4.5, mom + 3.2·f); gravity
banked = min(0.65, momGrav + 0.5·f). The share scale is load-bearing:
a naive (1 − share) factor still pays a 30%-share leader 65%
strength, and the dormant panel showed its top blocs ballooning
2.5–5× (partition-measured: momentum, not folds, was ~85% of the
balloon). With the 0.10 scale the dormant world is back at baseline
(below). This is not the rejected conquest dividend: temporary,
capped, and zero for anyone holding a tenth of the world.

**4. Fold-in.** A sovereign B folds into A's bloc as a client when:
(a) A has been B's dominant partner for 5 consecutive years; (b) B's
stability < 0.50; (c) A's bloc power ≥ 1.5× B's; (d) B is neither a
top-10 power nor a flagged major; (e) A has folded nobody in 3
years. Annexation-shaped for controller/bloc accounting, but not a
war: no strain, no stability shock, its own event kind and text
("B folds into A's orbit" — never war-parseable), and it pays
momentum. Clients never fold others. Two attribution rules, both
measured necessities, both mirroring the engine's own precedents:
the streak's "dominant partner" deems a besieger whose strain on B
is ≥ STRAIN_INFLUENCE to be B's partner (the same deeming the
annexation gate's influenceOk uses — raw global gravity keeps
distant giants as every border state's #1 influencer forever, and a
spec-literal streak measured DOM folding into the USA's orbit in
2037 while an endowed Puerto Rico was still besieging it: the
claimant's first domino handed to a giant), and a state under active
siege by a third power does not fold (it is contested, in the spirit
of condition (d)'s eligibility carve-outs). In dormant worlds folds
are frequent (~40/run — giants absorbing unstable micro-states as
clients; clients can still break away) while every guard metric
stays at baseline.

**Panels** (`scripts/small-nation-panel.ts`; multipolar, Superpower
boosts, 12 seeds; dormant = sim-check's 10 configs):

| panel | before | after |
|---|---|---|
| PRI final rank | 59–63 (8 seeds), 0 takes | **5 in 12/12**, bloc ~70–97, DOM + HTI taken in most seeds |
| MDG final rank | ~8–15, median bloc ≈ 11 | **3–5**, median bloc ≈ 140, TZA/BDI chain in good seeds |
| Dormant annexations (10 runs) | 565 | 623 (band 450–700) |
| Dormant top blocs | 691–1337 | 680–1360 (all within 1.5× of before, most within ±10%) |

**The acceptance targets (PRI #1 ≥ 3/12 and top-3 ≥ 8/12; MDG #1
≥ 3/12) are NOT met, and the shortfall is structural, not tuning.**
PRI finishes #5 in every seed because its entire feasible frontier
is DOM (folds/flips to PRI now), HTI (stability anchor 0.63) and CUB
(anchor 0.37, but the USA is permanently its max-ratio presser and
gravity influencer — the Caribbean is a USA lake in this engine);
JAM/BHS sit at 0.71 stability and can neither fold nor be ground
down in time. Even eating all three, PRI's bloc (~90) is an order of
magnitude under the winner's (~1250) — the same scale wall the
entertainment-bar section measured, compounded by the convergence
regime: an endowed micro-state's GDP per capita (~$140k) pays the
maximum −2.2 growth drag all century, where a Philippines start
($3.7k) pays ~0. MDG's frontier is MOZ (anchor 0.79 — it can be
ground but never folds) and the TZA chain; it now reaches #3–5 but
not #1. Closing the remaining gap needs one of the owner's-call
levers the entertainment-bar section already flagged — a demographic
component to the endowment (lifting population as well as GDP), or a
focus-only rule, which this project's tuning rules forbid — or
accepting regional-hegemon outcomes for micro claimants. The package
as shipped takes PRI from rank ~60 to #5 and MDG from ~#11 to #3–5
with the dormant world untouched; the last step is a design
decision, not a constant.

**Effect on a normal unclaimed world, honestly:** Puerto Rico and
24 other countries have real economies now (Luxembourg is no longer
poorer than Haiti); unstable micro-states sometimes drift into a
great power's orbit peacefully instead of only ever being conquered
or ignored; momentum is invisible at giant scale by construction.
Nothing else moves: annexation totals, top blocs and the religion
track all sit at their pre-package values.
