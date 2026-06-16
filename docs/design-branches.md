# Design Branches

This document captures unresolved design branches to resume later. It should stay focused on open decisions, dependencies, and recommended next areas to grill.

## Data Model Details

- Complete the planned implementation slice for `CardIdentityTag`, `CardIdentityTagAlias`, `CardIdentityTagging`, and `CardIdentityTagHierarchy` in [`plans/oracle-tags-import.md`](./plans/oracle-tags-import.md).
- Define the exact scalar metadata fields for `DeckOpportunity` and `DeckCandidate`.
- Define the Zod schemas for `DeckBuildingBrief` and `CollectionAccessPolicy`.
- Decide how to handle split cards, multi-face cards, attractions, stickers, digital cards, rebalanced cards, and other Scryfall identity edge cases.

## Application Services

- Define the initial application-service list and boundaries.
- Separate import services, Scryfall sync services, deck-building services, query services, and render/export services.
- Decide which service outputs are structured data, Markdown, or both.
- Define expected business errors for `neverthrow` Result seams.

## Opencode Adapter

- Define the first opencode tools.
- Define the first opencode skills and agent instructions.
- Decide whether tools accept file paths, raw text input, or both.
- Decide how local configuration such as `MTG_AGENT_DB_PATH` is exposed to tools.

## LLM Orchestration

- Decide what deterministic code owns versus what the LLM owns.
- Decide how the agent receives relevant card, tag, and collection context without loading excessive data into prompts.
- Define when the LLM produces durable Markdown rationale versus transient analysis.
- Define guardrails for legality, price, and rules-sensitive claims.

## Deck Opportunity Discovery

- Define how Card Identity Tags, Collection density, Format Anchors, and Collection Access Policy produce candidate Deck Opportunities.
- Decide how much discovery is deterministic candidate generation versus LLM ranking and explanation.
- Define ranking inputs and output shape for Deck Opportunity shortlists.
- Decide how to detect weak or impossible opportunities and recommend constrained alternatives.

## Testing

- Create small ManaBox CSV fixtures.
- Create Scryfall bulk-data subset fixtures for `oracle_tags` when Card Identity Tag import is implemented.
- Test import failure behavior, transactionality, computed Availability, generated Portable Decklists, and agent-facing Markdown shape.

## Initial Implementation Sequence

- Decide the first vertical slice.
- Decide which services and tools are required before any deck-building workflow can run.
- Sequence Scryfall sync, ManaBox import, collection queries, Deck Candidate persistence, and Portable Decklist generation.
- Defer richer Deck Opportunity discovery until the card-data and collection-data foundations are reliable.
