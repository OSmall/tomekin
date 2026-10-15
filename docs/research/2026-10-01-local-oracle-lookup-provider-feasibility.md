# Local Oracle lookup alongside provider-backed search

Date: 2026-10-01

Status update (2026-10-02): this report investigated an Oracle-only alternative; it is not the adopted implementation
specification. The user subsequently chose to retain Tomekin's existing relational identity and Printing corpus,
foreign keys, and domain transformations, with local lookup and provider-backed discovery. Source JSON storage,
provider-based Collection-import resolution, and user-record decoupling described below were not adopted. See
[ADR 0019](../adr/0019-provider-backed-scryfall-card-search.md) for the current decisions.

## Question

Can Tomekin retain imported Oracle identities for fast known-card lookup and tag evidence, use a Scryfall-compatible
provider for search, and avoid maintaining either a Scryfall query parser or all Printing records?

## Conclusion

Yes. Local lookup by Oracle UUID is an indexed key lookup followed by output-field selection; it does not require a
search-language interpreter. Exact canonical-name lookup is also small if its supported matching rules are explicit.
Keeping one representative Scryfall object per Oracle identity, including its face objects, avoids reconstructing raw
Scryfall output from a narrow normalized record.

The main complications are reference freshness and distinguishing Oracle facts from the representative Printing's
facts. An Oracle-only store cannot satisfy arbitrary exact Printing lookup, prove owned finishes, or resolve every
localized/alternate name. Those operations still require the selected provider or an explicit narrower tool contract.
Live search may find cards missing from the last local import, so the design needs an intentional missing/stale-data
policy before adoption. This report investigates options; it does not adopt a replacement for the accepted ADR.

## Verified source facts

- Oracle Cards bulk data supplies one complete Scryfall Card object per Oracle ID. The selected object is a
  representative version; its particular Printing is not a canonical identity for every physical copy.
- Default Cards includes all English objects and the available original-language object where a card only exists in
  one language. All Cards includes objects across languages. Oracle Cards is therefore not an exact-printing or
  comprehensive translated-name dataset.
- At inspection, public bulk metadata advertised compressed JSONL downloads: Oracle Cards approximately 24.6 MB,
  Default Cards 78.7 MB, All Cards 395.4 MB, and Oracle Tags 6.0 MB. These are compressed transfer sizes, not SQLite
  storage or memory estimates. Imports should use the metadata-supplied download URL and format.
- Oracle tagging associations join on `oracle_id`. Scryfall explicitly describes joining them to Oracle Cards; full
  Printing imports are unnecessary for that relationship.
- A Card object can contain `card_faces` instead of top-level rules text or mana cost. A live exact-name lookup for
  Delver of Secrets returned the combined canonical name and two face objects with separate rules text. Preserve the
  objects rather than synthesizing one text field.
- Scryfall's collection endpoint resolves several reference forms, including Oracle UUID, Printing UUID, and names.
  Up to 75 references fit one upstream request. Missing references are reported separately; response position is not
  a reliable request-to-result mapping.
- Bulk records have source update metadata. Oracle Cards and Oracle Tags are separate exports and can have different
  update timestamps. There is no evidence here of an atomic, combined card/tag snapshot or a guarantee that live
  search shares the imported revision.

Sources: [bulk data](https://scryfall.com/docs/api/bulk-data),
[Oracle Cards metadata](https://scryfall.com/docs/api/bulk-data/type),
[public bulk metadata inspected](https://api.scryfall.com/bulk-data),
[tag joins](https://scryfall.com/docs/api/tags),
[card objects](https://scryfall.com/docs/api/cards),
[collection lookup](https://scryfall.com/docs/api/cards/collection),
[exact named lookup](https://scryfall.com/docs/api/cards/named),
[Delver response inspected](https://api.scryfall.com/cards/named?exact=Delver%20of%20Secrets).

## Small design that follows from those facts

These are design inferences, not Scryfall requirements:

1. Import Oracle Cards into a primary-keyed Oracle store, retaining the source Card JSON with `card_faces` intact.
   Existing normalized columns can coexist for legacy behavior and deterministic domain checks.
2. Resolve `{oracle_id}` by primary key. Resolve `{name}` through a canonical-name index, with optional explicitly
   supported face-name aliases. Return ambiguity/missing results rather than adding fuzzy ranking.
3. Select allowed requested fields from that source object. Add tag and Collection evidence independently. Reading
   many IDs in one call means several indexed lookups, not a query language or an agent call per card.
4. Attach the successful local import revision to results. Keep the live provider's search revision separate.
5. Continue using provider exact-printing resolution for Collection imports and requests for owned Printing details.
   Collection rows can keep their Printing IDs without requiring a local Printing table.

No local Scryfall parser, arbitrary SQL authoring surface, or dynamic GraphQL field-selection engine is necessary.
The lookup must remain a finite list of known references plus an allowlisted output projection.

## Decisions and failure cases to settle

- **A live search result absent locally:** strict local lookup returns an explicit reference-refresh-needed result;
  provider-assisted hydration can fetch it, but adds upstream work and a mixed local/remote freshness policy. This is
  separate from automatic search-provider fallback. Either policy can be sound if visible and tested.
- **Card facts disagree:** a live query could match new rules text or legalities while local lookup returns yesterday's
  values. Search projection should use the returned source object, while lookup should identify its local revision.
  Rules validation needs a chosen freshness policy, especially when bannings or errata change legality.
- **Representative Printing fields:** local `id`, `set`, `collector_number`, language, finishes, images, prices, and
  artwork describe the imported representative object. They do not identify the owned Printing. Prefer limiting local
  Oracle lookup to gameplay fields or clearly describe representative fields; route exact Printing references to the
  provider. Identity-level Collection joins use `oracle_id`, never this representative `id`.
- **Name matching:** canonical full name lookup is simpler than exact parity with Scryfall name matching. Multi-face
  aliases can collide; localized names, alternate printed names, renamed cards, and partial-name suggestions need
  explicit support boundaries. Do not silently turn name lookup into a search engine.
- **Tag import integrity:** newer tag exports may reference IDs absent from the installed Oracle snapshot. Refresh
  Oracle Cards first, validate references transactionally, and preserve the last successful tag import on failure; or
  consciously allow unresolved source IDs and expose missing associations. Independently downloaded exports cannot
  be assumed synchronized merely because they were downloaded together.
- **Refresh behavior:** replace imports atomically, retain the last successful snapshot, expose source timestamp and
  revision, and avoid cascading removal of saved candidate or Collection rows when reference imports change.
- **Offline scope:** known-card lookup and local tags can work offline; live Scryfall syntax search still cannot.

## Evidence and limits

Context7 succeeded: one library-resolution call and two focused documentation calls. Its bulk metadata and Card
examples were corroborated through public Scryfall API requests using explicit User-Agent and Accept headers. The
documentation website returned HTTP 403 through the web reader, so this report does not claim that direct page
rendering succeeded. No private Collection data, entire bulk download, or production database was inspected. No
latency benchmark was run; improved lookup latency is an architectural expectation, not a measured result.

## Tomekin implementation assessment

The following findings are from the checked-out repository, not assumptions about an unimplemented provider.

- **Exact lookup is already implemented.** `getCardIdentity` checks the identity primary key or exact stored name,
  then loads faces, format legalities, and tag associations. No Card Query compilation is involved. The current
  multi-ID method loads each detail separately and aborts on a missing identity; a new public batch contract should
  report individual missing references and avoid fetching unrequested details. This is ordinary bounded database
  work, not a query interpreter. [Repository implementation](../../packages/sqlite/src/card-reference-repository.ts).
- **The current records cannot reproduce an arbitrary source Card object.** The Oracle importer discards the
  representative Printing ID and unknown source properties, renames fields, turns colors into scalar domain values,
  and converts absent optional values to null. Faces retain a gameplay subset, not every source face property.
  Therefore an output mapper can cover a documented gameplay-field allowlist, but cannot truthfully promise all
  Scryfall fields or unchanged complete face objects. Source-preserving JSON from the bulk input would honor that
  stronger contract without importing every Printing. It would require storage/import changes and, if retained
  beside existing normalized columns, some internal duplication. Alternatively, relax the output contract to the
  supported mapped subset; do not call that full source-object preservation.
  [Importer and raw schemas](../../packages/core/src/scryfall-sync.ts),
  [persisted fields](../../packages/sqlite/src/schema.ts).
- **Removing mandatory all-Printing imports is feasible but not a configuration-only change.** Collection import
  currently requires successful `oracle_cards` and `all_cards` imports, resolves exact Printing IDs through local
  tables, and Collection rows reference those Printing records. To make All Cards optional, replace that resolution
  path with the selected provider, persist the resolved Oracle ID and agreed Collection facts, and remove the full
  Printing-table dependency. This was already required by the provider-first proposal; local Oracle lookup neither
  removes nor fundamentally enlarges that work. It does not require retaining a local copy of every Printing.
  [Import prerequisites and resolution](../../packages/sqlite/src/collection-repository.ts),
  [CSV validation](../../packages/core/src/collection-import.ts).
- **Import integrity already exists, but readiness must be separated.** Oracle replacement uses a transaction and
  refuses to orphan existing Printing/tagging references. Tag imports refuse missing identity references. The old
  support summary expects all three reference datasets. Local Oracle lookup should require Oracle data; tags should
  have their own ready/stale status; default provider search must not require All Cards. Legacy capabilities that
  actually use Printings may still require it. A newly published tag export referencing a new identity can require
  refreshing Oracle Cards and retrying; a removed identity referenced by old tags needs an intentional coordinated
  refresh policy, not a cascade that deletes user-owned records.
  [Transactional imports](../../packages/sqlite/src/scryfall-repository.ts),
  [support summary](../../packages/sqlite/src/card-reference-repository.ts).
- **Bulk download format is already supported.** The CLI selects `jsonl_download_uri` when available, and the core
  parser handles gzipped JSONL and JSON arrays. The current upstream format is not a newly discovered implementation
  gap. [CLI downloader](../../packages/cli/src/sync-scryfall.ts),
  [stream parser](../../packages/core/src/scryfall-json-source.ts).

## Recommended boundary, pending user decision

Keep provider-backed Scryfall search and retain local Oracle Cards plus Oracle Tags. Make Oracle-ID lookup local
and exact canonical-name matching intentionally limited. Continue to use the selected provider for an explicitly
requested exact Printing and for Collection-import Printing validation; that deterministic routing is not runtime
fallback between search providers. All Cards remains available for legacy behavior, not required for default tools.

Use requested-field projection for both search and lookup, and add local tags to either by returned Oracle ID when
requested. Tags and Collection evidence are Tomekin additions, not fabricated Scryfall Card fields. A local tag
miss for an unknown identity must not be represented as proof that the card has no tags.

Start without automatic remote hydration of missing local Oracle IDs. Report the local revision and an actionable
refresh-needed result. If the agent must continue without an import, explicitly fetching the known identity through
the selected provider could be a later capability, but is a new decision rather than an assumed fallback.

Before adopting this alternative, settle two consequential choices: whether the original unchanged-source-field
promise warrants retaining source JSON; and whether local snapshot freshness is acceptable for follow-up details
and legality validation. Retaining a reference corpus does not automatically mean reinstating foreign keys from
saved candidates to it: a live search can discover identities the local snapshot does not yet contain. Saved user
records must survive reference refreshes, and their referential-validation policy is a separate decision.
