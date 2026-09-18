# Pi session and open-issue audit

Date: 2026-09-18

## Question and sources

This note compares the supplied Pi TUI session with Tomekin's currently open GitHub issues and checked-in product/code
contracts. GitHub issue bodies and comments, repository files, and `session.jsonl` are the only sources. No issue was
edited.

## Conclusion

Most session pain is already represented in the backlog. The Card Query roadmap is unusually well aligned with what
the session exposed: slow Collection-scoped queries, oversized discovery results, incomplete retrieval, missing
acquisition-date querying, repeated payloads, and the need for workflow-specific search recipes all have owners.

There is nevertheless one immediate Pi-migration defect worth treating as part of
[#55, Complete the interactive Pi product surface](https://github.com/OSmall/tomekin/issues/55): Pi applies one generic
12,000-character prefix clip to every successful result. In this session that made an approved methodology entry itself
incomplete and also clipped non-Card-Query tools without a supported recovery path. This is not just the future Card
Query pagination problem.

Four possible backlog gaps should be reviewed before changing issues:

1. No open issue explicitly owns compact, recoverable projections for `get_deck_candidate` and
   `summarize_reference_support`; #29 is deliberately Card Query-specific, while #30 is adjacent working-state design.
2. No open issue clearly owns Deck Candidate revision/change provenance. The session initially treated narrative text in
   the saved candidate as the “most recent” adds/cuts, although `updatedAt` cannot prove when those swaps happened.
   #31 covers owned-copy acquisition chronology, not Deck Candidate edit history.
3. No issue explicitly owns tolerant batch resolution of front-face names, spelling variants, and double-faced cards.
   #32 is adjacent workflow work, but the session needed a batch resolution, five substring queries, and three identity
   hydrations to recover five user-supplied names that did not resolve exactly.
4. More seriously, no issue explicitly owns Card Query matching over `CardIdentityPart` names, type lines, and Oracle
   text. The current `identity.oracleText` implementation searches only the parent identity column, so broad thematic
   searches can omit double-faced cards whose relevant ability exists only on a part. Better resolver ergonomics would
   not repair this discovery-recall hole.

## What the session demonstrated

### 1. Generic Pi truncation is currently lossy, not recoverable

The Pi adapter serializes any tool result, keeps only a prefix when it exceeds 12,000 characters, and returns only
`truncated`, `originalCharacters`, and `preview`; it does not provide omitted count/scope or a recovery action
([implementation](../../packages/pi/src/extension.ts#L98-L109)). This is weaker than #55's requirement that bounded
results carry explicit truncation information and a recovery hint.

The session hit this boundary on:

- `get_deck_candidate`: 21,004 original characters, twice
  ([first call](../../session.jsonl#L9), [second call](../../session.jsonl#L75));
- `summarize_reference_support`: 41,020 characters ([session](../../session.jsonl#L15));
- `load_methodology("query-cards")`: 19,114 characters, twice
  ([first call](../../session.jsonl#L23), [reload](../../session.jsonl#L84)); and
- seven broad `query_cards` responses, including a 278,759-character result ([session](../../session.jsonl#L34)).

Overall, the session contains 45 tool calls, including 23 `query_cards` calls. Twelve tool results were truncated, hiding
about 820,000 original characters behind preview envelopes. These counts are derived directly from the structured
message/tool-result records in `session.jsonl`.

The methodology truncation is especially harmful. The source entry is 17,896 bytes, while its key “Staged Retrieval”
guidance appears late in the document and says to use 20–50-card functional/Mana Value buckets, omit tags and
Collection rows from broad scans, and narrow a limit-reaching result
([methodology](../../product-methodology/query-cards/SKILL.md#L317-L326)). That section was beyond the returned preview.
The model consequently issued broad rich queries, later acknowledged that truncation reduced recall
([session](../../session.jsonl#L66)), and only after the user prompted it did it rerun narrow projections successfully
([session](../../session.jsonl#L72)).

This is directly actionable on the #55 branch: replace generic prefix clipping with tool-specific projections and make
approved methodology fully retrievable (for example, a compact entry plus declared section resources/continuation).
Reordering or shortening `query-cards` would reduce immediate harm, but it would not fix the contract for other large
tools.

### 2. Card Query latency and payload shape match the planned roadmap

The first discovery batch contained Collection-scoped queries that completed after roughly 28, 35, 44, 75, and 91
seconds. A later broad no-include query took about 149 seconds and was still truncated. These observations reproduce
the query-shape problem already specified by
[#40, Compile each Collection Scope once per Card Query](https://github.com/OSmall/tomekin/issues/40), rather than
establishing a Pi-only performance fault. Pi's sequential execution requirement in #55 makes the user-visible cost of
slow individual calls especially apparent, but #40 owns the underlying repeated Collection-scope compilation.

The current result contract always includes identity fields and Oracle text, has optional rich tag/Collection hydration,
and exposes no count, cursor, page, or completeness guarantee
([Card Query contract](../card-query.md#L164-L193)). The following open issues already divide that problem coherently:

- [#27, Capture representative retrieval traces and evaluation measures](https://github.com/OSmall/tomekin/issues/27)
  owns timing, bytes/tokens, truncation, coverage, and correctness baselines. This session is a useful tuning trace for
  that issue.
- [#28, Design compact Card Query discovery evidence projections](https://github.com/OSmall/tomekin/issues/28) owns
  compact candidate/evidence shapes and delayed detail hydration.
- [#29, Specify recoverable Card Query continuation and adapter truncation](https://github.com/OSmall/tomekin/issues/29)
  owns deterministic continuation, completion metadata, and a supported recovery path for Card Query.
- [#32, Define workflow-aware retrieval and candidate-promotion rules](https://github.com/OSmall/tomekin/issues/32)
  owns staged retrieval recipes and explicitly uses Heroic-Feast-style multi-signal discovery as an acceptance case.
- [#21, Make collection-aware card retrieval efficient and complete](https://github.com/OSmall/tomekin/issues/21) is the
  parent planning map joining those decisions without pretending that larger adapter limits solve them.

### 3. Acquisition chronology is known work

The user asked for cards acquired after 2026-08-29. The agent correctly disclosed that Card Query could not filter by
acquisition date and asked permission to use all cards in the selected boxes instead
([request](../../session.jsonl#L13), [bounded answer](../../session.jsonl#L45)).
[#31, Specify owned-copy chronology, Collection policy, and Availability evidence](https://github.com/OSmall/tomekin/issues/31)
already states that Collection Cards carry source `addedAt`, Card Query cannot filter/sort by it, and snapshot replacement
cannot prove “new since last import” without persisted deltas. No new issue is needed for this observation.

### 4. Repeated state and methodology context are partly covered, with a Pi-specific wrinkle

The session fetched the same 21,004-character Deck Candidate twice and loaded the same 19,114-character `query-cards`
methodology twice. [#30, Define deck-building working-state and opaque identifier boundaries](https://github.com/OSmall/tomekin/issues/30)
owns repeated Brief/deck payloads and state lifecycle. It does not clearly own repeated methodology delivery.

The second methodology load followed one malformed tool call and is consistent with the current instruction to reload
`query-cards` after any validation error. Under Pi's lossy transport, this spends context on the same incomplete prefix.
That should be addressed with the #55 methodology-loading fix (and possibly a small methodology wording change), not a
new general state ticket.

### 5. Workflow quality findings already have validation owners

The agent did not explicitly present the drafted Brief for confirmation before substantial discovery, despite the
canonical workflow requiring that confirmation. Later, the user corrected qualitative cut choices, and the agent revised
them. These are exactly the kinds of deviations that
[#26, Validate Pi real-session parity](https://github.com/OSmall/tomekin/issues/26) requires classifying as harness,
model, retrieval, or methodology defects. #26 is intentionally blocked by #40. The broader manual corpus is already
owned by [#38, Run the remaining manual deck-building workflow scenarios](https://github.com/OSmall/tomekin/issues/38).
This one session is useful evidence, but it is not enough to classify recommendation disagreement as a Pi defect.

### 6. Double-faced-card resolution and discovery are separate uncovered problems

`resolve_decklist_cards` left five of the user's ten names unresolved, including front-face names such as “Emeritus of
Truce” and “Emeritus of Abundance”; the agent recovered through five partial-name Card Queries and three exact identity
hydrations ([session](../../session.jsonl#L48)). A tolerant batch resolver could make that flow substantially cheaper.

The underlying recall problem is more important. The data model stores double-faced card names, type lines, and Oracle
text in ordered `CardIdentityPart` records ([data model](../data-model.md#L83-L101)), but Card Query maps
`identity.oracleText` directly to `ci.oracle_text` ([implementation](../../packages/sqlite/src/card-query-repository.ts#L93-L103)).
Other product logic already joins identity and part Oracle text where correctness requires it
([Commander legality](../../packages/core/src/commander-legality.ts#L99-L105)). Therefore an Oracle-text discovery query
can miss a double-faced card whose relevant rules text exists only on a face. #32 can improve query strategy, but no
strategy can retrieve records the searchable field excludes. This deserves explicit issue coverage, probably under the
#21 retrieval-completeness map, independently of the resolver convenience improvement.

## Open-issue coverage map

| Observed or likely sore spot | Existing owner | Assessment |
| --- | --- | --- |
| Complete restricted Pi capability surface, typed failures, cancellation, bounded results, methodology loading | [#55](https://github.com/OSmall/tomekin/issues/55), parent [#52](https://github.com/OSmall/tomekin/issues/52) | Current migration work; generic lossy clipping means acceptance is not yet met. |
| Collection-aware query latency | [#40](https://github.com/OSmall/tomekin/issues/40) | Direct coverage; blocks #26. |
| Oversized/noisy broad results | [#28](https://github.com/OSmall/tomekin/issues/28) | Direct coverage. |
| Incomplete result sets and truncation recovery | [#29](https://github.com/OSmall/tomekin/issues/29) | Direct for Card Query; not explicit for other tools. |
| Trace metrics and regression evidence | [#27](https://github.com/OSmall/tomekin/issues/27) | Direct coverage; this session is a candidate trace. |
| Search strategy, evidence handoff, multi-signal discovery | [#32](https://github.com/OSmall/tomekin/issues/32) | Direct coverage, including Heroic Feast. |
| Repeated Brief/deck payloads and working state | [#30](https://github.com/OSmall/tomekin/issues/30) | Direct for product state; methodology repetition remains a #55 concern. |
| Acquisition-date filtering and trustworthy availability | [#31](https://github.com/OSmall/tomekin/issues/31) | Direct coverage. |
| Front-face/DFC resolution and Card Part search recall | None explicit; [#21](https://github.com/OSmall/tomekin/issues/21) is the nearest map | Gap: resolver ergonomics and query recall should be assessed separately. |
| Pi real-session behavior and defect classification | [#26](https://github.com/OSmall/tomekin/issues/26), [#38](https://github.com/OSmall/tomekin/issues/38) | Direct coverage; #26 is correctly sequenced after #40. |
| Slow Deck Candidate writes | [#35](https://github.com/OSmall/tomekin/issues/35) | Known, but not exercised in this no-save session. |
| Cross-platform Pi distribution | [#59](https://github.com/OSmall/tomekin/issues/59) | Future distribution work; unrelated to this session's retrieval quality. |

The other currently open issues (#33, #34, #36, #37, #39, and #60) concern SQL defaults, environment configuration,
Scryfall progress, a migration helper, ManaBox import compliance, and Drizzle typechecking. They do not explain the
session's agent/tool-flow problems.

## Recommended review decisions before editing issues

1. **Treat as #55 branch work now:** make `load_methodology` fully recoverable and replace the one-size-fits-all Pi
   result prefix with tool-specific bounded projections/recovery metadata. Add a regression proving the agent can receive
   the complete staged-retrieval rules.
2. **Decide whether to broaden #29 or add a small follow-up:** cover recovery for non-Card-Query reads, especially
   `get_deck_candidate` and `summarize_reference_support`. If #55 is changed to provide complete tool-specific recovery,
   a separate issue may be unnecessary.
3. **Decide whether Deck Candidate history is a product requirement:** if users need “what changed most recently?” to be
   factual, record structured revision/change provenance. Otherwise, tighten methodology to label rendered
   “Cuts And Exclusions” as current narrative only and never infer its date from `updatedAt`.
4. **Decide whether tolerant named-card resolution belongs in #32 or a bounded tool issue:** front-face-only and
   misspelled names should ideally return structured candidate matches instead of forcing several manual substring and
   hydration calls.
5. **Record the double-faced Card Part recall defect explicitly:** decide and test which Card Query identity predicates
   should match canonical part fields, with deterministic projection and deduplication. This is a retrieval-correctness
   issue, not merely resolver ergonomics or methodology.
6. **Attach this session as evidence later, not as a new plan:** #27 should eventually capture its measured trace, and
   #26/#38 should classify the missed Brief confirmation and recommendation corrections during their scheduled manual
   validation.
