---
name: commander
description: "Commander/EDH: apply Format-specific rules, the adopted Template and commander-dependent strategy during discovery, construction, explanation or tuning."
---

# Commander

Use `deck-development` for task flow and completion, `card-research` for investigation and `probability-analysis` for numerical decisions. Follow the confirmed Commander Bracket, play experience and Collection Access Policy. Retrieve actual construction constraints and card facts: Commander normally has 100 cards including its commander, singleton by Card Identity except permitted overrides, Color Identity restrictions and no ordinary Sideboard. Check commander eligibility and special construction rules with the tools; current banned lists and Bracket classifications remain external changing facts.

Analyze the commander's exact actions through the shared workflow. Account for casting cost, commander tax, removal, protection and time to productive use. Command-zone access makes it available to cast, while the deck must still fund deployment and use. Explain development before it arrives and recovery or alternative play after it is removed.

## Apply the Template

**Template** means the adopted Command Zone starting profile below. Account for all six functions, then explain material departures and what compensates for them. These are overlapping functional memberships, not six disjoint piles or fixed Deck Packages. A Deck Package is a coherent strategic group that may span several functions.

| Function | Starting memberships |
| --- | ---: |
| Land/mana access | 38 |
| Card advantage | 12 |
| Ramp | 10 |
| Targeted disruption | 12 |
| Mass disruption | 6 |
| Plan | approximately 30 |

The baseline sums to 108 memberships; fitting those in 100 selected cards needs overlap. Evaluate each contribution's real costs, conditions, timing and competition. Concurrent effects can serve several functions, while alternative modes or spending a shared resource may prevent simultaneous use. Count actual selected quantities and sections; keep the commander distinct from library copies.

### Land and mana access

Start around 38 mana-access memberships, then assess actual land drops, colors, untapped access and curve against intended turns. The adopted convention includes MDFCs and cards that landcycle for one mana, recorded separately from actual lands. An MDFC used as a land gives up its spell mode; a landcycler consumes mana and a card, needs a suitable target, and still requires playing the found land. Utility lands can support other functions while straining colored access.

As an independently checked sampling illustration, 38 qualifying cards in a 99-card library yield about 54.8% for at least three and 82.9% for at least two in seven cards; in eight cards the figures are about 65.8% and 88.6%. These are uniform samples before mulligans or other access. Define qualifying sources and actual draws before recalculating; treating all land-like options as equivalent does not establish on-time land drops or castability.

### Card advantage

Start at 12 sources of usable net card gain, assessed by investment, timing, payment, zone and restrictions. Draw, access to extra plays and recursion can supply advantage when the deck can use the resources. Selection or replacing the card spent is a different contribution. A draw amplifier needs a functioning source to amplify.

Verified exemplar associations: Phyrexian Arena has the direct tag `draw-engine`, with broader inherited associations `repeatable-draw` and `card-advantage`; Harmonize has `burst-draw`; Wall of Omens has `cantrip`. Inspect current definitions and Oracle facts through `card-research`. Repeated draw need not produce net advantage, and a cantrip label alone does not establish it.

### Ramp

Start at 10 sources that increase usable mana beyond ordinary land development on relevant turns. Qualify mana creatures, rocks and lands put onto the battlefield by installation cost, summoning sickness, colors, first production and vulnerability. Temporary mana can enable a turn without supplying sustained acceleration; extra land drops need lands to play.

Sol Ring's verified `mana-rock` association inherits `ramp` and `mana-producer`. Colorless acceleration can pay other costs and preserve colored sources for abilities. For a turn-three four-mana play, compare actual cheap accelerators, installation mana and colors with the natural curve using `probability-analysis`; ten cards labelled ramp need not support that deadline.

### Targeted disruption

Start at 12 effects that meaningfully interfere with a specific opposing card or action. Assess targets, speed, payment, permanence and expected threats. Swords to Plowshares has the verified `spot-removal` tag; its exact Oracle text determines what it answers. Counterspells and disruptive lands can serve other forms of targeted interaction. Multiplayer one-for-one exchanges spend resources while other opponents retain theirs, so breadth and timing matter alongside count.

### Mass disruption

Start at 6 effects that constrain multiple opposing resources or actions. Investigate removal, prevention, taxes and repeatable interference by their actual scope. A wipe is one mechanism, not the whole category. The reported starting mix is roughly three creature answers, one artifact/enchantment answer, one graveyard answer and one repeatable interactive effect; treat that as an overlapping illustration to adapt to expected threats.

Wrath of God's verified `sweeper` association illustrates broad removal that can also destroy the deck's engine. Propaganda's direct `tax-attack` tag and broader inherited `pillowfort` association illustrate another mechanism: taxing each creature attacking you can constrain multiple attackers without removing them. Assess how readily opponents can pay, which threats bypass it and whom it protects. Calling that broad combat disruption is functional reasoning from its text, not a claim that a source or tag certifies one full unit of coverage.

Fogs, graveyard effects and protective spells vary in breadth and timing. Credit only what they can disrupt in this plan; an effect shielding your own board does not automatically answer opposing resources.

### Plan

Start with approximately 30 memberships serving the intended game actions and Win Routes. **Enablers** provide inputs, actions or access; **payoffs** convert those actions into useful progress or winning; **enhancers** multiply a working process. Include protection and recovery with the plan functions they sustain, such as preserving the commander or rebuilding an engine. Record disruption overlap only when the actual effects support both functions.

The source-derived guidance illustrates different needs depending on what the commander supplies:

| Commander's main function | Enablers | Payoffs | Enhancers |
| --- | ---: | ---: | ---: |
| Payoff for a repeated action | 25 or more | about 2 | about 3 |
| Supplies the enabling action | about 18 | about 8 | about 4 |
| Multiplies other effects | 25 or more | about 5 | 0 as a starting point |

These are report-attributed illustrations, not fixed ratios. A commander may serve several functions, cost too much to use on time or be removed. Choose counts from actual action frequency, useful deadlines, resilience and available alternatives. For example, Viscera Seer's `free-sacrifice-outlet` and Blood Artist's `blood-artist-ability` are verified discovery hints for an outlet and a death payoff; the plan still needs expendable creatures and enough output to close. A multiplier alone cannot supply those inputs.

## Compare curve and mana

Use this reported Command Zone illustration as relative weights for comparison:

| Mana Value | 0 | 1 | 2 | 3 | 4 | 5 | 6+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reported weight | 0 | 9 | 18 | 15 | 10 | 5 | 5 |

The weights total 62; the source's commander/land accounting has not been independently established. Compare proportions rather than copying them into a 100-card list. State whether the actual curve includes the commander and how modal cards are counted, and count the final selected deck separately. This is an illustrative starting shape, not a prescribed Bracket or an acceptable-distance test.

1. Compare the actual curve and land count with the reference. Explain meaningful differences through Power Level, budget, permitted cards, play experience and the plan; a supported higher curve can be appropriate.
2. Walk intended early, middle and later turns using actual casting routes, untapped colored sources, ramp setup, interaction held up and recurring costs. Repeated commander casts and rebuilding after disruption change the required budget. A high printed Mana Value can have a supported alternate route, but count its actual prerequisites.
3. Use `probability-analysis` to compare material alternatives, such as cheaper effects versus more mana support. State the access/deadline measured, improvements, displaced functions and unresolved conditions. Mean Mana Value, standard deviation or histogram similarity alone cannot establish that these turns work.
4. Retain the chosen trade-off and revisit affected counts and calculations when selection changes. Describe this as static analysis unless actual games or simulations supply additional evidence.

## Provenance

The adopted baseline comes from The Command Zone, [episode 658](https://www.youtube.com/watch?v=OSNV6224cHg); [episode 659](https://www.youtube.com/watch?v=PUrQpnQ7bi8) discusses contextual departures and [episode 733](https://podcasts.apple.com/au/podcast/why-overlap-is-the-key-to-good-deck-building-733/id898023861?i=1000758698520) discusses overlap. Publisher descriptions confirm those topics. Exact ratios, the disruption mix and curve weights remain report-attributed illustrations; substantive captions were unavailable during the 2026-11-02 check. Their retention is qualified adopted guidance, not fresh transcript verification. The sampling examples were independently recalculated; tag examples were checked against imported Scryfall records on that date. Use current tool-backed card facts and definitions for the actual task.
