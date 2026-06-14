# Scryfall Import Speed Improvement Grill Plan

This plan is preliminary and intended to be grilled against the docs before implementation.

## Current Implemented State

The latest Scryfall import slice moved local JSON parsing into core behind a `ReadableStream<Uint8Array>` source seam.

Implemented behaviour:

- Local Scryfall imports now pass a `ReadableStream<Uint8Array>` source from the CLI into core.
- Core parses top-level Scryfall JSON array objects from a byte stream without loading the whole source file.
- Core validates raw Scryfall source records and maps accepted records lazily through async generators.
- `all_cards` still skips valid Scryfall card objects without `oracle_id` silently.
- Repository import ports now consume `AsyncIterable<TRecord>` instead of complete in-memory arrays.
- SQLite replacement happens inside one transaction so failed imports preserve the previous usable dataset.
- Repository import methods return `Err` for expected replacement failures instead of `Ok` with a failed import attempt.
- Core records failed `ScryfallBulkDataImport` attempts when source parsing, source validation, source iteration, or repository replacement fails.
- The CLI now reports source-read progress while the stream is consumed.

## Observed Issue

Real `all_cards` imports are now very slow.

The CLI progress output appears to reach early milestones, such as 5% through 25%, relatively quickly, then slows down noticeably as the import continues. Because progress is measured by bytes read from the source stream, and that stream is backpressured by parsing, validation, mapping, and SQLite insertion, the progress slowdown likely reflects downstream pipeline throughput rather than local file read speed.

The user-facing symptom is:

- Progress advances at first.
- Later progress takes increasingly longer per 5% interval.
- The import appears to get slower as the staged dataset grows.

## Likely Culprits

### Per-Record SQLite Statement Construction

The SQLite repository currently inserts each streamed record with a separate statement inside the transaction.

For `all_cards`, this means roughly 500k insert operations for a real bulk file. Each operation currently goes through dynamically constructed Drizzle SQL or Drizzle insert builders rather than a reused prepared statement.

Likely cost:

- Repeated SQL construction.
- Repeated statement preparation or binding overhead.
- High JavaScript-to-SQLite crossing overhead per record.

### Growing Primary-Key Index On Scryfall IDs

The streamed `all_cards` implementation stages records into a temp table with `id TEXT PRIMARY KEY`.

Scryfall IDs are UUID-like, but the real performance risk depends on source order, not just ID shape. If the real `all_cards` file is ordered by Scryfall ID, maintaining the staging primary-key index is less likely to explain progressive slowdown. If records arrive in an order unrelated to `id`, maintaining a growing B-tree primary-key index for hundreds of thousands of inserts can get slower as the table grows.

This may match the observed shape, but it should be treated as a hypothesis to measure rather than the leading assumption.

### Constraint Diagnostics Strategy

The first streamed implementation intentionally relied on SQLite constraints for duplicate IDs and missing foreign-key references. To preserve useful diagnostics for missing identity references, the current implementation also stages then queries for missing identities before replacement.

The diagnostic strategy is correct for product behaviour, but the temp-table shape may be more expensive than necessary.

### Zod And Mapping Overhead

Core validates and maps every streamed record. For `all_cards`, the current path validates the raw record shape and then validates the mapped `CardPrinting` shape.

Likely cost:

- Per-record Zod validation across hundreds of thousands of records.
- Extra allocations while mapping.
- Potential duplicate raw validation in the `all_cards` path.

### Passthrough Raw Schemas Retaining Large Source Objects

Raw Scryfall schemas currently use `.passthrough()`, which accepts unknown Scryfall fields and preserves them on parsed objects.

For large real Scryfall records, this may retain much more data than the mapper needs. The import only needs a small subset of fields, so preserving unknown fields may increase allocation and garbage-collection pressure.

The intended source-format contract is to accept extra Scryfall fields, not necessarily to retain them after validation.

### Progress Measurement Ambiguity

The CLI progress message says `Read source`, but bytes-read progress is backpressured by downstream processing. This is technically accurate for consumed bytes, but it can be misleading during performance debugging.

The import may not be blocked on file IO. It is likely blocked on parser, validation, mapping, or SQLite insert throughput.

### Parser Replacement Regression Risk

The slowdown is observed before source consumption reaches 100%, and appeared after replacing the CLI-owned custom JSON tokeniser with `@streamparser/json-whatwg`. That does not prove the parser is the bottleneck, because source consumption is backpressured by validation, mapping, and staging inserts too.

Decision update from real-file profiling: `@streamparser/json-whatwg` is not viable for the hot `all_cards` path. Parser-only profiling against the real file reproduced the slowdown before SQLite was involved: the first 125k records parsed in roughly 22 seconds, then the 125k-150k interval took roughly 61 seconds. A token-like record with a large `all_parts` array showed the library path was doing expensive work for nested fields the import does not retain. Replace the hot parser path with a core-owned top-level JSON object tokenizer that streams one Scryfall card object string at a time and uses native `JSON.parse` per object.

The source seam should still remain `ReadableStream<Uint8Array>` so future local files and `fetch()` response bodies use the same core-owned parser boundary.

## Suggested Improvements

### Add Phase Timing Before Optimising

Add durable lightweight timing around import phases so real-file smoke testing can distinguish where time is spent. Timing output should be enabled by an explicit CLI flag for this slice, but the implementation should route timing events through a small import-local sink rather than scattering direct `stderr.write` calls through core and repository code. That keeps the feature compatible with a future project logging framework without introducing that framework now.

Instrumentation boundary:

- CLI owns rendering timing output and measuring local source bytes consumed.
- Core emits optional timing events for raw records parsed, accepted mapped records, skipped `all_cards` records, and source validation failures.
- SQLite repository emits optional timing events for records staged and finalization phases.
- Core and repository should not write directly to `stdout` or `stderr`.
- Use an optional import observer/event sink rather than introducing a full logging framework in this slice.
- Timing events should carry cumulative counts rather than deltas so the CLI observer can aggregate, throttle, and later batch events without losing meaning. Hot-path record counters should be emitted by core and SQLite only at intervals plus final totals, not once per record, so instrumentation does not materially distort the measured path.

Rough observer shape:

```ts
type ScryfallImportObserver = {
  onEvent(event: ScryfallImportEvent): void;
};

type ScryfallImportEvent =
  | { type: "source_bytes_consumed"; bytesConsumed: number; totalBytes?: number }
  | { type: "raw_record_parsed"; rawRecordCount: number }
  | { type: "record_mapped"; mappedRecordCount: number }
  | {
      type: "record_skipped";
      reason: "missing_oracle_id";
      skippedRecordCount: number;
    }
  | { type: "record_staged"; stagedRecordCount: number }
  | { type: "finalization_started"; phase: ScryfallFinalizationPhase }
  | {
      type: "finalization_finished";
      phase: ScryfallFinalizationPhase;
      elapsedMs: number;
    };
```

The first-pass cadence should emit hot-path record timing events every 25,000 records plus final totals. The CLI observer should render timing output at most every 5 seconds so real-file imports produce enough data to see throughput degradation without flooding stderr. CLI source-byte progress can keep its existing 5% milestones. Finalization phase events can emit immediately because they are rare.

When `--timing` is enabled, the CLI observer may sample JavaScript heap stats with Bun's `heapStats()` from `bun:jsc` while rendering throttled summaries. Do not try to include native heap or RSS interval metrics in the first pass; Bun's native allocator stats are better handled separately through environment-level diagnostics such as `MIMALLOC_SHOW_STATS=1`. Memory values are diagnostic-only and tests should not assert exact values.

Useful measurements:

- Source bytes consumed per interval.
- Raw records parsed per interval.
- Records accepted, skipped, and rejected during validation/mapping per interval.
- Records parsed/mapped per interval.
- Records staged into SQLite per interval.
- Time spent finalising from staging table into target table.
- Total transaction time.

Do not add noisy per-record logging. Prefer interval timing behind the explicit flag. The timing sink should represent structured events such as source bytes consumed, raw records parsed, records mapped/skipped, records staged, and finalization phases; CLI text rendering can remain a thin adapter over those events.

### Use Prepared SQLite Statements For Per-Record Staging

Replace dynamic per-record Drizzle SQL construction in the hot staging loop with reused Bun SQLite prepared statements.

Decision for this slice: do this after adding timing, even before real-file timings prove SQLite is the only bottleneck. It is a low-risk local optimisation that preserves the current staging shape and import behaviour while removing avoidable per-record SQL construction from the hot path.

Expected benefit:

- Avoid repeated statement construction.
- Reduce per-record overhead while keeping the streamed transaction model.

Keep Drizzle for ordinary queries if useful, but use the lower-level prepared statement API in this import hot path if tests and type boundaries stay simple.

### Stage `all_cards` Without A Primary-Key Index

For `all_cards`, consider staging into a temp table without a primary key, then perform one bulk insert into `card_printings` and rely on the real table constraints for duplicate primary keys and foreign-key failures.

Decision for the first implementation pass: do not change the staging primary key yet. This is no longer the leading hypothesis if real `all_cards` records are ordered by Scryfall ID, and removing the temp primary key changes duplicate detection mechanics. Keep this as a follow-up optimisation gated by timing evidence that staging insert cost remains high or degrades as staged-row count grows after prepared statements and validation/allocation cleanup.

Candidate flow:

- Begin transaction.
- Create temp staging table without `PRIMARY KEY`.
- Stream records into staging with a prepared insert statement.
- Query staging against `card_identities` for missing identity IDs to keep clear diagnostics.
- Query staging for duplicate Card Printing IDs to keep clear diagnostics before replacing live data.
- Delete current `card_printings`.
- Insert from staging into `card_printings` in one SQL statement.
- Let `card_printings.id` primary-key and `card_printings.card_identity_id` foreign-key constraints reject duplicates or missing references.
- Roll back on any failure.

Expected benefit:

- Avoid maintaining a growing random UUID index during staging.
- Shift constraint work to one set-based insert into the final table.
- Preserve transactional rollback.

Tradeoff:

- Duplicate IDs move from row-by-row constraint detection to a set-based diagnostic query after staging.
- Without the explicit duplicate query, duplicate diagnostic wording would fall back to SQLite constraint wording during final insertion.

### Consider The Same Staging Shape For `oracle_cards`

For `oracle_cards`, staging without a primary-key index may also help, but final replacement is more nuanced because existing `card_printings` can reference identities.

Candidate flow:

- Stage identities into an unindexed temp table.
- Query existing `card_printings` for identities that would be orphaned by the replacement.
- Update/insert identities from staging.
- Delete identities not present in staging only after orphan checks pass.
- Let final table primary-key constraints reject duplicate staged identity IDs.

This needs careful grilling because `oracle_cards` replacement has stronger referential preservation constraints than `all_cards`.

### Strip Unknown Raw Scryfall Fields After Validation

Change raw Scryfall source schemas from legacy `.passthrough()` usage to default `z.object()` stripping unless docs establish that unknown fields must be preserved after validation. In Zod 4 terms, do not use `z.looseObject()` here because the importer should accept unknown Scryfall fields without preserving them on parsed objects.

Decision for this slice: do not preserve unknown raw Scryfall fields. Use default stripping for raw Scryfall card schemas, including nested source-format objects such as `legalities`, unless a concrete downstream need to retain unknown fields appears.

Expected benefit:

- Accepts extra Scryfall fields as before.
- Avoids carrying huge source objects through mapping.
- Reduces allocation and garbage-collection pressure.

Decision to grill:

- Resolved: accepting unknown source fields is enough. No downstream code should rely on preserving fields outside the mapped `CardIdentity` and `CardPrinting` subsets.

### Remove Duplicate `all_cards` Validation Work

Simplify the `all_cards` lazy mapping path so each raw item is validated once as raw source, then mapped directly when it has `oracle_id`.

Decision for this slice: remove duplicate raw validation in the same slice as timing and prepared statements. Keep `CardPrintingSchema` validation after mapping for now as a domain-output guard, and do not combine this with schema-stripping changes unless measurements justify it.

Expected benefit:

- Less per-record CPU work.
- Less allocation.

This is likely smaller than the SQLite improvements, but cheap and aligned with keeping the hot path simple.

### Clarify Progress Output

Adjust progress wording or add a separate record-progress line so operators understand the import is pipeline-progress, not pure file-read speed.

Possible wording:

- `Consumed source: 25% (...)`
- `Imported records staged: 125000`
- `Finished consuming source; finalizing database replacement...`

Do not make output too chatty by default.

## Proposed Implementation Order

1. Add `--timing` interval timing for real-file smoke testing, separating parser throughput, validation/mapping throughput, SQLite staging throughput, and final database replacement time through an import-local event sink that can later be backed by project logging.
2. Replace per-record dynamic SQLite inserts with prepared staging statements while preserving the current staging table constraints and behaviour.
3. Remove duplicate `all_cards` raw validation work while preserving mapped `CardPrinting` validation.
4. Switch raw Scryfall schemas away from legacy `.passthrough()` and use default `z.object()` stripping so unknown source fields are accepted but not preserved.
5. Re-run `mise exec -- bun run typecheck`.
6. Re-run `mise exec -- bun test`.
7. Run a manual real-file smoke import for `oracle_cards` and `all_cards`, comparing per-interval timings before and after.
8. Use timing evidence to decide whether a follow-up should change `all_cards` staging to avoid a primary-key index and add an explicit duplicate-ID diagnostic query.

## Test Expectations

- Add CLI coverage that `--timing` is accepted and emits at least one timing-oriented line for small fixtures.
- Do not assert exact durations, memory values, throughput, or 25,000-record interval behaviour in automated tests.
- Add or adjust core schema tests to prove unknown Scryfall fields are accepted but not preserved on parsed raw records.
- Preserve existing behaviour tests for successful imports, failed imports, failed-import records, and previous usable dataset preservation.
- Do not add real-file `all_cards` performance tests to the automated suite. Keep real-file performance comparison as manual smoke testing.

## Behaviour To Preserve

- No live Scryfall download in this slice.
- Missing local files remain CLI source-resolution failures and do not create import records.
- Source parse and validation failures still create failed `ScryfallBulkDataImport` attempts after the source reaches core.
- Failed repository replacement still preserves the previous usable dataset.
- `all_cards` still requires a latest successful `oracle_cards` import before reading source.
- Valid `all_cards` objects without `oracle_id` are still skipped silently.
- Repository import methods still return `Ok` only for successful replacements.
- Failed replacement attempts are still recorded by core, not returned as `Ok(failedAttempt)` by repository import methods.

## Questions For Grill

- Should duplicate ID diagnostics remain specific, or is SQLite constraint wording acceptable for this hot path?
- Is staging without a primary-key index acceptable if duplicate detection moves to final target-table insertion?
- Should progress output remain byte-based, or should record-count progress be added even though total record count is unknown before parsing?
- Should raw Scryfall schemas strip unknown fields after validation, given the mapper only needs a subset?
- Should prepared statements live in the SQLite repository implementation only, or is a small import-specific helper warranted?
- Should timing output use a dedicated `--timing` flag and an import-local event sink that can later route to project logging?

## Grill Resolutions

- Replaced the `@streamparser/json-whatwg` hot path after parser-only profiling reproduced the slowdown without SQLite. Core now owns a top-level Scryfall JSON object tokenizer over `ReadableStream<Uint8Array>` and parses each card object with native `JSON.parse`.
- Treat the random-UUID staging-index hypothesis as weaker if the real `all_cards` file is ordered by Scryfall ID. Source order, not UUID appearance alone, determines whether the B-tree insertion pattern is likely to degrade progressively.
- Keep Scryfall IDs as the final `CardIdentity.id` and `CardPrinting.id`. Do not introduce internal UUIDv7-style IDs for this performance issue.
- If `all_cards` temp staging drops its primary key, add an explicit set-based duplicate-ID diagnostic before deleting or replacing live `card_printings`.
- Add timing output behind a dedicated `--timing` flag. Do not implement the future logging framework in this slice, but avoid hard-wiring timing writes throughout the pipeline; use a small import-local timing/event sink so the output path can later be replaced by robust logging.
- Let CLI render timing output while core and SQLite emit optional import timing events. Core should report parser/validation/mapping events; SQLite should report staging/finalization events. Neither layer should write directly to CLI streams.
- Use cumulative-count timing events, emitted at intervals plus final totals for hot-path record counters. Do not emit observer events or CLI output for every parsed or staged record.
- Use 25,000-record timing event intervals for parser/mapping/staging counters, plus final totals. Render `--timing` summaries at most every 5 seconds.
- Include lightweight JavaScript heap stats in `--timing` summaries if `bun:jsc` `heapStats()` is easy to use from the CLI. Do not add native heap/RSS interval metrics or heap snapshots in this slice.
- Test `--timing` presence without locking exact timing or memory values. Test Scryfall unknown-field behaviour as accepted but stripped, not rejected and not preserved.
- Implement prepared SQLite staging statements in this slice after adding timing. Do not wait for smoke-test proof because this preserves behaviour and removes obvious hot-loop overhead. Keep staging primary-key changes and parser replacement evidence-driven.
- Remove duplicate `all_cards` raw validation in this slice, but keep mapped `CardPrinting` validation as a domain-output guard for now.
- Replace raw Scryfall schema `.passthrough()` usage with default `z.object()` stripping in this slice. Unknown Scryfall fields should remain accepted but should not be preserved on parsed raw records.
- Do not remove the `all_cards` temp staging primary key in the first implementation pass. Revisit unindexed staging only if timing still points to staging insert cost after prepared statements and validation/allocation cleanup.

## Done Bar

This slice is done when:

- Real `all_cards` import no longer slows dramatically as the import progresses, or the remaining bottleneck is measured and documented.
- The repository still streams records and does not accumulate the full mapped dataset in core memory.
- SQLite replacement remains transactional and preserves previous usable datasets on failure.
- Successful and failed import behaviours remain covered by tests.
- `mise exec -- bun run typecheck` passes.
- `mise exec -- bun test` passes.
