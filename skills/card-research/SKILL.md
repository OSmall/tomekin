---
name: card-research
description: "Card research: derive searches from game actions, learn exemplars and tags, discover Collection-scoped options, or recover paginated evidence."
---

# Card research

Use the existing Brief and action analysis from `deck-development`. For a standalone investigation, establish just the question, permitted scope and relevant constraints.

A **Research Exemplar** is a card studied to learn a mechanism or search vocabulary; it may be unowned or otherwise ineligible for selection. A **Card Identity Tag** describes a reusable card characteristic. Tags guide discovery; a card's role in this particular deck depends on its actual rules and surrounding plan. A direct tag is recorded on the card; an inherited tag is a broader association supplied by the tag hierarchy.

## Prepare a search map

1. **Derive questions from actions.** For each material need, identify inputs, actions, costs, timing, resulting events and useful output. Follow indirect events as well as named abilities. Separate supplying an input, enabling its use and rewarding the result. Include ordinary mana, card advantage, disruption, access, protection and recovery. Finish with concrete research questions covering the plan's prerequisites and support needs.
2. **Learn from exemplars.** Inspect relevant exemplar Oracle facts and direct/inherited tag associations. Use `browse_tags` to inspect complete definitions: slug and nullable description by default, metadata or hierarchy when needed. For an absent or unclear description, ground the hypothesis in inspected card facts or other evidence and record the uncertainty. A not-found or unready dataset establishes no tag meaning. Finish with observed mechanisms and vocabulary rather than guessed slugs or automatic role assignments.
3. **Make criteria actionable.** For each question retain its exemplar, learned tag meaning, complementary Oracle/text/type/numeric criteria, timing qualifications and intended scope. Separate exploratory learning from selection eligibility. Use the action example below to check for overlooked events. Save the substantive map at the preparation boundary specified by `deck-development` before broad selection research.

## Investigate permitted options

1. **Search complementary branches.** Investigate the prepared mechanisms and ordinary support across the permitted scope. Use native provider queries and controls unchanged. Request the smallest useful complete facts for broad discovery, then batch missing Oracle facts for promising options. New findings can revise the map and Deck Plan or open a material new branch.
2. **Complete each traversal.** Repeat fixed inputs and effective selectors, forward the actual `next_cursor` as `after` until null, and preserve delivered facts plus safe `error.cursor` on partial failure. Changed inputs or relevant baseline require restart. A `first` of zero consumes no records. Every page of each search used must be traversed, including when an early page already looks sufficient. Report incomplete traversal and its recovery position honestly.
3. **Compare functional alternatives.** Inspect complete relevant facts for promising cards: required state, costs, timing, frequency, resource competition, vulnerability and contribution to the plan. Retain qualified alternatives separately from selection. End branch expansion when further investigation has a reasoned low likelihood of changing choices, with material mechanisms and support traversed and compared or their gaps explicitly reported. Research coverage remains distinct from having enough cards; a full deck or large pool alone is insufficient justification to stop.

## Choose evidence by question

| Question | Tool and evidence |
| --- | --- |
| Facts or tags for known identities, exact names or Printings | `lookup_cards`, with selected complete facts. It can also return Collection summary/copies evidence using actual rows under the supplied scope and confirmed policy. A found card alone proves no Collection membership. |
| Discover cards satisfying a mechanism or property | `search_cards`, using native provider syntax. Collection scope filters results locally; trust the returned scoped eligibility rather than rechecking each card. Request summary/copies evidence when quantities or sourcing require it. |
| Inspect owned rows, locations, printings or acquisition dates | `browse_collection_cards`, under the confirmed policy. |
| Learn tag meanings or relationships | `browse_tags` definitions and, when useful, hierarchy; per-card associations come from card facts. |

Keep known-empty, missing, unready and unknown evidence distinct. Scoped eligibility establishes matching permitted copies, while final whole-deck Availability needs the joint check owned by `deck-development`. Use complete returned facts; recover oversized or partial delivery rather than clipping required evidence.

## Worked action example: attacking and becoming tapped

An attack plan creates several questions: what can attack, what enables the attack, what happens when an attacker taps, and what rewards attack declaration or later damage? Declaring an attacker normally taps it; vigilance changes that step. Inspect both the named attack event and the indirect tapping event.

Fallowsage is a Research Exemplar: its own becomes-tapped trigger draws a card. Its verified `uninspired` tag teaches that search branch. Inspect its Oracle text and the tag definition, then search that mechanism and independent becomes-tapped text. Distinguish `synergy-tapped` (other tapped permanents) and `tapped-matters-self` (its own tapped state) from a transition to tapped.

Entering tapped and attacking is different: it produces neither an attack-declaration event nor a becomes-tapped transition. Alesha returning Fallowsage that way would not trigger its draw. Fallowsage's blue Color Identity also makes it ineligible for an ordinary Mardu Alesha selection; studying it teaches the mechanism without recommending inclusion. Translate the learned branch into eligible searches under the actual Brief.

For an action chain such as setting up a graveyard, returning a creature and exploiting its later death, investigate setup, legal target conditions, payment, entry timing, a sacrifice outlet and a death payoff separately. Viscera Seer's verified `free-sacrifice-outlet` association and Blood Artist's `blood-artist-ability` illustrate different jobs; their actual requirements and output determine whether the chain works.

These examples use imported Scryfall tag associations checked on 2026-11-02; learn current meanings through `browse_tags`. Event distinctions follow Wizards' [Comprehensive Rules](https://magic.wizards.com/en/rules), particularly 508.1f, 508.3a, 508.4, 603.2e and 702.20b. This is checked guidance, not a claim that Tomekin can browse rules during a session; qualify material uncertainty when available facts are insufficient.

For Pi scripts that compose calls or retain same-session checkpoints, read [codemode.md](codemode.md). When explicitly enabled legacy local Card Query is needed, read [legacy-query.md](legacy-query.md); its syntax and policy limitations differ from provider discovery.
