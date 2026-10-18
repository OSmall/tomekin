# Card Query

Card Query provides provider-backed discovery with `search_cards` and local batched known-card facts with
`lookup_cards`. Both require explicit closed typed selections and return bounded complete envelopes. The retained
CQL2 implementation is available only as explicitly enabled `legacy_query_cards` (`TOMEKIN_ENABLE_LEGACY_QUERY=true`);
it is disabled in the normal tool registry. OpenCode also requires allowing `tomekin_legacy_query_cards` explicitly.
Domain terms are defined in the [glossary](../GLOSSARY.md). Historical CQL2 rationale remains in ADRs 0012/0013.

## Live card discovery

```json
{"q":"t:creature o:draw","unique":"cards","select":{"name":true,"oracle_text":true},"first":175}
```

`search_cards` forwards `q` unchanged and preserves supplied native `unique`, `order`, `dir`, `include_extras`,
`include_multilingual`, and `include_variations`. Omitted controls remain omitted on the initial request; supplied
`next_page` URLs may contain the provider's own defaults. Tomekin neither parses q nor claims an effective rollup,
matched face or matched tag. Prefer `unique: "cards"` for identity discovery and `prints` for an explicit version need.
A representative Printing cannot establish all matching owned versions. Pure live discovery requires no local import.
Collection policy/filtering/evidence is not part of this delivered search slice; no Collection identifiers go upstream.

The selected card projection below is shared with lookup. Search nodes are `{card, unavailable_fields?}` without a
lookup occurrence status. Every card retains Oracle identity; selected Printing facts additionally retain Printing ID.
`mana_value` maps provider `cmc`; reversible presentation records require one distinct face Oracle ID and unambiguous
selected identity-face gameplay facts. Unsupported or ambiguous source content fails explicitly. Local tags use the
same direct/inherited semantics and unavailable-data sidecar as lookup. Introducing tag enrichment binds its successful
import or known absence, plus the Oracle import actually used for local identity/tag resolution; later selectors retain
those dependencies. A newer provider identity absent locally uses `identity_not_in_local_reference_data`, not empty tags. Unrelated imports do not stale pure live cursors.
Provenance is opt-in and lists only local dependencies actually used.

`first` defaults to 175 and accepts 0–200. Repeat fixed q, native controls and effective `include_provenance` with
`after`; `select` and `first` may change. Successful envelopes have complete edges, pageInfo and a stop reason.
`hasNextPage=true` establishes another qualifying card, including on zero-first calls; no card is consumed by
lookahead. Empty source exhaustion is successful. `provider_total` is the latest supplied count, or null;
`scoped_total` remains null even at exhaustion because live traversal is not a frozen census.

Stateless versioned tokens contain request/provider bindings, relevant import revisions and source URL/page,
page-completion flag and raw Printing (`Card.id`) anchor. Mid-page continuation refetches the page and resumes after
exactly one occurrence of the anchor. A missing anchor is `cursor_anchor_not_found`; duplicate anchors are
`provider_error/duplicate_anchor`. Page-end continuation follows the retained supplied next_page without rereading
the old page. Empty pages follow supplied next_page sequentially. No numbered-page synthesis, result buffer,
search store or token expiry is introduced. Static fixtures prove no local loss/replay; upstream changes can still
repeat or omit records, or remove an anchor.

The complete compact escaped JSON envelope has a default 51,200 UTF-8-byte budget. One 120-second budget covers
admission, HTTP, local enrichment, projection and lookahead. A result, face text or tag list is indivisible. Failure
returns complete partial edges and one optional safe `error.cursor`, without pageInfo; metadata growth rolls back
removed edges and recovery position together. Oversized records stay unconsumed. Oversized self-contained positions
fail explicitly; neither automatic narrowing instructions nor spill files are used. Cooperative cancellation can return
safe progress; a killed Worker has no new delivered position and uses the last received cursor/original request.

A host-owned dispatcher spaces actual HTTP starts by at least 500 ms, recomputing from each actual dispatch without
catch-up bursts or an extra post-response delay. A 429 pauses starts for at least 31 seconds from receipt, extended
by a longer valid Retry-After. Cancellation detaches delivery while the owner still observes HTTP; it cannot erase
cooldown. A wait exceeding the remaining scan budget returns `rate_limited` and remaining retry milliseconds.
There is no automatic retry loop. Host HTTP observation has an independent 120-second bound.

One active Tomekin provider process per user/state root is enforced with an exclusive owner directory under
`${XDG_STATE_HOME:-~/.local/state}/tomekin/scryfall`. Pi and OpenCode sessions must share this state root; a second
active provider process fails with actionable setup guidance, even with another database/worktree. Keep one provider
process active at a time. Minimal durable control metadata records only provider/version, wall cooldown deadline and
uncertain-dispatch state; it contains no q, cursors or cards. An interrupted owner, uncertain state or corrupt recovery
state establishes a fresh 31-second quiet period and retains any longer known deadline, reanchored to monotonic time.
Uncertain ownership fails closed for inspection. A crash between receiving an unrecorded longer header and durable
publication cannot reconstruct that unseen value; recovery does not claim otherwise. Persistence failure closes admission.

Info logs contain selected-property names, stage timings, provider/raw/returned counts and exact application/adapter
bytes. Debug deliberately includes q, full incoming/outgoing cursors and decoded positions/import bindings. Operational
logs do not dump complete results. Production defaults to info and retains credential redaction.

## Known-card lookup

`lookup_cards` is the delivered local retrieval contract through Core, SQLite, OpenCode and Pi Worker/fallback.
Collection-policy filtering/evidence and catalogue continuation remain separate work; lookup returns card facts only.

```json
{"references":[{"kind":"name","value":"Sol Ring"},{"kind":"printing_id","value":"073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a"}],"select":{"name":true,"oracle_text":true},"first":50}
```

References are nonempty, ordered `{kind, value}` objects: `oracle_id`/`printing_id` require UUIDs and `name` means an
exact case-sensitive canonical whole identity name. Faces and fuzzy spellings do not resolve separately. Every input
occurrence produces a found card or `not_found` with its original reference, including duplicates and local misses.
A miss establishes neither invalidity nor nonownership. There is no provider fallback or automatic hydration.

`select` is a closed nonempty object: every property is optional literal `true`. Both actual adapter JSON Schemas
enumerate meanings, prohibit additional properties and publish `minProperties: 1`. Selection names are:

- Identity: `oracle_id`, `name`, `layout`, `mana_cost`, `mana_value`, `type_line`, `oracle_text`, `colors`,
  `color_identity`, `color_indicator`, `produced_mana`, `keywords`, `power`, `toughness`, `loyalty`, `defense`,
  `legalities`, `game_changer`, `edhrec_rank`, `card_faces`, `tags`.
- Printing: `printing_id`, `set`, `set_id`, `set_name`, `set_type`, `collector_number`, `lang`, `printed_name`,
  `finishes`, `promo_types`, `tcgplayer_id`, `cardmarket_id`, `printing_layout`.

Every found record includes `oracle_id`; exact Printing references also retain `printing_id`. Other unselected facts
are absent. Printing facts reject a batch containing any Oracle/name reference before record retrieval, including
references before a supplied cursor. `mana_value` maps stored `manaValue` without a `cmc` alias. Colors reconstruct
arrays from stored scalars: null stays null and known colorless becomes `[]`. Produced-mana symbols retain stored
order. Scalar absence is null; known empty associations are arrays/maps. `layout` is canonical gameplay layout;
`printing_layout` is its separate standard/reversible presentation. Printing Set fields join the exact local Set,
`printed_name` never falls back to the canonical name, and `finishes` describes supported versions rather than an
owned copy's Finish. Legalities include the complete imported map without fabricated Casual 60 entries.

`oracle_text` preserves its complete top-level value, including null, plus each existing ordered face's name/text.
`card_faces` requests the complete face projection: name, mana_cost, type_line, oracle_text, colors,
color_indicator, power, toughness, loyalty and defense. Selecting both returns the fuller faces once. Ordinary cards
have no invented faces; explicit `card_faces` returns `[]`. Nothing is concatenated, matched-face-inferred or clipped.

`tags` returns `{direct:[{slug,weight,annotation}], inherited:[{slug,weight}]}`. Direct preference, all reachable
ancestors, deduplication and strongest supporting direct prominence are retained. Missing/incompatible tag imports
omit `card.tags` and explain `unavailable_fields.tags` as `dataset_not_imported`/`dataset_incompatible`; imported cards
with no tags return both empty arrays. Unexpected repository failures remain errors. Lookup's whole-call readiness
requires compatible successful Oracle Cards and All Cards imports; missing/incompatible core data returns
`reference_data_unready` with dataset lists and the explicit sync command. Failed attempts preserve usable imports.

Successful responses contain `status: "ok"`, complete `edges: [{node: LookupOutcome}]`, `pageInfo` with
`startCursor`, `endCursor`, `hasNextPage`, `hasPreviousPage`, `stop_reason` (`first`, `response_budget`,
`source_exhausted`), and metadata. `first` defaults to 50, accepts integer 0–200 and counts every outcome. A zero
request consumes nothing, returns null cursors, and reports whether input occurrences remain. Page cursors correspond
to the first/last emitted outcome; an exhausted empty page has null cursors. Metadata includes requested/returned
counts, `response_budget_bytes`, null provider/scoped totals, and `lookup: {input_count,start_index,next_index}`.
Indices are zero-based positions in the original batch; `next_index` is the next unconsumed occurrence.

Continue using the same ordinary request with returned `endCursor` as `after`. Repeat references and the effective
`include_provenance` setting exactly; selection and `first` may change. Omitted provenance means false. Versioned
opaque tokens contain fixed bindings, successful import IDs (including optional tag absence when first selected),
and next input position; they contain no results and use no saved cursor/search store or arbitrary expiry.
Previously bound optional imports remain dependencies when selection later omits them. Unrelated/failed imports do
not invalidate a cursor; successful replacement of any bound import returns `stale_cursor` and restart guidance.
Local records and import revisions are read in one SQLite view; imports are checked again after cursor preflight.

Failures carry `status: "error"`, complete partial `edges`, `error: {code,message,retryable,...}` and metadata;
they have no `pageInfo`. Input, readiness and invalid/stale cursor failures have no recovery cursor. Recoverable
execution stops carry a sole `error.cursor` before the first unreturned occurrence. Errors include `invalid_request`,
`invalid_cursor`, `stale_cursor`, `reference_data_unready`, `local_error`, `scan_timeout`, `cancelled`,
`record_too_large`, `cursor_too_large` and `response_budget_too_small`. Validation issues have paths/stable codes;
Printing incompatibility names the selected field and original reference indices. Source/tool/request mismatches are
explicit. Hard Worker cancellation delivers no invented new position; reuse the last delivered cursor/original call.

The default whole compact model-visible envelope is at most 51,200 UTF-8 bytes and the scan budget is 120 seconds.
Both are runtime configuration, not agent request parameters. Exact escaped JSON includes cursors, error/provenance
metadata and counts. Complete outcomes, rules text, face lists and tag lists are indivisible. A fitting prefix stops
before its next outcome; an oversized individual outcome returns `record_too_large` with measured required/limit
bytes and safe recovery. Error fitting rolls back unreturned outcomes when metadata grows. Requests whose
self-contained bindings cannot return usable continuation fail preflight with `cursor_too_large`; an adapter unable
to carry a minimal structured error rejects clearly. There is no preview, spill file or hidden cursor store.

`include_provenance: true` adds response-level `reference_imports` with only used datasets/import IDs and nullable
completion/source-update timestamps. It is omitted by default. No Collection context/evidence is exposed in this
slice. Info logging records selected fact names, status/counts, whole UTF-8 bytes and timing; deliberate debug logging
records incoming/outgoing continuation positions, without complete production result-body logging.

## Legacy local discovery request envelope

`legacy_query_cards` accepts one strict object with four optional fields:

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

That is the core Card Query port's error type. The public `legacy_query_cards` Agent Tool first checks reference readiness, so
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
