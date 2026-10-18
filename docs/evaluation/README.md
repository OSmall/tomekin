# Synthetic pre-migration evaluation

Run `bun run evaluate:baseline` from the workspace root. It emits JSON and requires no network, model, private session,
or user Collection. `pre-migration-v1.json` is the recorded baseline. Candidate latency interpretation and improvement
belong exclusively to [issue #35](https://github.com/OSmall/tomekin/issues/35).

The runner composes public Agent Tool handlers with isolated on-disk SQLite and executes actual Pi Worker, Pi fallback
and OpenCode serialization paths. It does not register any benchmark or legacy tool in the product capability registry.
The OpenCode host itself is outside this deterministic serializer seam; host clipping remains unknown.

`packages/evaluation/src/fixtures.ts` owns synthetic source records and fixed cardinalities. Discovery has 12 identities,
16 Printings, 10 owned rows/14 copies, three locations and eight allowed identities. Construction and assembly each have
26 identities, 30 Printings, 28 rows/100 copies, three locations and 26 allowed identities; selected membership has
20 rows/60 copies. Tuning has twelve selected rows/60 copies and an eight-identity Addition Pool with ten Printings and
ten owned rows/12 copies in two allowed locations plus one excluded location. Its three-card replacement retains nine
unchanged rows. The separate Commander-sized probe replaces three rows in a 69-row/100-copy candidate. Its facts and
Format are synthetic Casual 60 inputs: this is a cardinality comparison, not a claim of Commander legality.

Each fixture records synthetic names, facts and UUIDs. It is neither an anonymization of a private deck nor a production
size estimate. The scoped row witnesses retain Printing, Finish, location and quantity associations. Default tests assert
coverage against fixed fixture identities, exact row witnesses, candidate quantities, actual adapter clipping and the
long-text loss. `coverage` and `utf8Bytes` are reusable measurement assertions for later migrated runners. Fixture manifest
and source SHA-256 values permit distinguishing changed workloads. Reuse the same source records and explicit required
facts when comparing a future implementation; fewer bytes with missing facts is not an improvement.

The four workflow scripts measure a broad scoped query, a bounded three-result query, known-card lookup (five facts,
then seven including the original five), actual adapters, and, where applicable, save/read/explicit checks/render.
Three identical rich queries are deliberately executed to compare adapters; their repeated facts are labeled adapter
comparison overhead rather than agent inefficiency. Full save input and repeated Brief/card-row costs are recorded.
The tuned candidate is deliberately structurally saveable while its five-copy nonbasic rows fail explicit legality;
the artifact preserves this assessment instead of treating a successful save as final validation.

The protocol records a first cold observation, one unmeasured warm-up and five warm measurements, with all stage samples,
median and full range. Each observation seeds a fresh equivalent database; modules/process and OS caches may be warm.
OS caches are not flushed. Worker timings include startup and runtime creation. These are inclusive stage durations:
do not sum overlapping query/adapter spans. Database fixture setup and migration are outside operation timing.
The artifact identifies Bun, platform, architecture, CPU, source commit and fixture hashes. Run failures exit nonzero.

Application JSON and model-visible adapter text are measured independently in UTF-8, including escaped JSON metadata.
UTF-16 character counts are separate. Token values are explicitly rough `ceil(UTF-8 bytes / 4)` estimates, never measured
usage. Pi previews cannot be parsed as complete records; whole-record loss and lack of recovery are explicit. A limited
legacy query cannot continue, and its missing expected identities remain visible. The long text fixture demonstrates
legacy 500-character rules-text truncation even when identity coverage is complete.

Missing measures remain labeled: current SQL internals do not expose independent compiler/selection/totals/hydration
spans; there is no provider scheduling/network/cooldown in this local path; no current tool proves joint whole-deck
Availability. This baseline does not implement the later provider paging, multipart projection, date policy, candidate
revision or allocation contracts. Their deterministic acceptance fixtures must extend the same measurement protocol.
Synthetic facts cannot certify a real legal deck, strategic quality or live exhaustive recall. No production logger or
adapter behavior is changed by this measurement slice.

After migration, `bun run evaluate:legacy` recreates the recorded baseline source in a temporary directory from its pinned
Git commit, installs its frozen dependencies using Bun's offline cache, reruns the old public handlers and adapters,
and deletes the temporary checkout. It never changes the current checkout. The initial dependency cache must already
contain the pinned lockfile packages (a normal install at the pinned revision populates it). This deliberately separate
CLI is the legacy comparator, not a normal Agent Tool. Compare its artifact with a migrated runner using matched runtime,
fixture hashes, budgets and required facts; report both coverage and byte/latency differences.

## Local lookup slice

`bun run evaluate:lookup` runs the new local lookup path against the same four synthetic source fixtures. It measures
three-outcome ordinary pages through exhaustion, complete 1,300-character source Oracle text, a follow-up requesting
only new tag facts, compact application JSON, actual Pi Worker/fallback and OpenCode serialization. Every adapter
must retain the exact complete envelope and every expected input occurrence. Token values remain explicit estimates.
Cold, unmeasured warm-up and five warm observations retain the same timing protocol. `local-lookup-v1.json` records
this slice. Its synthetic names/facts are matched measurement inputs, not legal decks or live strategic evidence.
Provider discovery, Collection-policy evidence, candidate editing and final whole-deck Availability remain unmeasured
by this lookup-only artifact. The frozen pre-migration artifact and `evaluate:legacy` source remain unchanged.

## Post-build candidate performance

`bun run evaluate:performance` measures atomic three-card edits separately from explicit legality, evaluation and final
joint Availability, complete optional paged reports/decklists/Pull Lists, replacement facts, serialization and actual Pi
fallback/new-Worker/reused-Worker edits. It uses only public synthetic SQLite fixtures. Current create/edit never runs
automatic deck checks; requested explicit final checks remain necessary. See [the measurements and their comparison
limits](candidate-performance-v1.md) and [captured report](candidate-performance-v1.json). The original baseline stays
immutable; the separate [matched pinned legacy rerun](candidate-performance-legacy-v1.json) does not replace it.
No benchmark timing is a CI threshold, live-session latency guarantee or explanation of the historical six-minute case.
