---
name: deck-development
description: "Deck building: discover directions, construct, tune, explain, review, or save and resume an MTG Deck Candidate. Route by the requested outcome."
---

# Deck development

Reuse instructions, confirmed Briefs, permissions and applicable evidence already in context. For a substantial request, maintain the available request checklist through the final response. Answer simple factual or numerical questions directly with the tools and guidance they need.

## Establish the task

For substantial discovery or fresh construction, reuse a confirmed Brief or draft one and obtain confirmation of its material assumptions. Resolve an absent or ambiguous Format. Keep Power Level separate from desired play experience. Confirm missing Collection Access Policy and missing-card preferences, reusing established choices; a temporary location-specific search narrows that search, not the whole-deck policy. Collection imports remain read-only evidence.

Load `commander` or `sixty-card-constructed` whenever the task needs Format-specific construction rules, strategic assumptions or examples, including discovery, tuning and explanation. Reuse it while it remains in context.

Enter at the requested outcome:

- **Discovery:** Investigate actual permitted Collection support for plausible anchors, enabling actions, payoffs and ordinary support. Deepen contenders where uncertainty could change their comparison. Present distinct provisional Deck Opportunities with feasibility and meaningful trade-offs. Stop at that comparison; the user chooses a direction unless selection was delegated.
- **Construction:** A chosen Format Anchor skips discovery. Follow the preparation and construction stages below. Agree a materially different direction before pursuing it.
- **Tuning:** Read the existing selection and relevant reasoning, establish the authorized Addition Pool, and diagnose the requested change. An open review needs a concise confirmed tuning Brief; a contextualized review of user-nominated cards can proceed with stated material assumptions. Propose paired additions and cuts with their aggregate effects. Preserve the established identity, Power Level and play experience unless changed. Use the stages below for missing analysis and affected work, preserving valid unaffected evidence. Apply the saving rules below before persisting a revision.
- **Explanation:** Read the relevant saved state and evidence, then explain its choices, dependencies and limitations. Finish with the explanation unless edits were authorized.
- **Pool-only research:** Use `card-research` to assess alternatives and gaps while preserving selected membership. Finish with the requested options rather than deck finalization.
- **Direct question:** Use the relevant factual tools; load `card-research` for substantial investigation or `probability-analysis` for numerical modeling.

For recent-addition requests, use the date and copy-eligibility rules below.

## Prepare a selected direction

1. **Analyze actions.** Inspect the anchor's exact Oracle facts. Explain costs, prerequisites, timing, direct and indirect events, player scope, frequency, useful output, competing plays and vulnerabilities. Walk a representative opening, productive middle turn and later route to winning; explain how required cards are accessed and what happens without a key permanent or zone. Qualify material rules uncertainty, and claim external verification only when performed. Finish with an initial action analysis and plausible Win Routes that the user agrees before that analysis is saved.
2. **Prepare searches.** Follow the preparation steps in `card-research`: connect each material mechanism and ordinary support need to Research Exemplars, observed tag meanings, complementary criteria and open questions. Save the agreed action analysis and substantive search preparation at their stage boundaries using the rules below. The search map must explain how the intended actions will be investigated before broad selection research begins.
3. **Form and investigate the plan.** Turn the prepared mechanisms into an initial revisable Deck Plan graph. A **Deck Role** is a function in this deck's plan; a **Win Route** is an intended way to win. Connect roles and routes using enables, enhances, supports and competes relationships, recording the supplied resource or event, timing and limits. Continue with `card-research`'s investigation steps across the permitted Collection; refine the graph as evidence develops. Finish when material branches have been traversed and promising alternatives compared, with weak, prohibited or unexplored branches explicitly recorded. A researched branch need not be selected.

## Construct and review

1. **Choose a preliminary selection.** Select actual identities, quantities and sections from assessed options. Define role goals and qualified Card Contributions: why a card performs a role here, with costs, conditions, timing, repeatability and supporting evidence. Account for ordinary mana, card advantage, disruption, protection and recovery alongside synergy. Selected membership supplies quantities and coverage; retained alternatives contribute zero.
2. **Solve quantities and mana together.** Use `probability-analysis` for material access, deadline and mana decisions. Compare achievable configurations and the enablers, payoffs, enhancers or support displaced by each. Inspect land and color access, untapped sources, functional curve, recurring payments and shared resources against the intended turns. A mode, mana payment or sacrifice spent on one function may be unavailable for another. Finish with a coherent selection and reasoned coverage assessments, resolving material shortfalls within the Brief or seeking the user's decision on a genuine compromise.
3. **Reconcile the actual saved result.** For every change, trace all gained and lost functions and indirect dependencies, including a utility land's non-mana uses. After partial acceptance, read the actual saved selection and update affected rationale, coverage and calculations; retain evidence only while its inputs remain applicable. When `reasoning_review` is pending, review current claims and acknowledge `reviewed` in a separate edit using the latest timestamp. Reviewed means current reasoning, which may honestly record gaps. Pool-only maintenance preserves unrelated selected-deck review and check state.

## Save and resume

1. Create an authorized early candidate for the chosen direction, even with an empty pool and selection. For tuning, explain the resulting changes and persistence target; existing explicit authorization counts, otherwise obtain candidate-level agreement. Update a saved candidate in place unless a copy/variant was requested. An imported Existing Deck remains unchanged; an accepted revision becomes a new Deck Candidate.
2. Save agreed action analysis to `plan.action_analysis_markdown`, then substantive search preparation to `plan.search_research_markdown`. Each field replaces a whole document independently; preserve accepted analysis when saving preparation. Keep the Plan description concise with a **Resume** section recording the actual current stage, unfinished work and next action. Normal saves follow substantial stages rather than every finding; ordinary authorized progression and saves need no repeated approval.
3. Before a substantial pass use available context-capacity information; compact before a pass that will not fit when supported. If unexpectedly interrupted, save an explicitly incomplete checkpoint with a matching Resume note and safe recovery position. Verify each save's returned candidate timestamp and research field presence/size.
4. Use the exact latest `expected_updated_at`. Omitted fields stay unchanged; explicit null clears a nullable field. After conflict, reload and reconcile. After a dispatched write with unknown outcome, inspect the candidate or candidate list and affected records before retrying.
5. On resumption, read the actual candidate and Resume note, recover missing applicable instructions, and traverse each necessary `action_analysis` and `search_research` view through its final page. Repeat fixed selectors and forward the real `next_cursor` as `after` until null. A conversation summary or field-presence indicator alone is insufficient recovery.
6. Reconstruct candidate views from ordered versioned path/value assignments and text fragments. Preserve nulls and empty containers; establish each fragmented string at index zero and append successive indexes through its explicit final fragment. Concatenate ordered report/decklist strings. Reject incomplete or out-of-order fragments, and restart on changed baseline or unsupported representation. Retain delivered facts and safe recovery positions after partial/error responses, reporting incomplete recovery until finished.

## Recent additions

Establish the user's timezone and resolve relative dates to a UTC interval. Distinguish strict copy eligibility from exploratory inspiration in the Brief: strict eligibility requires matching policy date bounds, while inspiration may use other permitted copies of discovered identities. Browse matching dated rows and, unless declined, separately inspect unknown-date rows within the same scope. Label dates unknown and report unchecked coverage. Refresh and reconfirm Collection scope after successful Collection replacement; failed imports preserve the active policy.

## Finish the requested result

For a completed selected deck:

1. Read final saved membership and relevant facts, Brief, strategy, qualified coverage, mana and reasoning-review state. Resolve material shortcomings or obtain agreement; preserve exact constraints.
2. Use `get_format_constraints` for construction rules. Resolve material local reference misses and legality discrepancies, then explicitly run applicable `validate_format_legality`, `evaluate_deck_candidate` and joint `check_collection_availability` on the saved candidate under the whole Brief policy. Trial results concern only the trial. Refresh checks when relevant inputs or reference data change.
3. Inspect Availability's complete aggregate summary. Read saved `availability` with `details: "problems"` for affected requirements; use detailed witnesses or a Collection Pull List when sourcing is needed. Distinguish Missing Cards, policy shortfalls and uncertainty. A Pull List guides assembly without moving or reserving cards.
4. Explain actual results, evidence, intentional trade-offs, material gaps and research limits. Generate a Portable Decklist containing selected quantities/names and necessary Format sections only; keep role prose outside it.

Discovery, explanation and pool-only requests finish at their own outcomes. A full list, a large pool, a save or passing checks alone does not establish strategic completion.
