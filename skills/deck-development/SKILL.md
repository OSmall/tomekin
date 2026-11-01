---
name: deck-development
description: Use to discover deck directions, build, tune, explain, review, save or resume an MTG Deck Candidate. Route the requested outcome and complete only its authorized work.
---

# Deck development

Reuse this guidance while it remains in context. For a substantial request use the available request checklist, updating it through the final response; simple factual or numerical questions need no checklist or construction workflow. Reuse the established Brief, policy, permissions and evidence. Ask only about material ambiguity, changed constraints or missing authority. Keep Power Level separate from desired play experience. Clarify an absent Format rather than assuming Commander. A temporary location-specific search narrows that search, not the whole-deck Collection Access Policy. Collection imports are read-only evidence.

## Enter at the requested outcome

- **Discovery:** For an open direction or broad seed, investigate actual permitted Collection support, potential anchors, enablers, payoffs and ordinary support. Deepen contenders where uncertainty could change the comparison. Present distinct provisional Deck Opportunities, feasibility and meaningful trade-offs without building each or padding a quota. The user chooses unless selection was delegated.
- **Construction:** A chosen Format Anchor skips discovery. Follow the preparation and construction sequence below; load `commander` or `sixty-card-constructed` for the applicable Format. A materially different direction requires agreement.
- **Tuning:** Read the existing Brief, selection and relevant reasoning. Establish the authorized Addition Pool and diagnose the requested change before proposing paired additions and cuts. Preserve the user's identity, Power Level and play experience unless changed.
- **Explanation:** Inspect the relevant saved state and evidence, explain it and its limitations; do not automatically swap cards.
- **Pool-only research:** Investigate the requested options, preserve selected membership and report assessed alternatives and gaps without finalizing a deck.
- **Direct question:** Answer a Collection or numerical question with the relevant tools and evidence; load `probability-analysis` for modeling or `card-research` for substantial card investigation as needed.

## Prepare a selected direction

1. Inspect the anchor's exact Oracle facts and analyze actions: costs, prerequisites, timing, direct and indirect events, player scope, frequency, useful output, competing plays, vulnerabilities and likely early/middle/later development. Distinguish conditional possibility from reliable output; qualify material rules uncertainty and claim external verification only when performed. Explain proposed Win Routes and obtain the user's agreement to the initial action analysis before saving it.
2. Load `card-research` to investigate exemplars, actual tag meanings, complementary Oracle/property criteria and ordinary support. Retain the mechanism-to-exemplar-to-tag-to-search connection and open uncertainties.
3. Build an initial revisable Deck Plan graph from the preparation: contextual Deck Roles, Win Routes and enables, enhances, supports and competes relationships. Record causal, timing and frequency reasoning alongside graph nodes. Investigate broad permitted Collection support and refine the graph and candidates as evidence warrants; a branch need not be selected to be researched.
4. Compare qualified alternatives and explicitly assess research coverage, including weak and unexplored branches. An ample pool, a full deck or passing checks does not establish sufficient investigation. Preserve exact constraints and seek a preference decision when a material shortfall cannot be resolved.

## Construct and review

Use selected identities, quantities and sections as the authority for role coverage and joint demand; retained alternatives contribute zero. Define role goals and qualified contributions using conditions, costs, timing, repeatability, evidence and competition. Include mana, card advantage, disruption, protection and recovery as appropriate, not only synergy. Use `probability-analysis` for meaningful quantities, access, deadlines and mana trade-offs. Balance reliability with payoffs, amplification and support in finite slots.

For a change, trace all gained and lost functions and indirect dependencies, including a utility land's non-mana uses and modal competition. Read the actual saved result after partial acceptance; reconcile affected rationale, coverage and calculations or retain a valid assessment. When material changes leave `reasoning_review` pending, review current claims and acknowledge `reviewed` in a separate edit using the latest timestamp. Reviewed may honestly record gaps; it is not a strategic quality certificate or a check. Pool-only maintenance leaves unrelated current review and check state intact.

## Save and resume

Create an authorized early candidate with an empty pool and selection when useful; doing so neither chooses an undelegated direction nor runs checks. Save agreed action analysis to `plan.action_analysis_markdown`, then save substantive search preparation to `plan.search_research_markdown` at stage boundaries without re-emitting the analysis. Keep the concise description's Resume note aligned to the latest saved state. Mark an exceptional partial pass incomplete, with remaining work and recovery position. Check the returned timestamp and field presence/size.

On resumption read the actual candidate and Resume note; load missing instructions and traverse each necessary `action_analysis` and `search_research` view until its final page. Summary or a successful save alone is not full recovery. Candidate views use ordered path/value assignments and ordered zero-based text fragments through the final fragment; preserve empty values and containers, reject incomplete/out-of-order sequences, and restart on changed baseline. Repeat fixed selectors and use `next_cursor` until null. Report failed or incomplete traversal honestly.

Edits use the exact latest `expected_updated_at`; omitted fields stay unchanged and explicit null clears a nullable field. After conflict reload and reconcile. If a dispatched write has an unknown outcome, inspect the saved candidate or candidate list and affected records before retrying. Existing authorization covers ordinary progress and stage saves; a materially different result needs authority.

## Finish the requested result

For a completed selected deck, read actual final membership and relevant facts, Brief, strategy, qualified coverage, mana and pending review. Explicitly run applicable `validate_format_legality`, `evaluate_deck_candidate` and joint `check_collection_availability` on the saved candidate and whole Brief policy. Trial checks concern the trial only. Availability's default is a complete aggregate summary; read saved `availability` with `details: "problems"` for affected requirements and detailed witnesses or a Collection Pull List for sourcing. Keep shortages, policy exclusions and uncertainty distinct. Refresh checks when relevant inputs or reference data change.

Explain actual results, evidence, intentional trade-offs, material gaps and research limits. Generate a Portable Decklist with selected quantities/names and necessary Format sections only; put role prose outside it. A Pull List does not move or reserve cards. Finish an explanation, discovery or pool-only request at its own outcome rather than claiming a completed deck.
