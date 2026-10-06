# Data Model

This document owns Tomekin's implemented persisted records, relationships, and import invariants. Current
user-observable behavior belongs in [`product-behavior.md`](./product-behavior.md), Card Query semantics belong in
[`card-query.md`](./card-query.md), and canonical domain language belongs in the [shared glossary](../CONTEXT.md).

The current SQLite model keeps the user's Collection, Scryfall-backed reference data, and saved Deck Candidates
separate. Repository interfaces in the portable core keep SQLite and Drizzle details out of service contracts.

The adopted retrieval direction in [ADR 0019](./adr/0019-provider-backed-scryfall-card-search.md) retains these domain
records and relationships, including Collection-to-Printing and candidate-to-Identity foreign keys. It does not adopt
duplicate identity columns or diagnostic name snapshots. Provider-backed search is not implemented yet and does not
currently require a persisted-model migration.

## Persistence Boundaries

- Collection imports retain attempt summaries. Collection Locations and Collection Cards represent only the latest
  successful snapshot.
- Scryfall imports retain attempt summaries. Each supported reference dataset is replaced independently and
  transactionally.
- Deck Candidates are the only persisted deck-building result. Deck Opportunity shortlists and Deck Change Proposals
  remain transient.
- Card Query requests and results are transient. Queries do not create saved filters or cached product records.
- Saved Collection evidence is provenance, not current Availability. Tomekin does not persist an Availability decision,
  Collection Pull List, candidate freshness state, or refresh result.

Internal product records use UUIDv7 identifiers. Scryfall-backed records use stable source identifiers: Scryfall card
IDs for Card Printings, Oracle IDs for Card Identities, Set IDs for Card Sets, and tag IDs for Card Identity Tags.
External product identifiers such as ManaBox IDs remain separate fields.

## Collection Records

### CollectionImport

`CollectionImport` records a readable ManaBox Collection CSV import attempt. It stores status, import time, source
format and label, imported row and quantity counts, binder and inferred Existing Deck counts, skipped ManaBox Lists,
validation errors, and warnings.

A successful attempt transactionally replaces all current `CollectionLocation` and `CollectionCard` rows. A readable
attempt that fails reference-data prerequisites or row validation records a failed `CollectionImport` and leaves the
previous Collection snapshot unchanged. A missing or unreadable source file fails before the import service reaches the
repository and therefore creates no `CollectionImport` record.

Current Collection rows are understood to come from the latest successful import; they do not carry a per-row import
foreign key, and historical Collection snapshots are not retained.

### CollectionLocation

`CollectionLocation` stores a unique `(type, name)` pair for the current Collection snapshot. The implemented location
types are `binder` and `deck`; a `deck` location is an Existing Deck. Each Collection Card belongs to one location.

The data model does not store or enforce a structured Collection Access Policy. The agent confirms exact allowed
location pairs procedurally and passes them to Card Query.

### CollectionCard

`CollectionCard` stores one owned row from the source CSV rather than expanding the row into individual physical
copies. It records quantity, location, finish, optional ManaBox ID, exact Card Printing ID, misprint and altered flags,
condition, optional purchase price and currency, optional added time, and source row number.

The source name, Set code, collector number, and language are validation inputs rather than duplicated Collection Card
fields. Set code, collector number, language, and finish must agree with the resolved Card Printing; a name mismatch is
a warning. Card Identity is reached through the exact Card Printing rather than duplicated on the Collection Card.

## Scryfall Import Records

### ScryfallBulkDataImport

`ScryfallBulkDataImport` records an `oracle_cards`, `all_cards`, or `oracle_tags` import attempt. It stores the dataset's
Import Contract Revision, status, start and completion times, optional source update time and URI, imported record
count, warnings, and blocking errors.

Each dataset uses staging and transactional full replacement. A successful import replaces that dataset and records a
successful attempt. A failed import records diagnostics and preserves the previous usable dataset. Reference readiness
distinguishes a missing dataset from one produced by an incompatible Import Contract Revision.

The default explicit sync processes `oracle_cards`, then `all_cards`, then `oracle_tags`. Local-file import and explicit
single-dataset sync use the same replacement rules. Normal deck-building and Collection import do not perform hidden
network refreshes.

Replacement invariants include:

- `oracle_cards` replacement is blocked when it would orphan existing Card Printings or Card Identity Taggings.
- `all_cards` replacement is blocked when a Card Printing references a missing Card Identity, when repeated Set
  metadata conflicts by ID or code, or when equivalent Printing IDs disagree.
- `oracle_tags` replacement is atomic across tags, aliases, direct taggings, and hierarchy links.

### CardIdentity

`CardIdentity` is the canonical card-level record imported from `oracle_cards`. It stores the Oracle ID, canonical name
and layout, mana cost and Mana Value, type line and Oracle text, compiled Copy Limit Override, WUBRG-ordered Color
Identity and color fields, produced mana, keywords, applicable combat or loyalty values, EDHREC rank, required Game
Changer flag, and source page URI.

Colorless Color Identity is the empty scalar. Produced mana uses a separate scalar that can include colorless mana and
the source's tolerated `T` value. Copy Limit Override is stored as `none`, `unlimited`, or `maximum` with a positive
maximum; unsupported potential override wording blocks the `oracle_cards` import.

A Card Identity can have canonical parts, Format legality rows, direct Card Identity Taggings, many Card Printings, and
many Deck Candidate Cards.

### CardIdentityPart

`CardIdentityPart` stores ordered canonical parts supplied by `oracle_cards.card_faces`. No synthetic part is created
for an ordinary one-part identity. The composite identity is `(card_identity_id, part_index)`, and fields include name,
mana cost, type line, Oracle text, colors, Color Indicator, power, toughness, loyalty, and defense.

### CardIdentityFormatLegality

`CardIdentityFormatLegality` stores one source legality value for one Card Identity and Format. The accepted legality
values are `legal`, `not_legal`, `banned`, and `restricted`; `not_legal` rows are retained so absence is not ambiguous.

Every imported Card Identity must include source rows for Commander, Standard, Pioneer, Modern, Legacy, Vintage, and
Pauper. Other source-provided formats remain stored. Casual 60 has no source-legality row.

### CardSet

`CardSet` stores Scryfall Set reference metadata repeated by `all_cards`: Set ID, lowercase source code, name, open-ended
Set type, API URI, functional card-search URI, and human-facing source page URI. IDs and codes are unique.

All Card Printings require a real Card Set foreign key. The one-time migration from the pre-Set schema blocks when
legacy Card Printings remain. Its explicit preparation operation removes only regenerable Collection/Printing data;
Card Identities and saved Deck Candidates survive before Scryfall sync and Collection reimport rebuild the removed
rows. A fresh database contains no placeholder Set.

### CardPrinting

`CardPrinting` is a print-specific `all_cards` record, not an owned copy. It stores the Scryfall card ID, related Card
Identity, `standard` or `reversible_card` presentation layout, optional Printed Name, required Card Set, collector
number, language, optional marketplace IDs, and source page URI.

Reversible-card printings without a top-level Oracle ID derive their Card Identity from one distinct face-level Oracle
ID. Multiple distinct face-level Oracle IDs block import rather than being guessed. A Card Printing can have ordered
printing parts, available finishes, open-ended promo types, and many Collection Cards.

### CardPrintingPart

`CardPrintingPart` stores ordered print-local or presentation fields from `all_cards.card_faces`: Printed Name, flavor
name, printed type line and text, flavor text, artist metadata, illustration ID, and image URIs. It does not duplicate
canonical rules fields or carry a separate Card Identity ID.

### CardPrintingFinish

`CardPrintingFinish` stores one available `nonfoil`, `foil`, or `etched` finish per Card Printing. The composite
Printing-and-finish pair is unique and is used to validate imported owned rows.

### CardPrintingPromoType

`CardPrintingPromoType` stores each non-empty source promo type once per Card Printing. The vocabulary is open-ended.
Universes Beyond status is derived from the `universesbeyond` promo row rather than stored as a duplicate boolean.

## Oracle Tag Records

### CardIdentityTag

`CardIdentityTag` stores every Scryfall oracle tag, including tags with no direct Card Identity Taggings. It preserves
the stable source tag ID, unique slug, label, optional description, and source page URI. Illustration tags are not
imported.

Exact lookup can use slug, label, or aliases. Fuzzy interpretation of user language stays in the agent layer; Card
Query exposes deterministic tag and hierarchy matching without exposing the physical tables.

### CardIdentityTagAlias

`CardIdentityTagAlias` stores one source alias for one tag under a composite key. Alias values are not globally unique,
and no separate normalized value or provenance record is stored.

### CardIdentityTagging

`CardIdentityTagging` stores only a direct source relationship between a Card Identity and a tag. The composite
Card-Identity-and-tag pair is unique. Each row includes one of `very_strong`, `strong`, `median`, or `weak` and an
optional annotation. Broader inherited matches are computed through hierarchy traversal; they are not materialized as
extra taggings.

### CardIdentityTagHierarchy

`CardIdentityTagHierarchy` stores direct parent-child tag links derived from source `parent_ids`. Source `child_ids` are
not persisted or used to infer additional links. Root tags are valid.

An `oracle_tags` import requires a latest successful `oracle_cards` import. It is blocked by an empty dataset, invalid
or duplicate source records, unknown tagging weights, a tagging whose Card Identity is absent, a parent ID absent from
the staged tag dataset, or a self-parent link. Any blocking error rolls back replacement of tags, aliases, taggings,
hierarchy, and the successful-attempt record. The current importer does not perform full hierarchy-cycle detection.

## Deck Candidate Records

### DeckCandidate

`DeckCandidate` is a saved proposed decklist and explanation. It is separate from Collection state even when it was
built with Collection evidence.

SQLite stores its UUID, label, Format, optional Format Anchor, validated Format-discriminated Deck Building Brief JSON,
optional Collection import timestamp, canonical Markdown, and creation and update times. The Brief's Format is
authoritative; the repository derives the queryable Format column from it. Commander Bracket appears only in the
Commander Brief branch.

The optional Collection import timestamp records which snapshot informed the saved Markdown. The model does not derive
or persist freshness, current Availability, Missing Cards, or a Collection Pull List from that timestamp. Ordinary
reads return the canonical Markdown as stored. Saving an existing ID updates the candidate and transactionally replaces
its card rows.

### DeckCandidateCard

`DeckCandidateCard` stores a relational entry with Deck Candidate ID, Card Identity ID, positive quantity, canonical
section, stable sort order, and optional note. The closed section vocabulary is `commander`, `mainboard`, and
`sideboard`; Format validation decides which sections are legal.

Card names come from Card Identity when reading or rendering the Portable Decklist. A Deck Candidate Card does not point
to a Collection Card or choose an exact Card Printing, and it does not store an Availability classification.

## Relationship Summary

```text
CollectionImport (attempt history)

CollectionLocation
  -> CollectionCard
       -> CardPrinting
            -> CardSet
            -> CardPrintingPart / CardPrintingFinish / CardPrintingPromoType
            -> CardIdentity
                 -> CardIdentityPart / CardIdentityFormatLegality
                 -> CardIdentityTagging
                      -> CardIdentityTag
                           -> CardIdentityTagAlias / CardIdentityTagHierarchy

ScryfallBulkDataImport (attempt history per dataset)

DeckCandidate
  -> DeckCandidateCard
       -> CardIdentity
```

This shape preserves the distinctions between owned rows, exact Printings, canonical Card Identities, source-backed
tags, and proposed deck entries without presenting transient agent analysis as persisted product state.
