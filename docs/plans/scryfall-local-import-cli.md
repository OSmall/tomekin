# Scryfall Local Import CLI Slice

This plan is preliminary and intended to be grilled against the docs before implementation.

In this project, a slice means a small implementation increment that can be tested and used end-to-end without requiring the whole product to exist. A good slice should leave the system in a more useful state, have a clear done bar, and avoid pulling in deferred scope just because it is nearby.

## Goal

Add a user-facing local command that imports Scryfall bulk data files into the configured SQLite database.

The command should prove that the repository-level Scryfall import foundation can be exercised outside tests before an opencode or MCP adapter is attached.

## Scope

Implement the minimum useful local CLI or Bun script for:

- Reading local raw Scryfall `oracle_cards` and `all_cards` JSON files.
- Mapping raw Scryfall card objects into `CardIdentity` and `CardPrinting` records.
- Importing `oracle_cards` before `all_cards` by default.
- Using the configured SQLite database path, defaulting to `.data/mtg-agent.sqlite` and respecting `MTG_AGENT_DB_PATH`.
- Initialising the local SQLite schema when needed.
- Reporting imported record counts, failed import diagnostics, and the target database path.
- Exiting non-zero when a required file is missing, JSON is invalid, Scryfall records do not validate, or `all_cards` references missing Card Identities.

Do not implement live Scryfall downloads in this slice.

Do not implement the opencode adapter or MCP interface in this slice.

Do not implement ManaBox Collection import in this slice.

Do not import `oracle_tags` in this slice unless the CLI boundary makes it trivial and tests stay focused.

Do not add background sync, automatic refresh, or hidden network calls.

## Proposed Command Shape

Prefer a workspace script that can be run through Bun first, for example:

```sh
bun run sync:scryfall -- --oracle-cards ./data/oracle-cards.json --all-cards ./data/all-cards.json
```

The exact script name and package location are open for review. The command should be boring and local-first. It should not require opencode to run.

Required options for the first version:

- `--oracle-cards <path>`: path to a local Scryfall `oracle_cards` JSON file.
- `--all-cards <path>`: path to a local Scryfall `all_cards` JSON file.

Optional options if they remain simple:

- `--db <path>`: override `MTG_AGENT_DB_PATH` for one command invocation.
- `--only oracle_cards|all_cards`: import one dataset for repair or debugging, while preserving dependency checks.

If `--only` adds branching or weakens dependency checks, defer it.

## Input Expectations

The command should read local JSON arrays of Scryfall card objects, not the project's normalised `CardIdentity` or `CardPrinting` shapes.

The first implementation may load the full JSON file into memory if that keeps the slice small, but this should be called out in command output or docs as a temporary limitation. The Scryfall `all_cards` file is large, so streaming import may become necessary after this smoke path is proven.

The default test suite should continue to use small package-local fixtures. Tests must not require real Scryfall bulk files and must not call live Scryfall services.

## Test First

Use `bun test` and follow the testing guidance in [`testing.md`](../testing.md).

### CLI Tests

Create tests that prove command-observable behaviour against temporary on-disk SQLite databases:

- A command with valid small raw `oracle_cards` and `all_cards` fixtures exits successfully and reports imported record counts.
- The command writes Card Identities and Card Printings into the configured SQLite database.
- The command imports `oracle_cards` before `all_cards` when both paths are provided.
- A missing input file exits non-zero and reports the missing path clearly.
- Invalid JSON exits non-zero without replacing the previous usable dataset.
- An `all_cards` file containing a missing `oracle_id` exits non-zero and preserves the previous usable Card Printing dataset.
- The command respects `MTG_AGENT_DB_PATH` or `--db` and never writes to `.data/mtg-agent.sqlite` during tests.

### Core Or Adapter Tests

Keep parsing and mapping tests in `@mtg-agent/core` if the behaviour is source-format validation or Scryfall object mapping.

Keep process execution, argument parsing, filesystem, and exit-code tests outside core. Those are adapter concerns.

## Implementation Steps

1. Decide the script location, likely a small local CLI entrypoint under `packages/opencode` or a new scripts-oriented package only if there is a concrete need.
2. Add argument parsing without introducing a CLI framework unless manual parsing becomes awkward.
3. Resolve the database path from `--db`, then `MTG_AGENT_DB_PATH`, then `.data/mtg-agent.sqlite`.
4. Ensure the database parent directory exists for the configured path.
5. Open SQLite and initialise the schema.
6. Read and validate the raw `oracle_cards` fixture or file with raw Scryfall schemas.
7. Map and import Card Identities through the SQLite Scryfall repository.
8. Read and validate the raw `all_cards` fixture or file with raw Scryfall schemas.
9. Map and import Card Printings through the SQLite Scryfall repository.
10. Render a concise success or failure summary suitable for a human and later adapter wrapping.
11. Run `mise exec -- bun run typecheck` and `mise exec -- bun test`.

## Output Expectations

On success, output should include:

- Target database path.
- Imported `oracle_cards` count.
- Imported `all_cards` count.
- Source file paths.
- A clear statement that no live Scryfall network call was made.

On failure, output should include:

- Which dataset failed.
- Whether the previous usable dataset was preserved.
- Blocking validation or repository errors.
- The target database path.

Exact wording does not need to be locked unless an Exact Output Test is added intentionally.

## Done Bar

This slice is done when:

- A local command can import small raw Scryfall `oracle_cards` and `all_cards` fixture files into a temporary SQLite database.
- The same command can be pointed at a configured local database path.
- Successful imports create `ScryfallBulkDataImport`, `CardIdentity`, and `CardPrinting` records.
- Failed imports exit non-zero and preserve the previous usable dataset.
- The command makes no live network calls.
- Tests do not depend on real Scryfall bulk files.
- `mise exec -- bun run typecheck` passes.
- `mise exec -- bun test` passes.

## Open Questions For Grill

- Should this command live in `packages/opencode`, or should the workspace have a separate local CLI package?
- Should the first command accept only both required datasets, or should it support `--only` immediately?
- Is loading the full `all_cards` JSON into memory acceptable as a smoke path, or should this slice start with streaming JSON parsing?
- Should command output be treated as an Exact Output Test contract now, or kept flexible until the opencode/MCP adapter shape is clearer?
- Should schema initialisation stay as a code helper for now, or should migrations be introduced before importing real local files?

## Follow-Up Slice

After this slice, attach the local import capability to the first opencode-facing adapter or begin ManaBox Collection import against local Scryfall-backed card reference data.
