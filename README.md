# MTG Collection Deck Builder

This project provides an AI agent with expertise in Magic: The Gathering and specialises in parsing the user's card collection to assist with building cohesive and strategically viable decks.

The project is a collection-first deck builder. The MVP emphasises Commander/EDH while preserving a path to other formats.

## Documentation

- [`CONTEXT.md`](./CONTEXT.md): canonical glossary and domain language.
- [`docs/product-scope.md`](./docs/product-scope.md): product promise, scope boundaries, format direction, and non-goals.
- [`docs/mvp.md`](./docs/mvp.md): MVP workflow, deck-building behaviour, capability boundaries, and output expectations.
- [`docs/architecture.md`](./docs/architecture.md): current architecture direction, portability philosophy, and unresolved technology decisions.
- [`docs/data-model.md`](./docs/data-model.md): persisted records and relationships for the MVP data model.
- [`docs/testing.md`](./docs/testing.md): testing posture, TDD expectations, test layers, fixture guidance, and LLM test boundary.
- [`docs/design-branches.md`](./docs/design-branches.md): unresolved design branches to resume later.
- [`docs/future-direction.md`](./docs/future-direction.md): deferred scope and likely future product directions.
- [`docs/adr/`](./docs/adr/): hard-to-reverse architecture and technology decisions.

## Quickstart

Install tool and package dependencies, then prepare the local SQLite database before importing Scryfall reference data:

```sh
mise install
bun install
bun run db:sqlite:migration:apply
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.jsonl.gz
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.jsonl.gz
bun run import:scryfall -- oracle_tags /path/to/local/file/oracle-tags.jsonl.gz
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
```

Run `bun run db:sqlite:migration:apply` before normal app commands. It creates the parent directory for the configured
SQLite database path and applies migrations from `packages/sqlite/drizzle/`.

## Local Logging

Logs use `NODE_ENV` profile defaults. Development is the default profile and writes human-readable debug logs to
`.data/mtg-agent.log`; production writes JSON info logs to `stdout`; tests write human-readable info logs to `stderr`.

Override the destination, file, level, format, or enabled flag with environment variables:

```sh
NODE_ENV=production bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
MTG_AGENT_LOG_DESTINATION=stdout MTG_AGENT_LOG_LEVEL=info bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
MTG_AGENT_LOG_FORMAT=json MTG_AGENT_LOG_FILE=.data/mtg-agent.jsonl opencode
```

`NODE_ENV=production` selects production defaults, `NODE_ENV=test` selects test defaults, and any other value selects
development defaults. Supported logging overrides are `MTG_AGENT_LOG_ENABLED=true|false`,
`MTG_AGENT_LOG_DESTINATION=file|stdout|stderr`, `MTG_AGENT_LOG_LEVEL=trace|debug|info|warn|error`, and
`MTG_AGENT_LOG_FORMAT=pretty|json`. `MTG_AGENT_LOG_FILE` is used when the destination is `file`.

## Local Scryfall Import

Import local Scryfall bulk data files into SQLite. The importer accepts current Scryfall `jsonl.gz` bulk files and
legacy
top-level JSON-array `.json` files:

```sh
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.jsonl.gz
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.jsonl.gz
bun run import:scryfall -- oracle_tags /path/to/local/file/oracle-tags.jsonl.gz
```

Run `oracle_cards` before `oracle_tags` or `all_cards`. The command only reads local files, reports timestamped source-read progress while it runs, and does not download from Scryfall.

The import command does not create or migrate the database. Apply SQLite migrations first with
`bun run db:sqlite:migration:apply`.

By default, imports write to `.data/mtg-agent.sqlite`. Override the database for one run with `--db`:

```sh
bun run import:scryfall -- --db ./tmp/test.sqlite oracle_cards ./data/oracle-cards.jsonl.gz
```

When using a non-default database path, set `MTG_AGENT_DB_PATH` for the migration command or apply migrations to the
same path before importing:

```sh
MTG_AGENT_DB_PATH=./tmp/test.sqlite bun run db:sqlite:migration:apply
bun run import:scryfall -- --db ./tmp/test.sqlite oracle_cards ./data/oracle-cards.jsonl.gz
```

Add `--timing` to print diagnostic import timing, record counters, finalization timings, and lightweight JavaScript heap snapshots for large-file smoke testing:

```sh
bun run import:scryfall -- --timing all_cards ./data/all-cards.jsonl.gz
```

## ManaBox Collection Import

Import a ManaBox Collection CSV into the current SQLite Collection snapshot:

```sh
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
```

Collection import requires successful local `oracle_cards` and `all_cards` Scryfall imports first. `oracle_tags` is not
required for raw Collection import.

The command replaces the current `CollectionLocation` and `CollectionCard` snapshot only after all rows pass blocking
validation. Failed attempts are recorded once the CSV file is readable, and the previous successful Collection snapshot
is preserved. Row warnings are printed to stderr but do not skip rows.

Override the database for one run with `--db`:

```sh
bun run import:collection -- --db ./tmp/test.sqlite manabox ./data/ManaBox_Collection.csv
```

Before pushing changes to this importer, smoke test the current real export manually after migrations and required
Scryfall imports are present:

```sh
bun run import:collection -- manabox /Users/osmall/Downloads/ManaBox_Collection.csv
```

## Local Opencode Deck Builder

The project includes a local primary opencode agent at `.opencode/agents/mtg-deck-builder.md`. It uses project-local custom tools from `.opencode/tools/mtg-agent.ts` and does not make live Scryfall calls.

Before using it, apply migrations and import all three local Scryfall reference datasets:

```sh
bun run db:sqlite:migration:apply
bun run import:scryfall -- oracle_cards /path/to/oracle-cards.jsonl.gz
bun run import:scryfall -- all_cards /path/to/all-cards.jsonl.gz
bun run import:scryfall -- oracle_tags /path/to/oracle-tags.jsonl.gz
```

The first deck-building slice is Commander/EDH only. Saved Deck Candidates are persisted in SQLite with `DeckCandidate`
and `DeckCandidateCard` rows; Collection-aware availability reasoning remains deferred.

## Current Status

This repository is implementing local opencode slices over a portable TypeScript core and SQLite persistence.
Collection-aware deck-building behavior, hosted UI, and deployment decisions remain deferred until requirements are
clearer.
