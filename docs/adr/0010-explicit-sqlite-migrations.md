# Explicit SQLite migrations

SQLite schema changes will be managed with Drizzle Kit migrations owned by `packages/sqlite`, with Drizzle Kit
configuration at `packages/sqlite/drizzle.config.ts` and migration files stored in `packages/sqlite/drizzle/`.
Migrations are an explicit adapter administration step exposed as `bun run db:sqlite:migration:apply`; normal app
commands do not run migrations or check migration status, so database setup remains separate from product commands and
future Postgres persistence can use its own adapter-specific migration workflow.

Normal app commands should not perform implicit SQLite setup such as creating the database parent directory; first-run
filesystem preparation belongs to the explicit migration application command. `openDatabase()` may keep Bun SQLite's
default behavior of creating the database file if it does not exist, and unmigrated databases should fail naturally
through SQLite or repository operations rather than preflight migration checks.

Generated migration SQL should be reviewed and edited only when needed for correctness, data preservation, or SQLite
limitations. Future migrations must preserve existing data by default; destructive or rebuild-style migrations are
explicit exceptions.

The user-facing SQLite migration command should be a small TypeScript wrapper that prints the target database path,
creates the configured database path's parent directory, and applies migrations with Drizzle's Bun SQLite runtime
migrator. Migration generation remains a developer-facing Drizzle Kit command.

SQLite foreign key enforcement remains connection configuration rather than migration behavior: `openDatabase()` should
enable `PRAGMA foreign_keys = ON`, but it should not create, check, or migrate schema.
