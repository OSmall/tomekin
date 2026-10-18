---
name: commander-deck-architecture
description: Use after a Commander/EDH Deck Building Brief and either a commander or selected Deck Opportunity are confirmed to construct a Commander Deck Candidate with the shared deck-shape method, qualified starting profile and Commander-specific access assumptions.
---

# Commander Deck Architecture

Use after `tomekin-deck-building` confirms the Commander/EDH Brief and the user has chosen a commander or
selected a Deck Opportunity. Load `deck-shape-methodology` for the common reasoning sequence and `query-cards` for
retrieval mechanics. This skill owns Commander assumptions, counting guidance and its worked example; the lifecycle
skill owns supported tools, deterministic validation, rendering and persistence.

When discovery hands off a direction, preserve its anchor, activity, winning direction, Collection support and caveats.
Preserve the whole confirmed Collection Access Policy through retrieval and final joint Availability. Research and refine the selected direction; agree a materially different identity
before building it.

## Commander Access And Table Context

Inspect the commander's relevant card facts, Color Identity, legality, text, parts and supporting tags. Respect the
confirmed Commander Bracket, play experience, combo tolerance, budget, Missing Card tolerance and exclusions. Strength
and pilot complexity remain distinct. Preserve the appeal of a user-chosen commander while challenging off-plan cards.

Explain what the commander actually supplies, its costs and timing, and how the Mainboard functions when it is absent
or repeatedly removed. Command-zone access is not a phantom library copy or a reason to automatically shrink a support
role. Review protection, recovery and independent access in light of that dependence. Use meaningful primary/secondary
Win Routes rather than a compulsory number of closers. Commander has no Sideboard.

## Adopted Starting Profile

Begin ordinary construction with this meaningful report-attributed profile, then make reasoned deck-specific changes:

| Function | Starting target |
| --- | ---: |
| Land/mana-access slots under the report convention | 38 |
| Card advantage | 12 |
| Ramp | 10 |
| Targeted disruption | 12 |
| Mass disruption | 6 |
| Plan-serving cards | Approximately 30 |

These functional targets overlap; their sum is not deck size. The review condition is **baseline satisfied or a
justified departure recorded**. Explain departures using curve, strategy, anchor access, reliable card access,
recursion, aggression, opposition, protection/recovery, available options or confirmed constraints. A sufficient
reason is enough; justify how the resulting configuration still serves its plan, including any accepted compromise.
Retain the applied criteria and departure rationale with the role goal/assessment or other focused owner for later
sessions. A later tune should not automatically restore generic counts.

Provenance: the user adopted this profile in the
[methodology resolution](https://github.com/OSmall/tomekin/issues/75#issuecomment-6234696206), attributed by the supplied
report to [The Command Zone 658](https://www.youtube.com/watch?v=OSNV6224cHg), with contextual exceptions attributed to
[The Command Zone 659](https://www.youtube.com/watch?v=PUrQpnQ7bi8). The
[qualified synthesis](../../docs/research/2026-10-10-commander-deck-building-research.md) preserves source/evidence limits.
User adoption independently certifies neither exact transcript attribution nor numerical sufficiency. This profile
replaces the earlier Commander skeleton and mandatory mana-value rubric; it is not a legality or quality rule.

## Apply The Profile In Context

Define qualifying effects for each target using `deck-shape-methodology`. Card selection is distinct from net card
advantage; burst mana is distinct from repeatable acceleration; protection is distinct from removal. Recursion can
provide contextual card access with meaningful graveyard, timing and commander-dependence qualifications.

The report's mana-access convention includes MDFCs and one-mana landcyclers. Explain costs, timing and competing spell
uses if applying it. Keep this functional convention separate from card-type facts, the evaluator's defined land count
and deterministic construction. Count actual selected quantities by relevant section and identify commander
contributions separately. Pool alternatives supply zero selected coverage.

Review the intended early, middle and closing turns against functional actions and mana/curve. A higher-cost card can
be appropriate when its role, acceleration, survival and payoff support it; lower Mana Value is not an automatic
winner. Assess enabler/payoff balance, redundancy that still helps, resource competition and support that works without
the commander. Do not prefer a card merely for matching more tags or roles. Tags guide discovery alongside independent
functional searches and inspected card facts.

## Compact Worked Example: Meren Recursion

**Context:** an illustrative confirmed Brief requests a black-green Meren of Clan Nel Toth deck, recurring small
creatures and death payoffs, no infinite combo, and a resilient multiplayer play experience. Actual choices still need
the user's Addition Pool, Collection evidence and applicable deterministic checks; this is a reasoning example, not a
validated complete 100-card list.

**Plan and access:** sacrifice useful creatures, recover them for repeated value, and convert deaths into opponent life
loss with Zulaport Cutthroat as a primary winning direction; creature combat is a secondary route. Meren earns experience
when another controlled creature dies and recovers one targeted creature at the controller's end step, to battlefield
or hand depending on Mana Value and experience. She supplies conditional recovery, not unrestricted draw or an
instant-speed sacrifice outlet. Removal, graveyard disruption and end-step timing threaten the engine. Retain
independent access and recovery rather than assuming command-zone availability solves them.

**Qualified contributions:** select Sakura-Tribe Elder as one Mainboard option for basic-land acceleration and a
self-sacrificing creature. Its land arrives tapped; it sacrifices itself, not arbitrary creatures. A recovered Elder
can repeat the function only with suitable recovery. Select Village Rites for sacrifice access plus conditional card
access: it costs a creature as well as the spell, so drawing two is not automatically net-positive cardboard. Keep
Deadly Dispute as an assessed, unselected alternative; it supplies zero current coverage. Golgari Charm can provide
small-creature disruption, enchantment removal or regeneration, one mode at a time. Regeneration does not answer
exile or every sweeper. Its role labels cannot establish simultaneous protection and removal.

**Profile and departure:** start with the table above. Suppose this configuration retains 38 mana-access slots, 12
qualified access contributions, 10 ramp, 12 targeted disruption, approximately 30 plan-serving contributions, but only
four mass-disruption contributors. Treat the broadened access category as a separate justified departure from twelve
net-advantage pieces, documenting its dependence on recursion and available sacrifice fodder. Explain the departure in that role's assessment: the creature-recursion plan relies
on its own board and chooses selective interaction, recovery and two extra plan-serving slots over two more mass
answers. This accepts exposure to large opposing boards and needs reassessment if opposition changes. The count alone
does not certify adequacy; the example's access category must retain which effects are conditional recursion/selection
versus net card advantage instead of claiming all twelve are unconditional draw.

**Same-role change:** Village Rites → Deadly Dispute retains one sacrifice/card-access option. Dispute accepts an
artifact or creature and makes a Treasure, but costs one more mana. The Treasure is a one-shot resource, not proof of
repeatable ramp; sacrificing an artifact does not trigger creature-death payoffs. Review the resulting early mana and
creature-fodder access before accepting. Cutting Rites retains it as a viable pool alternative by default.

**Intentional redistribution:** a second proposed cut of Harmonize for another needed sacrifice enabler sacrifices
unconditional card access to repair a demonstrated enabler deficit. Review every lost contribution, whether conditional
access still meets the applied criteria, and the accepted risk. If the user accepts only this second swap, reassess that
actual aggregate instead of crediting Dispute's unaccepted access/Treasure contribution. Retain Harmonize as an active
alternative if it remains suitable; a desired access gap stays explicit. Exact changes and target follow lifecycle
confirmation rather than implied approval from the Brief.

**Bounded probability question:** for a context-specific access target, ask whether at least one of twelve independently
qualified Mainboard identities appears in nine cards sampled without replacement from the 99. Exclude the commander,
assume no mulligan, search, extra draws or prior known cards, and distinguish this from exactly one. This supports only
seeing an identity; it does not establish mana, fodder, casting or execution. Invoke the supported tool:

```json
{"operation":"probability","populationSize":99,"populationSuccesses":12,"sampleSize":9,"event":{"kind":"at_least","count":1}}
```

The probability is approximately 0.7036929 (70.37%). This meets an illustrative chosen 70% access target under these
assumptions; that target is contextual, not universal. The executable workflow harness checks this independent
uniform-subset result. Twelve qualified copies, not twelve role labels, define the modeled successes.

**Later session:** read the current role criteria, the four-mass-disruption departure, conditional contributions,
accepted swaps and retained options before tuning. Explain why the current configuration differs from the template.
Only relevant new intent/evidence warrants reopening that judgment. Retain each justification with its focused record
when supported by the available candidate tools; do not claim this illustrative reasoning was saved.

Card-fact provenance: relevant costs/effects checked against Scryfall on 2026-10-18:
[Meren](https://scryfall.com/card/tdc/297/meren-of-clan-nel-toth),
[Sakura-Tribe Elder](https://scryfall.com/card/soc/285/sakura-tribe-elder),
[Village Rites](https://scryfall.com/card/inr/137/village-rites),
[Deadly Dispute](https://scryfall.com/card/msc/794/deadly-dispute),
[Golgari Charm](https://scryfall.com/card/uma/201/golgari-charm),
[Harmonize](https://scryfall.com/card/msc/175/harmonize), and
[Zulaport Cutthroat](https://scryfall.com/card/soc/233/zulaport-cutthroat).
These facts support the local contribution examples, not source-report certification or a deck-strength claim.

## Return To The Lifecycle

Resolve final names and explicitly run applicable deterministic checks through `tomekin-deck-building` before claiming
a completed deck result. Obtain final joint Availability under the whole confirmed Collection Access Policy.
Explain plan, Commander Bracket/play experience, qualified selected coverage, template departures, mana/curve,
commander dependence, meaningful inclusions/exclusions, practical constraints and uncertainty. Save authorized incomplete construction through create/edit; explicitly check the actual accepted result and recover
complete joint Availability and Pull List evidence through the root lifecycle.
