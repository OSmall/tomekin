# Future Direction

This document captures known directions that are intentionally outside the MVP or not yet designed in detail. These items should not be treated as current requirements unless a later decision promotes them into scope.

## Collection Import

The MVP supports ManaBox collection CSV exports only. Future work may add support for other collection export formats and source systems.

Future import work should preserve the generic Collection model rather than coupling the product to one source format.

Future work may add separate Existing Deck imports if collection exports do not provide enough metadata to infer Existing Decks reliably.

More specialised import/export formats may be needed later for exact collection or printing metadata. [MTGGoldfish supported import formats](https://www.mtggoldfish.com/help/import_formats) is one example of format variance to consider.

## Adjacent Card Groups

Sideboards, maybeboards, considering boards, upgrade boards, and budget alternative boards are future scope.

The MVP Portable Decklist should remain final-deck-only. Future work may introduce separate structures for adjacent card groups without polluting the importable decklist.

## Persistence History

The MVP treats saved Deck Opportunities and Deck Candidates as mutable records.

Future work may add versioning, undo, historical revision browsing, or comparison across revisions. This should not complicate the MVP persistence model.

Future persistence work may also retain historical Collection snapshots. The MVP only needs import timestamps for freshness checks.

## Rules Judging

The MVP requires rules awareness, not full rules judging.

Future work may add deeper rules support, including comprehensive rule citations, detailed interaction adjudication, and judge-style explanations.

## Meta Analysis

Competitive meta analysis is not core MVP scope.

Future work may add format metagame tracking, tier lists, tournament results, trending archetype analysis, and stronger competitive calibration, especially for non-Commander formats.

## Pricing And Finance

The MVP includes price awareness for missing-card budgeting, not price tracking or MTG finance.

Future work may add price history, market trends, speculation support, buylist optimisation, collection valuation, and broader MTG finance analysis.

## Collection Management

The MVP is read-only with respect to Collection state.

Future work may explore write-back, source-system sync, deck registration, binder updates, or collection-management workflows. These should remain separate from the MVP's collection-first deck-building promise unless deliberately promoted into scope.

## User Interface

The MVP should preserve structured saved Deck Opportunities and Deck Candidates so they can be accessed later outside the original agent conversation.

Future work may add a richer user interface over saved opportunities, deck candidates, refresh status, import summaries, and deck-building workflows.

Future UI work may parse or wrap the MVP's structured Markdown output. Stable headings, sections, and repeated fields in MVP output are intended to keep that path open without defining UI architecture now.

## Format Expansion

The MVP emphasises Commander/EDH while preserving a path to other formats.

Future work may add deeper support for 60-card formats, including format-specific legality, sideboards, meta expectations, power calibration, and deck construction conventions.

Project language and requirements should remain format-extensible so later work can support other MTG formats without rewriting the product concept.

## Protected Collection Metadata

The MVP handles protected, sentimental, display, trade, or otherwise excluded cards through the Collection Access Policy.

Future import sources may expose first-class metadata for protected cards. If so, the Collection Access Policy should be able to incorporate that metadata without turning the product into a full collection management system.

Future protected-card workflows may cover sentimental, display, trade, high-value, altered, damaged, or otherwise excluded cards as first-class use cases.

## Technology And Architecture

The MVP will start as local opencode tooling over a TypeScript portable core running on Bun. This keeps the first implementation quick while preserving a path to a later web-based, multi-user hosted product.

Database, AI model provider, repository architecture, user interface shape, hosting, and deployment strategy remain otherwise deferred.

Those decisions should be made when the product requirements are clearer.
