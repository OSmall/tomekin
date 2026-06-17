# MTG Collection Deck Builder

This context describes the language of a collection-first MTG deck-building assistant. It exists to keep product, domain, and agent instructions consistent as the project grows.

## Language

**Collection**:
The user's owned MTG cards, including cards stored loose and cards currently assigned to decks. A Collection may include quantities, printings, condition, finish, language, purchase details, and location where known.
_Avoid_: Wishlist, card pool, inventory, library

**Collection Location**:
A named place or grouping from source collection data where owned cards are recorded, such as a binder, box, or Existing Deck. A Collection Location may affect Availability when the Collection Access Policy allows, protects, or excludes that location.
_Avoid_: Container, source group

**Availability**:
Whether an owned card can be used in a proposed deck without taking it from another deck. Availability is distinct from ownership.
_Avoid_: Ownership

**Available Card**:
An owned card that can be used in a proposed deck without taking it from an existing deck.
_Avoid_: Free card, unused card

**Committed Card**:
An owned card that is currently assigned to an existing deck and may require the user's permission before being used elsewhere.
_Avoid_: Locked card, unavailable card

**Missing Card**:
A card that is not owned by the user or is not owned in sufficient quantity for the proposed deck. If the Collection is empty, every card in a Deck Candidate is a Missing Card.
_Avoid_: Needed card, purchase

**Deck Building Preferences**:
The user's priorities for a deck-building task, including play experience, power level, budget, tolerance for missing cards, and Collection Access Policy.
_Avoid_: Deck settings, build options

**Power Level**:
The intended strength and optimisation level of a Deck Candidate relative to its format and expected table. In Commander/EDH, Power Level should usually be expressed through Commander Bracket.
_Avoid_: Tier

**Format**:
The rules environment a Deck Candidate is intended for, such as Commander/EDH or another MTG constructed format. Format determines deck construction rules, legality expectations, and format-specific conventions.
_Avoid_: Mode, deck type

**Format Anchor**:
The card, archetype, theme, or format-specific constraint that gives a Deck Opportunity or Deck Candidate its starting point. In Commander/EDH, the format anchor is usually the commander.
_Avoid_: Theme, commander when not Commander/EDH-specific

**Collection Access Policy**:
The part of Deck Building Preferences that defines which parts of the Collection may be used for a deck-building task, including cards, locations, Existing Decks, and metadata-based categories that are allowed, protected, or excluded.
_Avoid_: Availability preference, ownership rule

**Deck Building Brief**:
The confirmed working agreement for a deck-building task, summarising the user's goal, Deck Building Preferences, Collection Access Policy, and assumptions.
_Avoid_: Prompt, request, deck settings

**Existing Deck**:
A deck the user already has assembled or tracked. Cards in an Existing Deck are part of the Collection and may be available, committed, protected, or borrowable depending on the Collection Access Policy.
_Avoid_: Current deck, real deck

**Deck Candidate**:
A proposed decklist produced or modified by the agent. A Deck Candidate remains separate from the user's Collection state unless it later appears in imported source collection data as an Existing Deck.
_Avoid_: Suggested deck, generated deck

**Portable Decklist**:
The importable card-name decklist for a Deck Candidate, formatted for broad compatibility with common MTG deck tools. A Portable Decklist does not include collection locations, prices, explanations, or printing details by default.
_Avoid_: Export, raw list

**Collection Pull List**:
The assembly-focused list that shows the user's matching owned card copies for a Deck Candidate, including location and exact printing details where known. The user decides which physical copies to use.
_Avoid_: Decklist, shopping list

**Card Printing**:
A source-backed record for a specific printed or print-like version of a card, distinct from both owned Collection rows and canonical card identity.
_Avoid_: Scryfall Card, card pool entry

**Card Part**:
An ordered face, side, half, or castable mode of a Card Printing or Card Identity. A Card Part describes part-specific
card information without implying it is independently owned or always independently deck-buildable.
_Avoid_: Card face when referring to all multi-part layouts, separate printing

**Printed Name**:
The name shown for a specific Card Printing. It may differ from the canonical Card Identity name because of localization, alternate in-world naming, or other print-specific presentation.
_Avoid_: Card name, Oracle name

**Card Identity**:
The canonical card-level identity used for deck-building reasoning, legality, names, rules text, and matching Deck Candidate entries across printings.
_Avoid_: Oracle Card, card definition

**Color Identity**:
The set of MTG colors that constrain where a card can be used for format rules such as Commander/EDH deck construction. Colorless means the set contains no colors; it is not a sixth color.
_Avoid_: Color, mana cost

**Colors**:
The set of MTG colors a card or Card Part has under the rules, usually from its mana cost or color-defining rules.
Colors are distinct from Color Identity and may be absent at the whole-card level when colors are part-specific.
_Avoid_: Color Identity

**Color Indicator**:
The printed color marker that defines a card or Card Part's color when present, such as on some double-faced cards. A
Color Indicator contributes to Colors but is distinct from Color Identity.
_Avoid_: Color Identity, mana cost

**Mana Value**:
The numeric value of a card's mana cost as used by MTG rules for deck-building reasoning, filtering, and curve analysis.
_Avoid_: Converted mana cost, CMC

**Card Identity Tag**:
A reusable descriptive tag that can apply to `CardIdentity` records for search, grouping, and Synergy analysis.
_Avoid_: Oracle Tag, card label

**Card Identity Tagging**:
The relationship that applies a Card Identity Tag to a specific Card Identity, including any relationship-specific meaning such as prominence or annotation.
_Avoid_: Card tag link, tag assignment

**Scryfall Bulk Data Import**:
A manual import of one or more local Scryfall bulk data files into the card reference data used by the assistant. A Scryfall Bulk Data Import is distinct from a sync or refresh because it does not imply automatic downloading or hidden network access.
_Avoid_: Sync, refresh, card data load

**Deck Opportunity**:
A promising deck-building direction identified from the Collection, usually combining a Format Anchor, theme, available support cards, expected play pattern, and likely Missing Cards.
_Avoid_: Theme, idea, suggestion

**Synergy**:
A meaningful relationship where cards reinforce, enable, reward, or amplify one another as part of a deck's plan. Synergy is broader than combo and does not need to create a deterministic or game-ending line.
_Avoid_: Combo, similarity, theme

**Commander/EDH**:
The primary format emphasis for the MVP. Decisions should preserve a path to other MTG formats later.
_Avoid_: Commander-only

**Commander Bracket**:
The Commander/EDH power and play-experience category used to describe what kind of Commander game a Deck Candidate is intended for. Commander Brackets should be treated as external Commander terminology that may evolve over time.
_Avoid_: Tier
