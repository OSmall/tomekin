# SQLite card reference field normalization

The SQLite card reference model will store Color Identity as a canonical WUBRG-ordered scalar, with colorless
represented as the empty color set. SQLite will enforce the valid Color Identity set with a `CHECK` constraint rather
than storing source arrays as JSON.

Format legality will be stored in `card_identity_format_legality` instead of a Commander-specific column on
`card_identity`. The format value remains source-defined text, while legality is constrained to Scryfall's known
legality states. The `oracle_cards` import replaces `CardIdentity` and `CardIdentityFormatLegality` records in one transaction.

Card reference records will store source page URIs for user-facing links. `CardPrinting` records will store nullable
`printed_name` from Scryfall `printed_name` instead of using a generic printing `name` field or synthesizing a fallback
from Scryfall `name`.

These choices keep the local SQLite model queryable without adding lookup tables for tiny closed sets, avoid
Commander-only schema shape, and preserve exact printing display data while keeping source-specific protocol details out
of table names where practical.
