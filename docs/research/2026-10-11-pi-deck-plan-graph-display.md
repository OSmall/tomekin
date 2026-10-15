# Deck Plan graph inspection: Pi and SVG exports

Investigated **2026-10-11** for [Structured tag-based deck plans](https://github.com/OSmall/tomekin/issues/62).
This is capability research for the first inspection view, not an adopted implementation specification.

**Current decision status:** no rendering option has been adopted. Following the Pi investigation, the user
asked about developer-focused static SVG export through a Tomekin CLI command and/or an agent tool, opened
outside Pi. The SVG route below is the current recommendation for that narrower purpose; the earlier Pi
findings remain useful capability evidence. No production renderer, command, tool, or new dependency was added.

**Finding:** a static SVG export is feasible with a local Graphviz renderer. An isolated probe succeeded under
Bun 1.3.14, including a bundled Worker, without native Graphviz or a browser for generation. This avoids Pi's
terminal-width constraint for developer inspection. Pi's built-in Unicode diagrams also work, but a terminal
view needs compact projections and dedicated presentation integration. The export command/tool is still proposed.

## Evidence and version boundary

The checked-in [launcher](../../packages/pi/src/launcher.ts) pins the official macOS ARM Pi **0.85.1** release,
checks its SHA-256, checks `--version`, and launches the cached executable. It does not launch whichever `pi`
is on PATH. The installed release documentation under `.data/tomekin-pi-runtime/0.85.1/pi/` was inspected.
The separately installed global `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` packages also
reported **0.85.1**; their unbundled source was used to inspect the implementation. `grok-mermaid` reported **0.2.2**,
matching the coding-agent dependency in `bun.lock`. No user session or collection contents were read.

Source citations below are pinned to the matching first-party release. Latest documentation can describe
later versions; it is not the basis for claiming a capability is present in Tomekin's pinned runtime.

## Native terminal diagrams

Pi has a built-in Markdown transformer for top-level fenced `mermaid` blocks. It runs `grok-mermaid`, then
converts the resulting diagram into themed Unicode box-drawing rows. This is terminal text, not SVG or PNG,
so it does not depend on Kitty or iTerm2 image support. Normal user and assistant Markdown can take this
path; thinking blocks are explicitly excluded. The original message is preserved independently of the
display
transformation. [Mermaid transformer](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/modes/interactive/components/mermaid.ts),
[interactive integration](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/modes/interactive/interactive-mode.ts),
[Markdown hooks](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md#piregistermarkdowntransformertransformer).

The `markdown.mermaid` setting supports `off`, `final`, and `streaming`; the documented default is
`streaming`. `final` avoids attempting diagram layout while an assistant response is incomplete.
The default TUI mode is `regular`; fullscreen is an optional display mode.
[Pinned settings](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/settings.md#markdown).

This is a bounded Mermaid renderer, not a guarantee that every Mermaid feature renders. If no supported
diagram is produced, or its width exceeds the exact available terminal width, Pi retains the source fence.
For a completed diagram with renderer warnings, it keeps the source and adds a warning instead of displaying
the diagram. A wide graph does not automatically become a pannable canvas.
[Fallback implementation](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/modes/interactive/components/mermaid.ts).

For Deck Plans, a role-and-winning-route overview should therefore use short labels, an explicit edge legend,
and a simple flowchart syntax subset. Keep card contributors, quantities, conditions, and coverage findings
in an adjacent table or drill-down view. Separately display permitted terminal support roles; do not invent
relationships just to make them appear connected. This is a presentation recommendation, not a new graph rule.

## Tomekin's integration seam

Tomekin's [Pi extension](../../packages/pi/src/extension.ts) currently serializes core results as JSON in
text content, caps that serialized output at 16,000 characters, and registers no custom tool renderer.
Pi's fallback tool renderer displays raw text. Placing a Mermaid string inside the existing JSON result
does **not** automatically invoke the normal-message Mermaid renderer.
[Pi tool rendering contract](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md#custom-rendering),
[tool execution source](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/modes/interactive/components/tool-execution.ts).

There are two plausible small integrations:

1. A deterministic plan projection produces Mermaid and companion text; the agent includes that exact
   Mermaid fence in its assistant response, where native rendering already works. This is the lowest-effort
   path, but copying through the model introduces a fidelity boundary. It should not be the sole engineering
   inspection of the saved graph.
2. A Pi-specific tool or command displays a projection directly through a custom tool renderer or custom
   entry renderer. This avoids model reconstruction and can provide compact/expanded views. The adapter
   owns terminal presentation; portable plan validation and projection stay outside the TUI. Pi permits
   custom components and custom rendering, but native Mermaid transformation is not automatically attached
   to a newly constructed tool Markdown component. The implementation must deliberately wire a renderer
   or directly render a supported projection rather than depend on undocumented internal Pi imports.

Pi's public extension surface includes `renderCall`/`renderResult`, `registerEntryRenderer`, and
`ctx.ui.custom()`. Custom entries do not participate in model context; a command can provide an inspection
experience without expanding the agent's tool set. Custom components require a `tui` mode guard because
RPC/print modes do not provide the same component experience. Tomekin's local `PiApi`/`PiTool` types currently
expose a small subset of that API and would need a deliberate adapter extension.
[Extension rendering](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md#custom-rendering),
[entry renderer](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md#piregisterentryrenderercustomtype-renderer),
[custom UI](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/tui.md#using-components),
[extension types](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/core/extensions/types.ts).

## Browser export and images

Pi's `/export` writes session HTML, but the 0.85.1 HTML template handles code blocks with `marked` and
`highlight.js`. It has no Mermaid diagram renderer: the Mermaid source remains a code block in that export.
This differs from the terminal display path. A graphical browser view would need a standalone HTML/SVG
projection or an additional export integration; exporting the session alone does not deliver that view.
[Export command](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/usage.md#exporting-and-sharing-sessions),
[HTML renderer](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/core/export-html/template.js).

Pi also has an `Image` component and image content support. Supported terminal protocols include Kitty and
iTerm2, with a text placeholder fallback when image display is unavailable. In fullscreen mode iTerm2 images
are placeholders because its protocol cannot delete/crop placements as Pi scrolls; Kitty-compatible terminals
can display images there. Regular mode permits iTerm2 inline images. An image path additionally requires
generating a raster diagram, and its readability depends on terminal size and image support. It is unnecessary
for the first text diagram and should not replace an inspectable representation.
[Image component](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/tui.md#image),
[display modes](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/usage.md#interactive-mode),
[terminal capability overrides](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/terminal-setup.md#capability-overrides),
[image fallback source](https://github.com/earendil-works/pi/blob/v0.85.1/packages/tui/src/components/image.ts).

## Relative effort and scoped recommendation

| Approach                                               | Relative work                                     | Practical limit                                                              |
|--------------------------------------------------------|---------------------------------------------------|------------------------------------------------------------------------------|
| Native Mermaid in assistant text                       | Small projection/response integration             | Width/syntax fallback; model-copy fidelity                                   |
| Deterministic Pi inspection command or custom renderer | Modest adapter work                               | Need explicit renderer wiring, expansion/fallback, and mode handling         |
| Static SVG export                                      | Modest projection/export integration              | Graphviz dependency; viewing happens outside Pi                              |
| Standalone interactive browser view                    | Additional viewer integration                     | Browser UI and diagram dependencies; Pi export alone is insufficient         |
| Generated PNG inline                                   | Additional rendering pipeline and terminal checks | Image protocols, display mode, small-text readability                        |
| Interactive graph canvas/editor                        | Substantial new UI                                | Layout/navigation/editing and cross-front-end design beyond first inspection |

The original Pi-focused recommendation was a small terminal diagram plus tables; it was not an adopted
decision. For the user's later developer-inspection request, prefer the static SVG export described below.
Both approaches should use a deterministic projection, clearly distinguish edge types, preserve `enables`
direction (supplying function → affected function), and label intentional empty roles and gaps. Neither requires a graph
editor or interactive frontend. The user selected `enables` for the contract going forward, replacing
`requires` and reversing its endpoints. In Q13 the user revised the semantics: `enables` supplies an
input/resource/event used or rewarded by the target, `enhances` increases output/frequency/effectiveness,
and `supports` improves access/protection/recovery/resilience. These are contextual influence relationships,
not execution ordering or a necessary-versus-helpful distinction.

## Developer-focused static SVG alternative

A developer export can load a validated saved Deck Candidate and its authoritative plan, produce a stable
Graphviz projection, render SVG, and write a file. A browser or existing SVG viewer can display that file
outside Pi. The same projection could later serve an agent tool, which returns the artifact location and
summary rather than putting SVG markup into Pi's capped JSON transcript. This is a proposed integration,
not an existing end-to-end feature: [current CLI commands](../../packages/cli/package.json) cover import and
sync, and neither that package nor the root scripts currently expose a plan-diagram command.

The generated SVG is a snapshot derived from a particular candidate/plan revision, not an editable plan or
a second authoritative representation. Include candidate identity and revision/context in its title or
metadata so later inspection does not mistake an old export for the current plan. Export is a developer
inspection operation; the source candidate and plan remain the authority.

### Native Graphviz

Graphviz's native `dot` layout is designed for directed hierarchical graphs; SVG is an official output
format. A developer can render a generated DOT file with `dot -Tsvg input.dot -o output.svg`.
This keeps the code integration small but adds a separately installed executable. `dot` was **not on PATH**
on the checked machine, so this native path was not executed. Pinning or recording the Graphviz version
would be needed for reproducible layout; fonts and renderer versions can still affect output.
[DOT layout](https://graphviz.org/docs/layouts/dot/),
[SVG output](https://graphviz.org/docs/outputs/svg/),
[command-line flags](https://graphviz.org/doc/info/command.html).

### Graphviz through `@viz-js/viz`

`@viz-js/viz` packages Graphviz as WebAssembly with a JavaScript wrapper. After asynchronous initialization,
`renderString(input, {format: "svg", engine: "dot"})` returns an SVG string, so this export path does not
need a browser DOM or a local `dot` executable. The input can be DOT or a graph object containing nodes,
edges, attributes, and subgraphs. The object form provides a direct projection seam from validated plan data.
Use fixed presentation attributes and plain labels; layout does not replace domain validation.
[Official API](https://viz-js.com/api/), [package source](https://github.com/mdaines/viz-js/tree/v3/packages/viz).

The library initializes asynchronously but layout calls are synchronous. For a CLI that is straightforward;
for an agent tool, keeping that work in Tomekin's existing Worker execution lane would prevent layout from
blocking Pi's event loop. That is an architectural inference, supported by the isolated Worker experiment
below and the [current transport](../../packages/pi/src/worker-transport.ts), not proof that a future exporter
has been integrated or that every platform/runtime is supported.

| Backend            | Benefit                                                             | Trade-off                                                                                 |
|--------------------|---------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Native `dot`       | Minimal wrapper; familiar developer dependency                      | Separate installation and executable/version handling                                     |
| `@viz-js/viz` WASM | npm dependency; no native executable or browser needed for SVG text | Adds a bundled WASM runtime; initialization and worker/bundle integration need validation |

**Current recommendation, pending user decision:** a developer CLI export using the WASM backend is a
practical first path when avoiding native setup matters. Native `dot` is also reasonable if a developer-only
Graphviz prerequisite is acceptable. Keep diagram generation as one reusable projection/export capability;
whether to expose it to the agent immediately is a separate interface choice. Do not build Pi custom UI solely
to satisfy the developer inspection requirement.

### Isolated SVG render experiment

Installed **`@viz-js/viz` 3.31.0** into `/tmp/tomekin-viz-svg-probe`, without changing repository dependencies.
The package reported bundled **Graphviz 16.1.0**. On **Bun 1.3.14**, a synthetic graph object containing five
nodes, four edges, mixed `supports`/`requires` relationships, and a disconnected gap role rendered to SVG. The output
contained five
node groups and four edge groups, with 4,486 characters. A syntactically invalid DOT input returned a failure
and syntax-error message through `render()`. A separate directed cycle `a → b → c → a` also rendered
successfully, with three edge groups; that original five-node input did not contain a directed cycle.

The same input also rendered successfully inside a Bun Worker. A second check bundled that Worker with
`bun build --target bun` and successfully rendered from the bundled Worker; that temporary artifact was
approximately 2.66 MB. Observed direct-run initialization was 40–70 ms and rendering plus writing 16–21 ms.
These are small local checks, not performance guarantees or a full-candidate scalability benchmark.

Preserved artifact: [synthetic SVG example](./assets/2026-10-11-deck-plan-svg-example.svg), regenerated after
the user's Q13 functional-relationship decision. The original experiment above used `requires` from dependent
to prerequisite, followed by an intermediate export using the now-superseded necessary/helpful distinction.
The current example uses reciprocal `enables` edges between Produce expendable creatures and Convert creatures
into mana: creatures supply sacrifice fodder, and the resulting mana can fund creature production. Creature
production also enables the combat route; the intentionally empty Protect engine role supports creature
production. Following user review, the disconnected Mana Advantage node was removed from this example:
its card contributions were not shown, leaving it redundant and unexplained in this engine overview.
Terminal support roles remain permitted by the plan contract; this example does not illustrate them.
No card contributions are included in this overview. The revised SVG was rendered directly and in the
bundled Worker and checked as well-formed SVG with four node groups and
four edge groups. The input was invented for this experiment;
no production Deck Plan was read or exported. No native Graphviz run, Node runtime, other operating system,
Pi tool integration, arbitrary label corpus, or large real deck was tested. A correct SVG output still does
not establish strategic coherence or plan execution.

## Verification boundary and remaining checks

The capability conclusions above come from the pinned release docs and installed same-version source.
The parent researcher exercised the installed 0.85.1 `createMermaidMarkdownTransformer` and `grok-mermaid`
0.2.2 directly, in `final` mode, with synthetic graph inputs. Available content widths were 40, 80, and 120
columns; these are widths passed to the renderer, not total terminal widths before UI padding.

| Synthetic projection                                             | Produced width | Outcome                                           |
|------------------------------------------------------------------|----------------|---------------------------------------------------|
| Four connected route nodes plus three disconnected support nodes | 99 columns     | Source fallback at 40 and 80; rendered at 120     |
| Four connected route nodes only                                  | 26 columns     | Rendered at all three widths                      |
| Four-node feedback graph                                         | 24 columns     | Rendered at all three widths, no renderer warning |
| Three-node symmetric competition example                         | 26 columns     | Rendered at all three widths, no renderer warning |

These probes establish that compact route views fit where an overview containing disconnected support nodes
may not. They do not establish the quality of arbitrary large graphs. A deliberately invalid-looking label,
`A[Unclosed --> B[Win]`, was accepted as one label with no warning, illustrating why Mermaid rendering cannot
replace validation of the actual plan data. No exhaustive Mermaid conformance test was performed.

The pinned release binary was also launched in an 80-column pseudo-terminal, in regular mode, with an isolated
temporary profile, `markdown.mermaid: "final"`, offline startup, and a synthetic saved assistant message.
Its actual chat display rendered the four-node route as themed Unicode boxes, labelled arrows, and a separate
coverage summary. No provider/model call, private session, Collection data, or production profile was used.
The process was stopped after the display check. This verifies the native binary chat path as well as the
standalone transformer; it does not exercise a future Tomekin graph tool or custom renderer.

A full Tomekin graph-tool integration and a manual visual check in the user's actual terminal remain untested.
Those checks are necessary before promising exact production rendering quality across terminals.

Implementation validation should cover narrow-terminal fallback, unsupported syntax, disconnected support
roles, permitted empty roles, cycles, edge directions and labels, tool expansion, restored output, and
non-TUI fallback. Rendering must preserve the authoritative graph; a diagram's connectivity or a successful
layout remains no evidence that the deck executes its plan.
