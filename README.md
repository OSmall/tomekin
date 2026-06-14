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
- [`docs/plans/`](./docs/plans/): implementation plans for upcoming coding slices.
- [`docs/design-branches.md`](./docs/design-branches.md): unresolved design branches to resume later.
- [`docs/future-direction.md`](./docs/future-direction.md): deferred scope and likely future product directions.
- [`docs/adr/`](./docs/adr/): hard-to-reverse architecture and technology decisions.

## Local Scryfall Import

Import local Scryfall bulk data JSON files into SQLite:

```sh
bun run import:scryfall -- oracle_cards /path/to/local/file/oracle-cards.json
bun run import:scryfall -- all_cards /path/to/local/file/all-cards.json
```

Run `oracle_cards` before `all_cards`. The command only reads local files, reports source-read progress while it runs, and does not download from Scryfall.

By default, imports write to `.data/mtg-agent.sqlite`. Override the database for one run with `--db`:

```sh
bun run import:scryfall -- --db ./tmp/test.sqlite oracle_cards ./data/oracle-cards.json
```

## Current Status

This repository is in product definition. The first architecture direction is to deliver the MVP as local opencode tooling over a portable TypeScript core running on Bun. Further storage, user interface, and deployment decisions remain deferred until requirements are clearer.
