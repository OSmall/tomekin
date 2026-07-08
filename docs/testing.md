# Testing

This document describes the project's testing posture and expected test behaviours. It is implementation-facing guidance, not domain glossary language.

## Test Runner

Use `bun test` as the default test runner for unit tests, integration tests, and Exact Output Tests.

Bun sets `NODE_ENV=test` for `bun test`, which routes project logs to human-readable `stderr` output at `info` level so
test diagnostics stay in the terminal and do not append to `.data/mtg-agent.log`. Set `MTG_AGENT_LOG_LEVEL=debug` for
verbose SQL and tool payload logs, or `MTG_AGENT_LOG_ENABLED=false` to suppress project logs during a test run.

An Exact Output Test checks generated output against an expected string or file exactly. Use this term instead of testing jargon such as `golden-output test` or `approved-output test`.

Do not add another test runner unless a concrete Bun test limitation blocks a needed test.

The default `bun test` suite should include both unit and integration tests. Integration tests should remain fast by using tiny fixtures and isolated temporary local SQLite databases.

Separate focused commands such as `test:unit`, `test:integration`, or `test:large-data` may be added later when there is a concrete need. The default test command should stay comprehensive enough to trust before coding onward.

## TDD Posture

New product behaviour should start with a failing or pending behaviour-focused test when the behaviour can be expressed deterministically.

Refactors may proceed under existing tests. Trivial wiring and configuration changes do not require ceremonial red-green testing. Reproducible bug fixes should start with a regression test.

Tests should be deterministic around time, generated IDs, and ordering. Services that need time should receive a fake or test clock in tests. Services that generate IDs should receive a deterministic ID generator in tests. Lists returned from services should have explicit ordering before tests assert on them.

Tests should not depend on wall-clock time, random UUIDs, filesystem directory ordering, or database default row order.

## Test Layers

Core unit tests should cover deterministic product behaviour first, including:

- Parsing decisions.
- Validation.
- Availability calculations.
- Portable Decklist rendering.
- Freshness status.
- Legality result shaping.
- Service business errors.
- Deck Building Brief schema defaults and confirmation assumptions.

SQLite integration tests should cover repository-boundary behaviour, including:

- Migrations and schema behaviour.
- Repository transactionality.
- Failed import non-destructiveness.
- Current Collection snapshot replacement.
- Deck Candidate save, reopen, list, and transactional card-row replacement.
- SQLite migrations that rebuild tables referenced by foreign keys, using a populated pre-migration fixture and
  `PRAGMA foreign_key_check` assertions.

Opencode adapter tests should remain thin smoke tests that prove tool inputs are translated into service calls and
user-facing output. They should also prove repo-local OpenCode tool argument schemas can be represented as JSON Schema,
because OpenCode performs that conversion during session startup. Live opencode execution and LLM quality evaluation
should stay out of the default `bun test` suite unless a separate explicit smoke harness is added.

## Test Layout

Production source code should live in a package's `src/` directory.

Tests should live in a package's `test/` directory, not colocated beside source files. Test files should use the `.test.ts` suffix.

Fixtures should live under the relevant package's `test/fixtures/` directory.

Fixtures should stay package-local by default. Promote fixtures to a shared location only when multiple packages genuinely need the same fixture and duplication starts causing drift.

Behaviour and service tests should import through the package public API, such as `@mtg-agent/core` or `@mtg-agent/sqlite`.

Narrow unit tests for internal parsing, rendering, or validation helpers may import from `../src/...`. If many tests need internal imports, treat that as a sign that the behaviour boundary may be unclear.

Example package shape:

```txt
packages/core/
  src/
    import-foundation.ts
  test/
    import-foundation.test.ts
    fixtures/
      manabox/
        minimal-collection.csv
```

## Fixtures

Test fixtures should be small, hand-authored, and focused on one behaviour first.

Fixtures for card identity-sensitive behaviour should use real card names and Scryfall-shaped IDs. Minimal invented metadata is acceptable where the metadata is not relevant to the behaviour under test, such as binder names, source labels, purchase prices, or locations.

Scryfall JSON fixtures should stay minimal and include only fields consumed by the code under test.

Scryfall card-shape regression fixtures may be extracted from real Scryfall bulk data and reduced to the consumed
fields. Invalid-shape tests may minimally mutate those extracted real fixtures to create the invalid condition under
test. These fixtures should remain tiny and package-local, and `bun test` must not require full Scryfall bulk files.

Anonymised real-export regression fixtures may be added later when they protect against concrete import failures that small fixtures missed.

## SQLite Integration Tests

SQLite integration tests should use real temporary on-disk database files by default.

Tests must not use the real `.data/mtg-agent.sqlite` database. Each integration test should get an isolated temporary database path and clean up temporary files after success where practical.

In-memory SQLite may be used only for narrow query tests where file-backed database behaviour is irrelevant.

Repository tests should assert repository-observable behaviour by default. They should call repository methods and assert returned records or effects.

Assert raw table contents only when testing migrations, constraints, transaction rollback, or schema-specific behaviour. Core and service tests should not inspect SQLite tables directly.

## ManaBox Import Done Bar

The first ManaBox Collection import implementation is not done until service-level tests and SQLite integration tests both pass.

Service-level tests should prove accepted and rejected import behaviour from the caller's perspective.

SQLite integration tests should prove successful Collection snapshot replacement is transactional, and that a failed import records diagnostics without replacing the previous successful Collection.

ManaBox import tests should use small package-local fixtures and must not call live Scryfall services or live LLMs as part of `bun test`.

## Scryfall Sync Done Bar

Scryfall sync should have its own tested done bar before ManaBox Collection import is considered complete.

Scryfall sync tests should prove successful and failed `ScryfallBulkDataImport` attempts are recorded, failed sync preserves the last usable dataset, `oracle_cards` imports before `all_cards`, `all_cards` rows reference existing `CardIdentity` rows, and operations that need card identity fail clearly when required Scryfall datasets are missing.

Scryfall sync tests should use small package-local Scryfall fixtures, not real Scryfall bulk data files. Real Scryfall bulk files are too large for ordinary tests and must not be required by `bun test`.

Tests must not call live Scryfall network services as part of `bun test`.

A separate opt-in large-dataset smoke test command may be added later for real Scryfall bulk data. It should not run as part of the default test suite and should not be required for ordinary TDD.

## Exact Output Tests

Exact Output Tests should be limited to deterministic outputs where exact formatting is part of the product contract.

Use Exact Output Tests for importable decklist blocks, stable tool responses where agents depend on predictable shape, and Import Summary text if its wording is intentionally treated as user-facing contract.

Do not use Exact Output Tests for live LLM output, exploratory explanations, or long Markdown sections where headings and fields matter but exact wording may evolve.

For explanatory output, prefer focused assertions such as checking that a required section exists, forbidden content is absent from a decklist block, or skipped ManaBox Lists are reported.

## LLM Boundary

The default test suite should not call live LLMs.

Test deterministic prompt inputs, retrieved context, service outputs, and rendered artifacts with normal tests. Live LLM evaluation should be explicit, separate from `bun test`, and used only when intentionally assessing model behaviour.

LLM-produced recommendations should be treated as proposals until deterministic services validate card identity, Collection status, Availability, Portable Decklist format, and Commander legality where local data supports those checks. Failed validation should produce structured failures or revision requests.
