---
name: commander-deck-architecture
description: Use after a Commander/EDH Deck Building Brief is confirmed to architect a synergistic Commander Deck Candidate with Tomekin tools, tag-aware package discovery, role-density targets, and supported validation passes.
---

# Commander Deck Architecture

Use this methodology after the `tomekin-deck-building` skill has confirmed a Commander/EDH Deck Building Brief. This skill
is
the canonical Commander construction method. It does not replace `tomekin-deck-building` for tool orchestration, legality
validation, rendering, or persistence.

## Core Principle

Build a Commander deck as an engine with structural support, not as 100 individually good cards. Every candidate should
have a clear format anchor, coherent packages, enough mana, enough cards, enough answers, and credible win paths that
fit
the confirmed play experience.

## 1. Commander And Table Fit

Start from the commander as the format anchor.

- Use `get_card_identity` on the commander before building the 99.
- Confirm the commander's Color Identity, Commander legality, rules text, Card Identity Tags, EDHREC rank, and Game
  Changer status.
- Extract the commander's visible mechanics and hidden keywords from rules text, such as `enters`, `attacks`,
  `sacrifice`, `dies`, `leaves the battlefield`, `draw`, `discard`, `cast from graveyard`, or `modified`.
- Respect the confirmed Commander Bracket, combo tolerance, budget target, missing-card tolerance, and exclusions.
- Avoid commanders or packages that create oppressive, archenemy-on-turn-one play unless the brief explicitly asks for
  that experience.

Rule of cool matters. If the user chose a commander because it excites them, optimize around that appeal instead of
silently replacing the identity with generic goodstuff.

## 2. Tag Snowballing And Synergy Discovery

Use tags as first-class evidence for synergy discovery.

- Inspect the commander's `tags.direct` and `tags.inherits` from `get_card_identity` or `query_cards` with
  `include.tags: true`.
- `Inherited Card Identity Tag` is the canonical term for what may casually be called an umbrella, ancestor, or broader
  tag.
- Treat direct and inherited tags as useful discovery signals. Inherited Card Identity Tags are especially important for
  finding adjacent cards in the same functional family.
- Inherited tag weight carries the strength of the supporting specific Card Identity Tagging. If multiple specific
  taggings support the same inherited tag, the strongest supporting weight is used.
- Prefer stronger tag weights in this order: `very_strong`, `strong`, `median`, `weak`.
- Use tag snowballing: find a promising card, inspect its direct and inherited tags, then search high-signal tags to
  find
  similarly promising cards.
- Prefer cards that overlap the commander or package on multiple tags, text cues, or functional roles.
- Prefer internal affinity: cards in the 99 should work with each other even when the commander is unavailable.

Use the `query-cards` skill before composing non-trivial `query_cards` filters.

Tag-query rules to remember:

- Use `search_card_identity_tags` to resolve tag IDs before querying.
- Use `hasTagInHierarchy` for normal concept matching so an Inherited Card Identity Tag can match descendant taggings.
- Use independent `hasTagInHierarchy` predicates for multi-concept searches such as draw plus sacrifice.
- Use `withTagging` when tag identity and tag metadata must apply to the same tagging row, such as strong card draw.
- Do not invent ranked weight comparisons. If strength matters, use exact values such as
  `tag.weight in ["very_strong", "strong"]`.

## 3. Themed Core And Mana-Value Rubric

Build an initial themed pool before finalizing structural slots.

- Assemble roughly 40 on-theme candidates around the commander's mechanics, tags, and adjacent packages.
- Include enablers, payoffs, engines, recursion, protection, and closers where the theme needs them.
- Avoid piles of payoffs with too few enablers.
- Avoid cards that are merely legal in the Color Identity but do not advance the plan.

Use this mana-value rubric for themed cards:

- 6+ mana: must dramatically alter the game state or provide near-insurmountable advantage within one turn.
- 5 mana: must immediately provide significant advantage or be a threat that runs away with the game if unanswered.
- 4 mana: must be highly synergistic, push the engine into overdrive, or set up the next few turns perfectly.
- 1-3 mana: must be efficient setup, an engine piece, protection, interaction, or recurring value.

When cutting, start from the top of the curve. If two cards compete for one slot, prefer higher internal affinity, then
stronger tag evidence, then lower mana value.

## 4. Card Advantage

Card advantage keeps the deck from stalling.

- Target at least 12 dedicated card-advantage pieces.
- For high-functioning casual and stronger decks, prefer 16-17 when the strategy and brief support it.
- Prefer card advantage that overlaps with the deck's mechanics or tags.
- Prioritize effects that net positive cards. Looting without net card gain is selection, not card advantage, unless the
  deck converts discard or graveyard setup into real advantage.
- Aim for about 8 card-advantage effects at mana value 3 or less.
- Reserve higher-mana card-advantage slots for explosive refill effects or engine pieces that can draw many cards.

## 5. Ramp And Mana Acceleration

Ramp lets the deck execute its plan ahead of normal land drops.

- Target at least 10 standard ramp pieces: mana rocks, mana dorks, land tutors, cost reducers, or equivalent effects.
- Prefer 1-mana ramp over 2-mana ramp, and 2-mana ramp over 3-mana ramp, unless synergy strongly justifies the slower
  card.
- Add 2-4 explosive ramp pieces when they fit the strategy and Commander Bracket, such as burst treasures, rituals, or
  mana doublers.
- Avoid explosive ramp that pushes the deck above the confirmed play experience unless the user wants that.

## 6. Interaction, Protection, And Board Wipes

Interaction stops opponents from winning. Protection keeps the deck's own engine alive.

- Target roughly 10 pieces of targeted interaction and protection.
- Target 2-4 board wipes.
- Count thematic incidental interaction when it is real and reliable, such as a synergistic creature that removes an
  artifact on entry.
- At lower Commander Brackets, thematic interaction can be acceptable.
- At higher Commander Brackets, prioritize low mana value, instant speed, and flexibility.
- Include commander protection when the plan depends heavily on the commander being in play.

## 7. Mana Base And Final Structure

Default to 38 lands unless the confirmed brief, curve, ramp density, and evaluation results justify a different number.
Missing early land drops is a major consistency failure.

Use this structural skeleton as a starting point:

- 1 commander.
- 13 card-advantage pieces.
- 12 ramp pieces.
- 12 interaction, protection, and board-wipe pieces.
- 38 lands.
- 24 themed core cards.

The skeleton is a deck-building rubric, not a legality rule. Adjust it deliberately when the commander, curve, or brief
requires it, and explain the trade-off in the Deck Candidate Markdown.

## 8. Static Win-Path Check

True goldfishing is not supported yet. Do not claim to simulate opening hands, play sequencing, or turn-by-turn
gameplay.

Instead, run a static win-path check:

- Identify 3-4 credible closers or win paths.
- Check that those closers use the board states the deck naturally creates.
- Check that at least some closers work without the commander.
- If the deck can accrue value but cannot end games, replace low-impact themed cards with stronger closers.
- Flag rules-sensitive, combo-sensitive, or power-sensitive win paths rather than presenting them with unsupported
  certainty.

## 9. Evaluation Pass

Before final output, hand the candidate back to the `tomekin-deck-building` orchestration workflow.

Required checks outside this methodology skill:

- Resolve final names with `resolve_decklist_cards`.
- Validate Commander construction with `validate_format_legality`.
- Run `evaluate_deck_candidate` for legality, Game Changers, mana curve, land count, and Collection evidence.
- Revise weak areas for up to three full evaluation passes.
- Render and save only after the final list resolves cleanly and caveats are represented in Markdown.

## Final Explanation Requirements

The final Deck Candidate explanation should state:

- Game plan.
- Commander Bracket and play experience fit.
- Structural counts for lands, ramp, card advantage, interaction/protection/wipes, themed core cards, and closers.
- Key tag packages, including high-signal direct and inherited tags used for discovery.
- Internal affinity: how the 99 functions when the commander is unavailable.
- Important inclusions and meaningful exclusions or cuts.
- Unsupported areas, such as live budget validation or goldfishing, when relevant.
