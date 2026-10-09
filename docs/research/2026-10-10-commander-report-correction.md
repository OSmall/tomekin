### Source Access and Evidence Statement

**Accessed Content:**

* **V1 (OSNV6224cHg - Template New Era):** Auto-generated transcript and metadata.
* **V2 (PUrQpnQ7bi8 - Problem with Templates):** Auto-generated transcript and metadata.
* **V3 (xZvaBPrF56E - Fixing Shape):** Auto-generated transcript and metadata.
* **V4 (K5UGydfRKBw - Deckbuilding Traps):** Auto-generated transcript and metadata.

**Limitations:** I do not have visual access to any of the videos. I cannot see on-screen graphics, card images,
mathematical overlays, or gameplay demonstrations. Any exact numerical equations (like Frank Karsten's land formula
referenced in V1) or visual-only charts are inaccessible. My analysis relies entirely on the spoken audio as
transcribed.

---

### Correction and Evidence Table

| Original Claim / Topic                                                                 | Source & Section                                   | Source Advice / Context                                                                                                                                                                                                                                   | Status            | Corrected Handling in Report                                                                                                                                                           |
|:---------------------------------------------------------------------------------------|:---------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Numeric Template Defaults** (38 Lands, 12 CA, 10 Ramp, 12 Targeted, 6 Mass, 30 Plan) | V1 (~0:09:55 & sections throughout)                | V1 establishes these specific numbers as the "starting point" for an average casual deck. MDFCs and 1-mana landcyclers count toward lands. Rituals (Dark Ritual) and cantrips (Ponder) are explicitly excluded from Ramp and Card Advantage respectively. | Supported         | Accurately attributed to V1 as a baseline. Added V1's explicit counting conventions for MDFCs, rituals, and cantrips.                                                                  |
| **Exceptions for Mass Disruption**                                                     | V2 (~1:05:17)                                      | Previously omitted. V2 explicitly covers reasons to run less (hyper-aggressive, bad colors like Green) or more (spells decks, board-light decks, knowing you'll be Public Enemy #1, heavy protection suites).                                             | Supported (Added) | Added the complete V2 exception guidelines for Mass Disruption to the template rules.                                                                                                  |
| **Sidisi Probability Math**                                                            | V2 (~1:26:00)                                      | The speaker uses a third-party hypergeometric calculator ("Salubrious Snail") to find the odds of drawing exactly 3 lands AND 1 two-mana ramp spell by turn 2/mulligans. The numbers (53%, 68%) are external calculations, not rules of thumb.            | Corrected         | Clarified that these are externally generated probabilities. Removed any implication that the downstream agent should or could dynamically simulate these odds itself.                 |
| **Game-Plan Structure (1-2 steps)**                                                    | V4 (~13:00 "Game plan too complex")                | A reliable plan takes 1-2 steps (e.g., Step 1: Evasive creatures, Step 2: Ninjutsu). 3+ steps requiring sequential setups without disruption is "Magical Christmas Land".                                                                                 | Supported         | Codified the 1-2 step rule into the plan construction workflow. Explicitly defined "Magical Christmas Land" as a trap.                                                                 |
| **"Trying to do too much" (Splashing Plans)**                                          | V4 (~17:00 "Trying to do too much")                | Attempting to split a deck between 3-4 different thematic payoffs (e.g., Sagars, +1/+1 counters, and Poison for Atraxa) mathematically weakens all of them.                                                                                               | Supported         | Added to workflow: The deck must commit to a singular direction/engine to avoid diluting equity.                                                                                       |
| **Never cut support / Always swap exact category**                                     | V4 (~40:00 "Editing one card at a time")           | This is a human heuristic suggested by Josh to prevent the slow degradation of "vegetables" over time. It is not an absolute mechanical rule, but a discipline trick.                                                                                     | Overstated        | Rephrased as a heuristic/guardrail for human tuning rather than a hard architectural limit. The agent should evaluate whole-deck deficits.                                             |
| **Generic vs. Synergistic Support**                                                    | V3 (~0:23:54) vs. V4 (~27:15 "Hyper-focused plan") | V3 pushes highly synergistic support (e.g., token generation as mana). V4 explicitly warns against making *all* support synergistic (e.g., all removal tied to ETB creatures) because a single "silver bullet" (Torpor Orb) shuts down the entire deck.   | Corrected         | Removed the implied conflict. Replaced with the synthesis: Synergy raises the ceiling, but generic, efficient interaction is required as a fallback to prevent catastrophic fragility. |
| **Role Overlap / Modal Cards**                                                         | V1 (~1:05:54)                                      | Modal cards (like *Sink into Stupor*) overlap categories, allowing 108 slots to fit into 100. However, modal cards force a choice during gameplay; they do not provide *both* functions simultaneously.                                                   | Corrected         | Added explicit guidance: Assigning two roles to a card increases flexibility, but does not equal two simultaneous functional contributions during a game.                              |
| **Uncertain Card Names**                                                               | V3 Transcript                                      | The auto-captions produced "Thunderfoot Bayoth", "endraerunners", "biotech specialist", "quinoa Q gourmet", "Hydro assault robot", and "Dolegate".                                                                                                        | Unverified        | Maintained uncertainty. Replaced with descriptive intent (e.g., "an artifact-sacrifice pinger") and flagged unverified names.                                                          |

---

# Commander Deck-Building Source Report

## Source Access and Evidence

| Video Title                                                                 | Channel             | Publication Date | URL                                                        | Accessed Content     |
|:----------------------------------------------------------------------------|:--------------------|:-----------------|:-----------------------------------------------------------|:---------------------|
| Commander Deckbuilding Template for the New Era \| The Command Zone 658     | The Command Zone    | 2025-02-18       | [OSNV6224cHg](https://www.youtube.com/watch?v=OSNV6224cHg) | Transcript, Metadata |
| The Problem with Deckbuilding Templates \| The Command Zone 659             | The Command Zone    | 2025-02-26       | [PUrQpnQ7bi8](https://www.youtube.com/watch?v=PUrQpnQ7bi8) | Transcript, Metadata |
| Make Any Deck Busted (by fixing its shape)                                  | Commander Challenge | 2026-09-18       | [xZvaBPrF56E](https://www.youtube.com/watch?v=xZvaBPrF56E) | Transcript, Metadata |
| Stop Falling for these Commander Deckbuilding Traps \| The Command Zone 767 | The Command Zone    | 2026-10-08       | [K5UGydfRKBw](https://www.youtube.com/watch?v=K5UGydfRKBw) | Transcript, Metadata |

**Uncertainty & Gaps:**

* Visual content, on-screen mathematical overlays, and gameplay demonstrations were inaccessible; only automated
  transcripts and metadata were utilized.
* **V3 Transcript Errors:** Several cards mentioned in V3 are heavily garbled by auto-captions (e.g., "quinoa Q
  gourmet", "Hydro assault robot", "biotech specialist"). These specific card identities are unverified. Where they
  appear, the report relies on the mechanical intent described by the speaker (e.g., "token generation", "artifact
  sacrifice pinging").

---

## 1. Source Map and Glossary

*Source guidance* introduces terminology to categorize how cards function. Below is a mapping of source terms to
downstream agent concepts.

**The Command Zone (Sources 1, 2, & 4) Terminology:**

* **Vegetables:** Foundational support cards required for a deck to function (Lands, Ramp, Card Advantage, Disruption).
  Maps to **Deck Roles** (Mana, Draw, Interaction).
* **Plan / Meat:** Cards representing the deck's primary strategy. Maps to **Deck Packages**.
* **Enablers:** Cards that perform the foundational actions needed to make the plan work (e.g., token generators). Maps
  to **Generators/Enablers**.
* **Enhancers:** Force multipliers (like doubling seasons) that drastically improve the plan but do nothing
  independently. Maps to **Amplifiers**.
* **Payoffs:** Cards that reward the execution of the plan or win the game outright. Maps to **Payoffs**.
* **Magical Christmas Land (V4):** A derogatory term for a game-plan that requires 3+ perfect sequential steps and zero
  opponent interaction to succeed.

**Commander Challenge (Source 3) Terminology:**

* **Keystone Objective:** The deck's core focus, comprising three parts: the primary action, the capitalization on that
  action, and the definitive win condition. Maps to **Deck Plan**.
* **Advantage Gainers:** The supporting pillars of Card Advantage, Mana Advantage, and Board State Advantage
  (Suppression/Protection).

---

## 2. Faithful Inventory of Substantive Lessons

### The "Vegetables" (Core Support Pillars)

**[Source Guidance: V1, V2]** V1 establishes a strict numerical baseline for a modern 100-card deck. The most common
pitfall is cutting these for fun synergistic cards, causing the deck to stall.

* **Lands (38 Baseline):** Missing land drops is the most catastrophic failure mode in Commander.
    * *Counting Conventions:* Modal Double-Faced Cards (MDFCs) and 1-mana land-cyclers count toward this total.
    * *Exceptions (V2):* Can be lowered (e.g., to 36) *only* if the average curve is exceptionally low (~2.15) and runs
      heavy cheap card selection. High-curve or Landfall decks demand more (40-45). Frequent mana-flooding is solved by
      adding looting/selection, *not* by cutting lands.
* **Card Advantage (12 Baseline):**
    * *Counting Conventions:* Spells must *net* cards. Cantrips (e.g., *Ponder*) are card selection, not advantage.
      Impulse draw counts if cheap enough to cast reliably. Self-mill and looters only count if the deck actively
      utilizes the graveyard as a second hand.
    * *Exceptions (V2):* Decrease if the Commander guarantees card draw. Increase if the deck relies on multi-step
      plans, is built on low individual card quality, or ramps heavily.
* **Ramp (10 Baseline):**
    * *Counting Conventions:* Rituals (*Dark Ritual*) are temporary bursts, not ramp.
    * *Exceptions (V2, V4):* The cost of ramp must explicitly match the curve of the Commander. (e.g., A 4-mana
      Commander requires 2-mana ramp. A 3-mana *Cultivate* wastes the ramp tempo). Increase to 14-15 (per V2's external
      hypergeometric math calculations) if the user demands a guaranteed Turn-3 Commander deployment.
* **Targeted Disruption (12 Baseline):**
    * *Counting Conventions:* 1-for-1 answers (destroy, exile, phase, bounce, counterspells, grave-hate). Protection
      spells (e.g., *Snakeskin Veil*) protect your own board and do *not* count as disruption.
    * *Exceptions (V2):* Decrease if playing an hyper-aggressive strategy or if your colors fundamentally lack it (e.g.,
      Mono-Green). Increase if playing a draw-heavy/hold-up-mana strategy.
* **Mass Disruption (6 Baseline):** Multi-target disruption that breaks parity (e.g., board wipes, *Teferi's
  Protection*, *Disrupt Decorum*, *Grasp of Fate*).
    * *Exceptions (V2 - 1:05:17):* Decrease if aggressive or if constrained by colors (Green/Red). Increase if playing a
      Spellslinger deck, running heavy board-protection suites, or actively establishing oneself as "Public Enemy Number
      One."

### Establishing and Managing the Game Plan

**[Source Guidance: V3, V4]** A game plan is a causal chain. Building a functional plan requires absolute focus.

* **1-2 Step Plans (V4):** A reliable plan is direct. (Step 1: Evasive creatures. Step 2: Ninjutsu). 3+ steps (Make a
  wide board -> turn them into copies of the Commander -> cast a specific spell to trigger a loop) is "Magical Christmas
  Land" and will fail.
* **Avoid Splashing (V4):** Attempting to support 3 or 4 different sub-themes weakens all of them. The deck must commit
  to one cohesive route (e.g., If making Clues, decide strictly between hoarding them for affinity OR sacrificing them
  for drain. Doing both causes internal conflict).
* **Enablers over Enhancers (V4):** The most common deckbuilding flaw is over-indexing on Payoffs/Enhancers while
  cutting Enablers. If you have cards that multiply tokens but no cards that generate them, the deck does nothing.
* **Redundancy Thresholds (V4):** For effects that do *not* stack (e.g., giving a Commander unblockable, *Crucible of
  Worlds*, or a Fog), running more than 5-7 copies creates dead hands. To increase consistency without risking dead
  draws, add generic Card Advantage instead.

---

## 3. Synthesized Construction Workflow

**[Synthesis for Downstream Agent]**
This workflow structures the sources' disparate advice into a sequence suitable for an AI assistant, separating user
inputs from mechanical execution.

* **Step 1: Establish the Deck Building Brief**
    * *Inputs Required:* Budget, missing-card tolerance, collection access, and desired power level.
* **Step 2: Choose Commander & Articulate Keystone Objective (V3, V4)**
    * *Action:* Define the 1-2 step Game Plan. Identify the primary Enabler action and the ultimate Payoff.
    * *Decision:* Explicitly reject conflicting secondary themes.
* **Step 3: Analyze Commander Compensation (V2, V3)**
    * *Action:* Categorize the Commander as an Enabler, Enhancer, Payoff, or Advantage Gainer.
    * *Output:* Reduce the corresponding category in the 99. (e.g., If the Commander is an Enhancer, drastically cut
      Enhancers in the 99 and overload on Enablers).
* **Step 4: Draft the Support Pillars (V1, V3)**
    * *Action:* Retrieve cards for the 5 "Vegetable" categories using the baseline targets.
    * *Decision (Synergy vs. Generic):* Prioritize "High Synergy Advantage" (V3)—e.g., using tokens for mana—but retain
      enough efficient, generic interaction to avoid the "Hyper-Focused Fragility" trap (V4), where a single silver
      bullet (*Torpor Orb*) disables the entire deck.
* **Step 5: Card Selection & Role Mapping (V1)**
    * *Action:* Identify modal cards (e.g., MDFCs) to overlap categories, compressing the 108 numerical targets into 100
      slots.
    * *Caveat:* Assigning two roles to a single modal card provides flexibility, but does *not* provide two simultaneous
      functional contributions in gameplay.
* **Step 6: Static Review (V1, V4)**
    * *Action:* Verify the curve clusters around 1-3 mana and drops drastically at 5+. (V1 explicitly rejects almost all
      6-mana targeted interaction). Verify Enablers drastically outnumber Enhancers.

---

## 4. Collection-Aware Retrieval and Evaluation

**[Synthesis for Downstream Agent]**
When the agent evaluates a user's collection, it must differentiate between generic statistical popularity and
contextual functional coverage.

* **The EDHREC Trap (V4):** Using aggregate data for versatile Commanders pulls in cards from conflicting themes. The
  agent must evaluate cards strictly against the defined *Keystone Objective*, ignoring statistically popular cards that
  belong to alternate strategies.
* **Role Coverage vs. Tag Identity:** A card's tag is not automatically a functional role. A 6-mana creature that
  destroys an artifact technically possesses a "Removal" tag, but it fails the mechanical requirement for early,
  efficient Disruption.
* **Collection Verification:** If an optimal synergistic piece is retrieved, the agent must verify it meets the user's
  Brief restrictions before finalizing it as a Deck Plan component.

---

## 5. Worked Examples

**Example 1: Curve Alignment and Mathematical Consistency (Sidisi, Brood Tyrant)**

* *Source:* [V2, ~1:26:00]
* *Objective:* Ensure a 4-mana Commander hits the field consistently on Turn 3.
* *Adjustment:* The baseline 10 ramp spells proved insufficient. Using a third-party hypergeometric calculator, the
  creator increased lands to 40 and 2-mana ramp to 15. This raised the mathematical probability of seeing three lands
  and one 2-mana ramp piece by the first mulligan from 53% to over 60%. *(Note: This reflects external human-driven
  calculation, not an innate simulation capability).*

**Example 2: Commander Compensation (Wilson, Refined Grizzly + Guild Artisan)**

* *Source:* [V3, ~0:18:09]
* *Objective:* Generate treasure tokens by attacking, cast massive board-flip spells, and trigger ETB damage payoffs.
* *Adjustment:* Because the Commander pairing is a hyper-reliable *Enabler* (creating tokens on attack), the builder
  explicitly cut generic expensive generators (e.g., *Bootleggers' Stash*) from the 99. Slots were reallocated to
  Synergistic Card Advantage (e.g., *Sarinth Steelseeker*), leveraging the guaranteed treasure tokens.

**Example 3: Fixing a Split Game Plan (Eloise, Nephalia Sleuth)**

* *Source:* [V4, ~0:19:50]
* *Trap Encountered:* "Trying to do too much." The deck included cards that rewarded *hoarding* Clue tokens alongside
  cards that rewarded *sacrificing* them.
* *Tuning Solution:* The plan was simplified. The builder removed the hoard payoffs entirely, dedicating the deck purely
  to Aristocrats/Sacrifice, ensuring all drawn cards pushed in the same direction.

---

## 6. Tuning and Static Review

**The "Editing One Card at a Time" Heuristic (V4):**
When users update decks over time, they frequently swap a "boring" support card (a land or removal spell) for a new,
exciting Payoff. Repeatedly doing this destroys the deck's structural math. *Agent Directive [Synthesis]:* Tuning must
be evaluated holistically. If a user wishes to add a new Payoff, the agent should recommend swapping it for a competing
Payoff or Enhancer—not a foundational support "vegetable," unless the underlying math justifies the deficit.

**Goldfishing vs. Static Review:**

* *Human Advice (V2, V4):* The sources mandate that human players "goldfish" (solo playtest) their decks 50-100 times to
  verify if they hit land drops and curve out appropriately.
* *Agent Limitation [Synthesis]:* The downstream agent cannot dynamically simulate games, hands, or play sequencing.
  Instead, it must rely on Static Review (checking curves, checking Enabler-to-Payoff ratios, confirming overlap math)
  and prompt the user to report back on their lived goldfishing results (e.g., "Are you missing your 4th land drop in
  testing?").

---

## 7. Information Requirements for a Saved Deck Plan

**[Synthesis for Downstream Agent]**
To preserve a revisable "Deck Plan" state across sessions, the agent must store strategic context, not just a list of
100 cards.

1. **The Keystone Objective:** The 1-2 step logic chain. If lost, future tuning will devolve into "goodstuff"
   recommendations or introduce conflicting themes.
2. **Pillar/Role Intentions:** Every card must map to its intended functional pillar (Mana, Draw, Disruption, Enabler,
   Payoff). If a modal card is swapped out, the agent must recognize that *two* distinct functional counts may have
   degraded.
3. **Template Deviations & Rationale:** Explicit records of *why* a numerical target was abandoned (e.g., "Targeted
   Disruption lowered to 8 due to heavy graveyard spell recursion"). Without this, future audits will erroneously flag
   intentional choices as deficits.
4. **Unresolved Assumptions:** Flags for theoretical synergies that require human validation through table play.

---

## 8. Limitations and Open Decisions

* **Fractional Counting Subjectivity:** V2 acknowledges that no supercomputer can perfectly calculate the functional
  value of self-mill or looting. Evaluating how many "looters" equal a strict "Card Advantage" slot requires "art over
  science" and lived play experience. The agent must acknowledge this subjectivity rather than presenting arbitrary math
  as absolute.
* **Time-Sensitivity of Curves:** The recommendations are calibrated to a specific era of Commander where average games
  last 7-8 turns and curves are highly concentrated at 1 and 2 mana. If format speeds shift, the rejection of 5- and
  6-mana interaction will lose validity.
* **V3 Card Name Anomalies:** Several payoff examples supplied in V3 (captioned as "quinoa Q gourmet," "Hydro assault
  robot", "biotech specialist") remain unverified due to severe audio/caption garbling. They serve conceptually to
  illustrate "token-ETB triggers" and "artifact-sacrifice pingers," but cannot be directly retrieved as literal MTG
  cards.

---

## 9. Agent Checklist and Coverage Matrix

### Compact Agent Checklist

- [ ] **Brief Capture:** Are budget, power, and collection restrictions recorded?
- [ ] **Keystone Established:** Is the plan restricted to 1-2 focused steps? Is Step 1 inherently useful?
- [ ] **Commander Role Assessed:** Have the ratios of the 99 been adjusted to compensate for what the Commander
  provides?
- [ ] **Template Baseline Met:**
    - 38 Lands (MDFCs count).
    - 12 Card Advantage (Net positive draw).
    - 10 Ramp (Curve-matched to the Commander).
    - 12 Targeted Disruption.
    - 6 Mass Disruption.
- [ ] **Synergy vs. Generic:** Are synergistic pillars prioritized without creating hyper-focused fragility (e.g.,
  losing to a single *Torpor Orb*)?
- [ ] **Curve Verified:** Is the curve clustered around 1-3 mana, dropping sharply at 5+?
- [ ] **Redundancy Check:** Are there no more than 5-7 copies of unique, non-stacking effects?
- [ ] **Holistic Tuning:** Are proposed card swaps being evaluated against the whole-deck functional math?

### Source-Coverage Matrix

| Report Section           | V1: CZ 658     | V2: CZ 659       | V3: CC Challenge | V4: CZ 767        | Agent Audit / Notes                                                        |
|:-------------------------|:---------------|:-----------------|:-----------------|:------------------|:---------------------------------------------------------------------------|
| 1. Glossary              | Yes            | Yes              | Yes              | Yes               | Synthesized source terms; defined "Magical Christmas Land".                |
| 2. Faithful Inventory    | Yes (Baseline) | Yes (Exceptions) | Yes (Objective)  | Yes (Traps)       | Details caps, curve math, and structural pitfalls.                         |
| 3. Workflow              | Implied        | Implied          | Partial          | Implied           | Explicit methodology steps synthesized by Analyst.                         |
| 4. Collection Retrieval  | No             | No               | No               | Yes (EDHREC)      | Warns against generic aggregate data copying.                              |
| 5. Worked Examples       | No             | Yes (Sidisi)     | Yes (Wilson)     | Yes (Eloise)      | Addresses exact math, commander compensation, and theme splits.            |
| 6. Tuning/Review         | Yes            | Yes              | Partial          | Yes (1-by-1 Edit) | Details Goldfishing and the danger of isolating edits.                     |
| 7. Info Req (Saved Plan) | No             | No               | No               | No                | Pure Synthesis for agent architectural memory constraints.                 |
| 8. Limitations/Conflicts | Yes            | Yes              | Yes              | Yes               | Acknowledges subjectivity in fractional advantage and unverified captions. |