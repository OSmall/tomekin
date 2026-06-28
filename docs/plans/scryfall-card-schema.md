# Scryfall Card Schema Plan

This plan records decisions for the next Scryfall-backed card reference schema migration. It is implementation-facing;
canonical domain language belongs in `CONTEXT.md` once terms are resolved.

## Goal

Make the local SQLite card reference database complete for Scryfall card objects and expressive enough to represent
multi-face and reversible card data without lossy flattening.

## Current Findings

- `all_cards` import currently skips Scryfall card objects that do not have a top-level `oracle_id`.
- In `/Users/osmall/Downloads/all-cards-20260615212406.json`, there are 531,662 card objects and 81 objects without a
  top-level `oracle_id`.
- All 81 missing top-level `oracle_id` objects in that file have `layout = "reversible_card"`.
- The latest local `all_cards` import recorded 531,581 imported records, matching total card objects minus the 81
  skipped reversible cards.
- Not all Scryfall card objects have `card_faces`. In the current `all_cards` file, 11,656 objects have `card_faces` and
  520,006 do not.
- In the current `oracle_cards` file, 3,140 objects have `card_faces` and 35,038 do not.
- For ordinary multi-face layouts such as `split`, `transform`, `modal_dfc`, `adventure`, `prepare`, and `flip`, the
  top-level card object has one `oracle_id`; face objects generally do not have their own `oracle_id`.
- In the current `all_cards` file, only `reversible_card` face objects have face-level `oracle_id` values.
- In the current `all_cards` file, no card object has multiple distinct face-level `oracle_id` values. The 81
  `reversible_card` objects each have face-level `oracle_id` values, but both faces on each object point to the same
  Oracle ID.
- Adventure card objects store a combined top-level `mana_cost`, while their `card_faces` store the individual creature
  and adventure spell costs. Top-level power and toughness are populated for adventure creatures and match the creature
  face, while the adventure spell face has no power or toughness.
- Split card objects store a combined top-level `mana_cost`, while their `card_faces` store each half's individual cost
  and rules text.
- Modal DFC and transform objects generally move mana cost, colors, rules text, power, toughness, loyalty, and defense
  to `card_faces`, while the top-level object keeps aggregate values such as mana value and color identity.
- Some current `reversible_card` objects have face-level `layout = "adventure"`. Their `all_cards` face rows describe
  reversible printing sides/face presentation, while the matching `oracle_cards` object contains the canonical adventure
  parts with the correct adventure-mode rules text. This proves printing parts and identity parts are separate concepts.

## Resolved Decisions

- Scryfall card reference imports must not skip card objects from the selected bulk dataset. If a card object cannot be
  represented, the import should fail clearly rather than silently omitting it.
- Use the domain term `CardPart` for ordered face, side, half, or mode rows instead of `CardPrintingFace`, because
  Scryfall `card_faces` covers more than physical card faces.
- Split card part concepts by parent: `CardIdentityPart` stores canonical rules/mode parts from `oracle_cards`, while
  `CardPrintingPart` stores exact printing/presentation parts from `all_cards`.
- `CardIdentityPart.part_index` and `CardPrintingPart.part_index` should store the zero-based order from Scryfall
  `card_faces`. Do not add a separate front/back role field in this migration.
- `CardPrinting.card_identity_id` should remain non-null for this migration. For `reversible_card` objects without
  top-level `oracle_id`, derive it from the one distinct face-level `oracle_id`; if a future Scryfall object has
  multiple distinct face-level `oracle_id` values, fail the import clearly rather than guessing. This preserves the
  invariant that one exact `CardPrinting` has one parent `CardIdentity`, because current Magic/Scryfall data does not
  require multi-identity physical printings.
- Create `CardIdentityPart` rows only when `oracle_cards` provides `card_faces`; do not synthesize a single part for
  ordinary one-part `CardIdentity` records.
- Create `CardPrintingPart` rows only when `all_cards` provides `card_faces`; do not synthesize a single part for
  ordinary one-part `CardPrinting` records.
- `CardIdentityPart` should store canonical part-level rules fields: `name`, `mana_cost`, `type_line`, `oracle_text`,
  `colors`, `color_indicator`, `power`, `toughness`, `loyalty`, and `defense`.
- `CardPrintingPart` should store print/presentation fields only; it should not duplicate canonical rules fields from
  `CardIdentityPart`, and it should not store `card_identity_id` in this migration. Its planned fields are `part_index`,
  `printed_name`, `flavor_name`, `printed_type_line`, `printed_text`, `flavor_text`, `artist`, `artist_id`,
  `illustration_id`, and `image_uris_json`.
- Split Scryfall layout into two concerns while naming both fields `layout` on their owning records.
  `CardIdentity.layout` stores the canonical Scryfall layout values such as `normal`, `split`, `adventure`, `modal_dfc`,
  and `transform`. `CardPrinting.layout` stores the presentation layout for the exact printing and should initially
  allow `standard` and `reversible_card`; `standard` means the printing follows the Card Identity layout.
- `CardIdentity.layout` should enforce the known Scryfall layout enum except `reversible_card`, because reversible-card
  presentation belongs on `CardPrinting.layout`.
- `CardPrinting.layout` should enforce `standard` and `reversible_card` only.
- `CardIdentity.color_identity`, `CardIdentityPart.colors`, and `CardIdentityPart.color_indicator` should all be stored
  as WUBRG-ordered scalar strings using the same canonicalization function over Scryfall color arrays, while keeping
  their meanings distinct.
- Store both top-level `colors` and `color_indicator` on `CardIdentity` and part-level `colors` and `color_indicator` on
  `CardIdentityPart`; all are nullable WUBRG-ordered scalar strings. `CardIdentity.color_identity` remains required.
- `CardIdentity.produced_mana` should be stored as a canonical scalar using a separate mana-production canonicalization
  function that supports Scryfall's `C` value in addition to WUBRG colors.
- `CardIdentity.keywords` should be stored as JSON for this migration. A future richer search slice may normalize
  keywords into a child table if relational keyword queries become important.
- Store Scryfall `tcgplayer_id` and `cardmarket_id` on `CardPrinting`, not `CardIdentity`, because they identify
  marketplace products for exact card objects/printings rather than canonical Oracle identities.
- Store Scryfall `edhrec_rank` on `CardIdentity` as nullable card-level Commander metadata, and store
  `game_changer` as required card-level Commander metadata.
- Store `power`, `toughness`, `loyalty`, and `defense` on both `CardIdentity` and `CardIdentityPart`: top-level fields
  support ordinary cards and aggregate source values, while part-level fields preserve multi-part values from
  `oracle_cards.card_faces`.
- Collection rows should continue to reference one exact `CardPrinting`; `CardIdentity` remains derived through
  `CardPrinting.card_identity_id`. Do not add a `CardPrinting`-to-`CardIdentity` join table in this migration.
- Treat Scryfall-backed reference records as rebuildable import-owned data for this migration. The migration may
  destructively rebuild local Scryfall reference tables and require rerunning Scryfall bulk imports rather than
  preserving/backfilling existing `CardIdentity` and `CardPrinting` rows in place.
- Shape core import records around the source parent object and keep related child rows nested at the core/repository
  boundary: `CardIdentityImportRecord` should carry `identity`, `parts`, and `formatLegalities`;
  `CardPrintingImportRecord` should carry `printing` and `parts`. The SQLite repository may flatten these nested records
  into staging tables internally.
- Unsupported or contradictory Scryfall source shapes should fail the whole affected bulk import and preserve the
  previous usable dataset. This includes unknown layout values, invalid color or produced-mana symbols, missing or
  ambiguous identity links for `all_cards`, duplicate part indexes under one parent, missing child parents, and
  `CardPrinting.card_identity_id` values that do not exist in the current `CardIdentity` data.
- Write explicit target field lists for all four card reference tables before implementation starts, so schema, mapper,
  repository, and tests share one concrete target.
- Regression coverage should use fixtures sourced from real Scryfall data rather than invented card objects. Coverage
  should include ordinary single-part cards, identity parts such as split or adventure, transform or modal DFC
  part-level fields, reversible cards deriving the printing identity link from face-level `oracle_id`, and localized
  multi-face printings with face-level `printed_name`.
- Invalid-shape tests may start from real Scryfall fixtures and minimally mutate only the field needed to create the
  invalid condition. The mutation should be explicit in the test.
- The implementation slice should update `docs/data-model.md` to describe `CardIdentityPart` and `CardPrintingPart`
  relationships and keep persisted-record documentation in sync with the schema.
- The implementation slice should update `README.md` only if Scryfall import order, command behavior, setup flow, or
  user-facing command output changes.

## Target Tables

### CardIdentity

- `id`
- `name`
- `layout`
- `mana_cost`
- `mana_value`
- `type_line`
- `oracle_text`
- `color_identity`
- `colors`
- `color_indicator`
- `produced_mana`
- `keywords_json`
- `power`
- `toughness`
- `loyalty`
- `defense`
- `edhrec_rank`
- `game_changer`
- `source_page_uri`

### CardIdentityPart

- `card_identity_id`
- `part_index`
- `name`
- `mana_cost`
- `type_line`
- `oracle_text`
- `colors`
- `color_indicator`
- `power`
- `toughness`
- `loyalty`
- `defense`

### CardPrinting

- `id`
- `card_identity_id`
- `layout`
- `printed_name`
- `set_code`
- `collector_number`
- `finishes_json`
- `language`
- `tcgplayer_id`
- `cardmarket_id`
- `source_page_uri`

### CardPrintingPart

- `card_printing_id`
- `part_index`
- `printed_name`
- `flavor_name`
- `printed_type_line`
- `printed_text`
- `flavor_text`
- `artist`
- `artist_id`
- `illustration_id`
- `image_uris_json`
