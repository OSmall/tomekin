---
name: commander-deck-tuning
description: Use for Commander/EDH Existing Deck or Deck Candidate additions, cuts, swaps, upgrades, or improvement requests. Diagnose task-specific roles and packages with Tomekin data, propose coherent paired changes, and handle acceptance and persistence safely.
---

# Commander Deck Tuning

Use this Commander-specific methodology for improving an Existing Deck or Deck Candidate. Compose
`commander-deck-architecture` for structural guidance and `tomekin-deck-building` for tool lifecycle, validation,
rendering, and persistence. Load `query-cards` before non-trivial tag or card queries.

Produce a reasoned Deck Change Proposal, not a claim of mathematical optimality. Keep generic Deck Tuning language
format-extensible; these heuristics apply only to Commander/EDH.

Method provenance: EDHREC's
[Commander upgrade guide](https://edhrec.com/guides/edhrec-guide-to-upgrading-your-commander-deck) supports repairing
structural deficits, commander-specific counts, curve review, and synergistic flexible additions; the
[Commander Power Levels template](https://www.commanderpowerlevels.com/deckbuilding/template) supports treating role
targets as starting points and cards as multi-role. EDHREC's
[commander curve analysis](https://edhrec.com/articles/paradigm-shift-how-your-commanders-mana-value-alters-your-curve)
and [Wizards' Commander Brackets update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025)
support contextual curve and play-experience judgments rather than a universal optimum.

## Establish Tuning Context

Determine from the conversation or a concise clarification:

- The Existing Deck or Deck Candidate to tune.
- The goal and direction: stronger, weaker, lateral, thematic, more resilient, less commander-dependent, or another
  stated objective.
- Intended Commander Bracket and play experience when relevant.
- The Addition Pool: Available Cards, permitted Committed Cards, all legal cards including Missing Cards, or a
  user-defined scope.
- Protected or identity-defining cards, a requested change count or budget, and relevant gameplay observations.

Do not infer an Addition Pool from words such as “right now.” Reuse established context rather than asking an exhaustive
questionnaire. A user-nominated candidate review can proceed with material assumptions when deck context is sufficient;
an open review needs a concise confirmed tuning brief and an explicit Addition Pool.

When no direction is stated, improve execution of the established game plan while preserving its intended Commander
Bracket and play experience. Do not silently turn a thematic deck into generic goodstuff.

## Diagnose Before Recommending

Identify the commander, game plan, important Deck Packages and dependencies, credible win paths, resilience,
interaction, card advantage, commander dependence, mana curve, and mana-base concerns. Identify cards that are
redundant, inefficient, overly conditional, or off-plan.

Use `commander-deck-architecture` role-density targets as adjustable starting ranges, not pass/fail rules. Give
credible user-reported play patterns more weight than generic targets. Without those observations, perform static
analysis and never claim playtesting, simulation, or goldfishing.

### Infer Roles Transiently

Define useful task-specific Deck Roles and Deck Packages from the whole card context:

- Direct and Inherited Card Identity Tags, their weights, and annotations.
- Oracle text, Card Parts, type line, mana cost, Mana Value, keywords, restrictions, and repeatability.
- Required board state, commander or package dependence, and modal competition or opportunity cost.

Group and count cards when it clarifies representation. A card may occupy several roles. These counts are diagnostic
evidence, not persisted card facts: do not create a canonical role taxonomy, aliases, numeric role scores, contribution
enums, database fields, or a role-analysis tool.

## Discover Additions

Search only the confirmed Addition Pool. Prioritize needs in underrepresented roles or packages, then use tag
snowballing from the commander and high-signal cards, direct and inherited tags, Oracle-text and card-property search,
and multi-signal overlap. Compare efficiency, reliability, flexibility, curve, and internal affinity.

Use EDHREC rank only for discovery or a weak tie-breaker. Generic popularity is not evidence that a card fits this deck.

For user-nominated candidates, recommend none, some, or all. Answer that question before proposing a materially better
alternative. For open review, recommend the smallest coherent, high-confidence set by default; list marginal ideas
separately and ask before attempting a large rebuild.

## Pair Additions And Cuts

Evaluate every change as part of the resulting deck, not in isolation.

1. When aggregate structure is healthy, prefer a like-for-like cut from the same Deck Role or Deck Package.
2. When an addition repairs a meaningful deficit, cut the lowest-value card from a genuine surplus elsewhere.
3. Never infer a surplus from raw counts alone. Account for overlapping roles, package dependencies, curve, commander
   contributions, conditional functions, and reliability.

Treat lands as a mana-base system, not convenient generic cuts. Justify any land change using land count, coloured
sources, tapped and utility lands, curve, ramp, and commander cost. Do not cut explicitly protected theme or pet cards
without permission; distinguish weak performance from a potentially intentional play-experience choice.

A commander swap that retains substantially the same game plan may be a tuning recommendation, but state its advantages,
disadvantages, and command-zone implications. A same-Color-Identity swap may stay in the proposal. A Color Identity
change is a separate Deck Candidate variant and requires confirmation before construction.

## Deck Change Proposal

Keep quick reviews concise. Use these sections when relevant and omit empty ones:

1. **Tuning Context** — goal, Addition Pool, power/play-experience direction, material assumptions.
2. **Deck Diagnosis** — game plan, relevant role groupings/counts, deficits, surpluses, package, curve, or mana issues.
3. **Recommended Changes** — exact paired additions and cuts, concise reasons, Collection status where relevant.
4. **Rejected Candidates** — only user-nominated cards that should not be included.
5. **Aggregate Effect** — resulting role representation, curve/mana effects, trade-offs, and Bracket implications.
6. **Further Opportunities** — lower-confidence or larger changes.
7. **Persistence Status** — explicitly state that nothing was saved.

## Apply And Persist Safely

The user may accept, reject, or modify individual swaps. On partial acceptance, reanalyse role representation, deck size,
curve, and legality; explain dependency or aggregate-rationale breakage.

Build a complete revised Deck Candidate only when the user explicitly asks to apply or accept a proposal. Acceptance of a
recommendation does not authorize persistence. Before saving, show a final Change Summary with exact additions, cuts,
quantities, any commander change, and the persistence target, then wait for confirmation of that exact set. Never save
in the same message that first reveals the exact final change set or persistence target.

After confirmation, resolve the resulting list, rerun `validate_format_legality` and `evaluate_deck_candidate`, render
the revised Deck Candidate, and save only when deterministic checks pass.

- When tuning a saved Deck Candidate, update that candidate in place by passing its existing ID to
  `save_deck_candidate`. Do not create a new candidate unless the user explicitly requests a copy, variant, or new
  candidate.
- When tuning an Existing Deck inferred from imported Collection data, do not mutate the Collection or source deck.
  Save an accepted revision as a Deck Candidate because Collection write-back is unsupported.
