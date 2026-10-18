---
name: query-cards
description: Use for native search_cards discovery, known-card lookup_cards selections, first/after recovery, or explicitly enabled legacy_query_cards.
---

# Query Cards

## Known Cards

Use `lookup_cards` for exact Oracle IDs, canonical whole names (including ` // `), or Printing IDs.
Request only newly needed facts through an explicit nonempty `select` object whose properties are literal `true`.
For pasted decklists, batch name references and select `name` or `oracle_id`; preserve duplicate input occurrences.
Every found card includes `oracle_id`, and an exact Printing reference also includes `printing_id`.

```json
{"references":[{"kind":"name","value":"Sol Ring"}],"select":{"name":true,"oracle_text":true}}
```

Results are complete `edges[].node` outcomes: `found` with selected card facts or `not_found` with the original
reference. A miss only describes the local reference snapshot. `oracle_text` includes complete existing ordered
face names/text; explicit `card_faces` returns all supported face facts. `tags` returns complete direct/inherited
associations. `unavailable_fields` distinguishes absent/incompatible optional datasets from known empty facts.
Printing properties require Printing references throughout the original batch, including references before `after`.

For another page, repeat the fixed ordered references and `include_provenance` setting with the returned
`pageInfo.endCursor` as `after`. `first` defaults to 50, accepts 0–200, and counts misses and duplicates.
Selections and `first` may change. Follow `hasNextPage`; an exhausted source returns false. Failures have
`status: "error"`, complete partial edges and a single optional `error.cursor` for an ordinary retry.
For stale import bindings restart; after hard cancellation reuse the last delivered cursor or original request.
The 51,200-byte compact envelope never clips selected text, faces, tags or JSON. `record_too_large` leaves its
occurrence unconsumed. Lookup requires compatible Oracle Cards and All Cards imports; tags are optional enrichment.
It performs no network fallback or automatic hydration. Request Collection evidence explicitly as below; retrieval does not prove final joint Availability.
Read `docs/card-query.md` for the complete field, cursor and error contract.

## Tag and Set Vocabulary

Use `browse_tags` with an explicit operation: `{type: "search", query: "mana ramp"}` for slug/label/alias search,
`{type: "lookup", slugs: ["mana-rock"]}` for complete known definitions, or `{type: "list"}` for catalogue listing.
Definitions include all aliases. Hierarchy is absent unless lookup requests `hierarchy: {}` (immediate parents,
children and edges); explicitly request `depth: 2` or `3` for bounded deeper exploration. Repeat the operation with
`first`/`after` until `hasNextPage` is false; recover execution stops with `error.cursor`. Successful empty search,
known-slug `not_found`, and `reference_data_unready` have different meanings. Successful tag replacement invalidates
old cursors. Tags support discovery; assess Deck Roles and quality from the card in its candidate context.
`lookup_cards` selected tags still include every reachable inherited ancestor, independently of catalogue depth.

Use `search_card_sets` with a code/name query for existing imported Set metadata. Load no raw catalogue at startup.
The literal `mana-rock`, `ramp` and `recursion` slugs were verified from the public 2026-10-17 Oracle Tags bulk
snapshot; source UUIDs and snapshot provenance are recorded in `docs/card-query.md` under Tag and Set discovery.

## Owned-row Browsing

For policy-aware actual-row, source-date and exact owned-Printing discovery, use `browse_collection_cards` with an
explicit confirmed `collectionAccessPolicy` or its candidate-owned Brief reference. Inspect `list_collection_locations`
for the active import ID and exact locations. See `docs/card-query.md#collection-policy-and-owned-row-browsing` for
closed policy/copy selectors and ordinary first/after recovery. Reconfirm scope after successful Collection reimport.
For recent additions, independently browse unknown source dates unless the user declines. Legacy CQL2 predicates
remain procedural; independent Printing and Collection predicates cannot prove that the owned Printing matches.

## Live Discovery

Use `search_cards` for native Scryfall discovery. Forward q and supplied native controls unchanged; omitted controls
keep provider defaults. Prefer `unique: "cards"` for normal identity discovery, `prints` only for an explicit version
need. Do not infer effective rollup from q or claim representative results enumerate every matching owned Printing.

```json
{"q":"t:creature o:draw","unique":"cards","select":{"name":true,"oracle_text":true},"first":175}
```

Choose complete facts needed for the current comparison. `oracle_text` preserves top-level text/null and all existing
ordered face names/text; explicit `card_faces` selects the full face projection. Printing facts add Printing ID.
`mana_value` has no cmc alias. `tags` is optional local enrichment with complete direct/inherited associations.
Pure live discovery needs no local reference import; unavailable optional tags remain visibly unavailable.
Use optional `collection_scope` for confirmed-policy local filtering. Pass `collection_policy` as an explicit confirmed
policy or candidate reference; candidate permission loads the whole Brief. Match defaults to identity. Explicit printing
matching tests only provider Printings actually returned and does not prove all-owned-version coverage. Scope locations
use UUIDs or exact case-sensitive type/name pairs, and copy_requirements narrow the same actual row/Printing.

Request `collection_evidence: {mode: "summary"}` for exact recorded owned/eligible/uncertain quantities, or
`{mode: "copies", select: {location: true, finish: true}}` for complete selected matching rows. Owned quantity is
independent of policy permission; unknown strict metadata cannot prove eligibility. With unconfirmed policy,
eligibility is null and no copy rows are permission-proven. One Collection context exposes no/empty/ready import and
effective policy; successful reimport requires scope reconfirmation. A row quantity is not an allocation/reservation.
The result card's representative Printing differs from each actual owned Printing in its copy evidence.
Repeat fixed scope, policy source and evidence mode on continuation; card/copy selection and first may change.
Use local browse for source chronology/unknown-date discovery. Final whole-deck Availability requires its separate
complete-demand check; per-card summaries cannot prevent double allocation.

Repeat fixed q, native controls and effective include_provenance with ordinary `after`. `first` defaults to 175 and
accepts 0–200. Selection and first may change. Success uses pageInfo; failure has complete partial edges and at most
one `error.cursor`, with no pageInfo. Preserve returned evidence and continue from the supplied cursor when missing
facts can materially affect the decision. A changed fixed query starts a new search.

A successful hasNextPage establishes another matching object. Empty exhausted sources return false. Live traversal
can repeat/omit records when upstream pages change; scoped totals stay unknown even at exhaustion. Missing or
ambiguous anchors require explicit recovery, never guessed offsets. Stale dependencies require restarting. A killed
Worker has no delivered new progress: reuse the last received cursor or original request. No saved result buffers.

Respect retryability and retry_after_ms. The shared dispatcher enforces at least 500 ms between actual starts and at
least 31 seconds of cooldown after 429, extended by valid longer Retry-After. Avoid immediate retry loops. One active
provider process per shared user/state root is supported. Provider setup failures give operating guidance.
Whole compact envelopes are bounded at 51,200 UTF-8 bytes and scans at 120 seconds including admission/lookahead.
Never silently drop selected facts to obtain a smaller prompt or describe a partial scan as a census.

## Staged Retrieval

State the decision the evidence supports, search by meaningful function/package when useful, reuse suitable facts,
and batch only missing shortlist facts through lookup. Combine seed/tag exploration with independent Oracle-text
searches. Tags and prominence suggest candidates; they do not prove role adequacy or strategic strength. Discover
Set metadata with `search_card_sets` and tag vocabulary with the currently supported tag-catalogue tool.
Incidental material provider/local rules or legality disagreement requires explicit sync and recheck before a successful
final validation claim; do not routinely refetch results merely to cross-check sources.

Source contracts: #72 authoring, #28 projection, #29 stateless continuation, #82 request control, and #32 workflow/logging
final resolutions. The complete implemented mechanics and operating limits are in `docs/card-query.md`.

## Explicit Legacy Branch

`legacy_query_cards` is disabled by default. Use it only when explicitly enabled with
`TOMEKIN_ENABLE_LEGACY_QUERY=true`; OpenCode also requires an allow permission. Read the workspace-relative
`skills/query-cards/legacy-query.md` only for that legacy CQL2 workflow. It covers local relationships, procedural
Collection allow-lists and non-paginated legacy limits. Those expressions are not native search q.
