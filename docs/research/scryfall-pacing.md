# Scryfall search pacing and cooldown research

Date: 2026-10-17 (Australia/Sydney). Investigation:
[Measure Scryfall search pacing and cooldown behavior](https://github.com/OSmall/tomekin/issues/82).
This is research evidence for the pending provider, not delivered application behavior.

## Documented contract

Current official guidance gives `GET /cards/search` a hard limit of two requests per second,
expressed as 500 ms. Receiving HTTP 429 restricts access for 30 seconds; repeated overload can
lead to an application ban. The guidance encourages caching downloaded data for at least 24 hours.
It does not describe the limiter algorithm, bucket/window boundaries, whether different endpoint
limits share a bucket, or whether identity is measured by address, process, application, or another
scope. It does not document a `Retry-After` guarantee.
Source: [Scryfall rate limits](https://scryfall.com/docs/api/rate-limits), retrieved directly on the
research date and independently through Context7's indexed official documentation.

All requests to `api.scryfall.com` require both `User-Agent` and `Accept`. A script must set an
accurate application identity itself, rather than inheriting its HTTP library's default. An
explicit `Accept: application/json` suits this JSON benchmark.
Source: [Scryfall API overview, required headers](https://scryfall.com/docs/api-overview#required-headers).

Search returns 175 cards per page, with a numbered `page` parameter defaulting to 1. The
documented search parameters do not offer a configurable page size. Final pages can contain
fewer cards. The benchmark must record actual counts rather than multiply every successful
response by 175. Search does not perform the website's spelling correction or automatic retries.
Source: [Scryfall search endpoint](https://scryfall.com/docs/api/cards/search).

A List's `has_more` indicates another page; `next_page` supplies a complete API URL to fetch.
`total_cards` is an upstream search total across pages, not a count of Tomekin-owned matches.
Follow the supplied URL after validating its allowed origin/path; do not manufacture concurrent
requests for unknown page numbers. Nonfatal List `warnings` can mean an input did not obtain
all requested information and should be surfaced in observations.
Source: [Scryfall List objects](https://scryfall.com/docs/api/lists).

HTTP 429 may include `Retry-After`, but the standard makes that header optional and does not
specify the server's counting or client-identification strategy. A missing header therefore
cannot mean there is no cooldown. Source:
[RFC 6585, section 4](https://www.rfc-editor.org/rfc/rfc6585#section-4).
The field accepts either a nonnegative integer delay in seconds or an HTTP date. Source:
[RFC 9110, section 10.2.3](https://httpwg.org/specs/rfc9110.html#field.retry-after).

## Documentation retrieval

The repository-required Context7 sequence was run outside the default sandbox, exactly three
commands for the Scryfall question:

```sh
npx ctx7@latest library "Scryfall" "REST API request rate limit required User-Agent Accept headers"
npx ctx7@latest docs /websites/scryfall_api "API traffic limits requests per second delay required User-Agent Accept headers rate limit HTTP 429 Retry-After"
npx ctx7@latest docs /websites/scryfall_api "GET /cards/search List pagination cards per page next_page total_cards has_more pages"
```

The resolved source was `/websites/scryfall_api` (High source reputation). Direct HTML retrieval
of the rate-limit, search, and overview pages confirmed the indexed claims. The web browsing
service returned HTTP 403 for those pages; ordinary direct HTTPS document retrieval succeeded.
That difference does not establish any API admission behavior.

## Live measurements

Run: 2026-10-17 16:41:06–16:41:45 Australia/Sydney (05:41:06–05:41:45 UTC).
Bun **1.3.14**, Zod **4.4.3**, darwin/arm64. Assets:
[scratch TypeScript POC](scryfall-pacing-evidence/scratch.ts),
[raw live timings](scryfall-pacing-evidence/live.json), and
[deterministic fixture results](scryfall-pacing-evidence/fixtures.json).

From the repository root, with its existing dependencies installed:

```sh
bun docs/research/scryfall-pacing-evidence/scratch.ts --self-test
bun docs/research/scryfall-pacing-evidence/scratch.ts --live --out=/tmp/tomekin-scryfall-pacing.json
```

The scratch file imports the core package's already installed Zod; no new package or lockfile
change is required. Native `fetch`, `AbortSignal`, monotonic `performance.now()` and Zod are
suitable provider building blocks. The existing bulk sync also uses native `fetch` with
explicit headers. Zod here validates the list envelope and each Card's object/Printing ID,
not the complete future provider projection. See [Bun fetch](https://bun.sh/docs/api/fetch)
and [Zod object validation](https://zod.dev/api#objects), retrieved through Context7 separately.

Query: `q=game:paper&unique=prints&order=set&dir=asc`. The experiment made **48 requests**,
four runs of 12 supplied-next-page requests, with policies start/completion/completion/start
(ABBA), 550 ms minimum configured spacing, and two quiet seconds between runs. Each run had
a 120-second maximum deadline, a 12-page cap, and stopped on any error. The first 429 would
have stopped the entire experiment without a retry and written a cooldown marker under
`/tmp` to prevent an immediate scratch-process restart. No private Collection or session
data was read or saved; the artifacts contain only public URLs and timing/count metadata.

Every request set:

```text
User-Agent: Tomekin-Pacing-Research/0.0.0 (https://github.com/OSmall/tomekin/issues/82)
Accept: application/json
```

All 48 responses were HTTP 200, all contained 175 cards and `has_more=true` with a next-page
URL, and all four runs stopped at the page cap. There were **no 429 responses**, and
`Retry-After` was absent from all responses. The initial run reported `CF-Cache-Status: MISS`
for every page; all later runs reported `HIT`, with `Age` 8–32 seconds. This explains why the
initial run is unsuitable as an isolated comparison with a later completion-based run.
No cache-bypass directives or random-query cache busting were used. Warning values were not
captured by this narrow POC and are not asserted absent.

| Run | Policy / cache | Duration | Mean start gap | Mean header latency | Mean transfer | Mean JSON / validation | Steady 120s raw-card projection |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Start / MISS | 14.847s | 1,243.31ms | 1,190.36ms | 38.75ms | 5.70 / 1.19ms | 16,800 |
| 2 | Completion / HIT | 6.443s | 581.47ms | 25.42ms | 4.24ms | 7.09 / 0.71ms | 36,050 |
| 3 | Completion / HIT | 6.460s | 583.17ms | 24.69ms | 6.26ms | 7.71 / 1.74ms | 35,875 |
| 4 | Start / HIT | 6.099s | 551.47ms | 24.50ms | 3.89ms | 5.80 / 0.71ms | 37,975 |

Each run transferred 2,100 raw records; the experiment transferred 8,400 total, revisiting the
same first 2,100 results. Body completion, UTF-8 decoding, JSON parse and Zod validation have
separate monotonic timestamps/durations in the raw artifact. Body byte counts are decompressed
payload bytes, not network-wire bandwidth. Header latency includes all pre-header work and
network time; this POC cannot isolate server compute time.

The comparable HIT runs show completion-based spacing adding about **30–32 ms** to the mean
start interval, roughly **5–6%** relative to the HIT start-based run. The MISS run was already
slower than 550 ms, so the start gate did not add waits there. A deterministic 800 ms response
fixture demonstrates the larger possible cost: starts are 800 ms apart under start pacing,
versus 1,350 ms under completion pacing. This is a constructed comparison, not a second live
MISS/completion measurement.

The projection uses `floor(120000 / mean_start_gap_ms) × observed_mean_page_size`. It is an
extrapolation of short-run steady intervals with whole pages, **not a measured two-minute
scan**, independent confidence interval, or promised owned-card coverage. Dividing the entire
12-page batch count by its duration exaggerates sustained throughput because its first
dispatch is free; that naive projection was removed from the saved summary after the run,
without changing any raw observations or making additional HTTP requests.

Twelve deterministic HTTP/clock fixture cases passed: both spacing clocks under 800 ms
responses; minimum/short/long/date/malformed `Retry-After`; cooldown across new invocations;
simultaneous callers; cooldown changes during a wait; late timers without catch-up bursts;
cancellation during admission and HTTP; and deadline rejection before dispatch and after a
late response. Fixtures advance virtual time and exercise the same gate/request code, while
live fetch uses an aborting deadline signal. The fake late-response case verifies rejection
of work that finishes too late; it does not measure transport abort latency. The scratch file
also passed standalone TypeScript checking. These are POC checks, not production adapter or
Worker lifecycle integration tests.

The comparison must use actual dispatch starts. Start-based mode waits until at least the
previous dispatch plus its configured interval, while still waiting for the preceding page's
body/validation to discover `next_page`. Completion-based mode waits the interval after body
completion, with parsing/validation also finishing before dispatch. A late timer must never cause several overdue requests to dispatch as a
catch-up burst. The first 429 stops the run, regardless of remaining sample budget.

## What the timing comparison can establish

The comparison measures the cost of voluntarily adding a full interval after response
completion. With body-completion duration `d`, parse/validation duration `p` and spacing `s`,
steady sequential page spacing is approximately `max(s, d + p)` for start-based mode and
`d + max(s, p)` for completion-based mode, plus timer/scheduling overhead. Header latency, transfer, parsing, cold connections, cache
state, query complexity, and run order can all affect that difference. Short runs of the same
query are samples of that workload and network path, not general latency distributions.

A successful run does not establish Scryfall's limiter implementation or guarantee future
freedom from 429. Two client starts separated by 550 ms can arrive closer together at the
server when their outbound delays differ. Completion-based spacing gives a stronger causal
ordering: the preceding response is already received before the later request is sent. It
still cannot guarantee acceptance when unrelated callers share the server's limiting scope or
when server policy changes. These are deductions from the client/server ordering, not claims
made by Scryfall's documentation.

## Production recommendation

Use one serialized admission owner for the selected live provider. Measure elapsed time with a
monotonic clock and reserve the next start relative to the actual previous dispatch. Use a
minimum of 550 ms between actual starts initially: the additional 50 ms is a deliberately
chosen 10% operational margin above the documented interval, not a measured network bound or
provider guarantee. Keep a single next-page chain sequential. The completion-based alternative
is a conservative fallback if observed operation needs more headroom; measurements should make
its throughput cost explicit before choosing it as the default.

At the first 429, atomically raise shared `blockedUntil` before releasing the admission lane.
Use at least 30 seconds from receipt, or longer if a valid `Retry-After` requires it. Never
shorten an existing cooldown. Parse integer delays strictly; convert valid future HTTP dates
to a duration at receipt, then enforce that duration monotonically. Missing, malformed, or past
values retain the 30-second minimum. Treat this as a lower bound for when another attempt may
be considered, not a promise of acceptance. Do not automatically retry a failed page inside
the benchmark. Production recovery should preserve partial progress and return explicit retry
guidance rather than conceal a long blocking retry loop.

Every admission wait counts against the scan's 120-second budget. Cancellation/deadline expiry
must remove queued work without dispatching it, abort an in-flight fetch where possible, and
leave shared pacing/cooldown state intact. A cancelled request already sent still consumes its
reserved slot. Recheck the deadline and cooldown immediately before dispatch. A timeout cannot
refund a request that may already have reached the server. Reproduce these rules with HTTP and
clock fixtures, including simultaneous callers, because an uneventful live sample does not
exercise them.

## Scan coverage arithmetic

The ideal `120 × 2 × 175 = 42,000` records assumes sustained ceiling throughput, full pages,
no expensive responses, no competing callers, no cooldown, and negligible surrounding work.
It is capacity arithmetic, not an observed throughput guarantee. A 550 ms interval reduces
steady theoretical capacity to approximately 218 pages / 38,150 raw records per 120 seconds
before other costs. Boundary conventions and completion of the last response also matter.
If sequential page processing exceeds 550 ms, it becomes the bottleneck. Local Collection
matching and response-size limits can reduce useful results further. A single mandatory
30-second cooldown consumes at least one quarter of a 120-second call's budget. The measured
start-gap projections above range from 16,800 records for the MISS sample to 37,975 for the
HIT start-based sample, versus 35,875–36,050 for HIT completion-based samples. These are
raw source records with no Collection filtering cost. They do not support promising 42,000
records in an arbitrary 120-second workload.

## Admission ownership in the current runtime

The implementation evidence rules out storing admission state only inside a freshly composed
`LocalAgentToolRuntime`:

- [OpenCode tool dispatch](../../.opencode/tools/tomekin.ts) creates a local runtime for each
  `runTool` and closes it in `finally`.
- [Shared runtime composition](../../packages/agent/src/index.ts) opens SQLite and composes
  handlers; its lifetime belongs to its caller.
- [Pi Worker transport](../../packages/pi/src/worker-transport.ts) keeps one execution lane,
  terminates its Worker on cancellable work, and lazily creates a replacement. Worker failure
  also discards the instance.
- [Pi Worker](../../packages/pi/src/tomekin-worker.ts) keeps its runtime in Worker memory and
  replaces it when the database path changes.

Inject the admission owner from a harness/session/process lifetime that outlives per-call
OpenCode runtimes and Pi Workers. For Pi, the owner must remain outside the disposable Worker
or use shared coordination that survives Worker replacement. It must govern the actual fetch
dispatch and record a 429 promptly; passing a private timer into each worker is insufficient.
Provider choice is process-wide under
[ADR 0019](../adr/0019-provider-backed-scryfall-card-search.md), so domain handlers should not
each construct an independent live-provider limiter.

Multiple simultaneous calls must share atomic reservation and cooldown state. A process-local
owner only coordinates that process: separate OpenCode/Pi/CLI processes and machines behind a
shared egress address remain outside it. Either explicitly support one live-provider process
at a time initially, or choose cross-process admission coordination before claiming combined
rate compliance. Restart recovery also needs an explicit policy if a process can restart
during cooldown. Shared timestamps/leases or a local admission broker are possible designs;
they are not a reason to introduce a search-result or cursor store. Exact cross-process
mechanics are implementation work, not established by this benchmark.
