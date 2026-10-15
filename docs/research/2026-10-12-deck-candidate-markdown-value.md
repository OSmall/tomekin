# Deck Candidate Markdown: value and ownership

Researched **2026-10-12** against repository source, behavior/model documents and canonical deck-building skills.

**Status: research snapshot, with a later decision recorded below.** The investigation preceded the 2026-10-13
reporting-direction agreement; exact fields and migration remain open. This note
does not change implemented persistence, reporting, confirmation or migration behavior. No private database, Collection
or session
records were inspected. The inventory describes what the product can store and what its skills require, not the quality
or completeness of any user's saved reports.

## Current behavior

The saved candidate combines structured data and an opaque report. Its input includes label, nullable Format Anchor,
Format-discriminated Brief, optional Collection import timestamp, nonempty Markdown and nonempty relational card list.
Cards carry Card Identity UUID, quantity, canonical section, order and optional note. The read schema additionally
checks
that candidate Format agrees with its authoritative Brief. Markdown validation checks only that it is a nonempty string;
it does not validate headings, factual accuracy or agreement with the other fields.
([Candidate contract](../../packages/core/src/deck-candidate.ts#L8),
[save/read schemas](../../packages/core/src/deck-candidate.ts#L22)).

SQLite has a required `markdown` column beside Brief JSON and metadata. Save/update writes those values and replaces the
card rows in one transaction. Existing candidate creation time survives an update; replacement card rows get new UUIDs.
Reads join current Card Identity names, parse the Brief/candidate schemas and return stored Markdown unchanged. List
results omit Brief, Markdown and cards. ([SQLite schema](../../packages/sqlite/src/schema.ts#L79),
[save](../../packages/sqlite/src/deck-candidate-repository.ts#L17),
[list/read](../../packages/sqlite/src/deck-candidate-repository.ts#L55)).

The renderer produces twelve stable sections. Eleven accept caller-supplied prose; omitted sections get defaults. Only
Portable Decklist is computed from the list, overriding any supplied section text. The renderer sorts by order then
name, emits Commander/Mainboard for Commander or Mainboard and a populated optional Sideboard for other supported
formats, and omits card notes from portable output. Missing Collection Status explicitly says Availability was not
recorded. A renderer call does not itself validate legality or Collection evidence.
([Renderer](../../packages/core/src/deck-candidate-rendering.ts#L11),
[tool arguments/handler](../../packages/core/src/agent-tools.ts#L48),
[handler](../../packages/core/src/agent-tools.ts#L211)).

The agent save handler normalizes the input and checks reference readiness before repository persistence. It does not
rerender Markdown or call legality/evaluation there. The workflow separately requires resolution, legality, scoped
Collection checking and evaluation before rendering/saving. `get_deck_candidate` returns the stored candidate;
`renderSavedDeckCandidate` returns stored Markdown plus separately regenerated Portable Decklist. Inspection of current
call sites found no standalone candidate-export CLI and no production caller of the saved-render helper.
([Handlers](../../packages/core/src/agent-tools.ts#L220),
[workflow](../product-behavior.md#L156),
[saved renderer](../../packages/core/src/deck-candidate-rendering.ts#L51),
[CLI exports](../../packages/cli/src/index.ts#L1)).

## Section inventory and possible ownership

The section names/order are an existing rendering contract. The ownership column below is a **proposal** for comparing
options; proposed plan owners are not claims of implemented structured storage.
([Section contract](../../packages/core/src/deck-candidate-rendering.ts#L11)).

| Section                    | Purpose and content that matters                                                      | Possible canonical owner                                                                               |
|----------------------------|---------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Game Plan                  | Explain repeatable activity, advantage/win route and intended sequencing.             | Plan intent and rationale; generated report view.                                                      |
| Power And Experience       | Distinguish intended strength/complexity from the reasoning that this list fits them. | Brief for intent; plan assessment or focused rationale for fit.                                        |
| Legality Assessment        | Describe construction/legality result and exceptions/caveats.                         | Current deterministic validation; historical assessment only if explicitly retained as dated evidence. |
| Deck Structure             | Show sections/copy totals and explain desired/observed functional balance.            | Card rows for membership/totals; plan for contextual coverage and trade-offs.                          |
| Portable Decklist          | Supply importable quantity/name list.                                                 | Derived from card rows and canonical names; no separate authored copy needed.                          |
| Collection Status          | Explain scoped Available/Committed/Missing evidence and assembly trade-offs.          | Fresh scoped evidence, or explicitly identified report snapshot; timestamp alone is insufficient.      |
| Key Synergies              | Explain package relationships, conditional interactions and internal affinity.        | Plan contributions/relationships and associated rationale/evidence.                                    |
| Interaction And Protection | Explain answers, resilience, protection and relevant coverage limits.                 | Plan roles/contributions/assessments.                                                                  |
| Mana And Curve             | Separate curve/land facts from the judgment that they support the intended turns.     | Derived facts plus plan assessment or focused mana rationale.                                          |
| Optional Upgrades          | Retain alternatives and what constraints they might relax.                            | Optional proposal notes/report snapshot if deliberately wanted; not saved deck membership.             |
| Cuts And Exclusions        | Distinguish user prohibitions from strategic reasons for rejecting alternatives.      | Brief exclusions for user intent; focused decision rationale for considered cuts/exclusions.           |
| Assumptions And Caveats    | Expose uncertain evidence, conditions and unsupported capabilities.                   | Brief assumptions/constraints plus contextual plan/report caveats.                                     |

The Brief already stores goal, anchor, play experience, budget, missing-card/combo tolerance, constraints, exclusions
and
assumptions, plus Commander Bracket/Rule Zero exceptions or 60-card Power Level. It does not store the assessment that
a particular list meets those aims. Card notes can hold inclusion prose but do not identify a typed assessment or a
rejected card. ([Brief fields](../../packages/core/src/deck-building-brief.ts#L28),
[card notes](../../packages/core/src/deck-candidate.ts#L8)).

## Value that deleting Markdown alone would lose

The evaluator can reproduce legality, Game Changers, Mainboard land count and Mana Value distribution from current
local facts. It explicitly does not evaluate Collection Availability. Product behavior also distinguishes strategic
judgment from deterministic quality assessment. ([Evaluator](../../packages/core/src/agent-tools.ts#L173),
[strategy boundary](../product-behavior.md#L165)).

Canonical skills require reasoning beyond those calculations: power/experience fit, commander-independent affinity,
meaningful inclusions/exclusions, intended turn sequence, explicit curve accept/revise judgment, colored-source and
land-drawback reasoning, package dependencies, modal competition, weakest-card justification and Collection trade-offs.
Deleting the report without giving that reasoning an owner would discard useful explanations that cannot be recovered
from card membership alone. This is a content gap, not proof that the exact twelve-section format must remain.
([Commander explanation](../../skills/commander-deck-architecture/SKILL.md#L181),
[curve reasoning](../../skills/sixty-card-constructed-deck-architecture/SKILL.md#L82),
[static review](../../skills/sixty-card-constructed-deck-architecture/SKILL.md#L106),
[60-card explanation](../../skills/sixty-card-constructed-deck-architecture/SKILL.md#L142)).

Optional upgrades and rejected alternatives can also preserve decision context, but the current workflow explicitly
keeps
Deck Opportunity shortlists and Deck Change Proposals transient. Treating every recommendation as persisted product
state would be an additional decision, not an obligation imposed by this inventory.
([Root workflow](../../skills/tomekin-deck-building/SKILL.md#L95)).

Do not assume the proposed graph's intent, rationale and coverage fields fully own overall power/experience fit or the
reasons for rejected alternatives. They may carry some of that reasoning, but a dedicated decision-history record has
not been adopted in this discussion. The mapping above identifies an ownership question; it does not add that record.
Likewise, an original scoped Collection finding or acquisition trade-off can remain useful historical reasoning after
its Available/Missing quantities cease to describe the current snapshot. That historical value is separate from a
promise of current Availability.

## Duplication and freshness risks

- Stored Portable Decklist duplicates authoritative card rows. Saved Markdown may contain old names while a newly
  rendered list uses current joined names. Save accepts independent Markdown/list inputs, so disagreement need not
  wait for a later reference import. ([Schemas](../../packages/core/src/deck-candidate.ts#L22),
  [read names](../../packages/sqlite/src/deck-candidate-repository.ts#L80),
  [saved rendering](../../packages/core/src/deck-candidate-rendering.ts#L51)).
- Brief intent repeated in prose can diverge from structured intent; prose strategy and a future plan could similarly
  compete unless ownership is explicit. This is an inference from the independent free-text and structured inputs,
  not an observed user-record defect. ([Brief](../../packages/core/src/deck-building-brief.ts#L28),
  [renderer](../../packages/core/src/deck-candidate-rendering.ts#L39)).
- Collection Status is snapshot-based agent evidence. Current persistence records no structured confirmed scope,
  Availability classification, freshness or refresh result. Replacing prose with a calculation requires fresh evidence
  under a confirmed scope; it cannot reproduce historical evidence from the timestamp alone.
  ([Collection behavior](../product-behavior.md#L144),
  [persistence limits](../data-model.md#L197)).
- Recomputed legality/curve describe current local facts, whereas a preserved explanation describes its original
  assessment. Reports must distinguish these meanings. On-demand calculation removes duplicated result storage but
  does not automatically recreate contextual strategy judgments or establish their continued validity.
  ([Evaluator](../../packages/core/src/agent-tools.ts#L173),
  [saved report behavior](../product-behavior.md#L189)).

## Three realistic options

These are design alternatives, not implementation tasks or adopted policy.

| Option                                           | Benefits                                                                                                                                                                                                                                               | Costs and limitations                                                                                                                                                                                                                                                                            |
|--------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Retain a structured report snapshot              | Preserve the full reasoning and what was presented; named sections can distinguish prose from derived export content. Useful when historical explanation matters.                                                                                      | Creates another persisted artifact beside Brief/list/plan. Needs explicit snapshot meaning, provenance and revision association. A snapshot remains historical evidence, not current validation. Excluding the duplicated list reduces one inconsistency without solving all ownership problems. |
| Replace with focused fields plus derived reports | Give intent, strategy, rationale and caveats explicit owners; generate list, totals and current calculations on demand. Reduces competing sources and makes semantic updates more reviewable.                                                          | Must account for every valuable reasoning category above. Broad field design can recreate a twelve-section report schema under another name. Fresh Collection reporting needs scope/evidence support. Old arbitrary Markdown cannot be losslessly converted by heading inference.                |
| Narrow hybrid with optional rationale notes      | Keep Brief/list/plan authoritative and derive factual outputs, while allowing focused notes for reasoning that the plan does not naturally represent—for example mana judgment or rejected alternatives. Smaller initial model, flexible explanations. | Notes can become a shadow report unless restricted by purpose, ownership and revision/freshness semantics. They cannot independently redefine membership, intent or computed validity. Optional notes also mean some reports are incomplete.                                                     |

## Recommendation for discussion

**Proposal: explore the narrow hybrid first.** Use existing structured intent and membership, let the Deck Plan own
strategic relationships/assessments where that contract provides them, and derive Portable Decklist and basic factual
reports. Add only optional, purpose-specific rationale that otherwise has no owner. This preserves valuable judgment
without requiring a second complete canonical report or forcing all reasoning into a graph.

The trade-off is discipline: a note must not override the Brief, list, plan or current validation. Missing rationale
should appear as unrecorded rather than be fabricated during export. If preserving exactly what was shown at a point
in time is a product requirement, a clearly historical report snapshot is the stronger option. If the planned fields
already cover all useful rationale, the focused-fields option may need no auxiliary notes at all.

For existing candidates, preserve their original Markdown during any eventual transition rather than assume it can be
parsed into a plan. Whether that preservation is an active report, legacy-only payload or export archive is still a
decision. Deprecation, field design, export format and migration behavior remain unsettled; this note establishes the
content and authority questions needed to decide them.

## Subsequent direction — 2026-10-13

The user accepted preserving useful reasoning in defined fields and generating reports and exports on demand, including
explicit agreement that a Portable Decklist need not be duplicated inside stored Markdown. The future planned-candidate
contract should retire mandatory whole-document Markdown, while exact focused fields, legacy content preservation,
compatibility, and reporting payloads remain decisions. No application behavior changed as part of this discussion.
The canonical agreement
is [Structured tag-based deck plans — agreed direction](https://github.com/OSmall/tomekin/issues/62#issuecomment-6106714471).

The user also clarified that non-selected options should form persistent, active Role Card Pools for rotation,
user-led playtesting, sourcing, and fallback substitutions. They are enduring options, rather than solely rejected-card
history or temporary drafts. This supplies a concrete use for contextual alternative-comparison reasoning identified
above. Records and lifecycle belong to
[Define persistent Role Card Pools and deck selection](https://github.com/OSmall/tomekin/issues/78),
separate from temporary working state. Only current selected membership determines final counts and decklist exports;
the larger pool is not an extra Format section.
