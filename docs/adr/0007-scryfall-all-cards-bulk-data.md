# Scryfall bulk data sources

The MVP will sync Scryfall card data from the All Cards and Oracle Cards bulk data exports. ManaBox collection exports include a Scryfall ID column, so importing All Cards allows CollectionCard rows to resolve directly to exact ScryfallCard records. OracleCard records should come from Scryfall's Oracle Cards bulk data because Scryfall already provides one representative card object per Oracle ID.

Using All Cards is heavier than using Scryfall's default-card dataset, but it preserves exact printing resolution for Collection Pull Lists and keeps collection import deterministic without live per-card API calls. Importing Oracle Cards separately avoids inventing local representative-selection rules for canonical oracle-level card data.
