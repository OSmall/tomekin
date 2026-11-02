# Commander skill: source and tag verification

Checked 2026-11-02 for the skill refinement in PR #136. This note records evidence behind the operational
instructions; it is neither a new specification nor a claim of live deck-building acceptance.

## Publisher evidence and limits

The Command Zone's publisher-supplied episode descriptions confirm the purpose of
[episode 658, Commander Deckbuilding Template for the New Era](https://podcasts.apple.com/ca/podcast/commander-deckbuilding-template-for-the-new-era-658/id898023861?i=1000693689243),
the contextual exceptions in
[episode 659, The Problem with Deckbuilding Templates](https://podcasts.apple.com/fr/podcast/the-problem-with-deckbuilding-templates-659/id898023861?i=1000696331014),
and multiple functions per card in
[episode 733, Why Overlap Is The Key To Good Deck Building](https://podcasts.apple.com/au/podcast/why-overlap-is-the-key-to-good-deck-building-733/id898023861?i=1000758698520).
Episode 659 explicitly presents the earlier template as an oversimplification that should be adapted. Episode 733's
description confirms overlap as its subject; its YouTube title is “Level Up Your Deck Building w/ This One Hack.”

The public [658 video page](https://www.youtube.com/watch?v=OSNV6224cHg) supplied an English auto-caption track,
but fetching that track returned an empty body. No substantive transcript, audio, or visual slide was independently
verified in this pass. Search snippets and third-party summaries were not used to establish exact podcast claims.
The earlier [source audit](2026-10-10-commander-source-report-audit.md) and
[qualified synthesis](2026-10-10-commander-deck-building-research.md) remain the provenance for reported details.

The six-function baseline is already adopted in
[#118](https://github.com/OSmall/tomekin/issues/118): 38 land/mana-access memberships, 12 card advantage, 10 ramp,
12 targeted disruption, 6 mass disruption and approximately 30 plan-serving memberships. Adoption establishes the
Tomekin starting heuristic, not independent verification of exact transcript wording or universal sufficiency.
These memberships overlap. “Deck Package” retains its glossary meaning of a coherent strategic group; it is not a
synonym for one of the six Template functions.

## Curve and ratio accounting

The pre-refinement [Commander skill at aae9043](https://github.com/OSmall/tomekin/blob/aae904386350a0ac9f2286a65c2a89134496593a/skills/commander/SKILL.md)
attributes the mana-value counts `0, 9, 18, 15, 10, 5, 5` for bins `0, 1, 2, 3, 4, 5, 6+` to episode 658.
The counts total 62. Their combination with 38 lands and a separately counted commander totals 101.
The 37-land interpretation totals 100, but that arithmetic does not establish what the episode actually counted.
Neither commander inclusion in the bins nor a source decision to reduce lands was verified.

Retain the raw vector only as an attributed illustrative comparison with its accounting caveat, or explicitly label
any adjusted vector as Tomekin's adaptation. Do not silently change a number and attribute the repair to the source.
Compare a real selection's land count and nonland curve using a stated commander/modal-card counting convention.
Then examine useful turns, colored mana, setup costs and recurring spending; a distribution alone cannot establish
those actions are feasible. Budget, permitted cards, Power Level and play experience may justify a different curve.

The three enabler/payoff/enhancer distributions in that skill also remain report-attributed examples, not freshly
transcript-verified ratios. They can illustrate commander dependence if explicitly qualified. Neither these examples
nor the Template establish a fixed ratio, curve distance, variance threshold, Bracket, or deck-quality score.

## Verified local tag examples

The existing `.data/tomekin.sqlite` was opened with `sqlite3 -readonly`. It contained 4,578 tag definitions and
236,839 direct taggings at inspection. Queries read only card identities, tag definitions, taggings and hierarchy;
no Collection rows or production candidate contents were needed. The table below records imported Scryfall evidence,
not a fresh claim about the remote Tagger database. Descriptions are paraphrased; verify current definitions at runtime.

| Exemplar | Verified direct tag | Meaning and useful distinction |
| --- | --- | --- |
| Sol Ring | [`mana-rock`](https://tagger.scryfall.com/tags/card/mana-rock) | Noncreature artifact supplying increased mana. Its hierarchy includes `ramp` and `mana-producer`; colorless production can fund generic costs and preserve colored sources. |
| Phyrexian Arena | [`draw-engine`](https://tagger.scryfall.com/tags/card/draw-engine) | Repeated net card gain. Hierarchy includes `repeatable-draw` and `card-advantage`; `repeatable-draw` alone does not require net gain. |
| Harmonize | [`burst-draw`](https://tagger.scryfall.com/tags/card/burst-draw) | Several cards gained together; the imported description supplies its own quantity/net-gain convention. |
| Wall of Omens | [`cantrip`](https://tagger.scryfall.com/tags/card/cantrip) | A draw on resolution or entry. The label alone does not establish repeated or net card advantage. |
| Swords to Plowshares | [`spot-removal`](https://tagger.scryfall.com/tags/card/spot-removal) | Removal aimed at one target. Inspect actual target restrictions and cost. |
| Wrath of God | [`sweeper`](https://tagger.scryfall.com/tags/card/sweeper) | Broad removal; it may remove the deck's own engine as well. |
| Propaganda | [`tax-attack`](https://tagger.scryfall.com/tags/card/tax-attack) | Attacking requires payment. It inherits `pillowfort`; this is not a removal tag. |
| Viscera Seer | [`free-sacrifice-outlet`](https://tagger.scryfall.com/tags/card/free-sacrifice-outlet) | Repeated sacrifices without an additional payment; it still needs the appropriate material. |
| Blood Artist | [`blood-artist-ability`](https://tagger.scryfall.com/tags/card/blood-artist-ability) | Life changes rewarded by creature deaths; exact player scope and trigger text remain authoritative. |
| Fallowsage | [`uninspired`](https://tagger.scryfall.com/tags/card/uninspired), `draw-engine` | Its trigger concerns becoming tapped. `synergy-tapped` concerns other tapped permanents; `tapped-matters-self` concerns the permanent's own tapped state. |

`tapping-matters` was not an exact imported slug. Arcane Signet has a narrower direct tag,
`mana-rock-with-set-s-mechanic`; examples must distinguish direct tags from inherited ones rather than inventing
an exact direct association. Tag weights guide research attention, not contextual Role Coverage or inclusion scores.

## Mass disruption and the action example

Propaganda's imported [Oracle text](https://scryfall.com/card/msc/151/propaganda) imposes a per-creature attack payment.
It can therefore serve a broad combat-disruption function without removing creatures. That is a functional inference
from card text, not an independently verified quotation of episode 658. Assess what it delays, whom it protects,
and how readily opponents can pay. It does not answer every threat or protect the other players.

Plan protection and recovery belong with the plan functions they sustain. A card may also satisfy a disruption
function when its actual effects do so; overlapping labels alone establish neither simultaneous use nor adequacy.

The [Wizards Comprehensive Rules linked on the rules page](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt),
effective 2026-09-25, establish the action distinctions: declared attackers tap (508.1f), with the vigilance exception
(702.20b); entering attacking does not generate an attack-declaration trigger (508.3a, 508.4); entering tapped does
not generate a becomes-tapped trigger (603.2e).
The imported [Fallowsage text](https://scryfall.com/card/moc/223/fallowsage) rewards its own transition to tapped.
Thus declaring it as an attacker without vigilance can produce its draw trigger; returning it tapped and attacking
with [Alesha](https://scryfall.com/card/dmc/118/alesha-who-smiles-at-death) does not produce that trigger. Fallowsage's
blue Color Identity excludes it from an ordinary Mardu Alesha selection, but it remains a useful Research Exemplar.
The example teaches event decomposition and eligibility boundaries, not a recommendation to include the card.
