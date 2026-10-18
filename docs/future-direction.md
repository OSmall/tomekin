# Future Direction

This document captures uncommitted possibilities outside the current [Product Scope](./product-scope.md) and
[Product Behavior](./product-behavior.md). Nothing here is a current requirement, queued deliverable, or shipped
capability unless a later decision promotes it into scope.

## Collection Import

A future release could support collection exports and source systems beyond ManaBox CSV while preserving the generic
Collection model.

Separate Existing Deck imports may become useful if future collection sources do not expose enough metadata to infer
Existing Decks reliably. More specialised import/export formats may also be useful for exact collection or printing
metadata. [MTGGoldfish supported import formats](https://www.mtggoldfish.com/help/import_formats) illustrate the format
variance that such work would need to consider.

## Adjacent Card Groups

Future product design may introduce maybeboards, considering boards, upgrade boards, or budget alternatives as
structures separate from the final importable Portable Decklist.

## Reference Data Setup

The single-file Scryfall import command could eventually be deprecated in favor of coordinated Scryfall Bulk Data
Sync. Until an explicit deprecation decision, the local-file command remains supported for offline repair, debugging,
and fixture workflows.

## Validation Evidence

Content fingerprints could eventually support reuse of Deck Candidate validation results by recognizing unchanged
relevant inputs, including when edits are later reversed. This is an optional alternative to the UTC timestamp
approach adopted in the [pool planning decision](https://github.com/OSmall/tomekin/issues/78#issuecomment-6192102478),
not a queued requirement or an implemented feature.

## Persistence History

Future work may add Deck Candidate versioning, undo, historical revision browsing, comparison across revisions, or
historical Collection snapshots.

A first-class `DeckBuildingProject` could own a Format, confirmed Deck Building Brief revisions, and Collection
provenance. Multiple Deck Candidates could then reference the exact Brief revision they were built against instead of
embedding independently mutable copies.

Structured Deck Candidate data could eventually become the source of truth for rendering. Derived Markdown and
Portable Decklists could replace the current full Markdown snapshot, leaving only analysis that cannot be derived from
structured fields as authored persisted content. This remains an uncommitted redesign possibility.

## Rules Judging

Future work may add deeper rules support, including comprehensive rule citations, detailed interaction adjudication,
and judge-style explanations.

Legality Assessments could gain stable structured finding codes and typed context if a concrete UI, analytics,
localization, or automated-remediation consumer needs them.

## Meta Analysis

Future work may add Format metagame tracking, tier lists, tournament results, trending archetype analysis, and stronger
competitive calibration.

## Pricing And Finance

Future work may add reliable current-price data, budget-aware recommendations, price history, market trends, buylist
optimisation, collection valuation, and broader MTG finance analysis.

## Collection Management

Future work may explore write-back, source-system sync, deck registration, binder updates, or collection-management
workflows. These should remain separate from Tomekin's collection-first deck-building promise unless deliberately
promoted into scope.

## User Interface

Future work may add a richer user interface over saved Deck Candidates, import summaries, and deck-building workflows.
It may parse or wrap the current structured Markdown output without coupling the current product to a particular UI
architecture.

## Agent Quality Evaluation

Future work may add an opt-in runner around the manual deck-building scenario corpus. A separate judging agent,
LLM-as-judge score, or CI threshold would need evidence that it produces reliable decisions before adoption.

## Format Expansion

Future work may extend Tomekin beyond Commander/EDH and the currently supported paper-first 60-card Formats. Project
language should remain Format-extensible so additional Formats or Arena-first workflows do not require rewriting the
product concept.

## Protected Collection Metadata

Future import sources and workflows may expose first-class metadata for sentimental, display, trade, high-value,
altered, damaged, or otherwise protected cards. This could support exclusion and handling rules without turning Tomekin
into a full collection-management system.

## Technology And Architecture

A later product may use a web-based, multi-user hosted interface instead of or alongside the current local agent
harness. Database, AI model provider, user interface, hosting, and deployment choices remain open until product needs
justify them.
