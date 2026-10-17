# Commander deck-building research — read first

Consolidated **2026-10-10** from the supplied Gemini report, its replacement, and the evidence audit.
Adoption and interpretation notes updated **2026-10-18** following the methodology decision.
This is the single entry point for this research packet. Read it before the supporting files; those files preserve
provenance and review history rather than provide competing current instructions.

**Status:** qualified research input. Selected guidance and a contextual Commander starting template have been adopted
in [Define a shared deck-shape methodology foundation](https://github.com/OSmall/tomekin/issues/75#issuecomment-6234696206).
That decision does not endorse every report claim or independently verify its source attributions. This research packet
is not itself the operational skill or persistence contract. The canonical extraction resolution is
[Extract Commander deck-building guidance from the source report](https://github.com/OSmall/tomekin/issues/74#issuecomment-6083834396).
GitHub Issues holds decisions and remaining work. This document holds the consolidated research and its limitations.

## Reading order and authority

1. Read this document for the current qualified synthesis and evidence limits.
2. Read the linked extraction and final methodology resolutions for their adopted scope. The methodology resolution
   governs interpretation where the reports conflict with it; operational instructions belong in the canonical
   deck-building skills, beginning with [the shared method](../../skills/deck-shape-methodology/SKILL.md) and
   [Commander profile/example](../../skills/commander-deck-architecture/SKILL.md). These implement reasoning fidelity;
   [#64](https://github.com/OSmall/tomekin/issues/64) retains executable workflow integration.
3. Consult the supporting records below only when checking a particular attribution, example, or correction.

The latest Gemini submission is the **correction file**, which contains both a correction table and a full replacement
report. It supersedes the earlier Gemini report as the author's account. It does **not** supersede the audit's evidence
qualifications. The audit's final **Correction review and extraction handoff** section is its current assessment; the
earlier sections describe the earlier report.

“Supported” in the Gemini correction means the report author claims source support. It does not mean the claim was
independently verified by Tomekin's audit. “Unverified” here means the available evidence cannot establish a claim;
it does not establish that the claim is false.

## Adopted interpretation and report corrections

The final methodology resolution owns the full decision and acceptance criteria. These notes prevent the preserved
reports' stronger wording from being mistaken for adopted instructions:

- **Start from the template and justify departures.** The user adopted the report-attributed Commander targets as a
  meaningful starting profile. A sufficient deck-specific reason can justify a departure; retain that reason for later
  tuning. Read the report's checklist as **baseline met or a justified departure recorded**, rather than a requirement
  to restore every generic target. The report already contains category-specific exceptions.
- **Preserve intended functions when tuning.** Prefer same-role swaps when maintaining shape, but sharing a role label
  is not automatic approval. Review every material contribution lost or gained. Cross-role changes need an intentional,
  explained redistribution of coverage. The correction already includes this guardrail and its exceptions.
- **Keep counts separate from effectiveness.** Overlapping roles and modal options do not establish simultaneous
  performance. The report's MDFC/one-mana-landcycler convention concerns functional mana access; it does not change card
  types or deterministic land/construction facts. Explain meaningful costs, conditions and competing uses.
- **Use contextual guidance rather than unsupported absolutes.** Short plans, curve, redundancy and commander
  compensation inform review. Do not import universal one-to-two-step limits, compulsory low curves, drastic role-ratio
  changes, a fixed five-to-seven-copy ceiling, or a mandatory 50–100 goldfish sample into operational instructions.
- **Distinguish probability from execution.** The report does mention hypergeometric calculators. Its inconsistent
  Sidisi figures and guaranteed-turn-three wording are excluded from operational evidence unless repaired with explicit
  assumptions. A separately calculated sampling probability can support a contextual target without establishing
  castability, strategic execution or win rate. The adopted single generic calculator's API is owned by
  [Define the generic hypergeometric calculator contract](https://github.com/OSmall/tomekin/issues/83).

No broad report regeneration is required for this adopted scope. The numerical/source qualifications below remain;
there is no new transcript verification or certification of exhaustive podcast coverage. Keep the original submissions
and audit intact as provenance, and derive operational instructions using these qualifications and the owning decision.

## Sources and access

| Source                                                                                                                    | Role in the supplied report                                                                                                                                   | Independently available evidence                                                                                                                                                                   |
|---------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Commander Deckbuilding Template for the New Era — The Command Zone 658](https://www.youtube.com/watch?v=OSNV6224cHg)     | Primary: support categories, a numerical starting template, and card-role overlap. Published 2025-02-18 in the publisher's timezone.                          | Watch-page metadata, description, and chapter headings. Exact prescriptions were not independently checked against a transcript.                                                                   |
| [The Problem with Deckbuilding Templates — The Command Zone 659](https://www.youtube.com/watch?v=PUrQpnQ7bi8)             | Primary: contextual exceptions and template adaptation. Published 2025-02-26 in the publisher's timezone.                                                     | Metadata and chapters; the description explicitly permits departures from simplified templates. The mass-disruption exceptions chapter is confirmed, but its exact advice remains unverified here. |
| [Make Any Deck Busted (by fixing its shape) — Commander Challenge](https://www.youtube.com/watch?v=xZvaBPrF56E)           | Supporting: strategic activity, functional shape, commander contributions, and synergistic support. Published 2026-09-17 in UTC−07, September 18 in Sydney.   | Metadata and previously published transcript-derived research notes, linked below. Those notes are prior research, not a fresh transcript verification.                                            |
| [Stop Falling for these Commander Deckbuilding Traps — The Command Zone 767](https://www.youtube.com/watch?v=K5UGydfRKBw) | Additional source introduced in the report: complexity, excessive focus, whole-deck tuning, and redundancy. Published 2026-10-08 in the publisher's timezone. | Metadata, description, and chapter headings. This source was additional to the user's original three-video request.                                                                                |

The supplied reports say their author accessed automated transcripts and metadata, but not visual demonstrations.
The independent audit obtained all four watch pages and attempted their English captions once each. Those caption
requests returned HTTP 200 with empty content, so the audit did not independently obtain substantive transcripts,
audio, or visuals. Chapter titles establish topics, not all the claimed advice within them.

## Qualified synthesis

The following integrates the supplied reports with the audit as research synthesis. Read it with the adopted
interpretation above; it is not a claim that every source prescribes this exact process.

### Start with intent and a coherent activity

Establish the user's Brief: format, restrictions, collection and acquisition expectations, budget, desired experience,
and power expectations. Describe what the deck repeatedly does, how it benefits from that activity, and how those
benefits lead toward winning or overwhelming advantage. Explain how the commander or other format anchor contributes.

The prior Commander Challenge notes support an activity → capitalization → win/advantage framing, including layered
payoffs. Focus and complexity are useful questions to assess. The supplied report's universal one-to-two-step limit
and rejection of every longer plan are not established requirements.

### Explain card contributions in this deck

Useful working concepts include generators/enablers, amplifiers/enhancers, payoffs, and support that provides mana,
card advantage, interaction, or protection. Their purpose is to explain a deck's needs, not impose a fixed taxonomy.
A package groups cards serving a shared purpose; an individual card can serve multiple purposes or packages.

Keep Deck Roles distinct from Card Identity Tags. A tag can help retrieve and understand a card, but contextual
contribution depends on its actual effects, cost, timing, conditions, repeatability, and the surrounding deck.
Source terminology and any proposed mapping into Tomekin terminology require evaluation rather than automatic adoption.

Overlapping roles do not establish simultaneous contributions. A modal land/removal card offers competing uses.
Other cards may provide several effects together, or require spending a resource another part of the plan needs.
Record those distinctions when assessing coverage. This does not require assigning every card to a fixed list of roles.

### Balance support, dependencies, and reliability

A numerical template can supply a starting hypothesis, with explicit counting conventions and contextual reasons
to depart from it. Support needs depend on the strategy, curve, available resources, anchor contributions, and
expected opposition. The independently retrieved Command Zone description supports adapting templates.

Assess both enabling activity and rewards for it. A commander providing an effect can change what the rest of the
deck needs, but its access and resilience matter. The prior Commander Challenge notes describe contextual compensation,
not universally fixed ratios or drastic cuts.

Synergistic support may advance several needs at once. It can also share a dependency or vulnerability with the
main engine. Examine fallback options and recovery rather than universally banning generic cards or universally
requiring them. Having a causal relationship or a cycle does not by itself prove that a deck can execute it reliably.
These sources do not establish an objective synergy score or an executable card-effect analysis model.

### Retrieve, assess, and tune the whole candidate

Use card facts and validated tag evidence to retrieve candidates, then assess their contextual functions against
the Brief. Compare desired coverage with assessed coverage; expose assumptions and intentional departures instead
of treating raw group counts as proof of performance.

Evaluate a card swap across the whole deck. Replacing within the same category can be a useful guardrail against
gradually losing support, but the correction acknowledges it as a heuristic with exceptions. A cross-role swap can
be justified when other cards, packages, or anchor functions compensate for the changed contributions.

Distinguish static review from human observations. Tomekin's current scope does not supply game or hand simulation.
Human goldfishing and multiplayer experience can inform revisions, with their conditions and limitations recorded.
Neither a static review nor a small set of solo trials proves resilience against opponents.

## Information needs for a revisable Deck Plan

These are the research information needs that informed the representation decision, not a persistence contract.
The adopted representation and its later refinements live in the
[final Deck Plan graph decision](https://github.com/OSmall/tomekin/issues/62#issuecomment-6193312738) and
[final targeted-edit decision](https://github.com/OSmall/tomekin/issues/73#issuecomment-6230849972).

| Information                                                                         | Why it matters across revisions                                                                    |
|-------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Strategic intent, repeatable activities, resources, and winning routes              | Preserves why the selected cards belong together and which alternatives remain coherent.           |
| Deck-specific roles and packages, useful overlapping assignments, and rationale     | Explains contextual contributions beyond a card list or generic tag.                               |
| Conditions, costs, timing, repeatability, anchor dependence, and competing uses     | Distinguishes theoretical effects from accessible, reliable support.                               |
| Desired, assessed, and observed coverage; counting conventions and target rationale | Makes gaps and deliberate template departures understandable without implying objective certainty. |
| User restrictions, source provenance, assumptions, and unresolved uncertainties     | Allows later evidence or changed requirements to be connected to the reasoning they affect.        |

Representative information tests are a multi-role/modal card, a cross-role swap, a commander/anchor change, and
corrected tag, card, or methodology evidence. Each tests whether the retained context can explain affected functions,
dependencies, expectations, and rationale. The representation alternatives explored during extraction are historical;
consume the final decisions rather than reopening that choice from this research synthesis.

## Claims that remain qualified

The correction repaired several problems: it discusses mass-disruption exceptions, acknowledges competing modal
uses, softens same-category swaps into a heuristic, separates static review from human testing, and replaces a
blanket source conflict with a synergy/fragility trade-off. Its exact source claims still have the following limits.

| Claim family                                                                                                                                | Current qualification                                                                                                                                                                                                                                                            |
|---------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 38 lands, 12 card advantage, 10 ramp, 12 targeted disruption, 6 mass disruption, and approximately 30 plan cards                            | Adopted as a user-selected, report-attributed Commander starting profile, with justified departures. Transcript attribution, counting conventions and sufficiency remain unverified by this audit; adoption does not make them universal or deterministic Tomekin checks.        |
| Sidisi example: 53%/68%, “exactly” three lands and one ramp, “by the first mulligan,” and guaranteed turn-three casting                     | The correction table and replacement prose still use inconsistent events and assumptions. The audit's hypothetical calculation illustrates that “exactly” and “at least” yield different answers; it does not reproduce the source calculation or establish a casting guarantee. |
| Universal one-to-two-step plans, drastically reduced commander-provided categories, compulsory low curves, and a five-to-seven-copy ceiling | These remain overgeneralized or unsupported as universal instructions. Chapter topics and contextual heuristics do not establish these hard requirements.                                                                                                                        |
| Mandatory 50–100 goldfish trials                                                                                                            | The exact mandate was not independently established. Retain the distinction between human observations and static review without importing that sample-size requirement.                                                                                                         |
| Named worked examples and caption-derived card identities                                                                                   | Exact interpretations remain qualified. Garbled names must not become retrieval identifiers or verified card facts.                                                                                                                                                              |
| Real Scryfall tags and comprehensive source coverage                                                                                        | This packet does not validate a tag catalogue or establish an exhaustive inventory of every substantive lesson and exception. A section-to-video matrix is not proof of completeness.                                                                                            |

Before any disputed prescription becomes operational methodology, its source evidence must be checked, its actual
scope qualified, or the claim excluded. The final methodology resolution applies those options to the adopted scope;
it does not resolve the remaining source-evidence limitations. This packet does not require another broad Gemini rewrite
or adopt the report's checklist verbatim as an agent skill.

## Supporting records and provenance

| Record                                                                                                                                                              | How to use it                                                                                                                                                            |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [Initial generation prompt](2026-10-08-commander-source-report-prompt.md)                                                                                           | Historical record of the requested extraction, source priorities, and intended agent use.                                                                                |
| [Earlier Gemini report](2026-10-10-commander-deck-building-source-report.md)                                                                                        | Preserved source submission. Superseded by the correction's replacement report as the author's account.                                                                  |
| [Revision prompt](2026-10-10-commander-source-report-revision-prompt.md)                                                                                            | Historical record of requested repairs; not a current task list or adoption decision.                                                                                    |
| [Gemini correction and replacement report](2026-10-10-commander-report-correction.md)                                                                               | Latest supplied author account, including its correction table. Read with the qualifications above.                                                                      |
| [Evidence audit and correction review](2026-10-10-commander-source-report-audit.md)                                                                                 | Detailed evidence boundaries, claim comparisons, illustrative probability assumptions, and review history. Its final correction-review section is the latest assessment. |
| [Published Commander Challenge notes](https://github.com/OSmall/tomekin/blob/research/deck-shape-source/docs/research/2026-09-24-commander-challenge-deck-shape.md) | Prior transcript-derived supporting research on a separate research branch; not a newly verified transcript.                                                             |

Preserve the supplied reports as records rather than silently editing their assertions into adopted guidance.
Keep this entry point consistent with any later research qualification; record design decisions in the relevant
GitHub ticket and adopted operational instructions in the canonical skills.
