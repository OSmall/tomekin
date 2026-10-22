---
name: tomekin-deck-building
description: Use when discovering, building, or revising an MTG deck with Tomekin tools. Reuse or establish the Deck Building Brief and Collection scope, route to opportunity discovery, fresh construction, or Format-specific tuning, save construction progress, then explicitly validate and finish safely.
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
   Oracle Cards and All Cards imports; absent tags are reported as unavailable enrichment. Pure live `search_cards` requires no local import; explicitly enabled `legacy_query_cards`
   requires all three datasets. Follow the actionable sync instruction when a required dataset is unavailable.
2. Reuse the existing candidate Brief and explicit user instructions when they cover the task. For a new or materially
   changed task, draft a best-effort Brief with `draft_deck_building_brief`.
3. Resolve only missing or changed constraints before substantial work. Existing authorization counts; a drafting tool
   reminder does not require reconfirming an already established agreement.
4. Keep strength and pilot complexity explicit: `powerLevel` or Commander Bracket describes strength, while
   `playExperience` describes desired gameplay feel and complexity.
5. For Collection-first work, reuse an applicable confirmed policy. If scope is absent or the snapshot changed, inspect
   `list_collection_locations` and establish exact sources/restrictions. Then
   retain the active-import-bound `collectionAccessPolicy` in the Brief. Use `browse_collection_cards` with that
   candidate's Brief policy or an explicit confirmed policy for actual-row eligibility. Preserve the same permission
   through the final Availability recheck. Legacy `legacy_query_cards` still requires procedural exact
   `(locationType, locationName)` predicates; it does not enforce metadata policy or actual owned-Printing correlation.
6. If the Format is absent or ambiguous, ask one focused Format question before drafting. Do not silently default to
   Commander.
7. For a sufficiently contextualised nominated-card tuning review, state material assumptions and proceed. For open
   tuning, establish a concise tuning Brief and explicit Addition Pool, reusing applicable existing agreement.
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
- Use native `search_cards`, `browse_tags`, and batched `lookup_cards` with explicit selections to assemble and compare coherent packages.
- Request `collection_scope` for locally filtered eligible provider discovery and pass confirmed `collection_policy`
  explicitly or through the candidate Brief. Optional summary/copies evidence reports complete matching actual rows,
  separate from representative Printing facts. Repeat fixed scope/policy/evidence mode with ordinary after cursors.
  Use query-cards for the exact selectors and recovery contract; retrieval summaries do not replace final joint proof.
- Follow query-cards Staged Retrieval for every broad search: learn compact tags, broaden, shortlist through judgment,
  then batch missing rules facts. Trust scoped membership; request quantities or source rows for directed questions.
- Treat local Oracle text and direct and Inherited Card Identity Tags as evidence, not infallible role assignments.
- Do not call a card Available, Committed, or Missing until Collection evidence has been checked under the confirmed
  allow-list.

## Review And Pool Research

For an existing-candidate review or pool-only research, read summary first, then the needed `brief`, `selected`,
`options`, `plan` or other focused views. Reuse known facts and applicable checks. Retrieve complete Availability
witnesses/reports when the requested outcome needs them. Finish needed continuation before mutation or restart against
the changed baseline. Preserve selected membership in pool-only tasks and retain reasoned Card Contributions for saved
options. Report assessed additions, unchanged selection and material gaps/coverage limits. This route finishes without
invoking full construction/assembly finalization; use that route when delivering a completed selected deck.

## Recent Source Additions

For “recent”, “yesterday” or similar requests, confirm the user's task timezone and resolve an explicit UTC
`[added_at_from, added_at_before)` interval. Record `recentAdditions.purpose` as `strict_copy_eligibility` or
`exploratory_inspiration`. Strict copies require matching confirmed policy `copy_requirements` date bounds; an
incompatible Brief returns an error until corrected. Exploratory inspiration may assemble discovered identities from
other permitted rows.

Browse dated rows with `browse_collection_cards`, explicit copy `select` and bounded `first`/`after`. Then independently
browse `date_state: "unknown"` within the same permitted scope unless the user declines; record that choice in
`recentAdditions.undated_search`. Label unknown rows “date unknown; possibly relevant” and report partial/unchecked
coverage. Only reliable source `Added` chronology proves date bounds; legacy precision loss is unknown. A successful
Collection replacement requires location refresh and scope reconfirmation, including row exclusions. A failed attempt
preserves the active policy references. See [the exact policy and browse contract](../../docs/card-query.md#collection-policy-and-owned-row-browsing).

## Save And Resume Construction

Use `create_deck_candidate` for concrete authorized progress, including empty selection and provisional plans. Keep the
Brief, current plan, assessed options/contributions and selected memberships in their respective owners. A plan uses
`schema_version: 1`; new nodes/relationships declare request-local `ref` values. Use returned `created_ids` for later edits.
Every retained option needs a reasoned role contribution; a desired role with zero selected contributors needs a gap
assessment. Repeated copies use membership quantities. Cuts retain assessed options unless explicitly removed.

Read `get_deck_candidate` for a compact summary. Recover complete focused `brief`, `selected`, `options`, `pool`,
`plan`, `assessments`, `json`, `availability` or `collection_pull_list` views with `first`/`after`. Repeat `id` and
`view`, apply ordered path/value records, and concatenate report/decklist strings. A changed baseline requires restart. Use `edit_deck_candidate`
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

1. Read the actual final selected identities, quantities and sections. Reuse known facts; batch only missing facts with
   `lookup_cards`. Resolve local misses and material rules/legality discrepancies through explicit sync/recheck before
   a successful final claim. Pool-only alternatives supply no selected demand or coverage.
2. Explicitly call `validate_format_legality` and `evaluate_deck_candidate` using `candidate_id` and the exact
   `expected_updated_at`. Initial `brief`/`cards` checks and optional `changes` are transient trials. Trial findings
   apply only to that trial; inspect the saved result after acceptance and check the actual result.
3. Run `check_collection_availability` with the saved candidate ID/timestamp and its whole confirmed Brief policy.
   Optional typed `requirements` must cover every selected section/quantity and may only narrow copies. Recover all
   witness pages. Per-card search summaries cannot replace this joint proof or prevent double allocation. Distinguish
   Missing-owned, Policy Shortfall, metadata uncertainty and permitted Committed borrowing with its source deck.
4. Review strategy, Brief, qualified selected coverage, curve, dependencies and practical constraints. Reuse check
   evidence only while applicable; relevant selection/policy/reference/import changes require recomputation. A saved
   or legal candidate is not automatically strategically adequate or assemblable. Report genuine gaps honestly.
5. Generate `render_deck_candidate` with `candidate_id` and `output: "report"`, `"portable_decklist"` or
   `"collection_pull_list"`; recover complete `first`/`after` records. The Portable Decklist contains selected cards
   only. The Pull List consumes applicable explicit Availability evidence; it is neither a reservation nor a move.
   The user chooses physical copies.
6. Explain the actual saved result, applicable checks, remaining deficits, intentional compromises and search limits.
   Save authorized progress with create/edit as work proceeds; writes, reads and outputs never imply checks or approval.
