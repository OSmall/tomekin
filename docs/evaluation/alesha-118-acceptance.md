# Autonomous deck-building acceptance workload

This is the proposed compact manual workload for [#134](https://github.com/OSmall/tomekin/issues/134) and the
completion gate in [#118](https://github.com/OSmall/tomekin/issues/118). It is preparation, not an observation or
acceptance result. Deterministic handler and adapter checks establish delivery contracts, not autonomous strategic
behavior. The separate Pi/OpenCode parity gate in [#26](https://github.com/OSmall/tomekin/issues/26) remains unchanged.

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
from #134. Explicit maintainer outcome acceptance remains required. No run, positive fixture, measurements or outcome
acceptance has yet been recorded by this document.
