---
name: probability-analysis
description: Use for numerical questions, deck quantities, access reliability, mana timing or other reproducible probability and arithmetic.
---

# Probability analysis

Define the decision, event and useful deadline before calculating. Use actual selected quantities and relevant sections; pool alternatives count zero. Identify qualifying conditions, overlapping roles, dependence and accessible zones. Model graveyard access when relevant as conditional access, not a hand draw. A command-zone card is available under command-zone rules, not a phantom library copy or funded operation.

Use `hypergeometric_calculator` for its finite uniform sampling and minimum-count questions; use `calculate`, where available in Pi, for supported executable arithmetic. If the current adapter lacks the required arithmetic capability, state the limit. State population, sample, event, assumptions and exclusions, including mulligans, search, known cards, timing and independence where relevant. Choose reliability targets for the Brief, compare useful alternatives and explain which payoffs or support are displaced. Keep decision-relevant counts, assumptions and outputs with current reasoning, and reuse only while inputs remain applicable.

For mana, assess usable total and colored sources at relevant turns, tapped/conditional lands, ramp installation and whole-turn spending. Consider recurring payments and representative later turns, not just a first activation. Seeing or accessing a source is not castability, combined execution, sustained output, strategic quality or win rate. State where the chosen model cannot answer the actual question. A standalone calculation needs no Collection import or saved candidate.

## Model a decision

1. Phrase the event in terms of a decision: for example, seeing at least one qualifying early ramp source by a particular turn, rather than an undefined “consistency.” State the population actually sampled, qualifying successes, sample size, deadline and whether the commander, Sideboard or already known cards are outside that population. If opening hand and normal draws are included, count the actual draws under the stated play and mulligan assumptions.
2. Use the hypergeometric tool for sampling without replacement from a fixed population. For at least one success, the complement is `1 - C(N - K, n) / C(N, n)` for population N, qualifying cards K and samples n. The general event “at least r” is the sum of the individual probabilities for r through the feasible maximum. Prefer the executable tool over hand arithmetic and report its inputs and result.
3. Qualify the sample. A land seen after the deadline, a spell lacking its colors, a conditional tutor without its target, or a graveyard card without a way to put it there may not satisfy the decision. State which events the calculation includes and which require additional modeling. Overlapping categories are not independent just because they have separate role counts; multiplying their probabilities without an appropriate joint model can overstate certainty.
4. Compare the present count to plausible alternatives and the cards displaced. Do not present a generic target percentage as a rule. If an exact joint calculation is unavailable, give a clearly labeled simplification or bounded comparison and explain what remains unknown. Save meaningful assumptions and results with current reasoning, not a calculation diary; revisit them when selected quantities, relevant access or deadlines change.

For colored mana, distinguish a source's color production from its ability to enter untapped and pay for a spell on the target turn. For a two-color spell, different required colors may compete for the same source or for the turn's mana. Account for ramp's casting cost and when it starts producing, as well as mana required by activation, protection and recurring payments. A probability of seeing sources is evidence about access, not proof that all costs can be paid together.
