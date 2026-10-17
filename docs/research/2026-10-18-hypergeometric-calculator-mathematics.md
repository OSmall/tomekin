# Hypergeometric calculator: probability and minimum qualifying count

Investigated **2026-10-18** for [Define the generic hypergeometric calculator
contract](https://github.com/OSmall/tomekin/issues/83). **Status: research, not an adopted specification.**
GitHub Issues remains the authority for decisions and committed work. No calculator implementation,
dependencies or product documentation changed.

**Finding:** both requested operations have sound mathematics. The second is a search over the
population's qualifying count, not the usual inverse CDF. Exact integer combinatorics is practical in
the bounded cases measured here and makes threshold equality and minimality reliable. Whether these
operations appear as one Agent Tool or two is an interface decision.

## Source scope

The sources below are maintained statistical software documentation/source and the ECMAScript
standard, which own the definitions and numerical behavior discussed. No calculator blog supplies
the mathematics. The coupling proof, combinatorial algorithm derivation and experiments below are
original checks performed for this research; they are identified separately from sourced facts.
Documentation/source was inspected on 18 October 2026. These sources are evidence, not a dependency
selection. No library-specific API integration is proposed.

## Sourced distribution facts

Let `N` be population size, `K` its qualifying count, `n` sample size, and `X` the number of qualifying
objects in a uniformly selected sample without replacement. For integral parameters
`0 <= K <= N`, `0 <= n <= N`,

```text
P(X = x) = C(K,x) C(N-K,n-x) / C(N,n)
L = max(0, n-(N-K))
U = min(n,K)
```

The support is every integer from `L` through `U`; probability is zero elsewhere. The
[R statistics manual](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Hypergeometric.html)
provides this formula/support, defining its lower tail as `P(X <= x)` and upper tail as `P(X > x)`.
Its parameter names differ: R's white/black/draw counts correspond to `K`, `N-K`, `n` here.

For integer event cutoffs the four requested events therefore mean:

| Event | Mathematical value |
| --- | --- |
| Exactly `k` | `P(X=k)` |
| At least `k` | `sum(x=k..U) P(X=x)` |
| At most `k` | `sum(x=L..k) P(X=x)` |
| Inclusive range `a..b` | `sum(x=max(a,L)..min(b,U)) P(X=x)` |

Empty sums are zero. These formulas are immediate sums of the disjoint PMF outcomes, not extra
distribution assumptions. If a survival-function implementation uses `P(X>q)`, the at-least event
requires `q=k-1`, a relevant off-by-one risk. SciPy's
[maintained distribution reference](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.hypergeom.html)
independently gives the same PMF/support, distinguishes CDF/survival functions, and warns that a
survival function can be more accurate than subtracting the CDF from one.

## What the second operation actually inverts

The requested result is

```text
K_min = min { K in {0,...,N} : P_Hypergeom(N,K,n)(X >= k) >= p }
```

Here `N`, `n`, `k` and target probability `p` are fixed; `K` varies. The ordinary quantile instead
holds the population parameters fixed and finds the smallest **sample outcome** `x` with
`P(X<=x) >= p`. The [R manual's quantile definition](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/Hypergeometric.html)
and [SciPy's inverse-CDF definition](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.hypergeom.html)
make that distinction explicit. Calling a usual hypergeometric quantile routine does not solve the
requested population-count problem.

“Find minimum qualifying count” or “solve for population qualifying count” is therefore a precise
description. “Reverse calculator” can be informal UI language, but “inverse CDF” would describe a
different operation. Mathematics neither requires nor rules out two tools: the operations have
different inputs/results and can share the same probability engine.

## Original proof that the minimum-count search is valid

Label the population `1..N`. Choose a uniformly random `n`-element subset `S` once. For population
qualifying count `K`, designate labels `1..K` qualifying and set

```text
X_K = |S intersect {1,...,K}|.
```

This constructs the PMF above by counting subsets. On every particular sample,
`X_(K+1) = X_K + 1{K+1 is in S} >= X_K`. Consequently the indicator of `X_K>=k` never decreases as
`K` increases; taking expectations proves that `g(K)=P(X_K>=k)` is nondecreasing. This coupling is an
original proof from the uniform-subset model, not a claim that an external source already implements
this search. Nondecreasing is sufficient for an integer lower-bound binary search; strict increase
is unnecessary because plateaus are permitted.

For `1 <= k <= n`, the support also gives useful exact boundaries:

- `K<k` makes the event impossible.
- `K=N-n+k` makes the event certain, because even a sample with as many nonqualifying objects as
  possible contains `k` qualifiers.
- For `K<N-n+k`, the support includes an outcome below `k` with positive probability, so certainty
  has not yet been reached.

For `0<p<=1`, binary search can use the failing sentinel `k-1` and passing bound `N-n+k`.
The final result should satisfy both `g(K_min)>=p` and, when `K_min>0`, `g(K_min-1)<p`.

## Degenerate cases and mathematical feasibility

The following are deductions from the same counting model, not additional library guarantees:

| Case | Consequence |
| --- | --- |
| `N=0` | Only `K=0,n=0` are valid; one empty sample, so `X=0` certainly |
| `n=0` or `K=0` | `X=0` certainly |
| `K=N` | `X=n` certainly |
| `n=N` | `X=K` certainly |
| Minimum-count target `p=0` | Minimum is `K=0`, even when the event itself is impossible |
| Minimum-count cutoff `k=0` | Minimum is `K=0` for every target in `[0,1]` |
| `k>n`, `p>0` | No qualifying count can attain the target |
| `1<=k<=n`, `p=1` | Minimum is exactly `N-n+k` |

Thus no-solution is a meaningful search result if cutoffs beyond the sample size are accepted.
Within `1<=k<=n`, an unrestricted search over all `0..N` always has a solution. A future search bound
such as an availability cap could create additional no-solution cases, but is outside this research.

Allowing nonnegative integer event cutoffs beyond support preserves ordinary probability semantics;
rejecting them instead is a product validation choice. Reversed range endpoints and negative
cutoffs likewise need an explicit interface rule. Fractional population/card/sample counts do not
describe this model and should be rejected rather than silently rounded. The combinatorial model
works at `N=0`; software libraries may impose stricter constructor domains.

## Numerical evidence from primary implementations

The [R Core implementation of the CDF](https://raw.githubusercontent.com/wch/r-source/trunk/src/nmath/phyper.c)
(the R source mirror) documents an earlier cancellation failure: a tiny right tail was reported near
`6.37e-14` although the correct value was near `5.11e-22`. Current code switches tails and uses a
PMF-relative summation. Its comments also acknowledge that mathematically positive PMFs can
numerically underflow to zero.

[R's PMF source](https://raw.githubusercontent.com/wch/r-source/trunk/src/nmath/dhyper.c)
uses an equivalent ratio of binomial probabilities with a stabilizing choice of parameter rather
than naively forming factorials. These are primary implementation examples of why algebraically
equivalent floating-point formulas can behave differently.

[Boost's implementation notes](https://www.boost.org/doc/libs/latest/libs/math/doc/html/math_toolkit/dist_ref/dists/hypergeometric_dist.html)
describe factorial lookup for small populations, prime-factor methods for larger populations, and
direct summation of the chosen smaller tail using recurrence. They document accuracy degradation
for very large populations. Those are statements about Boost's implementation, not accuracy claims
for a future Tomekin engine. The original Wu paper cited there was located at its
[publisher DOI](https://doi.org/10.1145/151271.151274), but full text was inaccessible; no finding here
depends on an unread paper.

An arbitrary epsilon in `computedProbability >= target - epsilon` does not prove minimality: it can
accept a population count whose true probability falls below the target. Computing both adjacent
answers with the same unstable floating routine does not independently fix that defect.

## Recommended bounded exact approach — not an adopted decision

For a documented, performance-tested population bound, compute integer combinatorial weights:

```text
D = C(N,n)
w_x = C(K,x) C(N-K,n-x)
A = sum of w_x for the requested event
probability = A / D
```

For a decimal target represented exactly as `T/Q`, compare `A*Q >= T*D` using integers. No rounding
of the reported probability should enter the decision. This treats equality inclusively and handles
zero/one targets exactly. ECMAScript's
[BigInt specification](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types-bigint-type)
defines arbitrary-width integers and exact multiplication; division truncates, so exact divisibility
must be maintained. The following recurrences are algebraic derivations of binomial coefficients
and the PMF, respectively:

```text
C(a,0) = 1
C(a,j) = C(a,j-1) * (a-j+1) / j

w_(x+1) = w_x * (K-x) * (n-x)
                  / ((x+1) * (N-K-n+x+1))     for L <= x < U
```

Multiply the whole numerator before dividing by the whole denominator; the combined division is
exact, while dividing individual factors prematurely need not be. Initialize any in-support weight
using two exact binomial coefficients. For an at-least event, compute either its numerator or the
shorter complementary event and use `D-A`; integer subtraction has no floating cancellation.
Reuse `D` across the minimum-count search. A PMF/range sum uses at most `n+1` weights and search
uses `O(log N)` such evaluations; actual time depends on the integers' bit lengths, not only these
operation counts. Since every weight and `D` count subsets, they are bounded by `2^N`.

The public integer limit must be an explicit performance bound. The
[ECMAScript safe-integer definition](https://tc39.es/ecma262/2023/multipage/numbers-and-dates.html#sec-number.max_safe_integer)
permits exact Number inputs only through `2^53-1`; that representational limit is far too large to
serve as an algorithmic work limit. Convert bounded counts to BigInt before multiplying them.

Target representation remains an interface decision: a bounded decimal string can preserve exact
decimal intent; a JSON Number can instead be given documented shortest-decimal semantics after
parsing. The latter cannot preserve distinct input spellings that already rounded to the same Number.
Either choice needs bounded precision/length so target parsing cannot create unbounded integer work.
Using the exact IEEE binary value is another possible contract but makes familiar decimal equality
surprising (for example an event exactly `7/10`).

Return/display probability separately as an approximation. Converting huge `A` and `D` independently
to Number can produce `Infinity/Infinity`; use a bounded decimal/scientific conversion or scaled
integer division. Fixed decimal places alone can display a positive tiny probability as zero or a
noncertain probability as one. Formatting and whether to expose exact-zero/exact-one information
remain contract decisions. Exact decision arithmetic does not promise an exact floating result.

## Independent checks and feasibility experiment

Temporary Python and JavaScript scripts performed these original checks, without adding feature
code or permanent tests:

- Enumerated actual subsets for all **506 distributions** with `0<=N<=10`, every valid `K,n`.
  Exact combinatorial weights and their recurrence matched the enumerated outcome counts. Their
  sum equalled `C(N,n)`; every adjacent-`K` at-least tail was nondecreasing.
- Compared binary-search results against a separate direct-binomial-weight summation and linear
  scan for **12,012 searches**: `0<=N<=20`, every valid `n`, `0<=k<=n+1`, and targets
  `0,0.1,0.5,0.7,0.9,1`. All matched, including empty populations, impossible events and equality.

Useful exact acceptance examples:

| Inputs | Verified result |
| --- | --- |
| `N=4,K=2,n=2` | PMF weights for `X=0,1,2` are `1,4,1`, denominator `6` |
| `N=5,n=2,k=1`, varying `K=0..5` | At-least probabilities `0,2/5,7/10,9/10,1,1` |
| `N=5,n=2,k=1,p=0.70` | Minimum `K=2`; exact equality passes |
| `N=99,K=10,n=10,k=1` | `26500657335/39341612401` ≈ `0.6736037421365677492634600876` |
| `N=99,K=11,n=10,k=1` | `27943461275/39341612401` ≈ `0.7102774789751556426046443475` |
| `N=99,n=10,k=1,p=0.70` | Minimum `K=11`; `K=10` fails |
| `N=99,n=10,k=2,p=1` | Minimum `K=91`, not a rounded-near-one answer |

For feasibility, a temporary exact BigInt implementation ran on ARM64 with **Bun 1.3.14**, using
`n=K=N/2`, event `X>=N/4`, and minimum-count target `7/10`. Each invocation discarded one warm-up
and measured seven runs. Across two invocations, observed medians were:

| Population | Denominator bits | Direct probability | Minimum-count search |
| --- | ---: | ---: | ---: |
| `100` | 97 | 0.018 ms | 0.070–0.072 ms |
| `1,000` | 995 | 0.29–0.58 ms | 1.67–3.13 ms |
| `10,000` | 9,994 | 15.1–21.0 ms | 110–127 ms |

These include exact-divisibility assertions inside the recurrence. They demonstrate feasibility
for these dense cases only: they are not a worst-case guarantee, concurrent-load measurement,
full input-domain benchmark or justification for selecting a particular product bound.

Recommended implementation acceptance evidence is subset enumeration over a small complete domain,
an independently expressed exact oracle, PMF normalization and event/complement identities, monotone
tails, adjacent-count minimality, exact decimal equality, zero/one and support boundaries, and
measured maximum-bound workload. Those recommendations are distinct from tests already performed.

## Decisions outstanding at the research handoff

This section records the state before the subsequent user discussion. Current accepted decisions
live in the linked GitHub decision ticket; this research note is not a live tracker or specification.

The mathematics was settled sufficiently to discuss the contract. Still open at that point were one versus two Agent
Tools and their names; the practical population/target-precision bounds; target representation;
validation versus ordinary tail semantics for out-of-support cutoffs; and probability formatting.
No external dependency or floating-point accuracy tolerance has been selected. If an unbounded or
substantially larger population contract is required, the small experiment here is insufficient.
