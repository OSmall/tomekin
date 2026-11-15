# Autonomous deck-building acceptance workload

This is the compact manual workload for [#134](https://github.com/OSmall/tomekin/issues/134) and the completion gate in
[#118](https://github.com/OSmall/tomekin/issues/118). The [validation disposition](#validation-disposition) summarizes
the observed outcomes and deferred coverage. Deterministic handler and adapter checks establish delivery contracts.
The manual sessions exercise autonomous strategic behavior. The separate Pi/OpenCode parity gate is tracked in
[#26](https://github.com/OSmall/tomekin/issues/26).

## Reviewable run scope

Use one reviewed integration revision and the repository's pinned Pi, with one account-holder-approved provider, model,
effort, account-use and network scope. Record these values and any spending or duration limit agreed with the account
holder before running. Use a new isolated database and synthetic Collection only; never point this workload at a user's
existing database, Collection, candidate, or private transcript. Pi owns authentication and profiles. Keep raw sessions
and cursors private, outside the repository. This procedure does not authorize a model run, live provider search, public
reference sync, or account access.

Run each of the three sessions once, sequentially. Prompts below are initial requests; allow genuine preference answers,
agreement of initial action analysis and ordinary choices. Do not supply methodological coaching. Combine the recovery,
explanation and pool-only checks with the first session; do not repeat a full construction for each check. Record any
necessary prompt such as “research complementary functions” or “you skipped mana analysis” as an autonomy failure even
if the agent later corrects it. Do not treat a retry as an unassisted pass. Stop at the approved boundary and record any
unfinished work rather than widening scope.

## Required isolated input

The existing `bun run evaluate:parity:prepare` fixture contains eight identities, no basic lands and no tag dataset. It
cannot establish a completed-deck result. A larger public/synthetic fixture was prepared at
`/private/tmp/tomekin-118-acceptance-public/`, with its manifest, source hashes, import ID, location IDs, baseline and
working database. This temporary directory may be cleaned by the operating system; preserve it before relying on it.

The source is the static 2026-10-15 [Oracle snapshot](https://data.scryfall.io/oracle-cards/oracle-cards-20261015210157.jsonl.gz)
and matching [tag snapshot](https://data.scryfall.io/oracle-tags/oracle-tags-20261015210033.jsonl.gz). No provider query
or model session was used for preparation. The imported Oracle file contains 38,751 records and the tag file 4,579
definitions. The `all_cards` import deliberately contains only 1,638 representative public Printings selected from the
Oracle snapshot: it is **not** a complete Printing dataset, even though it uses that import type. Do not infer Printing
coverage or source freshness from readiness. The source is dated and will trigger source-age qualification; reimporting
new sources changes the baseline and requires renewed review.

The synthetic Collection has 1,639 rows and 6,783 copies in `Acceptance Binder` and `Protected Deck`. Select the binder
only. It includes each paper, Commander-legal identity with EDHREC rank at most 1,500, plus the first 300 ranked paper,
Commander-legal white/black/red identities with creature power 0, 1 or 2, both named anchors, Cultivate, Blighted
Woodland, War Room and the five basic lands. Rows use four copies per nonbasic and 50 per basic, plus one War Room in
the protected deck. These synthetic quantities are intentionally generous; they are not a real inventory, a claimed
strategic recommendation or proof the requested strategies are supported. Each Collection row uses the representative
Printing's actual public ID, set, collector number, language and supported finish; ManaBox IDs are unknown and produced
1,639 import warnings. The manifest records checksums and exact cardinalities. The public handlers found the anchors,
Cultivate, utility lands, Island and Forest, returned both Collection locations, and recovered actual `landfall` and
`reanimate-creature` definitions. Human review must still assess the fixture's suitability and actual strategic outcomes.

`baseline.sqlite` is the closed imported baseline; `work.sqlite` is an identical working copy before any model session.
Keep the baseline untouched and copy it again for a new run. Reference imports use the snapshot's original 2026-10-15
source time rather than the time the derived JSON was written. The exact input files, source hashes, policy, code revision,
model settings and any further changes belong in the evidence record. This preparation establishes neither a complete
deck nor live-model behavior.

To reproduce the inputs from the workspace root, fetch the two static public snapshots and run the checked-in
[`prepare-118-fixture.py`](../../packages/evaluation/prepare-118-fixture.py) with Python 3. The output directory must
not exist. These steps do not invoke a live card-search API or a model:

```sh
curl -fL -o /private/tmp/tomekin-118-oracle-20261015.jsonl.gz https://data.scryfall.io/oracle-cards/oracle-cards-20261015210157.jsonl.gz
curl -fL -o /private/tmp/tomekin-118-tags-20261015.jsonl.gz https://data.scryfall.io/oracle-tags/oracle-tags-20261015210033.jsonl.gz
shasum -a 256 /private/tmp/tomekin-118-oracle-20261015.jsonl.gz /private/tmp/tomekin-118-tags-20261015.jsonl.gz
python3 packages/evaluation/prepare-118-fixture.py /private/tmp/tomekin-118-oracle-20261015.jsonl.gz /private/tmp/tomekin-118-tags-20261015.jsonl.gz /private/tmp/tomekin-118-recreated
```

The Oracle and tag gzip SHA-256 hashes must respectively be
`458490e4c0d1d1cdcf141b3378eb93080333f093ea6fa49184eb641cc914af85` and
`0a57c86fbb7dfc75d24d0fbf1b4e1bf505cd046ab82c965e8c6e44651afae4fd`. A separate regeneration produced byte-identical
hashes for all four derived input files in the prepared manifest. Source files may expire; preserve them and the manifest
for later use. The generator writes only into its new output directory and never selects an existing database.

Create a database only in the new output directory. The local import command uses file modification time for source
freshness, so set the derived reference inputs' times to their respective snapshot times before import:

```sh
TZ=UTC touch -t 202610152101.57 /private/tmp/tomekin-118-recreated/oracle.json /private/tmp/tomekin-118-recreated/selected-printings.json
TZ=UTC touch -t 202610152100.33 /private/tmp/tomekin-118-recreated/tags.json
TOMEKIN_DB_PATH=/private/tmp/tomekin-118-recreated/baseline.sqlite bun run db:sqlite:migration:apply
bun run import:scryfall -- --db /private/tmp/tomekin-118-recreated/baseline.sqlite oracle_cards /private/tmp/tomekin-118-recreated/oracle.json
bun run import:scryfall -- --db /private/tmp/tomekin-118-recreated/baseline.sqlite all_cards /private/tmp/tomekin-118-recreated/selected-printings.json
bun run import:scryfall -- --db /private/tmp/tomekin-118-recreated/baseline.sqlite oracle_tags /private/tmp/tomekin-118-recreated/tags.json
bun run import:collection -- --db /private/tmp/tomekin-118-recreated/baseline.sqlite manabox /private/tmp/tomekin-118-recreated/synthetic-collection.csv
cp /private/tmp/tomekin-118-recreated/baseline.sqlite /private/tmp/tomekin-118-recreated/work.sqlite
```

Database and import IDs and database file hashes differ on recreation. Inspect the new imports and locations through
Tomekin, record them, and leave the baseline untouched. Do not reuse a working copy as a fresh baseline.

## Session 1: construction, recovery, explanation and pool research

Use Tatyova, Benthic Druid as the Commander anchor, subject to checking that it is outside the final worked examples and
present in the fixture. Start a fresh Pi session with the synthetic binder's exact identity substituted below:

> Build a Commander deck around Tatyova, Benthic Druid for an approachable mid-power multiplayer table. Use only cards
> permitted by our synthetic binder, with no Missing Cards; preserve that policy throughout. I want a land-focused
> game plan with ordinary interaction and resilience. Lead the authorized work and ask when you need a genuine choice.
> Agree the initial action analysis with me before saving it.

After initial analysis is agreed, allow the agent to proceed. During substantial research, interrupt at a natural
boundary, record the last saved candidate and checkpoint, compact or resume through the supported Pi session path, then
ask: “Continue the unfinished work from our saved candidate.” Do not paste lost research. Inspect the actual saved
Resume note, research fields and all necessary pages. Record whether work, fixed inputs and safe cursors were recovered,
and whether any incomplete traversal was falsely called complete.

After a saved selected deck exists, ask: “Explain how this deck is meant to work and where it is vulnerable; do not
change it.” Then ask for focused pool-only alternatives for one weak function, without changing selection. Compare the
saved membership and quantities before and after. Inspect current reasoning, mana and quantitative assumptions, actual
final membership, and the applicable explicit legality, evaluation and joint Availability checks. A full list alone is
not strategic completion. If the fixture cannot support the Brief, retain and review the honest gap instead of forcing a
pass.

## Session 2: focused Alesha regression

Start a fresh session on the same isolated reference and synthetic Collection, with a separate candidate. Ask:

> Investigate a Commander deck around Alesha, Who Smiles at Death using our permitted synthetic binder. Analyze how
> the commander works and prepare the relevant research. Keep material uncertainty visible and preserve our policy.

Allow initial analysis agreement and authorized progression. Inspect setup, attack timing, payment, target and relevant
indirect-event distinctions. Where the candidate and fixture support one, review removal of a selected utility land
that also performs a non-mana function; accept only the actual change under review. Check that lost contributions,
selected quantities, current reasoning and any affected numerical assumptions are reconciled, including when the card
remains an alternative. If the prerequisites never arise, mark that observation blocked; do not invent it or replay the
entire historical session.

## Session 3: 60-card and direct questions

Start a fresh session and ask for an approachable Casual 60 deck using only the same permitted synthetic binder, with
no Missing Cards and no nominated commander. Ask the agent to propose a supported direction, await the human choice,
and construct it. Inspect repeated copies, applicable sections, strategy, useful quantities and actual final checks.
Then ask independently: “How many copies of Cultivate are in the permitted binder?” and “What is the probability of
seeing at least one of four copies in an opening seven from a 60-card library?” Record whether each direct question is
answered with suitable evidence and assumptions without compulsory construction, extra skills or a new checklist.
Only use a card actually present in the fixture; record its actual imported quantity rather than an assumed answer.

## Evidence record and human decision

For each session record the exact reviewed prompts and allowed human replies, revision, Pi/provider/model/effort,
fixture manifest and import baselines, start/end and observed interruptions. Record pass, fail, blocked or not observed
for each requested behavior, with sanitized evidence anchors and actual saved-state/check observations. Human review
assesses action analysis, complementary exemplars and tag meanings, ordinary support, research coverage, numerical
assumptions and trade-offs, Brief/play experience, and current selected-state reasoning. A legality or Availability
pass, successful tool execution, or corrected retry cannot certify strategic quality. Record interventions and material
failures, not just a preferred result.

Measure instruction loads and unnecessary repeats, serialized tool request/response bytes, actual tokenizer counts
where available, repeated identities/facts, failures and elapsed time alongside the useful outcomes. Keep billing/cache
counters separate from measured text tokens and mark unavailable counters unknown. For comparable fixture/request
baselines record cold/warm conditions and complete traversals, including pages and stops. Separate observed model,
human wait, provider queue/admission/HTTP and local time; provider subspans are nested, not additional elapsed time.
Label uninstrumented residual and unknown source coverage honestly. Do not claim savings for skipped work or infer live
throughput from fixture timings.

Publish only the reviewed sanitized conditions and results in the established evaluation documentation and link them
from #134. Explicit maintainer outcome acceptance remains required.

## Tatyova construction observation

On 2–3 November 2026 AEDT, the maintainer requested an approachable mid-power Commander deck around Tatyova with
ordinary interaction and resilience. An isolated SQLite database contained the dated public reference fixture and
synthetic Acceptance Binder and Protected Deck locations described above. The session used `openai-codex`,
`gpt-6.1-sol`, and medium effort. The checkout at review was `717dd27` with Pi 1.4.0 pinned. The export records model and
effort but has no independently captured Git revision. The maintainer approved the initial analysis and prompted
continuation after two deliberate compactions.

- **Construction and same-session recovery succeeded.** The agent connected Tatyova's land-entry trigger to land ramp,
  independent draw, interaction and combat payoffs. It compared options and used access probabilities to explain
  trade-offs in land count, cheap accelerators and primary threats. After each interruption it recovered the saved
  candidate and research without the maintainer supplying lost work. Some searches were repeated after a truncated
  response and an interrupted script with uncommitted checkpoints.
- **Selection and checks verified at the time of review.** The saved candidate contained Tatyova and 99 Mainboard cards,
  including 40 actual lands plus a separate spell-front land option. The Portable Decklist matched all 81 selection
  rows. All 100 copies were allocated from Acceptance Binder, with zero Missing Cards or policy shortfall. Legality,
  evaluation and Availability applied to the saved selection. The Collection and reference records matched the baseline.
- **Known shortcomings.** The evaluator counted Bala Ged Recovery // Bala Ged Sanctuary as a land and omitted its spell
  face from the curve. The agent separately reported 40 actual lands and the modal option. One saved Wave Goodbye role
  criterion retained earlier wording about tokens despite the final explanation correctly referring to +1/+1 counters.
  The maintainer reported initial satisfaction and a ManaTap score of 95/100. This is external balance feedback supplied
  by the maintainer. The score was not independently reproduced and there was no gameplay observation.

Elapsed time was 27m17s, including 3m15s awaiting initial approval. The export reports 16m24s of model time and 5m33s of
outer tool time. The remaining time includes compaction and interruption overhead. The log recorded 122 successful HTTP
responses, with about 4m07s of HTTP time nested within the tool durations. The compact broad traversal delivered 711
eligible identities across four tool calls and 75 provider pages. Completed mechanism branches overlap that inventory.
Eleven skill reads included reloads after compaction. The `o200k_base` text counts were 21,420 request tokens (88,892
bytes) and 91,073 result tokens (349,354 bytes). Separately, the assistant replies report 218,242 input, 24,259 output,
and 3,357,440 cache-read tokens. Compactions report a further 16,115 input and 3,327 output tokens. There is no matched
prior-revision run from which to derive a savings percentage.

## Tatyova follow-up observation

On 15 November 2026, the maintainer ran explanation and pool-only research in a fresh Pi session using `openai-codex`,
`gpt-6.1-sol`, and medium effort. The test was prepared from revision `717dd27`, with Pi 1.4.0 pinned. The original
temporary database had expired. The test used the pinned October public snapshots, a recreated synthetic Collection, and
a separately seeded candidate with the original selection, Brief, reasoning and 102 assessed options from the Tatyova
export. The import and candidate identifiers were regenerated and the three candidate checks were run before the session.

The user first asked the agent to explain the saved deck, its key cards and vulnerabilities without changing it. They
then asked it to research ways to close games from Acceptance Binder, allowing it to save assessed alternatives to the
Deck Card Pool while preserving the selected cards and quantities. These were the only user messages.

- **Explanation passed with recovery.** Two code-mode responses printed too much saved state, so their checkpoints did
  not commit. A subsequent script tried to read a missing checkpoint and failed before calling any tools. The agent
  recovered the complete selected, Plan and assessment views with bounded output and used focused Oracle lookups. It
  explained land development, the specific combat finishers, commander tax, and vulnerabilities to wipes and slow
  closes. It made no candidate writes during this request.
- **Pool-only research passed with a local fallback.** `search_cards` returned a provider ownership conflict before any
  HTTP request. The maintainer reported another Tomekin session was open in a separate tab and idle at the time. A
  process that has claimed Scryfall ownership can retain it while idle, so exit other Tomekin sessions before a live
  provider test. The agent disclosed the failure and switched to the local Collection browse and card lookup tools under
  the same binder-only policy. It recovered from two store size errors by retaining identity IDs instead of full rows and
  discarding redundant legality fields after filtering. It traversed all 1,638 binder rows, found 711 eligible identities
  under the local Commander and color-identity data, and screened 110 matches with tags and Oracle text. It saved nine
  reasoned alternatives, each with four eligible copies, after shortening comparison notes rejected by the 500-code-point
  field limit. Champion of Lambholt and Crashing Drawbridge were the strongest fits for the Brief because they addressed
  blocking and the delay before tokens could attack at low mana cost. The saved research and final answer disclose the
  dated local coverage. The live provider branches were blocked in this session.
- **Selection and check preservation verified.** Read-only SQLite comparison against the baseline confirmed all 81
  selected identity, section and quantity rows matched, totaling 100 copies. The agent also compared the complete saved
  selection including notes and ordering. The pool grew from 102 to 111 options, with one new contribution per option.
  The legality, evaluation and joint Availability evidence kept their original check timestamps and remained applicable.
  The reasoning review stayed `reviewed`. SQLite reported no foreign-key violations.

Elapsed time was 1m30s for explanation and 4m22s for pool research. Across both requests the export reports 5m39s of model
response time and 12.3s of outer tool time. The full 6m11s window includes the 19s between user requests and other
unattributed overhead. There were four instruction reads and 35 top-level tool calls. Counting serialized arguments and
exported result text separately with `o200k_base` gives 6,969 request tokens (27,112 bytes) and 51,577 result tokens
(201,474 bytes). The export separately reports 108,021 input, 9,494 output and 2,761,088 cache-read tokens. The log records
18 local Collection browse pages across two traversals and 61 local lookup completions, including repeated work after the
store failures. The single provider attempt recorded no pages, queue wait or HTTP work. There is no matched comparator.

The agent completed both requested outcomes without coaching. The repeated large reads and oversized stores are
efficiency follow-ups. The ownership conflict demonstrates the local fallback and leaves live provider-backed discovery
unobserved for this pool request.

## Alesha observation

On 15 November 2026, the maintainer ran the focused Alesha prompt in a fresh Pi session using `openai-codex`,
`gpt-6.1-sol`, and medium effort. The test used revision `717dd27` with Pi 1.4.0 pinned and a fresh copy of the recreated
public reference and synthetic Collection baseline. The request asked for agreed action analysis, followed by saved
research under Acceptance Binder only, excluding Protected Deck and allowing no Missing Cards.

- **Action analysis and research preparation passed with recovery.** The agent confirmed four eligible Alesha copies
  and obtained agreement before saving. It distinguished selecting the target from paying on resolution, power in the
  graveyard from mana value, and entering tapped and attacking from declaring an attack or becoming tapped. It covered
  safe attacks, graveyard setup, recycling, finite death payoffs, backup plans, and ordinary mana and interaction. It
  saved an exemplar and tag research map, with unresolved bracket, mana consistency and closing strength visible. The
  initial Brief drafting and structured edits hit validation errors. One retry assumed a failed script had committed its
  stored Brief. The agent recovered and saved through the normal tools without methodological coaching.
- **Live retrieval succeeded. Broader investigation remained incomplete.** One broad call returned 40 eligible identities
  after scanning 598 provider records across four successful HTTP pages. The agent saved a separate spot check of eleven
  eligible exemplars and disclosed the incomplete traversal. It stored the exact delivered continuation in code mode and
  never dispatched it. The saved instruction to restart from page one would repeat work if the original session and
  cursor are still usable. No completed complementary search traversal was observed in this pass.
- **Utility-land comparison passed at the option level. Selected-land reconciliation was unobserved.** When asked about
  Access Tunnel, the agent explained that it was a research lead. It proposed Shizo, Death's Storehouse and waited for
  approval. After approval, it recovered from a rejected comparison note over 500 code points and saved Shizo as an
  unselected option, with separate contributions for black mana and attack support. The notes captured the cheaper
  activation, its competing mana demands, and the loss of unconditional evasion for a qualifying creature. The original
  research request scoped the candidate to preparation. There were zero selected cards when the user approved Shizo, so
  this edit supplied no evidence about selected quantities, lost selected contributions, or recalculated mana assumptions.
- **Saved state verified.** The final candidate has 12 options, 13 contributions, zero selected cards and two saved
  research documents. Reasoning review is pending and check evidence is absent, consistent with a research candidate.
  Collection rows, locations, snapshot state and import records match the baseline. SQLite integrity and foreign-key
  checks passed.

The initial request took 6m28s. The full 12m24s observation includes about 5m01s between user requests and 51s waiting for
initial agreement. The export reports about 5m46s of model time and 45s of other outer tool time. The 42.7s search is
part of that tool time. The provider logged 31s of recovered-owner admission delay, about 10.6s of HTTP time and about
3ms of queue wait, all within the search. These logs show a conservative recovery delay and four successful responses.
Three skills were loaded once each, with 20 top-level tool calls overall. Using `o200k_base`, serialized tool arguments
were 10,038 tokens (39,408 bytes), and exported result text was 23,603 tokens (91,963 bytes). Separate counters reported
78,913 input, 12,154 output and 1,750,656 cache-read tokens. There is no matched comparator.

### Alesha provisional selection follow-up

The maintainer continued in the same Pi session and authorized a provisional selection, keeping Shizo and the
binder-only policy. The agent asked about table strength and the maintainer chose stronger, optimized casual. The
follow-up export includes the earlier research turns. Counts below cover only the new construction request.

- **Provisional selection passed.** The agent recovered the saved research after an oversized code-mode read, ran
  scoped lookups and completed two focused native searches for sacrifice outlets, setup and death payoffs. The searches
  returned eight and nine eligible results respectively. It explicitly left the earlier all-Mardu traversal incomplete.
  It saved 100 copies across 91 identity and section rows, including Alesha, 38 lands and 61 other spells, and kept
  Shizo while leaving out Access Tunnel. The Collection and import records matched the baseline.
- **Utility-land roles are saved.** The agent compared color and timing trade-offs and recorded non-mana contributions
  for seven selected lands. High Market contributes to land access and sacrifice recycling. Shizo contributes to black
  access and attack support, and its activation competes with Alesha's return payments. The agent distinguished those
  constraints from its estimates for drawing lands and color sources.
- **Checks apply to the actual selection.** The agent reread the saved selection and marked the reasoning reviewed.
  SQLite confirmed applicable legality, evaluation and joint Availability evidence for the current selection and Brief.
  Every allocated copy came from Acceptance Binder. There were zero missing, committed or uncertain copies. The
  legality test used the dated October reference, flagged as 30 days old. SQLite integrity and foreign-key checks passed.
- This request ended after construction and identification of the selected utility lands. The
  [selected-land swap observation](#alesha-selected-land-swap) starts from this verified selection.

The construction request took 10m05s, including 1m11s for the table-strength answer. The export reports 8m46s of model
time and 8.4s of other outer tool time. The two focused provider searches took about 3.3s within that tool time, including
about 2.7s of HTTP time. There were 26 top-level tool calls. Using `o200k_base`, the serialized arguments were 13,359
tokens (52,513 bytes) and exported result text was 81,605 tokens (255,979 bytes). The export separately reports 85,605
input, 17,617 output and 3,572,864 cache-read tokens. The oversized response and repeated reads remain efficiency
findings. There is no matched comparator.

### Alesha selected-land swap

The maintainer asked the agent to evaluate replacing High Market with a sixth Swamp and wait before saving. The agent
explained the gain in black mana and basic Swamp access, and the loss of a sacrifice outlet that supports both death triggers
and graveyard recycling. It counted seven remaining qualified outlets, down from eight, and ran a transient joint
Availability check for the exact proposed change. That trial confirmed all 100 copies under the existing binder policy.
Two focused membership reads used filters unsupported by the `selected` view. The role pool read and transient check
provided enough evidence for the proposal. The candidate revision was unchanged when the maintainer approved the swap.

- **Approval and membership edit passed.** After the maintainer said to save only this change, the agent removed High
  Market and increased Swamp from five copies to six. SQLite comparison with the before snapshot confirmed that all
  other membership rows matched, including Shizo, sections, notes and ordering. The deck stayed at 100 cards and 38
  lands. High Market remained an assessed alternative with zero selected coverage. Collection rows and import state
  matched the baseline. Integrity and foreign-key checks passed.
- **Post-save reasoning review remained incomplete.** The membership note captured the main trade-off and the derived
  selected sacrifice count dropped from eight to seven. The saved coverage assessment still said eight outlets and two
  land outlets. The mana assessment still carried the prior black-source count and access estimate, and the research
  appendix still described High Market as selected. The edit correctly marked reasoning `pending` and all three saved
  checks `outdated`. The agent finished after the edit without revisiting those records or refreshing saved checks. The
  transient Availability result applies to the proposal. The saved check records still refer to the previous selection.

The approval limited the edit to one swap and did not explicitly address saving the associated reasoning and checks. That
wording may have encouraged the narrow stop. Record the authorization and the incomplete end state together. A focused
continuation can explicitly authorize reconciliation and refreshed checks while preserving the selected membership.
Any successful continuation is evidence of prompted recovery.

The proposal took 44s and the save turn took 38s, with about 4m04s between proposal and approval. The export reports
81s of model time and 1.1s of outer tool time across six top-level tool calls. Serialized arguments were 656 tokens
(1,781 bytes) and exported result text was 6,490 tokens (19,473 bytes) using `o200k_base`. Separate counters reported
7,851 input, 1,889 output and 1,524,480 cache-read tokens. The swap used local tools.

### Alesha post-swap review

The maintainer explicitly authorized updating the saved reasoning and refreshing checks while keeping every selected
card and quantity fixed. The agent completed that review in 5m11s. It recovered from a code-mode store size error by
retaining only relevant records from the paginated views.

- **Reconciliation completed with prompting.** The agent updated the role assessments, mana analysis and Plan to
  reflect seven qualified sacrifice outlets, one remaining land outlet and 23 potential black sources, up from 22.
  The saved reasoning traces the loss of redundancy for death-trigger draw and drain, creature recycling and clearing
  the Ophiomancer Snake. It retained High Market as an unselected alternative. Independent calculation confirmed the
  revised access estimates use the stated sample assumptions. The chance of seeing at least two white- or black-capable
  lands in 11 draws rose from 91.63% to 92.68%, while the chance of seeing at least one qualified outlet fell from
  62.46% to 57.36%. These are card-access estimates.
- **Final saved state verified.** The selection revision stayed fixed throughout the review. The only membership delta
  against the pre-swap snapshot is the approved replacement of High Market with the sixth Swamp, including its note.
  The candidate has 100 copies, 38 lands and Shizo. Reasoning is `reviewed`. Legality, evaluation and joint Availability
  were rerun and apply to the current selected and Brief revisions. Legality passed against the dated reference and all
  100 copies were allocated from Acceptance Binder. Collection and import state match the baseline. SQLite integrity
  and foreign-key checks passed.

This completes the Alesha observation. The first save left reasoning pending and checks outdated. The final outcome
shows successful prompted recovery. Casual 60 and the direct questions remain separate observations.

## Validation disposition

The maintainer ended further live testing for the current merge preparation on 15 November 2026. The Casual 60
construction smoke and the standalone Collection and probability questions remain unrun in live Pi. Their prompts stay
in Session 3 for a later manual pass. Scripted Casual 60 and calculator coverage supplies deterministic evidence only.

| Observation | Result |
| --- | --- |
| Fresh Commander construction on a new anchor | Tatyova completed with applicable saved checks and positive initial maintainer feedback. |
| Resumption after compaction | Tatyova recovered twice in the same session with replay of some completed work. |
| Explanation and pool-only research | Completed with the approved selection and checks preserved. Local binder research covered the pool request after a provider ownership conflict. |
| Focused Alesha regression | Action analysis, approved Research, live focused searches and provisional construction observed. Selected utility-land reasoning and checks were completed after a follow-up prompt. |
| Casual 60 and direct questions | Deferred from this live pass. |

At implementation revision `717dd27`, `bun test` passed 484 tests across 67 files, `bun run typecheck` passed, and
`bun run evaluate:workflows` passed. The suite exercised populated candidate migration fixtures, preservation of
existing Plan records, pending review for earlier candidates, and the Pi and shared tool boundaries. The manual results
record the separate behavioral coverage. The maintainer's decision on accepted scope and PR readiness belongs in
[#134](https://github.com/OSmall/tomekin/issues/134) and [PR #136](https://github.com/OSmall/tomekin/pull/136).
