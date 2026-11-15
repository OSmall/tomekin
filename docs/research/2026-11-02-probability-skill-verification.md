# Probability skill verification

Verified **2 November 2026** for the skill refinement in [PR #136](https://github.com/OSmall/tomekin/pull/136),
using [#118](https://github.com/OSmall/tomekin/issues/118)'s adopted quantitative boundaries. This is evidence for
operational instructions, not a new calculator specification or a strategic-quality certificate.

## Method and tool semantics

The [R Core distribution reference](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Hypergeometric.html)
defines sampling without replacement and the probability mass function. In Tomekin notation, for population `N`,
qualifying copies `K`, sample `n`, and observed qualifying copies `x`:

```text
P(X=x) = C(K,x) C(N-K,n-x) / C(N,n)
max(0,n-(N-K)) <= x <= min(n,K)
```

R's upper tail means `P(X>x)`, so a library survival function needs cutoff `r-1` to answer “at least r.”
The [SciPy distribution reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.hypergeom.html)
independently gives the same mass function and support, and distinguishes survival probability from a quantile.
Tomekin's minimum-count operation varies `K` for a fixed at-least event and target; it is not the usual quantile,
which varies the observed sample outcome. These sources verify the distribution, not an MTG deck model.

The implemented [calculator](../../packages/core/src/hypergeometric-calculator.ts) supports exact, at-least,
at-most and inclusive-between events. It counts subsets with integer arithmetic, compares minimum-count targets
against their exact decimal-string values, and separately returns a floating probability and an exact
`eventStatus`. A displayed `1` can still have `eventStatus: nontrivial`; display rounding does not establish
certainty. Argument shapes and limits belong to the tool schema rather than a duplicate skill reference.

The current skill's basic model is sound. Its important boundary is **which real event the chosen inputs model**.
The one-or-more complement `1-C(N-K,n)/C(N,n)` is a useful explanation, but the executable tool should compute
results rather than the agent implementing floating-point combinatorial arithmetic itself.

## Independent numerical checks

A temporary Python check used exact `Fraction` values and direct `math.comb` products. A separate enumeration of
actual subsets checked every valid `N,K,n` with `N<=8`, and all at-least cutoffs from zero through `n+1`:
**1,440 tail comparisons matched**. This enumeration does not use the production recurrence or binary search.
Direct calls to the existing calculator then matched the nine probability cases below to `1e-14` absolute error.

| Population `N` | Qualifying copies `K` | Sample `n` | Event | Independently calculated probability |
| ---: | ---: | ---: | --- | ---: |
| 60 | 4 | 7 | At least 1 | 39.949962574% |
| 99 | 38 | 7 | At least 3 | 54.803042923% |
| 99 | 38 | 7 | At least 2 | 82.896288569% |
| 99 | 38 | 8 | At least 3 | 65.796052089% |
| 99 | 38 | 8 | At least 2 | 88.596367395% |
| 4 | 2 | 2 | At least 1 | 5/6 |
| 0 | 0 | 0 | At least 0 | 1, certain |
| 10 | 0 | 5 | At least 1 | 0, impossible |
| 10 | 10 | 5 | At least 5 | 1, certain |

Thus 39.95% is a correct two-decimal approximation for the 60-card example. For the seven-card Commander sample,
the two-or-more figure rounds to **82.9%**, rather than the old skill's 82.8%. The Commander results count 38
qualifying objects in 99 library cards; substituting actual lands, MDFCs or landcyclers requires a defensible
definition of success, not just relabelling all 38 as equivalent land drops.

An independent linear scan also checked minimum-count examples:

| Fixed question | Minimum `K` | Passing probability | Probability at `K-1` |
| --- | ---: | ---: | ---: |
| `N=5,n=2`, at least 1, target 70% | 2 | 70% exactly | 40% |
| `N=99,n=10`, at least 1, target 70% | 11 | 71.027747898% | 67.360374214% |
| `N=99,n=10`, at least 2, target 100% | 91 | 100% exactly | 99.999999999422% |

The last comparison illustrates why a nearly certain displayed result must not be substituted for exact target-one
semantics. Targets here are numerical verification cases, not recommended deck reliability thresholds.

## What the deck model must establish

The following are deductions from the sampling model and game-resource accounting, rather than guarantees of the
distribution or calculator:

- Define the sampled library, qualifying **copies**, sample size, success zone and useful deadline. Selected
  quantities determine the starting deck; retained pool alternatives provide no selected copies. For an in-game
  conditional question, remove known cards from the relevant remaining population and qualifying count consistently.
- Count actual draws under the stated Format, play/draw and turn assumptions. An eighth card is a specified sample
  of eight, not a mulligan model. Choosing whether to keep a hand, returning cards after mulligans, tutors and
  conditional extra draws change the process and require separate treatment or an explicit simplified baseline.
- Library access, useful graveyard access and command-zone access are different events. Seeing a recursion target
  in hand does not put it in the graveyard; seeing a tutor does not establish that its target can be obtained on time.
- Shared categories are dependent. A card serving two roles may be one draw and one competing resource; multiplying
  marginal probabilities does not model their joint execution. Distinct categories sampled from one finite library
  are not automatically independent either.
- Source access is not castability. Check colors, tapped or conditional entry, ramp installation and first production,
  recurring payments and the whole turn's competing spending. Resources created by an action cannot pay its earlier
  costs retroactively. A single-color “source seen” count does not model all costs of a multicolor sequence.
- Mean, spread or histogram shape can compare curves descriptively, but omit card-specific colors, alternate costs,
  activations, sequencing and strategic effects. A contextual reference curve should lead to explicit turn questions
  and feasible alternatives; it cannot define an acceptable standard deviation or certify a good deck.

## Operational recommendation and verification limits

Keep one short ordered method: define the decision and event; assemble qualified counts and access assumptions;
run the applicable tool; explain its result and exclusions; compare feasible alternatives and displaced functions;
retain current decision-relevant evidence. Use the minimum-count operation when the question is how many qualifying
copies a contextual target requires, then assess whether that count is attainable and worthwhile within the Brief.
Use a joint model when supported, or label a simpler comparison and its unresolved conditions. No new per-card score,
universal target, curve-fitting rule or simulation claim follows from this verification.

Existing public core tests passed: **8 tests, 55,430 assertions** in
[the calculator test file](../../packages/core/test/hypergeometric-calculator.test.ts). They include independent
subset enumeration, a direct-factorial/linear-scan oracle, support boundaries, target equality and adjacent-count
minimality. The Pi calculator test could not load in the initial checkout because the installed `mathjs` dependency
was missing; this is an environment limitation, not a failed distribution assertion. No implementation, dependency
or permanent test was changed for this research. No live model, game simulation or production Collection was used.

The [earlier mathematics investigation](2026-10-18-hypergeometric-calculator-mathematics.md) remains historical
provenance. The current source and tests establish the implemented contract; these checks add independent evidence
for the examples and modeling guidance in the skills.

## Integration verification

The initial missing-package limitation was resolved with the repository's frozen-lockfile install; dependency
manifests and the lockfile were unchanged. The focused skill-delivery and calculator checks then passed **27 tests**,
including the actual Pi package, restricted instruction reads and both Pi calculator paths. Typecheck passed, and
the full default suite passed **485 tests across 68 files**, with no failures. This verifies existing product and
delivery contracts; no account-backed model run or live strategic acceptance was performed.
