# Alesha session tool/context audit

Evidence: `session_alesha.jsonl`, 419 lines, 5.3 MB, 204 tool results. Corresponding `.data/tomekin.log` is 4,316,284,439 bytes and 113m+ lines; relevant live search records use process 67897, local clock UTC+11. Transcript spans Oct20 13:56Z–Oct21 13:53Z. All transcript references below are one-based JSONL line numbers. Raw result payloads and debug logs are not copied here.

## What actually consumed context

Tool result `content[].text` totals **2,137,864 characters** (not token count). Result details also repeat structured payloads in session storage; whether both are supplied to the model must be checked at harness boundary, so do not claim double model exposure from JSONL alone.

| Tool | Calls | Text characters |
|---|---:|---:|
| get_deck_candidate | 30 | 546,287 |
| search_cards | 33 | 494,067 |
| read | 34 | 389,566 |
| lookup_cards | 27 | 219,938 |
| render_deck_candidate | 6 | 217,628 |
| check_collection_availability | 5 | 103,044 |
| browse_tags | 6 | 74,719 |
| edit_deck_candidate | 17 | 51,427 |
| hypergeometric_calculator | 33 | 11,529 |

34 full skill reads: router 17, query-cards 6, commander architecture 5, deck shape 4, commander tuning 2. **19 reads before compaction, 15 after.** Router alone returns ~11.7k text chars each time. These were complete identical reads, not changed-file refreshes. Re-reading after compaction is reasonable; repeated reads within one context are demonstrable redundant context. Examples: router at L55,63,88,96,136,173,191,212,246 before compaction L254; late token pressure at L404 followed by router L408 and L414. Current skill/harness invocation behavior should retain a loaded-document ledger through the checkpoint and resume at the current workflow step.

## Tool request vs result

**Card search/lookup projection broadly works.** Across 2,876 returned card records the only unselected card keys were `oracle_id` (mandatory identity) and `card_faces` (10 records, needed to fulfill requested Oracle text for multipart cards). No evidence of arbitrary unrequested card facts. `search_cards` asking compact tags without selected slugs (L26→27, L120→121) legitimately returns all tags, including flavor/type-errata metadata; this is overspecified usage, not a selection violation. L27: 200 requested, 93 returned, response budget exhausted; provider total 5,507 is global, not owned total. Metadata correctly leaves scoped total unknown.

**Tag browsing has a real projection gap.** L200→201 asks exact lookup of 22 tags with hierarchy depth1 and first100, returning ~43k text chars/48k JSON-serialized content. Full parent/child definitions include UUIDs, source_page_uri, labels, descriptions, aliases, plus repeated definitions. User explicitly complains L208 about junk and URLs. Assistant L209 accurately says browse_tags has no field selection. Current schema exposes only operation/first/after; definitions are complete by contract. Recommendation: compact definition projection (slug/description by default, optional label/aliases/provenance/hierarchy) or an explicit select contract. Merely telling agent to use compact card tags cannot solve tag-definition output. Omit hierarchy until a known relation is needed; batch narrow exact slugs.

**Candidate reads/rendering have poor task-shaped retrieval.** Path/value pagination is recoverable but pages contain raw persistence state and provenance, not concise requested role/card/research views. L194 plan first200 returns121 records with more remaining. L265 options first200 returns88 of137 records before budget. L368 report first200 emits48 of896 records, beginning with metadata and a large research document; it does not finish. The agent starts new broad views instead of narrowly extracting facts. Add narrowly selectable plan sections, role pools, summary assessments, current evidence and pull-list fields; retain complete raw export as opt-in.

## True implementation blocker: written research cannot be read back

L251 writes ~51k-byte research into atomic `plan.description`; L252 succeeds in **0.598s**. Post-compaction L263→264 asks plan first4 but receives only records [], schema_version, candidate_id (3). Response stops before description because of 51,200-byte budget. L266→267 asks next record first1 and receives `record_too_large`: required_bytes51,344 > limit_bytes51,200. The record is accepted and persisted, then impossible to retrieve intact through its only read contract. User must paste it manually L273. A smaller first cannot repair atomic-string overflow.

Recommended fix: chunk long Markdown strings reversibly in the paging projection (and reassemble), or introduce bounded ranged/section research retrieval. Validate that every accepted long field remains readable. Rejecting long writes only prevents this failure; it does not satisfy user-authorized full research persistence.

Compaction L254 itself contains stale instruction: it says plan description starts `# Alesha research handoff` and tells reader it is condensed, though L252 replaced it with `# Alesha...Full Working Research Document`. It preserves useful candidate/permission/remaining-search context but its handoff summary is not synchronized with the last write. Therefore there are two independent continuation failures: stale checkpoint text and actual unreadable persisted document.

## Live search latency is mostly global traversal plus local enrichment

Measured call→result latencies include provider work; independent model-generation gaps are addressed separately below. The log provides direct stage metrics:

| Transcript | Query intent | Provider pages/raw cards | Owned returned | duration | HTTP | local |
|---|---|---:|---:|---:|---:|---:|
| L27 | all Mardu power≤2 creatures + all compact tags | 9 /1,413 |93|64.01s|49.23s|6.66s|
| L37 | Mardu nonlands not power≤2 creatures |24 /4,030|200|111.67s|58.67s|24.34s|
| L106 | broad draw/removal/protection/recursion text |23 /3,984|200|105.91s|55.23s|23.00s|
| L222 | card advantage/ramp/sweeper OR |20 /3,388|163|107.69s|46.43s|25.73s|
| L224 | interaction OR |19 /3,281|200|90.40s|39.36s|20.40s|
| L277 | remainder of all Mardu power≤2 creatures |16 /2,558|164|54.23s|31.65s|~0.002s|
| L293 | broad mana/tutor/creaturefall/death/graveyard |14 /2,399|117|71.62s|30.66s|16.89s|

Relevant log references: L97,920,611 (L27), L100,925,696 (L37), L103,391,930 (L106), L107,273,857 (L222), L108,484,953 (L224), L111,125,269 (L277), L113,549,532 (L293). Each record has operation search_cards, providerDispatchAttempts, providerPages, rawCount, returnedCount, providerStageMs, localMs, durationMs. Queries are recorded immediately afterward.

Root cause: collection_scope applies local ownership filtering while live provider pages over the global query, repeatedly scanning thousands of globally eligible cards. Broad OR queries amplify cost. Explicit field projection reduces output but does not avoid traversal; all-tag enrichment adds substantial local cost. More precise research-derived queries and collection-first browsing can improve agent usage now. A provider optimization for collection-scoped matching (e.g. a correct bounded identity/name restriction strategy or local supported criteria) would require design/testing; do not silently claim existing live search is local or complete before exhaustion.

## Perceived editing slowness was generation, not DB execution

L248 result12:37:47.758Z→L249 next call12:42:50.998Z =303.24s. User interrupts L25012:43:03.204Z→L251 next call12:49:01.047Z =357.84s; successful edit returns L25212:49:01.645Z =0.598s. L249 emits a huge expanded replacement that is interrupted before any result; L251 generates another huge replacement. L253 says saved but does not read it back before compaction despite promising verification. Avoid rebuilding entire narrative for each checkpoint; store compact structured research increments and separate user-requested full narrative, with verification of the actual changed field. Do not diagnose SQLite from these gaps.

## Final availability cursor errors were agent corruption, not stale DB

L351 first check returns cursor with baseline `5f48aa773daa5c83b38d8ee487d1cb0246ae51fb6ad6a8bf8c7d1190a8060a72`, position97. L353 correctly continues and returns position147 under same baseline. L356 uses a different malformed base64 string, yielding L357 invalid_cursor. L359 attempts repair but its decoded baseline is `5f48aa773daa5c83b38d8ee487d1cb0246ae51R1fed6a8bf8c7d1190a8060a72` (altered middle), yielding L360 stale_cursor. No intervening candidate mutation. The baseline code hashes result/binding rather than check timestamp, so do not infer nondeterminism from evidence publication. These are literal copying failures. Use opaque stable short cursor handles or a harness-side continuation reference to reduce model transcription risk; skill should copy exact cursor, never reconstruct or edit it.

The agent then loads complete Availability via get: L367/370/372/374/376/378, six pages around50k each, including full ownership_allocations and allocations. Pull-list L355/358/361 already traversed much of equivalent information. This is heavy duplicated witness retrieval. L351 already had check_completion complete and sufficient true; checking all witness rows is unnecessary unless assembling a detailed pull list. At the end L415 appropriately uses check_collection_availability first0; L418 returns complete summary, no edges, sufficient true,287 witness records left unrequested. This is the useful default for a check. Probability results are tiny (~349 chars each), not the context problem.

## Other observed friction / priorities

- The agent repeatedly restarts broad retrieval after manual corrections; L274–277 redoes all power≤2 owned creatures, despite earlier discovery. Candidate pool dedupe helps persistence but does not avoid paying traversal or context again. Track completed query families and remaining cursors in compact checkpoint.
- L298→299 whole edit fails because contribution21 rationale is504 code points, limit500. The agent resends large batch. Surface bounded field constraints clearly; use short rationales/evidence separately. This is input-generation error under a valid schema.
- Tool selection alone is insufficient: user explicitly has to request snowballing L115, action-first commander analysis L169, researched search criteria L171, support vegetables L189, probability-backed role quantities L309, and colored mana/curve analysis L380. These are workflow ordering failures, not absent tools.
- A full game-action executable graph is unnecessary to fix these observations. A small commander action/dependency map with exact trigger distinctions, research/search matrix, turn sequence, probability assumptions, selected vs alternative roles, and checkpoint meets what the successful user-guided workflow actually needed.

## Recommended next implementation boundary

1. Rewrite strategy entrypoint with ordered outputs and completion criteria: brief→Oracle/rules action map→exemplar/tag/search research→owned discovery→assessed pool→probability/role and mana plan→assembly→summary checks/pull list.
2. Fix accepted-long-field readback and test roundtrip through budgeted plan retrieval.
3. Add task-shaped compact tag/candidate/availability outputs; summary checks use first0 now.
4. Treat provider/global traversal optimization and short opaque cursor handles as separately scoped tool work with regression cases, not prose-only fixes.
5. Forward test the revised skills against an unfamiliar commander, examining whether agent reaches tools without user prompts and whether every checkpoint can be resumed.
