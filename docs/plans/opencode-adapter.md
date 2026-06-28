# Opencode Adapter Plan

This plan defines the MVP opencode adapter roadmap and the first implementation slice for a local MTG deck-building agent.

The first slice should produce a useful Commander/EDH deck-building agent over local Scryfall reference data, while preserving the project boundary that reusable product logic lives in the portable core and opencode remains only one adapter surface.

## Research Basis

The first-slice agent strategy is grounded in three deck-building inputs:

- The project MVP quality bar: a Deck Candidate must have a clear game plan, enough enablers and payoffs, interaction, mana support, card advantage, protection or resilience where appropriate, a sensible curve, explicit status for owned/missing cards, and explanations for meaningful inclusions and exclusions.
- Commander Brackets guidance from Wizards of the Coast: Commander power should be described through play experience, bracket expectations, Game Changers, tutors, fast mana, two-card combos, extra turns, and mass land denial rather than an invented 1-10 scale.
- Expert deck-building practice: strong decks are built as coherent plans and packages, not piles of individually strong cards. The agent should reason about mana, curve, role coverage, synergy, win paths, interaction, resilience, and table expectations before finalizing a list.

## Reference Docs And Specs

Relevant project docs:

- [`README.md`](../../README.md): local setup, SQLite migration command, and Scryfall import commands.
- [`CONTEXT.md`](../../CONTEXT.md): canonical product and domain language.
- [`docs/product-scope.md`](../product-scope.md): collection-first product promise and current boundaries.
- [`docs/mvp.md`](../mvp.md): MVP workflow, Deck Building Brief expectations, Deck Candidate quality bar, Commander Brackets, and output format.
- [`docs/architecture.md`](../architecture.md): portable core, opencode adapter, repository ports, and technology baseline.
- [`docs/data-model.md`](../data-model.md): persisted records, Deck Candidate storage, Card Identity, Card Printing, and Card Identity Tag relationships.
- [`docs/testing.md`](../testing.md): Bun test posture, Exact Output Tests, SQLite integration tests, and LLM boundary.
- [`docs/adr/0001-opencode-first-portable-core.md`](../adr/0001-opencode-first-portable-core.md): opencode-first MVP with portable core.
- [`docs/adr/0004-typed-services-with-result-seams.md`](../adr/0004-typed-services-with-result-seams.md): typed services, `neverthrow` Result seams, and Zod validation.
- [`docs/adr/0005-repository-ports-with-sqlite-mvp.md`](../adr/0005-repository-ports-with-sqlite-mvp.md): repository ports and SQLite MVP persistence.
- [`docs/adr/0010-explicit-sqlite-migrations.md`](../adr/0010-explicit-sqlite-migrations.md): explicit SQLite migration workflow.

Relevant external specs and references:

- [opencode config schema](https://opencode.ai/config.json): authoritative config shape.
- [opencode config docs](https://opencode.ai/docs/config/): config locations, merge order, schema, plugins, and permissions.
- [opencode agents docs](https://opencode.ai/docs/agents/): primary agents, subagents, Markdown agent files, `steps`, and agent permissions.
- [opencode custom tools docs](https://opencode.ai/docs/custom-tools/): `.opencode/tools/`, `tool()` helper, Zod arguments, and custom tool execution context.
- [opencode plugins docs](https://opencode.ai/docs/plugins/): plugin lifecycle hooks and plugin-provided custom tools when hooks are needed.
- [opencode skills docs](https://opencode.ai/docs/skills/): `.opencode/skills/<name>/SKILL.md`, required frontmatter, discovery, and skill permissions.
- [opencode permissions docs](https://opencode.ai/docs/permissions/): least-privilege permission keys, defaults, and per-agent overrides.
- [Scryfall Card Objects](https://scryfall.com/docs/api/cards): `oracle_id`, `legalities`, `type_line`, `oracle_text`, `edhrec_rank`, `game_changer`, and card-face data.
- [Scryfall Bulk Data](https://scryfall.com/docs/api/bulk-data): `oracle_cards`, `all_cards`, `oracle_tags`, update cadence, and price-staleness warning.
- [Scryfall Tags](https://scryfall.com/docs/api/tags): community-maintained Oracle Tags, stable tag IDs, direct taggings, aliases, hierarchy, and tagging weights.
- [Scryfall Search Syntax](https://scryfall.com/docs/syntax): useful reference for local query semantics such as color identity, format legality, `is:commander`, `is:partner`, `is:gamechanger`, and Oracle tag search. The first slice does not call live Scryfall search; it should implement local equivalents where needed.
- [Wizards Commander Brackets Beta](https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta): Commander Bracket and Game Changer source guidance.
- [EDHREC Guide to Commander Brackets](https://edhrec.com/guides/edhrec-guide-to-commander-brackets): practical Commander Bracket examples and deck construction differences across brackets.

## Resolved Direction

- The result of this planning session is a plan only; implementation happens later.
- The plan covers the full MVP opencode adapter roadmap, with the first implementation slice explicitly bounded.
- The first slice is Commander/EDH only, with format-extensible names and schemas where practical.
- The first slice is reference-data-only and treats the Collection as empty because Collection import is not implemented yet.
- Deck Candidates may be built directly from a confirmed Deck Building Brief. Deck Opportunities are optional decision-layer records for discovery and comparison workflows, not mandatory intermediates.
- The first slice should persist Deck Candidates, even with an empty Collection, because saved Deck Candidates are core product records.
- The first slice should not persist Deck Opportunities.
- The first slice requires complete local Scryfall reference data: `oracle_cards`, `all_cards`, and `oracle_tags`.
- First-slice deck-building tools use SQLite as the local authoritative reference store and do not make hidden network calls.
- Missing reference data is a blocking setup error with actionable commands.
- Stale reference data should warn by default, not block, unless a later operation explicitly requires current volatile external facts.
- No MCP server is included in the roadmap for now. Future web app code should call core services and Agent Tools directly rather than depending on MCP internally.
- Agent Tool is the canonical term for protocol-neutral callable capabilities intended for AI-agent use, backed by product services and wrapped by adapter surfaces.
- Reusable Agent Tool contracts and handlers live in `@mtg-agent/core`.
- Opencode-specific custom tool registration, optional plugin hooks, agent files, skill files, permissions, and formatting live in `packages/opencode` and project-local `.opencode/` artifacts.
- `packages/opencode` keeps its current package name and remains opencode-specific.
- Use deep modules at `packages/core/src/*.ts` for the first slice rather than nested folders.
- Do not add an ADR for this plan; existing ADRs already cover opencode-first delivery, portable core, typed service seams, SQLite persistence, Drizzle, and migrations.

## First Slice Goal

Build a local opencode Commander deck-building agent that can:

- Confirm a Deck Building Brief.
- Search and inspect local Scryfall-backed card identity, legality, and tag data.
- Build a Commander/EDH Deck Candidate from local Card Identity records.
- Treat the Collection as empty and all candidate cards as Missing Cards.
- Analyze the in-progress deck against the confirmed brief.
- Validate Commander construction rules where deterministic local checks support them.
- Persist the final Deck Candidate and Deck Candidate cards.
- Render stable Deck Candidate Markdown and a strict Portable Decklist.
- Reopen/export a saved Deck Candidate.

## Out Of Scope For First Slice

- ManaBox Collection import.
- Availability calculation.
- Existing Deck inference.
- Collection Access Policy enforcement beyond stating that the Collection is empty.
- Collection Pull List generation beyond saying no owned copies are available.
- Durable Deck Opportunities.
- Collection-driven Deck Opportunity discovery.
- Real price awareness or current deck cost calculation.
- Live Scryfall API fallback.
- Remote import jobs.
- MCP server.
- Non-Commander formats.
- Full combo detection.
- Candidate-specific structured card roles.
- Live LLM calls in the default test suite.

## Agent Strategy

The LLM acts as the deck builder. Deterministic code gives it reliable context, constraints, validation, persistence, and rendering.

The intended workflow is:

1. User asks for a deck.
2. Agent drafts a best-effort Deck Building Brief from the request.
3. Agent asks the user to confirm or edit the Deck Building Brief.
4. After confirmation, agent uses context retrieval Agent Tools to search cards, tags, legality, and likely packages.
5. Agent assembles an initial Deck Candidate from resolved Card Identity records.
6. Agent runs legality and analysis Agent Tools.
7. Agent revises targeted weak areas.
8. Agent repeats review and revision up to the runtime evaluation-pass limit.
9. Agent persists the final Deck Candidate.
10. Agent renders the final Markdown explanation and Portable Decklist.

The agent should not start by asking an exhaustive questionnaire. It should draft a best-effort brief first unless there is a hard blocker.

Hard blockers before drafting a brief include:

- The requested Format is ambiguous and changes deck construction rules materially.
- The request contains conflicting constraints that cannot be represented coherently.
- Required local Scryfall reference data is unavailable.

## Deck Building Brief Rules

- A confirmed Deck Building Brief is mandatory before any full Deck Candidate build.
- The brief captures user goals and deck-building preferences, not runtime/tool budgets.
- The brief should include format, format anchor, play experience, Commander Bracket or power expectation, budget preference if any, missing-card tolerance, combo tolerance, constraints, exclusions, and assumptions.
- The first slice only supports Commander/EDH as the format.
- If the user wants Rule Zero or intentionally non-legal Commander, the brief must state the intended legality exception.
- Budget preference may be captured, but real price validation is deferred.

## Runtime Policy

- Evaluation-pass limits are agent/runtime policy, not core persisted workflow state.
- The local opencode agent should default to at most three full evaluation passes.
- Tools remain stateless and composable.
- No database field tracks pass count.
- If the agent exhausts the pass limit, it should present the best candidate with unresolved caveats.
- A future hosted runtime may enforce stricter tool, time, or pass budgets independently of the Deck Building Brief.

## Core Modules

Use deep modules at `packages/core/src/` for first-slice implementation:

- `agent-tools.ts`: protocol-neutral Agent Tool schemas and handler functions that wrap core services for AI-agent use.
- `deck-building-brief.ts`: Zod schemas, defaults, normalization, and validation for Deck Building Briefs.
- `card-reference-queries.ts`: read/query services over Card Identity, Card Identity Tag, legality, and related reference data.
- `commander-legality.ts`: deterministic Commander construction and commander-section validation.
- `deck-candidate.ts`: Deck Candidate schemas, service contracts, persistence-facing types, and business errors.
- `deck-candidate-rendering.ts`: Portable Decklist rendering and stable Deck Candidate Markdown assembly helpers.

Export new public modules through `packages/core/src/index.ts`.

## Agent Tools

Agent Tools should be divided conceptually into context retrieval tools and analysis/action tools.

Context retrieval tools give the agent raw enough local data to reason flexibly:

- `query_cards`: run a CQL2-shaped Card Query over Card Identity, Commander legality, Card Identity Tags, and positive
  Collection queryables. This replaces the temporary narrow `search_card_identities` shape; see
  [`card-query.md`](./card-query.md) and ADR 0012.
- `get_card_identity`: retrieve canonical card details, parts, legality, tags, EDHREC rank where imported, Game Changer flag, and source URI.
- `search_card_identity_tags`: search Scryfall-backed Card Identity Tags by slug, label, aliases, and hierarchy context. Use tag UUIDs as stable identities; Scryfall warns that tag slugs and labels may change.
- `summarize_reference_support`: summarize local reference-data availability, timestamps, stale warnings, and whether all required datasets exist.
- `get_deck_candidate`: retrieve a saved Deck Candidate as structured data.
- `list_deck_candidates`: list saved Deck Candidates with scalar metadata and freshness status where known.
- `get_format_constraints`: return Commander construction constraints, local legality data status, and references to current external Commander Bracket guidance.

Analysis and action tools provide objective checks and durable operations:

- `draft_deck_building_brief`: validate and normalize an LLM-proposed brief, apply defaults, and expose assumptions for confirmation.
- `resolve_decklist_cards`: resolve proposed card names to exact Card Identity records before validation or persistence.
- `validate_format_legality`: validate Commander construction and return `legal`, `illegal`, or `unsupported` results with reasons.
- `analyze_mana_and_curve`: report land count, mana value distribution, color identity needs, available color production evidence, ramp/fixing evidence from tags, and brief-relative risks.
- `analyze_deck_structure`: report tag-backed and annotation-backed evidence for ramp, card advantage, removal, board wipes, stack interaction, protection, recursion, enablers, payoffs, win paths, lands, and theme density.
- `analyze_synergy_packages`: report source-backed tag clusters and agent-supplied package annotations, with risks when packages lack support.
- `analyze_interaction_and_protection`: report likely interaction and protection coverage from tags, text, and agent annotations.
- `analyze_win_paths`: report stated win paths, supporting cards, speed expectations, and brief-relative risks.
- `analyze_power_and_experience`: report Commander Bracket fit, Game Changer count, likely tutor/fast-mana/extra-turn/mass-land-denial/combo signals, and play-experience caveats.
- `evaluate_deck_candidate`: compose the granular analysis tools for a full pass when the agent needs an aggregate review.
- `save_deck_candidate`: persist the final candidate, card rows, confirmed brief, scalar metadata, and Markdown body.
- `render_deck_candidate`: render stable Markdown and strict Portable Decklist from a saved or in-progress candidate.

All non-legality analysis findings should be framed as brief-relative risks or observations rather than absolute failures.

## Agent-Supplied Annotations

Analysis tools may accept agent-supplied temporary annotations for the in-progress decklist.

Examples include:

- “This card is a payoff.”
- “This card protects the commander.”
- “This card belongs to the sacrifice package.”
- “This card is included for theme density rather than efficiency.”

These annotations may inform analysis during the build, but first-slice persistence should not store them as first-class `DeckCandidateCardRole` records.

## Candidate-Specific Roles

Candidate-specific roles such as enabler, payoff, win condition, protection piece, and theme card are valid deck-building concepts, but they are deferred from the first slice.

Reasons:

- They describe why a card belongs in a specific Deck Candidate, which is distinct from source-backed `CardIdentityTag` data.
- They are useful for analysis and explanation, but the exact structured vocabulary needs real saved candidate examples.
- Inventing a canonical role taxonomy without a source risks mixing project heuristics with objective source-backed facts.

First-slice behavior:

- Use `CardIdentityTag` as source-backed card-function evidence. Scryfall Oracle Tags are community-maintained Tagger data, so analysis should treat them as strong local evidence rather than infallible truth.
- Use agent-supplied annotations transiently during analysis.
- Store grouped explanations and package rationale in the Deck Candidate Markdown body.
- Revisit structured `DeckCandidateCardRole` later as an explicit design branch.

## Commander Legality

Legality validation should live as normal core product logic, not inside Agent Tools.

Use `packages/core/src/commander-legality.ts` for readable, independently tested deterministic checks.

Scryfall Search supports predicates such as `is:commander` and `is:partner`, but the first slice does not call live Scryfall Search and the imported card object does not expose a dedicated commander-eligible boolean. The core legality module should therefore derive local commander eligibility from imported `type_line`, `oracle_text`, `CardIdentityPart` data where relevant, and `legalities.commander`.

First-slice deterministic checks should include:

- Deck has a `Commander` section.
- Deck size is 100 including commander section cards unless the brief explicitly allows Rule Zero exceptions.
- Singleton violations are detected, with basic lands exempted and other explicit rules-text exceptions supported where practical.
- Non-commander cards are within the commander color identity.
- Cards are Commander-legal according to local Scryfall legality data.
- Single legendary creature commanders are eligible.
- Single planeswalkers or other cards with recognized “can be your commander” text are eligible.
- Common multi-commander mechanics are supported when readable from local card text.

Supported multi-commander mechanics for the first slice should include:

- `Partner`.
- `Partner with [name]`.
- `Friends forever`.
- `Choose a Background` plus one Background.
- `Doctor's companion` plus one Time Lord Doctor.

Validation should be layered:

- `isCommanderEligible(card): boolean` for individual commander eligibility.
- `validateCommanderSection(cards): legal | illegal | unsupported` for the commander section as a whole.
- No LLM override is allowed for deterministic legality results.
- Unsupported multi-commander mechanics should be reported as unsupported rather than silently passed.
- Rule Zero exceptions must be explicit in the Deck Building Brief and labelled in output.

## Power And Experience

First-slice power analysis should use Commander Brackets as the default Commander/EDH power language.

Use imported local Scryfall `game_changer` data:

- Count Game Changers in the Deck Candidate.
- List which cards are Game Changers.
- Warn if local Scryfall data is stale.
- Do not maintain a separate hand-written Game Changer list in the first slice.

Analysis should also flag likely play-experience risks where local tags/text/annotations support them:

- Best-in-class or dense tutors.
- Fast mana.
- Extra turns.
- Mass land denial.
- Stax or prison patterns.
- Likely combo packages.
- Early deterministic win patterns.

Combo detection is intentionally limited:

- The agent must ask or confirm combo tolerance in the Deck Building Brief.
- Tools may flag likely combo-related cards or packages from tags, text, and annotations.
- Tools must not claim exhaustive combo detection.
- A future combo database or rules engine may improve this later.

## Deck Candidate Persistence

First-slice persistence should include `DeckCandidate` and `DeckCandidateCard` records.

`DeckCandidate` should persist:

- Internal UUIDv7 identifier.
- Label.
- Format.
- Format Anchor when applicable.
- Commander Bracket or power expectation when applicable.
- Confirmed Deck Building Brief as Zod-validated structured JSON.
- Collection import timestamp as nullable or unknown because the first slice has no Collection import.
- Markdown body as canonical saved explanation.
- Created and updated timestamps.

`DeckCandidateCard` should persist:

- Internal row identity or composite identity as appropriate for repository design.
- Deck Candidate ID.
- Card Identity ID.
- Quantity.
- Section, at minimum `commander` and `deck`.
- Stable sort order.
- Optional notes only if needed for a concise durable card-level reason.

Do not persist:

- Free-text unresolved card names.
- Intermediate rejected cards.
- Every search result used during refinement.
- Agent scratch annotations as first-class roles.
- Collection status as permanent truth.
- Collection Pull List data.

Before persistence:

- Every final Deck Candidate card must resolve to exactly one local `CardIdentity`.
- Ambiguous or missing names block persistence until resolved or replaced.
- Final legality and analysis caveats should be present in the Markdown body.

## Deck Candidate Output

The renderer should enforce stable Markdown sections.

Required first-slice sections:

- `Game Plan`
- `Power And Experience`
- `Legality Assessment`
- `Deck Structure`
- `Portable Decklist`
- `Collection Status`
- `Key Synergies`
- `Interaction And Protection`
- `Mana And Curve`
- `Optional Upgrades`
- `Cuts And Exclusions` when meaningful
- `Assumptions And Caveats`

The strict Portable Decklist block must be importable and separate from explanatory Markdown.

Commander/EDH Portable Decklist format:

```txt
Commander
1 Example Commander

Deck
1 Sol Ring
1 Arcane Signet
```

Portable Decklist rules:

- Quantity first, then exact Card Identity name.
- `Commander` and `Deck` sections only for first-slice Commander output.
- No commentary inside the strict block.
- No prices, availability notes, category labels, optional upgrades, maybeboards, or explanations inside the strict block.
- Multiple commander-section entries are allowed for supported multi-commander mechanics.

The human-readable grouped view should live outside the strict block and may group cards by deck-building purpose, package, or explanation.

## Collection Status In First Slice

The first slice treats the Collection as empty.

Output rules:

- State that no Collection has been imported or the Collection is empty.
- Treat every card in the Deck Candidate as a Missing Card.
- Do not provide a real Collection Pull List.
- The Collection Pull List section may state that no owned copies are available because the Collection is empty.
- Do not infer Availability, Committed Cards, Existing Decks, or borrowability.

## Opencode Artifacts

Commit project-local opencode artifacts so the local product interface is reproducible.

Use opencode's plural project-local directories from the current docs. Singular directories are supported for backward compatibility, but new files should use plural names.

Planned files:

- `.opencode/agents/mtg-deck-builder.md`: primary product agent instructions.
- `.opencode/skills/mtg-deck-building/SKILL.md`: reusable deck-building workflow instructions if useful separately from the primary agent.
- `.opencode/tools/mtg-agent.ts`: custom tool definitions that delegate to `packages/opencode`.
- `.opencode/plugins/mtg-agent.ts`: optional plugin hooks only if lifecycle behavior is needed beyond custom tool definitions.
- `opencode.json`: only if required for project-local config such as `default_agent` or explicit permission overrides.

Project-local agents, skills, tools, and plugins are auto-discovered from `.opencode/` by opencode. A project-local root `opencode.json` is not required just to load those files; add it only for project configuration such as `default_agent` or explicit permission overrides.

The agent Markdown file should include valid opencode frontmatter:

- `description`: required, and should clearly say when to use the MTG deck-building agent.
- `mode: primary`: lets the user select the product agent directly.
- `permission`: denies broad built-in capabilities by default and allows only required product custom tools.
- `steps`: optional native opencode iteration cap; use this for a coarse safety limit in addition to the agent's own three-pass workflow instruction.

If the skill file is added, its `SKILL.md` frontmatter must include `name: mtg-deck-building` and a specific `description`, and the `name` must match the containing directory.

Custom tool definitions should use opencode's `tool()` helper from `@opencode-ai/plugin`, Zod-backed `args`, and `execute(args, context)` handlers. If multiple tools are exported from one file, opencode names them with the `<filename>_<exportname>` convention; the implementation should choose filenames/export names that produce clear tool names.

If TypeScript tooling or tests typecheck `.opencode/tools/` files directly, make `@opencode-ai/plugin` resolvable through the appropriate project or `.opencode/package.json` dependency rather than relying on an implicit opencode runtime dependency.

The first-slice deck-builder agent should be a primary agent.

The base deck-builder agent should be workflow-light and authority-bound. It should know the product boundaries, allowed
tools, and deterministic checks, but should not hardcode a detailed deck-building workflow once Card Query is
available. Repeatable workflows should move into skills or subagents after they are validated through real use.

Least privilege rules:

- Deny edit permission.
- Deny or tightly restrict bash permission.
- Do not grant arbitrary file read/search for normal deck-building.
- Use opencode custom tools for all product actions. Custom tools are controlled by opencode permission keys using their tool names, so the implementation should explicitly allow only the MTG deck-building tool names and deny broad built-in tools.
- Do not grant dbhub or any database MCP access to the normal deck-building agent unless it is explicitly approved as a
  product Agent Tool wrapper. Raw SQL/database MCP access is developer/admin-only and outside the deck-building
  workflow.
- Do not expose SQLite migrations or imports as first-slice deck-builder tools.

The deck-builder agent is a product agent, not a coding agent.

## Opencode Package

`packages/opencode` remains opencode-specific.

It should own:

- Tool handler wrappers that translate opencode custom tool calls into core Agent Tool calls.
- Result-to-opencode-output rendering.
- Local wiring from core services to SQLite repositories.
- Adapter smoke-test seams.

It should not own:

- Deck-building product logic.
- Commander legality algorithms.
- Deck Candidate persistence contracts.
- Protocol-neutral Agent Tool schemas.
- SQLite schema or migrations.

## Setup And Admin Boundaries

First-slice deck-building requires preloaded local reference data.

The deck-builder agent should report missing setup with commands such as:

```sh
bun run db:sqlite:migration:apply
bun run import:scryfall -- oracle_cards /path/to/oracle-cards.json
bun run import:scryfall -- all_cards /path/to/all-cards.json
bun run import:scryfall -- oracle_tags /path/to/oracle-tags.json
```

First-slice opencode tools should not run these commands automatically.

Future admin/setup tools may initiate imports from remote locations, including Scryfall reference imports and Collection imports, but those should be separate privileged workflows with explicit confirmation and controlled backend behavior.

## Testing Plan

Use `bun test` for deterministic tests. Do not call live LLMs in the default test suite.

Core unit tests should cover:

- Deck Building Brief schema validation, defaults, and contradiction handling.
- Card reference query behavior over small fixtures.
- Agent Tool input/output schemas.
- Commander legality for ordinary commanders, unsupported commanders, illegal cards, color identity violations, singleton violations, and supported multi-commander mechanics.
- Portable Decklist rendering with Exact Output Tests.
- Deck Candidate Markdown section rendering at the section-presence level.

SQLite integration tests should cover:

- Deck Candidate and Deck CandidateCard persistence.
- Reopening a saved candidate with Card Identity joins.
- Transactional behavior for candidate saves.
- Migrations for new candidate tables.

Opencode adapter tests should remain thin smoke tests:

- Tool inputs validate and translate into core calls.
- Missing setup errors render usefully.
- Saved candidate output is returned in the expected shape.
- Permissions/config-sensitive behavior is not tested through live opencode unless a separate smoke harness is added.

Live deck-building quality evaluation may be added later as an explicit opt-in script, not as part of `bun test`.

## Implementation Sequence

### Slice 1A: Core Contracts

- Add `deck-building-brief.ts` with schemas and validation.
- Add `deck-candidate.ts` with schemas, save/read service contracts, and expected business errors.
- Add `agent-tools.ts` with first Agent Tool schemas and protocol-neutral handler contracts.
- Export new modules from `packages/core/src/index.ts`.

### Slice 1B: Commander Legality And Rendering

- Add `commander-legality.ts` with deterministic checks and unit tests.
- Add `deck-candidate-rendering.ts` with Portable Decklist rendering and stable Markdown section helpers.
- Add Exact Output Tests for strict decklist blocks.

### Slice 1C: SQLite Persistence

- Add Drizzle schema for `deck_candidate` and `deck_candidate_card`.
- Generate SQLite migration with `bun run db:sqlite:migration:generate` from the workspace root.
- Add repository methods for saving and reading Deck Candidates.
- Add SQLite integration tests using migrated temporary databases.

### Slice 1D: Card Reference Queries And Analysis

- Add read/query services over existing Card Identity, legality, and Card Identity Tag tables.
- Add Agent Tools for card search, tag search, card detail retrieval, and reference-data status.
- Add granular analysis tools with objective, brief-relative outputs.
- Add aggregate `evaluate_deck_candidate` composition.

### Slice 1E: Opencode Adapter

- Implement opencode wrapper handlers in `packages/opencode`.
- Add `.opencode/tools/mtg-agent.ts` to expose custom tools.
- Add `.opencode/plugins/mtg-agent.ts` only if lifecycle hooks are needed.
- Add `.opencode/agents/mtg-deck-builder.md` as primary least-privilege product agent.
- Add `.opencode/skills/mtg-deck-building/SKILL.md` only if it reduces prompt duplication.
- Add minimal root `opencode.json` only if required.
- Add adapter smoke tests.

### Slice 1F: Documentation And Verification

- Update README with how to use the local deck-builder agent after migrations and Scryfall imports.
- Update `docs/mvp.md`, `docs/data-model.md`, and `docs/testing.md` if implementation details refine persisted shape or test expectations.
- Run `bun test` and `bun run typecheck`.

## Later Roadmap

### Collection Import And Availability

- Implement ManaBox Collection import.
- Add Collection Location and Existing Deck inference.
- Add Availability analysis under Collection Access Policy.
- Add Collection Status and Collection Pull List generation.
- Update Deck Candidate refresh behavior against latest Collection import timestamp.

### Deck Opportunity Discovery

- Add collection-driven Deck Opportunity discovery using Collection support, Availability, Card Identity Tags, Format Anchors, and Deck Building Preferences.
- Persist Deck Opportunities after discovery semantics are implemented.
- Support ranked opportunity shortlists and comparison workflows.

### Price Awareness

- Add deterministic price source or import path.
- Use prices for Missing Card budget estimates and cheaper alternatives.
- Keep purchase price from Collection metadata distinct from current Missing Card price awareness.
- Scryfall bulk card objects include prices, but Scryfall warns bulk prices should be considered dangerously stale after 24 hours, so first-slice deck-building should not use imported bulk prices as reliable current budget validation.

### Admin And Setup Tools

- Add privileged setup/import workflows that can initiate imports from remote locations.
- Keep admin tools separate from normal deck-building tools.
- Require explicit confirmation for long-running or mutating setup operations.

### Candidate-Specific Roles

- Revisit `DeckCandidateCardRole` after real Deck Candidate outputs exist.
- Keep candidate-specific roles distinct from `CardIdentityTag`.
- Decide whether roles should be stored as structured rows, JSON, or remain Markdown-only.

### Hosted Web App

- Expose the same core services and Agent Tools through the web app backend.
- Do not require MCP for internal web app operation.
- Let hosted persistence, auth, scheduled imports, and runtime budgets become separate architecture decisions.

## Documentation Changes Already Made

- `CONTEXT.md` now defines `Agent Tool`.
- `docs/mvp.md` now states that a Deck Candidate may be built directly from a confirmed Deck Building Brief, with Deck Opportunities as optional decision-layer records.
- `docs/design-branches.md` now tracks candidate-specific `DeckCandidateCardRole` as a future design branch.
