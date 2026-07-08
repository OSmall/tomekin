# Explicit Scryfall bulk sync command

The alpha release will add an explicit user-invoked Scryfall bulk sync command that downloads and imports the default
local reference datasets in dependency order: `oracle_cards`, `all_cards`, then `oracle_tags`. This command is
setup/admin behaviour, not normal deck-building behaviour.

Normal opencode deck-building tools and ManaBox Collection import remain local/offline and must not make hidden live
Scryfall calls. The existing local-file `import:scryfall` command remains supported for repair, debugging, fixture
workflows, and users who manually download bulk files.

The sync command should fetch Scryfall bulk metadata, resolve datasets by Scryfall bulk data `type`, stream the
downloaded source, and preserve existing failed-import non-destructiveness. Current Scryfall bulk downloads are gzipped
JSONL, so the sync path must support streaming gzip/JSONL sources rather than assuming top-level JSON-array files.
Existing JSON-array local import support may remain for backwards-compatible fixtures and local repair workflows.

This keeps network access explicit and user-controlled while improving the clone-based alpha setup path.
