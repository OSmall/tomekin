---
name: sixty-card-constructed-deck-architecture
description: Use after a Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or Casual 60 Deck Building Brief and Deck Opportunity or specific Format Anchor are confirmed. Build a fresh cohesive Mainboard and optional requested Sideboard; do not use this skill to tune an Existing Deck before the tuning workflow selects a rebuild.
---

# 60-card Constructed Deck Architecture

Use this skill only for fresh construction after `tomekin-deck-building` confirms both the Deck Building Brief and
a selected Deck Opportunity or sufficiently specific Format Anchor. Use `sixty-card-constructed-deck-tuning` first for
an Existing Deck; enter this workflow from tuning only after the agent recommends and the user confirms a rebuild or
fresh-construction path.

Compose `tomekin-deck-building` for tool lifecycle, deterministic validation, rendering, and persistence. Load
`query-cards` before non-trivial searches.

Method provenance: the plan-first construction sequence follows Andrew Quinn's
[six-step deck-building method](https://draftsim.com/build-mtg-deck/); card-advantage distinctions and Sideboard plans
follow Reid Duke's [card-advantage](https://magic.wizards.com/en/news/feature/basics-card-advantage-2015-07-13) and
[Sideboard](https://magic.wizards.com/en/news/feature/sideboard-plans-2015-03-09) guidance; the land estimate is Frank
Karsten's [updated analysis](https://www.tcgplayer.com/content/article/How-Many-Lands-Do-You-Need-in-Your-Deck-An-Updated-Analysis/cd1c1a24-d439-4a8e-b369-b936edb0b38a/).
Named cards, historical lists, universal curve claims, and current-metagame claims from those sources are not part of
the method.

Load `deck-shape-methodology` for plan, qualified coverage, whole-contribution tuning and retained reasoning.

## 1. Establish The Plan

Turn the chosen direction into a functional plan before selecting cards. State:

- how the deck gets ahead or survives;
- what resource or board state it develops;
- how it converts that state into a win; and
- which opposing actions most directly interrupt it.

A creature type, mechanic, color pair, or favorite card is a seed, not yet a plan. Aggro, control, midrange, combo,
tempo, ramp, typal, prison, and other labels are lenses rather than substitutes for the four statements above.

Carry forward Format, Format Anchor, Power Level, `playExperience`, Collection allow-list, budget, missing-card
tolerance, combo tolerance, constraints, exclusions, and assumptions. Keep strength separate from pilot complexity: do
not weaken a strong-casual request merely because the user wants approachable sequencing or limited bookkeeping.

## 2. Choose Colors And Check Mana Feasibility

Let the plan and Format Anchor determine colors, not the reverse. Before committing to a color count, check:

- whether the allowed Collection and Missing Card tolerance contain the required enablers, payoffs, answers, and lands;
- early and intensive colored costs;
- the tempo, life, and budget costs of fixing;
- whether extra colors add enough plan-relevant leverage to justify less consistent mana.

Change the plan or colors early when the mana requirements are not credible under the Brief.

## 3. Research Packages Before Individual Cards

Use local Oracle text, Card Identity properties, direct and Inherited Card Identity Tags, and scoped Collection evidence
to build coherent Deck Packages. Define task-specific Deck Roles such as early pressure, enabler, payoff, selection,
true card advantage, interaction, protection, sweeper, recursion, ramp, and closer.

- Compare contextual contributions and competing uses; several role labels do not automatically improve an option.
- Include enough enablers for payoffs and enough functional redundancy to execute the plan consistently.
- Treat Card Identity Tags as evidence, not infallible or persisted Deck Roles.
- Use EDHREC rank only for discovery or a weak tie-breaker, never as proof of deck-specific quality.
- Follow the confirmed Collection allow-list rather than maximizing owned-card use by default.

Use staged retrieval: broad queries return compact results in functional or Mana Value buckets; full tags and physical
Collection rows are fetched only for shortlisted cards.

## 4. Assign Functional Slots And Quantities

Decide how many cards each function needs before finalizing exact names. Choose a card's quantity according to how often
the deck needs to see it and how well multiples function.

- Use four copies for foundational cards the deck needs consistently.
- Use fewer for expensive, narrow, legendary, searchable, redundant-late, matchup-specific, or poor-in-multiples cards.
- Explain every foundational four-of and every unusual one- or two-of.
- Aim for exactly 60 Mainboard cards for consistency. More than 60 requires an explicit card requirement, user
  constraint, or strategic reason; it is not automatically illegal.

Do not create a Sideboard by default. If requested, use matchup or local-play context. When none exists, ask one focused
matchup question; if the user requests general coverage, state broad-vulnerability assumptions and make no current-meta
claim. For each package, name the problem, cards in, likely cards out, and post-board effects on curve, mana, role
coverage, and win condition.

## 5. Shape Curve And Mana Together

Describe the intended early, middle, and closing turns, then compare that sequence with the actual Mana Value
distribution and functional early actions. Curve health is contextual:

- Proactive decks need enough early pressure and plan-clearing interaction.
- Reactive decks need early survival, broad-enough answers, actual card advantage, and credible finishers.
- Linear decks must protect engine density without ignoring the minimum resilience demanded by the Brief.
- Ramp decks may have multiple curve peaks when reliable acceleration connects them.

Make an explicit **accept** or **revise** decision about the curve. Support it with the distribution, intended turn
sequence, early-action density, and ramp or selection reliability; never accept a curve merely because a histogram was
returned.

Build spells and lands together. When inputs are reliable, use Frank Karsten's 60-card formula only as an explainable
starting estimate:

`19.59 + 1.90 × average nonland Mana Value - 0.28 × cheap draw/ramp count + 0.27 × companion count`

Count non-mythic land/spell modal double-faced cards as 0.38 land and mythic ones as 0.74 only when classification is
reliable. The model has substantial unexplained variation. Explain adjustments for curve shape, colored sources,
selection/ramp reliability, tapped and utility lands, life costs, modal cards, and the actual plan. Never use the
formula as legality or a quality score.

## 6. Run A Static Quality Review

Use `hypergeometric_calculator` for explicit uniform-sampling questions under the shared bounded-statistics method.
True playtesting, simulation, mulligan/selection sequences, casting analysis and goldfishing remain unsupported. Perform
a static review and use later user-reported gameplay as stronger tuning evidence.

Require explicit evidence for:

- coherent win conditions and enough ways to reach them;
- enabler/payoff and threat/answer balance;
- early actions, curve, and mana spending across intended turns;
- true card advantage and resilience;
- total lands, colored sources, and land drawbacks;
- package dependencies, modal competition, narrow cards, and cards weak in multiples;
- Sideboard in/out plans when requested.

Treat looting and filtering as selection, not net card advantage, unless the deck converts the selection cost into
material value.

Identify the three weakest included nonland cards. Replace each one or justify it using a required Deck Role, package
dependency, protected theme, power/play-experience goal, or Collection constraint. “On theme” alone is insufficient.

## Compact Coverage Example

In a Casual 60 Mainboard, four selected copies of an early enabler and three of a payoff supply four and three
copies to their respective contextual roles. An assessed pool-only replacement supplies zero current coverage. One
Sideboard copy, if requested, remains outside active Mainboard coverage; quantities across sections still obey
applicable Format/copy rules. Explain why multiples help or compete rather than importing Commander singleton counts
or its starting profile. For a supported access calculation, use the actual 60-card population, relevant qualifying
selected copies and stated sample/event, excluding Sideboard cards from the initial Mainboard population. Access alone does not establish castability. For four qualifying copies in 60, a seven-card uniform opening sample:

```json
{"operation":"probability","populationSize":60,"populationSuccesses":4,"sampleSize":7,"event":{"kind":"at_least","count":1}}
```

This returns approximately 0.3994996 (39.95%). Assume no mulligans, search, extra draws or known cards. A requested
Sideboard copy is excluded. If a contextual 60% access target is chosen for that same sample, use:

```json
{"operation":"minimum_successes","populationSize":60,"sampleSize":7,"event":{"kind":"at_least","count":1},"targetProbability":"0.60"}
```

The minimum is seven qualifying Mainboard copies across compatible effects, subject to actual copy limits. This is
access mathematics, not a recommendation to violate the four-copy default or proof of casting/sequencing.

## 7. Validate, Recheck Availability, And Hand Back

Return the candidate to `tomekin-deck-building`:

Save authorized structurally sound construction as it progresses, including gaps and alternatives. Follow the root
lifecycle to read the actual selection, explicitly check legality/evaluation, obtain complete joint Availability under
the whole confirmed policy, then generate report, selected Portable Decklist and evidence-backed Pull List. Review
strategy and Brief before a completed-result claim. Keep shortages and limitations visible.

The final explanation states the plan, Power Level and pilot-complexity fit, important package/role densities, curve
decision, land and colored-source reasoning, card-advantage evidence, weakest-card decisions, Collection trade-offs,
meaningful exclusions, legality, and source-data caveats.
