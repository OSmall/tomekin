# Product Behavior

This document is the durable contract for Tomekin's current user-observable behavior. Product promise and scope belong
in [`product-scope.md`](./product-scope.md); domain terms belong in the [glossary](../GLOSSARY.md); persisted records
belong in [`data-model.md`](./data-model.md); Card Query semantics belong in [`card-query.md`](./card-query.md); and
verification policy belongs in [`testing.md`](./testing.md).

## Supported Routes

Tomekin supports three distinct ways to reach or revise a Deck Candidate.

### Restricted interactive Pi session

On macOS arm64, `bun run tomekin` starts Pi through the inherited terminal using a persistent clone-local profile at
`.data/pi`. Tomekin verifies the pinned Pi v0.85.1 standalone artifact's checksum and reported version before it runs;
its separate clone-local runtime cache contains only Tomekin-owned artifacts. The default Tomekin database remains
`.data/tomekin.sqlite`, and `TOMEKIN_DB_PATH` remains available for an isolated session.

The session exposes exactly the 16 Tomekin Agent Tools, `read`, and Pi's interactive `ask_user` tool. Shared tools run
in one lazy Bun Worker lane; `read` is Pi-local and
limited to existing regular files below `skills/`; it reads the working tree and supports Pi-style one-indexed line
`offset` and `limit` ranges. The launcher explicitly registers that directory as Pi-native skills,
while ambient skill and context-file discovery remain disabled. Before every agent turn, Tomekin appends its product
bootstrap to Pi's normal system prompt. The bootstrap identifies Tomekin's collection-first deck-building role, states
its restricted authority, and directs the agent to read the root `tomekin-deck-building/SKILL.md` before product-tool
use. That skill routes to the further skills required by the request.
Core-owned Zod input contracts supply tool argument affordance; Card Query preserves its structured validation
diagnostics for nuanced semantic rules. Expected failures are actionable results and unexpected errors are sanitized.
Core Agent Tool output has a temporary 16,000-character prefix safety cap; this is not a recovery mechanism and does
not apply to scoped `read`. Compact, recoverable product-tool output remains separate planned work. Aborting a read
terminates its Worker and discards late output. Dispatched candidate writes and explicit check tools settle before shutdown and are not reported as cancelled; an
unexpected Worker exit reports an unknown outcome for the agent to verify through Deck Candidate reads. The profile loads
only the reviewed `pi-ask-user@0.15.0` extension entry point and no bundled resources. Pi
login, settings, conversations, and recovery remain Pi-owned within the clone-local profile. Unsupported platforms and failed artifact verification
fail before the session begins.

### Collection Opportunity discovery through construction

For an open request such as “what can I build?” or a broad seed that still needs comparison, Tomekin:

1. checks that local Scryfall reference data is ready;
2. drafts a Format-specific Deck Building Brief and asks the user to confirm or edit it;
3. resolves an exact allow-list of Collection Locations when Collection evidence matters;
4. searches the allowed Collection and local reference data for viable directions;
5. returns at most three ranked Deck Opportunities, without padding a weak shortlist;
6. waits for the user to choose or refine a direction; and
7. routes the selected opportunity to the matching Commander/EDH or 60-card construction method.

A Deck Opportunity shortlist is transient analysis. The current tools do not save Deck Opportunities. Discovery stops
before producing or saving a full decklist.

If no direction is viable, Tomekin reports the specific blockers and offers constrained next moves, such as changing
the Format Anchor or Power Level, relaxing the Collection allow-list, or increasing missing-card tolerance. It does not
silently force a weak Deck Candidate. If the user explicitly proceeds despite the blockers, the result is labelled as
compromised and explains why.

### Direct construction from a confirmed Brief

When the user already supplies a sufficiently specific Format Anchor or deck direction, Tomekin may proceed directly
from a confirmed Deck Building Brief to fresh construction. A Deck Opportunity is a comparison and selection layer, not
a mandatory persisted intermediate.

Commander/EDH construction requires a confirmed commander or selected Deck Opportunity. Standard, Pioneer, Modern,
Legacy, Vintage, Pauper, and Casual 60 construction requires a selected Deck Opportunity or specific Format Anchor.

### Existing Deck or Deck Candidate tuning

Tuning starts from an imported Existing Deck or a saved Deck Candidate and produces a Deck Change Proposal. The proposal
contains paired additions and cuts, the applicable Addition Pool, the aggregate effect, and material caveats. It is
analysis rather than a saved deck, and Tomekin states that nothing was saved.

A sufficiently contextualized review of user-nominated cards may proceed with stated material assumptions. An open
review requires a concise confirmed tuning Brief and an explicit Addition Pool.

For a 60-card deck, Tomekin first classifies the work as focused repair, rebuild around an identity, or fresh
construction. Moving beyond focused repair requires user confirmation. Commander tuning preserves the established game
plan, intended Commander Bracket, and play experience unless the user asks to change them.

Tomekin explains the exact resulting additions, cuts, quantities, plan/Brief changes and persistence target. Existing
explicit authorization for that result counts; otherwise it obtains candidate-level confirmation. A saved Deck
Candidate is updated in place unless the user asks for a copy or variant. An imported Existing Deck is never mutated; an
accepted revision can only be saved as a new Deck Candidate.

## Deck Building Brief

Before substantial discovery or fresh construction, Tomekin drafts a best-effort Deck Building Brief and asks the user
to confirm or edit it. If the Format is absent or ambiguous, it asks a focused Format question rather than silently
defaulting to Commander/EDH.

The Brief is discriminated by `format`:

- every Brief records the goal, nullable Format Anchor, play experience, nullable budget, missing-card tolerance, combo
  tolerance, constraints, exclusions, and assumptions;
- a Commander/EDH Brief records a nullable Commander Bracket and explicit Rule Zero exceptions; and
- a 60-card Brief records a nullable Power Level and does not contain Commander-only fields.

The drafting tool always marks the Brief as requiring confirmation. It also records that Collection availability must
be checked before treating cards as Missing Cards, and it calls out an omitted Commander Bracket for confirmation.

The current Brief schema does not contain a structured Collection Access Policy or dedicated Deck Opportunity ranking
priorities. The agent therefore keeps the confirmed exact Collection Location allow-list and relevant priorities in
the working conversation and repeats that scope in each Collection query. This procedural boundary is a current
limitation, not hidden policy state.

## Power And Play Experience

Power and pilot complexity are separate. Commander Bracket or a 60-card Power Level describes intended strength;
`playExperience` describes the desired gameplay feel and complexity. An approachable play experience does not by itself
authorize weakening the deck.

When the user says “fun” without further detail, the Brief defaults to synergistic, varied, expressive, and
fair-feeling play. Other requested experiences may be interactive, splashy, resilient, political, aggressive,
controlling, combo-oriented, or unusual.

Commander/EDH uses Commander Brackets rather than an invented numeric scale. Bracket terminology is external and may
change; Tomekin records the user's intended table experience and does not treat a copied historical bracket description
as permanent rules authority.

Deterministic local legality results cannot be overridden by agent judgment. A Rule Zero exception is permitted only
when it is explicit in the confirmed Commander/EDH Brief and labelled in the output; it does not rewrite the underlying
legality result.

## Collection Behavior

The Collection is an imported, read-only snapshot. Tomekin may search and reason over it, but it does not move cards,
change locations, register a deck in the source collection manager, or write back to ManaBox. Saving a Deck Candidate
does not make it part of the Collection. After physical or source-system changes, the user reimports the Collection.

Collection queries are stateless. When Collection evidence matters, Tomekin lists the available Collection Locations,
confirms an exact case-sensitive allow-list of `(locationType, locationName)` pairs, and reuses it unchanged. A query
that accidentally omits or widens the confirmed scope is discarded and retried.

Locations of type `deck` are treated as Existing Decks. Whether their cards may be used is expressed procedurally in
the confirmed working context; the tools do not independently decide whether an owned copy is Available, Committed, or
excluded.

### Empty Collection

No imported Collection and an imported empty Collection have the same deck-building consequence: there are no owned
copies available to the workflow. Tomekin can still discover directions from the user's stated preferences and can
construct and save a Deck Candidate. Every required copy is reported as Missing, and no Collection Pull List is
presented beyond stating that no owned copies are available.

### Owned and missing evidence

For a non-empty active Collection scope, Tomekin re-queries every final card name under the unchanged allow-list and
compares scoped quantities with required quantities before rendering. It then reports best-effort Available, Committed,
and Missing evidence from the imported snapshot.

This evidence is not a deterministic final Availability service. Card Query reports owned rows and quantities; the
agent applies the procedurally confirmed scope and explains the result. Retained scoped reasoning may therefore become stale after
a later import, and the current product has no automatic refresh service or persisted freshness status.

## Validation, Rendering, and Persistence

Before rendering a final Deck Candidate, Tomekin:

1. resolves every card name to a local Card Identity;
2. validates Format construction and legality against the confirmed Brief;
3. performs the final scoped Collection evidence check when applicable;
4. evaluates Format-appropriate power context, Mainboard land count, and Mana Value distribution; and
5. performs at most three complete evaluate-and-revise passes before presenting the best candidate with any unresolved
   caveats.

The evaluator is not a deterministic deck-quality oracle. Strategy, roles, packages, Synergy, and tuning judgments are
agent reasoning backed by local facts and skills.

Every rendered Deck Candidate uses these stable Markdown sections in order:

1. Game Plan
2. Power And Experience
3. Legality Assessment
4. Deck Structure
5. Portable Decklist
6. Collection Status
7. Key Synergies
8. Interaction And Protection
9. Mana And Curve
10. Optional Upgrades
11. Cuts And Exclusions
12. Assumptions And Caveats

The Portable Decklist is an importable card-name list without prices, Collection Locations, printing selection, or
explanations. Commander/EDH renders `Commander` followed by `Mainboard` and never adds a Sideboard. A 60-card candidate
renders `Mainboard`, followed by `Sideboard` only when Sideboard cards exist. Tomekin creates no 60-card Sideboard by
default; it does so only when requested, using user-supplied matchup context or clearly labelled general-purpose
assumptions.

### Structured candidate writes

`create_deck_candidate({label, brief, plan?, options?, memberships?, assessments?})` saves concrete authorized construction
progress, including unfinished or empty selection. `edit_deck_candidate({candidate_id, expected_updated_at, changes})`
loads unchanged records server-side and applies one atomic typed change set. There is no mandatory Markdown, automatic
legality/evaluation/Availability check, dedicated copy tool, stored proposal, confirmation token or completion state.

The Brief owns Format and preferences. A plan uses `schema_version: 1`; node and relationship additions declare a local
`ref`. Contributions use `role_id` or `role_ref`; relationships use `source_id`/`source_ref` and `target_id`/`target_ref`.
The server returns candidate/authored UUIDs in `created_ids`. Local references are confined to the request. Roles and
relationships retain stable IDs across wording changes. Options use Card Identity, contributions use option/role pairs,
and selected memberships use Card Identity/section. New record operations are explicit `add`; updates use `update` and
field `changes`; removals use `remove`. Membership `set` uses an absolute positive quantity and supplied order/note;
zero does not remove. Omitted fields survive; explicit `null` clears optional fields. Lists replace their own field.

Every assessed option needs a reasoned contribution. Selected membership needs its option. Desired roles with zero selected
contributors require an explained coverage gap. Pool alternatives contribute zero selected copies. Related removals must
be reconciled together. Duplicate logical records, cross-candidate/unknown references, invalid endpoints, unknown fields,
unsupported schema versions and invalid text fail without partial writes. Contribution/relationship/route rationales,
option comparison notes, individual qualifications and evidence notes allow at most 500 Unicode code points. Stored or
returned reasoning is never silently truncated.

The exact UTC `updated_at` is candidate-wide. A stale edit returns `conflict`, with candidate ID and expected/current
timestamps. Reload and reconcile rather than silently rebasing. Success returns compact actual-change context and stable
ID mappings. `get_deck_candidate({id})` and `list_deck_candidates` return summaries with Format/anchor, timestamps, selected
section quantities, pool size and concise role/gap information. Explicit `get_deck_candidate({id, view: "state"})` exposes
current authoritative records for resumption. Ordinary reads do not invoke checks. Summaries expose each recorded check's
applicability and check time; explicit state retains complete findings and captured dependencies.

### Explicit saved and transient checks

`validate_format_legality` and `evaluate_deck_candidate` accept either `{candidate_id, expected_updated_at, changes?}`
or initial `{cards, brief}`. A saved baseline must match the exact last-read content timestamp. Optional typed `changes`
apply to a transient resulting state; revised selected memberships are hydrated with canonical card facts before checking.
Initial inputs and trials return complete findings without creating candidates or overwriting saved evidence.

An explicit saved check captures the Brief, selected memberships, Oracle facts and successful Oracle import dependency
in one database snapshot. Its latest candidate-owned findings publish only while the check's selected inputs, relevant
Brief fields, Oracle import/contract revision and validator versions still match. Concurrent relevant changes return
the captured findings as `outdated` without replacing evidence for newer inputs. Publication does not change candidate
content timestamps or invalidate an existing edit precondition.

Evidence reads distinguish `absent`, `applicable` and `outdated` separately for `format_legality` and `deck_evaluation`.
Applicability describes checked inputs, including illegal results; it is not a completion flag. Pool/plan maintenance,
selected notes/order and unrelated Brief changes preserve selected legality. Evaluation power/play-experience changes
stale evaluation while preserving legality. Selected identity/quantity/section changes affect both. Oracle imports and
validator changes stale the checks that use them; unused Printing/tag imports do not. These checks need current Oracle
reference data, independently of Printing/tag import readiness. Collection Availability remains a separate capability.

Create, edit, read and rendering operations never invoke these checks. Pi preserves their complete findings beyond its
old preview boundary, classifies both as possible evidence writes and settles dispatched calls after cancellation.

After an unknown Worker write outcome, inspect before retrying. For edits, compare saved records and timestamps with the
intended result. For creates, use list/get to inspect possible matches by label, Format/anchor, times and contents; labels
are not unique and exact-once retries are not guaranteed. Inspect ambiguous matches rather than guessing. Pi serializes
mutations, ignores cancellation once dispatched and waits for their settlement during shutdown. Unexpected Worker failure
reports `unknown_write_outcome`. Neither the Worker lane nor a candidate ID replaces concurrency checks or authorization.

## Hypergeometric Calculator

`hypergeometric_calculator` is one shared Agent Tool exposed through Pi and OpenCode. It models a uniformly chosen
sample without replacement from one binary qualifying/nonqualifying population, independently of reference readiness,
Collection data or Deck Candidates. It reads and writes no records and is never implicitly invoked by candidate reads,
saves or evaluation. The agent supplies and explains the qualifying predicate, actual copy counts, sampling assumptions,
event and chosen reliability target. Commander access, Sideboard cards and pool alternatives do not create library copies.

Both operations require `operation`, integer `populationSize` in `0..1000`, integer `sampleSize` in `0..populationSize`,
and an explicit `event`:

- `probability` also requires integer `populationSuccesses` in `0..populationSize`. Supported event shapes are
  `{kind: "exactly", count}`, `{kind: "at_least", count}`, `{kind: "at_most", count}` and
  `{kind: "between", lower, upper}` with inclusive endpoints and `lower <= upper`.
- `minimum_successes` omits `populationSuccesses`, requires an `at_least` event and an exact `targetProbability` decimal
  string in `[0,1]` with at most 18 fractional digits. Examples include `"0"`, `"0.70"`, `"1.000"` and
  `"0.999999999999999999"`. Whitespace, signs, exponents, percentages, numeric targets and excess precision are rejected.

Counts and event endpoints are nonnegative safe integers. Event endpoints may exceed population/sample support and
retain ordinary zero/one probability semantics. Unknown properties, missing requirements, unsupported combinations,
coercion and mathematical defaults are rejected with `validation_error`; the message identifies the invalid field or
combination. An impossible event is a successful zero probability. A positive minimum-count target for an event above
the sample size returns `target_unattainable` with the sample/event/target limitation.

Successful results contain the validated `request`, `model: "uniform_without_replacement"`, approximate numeric
`probability` and exact `eventStatus` (`impossible`, `certain` or `nontrivial`). Minimum-count results additionally
contain `minimumSuccesses` and `previous`, either `null` at minimum zero or
`{populationSuccesses, probability, eventStatus}` for the immediately preceding count. The returned minimum is the
smallest qualifying population count meeting the target; exact integer comparisons decide equality and minimality even
when displayed probabilities round alike. No fractions, BigInt values, distributions or explanation prose are serialized.

The empty population permits only an empty sample/count, with zero observed successes certainly. Target zero returns
minimum zero even for an impossible event; an at-least-zero event returns zero for any valid target. For positive event
count `k` within sample size `n`, target exactly one requires `populationSize - n + k` qualifying copies. A displayed
probability rounded to one can still have `nontrivial` status. Nonzero numeric probabilities remain positive and have
relative error at most `1e-12` within the supported domain; exact zero and one display as zero and one.

For example, this request returns minimum `11`, approximately `0.7102774789751556`, with previous count `10` at
approximately `0.6736037421365677`:

```json
{"operation":"minimum_successes","populationSize":99,"sampleSize":10,"event":{"kind":"at_least","count":1},"targetProbability":"0.70"}
```

This is a bounded sampling calculation, not evidence of castability or a universal reliability target. Joint or
overlapping-category events, mulligans, selection/draw sequences, sequencing and mana, simulation and win-rate/power
judgments are unsupported. The agent must interpret the result against the stated Deck Plan and assumptions.

## Import Behavior

The supported Collection source is a ManaBox Collection CSV. The file must be readable before an import attempt reaches
the database. A missing or unreadable path exits without creating a `CollectionImport` record.

Once the file is readable, the importer requires compatible local `oracle_cards` and `all_cards` reference data. It
strictly validates the header and every row, resolves each Scryfall ID to a local Card Printing, validates Set code,
collector number, language, and finish, and treats name disagreement and some optional metadata problems as warnings.
All blocking validation must pass before the current Collection snapshot is replaced transactionally.

A successful import replaces the current Collection Locations and owned rows and records a summary. A readable attempt
that fails prerequisites or validation records a failed attempt and preserves the previous successful snapshot.
`oracle_tags` is not required for raw Collection import but is required for tag-backed deck-building discovery.

ManaBox List rows are not currently skipped and summarized as desired; unsupported location types fail validation. The
tracked compliance work is [issue #39](https://github.com/OSmall/tomekin/issues/39).

Scryfall reference data is populated only by explicit user-invoked sync or local-file import commands. Successful
dataset replacement is transactional, and a failed import preserves the previous usable dataset. Normal deck-building
does not automatically fetch or refresh Scryfall data.

## External Authority Limits

The local deck-building agent is authority-bound to Tomekin's product tools. During normal deck-building it cannot run
shell commands, inspect source files, issue raw SQL, use generic database access, call arbitrary web services, or write
Collection state.

Local Scryfall data is authoritative for Card Identity, Oracle text, Format legality, Game Changer flags, EDHREC rank,
Card Sets and Printings, and Oracle Tags. Tomekin does not claim live prices, current metagame knowledge, exhaustive
combo detection, gameplay simulation, mulligan or casting analysis, goldfishing, or deterministic strategic optimality.
The bounded uniform-sampling calculation above supports explicit opening-sample events only.
Only the explicit Scryfall sync command performs live Scryfall network requests.
