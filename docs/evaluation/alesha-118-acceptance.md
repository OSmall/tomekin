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
can exercise transport but cannot establish a completed-deck result. **The positive fixture is not yet prepared.**
Before a live run, create a new isolated database with current public Oracle and Printing records and a synthetic
ManaBox Collection. Record exact source files and SHA-256 hashes, source/import times, import IDs, policy, row/copy and
identity counts, the code revision and the fixture manifest. Include public tag definitions and associations where
available; otherwise record their absence and assess honest recovery rather than treating unavailable tags as empty.

The reviewed Collection must provide, at minimum, the chosen anchors and enough distinct legal identities and basics to
make a plausible 100-card Commander deck and a separate legal 60-card Mainboard, with meaningful alternatives across
mana, card advantage, interaction and each strategy. Include a utility land with a non-mana function relevant to the
Commander candidate and some policy-excluded or insufficient copies. Availability is established from actual selected
quantities under the agreed policy, not from this inventory design. Verify the imported identities, printings and
quantities through Tomekin before the session. Preserve a closed baseline copy and a separate working copy; do not edit
or replace imports during the session. A larger public-data import or sync and the synthetic CSV must be reviewed and
prepared before this workload can produce positive completed-deck evidence.

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
