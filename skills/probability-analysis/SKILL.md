---
name: probability-analysis
description: "Probability and arithmetic: answer numerical questions or justify deck quantities, access reliability, useful deadlines and mana trade-offs."
---

# Probability analysis

Use executable arithmetic for important numerical answers. A standalone calculation needs neither a Collection import nor a saved candidate. For deck work, reuse the confirmed Brief and applicable numerical evidence.

## Model the decision

1. **Define success.** State the intended action, useful deadline and qualifying conditions. Identify actual selected copies and relevant zones; retained pool alternatives contribute zero. Distinguish seeing a card from accessing it in a usable zone and paying for it. A command-zone card is outside the library sample, and graveyard access depends on how the card reaches that zone and can be used there.
2. **Specify the sample.** For a uniformly sampled fixed population without replacement, state population size N, qualifying count K and cards sampled n. Count the actual opening hand and draws by the deadline under the Format's play/draw assumptions. Treat extra draw, tutors, milling, mulligans and known cards explicitly: a selected mulligan hand is not a larger uniform hand, and searching or conditional access needs its own model. With known cards removed, adjust both the remaining population and qualifying count.
3. **Calculate the stated event.** Use `hypergeometric_calculator` for exactly, at-least, at-most or inclusive-range events and for finding the minimum qualifying population count that reaches a contextual target. The latter varies K, not the number drawn. For supported general arithmetic use Pi's `calculate`; state a capability limit if the adapter cannot execute the required calculation. Report tool inputs, event and result, preserving exact boundary/certainty status rather than inferring certainty from a rounded percentage.
4. **Test the interpretation.** Identify what the calculation omits. A slow or conditional card may belong to a broad role but fail the measured early event. Overlapping roles, multi-color sources and required combinations share cards or resources; use a valid joint/conditional model instead of multiplying marginal probabilities without justified independence. If the available tools cannot answer the combined question, label the simplification and state the unresolved condition.
5. **Compare a choice.** Compare the present configuration with plausible alternatives, choosing reliability targets from the Brief and consequences of missing the action. Explain displaced enablers, payoffs, enhancers or support. Retain the event, qualifying counts, material assumptions, result and trade-off with the current Plan or assessment. Recalculate when those inputs change; reuse valid results across cards instead of manufacturing per-card scores.

## Check mana and curve against intended turns

Assess actual land access, usable total and colored sources, tapped/filter/opponent-dependent lands, ramp installation and first production, recurring payments and mana held for protection or interaction. Follow a representative opening, productive middle turn and later turn. Resources produced by an action can fund later actions; they cannot pay the completed cost that produced them. Colorless mana can fund other costs and free colored sources.

For a multi-color spell, count each source's actual output: the same single unit of flexible mana cannot pay two simultaneous requirements. A tutor can add access only if it can be paid for and used before the deadline. Access percentages describe the modeled event; they do not establish castability, joint execution, sustained output, strategic adequacy or win rate.

Use the applicable Format's reference profile to orient curve review, then compare the actual deck with feasible alternatives. Printed Mana Value summaries describe composition; effective casting routes, activation costs and whole-turn spending determine what the deck can do. A curve's mean, spread or visual resemblance alone supplies no acceptance threshold.

## Sampling reference

For X qualifying cards in a uniform sample without replacement:

`P(X = x) = C(K, x) × C(N − K, n − x) / C(N, n)`

The feasible range is `max(0, n − (N − K))` through `min(n, K)`. Sum feasible outcomes for the requested event. In particular, `P(X ≥ 1) = 1 − C(N − K, n) / C(N, n)`, taking impossible combinations as zero. These formulas explain the model; use the tool for the numerical result.

As a checked example, N=60, K=4 and n=7 gives P(X≥1) ≈39.95%, before mulligans, search or other access. This is the chance of seeing at least one qualifying card, not a casting probability. Distribution definitions: [R's hypergeometric reference](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Hypergeometric.html). Tool schemas own request shapes.
