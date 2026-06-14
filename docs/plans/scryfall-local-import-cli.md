# Scryfall Local Import CLI Slice

This plan is preliminary and intended to be grilled against the docs before implementation.

In this project, a slice means a small implementation increment that can be tested and used end-to-end without requiring the whole product to exist. A good slice should leave the system in a more useful state, have a clear done bar, and avoid pulling in deferred scope just because it is nearby.

## Goal

Add a user-facing local command that imports Scryfall bulk data files into the configured SQLite database.

The command should prove that the repository-level Scryfall import foundation can be exercised outside tests before an opencode or MCP adapter is attached.

## Scope

Implement the minimum useful local CLI or Bun script for one explicitly selected Scryfall Bulk Data Import per invocation:

- Reading one local raw Scryfall `oracle_cards` or `all_cards` JSON file.
- Mapping raw Scryfall card objects into the corresponding `CardIdentity` or `CardPrinting` records.
- Importing only the bulk data type named by the command invocation.
- Using the configured SQLite database path, defaulting to `.data/mtg-agent.sqlite` and respecting `MTG_AGENT_DB_PATH`.
- Initialising the local SQLite schema when needed.
- Reporting imported record counts, failed import diagnostics, and the target database path.
- Exiting non-zero when a required file is missing, JSON is invalid, Scryfall records do not validate, or the selected import references missing dependency records.
- Recording source read, parse, source-format validation, and repository constraint failures as failed `ScryfallBulkDataImport` attempts when the source reaches the import pipeline.
- Treating missing local files as CLI source-resolution failures that exit non-zero without creating a `ScryfallBulkDataImport` record.
- Failing an `all_cards` import before reading or replacing Card Printings when there is no latest successful `oracle_cards` Scryfall Bulk Data Import in the target database.
- Failing an `all_cards` import transactionally when any imported Card Printing references a missing Card Identity.
- Exercising a core local Scryfall Bulk Data Import service seam rather than calling SQLite repository replacement methods directly from the CLI.
- Keeping raw Scryfall source-format validation and mapping in `@mtg-agent/core` so future adapters reuse the same import rules.
- Exposing separate core methods for each supported Scryfall Bulk Data Import type, rather than a single method with a bulk-data-type gate.
- Exposing a repository port method for recording failed Scryfall Bulk Data Import attempts so core can persist pre-replacement failures without the CLI writing import records directly.
- Passing file or download content into core through a small source object with `text(): Promise<string>`, so local files and future fetch responses can use the same import path.
- Passing source metadata into core with a required `sourceUri` and `sourceUpdatedAt` when known.
- Keeping CLI command logic in an importable runner function with a thin process entrypoint for Bun script execution.

Do not implement live Scryfall downloads in this slice.

Do not implement the opencode adapter or MCP interface in this slice.

Do not implement ManaBox Collection import in this slice.

Do not import `oracle_tags` or Card Identity Tags in this slice. That requires new repository and schema behaviour and should be handled as a later data-model/repository slice before being exposed through this command.

Do not add background sync, automatic refresh, or hidden network calls.

## Proposed Command Shape

Prefer a workspace script that can be run through Bun first, for example:

```sh
bun run import:scryfall -- oracle_cards ./data/oracle-cards.json
bun run import:scryfall -- all_cards ./data/all-cards.json
```

The command should live in a dedicated `packages/cli` adapter package and be exposed from the root workspace scripts. It should be boring and local-first. It should not require opencode to run. Use import terminology for this local-file-only feature; reserve sync terminology for a future feature that can discover, download, or refresh Scryfall bulk data.

Required options for the first version:

- `<bulk-data-type>`: one explicit Scryfall bulk data type to import.
- `<path>`: path to the local Scryfall bulk data JSON file for that type.

Supported bulk data types for this slice:

- `oracle_cards`
- `all_cards`

Optional options if they remain simple:

- `--db <path>`: override `MTG_AGENT_DB_PATH` for one command invocation.

Do not support implicit default imports or multi-dataset imports in this slice. A user who wants to import multiple Scryfall bulk data files should run the command once per file in dependency order.

## Input Expectations

The command should read local JSON arrays of Scryfall card objects, not the project's normalised reference record shapes.

The importer should load and validate the complete dataset before replacing target records, matching the documented Scryfall Bulk Data Import model. The first implementation should accept source content through a small object with `text(): Promise<string>` and may load the full JSON payload into memory. `Bun.file(path)` and future `fetch()` responses both fit this shape. The Scryfall `all_cards` file is large, so streaming JSON parsing may become necessary after this smoke path is proven, but that should not weaken the full-dataset validation and transactional replacement rule.

The default test suite should continue to use small package-local fixtures. Tests must not require real Scryfall bulk files and must not call live Scryfall services.

## Test First

Use `bun test` and follow the testing guidance in [`testing.md`](../testing.md).

### CLI Tests

Create tests that prove command-observable behaviour against temporary on-disk SQLite databases:

- A command with valid small raw `oracle_cards` and `all_cards` fixtures exits successfully and reports imported record counts.
- The command writes Card Identities and Card Printings into the configured SQLite database.
- The command imports exactly the one Scryfall bulk data type requested by the invocation.
- An `all_cards` import fails clearly when the required Card Identity records are missing.
- An `all_cards` import fails clearly when the target database has no latest successful `oracle_cards` Scryfall Bulk Data Import.
- A missing input file exits non-zero and reports the missing path clearly.
- A missing input file does not create a `ScryfallBulkDataImport` record.
- Invalid JSON exits non-zero, records a failed `ScryfallBulkDataImport`, and preserves the previous usable dataset.
- A source object whose `text()` method rejects records a failed `ScryfallBulkDataImport` and preserves the previous usable dataset.
- An `all_cards` file containing a missing `oracle_id` exits non-zero and preserves the previous usable Card Printing dataset.
- The command respects `MTG_AGENT_DB_PATH` or `--db` and never writes to `.data/mtg-agent.sqlite` during tests.

### Core Or Adapter Tests

Keep raw Scryfall source-format validation, mapping, and import dependency tests in `@mtg-agent/core` if the behaviour is source-format validation, Scryfall object mapping, or product-level import rules.

Keep process execution, argument parsing, filesystem, JSON decoding, output rendering, and exit-code tests outside core. Those are adapter concerns.

Most CLI behaviour should be tested through an importable runner function with fake IO and temporary SQLite paths. Add only thin process-level smoke coverage for the actual Bun script wiring and exit code behaviour.

## Implementation Steps

1. Add a dedicated `packages/cli` adapter package for local command-line entrypoints that sit alongside, not inside, the opencode adapter.
2. Add an importable command runner such as `runImportScryfallCommand(args, env, io)` plus a thin process entrypoint that passes `process.argv`, `process.env`, stdout/stderr, and exits.
3. Add manual argument parsing for this first command. Do not introduce a CLI framework unless later command growth creates a concrete need.
4. Resolve the database path from `--db`, then `MTG_AGENT_DB_PATH`, then `.data/mtg-agent.sqlite`.
5. Ensure the database parent directory exists for the configured path.
6. Open SQLite and initialise the schema.
7. Open the selected raw Scryfall file in the CLI boundary and hand the source to the import pipeline with the selected bulk data type and source metadata. The CLI should set `sourceUri` to an absolute `file://` URI resolved with standard path/URL utilities, not by hand-built string concatenation. It should set `sourceUpdatedAt` from the file modified time when cheap, falling back to the command's current time.
8. Add reusable core Scryfall Bulk Data Import service methods, such as `importOracleCards` and `importAllCards`, that accept a source object with `text(): Promise<string>` and can be called by both the manual CLI and a future automated sync path without branching on which caller supplied the source.
9. Decode JSON, validate the raw parsed JSON value, and map it into the matching reference record shape inside the reusable import pipeline.
10. Add a repository port method for recording failed Scryfall Bulk Data Import attempts. Use it from core for source read failures, JSON parse failures, source-format validation failures, and missing prerequisite `oracle_cards` before `all_cards`.
11. Continue letting SQLite replacement methods record failures that occur during actual dataset replacement, such as missing Card Identity references during `all_cards` replacement.
12. Have the core service fail `all_cards` before replacement when there is no latest successful `oracle_cards` Scryfall Bulk Data Import in the target repository.
13. Import the selected reference records through the SQLite Scryfall repository while preserving repository-level dependency checks, including missing Card Identity references during `all_cards` replacement.
14. Render a concise success or failure summary suitable for a human and later adapter wrapping.
15. Run `mise exec -- bun run typecheck` and `mise exec -- bun test`.

## Output Expectations

On success, output should include:

- Target database path.
- Imported bulk data type.
- Imported record count.
- Source file paths.
- A clear statement that no live Scryfall network call was made.

On failure, output should include:

- Which dataset failed.
- Whether the previous usable dataset was preserved.
- Blocking validation or repository errors.
- The target database path.

Exact wording should not be locked in this slice. Tests should assert required fields, exit codes, and preservation statements without treating full output wording as an Exact Output Test contract.

## Done Bar

This slice is done when:

- A local command can import small raw Scryfall `oracle_cards` and `all_cards` fixture files into a temporary SQLite database.
- The same command can be pointed at a configured local database path.
- Successful imports create `ScryfallBulkDataImport`, `CardIdentity`, and `CardPrinting` records.
- Failed imports exit non-zero and preserve the previous usable dataset.
- Each invocation imports exactly one explicitly selected Scryfall bulk data type.
- The command makes no live network calls.
- Tests do not depend on real Scryfall bulk files.
- `mise exec -- bun run typecheck` passes.
- `mise exec -- bun test` passes.

## Open Questions For Grill

- Resolved: create a dedicated `packages/cli` adapter package for local command-line entrypoints.
- Resolved: include only `oracle_cards` and `all_cards`. Defer `oracle_tags` and Card Identity Tags until their repository behaviour exists.
- Resolved: the importer should load and validate the complete dataset before replacing target records. The first implementation should accept a source object with `text(): Promise<string>` and may load the full JSON payload into memory; streaming JSON parsing can be introduced later without weakening full-dataset validation.
- Resolved: use manual argument parsing for this first command; defer CLI framework adoption until there is a concrete need.
- Resolved: add a repository port method for recording failed Scryfall Bulk Data Import attempts so core records pre-replacement failures through the repository rather than through CLI persistence code.
- Resolved: keep using the existing schema initialisation helper for this slice. Add migrations when other users start using the tool or when long-lived local databases need safe schema evolution.
- Resolved: keep command output flexible in this slice. Assert required fields and behaviour, not exact wording.

## Follow-Up Slice

After this slice, attach the local import capability to the first opencode-facing adapter or begin ManaBox Collection import against local Scryfall-backed card reference data.
