# Repository ports with SQLite for the MVP

Persistence will be accessed through repository interfaces owned by the portable core rather than hardcoded into deck-building logic or opencode adapters. This keeps saved Collection imports, Import Summaries, Deck Opportunities, and Deck Candidates as portable product records that can later be backed by hosted persistence.

The MVP implementation will store local data in SQLite. SQLite is simple enough for a local opencode-first workflow while still providing structured persistence, queryability, and a clearer migration path than ad hoc JSON files.
