# Architecture

Tomekin is a local TypeScript and Bun application delivered through a project-local OpenCode agent. Its architecture
keeps deterministic product services separate from agent methodology and keeps SQLite and external data authority
behind explicit adapters.

Current observable workflows are defined in [Product Behavior](./product-behavior.md). The persisted model is defined
in [Data Model](./data-model.md), structured retrieval in [Card Query](./card-query.md), and verification policy in
[Testing](./testing.md). Historical rationale and adopted trade-offs live in [`adr/`](./adr/).

## Current Components

### Portable core

`packages/core` owns domain types, runtime schemas, application-service contracts, validation, Format construction and
legality assessment, Deck Building Briefs, Card Query input and result types, Collection import behavior, rendering,
and Agent Tool handlers. It does not depend on OpenCode, Drizzle, SQLite paths, or a user interface.

Expected service failures use typed `Result` values. Zod validates data at service and adapter boundaries. Repository
ports expose only the persistence operations each service needs.

### SQLite adapter

`packages/sqlite` implements repository ports with Drizzle and SQLite. It owns schema, generated migrations,
transactional dataset and Collection replacement, Deck Candidate persistence, reference queries, and the internal SQL
compiler for Card Query.

SQL, table names, joins, and migration details do not cross the repository boundary. Card Query's public contract is
allowlisted and typed; all query values are bound parameters. See ADRs
[`0005`](./adr/0005-repository-ports-with-sqlite-mvp.md),
[`0006`](./adr/0006-drizzle-for-sqlite-repositories.md),
[`0010`](./adr/0010-explicit-sqlite-migrations.md), and
[`0013`](./adr/0013-sql-backed-card-query-repository.md).

The default database path is `.data/tomekin.sqlite`, configurable with `TOMEKIN_DB_PATH`. Database files are local and
uncommitted.

### CLI adapter

`packages/cli` owns explicit local commands for migrations, Scryfall bulk sync/import, ManaBox Collection import, and
the one-time Card Set migration preparation workflow. It wires core services to SQLite repositories and renders command
results for a human operator.

Only the explicit Scryfall sync command performs live Scryfall network requests. Local-file Scryfall import and ManaBox
Collection import read user-supplied local files.

### Agent harness adapter

`packages/agent` composes the SQLite-backed Agent Tool runtime without selecting a harness and owns the fixed reviewed
Product Methodology catalog. Callers pass an explicit database path and logger, invoke handlers, then close the runtime.
`product-session/` contains shared product instructions and `product-methodology/` contains the seven canonical
methodology entries. `packages/opencode` and `.opencode/` remain a thin OpenCode adapter: it translates tool input and
output, uses the shared runtime per call, and reaches canonical methodology through repository-local shims. The adapter
does not receive raw database, shell, source-tree, or arbitrary network authority for normal product use.

Some contextual deck-building behavior remains in skills while its stable service shape is being proven. Deterministic
facts and invariants—reference readiness, Card Query, identity resolution, legality, rendering, Collection evidence,
and persistence—remain behind product tools. The current authority and confirmation boundaries are part of
[Product Behavior](./product-behavior.md), not implicit prompt convention.

## Package and Dependency Shape

The repository is a small Bun workspace with `core`, `sqlite`, `cli`, `agent`, and `opencode` packages. `core` defines
portable contracts. `sqlite` depends on those contracts to provide persistence. `cli` and Agent Harness Adapters use
the shared `agent` composition module to compose core services with SQLite repositories.

This separation permits another interface or persistence implementation without changing the domain vocabulary or
agent-facing product contract. It does not imply distributed services or a large monorepo, and the project does not use
Turborepo.

## Authority Boundaries

- **User intent:** the confirmed Format-specific Deck Building Brief and subsequent explicit confirmations authorize
  discovery, construction, tuning, and persistence choices.
- **Collection:** the latest successful ManaBox import is read-only evidence of owned rows. Tomekin does not write back
  or mutate imported Existing Decks.
- **Reference facts:** compatible local Scryfall datasets are authoritative for card identity, text, legality, Sets,
  Printings, Game Changer flags, EDHREC rank, and Oracle Tags.
- **Retrieval:** Card Query and reference repositories expose bounded allowlisted reads. Raw SQL and arbitrary database
  access are not Agent Tools.
- **Legality:** deterministic service results cannot be overridden by the agent. Explicit Rule Zero exceptions remain
  labelled user-authorized exceptions rather than rewritten facts.
- **Strategy:** the agent reasons about roles, packages, Synergy, play experience, and trade-offs. These are explained
  proposals, not deterministic or source-backed facts.
- **Persistence:** only confirmed full Deck Candidates are saved. Deck Opportunities and Deck Change Proposals are
  transient, and saving never changes the Collection.
- **External network:** normal deck-building is local. Live data access occurs only through an explicit user-invoked
  Scryfall sync.

ADR 0005 established portable repository ownership and named `DeckOpportunity` among the records the anticipated MVP
would save. That persistence portion was not implemented. The current services and Product Behavior contract persist
Deck Candidates only; the ADR remains historical rationale for the repository boundary rather than evidence that every
listed record shipped.

## Data and Request Flow

Scryfall sync or local import populates local reference records. ManaBox import resolves owned rows against that
reference data and transactionally replaces the current Collection snapshot. The agent then calls typed Agent Tools,
which validate requests in core services and read or write through repository ports. SQLite executes the bounded data
operations and returns domain-shaped results. Rendering produces stable Markdown and a Portable Decklist before a
confirmed candidate is persisted.

Imports and repository writes preserve the last usable state on expected validation or replacement failures. Tests use
the same public services and repository boundaries with isolated temporary databases; see [Testing](./testing.md).

## Technology Baseline

- TypeScript 7 and Bun workspaces/runtime/package management.
- Zod for runtime schemas at service and adapter boundaries.
- `neverthrow` `Result` types for expected application-service failures.
- SQLite with Drizzle behind repository ports.
- Bun's test runner for deterministic unit and integration coverage.
- OpenCode as the current local agent harness.
