# Product Scope

This document owns Tomekin's product promise, supported scope, boundaries, and non-goals. Current observable workflows
are defined in [`product-behavior.md`](./product-behavior.md); possibilities that are not current commitments belong in
[`future-direction.md`](./future-direction.md).

## Product Promise

Tomekin is a local, collection-first Magic: The Gathering deck builder. It helps a player turn an imported record of
their real cards into cohesive, explainable Deck Candidates while making owned and missing evidence visible.

The product favours recommendations that can be inspected and revised. User goals, preferred play experience, intended
strength, tolerance for Missing Cards, and permitted Collection Locations shape the result; maximizing power or owned
card usage is not an automatic objective.

## Supported Scope

- Commander/EDH construction and tuning, including Commander Bracket and explicit Rule Zero handling.
- Paper-first 60-card construction and tuning for Standard, Pioneer, Modern, Legacy, Vintage, Pauper, and Casual 60.
- Collection Opportunity discovery, direct fresh construction, and Existing Deck or Deck Candidate tuning as separate
  valid routes.
- Optional 60-card Sideboards when requested; Commander/EDH has no Sideboard in Tomekin's workflow.
- Strict full-snapshot import from ManaBox Collection CSV files, with binder and deck Collection Locations.
- Explicit Scryfall bulk-data sync and local-file import for Card Identities, Card Printings, Card Sets, legality, and
  Oracle Tags.
- Local Card Query over Card Identity, legality, tags, Collection rows, and Printing/Set criteria.
- Deterministic local card resolution, Format construction validation, rendering, and Deck Candidate persistence.
- Generic hypergeometric probability and minimum qualifying-count calculations for a uniformly sampled population of
  at most 1,000 copies, without replacement.
- Local SQLite storage for the current Collection snapshot, import history, reference data, and saved Deck Candidates.

The exact workflow and output guarantees are in [Product Behavior](./product-behavior.md). The public retrieval
language is in [Card Query](./card-query.md).

## Product Principles

- Prioritize collection-first deck building before broader MTG assistant behavior.
- Prefer explainable recommendations over opaque optimization.
- Treat user priorities as inputs rather than fixed assumptions.
- Keep Format language and core services extensible.
- Keep deterministic facts and validation in product services while leaving contextual strategy to the agent.
- Keep external and persistence authority narrow and explicit.

## Current Boundaries

The Collection is imported source data, not Tomekin-managed inventory. Tomekin reads and analyzes it but does not move
cards, update locations, register source decks, or write back to ManaBox. The user updates their source collection
system and reimports after physical changes.

Deck Opportunities and Deck Change Proposals are transient agent analysis. Only Deck Candidates have a current product
persistence service. Saving a Deck Candidate neither changes the Collection nor records exact physical copies chosen
for assembly.

Collection Access Policy is not a structured or independently enforced service today. The agent confirms an exact
Collection Location allow-list in the working context, repeats it in Card Queries, and performs a best-effort final
owned/missing check. There is no persisted final Availability or Collection Pull List service.

Discovery uses the boot-injected live Scryfall search provider; local lookup and deterministic checks use explicitly
imported reference data. Search does not silently refresh that corpus. The agent has no arbitrary web, shell, raw SQL,
or generic database authority. Bulk refresh remains the explicit Scryfall sync command.

Tomekin stores source purchase-price metadata when present but does not currently provide live price lookup, price-aware
optimization, or budgeted purchase recommendations. It also does not claim current metagame knowledge, exhaustive combo
detection, gameplay simulation, or deterministic strategic optimality.

The current ManaBox importer does not implement the desired skip-and-summary behavior for List rows; unsupported
location types fail the readable import and preserve the previous snapshot. That gap is tracked in
[issue #39](https://github.com/OSmall/tomekin/issues/39).

## Non-goals

- Replacing collection-management software or synchronizing changes back to a source system.
- Acting as a general raw database, shell, browsing, or coding agent.
- Automatically downloading card data during ordinary deck-building.
- Treating generated strategy, roles, Synergy, or tuning advice as a mathematical guarantee.
- Persisting every exploratory query, Deck Opportunity, Deck Change Proposal, or agent conversation.
- Providing a hosted service, packaged installer, or graphical user interface in the current clone-based alpha.

Uncommitted possibilities beyond these boundaries are described in [Future Direction](./future-direction.md).
