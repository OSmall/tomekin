# ManaBox Collection Import Plan

This plan defines the implementation slice for importing a ManaBox Collection CSV into the local SQLite Collection
snapshot.

## Current Export Shape

The current real export at `/Users/osmall/Downloads/ManaBox_Collection.csv` has these columns:

```text
Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added
```

Observed current-export facts:

- 1,535 source rows.
- 2,295 total owned-card quantity.
- `Binder Type` values are `binder` and `deck`.
- Every row has `Scryfall ID`.
- `Foil` values observed are `normal` and `foil`.
- `Language` is `en` for every row.
- 12 rows have blank `Purchase price`; the source still provides `Purchase price currency`.

## Resolved Decisions

- Do not store raw CSV row JSON on `CollectionCard`.
- Store row-level `CollectionCard` records; do not expand quantities into one row per physical copy.
- Keep the name `CollectionCard` for the row-level owned-card record. One `CollectionCard.id` may represent multiple
  physical copies through `quantity`.
- Store only Collection-owned fields that cannot be inferred from local Scryfall reference data: `quantity`,
  `collectionLocationId`, `finish`, `manaBoxId`, `cardPrintingId`, `misprint`, `altered`, `condition`,
  `purchasePriceCurrency`, `purchasePrice`, `addedAt`, and `sourceRowNumber`.
- Use `finish` rather than `foil` as the domain field name.
- Normalize imported values to Scryfall-aligned values where practical, including `normal` to `nonfoil` for finish.
- Constrain `finish` values to Scryfall finish values supported in the first slice: `nonfoil`, `foil`, and `etched`.
- Store `condition` as source text for now rather than a closed enum. ManaBox condition values are not documented
  authoritatively enough for this slice.
- Do not store `language` on `CollectionCard`; infer it from the resolved `CardPrinting.language` and validate ManaBox
  row language against that printing.
- Treat ManaBox row language disagreement with the resolved `CardPrinting.language` as a blocking import error.
- Do not store ManaBox `Set code` or `Collector number` on `CollectionCard`; infer them from the resolved `CardPrinting`
  and validate ManaBox row values against that printing.
- Treat ManaBox row set code or collector number disagreement with the resolved `CardPrinting` as a blocking import
  error.
- Do not store ManaBox `Name` on `CollectionCard`. If the ManaBox row name differs from local Scryfall reference names
  while exact-printing identifiers match, import should succeed with a warning.
- Require `quantity` to be a positive integer. Zero, negative, missing, or non-integer quantity is a blocking import
  error.
- Store `misprint` and `altered` as booleans. Accept only ManaBox `true` and `false`; unknown values are blocking import
  errors.
- Store `addedAt` as nullable source metadata. Blank `Added` imports as null; valid timestamps are parsed; malformed
  `Added` values produce row warnings and store null.
- Use all-or-nothing snapshot semantics. Blocking row errors fail the entire import and preserve the previous Collection
  snapshot. Row warnings are recorded but never cause rows to be skipped.
- Require CSV headers needed for import and validation: `Binder Name`, `Binder Type`, `Name`, `Set code`,
  `Collector number`, `Foil`, `Quantity`, `ManaBox ID`, `Scryfall ID`, `Purchase price`, `Misprint`, `Altered`,
  `Condition`, `Language`, `Purchase price currency`, and `Added`.
- Do not require `Set name` or `Rarity` because they are not stored or validated in this slice.
- Allow extra CSV columns and ignore them with a warning.
- Require non-blank `Binder Name`; blank location names are blocking row errors.
- Accept only `binder` and `deck` for ManaBox `Binder Type`. Unknown types are blocking row errors.
- Use `csv-parse` for CSV parsing. It is the best fit among `csv-parse`, `fast-csv`, `papaparse`, and `d3-dsv` because
  it is backend/ETL-oriented, TypeScript-ready, supports streaming and sync APIs, and has a small dependency footprint.
- Add a source-neutral CLI command with a required source argument:
  `bun run import:collection -- manabox /path/to/collection.csv`. ManaBox is the only accepted source for this slice.
- Support `--db` like `import:scryfall`:
  `bun run import:collection -- --db ./tmp/test.sqlite manabox /path/to/collection.csv`. Default database path remains
  `.data/tomekin.sqlite`.
- Print a compact successful Import Summary to stdout: source path, imported row count, total quantity, location count
  with binder/deck split, and warning count.
- Print row warnings and row errors to stderr.
- Keep ManaBox parsing, normalization, row validation, snapshot construction, warning/error decisions, and summary
  construction in `@tomekin/core`.
- Keep card-printing lookups, finish validation data access, transactional Collection snapshot replacement, and
  `CollectionImport` persistence in `@tomekin/sqlite`.
- Keep `@tomekin/cli` as file-reading, service-wiring, and output glue.
- Require successful local `oracle_cards` and `all_cards` imports before Collection import. Do not require `oracle_tags`
  for raw Collection import.
- Record failed `CollectionImport` attempts once the import service receives readable source data, including
  missing-prerequisite failures. If the CLI cannot read the file, return a CLI error without creating an import record.
- Use small package-local ManaBox CSV fixtures for default tests. Do not commit the full real export. A small
  user-provided real-export slice may be used as a fixture if it is safe and intentionally added.
- Before pushing the implementation, manually smoke test the real export with
  `bun run import:collection -- manabox /Users/osmall/Downloads/ManaBox_Collection.csv` after migrations and required
  Scryfall reference imports are present. This smoke test is required but should be run manually, not as part of default
  tests.
- End this implementation slice at importing and storing the Collection snapshot through the CLI. Do not update agent
  tools, deck-building behavior, Availability reasoning, or Collection Pull Lists in this slice.
- Do not add a separate Collection query/list CLI command in this slice.
- Store `purchasePrice` as nullable SQLite `REAL` metadata in the source currency. Do not convert currency during
  import.
- Preserve `purchasePriceCurrency` from ManaBox even when `purchasePrice` is blank.
- Treat malformed or negative `purchasePrice` as a row warning and store `purchasePrice = null`, while preserving
  `purchasePriceCurrency` when present.
- Normalize `purchasePriceCurrency` by trimming and uppercasing source text. Blank currency imports as null. Do not
  validate against a fixed currency-code list in this slice.
- Create one `CollectionLocation` per unique `(Binder Type, Binder Name)` pair in a successful import.
- Store only `id`, `name`, and `type` on `CollectionLocation` for the first slice.
- Normalize ManaBox `Binder Type` values to `CollectionLocation.type`: `binder` remains `binder`; `deck` remains `deck`.
- Store `sourceRowNumber` on `CollectionCard` for import diagnostics and CSV traceability without storing raw row JSON.
- Give every `CollectionCard` its own internal UUIDv7 `id`; do not use source row fields as record identity.
- Do not store `collectionImportId` on `CollectionCard` or `CollectionLocation`. Like Scryfall-backed reference imports,
  ManaBox Collection import keeps import attempt history separately and fully replaces the current Collection snapshot
  on successful import.
- On successful import, delete and recreate all current `CollectionLocation` and `CollectionCard` rows.
  `CollectionLocation.id` is not stable across imports in this slice.
- Enforce unique `(type, name)` for `CollectionLocation` in the current snapshot.
- Treat `manaBoxId` as nullable source metadata. A row with a valid resolvable `Scryfall ID` but blank `ManaBox ID`
  should import with a warning rather than fail.
- Treat missing or locally unresolvable `Scryfall ID` as a blocking import error. Record a failed `CollectionImport`
  with row-specific diagnostics and leave the previous successful Collection snapshot unchanged.
- Promote Card Printing finishes from `card_printing.finishesJson` to a relational `card_printing_finish` table with
  primary key `(cardPrintingId, finish)`.
- Remove `card_printing.finishes_json`; `card_printing_finish` is the only persisted source for Card Printing finishes
  after this migration.
- Do not backfill `card_printing_finish` from existing `finishes_json`; after migration, re-run the Scryfall `all_cards`
  import to populate printing finishes.
- Validate imported `CollectionCard.finish` against the resolved Card Printing's available finishes.

## Done Bar

- `bun test` passes.
- SQLite migration is generated with `bun run db:sqlite:migration:generate`; migration files are not handwritten.
- Scryfall `all_cards` import writes `card_printing_finish` rows.
- ManaBox Collection import succeeds in tests with valid fixture data.
- ManaBox Collection import records failed attempts and preserves the previous Collection snapshot on blocking errors.
- CLI supports `bun run import:collection -- manabox <csv>` and `--db`.
- `README.md` documents the Collection import command, required Scryfall reference imports, and manual real-export
  smoke-test guidance.
- Before push, the real export smoke test is run manually with `/Users/osmall/Downloads/ManaBox_Collection.csv`.

## Implementation Sequence

1. Add `csv-parse` dependency to the package that owns ManaBox CSV parsing.
2. Update SQLite schema for `card_printing_finish`, remove `card_printing.finishes_json`, add `collection_location`, and
   add `collection_card`.
3. Generate the SQLite migration with `bun run db:sqlite:migration:generate` from the workspace root.
4. Update Scryfall `all_cards` import persistence to write `card_printing_finish` rows.
5. Add core ManaBox CSV parsing, normalization, row validation, snapshot construction, warning/error classification, and
   summary construction.
6. Add SQLite Collection repository methods for card-printing resolution, reference-data prerequisite checks, failed
   import recording, and transactional Collection snapshot replacement.
7. Add `import:collection` CLI command and package script with `--db` support.
8. Add core service tests, SQLite integration tests, and CLI tests using small package-local fixtures.
9. Update `README.md` with the Collection import command, prerequisites, and manual smoke-test guidance.
10. Before push, manually smoke test the real export with
    `bun run import:collection -- manabox /Users/osmall/Downloads/ManaBox_Collection.csv` after migrations and required
    Scryfall reference imports are present.
