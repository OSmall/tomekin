# Matched Pi / OpenCode real-session acceptance

This protocol prepares [#26](https://github.com/OSmall/tomekin/issues/26) under
[#86](https://github.com/OSmall/tomekin/issues/86). It is a manual acceptance procedure, not evidence of a completed
live run. OpenCode remains supported. Track progress and acceptance in GitHub Issues; keep approved sanitized evidence
with the evaluation artifacts. Use the [result template](real-session-parity-results-template.md) for each matched pair.

## Prerequisites and authority

Before running a model, the account holder must choose/approve the provider, exact model and effort, account usage,
network access, Pi login/profile interaction and the synthetic-fixture scope. Human outcome review is a separate gate.
Do not inspect authentication files or private Collection/session data to fill these fields. Implementation authorization
or a passing scripted adapter test does not supply account-holder consent or human acceptance.

The actual new-path gates are the completed retrieval/policy/candidate/check/Availability foundation, integrated
workflow methodology [#64](https://github.com/OSmall/tomekin/issues/64), measured edit/check evidence
[#35](https://github.com/OSmall/tomekin/issues/35), and reviewed Pi question-extension boundary
[#42](https://github.com/OSmall/tomekin/issues/42). The optional legacy compiler optimization
[#40](https://github.com/OSmall/tomekin/issues/40) is not a prerequisite. Keep legacy retrieval disabled.

Record the reviewed revision and current deterministic `bun test`, `bun run typecheck` and workflow/performance
artifacts before representing live runs as release evidence. The existing [workflow evidence](workflows.md),
[performance evidence](candidate-performance-v1.md) and [manual corpus](../testing/deck-building-workflow-scenarios.md) have
separate jobs: exact fixture behavior, descriptive local timing, and human strategic judgment. Reuse a recorded passing
check on the same revision; documentation edits alone do not require another full suite.

## Prepare matching isolated inputs

From the workspace root:

```sh
bun run evaluate:parity:prepare
```

This opt-in developer command performs no network/model/account operation. It accepts no target path or other arguments;
it always creates a new temporary directory, imports the two committed public reference JSON fixtures through existing
import services, imports a synthetic ManaBox CSV, closes SQLite, and copies one baseline to `pi.sqlite` and
`opencode.sqlite`. It cannot select an existing or production `.data` database. The printed manifest gives absolute
paths and source SHA-256 hashes. Preserve that manifest beside private run notes; read the active import ID through
`list_collection_locations` in each session. Reference and Collection import times are fixed at 2026-10-18T00:00:00Z
for this fixture; distinguish those times from actual run time. No candidates are precreated. Generated import/location
IDs may differ between preparation invocations; copies within one pair share them.

The bounded fixture has eight public Card Identities, six Printings, eight owned rows and ten copies. Both binder and
deck are named `Parity Shelf`; allow only the exact **binder** unless a later instruction expressly changes permission.
Kenrith is in the excluded deck. Sol Ring has one old foil binder copy and one recent foil deck copy. Cultivate has one
recent nonfoil binder copy and three old nonfoil binder copies. Other source-added dates are unknown. Arcane Signet's
owned Printing is Italian; Fire // Ice's is Japanese. Preserve those facts instead of inventing English copies.
The date exercise uses `[2026-10-17T00:00:00Z, 2026-10-18T00:00:00Z)` in UTC, not the operator's current “yesterday.”
No tag dataset is imported; unavailable tags must remain unavailable, not a verified empty catalogue.

There are no basic lands and too few identities for a normal completed deck. This fixture establishes bounded
retrieval, provisional construction, resumption, tuning, permission and shortage behavior. It cannot establish a legal
completed deck, broad Opportunity quality or exhaustive source coverage. The integrated synthetic Feast demonstration
uses an injected provider; its synthetic card names are not live Scryfall searches.

For the full positive corpus, the additional prerequisite is an approved larger **public** reference import/sync and a
reviewed synthetic ManaBox fixture containing enough known cards/basic lands for the selected Format and manual
scenarios. Record its files, hashes, cardinalities, import IDs/times and expected demands before sessions; prepare one
baseline and two closed-database copies. Do not substitute the user's private Collection. An explicitly authorized
public sync can use the existing `bun run sync:scryfall -- --db <isolated-database>` command; sync changes dependencies
and requires a new matched baseline. Until this input is prepared, mark positive completed-deck rows `blocked`.

After final code review and account-holder consent, run one process at a time from the same reviewed checkout:

```sh
TOMEKIN_DB_PATH="<manifest databases.pi>" TOMEKIN_LOG_FILE="<manifest directory>/pi.log" TOMEKIN_ENABLE_LEGACY_QUERY=false bun run tomekin
```

Exit Pi before starting the matched OpenCode run:

```sh
TOMEKIN_DB_PATH="<manifest databases.openCode>" TOMEKIN_LOG_FILE="<manifest directory>/opencode.log" TOMEKIN_ENABLE_LEGACY_QUERY=false opencode
```

Select the local `tomekin-deck-builder` agent in OpenCode. Keep the same provider/model/effort and explicit user replies;
record any unavailable combination as unmatched, not equivalent. Keep default info logging. Raw conversations remain
private and outside the repository; account settings and auth remain owned by the harness. Pi's normal clone-local
profile is persistent; the fixture command does not create, read, or copy it. Do not delete profiles at cleanup.

## Matched workflow sequence

Start fresh conversations without previous card recommendations. Use the same frozen text and staged human replies in
both harnesses. Replace only returned candidate/import/location IDs. A human records materially different replies.
The following are controls, not a golden deck or an automatic strategic score.

**Discovery Brief**

```text
This is a bounded public-card/synthetic-Collection exercise. Use Casual 60, illustrative power, approachable play,
no Missing Cards, and only binder "Parity Shelf"; exclude deck "Parity Shelf". Confirm the exact scope from the tools.
Compare plausible mana-development/recursion directions using the locally known cards. Do not build or persist a deck
until I choose. Explain missing functions and whether the tiny corpus supports any genuine Opportunity. Inspect the
fixed UTC recent-addition interval [2026-10-17T00:00:00Z, 2026-10-18T00:00:00Z) and independently check undated rows.
Recent cards are inspiration; this does not restrict assembly to recent copies. Do not invent missing tag coverage.
```

Allow an honest “insufficient evidence” outcome. Public-provider probe, after query guidance: request a bounded
`search_cards` search for `name:"Cultivate"`, `unique: "cards"`, selecting name and complete rules text; request further
pages only where supplied. Compare to local lookup only for this explicit discrepancy test. Record source/import
versions and material differences. A representative search Printing does not prove owned-Printing coverage. For the
positive corpus also run catalogue-valid seed exploration plus independent functional/text discovery; never invent a
slug because the small fixture lacks tags. Inspect multipart local facts using Bala Ged Recovery and Fire // Ice.

**Construction Brief and replies**

```text
Choose the mana-development/recursion direction as a provisional exercise. Save an incomplete candidate labelled
"Parity provisional" with our confirmed Brief, meaningful plan roles, assessed known-card alternatives and explicit
unfilled needs. I authorize this provisional progress, including empty selected membership. Do not claim a legal,
completed or assemblable deck. Preserve conditions and uncertainty with the reasoning that owns them.
```

Close and resume the session, then request the candidate by its returned ID. Check the Brief, retained reasoning/pool,
empty selection and absent evidence survive. Authorize selecting one binder Cultivate and one binder Arcane Signet as
incomplete Mainboard progress. Pool-only options do not count as selected coverage. For the larger positive corpus,
continue the chosen manual construction scenario to actual Format-sized membership before final checks.

**Tuning Brief and staged reply**

```text
Review replacing selected Cultivate with the known Bala Ged Recovery option, and separately increasing Arcane Signet
by one. Explain additions, cuts, every material lost/gained function, quantities, sections and the persistence target.
Keep both changes as a proposal for now; my Brief alone does not authorize these later swaps.
```

Reply identically in both sessions: “Accept only the Cultivate swap for consideration; reassess that aggregate and show
the exact resulting change set before saving.” The next reply confirms only that reviewed result. A changed result
needs matching authorization; covering prior authorization should not provoke repeated per-option questions. Expect
mana-development versus recovery/modal-land trade-offs, no credit for the unaccepted Signet increase, retained viable
cut options and incomplete-deck caveats. An insufficient strategic case is an acceptable reason to challenge the swap.
Use manual scenarios 8/13/15 on the positive corpus for secondary-function loss and real partial-acceptance tuning.

**Assembly Brief**

```text
Inspect actual selected quantities/sections and our current policy. Explicitly check legality, evaluation and whole-deck
Collection Availability for this saved candidate. Retrieve the complete bounded proof/Pull List and Portable Decklist.
Exclude pool-only alternatives. Distinguish missing ownership, policy shortage and uncertainty; never call incomplete
membership a completed legal deck. Explain applicable versus absent/outdated evidence.
```

Add a read-only trial requiring the same single owned Bala Ged Recovery in both Mainboard and Sideboard: a total of two
demands with one owned copy must show one Missing-owned copy, without publishing trial findings as saved evidence.
Separately request two Sol Rings under binder-only permission: two owned, one eligible, zero Missing-owned and one
Policy Shortfall. Do not change actual membership/permission merely to make these probes pass. In the positive corpus,
require current complete joint proof for the exact final membership and policy before an assemblable claim. The small
probes establish allocation semantics even when the provisional deck independently fails Format size.

## Recovery, boundaries and session checks

Record each row separately for each harness. `not observed` or `blocked` is honest; deterministic coverage or a verbal
hypothetical must not be relabelled as an observed live fault. Do not deliberately trigger upstream throttling.

| Check | Required observation |
| --- | --- |
| Initial / reload / resume | Pi identifies as Tomekin and reads root `tomekin-deck-building` before product tools each time; query guidance precedes the shaped provider probe where needed. OpenCode loads the same canonical root/method/Format skills through its native route. Record the harness-native reload action/version used. |
| Exact surface | Compare current audited product tools/closed schemas to actual loaded sessions; Pi adds only constrained skill `read` and `ask_user`. OpenCode uses its reviewed native question/skill permissions. No shell/raw DB/general files/network tool/ambient skill or default legacy retrieval is granted to the model. |
| Question boundary | Answer and cancel a normal clarification. Scope remains unchanged on cancel; no invented reply or permission. Verify authentication, harmless request, expected tool success/failure, account-holder logout/recovery if approved, and clean exit without exposing credentials. |
| Bounded output | Use small `first` for card/owned-row/candidate views and follow every supplied continuation needed for the decision. Whole text/faces/reasoning survive. No preview is passed off as complete; incomplete scans stay explicit. |
| Expected errors | Unknown known-card reference is an explicit local miss; invalid selector is an actionable request error. Recover using supported fields rather than dropping evidence/permissions. Unavailable tags are not empty confirmed tags. |
| Provider drift / local miss | A newer provider identity absent locally is a reference discrepancy, not nonownership or safe persistence. Explain and seek explicit sync authority; no automatic sync or widening of scope. A successful explicit sync creates a new baseline/dependencies. |
| UI / cancellation | During an observed slow read, terminal/spinner remain responsive; Escape cancels a read. If no slow call occurs, record not observed. Dispatched writes/check publications settle; never call an unknown outcome cancelled or blindly retry it. |
| Conflict / unknown outcome | Supervised stale-timestamp edit must reload/reconcile and preserve authorization for the actual result. Unknown edit outcome requires reading affected records; unknown create requires list/detail inspection, not label uniqueness or duplicate creation. Use deterministic transport evidence where a safe live fault was not observed. |
| Reference / policy restrictions | Binder/deck name collision stays exact. Strict recent-copy intent counts only the one recent Cultivate, not its three old copies; exploratory inspiration may use all four. Unknown dates remain visible. Actual Printing language/finish restrictions apply on the same owned row. |
| Reimport | After a failed import, unchanged last-successful snapshot remains usable. After successful replacement, old scope/row refs/cursors and Availability cannot be reused; list locations, reconfirm scope, resolve restrictions and recompute. Matching names alone do not reauthorize. |
| Confirmation / evidence | Partial acceptance is reassessed before matching save authority. Create/edit/read/export do not implicitly check. Trials stay transient. Relevant selected/policy/reference changes invalidate affected evidence; pool-only edits do not blindly erase selected legality. |

For reimport, fully exit the current harness first, target only its manifest database, then resume that harness. Repeat
for the other copy at the same sequence point. This tests between-session freshness without unsupported simultaneous
provider owners. Use a deliberately malformed new CSV in the temporary directory for the failed-import case, then the
unchanged generated `synthetic-collection.csv` for successful replacement:

```sh
TOMEKIN_DB_PATH="<one manifest database>" TOMEKIN_LOG_FILE="<manifest directory>/import.log" bun run import:collection -- manabox "<malformed CSV path>"
TOMEKIN_DB_PATH="<one manifest database>" TOMEKIN_LOG_FILE="<manifest directory>/import.log" bun run import:collection -- manabox "<manifest collectionCsv>"
```

A failed shell invocation alone is not proof of transactional failed-import behavior; note the actual error/stage.
For stale-cursor tests retain only the returned token privately; do not decode it in the model or publish it.

## Evidence and decision

Human review records pass/fail per applicable invariant and source evidence anchors. Any critical permission,
confirmation, integrity, illegality or false-completeness failure fails that scenario regardless of prose quality.
Classify differences as product/adapter defect, model variance, source drift, fixture limitation or unmatched conditions;
model variance does not excuse an invariant violation. No LLM judge, aggregate quality score or exact-card golden list.

Measure application output and adapter-visible UTF-8 bytes separately when actually available; state missing captures.
Label token estimates/method separately from harness-reported actual usage. Attribute timings only to observed stages;
conversation elapsed time does not establish provider/repository latency. Record repeated facts/full candidate payloads,
whole-record loss and recovery, without fabricated recall/throughput or a frozen live-corpus claim. Do not publish
queries/cursors, private prompts, account identifiers or raw Collection/session payloads as sanitized aggregates.

Close #26 only after required matched runs and human review establish its acceptance, including the positive corpus.
Keep #86 completion and the PR's readiness honest while any required gate remains. Preparation or deterministic CI alone
never passes #26. Remove only generated temporary fixture directories when the account holder no longer needs them;
preserve approved sanitized evidence and leave normal databases/profiles intact.
