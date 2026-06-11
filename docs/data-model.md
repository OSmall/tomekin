# Data Model

This document describes the MVP's persisted records and their relationships. It is implementation-facing documentation for the local SQLite model and future persistence adapters; canonical domain language still belongs in `CONTEXT.md`.

The data model should preserve the product boundary between the user's Collection, Scryfall-backed card data, Deck Opportunities, and Deck Candidates. Persistence should support the local opencode MVP without making records opencode-specific.

## Principles

- Persist product records, not chat transcript artifacts.
- Keep collection ownership data separate from canonical card data.
- Keep Deck Candidates separate from Collection state until the user updates their source collection system and reimports.
- Use repository interfaces from the portable core so SQLite and Drizzle do not leak into service contracts.
- Prefer relational records for deck cards and collection cards where relationships, refresh, and querying matter.
- Preserve Scryfall's distinction between print-specific card records and Oracle card records.

## Store Versus Compute

The MVP should store agent decisions, user inputs, source data, and rationale. It should compute current factual status from those stored inputs.

Store records and fields that answer what was decided, imported, synced, or explained at the time: Deck Opportunities, Deck Candidates, Deck Candidate cards, Deck Building Briefs, Collection imports, Scryfall bulk data imports, current Collection rows, Scryfall card data, Oracle card tags, and Markdown rationale.

Compute outputs that answer what is true now: Availability, Available Cards, Committed Cards, Missing Cards, Collection Status, Collection Pull Lists, freshness status, and legality assessment.

This keeps saved agent decisions stable while allowing current facts to change when the Collection, Collection Access Policy, Scryfall data, or format legality data changes.

## Identity

Product records should use internal UUIDv7 identifiers. UUIDv7 keeps identifiers globally unique while preserving creation-time ordering as part of the identifier.

Scryfall-derived records should use Scryfall's identifiers as their record IDs. `ScryfallCard` should use the Scryfall card ID, and `OracleCard` should use the Scryfall oracle ID.

Other external source identifiers should be preserved as separate fields, such as ManaBox IDs where available. External IDs should not replace internal product record IDs.

## Records

### CollectionImport

`CollectionImport` represents a single attempt to import collection source data.

It should record import status, import timestamp, source format, imported counts, skipped source groups, validation errors, and non-failing warnings. A failed import should be visible without replacing the latest successful Collection state.

The MVP should retain `CollectionImport` history but only keep detailed `CollectionCard` rows for the latest successful Collection snapshot. It should not retain historical Collection card snapshots.

A successful Collection import should replace the current `CollectionLocation` and `CollectionCard` snapshot transactionally after the full source file has been validated and resolved. A failed import should leave the previous successful Collection snapshot unchanged.

Failed Collection import attempts should also be persisted as `CollectionImport` records with diagnostic information such as timestamp, source format, failed status, and blocking validation errors. Failed imports should not create or replace `CollectionLocation` or `CollectionCard` records.

Relationships:

- A successful `CollectionImport` provides the import timestamp used for Collection freshness checks.
- Collection-derived records should be traceable to the successful `CollectionImport` they came from.

### CollectionLocation

`CollectionLocation` represents a named place or grouping from source collection data where owned cards are recorded.

For the MVP, `CollectionLocation` should initially support `binder` and `deck` types. ManaBox calls both of these binders in the CSV shape, but the product model should use `CollectionLocation` so the rest of the system is not coupled to ManaBox terminology.

Relationships:

- A `CollectionLocation` belongs to a successful `CollectionImport` or current Collection snapshot.
- A `CollectionCard` belongs to one `CollectionLocation`.
- A `CollectionLocation` with type `deck` corresponds to the domain concept of an Existing Deck.
- Collection Access Policy may allow, protect, or exclude cards by `CollectionLocation`.

### CollectionCard

`CollectionCard` represents one imported owned-card row from the ManaBox collection CSV.

It is the collection-owned record, not the canonical card definition. It should preserve source row details needed for ownership, Availability, and Collection Pull Lists, including quantity, source location, printing metadata, finish, condition, language, purchase metadata where available, and source identifiers. `CollectionCard` is row-level and should store the ManaBox row quantity; it should not expand one source row into one record per physical card copy.

Relationships:

- A `CollectionCard` belongs to one `CollectionLocation`.
- A `CollectionCard` references one `ScryfallCard` for the specific imported card or printing.
- Multiple `CollectionCard` records may reference the same `ScryfallCard` when the user owns the same printing in multiple locations or source rows.

### ScryfallCard

`ScryfallCard` represents a Scryfall card record, including print-specific card data where Scryfall models a card at that level.

It is Scryfall source data, not an owned collection row. It may include Scryfall card ID, oracle ID, name, set, collector number, rarity, image data, prices, and other Scryfall fields useful for resolving imported collection rows and displaying exact printings.

Scryfall card data should be loaded through a separate explicit sync/import path, not as a side effect of ManaBox Collection import. The MVP should use Scryfall's All Cards bulk data export so ManaBox rows can resolve by Scryfall ID to exact `ScryfallCard` records. ManaBox import should resolve rows against local `ScryfallCard` and `OracleCard` records. If required Scryfall data is missing or a card cannot be resolved, Collection import should fail clearly rather than continuing with uncertain card identity.

The MVP should provide an explicit local sync tool for Scryfall data. It should not run automatic background Scryfall syncs or make hidden network calls during normal deck-building or Collection import.

The default Scryfall sync path should sync the required and recommended bulk datasets together in dependency order: `oracle_cards`, then `all_cards`, then Oracle Tags. The sync tool may also support syncing a single bulk data type for repair or debugging. Singular imports should fail fast when foreign-key dependencies are missing or mismatched. Each bulk data type should create its own `ScryfallBulkDataImport` record, and a failed import of one type should preserve the last usable data for that type.

If required Scryfall data is missing, operations that depend on card identity or card data should fail clearly. If Scryfall data exists but is more than 14 days old, the MVP should warn rather than block by default. Outputs that depend on Scryfall data should expose the relevant Scryfall dataset timestamp when freshness matters.

ManaBox Collection import should require local `all_cards` and `oracle_cards` datasets to exist. Oracle Tags are not required for raw Collection import, but synergy-based Deck Opportunity discovery should require local Oracle Tags data.

Relationships:

- A `ScryfallCard` references one `OracleCard`.
- Many `ScryfallCard` records may reference the same `OracleCard`.
- A `ScryfallCard` may be referenced by many `CollectionCard` records.

### ScryfallBulkDataImport

`ScryfallBulkDataImport` represents an attempt to import one Scryfall bulk data source.

It should record the bulk data type, import status, started and completed timestamps, source updated timestamp where available, source URI or bulk data identifier where available, imported record counts, warnings, and blocking errors. The bulk data type should use Scryfall's canonical response `type` value, such as `all_cards`, rather than URL path slugs. URL path mapping belongs in the Scryfall adapter.

Successful Scryfall bulk data imports update the corresponding Scryfall-backed records. Failed imports should preserve diagnostic information without replacing the last usable Scryfall-backed dataset.

Scryfall bulk data imports should use transactional full replacement per dataset with staging. The importer should load and validate the complete dataset before replacing the target records. A successful import replaces the target dataset and records a successful `ScryfallBulkDataImport`; a failed import leaves the previous usable dataset unchanged.

Relationships:

- `ScryfallCard` records are loaded from successful `all_cards` bulk data imports.
- `OracleCard` records are loaded from successful `oracle_cards` bulk data imports.
- `OracleCardTag` records are loaded from successful Oracle Tags bulk data imports.

### OracleCard

`OracleCard` represents Scryfall oracle card data used for canonical card identity and deck-building reasoning.

It is not an owned physical card and should not contain collection location, condition, finish, language, purchase details, or print-specific collection metadata. It should be imported from Scryfall's `oracle_cards` bulk data because that source provides one Scryfall card object for each Oracle ID. It should provide the canonical card information needed for deck construction, legality checks, color identity, card text, card typing, and synergy analysis.

Relationships:

- A single `OracleCard` may be referenced by many `ScryfallCard` records.
- A single `OracleCard` may be reached from many `CollectionCard` records through `ScryfallCard`.
- A single `OracleCard` may be referenced by many `DeckCandidateCard` records.
- A single `OracleCard` may have many `OracleCardTag` records.
- `OracleCard` is the bridge between owned collection rows and proposed deck cards.

### OracleCardTag

`OracleCardTag` represents a tag from Scryfall's Oracle Tags bulk data associated with an `OracleCard`.

Oracle card tags should be stored as relational records because synergy calculations and Deck Opportunity discovery need to query tags across the Collection and candidate card space. The exact fields should be resolved from the Scryfall Oracle Tags bulk data specification.

Relationships:

- An `OracleCardTag` belongs to one `OracleCard`.
- An `OracleCard` may have many `OracleCardTag` records.
- Future tag sources may add records alongside Scryfall Oracle Tags if they can be distinguished without changing the core card identity model.

### DeckOpportunity

`DeckOpportunity` represents a durable deck-building direction discovered from the Collection or from the user's stated Deck Building Preferences.

It should preserve enough information to reopen and explain the opportunity without depending on the original chat conversation. It should store scalar metadata needed for list, search, freshness, and comparison, plus a Markdown body containing the structured opportunity explanation. Scalar metadata should include label, Format, Format Anchor where applicable, Power Level or Commander Bracket where applicable, and the Collection import timestamp it was discovered against. The Deck Building Brief used to discover the opportunity should be stored as Zod-validated structured JSON. The stored Markdown body is the canonical saved explanation and should be returned as stored on ordinary reads.

The Collection import timestamp is provenance metadata. It supports freshness checks by comparison with the latest successful `CollectionImport` and does not store derived Collection Status.

Deck Opportunities should be mutable for the MVP and should include `createdAt` and `updatedAt` timestamps.

Relationships:

- A `DeckOpportunity` may be created against a specific successful `CollectionImport` timestamp.
- A `DeckOpportunity` may be the source for zero or more `DeckCandidate` records.

### DeckCandidate

`DeckCandidate` represents a durable proposed decklist and its explanation.

It should preserve enough structured information to reopen, compare, refresh, and export the proposal without depending on the original chat conversation. It remains separate from Collection state unless the user later updates their source collection system and reimports.

The decklist should be stored through `DeckCandidateCard` rows. The larger Deck Candidate explanation should be stored as a Markdown body containing the stable MVP output sections. Scalar metadata needed for list, search, freshness, and comparison should live as fields on `DeckCandidate`, including label, Format, Format Anchor where applicable, Power Level or Commander Bracket where applicable, source Deck Opportunity reference where applicable, and the Collection import timestamp used for the latest Collection Status and Collection Pull List calculations. The Deck Building Brief used to build the candidate should be stored as Zod-validated structured JSON. The stored Markdown body is the canonical saved explanation and should be returned as stored on ordinary reads.

The Collection import timestamp is provenance metadata. It supports freshness checks by comparison with the latest successful `CollectionImport`; Availability, Missing Cards, Collection Status, and Collection Pull Lists should be computed when needed.

The Portable Decklist should be generated from `DeckCandidateCard` rows and `OracleCard` names when needed.

Deck Candidates should be mutable for the MVP and should include `createdAt` and `updatedAt` timestamps.

Relationships:

- A `DeckCandidate` may reference a source `DeckOpportunity`.
- A `DeckCandidate` has many `DeckCandidateCard` records.
- A `DeckCandidate` records the Collection import timestamp used for its latest Collection Status and Collection Pull List calculations.
- Refreshing a stale `DeckCandidate` recalculates collection-derived information without changing the decklist unless the user asks for a revision.

### DeckCandidateCard

`DeckCandidateCard` represents one card entry in a Deck Candidate.

It should be relational rather than stored only inside a JSON array so the system can refresh Collection Status, inspect Missing Cards, validate legality, and query deck contents. It should include the card quantity, Commander/EDH decklist section, stable sort order, and optional notes when card-level explanation needs to be persisted. Portable Decklist card names should come from `OracleCard`, not duplicated display names on `DeckCandidateCard`.

Relationships:

- A `DeckCandidateCard` belongs to one `DeckCandidate`.
- A `DeckCandidateCard` references one `OracleCard`.
- A `DeckCandidateCard` should not reference `CollectionCard` directly because current owned-copy matching can be derived through `OracleCard` and the active Collection snapshot.
- A `DeckCandidateCard` should not reference `ScryfallCard` by default because Deck Candidates care about canonical card choice, not exact printing.
- Availability status should not be stored as permanent truth on `DeckCandidateCard`; it should be recalculated against the active Collection snapshot.

## Relationship Summary

```txt
CollectionImport
  -> CollectionLocation
       -> CollectionCard
            -> ScryfallCard
                 -> OracleCard
                      -> OracleCardTag

DeckOpportunity
  -> DeckCandidate
       -> DeckCandidateCard
            -> OracleCard
                 -> OracleCardTag
```

`ScryfallCard` represents Scryfall's card-level data, including print-specific records. `OracleCard` represents Scryfall's canonical oracle-level card identity. `OracleCardTag` describes tag data associated with that canonical identity. `CollectionCard` describes owned source rows. `DeckCandidateCard` describes proposed deck entries and references `OracleCard` because Deck Candidates do not choose exact printings by default.

## Open Questions

- The exact record fields for `OracleCardTag`, resolved from the Scryfall Oracle Tags bulk data specification.
- How split cards, rebalanced digital cards, and print-specific exceptions should be represented when Scryfall's card and oracle identities are not enough by themselves.
- Whether `DeckOpportunity` needs separate child records for key cards, packages, or Synergies, or whether those can remain structured JSON for the MVP.
