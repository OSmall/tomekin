# Commander Deck-Building Source Report

## Source Access and Evidence

| Video Title                                              | Channel             | Date       | URL                                                        | Accessed Content     |
|:---------------------------------------------------------|:--------------------|:-----------|:-----------------------------------------------------------|:---------------------|
| Commander Deckbuilding Template for the New Era (V1)     | The Command Zone    | 2025-02-18 | [OSNV6224cHg](https://www.youtube.com/watch?v=OSNV6224cHg) | Transcript, Metadata |
| The Problem with Deckbuilding Templates (V2)             | The Command Zone    | 2025-02-26 | [PUrQpnQ7bi8](https://www.youtube.com/watch?v=PUrQpnQ7bi8) | Transcript, Metadata |
| Make Any Deck Busted (by fixing its shape) (V3)          | Commander Challenge | 2026-09-18 | [xZvaBPrF56E](https://www.youtube.com/watch?v=xZvaBPrF56E) | Transcript, Metadata |
| Stop Falling for these Commander Deckbuilding Traps (V4) | The Command Zone    | 2026-10-08 | [K5UGydfRKBw](https://www.youtube.com/watch?v=K5UGydfRKBw) | Transcript, Metadata |

**Uncertainty & Limitations:**

* Visual content was inaccessible; only automated transcripts and metadata were utilized.
* Exact timestamps for V4 are unavailable in this processing pass; section identifiers are used to map citations without
  inventing precision.
* The V3 transcript contained multiple unrecognizable auto-captioned card names during the *Wilson* build. These
  specific payoff cards remain unverified, meaning some of V3's practical examples lack Oracle-text validation.

---

## 1. Source Map and Glossary

**[Source Guidance]** The sources introduce specific terminologies to categorize card functions.

**The Command Zone (V1, V2, V4):**

* **Vegetables:** The foundational support cards required for a deck to function (Lands, Ramp, Card Advantage,
  Disruption). Maps to **Deck Roles**.
* **Meat / Plan:** Cards representing the deck's primary strategy. Maps to **Deck Packages**.
* **Enablers:** Cards that perform the foundational actions needed to make the plan work. Maps to **Generators**.
* **Enhancers:** Force multipliers that improve the plan but do nothing on their own. Maps to **Amplifiers**.
* **Payoffs:** Cards that reward the execution of the plan or win the game.
* **Magical Christmas Land (V4):** A derogatory term for a game plan that requires too many perfect, sequential steps
  and zero opponent interaction to succeed.
* **The Danger of Cool Things (V4):** The trap of cutting mandatory support "vegetables" to make room for synergistic
  but expensive "meat" cards.

**Commander Challenge (V3):**

* **Keystone Objective:** The primary action, how the deck capitalizes on it, and the definitive win condition. Maps to
  **Deck Plan**.
* **Generators, Amplifiers, Payoffs:** Functionally identical to the CZ Enabler/Enhancer/Payoff structure.
* **Advantage Gainers:** The supporting pillars of Card Advantage, Mana Advantage, and Board State Advantage
  (Suppression/Protection).

---

## 2. Faithful Inventory of Substantive Lessons

### Support Pillars & The "Vegetables" (V1, V2, V4)

* **The Land Count is Non-Negotiable:** Missing land drops is the most catastrophic failure mode in Commander. V1
  explicitly sets the baseline at 38 lands `[V1, ~00:11:30]`.
* **Ramp Must Match the Commander (V2):** The curve of your ramp must logically precede the cost of your Commander.
  Casting a 3-mana ramp spell when you have a 4-mana Commander is a tempo trap `[V2, ~00:15:42]`.
* **The Danger of Cool Things (V4):** V4 explicitly warns against the "EDHREC trap"
  `[V4, "Danger of Cool Things" section]`. Builders often see highly synergistic cards on aggregate sites and cut their
  removal or lands to fit them in. This destroys the deck's structural math.

### Structural Dependency and Ratios (V3)

* **The Ratio of Generators to Amplifiers:** V3 argues that deck power comes from internal structure, not card price
  `[V3, ~00:00:46]`. You must have significantly more Generators than Amplifiers. If a deck draws an Amplifier (e.g., a
  token doubler) without a Generator, it is a dead card.
* **Commander Compensation:** If the Commander itself is a reliable Generator, the builder must drastically reduce the
  number of Generators in the 99 and increase the Amplifiers. If the Commander is an Amplifier, the 99 must be almost
  entirely Generators `[V3, ~00:10:01]`.

### Formulating a Resilient Plan (V4)

* **Compact Plans:** A functional plan has 1-2 steps `[V4, "Compact Plans" section]`.
* **Inherent Value:** The first step of a plan must generate value independently. E.g., Generating tokens is good for
  blocking even if the payoff is never drawn.
* **Singular Direction:** Splashing secondary themes natively supported by the Commander (e.g., trying to do +1/+1
  counters *and* poison counters) dilutes the primary plan and causes the deck to fail
  `[V4, "Singular Direction" section]`.

---

## 3. Synthesized Construction Workflow

**[Synthesis]** The following workflow translates the sources' advice into a logical, sequential prompt chain for a
downstream AI agent, separating user decisions from agent retrieval tasks.

1. **Establish the Deck Building Brief:** Record user constraints (budget, missing-card tolerance, desired power level).
2. **Define the Keystone Objective [Inspired by V3]:** Identify the primary action and the ultimate Payoff. The agent
   must verify the plan is a compact 1-2 steps and not pulling in contradictory directions.
3. **Analyze the Commander's Role [Inspired by V2, V3]:** Categorize the Commander as an Enabler, Enhancer, Payoff, or
   Advantage Gainer. Record the required compensation in the 99.
4. **Draft the Support Pillars [Inspired by V1, V3]:** Retrieve cards supplying Lands, Draw, Ramp, and Disruption. (See
   Section 10 for conflict resolution on generic vs. synergistic support).
5. **Select Cards and Map Overlaps [Inspired by V1]:** Assign single cards to multiple roles to satisfy numerical
   targets within a 100-card limit.
6. **Review Dependencies and Curve [Inspired by V2, V4]:** Verify the curve is clustered at 1-3 mana. Ensure there are
   drastically more Enablers than Enhancers/Payoffs to prevent dead board states.

---

## 4. Numeric Template and Adaptation Rules

**[Source Guidance: V1, V2]** The baseline numerical targets for a modern Commander deck.

| Role                    | Baseline Target | Scope & Counting Conventions                                                                      | Justified Exceptions (When to Depart)                                                                                                                      |
|:------------------------|:----------------|:--------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Lands**               | 38              | Includes MDFCs and 1-mana land-cyclers.                                                           | **Increase (40+):** Landfall strategies or highly inflated curves. **Decrease (36):** Hyper-low average CMC (~2.1) loaded with cantrips `[V2, ~01:10:55]`. |
| **Card Advantage**      | 12              | Must *net* cards. Cantrips/looters are fractional selection, not raw advantage `[V1, ~00:25:50]`. | **Increase:** Low individual card quality or combo reliance. **Decrease:** Commander intrinsically guarantees card draw `[V2, ~00:34:22]`.                 |
| **Ramp**                | 10              | Must *net* mana. Rituals do not count for this baseline.                                          | **Increase (14-15):** Strict requirement to cast a 4-drop commander on turn 3 `[V2, ~01:26:37]`.                                                           |
| **Targeted Disruption** | 12              | 1-for-1 answers (Destroy, Exile, Bounce, Phase).                                                  | **Decrease:** Extremely fast aggro decks or decks with heavy graveyard spell recursion `[V2, ~00:50:18]`.                                                  |
| **Mass Disruption**     | 6               | Multi-target disruption that leaves you at parity/ahead (Wraths, *Teferi's Protection*).          | No specific exceptions noted in sources.                                                                                                                   |
| **Plan (Meat)**         | ~30             | The Generators, Amplifiers, and Payoffs.                                                          | Expanded by finding overlapping support cards.                                                                                                             |

**Overlap Accounting [Source Guidance: V1]:** To fit these targets into 100 cards, cards must perform dual roles. For
example, a creature that enters the battlefield and destroys an artifact counts as both an Enabler (Meat) and Targeted
Disruption `[V1, ~01:05:54]`.

---

## 5. Collection-Aware Retrieval and Evaluation

**[Synthesis]** When an agent fetches from a user's Collection or a database, it must evaluate beyond Scryfall tag
matching.

1. **Tag Discovery is not Role Coverage:** A tag is not automatically a functional role. A 6-mana creature tagged as
   `removal` fails the functional necessity of early, efficient Disruption. It cannot be counted toward the 12 Targeted
   Disruption slots without breaking the deck's curve.
2. **Oracle Verification:** Synergistic tags (e.g., "Artifacts-matter") must be verified against Oracle text to ensure
   they support the specific *Keystone Objective* (e.g., triggering on artifact *sacrifice*, not just equip costs).
3. **Ownership vs. Availability:** Confirm that owned synergistic pieces aren't excluded by the user's Brief (budget
   caps or assigned to other decks).

---

## 6. Worked Examples

**Example 1: Curve Alignment and Probability (Sidisi, Brood Tyrant)**

* *Source Evidence:* `[V2, ~01:26:37]`
* *Brief/Goal:* Ensure a 4-mana Commander hits the field consistently on turn 3.
* *Template Adjustment:* The baseline 10 ramp spells are statistically insufficient. Using a hyper-geometric calculator,
  the builder increased lands to 40 and 2-mana ramp to 15. This raised the probability of hitting three lands and one
  2-mana ramp piece by the first mulligan from 53% to over 60%.

**Example 2: Fixing a Split Game Plan (Eloise, Nephalia Sleuth)**

* *Source Evidence:* `[V4, "Singular Direction" section]`
* *Trap Encountered:* The deck attempted to both *hoard* Clue tokens (for affinity/mana) and *sacrifice* Clue tokens (to
  drain life). Drawn halves inherently fought each other.
* *Tuning Solution:* The builder removed the "hoard" payoffs entirely, committing 100% of the payoff slots to the
  sacrifice win condition.

**Example 3: Commander Compensation (Wilson, Refined Grizzly + Guild Artisan)**

* *Source Evidence:* `[V3, ~00:18:09]`
* *Reshaping Action:* Because the Commander pairing serves as a hyper-reliable Generator (creating treasure tokens on
  attack), the builder explicitly cut expensive, generic generators from the 99. The freed-up slots were allocated to
  Amplifiers and *Synergistic Advantage* (e.g., *Sarinth Steelseeker*).
* *(Note: The exact payoffs used in this V3 example remain unverified due to transcript errors).*

---

## 7. Tuning and Static Review

**[Source Guidance: V4] The "One Card at a Time" Trap:**
When updating decks over time, players often swap a boring support card (like a land) for a new payoff. Done repeatedly,
the deck's structural math degrades, leading to stalls. *Synthesis Rule for the Agent:* Tuning must be holistic. If the
agent recommends adding a Payoff, it must recommend cutting a competing Payoff or Amplifier—never a foundational support
"vegetable."

**[Source Guidance: V2] Evaluating via Goldfishing:**
Static math requires simulated solo playtesting (goldfishing) for validation `[V2, ~01:21:29]`.

* **The Land Check:** If the simulation regularly misses the 4th land drop, add lands or card draw. Do *not* add more
  ramp.
* **The Dead Hand Check:** If the simulation results in unused mana on turns 2 and 3, the curve is too high.
* **The Empty Hand Check:** If the hand is empty by turn 4, the deck requires more Card Advantage engines.

---

## 8. Information Requirements for a Saved Deck Plan

**[Synthesis]** For the AI agent to retain a revisable "Deck Plan" state across sessions, it must persist the following
context:

1. **The Keystone Objective:** The conceptual logic chain (e.g., Step 1: Generate Tokens -> Step 2: ETB Burn).
2. **Role Intentions (The Pillars):** Every selected card must be mapped to its intended template pillars. If a card is
   swapped later, the agent needs to know which specific functional counts are degraded.
3. **Overlap Dependencies:** If a modal card serves as both a Land and a Removal spell, cutting that one card creates
   *two* distinct deficits. This dependency must be saved.
4. **Template Deviations & Rationale:** Explicitly record *why* a numerical target was abandoned (e.g., "Targeted
   Disruption reduced to 8 due to commander's built-in removal"). Without this, future AI sessions will erroneously flag
   the deck as "broken" and attempt to fix intentional choices.

---

## 9. Source Disagreements, Limitations, and Open Decisions

* **Conflicting Paradigms (Generic vs. Synergistic Support):** There is a distinct conflict between the sources. V1 and
  V2 rely heavily on highly efficient, "generic" staples (e.g., *Swords to Plowshares*, *Cultivate*) to ensure the
  template numbers are consistently met. V3 explicitly argues *against* generic staples, insisting that support pillars
  (Advantage Gainers) should synergize with the Keystone Objective to create outsized advantage `[V3, ~00:23:54]`. The
  agent will need user input to decide which philosophy to prioritize based on the desired power level.
* **Limitations of Templates:** V2 explicitly states that no "time-traveling supercomputer" can perfectly dictate
  fractional card values for mechanics like self-mill or looting `[V2, ~01:21:29]`. The agent must acknowledge that
  evaluating exactly how much "Card Advantage" 10 looter effects provide requires subjective human play experience.

---

## 10. Agent Checklist and Source-Coverage Matrix

### Compact Agent Checklist

- [ ] **Brief Capture:** Are budget, power, and collection restrictions locked?
- [ ] **Keystone Established:** Is the plan restricted to 1-2 focused steps? Is Step 1 inherently useful?
- [ ] **Commander Role Assessed:** Have the ratios of the 99 been adjusted to compensate for what the Commander reliably
  provides?
- [ ] **Template Baseline Met:** 38 Lands, 12 CA, 10 Ramp (Curve matched), 12 Targeted Disruption, 6 Mass Disruption.
- [ ] **Overlap Checked:** Are cards performing dual roles to free up slots for the "Meat"?
- [ ] **Curve Verified:** Is the curve clustered around 1-3 drops, dropping sharply at 5+?
- [ ] **Holistic Tuning:** If swapping cards, are they being traded within the exact same functional category?

### Source-Coverage Matrix

| Report Section           | V1 (CZ 658)    | V2 (CZ 659)           | V3 (CC Shape) | V4 (CZ 767)  | Agent Audit / Notes                                             |
|:-------------------------|:---------------|:----------------------|:--------------|:-------------|:----------------------------------------------------------------|
| 1. Glossary              | Yes            | Yes                   | Yes           | Yes          | Synthesized source terms; defined traps.                        |
| 2. Faithful Inventory    | Yes (Baseline) | Yes (Exceptions)      | Yes (Ratios)  | Yes (Traps)  | Accurately distinguishes numerical caps vs structural pitfalls. |
| 3. Workflow              | Implied        | Implied               | Partial       | Implied      | Explicit methodology strictly tagged as Synthesis.              |
| 4. Template & Rules      | Yes (Numbers)  | Yes (Math/Exceptions) | No            | No           | Integrates exact numbers, scope, and fractional counting.       |
| 5. Collection Retrieval  | No             | No                    | No            | Partial      | Pure Synthesis for agent capabilities; warns on tag limits.     |
| 6. Worked Examples       | No             | Yes (Sidisi)          | Yes (Wilson)  | Yes (Eloise) | Attributes specific mathematical and strategic corrections.     |
| 7. Tuning/Review         | Yes            | Yes (Goldfish)        | No            | Yes (1-by-1) | Details simulation limits and the danger of isolating edits.    |
| 8. Info Req (Saved Plan) | No             | No                    | No            | No           | Pure Synthesis for agent architectural memory constraints.      |
| 9. Limitations/Conflicts | Yes            | Yes                   | Yes           | Yes          | Acknowledges subjectivity and highlights V1/V2 vs V3 conflict.  |