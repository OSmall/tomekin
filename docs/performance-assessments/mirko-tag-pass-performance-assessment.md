# Mirko Tag-Cohesion Pass Performance Assessment

## Context

After the first Mirko, Obsessive Theorist deck candidate, the user gave direct feedback: use the tag tools much more heavily. The intended workflow was to inspect tags on the commander, use those tags to find or evaluate synergistic cards, and also follow adjacent tags that reveal related synergy packages.

This assessment covers the second pass and save operation for `Mirko Budget Dimir Control - Tag-Cohesion Pass`.

## What Improved

The second pass was more domain-driven. Instead of relying mostly on card knowledge and broad archetype intuition, I explicitly started from Mirko's local tags:

- `synergy-surveil`
- `surveil`
- `synergy-low-power`
- `reanimate-creature`
- `repeatable-pp-counters`
- `power-matters-self`
- `evasion`

I also followed adjacent tags exposed on candidate cards:

- `repeatable-loot`
- `reanimate-copy`
- `copy-creature`
- `graveyard fuel-creature`
- `trigger from graveyard`
- `utility land`
- `cycle-dual-surveil-land`

The final list became more cohesive. The additions were more clearly connected to Mirko's mechanics:

- `Lazav, the Multifarious`: surveil plus graveyard copy payoff.
- `Likeness Looter`: repeatable loot plus graveyard copy payoff.
- `Master of Death`: surveil and self-recursion.
- `Doom Whisperer`: repeatable surveil engine.
- `Dream Eater`: surveil plus interactive tempo.
- `House Guildmage`: repeatable surveil mana sink.
- `Obsessive Stitcher`: repeatable loot plus creature reanimation.
- `Undercity Sewers`: surveil land that also supports the mana base.

I also improved the cut logic. Cards were removed for being less connected to the tag graph or for pushing the deck toward generic Dimir control rather than Mirko-specific synergy.

## What Got Worse

The second pass was more tool-heavy but also more cumbersome. Several tag and identity search calls returned empty results, especially when I attempted query-like syntax such as `tag:surveil colorIdentity<=UB`. This caused some wasted exploration and made the workflow feel less direct than it should have.

The final save operation was worse from an efficiency standpoint. Because the save tool required a full card payload, brief, and markdown, I had to pass a very large request. That was slow, verbose, and fragile.

The pass still did not verify live prices. This remained a significant gap because the user's budget target was ~$100. `Undercity Sewers` may be a budget risk, and I only noted fallback options rather than validating the price.

## What Stayed The Same

The core build philosophy stayed the same:

- Upgraded-precon / synergistic casual power.
- Dimir surveil, graveyard value, and fair control.
- No deterministic combo focus.
- No Game Changers.
- Empty-Collection first-slice assumption, so every card is a Missing Card.

The validation posture also stayed the same:

- I validated Commander legality.
- I evaluated land count, curve, Game Changers, and collection status.
- I did not run live price checks, gameplay simulation, or goldfishing.

## Positives About The Tool Set

The tools are strong for deterministic local validation.

- `get_card_identity` is very useful because it returns card text, legality, EDHREC rank, Game Changer status, and tags in one place.
- Commander legality validation is valuable and prevents accidental illegal lists.
- Game Changer detection is useful for matching Commander Bracket expectations.
- The empty-Collection status is explicit and consistent.
- The save tool produces a persistent Deck Candidate with structured card rows and rendered markdown.
- Tag metadata is genuinely useful for synergy discovery when used card-by-card.

The best workflow was not broad search first. It was:

1. Inspect commander tags.
2. Inspect likely candidate cards.
3. Compare candidate tags against commander tags and adjacent tags.
4. Add cards that increase overlapping tag density.
5. Validate and evaluate the final result.

## Negatives And Friction Points

The biggest friction point is that tag discovery appears stronger on individual card inspection than on global card search.

Problems encountered:

- `search_card_identities` did not perform well for semantic or tag-like queries.
- Tag search found tag definitions, but did not directly return cards with those tags.
- There was no obvious tool for "give me Commander-legal UB cards with tag X".
- There was no obvious tool for "find cards sharing tags with this commander".
- There was no category analysis tool for role density.
- There was no price tool, so budget compliance remained speculative.
- Tool schemas were strict and not always discoverable from the tool names alone.
- Render and save require large structured payloads instead of accepting a previously validated candidate object or saved intermediate state.

The repeated failed calls were my responsibility, but they also indicate schema discoverability friction. The tools would be easier to use if each error suggested a minimal valid request shape.

## Does The Agent Need Updating?

Yes, the agent behavior should be updated.

The agent should treat tags as a first-class deck-building workflow, not as incidental metadata. For Commander deck construction, the agent should default to:

- Pull commander identity and tags first.
- Name the commander's primary tag clusters.
- Build a candidate pool by tag cluster.
- Track which cards share direct commander tags and which cards are adjacent enablers/payoffs.
- Report the final deck's tag-density improvements.
- Avoid jumping too quickly from commander choice to hand-built 99.

The agent should also avoid claiming budget confidence without price validation. If no pricing tool is available, it should label the budget as a target and identify likely budget-risk cards.

## Does The Skill Need Updating?

Yes, the `mtg-deck-building` skill should be updated more than the base agent.

Recommended skill changes:

- Add a tag-first workflow step immediately after commander selection.
- Require recording the commander's important tags in the Deck Building Brief.
- Require a "tag package" section in the final response.
- Require a before/after cut rationale when revising a deck.
- Require checking candidate cards' tags before including them when the user asks for cohesion.
- Add a reminder that `search_card_identity_tags` finds tag definitions, while `get_card_identity` is the reliable way to inspect a card's actual tags.
- Add a warning that budget is unverified unless a price source is explicitly used.

The skill could also define an expected tool sequence for revisions:

1. `get_card_identity` on the commander.
2. `search_card_identity_tags` for commander tags and adjacent tags.
3. `get_card_identity` on proposed additions and cuts.
4. Explain tag overlap and role improvement.
5. Resolve, validate, evaluate, render, and save only after review.

## Why Rendering And Saving Takes So Long

Rendering and saving are slow because the tools require large, fully structured deck payloads.

For a 100-card Commander deck, the payload includes many repeated objects with:

- `cardIdentityId`
- `cardName`
- `quantity`
- `section`

The save step also required:

- A full `brief` object.
- A full markdown document.
- The full structured card list.

That means the agent must serialize nearly the entire deck multiple times across separate tool calls:

- Once for validation.
- Once for evaluation.
- Once for rendering.
- Once for saving.

Each call repeats the same 100-card structure. This is token-expensive, slow to transmit, and easy to get wrong. It also creates friction when the deck has already been resolved and validated, because there is no short candidate handle that can be reused in later calls.

The save failure made this worse. The first save attempt omitted required `brief` and `markdown` fields, so I had to resend the complete card payload with those fields added.

## Suggested Tool Improvements

The largest improvement would be a stateful candidate workflow.

Useful additions:

- `create_deck_candidate_draft` to store a candidate once.
- `update_deck_candidate_cards` to apply additions and cuts.
- `evaluate_saved_candidate` by candidate ID.
- `render_saved_candidate` by candidate ID.
- `save_candidate_revision` by candidate ID.
- `find_cards_by_tag` with filters for color identity, legality, card type, mana value, and budget flags.
- `find_synergy_by_card` to return cards sharing or complementing a card's tags.
- `analyze_deck_tags` to report tag density, orphan cards, and under-supported themes.
- `analyze_deck_roles` to count ramp, draw, interaction, recursion, self-mill, protection, win conditions, and lands.
- `estimate_budget` or a price-source integration.

If a saved draft ID could flow through validation, evaluation, rendering, and final save, the render/save path would be much faster and less error-prone.

## Overall Assessment

Performance improved from the first pass because I followed the user's advice and used card tags to make the deck more internally coherent. The final list better reflects Mirko's actual mechanics and the surrounding synergy graph.

The main remaining weaknesses are budget uncertainty, weak global tag search, and high-friction render/save payloads.

Overall score for the second pass: 8/10.

The deck-building quality improved, but the tool workflow exposed clear opportunities for both agent instruction updates and skill-level process improvements.
