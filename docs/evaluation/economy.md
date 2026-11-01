# Agent-context economy

Issue [#107](https://github.com/OSmall/tomekin/issues/107) separates inexpensive discovery from detailed contender
inspection. Broad searches learn compact direct/inherited tag slugs and prominence; model judgment chooses which missing
rules facts to inspect. This protocol measures transport and scripted retrieval, not strategic quality.

## Reproduce the deterministic comparison

```sh
bun run evaluate:economy:baseline
bun run evaluate:economy -- --rich
bun run evaluate:economy
```

The first command exports the actual pre-change source at `d16556954a10443e5e207a032dfe75e3e88dd377` into a new temporary
directory, reuses installed pinned dependencies, and runs the same rich workload against those old handlers/adapters.
It replaces `packages/evaluation/src/economy-baseline.json` and removes its temporary source directory. No network or
model is used. The current rich and staged commands use the same immutable synthetic discovery fixture, source rules,
required identity/tag/Mana Value facts and literal two-card contender rules. The scripted contenders are measurement
inputs, not a model-selection algorithm or an exact-card quality expectation.

Twelve synthetic identities contain eight policy-eligible identities. Provider pages contain four cards and tool pages
request three results. Each eligible card has a direct draw tag, inherited resource tag and a synthetic source annotation
repeated twenty times. This deliberately exercises optional annotation overhead; its size is not a production average.
The rich workload retrieves complete rules/tags and summary evidence throughout; staged discovery learns compact tags,
omits membership evidence, then hydrates only missing contender text. Actual OpenCode, Pi fallback and Pi Worker outputs
must equal the complete application envelope. Repeating those calls to inspect adapters is measurement overhead and is
not counted as extra research calls.

## Measured results

Measured on 21 October 2026 with `js-tiktoken` **1.0.21**, **o200k_base**. Counts include serialized tool arguments,
including returned cursors resubmitted on continuation, and complete model-visible response text. They exclude provider
framing, system/skill prompts, assistant reasoning, cache behavior and billing semantics.

| Matched workload | Research calls | Request tokens | Response tokens | Total text tokens |
| --- | ---: | ---: | ---: | ---: |
| Actual pre-change source, rich | 3 | 2,871 | 10,384 | 13,255 |
| Current source, same rich projection | 3 | 668 | 2,609 | 3,277 |
| Current source, staged retrieval | 4 | 690 | 1,643 | 2,333 |

Every actual adapter produced the same counts. Current rich transport is 75.3% lower than the matched baseline;
staged retrieval is 82.4% lower, including its extra lookup call. Required facts remain equal. Broad discovery hydrates
eight rules texts in the rich cases and two in the staged case; no hydrated fact is repeated. Repeated identities during
targeted hydration are distinguished from duplicated facts.

Independently tokenized cursor components fall from 7,734 to 320 tokens; Collection context from 474 to 153; discovery
Collection evidence from 192 to zero. These component counts are diagnostic and do not add exactly to total BPE counts.
Maximum cursor length falls from 2,012 to 238 characters. For the same two current cursor payloads, JSON-string transport
costs 358 tokens as positional JSON, 600 as plain base64url and 320 as deflated positional JSON plus base64url. The codec
therefore uses the measured compressed representation. These synthetic observations are not universal savings promises.

`economy.test.ts` requires identical required facts and improvements on every surface. Its staged ceiling of 2,500 tokens
and maximum cursor length of 260 characters are derived from these measurements, with modest encoding/runtime headroom.
Existing public-handler tests separately retain same-row filtering, relevant import/context invalidation, selector changes,
zero-first, source anchors, exhausted-page handling and complete byte-bounded error recovery.

## Bounded live-agent comparison

The user approved `openai-codex/gpt-6.1-sol` at **medium**. Reproduce after deterministic verification and code review:

```sh
TOMEKIN_LOG_ENABLED=false bun packages/evaluation/src/economy-live.ts
TOMEKIN_LOG_ENABLED=false bun packages/evaluation/src/economy-live.ts --run --model=openai-codex/gpt-6.1-sol --thinking=medium
```

Without `--run`, preparation creates matching isolated synthetic databases, a provisional 60-card candidate and the exact
prompt. It calls no model. Explicit execution runs one fresh Pi session against each source revision, with production
public handlers and the Pi fallback adapter. The injected finite provider serves synthetic card rules/tags through
documented fixture-only queries, so there is no live Scryfall transport or private Collection. Native Pi loads the approved
model through its existing profile; the runner neither reads nor copies authentication files. Each session is bounded to
30 tool calls and four minutes, with a hard process stop after ten further seconds. Stopped or failed runs are incomplete.

Inspect saved options and unchanged selection through public handlers. Review tag learning/broadening, selective rules
inspection, actual advantage versus selection, costs and conditions, handling of the misleading tag, useful alternatives,
scope trust, reuse and honest limits. Record cumulative model-visible tool text alongside those judgments. This synthetic
pair cannot establish real Collection recommendation quality, complete Format-sized construction, native question UI or
the broader Pi/OpenCode parity gate in #26. Human outcome acceptance remains separate from a successful model exit.

### Recorded paired observation

On 21 October 2026, both approved sessions exited successfully within the bounds: baseline **21** tool calls, current
**20**. The [sanitized observation](economy-live-observation.json) contains the exact synthetic prompt/source cards,
executed bundle/log digests, counts, saved options/contributions and final answers. It contains no raw reasoning,
authentication or production Collection data. Human outcome acceptance is **pending**; these are observed behaviors,
not an LLM quality score.

| Live tool-text measurement | Baseline | Current |
| --- | ---: | ---: |
| All serialized arguments | 2,911 | 2,662 |
| All tool response text | 31,837 | 14,126 |
| All-tool total, including methodology reads and failures | 34,748 | 16,788 |
| Catalogue/search/lookup total, including failures | 22,674 | 3,475 |
| Successful catalogue/search/lookup total | 21,128 | 3,475 |
| Rules texts returned / distinct identities | 16 / 7 | 7 / 7 |
| Broad searches emitting per-card Collection evidence | 7 | 0 |

Counts use the same pinned tokenizer as above: each `tool_execution_start` argument object is serialized once, and each
completed `message_end` tool result contributes only `content[].text`. Streaming updates and archival `details` are
excluded. All-tool text is **51.7% lower** in this pair. Successful research text is **83.6% lower**, independently of
the baseline's six malformed search attempts. The current run retried one edit whose comparison notes exceeded the
existing 500-code-point limit. Both recovered normally; their failed-call costs remain in the all-tool totals.

Public-handler reads of the saved databases confirmed the original four selected memberships and all **60** copies
unchanged. Both runs saved Focused Reader and Patient Supplier as pool-only options with qualified contributions,
rejected Misleading Seed's access tag, distinguished a token supplier from an outlet, and disclosed that pool options
do not repair selected coverage. Both final answers qualified draw accounting and sacrifice costs, distinguished supply,
outlets and death payoffs, and reported the finite search coverage without claiming joint Availability or playability.
The current run reused the confirmed Brief/policy, used focused views, learned compact tags, omitted broad membership
evidence and batched rules in one lookup. It inspected **all seven** identities: this small fixture demonstrates staging
and removal of duplicate rules hydration, not narrowing a large population to fewer contenders. Baseline additionally
rewrote selected-card contributions; current saved detailed contributions for the new options. Review that difference
alongside the final answers when assessing usefulness.

For completeness, native Pi's raw assistant usage sums were: baseline input **87,249**, cached input **460,672**, output
**3,997**, reported total **551,918**; current input **65,821**, cached input **426,368**, output **3,953**, reported total
**496,142**. Reported reasoning was 215/444 respectively and is not added again. These counters include repeated context,
have provider-specific/cache semantics, and are separate from unique tool-text counts; they are not externally verified
billing or a causal savings forecast. One non-deterministic synthetic pair is insufficient for a general quality claim.
