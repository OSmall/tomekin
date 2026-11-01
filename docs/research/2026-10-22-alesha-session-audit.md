# Alesha Session Investigation

Date: 2026-10-22 (Australia/Sydney). This records investigation findings and unresolved design questions, not adopted changes or a live work tracker.
Implementation changes made during the investigation were reverted at the user's request; only these reports remain.

## Scope And Evidence

Three delegated audits inspected the 419-record, 5.3 MB `session_alesha.jsonl` and correlated events in the 4.3 GB
`.data/tomekin.log`. The coordinating agent read their reports rather than the transcript. The audit covers all
32 user messages, four ask-user answers, 204 tool results, 14 actual errors, the compaction and the final workflow.
Physical transcript/log line references are local evidence locators; these large local files are not copied here.

- [User friction and complete error inventory](alesha-session-audit/friction-and-errors.md).
- [Tool projection, context and latency measurements](alesha-session-audit/tool-output-and-latency.md).
- [Actual workflow, research digest and probability decisions](alesha-session-audit/workflow-and-research.md).

WebStorm and its existing `tomekin` SQLite connection worked. Read-only inspection of candidate
`01a1599b-b6bd-7000-853d-48c706a8d270` found 100 selected copies (one commander, 99 Mainboard), 168 options and 14 plan
nodes. The agent performed no writes to the user's database. The transcript's earlier 166-option figures describe
an earlier revision; later land additions account for the current larger pool.

## Main Finding

The human supplied the strategy control loop. Relevant advice already existed, but lifecycle contracts, contextual
methodology, Format examples and retrieval mechanics competed for attention. Available advice did not reliably cause
completed strategic stages. The strongest successful sequence was:

Oracle/actions and prerequisites → exemplar/tag/definition research → focused search criteria → assessed pool →
turn-based role and mana probabilities → coherent selection → aggregate reconciliation → explicit checks.

Whether and how to encode that sequence in skills is a subject for later discussion. No revised workflow is adopted
by this report.

## Observed Failures And Their Causes

| Finding | Evidence | Cause / open question |
| --- | --- | --- |
| Premature progression | L49–60, L86–94: saved core lacked meaningful graph/coverage and pool depth | The agent advanced without evidence that earlier strategic stages were complete. How should stages and completion criteria guide it? |
| Commander fit drift | L128–134, L169–170: user repeatedly restores power≤2, setup, timing and action analysis | Known commander constraints did not consistently govern assessment. How should action/prerequisite reasoning drive the process? |
| Research required direction | L115, L171, L189: user asks for snowball, exemplar/tag definitions and normal support | The preparation sequence was human-directed. What research artifact would reliably guide subsequent searches? |
| Statistics arrived late | First calculator call only after L309; colors only after L380 | Calculator capability existed but was not used proactively. Which decisions should require which quantitative evidence? |
| Repeated instruction loads | 34 skill reads, ~390 KB; root read 17 times across one compaction | Bootstrap says before any product call; OpenCode says before responding. These ambiguous triggers may encourage rereads. Causation is plausible, not proven. |
| Unreadable persisted research | L251 save succeeds, L267 requires 51,344 response bytes with 51,200 budget | Accepted text cannot fit the atomic read record. Bounded lossless text retrieval or another research-storage design needs discussion; the defect remains. |
| Stale continuation | L254 checkpoint describes condensed research after expanded replacement | The checkpoint did not reflect the latest saved research. What should a verified, resumable checkpoint contain? |
| Misleading apparent edit latency | ~303/358 seconds before large calls; successful save 0.598 seconds | The observed delay was mainly generation of large replacements, not demonstrated slow SQLite execution. What save granularity would avoid this? |
| Slow Collection searches | 54–112 seconds; 14–24 global provider pages for some calls | Ownership filtering follows global provider traversal. Search strategy and provider design both warrant investigation; smaller output alone does not eliminate scanning. |
| Unwanted tag metadata | L208, six tag calls returning ~75k text characters | `browse_tags` has no field projection. Narrow exact lookups/shallow hierarchy reduce cost, but a real projection gap remains. |
| Cursor failures | L31, L226/228, L357/360 | Submitted opaque cursor strings differ from returned strings. There is no demonstrated Availability-baseline defect. How can continuation become less transcription-prone? |
| Scope confusion | L61–85 | A location-only research pass was mistaken for a new whole-deck policy. How should the agent distinguish local search scope from deck-wide permission? |
| Final assessments stale | L409 mana revision removes War Room and Rogue's Passage | Current DB still says “12” draw including War Room and “8” attack support including Passage. Reconciliation after membership changes failed; the candidate remains unchanged. |

Three `invalid provider page` errors (L143/145/155) are observed provider-response validation failures. The available
audit did not establish the rejected field or whether upstream content versus parser strictness caused them; no more
specific cause is asserted. Other errors are fully inventoried in the linked friction report: zero-selected role-gap
validation, invalid relationship endpoints, a 504-codepoint rationale against a 500 limit, and user cancellation.

## Tool Output Findings

Card search/lookup projection worked across 2,876 returned records: extra keys were mandatory identity and multipart
faces needed to fulfill requested Oracle text. Broad all-tag requests legitimately returned all tags; that was request
breadth rather than a projection violation. Scoped totals remained unknown rather than pretending global totals were
owned totals.

Total tool result text was 2,137,864 characters. This is a character measurement, not a token/billing estimate:

| Tool | Calls | Returned text characters |
| --- | ---: | ---: |
| get_deck_candidate | 30 | 546,287 |
| search_cards | 33 | 494,067 |
| skill read | 34 | 389,566 |
| lookup_cards | 27 | 219,938 |
| render_deck_candidate | 6 | 217,628 |
| check_collection_availability | 5 | 103,044 |
| browse_tags | 6 | 74,719 |
| hypergeometric_calculator | 33 | 11,529 |

Repeated candidate views and witness/Pull List traversal duplicated information. Complete summary Availability checks
already work with `first: 0`. The distinction between checking sufficiency and retrieving physical-copy witnesses
was not applied economically. Candidate inspection and tag-definition projection also have room for task-specific
improvement; no retrieval API or provider optimization has been adopted.

The 4.3 GB debug log is itself a substantial investigation cost. No log-format or retention change was made in this
investigation; the audits used targeted correlations instead of loading it into model context.

## Research Recovered

The [workflow digest](alesha-session-audit/workflow-and-research.md) retains the full human-directed sequence, exemplar
families, useful tag vocabulary, exact timing qualifications, role-access decisions and colored-mana correction.

The successful human-directed analysis considered both what the commander consumes and what events it produces: deliberate graveyard setup,
attack access, becoming tapped, W/B payment, leaving graveyard, entering, combat damage, sacrifice/death, reset and
conversion. It covers normal mana, card advantage, interaction and recovery as well as synergies. Becoming-tapped
research extends the user's current request; the original session did not explore it.

One possible direction is to supplement the existing role graph with causal action reasoning. The evidence establishes
a need for better reasoning and workflow direction; it does not settle whether a different graph model is warranted.
That remains a design question for grilling, rather than a decision made by this investigation.

Probability supports access and count/deadline tradeoffs. It does not prove joint assembly, castability or win rate.
A proposed approach would connect card decisions to measured configuration needs while retaining qualitative rules,
cost and output comparisons. Cheap, late and conditional contributors differ, and overlapping source marginals cannot
be multiplied as though independent. The appropriate operational requirements remain open for discussion.

## Status And Discussion Boundary

All implementation, skill, configuration, test and existing-document edits from this investigation have been reverted.
The investigation reports are retained. No changes were made to the user's Tomekin database.

Possible remedies mentioned in the delegated reports are proposals for discussion, not adopted specifications or
committed work. Separate conversations can examine the strategic workflow, action reasoning/graph design, probability
requirements, research persistence, retrieval projections, search performance, continuation handling and reconciliation.
The evidence and unresolved causes above should inform those conversations before implementation choices are made.
