# Design Branches

This document captures unresolved design branches to resume later. It should stay focused on open decisions, dependencies, and recommended next areas to grill.

## Data Model Details

- Complete the planned implementation slice for `CardIdentityTag`, `CardIdentityTagAlias`, `CardIdentityTagging`, and `CardIdentityTagHierarchy` in [`plans/oracle-tags-import.md`](./plans/oracle-tags-import.md).
- Define the exact scalar metadata fields for `DeckOpportunity` and `DeckCandidate`.
- Define the Zod schemas for `DeckBuildingBrief` and `CollectionAccessPolicy`.
- Decide whether to add candidate-specific `DeckCandidateCardRole` records or fields for roles such as enabler, payoff,
  win condition, and theme card. These roles describe why a card belongs in a specific Deck Candidate and should remain
  distinct from source-backed `CardIdentityTag` data.
- Decide how to handle split cards, multi-face cards, attractions, stickers, digital cards, rebalanced cards, and other Scryfall identity edge cases.

## Application Services

- Implement the structured Card Query service described in [`plans/card-query.md`](./plans/card-query.md) and
  [`ADR 0012`](./adr/0012-cql2-shaped-card-queries.md).
- Separate import services, Scryfall sync services, deck-building services, query services, and render/export services.
- Decide which service outputs are structured data, Markdown, or both.
- Define expected business errors for `neverthrow` Result seams.

## Opencode Adapter

- Continue hardening the CQL2-shaped `query_cards` Agent Tool as the primary card retrieval surface.
- Loosen the base MTG deck-builder agent workflow while keeping strict authority boundaries: no raw database MCP access,
  no arbitrary file or shell access, and only explicitly allowed MTG Agent Tools.
- Move proven deck-building workflows into skills or subagents after they are validated through real use.
- Decide whether tools accept file paths, raw text input, or both.
- Decide how local configuration such as `MTG_AGENT_DB_PATH` is exposed to tools.

## LLM Orchestration

- Decide what deterministic code owns versus what the LLM owns.
- Use Card Query and detail tools as the primary way the agent receives relevant card, tag, and collection
  context without loading excessive data into prompts.
- Define when the LLM produces durable Markdown rationale versus transient analysis.
- Define guardrails for legality, price, and rules-sensitive claims.

## Deck Opportunity Discovery

- Define how `CardIdentityTag` records, Collection density, Format Anchors, and Collection Access Policy produce candidate Deck Opportunities.
- Decide how much discovery is deterministic candidate generation versus LLM ranking and explanation.
- Define ranking inputs and output shape for Deck Opportunity shortlists.
- Decide how to detect weak or impossible opportunities and recommend constrained alternatives.

## Testing

- Create small ManaBox CSV fixtures.
- Create Scryfall bulk-data subset fixtures for `oracle_tags` when Card Identity Tag import is implemented.
- Test import failure behavior, transactionality, computed Availability, generated Portable Decklists, and agent-facing Markdown shape.

## Initial Implementation Sequence

- Next Card Query hardening slices: push supported filtering/sorting/Collection quantity work into SQL, populate
  inherited tag projections for `include.tags` as a priority completeness gap, and expand strict Card Query validation
  coverage.
- After structured search, revise the base MTG deck-builder agent to be workflow-light and tool-bound, then move
  repeatable workflows into skills or subagents.
- Defer richer Deck Opportunity discovery until the card-data and collection-data foundations are reliable.
