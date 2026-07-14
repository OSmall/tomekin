# Tomekin

Local, collection-first Commander deck-building through opencode.

This alpha helps you turn a ManaBox Collection export plus local Scryfall reference data into validated Commander Deck
Candidates. It runs on your machine, stores data in local SQLite, and exposes deck-building actions through a project-local
opencode agent and custom tools.

## Alpha Status

This is a public alpha. The distribution model is intentionally clone-based: clone the repo,
install dependencies, sync Scryfall data, import your collection, open opencode, and use the local deck-building agent.

The project is not packaged for npm, does not include an installer, and does not provide hosted sync or hosted deck-building
services yet.

## Prerequisites

- Bun, installed directly or through `mise install`.
- opencode for the local agent workflow.
- Local disk space for Scryfall bulk data and the SQLite database under `.data/`.
- A ManaBox Collection CSV export for Collection-aware deck-building.

## Quickstart

Clone the repository, install dependencies, prepare SQLite, sync Scryfall reference data, import your ManaBox Collection,
then open opencode from the repository root.

```sh
git clone <repository-url>
cd tomekin
mise install
bun install
bun run db:sqlite:migration:apply
bun run sync:scryfall
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
opencode
```

In opencode, select or invoke the local deck-building agent from `.opencode/agents/tomekin-deck-builder.md` and ask for a
Commander deck. The agent uses project-local tools and does not make hidden live Scryfall calls during normal deck-building.

Run `bun run db:sqlite:migration:apply` before normal app commands. It creates the parent directory for the configured
SQLite database path and applies migrations from `packages/sqlite/drizzle/`.

By default, commands use `.data/tomekin.sqlite`. Override the database path with `TOMEKIN_DB_PATH` or command-specific
`--db` flags where supported.

## Scryfall Sync

Use the default setup command to download and import the required reference datasets in order: `oracle_cards`, `all_cards`,
then `oracle_tags`.

```sh
bun run sync:scryfall
```

This command explicitly makes live Scryfall Bulk Data API requests. It fetches bulk metadata, downloads the selected bulk
files, imports them into SQLite, and keeps failed imports non-destructive so the previous usable dataset is preserved.

Override the database for one sync run with `--db`:

```sh
bun run sync:scryfall -- --db ./tmp/test.sqlite
```

## ManaBox Collection Import

Import a ManaBox Collection CSV into the current SQLite Collection snapshot:

```sh
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
```

Collection import requires successful `oracle_cards` and `all_cards` Scryfall imports first. `oracle_tags` is not required
for raw Collection import, but it is part of the default deck-building setup.

The command replaces the current Collection snapshot only after all rows pass blocking validation. Failed attempts are
recorded once the CSV file is readable, and the previous successful Collection snapshot is preserved.

Override the database for one import run with `--db`:

```sh
bun run import:collection -- --db ./tmp/test.sqlite manabox ./data/ManaBox_Collection.csv
```

## Local Scryfall File Import

The live sync command is the intended alpha setup path. The local-file importer remains available for repair, debugging,
fixture-backed workflows, and users who manually download Scryfall bulk files.

The importer accepts current Scryfall `jsonl.gz` bulk files and legacy top-level JSON-array `.json` files:

```sh
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.jsonl.gz
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.jsonl.gz
bun run import:scryfall -- oracle_tags /path/to/local/file/oracle-tags.jsonl.gz
```

Run `oracle_cards` before `all_cards` or `oracle_tags`. The local-file command only reads local files and does not download
from Scryfall.

Add `--timing` to print diagnostic import timing, record counters, finalization timings, and lightweight JavaScript heap
snapshots for large-file smoke testing:

```sh
bun run import:scryfall -- --timing all_cards ./data/all-cards.jsonl.gz
```

## Local Logging

Logs use `NODE_ENV` profile defaults. Development is the default profile and writes human-readable debug logs to
`.data/tomekin.log`; production writes JSON info logs to `stdout`; tests write human-readable info logs to `stderr`.

Supported logging overrides are:

- `TOMEKIN_LOG_ENABLED=true|false`
- `TOMEKIN_LOG_DESTINATION=file|stdout|stderr`
- `TOMEKIN_LOG_FILE=.data/tomekin.log`
- `TOMEKIN_LOG_LEVEL=trace|debug|info|warn|error`
- `TOMEKIN_LOG_FORMAT=pretty|json`

Examples:

```sh
NODE_ENV=production bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
TOMEKIN_LOG_DESTINATION=stdout TOMEKIN_LOG_LEVEL=info bun run sync:scryfall
TOMEKIN_LOG_FORMAT=json TOMEKIN_LOG_FILE=.data/tomekin.jsonl opencode
```

## Current Features

- Local SQLite persistence for Scryfall reference data, Collection snapshots, and saved Deck Candidates.
- Explicit Scryfall bulk sync for `oracle_cards`, `all_cards`, and `oracle_tags`.
- ManaBox Collection CSV import with blocking validation and non-destructive failed imports.
- Commander/EDH-focused opencode deck-building agent with deterministic local tools.
- Card search, card identity lookup, Oracle Tag lookup, Commander legality validation, deck rendering, and Deck Candidate
  persistence tools.
- Structured local logging for CLI commands, SQLite queries, imports, sync, and opencode tool calls.

## Known Limitations

- Commander/EDH is the only supported deck-building format in the current agent workflow.
- Collection-aware deck-building depends on an imported ManaBox CSV snapshot; there is no collection write-back.
- Normal deck-building is local/offline and will not fetch missing Scryfall data automatically.
- No npm package, installer, hosted UI, or plugin marketplace packaging is provided in this alpha.
- Prices, exhaustive combo detection, and live LLM evaluation are out of scope for the default local tools.

## Development Commands

```sh
bun install
bun run db:sqlite:migration:apply
bun run sync:scryfall
bun run import:scryfall -- oracle_cards /path/to/oracle-cards.jsonl.gz
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
bun run test
bun run typecheck
```

## Documentation

- [`CONTEXT.md`](./CONTEXT.md): canonical glossary and domain language.
- [`docs/product-scope.md`](./docs/product-scope.md): product promise, scope boundaries, format direction, and non-goals.
- [`docs/mvp.md`](./docs/mvp.md): MVP workflow, deck-building behaviour, capability boundaries, and output expectations.
- [`docs/architecture.md`](./docs/architecture.md): architecture direction, portability philosophy, and unresolved technology decisions.
- [`docs/data-model.md`](./docs/data-model.md): persisted records and relationships for the MVP data model.
- [`docs/testing.md`](./docs/testing.md): testing posture, TDD expectations, test layers, fixture guidance, and LLM test boundary.
- [`docs/future-direction.md`](./docs/future-direction.md): deferred scope and likely future product directions.
- [`docs/adr/`](./docs/adr/): hard-to-reverse architecture and technology decisions.

## Future Direction

Likely post-alpha work includes friendlier setup checks, packaging around stable commands, broader Collection-aware deck
building behaviour, richer candidate review, and eventually additional interfaces over the same portable core. Hosted
deployment and npm packaging remain future possibilities, not alpha promises.
