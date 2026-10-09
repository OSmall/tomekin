# Focused revision prompt for the Commander source report

Use this in the Gemini chat that generated the report, with the current report and original sources available. Preserve
the submitted report as research provenance; this prompt requests a corrected version or evidence supplement.

```text
Audit and revise the Commander Deck-Building Source Report against the original source content. Do not treat your previous report or its coverage matrix as evidence that a source claim is correct.

Sources:
- https://www.youtube.com/watch?v=OSNV6224cHg
- https://www.youtube.com/watch?v=PUrQpnQ7bi8
- https://www.youtube.com/watch?v=xZvaBPrF56E
- https://www.youtube.com/watch?v=K5UGydfRKBw (additional source used in the report; identify it explicitly as such)

First state what substantive content you can actually access for each video. Metadata/chapter lists alone cannot verify advice, numeric targets, card interactions, or probabilities. If substantive access fails, mark the affected claims unverified; do not invent source content or exact timestamps. Preserve approximate timestamps as approximate until checked.

Produce a correction/evidence table. For each material claim below, give: original claim; source and timestamp/range or identifiable section; a concise paraphrase of the actual supporting advice; relevant conditions/exceptions; evidence status (supported, overstated, contradicted, or unverified); and corrected wording. Mark cross-source synthesis separately from creator statements. Do not force a correction merely because it was requested: if the source really gives an absolute recommendation, attribute and scope it rather than silently softening what the creator said.

Check these points specifically:
1. Numeric defaults: 38 lands, 12 card-advantage cards, 10 ramp cards, 12 targeted disruption, 6 mass disruption, and about 30 plan cards. Identify which source supplies each number, the intended deck/table context, counting conventions, MDFC/landcycler treatment, and exceptions. Check claims about rituals, selection, multi-target effects, and protection. Resolve the apparent tension between 'non-negotiable' lands and later land-count exceptions.
2. Sidisi probability example: establish exactly what the 53% and over-60% values measure, how many cards/turns are considered, the deck composition, mulligan assumptions, and relevant coloured-mana/sequencing assumptions. Distinguish what the speaker reports from independently reproduced mathematics. If assumptions are missing, preserve the example as an unverified illustration without claiming statistical necessity or importing an agent simulation capability.
3. Engine ratios and commander contributions: verify claims that generators must significantly outnumber amplifiers, commanders require drastic changes, or the 99 should be almost entirely generators. Distinguish worked-example recommendations from general principles and preserve commander dependence and interaction risks.
4. Game-plan structure: verify the 1–2-step recommendation and its scope. Distinguish a compact explanation from the number of actual actions/dependencies or payoff layers. Check whether multiple complementary win routes or themes are ruled out, or whether the concern is conflicting/unsupported plans.
5. Tuning: verify the source behind 'never cut support' and 'always swap within the exact same functional category.' If these are your synthesis, explain them as proposals rather than source facts. Consider whole-deck deficits/surpluses, overlapping contributions, protected user preferences, and justified restructuring.
6. Role overlap: separate role membership from effective coverage. A modal land/removal card offers competing uses; assigning two roles does not automatically provide two simultaneous full contributions. An artifact-removing creature is an engine enabler only in an appropriate deck context. Verify or qualify the categorical rejection of all six-mana interaction.
7. Generic versus synergistic support: verify whether the sources actually reject one another's approach, or emphasize different trade-offs. Quote no invented disagreement. Distinguish preference for on-plan support from a universal rejection of efficient generic cards.
8. Goldfishing: retain accurately attributed advice for human deck builders, but explicitly separate it from Tomekin's supported static review. Tomekin cannot simulate games, opening hands, or play sequencing. Do not turn a human playtesting recommendation into a mandatory tool action or a claim that the agent has performed it.
9. Card and tag examples: verify names/interactions where possible and label unresolved cases. Do not present unverified tag slugs as catalogue entries. Ordinary-language role descriptions are acceptable when tag verification is unavailable.

The public V2 chapter list includes 'Exceptions for Mass Disruption' at 1:05:17, which the report omitted. Investigate that section. V4 also includes 'Hyper-Focused Game Plan' at 27:15; investigate its substantive advice before making focus an absolute rule. Chapter headings identify topics to review, not enough evidence to infer their recommendations.

Then repair the report's completeness and organization:
- For each construction/tuning step, identify required information, concrete actions, outputs, decisions, and reasons to revisit the step. Preserve uncertainty and evidence limits.
- Explain relationships between engine, support, packages, and win routes. Record conditions, timing, reliability, modal competition, and rationale for deliberate template deviations without inventing universal scores or a storage schema.
- Separate desired role coverage from an assessment of the current card list. Explain what must be remembered to review a swap, commander change, or changed card/tag evidence. Preserve package definitions and per-card rationale as possible information needs, not a decided persistence contract.
- Identify important lessons not covered by the prior report, including relevant actual sections of the fourth video. Map source sections/lessons to report sections, with omissions and access gaps; a table saying 'Yes' for entire videos is not an evidence audit.
- Correct internal references, including the workflow's pointer to the generic/synergistic support discussion.
- Do not delete uncertainty or qualifications merely to shorten the report. Avoid repetition rather than removing substantive reasoning.

Return the correction/evidence table followed by a complete corrected Markdown report. If the source evidence remains unavailable, return an explicit evidence-gap list and the precise material needed, alongside only the portions you can support. Keep all source statements distinguishable from your synthesis. Do not claim that model storage, product rules, or numeric acceptance thresholds have been decided.
```
