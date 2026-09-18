---
name: collection-opportunity-discovery
description: Use for open or seeded questions about what Commander/EDH or 60-card Constructed deck directions the imported Collection can support. Resolve the allowed Collection Locations, compare viable Deck Opportunities, explain blockers, and stop before building or saving a full Deck Candidate.
---

# Collection Opportunity Discovery

Use this workflow before construction when the user asks what they can build, wants Collection-supported ideas, or has
only a broad seed such as a card, creature type, mechanic, color, or play pattern. Compose `tomekin-deck-building` for
the Deck Building Brief and tool lifecycle. Load `query-cards` before Collection or tag searches.

Discovery is a decision layer, not construction. Return a compact Deck Opportunity shortlist and wait for the user to
choose or refine a direction. Do not produce, render, or save a full decklist.

## Establish Discovery Context

Require:

- A confirmed Deck Building Brief, including Format, Power Level or Commander Bracket, `playExperience`, budget,
  missing-card tolerance, and combo tolerance. Keep Deck Opportunity ranking priorities in the confirmed working context
  because the current Brief schema has no dedicated field for them.
- Open or seeded intent. A seed constrains discovery but does not prove that the first matching theme is viable.
- Current reference support from `summarize_reference_support`.
- An explicit allow-list of Collection Locations when Collection evidence matters.

Keep strength and pilot complexity distinct. For example, “strong casual” may be the Power Level while “approachable for
an intermediate player, with limited bookkeeping” belongs in `playExperience`.

## Resolve The Collection Allow-list Once

Call `list_collection_locations` and state the exact allowed `(locationType, locationName)` pairs in the confirmed
working context. Collection Location names are exact and case-sensitive.

Translate that allow-list into one positive Collection predicate and copy it unchanged into every Collection query:

- Require `collection.quantity > 0`.
- When all allowed names are unique, use `collection.locationName in [...]`.
- When a name exists under more than one location type, preserve the intended pairs with an `or` of scoped
  `(collection.locationType, collection.locationName)` branches.
- Wrap complex location logic and quantity in one `withCollectionCard` so they apply to the same owned row scope.

The tool has no hidden active policy. A Collection query that omits the confirmed allow-list is invalid workflow usage:
discard it and retry with the full scope. Do not widen the scope merely because a promising card exists elsewhere.

## Discover Broad Directions

Use bounded searches to find clusters of Collection support without requesting all detail at once.

1. Query compact Card Identity and scoped quantity results by Format, seed, color constraints, tag concept, functional
   package, or Mana Value band. Prefer limits of 20-50 per discovery query.
2. Resolve relevant tag IDs with `search_card_identity_tags`; use direct and Inherited Card Identity Tags as evidence,
   not as automatic Deck Roles.
3. Form candidate directions from repeated overlap among Format Anchors, enablers, payoffs, mana support, interaction,
   card advantage, resilience, and credible win conditions.
4. Fetch full tags or Collection Card rows only for high-signal cards in shortlisted directions. Do not request
   `include.tags: true` and `include.collectionCards: true` across a broad result set.

Do not equate a broad theme with a game plan. Refine each direction until it states:

- how it gets ahead or survives;
- what resource or board state it develops;
- how it converts that state into a win; and
- which opposing actions most directly interrupt it.

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

Return up to three viable Deck Opportunities. When the request is open, prefer two or three genuinely distinct
directions, but never pad the shortlist: one or zero is valid.

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
