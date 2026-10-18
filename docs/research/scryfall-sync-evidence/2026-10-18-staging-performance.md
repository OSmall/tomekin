# Coordinated sync staging verification — 18 October 2026

The first coordinated-refresh implementation streamed each TEMP-table insert in autocommit mode. Small fixtures fit
SQLite's cache and masked the cost; larger staging tables spilled to disk and exposed substantial per-row transaction
overhead. The repair batches TEMP writes in a deferred transaction, commits that transaction before migration discovery,
and retains the separate immediate publication transaction and concurrent-state check. Live data remains writable during
staging. CLI output now reports staged record counts independently of the eventual publication result.

## Local performance probes

These are individual diagnostic samples, with logging disabled, rather than CI timing assertions or throughput promises.
The synthetic probe runs the actual command, real temporary SQLite, and injected source ports.

| Probe | Before | After |
| --- | ---: | ---: |
| Command with 30,000 tiny Oracle records | 24.95 s | 3.31 s |
| Oracle staging within that command | 24.23 s | 1.92 s |

A separate debug-logging probe showed additional overhead, but the scaling regression reproduced with logging disabled.
The deterministic regression test asserts transaction batching, independent live writes during staging, transaction
release before discovery, and safe rejection after a concurrent write; it does not assert wall-clock timing.

## Affected populated database copy

A complete command replay used an isolated copy of the affected populated database, the three public bulk files already
downloaded by the interrupted command, and previously captured official migration pages. It performed no new source
requests and left the original database unchanged. Cached source identity is pinned below by compressed-file SHA-256;
source update timestamps were not inferred from filesystem timestamps.

| Incoming dataset | Committed records | Compressed source SHA-256 |
| --- | ---: | --- |
| Oracle Cards | 38,861 | `01617c9da554147f055faf7b67f325ffa355d35fb59d987fa21eff6a51cff9f7` |
| All Cards | 546,406 | `23386b8c8e8addb75b4572e74e6b5c8e066cb4cdfa1321ccfc6fb75052c3ad4b` |
| Oracle Tags | 4,578 | `5a41fe4838d69b0b7941f5c3e1e117164b480237ac392381e5cf78a51858cdec` |

The complete refresh succeeded in 102.68 seconds; Oracle staging completed in 4.34 seconds. Discovery needed one cached
migration page. Successful import history gained exactly three records, and application history recorded 221 official
migrations. Committed Card Identity membership exactly equalled the incoming Oracle IDs, with zero foreign-key
violations. Collection and candidate table counts and protected-content hashes matched before/after. The comparison
permits only the specified Printing/Identity reference remaps and affected candidate revision timestamps; ownership
metadata, selected quantities/sections, options, contributions and other authored content remain protected.

Private database contents, names, hashes of private content and affected-ID lists are omitted. This cached-source replay
verifies populated reconciliation and publication; live HTTP pacing/retry behavior has separate fake-clock adapter and
process-owner coverage in the default suite.

A second replay deliberately supplied malformed All Cards input after staging the real Oracle source. It rejected the
refresh with a source-validation diagnostic. The entire copied database file remained byte-for-byte identical to its
pre-attempt state, including reference/user data and successful/application history, with zero foreign-key violations.

The maintainer subsequently confirmed that the complete live `bun run sync:scryfall` command succeeded on
18 October 2026, providing manual acceptance alongside the copied-database checks above.
