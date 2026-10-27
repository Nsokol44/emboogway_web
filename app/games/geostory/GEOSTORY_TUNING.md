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
