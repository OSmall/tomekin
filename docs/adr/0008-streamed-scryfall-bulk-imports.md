# Streamed Scryfall bulk imports

Scryfall `all_cards` bulk data is large enough that both full raw JSON parsing and accumulating all mapped records in
core memory create unnecessary memory pressure. Core owns streaming JSON parsing from `ReadableStream<Uint8Array>`
sources and lazily validates/maps records into repository imports; SQLite consumes those mapped records into
transaction-scoped staging tables before replacing live Card Identity and Card Printing reference data. The parser is
intentionally a Scryfall bulk-data object tokenizer, not a general JSON parser: it supports observed Scryfall source
containers (`jsonl.gz`, plain JSONL, and top-level JSON arrays of objects) while still only yielding one Scryfall object
record at a time. Real-file profiling showed `@streamparser/json-whatwg` spent excessive time materializing large nested
Scryfall fields that the importer discards, while splitting one top-level object or JSONL record at a time and using
native `JSON.parse` preserved the `ReadableStream` seam and removed the throughput cliff. We chose staged replacement
over direct streamed writes into target tables because it preserves failed-import non-destructiveness while allowing
set-based validation and clearer diagnostics before live reference data is replaced; Card Printing replacement must also
respect imported Collection rows by failing fast if a referenced printing disappears from incoming `all_cards`, rather
than cascading or silently orphaning Collection data. Hot staging loops may use lower-level prepared SQLite statements
while repository ports continue to hide persistence-specific types from core.
