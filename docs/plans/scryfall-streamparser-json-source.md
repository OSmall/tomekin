# Scryfall Streamparser JSON Source Slice

Status update: the `@streamparser/json-whatwg` parser choice from this slice was later replaced for the hot import path after real `all_cards` profiling showed severe slowdown on large nested Scryfall objects. The lasting decision from this slice is the core-owned `ReadableStream<Uint8Array>` source seam and streamed repository import shape, not the specific parser library.

This plan is preliminary and intended to be grilled against the docs before implementation.

## Goal

Replace the current custom local JSON-array streaming logic with a maintained streaming JSON parser and stream accepted records into repository staging so large Scryfall bulk data files can be imported safely from local files now and from future downloads later.

The immediate motivator is real `all_cards` imports: the file is roughly 2.5 GB with about 500k records, too large to load with `text()` and `JSON.parse()`, and large enough that accumulating all mapped `CardPrinting` records in memory is also unnecessary pressure. Hand-written JSON parsing at the CLI boundary is not a good long-term ownership choice.

## Scope

Implement the minimum source-parsing slice for Scryfall Bulk Data Import:

- Use `@streamparser/json-whatwg` for streaming top-level JSON array items.
- Keep local file import working through `Bun.file(path).stream()`.
- Shape the source seam around `ReadableStream<Uint8Array>` so core can parse both local file streams and future `fetch()` response bodies through the same parser path.
- Remove the custom character-by-character parser from `packages/cli`.
- Move JSON source parsing into `@mtg-agent/core` so the parser, raw Scryfall source-format validation, and mapping live behind the same reusable import rules.
- Enforce the expected Scryfall bulk file shape in core: the source must be a top-level JSON array, and records inside that array must satisfy the existing raw Scryfall source-format schemas.
- Preserve current `all_cards` handling for valid Scryfall card objects without `oracle_id`: skip them silently rather than adding warnings or failures in this parser slice.
- Preserve failed-import non-destructiveness by performing streamed replacement inside one repository transaction; rollback must leave the previous usable dataset intact.
- Stream accepted mapped records into the repository for replacement, especially for `all_cards`, instead of accumulating the full mapped dataset in core memory.
- During streamed repository replacement, stage records transactionally and use set-based database checks plus target table constraints for duplicate primary keys and missing foreign-key references rather than retaining large in-memory ID sets for diagnostics.
- Cap source-format validation diagnostics for streamed imports, for example at 20 item-level errors, then fail the import instead of collecting unbounded errors across a huge file.
- Keep the first SQLite streamed implementation simple with one Drizzle insert per yielded record inside the transaction. Defer prepared statements or batch inserts unless real-file smoke testing shows the simple path is too slow.
- Align Scryfall import Results with project Result semantics: repository import methods should return `Ok` only for successful replacements. Expected import rejections such as duplicate IDs, missing foreign-key references, parse/validation failures thrown while consuming the record stream, or source iteration failures should return `Err` with blocking diagnostics so core can record a failed `ScryfallBulkDataImport` attempt.
- Preserve transactional repository replacement and failed-import recording behaviour.
- Preserve the current command shape and user-facing output contract.
- Preserve the current boundary where missing local files are CLI source-resolution failures that exit non-zero without creating a `ScryfallBulkDataImport` record.
- Record a failed `ScryfallBulkDataImport` when a resolved source reaches core but `source.stream()` throws or the returned stream fails during parsing.

Do not implement live Scryfall downloads in this slice.

Do not add background sync, automatic refresh, retries, caching, or decompression in this slice.

Do not weaken the rule that a failed import preserves the previous usable dataset.

## Parser Choice

Prefer `@streamparser/json-whatwg` for this slice.

Reasons:

- `Bun.file(path).stream()` returns a WHATWG `ReadableStream`.
- Future `fetch(url).body` also returns a WHATWG `ReadableStream`.
- The same adapter can parse local files and future HTTP responses.
- It avoids project-owned JSON tokenisation logic.

Known tradeoff:

- `stream-json` is more mature and more popular, but it is Node stream first. That is acceptable in many apps, but this project expects future Scryfall downloads through web-stream-shaped `fetch()` sources, so the WHATWG parser is the cleaner architectural fit if Bun compatibility is proven by tests.

## Proposed Source Shape

Core should own Scryfall JSON source parsing from a WHATWG byte stream. The CLI should only resolve the local file and hand core a source that can open a `ReadableStream<Uint8Array>`.

One possible shape:

```ts
export type ScryfallBulkDataSource = {
  stream(): ReadableStream<Uint8Array>;
};
```

Use a factory method rather than a stream property because `ReadableStream` instances are one-shot once consumed. The source object should expose how to open the stream when core is ready to import.

Then the CLI owns local-file source construction, but not JSON parsing:

```ts
function createLocalJsonArraySource(path: string): ScryfallBulkDataSource {
  return {
    stream: () => Bun.file(path).stream(),
  };
}
```

The reusable parser adapter should live in core and remain source-agnostic:

```ts
async function* parseJsonArrayItems(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<unknown> {
  const parser = new JSONParser({
    paths: ["$.*"],
    keepStack: false,
    stringBufferSize: undefined,
  });

  const reader = stream.pipeThrough(parser).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value.value;
  }
}
```

Future download source can use the same core parser path:

```ts
stream: () => response.body
```

Because core owns this parser path, `@streamparser/json-whatwg` belongs in `@mtg-agent/core` for this slice. Do not add a separate adapter package unless reuse outside Scryfall import becomes concrete.

## Core Import Behaviour

Core should receive a stream-shaped Scryfall source and remain responsible for:

- Parsing top-level JSON array items from the source stream.
- Rejecting non-array top-level JSON values clearly instead of silently emitting zero records or treating object properties as records.
- Validating each raw Scryfall record shape.
- Collecting only a bounded number of source-format validation diagnostics before failing a streamed import.
- Mapping accepted raw records into `CardIdentity` or `CardPrinting` records lazily in a core-owned async generator.
- Passing the mapped async generator to the repository so large imports do not require a complete mapped array in core memory.
- Recording source parse and source-format validation failures as failed `ScryfallBulkDataImport` attempts.
- Recording source stream construction and stream read failures as failed `ScryfallBulkDataImport` attempts once the source reaches the import pipeline.
- Leaving missing local file handling at the CLI boundary so those failures do not create import records.
- Checking `all_cards` requires a latest successful `oracle_cards` import before reading the `all_cards` source.

This slice should remove `text(): Promise<string>` and `jsonArrayItems(): AsyncIterable<unknown>` from the core source seam if no caller still needs them. Do not keep compatibility code unless a real caller requires it.

The repository import input should change from `readonly TRecord[]` to `AsyncIterable<TRecord>` so core can pass mapped parser output directly:

```ts
export type ScryfallBulkImportInput<TRecord> = {
  readonly startedAt: Date;
  readonly sourceUpdatedAt?: Date | undefined;
  readonly sourceUri?: string | undefined;
  readonly records: AsyncIterable<TRecord>;
};
```

For streamed imports, the repository should set `completedAt` after it has consumed the record stream and the transaction has succeeded or failed. Core should still set `startedAt` before parsing begins.

Pass the application `Clock` into `createSqliteScryfallRepository(db, clock)` so repository-assigned `completedAt` remains deterministic in tests and uses the same time source as core-assigned `startedAt`. Do not use SQLite current timestamp functions for this slice.

Core should validate and map records lazily inside the async generator it passes to the repository. The repository should consume that generator inside its replacement transaction; if parsing, source-format validation, or mapping fails partway through, the transaction rolls back and the failure is recorded as a failed import.

Repository import methods should not return `Ok` with an import attempt whose status is `failed`. `Ok` means the replacement succeeded and the import attempt status is `succeeded`. Expected replacement rejections should be represented on the `Err` side, then core records the failed import attempt through `recordFailedBulkDataImport` and returns an `import_failed` service error to the CLI.

## Result Semantics Cleanup

This slice should fix the existing Scryfall repository Result-shape mismatch while touching the import pipeline.

Current mismatch:

- `importCardIdentities()` and `importCardPrintings()` can return `Ok(importAttempt)` where `importAttempt.status === "failed"`.
- Core compensates with `toSuccessfulLocalImportResult()` to convert that happy-path value back into `Err(import_failed)`.
- SQLite repository tests currently assert `isOk()` for expected import failures.

Target shape:

- Repository import methods return `Ok(successfulImportAttempt)` only when replacement succeeded.
- Expected import rejections return `Err` with blocking diagnostics, for example duplicate primary keys, missing foreign-key references, or source iteration failures while consuming the record stream.
- Core records failed `ScryfallBulkDataImport` attempts by calling `recordFailedBulkDataImport()` when it handles expected import rejections.
- `recordFailedBulkDataImport()` may still return `Ok(failedImportAttempt)` because the operation it represents is specifically recording a failed attempt; that is its happy path.
- Remove `toSuccessfulLocalImportResult()` once import methods no longer return failed attempts on `Ok`.
- Update repository and service tests so expected import failures are asserted on the `Err` side, while recorded failed-attempt persistence is asserted separately.

## Test First

Use `bun test` and follow [`docs/testing.md`](../testing.md).

Tests should use small fixtures and temporary SQLite databases. They must not require real Scryfall bulk files or live Scryfall services.

### Parser Adapter Tests

Add focused tests for the parser adapter:

- Parses a top-level JSON array from a local Bun file stream.
- Emits one value per array item in order.
- Handles objects containing nested arrays, nested objects, escaped strings, braces in strings, and Unicode text through the library parser.
- Fails clearly for malformed JSON.
- Fails clearly when the top-level JSON value is not an array.

These tests should prove we no longer own tokenisation edge cases while still enforcing the expected Scryfall bulk file shape.

### Repository Streaming Replacement Tests

Update SQLite repository tests to prove transactional streamed replacement preserves current datasets without requiring all records in memory:

- Successful streamed `oracle_cards` import records success and exposes Card Identities.
- Successful streamed `all_cards` import records success and exposes Card Printings.
- Duplicate IDs in the streamed source fail through SQLite primary-key constraints, record a failed `ScryfallBulkDataImport`, and preserve the previous usable dataset through transaction rollback.
- `all_cards` records referencing missing Card Identity IDs fail through staged database validation or SQLite foreign-key constraints, record a failed `ScryfallBulkDataImport`, and preserve the previous usable Card Printing dataset through transaction rollback.
- Source iteration failure during streamed repository replacement records a failed `ScryfallBulkDataImport` and preserves the previous usable dataset.
- Source-format validation over many invalid records records only the capped diagnostics and preserves the previous usable dataset.

### CLI/Core Behaviour Tests

Update existing CLI/core tests as needed so they prove behaviour through the new source seam:

- Valid `oracle_cards` and `all_cards` fixtures still import successfully.
- Invalid JSON still exits non-zero, records a failed `ScryfallBulkDataImport`, and preserves the previous usable dataset.
- A source stream failure records a failed `ScryfallBulkDataImport` after the source reaches the import pipeline.
- Missing local files still exit non-zero without creating a `ScryfallBulkDataImport` record.
- `all_cards` still fails before reading the source when there is no latest successful `oracle_cards` import.

## Implementation Steps

1. Add `@streamparser/json-whatwg` to `@mtg-agent/core`.
2. Add a small core parser adapter that accepts `ReadableStream<Uint8Array>` and returns `AsyncIterable<unknown>` for top-level JSON array items.
3. Add parser adapter tests using package-local small fixtures or inline temp files.
4. Replace the custom `parseJsonArrayFile` implementation in `packages/cli` with a source object whose `stream()` method returns `Bun.file(path).stream()`.
5. Simplify `ScryfallBulkDataSource` so core consumes `stream(): ReadableStream<Uint8Array>` as the only source path.
6. Remove `text(): Promise<string>` and `jsonArrayItems(): AsyncIterable<unknown>` from the Scryfall import source type if no tested caller still needs them.
7. Change the repository port so Scryfall import methods consume `AsyncIterable<TRecord>` instead of a complete readonly array, and move successful/failed streamed import `completedAt` assignment into the repository.
8. Implement SQLite streamed replacement in one large transaction: validate preconditions, stage mapped records as they are yielded with simple per-record Drizzle inserts, run set-based validation needed for clear diagnostics, replace the target table only after staging succeeds, and rely on rollback to preserve the previous usable dataset on failure.
9. Change Scryfall import Result handling so repository import methods return `Err` for expected import rejections and core records the failed `ScryfallBulkDataImport`; do not return `Ok` containing a failed-status import attempt from import methods.
10. Pass the shared application `Clock` into SQLite repository construction so repository-generated completion timestamps remain deterministic.
11. Keep source metadata handling unchanged: required `sourceUri`, optional `sourceUpdatedAt` when known.
12. Run `mise exec -- bun run typecheck`.
13. Run `mise exec -- bun test`.
14. Optionally run a manual local smoke import against a real `oracle_cards` file and a real `all_cards` file outside the default test suite. Do not add a dedicated smoke script or skipped large-file test in this slice.

## Output Expectations

User-facing command output should not materially change in this slice.

On parser failure, output should still include:

- Failed dataset.
- Previous usable dataset preservation statement.
- Target database path.
- Source file path.
- A clear blocking parse error.

Do not lock exact parser or SQLite constraint wording in tests unless the wording is intentionally part of the product contract.

## Done Bar

This slice is done when:

- The project no longer contains custom JSON tokenisation logic for Scryfall file imports.
- Local Scryfall imports parse through `@streamparser/json-whatwg` in core.
- Core does not accumulate a complete mapped `all_cards` dataset before handing records to the repository.
- SQLite replacement preserves previous usable datasets while importing streamed records through one repository transaction.
- Scryfall repository import methods no longer return `Ok` values containing failed import attempts.
- The parser adapter can be reused for future `fetch()` response bodies without changing core import rules.
- Successful and failed import behaviours remain covered by tests.
- Default tests do not require real Scryfall bulk files or live network calls.
- `mise exec -- bun run typecheck` passes.
- `mise exec -- bun test` passes.

## Open Questions For Grill

- Resolved: `@streamparser/json-whatwg` should live in `@mtg-agent/core`; core owns the `ReadableStream<Uint8Array>` to parsed item conversion.
- Resolved: do not lock exact parser or SQLite constraint wording in tests. Assert stable behaviour, preservation, and useful diagnostic categories rather than library- or database-specific messages.
- Resolved: preserve current behaviour for valid `all_cards` records without `oracle_id`; skip them silently. Warning semantics are source-format behaviour, not part of this parser replacement slice.
- Resolved: keep real-file smoke testing as manual optional verification for this slice; do not add a dedicated opt-in command yet.

## Follow-Up Slice

After this slice, implement live Scryfall bulk data discovery/download as a separate feature if product scope confirms it. That follow-up should reuse this parser source seam rather than adding a separate download-specific parser path.
