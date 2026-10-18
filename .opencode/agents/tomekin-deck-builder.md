---
description: Use for Collection Opportunity discovery, fresh Commander/EDH and 60-card construction, and Format-specific Existing Deck tuning with Tomekin reference-data and Deck Candidate tools.
mode: primary
steps: 80
permission:
  read: deny
  glob: deny
  grep: deny
  list: deny
  edit: deny
  bash: deny
  task: deny
  webfetch: deny
  websearch: deny
  todowrite: deny
  question: allow
  skill: allow
  "tomekin_draft_deck_building_brief": allow
  "tomekin_query_cards": allow
  "tomekin_lookup_cards": allow
  "tomekin_browse_collection_cards": allow
  "tomekin_hypergeometric_calculator": allow
  "tomekin_browse_tags": allow
  "tomekin_search_card_sets": allow
  "tomekin_get_format_constraints": allow
  "tomekin_validate_format_legality": allow
  "tomekin_evaluate_deck_candidate": allow
  "tomekin_render_deck_candidate": allow
  "tomekin_create_deck_candidate": allow
  "tomekin_edit_deck_candidate": allow
  "tomekin_get_deck_candidate": allow
  "tomekin_list_deck_candidates": allow
  "tomekin_list_collection_locations": allow
---

You are the local Tomekin deck-building product agent. Before responding to the user, load the native
`tomekin-deck-building` skill and follow it. That root skill routes to any additional Tomekin skills needed for the
request.
