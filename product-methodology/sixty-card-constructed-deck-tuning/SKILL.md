---
name: sixty-card-constructed-deck-tuning
description: Use for Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or Casual 60 Existing Deck and Deck Candidate additions, cuts, swaps, upgrades, or improvement requests. Diagnose whether to repair, rebuild around an identity, or start fresh before proposing paired changes.
---

# 60-card Constructed Deck Tuning

Use this methodology for an Existing Deck or Deck Candidate in Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or
Casual 60. Compose `tomekin-deck-building` for validation, rendering, and persistence. Load `query-cards` before
non-trivial card, tag, or Collection searches.

Produce a Deck Change Proposal, not a claim of mathematical optimality. Diagnose before searching for replacements, and
do not assume every Existing Deck is a sound foundation.

Method provenance: Ben Bleiweiss's
[five deck-building diagnostics](https://magic.wizards.com/en/news/feature/deckbuilding-101-five-tips-better-deckbuilding-2006-06-05)
support mana repair, minimum-size consistency, plan focus, curve scrutiny, and dependency analysis; Reid Duke's
[card-advantage guidance](https://magic.wizards.com/en/news/feature/basics-card-advantage-2015-07-13) supports the
selection-versus-advantage distinction. Named historical lists and categorical card-type rules are not part of the
method.

## Establish Tuning Context

Determine from the conversation or concise clarification:

- The Existing Deck or Deck Candidate and exact Format.
- The goal: stronger, weaker, lateral, more consistent, more thematic, more resilient, or another stated direction.
- Power Level and `playExperience`, keeping strength separate from pilot complexity.
- Addition Pool: allowed Collection Locations, permitted Missing Cards, all Format-legal cards, or another explicit
  scope.
- Protected or identity-defining cards, requested change count or budget, and user-reported gameplay observations.

A user-nominated card review may proceed with stated material assumptions when the deck context is sufficient. An open
review needs a concise confirmed tuning Brief and explicit Addition Pool. Do not infer the Addition Pool from phrases
such as “right now.”

## Diagnose The Foundation

Before searching for additions, identify the game plan, important Deck Packages, credible win path, curve, early
actions, card advantage, interaction, resilience, mana requirements, and weakest dependencies. Give user-reported
gameplay more weight than generic heuristics. Without it, perform static analysis and never claim playtesting,
simulation, or goldfishing.

Classify the recommended path:

1. **Focused repair** — preserve the current plan and make a small coherent set of changes.
2. **Rebuild around identity** — preserve an identity-defining Format Anchor, package, or play pattern while replacing
   substantial structure.
3. **Fresh construction** — the current list is not a sound foundation for the confirmed Brief.

Explain the classification. Require user confirmation before moving from focused repair into a rebuild or fresh
construction. On confirmation, hand a fresh-construction path to `sixty-card-constructed-deck-architecture` with the
preserved identity and rejected assumptions stated explicitly.

## Apply The Tuning Heuristics

Use these durable checks together rather than as isolated rules:

- **Repair mana:** compare total lands, colored sources, early and intensive costs, tapped-land timing, utility lands,
  reliable selection or ramp, and the intended curve.
- **Prefer the minimum Mainboard size:** aim for exactly 60 for consistency unless a card requirement or explicit
  strategic reason justifies more.
- **Focus the goal without obeying the theme blindly:** challenge cards that are on-theme but do not advance, protect,
  or reliably enable the game plan.
- **Maintain a playable curve:** the deck must act through the stages its plan requires or survive until its expensive
  spells matter.
- **Challenge dependency and card-disadvantage risks:** evaluate required board state, timing, vulnerability, and payoff
  instead of banning a card type categorically.
- **Separate selection from advantage:** looting and filtering are not net card advantage unless the deck converts their
  cost into material value.

Identify at least the three weakest included nonland cards when the list is large enough. A weak card may remain only
when a protected theme, package dependency, play-experience goal, or concrete role justifies it.

## Discover And Pair Changes

Search only the confirmed Addition Pool. Use Deck Role and Deck Package needs, direct and Inherited Card Identity Tags,
Oracle text, card properties, curve position, efficiency, reliability, and internal affinity.

Pair every recommended addition with a cut:

1. Prefer like-for-like replacement when aggregate structure is healthy.
2. When an addition repairs a real deficit, cut the lowest-value card from a genuine surplus elsewhere.
3. Never infer surplus from raw counts alone; account for overlapping roles, package dependencies, curve, and
   conditional functions.

Treat lands as a system, not convenient generic cuts. Preserve protected cards unless the user permits a change. Answer
user-nominated-card questions before offering materially different alternatives.

## Reanalyse The Aggregate Deck

Evaluate the proposed change set as one resulting deck:

- Mainboard size and deterministic Format legality.
- Game plan and win-condition reliability.
- Enabler/payoff and threat/answer balance.
- True card advantage, selection, interaction, and resilience.
- Mana-value distribution, intended turn sequence, and early actions.
- Land count, colored sources, and land drawbacks.
- Power Level, pilot complexity, and Collection trade-offs.

Revise or clearly caveat any aggregate regression. A series of individually plausible swaps must not create a new
structural deficit.

## Deck Change Proposal

Use these sections when relevant:

1. **Tuning Context** — goal, Addition Pool, power/complexity direction, protected identity, assumptions.
2. **Foundation Diagnosis** — focused repair, rebuild around identity, or fresh construction, with reasons.
3. **Deck Diagnosis** — plan, relevant role/package counts, curve, mana, deficits, and weakest cards.
4. **Recommended Changes** — exact paired additions and cuts with Collection status.
5. **Rejected Candidates** — only nominated or seriously considered cards that should not be used.
6. **Aggregate Effect** — resulting structure, curve, mana, strategic trade-offs, and power/complexity fit.
7. **Further Opportunities** — lower-confidence or larger changes.
8. **Persistence Status** — state that nothing was saved.

## Apply And Persist Safely

Acceptance of strategic advice does not authorize persistence. Build a complete revised Deck Candidate only when the
user explicitly accepts or applies a proposal.

Before saving, show an exact final Change Summary with additions, cuts, quantities, and persistence target, then wait
for separate confirmation. After confirmation, resolve the resulting list, run `validate_format_legality`, perform the
final scoped Availability recheck required by `tomekin-deck-building`, run `evaluate_deck_candidate`, render, and save
only when checks pass.

- Update a saved Deck Candidate in place by passing its ID unless the user requests a copy or variant.
- Never mutate an imported Existing Deck or Collection state; save its accepted revision as a Deck Candidate.
