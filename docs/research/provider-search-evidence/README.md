# Synthetic provider-search measurements

`2026-10-18-synthetic-search.json` was generated with `bun run evaluate:search` against implementation commit
`538b041d22310c0ed3657fd5190a622db329b2ef`. It uses the existing public synthetic workflow identities, names and complete
Oracle text, with injected four-card provider pages and three-card application pages to exercise stateless continuation.
The protocol records one cold run, one unmeasured warmup and five warm samples for each workflow.

| Matched workflow | Source / returned cards | Handler provider calls | Application pages | Complete page UTF-8 bytes |
| --- | ---: | ---: | ---: | ---: |
| Discovery | 12 / 12 | 6 | 4 | 1,562–2,831 |
| Construction | 26 / 26 | 15 | 9 | 1,442–2,831 |
| Tuning | 20 / 20 | 11 | 7 | 1,442–2,831 |
| Assembly | 26 / 26 | 15 | 9 | 1,442–2,831 |

Every traversal had zero missing, unexpected or duplicate returned identities and preserved the required complete Oracle
text. The first application envelope and OpenCode result serialization/Pi fallback/actual Pi Worker text all measured
2,831 UTF-8 bytes and matched exactly. The runner reports two additional provider calls for the two Pi first-page
adapter measurements separately from traversal calls. Repeated provider calls include expected mid-page anchor refetches;
no result cache or search store removes that cost.

Stage timings and synthetic admission start offsets are in the JSON. Admission uses an injected monotonic clock and
controlled provider boundary; these values do not measure network pacing or predict live throughput. No live Scryfall
census, Collection filtering/Availability, actual model-token usage or LLM comparison was run. Actual OpenCode loader,
independent schema-registry handling and cancellation are covered separately by the adapter integration tests.
