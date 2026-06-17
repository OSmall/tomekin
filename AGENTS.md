# Agent Notes

## Documentation Ownership

Keep the documentation in sync with the code and with design decisions.

- `README.md`: user-facing setup and usage.
- `CONTEXT.md`: glossary and domain language.
- `docs/product-scope.md`: product promise, principles, and boundaries.
- `docs/mvp.md`: current MVP behaviour and requirements.
- `docs/future-direction.md`: deferred scope and later possibilities.
- `docs/testing.md`: testing posture, layers, fixtures, and LLM boundaries.
- `docs/plans/`: planned coding slices not yet complete.
- `docs/adr/`: hard-to-reverse or surprising architecture decisions.

## SQLite Migrations

- Generate SQLite schema migrations with `bun run db:sqlite:migration:generate` from the workspace root.
- Do not handwrite files under `packages/sqlite/drizzle/` or manually edit
  `packages/sqlite/drizzle/meta/_journal.json` / snapshot files, except to revert an uncommitted generated migration
  before regenerating it.
