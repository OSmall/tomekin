# Card Query Plan

This plan captures the next search-tool direction after ManaBox Collection import. The goal is to replace temporary
narrow card search tools with a structured Card Query capability that gives the deck-building agent flexible retrieval
over joined card reference and Collection data without exposing raw database access.

## Resolved Direction

- Card Query is the canonical term for structured agent-facing card search.
- The first slice should favour bounded positive retrieval with obvious agent semantics over SQL-like or Scryfall-like
  expressiveness. Richer negation, anti-existence, and relationship-wide semantics should be added only when real agent
  workflows justify the added language.
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
  `identity.gameChanger` is now required end to end across import validation, domain type, SQLite schema, query result
  type, and tests.
- Do not include null-checking operators in the first slice. Omitted predicates mean unconstrained fields; comparisons
  and text predicates over nullable facts do not match absent values. Sorting should place absent values last for
  nullable
  sortable properties in both ascending and descending directions.
- Card Query validation should be strict and should prefer obvious agent semantics over maximum expressiveness. Unknown
  fields, operators, queryables, invalid operator/property pairings, wrong value types, invalid enum values, empty
  boolean groups, invalid `sortby` properties, and excessive limits should return descriptive validation errors rather
  than being coerced, ignored, or partially applied.
- `not` is supported only for single-valued reference predicates in the first slice. Reject `not` when its subtree
  contains any relationship-backed `collection.*` or `tag.*` predicate so anti-existence search is not accidentally
  expressed through implementation-dependent join semantics.
- Collection predicates are positive owned-row search only in the first slice.
  Reject `!=` for all `collection.*` predicates in the first slice for the same reason; require positive equality,
  positive quantity comparison, or other explicitly positive row-matching predicates instead.
  Anti-existence Collection search is deferred rather than impossible; if it becomes useful, add explicit identity-level
  existence semantics instead of overloading row-level negation.
- Tag predicates are also positive relationship search only in the first slice. Reject `!=` for `tag.*` predicates so
  cards with multiple attached tags are not accidentally matched just because one attached tag differs from the
  requested
  tag. If "cards without tag X" becomes useful, add explicit anti-existence semantics later.
- Validation should use the core Result/AsyncResult style so consumers receive typed failures with descriptive
  Zod-derived details instead of thrown validation exceptions.
- Card Query validation failures should use a transport-neutral core shape inspired by HTTP Problem Details but not
  pretending to be an HTTP response. Use a top-level `code`, `message`, and `issues` array. Each issue should include an
  RFC 6901 JSON Pointer such as `#/filter/args/1/args/0/property`, a machine-readable `code`, a human-readable
  `message`,
  and optional context such as `allowedValues`. HTTP adapters may translate this to RFC 9457 Problem Details at the
  edge.
- Validation should return all reasonably discoverable envelope-level and filter-level issues in one response rather
  than failing fast at the first issue. It does not need perfect exhaustive reporting inside malformed subtrees.
- Validation issue `code` values should be stable product-level codes where practical, even when they are derived from
  Zod internally. Use specific codes such as `unknown_field`, `invalid_operator`, `invalid_queryable`, `invalid_value`,
  `duplicate_value`, `too_small`, `too_large`, and `invalid_collection_semantics` rather than exposing unstable library
  details when a product code is clearer.
- Include `allowedValues` whenever the valid set is finite and useful, such as operators, queryables, sortable
  properties,
  supported legality include formats, legality values, and Collection enum values. Do not include `allowedValues` for
  unbounded numeric constraints such as the `limit` range.
- Validation issue pointers should target the most specific offending value available. Unknown keys should produce one
  issue per unknown key at that key's pointer. Duplicate values should point to the later duplicate occurrence, such as
  `#/sortby/1/property` or `#/include/legalities/1`. Cross-field or container-level errors should point to the smallest
  responsible container, such as `#/filter/args` for an empty boolean group.
- Stop atomic value validation when the queryable property itself is invalid, because value compatibility depends on the
  property type.
- The first slice supports `limit` only. Do not add `offset`, `cursor`, `page`, or `after` until a real workflow
  requires pagination and its semantics are designed.
- Omitted `filter` is valid and means unconstrained Card Identity browse. Empty boolean groups such as `and` or `or`
  with
  no arguments are invalid.
- Omitted optional envelope fields mean default or unconstrained behaviour. Explicit `null` values are invalid for
  `filter`, `sortby`, `include`, and `limit`. `filter: {}` is invalid because it lacks an operator. `include: {}` is
  valid
  and behaves like omitted `include`. `sortby: []` and `include.legalities: []` are invalid because present-but-empty
  arrays are likely agent mistakes.
- When `sortby` is omitted, default ordering should be `identity.id asc`.
- Deterministic ordering for explicit `sortby` should append stable internal tie-breakers after user-requested sort
  fields.
  Append `identity.id asc` unless the request already sorts by `identity.id`.
- `sortby` should map allowed sort properties to repository/database ordering with explicit null-last ordering for
  nullable sortable values. If the agent wants to exclude absent values, it should express that through supported
  filters
  rather than expecting sort semantics to imply a filter.
- Sorting by `collection.quantity` uses the same positive Collection row scope as Collection filtering and projection.
  With no other Collection predicates in the branch, it orders by summed owned quantity across the whole Collection.
  With
  Collection row predicates such as `collection.locationType = "binder"`, it orders by summed quantity for the matching
  scoped rows. If an identity matches only a reference-only branch with no retained Collection scope, it sorts as
  quantity `0`.
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
  strings, `null`, and values over `200` rather than coercing them. Do not add an internal override for the agent-facing
  parser; if a future internal batch operation needs larger scans, add a separate admin capability.

The first `include` envelope should accept only these fields:

- `legalities`: optional non-empty array of supported format strings, initially only `"commander"`; reject duplicates.
- `tags`: optional boolean.
- `collectionCards`: optional boolean.

Reject unknown include keys and structured options for `tags` or `collectionCards` in the first slice. All `include`
fields are projection-only and must never constrain matching. Matching is controlled only by `filter`.

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

`legality.commander` filtering should accept all persisted Scryfall legality values: `legal`, `not_legal`, `banned`, and
`restricted`. Persisted source legality data may be broader than the first-slice include projection formats.

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
quantity is applied after other Collection row-scoping predicates in the same branch, so the quantity comparison uses
the
sum of the already-scoped rows. Collection predicates are branch-local under normal boolean semantics. An `AND` branch
containing a non-quantity `collection.*` predicate requires owned Collection Card rows for that branch, while a separate
reference-only `OR` branch may still match unowned Card Identities. Use `collection.quantity > 0` as the first-slice
idiom
for "owned in my Collection." In the first slice, `collection.quantity` comparisons must use positive integer
thresholds;
reject `collection.quantity = 0`, `collection.quantity < 1`, `collection.quantity <= 0`, and negative thresholds.
Reject `!=` for all `collection.*` predicates in the first slice because it is too easy to confuse row-level inequality
with anti-existence search. Use positive predicates instead. For example, `collection.altered = false` means there is at
least one owned non-altered Collection Card row that could be used for assembly; it does not mean the Card Identity has
zero altered copies anywhere in the Collection. The same row-level positive matching rule applies to
`collection.misprint`. Common supported quantity forms include `collection.quantity > 0`, `collection.quantity >= 1`,
`collection.quantity >= 2`, and `collection.quantity = 1`.
Comparisons such as `collection.quantity < 2` are positive Collection searches, not missing-card searches; they only
match Card Identities with positive matching owned quantity below the threshold.

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
`tag.weight` supports exact enum matching through `=` and `in` in the first slice; do not add ranked comparisons such as
`tag.weight > "median"` until a real workflow needs strength-threshold semantics.
Reject `!=` for `tag.*` predicates in the first slice because Card Identities can have multiple direct tags. For
example,
`tag.slug != "ramp"` could otherwise be confused between "has at least one attached tag that is not ramp" and "has no
ramp tag."

Independent tag identity predicates in an outer `and` should remain independent relationship searches so Card Query can
express common multi-tag searches such as "draw and ramp." To require a tag concept and tag metadata on the same Card
Identity Tagging row, use the explicit `withTagging` relationship-scope operator. For example, "strong draw" should be
expressed by placing both the draw hierarchy predicate and `tag.weight = "strong"` inside one `withTagging` child
filter,
so a weak draw tag plus an unrelated strong ramp tag does not match. The companion `withCollectionCard` operator
provides
the same explicit scoping pattern for Collection rows; simple Collection predicates remain available as ergonomic
owned-row shorthand. Detailed operator semantics are recorded in
[`sql-backed-card-query-repository.md`](./sql-backed-card-query-repository.md).

## First Operators

Start with a bounded operator set:

- Boolean operators: `and`, `or`, `not`.
- Scalar comparison operators: `=`, `!=`, `<`, `<=`, `>`, `>=`.
- Text operators: `contains`.
- Set/list operator: `in`.
- MTG-specific operators and expressions: `colorIdentitySubsetOf`, `hasTagInHierarchy`.
- Relationship-scope operators: `withTagging`, `withCollectionCard`.

Avoid regex, arbitrary functions, property-property comparisons, and raw SQL escape hatches in the first implementation.

`not` is supported only for single-valued reference predicates in the first slice. Reject `not` over any subtree
containing a relationship-backed `collection.*` or `tag.*` predicate, because those predicates mean positive
relationship
search and should not be overloaded into missing/unowned, no-copies-in-location, or no-tag anti-existence queries.

Where allowed, string equality and inequality operators should be exact comparisons. Text search operators such as
`contains` should be case-insensitive. This keeps exact identifiers and source names predictable while preserving
ergonomic text search for names, type lines, Oracle text, and similar fields.

`in` is an exact scalar/list operator for properties where `=` is valid. Empty lists, mixed-type lists, and incompatible
property/list pairings should fail validation. Reject `in` for boolean properties because `[true, false]` is equivalent
to no predicate and single-item boolean arrays are just equality with extra ceremony. For `tag.id`, `in` matches direct
tag IDs only; hierarchy-aware tag matching should use `hasTagInHierarchy`.

Ordering comparison operators `<`, `<=`, `>`, and `>=` are supported only for numeric queryables: `identity.manaValue`,
`identity.edhrecRank`, and `collection.quantity`. Reject ordering comparisons over strings, booleans, Color Identity,
legality values, and tag weights in the first slice. Use `sortby` for result ordering and exact `=`, `!=`, or `in` where
those operators are valid for filtering.

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
- `totalQuantity`, the owned Collection quantity for the returned Card Identity under the active Collection row scope.
- Optional included Collection Card rows that matched the query when `include.collectionCards` is true.

When `include.tags` is true, `tags.direct` should include all direct Card Identity Taggings for the result card, and
`tags.inherits` should include broader ancestor Inherited Card Identity Tags derived from those direct taggings.
Inherited projection should not include descendant tags, and an ancestor tag that is already directly tagged should
remain
only in `tags.direct`, not duplicated in `tags.inherits`.
`tags.inherits.weight` should use the weight from the direct tagging that caused the inherited tag to apply; if multiple
direct taggings inherit the same broader tag with different weights, keep the strongest weight. Do not include
path/provenance by default. Inherited tag annotations should be `null` in the first slice because direct-tag annotations
may not describe the broader inherited tag accurately.

`include.tags` should be boolean-only in the first slice. `true` includes both `tags.direct` and `tags.inherits` in the
compact documented shape. Omitted or `false` means tags are not projected. Reject structured tag include options until a
real workflow needs them. `include.tags` is projection-only; untagged matching Card Identities should still appear with
empty `tags.direct` and `tags.inherits` arrays when tags are included.
Inherited tag projection should traverse broader ancestor tags defensively and de-duplicate visited hierarchy nodes so a
malformed hierarchy cycle cannot hang Card Query. The Scryfall tag import path should own hierarchy validation; Card
Query should return best-effort tag projections and emit a non-failing warning/diagnostic through the available logging
mechanism when traversal detects a cycle.
Tag projections should be deterministic. Sort direct and inherited tags by strongest weight first using
`very_strong`, `strong`, `median`, `weak`, then label or slug ascending, then tag ID as a final tie-breaker.

When `include.collectionCards` is true, result items should include only the compact Collection Card rows that matched
the query's Collection predicates. If no Collection predicates are present, include all owned Collection Card rows for
each returned Card Identity. Omitted or `false` means Collection Card rows are not projected. `include.collectionCards`
should be boolean-only in the first slice; reject structured Collection include options until a future dedicated
copy-matching service needs them.
Every result item should include `totalQuantity` regardless of `include.collectionCards`. It uses the same active
Collection row scope as `collection.quantity`, so a location-filtered query reports the quantity in that location, not
the Card Identity's total owned quantity elsewhere. If no Collection predicate is present, `totalQuantity` is the total
owned quantity across the whole Collection. Unowned identities and identities that only matched a reference-only branch
in a mixed `OR` query report `0` for the scoped total.
`include.collectionCards` is projection-only and must never constrain matching. A reference-only query with
`include.collectionCards: true` remains unowned-capable; owned matching identities include their owned rows, and unowned
matching identities include an empty `collectionCards` array.
When `collection.quantity` is used as an aggregate over matching rows, included Collection Card rows should be the rows
that contributed to the matching aggregate scope. For example, `collection.locationType = "binder" AND
collection.quantity >= 2` returns the binder rows whose quantities were summed for the match.
For mixed `OR` queries where some branches contain Collection predicates and other branches are reference-only, identities
that match only a reference-only branch may return with an empty `collectionCards` array when `include.collectionCards`
is true.
If such an identity has owned Collection Card rows that did not contribute to a matching Collection branch, those rows
should still be omitted. Included Collection Card rows are match evidence for the Collection branch, not an
all-owned-copy
projection for every returned Card Identity.
For `OR` queries with multiple Collection branches, each branch keeps its own row scope and quantity aggregation. Do not
combine rows from separate `OR` branches to satisfy a branch-local quantity predicate. If a Card Identity matches
multiple
Collection branches, included Collection Card rows should be the union of rows that contributed to any matching branch.
When an outer `AND` establishes a Collection row scope, such as `collection.quantity > 0`, and an inner `OR` branch is
reference-only, a Card Identity that matches through that reference-only branch still retains the outer Collection scope
as match evidence. `include.collectionCards` and `sortby: collection.quantity` should use that retained outer scope for
the matched identity.

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
the source row quantity, and row granularity preserves condition, location, finish, and printing distinctions.
Aggregation is used for filtering through `collection.quantity` and for the scalar `totalQuantity` projection. It is not
used to merge `collectionCards` rows.

Use detail tools for full Card Identity records, parts, broader legality data, tags, and longer text. Add optional
bounded match reasons later only if real agent traces show they improve deck-building quality.

## SQL-Backed Implementation Shape

Detailed implementation handoff for the SQL-backed repository replacement lives in
[`sql-backed-card-query-repository.md`](./sql-backed-card-query-repository.md). That plan records the explicit
relationship-scope operators, SQL compiler shape, rollout slices, and required semantic tests.

The SQLite Card Query implementation should keep the core `CardQueryRepository` port and `CardQueryInput`/
`CardQueryResult` contract unchanged. SQL pushdown is an internal SQLite adapter concern, not an agent-facing API
change.
Supported predicates, sorting, limiting, and Collection quantity aggregation should be executed by SQLite rather than by
loading all Card Identities, tags, legalities, and Collection rows into TypeScript. TypeScript may still assemble the
already-constrained SQL rows into the nested `CardQueryResultItem` shape.

This should be a replacement of the current in-memory SQLite Card Query repository, not a production fallback or
parallel
implementation. The public Card Query tool shape and documented feature set should remain stable: existing envelope
fields, queryables, operators, includes, sorting, and limits should stay available. During development, the old
evaluator
may be useful as a temporary test oracle, but the final SQLite adapter should have one SQL-backed implementation for
supported Card Queries. The old evaluator's accidental behaviour should not define the new implementation; where
behaviour
needs clarification, use this plan's documented SQL-backed semantics as the source of truth.

The primary query should be identity-first: it should return at most one row per Card Identity, apply identity-level
ordering and `limit`, and use bounded follow-up queries to hydrate requested includes for the final Card Identity IDs.
This avoids multiplying rows when a Card Identity has many Collection Card rows, legalities, and Card Identity Taggings.

Collection predicates should compile into joined `collection_card` / `collection_location` row restrictions, grouped
back
to Card Identity. `collection.quantity` is an aggregate over the matching Collection row scope and should be expressed
in
`HAVING`, not as a scalar `WHERE` predicate. For example, a query for owned foil cards in a specific Collection Location
with more than one matching copy has this shape:

```sql
select
  ci.id,
  ci.name,
  sum(cc.quantity) as collection_quantity
from card_identity ci
join card_printing cp
  on cp.card_identity_id = ci.id
join collection_card cc
  on cc.card_printing_id = cp.id
join collection_location cl
  on cl.id = cc.collection_location_id
where cl.id = ?
  and cc.finish = 'foil'
group by ci.id
having sum(cc.quantity) > 1
order by ci.name asc
limit ?;
```

Tag and legality predicates should normally be compiled as identity-level `exists` subqueries rather than joined into
the
same Collection aggregate query. Joining multiple one-to-many relationships into the same aggregate query can multiply
Collection rows and inflate `sum(cc.quantity)`. A query for owned cards with a direct `draw` tag should therefore keep
Collection ownership in the grouped join and use `exists` for the tag predicate:

```sql
select
  ci.id,
  ci.name,
  sum(cc.quantity) as collection_quantity
from card_identity ci
join card_printing cp
  on cp.card_identity_id = ci.id
join collection_card cc
  on cc.card_printing_id = cp.id
where exists (
  select 1
  from card_identity_tagging cit
  join card_identity_tag tag
    on tag.id = cit.tag_id
  where cit.card_identity_id = ci.id
    and tag.slug = 'draw'
)
group by ci.id
having sum(cc.quantity) > 0
order by ci.name asc
limit ?;
```

Deck-building concept searches should usually resolve the intended Card Identity Tag first and use
`hasTagInHierarchy(tag.id, <resolved tag id>)` rather than direct slug matching. Hierarchy-aware tag matching should use
a
recursive CTE to include the resolved tag and all descendant tags:

```sql
with recursive tag_scope(tag_id) as (
  select ?
  union
  select h.child_tag_id
  from card_identity_tag_hierarchy h
  join tag_scope scope
    on h.parent_tag_id = scope.tag_id
)
select
  ci.id,
  ci.name,
  sum(cc.quantity) as collection_quantity
from card_identity ci
join card_printing cp
  on cp.card_identity_id = ci.id
join collection_card cc
  on cc.card_printing_id = cp.id
where exists (
  select 1
  from card_identity_tagging cit
  where cit.card_identity_id = ci.id
    and cit.tag_id in (select tag_id from tag_scope)
)
group by ci.id
having sum(cc.quantity) > 0
order by ci.name asc
limit ?;
```

When `include.collectionCards` is true, hydrate Collection Card rows in a bounded follow-up query for the final Card
Identity IDs. If the filter contains Collection predicates, return only the Collection rows that contributed to matching
Collection branches. If the filter contains no Collection predicates, return all owned Collection rows for each returned
Card Identity. Likewise, `include.legalities` and `include.tags` should be hydrated by bounded follow-up queries for the
final IDs rather than by expanding the primary aggregate query.

## Natural-Language Scenarios

Use these scenarios as design fixtures when testing whether the query shape stays useful:

- Find Commander-legal cards within this commander's Color Identity that support sacrifice.
- Find owned binder cards that are ramp or mana fixing for a Golgari deck.
- Find owned cards in a specific Collection Location that are tagged as recursion.
- Find Commander-legal removal spells in Dimir colors, preferring owned cards and low EDHREC ranks.
- Find cards in the Collection Location `Trade Binder` that should be excluded from a Deck Candidate.
- Find potential commanders for a +1/+1 counters strategy in Abzan colors.
- Find Game Changers in a proposed Deck Candidate so the agent can explain Commander Bracket risk.

## Follow-Up Decisions

- SQL-backed repository rollout should follow the slices in
  [`sql-backed-card-query-repository.md`](./sql-backed-card-query-repository.md): first add the explicit
  relationship-scope
  operators and agent guidance, then add semantic repository tests that lock the intended SQL-backed behaviour, then
  replace the in-memory SQLite Card Query evaluator with the SQL-backed implementation. This keeps the rewrite safer and
  avoids accidentally preserving undocumented behaviour from the old evaluator.
- Priority implementation gap: strict Card Query validation coverage is still thin. Add core parser tests for every
  documented invalid input class, then fix `parseCardQueryInput` until those tests pass before relying on repository
  behaviour.
- Current implementation gap: Card Query currently evaluates much of the query in TypeScript after loading local rows.
  A later hardening pass should push supported predicates, sorting, and Collection quantity aggregation into SQL while
  preserving the documented positive row-scope, branch-scope, projection, and sorting semantics.
- Priority implementation gap: `include.tags` projects direct tags and keeps the documented `tags.inherits` field, but
  inherited tag projection is not populated yet. This is a meaningful Card Query completeness gap because agents need
  inherited tag context to find and explain broader functional card groups without over-querying. Hierarchy-aware
  filtering through `hasTagInHierarchy` is separate from projection and may work before inherited tags are returned in
  `tags.inherits`.
- Future Collection Pull List and Availability service shape after Card Query.
- Future explicit identity-level Collection existence semantics, such as owned/unowned or no copies in a location, if
  real
  agent workflows need anti-existence search.
