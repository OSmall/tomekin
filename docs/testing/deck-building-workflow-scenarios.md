# Deck-Building Workflow Manual Scenarios

## Purpose

Use these frozen scenarios to evaluate Deck Opportunity discovery, fresh construction, and Deck Tuning without
requiring one exact decklist. They are the manual live-model quality gate and do not run under `bun test`.

For every run record date, Tomekin revision, Collection import timestamp, model, reasoning effort, and material Brief
assumptions. Run the initial reference pass with Sol at one fixed reasoning effort. Compare Terra only at that same
effort after Sol passes.

## Critical Invariants

Every applicable scenario must satisfy all of these:

- Use only the confirmed Collection Location allow-list for Collection evidence.
- Stop on deterministic illegality rather than overriding it.
- Never claim playtesting, simulation, goldfishing, current prices, or current metagame knowledge.
- Never pad a Deck Opportunity shortlist or force a Deck Candidate through a stated viability blocker.
- Distinguish Power Level from pilot complexity.
- Distinguish selection or looting from net card advantage.
- Support curve and mana conclusions with explicit evidence.
- Challenge weak cards instead of retaining them merely because they match the theme.
- Recheck final scoped Collection quantities and owned-row evidence before rendering a Deck Candidate.
- Do not persist a shortlist, proposal, or newly revealed final tuning change set.

Any critical-invariant failure fails the scenario regardless of the subjective deck quality.

## Scenario 1: Open Collection Opportunity Comparison

Ask what can be built from an allowed starter deck plus binders while other Existing Deck locations are excluded. Seed
the allowed Collection with at least two plausible plans and one recognizable but structurally weak theme.

Accept when the agent compares viable functional plans before construction, returns no more than three opportunities,
downgrades or rejects the weak theme with specific blockers, and waits for a choice.

## Scenario 2: Strong But Approachable

Request a strong-casual 60-card deck that demonstrates the strategy's potential for an intermediate player without
excessive bookkeeping or obscure sequencing.

Accept when the agent preserves requested strength, expresses complexity separately in `playExperience`, and chooses
approachable lines or cards without substituting generally weak cards.

## Scenario 3: Suspicious Mana Curve

Provide a candidate pool whose theme has many attractive expensive spells and too few functional early actions.

Accept when the agent describes the intended turn sequence, examines the actual distribution and early actions, then
revises the curve or explicitly justifies a nonstandard curve through reliable ramp or survival. A raw histogram alone
is insufficient.

## Scenario 4: Selection Is Not Card Advantage

Provide strong looting/filtering support but little net card advantage.

Accept when the agent records selection separately, identifies whether discard or graveyard setup converts its cost into
material value, and does not declare card-advantage coverage healthy solely from looting tags or text.

## Scenario 5: Weak Theme Cards

Provide enough on-theme cards to fill a deck, including several low-impact cards with weak timing, dependencies, or
payoffs.

Accept when fresh construction identifies its three weakest nonlands and replaces or specifically justifies them. “On
theme” alone is not a justification.

## Scenario 6: No Viable Opportunity

Restrict the Collection and Missing Card tolerance so no direction has enough enablers, payoffs, mana support,
interaction, or credible win conditions.

Accept when the agent returns blockers and constrained next moves rather than a weak shortlist or full decklist.

## Scenario 7: Existing Deck Rebuild Gate

Present a 60-card Existing Deck whose recognizable identity is undermined by an incoherent plan, poor curve, inadequate
mana, and many weak cards.

Accept when tuning diagnoses the foundation, recommends rebuild around identity or fresh construction, explains what is
and is not preserved, and waits for confirmation before entering architecture.

## Scenario 8: Focused Tuning

Present a structurally healthy 60-card deck plus a small Addition Pool containing clear improvements and tempting
off-plan cards.

Accept when tuning recommends the smallest coherent set, pairs every addition with a cut, rejects off-plan candidates,
and reanalyses the aggregate deck.

## Scenario 9: Collection Scope Consistency

Use a binder and Existing Deck with the same name, allow only the binder plus a differently named deck, and place
stronger tempting cards in the excluded same-name deck.

Accept when every Collection query preserves exact `(locationType, locationName)` pairs, projected evidence excludes the
same-name deck, and the final Collection quantity and owned-row check uses the same scope.

## Scenario 10: Commander Nominated Cards

Present a Commander Deck Candidate and several nominated additions: at least one strong fit, one redundant or off-plan
card, and one plausible card whose cost depends on the Addition Pool.

Accept when the agent recommends none, some, or all on their merits, answers the nominated-card question before offering
alternatives, pairs every accepted addition with a cut, and states material assumptions.

## Scenario 11: Commander Structural Repair

Present a Commander deck with one meaningful structural deficit and no same-role cut that would preserve the repair.
Include multi-role and modal cards whose contributions cannot be represented by raw counts alone.

Accept when the agent identifies the deficit, chooses a justified cross-role cut from a genuine surplus, accounts for
overlapping and conditional roles, and reanalyses the aggregate deck. Repeat with a healthy deck and accept only a
like-for-like improvement that preserves its structure.

## Scenario 12: Commander Identity And Protection

Present a protected theme or pet card, then offer both a same-Color-Identity commander swap and a commander that changes
Color Identity.

Accept when the protected card is preserved, the same-identity swap is evaluated with command-zone trade-offs, and the
Color Identity change is treated as a separate Deck Candidate variant requiring confirmation before construction.

## Scenario 13: Commander Addition Pools And Partial Acceptance

Run the same open-ended tuning request once with a Collection-only Addition Pool and once with all legal cards including
Missing Cards. Partially accept the resulting proposal.

Accept when searches remain inside the stated Addition Pool, Collection evidence uses the confirmed location scope,
every proposed addition has a cut, and partial acceptance triggers deck-size, role, package, curve, and legality
re-analysis. The agent must show the exact resulting change set and persistence target, then wait for separate
confirmation before saving.

## Methodology Foundation Expectations

These human-reviewed scenarios exercise the shared reasoning skill, not deterministic deck-quality scoring. Record
conditions and reviewer evidence using the result procedure below. Their presence is an acceptance rubric, not a claim
that live-model runs have passed. [Foundation #98](https://github.com/OSmall/tomekin/issues/98) supplies reasoning and
routing; [integration #64](https://github.com/OSmall/tomekin/issues/64) retains executable retrieval/edit/calculator
examples and the final discovery, fresh-construction, Existing Deck tuning and saved-candidate tuning workflow passes.
Use supported tools only; test durable resumption/edit/check expectations when their owning capabilities are available.

### Scenario 14: Commander Profile And Resumption

Ask for ordinary Commander construction, then provide a plausible reason for a specific departure from the adopted
38 mana-access / 12 advantage / 10 ramp / 12 targeted / 6 mass / approximately 30 plan-serving starting profile.
Resume the current reasoning in a later session.

Accept when the profile is used meaningfully, the departure explains the resulting plan and accepted compromise, and
its criteria/rationale remain with the focused owner rather than disappearing into conversation history. The later
session consumes that reason instead of restoring generic counts. Counts overlap; MDFCs/landcyclers remain qualified
functional access, distinct from factual land count. Commander effects do not become extra library copies. Neither a
profile match nor a justified strategic gap waives deterministic Format failure.

### Scenario 15: Facts, Modes And Whole Contributions

Offer a tag-matched card that cannot perform the desired function in context, a modal card whose protection and removal
uses compete, and a same-role swap that loses a secondary sacrifice/enabler function.

Accept when relevant facts qualify or reject the tag match, modes retain costs/competition, and every material lost or
gained contribution is reviewed. Healthy-deck swaps preserve intended function; intentional redistribution states the
reason, compensation and resulting trade-off. Partial acceptance triggers review of only the actual resulting changes.
No role sum becomes deck size or simultaneous resource use, and no invented strength weights certify coverage.

### Scenario 16: Active Alternatives And Section Coverage

Cut a selected viable option while retaining it as an assessed alternative. Leave a desired role with no selected
contributors but one pool alternative. In a 60-card Format, include repeated Mainboard copies and a Sideboard option.

Accept when the cut remains available by default, pool-only options supply zero selected coverage, the desired gap is
explained, and repeated copies are counted once per identity/role/section at their selected quantity. Sideboard
coverage remains separate. Explicit removal/reassignment reconciles affected reasoning; an invented role cannot rescue
an otherwise unsuitable option. Format-owned examples stay in the applicable Format skills.

### Scenario 17: Plan Review And Bounded Evidence

Present a complementary multi-stage plan, a high curve with a possible ramp explanation, and a small set of human
observations. Change relevant anchor or card-function evidence; separately remove a supporting tag without changing
facts. Where the calculator is available, ask an at-least access question and then an exactly question.

Accept when the agent connects early actions, dependencies, resources, resilience and winning direction instead of
applying universal step/curve/redundancy ceilings. It preserves observation provenance and focuses reassessment on the
material change; tag disappearance alone does not force cuts or erase rationale. Statistics state qualified effects,
population, sample, event and context-specific reliability target; they establish access within assumptions rather
than mana, execution or win rate. No source Sidisi percentages/turn guarantee, invented caption names or catalogue
slugs enter the reasoning. No agent-run playtesting or mandatory goldfish sample is claimed.

### Scenario 18: Reasoning Ownership And Checking Boundary

Inspect the shared-method route from discovery, Commander and 60-card construction/tuning in both supported harnesses.
For adopted candidate-edit workflows, save authorized incomplete progress, read it, then explicitly check the relevant
inputs before a completed-result claim.

Accept when one shared method supplies common reasoning, discovery remains a concise transient comparison, and Format
assumptions/examples remain with their owners. Focused plan/contribution/goal reasoning remains understandable on
resumption. Available adapters expose only implemented operations. Saves and reads do not implicitly check in the
adopted edit workflow; evidence is reused only while applicable. The agent reviews strategy, Brief and Collection and
uses existing authorization covering the actual result/target, seeking agreement where absent. Existing whole-report
persistence paths remain governed by their supported lifecycle until the integration migration replaces them.

## Recording Results

Record pass/fail per invariant and concise human notes. Do not use an LLM judge, aggregate quality score, exact-card
golden list, or CI threshold. Keep raw traces outside the repository unless they are deliberately sanitized into stable
fixtures.

## Real-session Test Prompts

Run these in fresh OpenCode sessions so prior card choices and large tool results do not anchor the model. Replace the
bracketed values with exact Collection Location names returned by Tomekin.

### Discovery through construction

```text
Using only these Collection Locations: [type/name pairs], show me the best deck opportunities for a [Format] deck.
I want [Power Level or Commander Bracket], while keeping the play experience [complexity and feel].
Do not build a full decklist until I choose a direction. Compare genuine functional plans, reject directions that lack
the required support, and tell me the most important caveat for each viable opportunity.
```

After choosing:

```text
Build the [chosen opportunity] direction under the confirmed Brief. Before presenting the final candidate, explicitly
review the curve, distinguish net card advantage from selection or looting, challenge the three weakest included
nonlands, and recheck final Collection quantities and owned rows against the unchanged Collection Location allow-list.
```

### Existing Deck tuning

```text
Review the Existing Deck at [type/name]. My goal is [goal], my intended Power Level is [strength], and my desired play
experience is [complexity and feel]. The Addition Pool is [allowed Collection Locations and/or Missing Card policy].
Diagnose whether this should be a focused repair, a rebuild around its identity, or fresh construction before proposing
changes. Do not persist anything.
```

### Results review in a new development session

```text
Review the attached OpenCode deck-building session and relevant Tomekin logs against
docs/testing/deck-building-workflow-scenarios.md. Identify which failures come from skill instructions, Card Query or
tool Interfaces, context truncation, missing Collection evidence, or model behaviour. Report evidence and recommend the
smallest next improvement before editing.
```

## Batched known-card recovery

In both harnesses request Sol Ring, Bala Ged Recovery // Bala Ged Sanctuary, an exact known Printing, a duplicate and
a deliberate local miss with explicit `name`/`oracle_text` selection and a small `first`. Confirm complete face text,
ordered outcomes and recovery by repeating the original references with `after`; request additional tags on the next
page. Confirm missing tag data is unavailable, a successful bound import replacement requires restart, and cancellation
reuses only delivered progress. Lookup alone establishes neither Collection permission nor final Availability.

## Recent and undated Collection discovery

Run in both harnesses with a tiny synthetic Collection containing identically named binder/deck locations, known source
dates on both UTC boundaries, an unknown source date and different Printings/Finishes of the same identity. Confirm the
exact binder and date interval in the task timezone. Inspect the effective policy and traverse small `first` pages;
verify the excluded Existing Deck and rows failing any conjunct do not consume result slots.

Ask for exploratory recent-card inspiration, then strict recent physical copies. Exploratory assembly may use other
permitted rows. Strict intent must reject a wider policy until confirmed date restrictions agree. Independently search
unknown dates unless declined, label them possible rather than confirmed recent additions, and report partial coverage.
Permit an Existing Deck explicitly and confirm borrowed rows stay Committed with their source deck visible.

Record a failed import and resume a delivered cursor; the active snapshot remains usable. Successfully replace the
Collection, then verify the old policy and cursor require refreshed exact locations and scope reconfirmation. Observe
`no_collection`, imported-empty, null policy and confirmed empty allow-list as distinct states. Do not treat browse row
quantities as whole-deck joint allocation or physical reservations.

### Tag vocabulary discovery

Search `browse_tags` with `operation: {type: "search", query: "mana ramp"}`, then inspect a returned exact slug
with `operation: {type: "lookup", slugs: ["mana-rock"]}`. Verify complete definitions/aliases with no hierarchy
until requested. Repeat with `hierarchy: {}` and explicit `depth: 2`; distinguish immediate edges from the chosen
exploration boundary. Traverse `operation: {type: "list"}` through `first`/`after` to exhaustion, without injecting
the catalogue into startup context. A missing tag import is a readiness failure; a successful empty search or
known-slug miss is not. Compare selected per-card `tags`: inherited ancestors remain complete even when catalogue
exploration stops at one level. Keep strategic Deck Role judgments contextual. Verified example-slug source
provenance is beside the contract in `docs/card-query.md`. This is a focused tool scenario; final executable workflow
integration remains separate work.
