# Data Model

This document describes the MVP's persisted records and their relationships. It is implementation-facing documentation for the local SQLite model and future persistence adapters; canonical domain language still belongs in `CONTEXT.md`.

The data model should preserve the product boundary between the user's Collection, Scryfall-backed card data, Deck Opportunities, and Deck Candidates. Persistence should support the local opencode MVP without making records opencode-specific.

## Principles

- Persist product records, not chat transcript artifacts.
- Keep collection ownership data separate from canonical card data.
- Keep Deck Candidates separate from Collection state until the user updates their source collection system and reimports.
- Use repository interfaces from the portable core so SQLite and Drizzle do not leak into service contracts.
- Prefer relational records for deck cards and collection cards where relationships, refresh, and querying matter.
- Preserve the distinction between print-specific card records and canonical card identities without making the domain model Scryfall-specific.

## Store Versus Compute

The MVP should store agent decisions, user inputs, source data, and rationale. It should compute current factual status from those stored inputs.

Store records and fields that answer what was decided, imported, synced, or explained at the time: Deck Opportunities, Deck Candidates, Deck Candidate cards, Deck Building Briefs, Collection imports, Scryfall bulk data imports, current Collection rows, card reference data, Card Identity Tags, and Markdown rationale.

Compute outputs that answer what is true now: Availability, Available Cards, Committed Cards, Missing Cards, Collection Status, Collection Pull Lists, freshness status, and legality assessment.

This keeps saved agent decisions stable while allowing current facts to change when the Collection, Collection Access Policy, Scryfall data, or format legality data changes.

## Identity

Product records should use internal UUIDv7 identifiers. UUIDv7 keeps identifiers globally unique while preserving creation-time ordering as part of the identifier.

Scryfall-derived reference records should use Scryfall's identifiers as their record IDs. `CardPrinting` should use the Scryfall card ID, `CardIdentity` should use the Scryfall oracle ID, and `CardIdentityTag` should use the Scryfall tag ID.

Physical table and relationship column names should use source-neutral model names, such as `card_printings`, `card_identities`, `card_identity_tags`, `card_identity_taggings`, and `card_identity_tag_hierarchy`. Source-specific values should remain where they are external protocol values, such as `ScryfallBulkDataImport.bulkDataType` values of `oracle_cards`, `all_cards`, and `oracle_tags`.

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
- A `CollectionCard` references one `CardPrinting` for the specific imported card or printing through `card_printing_id`.
- Multiple `CollectionCard` records may reference the same `CardPrinting` when the user owns the same printing in multiple locations or source rows.
- `CollectionCard` should not also store `card_identity_id`; Card Identity is derived through `CardPrinting`.

### CardPrinting

`CardPrinting` represents a source-backed record for a specific printed or print-like version of a card.

It is source reference data, not an owned collection row. It should include only source fields directly needed for resolving imported collection rows and displaying exact printings. For the MVP, that means the Scryfall card ID as `id`, the related Card Identity as `card_identity_id`, source printing name, set code, collector number, finish-related data, and language. Source-specific URI fields should be omitted unless a concrete display or debugging need appears.

Scryfall card data should be loaded through a separate explicit sync/import path, not as a side effect of ManaBox Collection import. The MVP should use Scryfall's All Cards bulk data export so ManaBox rows can resolve by Scryfall ID to exact `CardPrinting` records. ManaBox import should resolve rows against local `CardPrinting` and `CardIdentity` records. If required Scryfall data is missing or a card cannot be resolved, Collection import should fail clearly rather than continuing with uncertain card identity.

The MVP should provide an explicit local sync tool for Scryfall data. It should not run automatic background Scryfall syncs or make hidden network calls during normal deck-building or Collection import.

The default Scryfall sync path should sync the required and recommended bulk datasets together in dependency order: `oracle_cards`, then `all_cards`, then `oracle_tags`. The sync tool may also support syncing a single bulk data type for repair or debugging. Singular imports should fail fast when foreign-key dependencies are missing or mismatched. Each bulk data type should create its own `ScryfallBulkDataImport` record, and a failed import of one type should preserve the last usable data for that type. The `oracle_tags` import depends on `CardIdentity` records but does not depend on `CardPrinting` records.

If required Scryfall data is missing, operations that depend on card identity or card data should fail clearly. If Scryfall data exists but is more than 14 days old, the MVP should warn rather than block by default. Outputs that depend on Scryfall data should expose the relevant Scryfall dataset timestamp when freshness matters.

ManaBox Collection import should require local `all_cards` and `oracle_cards` datasets to exist. The `oracle_tags` dataset is not required for raw Collection import, but synergy-based Deck Opportunity discovery should require local Card Identity Tag data from `oracle_tags`.

Relationships:

- A `CardPrinting` references one `CardIdentity`.
- Many `CardPrinting` records may reference the same `CardIdentity`.
- A `CardPrinting` may be referenced by many `CollectionCard` records.

### ScryfallBulkDataImport

`ScryfallBulkDataImport` represents an attempt to import one Scryfall bulk data source.

It should record the bulk data type, import status, started and completed timestamps, source updated timestamp where available, source URI or bulk data identifier where available, imported record counts, warnings, and blocking errors. The bulk data type should use Scryfall's canonical response `type` value, such as `all_cards`, rather than URL path slugs. URL path mapping belongs in the Scryfall adapter.

Successful Scryfall bulk data imports update the corresponding Scryfall-backed records. Failed imports should preserve diagnostic information without replacing the last usable Scryfall-backed dataset.

Scryfall bulk data imports should use transactional full replacement per dataset with staging. The importer should load and validate the complete dataset before replacing the target records. A successful import replaces the target dataset and records a successful `ScryfallBulkDataImport`; a failed import leaves the previous usable dataset unchanged.

Writes to `CardIdentity`, `CardPrinting`, and Card Identity Tag reference data should be owned by the Scryfall bulk import path for the MVP. General card reference query services should not expose arbitrary write methods for these records unless another real source or editing workflow exists.

Repository ports should keep source-sync provenance separate from card reference queries. A Scryfall bulk import repository should record import attempts, replace Scryfall-backed datasets, and answer dataset availability or freshness status. A card reference repository should expose read-only queries over Card Identities, Card Printings, and Card Identity Tags.

`oracle_cards`, `all_cards`, and `oracle_tags` replacements should each be independently transactional and independently recorded, even when invoked by a default full sync. A standalone `oracle_cards` replacement should fail fast if it would orphan existing `CardPrinting` or `CardIdentityTagging` records. This should be rare with Scryfall data, but preserving referential integrity is more important than accepting a partial reference-data refresh. An `all_cards` replacement should fail if any imported `CardPrinting.card_identity_id` does not exist in the currently usable `CardIdentity` dataset.

Relationships:

- `CardPrinting` records are loaded from successful `all_cards` bulk data imports.
- `CardIdentity` records are loaded from successful `oracle_cards` bulk data imports.
- `CardIdentityTag`, `CardIdentityTagAlias`, `CardIdentityTagging`, and `CardIdentityTagHierarchy` records are loaded from successful `oracle_tags` bulk data imports.
- A successful `oracle_tags` import transactionally replaces the tag, alias, tagging, and hierarchy dataset together.

### CardIdentity

`CardIdentity` represents canonical card identity data used for deck-building reasoning.

It is not an owned physical card and should not contain collection location, condition, finish, language, purchase details, or print-specific collection metadata. It should be imported from Scryfall's `oracle_cards` bulk data because that source provides one Scryfall card object for each Oracle ID. It should provide the canonical card information needed for deck construction, legality checks, color identity, card text, card typing, synergy analysis, and Portable Decklist names. `CardIdentity.name` is the canonical deck-building and Portable Decklist name; `CardPrinting.name` preserves the source printing name for exact printing display.

Relationships:

- A single `CardIdentity` may be referenced by many `CardPrinting` records.
- A single `CardIdentity` may be reached from many `CollectionCard` records through `CardPrinting`.
- A single `CardIdentity` may be referenced by many `DeckCandidateCard` records.
- A single `CardIdentity` may have many `CardIdentityTagging` records.
- `CardIdentity` is the bridge between owned collection rows and proposed deck cards.

### CardIdentityTag

`CardIdentityTag` represents a reusable tag from Scryfall's `oracle_tags` bulk data that may apply to Card Identities.

Card Identity Tags should be stored as relational records because synergy calculations and Deck Opportunity discovery need to query tags across the Collection and candidate card space. The MVP should import only Scryfall `oracle` tags, not `illustration` tags, and does not need to store tag type because every persisted Card Identity Tag is an oracle tag. `CardIdentityTag` should preserve Scryfall's stable tag UUID as its primary ID and store Scryfall tag metadata including slug, label, and nullable description. Slug should be unique in the current imported dataset but should not be treated as the stable identity. Label is display metadata and should not be unique. Tag aliases and hierarchy should be stored relationally.

All imported Card Identity Tags should be stored, even when they have no direct Card Identity Taggings. Broad parent-tag matches should be inferred from descendant taggings at query or reasoning time rather than materialized as additional taggings.

Core services should expose deterministic tag lookup and search primitives over stored tag data without depending on an LLM. Exact tag resolution should match slug, label, and aliases. Exploratory matching for fuzzy user language belongs in the adapter or agent layer, which may turn user phrases into candidate search terms and then ask core for deterministic candidate tags with enough context to choose or clarify.

Relationships:

- A `CardIdentityTag` may have many `CardIdentityTagging` records.
- A `CardIdentityTag` may have many `CardIdentityTagAlias` records.
- A `CardIdentityTag` may have many parent and child `CardIdentityTag` records through `CardIdentityTagHierarchy`.
- Future tag sources may add records alongside Scryfall `oracle_tags` data if they can be distinguished without changing the core card identity model.

### CardIdentityTagAlias

`CardIdentityTagAlias` represents an alternate lookup name for a Card Identity Tag.

It should be relational rather than stored only as JSON because users may refer to tag concepts with language that differs from Scryfall's canonical label. The MVP should populate aliases from Scryfall tag data and should not include alias provenance until user-defined aliases are a real feature.

It should store the source alias string directly without a separate normalized lookup value. The row should use a composite primary key of `card_identity_tag_id` and `alias`.

Relationships:

- A `CardIdentityTagAlias` belongs to one `CardIdentityTag`.
- A `CardIdentityTag` may have many aliases.
- A `CardIdentityTag` and alias pair should be unique. Alias values should not be globally unique across all tags.

### CardIdentityTagging

`CardIdentityTagging` represents the direct relationship between a Card Identity and a Card Identity Tag.

It should use a composite primary key of `card_identity_id` and `card_identity_tag_id`. Relationship-specific Scryfall tagging fields such as weight and annotation belong on `CardIdentityTagging`. Tagging weight should be constrained to Scryfall's documented values: `very_strong`, `strong`, `median`, and `weak`. If a tagging references a missing `CardIdentity`, or if the same `card_identity_id` and `card_identity_tag_id` pair appears more than once in the imported data, the `oracle_tags` import should fail and preserve the previous usable tag dataset.

Relationships:

- A `CardIdentityTagging` belongs to one `CardIdentity`.
- A `CardIdentityTagging` belongs to one `CardIdentityTag`.
- A `CardIdentity` and `CardIdentityTag` pair should have at most one direct `CardIdentityTagging`.

### CardIdentityTagHierarchy

`CardIdentityTagHierarchy` represents a direct parent-child relationship between two Card Identity Tags.

It should use a composite primary key of `parent_card_identity_tag_id` and `child_card_identity_tag_id`. The importer should build hierarchy only from Scryfall `parent_ids` and should ignore `child_ids` for persistence and validation. If a `parent_ids` value references a tag missing from the imported `oracle_tags` dataset, the import should fail and preserve the previous usable tag dataset. Self-parenting and hierarchy cycles should be rejected.

Relationships:

- A `CardIdentityTagHierarchy` references one parent `CardIdentityTag`.
- A `CardIdentityTagHierarchy` references one child `CardIdentityTag`.
- A `CardIdentityTag` may have many parent and child tags.

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

The Portable Decklist should be generated from `DeckCandidateCard` rows and `CardIdentity` names when needed.

Deck Candidates should be mutable for the MVP and should include `createdAt` and `updatedAt` timestamps.

Relationships:

- A `DeckCandidate` may reference a source `DeckOpportunity`.
- A `DeckCandidate` has many `DeckCandidateCard` records.
- A `DeckCandidate` records the Collection import timestamp used for its latest Collection Status and Collection Pull List calculations.
- Refreshing a stale `DeckCandidate` recalculates collection-derived information without changing the decklist unless the user asks for a revision.

### DeckCandidateCard

`DeckCandidateCard` represents one card entry in a Deck Candidate.

It should be relational rather than stored only inside a JSON array so the system can refresh Collection Status, inspect Missing Cards, validate legality, and query deck contents. It should include the card quantity, Commander/EDH decklist section, stable sort order, and optional notes when card-level explanation needs to be persisted. Portable Decklist card names should come from `CardIdentity`, not duplicated display names on `DeckCandidateCard`.

Relationships:

- A `DeckCandidateCard` belongs to one `DeckCandidate`.
- A `DeckCandidateCard` references one `CardIdentity`.
- A `DeckCandidateCard` should not reference `CollectionCard` directly because current owned-copy matching can be derived through `CardIdentity` and the active Collection snapshot.
- A `DeckCandidateCard` should not reference `CardPrinting` by default because Deck Candidates care about canonical card choice, not exact printing.
- Availability status should not be stored as permanent truth on `DeckCandidateCard`; it should be recalculated against the active Collection snapshot.

## Relationship Summary

```txt
CollectionImport
  -> CollectionLocation
       -> CollectionCard
            -> CardPrinting
                 -> CardIdentity
                      -> CardIdentityTagging
                           -> CardIdentityTag
                                -> CardIdentityTagAlias
                                -> CardIdentityTagHierarchy

DeckOpportunity
  -> DeckCandidate
       -> DeckCandidateCard
            -> CardIdentity
                 -> CardIdentityTagging
                      -> CardIdentityTag
                           -> CardIdentityTagAlias
                           -> CardIdentityTagHierarchy
```

`CardPrinting` represents source-backed print-specific records. `CardIdentity` represents canonical card identity. `CardIdentityTag` describes reusable functional tag data associated through `CardIdentityTagging`. `CollectionCard` describes owned source rows. `DeckCandidateCard` describes proposed deck entries and references `CardIdentity` because Deck Candidates do not choose exact printings by default.

## Open Questions

- How split cards, rebalanced digital cards, and print-specific exceptions should be represented when Scryfall's card and oracle identities are not enough by themselves.
- Whether `DeckOpportunity` needs separate child records for key cards, packages, or Synergies, or whether those can remain structured JSON for the MVP.
