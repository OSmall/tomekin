# Card Query

Card Query is Tomekin's current public contract for structured, agent-facing card retrieval. It exposes a bounded,
Card Identity-rooted language over local reference and Collection data without exposing SQL, tables, arbitrary joins,
or physical schema details. Product workflows that use this contract are described in
[`product-behavior.md`](./product-behavior.md).

[ADR 0019](./adr/0019-provider-backed-scryfall-card-search.md) adopts provider-backed Scryfall-syntax search as the
normal discovery path after implementation. The existing DSL will remain an explicitly enabled legacy capability;
this document continues to describe the delivered contract and does not imply that the transition has shipped.

Domain terms are defined in the [glossary](../CONTEXT.md), and the related persisted records are defined in
[`data-model.md`](./data-model.md). The rationale for the query language and SQLite compilation boundary is retained in
ADRs [`0012`](./adr/0012-cql2-shaped-card-queries.md) and
[`0013`](./adr/0013-sql-backed-card-query-repository.md).

The implementation is inspired by CQL2-JSON expression nodes but does not claim CQL2 conformance. `sortby`, `include`,
and `limit` are Tomekin query-envelope fields rather than CQL2 filter members.

## Request Envelope

`query_cards` accepts one strict object with four optional fields:

```ts
type CardQueryInput = {
  filter?: CardQueryFilter;
  sortby?: readonly {property: CardQuerySortableProperty; direction: "asc" | "desc"}[];
  include?: {
    legalities?: readonly CardQueryLegalityFormat[];
    tags?: boolean;
    collectionCards?: boolean;
  };
  limit?: number;
};
```

- Omitted `filter` means unconstrained Card Identity browsing.
- Omitted `sortby` means `identity.id asc`.
- Omitted `include` or `include: {}` requests only the fixed result fields.
- Omitted `limit` applies `50`; the accepted range is 1 through 200.
- Explicit `null`, unknown fields, empty `sortby`, empty `include.legalities`, and duplicate sort or legality entries are
  invalid. The parser does not coerce malformed values.

A filter node has an `op` and `args`. Property operands have the form `{"property": "identity.name"}`. Boolean groups
must contain at least one child.

## Validation and Errors

Validation occurs before repository execution and returns a typed failure rather than partially applying or silently
ignoring input:

```ts
type CardQueryError =
  | {
      type: "validation_error";
      code: "invalid_card_query";
      message: string;
      issues: readonly {
        pointer: string;
        code: string;
        message: string;
        allowedValues?: readonly string[];
      }[];
    }
  | {type: "repository_error"; message: string};
```

That is the core Card Query port's error type. The public `query_cards` Agent Tool first checks reference readiness, so
its full failure surface also includes:

- `reference_data_unready`, with a message plus `missingBulkDataTypes` and `reimportRequiredBulkDataTypes`; and
- `tool_error` when the readiness repository itself cannot be queried.

The tool returns no Card Query result until compatible required Scryfall datasets are ready.

Issue pointers are RFC 6901 JSON Pointers rooted at `#`, and each issue targets the most specific offending value the
parser can identify. Finite valid sets include `allowedValues` where useful. Validation accumulates reasonably
discoverable envelope and filter issues, although a structurally malformed subtree may prevent deeper checks.

Stable product-level issue codes include `unknown_field`, `invalid_type`, `invalid_operator`, `invalid_queryable`,
`invalid_value`, `invalid_enum_value`, `invalid_string`, `invalid_length`, `duplicate_value`, `too_small`, `too_large`,
`invalid_relationship_scope`, and `invalid_collection_semantics`.

## Queryable Allowlist

Only the following property paths are public queryables.

| Family | Properties |
| --- | --- |
| Card Identity | `identity.id`, `identity.name`, `identity.typeLine`, `identity.oracleText`, `identity.manaValue`, `identity.colorIdentity`, `identity.colors`, `identity.gameChanger`, `identity.edhrecRank` |
| Scryfall legality | `legality.commander`, `legality.standard`, `legality.pioneer`, `legality.modern`, `legality.legacy`, `legality.vintage`, `legality.pauper` |
| Card Identity Tagging | `tag.id`, `tag.slug`, `tag.label`, `tag.alias`, `tag.weight` |
| Collection Card | `collection.quantity`, `collection.locationName`, `collection.locationType`, `collection.finish`, `collection.altered`, `collection.misprint` |
| Card Printing and Set | `printing.setCode`, `printing.setType`, `printing.promoType`, `printing.universesBeyond` |

Casual 60 deliberately has no Scryfall legality queryable. Valid legality values are `legal`, `not_legal`, `banned`,
and `restricted`. Color Identity values use canonical WUBRG order, with the empty string representing colorless.
Collection Location type is `binder` or `deck`; Finish is `nonfoil`, `foil`, or `etched`; Tag weights are
`very_strong`, `strong`, `median`, or `weak`.

Sortable properties are limited to `identity.id`, `identity.name`, `identity.manaValue`, `identity.colorIdentity`,
`identity.edhrecRank`, and `collection.quantity`.

## Operator Allowlist

| Operators | Contract |
| --- | --- |
| `and`, `or` | One or more child filters. Branch structure is significant for relationship evidence and quantity. |
| `not` | Exactly one child; supported only inside `withPrinting` or `withoutPrinting`. It is invalid over `printing.promoType`. |
| `=`, `!=` | Exact scalar comparison. `!=` is invalid for Tag and Collection properties. Printing properties do not support it. |
| `<`, `<=`, `>`, `>=` | Numeric comparison only for Mana Value, EDHREC rank, and Collection quantity. |
| `contains` | Case-insensitive substring search for identity name, type line, or Oracle text. |
| `in` | Exact match against a non-empty, consistently typed list. It is invalid for booleans. |
| `colorIdentitySubsetOf` | Matches Card Identities whose colors are a subset of one supplied Color Identity. |
| `hasTagInHierarchy` | Accepts a Tag UUID and matches direct tagging with that Tag or any descendant. |
| `withTagging` | Requires its child Tag predicates to match one Card Identity Tagging row. |
| `withCollectionCard` | Applies its child Collection predicates to one explicit Collection row scope. |
| `withPrinting` | The Card Identity has at least one Printing satisfying the child predicate. |
| `withoutPrinting` | The Card Identity has no Printing satisfying the child predicate. |

`printing.setCode` and query values are normalized to lowercase. Set code, Set type, and promo type support `=` and
`in`; `printing.universesBeyond` supports `=` only. Printing predicates are invalid outside a Printing scope, nested
relationship scopes are invalid, and a Printing scope may contain only Printing properties and boolean groups over
them.

Collection quantity comparisons express positive owned-row retrieval. Equality with zero, greater-than-or-equal to
zero, less-than one, negative values, and all Collection `!=` predicates are rejected because they would imply
ambiguous absence semantics. Use `collection.quantity > 0` to require ownership.

## Relationship Matching

Relationship predicates outside a scope are independent identity-level tests. For example, two outer
`hasTagInHierarchy` predicates joined by `and` may match two different direct taggings on the same Card Identity. Use
`withTagging` when Tag identity and metadata must correlate on one tagging row, such as “a strong draw tagging.”

Simple Collection predicates are shorthand for a progressively narrowed matching Collection row scope. Use
`withCollectionCard` to make that scope explicit for complex groups. A quantity predicate sums the rows remaining in
the active scope; it is not a predicate on each individual source row.

Each `withPrinting` or `withoutPrinting` child describes one correlated Printing scope. Set and promo predicates inside
one `withPrinting(and(...))` must be true of the same Printing. Separate Printing scopes are independent identity-level
tests. Printing and Collection predicates are also independent: an identity may have an acceptable Printing and owned
copies from a different Printing. Card Query does not select an exact owned copy satisfying a Printing predicate.

## Collection Quantity and Evidence

When no Collection row predicate establishes a scope, `collection.quantity` and `totalQuantity` mean the sum of all
owned rows for the Card Identity. Sorting by Collection quantity alone does not filter unowned cards; they sort as zero.

Inside an `or`, each Collection branch retains its own row scope and quantity aggregation. Rows from separate branches
cannot combine to satisfy a branch-local quantity predicate. If an outer `and` first unions location alternatives and a
following quantity predicate is applied, quantity is calculated over that union.

For mixed `or` filters containing both Collection and reference-only branches:

- a Card Identity may match solely through a reference-only branch;
- its scoped `totalQuantity` is then `0`;
- `include.collectionCards` returns an empty array for that identity, even if it owns unrelated rows elsewhere; and
- when multiple Collection branches match, projected rows are the union of the evidence rows from those matching
  branches.

When an outer `and` already establishes a Collection scope, a nested reference-only `or` branch retains that outer
scope. Projection and Collection quantity sorting use the retained rows.

These rules keep owned-row evidence tied to the branch that caused the result rather than presenting unrelated owned
copies as match evidence.

## Projections and Result Envelope

The result contains the applied limit and an ordered list with at most one item per Card Identity:

```ts
type CardQueryResult = {
  limit: number;
  items: readonly CardQueryResultItem[];
};
```

Every item includes Card Identity ID, name, mana cost, Mana Value, type line, Oracle text, Color Identity, Game Changer
flag, EDHREC rank, and `totalQuantity`. Oracle text longer than 500 characters is truncated to 497 characters plus an
ellipsis. The result does not include `totalCount`, page information, cursors, offsets, or a guarantee that all matches
were returned.

Includes are projection-only and never change matching:

- `include.legalities` accepts a non-empty, duplicate-free list drawn from Commander, Standard, Pioneer, Modern,
  Legacy, Vintage, and Pauper and returns only those legality fields.
- `include.tags: true` returns all direct taggings and deduplicated inherited ancestors. Direct and inherited lists sort
  strongest weight first, then label, slug, and Tag ID. An inherited tag takes the strongest supporting direct weight,
  has a null annotation, and is omitted when the same Tag is direct.
- `include.collectionCards: true` returns one compact row per matching imported Collection Card row. With no Collection
  predicate, it returns all owned rows for each result, including an empty array for unowned results.

Each projected Collection row includes its Collection Card ID, quantity, Finish, altered and misprint flags, condition,
Collection Location ID/name/type, Card Printing ID, Printed Name, Set code, collector number, and language. Rows remain
separate; they are not merged across location, condition, Finish, or Printing. Purchase metadata, source row number, and
added date are not projected.

## Deterministic Ordering

Default ordering is `identity.id asc`. Explicit sorts are applied in request order, and `identity.id asc` is appended as
the stable tie-breaker unless already requested. Nullable reference values are last in both ascending and descending
order. Collection quantity sorting uses the same scoped quantity evidence described above.

Collection rows sort by Card Identity, Collection Location name, then Collection Card ID. Direct and inherited Tags use
the deterministic weight and name ordering described in the projection contract. Hydration never changes the primary
Card Identity result order.

## Printing and Set Semantics

Card Query filters Printings but remains rooted at Card Identity. Set-name discovery is a separate local
`search_card_sets` capability; Card Query accepts exact source-faithful Set codes rather than fuzzy Set names.

`printing.universesBeyond` is true when the scoped Printing has the `universesbeyond` promo type. This supports two
important, deliberately different questions:

- `withPrinting(printing.universesBeyond = false)` means the identity has at least one non-Universes Beyond Printing and
  is suitable for acquiring such a Printing, even if it also has a Universes Beyond Printing.
- `withoutPrinting(printing.universesBeyond = true)` means the identity has never had a Universes Beyond Printing and
  excludes an identity as soon as any such Printing exists.

The same acquisition-versus-never-printed distinction applies to Set-family searches: a negated predicate inside
`withPrinting` asks for at least one acceptable Printing, while `withoutPrinting` rejects an identity with any
unacceptable Printing.

## SQLite Authority Boundary

The public contract ends at typed Card Query input and result objects. SQL and the physical schema are internal to the
SQLite adapter.

The adapter compiles validated filters, ordering, limits, and Collection aggregates into parameterized SQL. Query values
are always bound parameters; columns, tables, operators, sort directions, and generated aliases come only from fixed
allowlist mappings. No raw SQL escape hatch or user-controlled identifier exists.

The primary query is Card Identity-first and applies filtering, ordering, and limit before optional hydration. Legalities,
Tags, Collection totals, and requested Collection rows are then loaded only for the final IDs with bounded follow-up
queries and assembled without changing result order. Tag and legality predicates use identity-level existence tests so
their one-to-many rows cannot inflate Collection quantities.

The compiler currently carries logical Collection scopes through generated subqueries. The contract bounds authority
and returned results, but complex allow-lists may still duplicate a logical scope and produce excessive SQL work. The
semantics in this document remain fixed while [issue #40](https://github.com/OSmall/tomekin/issues/40) owns compiling
each logical Collection scope once and proving linear query growth.
