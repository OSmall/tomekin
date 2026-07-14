# Alpha Public Release Prep Plan

This plan defines the release-prep work for making the local opencode deck-building project ready for a public GitHub
`alpha1.0.0` release.

The target release is intentionally clone-based: users clone the repository, install dependencies, import Scryfall
reference data, import a ManaBox Collection export, open opencode, and talk with the local deck-building agent. npm
packaging and friendlier installers are deferred until the product proves enough value to justify a sharper distribution
surface.

## Goal

Prepare the branch for a public GitHub alpha release by improving local observability, setup ergonomics, dependency
reproducibility, and user-facing documentation without expanding the product beyond the local opencode MVP.

## Current State

- The project is a Bun workspace with `packages/core`, `packages/sqlite`, `packages/cli`, `packages/opencode`, and
  project-local `.opencode` artifacts.
- Local SQLite persistence is explicit: users run `bun run db:sqlite:migration:apply` before normal app commands.
- Scryfall reference data can be imported from local bulk files with `bun run import:scryfall -- <bulk-type> <path>`.
- Scryfall bulk sources are observed in both gzipped JSONL and legacy top-level JSON-array shapes, so local import and
  live sync must share source-shape support rather than assuming one container format.
- ManaBox Collection CSV import exists through `bun run import:collection -- manabox <path>`.
- The local opencode agent uses project-local custom tools and should not make hidden live Scryfall calls during normal
  deck-building.
- Dependencies currently use a mix of exact versions, caret ranges, `latest`, and workspace ranges.
- No centralized logger exists; CLI commands write user-facing output to stdout/stderr, and SQLite queries are not
  centrally logged.
- Existing dirty worktree entries at planning time are unrelated to this release-prep plan and must not be reverted or
  staged accidentally.

## Release Target

- Public GitHub repository readiness only.
- Do not prepare npm publishing in this branch.
- Do not add `SECURITY.md` or `CONTRIBUTING.md` for `alpha1.0.0`.
- Do not add a license file until the project owner chooses one.
- Keep the project rename as the final slice, after the owner chooses a more personal name.

## Reference Docs And Decisions

Relevant project docs:

- [`README.md`](../../README.md): current user-facing setup and usage.
- [`CONTEXT.md`](../../CONTEXT.md): canonical domain language.
- [`docs/product-scope.md`](../product-scope.md): collection-first product promise and boundaries.
- [`docs/mvp.md`](../mvp.md): Commander-first MVP behaviour, import workflow, Deck Candidate expectations, and output
  shape.
- [`docs/architecture.md`](../architecture.md): portable core, opencode adapter, SQLite adapter, and local runtime
  posture.
- [`docs/data-model.md`](../data-model.md): Scryfall import, Collection import, and saved Deck Candidate records.
- [`docs/testing.md`](../testing.md): Bun test posture, SQLite integration tests, and no-live-LLM test boundary.
- [`docs/adr/0001-opencode-first-portable-core.md`](../adr/0001-opencode-first-portable-core.md): opencode-first local
  MVP with portable core.
- [`docs/adr/0002-typescript-and-bun.md`](../adr/0002-typescript-and-bun.md): TypeScript and Bun baseline.
- [`docs/adr/0003-small-bun-workspace.md`](../adr/0003-small-bun-workspace.md): small Bun workspace.
- [`docs/adr/0008-streamed-scryfall-bulk-imports.md`](../adr/0008-streamed-scryfall-bulk-imports.md): streamed Scryfall
  import architecture.
- [`docs/adr/0010-explicit-sqlite-migrations.md`](../adr/0010-explicit-sqlite-migrations.md): explicit SQLite migration
  workflow.
- [`docs/adr/0014-structured-local-logging.md`](../adr/0014-structured-local-logging.md): structured local file logging
  behind a project logger boundary.
- [`docs/adr/0015-explicit-scryfall-bulk-sync-command.md`](../adr/0015-explicit-scryfall-bulk-sync-command.md): explicit
  user-invoked Scryfall download/sync command.
- [`docs/adr/0016-clone-based-alpha-distribution.md`](../adr/0016-clone-based-alpha-distribution.md): clone-based GitHub
  alpha distribution.

Relevant external references:

- Scryfall Bulk Data API: bulk metadata, `oracle_cards`, `all_cards`, `oracle_tags`, daily update cadence, and current
  `jsonl.gz` download shape.
- Pino documentation: structured JSON logging, file destinations, asynchronous destinations, child loggers, transports,
  and redaction.
- Drizzle ORM documentation: `logger` option and custom logger interface for SQL query logging.
- General README best practice: concise pitch, quickstart, features, current state, limitations, roadmap, and
  development commands.

## Resolved Direction

- Use Pino as the first logging implementation because it is efficient, structured-JSON-first, TypeScript-friendly,
  modern, well supported, and maps cleanly to later cloud logging.
- Put Pino behind a small project logging boundary so application code does not depend on Pino directly.
- Local logging is always enabled at debug level by default during the alpha.
- Default logs write under `.data/`, which is already gitignored.
- Expose logging configuration through environment variables rather than adding config files for the alpha.
- Default logs are human-readable; structured JSON logs remain available through an environment override.
- Log tool inputs and outputs, SQL query text and parameters, CLI command lifecycle events, import progress summaries,
  sync/download lifecycle events, and errors.
- Treat potentially large or sensitive payloads as debug/trace detail rather than always-on info logs. Because the alpha
  default is debug, users should lower `TOMEKIN_LOG_LEVEL` to `info` for quieter local logs.
- Add Drizzle SQL logging at the SQLite adapter boundary.
- Add one explicit Scryfall download/import command for the default reference-data setup path.
- Preserve the existing local-file Scryfall import command for repair, debugging, and fixture-backed workflows.
- The Scryfall sync command may make network calls only because the user explicitly invoked setup/sync.
- Normal opencode deck-building and ManaBox Collection import remain local/offline and must not make hidden Scryfall
  calls.
- Pin dependency versions before feature work so later diffs are easier to review.
- Rename the project last, after the owner chooses a personal name and availability is rechecked.
- The project name is Tomekin. Package scopes use `@tomekin/*`, local data defaults use `.data/tomekin.*`, logging and
  database environment variables use the `TOMEKIN_` prefix, and opencode tool permission names use the `tomekin_` prefix.
- Do not add `SECURITY.md`, `CONTRIBUTING.md`, or a license in this release-prep branch unless explicitly requested
  later.

## Out Of Scope

- npm publishing.
- One-line installer scripts.
- Hosted app packaging.
- OpenCode plugin marketplace packaging.
- Background or automatic Scryfall sync.
- Collection-management write-back.
- New deck-building product features unrelated to setup, logging, docs, and release readiness.
- Live Scryfall calls in normal agent tools.
- Live Scryfall calls in the default `bun test` suite.
- `SECURITY.md`, `CONTRIBUTING.md`, and license selection.

## Commit Sequence

Each implementation slice should be independently reviewable and committed separately. Stage only files intentionally
changed for the slice. Do not stage unrelated dirty files such as pre-existing edits to `docs/todos.md`,
`packages/sqlite/test/collection-repository.test.ts`, or untracked `.DS_Store` unless the owner explicitly asks.

### Slice 1: Pin Dependency Versions

Commit message: `chore: pin dependency versions`

Planned work:

- Replace `latest` and caret dependency ranges in workspace `package.json` files with exact versions resolved in
  `bun.lock`.
- Keep internal workspace dependencies as `workspace:*` unless a later npm-publishing slice changes that deliberately.
- Run `bun install` so `bun.lock` reflects exact dependency declarations.
- Do not introduce new dependencies in this slice.

Expected verification:

- `bun test`
- `bun run typecheck`

### Slice 2: Add Structured Local Logging

Commit message: `feat: add local file logging`

Planned work:

- Add Pino as the logging dependency.
- Add a small logging module owned by the appropriate shared package or adapter boundary.
- Default to writing human-readable logs to a local file under `.data/`.
- Support environment overrides such as log path, log level, and log format.
- Add child loggers or equivalent bindings for `cli`, `sqlite`, `opencode`, `scryfall_import`, `scryfall_sync`, and
  `agent_tool` contexts.
- Wire Drizzle's custom logger option so SQL query text and parameters are recorded.
- Log direct Bun SQLite prepared-statement queries where Drizzle logging does not observe the query.
- Log opencode custom tool invocation and result metadata in `.opencode/tools/tomekin.ts` or the opencode adapter
  boundary.
- Log full tool arguments/results at debug or trace level; keep info-level logs concise.
- Log CLI command start/end, target database path, source path or source URI, status, duration, and blocking errors.
- Ensure log file creation does not replace user-facing stdout/stderr output.

Expected verification:

- Unit or adapter tests for logger configuration and tool-call logging where deterministic.
- Existing opencode adapter tests continue to pass.
- `bun test`
- `bun run typecheck`

### Slice 3: Add One-Command Scryfall Sync

Commit message: `feat: add scryfall sync command`

Planned work:

- Add a root script such as `sync:scryfall`.
- Add a CLI entrypoint that downloads and imports the default reference datasets in dependency order: `oracle_cards`,
  `all_cards`, then `oracle_tags`.
- Fetch Scryfall bulk metadata from the Bulk Data API.
- Resolve each required dataset by Scryfall bulk data `type`.
- Prefer Scryfall `jsonl_download_uri` sources when available and stream/decompress them without loading complete bulk
  files into memory, while falling back to `download_uri` JSON-array sources.
- Add shared parser/source support for gzipped JSONL and top-level JSON-array records across live sync and local import.
- Reuse existing mapping, validation, staging, and transactional replacement services as much as practical.
- Record source URI and source updated timestamp from Scryfall metadata.
- Preserve failed-import non-destructiveness for each dataset.
- Keep the existing `import:scryfall` local-file command available and documented.
- Make network access explicit in command naming and user-facing output.

Expected tests:

- Core parser tests for JSONL source records.
- CLI tests with fake fetch or injected bulk-data client; no live Scryfall calls.
- Tests for default ordering and early failure behaviour.
- Tests that failed sync preserves previous usable datasets.
- Tests that local JSON-array and gzipped JSONL imports both work.

Expected verification:

- `bun test`
- `bun run typecheck`
- Optional manual smoke against real Scryfall bulk data only after deterministic tests pass; do not require this for
  default tests.

### Slice 4: Refresh Public Alpha README

Commit message: `docs: refresh public alpha readme`

Planned work:

- Rewrite `README.md` as the public front door for `alpha1.0.0`.
- Include a clear product pitch: local collection-first Commander deck-building through opencode.
- State the alpha status and clone-based workflow honestly.
- Include prerequisites: Bun through mise or direct Bun install, opencode, local disk space for Scryfall data, and a
  ManaBox export for Collection-aware use.
- Include quickstart commands in the intended user order:
    - clone repository
    - install dependencies
    - apply SQLite migrations
    - sync/import Scryfall reference data
    - import ManaBox Collection CSV
    - open opencode and select/use the deck-building agent
- Document logging defaults and environment overrides, including pretty/JSON format selection.
- Document existing local-file Scryfall import for repair/debug use.
- Document current features and known limitations.
- Document future direction without overpromising hosted or npm packaging.
- Link to the deeper docs that remain useful for contributors and architecture readers.
- Add `.DS_Store` to `.gitignore` as a small public-repo hygiene fix.
- Do not add `SECURITY.md`, `CONTRIBUTING.md`, or a license file.

Expected verification:

- README commands should match actual package scripts.
- `bun test`
- `bun run typecheck`

### Slice 5: Rename Project

Commit message: `chore: rename project to Tomekin`

Planned work:

- Stop before this slice until the owner chooses the final name.
- Recheck npm registry availability and obvious GitHub/package-name collisions immediately before renaming.
- Rename root package and workspace package scopes if appropriate.
- Rename code imports from the old package scope.
- Rename environment variables and default database path in this same slice.
- Rename opencode tool file and permission keys so the new name appears in tool names.
- Update docs and README references.
- Do not rewrite historical ADR filenames.

Expected verification:

- `bun install`
- `bun test`
- `bun run typecheck`
- OpenCode adapter schema tests must pass after any tool-file rename.

### Slice 6: Final Public-Ready Check

Commit message: optional, only if final cleanup is needed.

Planned work:

- Run full verification.
- Inspect `git status` and `git diff`.
- Confirm no unrelated dirty files are staged.
- Confirm `.data/`, logs, generated local databases, `node_modules`, `dist`, and tsbuild info are not included.
- Confirm README accurately reflects the alpha workflow.

Expected verification:

- `bun install`
- `bun test`
- `bun run typecheck`

## Future Packaging Direction

The clone-based alpha should not become the long-term packaging model. A later packaging milestone should consider a
small CLI distribution that wraps setup and health checks while preserving the portable core and opencode adapter
boundaries.

Likely future commands:

- `<name> init`: create local config, data directories, and opencode setup artifacts.
- `<name> sync-scryfall`: download and import Scryfall reference data.
- `<name> import manabox <collection.csv>`: import a ManaBox Collection export.
- `<name> doctor`: check Bun, migrations, database path, Scryfall datasets, Collection import status, opencode config,
  and logging path.
- `<name> open` or documented opencode integration: help users start the local agent workflow.

Packaging should stay deferred until the alpha workflow proves which parts are stable enough to turn into user-facing
install contracts.

## Open Decisions

- Whether to manually smoke-test real Scryfall bulk sync before the public release tag.

```aiignore
# Prompt to continue with implementation

Continue the alpha public release prep plan for this repo.

First, read:
- AGENTS.md
- docs/plans/alpha-public-release-prep.md
- docs/adr/0014-structured-local-logging.md
- docs/adr/0015-explicit-scryfall-bulk-sync-command.md
- docs/adr/0016-clone-based-alpha-distribution.md
- docs/testing.md
- docs/architecture.md

Then inspect git status and recent commits. Determine the first incomplete slice in `docs/plans/alpha-public-release-prep.md` by checking the worktree, package files, tests, and recent commit history.

Execute exactly one incomplete slice at a time, in order:
1. Pin dependency versions.
2. Add structured local logging.
3. Add one-command Scryfall sync.
4. Refresh public alpha README.
5. Rename project, but only after asking me for the final name.
6. Final public-ready check.

Rules:
- Do not skip ahead.
- Do not implement multiple slices in one commit unless I explicitly approve it.
- Before committing, inspect `git status`, `git diff`, and recent commits.
- Stage only files intentionally changed for the current slice.
- Do not touch, revert, or stage unrelated dirty files.
- Use Bun commands, not npm/node/npx.
- Run the verification listed for the slice.
- If verification fails, fix the slice before committing.
- If the current slice requires a decision not answered by the plan, ask me one focused question.
- Do not add SECURITY.md, CONTRIBUTING.md, or a license.
- Keep the project rename as the final feature slice and ask before doing it.

When the slice is complete, commit it with the commit message specified in the plan, then stop and report:
- which slice was completed
- verification commands run
- commit hash
- any remaining risks or follow-up decisions
```
