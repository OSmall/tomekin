# Candidate edit performance: measured post-build behavior

Run `bun run evaluate:performance` for the current implementation and `bun run evaluate:legacy` for the immutable
pre-migration comparator. The captured reports are [current](candidate-performance-v1.json) and
[matched legacy rerun](candidate-performance-legacy-v1.json). The original [pre-migration checkpoint](pre-migration-v1.json)
and its pinned comparator source `3f23b7a3cbdd1d713f209e2c001934a3a36e1ecb` remain unchanged. These measurements resolve
the remaining measurement phase of GitHub #35; they do not measure a live agent session.

Both reports use Bun 1.3.14 on Darwin arm64 / Apple M1 and the same synthetic reference population. Each workload has
one first-dispatch observation, one discarded warm-up, and five recorded equivalent warm observations. Every observation
uses a fresh on-disk SQLite database. OS caches are not flushed; the second workload shares process/module caches.
Machine load, JIT/GC and OS activity are uncontrolled. Source revision, harness/fixture hashes, all raw timing samples,
min/max, median, mean and population standard deviation are included in the current report. The rerun was sequential
on this machine, not randomized or CPU-isolated. The legacy report retains its original statistics format.

The tuning fixture replaces three identities in 12 selected rows / 60 copies. The size probe replaces three in 69 selected
rows / 100 copies, using synthetic Casual 60 records; this is a Commander-sized population, not a legal Commander deck.
The tuning fixture's five-copy nonbasic rows deliberately fail legality. Successful mutation is not successful validation.
Both preserve cut options, contextual contribution references and complete final selection. The new harness assigns the
same synthetic owned rows to a current successful Collection import and confirms binder policy before measurement.
All three explicit check evidence kinds are absent after editing and applicable after their requested checks; checks
preserve the exact edit timestamp. Final joint Availability is complete and establishes a shortage: tuning has 7 eligible
recorded copies / 53 Missing-owned copies; the empty-owned size probe has 100 Missing-owned copies. Neither is assemblable.

## Observed timings

Milliseconds; warm median [minimum–maximum] over five samples. These are fixture observations, not service guarantees.

| Stage | 12-row cold | 12-row warm | 69-row cold | 69-row warm |
| --- | ---: | ---: | ---: | ---: |
| Atomic three-card edit | 12.38 | 5.54 [4.47–10.71] | 7.67 | 7.36 [5.71–11.63] |
| Explicit legality | 22.55 | 8.90 [6.49–14.88] | 26.10 | 31.81 [23.10–35.92] |
| Explicit evaluation | 11.85 | 6.80 [6.62–8.52] | 25.66 | 29.99 [23.22–31.35] |
| Explicit final Availability | 17.66 | 11.73 [8.46–15.93] | 30.89 | 33.64 [28.26–34.52] |
| Edit + three requested checks | 64.44 | 35.73 [30.78–36.78] | 90.33 | 103.69 [80.29–113.42] |
| Complete saved JSON read after checks | 17.66 | 14.11 [13.53–19.38] | 31.62 | 37.73 [36.74–54.59] |
| Edit, checks, complete optional outputs and replacement facts | 87.68 | 51.26 [44.59–57.04] | 148.22 | 159.39 [130.09–195.09] |
| Actual Pi edit: new Worker | 107.25 | 120.68 [95.80–148.61] | 130.34 | 146.97 [109.60–180.12] |
| Actual Pi edit: reused Worker | 6.79 | 10.70 [5.62–26.78] | 12.20 | 15.19 [10.32–18.04] |

Paired composite timings add stages from the same observation, not independently selected medians. They exclude
fixture setup, initial creation, benchmark verification reads and duplicate adapter probes. Optional outputs include
all report, Portable Decklist and Pull List pages, plus one batch of complete selected replacement facts. There is no
provider call, broad repeated deck retrieval, network or model. Application and OpenCode serialization are measured
separately (warm medians below 0.1 ms here). Logging is disabled in both reports; logging cost is unmeasured and no
attribution to logging is made. Cold/reused Worker edit samples use separate equivalent candidates so there is no replay
of a mutation or stale timestamp. Pi fallback executes the actual tool and its runtime; OpenCode uses the actual result
serializer, with schema/tool loading already covered by adapter integration tests elsewhere.

The largest measured adapter cost is starting a Worker, which happens once per ordinary session and is isolated here
from reused-Worker dispatch. Among local work, complete evidence reads/reports and the explicitly requested checks
cost more than the small edit. No measured local stage supports a six-minute bottleneck attribution. These small
synthetic populations also cannot identify costs in a substantially larger reference database or long-running session.

The achieved descriptive target is **under 12 ms for each observed direct edit and under 114 ms for each observed edit
plus the three complete requested checks**. Including complete optional outputs and replacement lookup remains under
196 ms for these observations; separately, each measured new-Worker edit is under 181 ms. These bounds are rounded
observed maxima across cold and warm samples, chosen after measurement, not prior SLA claims, percentile estimates or
CI timing assertions. The paired edit/check standard deviations are 2.14 ms (12 rows) and 11.12 ms (69 rows).

No source optimization is justified by this evidence. Removing checks, dropping reasoning, caching stale evidence,
reducing required facts or weakening atomicity would change the task being measured. Worker startup already has a
session-scoped reuse path. Extra telemetry or a speculative cache would add complexity without an identified material
local bottleneck. The implemented targeted edit and explicit-check split deliver the adopted behavior; their cost is
reported honestly, including added persistence and proof work.

## Legacy comparison and completion

The matched legacy tuning replacement-save median is 5.34 ms [3.10–15.02]; the old 69-row replacement-save probe is
5.03 ms [4.73–9.13]. Old saves perform automatic checks and return full old candidate records; the new edit does no
automatic deck checks and returns a compact acknowledgement. The old tuning explicit legality/evaluation medians are
18.47 / 7.65 ms; they accept repeated whole card arrays, while current checks load the saved exact-timestamp baseline
and publish reusable evidence. There is no old equivalent of complete joint Availability, structured pool/plan reasoning
or recoverable full current reports. These observations **do not establish an end-to-end speedup**. In particular, the
new 69-row direct edit median exceeds the old save median, and the complete new check pipeline performs additional work.

| Required result | Legacy comparator | Current harness |
| --- | --- | --- |
| Three additions and three cuts; 12/60 and 69/100 final selection | Complete | Complete, asserted through public paged reads |
| Cut alternatives and their reasoning retained | No corresponding pool/plan contract | All three retained; stable role references checked |
| Complete selected replacement facts | Legacy query can clip/truncate; not a completion-equivalent comparator | Batched local lookup with complete selected facts |
| Explicit saved matching check evidence | Whole-input findings, no equivalent reuse contract | All three evidence kinds applicable; content timestamp unchanged |
| Final joint owned-copy proof and shortages | Unsupported | Complete, shortage visible; complete Pull List recovered |
| Complete optional report/decklist/Pull List | No corresponding complete current report/Pull List contract | Every page consumed; 12/69 selected decklist rows asserted |

The old tuning create+replacement inputs total 3,374 bytes (including repeated Brief and nine unchanged membership
rows). The new edit alone is 1,670 bytes and repeats neither Brief nor unchanged memberships; this is almost the same
size as one old tuning save, because the new change set also carries contributions and stable references. For 69 rows,
the old whole-save input is 8,539 bytes versus 1,671 for the new edit. The compact new acknowledgement is 1,232/1,233
bytes versus the old 69-row 11,325-byte full result. These are interface payload differences, not total context savings:
complete current reports are 51,865 bytes over 3 pages / 126,080 over 8; Pull Lists are 15,599 / 43,506 bytes. Extra
required reasoning and proof must not be counted as avoidable overhead or omitted to obtain a flattering byte ratio.

The reported historical approximately six-minute interactive substitution has no captured stage timing, model/network
latency breakdown, matching corpus size or complete context oracle. It remains unexplained by these fixture results.
Private sessions, live user databases, provider/model calls and human strategic/confirmation quality are excluded.
Agent-owned confirmation remains a workflow obligation; this noninteractive synthetic benchmark cannot validate it.
