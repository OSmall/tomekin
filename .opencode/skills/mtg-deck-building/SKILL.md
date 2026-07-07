---
name: mtg-deck-building
description: Use when building or revising an MTG Deck Candidate with MTG Agent tools, Deck Building Brief confirmation, format-methodology skill loading, validation, rendering, persistence, and imported-Collection awareness.
---

# MTG Deck Building

Use this workflow to coordinate local deck-building through MTG Agent tools. This skill is the canonical source for the
tool lifecycle. Format-specific deck construction methodology belongs in format skills such as
`commander-deck-architecture`.

## Workflow

1. Check `summarize_reference_support`. Missing `oracle_cards`, `all_cards`, or `oracle_tags` blocks local
   deck-building.
2. Draft a best-effort Deck Building Brief from the user's request with `draft_deck_building_brief`.
3. Ask the user to confirm or edit the brief before substantial discovery or full Deck Candidate construction.
4. Load the format methodology skill after the brief is confirmed.
5. Use `query_cards`, `search_card_identity_tags`, and `get_card_identity` to assemble coherent packages, not isolated
   staples. Load the `query-cards` skill before composing non-trivial `query_cards` filters or after validation errors.
6. Resolve proposed final names with `resolve_decklist_cards` before validation or persistence.
7. Validate deterministic format construction with `validate_format_legality`.
8. Run `evaluate_deck_candidate` for aggregate legality, Game Changer, mana curve, land count, and Collection evidence.
9. Revise weak areas for up to three full evaluation passes.
10. Render Markdown and Portable Decklist with `render_deck_candidate`.
11. Save the final candidate with `save_deck_candidate` only after final cards resolve cleanly and caveats are
    represented
    in the Markdown.

## Format Methodology Skills

- For Commander/EDH, load `commander-deck-architecture` after the Deck Building Brief confirms `format: commander` or an
  equivalent Commander/EDH intent.
- If the requested format is unsupported by local tools or no methodology skill exists, say so directly and ask whether
  the user wants a best-effort unsupported build.
- Do not duplicate format-specific construction heuristics here. Keep Commander role-density targets, tag snowballing,
  mana-base heuristics, and win-path methodology in `commander-deck-architecture`.

Deck-building quality bar:

- State a clear game plan and expected play experience.
- Include enough enablers, payoffs, mana support, interaction, card advantage, and resilience for the confirmed brief.
- Use Commander Brackets and Game Changer counts for power language rather than a custom 1-10 scale.
- Treat local Oracle Tags as useful source-backed evidence, not infallible truth.
- Use direct and Inherited Card Identity Tags as first-class package-discovery evidence; follow the format methodology
  skill for tag interpretation.
- Label likely tutors, fast mana, extra turns, mass land denial, stax, prison, or combo risks when local text, tags, or
  annotations support them.
- Use `query_cards` for Card Identity, legality, tag, and Collection card retrieval. Use the `query-cards` skill for
  filter syntax and examples. Use `list_collection_locations` only to discover exact Collection Location names for query
  predicates. Do not treat cards as Missing until Collection evidence has been checked or explicitly marked unavailable.
- Treat category counts, card roles, and package membership as agent scratch analysis or Deck Candidate Markdown unless
  deterministic tools return structured data for them.
- Do not claim support for gameplay simulation, opening-hand analysis, or goldfishing. If those would matter, label them
  as unsupported caveats.
