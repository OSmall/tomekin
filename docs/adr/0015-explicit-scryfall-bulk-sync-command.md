# Explicit Scryfall bulk sync command

The alpha release will add an explicit user-invoked Scryfall bulk sync command that downloads and imports the default
local reference datasets in dependency order: `oracle_cards`, `all_cards`, then `oracle_tags`. This command is
setup/admin behaviour, not normal deck-building behaviour.

Normal opencode deck-building tools and ManaBox Collection import remain local/offline and must not make hidden live
Scryfall calls. The existing local-file `import:scryfall` command remains supported for repair, debugging, fixture
workflows, and users who manually download bulk files.

The sync workflow is core application behaviour because every adapter that updates local reference data needs the same
ordering, validation, and failure semantics. Runtime-specific I/O remains outside core: adapters provide fetch/download,
temporary or durable source storage, and user-facing progress rendering through ports. The sync workflow should fetch
Scryfall bulk metadata, resolve datasets by Scryfall bulk data `type`, stream the downloaded source, and preserve existing
failed-import non-destructiveness. Current Scryfall bulk downloads are gzipped JSONL, while older downloaded files and
the
API `download_uri` fallback can be top-level JSON arrays, so every Scryfall bulk import path must support both shapes.

For the alpha, live Scryfall Bulk Data Sync means the fixed default set of `oracle_cards`, `all_cards`, and
`oracle_tags`. Partial live sync is intentionally not exposed; single-dataset repair and debugging should use the local
Scryfall Bulk Data Import path.

Core should expose one orchestration service method rather than separate prepare/import phases, so the service can enforce
that all metadata resolution and downloads succeed before any import begins. Download ports should return re-openable
downloaded sources: CLI can back them with temporary files, future adapters can back them with other storage, and tests can
back them with in-memory fixtures. Core owns Scryfall bulk source decoding, including gzipped JSONL and top-level JSON
arrays, and exposes structured sync events; adapters own rendering those events to users. The local-file import command
uses the same source-shape support as live sync.

Sync results should be per-dataset rather than only aggregate. A caller should be able to distinguish downloaded but not
imported datasets from imported datasets and see the Scryfall source URI, source timestamp, status, and imported record
count for each dataset.

The alpha sync should make one metadata request and one download request per dataset, without automatic retries or
backoff. Clear fail-fast errors and safe re-run behaviour are preferred over retry logic for this clone-based alpha. The
HTTP adapter should send a simple project User-Agent such as `tomekin-alpha/0.0.0`. Metadata should come from one
`GET /bulk-data` response, not three `GET /bulk-data/:type` calls, so all selected download links come from the same
Scryfall metadata snapshot.

This keeps network access explicit and user-controlled while improving the clone-based alpha setup path.
