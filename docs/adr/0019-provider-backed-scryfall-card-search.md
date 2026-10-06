# Provider-backed Scryfall Card Search

Status: Accepted design; not implemented. Refines the decision recorded in
[Choose the agent-facing Card Query authoring contract](https://github.com/OSmall/tomekin/issues/72).
The existing CQL2 implementation remains the current behaviour until migration.

Tomekin will accept Scryfall search syntax through a boot-injected Card Search provider so agents can use an established
language without Tomekin maintaining another search parser. Live Scryfall is the initial provider. One provider is
selected for the process, with no runtime fallback. The local reference corpus is retained for lookup, not for
interpreting
Scryfall syntax. Retain the existing DSL behind explicitly enabled `legacy_query_cards`, disabled by default.
The new direction keeps the current domain model and table relationships rather than requiring a corpus redesign.
No schema migration is currently required by the adopted design: no duplicate Collection identity columns, name
snapshots, raw-card JSON storage, color-representation changes, or layout changes are adopted. New tools change the
retrieval workflow, not the meaning of the existing persisted records.

The normal `search_cards` tool preserves Scryfall search parameters and passes `q` unchanged. `unique` is Scryfall's
optional request parameter, not a Tomekin-imposed Printing mode. Forward the agent's supplied value unchanged; if
omitted, leave the provider default in effect. Do not inject `unique=prints`, silently change a supplied mode, or
resolve
conflicts between request parameters and query-string directives. Preserve the Scryfall request semantics, including
their footguns. Tomekin owns confirmed
Collection filtering, bounded result projection, agent-facing continuation, and provider request budgets. It privately
fetches provider pages and filters them locally until the requested result count is filled, the source is exhausted, or
a scan budget is reached. It does not send Collection identifiers to Scryfall. In-memory identifier sets suffice
initially; bitmap filtering is a possible later optimisation.

The initial live provider follows Scryfall's numbered pages and next-page URLs without claiming a frozen search
snapshot.
Tomekin continuation retains upstream position and buffered matches, but upstream changes between page requests may
still repeat or omit records. `can_continue` means more search work is available, not that another owned match is
already
known to exist. Result metadata distinguishes a filled page, an exhausted source, and a scan stopped by its budget.

If a scan stops after useful progress, the tool returns the collected matches, a continuation when further work remains,
and an explicit stop reason. Rate limiting also reports retry guidance. Partial progress is not discarded as an ordinary
failure. A successfully exhausted search with no matches is a normal empty result; invalid requests and failures before
progress are distinct errors. Public examples and the eventual tool contract use consistent snake_case field names,
including `collection_evidence`, rather than mixing casing styles with Scryfall parameters.

The initial scan time budget is approximately ten seconds per call, including rate-limit scheduling delays; measurements
may justify adjusting it. Provider result totals are labelled separately from Collection totals. Tomekin does not report
an exact Collection total before exhaustive filtering and need not perform extra scans merely to calculate one.
Returned page counts are explicit, and an unknown Collection total is represented as unknown rather than zero.

Agent-visible responses use a configurable size budget chosen through representative measurements. A response stops
before the next complete record would exceed its budget and exposes a continuation; it does not cut serialized JSON,
rules text, or face data into previews. A single record that exceeds the budget produces actionable guidance to narrow
the requested fields or Collection evidence. The current adapter's 16,000-character preview limit is a temporary
implementation detail, not the adopted contract.

The intended agent workflow is staged retrieval: request only facts needed to compare the current candidates, then
look up additional facts for a shortlist in groups. Card details already returned can be reused in that comparison.
The objective is low total agent-context use, including avoidable follow-up calls, rather than the smallest individual
response. Fields that the current decision depends on should be requested together; no universal field bundle or
fixed per-card sequence is prescribed. Return of per-card tags remains a separate requirement from tag-term discovery.

Confirmed Collection scopes and saved search continuations are tied to the successful Collection import that established
them. After reimport, old location UUIDs and continuations are rejected with actionable guidance to list locations again
and refresh Collection evidence. The import record identifies the snapshot and its timestamp provides human-readable
provenance. This also applies when an earlier agent session resumes; it does not require historical Collection storage.

Saved search continuations also identify successful local reference imports on which they depend. A replacement of
those imports invalidates the continuation and produces guidance to restart the search; buffered results must not
silently mix local reference revisions. Existing import-attempt identifiers provide the revision evidence without
historical card storage. This does not freeze the provider's upstream search snapshot.

Card Identity matching is the normal deck-building path: an owned printing of the returned Oracle identity is
sufficient.
Tool descriptions and deck-building guidance should nudge the agent toward `unique: "cards"` for normal identity-level
discovery. Reserve `unique: "prints"` for an explicit version-specific user need, such as selecting physical copies from
particular Sets or other exact-Printing constraints; do not use it routinely merely because the provider returns Card
objects backed by printings. Whether a task requires eligible identities or exact owned versions must be clear in the
user's brief. This guidance does not override supplied request parameters or alter `q`.
Exact Printing matching is an uncommon, explicitly requested path. Agent guidance recommends requesting
`unique: "prints"` and avoiding conflicting query-string rollup directives when all matching Printings are needed.
This is guidance, not an enforced override or an unconditional completeness guarantee. Matching one representative
Printing after collapse cannot prove that no owned Printing matches. Live verification found that a `unique:` directive
inside `q` can override the API parameter without an effective-mode field in the response. Accept that provider
behaviour: Tomekin must not inspect or rewrite the query, claim that the requested mode was verified effective, or
promise all matching owned Printings when the provider may have collapsed alternatives. Collection filtering applies
to the results the provider actually returns.

The search provider accepts Scryfall queries; normal known-card lookup is a separate local capability, not a requirement
to send known references to that provider. Local lookup uses retained Card Identities for Oracle-ID
and exact canonical-name references, and retained Card Printings for exact Printing-ID references; Scryfall-syntax
discovery remains provider-backed. Multiple known references can be resolved in one agent call, including names from
pasted decklists. Local misses are explicit; automatic provider hydration is not adopted. Collection CSV parsing,
validation, and persistence remain Tomekin responsibilities. Retain the existing All Cards import and
Printing-to-Identity
relationship rather than replace it with import-time provider calls. The supported ManaBox export's Scryfall ID is a
Printing identifier; its Card Identity is resolved through that local relationship. Retain the existing Collection-to-
Printing and Printing-to-Identity foreign keys; this does not add a local Scryfall query parser.

Search and local lookup share a bounded agent-facing projection, using Scryfall-shaped field names where meanings
align. One deliberate terminology exception is `mana_value`: provider `cmc` and local `manaValue` both map to that
public field. Do not expose a second `cmc` response alias. `oracle_id` and `oracle_text` retain their familiar names.
Public field naming is a deliberate interface decision open to user review, not an automatic mirror of every upstream
property. Record the approved source-to-response mapping explicitly as the supported field list is finalised.
Both search and lookup require an explicit nonempty `fields` selection; omission is a request-validation error and
does not trigger a default card-field bundle. Identifier-only retrieval is supported. Agent guidance encourages reuse
of returned facts and selection of only the additional facts needed for the current task.
Every card result includes `oracle_id`; exact-Printing results also include `printing_id`, regardless of requested
facts. Other facts, including the name, are returned only when selected. Unrequested fields are absent. Requested
supported scalar fields with no supplied value are explicit nulls; known empty lists are empty arrays. Unsupported
field selections are request errors. Supported fields whose backing data is unavailable are explicitly identified as
unavailable, not presented as confirmed null facts or empty associations.

The approved initial exact-Printing field allowlist is `set` (code), `set_id`, `set_name`, `set_type`,
`collector_number`, `lang`, `printed_name`, `finishes`, `promo_types`, `tcgplayer_id`, `cardmarket_id`, and
`printing_layout`, alongside the always-returned `oracle_id` and `printing_id`. Identity gameplay facts remain
selectable for a Printing. `printing_layout` means Tomekin's `standard`/`reversible_card` presentation distinction;
`layout` means canonical Card Identity layout. Printing facts describe the version, not owned-copy finish, condition,
quantity, or location. Do not promise artwork or image fields with incomplete local coverage.
Local lookup validates requested fields against reference kinds before execution. Printing-specific fields are invalid
for Oracle-ID or identity-name references because no exact Printing is identified. Reject that request up front with
guidance to supply Printing IDs or separate identity and Printing lookups; do not select an arbitrary representative
Printing or return a partial identity response for this request-shape error. This differs from a supported optional
value being absent or an otherwise valid backing dataset being unavailable.

The approved initial identity field allowlist is `name`, `layout`, `mana_cost`, `mana_value`, `type_line`,
`oracle_text`,
`colors`, `color_identity`, `color_indicator`, `produced_mana`, `keywords`, `power`, `toughness`, `loyalty`, `defense`,
`legalities`, `game_changer`, `edhrec_rank`, `card_faces`, and `tags`, alongside the always-returned `oracle_id`.
Public color-related facts are arrays reconstructed from the existing local scalar representations; no persisted
representation change is adopted.

Selecting `tags` returns all direct associations and all reachable inherited ancestors, in separate `direct` and
`inherited` lists. Direct entries contain `slug`, `weight`, and nullable source `annotation`; inherited entries contain
`slug` and `weight`, without invented annotations. Deduplicate inherited tags and omit them when the same tag is
direct. Reuse the existing strongest-supporting-direct-weight rule for inherited prominence. Card responses do not
repeat tag UUIDs, labels, descriptions, aliases, graph edges, or inheritance paths. Hierarchy details remain accessible
on demand through the dedicated tag-catalogue tool rather than repeating the graph for each card. An unavailable tag
dataset is
not represented as empty tag lists. Weight denotes prominence, not statistical confidence.

Selecting `oracle_text` also returns ordered `card_faces` containing each existing part's `name` and `oracle_text`,
while preserving the top-level value, including null. Inclusion depends on parts being present, not merely top-level
null. Both search and lookup apply this narrow projection, without concatenating text, inferring which part matched,
or parsing the query. Explicit `card_faces` selection returns the fuller supported face projection. This uses existing
parts and does not require schema changes or an additional provider request. The fuller supported face projection is
`name`, `mana_cost`, `type_line`, `oracle_text`, `colors`, `color_indicator`, `power`, `toughness`, `loyalty`, and
`defense`; selecting both fields returns that fuller face projection once, without inventing ordinary single-card parts.

This projection maps only supported requested facts, not complete provider objects into the full Tomekin domain model,
and does not promise arbitrary complete Scryfall Card objects. Equivalent facts use the same shape across search and
lookup; provenance identifies their source. Printing facts are distinguished from identity facts. Face projection
retains
order and supported face-specific values without flattening rules text or synthesising absent facts. Agent guidance must
not assume top-level `oracle_text` describes the complete card. No expansion of face or Printing storage is adopted
without an actual required field. Retain ADR 0011's deliberate split of canonical Card Identity layout and Printing
presentation layout, and retain existing persisted color representations and derived Copy Limit Overrides. The public
projection does not change those domain decisions.

Tomekin retains local Card Identities, face information, legalities, and tag associations, alongside source tag
definitions, aliases, and hierarchy. This supports known-card lookup and requested per-card tag evidence without a
local Scryfall-syntax search engine. Card membership matching for Scryfall queries remains with the search provider.
Retain All Cards for local Printing lookup and Collection import, not merely for legacy query support. The lookup store
keeps the current relational records and their deliberate domain transformations. The approved projections and
discrepancy policy below do not require a persisted-model redesign. Scryfall's
[documented tag exports](https://scryfall.com/docs/api/tags)
provide the tag vocabulary and associations in bulk.

Set metadata remains searchable by code or name through the existing `card_set` records populated by All Cards.
Retaining that importer supersedes the earlier plan for a separate persisted Set API cache. Initially no supplementary
Set refresh path, second Set store, or associated schema change is adopted.
Tag-catalogue discovery and Set discovery are separate dedicated Agent Tools, not modes of a combined
`search_reference_terms` tool. Retain `search_card_sets` over `card_set`. The dedicated `browse_tags` tool has three
explicit operations: search ordinary text across slugs, labels, and aliases; lookup known slugs for definitions with
optional bounded hierarchy exploration; and list the catalogue through pages. Do not infer the operation from the
input's wording or expose three separate tag tools. Complete
catalogue access does not mean loading every tag or hierarchy edge into agent context at startup. Normal responses
identify incomplete pages and provide continuation rather than silently truncating the catalogue.
Known-tag lookup returns no hierarchy unless requested. When requested, default to one level of immediate parents,
immediate children, and connecting relationships. Deeper traversal must be explicitly requested and remains bounded
by pagination and the response-size budget. This does not reduce the complete inherited-tag lists in card responses.

Tag search complements the existing tag-snowball method: inspect direct and inherited tags on promising seed or
shortlist cards, search high-signal slugs, and inspect promising results. Already-known valid slugs do not need another
catalogue lookup merely to author a card search. Independent role needs and Oracle-text searches remain important
so snowballing does not constrain discovery to one neighbourhood. Curated categories and useful seed tags may later
be maintained in deck-building skills as that workflow is revised; no curated taxonomy, new database fields, or
complete startup tag dump is adopted here. Metadata discovery does not introduce card-query parsing into Tomekin.

`summarize_reference_support` leaves the normal agent tool list. Startup and command-line diagnostics report setup
problems, and normal provider operations return actionable failures. Local bulk-import diagnostics remain part of normal
setup because the corpus supports lookup, validation, and Collection import. Provider setup must not require local
`oracle_cards` or `all_cards` imports merely to search cards;
local known-card lookup and tag enrichment have their own import-readiness requirements.

Keep Deck Candidate entries linked to Card Identity by their existing foreign key, and Collection rows linked to Card
Printing by their existing foreign key. Names remain on Card Identity; no diagnostic name snapshots or duplicate
Card Identity IDs are added to Collection rows. This reverses the earlier provider-only-corpus proposal to decouple
user records from reference tables. Local reference integrity remains required; imports must not cascade-delete saved
user data. Live search may find an identity not yet imported, which needs actionable refresh guidance rather than
silently weakening integrity constraints.
Search evidence comes from the selected provider; known-card details come from the retained local reference snapshot.
The local snapshot is not assumed to override provider facts: the initial live provider is expected to be newer.
Detected factual disagreements must be reported to the agent, which tells the user to update Tomekin through the
explicit sync workflow; no silent choice of facts or automatic refresh is adopted. Do not double-check search results
through additional local/provider retrievals. The agent normally reuses facts already received and requests only missing
facts, avoiding redundant responses and context use. Discrepancies are incidental findings when comparable facts from
both sources are already available, not inferred by interpreting the provider query. A detected rules or legality
discrepancy blocks claiming successful validation and final saving until resolved; discussion and drafting can continue.
Advisory metadata differences are warnings rather than finalisation blockers. After an explicit sync, recheck the
affected facts and deterministic validation. Authority for future non-live providers remains unsettled.
Implementation must preserve deterministic construction
checks and review existing detail, name-resolution, evaluation, import, and readiness paths as well as the new search
tool. This is not a decision to alter their persisted records.

The adopted direction supersedes ADR 0012's choice of CQL2 as the normal agent-facing language after implementation.
ADR 0013's compiler rationale remains relevant to the retained legacy capability. Current behaviour documentation must
be updated alongside implementation; this ADR does not describe delivered functionality.
