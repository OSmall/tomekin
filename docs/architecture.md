# Architecture

The MVP will start as local opencode tooling: tools, agents, and skills used by a local opencode agent. This keeps the first implementation small and allows the user to rely on their existing ChatGPT subscription for LLM access.

The product logic should not be embedded directly in opencode prompts, skills, or tool glue. Collection import, Collection analysis, Availability reasoning, Deck Opportunity discovery, Deck Candidate construction, legality checks, and structured output generation should live in a portable core that can later be reused by a web-based, multi-user hosted product.

## Architectural Shape

- **Portable core**: owns domain and product logic without depending on opencode, local filesystem paths, a chat-only workflow, hosted infrastructure, or UI framework code.
- **Opencode adapter**: exposes the portable core through local tools, agents, and skills for the MVP.
- **Future hosted adapter**: may expose the same portable core through web APIs, background jobs, hosted persistence, authentication, and a richer user interface.

The portable core should expose typed application-service functions. It should not expose MCP-shaped APIs as its primary interface, and it should not require opencode concepts at the service boundary.

Expected business failures at service boundaries should be represented with `neverthrow` Result types. Zod schemas should provide runtime validation for data entering or leaving adapter seams, including opencode tools and future web APIs.

Persistence should be accessed through repository interfaces rather than directly from deck-building logic. The MVP repository implementation should use SQLite for local persistence. Future hosted implementations may replace the local repository adapter without changing the core service contracts.

The SQLite repository implementation should use Drizzle ORM. Drizzle schema, migration, and query code should remain inside the persistence adapter and should not leak into service contracts.

For the local MVP, the default SQLite database path should be `.data/mtg-agent.sqlite`. The path should be configurable with `MTG_AGENT_DB_PATH`. Local database files should not be committed, and migrations should run against the configured database path.

Persisted records and relationships are documented in [`data-model.md`](./data-model.md).

## Technology Baseline

- **Language**: TypeScript.
- **Runtime and package manager**: Bun.
- **Service error handling**: `neverthrow` Result types at application-service seams.
- **Runtime validation**: Zod schemas at adapter and service boundaries.
- **MVP persistence**: SQLite behind repository interfaces.
- **SQLite access layer**: Drizzle ORM.
- **External card data**: explicit local Scryfall sync; no automatic background sync in the MVP.
- **Toolchain installation**: Bun should be installable through mise for local development.
- **Runtime posture**: Bun is a first-class project dependency, not only a convenience wrapper around Node.js workflows.
- **Testing posture**: `bun test` is the default test runner. Testing behaviour and TDD expectations are documented in [`testing.md`](./testing.md).

## Repository Shape

The project should use a small Bun workspace from the start.

Initial package boundaries:

- **Core package**: portable MTG collection and deck-building product logic.
- **SQLite package**: Drizzle schema, migrations, and local repository implementations.
- **CLI package**: local command-line entrypoints that wire the core and SQLite implementation together for manual imports and other local operations.
- **Opencode package**: local opencode tools, agents, skills, and adapter glue that wires the core and SQLite implementation together.

The workspace boundary exists to keep the core reusable by later interfaces. CLI and opencode are sibling adapters over the same core and persistence packages. This should not imply a large monorepo, distributed system, or premature package proliferation.

The MVP should not add Turborepo by default. Bun workspaces are enough for the initial package count, and avoiding Turborepo keeps local tooling simpler. The workspace structure should remain compatible with adding Turborepo later if task orchestration, caching, CI performance, or additional apps make it useful.

## Design Philosophy

- Optimise for a fast local MVP without trapping product logic in local-only automation.
- Keep domain concepts represented in code independently from the first delivery surface.
- Treat opencode as the first interface to the product, not as the product's domain model.
- Leave room for later multi-user hosting by keeping persistence, authentication, deployment, and UI decisions outside the core until they are deliberately chosen.

## Open Decisions

The following decisions have not been resolved yet:

- LLM orchestration boundary.
- External MTG data refresh cadence and caching strategy.
- Fixture shape and first import test cases.
- Deployment shape for any future hosted product.
