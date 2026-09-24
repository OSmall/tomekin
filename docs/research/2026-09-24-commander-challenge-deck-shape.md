# Commander Challenge deck-shape source notes

**Question:** What does the video linked by [“Integrate Commander Challenge video on improving Commander decks”](https://github.com/OSmall/tomekin/issues/64) actually propose, and which ideas can inform a format-neutral Tomekin plan?

**Primary source:** Commander Challenge, [“Make Any Deck Busted. (by fixing it's shape)”](https://www.youtube.com/watch?v=xZvaBPrF56E), 37:39. Reviewed the video's English auto-generated transcript on 2026-09-24. Timestamps below point into that video. Auto-caption errors affect some card names and rules text, so those details are not treated as authoritative card data.

## Verified source guidance

- The speaker starts with a clear objective in three links: the thing the deck repeatedly does, how it capitalizes on that activity, and the resulting win or overwhelming advantage. In the worked example, making tokens enables Warp World-like effects, which find cards that finish the game. The objective is the test for later card choices. [2:26–5:12](https://www.youtube.com/watch?v=xZvaBPrF56E&t=146s), [9:29–9:54](https://www.youtube.com/watch?v=xZvaBPrF56E&t=569s)
- “Shape” means the balance of functional components, not a fixed curve or deck silhouette. The video names generators (perform the base activity), amplifiers (make that activity do more), payoffs (convert a sufficient setup into a win), and advantage gainers. It draws three supporting pillars: card advantage, mana advantage, and interaction/protection. [10:00–14:29](https://www.youtube.com/watch?v=xZvaBPrF56E&t=600s)
- The desired balance depends on the plan and the commander. A mana-hungry plan calls for more mana support; a slow plan may need more interaction or protection. Because a commander is reliably accessible, the speaker suggests needing fewer deck slots for a function it already supplies. A commander may cover multiple functions. These are explicitly heuristics, not hard rules; play and playtesting are needed to check a shape. [14:31–17:05](https://www.youtube.com/watch?v=xZvaBPrF56E&t=871s)
- In the example, cuts target redundant token generators and expensive cards that neither advance the early token plan nor help the Warp World outcome, even where the individual card is strong. Replacements favour amplifiers and fit with the objective. The plan has two payoff layers: the Warp World effect and the cards it finds to close the game. [17:39–19:39](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1059s)
- The supporting pillars are evaluated for synergy with the deck's activity. The speaker separates ordinary ramp, one-turn explosive mana, and repeatable mana produced by the deck's own plan. Interaction is framed as both suppressing opponents and protecting the deck, with its amount and mix dependent on speed, resilience, and how the deck wins. [22:18–23:14](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1338s), [26:49–29:33](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1609s), [29:33–33:57](https://www.youtube.com/watch?v=xZvaBPrF56E&t=1773s)
- The closing goldfish checks draw, timing, and the turn a win is presented. The speaker warns that the observed turns can overstate real multiplayer performance because opponents affect whether the example commander produces resources. [36:05–37:15](https://www.youtube.com/watch?v=xZvaBPrF56E&t=2165s)

## Tomekin terminology and planning implications

This mapping is **our interpretation**, not terminology or a product design prescribed by the video. The canonical definitions are in [CONTEXT.md](../../CONTEXT.md).

| Video concept | Closest Tomekin term | Important distinction |
| --- | --- | --- |
| Clear objective / base activity and route to winning | Deck Building Brief goal; prospective persisted Deck Candidate plan | A Brief captures the user's agreement. The candidate-specific causal plan may change during construction and Deck Tuning. |
| Generator, amplifier, payoff, advantage gainer | Deck Role | These are roles in one candidate, not reusable Card Identity Tags. A card may cover multiple roles, and “advantage” separates into several roles. |
| Functional sequence or interacting layers | Deck Package and Synergy | One plan can span multiple packages and have layered payoffs. |
| Amount and quality of support | Role Coverage | Evaluate reliability, timing, and dependencies, rather than count cards with a label. |
| Commander supplying a function | Format Anchor contributing to Role Coverage | The generalizable question is what a reliably available anchor supplies; other formats need their own treatment, without importing Commander command-zone assumptions. |
| Swap based on the plan | Deck Tuning / Deck Change Proposal | Existing product behaviour preserves the plan by default during tuning and separately confirms persistence. |

**Possible design questions for the Wayfinder map:** What is the smallest persisted representation of the causal plan and its role dependencies? How should a Deck Candidate record intended versus observed Role Coverage without pretending to calculate an objective optimum? How does a plan revision update card explanations and the final Markdown coherently? Which Commander-specific availability assumptions are examples rather than format-neutral rules? These are inferences for later decisions, not findings asserted by the source.

**Limits:** The video is one creator's practical Commander heuristic and one worked deck, not evidence for universal ratios, numeric targets, format-wide performance, or a guaranteed bracket change. The auto-generated transcript is useful for structure and timestamps but should not be used to validate individual MTG card names or rules text.
