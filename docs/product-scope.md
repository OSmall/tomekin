# Product Scope

This project provides an AI agent with expertise in Magic: The Gathering and specialises in parsing the user's card collection to assist with building cohesive and strategically viable decks.

## Product Promise

The project is a collection-first deck builder.

Its primary value is helping a player turn their real MTG collection into stronger, explainable deck candidates. Collection analysis, synergy analysis, rules awareness, price awareness, and deck optimisation all exist to support that core promise.

## Format Direction

The first useful version is Commander-first.

The MVP may optimise initially for Commander/EDH concepts such as singleton deck construction, commander identity, casual power expectations, and collection-aware upgrades. Project language and requirements should remain format-extensible.

## Collection Import

The MVP supports ManaBox collection CSV exports only.

The known initial ManaBox export shape is:

```csv
Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added
```

The project should treat imported collection data as evidence of the user's owned physical cards. Cards already assigned to decks remain part of the Collection, but they are not necessarily freely available for new deck candidates.

For the MVP, imports should stay simple: each import call should take the entire Collection as a fresh snapshot. The import should be strict and fail fast if required collection data is missing, malformed, or ambiguous. Incomplete collection data should be treated as either a problem with the user's source collection data or a problem with the import logic, not as something the agent should silently work around.

ManaBox Lists should not be imported as part of the Collection because ManaBox uses Lists for cards that may not be owned, such as wishlists and buylists. Rows belonging to Lists should be skipped rather than treated as import failures. The agent has no MVP use for ManaBox Lists. Skipped Lists should still be reported in the import summary.

The agent should infer Existing Decks from imported Collection metadata such as binder name, binder type, or location where possible.

ManaBox references:

- [Import and export the collection](https://manabox.app/guides/collection/import-export/) documents ManaBox collection CSV import/export and supported card properties.
- [Getting started with the collection](https://manabox.app/guides/collection/getting-started/) distinguishes binders, which represent owned cards, from lists, which may represent cards the user does not own.
- [Decks in the collection](https://manabox.app/guides/decks/collection-decks/) explains ManaBox's registered deck support and how deck cards can be tracked as physically located in decks.

## Product Principles

- Optimise for collection-first deck building before broader MTG assistant behaviour.
- Prefer explainable recommendations over opaque optimisation.
- Treat user priorities as inputs, not fixed assumptions.
- Keep format language extensible.
- Keep Collection Access Policy flexible enough to express protection and exclusion needs without turning the MVP into collection management software.
- Define capabilities before choosing technologies or architecture.

## Current Boundaries

Deferred scope and technology directions are tracked in [`future-direction.md`](./future-direction.md).

The MVP is also not intended to replace the user's collection management software. The agent should treat the Collection as imported source data. It may read and analyse the Collection, but it should not mutate Collection state, mark cards as moved, create Existing Deck records, or update binder locations. The user remains responsible for updating Collection state in the source system after moving cards, building decks, or reorganising binders, then reimporting or resyncing that data into the agent.
