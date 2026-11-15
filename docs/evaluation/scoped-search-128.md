# Collection-scoped search enrichment measurement

Ticket #128, synthetic controlled comparison on 2026-11-01, Bun 1.3.14, macOS, single process,
SQLite fixture from `packages/agent/test/fixtures/collection.ts` with imported Oracle, All Cards and tag
fixtures. The provider is injected in memory; no live provider or user data was used. The explicit policy
permits a nonfoil copy in the Shared binder. The same 80 provider records contained two eligible records at
positions 31 and 66. Both versions used `first: 1`, traversed all continuations and returned two records.
The second call refetches the source page and scans from its anchor: 115 raw iterations and two provider
page dispatches are not 115 distinct source records. Fixed `q` and requested fields were identical.

Before was `cc3c7c1` with only a temporary counter added to the existing tag lookup. After was the #128
change. Each version ran a fresh process; the first traversal is colder than subsequent traversals in that
process. Four tagged traversals followed by four identical untagged traversals were observed. Values below
are sums across the two calls per traversal, in milliseconds; they are observations rather than guarantees.

| Request | Before total (cold; warm range) | After total (cold; warm range) | Before tag reads | After tag reads |
| --- | --- | --- | ---: | ---: |
| Tags selected | 232.75; 114.25–136.71 | 133.09; 80.28–129.26 | 115 | 2 |
| Tags omitted | 73.46; 77.82–93.16 | 75.55; 65.17–80.24 | 0 | 0 |

For tagged traversals, recorded local tag/revision lookup time was 75.89 ms cold and 30.54–37.91 ms
warm before, versus 4.85 ms cold and 2.70–3.61 ms warm after. The fixture provider stage took 0.01–0.07 ms
per complete traversal; it includes dispatch and does not represent live admission, queue, or HTTP.
Projection was under 2.4 ms per traversal. Remaining elapsed time includes Collection evaluation,
serialization and uninstrumented overhead; it is not an independently measured local stage. These nested
stage measurements must not be added to total duration. Run `TOMEKIN_LOG_ENABLED=false bun
packages/evaluation/src/scoped-search-measure.ts` to repeat the current measurement. Logs report actual
`tagEnrichmentReads`; compare to the baseline by instrumenting its `localSnapshot` call in the same manner.
The public-handler tests cover independent expected results, complete multi-page recovery, empty scope,
zero-first, tag/no-tag and response-size behavior. These fixtures do not establish live network throughput,
a frozen upstream census, or closure of separate economy and provider timeout gates.
