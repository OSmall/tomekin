# Pi calculator options

Research date: 2026-11-02. This is a dated dependency investigation, not an implementation specification.
The comparison phase inspected package metadata, source, documentation and upstream CI without executing candidates.
The user subsequently selected `@fitchmultz/pi-calculator` as the preferred candidate and authorized an isolated
Bun/Pi compatibility trial. Trial evidence is recorded below.

**Adopted outcome:** following the trial and user approval, Tomekin now pins 4.1.9 and explicitly loads its native
`calculator` extension. The custom `calculate` implementation and direct Math.js dependency are removed. Current
behavior is owned by [product behavior](../product-behavior.md#general-calculator-pi), with the integration boundary in
[architecture](../architecture.md#pi-general-arithmetic-dependency). The comparison and trial descriptions below record
the evidence at their respective stages.

## Native Pi extensions

Two published native calculator extensions were identified through the [Pi package catalog](https://pi.dev/packages),
[npm's registry search](https://registry.npmjs.org/-/v1/search?text=keywords%3Api-package%20calculator&size=100),
GitHub repository searches, and official Pi source inspection. This search does not prove that no other extension exists.

| Option | Observed adoption and maintenance | Features | Footprint and compatibility | Main caveats |
| --- | --- | --- | --- | --- |
| [`@fitchmultz/pi-calculator`](https://github.com/fitchmultz/pi-calculator) | 0 GitHub stars; repository created 2026-08-02; pushed 2026-11-01; npm latest 4.1.9 published 2026-11-01, ten published versions. | 40-significant-digit decimal arithmetic, scalar or flat-array results, roots/logarithms/trigonometry, factorial, percentages, rounding, mean/median/standard deviation. | MIT; 49,791-byte unpacked package, two exact direct runtime dependencies with no further dependencies; Node >=24, Pi >=1.0 stated. Development and qualification cover Pi 1.4.0; bounded local Bun trial passed below. | Small, young project with no star-based adoption evidence. No upstream Bun qualification found. Changes tool name to `calculator`, and returns decimal strings rather than Tomekin's current numeric `result`. |
| [`@ohaiibuzzle/pi-calculator`](https://github.com/ohaiibuzzle/pi-calculator) | 0 stars; repository and only npm release 0.1.0 dated 2026-09-26. | Math.js BigNumber arithmetic with 64-digit working precision/60-digit default output, batches of up to 50 expressions, assignments scoped to one call, units, broad Math.js functions including combinations and statistics. | 42,073-byte unpacked extension package; Math.js ^15.2.0 dependency; native Pi `defineTool`/`registerTool`. Repository license GPL-3.0; npm package omits license field. | README explicitly says pathological factorial input can stall Pi's main thread. No tests or CI files in inspected tree. No exact supported Pi version, Node engine or Bun qualification declared. Broad syntax differs materially from current scalar contract. |

Sources for the table: primary [fitch repository metadata](https://api.github.com/repos/fitchmultz/pi-calculator),
[fitch npm metadata](https://registry.npmjs.org/@fitchmultz/pi-calculator),
[fitch 4.1.9 manifest](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/package.json),
[fitch reference](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/docs/reference.md),
[fitch development guide](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/docs/development.md),
[ohai repository metadata](https://api.github.com/repos/ohaiibuzzle/pi-calculator),
[ohai npm metadata](https://registry.npmjs.org/@ohaiibuzzle/pi-calculator),
[ohai source](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/index.ts),
[ohai README](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/README.md),
[ohai license](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/LICENSE), and
[ohai tree](https://api.github.com/repos/ohaiibuzzle/pi-calculator/git/trees/senpai?recursive=1).
Stars and release metadata are observations at research time, not evidence of numerical correctness or future support.

### Fitchmultz: qualification and behavior

The current repository revision inspected was `fa22b914536773714015174ab6676e613187ee37`, associated with 4.1.9.
The release is [v4.1.9](https://github.com/fitchmultz/pi-calculator/releases/tag/v4.1.9), published 2026-11-01.
The [actual Pi compatibility run](https://github.com/fitchmultz/pi-calculator/actions/runs/41337152270) and
[release run](https://github.com/fitchmultz/pi-calculator/actions/runs/41337152468) completed successfully at that revision.
Upstream's [development guide](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/docs/development.md)
describes verification against separately frozen official Pi and the maintainer's Pi fork, including packed npm and fresh Git consumers,
extension loading, numerical and work-limit probes, native validation/policy errors and rendering. These are upstream results;
they do not establish compatibility with Tomekin's Bun launcher and restricted registry.

The [evaluator](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/eval.ts) uses expr-eval-fork with member access,
assignment, function definition, comparison and logical operators disabled. It replaces operator/function maps with explicit decimal
implementations and supplies an empty variable map. This is inspection evidence of deliberately restricted evaluation, not a formal security audit.
Its [documented limits](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/docs/reference.md#limits) include
4,096 input characters, 128 nesting levels, 50 KiB serialized output, factorial operands at most 1000,
a shared 1000-step factorial budget, and a shared budget for expensive trigonometric, hyperbolic and modulo operations.
Evaluation runs synchronously in the registered tool, with no Worker/timeout or abort-signal handling visible in
[index.ts](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/index.ts).

The [function catalog](https://github.com/fitchmultz/pi-calculator/blob/v4.1.9/docs/reference.md#functions)
includes factorial and descriptive statistics, but does not expose a binomial-coefficient, hypergeometric or distribution API.
Its decimal results are rounded to 40 significant digits; they are not symbolic exact answers.
For example, `exp(ln(1000))` need not return exactly 1000 because intermediate calculations round.
No assumptions about probability independence or an MTG event model are owned by this extension.

For footprint comparison, registry unpacked sizes are 49,791 bytes for the extension,
284,347 bytes for [decimal.js 10.6.0](https://registry.npmjs.org/decimal.js/10.6.0), and
152,724 bytes for [expr-eval-fork 3.0.3](https://registry.npmjs.org/expr-eval-fork/3.0.3).
Both dependencies declare no dependencies. Their sum is 486,862 bytes, excluding host-provided peers and install metadata.
This measures published source footprint; it is not a measured load-time, memory or bundle-size benchmark.

### Ohaiibuzzle: broader functionality, weaker bounds

The [implementation](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/index.ts) creates a Math.js instance
using BigNumber and disables imports, unit creation, parser reentry, simplification and derivative/resolver functions.
The remaining broad Math.js surface includes variables, unit conversions, arrays and functions such as combinations.
Each expression reports its own result/error; the whole call throws only when all expressions fail.
The source has a 50-expression batch maximum, but no per-expression character/work limit or off-thread execution.
The [README](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/README.md#limitations) explicitly documents
that pathological inputs such as a very large factorial can stall Pi.

The package's small top-level size excludes Math.js: [Math.js 15.2.0](https://registry.npmjs.org/mathjs/15.2.0)
alone is 9,434,044 bytes unpacked and declares nine direct dependencies. It uses the same major dependency already selected
by Tomekin, so replacing the wrapper with this extension would not inherently remove Math.js.
The [repository license](https://github.com/ohaiibuzzle/pi-calculator/blob/senpai/LICENSE) is GPL-3.0,
despite missing license metadata in the [published package](https://registry.npmjs.org/@ohaiibuzzle/pi-calculator/0.1.0).
That discrepancy should be assessed before bundling or distributing it; no legal conclusion is asserted here.

## Official Pi calculator status

The inspected official Pi main-tree inventory contained one calculator-specific file:
[`packages/agent/test/utils/calculate.ts`](https://github.com/earendil-works/pi/blob/9ee7586a95f5e653ae279c3b8f20938faf3639a1/packages/agent/test/utils/calculate.ts).
It is an agent-test utility that evaluates JavaScript with `new Function`, not a published calculator extension or a restricted production implementation.
Its presence must not be described as an official plug-and-play calculator recommendation.
The inventory search did not identify a maintained official calculator extension or example; official Pi compatibility is therefore
an integration/qualification consideration for community options, rather than an available official calculator product in this investigation.

## Tomekin-specific comparison considerations

At comparison time, Tomekin registered a custom Math.js-backed `calculate` wrapper and
[audited](../../packages/pi/src/launcher.ts) an exact model-visible registry. It already deliberately loaded a pinned third-party
`pi-ask-user` extension, so adopting a native calculator extension fits an existing integration mechanism.
This does not require ambient extension discovery or independent Pi package management.

The comparison considered tool-name/schema/result changes, probability instructions, preserved numerical capabilities,
Bun execution, startup/reload/resume registry behavior, and CPU/work bounds.
The existing shared [`hypergeometric_calculator`](../../docs/product-behavior.md#hypergeometric-calculator)
has its own sampling contract and remains separate from this general arithmetic investigation.

## MCP alternatives

These complete the five-option comparison. They are existing servers rather than native Pi calculator extensions.
GitHub stars below were fetched through the live API on the research date; indexed pages can lag by a star or a release.

| Option | Adoption and maintenance | Features | Footprint and compatibility | Assessment |
| --- | --- | --- | --- | --- |
| [githejie/mcp-server-calculator](https://github.com/githejie/mcp-server-calculator) | 161 stars; latest actual commits 2026-08-08, including release 0.2.1 and an MCP dependency compatibility cap; previous feature change May 2025. One code contributor; successful upstream CI. | One expression tool, arithmetic, power/modulo/floor division, Python math functions/constants including factorial, combinations and permutations. | MIT; Python >=3.10, one direct dependency `mcp>=1.4.1,<2`. Published wheel 4,246 bytes, excluding Python and all MCP dependencies. | Best lightweight MCP fallback, but adds a Python process and lacks explicit work/input/finite-result limits. |
| [WolframResearch/AgentTools](https://github.com/WolframResearch/AgentTools) / official Wolfram MCP | 97 stars for the AgentTools repository, not the hosted service; actual latest commits 2026-10-28, substantial ongoing development, tests and successful build. Latest stable GitHub release 2.2.0 dated 2026-07-24; source paclet 2.2.21. | Symbolic/exact mathematics, arbitrary-precision computation, probability distributions, Wolfram Language evaluation and Wolfram Alpha. | MIT adapter; local source requires Wolfram Language 15.0+ and separately licensed runtime. Vendor cloud option avoids local engine but depends on a network service. | Strongest vendor provenance and mathematical breadth; more infrastructure or external dependency than simple arithmetic needs. Official to Wolfram, not Pi. |
| [huhabla/calculator-mcp-server](https://github.com/huhabla/calculator-mcp-server) | 63 stars; latest code 2025-08-13; 14 commits/five contributors; no tagged releases or GitHub Actions runs observed. Doctests present. | 23 tools for arithmetic, algebra/calculus, descriptive statistics, regression/confidence intervals, matrices and plots. | MIT; Python plus FastMCP, NumPy, SciPy, SymPy, Matplotlib and Pydantic. Runtime metadata conflicts, so no minimum working Python version is established here. | Broad but heavy and stale for this need; expression evaluation and isolation need particular scrutiny. Not recommended for Tomekin's simple calculator. |

Primary table sources: [githejie metadata](https://api.github.com/repos/githejie/mcp-server-calculator),
[commits](https://github.com/githejie/mcp-server-calculator/commits/main/),
[manifest](https://github.com/githejie/mcp-server-calculator/blob/main/pyproject.toml),
[PyPI metadata](https://pypi.org/pypi/mcp-server-calculator/json),
[CI](https://github.com/githejie/mcp-server-calculator/actions);
[Wolfram metadata](https://api.github.com/repos/WolframResearch/AgentTools),
[commits](https://github.com/WolframResearch/AgentTools/commits/main/),
[manifest](https://github.com/WolframResearch/AgentTools/blob/main/PacletInfo.wl),
[tests](https://github.com/WolframResearch/AgentTools/tree/main/Tests),
[hypergeometric](https://reference.wolfram.com/language/ref/HypergeometricDistribution.html) and
[binomial](https://reference.wolfram.com/language/ref/BinomialDistribution.html) reference;
[huhabla metadata](https://api.github.com/repos/huhabla/calculator-mcp-server),
[commits](https://github.com/huhabla/calculator-mcp-server/commits/main/),
[manifest](https://github.com/huhabla/calculator-mcp-server/blob/main/pyproject.toml),
and [implementation/doctests](https://github.com/huhabla/calculator-mcp-server/blob/main/calculator_server.py).

### Limits, precision and external dependencies

Githejie's [AST evaluator](https://github.com/githejie/mcp-server-calculator/blob/main/src/mcp_server_calculator/calculator.py)
avoids raw Python `eval`, but accepts `ast.Constant` without a numeric-only check and has no explicit length,
node-count, computation-budget or finite-result restrictions. It combines exact Python integers with ordinary
floating-point math. Its [test suite](https://github.com/githejie/mcp-server-calculator/blob/main/tests/test_calculator.py)
contains 22 unittest methods. These facts support a small, tested implementation, not a claim of bounded resource use.

Huhabla's [source](https://github.com/huhabla/calculator-mcp-server/blob/main/calculator_server.py) uses
`eval(expression, {"__builtins__": {}}, ALLOW_FUNCTION)` with `math` and `np` exposed; other tools use SymPy parsing.
This is a source-level isolation concern, not a demonstrated exploit. No explicit computation/input budgets were
evident. Its six direct scientific dependencies make the small source file a poor proxy for install/runtime weight.

Wolfram's [current cloud offering](https://www.wolfram.com/ai/mcp/cloud/) is free for limited personal use,
stateless, and has no external file support. This does not establish appropriate terms or quotas for an eventual hosted
multi-user Tomekin application. [Local MCP](https://www.wolfram.com/ai/mcp/local/) requires Wolfram|One,
Mathematica or a licensed Wolfram Engine. The adapter's MIT license does not license the engine or cloud service.
No latency, memory, startup or accuracy benchmarks were run for any candidate.

## Documentation lookup and integration evidence

Context7 was used in the required resolve-then-fetch sequence: `Pi Coding Agent` resolved to the official Pi site
(`/websites/pi_dev`), followed by separate queries about extension loading and native MCP configuration.
Three CLI requests were used. Its [extension](https://pi.dev/docs/latest/extensions),
[package](https://pi.dev/docs/latest/packages), [CLI](https://pi.dev/docs/latest/cli) and
[MCP](https://pi.dev/docs/latest/mcp) results establish the supported integration routes; they did not identify
an official production calculator.

The pinned [Pi 1.4.0 MCP documentation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/mcp.md)
independently confirms built-in stdio and streamable-HTTP support. No third-party Pi/MCP bridge is necessary.
Tomekin explicitly supplies `--no-mcp` and a restricted tool registry, so an MCP candidate needs a deliberate
launcher/profile/exposure decision. Removing that flag alone would not establish that only the selected server is
reachable. This is an integration cost, not an adopted change.

## Research recommendation

Prefer an isolated compatibility evaluation of `@fitchmultz/pi-calculator` 4.1.9 before deciding on adoption.
It fits the native-extension mechanism, has recent actual Pi qualification, a small dependency closure, decimal
precision and explicit resource budgets. Its lack of adoption evidence and unverified Bun execution were material
at comparison time. The recommendation favors direct fit and visible engineering evidence over star count.
The user selected this candidate for the compatibility trial, then approved its native integration following the results.

Githejie is the lightweight MCP fallback if a Python runtime and explicit MCP enablement are acceptable.
Wolfram is the vendor-supported alternative if broader mathematics justifies local licensing or a cloud dependency.
Ohaiibuzzle and huhabla were compared but do not clear the same maintenance/resource-bounds bar.
Other decisive dimensions are output-contract compatibility, cancellation/TUI responsiveness, reproducible dependency
pins, numerical precision, license obligations, offline behavior, tool-schema/context cost, and maintainer concentration.

## Selected candidate: isolated compatibility trial

The user selected `@fitchmultz/pi-calculator` after the comparison. On 2026-11-02, an isolated trial of exact version
4.1.9 passed with Bun 1.3.14 and Tomekin's pinned Pi 1.4.0. The candidate was installed under
`/private/tmp/tomekin-calculator-trial.qKuffg` using npm with lifecycle scripts disabled and automatic peer installation
disabled; the probes used the repository's existing Pi host. No project dependency, source or real user profile changed.

- The actual Pi SDK extension loader registered only the explicit `calculator` and restricted Tomekin `codemode` tools,
  with no extension errors. Reload preserved the same active registry.
- Scalar arithmetic, scientific functions, factorial, statistics, percentages and flat-array results passed.
  `0.1+0.2` returned `"0.3"`, and `2^64` returned `"18446744073709551616"`.
- Invalid syntax, assignments, property access, division by zero, complex/nonfinite results, nested result arrays,
  and sampled factorial/trigonometric/hyperbolic/modulo limits were rejected.
- Native codemode calls returned structured `{expression, value}` directly. `value` is a decimal string or flat
  string array. Errors threw and were recorded as failed nested calls. Native Pi validation rejected an object input,
  but coerced numeric `expression: 42` to `"42"`; the plugin does not impose the old wrapper's exact runtime validation.
- The schema requires one expression string of length 1–4096, with no additional properties. Constants are `PI` and `E`,
  not the previous lowercase forms. `log(E)` returned a 40-significant-digit approximation below one, consistent with
  rounded decimal arithmetic rather than symbolic identities.
- The repository's modular `packages/pi/src/pi-main.ts` started successfully in offline RPC mode, without a model,
  session persistence, ambient resources, MCP or built-in tools. Only the explicit calculator and restricted codemode
  extensions were loaded. RPC state/command requests succeeded, exit status was zero, and stderr was empty.
- Tomekin's then-current registry audit correctly rejected the new name `calculator`. This established the need for
  the registry/launcher/skill/documentation migration, rather than claiming the unchanged production extension supported it.

Local evidence: [SDK probe](/private/tmp/tomekin-calculator-trial.qKuffg/probe.ts),
[SDK results](/private/tmp/tomekin-calculator-trial.qKuffg/result.json),
[CLI probe](/private/tmp/tomekin-calculator-trial.qKuffg/cli-probe.py), and
[CLI results](/private/tmp/tomekin-calculator-trial.qKuffg/cli-result.json).
These disposable local artifacts are not needed to install or run Tomekin.

This establishes bounded compatibility on the measured host, not exhaustive Bun support, integrated production
registry behavior, interactive TUI/authentication behavior, or cross-platform qualification. The upstream Node >=24
requirement remains its documented support contract. Native name/results/errors are the recommended integration
boundary; no compatibility alias or custom evaluator is needed for the observed callers.
