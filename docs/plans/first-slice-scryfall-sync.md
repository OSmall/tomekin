# First Slice: Scryfall Sync Foundation

This plan defines the first TDD implementation slice after the workspace and testing posture have been established.

## Goal

Build the local Scryfall data foundation needed before ManaBox Collection import can reliably resolve card identity.

The slice should prove that the system can persist and replace local Scryfall-backed card data safely, without using live network calls or real Scryfall bulk files in the default test suite.

## Scope

Implement the minimum useful Scryfall sync path for:

- Recording successful and failed `ScryfallBulkDataImport` attempts.
- Importing minimal `OracleCard` records from local `oracle_cards` fixture data.
- Importing minimal `ScryfallCard` records from local `all_cards` fixture data.
- Enforcing that `all_cards` records reference existing `OracleCard` records.
- Preserving the last usable dataset when an import fails.
- Reporting clearly when required Scryfall datasets are missing.

Do not implement live Scryfall downloads in this slice.

Do not import real Scryfall bulk files in this slice.

Do not implement ManaBox Collection import in this slice.

Do not implement Oracle Tags in this slice unless the first tests require a placeholder boundary.

## Test First

Use `bun test` and follow the testing guidance in [`testing.md`](./testing.md).

Tests should use small package-local fixtures under `packages/*/test/fixtures/`.

SQLite integration tests should use isolated temporary on-disk database files, never `.data/mtg-agent.sqlite`.

### First SQLite Integration Tests

Create tests in `packages/sqlite/test/` that prove repository-observable behaviour:

- A successful `oracle_cards` import records a succeeded `ScryfallBulkDataImport` and makes imported Oracle cards available through the repository.
- A failed `oracle_cards` import records a failed `ScryfallBulkDataImport` and preserves the previous usable Oracle card dataset.
- A successful `all_cards` import records a succeeded `ScryfallBulkDataImport` and makes imported Scryfall cards available through the repository.
- An `all_cards` import fails when a card references a missing Oracle ID.
- A failed `all_cards` import preserves the previous usable Scryfall card dataset.
- Required-dataset checks report missing `oracle_cards` and `all_cards` clearly.

### First Core Service Tests

Create tests in `packages/core/test/` that prove service-level behaviour:

- The Scryfall sync service validates requested bulk data types.
- The service returns structured failures for missing required datasets when an operation requires card identity.
- The service does not expose SQLite or Drizzle details through core types.

## Minimal Data Shape

Start with only fields needed by the next ManaBox import slice.

`OracleCard` should include enough data for canonical card identity and later deck-building checks:

- Scryfall oracle ID.
- Name.
- Mana cost when available.
- Type line.
- Oracle text when available.
- Colour identity.
- Legalities needed for Commander/EDH checks when available.

`ScryfallCard` should include enough data to resolve exact Collection printings:

- Scryfall card ID.
- Oracle ID.
- Name.
- Set code.
- Collector number.
- Finish-related data when available.
- Language when available.

Keep fixture payloads smaller than real Scryfall records. Include only fields consumed by the code under test.

## Implementation Steps

1. Add Scryfall repository interfaces to `@mtg-agent/core`.
2. Add domain-facing Scryfall record types and Zod schemas to `@mtg-agent/core`.
3. Add Drizzle tables for `oracle_cards` and `scryfall_cards` in `@mtg-agent/sqlite`.
4. Add SQLite repository implementation for Scryfall imports.
5. Add transactional full-replacement behaviour per dataset.
6. Add minimal fixture readers inside tests or test helpers, not production code.
7. Wire the core Scryfall sync service to the repository port.
8. Keep `syncScryfallData` free of live network behaviour for this slice.
9. Run `mise exec -- bun run typecheck` and `mise exec -- bun test`.

## Done Bar

This slice is done when:

- Scryfall repository integration tests pass against temporary on-disk SQLite databases.
- Core service tests pass without live network calls.
- `oracle_cards` imports before `all_cards` is enforced.
- Failed imports preserve the last usable dataset.
- Missing required datasets are reported clearly.
- No test depends on real Scryfall bulk files.
- `mise exec -- bun run typecheck` passes.
- `mise exec -- bun test` passes.

## Follow-Up Slice

After this slice, start ManaBox Collection import:

- Parse small ManaBox CSV fixtures.
- Resolve rows against local Scryfall data.
- Skip ManaBox Lists visibly.
- Fail fast on identity, quantity, or usable-location issues.
- Transactionally replace the current Collection snapshot only after full validation.
