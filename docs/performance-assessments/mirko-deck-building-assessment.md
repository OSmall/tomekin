# Mirko Deck Building Performance Assessment

## Context

The user wanted a fun, affordable two-color Commander deck. After an interview, the brief became a ~$100 Dimir deck at upgraded-precon power, with a high-synergy control/value playstyle that avoids oppressive patterns and early archenemy pressure. The selected commander was Mirko, Obsessive Theorist.

## Process Used

1. Loaded the `mtg-deck-building` skill because the task matched local Commander deck construction.
2. Checked local MTG reference readiness with `summarize_reference_support`.
3. Interviewed the user for budget, power level, colors, playstyle, oppressiveness tolerance, complexity, and win preference.
4. Drafted a Deck Building Brief around $100, Dimir, upgraded-precon power, high-synergy control, and non-oppressive gameplay.
5. Suggested commanders using local card identity lookups and card knowledge: Nymris, Vohar, Mirko, Ertai, and Satoru.
6. After the user chose Mirko, assembled a 100-card candidate manually around surveil, graveyard setup, ETB creatures, reanimation, and light control.
7. Resolved the decklist with `resolve_decklist_cards`.
8. Extracted resolved card identity IDs using an `explore` subagent because the resolution output was large and truncated.
9. Validated Commander legality with `validate_format_legality`.
10. Evaluated the candidate with `evaluate_deck_candidate`.
11. Rendered a portable decklist with `render_deck_candidate`.

## Tools Used

- `mtg-agent_summarize_reference_support`
- `mtg-agent_draft_deck_building_brief`
- `mtg-agent_search_card_identities`
- `mtg-agent_search_card_identity_tags`
- `mtg-agent_get_card_identity`
- `mtg-agent_resolve_decklist_cards`
- `task` with the `explore` subagent
- `mtg-agent_validate_format_legality`
- `mtg-agent_evaluate_deck_candidate`
- `mtg-agent_render_deck_candidate`
- `todowrite`

## Evaluation Used

The formal tool evaluation checked Commander legality, Game Changer count, land count, mana curve, and collection status.

Results:

- Commander legality: legal
- Game Changers: 0
- Land count: 36
- Collection status: empty collection; every card is a Missing Card

The qualitative evaluation checked whether the deck supported Mirko's text, had enough surveil and self-mill effects, contained enough low-power creatures worth recurring, used control tools without becoming oppressive, and had fair win conditions.

## Tooling Assessment

The available tools were mostly sufficient for local Commander construction. The strongest tooling covered local Scryfall-style card identity data, Commander legality validation, Game Changer detection, mana curve and land-count evaluation, and stable decklist rendering.

Weak or missing tooling:

- No live price validation, so the ~$100 budget was not actually verified.
- No EDHREC/package recommendation tool for budget Mirko staples.
- Semantic card search was weak; some commander and archetype searches returned no useful results.
- No simulated gameplay, goldfishing, or opening-hand analysis.
- No automated category balance report for ramp, card draw, removal, recursion, surveil enablers, and finishers.
- The render tool required a specific schema and did not capture richer notes unless supplied in the expected shape.

## Expert Behavior Assessment

The process partially matched expert deck-building behavior.

Expert-aligned behavior:

- Interviewed before prescribing.
- Converted user preferences into a concrete deck brief.
- Avoided notorious oppressive Dimir patterns.
- Recommended commanders that matched the user's desired power and table vibe.
- Built around commander-specific synergy rather than generic UB goodstuff.
- Included overlapping plans: surveil, graveyard setup, reanimation, ETB value, fair drain, and evasive combat.
- Validated legality instead of assuming the list was legal.

Gaps from expert behavior:

- Did not verify actual card prices, which is critical for a $100 budget deck.
- Did not present a categorized deck skeleton before finalizing.
- Did not explicitly count functional categories like ramp, draw, removal, surveil enablers, reanimation targets, and finishers.
- Did not ask whether the user preferred more classic control or more graveyard creature engine after choosing Mirko.
- Did not compare multiple Mirko build directions, such as surveil tempo, reanimator-control, detective/value, and low-power creature toolbox.
- Some card choices may be clunky or under-optimized without a later price and role-density pass.

## What Went Well

- Good interview-to-brief translation.
- Strong commander recommendation for the user's constraints.
- Coherent Mirko deck identity.
- Legal deck with correct size and no Game Changers.
- Avoided deterministic infinite combo focus.
- Kept the list closer to upgraded-precon than high-power Dimir.
- Included fair win paths instead of hard locks.
- Used local validation rather than relying only on intuition.

## Areas For Improvement

- Verify budget with live pricing or ask permission to use web pricing sources.
- Produce a category breakdown before presenting the final list.
- Run a stricter expert pass on card quality and role density.
- Replace clunky surveil cards with stronger budget enablers where possible.
- Add more explicit protection for Mirko if he is central to the deck.
- Better distinguish control from reanimator value, because Mirko naturally pushes toward value recursion more than draw-go control.
- Learn tool input schemas faster and avoid repeated failed calls.
- Capture rendered deck notes, game plan, and synergies through the render tool rather than only in final prose.

## Overall Assessment

Performance: 7/10.

The deck was legal, coherent, likely fun, and aligned with the user's stated vibe. The main weakness was not verifying the $100 budget or deeply optimizing the final 99 through price checking and role-count analysis. The next expert-level step would be a budget audit plus category tuning pass.
