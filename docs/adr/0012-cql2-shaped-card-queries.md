# CQL2-shaped Card Queries

Card Queries will use a CQL2-JSON-inspired expression shape with composable `op` and `args` nodes and an explicit
allowlist of Tomekin queryables, instead of giving deck-building agents raw SQL or cloning Scryfall's public search
syntax. The first tool should be `query_cards`, querying a SQL-like joined card-search resource over Card Identity,
Card Printing, Collection Card, Collection Location, Commander legality, and Card Identity Tags where needed. Results
are
grouped by Card Identity, with optional included Collection Card rows for owned-copy context.

This keeps the agent-facing search contract portable across opencode, future MCP or HTTP adapters, and hosted web code
while preserving database access control and side-effect boundaries. It also keeps Collection predicates first-class for
a
collection-first deck-building assistant without exposing physical table names, arbitrary joins, or SQL fragments to the
agent. The implementation should follow the concepts and JSON encoding patterns from the OGC Common Query Language
(CQL2) 1.0 specification where practical, but should not claim full CQL2 conformance until the supported requirements
classes and deviations are documented and tested: https://docs.ogc.org/is/21-065r2/21-065r2.html

Rejected alternatives were arbitrary SQL through dbhub or another database MCP, which would make the physical schema an
agent API; a full Scryfall-compatible parser, which is too broad for the MVP; separate identity and Collection search
tools as the only search surface, which made collection-bound deck-building feel bolted on; and a single tool with a
variable target/result schema, which made agent use and validation harder. The first implementation should support a
bounded CQL2-like subset over Card Identity, legality, Card Identity Tag, and positive Collection row/quantity
queryables;
printing predicates, Scryfall-string parsing, exact copy-selection, and anti-existence Collection predicates remain
future
extensions over the same query model.
