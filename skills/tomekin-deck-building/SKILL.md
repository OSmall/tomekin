---
name: tomekin-deck-building
description: Use when discovering, building, or revising an MTG deck with Tomekin tools. Confirm the Deck Building Brief and Collection scope, route to opportunity discovery, fresh construction, or Format-specific tuning, save construction progress, then explicitly validate and finish safely.
---

# Tomekin Deck Building

Use this workflow to coordinate local deck-building through Tomekin tools. This root skill owns the tool lifecycle and
intent routing. Shared strategic reasoning belongs in `deck-shape-methodology`; discovery and Format skills apply it at their
workflow fidelity and own Format-specific guidance.

Load `deck-shape-methodology` for plan, qualified coverage, whole-contribution tuning and retained reasoning.

## Establish The Working Contract

For a standalone supplied sampling question, use `hypergeometric_calculator` with the shared bounded-statistics method.
This pure calculation needs no Collection import, reference readiness or Deck Candidate. Apply the workflow below when
card facts, discovery, construction or tuning are needed.

1. Use startup/setup diagnostics and tool readiness errors for reference status. Local `lookup_cards` needs compatible
   Oracle Cards and All Cards imports; absent tags are reported as unavailable enrichment. Local `query_cards` still
   requires all three datasets. Follow the actionable sync instruction when a required dataset is unavailable.
2. Draft a best-effort Deck Building Brief with `draft_deck_building_brief`.
3. Ask the user to confirm or edit the Brief before substantial discovery or full construction.
4. Keep strength and pilot complexity explicit: `powerLevel` or Commander Bracket describes strength, while
   `playExperience` describes desired gameplay feel and complexity.
5. When Collection evidence matters, call `list_collection_locations`, confirm an exact allow-list, and preserve the
   same procedural `(locationType, locationName)` scope for all later Collection queries and the final Availability recheck.
6. If the Format is absent or ambiguous, ask one focused Format question before drafting. Do not silently default to
   Commander.
7. For a sufficiently contextualised nominated-card tuning review, state material assumptions and proceed. For open
   tuning, confirm a concise tuning Brief and explicit Addition Pool first.
8. Rule Zero exceptions must be explicit in the confirmed Brief and labelled in output.

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
- If the requested Format is unsupported or lacks a suitable skill, say so and ask whether the user wants a
  best-effort unsupported build.

Do not duplicate format-specific heuristics here. Let each route-specific skill decide its structural analysis while this
skill preserves the lifecycle and authority constraints.

## Retrieve Evidence Economically

- Load `query-cards` before non-trivial filters or after any validation error.
- Use `query_cards`, `browse_tags`, and batched `lookup_cards` with explicit selections to assemble and compare coherent packages.
- Keep broad discovery queries bounded and compact. Fetch full tags and physical Collection rows only for shortlisted
  cards.
- Treat local Oracle text and direct and Inherited Card Identity Tags as evidence, not infallible role assignments.
- Do not call a card Available, Committed, or Missing until Collection evidence has been checked under the confirmed
  allow-list.

## Save And Resume Construction

Use `create_deck_candidate` for concrete authorized progress, including empty selection and provisional plans. Keep the
Brief, current plan, assessed options/contributions and selected memberships in their respective owners. A plan uses
`schema_version: 1`; new nodes/relationships declare request-local `ref` values. Use returned `created_ids` for later edits.
Every retained option needs a reasoned role contribution; a desired role with zero selected contributors needs a gap
assessment. Repeated copies use membership quantities. Cuts retain assessed options unless explicitly removed.

Read `get_deck_candidate` for a compact summary or `view: "state"` for full current reasoning. Use `edit_deck_candidate`
with `candidate_id`, the exact last-read `expected_updated_at`, and typed `changes`. Quantities are absolute; omissions
preserve stored values and optional fields can explicitly clear with `null`. Coordinate related additions/removals in one
edit. The tools enforce record integrity without implicitly checking legality, evaluation or Availability.

Explain the actual selected-deck/current-strategy result and persistence target before applying it. Existing authorization
counts when it covers that result; otherwise obtain candidate-level agreement. Authorized construction and pool-only
maintenance need no per-option approval. After a conflict, reload and reconcile before retrying. After an unknown edit
outcome, inspect the candidate and affected records. After an unknown create outcome, inspect `list_deck_candidates` and
matching candidate state by label, Format/anchor, times and contents; labels are not unique and ambiguous matches require
inspection before another create. See [the public write contract](../../docs/product-behavior.md#structured-candidate-writes).

## Validate And Finish A Deck Candidate

1. Resolve final names with batched `lookup_cards` name references and `select: {name: true}`. Check every ordered
   outcome across pages and resolve any local miss before validation.
2. Validate deterministic Format construction with `validate_format_legality`.
3. When a non-empty Collection scope is active, requery all final card names with the unchanged allow-list. Compare
   scoped `totalQuantity` with required quantities and classify Available, Committed, and Missing cards before
   rendering. With an empty Collection, classify every copy as Missing without a Collection Pull List.
4. Run `evaluate_deck_candidate` for legality, Format-appropriate power context, Mana Value distribution, Mainboard land
   count, and Collection caveats. It is not a deterministic deck-quality verdict.
5. Follow the active skill's static quality review and revise for at most three complete passes.
6. Render Markdown and Portable Decklist with `render_deck_candidate`.
7. Persist the authorized result through create/edit as needed and report the actual save result. Keep explicit check
   findings and the remaining strategic/Brief/Collection review distinct from structural save success. A saved provisional
   candidate is not a completed deck merely because its records are sound.
