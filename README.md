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

## Documentation Ownership

- Update `CONTEXT.md` only for glossary and domain language changes.
- Update `docs/product-scope.md` for product promise, principles, and current boundaries.
- Update `docs/mvp.md` for current MVP behaviour and requirements.
- Update `docs/future-direction.md` for deferred scope and later possibilities.
- Update `docs/testing.md` for testing posture, test layers, fixture guidance, and LLM test boundaries.
- Add implementation plans under `docs/plans/` when a coding slice is defined but not yet complete.
- Add ADRs under `docs/adr/` only for hard-to-reverse, surprising trade-off decisions.

## Current Status

This repository is in product definition. The first architecture direction is to deliver the MVP as local opencode tooling over a portable TypeScript core running on Bun. Further storage, user interface, and deployment decisions remain deferred until requirements are clearer.
