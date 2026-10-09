# Commander source-report audit

**Read first:** [consolidated Commander deck-building research](2026-10-10-commander-deck-building-research.md).
This file preserves the audit history. The opening review concerns the earlier report; the final **Correction review and
extraction handoff** section assesses the later correction and replacement report.

Reviewed **2026-10-10**. Input: [current revised source report](2026-10-10-commander-deck-building-source-report.md).
This is research input
for [Extract Commander deck-building guidance from the source report](https://github.com/OSmall/tomekin/issues/74), not
an adopted methodology or Deck Plan design.

**Result:** the report supplies useful topics, but its hard rules and purportedly exhaustive coverage are not ready to
become agent instructions. Primary metadata/chapter evidence establishes several topics and one coverage contradiction;
it does not validate the transcript-dependent claims below. Original report and staged content were preserved.

## Access and evidence boundaries

All four public YouTube watch pages were retrieved directly. Their player metadata supplied creator, publication
timestamp, duration, description, and advertised English auto-caption tracks. Each English caption URL was requested
once; all returned HTTP 200 with **zero content**. No substantive transcript, audio, or visual content was obtained in
this audit. Web-page extraction initially returned shells/errors. Available captions in metadata are not evidence of
successful transcript access.

| Source                                                                                                 | Independently checked metadata / chapters                                                                                                                       | Substantive evidence available                                                                                                                                                                                                    |
|--------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [V1: Commander Deckbuilding Template for the New Era](https://www.youtube.com/watch?v=OSNV6224cHg)     | The Command Zone; 2025-02-18, publisher timezone; about 1:46:35. Role chapters, plan cards, curve, and complications.                                           | Description/chapter headings only. Creator's [Patreon outline](https://www.patreon.com/commandzone/posts/commander-for-122512504) exists but is locked; its contents were not accessed.                                           |
| [V2: The Problem with Deckbuilding Templates](https://www.youtube.com/watch?v=PUrQpnQ7bi8)             | The Command Zone; 2025-02-26, publisher timezone; about 1:46:38. Separate exceptions chapters for every support category.                                       | Description explicitly presents templates as simplified starting points and endorses departures. Headings do not establish exact examples or numbers.                                                                             |
| [V3: Make Any Deck Busted (by fixing its shape)](https://www.youtube.com/watch?v=xZvaBPrF56E)          | Commander Challenge; 2026-09-17 19:09:12 UTC−07, which is September 18 in Sydney; 37:39. Description identifies Wilson/Guild Artisan and functional categories. | Existing transcript-derived source notes, accessed through `git show research/deck-shape-source:docs/research/2026-09-24-commander-challenge-deck-shape.md`. Those notes are prior research, not a fresh transcript verification. |
| [V4: Stop Falling for these Commander Deckbuilding Traps](https://www.youtube.com/watch?v=K5UGydfRKBw) | The Command Zone; 2026-10-08, publisher timezone; 1:29:13. Detailed chapter list is public.                                                                     | Description/chapter headings only. This fourth source was added beyond the original three-video request; keep its provenance explicit.                                                                                            |

Dates should state their timezone convention rather than treating the V3 calendar difference as an error. The report's
assertion that its author accessed transcripts is retained as an author assertion; it was not independently reproduced.

## Concrete findings

**Verified** below means verified against the described primary evidence. **Unsupported** means evidence available here
cannot establish the claim; it does not prove the claim false. Comparisons to prior V3 notes are labelled separately.

| Current report claim                                                                                                                                                          | Finding and required qualification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Section 4: 38 lands / 12 card advantage / 10 ramp / 12 targeted / 6 mass / approximately 30 plan cards                                                                        | **Not independently primary-verified here.** Treat as a attributed provisional baseline pending transcript excerpts. The original source's category chapters are [9:51](https://www.youtube.com/watch?v=OSNV6224cHg&t=591s), [21:18](https://www.youtube.com/watch?v=OSNV6224cHg&t=1278s), [36:30](https://www.youtube.com/watch?v=OSNV6224cHg&t=2190s), [45:54](https://www.youtube.com/watch?v=OSNV6224cHg&t=2754s), [53:20](https://www.youtube.com/watch?v=OSNV6224cHg&t=3200s), and [1:04:49](https://www.youtube.com/watch?v=OSNV6224cHg&t=3889s). Exact counting conventions, ritual exclusions, land-cyclers, and adaptation thresholds require substantive evidence. |
| Section 2: land count “non-negotiable”; checklist requires baseline met                                                                                                       | **Overstated:** V2's verified description expressly allows breaking template rules, with a [lands-exceptions chapter](https://www.youtube.com/watch?v=PUrQpnQ7bi8&t=4252s). Source-attributed defaults should not become universally mandatory targets.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Section 4 mass-disruption row: “No specific exceptions noted in sources”                                                                                                      | **Coverage contradicted:** V2 has [Exceptions for Mass Disruption, 1:05:17](https://www.youtube.com/watch?v=PUrQpnQ7bi8&t=3917s). Exact exceptions remain unverified; request that section's substance rather than infer it.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Sections 4/6: 14–15 ramp, 40 lands, Sidisi example, 53% → over 60% “by the first mulligan”                                                                                    | **Unsupported source attribution and underspecified probability.** V2's [math chapter, 1:24:19](https://www.youtube.com/watch?v=PUrQpnQ7bi8&t=5059s), is verified, not these figures or Sidisi details. The independent calculation below shows why event/hand assumptions matter.                                                                                                                                                                                                                                                                                                                                                                                            |
| Sections 2/3: significantly more generators than amplifiers; “drastically” reduce generators if commander supplies them; amplifier commander means almost entirely generators | **Unsupported as universal rules; inconsistent with the prior V3 notes' qualification.** Those notes describe plan-dependent heuristics, multiple commander functions, and playtesting at [14:31–17:05](https://www.youtube.com/watch?v=xZvaBPrF56E&t=871s), not fixed ratios. Do not report this as a freshly verified contradiction of the transcript.                                                                                                                                                                                                                                                                                                                      |
| Section 9: V3 explicitly rejects generic staples; distinct philosophical conflict with V1/V2                                                                                  | **Unsupported blanket claim.** Prior V3 notes support evaluating synergistic support at [22:18](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1338s) and [26:49](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1609s), not a universal ban. An efficiency/synergy trade-off is not established source disagreement.                                                                                                                                                                                                                                                                                                                                                           |
| Sections 2/3/10: all functional plans have 1–2 steps and must have one direction                                                                                              | **Unsupported universal rule.** V4 has both [Game Plan is Too Complex, 12:29](https://www.youtube.com/watch?v=K5UGydfRKBw&t=749s) and [Hyper-Focused Game Plan, 27:15](https://www.youtube.com/watch?v=K5UGydfRKBw&t=1635s). The latter must be investigated before making focus an absolute. Prior V3 notes describe an activity, capitalization, and win/advantage with layered payoffs at [2:26](https://www.youtube.com/watch?v=xZvaBPrF56E&t=146s) and [17:39](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1059s).                                                                                                                                                     |
| Sections 6/7: Eloise commits 100% to sacrifice; never cut support for payoff; swaps must remain in identical categories                                                       | **Unsupported example and excessive synthesis.** V4 verifies topics of [whole-deck editing, 38:32](https://www.youtube.com/watch?v=K5UGydfRKBw&t=2312s) and [cutting enablers for payoffs/enhancers, 42:04](https://www.youtube.com/watch?v=K5UGydfRKBw&t=2524s), not blanket prohibitions or that example's details. Review resulting coverage, dependencies, timing, and user goals rather than require same-category swaps.                                                                                                                                                                                                                                                |
| Sections 5/7/10: six-mana removal never counts; mandatory 1–3-mana cluster; specific hand symptoms dictate one correction                                                     | **Unverified prescriptive synthesis.** Timing/efficiency and goldfish diagnosis are useful questions. Expensive cards, alternative casting routes, modal choices, commander dependence, and resources can change the answer. Do not turn one symptom into an unconditional diagnosis.                                                                                                                                                                                                                                                                                                                                                                                         |
| Section 8: every card must map to template pillars; cutting a modal land/removal creates two deficits                                                                         | **Product/design assertions, not source findings.** A card may be strategic rather than a support pillar; modal uses compete rather than both occur simultaneously. A cut removes two potential functions but whether either is a deficit depends on desired/observed coverage.                                                                                                                                                                                                                                                                                                                                                                                               |

### Probability check: plausible numbers, different events

Independent combinatorial check, **not validation of V2's example**: assume a 99-card library, disjoint land and ramp
categories, and no colour, tapped-land, timing, or casting restrictions. For a sample of `n` cards, the joint event is
at least three lands and at least one ramp card:

`P = sum(C(L,l) × C(R,r) × C(99−L−R,n−l−r)) / C(99,n)` over `l ≥ 3, r ≥ 1`.

| Assumed draw event                                                                  | 38 lands / 10 ramp | 40 lands / 15 ramp |
|-------------------------------------------------------------------------------------|-------------------:|-------------------:|
| One seven-card hand                                                                 |             24.99% |             36.79% |
| At least one success in two independent seven-card hands, modelling one free redraw |             43.73% |             60.05% |
| First ten cards, no mulligan policy                                                 |             52.96% |             68.63% |

Thus approximately **53% and 60% can be reproduced using different events**. This does not establish the reported
before/after comparison. To retain it, request the actual source excerpt, population, sample size, success predicate,
turn/draw assumptions, ramp costs, and mulligan/keep policy. Merely drawing the needed counts does not prove legal
turn-three casting; ordering and available colours matter.

## Coverage and extraction gaps

The current coverage matrix maps **report sections to source labels**, not actual source chapters to extracted lessons.
It cannot establish that every substantive lesson was captured. V4's published chapters also include redundant effects
(1:01), hyper-focus (27:15), covering every base (35:29), playgroup fit (1:10:30), defanging decks (1:15:17), and too
many decks (1:17:32); several receive no distinct treatment. V2 mass-disruption exceptions are explicitly missed. Card
examples and tag identifiers require separate authoritative verification; no exact Scryfall tag examples were validated
here.

The glossary also mixes extracted source vocabulary with Tomekin mappings under one “Source Guidance” heading. Mark
mappings, claimed equivalences, and proposed names such as “Keystone Objective” as interpretation unless their exact
source usage is demonstrated.

## Qualified process outline

This is **an audit synthesis for later evaluation**, not an agreed operational skill:

1. Capture format, user goals, play environment, restrictions, collection availability, and preferred experiences in the
   Brief.
2. Describe the candidate's repeatable activity, how it creates advantage, and its routes to winning. Record
   dependencies and recovery paths without imposing a universal step limit.
3. Identify what a reliably available format anchor contributes and what happens when access is disrupted.
   Commander-specific assumptions must remain format-specific.
4. Define the candidate's roles and packages/groups: their purpose, relevant activities/resources, and the support each
   needs. Set desired coverage with explicitly sourced defaults and contextual deviations.
5. Retrieve and inspect candidates, using tags as discovery evidence and verified card text for functional claims.
   Assess timing, resource demands, standalone usefulness, and overlap/modal competition.
6. Compare selected cards and packages with desired coverage; distinguish estimated capability from observed results.
   Tomekin performs static checks, while the human can test draws/sequences and multiplayer resilience and report
   observations. Record who produced each form of evidence and its assumptions; do not imply an agent simulation
   capability.
7. Tune the whole candidate against the Brief and observations. Explain effects on roles, dependencies, coverage, and
   alternative winning routes; revise targets when justified.

Prior V3 notes support objective-based selection, functional balance, contextual support, and limited goldfish evidence.
V2's description supports adaptable templates. The fuller process above is an explicit integration hypothesis, not proof
that all sources prescribe these steps.

## Format-neutral Deck Plan information needs

For subsequent design discussion, retain enough context to reason about:

- Candidate-specific strategic intent, activities/resources, winning routes, and dependencies/recovery.
- Role and package/group definitions and their purposes within this deck; useful overlapping card assignments with
  rationale, without assuming exhaustive classification is required.
- Desired coverage versus estimated and observed coverage; counting rules, timing, costs, conditions, alternative
  casting routes, and modal or resource competition.
- Anchor contributions, availability/reliability assumptions, gaps, and resilience requirements.
- Contextual targets, deviations, reasons, source provenance/confidence, and links back to user requirements.
- Evaluation evidence and its limits, unresolved uncertainties, and which parts a change affects.

These are information needs to evaluate against examples. This audit selects no Markdown/table/graph representation,
persistence contract, authority model, or user decision.

## Correction review and extraction handoff

**Follow-up reviewed 2026-10-10:** [Commander report correction](2026-10-10-commander-report-correction.md), including
its correction table and full replacement report. The earlier findings above describe the earlier report; the following
records what the correction repairs and what remains. No captions were fetched again. The correction author's
transcript-access statements and “Supported” labels remain **author assertions**, not fresh independent verification.
Primary metadata/chapter evidence and the prior V3 notes retain the boundaries described above.

**Enough for information-needs extraction; insufficient for adopting disputed rules.** The combined material identifies
strategic intent, contextual card contributions, dependencies, support coverage, overlap, deviations, and revision
evidence. Those needs do not depend on the exact template numbers, a forced generator/enhancer/payoff taxonomy, a
universal plan length, or particular database/graph choices. Numerical defaults and source-specific counting conventions
can remain evidence questions for the methodology discussion rather than block identifying what a plan must explain.

### Repaired versus remaining claims

| Topic                                                      | Correction assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Whole-deck tuning and modal overlap                        | **Meaningfully repaired.** Same-category swaps are described as a guardrail with exceptions, and modal uses explicitly compete rather than contribute simultaneously. Whether a removed function becomes a deficit still depends on contextual coverage.                                                                                                                                                                                                                                                                                                                                                |
| Mass-disruption exceptions                                 | **Coverage omission repaired at the author's assertion level.** A specific treatment now exists and matches the known chapter topic. Exact colour/archetype exceptions remain unverified here.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Synergy versus generic support                             | **Blanket source-conflict framing removed.** Dependency fragility and fallback support are useful evaluation needs. The new assertion that generic interaction is always required should remain a contextual proposal; the available primary chapter evidence does not establish that absolute.                                                                                                                                                                                                                                                                                                         |
| Card-name uncertainty                                      | **Preserved appropriately**, but descriptive mechanical intent remains unverified when the underlying example cannot be independently checked. Do not turn caption guesses into retrieval identifiers or verified Oracle facts.                                                                                                                                                                                                                                                                                                                                                                         |
| Probability and guaranteed turn-three casting              | **Not repaired.** The correction table says “exactly 3 lands AND 1” with 53%/68%, whereas the worked example still says 53% to over 60% “by the first mulligan”; the ramp rule says “guaranteed.” These are inconsistent predicates and assumptions. Under the earlier explicitly hypothetical 99-card/disjoint-category/ten-card calculation, **at least** three lands and one ramp gives 52.96%/68.63%; **exactly** three lands and exactly one ramp instead gives 9.75%/6.72%. This numerical check demonstrates ambiguity, not what the video actually calculated. None proves a casting guarantee. |
| Plan complexity, commander compensation, curve, redundancy | **Still overgeneralized.** Mandatory 1–2 steps, failure of every 3+ step plan, drastic category reductions, compulsory low curve, and a 5–7-copy ceiling for non-stacking effects remain unsupported universal instructions. A redundancy chapter establishes a topic, not that threshold; the earlier V3 notes qualify shape changes as heuristics.                                                                                                                                                                                                                                                    |
| Goldfishing                                                | **New unresolved precision:** a claimed mandate to goldfish 50–100 times lacks independently accessible support. Retain the need for human observations and explicit static-review limitations without importing that sample-size requirement.                                                                                                                                                                                                                                                                                                                                                          |
| Fixed targets and exhaustive assignment                    | **Still product/methodology proposals.** “Strict” defaults, land exceptions framed as “only,” mandatory baseline checks, and every card mapped to a fixed pillar set should not silently become Deck Plan requirements.                                                                                                                                                                                                                                                                                                                                                                                 |
| Completeness                                               | **Still not established.** The matrix continues to map report sections to videos; it does not inventory actual video chapters, substantive lessons, exceptions, and omissions. A source excerpt or chapter-level extraction would strengthen particular claims without another broad rewrite.                                                                                                                                                                                                                                                                                                           |

### Representative scenarios for the next decision

These are **illustrative information tests**, not prescribed mechanics or new product contracts:

| Scenario                                | Information the plan discussion needs to account for                                                                                                                                                                                                                        |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Multi-role or modal card                | A card can contribute to strategic activity and draw; a modal land/removal card offers competing options. Distinguish contextual functions, costs/timing, simultaneous versus alternative uses, and coverage confidence.                                                    |
| Swap across different roles             | Replacing a support card with an engine piece may change several dependencies and coverage estimates. Explain the intended benefit, removed contributions, compensating cards/anchor functions, and comparison with desired coverage, rather than reject by category alone. |
| Commander or other format-anchor change | A new anchor can change the repeatable activity, access assumptions, support demands, and which packages remain useful. Identify affected rationale and expectations instead of mechanically transferring old role counts.                                                  |
| Changed source evidence                 | A corrected tag, card-text interpretation, or methodology claim can invalidate an explanation or estimate. Keep enough provenance and uncertainty to locate affected reasoning and re-evaluate it; the authority and update policy remain undecided.                        |

**Handoff:** information-needs extraction can proceed with the explicit qualifications above. Residual evidence needs
are the precise numeric/counting and probability claims, universal complexity/curve/redundancy claims, exact named
examples, and complete source coverage. Resolving the extraction ticket, choosing a representation, and adopting
methodology are separate decisions for the driving session.
