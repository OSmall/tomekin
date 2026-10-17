# Agent Notes

## Documentation Ownership

Keep documentation in sync with implemented behavior and adopted design decisions.

- `README.md`: current user setup, commands, features, limitations, and the high-level documentation index.
- `AGENTS.md`: contribution rules, documentation ownership, and work-tracking policy.
- `GLOSSARY-MAP.md`: domain-context routing only, not general documentation navigation or implementation status.
- `GLOSSARY.md`: glossary and shared domain language only, not implementation status or work tracking.
- `docs/product-scope.md`: product promise, principles, supported scope, boundaries, and non-goals.
- `docs/product-behavior.md`: current user-observable workflows, contracts, and behavioral invariants.
- `docs/architecture.md`: current components, seams, authority boundaries, and concise summaries of adopted architecture.
- `docs/data-model.md`: implemented records, relationships, persistence behavior, and import invariants.
- `docs/card-query.md`: the current public and compilation contract for Card Query.
- `docs/testing.md` and `docs/testing/deck-building-workflow-scenarios.md`: testing policy, done bars,
  fixture and scenario responsibilities, and the stable manual corpus.
- `docs/future-direction.md`: uncommitted possibilities only, never active or deliberately queued work.
- `docs/adr/`: historical decision rationale and trade-offs, with explicit status or supersession notes when needed.
- `docs/agents/`: agent workflows, domain-document routing, issue-tracker mechanics, and triage conventions.
- Canonical deck-building skills: current operational methodology and compact source provenance beside the instructions
  that use it.

GitHub Issues is the only live tracker for committed work and specifications. Do not recreate a repository Plans
directory, Todos document, Design Branches document, or any equivalent shadow backlog. Git history is the archive for
delivered implementation plans.

## Agent skills

The Matt Pocock engineering skills are installed per contributor, not bundled with this repository. Install them
separately before using their workflows; they are not required for ordinary repository contributions.

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Uses a multi-context layout routed by `GLOSSARY-MAP.md`. Before exploring the codebase, read `docs/agents/domain.md`.

## SQLite Migrations

- Generate SQLite schema migrations with `bun run db:sqlite:migration:generate` from the workspace root.
- Do not handwrite files under `packages/sqlite/drizzle/` or manually edit
  `packages/sqlite/drizzle/meta/_journal.json` / snapshot files, except to revert an uncommitted generated migration
  before regenerating it.
