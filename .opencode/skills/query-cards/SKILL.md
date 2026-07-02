---
name: query-cards
description: Use when composing, fixing, or explaining filters for the `query_cards` MTG Agent tool.
---

# Query Cards

Use this reference for the `query_cards` tool. Card Query is structured card retrieval over local Card Identity,
Commander legality, Card Identity Tags, and imported Collection rows. It is not SQL and does not accept arbitrary
property
paths.

## Envelope

`query_cards` accepts only these top-level fields:

- `filter`: optional CQL2-inspired expression object.
- `sortby`: optional non-empty array of `{property, direction}` where direction is `"asc"` or `"desc"`.
- `include`: optional projection object.
- `limit`: optional positive integer, maximum `200`, default `50`.

Omitting `filter` means unconstrained Card Identity browse. `filter: {}` and explicit `null` values are invalid.

## Filter Shape

Every filter node uses `{op, args}`.

```json
{
  "op": "and",
  "args": [
    {"op": "=", "args": [{"property": "legality.commander"}, "legal"]},
    {"op": "contains", "args": [{"property": "identity.typeLine"}, "Creature"]}
  ]
}
```

Boolean operators:

- `and`, `or`: `args` is a non-empty array of filter nodes.
- `not`: `args` is exactly one filter node; do not use over `collection.*` or `tag.*` predicates.
- `withTagging`: `args` is exactly one tag-only child filter. Use when tag metadata must apply to the same Card Identity
  Tagging row.
- `withCollectionCard`: `args` is exactly one Collection-only child filter. Use for explicit Collection row-scope
  grouping
  in complex cases.

Atomic operators:

- `=`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `in`, `colorIdentitySubsetOf`, `hasTagInHierarchy`.

## Queryables

Card Identity and reference queryables:

- `identity.id`
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

Collection queryables:

- `collection.quantity`
- `collection.locationName`
- `collection.locationType`
- `collection.finish`
- `collection.altered`
- `collection.misprint`

Sortable properties:

- `identity.id`
- `identity.name`
- `identity.manaValue`
- `identity.colorIdentity`
- `identity.edhrecRank`
- `collection.quantity`

## Operator Rules

- `contains` works only on `identity.name`, `identity.typeLine`, and `identity.oracleText`; it is case-insensitive.
- `<`, `<=`, `>`, `>=` work only on `identity.manaValue`, `identity.edhrecRank`, and `collection.quantity`.
- `in` is exact list matching where `=` is valid; do not use it for booleans.
- `colorIdentitySubsetOf` works only with `identity.colorIdentity`. It means legal within the given Commander Color
  Identity.
- `hasTagInHierarchy` works only with `tag.id` and a resolved tag UUID. Use `search_card_identity_tags` first.
- For deck-building concepts such as draw, ramp, removal, recursion, protection, sacrifice, or tokens, call
  `search_card_identity_tags` first and query with `hasTagInHierarchy` using the chosen tag ID.
- For multi-tag concept searches such as draw plus ramp, use independent `hasTagInHierarchy` predicates in an outer
  `and`. Do not put both concept predicates in one `withTagging` unless one direct tagging row must satisfy both.
- Use `withTagging` when a tag concept and tag metadata must be true of the same tagging row, such as strong draw.
- `!=` is rejected for `collection.*` and `tag.*` predicates.
- `legality.commander` values include `legal`, `not_legal`, `banned`, and `restricted`.
- Color Identity values are exact WUBRG strings such as `""`, `"G"`, `"UG"`, or `"WUBRG"`.

Inside `withTagging`, only these are allowed:

- `tag.id`, `tag.slug`, `tag.label`, `tag.alias`, `tag.weight`.
- `hasTagInHierarchy` over `tag.id`.
- `and` / `or` groups over those tag predicates.

Do not use `identity.*`, `legality.*`, `collection.*`, nested relationship-scope operators, or `not` inside
`withTagging`.

Inside `withCollectionCard`, only these are allowed:

- `collection.quantity`, `collection.locationName`, `collection.locationType`, `collection.finish`,
  `collection.altered`, `collection.misprint`.
- `and` / `or` groups over those Collection predicates.

Do not use `identity.*`, `legality.*`, `tag.*`, `hasTagInHierarchy`, nested relationship-scope operators, or `not`inside
`withCollectionCard`.

## Collection Rules

Collection predicates are positive owned-row search. They cannot express missing cards, unowned cards, or “no copies in
this location.”

- Use `collection.quantity > 0` or `collection.quantity >= 1` for owned cards.
- Use `list_collection_locations` before exact location filters.
- Use `collection.locationName`, not `collection.location.name`.
- `collection.locationType` is `"binder"` or `"deck"`.
- `collection.locationName` comparisons are exact and case-sensitive.
- Multiple Collection predicates in the same `and` branch scope the same owned rows before quantity is summed.
- Use simple Collection predicates for normal owned-row searches.
- Use `withCollectionCard` when a complex query needs explicit Collection row-scope grouping.
- `sortby: [{"property":"collection.quantity","direction":"desc"}]` sorts by matching scoped quantity where applicable.
  It does not filter to owned cards unless the filter explicitly includes ownership, such as `collection.quantity > 0`.

## Includes

`include` changes projection only; it does not constrain matching.

- `legalities: ["commander"]` includes Commander legality in results.
- `tags: true` includes direct and inherited Card Identity Tag summaries.
- `collectionCards: true` includes compact owned Collection Card rows. If Collection predicates are present, these are
  the rows that matched the Collection branch.
- In mixed `or` queries, `include.collectionCards` is match evidence. It is not automatically all owned copies for cards
  that matched only through a non-Collection branch.

## Examples

Planeswalkers in an Existing Deck:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {"op": "=", "args": [{"property": "collection.locationName"}, "Simic Ramp Control"]},
      {"op": "contains", "args": [{"property": "identity.typeLine"}, "Planeswalker"]},
      {"op": ">", "args": [{"property": "collection.quantity"}, 0]}
    ]
  },
  "include": {"collectionCards": true},
  "sortby": [{"property": "identity.name", "direction": "asc"}],
  "limit": 100
}
```

Owned binder cards:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {"op": "=", "args": [{"property": "collection.locationType"}, "binder"]},
      {"op": ">", "args": [{"property": "collection.quantity"}, 0]}
    ]
  },
  "include": {"collectionCards": true},
  "limit": 50
}
```

Commander-legal cards within Simic Color Identity:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {"op": "=", "args": [{"property": "legality.commander"}, "legal"]},
      {"op": "colorIdentitySubsetOf", "args": [{"property": "identity.colorIdentity"}, "UG"]}
    ]
  },
  "include": {"legalities": ["commander"]},
  "sortby": [{"property": "identity.edhrecRank", "direction": "asc"}],
  "limit": 50
}
```

Text search in Oracle text or type line:

```json
{
  "filter": {
    "op": "or",
    "args": [
      {"op": "contains", "args": [{"property": "identity.oracleText"}, "draw a card"]},
      {"op": "contains", "args": [{"property": "identity.typeLine"}, "Artifact"]}
    ]
  },
  "limit": 25
}
```

Tag workflow:

1. Call `search_card_identity_tags` for the user's concept, such as `ramp` or `recursion`.
2. Pick the intended exact tag ID.
3. Query with `hasTagInHierarchy`.

```json
{
  "filter": {
    "op": "hasTagInHierarchy",
    "args": [{"property": "tag.id"}, "00000000-0000-0000-0000-000000000000"]
  },
  "include": {"tags": true},
  "limit": 50
}
```

Draw plus ramp as independent concepts:

```json
{
  "filter": {
    "op": "and",
    "args": [
      {
        "op": "hasTagInHierarchy",
        "args": [
          {
            "property": "tag.id"
          },
          "00000000-0000-0000-0000-000000000001"
        ]
      },
      {
        "op": "hasTagInHierarchy",
        "args": [
          {
            "property": "tag.id"
          },
          "00000000-0000-0000-0000-000000000002"
        ]
      }
    ]
  },
  "include": {
    "tags": true
  },
  "limit": 50
}
```

Strong draw, where the draw tagging itself must be strong:

```json
{
  "filter": {
    "op": "withTagging",
    "args": [
      {
        "op": "and",
        "args": [
          {
            "op": "hasTagInHierarchy",
            "args": [
              {
                "property": "tag.id"
              },
              "00000000-0000-0000-0000-000000000001"
            ]
          },
          {
            "op": "=",
            "args": [
              {
                "property": "tag.weight"
              },
              "strong"
            ]
          }
        ]
      }
    ]
  },
  "include": {
    "tags": true
  },
  "limit": 50
}
```

Explicit Collection row-scope grouping:

```json
{
  "filter": {
    "op": "withCollectionCard",
    "args": [
      {
        "op": "and",
        "args": [
          {
            "op": "=",
            "args": [
              {
                "property": "collection.locationName"
              },
              "Simic Ramp Control"
            ]
          },
          {
            "op": "=",
            "args": [
              {
                "property": "collection.finish"
              },
              "foil"
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
          }
        ]
      }
    ]
  },
  "include": {
    "collectionCards": true
  },
  "limit": 50
}
```

## Validation Recovery

If `query_cards` returns `validation_error`:

- Read `issues[].pointer`, `code`, `message`, and `allowedValues`.
- Fix the exact property, operator, value, or envelope field called out.
- Do not retry with guessed property paths.
- If a property is unsupported, choose from the queryables above.
- If filtering by Collection Location, call `list_collection_locations` and use the exact `collection.locationName`.
