# Repository ports with SQLite for the MVP

Persistence will be accessed through repository interfaces owned by the portable core rather than hardcoded into deck-building logic or opencode adapters. This keeps saved `CollectionImport`, Import Summary, `DeckOpportunity`, and `DeckCandidate` records portable so they can later be backed by hosted persistence.

The MVP implementation will store local data in SQLite. SQLite is simple enough for a local opencode-first workflow while still providing structured persistence, queryability, and a clearer migration path than ad hoc JSON files.
