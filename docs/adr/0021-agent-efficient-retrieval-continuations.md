# Agent-efficient retrieval continuations

Status: implemented; deterministic and bounded live evidence is recorded in [the economy protocol](../evaluation/economy.md).
Human outcome acceptance remains a separate gate for
[issue #107](https://github.com/OSmall/tomekin/issues/107).

Tomekin's retrieval interface consumes agent context on every response. Prefer a single compact continuation over the
full Relay-inspired pagination metadata adopted in [ADR 0019](./0019-provider-backed-scryfall-card-search.md) and
[issue #29](https://github.com/OSmall/tomekin/issues/29#issuecomment-6230187644). Successful traversal exposes one
`next_cursor`, null when exhausted; recoverable failures retain a safe continuation position. Strict Relay response
conformance is not a goal for this tool interface.

Keep cursors stateless and versioned. Search position consists of the provider page, page-boundary state and `afterId`,
the raw provider Printing identifier last consumed. Callers repeat ordinary fixed query, scope and policy arguments.
Do not duplicate full queries, policies, location lists or lookup reference batches inside cursors. A bounded context
check retains automatic detection of changed search conditions and relevant dependency revisions. A valid policy change
can make previously skipped cards eligible behind the saved position even though the provider's pages have not changed;
requiring a restart prevents silently treating those traversals as one coherent filtered search. Ordinary policy
validation remains responsible for permission and active Collection-import validity.

Reconstruct provider page requests from repeated native controls and the saved position rather than embedding their
query-bearing URLs. Scryfall's [search API](https://scryfall.com/docs/api/cards/search) supports numbered pages. Preserve
source anchoring, page-boundary and exhausted-source recovery; this does not freeze the provider's live result set.
Context checks retain relevant dependencies established earlier in traversal even when selectors change, without
invalidating continuation for unrelated imports.

Expose compact Collection snapshot/policy identifiers in ordinary responses and keep the resolved policy available
through explicit inspection, rather than repeating its complete contents on every search. Preserve complete selected
facts, safe recovery and actionable invalidation. Choose the compact wire encoding through token measurements; version 2 uses deflated positional JSON with a 2. prefix, request/scope fingerprints and bounded dependency revisions. Versioning allows an app
update to decode supported older formats or report that the search must restart.
