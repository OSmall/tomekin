---
name: collection-opportunity-discovery
description: Use for open or seeded questions about what Commander/EDH or 60-card Constructed deck directions the imported Collection can support. Resolve the allowed Collection Locations, compare viable Deck Opportunities, explain blockers, and stop before building or saving a full Deck Candidate.
---

# Collection Opportunity Discovery

Use this workflow before construction when the user asks what they can build, wants Collection-supported ideas, or has
only a broad seed such as a card, creature type, mechanic, color, or play pattern. Compose `tomekin-deck-building` for
the Deck Building Brief and tool lifecycle. Load `query-cards` before Collection or tag searches.

Apply the shared method at opportunity-comparison fidelity: explain each activity, advantage mechanism, winning
direction and material support risk without demanding a full candidate graph. Discovery is a decision layer, not construction. Return a compact Deck Opportunity shortlist and wait for the user to
choose or refine a direction. Do not produce, render, or save a full decklist.

Load `deck-shape-methodology` for plan, qualified coverage, whole-contribution tuning and retained reasoning.

## Establish Discovery Context

Require:

- A confirmed Deck Building Brief, including Format, Power Level or Commander Bracket, `playExperience`, budget,
  missing-card tolerance, and combo tolerance. Keep Deck Opportunity ranking priorities in the confirmed working context
  because the current Brief schema has no dedicated field for them.
- Open or seeded intent. A seed constrains discovery but does not prove that the first matching theme is viable.
- Reference status from startup/CLI diagnostics or actionable tool readiness errors.
- An explicit allow-list of Collection Locations when Collection evidence matters.

Keep strength and pilot complexity distinct. For example, “strong casual” may be the Power Level while “approachable for
an intermediate player, with limited bookkeeping” belongs in `playExperience`.

## Resolve The Collection Allow-list Once

Call `list_collection_locations` and inspect its exact locations plus authoritative active import context. Confirm
allowed sources and any protected/excluded locations, excluded identities/Printings/rows, and typed copy restrictions.
Keep the inspectable `collectionAccessPolicy` in the Brief, or use an explicit confirmed policy before a candidate
exists. An empty allow-list permits zero rows. Existing Deck borrowing remains visibly Committed even when allowed.

Use `browse_collection_cards` for actual owned-row/date discovery and exact owned-Printing restrictions. It resolves
UUID plus type/name or exact case-sensitive type/name pairs in the bound snapshot. Repeat the fixed policy/criteria
with `after` for complete bounded traversal; request card-level facts through batched `lookup_cards`. Ask for the user's
changed agreement before widening sources or restrictions. A successful Collection replacement requires scope
reconfirmation; unchanged names do not rebind permission.

For recent-card inspiration follow the coordinator's Recent Source Additions workflow: independently browse unknown
dates unless declined and preserve strict physical-copy eligibility versus wider exploratory assembly. Unknown metadata
never proves a strict restriction. Inspect completion/undated coverage before claiming a scan is complete.

## Discover And Qualify Directions

1. State the decision being supported. Search bounded functional packages or Mana Value bands using `search_cards`,
   native `q`, `unique: "cards"` and explicit typed `select`. Request full text immediately where fit depends on it.
2. Inspect seed facts/tags, validate literal slugs through `browse_tags`, then complement seed/tag snowballing with
   independent functional/Oracle-text searches. Tags and prominence suggest options; facts establish contextual fit.
3. Reuse suitable returned facts and batch only missing shortlist facts through `lookup_cards`. Request scoped summary
   or actual-row copies evidence for inspected examples. Representative provider Printings do not enumerate owned versions.
4. Compare plausible repeatable activities, advantage mechanisms and winning directions, their enabling resources,
   rewards and resilience. Use a compact comparison when useful: decisive facts/qualifications, mana, scoped ownership,
   unresolved needs. Continue where an unresolved gap could materially change the recommendation.

A direction qualifies as a **Deck Opportunity** when it has a plausible repeatable plan and winning direction,
inspected examples of important functions, scoped Collection evidence, and explicit gaps/dependencies. A full deck,
whole-deck Availability proof or exhaustive search is unnecessary. Discovery hits remain transient; assessed options
enter a candidate-owned Deck Card Pool only after contextual contributions are justified, and selection is separate.
Use a useful shortlist justified by the decision and evidence. Report unexplored approaches, incomplete scans and
coverage limits; no fixed quota or universal top-N cutoff establishes sufficiency.

## Evaluate Viability

Compare each direction under the confirmed Brief:

- Format Anchor fit.
- Support density inside the allowed Collection scope.
- Availability and disruption to Existing Decks.
- Cohesion among enablers, payoffs, interaction, card advantage, mana, and win conditions.
- Missing-card burden and budget fit.
- Power and play-experience fit, treating pilot complexity separately from strength.
- Material blockers or fragile dependencies.

Reject or downgrade directions that have a recognizable theme but lack enough functional support. Do not hide missing
early actions, mana support, enablers, payoffs, interaction, actual card advantage, resilience, or a credible way to
win.

## Return The Shortlist

Return useful compared Deck Opportunities. One or zero is valid when the evidence supports no broader shortlist.

For each opportunity state:

1. Format Anchor and functional game plan.
2. Expected play pattern and strength/complexity fit.
3. Strongest Collection support and key packages.
4. Scoped Availability and Missing Card burden.
5. Weakest required package or most important caveat.
6. Recommendation under the Brief's ranking priorities.

If no opportunity is viable, state the specific blockers and offer constrained next moves such as relaxing the
allow-list, increasing missing-card tolerance, changing Power Level, or choosing a nearby plan. Do not force a weak Deck
Candidate.

After the user chooses:

- Hand Commander/EDH to `commander-deck-architecture`.
- Hand Standard, Pioneer, Modern, Legacy, Vintage, Pauper, or Casual 60 to
  `sixty-card-constructed-deck-architecture`.
- If the user instead nominates an Existing Deck for changes, route to the Format's tuning skill.
