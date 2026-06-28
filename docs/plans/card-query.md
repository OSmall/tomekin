# Card Query Plan

This plan captures the next search-tool direction after ManaBox Collection import. The goal is to replace temporary
narrow card search tools with a structured Card Query capability that gives the deck-building agent flexible retrieval
over joined card reference and Collection data without exposing raw database access.

## Resolved Direction

- Card Query is the canonical term for structured agent-facing card search.
- The first Card Query tool should be named `query_cards`.
- Card Query searches a SQL-like joined card resource across Card Identity, Card Printing, Collection Card, Collection
  Location, Commander legality, and Card Identity Tags where needed, but exposes only documented queryables rather than
  SQL, table names, or arbitrary joins.
- Card Query returns a fixed Card Identity-grouped result shape. Each result item represents one Card Identity, with
  optional included Collection Card rows that matched the query.
- Reference-only Card Queries remain unowned-capable. Collection data participates only when the query uses Collection
  queryables or requests Collection Card projection; an identity-only query must not implicitly become an owned-card
  query because Collection tables exist.
- Deck Candidates still choose Card Identities rather than exact Collection Cards or Card Printings. Included Collection
  Card rows provide owned-copy context for search and later assembly reasoning.
- Printing predicates are deferred. The query model should leave room for future printing filters and projections, but
  the MVP should not add language, set, collector-number, art, or exact-printing search until a real workflow requires
  it and the necessary printing data is persisted.
- Match evidence should not be returned by default. Search results should be compact; optional includes may later
  request tags, legalities, Collection Card rows, snippets, or bounded match reasons.
- The first slice supports structured `include.legalities` as an array of explicit formats, such as `["commander"]`.
  Legality filtering does not automatically include legality data in result items; projection is explicit.
  `include.legalities` should accept only explicit known supported formats, starting with `"commander"`. Reject `"all"`,
  unknown strings, empty arrays, and duplicate formats rather than expanding or coercing them.
- Card Query should be stateless. There is no hidden active policy automatically applied to every query.
- The agent translates the confirmed Collection Access Policy into explicit hard Collection clauses when useful.
- If the user changes the Collection Access Policy during a thread, the agent should confirm an updated Deck Building
  Brief and use the updated hard clauses in later queries. No prior hidden query state needs to be unwound.
- Final Deck Candidate evaluation and Collection Pull List generation should verify the final proposal against the
  latest confirmed Deck Building Brief and catch policy mistakes made during search.
- Raw SQL through dbhub or any database MCP is not part of the normal deck-building agent capability. Any such access is
  developer/admin-only and must be explicitly allowed outside the product deck-building agent.
- The base MTG agent should be loose in workflow and strict in authority. It should have access to safe Agent Tools and
  hard boundaries; proven deck-building workflows should later move into skills or subagents.
- Boolean queryables should not be nullable in the first slice. `identity.gameChanger` should be a required boolean, and
  Collection booleans such as `altered` and `misprint` are already required by the Collection model. Required source
  booleans should fail import when absent or invalid rather than being normalized to unknown values.
  Make `identity.gameChanger` required end to end as a prerequisite cleanup slice and separate commit before
  implementing
  `query_cards`.
- Do not include null-checking operators in the first slice. Omitted predicates mean unconstrained fields; comparisons
  and text predicates over nullable facts do not match absent values. Sorting should use database-native ordering for
  allowed sort properties, including the database's normal handling of absent values.
- Card Query validation should be strict. Unknown fields, operators, queryables, invalid operator/property
  pairings, wrong value types, invalid enum values, empty boolean groups, invalid `sortby` properties, and excessive
  limits should return descriptive validation errors rather than being coerced, ignored, or partially applied.
- Validation should use the core Result/AsyncResult style so consumers receive typed failures with descriptive
  Zod-derived details instead of thrown validation exceptions.
- Card Query validation failures should use a transport-neutral core shape inspired by HTTP Problem Details but not
  pretending to be an HTTP response. Use a top-level `code`, `message`, and `issues` array. Each issue should include an
  RFC 6901 JSON Pointer such as `#/filter/args/1/args/0/property`, a machine-readable `code`, a human-readable`message`,
  and optional context such as `allowedValues`. HTTP adapters may translate this to RFC 9457 Problem Details at the
  edge.
- The first slice supports `limit` only. Do not add `offset`, `cursor`, `page`, or `after` until a real workflow
  requires pagination and its semantics are designed.
- Omitted `filter` is valid and means unconstrained Card Identity browse. Empty boolean groups such as `and` or `or`with
  no arguments are invalid.
- When `sortby` is omitted, default ordering should be `identity.id asc`.
- Deterministic ordering for explicit `sortby` should append stable internal tie-breakers after user-requested sort
  fields.
  Append `identity.id asc` unless the request already sorts by `identity.id`.
- `sortby` should map allowed sort properties to repository/database ordering without custom null ordering. If the agent
  wants to exclude absent values, it should express that through supported filters rather than expecting sort semantics
  to
  imply a filter.
- Sorting by `collection.quantity` uses the same positive Collection row scope as Collection filtering. With no other
  Collection predicates in the branch, it orders by summed owned quantity across the whole Collection. With Collection
  row
  predicates such as `collection.locationType = "binder"`, it orders by summed quantity for the matching scoped rows.
- Do not depend on Scryfall Tagger's internal GraphQL relationship edges in the first slice. Reserve the documentation
  term `Card Identity Relationship` / `CardIdentityRelationship` for future publicly documented relationship data, such
  as better/worse, similar, references, or with/without creature body relationships between Card Identities. Do not add
  first-slice code, schemas, tools, imports, queryables, or result projections for relationships.

## CQL2 Shape

Card Query should use a CQL2-JSON-inspired expression shape with composable `op` and `args` nodes and an explicit
allowlist of MTG Agent queryables. See ADR 0012 and the OGC Common Query Language (CQL2) 1.0
specification: https://docs.ogc.org/is/21-065r2/21-065r2.html

The implementation is CQL2-inspired, not conformant, until supported requirements classes and deviations are documented
and tested.

The top-level `filter` field remains the CQL2-JSON-inspired filter expression. Top-level `sortby` and `limit` are MTG
Agent query-envelope fields, not CQL2 filter-expression members; `sortby` is inspired by OGC API terminology rather than
CQL2-JSON filter syntax. `sortby` should use a structured JSON array of `{property, direction}` objects rather than the
compact OGC API query-parameter string form. This is chosen for agent and TypeScript validation, and avoids parsing
another mini-language. The first slice supports `limit` only, with no `offset`, `cursor`, `page`, or `after` pagination
fields.

The first query envelope should support:

- `filter`: optional CQL2-JSON-inspired filter expression.
- `sortby`: optional structured array of `{property, direction}` objects.
- `include`: optional structured projection request, starting with `legalities`, `tags`, and `collectionCards`.
- `limit`: optional positive integer with default `50` and maximum `200`. Reject `0`, negative numbers, decimals,
  numeric
  strings, `null`, and values over `200` rather than coercing them.

The first `include` envelope should accept only these fields:

- `legalities`: optional non-empty array of supported format strings, initially only `"commander"`; reject duplicates.
- `tags`: optional boolean.
- `collectionCards`: optional boolean.

Reject unknown include keys and structured options for `tags` or `collectionCards` in the first slice.

The first `sortby` envelope should accept only non-empty arrays of `{property, direction}` where `direction` is `"asc"`
or `"desc"`, `property` is in the sortable allowlist, and duplicate properties are rejected.

Example:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {
        "op": "=",
        "args": [
          {
            "property": "legality.commander"
          },
          "legal"
        ]
      },
      {
        "op": "colorIdentitySubsetOf",
        "args": [
          {
            "property": "identity.colorIdentity"
          },
          "BG"
        ]
      },
      {
        "op": "or",
        "args": [
          {
            "op": "contains",
            "args": [
              {
                "property": "identity.oracleText"
              },
              "sacrifice"
            ]
          },
          {
            "op": "hasTagInHierarchy",
            "args": [
              {
                "property": "tag.id"
              },
              "00000000-0000-0000-0000-000000000000"
            ]
          }
        ]
      }
    ]
  },
  "sortby": [
    {
      "property": "identity.edhrecRank",
      "direction": "asc"
    }
  ],
  "include": {
    "legalities": [
      "commander"
    ],
    "tags": true
  },
  "limit": 25
}
```

Owned binder-card example:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {
        "op": "=",
        "args": [
          {
            "property": "legality.commander"
          },
          "legal"
        ]
      },
      {
        "op": ">",
        "args": [
          {
            "property": "collection.quantity"
          },
          0
        ]
      },
      {
        "op": "=",
        "args": [
          {
            "property": "collection.locationType"
          },
          "binder"
        ]
      }
    ]
  },
  "include": {
    "legalities": [
      "commander"
    ],
    "collectionCards": true
  },
  "limit": 25
}
```

## First Queryables

Initial identity and reference queryables should include:

- `identity.name`
- `identity.typeLine`
- `identity.oracleText`
- `identity.manaValue`
- `identity.colorIdentity`
- `identity.colors`
- `identity.gameChanger`
- `identity.edhrecRank`
- `legality.commander`
- `tag.id`
- `tag.slug`
- `tag.label`
- `tag.alias`
- `tag.weight`

Initial Collection row queryables should include:

- `collection.quantity`
- `collection.locationName`
- `collection.locationType`
- `collection.finish`
- `collection.altered`
- `collection.misprint`

Do not expose arbitrary table names, column names, joins, SQL fragments, or property paths outside the documented
queryable allowlist.

Initial sortable properties should be narrower than filterable queryables:

- `identity.id`
- `identity.name`
- `identity.manaValue`
- `identity.colorIdentity`
- `identity.edhrecRank`
- `collection.quantity`

Do not support first-slice sorting by text blobs, tags, legalities, location names, or other Collection row metadata.

Collection queryables are evaluated against joined Collection Card rows and grouped back to Card Identity results.
Collection row predicates such as `collection.locationType`, `collection.locationName`, `collection.finish`,
`collection.altered`, and `collection.misprint` select matching owned rows. `collection.quantity` is the summed quantity
over those matching rows for the current Card Identity, not the quantity of a single source row. For example,
`collection.locationType = "binder" AND collection.quantity >= 2` means the Card Identity has at least two owned binder
copies, even when those copies are split across multiple Collection Card rows. Card Query does not support first-slice
aggregate or anti-existence Collection predicates such as "this Card Identity has zero copies in this Existing Deck" or
"this Card Identity is missing from my Collection." Missing/unowned and "no copies in X" queries are deferred future
scope rather than overloaded into positive Collection search.
When `collection.quantity` appears without other Collection row predicates in its branch, it sums all owned Collection
Card rows for the Card Identity across all locations, finishes, conditions, and source rows.
Multiple non-quantity Collection predicates in the same boolean branch apply to the same matched Collection Card row
set.
For example, `collection.locationType = "binder" AND collection.finish = "foil"` matches and sums only owned rows that
are both in a binder and foil; a nonfoil binder row plus a foil deck row does not satisfy that branch. Collection
predicates are branch-local under normal boolean semantics. An `AND` branch containing a non-quantity `collection.*`
predicate requires owned Collection Card rows for that branch, while a separate reference-only `OR` branch may still
match
unowned Card Identities. Use `collection.quantity > 0` as the first-slice idiom for "owned in my Collection." In the
first slice, `collection.quantity` comparisons must use positive integer thresholds; reject `collection.quantity = 0`,
`collection.quantity < 1`, `collection.quantity <= 0`, and negative thresholds.
Reject `!=` for `collection.quantity` in the first slice because it would blur positive quantity search with unsupported
zero/missing semantics. Common supported forms include `collection.quantity > 0`, `collection.quantity >= 1`,
`collection.quantity >= 2`, and `collection.quantity = 1`.
Comparisons such as `collection.quantity < 2` are positive Collection searches, not missing-card searches; they only
match
Card Identities with positive matching owned quantity below the threshold.

`collection.locationName` comparisons should be exact and case-sensitive. Consumers should use location names returned
by Collection import or discovery surfaces rather than relying on fuzzy matching.

`collection.finish` means the Finish of an owned Collection Card row. Future printing-level search may add a separate
`printing.finish` queryable meaning the finishes available for a Card Printing, but first-slice Card Query should not
expose printing finish predicates.

Tag filtering should use `tag.id` with an exact Card Identity Tag UUID selected through tag discovery. Card Query should
not perform fuzzy tag discovery. Direct tag filtering can use `=` or `in` over `tag.id`; hierarchy-aware tag filtering
should use `hasTagInHierarchy` over `tag.id` so broad parent tags match descendant taggings. Concrete queryables such as
`tag.slug`, `tag.label`, `tag.alias`, and `tag.weight` are exact/direct tag queryables in the first slice; they do not
perform fuzzy tag discovery and they do not imply hierarchy-aware matching unless used through `hasTagInHierarchy` with
a
resolved `tag.id`.

## First Operators

Start with a bounded operator set:

- Boolean operators: `and`, `or`, `not`.
- Scalar comparison operators: `=`, `!=`, `<`, `<=`, `>`, `>=`.
- Text operators: `contains`.
- Set/list operator: `in`.
- MTG-specific operators and expressions: `colorIdentitySubsetOf`, `hasTagInHierarchy`.

Avoid regex, arbitrary functions, property-property comparisons, and raw SQL escape hatches in the first implementation.

String equality and inequality operators should be exact comparisons. Text search operators such as `contains` should be
case-insensitive. This keeps exact identifiers and source names predictable while preserving ergonomic text search for
names, type lines, Oracle text, and similar fields.

`in` is an exact scalar/list operator for properties where `=` is valid. Empty lists, mixed-type lists, and incompatible
property/list pairings should fail validation. For `tag.id`, `in` matches direct tag IDs only; hierarchy-aware tag
matching should use `hasTagInHierarchy`.

Color Identity filters should support both exact matching and Commander-style subset matching.
`identity.colorIdentity = "BG"` means exactly Golgari Color Identity. `identity.colorIdentity in ["", "B", "G", "BG"]`
means exact match against one of those identities. `colorIdentitySubsetOf(identity.colorIdentity, "BG")` means legal
within a Golgari Commander deck and should match colorless, mono-black, mono-green, and Golgari cards.

`hasTagInHierarchy` is exact and taxonomy-aware: it accepts `tag.id` plus a single Card Identity Tag UUID, matches cards
directly tagged with that tag or cards tagged with descendants of that tag, and never performs tag discovery or fuzzy
matching. Use boolean `or` groups for multiple tag IDs. Weights and annotations belong to the direct Card Identity
Tagging that caused the match; inherited tag projections may expose that direct tagging's weight as `weight`.

## Result Shape

The first slice returns compact `CardQueryResultItem` projections and the applied `limit`, not full Card Identity
details. It does not return `totalCount`, `pageInfo`, cursors, offsets, or any exact count of additional matches. If the
number of returned items equals the applied `limit`, the agent may infer that more matching cards might exist, but the
response does not promise an exact remaining count.

Each compact result item should include enough data for the agent to choose whether to fetch details:

- Card Identity ID and name.
- Mana cost and Mana Value.
- Type line.
- Truncated Oracle text when useful.
- Color Identity.
- Optional legality map from format to legality value only for formats requested through `include.legalities`.
- Game Changer flag.
- EDHREC rank.
- Optional compact tag summaries through `include.tags`, following the Scryfall Tagger-style pattern of direct tags
  attached to the card plus an `inherits` section of broader tags derived from the hierarchy. This supports agents
  finding related cards without dumping full descendant subtrees. The result shape should group tags as `tags.direct`
  and `tags.inherits` so agents do not confuse direct taggings with inherited context.
- Optional included Collection Card rows that matched the query when `include.collectionCards` is true.

When `include.tags` is true, `tags.direct` should include all direct Card Identity Taggings for the result card, and
`tags.inherits` should include all broader Inherited Card Identity Tags derived from those direct taggings.
`tags.inherits.weight` should use the weight from the direct tagging that caused the inherited tag to apply; if multiple
direct taggings inherit the same broader tag with different weights, keep the strongest weight. Do not include
path/provenance by default.

`include.tags` should be boolean-only in the first slice. `true` includes both `tags.direct` and `tags.inherits` in the
compact documented shape. Omitted or `false` means tags are not projected. Reject structured tag include options until a
real workflow needs them.

When `include.collectionCards` is true, result items should include only the compact Collection Card rows that matched
the query's Collection predicates. If no Collection predicates are present, include all owned Collection Card rows for
each returned Card Identity. Omitted or `false` means Collection Card rows are not projected. `include.collectionCards`
should be boolean-only in the first slice; reject structured Collection include options until a future dedicated
copy-matching service needs them.
When `collection.quantity` is used as an aggregate over matching rows, included Collection Card rows should be the rows
that contributed to the matching aggregate scope. For example, `collection.locationType = "binder" AND
collection.quantity
> = 2` returns the binder rows whose quantities were summed for the match.
For mixed `OR` queries where some branches contain Collection predicates and other branches are reference-only, identities
that match only a reference-only branch may return with an empty `collectionCards` array when `include.collectionCards`
> is
> true.

First-slice included `collectionCards` rows should be compact but assembly-useful:

- `collectionCardId`
- `quantity`
- `locationName`
- `locationType`
- `finish`
- `altered`
- `misprint`
- `condition`
- `cardPrintingId`
- `printedName`
- `setCode`
- `collectorNumber`
- `language`

Do not include purchase price, purchase currency, source row number, or added date until a concrete deck-building or
Collection browsing workflow needs them.
Preserve one projected row per imported `CollectionCard` row. Do not merge rows in the first slice; `quantity` carries
the
source row quantity, and row granularity preserves condition, location, finish, and printing distinctions. Aggregation
is
used for filtering through `collection.quantity`, not for projection.

Use detail tools for full Card Identity records, parts, broader legality data, tags, and longer text. Add optional
bounded match reasons later only if real agent traces show they improve deck-building quality.

## Natural-Language Scenarios

Use these scenarios as design fixtures when testing whether the query shape stays useful:

- Find Commander-legal cards within this commander's Color Identity that support sacrifice.
- Find owned binder cards that are ramp or mana fixing for a Golgari deck.
- Find owned Collection rows outside the Existing Deck named `Meren` that are tagged as recursion.
- Find Commander-legal removal spells in Dimir colors, preferring owned cards and low EDHREC ranks.
- Find cards in the Collection Location `Trade Binder` that should be excluded from a Deck Candidate.
- Find potential commanders for a +1/+1 counters strategy in Abzan colors.
- Find Game Changers in a proposed Deck Candidate so the agent can explain Commander Bracket risk.

## Follow-Up Decisions

- Current implementation gap: Card Query currently evaluates much of the query in TypeScript after loading local rows.
  A later hardening pass should push supported predicates, sorting, and Collection quantity aggregation into SQL so the
  database does the filtering work and the agent receives only bounded result sets.
- Priority implementation gap: `include.tags` projects direct tags and keeps the documented `tags.inherits` field, but
  inherited tag projection is not populated yet. This is a meaningful Card Query completeness gap because agents need
  inherited tag context to find and explain broader functional card groups without over-querying. Hierarchy-aware
  filtering through `hasTagInHierarchy` is separate from projection and may work before inherited tags are returned in
  `tags.inherits`.
- Required cleanup: make `identity.gameChanger` a required boolean end to end, including import validation, domain type,
  SQLite schema, query result type, and tests.
- Future Collection Pull List and Availability service shape after Card Query.
