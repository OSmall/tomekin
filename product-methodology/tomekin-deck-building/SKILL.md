---
name: tomekin-deck-building
description: Use when discovering, building, or revising an MTG deck with Tomekin tools. Confirm the Deck Building Brief and Collection scope, route to opportunity discovery, fresh construction, or Format-specific tuning, then validate, recheck Availability, render, and persist safely.
---

# Tomekin Deck Building

Use this workflow to coordinate local deck-building through Tomekin tools. This skill owns the tool lifecycle and intent
routing. Strategic methodology belongs in `collection-opportunity-discovery`, the Format architecture skills, and the
Format tuning skills.

## Establish The Working Contract

1. Check `summarize_reference_support`. Missing `oracle_cards`, `all_cards`, or `oracle_tags` blocks local
   deck-building.
2. Draft a best-effort Deck Building Brief with `draft_deck_building_brief`.
3. Ask the user to confirm or edit the Brief before substantial discovery or full construction.
4. Keep strength and pilot complexity explicit: `powerLevel` or Commander Bracket describes strength, while
   `playExperience` describes desired gameplay feel and complexity.
5. When Collection evidence matters, call `list_collection_locations`, confirm an exact allow-list, and preserve the
   same `(locationType, locationName)` scope for all later Collection queries and the final Availability recheck.

## Route By Intent

- Load `collection-opportunity-discovery` for “what can I build?”, open Collection exploration, or a broad seed that
  still needs viable directions compared. It supports Commander and all supported 60-card Formats.
- Load `commander-deck-architecture` for a fresh Commander Deck Candidate after the Brief and commander or selected Deck
  Opportunity are confirmed.
- Load `commander-deck-tuning` for Commander Existing Deck or Deck Candidate additions, cuts, swaps, upgrades, or
  improvement.
- Load `sixty-card-constructed-deck-architecture` for fresh Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or
  Casual 60 construction only after the Brief and a selected Deck Opportunity or specific Format Anchor are confirmed.
- Load `sixty-card-constructed-deck-tuning` for a 60-card Existing Deck or Deck Candidate involving additions, cuts,
  swaps, upgrades, or improvement. Do not route it directly to fresh architecture.
- If the requested Format is unsupported or lacks a methodology skill, say so and ask whether the user wants a
  best-effort unsupported build.

Do not duplicate format-specific heuristics here. Let each methodology skill decide its structural analysis while this
skill preserves the lifecycle and authority constraints.

## Retrieve Evidence Economically

- Load `query-cards` before non-trivial filters or after any validation error.
- Use `query_cards`, `search_card_identity_tags`, and `get_card_identity` to assemble and compare coherent packages.
- Keep broad discovery queries bounded and compact. Fetch full tags and physical Collection rows only for shortlisted
  cards.
- Treat local Oracle text and direct and Inherited Card Identity Tags as evidence, not infallible role assignments.
- Do not call a card Available, Committed, or Missing until Collection evidence has been checked under the confirmed
  allow-list.

## Validate And Finish A Deck Candidate

1. Resolve final names with `resolve_decklist_cards`.
2. Validate deterministic Format construction with `validate_format_legality`.
3. When a non-empty Collection scope is active, requery all final card names with the unchanged allow-list. Compare
   scoped `totalQuantity` with required quantities and classify Available, Committed, and Missing cards before
   rendering. With an empty Collection, classify every copy as Missing without a Collection Pull List.
4. Run `evaluate_deck_candidate` for legality, Format-appropriate power context, Mana Value distribution, Mainboard land
   count, and Collection caveats. It is not a deterministic deck-quality verdict.
5. Follow the active methodology's static quality review and revise for at most three complete passes.
6. Render Markdown and Portable Decklist with `render_deck_candidate`.
7. Save with `save_deck_candidate` only after final cards resolve, legality passes, scoped Availability is rechecked,
   and assumptions and caveats are represented.

If the Collection allow-list was accidentally omitted or changed during a query, discard that result and retry. The
current enforcement is procedural because the Brief and evaluator do not yet carry a structured Collection Access
Policy.

## Quality And Safety Rules

- State a functional game plan and expected play experience.
- Include enough enablers, payoffs, mana support, interaction, actual card advantage, resilience, and credible win
  conditions for the confirmed Brief.
- Do not reduce requested strength merely to meet an approachable pilot-complexity target.
- Do not claim gameplay simulation, opening-hand analysis, goldfishing, live prices, live metagame knowledge, or
  exhaustive combo detection.
- Deterministic legality results cannot be overridden by agent judgment.
- Build no 60-card Sideboard unless requested; Commander does not gain a Sideboard.

A Deck Opportunity shortlist and a Deck Change Proposal are transient analysis. Do not save either with the current
tools. Build a full Deck Candidate only after the user selects an opportunity or accepts a tuning path.

For accepted tuning, show the exact final additions, cuts, quantities, and persistence target, then wait for separate
confirmation before resolving, revalidating, rendering, and saving. Update a saved Deck Candidate in place unless the
user requests a copy or variant; an imported Existing Deck can only produce a new Deck Candidate.
