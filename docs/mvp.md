# MVP

The MVP should prove that an agent can discover and build useful Commander/EDH deck candidates from the user's real Collection.

## MVP Scope

The MVP should help an agent:

- Parse a user's exported MTG collection.
- Understand owned cards, quantities, and useful collection metadata.
- Distinguish available, committed, and missing cards.
- Ask for a Collection Access Policy instead of assuming whether committed cards may be used.
- Discover promising deck opportunities from the user's Collection.
- Build Commander/EDH deck candidates from selected deck opportunities.
- Build Deck Candidates from an empty Collection when the user wants generic deck-building support.
- Explain why recommended cards belong in a deck candidate.
- Identify when a useful card is owned, committed to another deck, or missing.

## Primary Workflow

The primary MVP workflow is:

1. Discover Deck Opportunities from the user's Collection.
2. Present a ranked shortlist of the most promising opportunities with concise explanations.
3. Let the user choose or refine one opportunity.
4. Build a Deck Candidate from the chosen opportunity.

The user may also provide the starting point directly, such as a commander, theme, colour identity, or desired play experience. In that case, discovery is constrained by the user's seed rather than skipped entirely.

A Deck Candidate may also be built directly from a confirmed Deck Building Brief when the user has already provided a strong enough direction. Deck Opportunities are the decision layer for discovery, comparison, and choosing among possible directions; they are not a mandatory intermediate for every Deck Candidate.

The standard happy-path workflow is:

1. Import the Collection.
2. Show the Import Summary.
3. Ask for or infer the user's goal.
4. Produce a Deck Building Brief with stated assumptions.
5. Let the user confirm or edit the brief.
6. Discover Deck Opportunities.
7. Present a ranked Deck Opportunity shortlist.
8. Let the user choose or refine one Deck Opportunity.
9. Build one or more Deck Candidates.
10. Present Deck Candidate output, including Portable Decklist and Collection Pull List.
11. Save Deck Opportunity and Deck Candidate records.
12. Refresh saved records later only on explicit user action after a new Collection import.

This workflow is product behaviour, not an implementation architecture.

## Collection-Aware MVP

The product should not distinguish between a user who has not imported a Collection and a user who has imported an empty Collection. In both cases, the Collection is empty.

The agent may build a Deck Candidate against an empty Collection. There are no Available Cards, Committed Cards, Existing Decks, binders, or owned card copies. Every card in the Deck Candidate should be treated as a Missing Card.

The local opencode slice can search the current imported Collection snapshot, including binder locations and deck-type
locations inferred as Existing Decks. It can also save Deck Candidates before a Collection exists, but those saved
candidates have unknown Collection freshness and no real Collection Pull List until checked against an import.

The agent should still provide the usual deck-building explanation and Portable Decklist. It should not provide a Collection Pull List except to state that no owned copies are available because the Collection is empty.

Deck Opportunity discovery may still happen with an empty Collection, but it should be based on the user's stated commander, theme, format, play experience, budget, or other Deck Building Preferences rather than Collection support.

## Existing Deck Improvement

Improving an Existing Deck is a supported MVP workflow when the Existing Deck can be identified from the imported Collection metadata.

This workflow should reuse the same core deck-building capabilities as new Deck Candidate construction. The agent starts from the Existing Deck's current list, applies the Deck Building Brief and Collection Access Policy, then proposes a revised Deck Candidate with additions, cuts, Optional Upgrades, Collection Status, a Portable Decklist, and a Collection Pull List.

Existing Deck improvement output should include both a full revised Deck Candidate and a concise Change Summary. The full Deck Candidate is the source of truth for import and review. The Change Summary should explain additions, cuts, and the most important reasons for those changes.

Existing Deck improvement should not require the MVP to mutate Collection state, update the source deck, or become a collection management system. The user remains responsible for applying accepted changes in their collection management software and reimporting or resyncing later.

## Deck Building Brief

When Deck Building Preferences are incomplete, the agent may propose sensible assumptions instead of asking exhaustive questions. It should present those assumptions for confirmation before doing substantial analysis or building a full Deck Candidate.

Before substantial deck-building work, the agent should produce a Deck Building Brief for confirmation. The brief should summarise the user's goal, assumed or stated Deck Building Preferences, Collection Access Policy, and ranking priorities.

When the user gives a vague request such as `build me something fun`, the agent should propose a Deck Building Brief rather than asking an exhaustive questionnaire first. Sensible defaults should include Commander/EDH unless the user indicates another format, the default meaning of fun from the Play Experience section, moderate missing-card tolerance unless the Collection Access Policy says otherwise, a preference for Available Cards, and confirmation before relying heavily on Committed Cards. For Commander/EDH, the agent should infer a casual or mid Commander Bracket and ask for confirmation before substantial deck-building work.

The minimum Deck Building Brief should include:

- Goal.
- Format.
- Format Anchor, if any.
- Play experience.
- Power Level.
- Missing-card tolerance.
- Budget, if any.
- Collection Access Policy.
- Deck Opportunity evaluation priorities.
- Assumptions to confirm.
- Known constraints or exclusions.

For the MVP, the Collection Access Policy should be captured as structured data inside the Deck Building Brief rather
than as a separate persisted policy record. If the user changes their mind during a thread, the agent should restate the
updated Deck Building Brief or changed policy constraints for confirmation before relying on them for further searches
or final evaluation.

Missing-card tolerance and budget should be captured separately. Missing-card tolerance describes how willing the user is to use cards outside the Collection. Budget describes the money constraint on those Missing Cards.

Deck Opportunity evaluation priorities describe how the agent should rank trade-offs, such as Collection fit, power, budget, play experience, low disruption to Existing Decks, or strongest Synergy.

## Deck Opportunity Evaluation

A Deck Opportunity should be evaluated across several dimensions:

- Format anchor fit, such as commander fit for Commander/EDH.
- Support density in the Collection.
- Availability fit under the Collection Access Policy.
- Cohesion between cards.
- Completion cost.
- Desired play experience.
- Power And Experience fit for the intended table.

The relative importance of these dimensions is user-directed. The agent should not assume that owned-card usage, low completion cost, maximum power, or minimum disruption is always the top priority. One user may want to build strictly from available cards, while another may be happy to buy most of a new deck if the opportunity is compelling.

These priorities are captured as Deck Building Preferences. The Collection Access Policy is one part of those
preferences and describes deterministic constraints on which Collection cards, locations, Existing Decks, or metadata
categories may be used, protected, or excluded for the task.

The Collection Access Policy should be flexible enough to cover more than Existing Deck borrowing. It may include location-based access, such as excluding a binder or protecting an Existing Deck, and metadata-based access, such as avoiding foils, altered cards, damaged cards, high-value cards, or other categories the user does not want considered. The MVP does not need a separate protected-card registry.

Deck Opportunity discovery should be constrained by the confirmed Collection Access Policy. A Deck Opportunity that depends heavily on excluded or protected cards should not be ranked as strong under a policy that disallows those cards.

If the user is unsure about the policy, the agent may offer to compare policy variants, such as available-only versus allowing borrowable Existing Decks. The active policy should still be stated before substantial discovery work begins.

Softer borrowing preferences, such as borrowing only a small number of cards from Existing Decks or borrowing only when
a Committed Card is central to the Deck Candidate, belong in Deck Building Preferences rather than the Collection Access
Policy. The agent can reason about whether a proposed Committed Card is worth the disruption and explain that trade-off,
while deterministic tools should still report whether the card is owned, committed, missing, or excluded under the
confirmed hard constraints.

## Deck Opportunity Shortlist

When multiple Deck Opportunities are viable, the agent should present a shortlist rather than silently choosing a single winner. If the user explicitly asks the agent to choose and proceed, the agent may pick the strongest match and explain why.

A Deck Opportunity shortlist should be compact but decision-ready. Each entry should include:

- Format anchor, such as commander, central card, archetype, or format-specific constraint.
- Theme.
- Expected play pattern.
- Why the Collection supports it.
- Availability summary.
- Missing-card burden.
- Power And Experience fit.
- Play experience fit.
- Caveats.
- Recommendation under the Deck Building Brief.

The shortlist is not the final decklist. It is the decision layer before choosing or refining one Deck Opportunity into a Deck Candidate.

If the Collection has insufficient support for the requested deck, the agent should say so directly rather than forcing a weak Deck Candidate. It should explain what is missing, such as a suitable format anchor, enablers, payoffs, mana support, interaction, card advantage, or enough cards within the confirmed Collection Access Policy.

When redirecting, the agent should offer constrained alternatives, such as relaxing the Collection Access Policy, increasing missing-card tolerance, choosing a nearby Deck Opportunity with better Collection support, building a lower-power version, or saving the idea for later.

If there are no viable Deck Opportunities under the current Deck Building Brief, the agent should explain the specific blocker rather than forcing a weak shortlist or Deck Candidate. Blockers may include no suitable format anchor, too few enablers, too few payoffs, poor mana support, missing interaction, budget conflict, Power Level mismatch, or Collection Access Policy conflict.

The agent should offer constrained next moves, such as relaxing the Collection Access Policy, increasing missing-card tolerance, lowering or changing Power Level, changing commander, theme, or format, building from an empty-Collection direction, or saving the idea for later.

If the user explicitly insists on proceeding, the agent may build a compromised Deck Candidate, but it should label the result as compromised and explain why.

A single Deck Opportunity may lead to multiple Deck Candidates. Variants might reflect different Deck Building Preferences, such as available-cards-only, low-budget missing cards, higher-power, combo-free, or combo-inclusive versions.

By default, the agent should build one Deck Candidate that best matches the confirmed Deck Building Brief. If there is a meaningful fork, it may mention alternative variants briefly. It should not produce multiple full decklists unless the user asks for variants or the trade-off is central to the task.

When multiple Deck Candidate variants are produced, each variant should follow the same Deck Candidate output structure. Each variant should have its own Portable Decklist, Collection Pull List, Legality Assessment, missing-card burden, Optional Upgrades, Power And Experience target, and explanation of how it differs from the other variants. Commander/EDH variants should include Commander Bracket within Power And Experience.

When comparing variants, the agent should present a concise comparison before producing multiple full Deck Candidate outputs.

Deck Opportunities and Deck Candidates should be durable product objects that can be accessed by the user later. The MVP should preserve enough structured information to display saved Deck Opportunities and Deck Candidates without depending on the original agent conversation. This requirement should not dictate storage technology, application architecture, or user interface shape.

Persisting a Deck Opportunity or Deck Candidate should not make it part of the user's Collection state. Saved Deck Candidates remain proposals until the user updates their source collection system and reimports or resyncs the Collection. The Collection remains the imported owned-card snapshot from the source collection system.

Saved Deck Candidates should record the Collection import timestamp they were created or last updated against. If the Collection is reimported later, a saved Deck Candidate may need refresh or revalidation because Availability, Missing Cards, and Collection Pull Lists can change. Refreshing should recalculate Collection Status and Collection Pull List against the latest successful Collection import.

Saved Deck Opportunities should retain enough information to explain why the opportunity was worth considering without storing a full decklist. The minimum saved shape should include a short label, format, format anchor when applicable, theme, expected play pattern, Power And Experience target when applicable, why the Collection supports it, Availability summary, Missing Card burden summary, key Synergies or packages, caveats, recommendation rationale, the Deck Building Brief used to discover it, and the Collection import timestamp it was discovered against. Commander Bracket should be included within Power And Experience for Commander/EDH opportunities but should not be required for formats that do not use Commander Brackets.

Saved Deck Candidates should retain enough information to reopen, compare, refresh, and export them later without depending on the original agent conversation. The minimum saved shape should include a short label, format, source Deck Opportunity reference when applicable, Deck Building Brief, Collection import timestamp used for the latest update, Portable Decklist, Collection Status summary, Collection Pull List or enough information to regenerate it, Missing Cards and missing-card burden, Power Level and play-experience target, Legality Assessment, Game Plan, Key Synergies, Optional Upgrades, Cuts And Exclusions when applicable, assumptions and caveats, and variant label or comparison notes when applicable. Commander Bracket should be included for Commander/EDH Deck Candidates but should not be required for formats that do not use Commander Brackets.

For the MVP, saved Deck Opportunities and Deck Candidates should be mutable. The user may go back and forth with the agent during a session, refine requirements, and update the saved proposal rather than creating a new immutable record for every change.

When a mutable Deck Opportunity or Deck Candidate is updated after a new Collection import, it should reference the latest successful Collection import timestamp used for that update. The MVP should not retain historical Collection snapshots; timestamps are enough to identify whether saved analysis may be stale relative to the latest import.

Saved Deck Opportunities and Deck Candidates should expose a Collection freshness status based on their recorded Collection import timestamp:

- Current: saved item was last updated against the latest Collection import.
- Stale: saved item was last updated against an older Collection import.
- Unknown: timestamp is missing or cannot be compared.

A stale Deck Candidate should warn the user to refresh before relying on Availability, Missing Cards, or the Collection Pull List.

Stale saved Deck Candidates should refresh only on explicit user action. Opening a stale Deck Candidate should show the staleness warning and offer refresh rather than silently updating the saved proposal.

Refreshing a stale Deck Candidate should recalculate Collection-derived information such as Availability, Missing Cards, Collection Status, and Collection Pull List against the latest Collection import. It should update the saved Deck Candidate's Collection import timestamp. It should not change the Portable Decklist or deck-building choices unless the user asks the agent to revise the Deck Candidate itself.

Stale saved Deck Opportunities should also refresh only on explicit user action. Refreshing a Deck Opportunity should recalculate Collection support, Availability summary, Missing Card burden, and recommendation rationale against the latest Collection import. It should update the saved Deck Opportunity's Collection import timestamp. It should not automatically create or revise Deck Candidates unless the user asks.

## Play Experience

When the user asks for a deck to be fun, the agent should treat that as a play experience preference rather than a single objective score.

By default, fun means:

- Synergistic: cards combine into satisfying engines or packages.
- Varied: games do not always play out the same way.
- Expressive: the deck has a clear identity, theme, or story.
- Fair-feeling: the deck avoids oppressive locks, fast deterministic wins, or repetitive denial unless requested.

Other play experience preferences may include being interactive, splashy, resilient, political, aggressive, controlling, combo-oriented, or intentionally strange. If a highly supported Deck Opportunity conflicts with the requested play experience, the agent should make that trade-off explicit rather than ranking it as best by raw strength alone.

## Commander Brackets

For Commander/EDH, the MVP should use Commander Brackets as the default language for power level and expected game experience.

The agent should prefer Commander Brackets over an invented numeric power scale. If the user gives informal language such as `casual`, `precon`, `high power`, or `7/10`, the Deck Building Brief should translate that into an assumed Commander Bracket and ask for confirmation before substantial deck-building work.

Commander Brackets are external Commander terminology and may change over time. The project should reference current bracket guidance rather than treating copied bracket descriptions as permanent internal rules.

References:

- [Introducing Commander Brackets Beta](https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta) from Wizards of the Coast introduces the Commander Brackets system as a replacement for vague `1-10` power-level discussion.
- [EDHREC Guide to Commander Brackets](https://edhrec.com/guides/edhrec-guide-to-commander-brackets) provides practical examples of how deck construction changes across brackets.

## Combos And Synergy

The agent should distinguish combos from ordinary synergy.

Synergy means cards meaningfully reinforce, enable, reward, or amplify one another as part of a deck's plan. It should be explained in human deck-building terms, such as enablers, payoffs, engines, packages, and support pieces. The MVP should not require any specific technical mechanism for detecting synergy.

For the MVP, the agent should detect and explain combos when they appear in a Deck Opportunity or Deck Candidate, but it should not optimise for deterministic or game-ending combo wins unless the user asks for that play experience or power level.

If a Collection strongly supports both a combo version and a value-oriented version of the same commander or theme, the agent should choose according to the Deck Building Brief. For a fun casual brief, it should usually prefer the value-oriented version and mention the combo package as optional.

## Deck Candidate Quality Bar

A Deck Candidate should be built like an expert deck builder would build it, not as a pile of individually strong or popular cards.

Each Deck Candidate should have:

- A clear game plan.
- Enough enablers for that plan.
- Enough payoffs for that plan.
- Interaction and removal.
- Mana support appropriate to the format and plan.
- Card advantage.
- Protection or resilience where appropriate.
- A sensible curve.
- Explicit Available Card, Committed Card, and Missing Card status.
- Explanations for important inclusions and exclusions.

The agent should avoid recommendations that resemble disconnected staple lists. If a deck has many payoffs but too few enablers, the agent should strengthen the enabling structure before adding more payoffs.

## Deck Candidate Output

A completed Deck Candidate should include both a decklist and an explanation of why the deck is coherent.

The standard output should include:

- Game Plan: how the deck tries to win or create advantage.
- Power And Experience: the target power level and play-experience expectation. For Commander/EDH, this should include Commander Bracket.
- Decklist: grouped by useful deck-building categories, not only card type.
- Collection Status: Available Cards, Committed Cards, and Missing Cards.
- Key Synergies: important enabler/payoff relationships and engines.
- Interaction And Protection: how the deck answers threats and survives disruption.
- Mana And Curve: whether the deck can cast its spells reliably.
- Optional Upgrades: useful Missing Cards or potential improvements.
- Cuts And Exclusions: notable cards that were deliberately cut or excluded, when that decision was actually made.
- Assumptions And Caveats: uncertainty, rules-sensitive lines, price approximation, or data gaps.

For Commander/EDH Deck Candidates, the Power And Experience section should include the target Commander Bracket, rationale, cards or patterns that may push the deck toward a higher bracket, deliberate omissions made to stay within the target bracket, and any uncertainty that should be checked against current Commander Bracket guidance.

For Commander/EDH Deck Candidates, the agent should default to producing Commander-legal decks. It should be able to assess Commander legality and explain any failures, including deck size, commander validity, colour identity, singleton violations, banned cards, or other format-specific construction issues.

The agent may create a Deck Candidate that breaks Commander legality if the user's Deck Building Brief explicitly calls for a rule-zero, casual, experimental, or otherwise non-legal deck. In that case, the legality exceptions should be deliberate and clearly labelled rather than accidental.

If a Deck Candidate is assessed and does not pass legality, the result should include the reasons why instead of presenting the deck as legal.

Every Commander/EDH Deck Candidate should include a Legality Assessment. If the deck is legal, the assessment should be concise, such as `Status: Commander-legal`. If the deck is not legal, the assessment should list the specific failures.

The explanatory parts of the output should be structured. The MVP may present this structure as agent-readable Markdown, but headings, sections, and repeated fields should be stable rather than improvised for each response.

The Deck Candidate decklist itself should be strict and formal. It should adhere to popular decklist conventions so it can be copied into common MTG deck tools with minimal cleanup. Deck Opportunity shortlists may remain Markdown templates optimised for human readability and do not need to be parsed as strictly.

## Decklist Export Format

The MVP should default to a quantity-first plain text decklist format because it is widely accepted by MTG deck tools and easy for both humans and software to handle.

A Deck Candidate should include two separate deck assembly outputs:

- Portable Decklist: a clean importable decklist that ignores exact printings by default.
- Collection Pull List: an assembly-focused list that identifies which owned card copies to use and where they are located.

This split keeps the importable decklist broadly compatible while still helping the user physically assemble the deck from their Collection.

For Commander/EDH Deck Candidates, the strict decklist block should use separate `Commander` and `Deck` sections:

```txt
Commander
1 Lathril, Blade of the Elves

Deck
1 Sol Ring
1 Llanowar Elves
1 Elvish Mystic
```

Requirements:

- Each card line should use quantity first, followed by the exact card name.
- The importable decklist block should not include commentary, prices, availability notes, category labels, or explanations.
- Explanations, Collection Status, prices, caveats, and grouped deck-building analysis should appear outside the strict decklist block.
- Exact printing information should appear in the Collection Pull List when known, not in the Portable Decklist by default.
- The MVP Portable Decklist should contain only the final Deck Candidate. Sideboards, maybeboards, considering boards, optional upgrades, and budget alternatives should not appear inside the importable block.

Optional Upgrades should remain part of the Deck Candidate explanation. They should be human-readable recommendations, not a formal maybeboard or importable decklist section in the MVP. Each Optional Upgrade should explain why the card is useful, whether it is owned or missing, rough cost impact when relevant, and what it might replace.

Cuts And Exclusions should be included only when the agent actually made a meaningful cut or exclusion decision. The agent should not invent cuts for a brand-new Deck Candidate where no source deck or notable candidate card was considered and rejected. When included, this section should explain why a card was excluded, such as being off-plan, too weak for the target Commander Bracket, redundant, unavailable under the Collection Access Policy, or intentionally omitted to preserve the requested play experience.

The Collection Pull List should expose useful owned-copy details where known:

- Availability status.
- Binder, box, or Existing Deck location.
- Set code or set name.
- Collector number.
- Finish.
- Condition.
- Language.

When the user owns multiple copies of a card, the agent should list the relevant copies and their metadata rather than selecting a preferred physical copy by default. The user owns collection management decisions, including which copy to move, sleeve, trade, or leave in place.

Missing Cards should be listed separately from owned cards so the user can distinguish physical assembly from acquisition decisions.

If the user moves cards between binders or Existing Decks, that change should be reflected by updating the source collection data and reimporting or resyncing it into the agent. The MVP should not try to become the user's collection management system.

The MVP should be read-only with respect to Collection state. It should not mutate the Collection, mark cards as moved, create Existing Deck records, or update binder locations.

The MVP should support ManaBox collection CSV exports only.

The MVP should use a simple whole-Collection import model. Each import should treat the provided collection export as the current snapshot of the user's Collection.

Collection import should be strict and fail fast. If required data is missing, malformed, or ambiguous, the import should fail with a clear explanation rather than allowing the agent to continue with uncertain Collection state. Incomplete collection data should be treated as either a source data issue or an import logic issue.

ManaBox Lists should be skipped during import because they may contain cards the user does not own. Skipping Lists should not fail the import. The MVP should import owned cards from ManaBox Binders and registered deck locations only.

The import summary should report skipped ManaBox Lists by name and row or card count. Skipped Lists are not errors, but they should be visible so the user understands which source data was intentionally ignored.

Every Collection import should produce an Import Summary. The summary should include import status, import timestamp, source format, imported owned card rows, total owned card quantity, imported binder count, inferred Existing Deck count, skipped ManaBox Lists with row or card counts, validation errors if the import failed, and any non-failing warnings.

Import Summary wording should be direct and actionable. A failed import should state that import failed, that the previous successful Collection remains current, the exact blocking issue, and what the user can change in the source export. A successful import with warnings should state that import succeeded, what was imported, what was skipped or ignored, and whether skipped or ignored data affects deck-building. Warnings should not sound like failures, and failures should not be hidden as warnings.

`CollectionImport` writes should be non-destructive. A failed import should not replace the previous successful Collection, should not change the latest successful Collection import timestamp, and should not make saved Deck Opportunities or Deck Candidates stale. The Import Summary should clearly state that the previous successful Collection remains current.

Import warnings should be limited to data the MVP intentionally ignores or can safely preserve without using. Examples include skipped ManaBox Lists, missing optional metadata such as purchase price, unsupported metadata that is ignored, or source columns that are preserved but not used in MVP deck-building.

Import issues that affect card identity, quantity, ownership, required headers, or usable location should fail the import rather than become warnings. The agent should not continue with uncertain Collection state.

Existing Decks should be inferred from Collection metadata where possible, rather than requiring separate deck imports.

The MVP import requirements should be based on ManaBox's collection CSV documentation. ManaBox documents card identity as requiring card name plus set code or set name, with Scryfall ID usable as a replacement identity. ManaBox also exports card properties and binder/list name, which the MVP should use for Collection Pull Lists and Availability analysis.

ManaBox references:

- [Import and export the collection](https://manabox.app/guides/collection/import-export/)
- [Getting started with the collection](https://manabox.app/guides/collection/getting-started/)
- [Decks in the collection](https://manabox.app/guides/decks/collection-decks/)

References:

- [ManaBox deck import/export guide](https://manabox.app/guides/decks/import-export/) describes quantity-first text import as the most standard format and shows optional set/collector metadata.
- [Decklist.gg deck import guide](https://decklist.gg/docs/deck-import) accepts `quantity cardname`, documents `Commander` and `Deck` section headers, and includes a Commander-format example.

## MVP Capabilities

The MVP should define capabilities, not implementation choices.

The agent needs enough support to:

- Parse the user's collection export and preserve useful collection metadata.
- Understand card identity, rules text, colour identity, legality, types, and basic deck-building role.
- Analyse Availability under the confirmed Deck Building Brief.
- Assess format legality and return clear reasons for any failures.
- Reason about Synergy, including enablers, payoffs, engines, packages, and combos.
- Construct Deck Candidates with appropriate game plan, curve, mana, card advantage, interaction, and resilience.
- Explain Deck Opportunities, card inclusions, card exclusions, missing cards, and trade-offs.
- Export a Deck Candidate in a usable text format.

## Price Awareness

The MVP should include price awareness for missing-card budgeting, but not price tracking or MTG finance.

The agent should be able to estimate the current cost of Missing Cards well enough to respect a budget, identify expensive recommendations, and suggest cheaper alternatives when appropriate. Prices should be treated as approximate and time-sensitive.

Purchase price from the ManaBox export should be preserved as Collection metadata, but it should not drive MVP deck-building optimisation. Purchase price is distinct from current price awareness for Missing Cards. The agent should not avoid or prefer owned cards based on purchase price unless the user explicitly makes that part of the Deck Building Preferences.

## Rules Awareness

The MVP should include rules awareness, but not full rules judging.

The agent should understand enough card text, legality, colour identity, and common interaction logic to avoid invalid deck-building recommendations. If a combo, synergy, or recommendation depends on a complex timing, replacement, copy, or rules interaction, the agent should flag it as rules-sensitive rather than presenting it with unsupported certainty.

## Source Expectations

The agent should cite or reference authoritative and current sources for volatile or rules-sensitive claims when relevant, including legality, banned cards, Commander Brackets, official rules-sensitive claims, and current prices.

The agent does not need citations for ordinary deck-building judgement, such as identifying ramp, payoffs, enablers, interaction needs, curve concerns, or synergy fit.

When the agent is unsure, it should flag uncertainty rather than inventing precision. Prices should be treated as approximate and time-sensitive. Commander Bracket guidance should be checked against current external guidance because the bracket system may evolve.

## Meta Knowledge

Competitive meta analysis is not core MVP scope. For Commander/EDH, the agent may still use broad community knowledge of staples, common archetypes, and power expectations to calibrate recommendations.
