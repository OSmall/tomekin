# Architecture

Tomekin is a local TypeScript and Bun application delivered through a project-local OpenCode agent. Its architecture
keeps deterministic product services separate from agent skills and keeps SQLite and external data authority
behind explicit adapters.

Current observable workflows are defined in [Product Behavior](./product-behavior.md). The persisted model is defined
in [Data Model](./data-model.md), structured retrieval in [Card Query](./card-query.md), and verification policy in
[Testing](./testing.md). Historical rationale and adopted trade-offs live in [`adr/`](./adr/).

## Retrieval

[ADR 0019](./adr/0019-provider-backed-scryfall-card-search.md) is implemented for provider discovery and local lookup.
Core owns native request bindings, selected projections, bounded envelopes, stateless source-position traversal and
admission policy. The common runtime injects one provider and retains SQLite for local lookup/enrichment, Collection
import and deterministic checks. Confirmed-policy owned-row browsing is implemented; provider Collection filtering/evidence remains separate work. No retrieval-only corpus migration or
result/search store is introduced.

The process-lifetime provider owner performs HTTP outside disposable runtimes/Workers. Pi brokers transient provider
request/reply messages through its extension host; cancellation terminates the search Worker and detaches its caller,
while the host observes any 429 and retains cooldown. OpenCode and fallback runtimes reuse the same process owner.
Monotonic actual-start admission, durable minimal recovery metadata and an enforced single-provider-process state-root
boundary survive runtime disposal and Worker replacement. See [request control](./card-query.md#live-card-discovery)
for operating rules, restart recovery and the unrecorded-header crash limitation.

Normal discovery is `search_cards`; local CQL2 is only explicitly enabled `legacy_query_cards`. `lookup_cards` remains
local and does not hydrate missing facts from the provider. Reference relationships and existing foreign keys remain.

## Current Components

### Portable core

`packages/core` owns domain types, runtime schemas, application-service contracts, validation, Format construction and
legality assessment, Deck Building Briefs, Card Query input and result types, Collection import behavior, rendering,
and Agent Tool handlers. It does not depend on OpenCode, Drizzle, SQLite paths, or a user interface.

Expected service failures use typed `Result` values. Zod validates data at service and adapter boundaries. Repository
ports expose only the persistence operations each service needs.

Explicit deck checks use a repository snapshot operation to capture candidate state, revised trial memberships,
canonical Oracle facts and import provenance consistently. Core computes deterministic findings from that capture.
A separate immediate transaction publishes latest candidate-owned evidence only when its check-specific inputs and
reference/validator dependencies still match. Read-time applicability is a dependency comparison, never an implicit
validator run. Evidence writes leave content timestamps unchanged; transient trials have no persistent identity.

The hypergeometric service is pure and independent of repository ports/reference readiness. It sums exact BigInt
combinatorial weights, uses exact decimal fractions and a monotone lower-bound search for minimum qualifying counts,
and determines event status before approximate display conversion. With the 1,000 population limit, every numerator
and denominator is at most `2^1000`; Number conversion stays finite and their smallest positive ratio stays normal.
No numerical or probability record is persisted.

The calculator's strict operation union owns runtime validation and Pi's serialized schema. OpenCode's supported
`tool.args` API accepts only a flat Zod property shape, so its serialized calculator schema exposes the operation enum,
event variants and optional qualifying-count/target fields with descriptions of their conditional requirements.
Object-level validation and the shared service enforce the complete strict operation union, including missing or
forbidden operation-specific fields. OpenCode's model-visible schema cannot express those root conditional requirements;
both harnesses nevertheless execute the same request/result/error contract.

Known-card retrieval uses the Core `CardLookupRepository` snapshot port. Its SQLite implementation reads exact
identity/Printing/Set relationships, complete parts/legalities and selected tag enrichment in a synchronous read
transaction. The service preflights closed selectors and whole-original-batch Printing compatibility, then binds
successful import revisions and sizes self-contained continuation before reading records. A second revision check
prevents mixing snapshots during preflight. It projects only requested facts and advances one input occurrence per
complete outcome. Shared card selectors, projection/envelope types, cursor codec and compact transport serialization
are reusable by subsequent retrieval tools. No migration, result cache or cursor store is added.

Lookup failures remain on Result's error side with their complete wire envelope. Shared adapter serialization unwraps
that envelope without flattening readiness/validation/recovery details. OpenCode installations may use an independent
Zod metadata registry. `createCanonicalOpenCodeInputSchema` in `@tomekin/opencode` delegates selector validation to Core
and attaches Core's generated JSON Schema through a schema-local conversion override. Reuse it for further card, copy
and row selectors. Both installed Zod versions declare and honor this override before registry lookup. The adapter uses
a fresh custom schema to avoid converter-specific metadata clone-parent traversal. Supported host converters preserve
this complete representation regardless of registry identity. Actual serialized-schema tests, including an isolated
consumer registry, cover `minProperties`, closed properties and complete meanings. Pi uses Core's JSON Schema.

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

Live `search_cards` and explicit Scryfall sync perform Scryfall network requests. Local-file Scryfall import and ManaBox
Collection import read user-supplied local files.

### Agent harness adapter

`packages/agent` composes the SQLite-backed Agent Tool runtime without selecting a harness. Callers pass an explicit
database path and logger, invoke handlers, then close the runtime.
`skills/` contains the eight canonical Tomekin skills, rooted at `tomekin-deck-building`. `packages/opencode` and
`.opencode/` remain a thin OpenCode adapter: it translates tool input and output, uses the shared runtime per call, and
reaches canonical skills through repository-local shims. The adapter
does not receive raw database, shell, source-tree, or arbitrary network authority for normal product use.

`packages/pi` is a sibling interactive adapter. Its launcher verifies the pinned Pi standalone binary before execution,
uses `.data/tomekin-pi-runtime/` only for Tomekin-owned runtime artifacts, and inherits the user's terminal streams.
It sets Pi's persistent clone-local profile to `.data/pi`, selecting only the reviewed `pi-ask-user` extension entry
point and no package skills, prompts, or themes. The launcher explicitly registers `skills/` as Pi-native
skills while retaining disabled ambient skill and context-file discovery. A Bun-bundled extension translates the approved
shared Agent Tools through one lazy Worker lane. The Worker owns the SQLite runtime and preserves complete compact
lookup envelopes; unmigrated tools retain their temporary 16,000-character safety cap. The Worker is recreated after
cancellation or failure. Pi-local `read` remains a working-tree Tomekin-skill-only reader. The extension re-audits the
approved model-visible registry (including Pi's `ask_user`) at session start. Before each agent turn, it appends its controlled Tomekin
bootstrap to Pi's existing system prompt. `packages/core` owns the shared Agent Tool input contracts, which OpenCode and Pi project into their harness
schemas; Card Query keeps focused semantic validation behind that structural contract. The allow-list excludes generic authority;
Pi's own credentials and TUI interaction stay Pi-owned.

Some contextual deck-building behavior remains in skills while its stable service shape is being proven. Deterministic
facts and invariants—reference readiness, Card Query, identity resolution, legality, rendering, Collection evidence,
and persistence—remain behind product tools. The current authority and confirmation boundaries are part of
[Product Behavior](./product-behavior.md), not implicit prompt convention.

## Package and Dependency Shape

The repository is a small Bun workspace with `core`, `sqlite`, `cli`, `agent`, `opencode`, and `pi` packages. `core` defines
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
- **Reference facts:** live search evidence comes from the selected provider; local lookup and deterministic checks
  use compatible retained Scryfall datasets. Incidental material rules/legality disagreements require explicit sync
  and recheck before a successful final claim; normal search does not redundantly cross-check every result.
- **Retrieval:** Card Query and reference repositories expose bounded allowlisted reads. Raw SQL and arbitrary database
  access are not Agent Tools.
- **Legality:** deterministic service results cannot be overridden by the agent. Explicit Rule Zero exceptions remain
  labelled user-authorized exceptions rather than rewritten facts.
- **Strategy:** the agent reasons about roles, packages, Synergy, play experience, and trade-offs. These are explained
  proposals, not deterministic or source-backed facts.
- **Persistence:** authorized structured construction progress is candidate-owned and may be incomplete. Targeted
  changes validate the resulting record state atomically; explicit deck checks and agent confirmation remain distinct.
  Deck Opportunities and Deck Change Proposals are transient; candidate writes never change the Collection.
- **External network:** discovery uses the injected Scryfall search provider; bulk reference refresh remains an explicit user-invoked
  Scryfall sync.

ADR 0005 established portable repository ownership and named `DeckOpportunity` among the records the anticipated MVP
would save. That persistence portion was not implemented. The current services and Product Behavior contract persist
Deck Candidates only; the ADR remains historical rationale for the repository boundary rather than evidence that every
listed record shipped.

## Data and Request Flow

Scryfall sync or local import populates local reference records. ManaBox import resolves owned rows against that
reference data and transactionally replaces the current Collection snapshot. The agent then calls typed Agent Tools,
which validate requests in core services and read or write through repository ports. SQLite executes the bounded data
operations and returns domain-shaped results. Candidate create/edit operations save structured records without implicitly rendering or checking a deck. Rendering
loads saved authoritative records and produces bounded generated Markdown or a selected canonical Portable Decklist.

Imports and repository writes preserve the last usable state on expected validation or replacement failures. Tests use
the same public services and repository boundaries with isolated temporary databases; see [Testing](./testing.md).

## Technology Baseline

- TypeScript 7 and Bun workspaces/runtime/package management.
- Zod for runtime schemas at service and adapter boundaries.
- `neverthrow` `Result` types for expected application-service failures.
- SQLite with Drizzle behind repository ports.
- Bun's test runner for deterministic unit and integration coverage.
- OpenCode and the restricted interactive Pi session as local agent harness adapters.

## Candidate inspection and export

Core owns explicit candidate projections, generated report fragments and JSON/Mermaid source. The same saved read
snapshot supplies canonical names and current per-check applicability. Complete explicit views use ordered path/value
records within the shared byte-bounded retrieval envelope. Stateless cursors bind candidate/view and a transient hash of
the content timestamp plus included records; check publication and canonical-name changes cannot mix pages. Brief-only
reads do not depend on unused evidence/import state. No persisted report, fingerprint, cursor or extra authority exists.

CLI loads a saved candidate, generates source in Core, writes a unique temporary file beside the destination and
publishes by atomic rename. Filesystem failures clean the temporary file and leave previous output untouched. Diagram
rendering remains an external inspection concern; no Mermaid/SVG production dependency is introduced.

## Collection policy and owned-row browse

Core owns closed copy selectors, exact snapshot/location resolution, whole-Brief strict-date consistency and pure
same-row policy evaluation. `OwnedRowFacts` carries a row's actual Printing/Set/language facts independently of selected
output so omitted display facts cannot weaken proof. The evaluator classifies eligible, excluded and uncertain rows,
retains reasons/proof fields and marks Existing Deck quantities Committed. It is reusable by retrieval evidence and
whole-demand allocation; browsing itself performs no final deck allocation.

SQLite supplies bounded joined row batches and the authoritative active Collection pointer. Core applies all policy,
row/date and actual-Printing criteria before emitting result bounds. It uses the common stateless cursor/envelope and
UTF-8 sizing contract, with revision checks around evaluation and final emission. Tokens bind fixed inputs, effective
policy and relevant successful imports; they contain no results. New exact UTC date text preserves milliseconds without
changing legacy timestamp units. The active pointer commits/rolls back with Collection replacement. No provider scan,
historical Collection rows, duplicate identity columns, saved search or standalone policy handle is introduced.
