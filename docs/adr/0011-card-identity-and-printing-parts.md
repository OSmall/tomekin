# Card identity and printing parts

Scryfall `card_faces` mixes several concepts: canonical castable modes for split, adventure, modal DFC, and transform
cards; physical or presentational sides for exact printings; and reversible-card faces whose Oracle ID may live only on
the face. The card reference model will split these into `CardIdentityPart` rows imported from `oracle_cards` for
canonical rules and mode reasoning, and `CardPrintingPart` rows imported from `all_cards` for exact printing and
presentation data. Parts use the zero-based Scryfall face order rather than an invented face ID or front/back role.

Scryfall `layout` is also split into two concerns while keeping the field name `layout` on each owning record.
`CardIdentity.layout` stores canonical Scryfall layout values such as `normal`, `split`, `adventure`, `modal_dfc`, and
`transform`; `CardPrinting.layout` stores presentation layout for the exact printing, initially `standard` or
`reversible_card`, where `standard` means the printing follows the Card Identity layout.

`CardPrinting.card_identity_id` remains the primary single-identity link for this migration. Reversible printings
without a top-level `oracle_id` may derive that link from the one distinct face-level Oracle ID present in current
Scryfall data. `CardPrintingPart` remains presentation-only and does not carry its own identity link. Current
Magic/Scryfall data does not require representing one physical printing as multiple Card Identities, so if a future
Scryfall object contains multiple distinct face-level Oracle IDs for one printing, the import should fail clearly rather
than skip the card, guess a primary identity, or introduce a broader identity-join model in this migration.
