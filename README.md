# Tomekin

Local, collection-first MTG deck-building through opencode.

This alpha helps you turn a ManaBox Collection export plus local Scryfall reference data into validated Commander/EDH
and paper-first 60-card Constructed Deck Candidates. It runs on your machine, stores data in local SQLite, and exposes
deck-building actions through a project-local opencode agent and custom tools.

## Project Status

The public alpha remains intentionally clone-based: clone the repo, install dependencies, sync Scryfall data, import
your Collection, open OpenCode, and use the local deck-building agent.

The project is not packaged for npm, does not include an installer, and does not provide hosted sync or hosted deck-building
services yet.

## Prerequisites

- Bun and opencode, installed through `mise install` or installed directly.
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
Commander, Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or Casual 60 deck. The agent uses project-local tools and
does not make hidden live Scryfall or metagame calls during normal deck-building.

Run `bun run db:sqlite:migration:apply` before normal app commands. It creates the parent directory for the configured
SQLite database path and applies migrations from `packages/sqlite/drizzle/`.

### Pi interactive deck-building session

`bun run tomekin` launches Pi v1.4.0 through Bun using a persistent clone-local Pi profile at `.data/pi`.
Pi is an exact dependency of `packages/pi`, installed with the rest of the workspace through `bun install --frozen-lockfile`.
The launcher uses Pi's public modular entrypoint; its bundled npm CLI still fails under Bun 1.3.14.
Tomekin builds its extension and Worker into `.data/tomekin-pi-runtime/1.4.0/` before starting the inherited terminal session.
Use `bun run tomekin --version` to inspect and verify the installed Pi version.

This path removes the macOS arm64 download restriction. It has been exercised on macOS arm64 with Bun 1.3.14;
Linux and Windows compatibility remain unverified. The current workflow targets developers cloning the repository
and running Bun commands; Pi supplies the interactive interface for this phase.
Pi's native TUI may separately download its `fd`/`rg` helpers when absent. Set `PI_OFFLINE=1` to skip those downloads
and catalog network refreshes during an offline startup check; this does not make authenticated model calls work offline.
Helper acquisition and behavior remain Pi-owned.

The session exposes the approved Tomekin Agent Tools, a skill-only `read`, `ask_user`, restricted native `codemode`,
the pinned Pi todo extension and `context_status`. It does not grant coding, shell, general filesystem, network,
raw-database or MCP tools. Pi discovers canonical `skills/`; ambient resources remain disabled. The launcher loads
the reviewed `pi-ask-user@0.15.0` file and the official todo example shipped with the pinned Pi version. It preserves
other settings while clearing the profile's package list. A compact Tomekin system prompt replaces Pi's coding orientation
while preserving native skill discovery. For substantial requests the agent uses a checklist and checks estimated context
capacity; unknown estimates remain unknown. After compaction it recovers the actual candidate, Resume note and needed
research pages. Pi retains ownership of login, settings and conversation data within this clone-local profile.
Existing standalone caches and profile data are retained. Downgrades and cross-version profile/session compatibility
are unsupported in this developer phase; deliberate downgrade recovery is manual.

For a maintainer upgrade, change the exact Pi dependency and `supportedPiVersion` in `packages/pi/src/runtime-version.ts`,
regenerate `bun.lock`, and run the launcher/adapter tests, full suite, and typecheck. There is no integrated CLI launch
test or mandatory manual terminal smoke-test gate for dependency upgrades in this developer phase; normal use supplies feedback.
Normal launches use that installed version; Pi's self-updater is not Tomekin's upgrade mechanism.
Model catalogs, provider support, and authentication remain Pi concerns. Catalogs may refresh independently for existing
providers, while new provider protocols or authentication flows can require a dependency upgrade.

`browse_tags` discovers imported tag vocabulary with explicit search, known-slug lookup, optional bounded hierarchy,
and recoverable catalogue listing. `search_card_sets` discovers codes/names from existing imported Set metadata.

`lookup_cards` retrieves ordered local Oracle/name/Printing batches with explicitly selected complete facts,
including multipart text and direct/inherited tags. Complete bounded envelopes support `first`/`after` recovery in
OpenCode and both Pi execution paths. Local misses remain explicit, and optional unavailable tags do not block core
lookup. It performs no network fallback; opt-in Collection summaries/copies evaluate the same-row confirmed policy. See the [lookup contract](docs/card-query.md#known-card-lookup).

`list_collection_locations` exposes exact locations and the authoritative active Collection import ID.
`browse_collection_cards` reads bounded actual owned rows under an explicit confirmed policy or a candidate's Brief,
including reliable source-added dates and independently searchable unknown dates. Successful reimport requires scope
reconfirmation; failed attempts preserve current references. See the [Collection contract](docs/card-query.md#collection-policy-and-owned-row-browsing).

Pi also provides `calculate` for bounded scalar arithmetic without Collection or reference data. See the
[general calculator contract](docs/product-behavior.md#general-calculator-pi) for supported expressions and limits.

The shared `hypergeometric_calculator` computes bounded sampling probabilities or a minimum qualifying count against an
explicit decimal target. It works without imported card data and does not save records. See the
[calculator contract](docs/product-behavior.md#hypergeometric-calculator) for inputs, precision and sampling limits.

The separate account-holder-consented matched real-session parity evaluation (#26) covers authentication, one harmless request, a successful
and expected-failure tool call, answer/cancel behaviour, refresh/recovery/logout, and clean shutdown without exposing
tokens. OpenCode remains supported. The profile and database remain intact after each run. Follow the [matched real-session parity protocol](docs/evaluation/real-session-parity.md)
for controlled inputs, exact new-path gates and sanitized results; `bun run evaluate:parity:prepare` prepares isolated
public-reference/synthetic-owned fixtures without running a model or accessing an account.

Within that separate parity evaluation, check initial sessions, extension reload, and resumed sessions: Pi identifies as Tomekin, loads
`deck-development` when its workflow is needed, and completes a correctly shaped `search_cards` call after
loading `card-research` when retrieval selection or recovery needs guidance. During a deliberately slow product-tool call, confirm that
the spinner and terminal input remain responsive, Escape cancels a read, and dispatched candidate writes settle and are not reported cancelled.

### Upgrading an existing pre-Card-Set database

The Card Set migration replaces stored Printing Set codes with required Scryfall Set UUID foreign keys. Those UUIDs
cannot be derived truthfully from the legacy database. If the migration reports existing legacy Card Printings, first
back up the SQLite file, then run:

```sh
bun run db:sqlite:migration:prepare-card-set-search
bun run db:sqlite:migration:apply
bun run sync:scryfall
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
```

The preparation command transactionally removes only the regenerable Collection snapshot and Card Printing rows. It
preserves Card Identities, Oracle Tags, Scryfall import history, and saved Deck Candidates and their cards. It recognizes
only the legacy `card_printing.set_code` schema and refuses to run after the Card Set migration. The subsequent Scryfall
sync supplies real Set UUIDs, and the ManaBox reimport restores owned-card rows. Use `TOMEKIN_DB_PATH` to target a
non-default database for every command.

By default, commands use `.data/tomekin.sqlite`. Override the database path with `TOMEKIN_DB_PATH` or command-specific
`--db` flags where supported.

## Scryfall Sync

Use the default setup command to download and import the required reference datasets in order: `oracle_cards`, `all_cards`,
then `oracle_tags`.

```sh
bun run sync:scryfall
```

This command explicitly fetches Scryfall metadata and all three bulk datasets. It stages and validates the incoming
graph, resolves disappearances using official Card Migrations, and publishes the complete reference refresh in one
transaction. Paper and digital cards are retained. Safe official merges preserve Collection row metadata and saved
candidate memberships, options and contributions; referenced deletes, ambiguous replacements, collisions and unexplained
disappearances abort the refresh and preserve the prior usable data. Apply SQLite migrations before running an updated
checkout. Staging reports record counts every 25,000 records and at each dataset's completion; success is reported only
after the complete refresh commits.

Initial setup and refreshes without disappearances need no migration history. Discovery reuses cached evidence and stops
when required chains resolve, within 32 API requests (including retries), 16 MiB of responses and 180 seconds including
waits. Budget exhaustion means incomplete reconciliation. Metadata and migrations share the search process owner:
API starts are at least 100 ms apart, with search retaining its stricter 500 ms cadence. Bulk-file downloads use a
separate origin. Every HTTP 429 retains a minimum 31-second cooldown, honors longer Retry-After values, and permits at
most two retries per request within budget. One active Tomekin API owner per user/state directory is supported; close
another active Tomekin process before starting sync. Retry after reported cooldown; restart does not bypass it.

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
from Scryfall. Compatible replacements remain supported; removing Card Identities or Printings requires the coordinated
live sync and its migration safeguards. Older ManaBox CSVs with discarded Printing IDs are rejected with locally
cached official replacement guidance; repair the source CSV and verify exact Printing metadata before reimporting.

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
- Structured candidate create/edit with provisional plans, assessed options, selected memberships and exact timestamp
  concurrency checks. Saves and reads do not automatically validate a deck.
- Explicit saved-candidate legality/evaluation/Collection Availability by ID and last-read timestamp, isolated transient trials, and latest
  check-specific evidence with absent/applicable/outdated reads. Evidence publication preserves content timestamps.
- Compact candidate summaries and complete paged Brief/selection/pool/plan/reasoning/report views. Saved rendering uses
  selected canonical names; developer JSON/Mermaid exports preserve current reasoning without running checks.
- Explicit Scryfall bulk sync for `oracle_cards`, `all_cards`, and `oracle_tags`.
- Local Card Set discovery. Retained local CQL2 filters require explicit `TOMEKIN_ENABLE_LEGACY_QUERY=true` and the `legacy_query_cards` capability (OpenCode also requires an allow permission).
- ManaBox Collection CSV import with blocking validation and non-destructive failed imports.
- Format-aware opencode deck-building agent with deterministic local tools and researched 60-card construction guidance.
- Collection Opportunity discovery across all supported Formats, with ranked viable directions before full construction.
- Commander Existing Deck tuning: review proposed additions, identify paired cuts, or diagnose open-ended improvements
  within an explicitly stated Addition Pool.
- 60-card Existing Deck tuning with an explicit focused-repair, rebuild-around-identity, or fresh-construction gate.
- Native Scryfall `search_cards`, selected local `lookup_cards`, Oracle Tag lookup, Format legality validation, deck rendering, and Deck Candidate
  persistence tools for Commander/EDH and the supported 60-card Formats.
- Optional 60-card Sideboards when requested, with matchup context or explicit general-purpose assumptions.
- Structured local logging for CLI commands, SQLite queries, imports, sync, and opencode tool calls.

## Known Limitations

- Collection-aware deck-building depends on an imported ManaBox CSV snapshot; there is no collection write-back.
- Discovery uses live Scryfall search. Known-card lookup and deterministic checks use explicit local imports; no automatic corpus hydration occurs.
- One active provider process per shared user/state root is supported. A second active Pi/OpenCode process must wait for the owner to exit. See [provider operating rules](docs/card-query.md#live-card-discovery).
- Native search supports local confirmed-policy Collection scope and opt-in exact same-row ownership evidence.
  Representative Printings do not establish all-owned-version coverage; retrieval summaries are not final whole-deck proof.
- Normal 60-card deck-building has no live metagame feed; Sideboard recommendations depend on user-supplied context or
  clearly stated general-purpose assumptions.
- No npm package, installer, hosted UI, or plugin marketplace packaging is provided in this alpha.
- Prices, exhaustive combo detection, and live LLM evaluation are out of scope for the default local tools.
- Deck-tuning recommendations are reasoned proposals, not deterministic optimality guarantees; prices and budgeted
  purchase recommendations are not yet supported.
- Deck Opportunity shortlists are transient in the current agent workflow; durable Deck Opportunity persistence remains
  future work.
- Confirmed Collection Access Policy is enforced by Collection-scoped search, selected retrieval evidence and `browse_collection_cards`. Legacy `legacy_query_cards` still needs
  explicit scoped predicates and does not prove the new policy or actual owned-Printing restrictions.
- Deck Opportunities and Deck Change Proposals are transient. The current persistence service saves Deck Candidates
  only.
- Final Availability checks cover the complete selected demand against recorded Collection rows under the Brief policy.
  The default check returns the complete summary without witness rows; focused saved problems explain shortages and
  uncertainty. Bounded Collection Pull Lists recover sourcing witnesses; imported data does not establish physical possession.
- ManaBox List rows are not currently skipped and summarized; an unsupported location type fails the readable import
  and preserves the previous Collection snapshot ([issue #39](https://github.com/OSmall/tomekin/issues/39)).

## Development Commands

```sh
bun install
bun run db:sqlite:migration:apply
bun run sync:scryfall
bun run import:scryfall -- oracle_cards /path/to/oracle-cards.jsonl.gz
bun run import:collection -- manabox /path/to/ManaBox_Collection.csv
bun run tomekin
bun run test
bun run typecheck
```

## Documentation

- [`GLOSSARY.md`](./GLOSSARY.md): canonical glossary and domain language.
- [`GLOSSARY-MAP.md`](./GLOSSARY-MAP.md): routes shared and package-specific domain documentation.
- [`docs/product-scope.md`](./docs/product-scope.md): product promise, supported scope, boundaries, and non-goals.
- [`docs/evaluation/economy.md`](./docs/evaluation/economy.md): measured staged retrieval, compact cursor/context costs and bounded live comparison.
- [`docs/product-behavior.md`](./docs/product-behavior.md): current user-observable workflows, confirmations, outputs,
  imports, and authority limits.
- [`docs/card-query.md`](./docs/card-query.md): public Card Query request, result, relationship, quantity, and compilation
  semantics.
- [`docs/architecture.md`](./docs/architecture.md): current components, seams, and authority boundaries.
- [`docs/data-model.md`](./docs/data-model.md): persisted records, relationships, and import invariants.
- [`docs/testing.md`](./docs/testing.md): testing posture, TDD expectations, test layers, fixture guidance, and LLM test boundary.
- [`docs/future-direction.md`](./docs/future-direction.md): deferred scope and likely future product directions.
- [`docs/adr/`](./docs/adr/): hard-to-reverse architecture and technology decisions.
- [`docs/research/`](./docs/research/): saved research notes and prototypes.

The canonical [deck-development skill](skills/deck-development/SKILL.md) routes discovery, construction,
tuning, explanation and resumption. [Card research](skills/card-research/SKILL.md) and
[probability analysis](skills/probability-analysis/SKILL.md) own shared methods;
[Commander](skills/commander/SKILL.md) and [60-card Constructed](skills/sixty-card-constructed/SKILL.md)
supply Format-specific guidance. The [workflow demonstration](docs/evaluation/workflows.md) exercises product seams
with synthetic data. Deterministic evidence does not establish live-model quality.

## Future Direction

Possible future directions include friendlier setup, packaging around stable commands, and additional interfaces over
the same portable core. They are possibilities rather than alpha promises; see
[`docs/future-direction.md`](./docs/future-direction.md).

For current deterministic workflow evidence run `bun run evaluate:workflows`; for candidate timing measurements run
`bun run evaluate:performance`. The pinned pre-migration comparison remains `bun run evaluate:legacy`.
[The evaluation protocol](docs/evaluation/README.md) describes the recorded artifact, limitations and legacy comparator.

### Inspect a saved Deck Plan

```sh
bun run tomekin deck-candidate export-plan <candidate-id> --format json --projection strategy --output plan.json
bun run tomekin deck-candidate export-plan <candidate-id> --format mermaid --projection pool --output plan.mmd
```

The default projection is `strategy`; `selected` adds selected quantities/sections and `pool` includes alternatives.
JSON always retains the complete candidate reasoning. Mermaid source can be rendered by an external compatible viewer;
Tomekin has no production SVG/rendering dependency. Reports expose missing judgments and outdated evidence rather than
implicitly checking a deck. See [complete candidate views and output](docs/product-behavior.md#complete-views-and-generated-output).
