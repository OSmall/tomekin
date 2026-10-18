# Product Behavior

This document is the durable contract for Tomekin's current user-observable behavior. Product promise and scope belong
in [`product-scope.md`](./product-scope.md); domain terms belong in the [glossary](../GLOSSARY.md); persisted records
belong in [`data-model.md`](./data-model.md); Card Query semantics belong in [`card-query.md`](./card-query.md); and
verification policy belongs in [`testing.md`](./testing.md).

`browse_tags` provides explicit slug/label/alias search, known-slug definitions and recoverable catalogue listing.
Hierarchy appears only when requested for lookup: one parent/child level by default, explicitly up to three.
Missing tag data is a readiness error; empty search and known-slug misses are separate successful outcomes.
Complete definitions and requested graph records survive adapter transport without preview clipping. Catalogue
pagination binds the successful tag import; per-card inherited tags remain complete at every depth.
`search_card_sets` discovers existing imported Set code/name metadata and depends only on All Cards readiness.

## Known-card facts

Use `lookup_cards` for batched exact canonical names, Oracle IDs or exact Printing IDs. It returns every ordered
occurrence, including duplicates and explicit local misses. Select complete facts explicitly; Oracle identity is always
present and exact Printing references also retain Printing identity. Selected multipart Oracle text includes all existing
ordered face text. Complete direct/inherited tags are optional local enrichment. Compatible Oracle Cards and All Cards
imports are required; missing optional tags are unavailable rather than false empty associations. Lookup does not fetch
from a provider or establish ownership/Availability. Its [contract](./card-query.md#known-card-lookup) specifies selectors,
whole-envelope byte limits, positional cursors, readiness, invalidation and complete error recovery.

The default adapters consolidate `get_card_identity` and `resolve_decklist_cards` into this tool and remove the normal
`summarize_reference_support` catalogue capability. Setup diagnostics and actionable tool readiness failures report
reference status. Internal legacy/validation handlers remain available to existing application code.

## Supported Routes

Tomekin supports three distinct ways to reach or revise a Deck Candidate.

### Restricted interactive Pi session

On macOS arm64, `bun run tomekin` starts Pi through the inherited terminal using a persistent clone-local profile at
`.data/pi`. Tomekin verifies the pinned Pi v0.85.1 standalone artifact's checksum and reported version before it runs;
its separate clone-local runtime cache contains only Tomekin-owned artifacts. The default Tomekin database remains
`.data/tomekin.sqlite`, and `TOMEKIN_DB_PATH` remains available for an isolated session.

The session exposes the approved Tomekin Agent Tools, `read`, and Pi's interactive `ask_user` tool. Shared tools run
in one lazy Bun Worker lane; `read` is Pi-local and
limited to existing regular files below `skills/`; it reads the working tree and supports Pi-style one-indexed line
`offset` and `limit` ranges. The launcher explicitly registers that directory as Pi-native skills,
while ambient skill and context-file discovery remain disabled. Before every agent turn, Tomekin appends its product
bootstrap to Pi's normal system prompt. The bootstrap identifies Tomekin's collection-first deck-building role, states
its restricted authority, and directs the agent to read the root `tomekin-deck-building/SKILL.md` before product-tool
use. That skill routes to the further skills required by the request.
Core-owned Zod input contracts supply tool argument affordance; Card Query preserves its structured validation
diagnostics for nuanced semantic rules. Expected failures are actionable results and unexpected errors are sanitized.
`lookup_cards` and `browse_collection_cards` preserve their complete 51,200-byte compact success/error envelopes in model-visible content and details,
with ordinary `first`/`after` recovery. Location inspection preserves complete names/IDs and snapshot context. Other unmigrated core tools retain their temporary 16,000-character preview cap;
scoped `read` has its own file limits. Aborting a read
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

The Brief stores nullable `collectionAccessPolicy` and `recentAdditions`. A confirmed policy is bound to the active
successful Collection import, exact locations and typed conjunctive copy requirements. Recent-addition intent records
strict physical-copy eligibility versus exploratory identity inspiration, explicit UTC bounds, the user's task timezone,
and whether undated discovery was required or declined. With a confirmed policy, strict intent requires policy date
bounds at least as restrictive as its interval; incompatible/incomplete inputs reject before eligibility is claimed.
A provisional candidate may retain null permission. Ranking priorities remain in the working conversation.

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

`list_collection_locations` returns exact `locations` and `collection_context` identifying the active successful import.
The agent confirms allowed sources once and records the policy in the Brief or passes an explicit confirmed policy
before candidate creation. Exact case-sensitive type/name pairs or UUID plus type/name resolve only within that snapshot.
An empty allow-list explicitly permits zero copies. Contradictory dispositions and stale references reject; excluded
cards, Printings and row IDs subtract from permission. Existing Deck rows remain visibly Committed even when permitted.

`browse_collection_cards` evaluates all restrictions on one actual row and its own Printing before applying result
bounds. Missing relevant metadata is uncertain, never positive strict proof; currency-qualified prices compare only
known matching currencies. Legacy Card Query still requires its explicit positive scope and does not enforce the new
policy or correlate independent Printing predicates with owned rows.

ManaBox `Added` is optional operational source chronology. Valid explicit-zone calendar timestamps normalize to UTC;
missing, malformed, timezone-ambiguous and unsupported-precision values remain unknown, with nonblocking diagnostics
where appropriate. New imports preserve milliseconds. Legacy dates whose precision was lost cannot prove strict date
bounds. Release dates and import times never substitute for source-added dates.

Recent browsing accepts explicit inclusive `added_at_from` and exclusive `added_at_before` UTC instants. The agent
resolves human intervals using the user's task timezone. It separately browses `date_state: "unknown"` within the same
permitted scope unless declined, labels those rows possibly relevant and reports incomplete coverage. Strict recent
copies require known dates inside the interval; exploratory inspiration may assemble identities from other permitted
rows. Source order is source row then ID; both date directions put nulls last and break ties by row ID.

### Empty, absent and unconfirmed Collection

No import is explicit `no_collection`; an imported empty snapshot is `ready` with its active import ID and zero rows.
Both supply zero recorded ownership without proving the user's physical possessions. A legacy snapshot lacking an
authoritative active pointer reports `reimport_required`. A nonempty snapshot with null Brief policy establishes no
permission; browse returns `unconfirmed_policy`. It is distinct from an explicitly confirmed empty allow-list.

Successful replacement invalidates prior policy/row/location references and continuation; list locations and reconfirm
scope. Failed attempts preserve active references and usable continuation. Relevant successful reference replacement
also invalidates dependent browse cursors. Results expose the effective policy, bounded completion and undated coverage;
opaque candidate/cursor IDs never substitute for inspectable permission.

### Owned and missing evidence

Row browsing establishes policy-compliant matching row quantities, not joint allocation across a complete deck. The
current final Available, Committed and Missing conclusions remain best-effort agent reasoning until the deterministic
whole-demand Availability service ships. A candidate save does not reserve copies, move cards or publish final
Availability proof.

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

Generated reports derive the current Brief, selected memberships, Deck Plan nodes/relationships, assessed options and
contributions, focused judgments and latest explicit check evidence. Missing focused judgments are `Unrecorded`;
recorded checks keep their `absent`, `applicable` or `outdated` labels and complete findings. Rendering never computes
a check or manufactures current Collection Availability. Reports are generated output, with no separately editable
report authority or report history. Existing low-level template rendering utilities are not the Agent Tool input contract.

The Portable Decklist is an importable card-name list without prices, Collection Locations, printing selection, or
explanations. Commander/EDH ordinarily renders `Commander` followed by `Mainboard`. A 60-card candidate ordinarily
renders `Mainboard`, followed by `Sideboard` only when Sideboard cards exist. Rendering incomplete saved progress exposes
every populated selected section, even a section that a later explicit Format check will reject; it never silently
drops selected copies. Tomekin creates no 60-card Sideboard by
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
section quantities, pool size and concise role/gap information. Summaries expose each recorded check's applicability and
check time. Ordinary reads do not invoke checks.

### Complete views and generated output

`get_deck_candidate({id, view, first?, after?})` supports `brief`, `selected`, `options`, `pool`, `plan`, `assessments`,
`json`, `report` and `portable_decklist`, plus the default compact `summary`. There is no public unbounded `state` view.
Options include canonical names, comparison notes, selected memberships and complete contribution rationale,
qualifications and evidence. The pool view has one deduplicated `options` array and role groups referring to those
options by Card Identity; section-aware selected quantities come only from memberships.

Explicit views use the shared complete bounded envelope: default `first: 50`, range 0–200, maximum 51,200 escaped UTF-8
JSON bytes, complete `edges[].node`, `pageInfo` and stop reason. Each node is `{path, value}` in `path_value_v1` format.
Apply records in order: an empty path sets the root; other paths assign an object key or array index. Explicit empty
containers preserve empty objects/arrays. Array entities retain complete local reasoning. For `json`, this reconstructs
the complete current candidate, including full check findings and dependencies. For report/decklist views, concatenate
the ordered string values. Repeat `id` and `view` with `after`; `first` may change. A view's transient hash binds its
content timestamp and all included records, so changed canonical names, evidence publication or evidence applicability
reject affected continuation even when candidate content timestamps stay unchanged. Unrelated data does not stale an
unchanged Brief-only view. There is no persisted cursor/result store. An oversized indivisible record fails explicitly;
there is no truncated rationale or serialized preview.

`render_deck_candidate({candidate_id, output: "report" | "portable_decklist", first?, after?})` uses the same recoverable
output contract and loads saved records. It accepts no authored report sections, names or independent decklist.
Only selected membership and canonical names feed the Portable Decklist. Pool alternatives are never selected copies.

Developer inspection uses:

```sh
bun run tomekin deck-candidate export-plan <id> --format json --projection strategy --output plan.json
bun run tomekin deck-candidate export-plan <id> --format mermaid --projection pool --output plan.mmd
```

`strategy` is the default projection; `selected` adds selected contributors and quantities by section; `pool` also shows
active alternatives. Mermaid shows desired gaps, route priorities, directed influence and symmetric competition, with
deterministic identifiers/order, escaped labels, candidate/update context and a legend. It is inspection, not strategic
validation. JSON always preserves the complete authoritative candidate regardless of diagram projection. Exports run
no checks. Missing candidates/plans, invalid arguments and output failures are actionable failures. Same-directory
atomic publication preserves previous artifacts on failure. Tomekin produces Mermaid source, with no SVG renderer or
graph frontend dependency.

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
