# Oracle Tags Import Plan

This plan defines the first implementation slice for importing Scryfall `oracle_tags` bulk data into the local card-reference store.

## Goal

Import Scryfall's local `oracle_tags` bulk data file as Card Identity Tag reference data so later Deck Opportunity discovery can reason over functional card tags, tag aliases, direct taggings, and tag hierarchy.

## Current State

- `oracle_cards` local import creates `CardIdentity` and format legality records.
- `all_cards` local import creates `CardPrinting` records and requires `oracle_cards` first.
- `oracle_tags` is already listed as a Scryfall bulk data type, but the CLI currently rejects it and no `CardIdentityTag` tables exist yet.
- The downloaded `oracle_tags` file at `/Users/osmall/Downloads/oracle-tags-20260616090037.json` contains 4,487 oracle tags and 227,224 direct taggings.

## Resolved Decisions

- The first slice extends the existing explicit local Scryfall bulk import path. It does not add live Scryfall downloading.
- The user-facing command remains the existing CLI shape: `bun run import:scryfall -- oracle_tags <path>`.
- No opencode-facing import tool is added in this slice.
- `oracle_tags` depends on a latest successful `oracle_cards` import, not on `all_cards`.
- If `oracle_tags` references a missing `CardIdentity`, the import fails and preserves the previous usable tag dataset.
- A standalone `oracle_cards` replacement must fail if it would orphan existing `CardIdentityTagging` rows.
- `CardIdentityTag` validates Scryfall `type: "oracle"`, but does not persist the type because every persisted tag in this model is an oracle tag.
- `CardIdentityTag` persists Scryfall tag `id`, `slug`, `label`, nullable `description`, and source page URI.
- `CardIdentityTag.id` is the stable primary key. `slug` is unique in the current imported dataset but is not stable identity. `label` is not unique.
- Tag aliases are persisted as relational `CardIdentityTagAlias` rows, not as JSON. Alias values are unique per tag, not globally unique.
- `CardIdentityTagging` persists direct taggings only, including constrained `weight` and nullable `annotation`.
- Tagging weight is constrained to Scryfall's documented values: `very_strong`, `strong`, `median`, and `weak`. Unknown weights fail the import.
- Tags with zero direct taggings are imported.
- Broad parent-tag matches are not materialized as extra taggings; descendant expansion is deferred to later query or reasoning code.
- Tag hierarchy is persisted from `parent_ids` only. `child_ids` is ignored for persistence and validation.
- Import uses one streamed pass over the source file into SQLite temp staging tables, followed by set-based SQL validation and atomic replacement.
- Hierarchy validation rejects parent IDs that do not exist in the staged tag dataset and rejects self-parenting. Root tags with no parents are valid. Full cycle detection is deferred.
- Duplicate tag IDs, duplicate slugs, duplicate aliases for the same tag, duplicate direct taggings, and duplicate hierarchy links are blocking import errors.
- An `oracle_tags` import with zero tags is a blocking error. An import with tags but zero direct taggings is allowed.
- A successful `oracle_tags` import atomically replaces tags, aliases, taggings, and hierarchy together. A failed import preserves the previous usable tag dataset.
- This slice adds repository-level list reads for tag tables, mirroring existing card identity and printing import verification helpers. It does not add a public card-reference query service.
- This slice does not need a new ADR because it applies existing Scryfall bulk import decisions rather than introducing a surprising hard-to-reverse architecture choice.

## Planned Data Records

- `card_identity_tag`: one row per imported `CardIdentityTag`.
- `card_identity_tag_alias`: alternate lookup names for a `CardIdentityTag`.
- `card_identity_tagging`: direct relationship between a `CardIdentity` and a `CardIdentityTag`.
- `card_identity_tag_hierarchy`: direct parent-child relationship between `CardIdentityTag` records, sourced from `parent_ids`.

## Test-First Implementation Slices

1. Core schema and mapping slice:
   - Add failing core tests for raw Scryfall oracle tag parsing, unknown `type`, unknown `weight`, nullable fields, aliases, annotations, and parent IDs.
   - Add core schemas and mapping types for `CardIdentityTag`, `CardIdentityTagAlias`, `CardIdentityTagging`, and `CardIdentityTagHierarchy` import records.

2. Service dependency slice:
   - Add a failing core service test that `importOracleTags` fails before reading the source when no latest successful `oracle_cards` import exists.
   - Add `importOracleTags` to local import services and `importCardIdentityTags` to the repository port.

3. SQLite success slice:
   - Add failing SQLite repository tests that import a small fixture containing tags, aliases, annotations, direct taggings, root tags, and parent-child hierarchy.
   - Add SQLite tables, temp staging tables, transactional replacement, and repository-level list reads for `CardIdentityTag`, `CardIdentityTagAlias`, `CardIdentityTagging`, and `CardIdentityTagHierarchy` records.

4. SQLite validation slice:
   - Add failing tests for missing `CardIdentity` references, duplicate tag IDs, duplicate slugs, duplicate aliases for the same tag, duplicate taggings, duplicate hierarchy links, nonexistent parent IDs, self-parenting, and zero-tag imports.
   - Implement set-based validation against temp staging tables so failed imports preserve the previous usable tag dataset.

5. Oracle Cards referential-integrity slice:
   - Add a failing SQLite repository test showing standalone `oracle_cards` replacement fails if it would orphan existing `CardIdentityTagging` rows.
   - Extend the existing `oracle_cards` orphan check to include taggings.

6. CLI slice:
   - Add failing CLI tests for `bun run import:scryfall -- oracle_tags <path>`, dependency failure, invalid JSON/source validation failure, and previous-dataset preservation.
   - Extend CLI argument parsing, dispatch, usage text, progress rendering, and success/failure output to include `oracle_tags`.

7. Documentation and smoke slice:
   - Update README local Scryfall import usage to include `oracle_tags` after `oracle_cards`.
   - Run the full test suite and typecheck.
   - Smoke-test the real downloaded file against a temporary database after importing matching `oracle_cards`.

## Open Decisions

- None for this implementation slice.
