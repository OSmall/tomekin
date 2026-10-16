# Collection-aware retrieval: trace baseline and evaluation protocol

Date: 2026-10-16. Source revision: `3c2d545423ef3a4deb7ab22cc80a3790035c8f07`.

Research for [Capture representative retrieval traces and evaluation measures][ticket], under
[Make collection-aware card retrieval efficient and complete][map]. This is a planning artifact: it selects evidence,
fixtures, and an evaluation protocol; it implements no retrieval, instrumentation, or tests.

## Finding and decision

Use three evidence layers: the reported historical OpenCode failure, hash-identified private Pi trace aggregates,
and a deterministic fixture corpus covering discovery, construction, tuning, and final assembly. The private traces
provide measured payload and cardinality baselines; they do **not** provide uncontaminated retrieval timings or an
exhaustive Collection ground truth. Fresh discovery/construction live traces and measured new-provider performance
remain absent. The fixture specifications below cover those workflow shapes without pretending those runs occurred.

Evaluate the adopted [Choose the agent-facing Card Query authoring contract — final resolution][contract]. Provider
search, local batched lookup, optional tags/evidence, and live paging are the target. Legacy compiler timings remain a
separate diagnostic series, never a prerequisite or a proxy for provider performance. The earlier resolution in that
issue is superseded, including its remote lookup and foreign-key removal proposals. [Source: final contract][contract].

Default CI should assert deterministic results, budgets, scheduled calls, and bounded complete serialization against
controlled providers/clocks; it should not assert live-model quality or wall-clock speed. Measured performance belongs
in a separate repeatable benchmark; live provider runs are diagnostic. This follows the repository's
[deterministic testing policy][testing] and [manual workflow corpus][scenarios].

Throughout this report:

- **Observed** means a source record or source code directly contains the fact.
- **Derived** means a stated calculation over those records, with no model judgment.
- **Proposed** means the selected future fixture or measurement procedure, not an executed result.
- **Unknown** means the supplied evidence cannot establish the value; it must not become zero or a coverage guarantee.

## Evidence provenance and limits

### Historical OpenCode report: reported, not reproduced

The research ticket and map report 22 Card Query calls, roughly 48m20s, approximately 1.07 MB returned, a roughly
19m45s recent-Printing/Collection query, inaccessible adapter spill files, and Heroic Feast surfacing only after a
narrow multi-role intersection. Those values are **reported historical evidence**; the originating trace was not
available in this investigation, so bytes, intervals, and recall cannot be independently reconstructed.
[Sources: research question][ticket], [retrieval map][map].

The retired Agent Context Efficiency note independently describes inaccessible OpenCode spill files and repeated rich
payloads, but does not establish those numeric measurements. It is available at a fixed historical revision.
The map's other named provenance file, `docs/plans/card-discovery-query-efficiency.md`, was not found in the available
Git history. Neither retired file is a dependency of this protocol. [Source: archived context investigation][archive].

The checked-in [Pi session audit][audit] reports an earlier 23-query/45-tool view. The supplied files now contain the
counts below. Its narrative is useful provenance, but its old counts and line references cannot identify the current
private file. Do not merge the OpenCode 22-call baseline, that earlier audit, and the newer Pi recordings into one run.

### Current private Pi recordings: derived aggregates

The following aliases identify local recordings without publishing user prompts, decklists, identifiers, or locations.
All counts use persisted records in file order, across the whole file, including resumed history. They are not a claim
that every record belonged to the final active conversational branch.

| Trace alias | File bytes | SHA-256 |
| --- | ---: | --- |
| Pi tuning | 1,155,429 | `6469e56d15ddcfe404db5254bc4d73b4bb39fdf607bc1c627cad1d17cd5b40a8` |
| Pi transport diagnostic | 90,665 | `8c4908f725ce14cd01a2c347cc055f79eb0a1c8d95d8741954510869d34c370c` |
| Pi tuning and finalization | 1,764,100 | `08b71e962d8a97385f07af53068c49f6cf906b159ff68553f4887b4652d3234e` |

| Derived measure | Pi tuning | Pi transport diagnostic | Pi tuning and finalization |
| --- | ---: | ---: | ---: |
| Persisted records | 103 | 28 | 170 |
| All tool-call / tool-result records | 74 / 74 | 5 / 5 | 120 / 120 |
| `query_cards` call / result records | 26 / 26 | 3 / 3 | 48 / 48 |
| Query results with visible clipping envelope | 12 | 1 | 1 |
| All tool results with visible clipping envelope | 14 | 1 | 7 |
| Query visible text, UTF-8 bytes | 261,410 | 19,021 | 277,570 |
| Query argument canonical JSON, UTF-8 bytes | 15,690 | 614 | 45,466 |
| Original rendered query characters, known total¹ | 1,414,604 | 724,761 | 276,072 |
| Complete visible query outputs | 14 | 2 | 47 |
| Rows in complete visible query outputs, counting repeats | 100 | 1 | 520 |
| Distinct identity IDs in those complete outputs | 86 | 1 | 299 |
| Owned-copy rows in those complete outputs, counting repeats | 18 | 1 | 17 |
| Complete outputs returning exactly their requested limit | 0 | 0 | 3 |

¹ JavaScript UTF-16 code units, **not bytes or tokens**: use `originalCharacters` for clipped outputs and UTF-16 length
of visible text for unclipped ones. Only the clipped envelopes preserve original length, not original content. In the
third trace the escaped preview envelope contributes enough overhead that visible UTF-8 bytes exceed this character
sum; the columns measure different things. No reconstruction of missing rows is implied.

The complete-output identity counts are lower bounds on observed candidate identities, not Collection sizes or recall
denominators. A visible `isError: false` does not prove query completeness. For the query outputs in these files,
visible-envelope and `details` clipping flags agree; count visible `content` once for context, never add `details` as a
second model input. Whether another harness actually sends `details` to its model must be established separately.

**Query shapes observed:** the first trace requests limits 10–200, the diagnostic uses two limit-10 queries and a
limit-200 rich query, and the finalization trace requests limits 12–100. The rich diagnostic selects tags, owned-copy
rows, and seven legality formats; its clipped original is 723,540 UTF-16 code units. The finalization trace uses
small role/tag buckets as well as broader searches; three complete responses hit limit 30. Location type/name,
quantity, Color Identity, legality, tag, ranking, Mana Value, and Oracle-text predicates occur across these recordings.
The historical multi-role discovery observation motivates independent retrieval channels; these aggregates do not prove
which channel would recover every candidate. [Sources: private recordings, extraction method below; historical case][ticket].

**State and assembly cardinalities observed:** both real tuning recordings list seven Collection Locations. In the
finalization recording, validation, evaluation, rendering, and both save attempts each carry 69 selected card rows
summing to 100 copies. This is a selected deck cardinality, not 69 singleton copies or a full Collection census.
Validation and evaluation each resend the same 8,006-byte canonical argument payload; the render argument is 15,528
bytes and each of two save attempts is 16,738 bytes. The Brief appears in validation, evaluation, and both save inputs.
The same `get_deck_candidate` arguments recur twice and a `get_card_identity` argument recurs twice in that trace.
These are exact argument repetitions, not proof that all facts were unchanged between calls. The first tuning trace
also repeats one identity lookup. All figures are derived from private records without publishing card choices.

**Final evidence correctness remains unknown:** the finalization recording includes validation, evaluation, rendering,
and save attempts, but complete scoped owned-copy evidence for the whole final selection is not available in the
visible recording. Do not infer Availability from tool completion or 100-card size. The current evaluator explicitly
[does not compute Collection Availability][evaluator]; the [manual corpus][scenarios] requires a final scoped check.
Full reference identity/Printing counts, Collection copy/row counts, import revisions at each historical call,
unclipped-result cardinalities, and a human-approved relevance ground truth are also unknown.

### Timing: do not turn conversation gaps into SQL latency

The three recordings span long and resumed conversations. Assistant message timestamps may precede model generation;
one assistant result can declare several calls (up to 6 / 1 / 10 query calls in a single record respectively). A paired
assistant-to-result interval therefore mixes generation, queueing, previous calls, interruptions, and retrieval.
Even the outer persisted event timestamp is not a per-tool dispatch timer.

For example, the three diagnostic query call-event-to-result intervals are 187 ms, 26 ms, and 4,208 ms, but its first
query call event to last result spans 19,030.542 seconds across the recording. Neither that span nor the sum of
paired intervals is a measured retrieval latency. These values are diagnostic evidence of the timing limitation.
Provider latency, cooldown, page reads, compiler/selection/totals/hydration/serialization durations, and pure local
lookup timing are **unknown** in the supplied recordings. Do not use them to claim a speedup over the historical
48-minute report. The code has distinct [legacy stages][legacy-stages], but no stage measurements were recovered here.

### Current code explains additional baseline risks

At the pinned source revision, the normal tool is still `query_cards`; the adopted provider contract is not shipped.
The legacy repository compiles the filter and selection, then separately hydrates legalities, tags, scoped totals, and
owned-copy rows. Totals are hydrated even without rich includes. The result envelope contains `limit` and `items`, with
no continuation or exhaustive total. Its rules text is [clipped to 500 characters][oracle-cap]. These are observed
legacy properties; complete JSON by itself does not establish complete Oracle text. [Source: repository][legacy-stages].

Both the [Pi Worker serializer][worker] and [extension serializer][extension] have temporary clipping paths. The Worker
uses a 16,000-character threshold and an escaped preview envelope; the extension separately bounds its envelope.
Measure the actual adapter path and serialized UTF-8 bytes: a character threshold is not a byte budget and a Worker
preview can itself grow when escaped. Current source explains mechanisms; it does not identify which exact adapter
revision produced every private historical response.

## Selected representative fixture corpus (proposed, not executed)

Use explicit manifests and minimal card fields. Package-local fixtures should reuse source-backed real card identities
and Scryfall-shaped IDs; locations, chronology, and quantities are synthetic. Do not derive fixtures by publishing the
private Collection. Card semantics should come from a reviewed local/public source snapshot, following the existing
[fixture policy][fixtures]. A semantic fixture is deliberately small; it does not represent the distribution of a
production Collection. The recorded tuning deck's 69 rows/100 copies supplies a separate assembly workload size.

| Workflow fixture | Exact proposed cardinalities | Deterministic script and expected result |
| --- | --- | --- |
| Discovery across plans | 12 identities, 16 Printings, 3 locations, 10 owned rows totaling 14 copies; 8 distinct identities in the allowed scope | Three frozen provider pages of 4 records; 8 of the 12 records match the allowed scope. Request `first=3`: fill through local filtering, then exhaust continuations as 3 / 3 / 2 matches. Known eligible IDs, not a model-ranked decklist, are the oracle. Two viable role groups and one unsupported theme are supplied for optional manual evaluation. |
| Fresh construction | 24 nonbasic identities plus 2 basic-land identities, 30 Printings, 3 locations, 28 owned rows totaling 100 copies; 26 allowed identities | Freeze staged search results and local reference data; select a legal Casual 60 candidate with 20 distinct identity rows and 60 copies. Script role-bucket discovery, one batch lookup of newly needed facts, then final evidence lookup. Assert expected fact/card sets, quantity accounting, no excluded location leakage, and no full Brief on every retrieval. Card selection is fixture input, not an LLM assertion. |
| Focused tuning | 12 selected identity rows/60 copies; Addition Pool 8 identities, 10 Printings, 10 owned rows/12 copies in 2 allowed locations, plus 1 excluded location | Three known additions, three paired cuts, one multi-role sentinel reachable through two independent search channels, and off-plan alternatives. Assert retrieval coverage and final net quantities against the manifest. Strategic merit belongs to manual evaluation. |
| Final assembly | Same 20-row/60-copy candidate as construction; also a separate 69-row/100-copy Commander-shaped workload manifest | Batch lookup selected cards; retrieve exact scoped physical-copy evidence only where required. Assert all selected quantities are accounted for or explicitly Missing, preserved printing/finish/location association, deterministic legality gate, and exact Portable Decklist. Use real legal card data before asserting format validity; row/copy counts alone never prove legality. |

The 69-row workload is a **synthetic size match**, not an anonymized copy of the private deck. The 26-identity
construction corpus and 12-row tuning corpus are semantic protocol fixtures, not empirical size distributions. Their
manifests must reconcile identity/Printing/row/copy counts before execution; ownership rows may have quantity greater
than one. Unknown historical corpus size stays unknown.

For a separate synthetic performance profile, repeat the same retrieval plan at 100 / 1,000 / 10,000 owned identities,
with 2 Printings per identity and 1 owned row per Printing, quantity 1: respectively 200 / 2,000 / 20,000 Printings,
owned rows, and copies. Keep 3 locations, scope selectivity 50%, provider stream 1,000 records in 10 fixed pages of 100,
and 40 scoped owned matches in that stream. These are selected scale probes, not production estimates; fixture construction
must choose explicit overlap to make these counts true. Keep them outside tiny default tests if runtime is material.

### Diagnostic cases that the workflow corpus must include

Each case is independent unless it explicitly modifies a workflow manifest. Expected outputs are asserted against
frozen source IDs and copy rows, not string-searching a preview or asking a model to judge completeness.

| Case and cardinality | Required assertion |
| --- | --- |
| Sparse page fill: 3 provider pages × 4 records, per-page scoped matches 0 / 1 / 3, `first=3` | Read enough upstream pages to fill; return 3 then buffered 1; no skipped or duplicated stable-fixture results, including an empty filtered page. `can_continue` is not proof another match exists. |
| Scan budget: same stream with scripted clock crossing configured approximately 10-second budget before exhaustion | Scheduling consumes budget; return useful partial/empty progress, explicit budget stop and continuation, scoped total unknown. Never read more pages merely to count. Concrete envelope/budget selection belongs to the continuation decision. |
| Central pacing/cooldown: 3 search calls, including 2 internal page reads; third response 429 | At most 2 request starts per second across consumers; fake-clock schedule covers internal reads. Cooldown/retry guidance appears promptly without hidden retry loops. Local lookup makes 0 provider requests and must not be paced as remote traffic. |
| Continuation boundaries: 5 matching records, `first=2`, buffer 1 from an upstream page | Return all 5 exactly once against a stable provider fixture; bind cursor to request/provider/scope/revisions. Reject changed request, reference reimport, or Collection reimport with restart guidance. |
| Live drift: 2 upstream pages with 1 repeated identity and 1 intervening insertion/deletion | Record upstream drift as a provider limitation; do not promise snapshot completeness. Keep a separate stable-provider test for local duplicate/omission defects. Provider totals are not scoped totals. |
| Collapsed printing ownership: 1 identity, 2 Printings, ownership only on the nonrepresentative Printing | Identity match and exact-Printing match differ; `unique=cards` representative absence cannot establish no owned Printing. Forward conflicting `q`/`unique` directives unchanged and report the rollup limitation. |
| Same-copy evidence: 1 identity, 2 Printings, 3 owned rows across allowed binder and excluded deck, including a foil/nonfoil split | Never combine allowed location from one row with finish/date/Printing from another. Scoped quantities equal only qualifying rows. Include same-name binder/deck locations distinguished by exact type/name. |
| Chronology: 2 owned rows of one Printing, 1 acquired earlier and 1 later; Printing release predates both | Printing release is not acquisition. Missing source dates or absent historical deltas remain unknown; use eventual chronology contract rather than fabricate history. |
| Tags: 1 card, 2 direct tags with different weights, 1 shared ancestor, plus direct membership in that ancestor in a variant | Explicit selection returns complete direct/inherited sets, deduplicates, prefers direct membership, and uses strongest supporting weight. Unselected tags absent; tag weight is prominence, not confidence. Catalogue search/list/hierarchy stay separately bounded. |
| Projection and text: 1 multipart card with null top-level text and 2 existing faces; 1 non-ASCII oversized record | `oracle_text` preserves ordered face text; field/null/empty/unavailable distinctions survive search and lookup. Stop before whole record exceeds byte budget; no 500-character rules-text cut, mid-record JSON slice, or UTF-8 damage. Oversized single record gets actionable narrower-field/evidence guidance. |
| Local batch lookup: 3 supported reference kinds, 1 miss, 1 repeated reference | No remote fallback; actionable unresolved reference; field validation before execution for invalid identity-plus-Printing projection. Mixed valid batches preserve documented association/deduplication semantics without inventing a representative Printing. |
| Fact discrepancy: 1 rules/legality mismatch, 1 advisory-only mismatch across provider/local snapshots | No extra lookup merely to cross-check every search hit. Incidental rules mismatch blocks successful final validation/save; advisory mismatch warns. Explicit sync preserves saved data and rechecks affected facts. No silent replacement. |
| Adapter recovery: 1 response below budget, 1 multi-record response above it, 1 individually oversized record | Bound visible UTF-8 bytes including envelope overhead; expose supported continuation/recovery; union recovered complete records equals the stable source oracle. No inaccessible spill-path dependence. |
| Repeated context: 2 stages share 5 known facts, stage two needs 2 new facts | Retrieve the 2 new facts; batch the shortlist. Record repeats separately for facts, Brief, candidate, and methodology, with justification when a revision or final evidence check requires rereading. |
| Persistence/reference integrity: saved candidate plus owned Printing and Identity rows, then explicit reference sync | Retain foreign keys and user data; no cascade deletion or schema redesign inferred from the superseded contract. Legacy tool is disabled by default and absent from normal capability allow-lists. |

These cases implement the final contract's acceptance boundary, including its explicit live-provider exceptions; they
do not reopen it. Existing [same-row Collection tests][same-row], [scoped quantity tests][scoped-totals], and
[tag inheritance implementation][tag-weight] supply local regression anchors, not proof of future provider behavior.
The concrete response schemas remain with the projection/continuation children of the [retrieval map][map].

## Measurement record and evaluation procedure (proposed)

For each workflow, record a run manifest: source commit, fixture manifest hash, reference/Collection revision,
provider mode (frozen/local/live), adapter revision/path, explicit fields and evidence selection, scope identifier/hash,
page/scan/size budgets, hardware/runtime for benchmarks, warm/cold policy, and model/reasoning effort only for optional
manual runs. Record actual identity, Printing, row, copy, location, tag/edge, candidate, and stream cardinalities.
Missing fields are `unknown` with a reason. Retain an unredacted manifest only locally.

Use one monotonic run clock and distinct call/span IDs. Start and finish spans at actual dispatch and completion,
not conversation timestamps. Capture these components without double-counting nested spans:

| Layer | Required measurements |
| --- | --- |
| Agent call | Wall time to first useful result and completion; success/failure/stop reason; queue wait; cancellation; requested/returned counts; call count and query shape |
| Provider search | Request count, upstream pages and rows read, network duration per request, scheduling wait, cooldown duration/status, provider total and page metadata, bytes read; separate provider failures from local failures |
| Local filtering/fill | Scope set construction, membership-filter time, scanned/matched/buffered/emitted counts, page-fill iterations, budget stop point, remaining buffered matches |
| Local lookup | Batch reference count/distinct count, hit/miss counts and timing; remote-call count must remain zero |
| Enrichment | Tag lookup/hierarchy time and counts; evidence/quantity hydration time, copy rows and payload bytes; explicitly selected vs omitted datasets |
| Serialization and adapter | Projection/serialization duration; structured response UTF-8 bytes; rendered visible UTF-8 bytes including envelopes; original UTF-16 characters if reported; clip/recovery counts and recovery calls |
| Legacy-only series | Parse/validation and filter/scope compilation, primary selection SQL, totals SQL, legalities/tags/owned-row hydration, serialization; statement counts and optional local query plans |
| Context | Canonical input bytes, visible output bytes, exact tokenizer input count when tokenizer/model version known; otherwise clearly labeled estimate; repeated facts/Brief/deck/methodology bytes and counts |
| Correctness/coverage | Expected vs emitted stable-fixture ID/Printing sets; omissions/duplicates; scoped copy totals and row provenance; whole-face rules text; final legality, Availability evidence status, discrepancy state |

Keep provider wait/network/fill/enrichment spans distinct; do not sum inclusive wall times to manufacture a total.
For parallel work, report wall time plus per-span work time and scheduling explicitly. Match legacy runs by workload
and snapshot when available; do not translate CQL2 filters into a purported identical live Scryfall universe.

A token estimate may use `ceil(visible_utf8_bytes / 4)` as a declared rough proxy, giving 65,353 / 4,756 / 69,393 for
these query-visible totals. It is **not a measured model input count**, ignores other conversation/tool/schema content,
and is not a universal tokenizer bound. Obtain exact counts only with an identified model tokenizer and the actual
payload sent. Keep tokenizer changes separate from retrieval changes.

Execute the deterministic workflow script once per case with injected clock/provider. Verify exact expected record
sets, same-copy provenance, budget/continuation invariants, whole-record output, and zero unauthorized remote calls.
There is no relevance-score or live-model CI threshold. A recovery test fails if the agent has only an inaccessible
file path, even when the full result exists somewhere on disk.

For performance comparison, use the same fixture/runtime and budgets, one warm-up and five measured runs; report
median and full range with all failures, calls, bytes, and coverage. These are protocol choices, not statistical claims
about live production. Include a cold run separately; do not hide a failed/partial run behind a faster median.
A later implementation can establish a stable performance envelope from these measurements; no defensible absolute
SQL/provider speed threshold can be inferred from today's missing timings.

Accept a compact-retrieval change when all correctness/coverage gates pass and paired runs show reduced visible bytes
or repeated facts for the same required facts, with no unexplained extra provider calls or recovery loops. Report actual
deltas and any latency trade-off; the projection ticket owns the demonstration of reduction. Respect scan/response
budgets even when a run cannot finish; a truthful partial result can pass budget handling, but cannot count as complete
coverage. Stable fixtures require all expected results after exhausting continuation. Live runs report rows seen,
upstream pages, drift/rollup limits, and scoped total unknown where applicable; they cannot certify exhaustive recall.

Run optional live-agent evaluations using the existing [manual corpus][scenarios], scoring its human-reviewed
invariants rather than an exact decklist or LLM judge. Add retrieval observations for Heroic-Feast-style multi-signal
coverage, tag-independent Oracle-text/seed discovery, final evidence, and intentional fact reuse. Keep model choices
and user pauses out of service performance claims. No fresh live discovery/construction run was performed here.

## Reproducing the private aggregates safely

An authorized contributor can recompute the tables against the hash-matching files. Do not copy them into the repo,
write a processed raw transcript, send them to a documentation/model service, or enable complete-payload logs.
The following is pseudocode, not a checked-in executable or a required library API:

```text
for each private JSONL file:
  record SHA256(original bytes), byte length, and nonempty-record count
  parse records in file order; count assistant.content toolCall entries by name
  index calls by toolCall ID, retain only arguments necessary for local aggregate calculations
  for each role=toolResult:
    count by toolName; join toolCallId to its declared call
    visible_texts = text blocks in content (do not count details again)
    visible_bytes = sum(UTF8_length(text) for text in visible_texts)
    parse visible JSON if possible; count truncated=true envelopes
    original_characters = envelope.originalCharacters if clipped
                          else sum(UTF16_code_units(text) for text in visible_texts)
    if a complete visible query object has items:
      count row occurrences, unique item.id, collectionCards row occurrences,
      and items.length == requested limit
    otherwise mark result-row cardinality unknown; never parse a clipped preview as complete JSON
  canonical_argument_bytes = UTF8_length(JSON(arguments, compact separators, unescaped Unicode))
  compare canonical sorted-key arguments locally for exact repeat counts (publish counts only)
  for candidate operations: count cards rows, sum quantities, detect Brief presence
  verify visible/detail clipping agreement separately; record mismatches if any
  emit only the approved aggregate columns above; omit IDs, names, query values, and raw text
```

Use UTF-16 code units for JavaScript character counts (in Python, `len(text.encode('utf-16-le')) // 2`), not Python's
Unicode-code-point length. Stable re-extraction requires the original file hashes; changed files become new trace
revisions, not corrections silently substituted into this baseline. The aggregate hashes identify private evidence;
they do not make it publicly reproducible without authorized access. Public CI reproducibility comes from the reviewed
synthetic fixture manifests, not these files.

Public benchmark/log records should contain fixture IDs, revisions, timing/count/size summaries, and categorized errors.
Keep Collection identifiers, location names, purchase/chronology details, free-text Briefs, full queries carrying user
values, and deck choices private. Redact or synthesize before publication and check that errors/cursors do not leak
those values. An opaque continuation must not expose a Collection or raw provider diagnostic. Preserve only approved
aggregate evidence in the ticket; any raw retention/deletion policy remains the owner's existing local policy.

## Handoff and completion boundary

This investigation selects a measured historical payload baseline, states its missing metrics, and specifies the
workflow/diagnostic fixture corpus and protocol. It does not claim the new retrieval path is implemented or benchmarked.
Later implementation work must build the fixtures/instrumentation, run paired measurements, and record their observed
results. It need not create another planning ticket just to execute this protocol.

Remaining map decisions still own concrete projection/response schemas, continuation serialization and exact configurable
budgets, owned-copy chronology/policy, and workflow promotion. Missing live timings and raw historical OpenCode evidence
are limits on empirical claims, not permission to substitute synthetic numbers. The accepted provider/local authority,
retained foreign keys, local lookup, and live-snapshot limitations remain fixed by the [final contract][contract].

[ticket]: https://github.com/OSmall/tomekin/issues/27
[map]: https://github.com/OSmall/tomekin/issues/21
[contract]: https://github.com/OSmall/tomekin/issues/72#issuecomment-6016155910
[archive]: https://github.com/OSmall/tomekin/blob/a6b26454f9a9b8db7ae4fe8b2ba3d95e54b206c4/docs/plans/agent-context-efficiency.md
[audit]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/docs/research/pi-session-issue-audit.md
[legacy-stages]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/sqlite/src/card-query-repository.ts#L114-L144
[oracle-cap]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/sqlite/src/card-query-repository.ts#L750-L753
[worker]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/pi/src/tomekin-worker.ts#L33-L37
[extension]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/pi/src/extension.ts#L152-L164
[evaluator]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/core/src/agent-tools.ts#L173-L208
[testing]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/docs/testing.md#L24-L32
[fixtures]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/docs/testing.md#L92-L104
[scenarios]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/docs/testing/deck-building-workflow-scenarios.md
[same-row]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/sqlite/test/card-query-repository.test.ts#L382
[scoped-totals]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/sqlite/test/card-query-repository.test.ts#L439
[tag-weight]: https://github.com/OSmall/tomekin/blob/3c2d545423ef3a4deb7ab22cc80a3790035c8f07/packages/sqlite/src/card-query-repository.ts#L697-L713
