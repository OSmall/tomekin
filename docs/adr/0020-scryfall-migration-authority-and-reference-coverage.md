# Scryfall migration authority and reference coverage

Status: implemented; the maintainer confirmed successful live populated-database sync on 18 October 2026.

The [populated-copy verification](../research/scryfall-sync-evidence/2026-10-18-staging-performance.md) records
successful reconciliation, exact source membership, user-content preservation and rejected-refresh rollback evidence.

Implementation specification: [issue #105](https://github.com/OSmall/tomekin/issues/105).

The populated sync failure in [issue #104](https://github.com/OSmall/tomekin/issues/104) exposed a mismatch between
identity-first dataset replacement and upstream removals. Scryfall publishes explicit Card Migrations for discarded
Printing identifiers; its 23 September 2026 merge records cover all 221 affected Printings and resolve their 216 old
Card Identities to consistent current identities. This decision records the agreed reference coverage and source
authority boundaries. [ADR 0015](./0015-explicit-scryfall-bulk-sync-command.md) describes the existing sync design.

Keep digital reference data alongside paper reference data. Preserving this coverage supports future Arena use
without expanding the current work into Arena Collection import or additional Format support. Restricting reference
imports to paper would reduce coverage without resolving upstream correction and removal generally.

Use explicit Scryfall merge mappings as authoritative evidence for automatic reconciliation when the replacement is
unambiguous and user-authored data can be preserved. These mappings concern Card Printing identifiers; Card Identity
reconciliation must also establish the old and replacement Printings' identity relationships. A change that creates
conflicting saved memberships, options, contributions, or quantities requires review rather than silently discarding
or combining user intent.

The number of valid, explicit official migrations alone is not an approval gate. Source validation, referential
integrity, and preservation of Collection rows and Deck Candidate content remain requirements regardless of batch
size. Trust in explicit migrations does not automatically extend to unexplained disappearance from a bulk snapshot.

After a successful sync, the Card Identity table mirrors the selected Scryfall Oracle Cards snapshot. Retain foreign
keys and current source membership rather than preserving historical identities to accommodate errant Collection or
Deck Candidate references.

An official delete may remove obsolete reference data when the resulting reference graph has no broken user
references. If a delete has no safe replacement and would break a Collection or Deck Candidate reference, abort the
whole sync and preserve the previous usable database. Report the affected records for repair; source deletion does
not authorize discarding ownership information or candidate content.

Lossless official merges may update references in Collection and Deck Candidates automatically. Collisions in saved
quantities, options, contributions, or other user-authored content require review rather than implicit combination.
Disappearance from an incoming snapshot without applicable migration evidence also blocks the whole refresh, even
when the disappearing record has no user references. This is an evidence requirement rather than a batch-size limit.

## Coordinated refresh

Download and stage the three bulk datasets, validate their incoming relationships, and compare staged records with
the current database before changing live reference or user data. Resolve disappearances using applicable official
migrations, then validate user-reference remapping and conflicts. Publish the reference refresh, lossless user-reference
changes, and records of migrations actually applied in one transaction, with foreign keys preserved. Recheck the
relevant live state before publication so concurrent changes cannot invalidate the reconciliation.

An initial import into an empty database needs no migration history. Subsequent refreshes fetch migration pages only
when disappearances need explanation, consulting cached evidence and stopping once the required mapping chains and
deletions are resolved. Bound requests, downloaded bytes, and elapsed time. Exhausting a budget means reconciliation
is incomplete, not that no migration exists; preserve the prior usable database and report the unresolved work.
The current API documents numeric pagination but no date filter or lookup by old Printing identifier, so this design
does not rely on a date-only checkpoint or a saved page number to prove coverage.

Fetched migration evidence may be cached without applying it. Application history records only migrations committed
with a successful refresh; it is distinct from a download cache or a proof that all upstream history was examined.

## Request control

Sync metadata and migration requests use at least 100 ms between actual request starts, without catch-up bursts.
Coordinate API traffic and cooldown with other Tomekin Scryfall activity while preserving stricter endpoint-specific
limits, including the existing search cadence. The 100 ms choice concerns sync requests; it does not change search
or manifest request limits.

An HTTP 429 pauses further API requests. Use a minimum 31-second cooldown from response receipt when Retry-After is
missing or unusable, and honor a longer valid Retry-After. A valid shorter Retry-After also cannot shorten that
31-second safety floor. Cancellation or another invocation must not bypass an active cooldown. File downloads from
the separate Scryfall file origins do not consume the API request cadence.

After the cooldown, retry the rate-limited request automatically, at most twice per request and within the overall
fetch budget. Retry exhaustion preserves the previous usable database and reports the remaining cooldown or recovery
guidance. This bounded HTTP 429 retry policy supersedes ADR 0015's no-automatic-retry decision for rate-limited sync
requests; it does not introduce unrestricted retries for other failures.

## Other import commands

ManaBox Collection import remains strict and offline. An older CSV containing discarded Printing identifiers fails
with actionable official replacement guidance when evidence is available locally. This decision does not make
Collection import migration-aware or relax validation of Set, collector number, language, finish, or other owned-row
metadata. Changing an identifier alone does not establish that the rest of the CSV matches the replacement Printing.

The supported local-file Scryfall import remains offline and subject to the same removal protections. Compatible
single-dataset imports may proceed; unsafe removals fail with guidance to use coordinated sync rather than bypassing
the reconciliation requirements. An offline bundle workflow and deprecation of the single-file command are not
adopted by this decision.

Source contract: [Scryfall Card Migrations](https://scryfall.com/docs/api/migrations),
[migration feed](https://scryfall.com/docs/api/migrations/all), and
[rate limits](https://scryfall.com/docs/api/rate-limits). A Card Migration reconciles a removed identifier;
it is not a complete feed of newly added cards or changes to current rules, legality, and tags.
