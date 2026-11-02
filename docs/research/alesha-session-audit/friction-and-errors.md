# Alesha session friction and error audit

Scope: all 419 JSONL records in `/Users/osmall/code/tomekin/session_alesha.jsonl`, including all 32 user-role messages, all four ask_user answers, all tool-result errors, compaction, and repeated skill reads. Line numbers are one-based JSONL physical lines. Log source is `/Users/osmall/code/tomekin/.data/tomekin.log` (4.3 GB, pretty Pino), audited separately for targeted correlations. Session message history covers 2026-10-20 13:56Z through 2026-10-21 13:53Z; exported session header says Oct21 13:53, so use message timestamps for correlation.

## Main findings

1. **High: strategy was available as prose, but the agent advanced without completion evidence.** User L49 asks whether the graph is sorted. Assistant L52 admits saved plan has only two broad roles/seven options and no explicit win routes or relationships, despite L48 saying the core is saved and next is assembling a draft. L58–60 then creates 11 roles, two routes,21 relationships. User L86 asks whether template roles are filled; L91 acknowledges only16 assessed options/zero selected cards and earlier updates implied too much progress. L92 asks whether enough pool cards exist; L94 directs actual expansion. Correction: make stages and their done criteria visible: analysis -> researched predicates -> assessed pool -> quantitative composition -> selected deck -> validation, report the current stage and specific remaining need.

2. **High: commander constraints were noted but not consistently used as selection logic.** User L115 explicitly asks for tag snowballing. After L126's snowball pass, user L128 says power<=2 synergy creatures should have been prioritized at the start. Assistant L129 admits it knew but failed to apply this consistently; L133 reprioritizes the104-option pool. Initial broad query L26 already used power<=2, so the defect is not total ignorance of Alesha: later assessments drifted toward generic Zombie/sacrifice fit. User L134 supplies the full action-first method (early deployment, actual attacks, protection/evasion/haste, colored payment, ETB/death/damage timing, support, winning). L169 again insists setup needs must include sacrifice, self-mill, discard, surveil and requests a full ability breakdown *before searching again*. L170 finally provides the highly useful nine-section reasoning the user praises at L171. Correction: derive costs, prerequisites, events, recipients, timing, outputs, resets and winning conversion before card searches; distinguish commander-return targets from justified support.

3. **High: research was user-orchestrated.** L171 directs exemplar-based tag research for every branch, tag-definition inspection and precise non-tag filters. L189 has to add generic support/vegetable roles and demand the same research quality there. The agent had not treated these as normal required research work. Correction: every search branch gets the mechanical need, exemplar, verified tag meaning or Oracle alternative, numeric/type/zone/timing restrictions and assessment question. Exemplar may be unowned; inclusion evidence remains owned legal cards.

4. **High: quantitative reasoning came late, only after user intervention.** First hypergeometric calculator call is L315 (13:23:44Z), after user L309 specifically demands turn-by-turn logic and probability to size roles. By then166 options have been assessed. User L380 again demands mana-curve/color-source analysis after the100-card list is presented; L403 admits the13 Swamp/2 Mountain/4 Plains basic split lacked adequate colored-source analysis. Agent reports old13 red routes give77.3% source-seen by turn3; proposed20 give90.8%. Correction: define productive-turn requirements before selection; measure role access, lands, colored deadlines and commander activation; assess overlap/dependence, tapped sources and mana reuse separately. Use probability for measurable configuration decisions, with inspected rules for what each card actually does.

5. **High: continuity depended on a human recovering the research.** L230 asks research be saved before compaction. L237 claims research/handoff saved; user L238 cannot find Markdown. L241 explains it is `plan.description`, not candidate Markdown. User L242 questions completeness; L243 admits a condensed handoff, not the full reasoning represented earlier. L244 requests full Markdown; L251 saves ~50.9KB arguments. Following sole compaction L254, L267 fails to return description: complete record requires51,344 bytes versus51,200 tool budget. L270 says it remains in conversation, although full research is not in the compacted summary; L273 user pastes full plan to restore it. Correction: use the designated persisted Markdown field/tool where supported, read back the actual continuation artifact before saying it is safe, keep a compact checkpoint/index plus separately retrievable research sections, expose bounded text reads rather than accepting unreachable atomic strings. Caveat: compaction firstKeptEntryId=L249 retains a preceding attempted44KB version and subsequent save in suffix; some research did remain in suffix, but the durable database read definitely failed. Avoid overstating that *all* prior research was lost.

6. **High: apparent slow edit tools were often slow generation of huge mutations.** L248 summary result12:37:47.758 -> L249 edit invocation12:42:50.998 =303.24s generating44,057-byte arguments. User complains L250 at12:43:03.204. Next L251 edit invocation12:49:01.047 =357.84s later, now50,932-byte arguments; L252 tool result arrives0.598s afterward. Similarly user L303 says edit took a bloody long while; L298 large mutation failed rationale length and L300 regenerated it. Correction: incremental bounded research writes, preserve roles via focused updates rather than re-emitting whole graph, separate model drafting latency from tool runtime in diagnostics. There is no evidence that rereading a small summary itself caused the five-minute delay; assistant L251's claim of 'overcomplicating with more retrieval' is not supported by observed extra calls in that interval.

7. **Medium: needless skill rereads consumed substantial context.**34 read calls returned389,924 UTF-8 bytes total. Root lifecycle17 times (L5,54,62,87,95,135,172,190,211,245,256,304,310,339,381,407,413); Commander architecture5; query6; shared method4; tuning2. Only one compaction L254. Some post-compaction reads are warranted; repeated loads within one active window are not. E.g. root read at L407 to persist a narrow authorized mana update, then again L413 to run checks one minute later. Correction: phase-oriented entry point, load active reference once and retain loaded-doc list/checkpoint, refresh only after compaction or an actual changed-contract need. These are actual returned context bytes; input cache and attention impact cannot be reduced to dollar cost without provider metrics.

8. **Medium: search scope was mistaken for the whole brief.** User L61 says inspect new location alone and improve list from there. Agent L67 asks whether Wretched Ranks is sole card pool; user chooses yes. L77 then says no commander/basics there and requests exception. Ask-user response L78 clarifies original all-location policy remains and new location was just new-card research. Agent L79 admits narrowed scope incorrectly. Correction: keep temporary query scope separate from persisted Collection Access Policy; a search-local instruction refines the search unless the user changes deck-wide sourcing. Ambiguity here was real, but the tool question led the user into an unnecessarily broad interpretation.

9. **Medium: generic mana foundation was underweighted relative to synergy.** User L167 says Sol Ring and rock package should be in skill. Agent L168 admits overemphasizing inability of colorless mana to pay Alesha's hybrid trigger rather than recognizing it casts commander/equipment/support and preserves colored sources. Correction: maintain normal functional base and search synergy alternatives as complements; inspect whole-turn budgets rather than a single activation in isolation.

10. **Medium: tag browse cannot return only requested semantic facts.** User L208 complains URLs/junk. Agent L209 confirms browse_tags has no select and admits last hierarchy request too broad. Correction in skill: targeted detail and shallow hierarchy; tool change: selectable fields/compact semantic response. This cannot be fully fixed by instructions.

11. **Medium: time/token pressure caused repeated user management.** L230 pause and save before compaction; L250 speed intervention; L404 wrap-up; L406 narrow 'persist...do nothing else'; L412 run checks near context limit. Agent ultimately respects L406 narrow mutation and labels previous validation stale at L411; final L415 uses availability first=0, a good compact check pattern. Correction: finish evidence and checkpoint proactively, keep compact summary of remaining work, avoid full witness pages unless sources are needed.

## Actual error inventory (14 results)

|Result line/id|Failure|Cause/recovery evidence|
|---|---|---|
|31 /91acaf47|search invalid_cursor/malformed|L30 continuation is338 characters versus336 in L29 returned cursor; L32 retries visually corrected string successfully atL33. Cursor-copy/tool contract issue; opaque values should be reused exactly.|
|45 /33ef134c|edit validation_error|Desired role haszero selected contributors but summary lacks gap explanation. Corrected larger mutation succeedsL47. Schema contract discovered by failure.|
|82 /5721fbb1|edit validation_error|Source must be a role; competition must join roles. L81 graph contains invalid relationship endpoint; correctedL83 succeedsL84.|
|143 /d56bdbe3|search provider_error invalid_response|Invalid provider page. Same class repeatedL145 and155; needs provider adapter/log analysis, cannot infer unsupported card mechanic from this error.|
|145 /02b586ca|same|See above.|
|155 /cebcc0a7|same|See above.|
|226 /bdf43c1a|search invalid_cursor|L224 returned332-character cursor; L225 submits329 characters; L227 retry submits334. Both copies are corrupted.|
|228 /ef47fa09|same|See above.|
|267 /ca5f2beb|get plan record_too_large|Atomic description51,344 required bytes >51,200 limit; first=1 cannot repair oversized single value. Persistence accepts content retrieval cannot read.|
|271 /472ea1aa|search cancelled|User interruption while tool running; explicitly retryable. Not independent product fault; retain last delivered cursor.|
|299 /aa002aa9|edit validation_error|Contribution index20 rationale504 Unicode codepoints exceeds500. Large edit rejected atomically, regeneratedL300. Improve compact predictable write contract.|
|357 /ce8012ef|availability invalid_cursor|L353 returned152-character cursor; L356 submits179-character cursor. L359 retry has152 characters but still differs from original, then gets stale errorL360.|
|360 /ed7dc422|availability stale_cursor|Tool says requirements/policy/import changed; no intervening candidate mutation betweenL347 check andL359 retry. Submitted cursor is still different from originalL353, so corruption is established; baseline defect is unproven. Do not claim user changed policy here.|

No other toolResult has isError=true or top-level status:error/error object. Text matches such as 'error' inside skills or checks are not counted as actual failures.

## Evidence cautions

- Research progression and tool projections are being reviewed by sibling audit agents, so this report emphasizes friction, all actual failures and continuity.
- Some two-day elapsed time is a user/session gap (L60 Oct20 toL61 Oct21), not tool latency.
- User handholding is demonstrable from interventions; internal model motives and why rereads occurred remain hypotheses.
- Full executable game-action graph is not established as necessary by these failures: the useful artifact was a reasoned action/dependency/search worksheet layered onto existing contextual Deck Roles.

## Targeted log correlation

Scanned all113,662,919 log lines once, selecting blocks by exact tool-call correlation IDs (selected correlations below). Local log timestamps are UTC+11 and correspond to transcript UTC (e.g.23:49:01 local =12:49:01Z).

- L44 failed edit -> log101,337,492 `[01:07:57.799] Pi Worker output serialized`,196 bytes.
- L81 failed relationship edit -> log101,541,258 `[22:23:31.740]`,120 bytes.
- L251 expanded research save -> log108,493,442 `[23:49:01.639]`,593 bytes; serialization1.213ms. L252 transcript result12:49:01.645Z confirms sub-second actual execution/return after the long generation interval.
- L266 oversized plan read -> log108,494,058 `[23:52:23.133]`,771 bytes; matches L267 failure.
- L298 rationale validation failure -> log113,552,502 `[00:07:46.553]`,293 bytes; serialization3.573ms.
- L300 successful replacement -> log113,557,124 `[00:10:23.667]`,5,942 bytes.
- L249 attempted expanded edit has **no exact correlation-ID block** anywhere in log and no tool result in transcript. It appears interrupted before execution; do not count its five-minute generation interval as edit runtime.

These selected blocks expose adapter serialization duration, not total service duration. Timing assertions above use matched transcript call/result timestamps.
