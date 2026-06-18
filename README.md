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
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.json
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.json
bun run import:scryfall -- oracle_tags /path/to/local/file/oracle-tags.json
```

Run `bun run db:sqlite:migration:apply` before normal app commands. It creates the parent directory for the configured
SQLite database path and applies migrations from `packages/sqlite/drizzle/`.

## Local Scryfall Import

Import local Scryfall bulk data JSON files into SQLite:

```sh
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.json
bun run import:scryfall -- oracle_tags /path/to/local/file/oracle-tags.json
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.json
```

Run `oracle_cards` before `oracle_tags` or `all_cards`. The command only reads local files, reports timestamped source-read progress while it runs, and does not download from Scryfall.

The import command does not create or migrate the database. Apply SQLite migrations first with
`bun run db:sqlite:migration:apply`.

By default, imports write to `.data/mtg-agent.sqlite`. Override the database for one run with `--db`:

```sh
bun run import:scryfall -- --db ./tmp/test.sqlite oracle_cards ./data/oracle-cards.json
```

When using a non-default database path, set `MTG_AGENT_DB_PATH` for the migration command or apply migrations to the
same path before importing:

```sh
MTG_AGENT_DB_PATH=./tmp/test.sqlite bun run db:sqlite:migration:apply
bun run import:scryfall -- --db ./tmp/test.sqlite oracle_cards ./data/oracle-cards.json
```

Add `--timing` to print diagnostic import timing, record counters, finalization timings, and lightweight JavaScript heap snapshots for large-file smoke testing:

```sh
bun run import:scryfall -- --timing all_cards ./data/all-cards.json
```

## Local Opencode Deck Builder

The project includes a local primary opencode agent at `.opencode/agents/mtg-deck-builder.md`. It uses project-local custom tools from `.opencode/tools/mtg-agent.ts` and does not make live Scryfall calls.

Before using it, apply migrations and import all three local Scryfall reference datasets:

```sh
bun run db:sqlite:migration:apply
bun run import:scryfall -- oracle_cards /path/to/oracle-cards.json
bun run import:scryfall -- all_cards /path/to/all-cards.json
bun run import:scryfall -- oracle_tags /path/to/oracle-tags.json
```

The first slice is Commander/EDH only and treats the Collection as empty. Saved Deck Candidates are persisted in SQLite with `DeckCandidate` and `DeckCandidateCard` rows; every candidate card is reported as a Missing Card until Collection import exists.

## Current Status

This repository is implementing the first local opencode slice over a portable TypeScript core and SQLite persistence. Further collection import, hosted UI, and deployment decisions remain deferred until requirements are clearer.
