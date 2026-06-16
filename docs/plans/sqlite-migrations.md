# SQLite Migrations Plan

This plan records the decisions for replacing hand-written SQLite schema initialization with explicit Drizzle-managed
migrations.

## Goal

Introduce a migration workflow for the local SQLite persistence adapter so schema changes are intentional, reviewable,
and data-preserving after the initial adoption.

## Current State

- The project uses Bun, SQLite, and Drizzle ORM for the local MVP persistence adapter.
- `packages/sqlite/src/database.ts` opens the SQLite database with `openDatabase()`.
- `openDatabase()` only opens the connection and attaches Drizzle schema metadata; it does not create or migrate tables.
- `initializeDatabaseSchema()` currently creates tables and indexes with hand-written `CREATE TABLE IF NOT EXISTS` and
  `CREATE INDEX IF NOT EXISTS` SQL.
- `import:scryfall` currently calls `initializeDatabaseSchema()` before importing data.
- `packages/sqlite/src/schema.ts` is used by Drizzle query code, but it does not fully represent the current
  hand-written DDL.
- Missing `schema.ts` details include composite primary keys, indexes, and some SQL `CHECK` constraints.

## Resolved Decisions

- Use Drizzle Kit and Drizzle migration files for the SQLite adapter.
- Add `drizzle-kit` as the migration-generation tool rather than building a custom migration runner.
- Add `drizzle-kit` using the repo's current `latest` dependency style; broader dependency pinning remains a separate
  todo.
- Keep SQLite migrations inside the SQLite persistence adapter rather than treating them as root-level application
  state.
- Future hosted Postgres persistence will be a separate adapter with separate schema, migrations, and data.
- The local SQLite database is an MVP/local adapter, not the canonical future database.
- Existing local SQLite data does not need to be preserved during the initial switch to Drizzle migrations.
- Future migrations must preserve existing data by default.
- Future data preservation includes Scryfall-derived reference data, not only user-owned Collection data.
- Destructive or rebuild-style migrations are allowed only as explicit exceptions.
- Migration application should be an explicit SQLite-specific command that must be run before using app commands.
- `openDatabase()` should remain connection-only and should not create schema, initialize schema, check migration
  status, or migrate schema.
- `openDatabase()` should enable `PRAGMA foreign_keys = ON` as connection configuration, not schema management.
- `openDatabase()` may keep Bun SQLite's default behavior of creating the database file if it does not exist.
- Normal app commands should not run migrations automatically.
- Normal app commands should not check migration status on every agent-facing action.
- Normal app commands should not create the SQLite database parent directory as implicit setup.
- If a normal app command opens an unmigrated database, it should fail naturally through SQLite or repository operations
  rather than preflight checks.
- Missing or outdated schema errors may surface naturally from SQLite or repository operations.
- Documentation should make the explicit migration step clear.
- README should include a quickstart section whose first steps are installing tool dependencies with mise, installing
  package dependencies with Bun, applying SQLite migrations, and then importing local Scryfall data.
- `import:scryfall` should stop initializing schema automatically once migrations exist.
- `import:scryfall` should stop creating the database parent directory once migrations exist.
- Before generating the first migration, `packages/sqlite/src/schema.ts` must be updated to represent the current DDL
  from `initializeDatabaseSchema()`.
- The first migration should be generated from the corrected Drizzle schema, then reviewed against the existing
  hand-written DDL before committing.
- Migration files should live in `packages/sqlite/drizzle/`.
- Drizzle Kit configuration for SQLite should live at `packages/sqlite/drizzle.config.ts`.
- The user-facing migration application command should be `bun run db:sqlite:migration:apply`.
- The migration command implementation should be owned by `packages/sqlite`, not by `packages/cli`.
- Do not add a generic `bun run db:migrate` alias yet, because a future Postgres adapter should have its own explicit
  migration command.
- `bun run db:sqlite:migration:apply` should call a small TypeScript wrapper owned by `packages/sqlite`.
- The SQLite migration wrapper should apply migrations with Drizzle's `drizzle-orm/bun-sqlite` runtime migrator rather
  than shelling out to Drizzle Kit.
- The SQLite migration wrapper should resolve `packages/sqlite/drizzle/` relative to the wrapper module file, not the
  caller's current working directory.
- `bun run db:sqlite:migration:apply` should create the parent directory for the configured SQLite database path before
  opening the database.
- `bun run db:sqlite:migration:apply` should print the target database path before applying migrations and a short
  success message afterward.
- SQLite migration generation should call Drizzle Kit directly through the developer-facing
  `bun run db:sqlite:migration:generate` command.
- `packages/sqlite/drizzle.config.ts` should read `MTG_AGENT_DB_PATH` with fallback to `.data/mtg-agent.sqlite`.
- SQLite migration names should not be required by project convention; developers may pass Drizzle Kit's optional
  `--name` parameter when useful.
- SQLite integration tests should create temporary databases by running migrations rather than using a separate schema
  bootstrap helper.
- Generated migration SQL should be reviewed and edited only when needed for correctness, data preservation, or SQLite
  limitations.
- Generated migration SQL should not be edited for formatting or style alone.
- After any migration SQL edit, `schema.ts`, migration SQL, and Drizzle metadata should still describe the same final
  schema.
- The initial baseline migration should be verified with a one-time temporary parity test comparing the old
  `initializeDatabaseSchema()` schema to the migrated schema.
- The temporary baseline parity test should be removed with `initializeDatabaseSchema()` after the migration path
  replaces the initializer.
- `initializeDatabaseSchema()` should be deleted in the same implementation slice that introduces the migration path.
- The migration adoption should be implemented as one slice because schema parity, baseline generation, command wiring,
  test updates, and initializer deletion are tightly coupled.
- Record the migration workflow in ADR 0010.

## Planned Workflow

- Update `packages/sqlite/src/schema.ts` so it represents the current SQLite tables, primary keys, indexes, and
  constraints.
- Add a Drizzle Kit configuration for the SQLite adapter.
- Generate the baseline migration from the corrected schema.
- Review generated SQL against the current `initializeDatabaseSchema()` SQL.
- Add a temporary automated parity test for the baseline migration and remove it once `initializeDatabaseSchema()` is
  deleted.
- Add an explicit SQLite migration application command exposed as `bun run db:sqlite:migration:apply`.
- Add a developer-facing SQLite migration generation command exposed as `bun run db:sqlite:migration:generate`.
- Remove automatic schema initialization from `import:scryfall`.
- Remove database parent-directory creation from `import:scryfall`.
- Delete `initializeDatabaseSchema()` after the migration path is in place and the temporary parity test has served its
  purpose.
- Preserve foreign key enforcement by moving `PRAGMA foreign_keys = ON` into `openDatabase()` or an unconditional
  connection-configuration helper.
- Update README setup and usage docs to require the migration command before app usage.
- Add a README quickstart that shows the setup sequence before Scryfall import examples.

## Open Decisions

- None currently.
