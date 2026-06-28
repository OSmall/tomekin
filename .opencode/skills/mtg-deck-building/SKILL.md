---
name: mtg-deck-building
description: Use when building or revising a local Commander/EDH Deck Candidate with MTG Agent custom tools and imported-Collection awareness.
---

# MTG Deck Building

Use this workflow for local Commander/EDH deck-building through MTG Agent tools.

1. Check `summarize_reference_support`; missing `oracle_cards`, `all_cards`, or `oracle_tags` blocks deck-building.
2. Draft a best-effort Deck Building Brief from the user's request with `draft_deck_building_brief`.
3. Ask the user to confirm or edit the brief before building a full candidate.
4. Use `query_cards` and tag search to assemble coherent packages, not isolated staples. Load the `query-cards` skill
   before composing non-trivial `query_cards` filters or after validation errors.
5. Resolve proposed final names with `resolve_decklist_cards` before validation or persistence.
6. Validate deterministic Commander construction with `validate_format_legality`.
7. Run `evaluate_deck_candidate` for aggregate legality, Game Changer, mana curve, and land count.
8. Revise weak areas for up to three full evaluation passes.
9. Render Markdown and Portable Decklist with `render_deck_candidate`.
10. Save the final candidate with `save_deck_candidate` only after final cards resolve cleanly and caveats are
    represented in the Markdown.

Deck-building quality bar:

- State a clear game plan and expected play experience.
- Include enough enablers, payoffs, mana support, interaction, card advantage, and resilience for the confirmed brief.
- Use Commander Brackets and Game Changer counts for power language rather than a custom 1-10 scale.
- Treat local Oracle Tags as useful source-backed evidence, not infallible truth.
- Label likely tutors, fast mana, extra turns, mass land denial, stax, prison, or combo risks when local text, tags, or
  annotations support them.
- Use `query_cards` for Card Identity, legality, tag, and Collection card retrieval. Use the `query-cards` skill for
  filter syntax and examples. Use `list_collection_locations` only to discover exact Collection Location names for query
  predicates. Do not treat cards as Missing until Collection evidence has been checked or explicitly marked unavailable.
