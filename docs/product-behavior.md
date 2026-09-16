# Product Behavior

This document is the durable contract for Tomekin's current user-observable behavior. Product promise and scope belong
in [`product-scope.md`](./product-scope.md); domain terms belong in the [glossary](../CONTEXT.md); persisted records
belong in [`data-model.md`](./data-model.md); Card Query semantics belong in [`card-query.md`](./card-query.md); and
verification policy belongs in [`testing.md`](./testing.md).

## Supported Routes

Tomekin supports three distinct ways to reach or revise a Deck Candidate.

### Restricted interactive Pi session

On macOS arm64, `bun run tomekin` starts Pi through the inherited terminal using a persistent clone-local profile at
`.data/pi`. Tomekin verifies the pinned Pi v0.85.1 standalone artifact's checksum and reported version before it runs;
its separate clone-local runtime cache contains only Tomekin-owned artifacts. The default Tomekin database remains
`.data/tomekin.sqlite`, and `TOMEKIN_DB_PATH` remains available for an isolated session.

The session exposes exactly the 15 Tomekin Agent Tools, `load_methodology`, and Pi's interactive `ask_user` tool.
Before every agent turn, Tomekin appends its checked-in product bootstrap to Pi's normal system prompt. The bootstrap
identifies Tomekin's collection-first deck-building role, states its restricted authority, and instructs the agent to
load `tomekin-deck-building` before product-tool use. Core-owned Zod input contracts supply tool argument affordance;
Card Query preserves its structured validation diagnostics for nuanced semantic rules. Expected failures are actionable
results, unexpected errors are sanitized, and model-visible output is bounded. `load_methodology` accepts only reviewed
committed Tomekin entries. The profile
loads only the reviewed `pi-ask-user@0.15.0` extension entry point and no bundled skills, prompts, or themes. Pi
login, settings, conversations, and recovery remain Pi-owned within the clone-local profile. Unsupported platforms and failed artifact verification
fail before the session begins.

### Collection Opportunity discovery through construction

For an open request such as “what can I build?” or a broad seed that still needs comparison, Tomekin:

1. checks that local Scryfall reference data is ready;
2. drafts a Format-specific Deck Building Brief and asks the user to confirm or edit it;
3. resolves an exact allow-list of Collection Locations when Collection evidence matters;
4. searches the allowed Collection and local reference data for viable directions;
5. returns at most three ranked Deck Opportunities, without padding a weak shortlist;
6. waits for the user to choose or refine a direction; and
7. routes the selected opportunity to the matching Commander/EDH or 60-card construction method.

A Deck Opportunity shortlist is transient analysis. The current tools do not save Deck Opportunities. Discovery stops
before producing or saving a full decklist.

If no direction is viable, Tomekin reports the specific blockers and offers constrained next moves, such as changing
the Format Anchor or Power Level, relaxing the Collection allow-list, or increasing missing-card tolerance. It does not
silently force a weak Deck Candidate. If the user explicitly proceeds despite the blockers, the result is labelled as
compromised and explains why.

### Direct construction from a confirmed Brief

When the user already supplies a sufficiently specific Format Anchor or deck direction, Tomekin may proceed directly
from a confirmed Deck Building Brief to fresh construction. A Deck Opportunity is a comparison and selection layer, not
a mandatory persisted intermediate.

Commander/EDH construction requires a confirmed commander or selected Deck Opportunity. Standard, Pioneer, Modern,
Legacy, Vintage, Pauper, and Casual 60 construction requires a selected Deck Opportunity or specific Format Anchor.

### Existing Deck or Deck Candidate tuning

Tuning starts from an imported Existing Deck or a saved Deck Candidate and produces a Deck Change Proposal. The proposal
contains paired additions and cuts, the applicable Addition Pool, the aggregate effect, and material caveats. It is
analysis rather than a saved deck, and Tomekin states that nothing was saved.

A sufficiently contextualized review of user-nominated cards may proceed with stated material assumptions. An open
review requires a concise confirmed tuning Brief and an explicit Addition Pool.

For a 60-card deck, Tomekin first classifies the work as focused repair, rebuild around an identity, or fresh
construction. Moving beyond focused repair requires user confirmation. Commander tuning preserves the established game
plan, intended Commander Bracket, and play experience unless the user asks to change them.

Accepting advice does not itself authorize persistence. Tomekin first shows the exact final additions, cuts,
quantities, any commander change, and the persistence target, then waits for separate confirmation. A saved Deck
Candidate is updated in place unless the user asks for a copy or variant. An imported Existing Deck is never mutated; an
accepted revision can only be saved as a new Deck Candidate.

## Deck Building Brief

Before substantial discovery or fresh construction, Tomekin drafts a best-effort Deck Building Brief and asks the user
to confirm or edit it. If the Format is absent or ambiguous, it asks a focused Format question rather than silently
defaulting to Commander/EDH.

The Brief is discriminated by `format`:

- every Brief records the goal, nullable Format Anchor, play experience, nullable budget, missing-card tolerance, combo
  tolerance, constraints, exclusions, and assumptions;
- a Commander/EDH Brief records a nullable Commander Bracket and explicit Rule Zero exceptions; and
- a 60-card Brief records a nullable Power Level and does not contain Commander-only fields.

The drafting tool always marks the Brief as requiring confirmation. It also records that Collection availability must
be checked before treating cards as Missing Cards, and it calls out an omitted Commander Bracket for confirmation.

The current Brief schema does not contain a structured Collection Access Policy or dedicated Deck Opportunity ranking
priorities. The agent therefore keeps the confirmed exact Collection Location allow-list and relevant priorities in
the working conversation and repeats that scope in each Collection query. This procedural boundary is a current
limitation, not hidden policy state.

## Power And Play Experience

Power and pilot complexity are separate. Commander Bracket or a 60-card Power Level describes intended strength;
`playExperience` describes the desired gameplay feel and complexity. An approachable play experience does not by itself
authorize weakening the deck.

When the user says “fun” without further detail, the Brief defaults to synergistic, varied, expressive, and
fair-feeling play. Other requested experiences may be interactive, splashy, resilient, political, aggressive,
controlling, combo-oriented, or unusual.

Commander/EDH uses Commander Brackets rather than an invented numeric scale. Bracket terminology is external and may
change; Tomekin records the user's intended table experience and does not treat a copied historical bracket description
as permanent rules authority.

Deterministic local legality results cannot be overridden by agent judgment. A Rule Zero exception is permitted only
when it is explicit in the confirmed Commander/EDH Brief and labelled in the output; it does not rewrite the underlying
legality result.

## Collection Behavior

The Collection is an imported, read-only snapshot. Tomekin may search and reason over it, but it does not move cards,
change locations, register a deck in the source collection manager, or write back to ManaBox. Saving a Deck Candidate
does not make it part of the Collection. After physical or source-system changes, the user reimports the Collection.

Collection queries are stateless. When Collection evidence matters, Tomekin lists the available Collection Locations,
confirms an exact case-sensitive allow-list of `(locationType, locationName)` pairs, and reuses it unchanged. A query
that accidentally omits or widens the confirmed scope is discarded and retried.

Locations of type `deck` are treated as Existing Decks. Whether their cards may be used is expressed procedurally in
the confirmed working context; the tools do not independently decide whether an owned copy is Available, Committed, or
excluded.

### Empty Collection

No imported Collection and an imported empty Collection have the same deck-building consequence: there are no owned
copies available to the workflow. Tomekin can still discover directions from the user's stated preferences and can
construct and save a Deck Candidate. Every required copy is reported as Missing, and no Collection Pull List is
presented beyond stating that no owned copies are available.

### Owned and missing evidence

For a non-empty active Collection scope, Tomekin re-queries every final card name under the unchanged allow-list and
compares scoped quantities with required quantities before rendering. It then reports best-effort Available, Committed,
and Missing evidence from the imported snapshot.

This evidence is not a deterministic final Availability service. Card Query reports owned rows and quantities; the
agent applies the procedurally confirmed scope and explains the result. Saved Markdown may therefore become stale after
a later import, and the current product has no automatic refresh service or persisted freshness status.

## Validation, Rendering, and Persistence

Before rendering a final Deck Candidate, Tomekin:

1. resolves every card name to a local Card Identity;
2. validates Format construction and legality against the confirmed Brief;
3. performs the final scoped Collection evidence check when applicable;
4. evaluates Format-appropriate power context, Mainboard land count, and Mana Value distribution; and
5. performs at most three complete evaluate-and-revise passes before presenting the best candidate with any unresolved
   caveats.

The evaluator is not a deterministic deck-quality oracle. Strategy, roles, packages, Synergy, and tuning judgments are
agent reasoning backed by local facts and methodology.

Every rendered Deck Candidate uses these stable Markdown sections in order:

1. Game Plan
2. Power And Experience
3. Legality Assessment
4. Deck Structure
5. Portable Decklist
6. Collection Status
7. Key Synergies
8. Interaction And Protection
9. Mana And Curve
10. Optional Upgrades
11. Cuts And Exclusions
12. Assumptions And Caveats

The Portable Decklist is an importable card-name list without prices, Collection Locations, printing selection, or
explanations. Commander/EDH renders `Commander` followed by `Mainboard` and never adds a Sideboard. A 60-card candidate
renders `Mainboard`, followed by `Sideboard` only when Sideboard cards exist. Tomekin creates no 60-card Sideboard by
default; it does so only when requested, using user-supplied matchup context or clearly labelled general-purpose
assumptions.

The save boundary accepts only resolved Card Identity IDs and persists the Format-discriminated Brief, canonical
Markdown, Collection import timestamp when supplied, and relational commander/Mainboard/Sideboard card rows. Reads
return the stored Markdown, while the Portable Decklist can be rendered from the saved card rows. Save and update are
transactional at the repository boundary.

## Import Behavior

The supported Collection source is a ManaBox Collection CSV. The file must be readable before an import attempt reaches
the database. A missing or unreadable path exits without creating a `CollectionImport` record.

Once the file is readable, the importer requires compatible local `oracle_cards` and `all_cards` reference data. It
strictly validates the header and every row, resolves each Scryfall ID to a local Card Printing, validates Set code,
collector number, language, and finish, and treats name disagreement and some optional metadata problems as warnings.
All blocking validation must pass before the current Collection snapshot is replaced transactionally.

A successful import replaces the current Collection Locations and owned rows and records a summary. A readable attempt
that fails prerequisites or validation records a failed attempt and preserves the previous successful snapshot.
`oracle_tags` is not required for raw Collection import but is required for tag-backed deck-building discovery.

ManaBox List rows are not currently skipped and summarized as desired; unsupported location types fail validation. The
tracked compliance work is [issue #39](https://github.com/OSmall/tomekin/issues/39).

Scryfall reference data is populated only by explicit user-invoked sync or local-file import commands. Successful
dataset replacement is transactional, and a failed import preserves the previous usable dataset. Normal deck-building
does not automatically fetch or refresh Scryfall data.

## External Authority Limits

The local deck-building agent is authority-bound to Tomekin's product tools. During normal deck-building it cannot run
shell commands, inspect source files, issue raw SQL, use generic database access, call arbitrary web services, or write
Collection state.

Local Scryfall data is authoritative for Card Identity, Oracle text, Format legality, Game Changer flags, EDHREC rank,
Card Sets and Printings, and Oracle Tags. Tomekin does not claim live prices, current metagame knowledge, exhaustive
combo detection, gameplay simulation, opening-hand analysis, goldfishing, or deterministic strategic optimality.
Only the explicit Scryfall sync command performs live Scryfall network requests.
