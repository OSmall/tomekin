# Pi TUI-to-product tool topologies

**Question.** Which current Pi v0.85.1 mechanisms can let Tomekin's pinned,
checksum-verified standalone Pi TUI expose its restricted product-tool registry and
methodology loader without generic model authority, a Node sidecar, or a duplicate
of portable-core behaviour?

**Investigated:** 2026-09-14. This is a topology finding, not adapter
implementation or a change to the runtime dependency set.

## Result

Pi has two relevant, first-party mechanisms, but they are not the same topology:

1. **A released standalone Pi TUI with a Tomekin extension running in Pi's
   process** is the direct fit for the already chosen interactive-TUI surface. The
   extension is the tool bridge: it registers the selected Tomekin tools and calls
   the existing portable handlers. No SDK-to-TUI or parent-to-child tool RPC is
   involved or required.
2. **An in-process SDK session, optionally rendered with `InteractiveMode`,** can
   receive `customTools` directly. This is a supported Pi SDK composition
   mechanism, but it replaces the release-binary TUI topology with a Tomekin-owned
   host/launcher. It is an alternative, not a missing bridge for option 1.

Pi's documented RPC and JSON modes control a Pi process from another client; they
are not documentation of a protocol by which a standalone TUI delegates individual
tool calls to a separately running Tomekin SDK process. Do not infer that bridge
from the independent existence of the SDK and the TUI. Building such IPC would be
new adapter architecture, not a Pi-proved integration.

## Topology matrix

| Candidate                                                                              | What Pi proves                                                                                                                                                                                                                                                                                            | Necessary Tomekin seam                                                                                                                                                                                                                                                                                                                                                                                                      | Limits and decision impact                                                                                                                                                                                                                                                                                                                                  |
|----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Released standalone Pi TUI + project-local Tomekin extension**                       | Extensions can register model-callable tools, receive tool arguments and an abort signal, return structured results, and use the TUI. Pi discovers project-local extensions only after project trust. Its released Bun binary has already been verified locally to launch the interactive TUI at v0.85.1. | The extension must be a thin adapter that imports/calls Tomekin's existing local Agent Tool handler composition; it translates Pi schemas/results only. It must load the checked-in methodology through Pi's resource loader, and it must create/close the existing SQLite-backed runtime on the same safe lifetime as the current adapter. Launch with an explicit product tool allow-list and isolated resource settings. | This is **the direct initial-surface candidate**. The extension executes inside Pi's process; there is no separate product-tool process to supervise. Its ability to import the exact workspace handler module from the release binary has not yet been demonstrated, so an adapter spike must prove that import, one tool call, cancellation, and cleanup. |
| **In-process SDK + `customTools` + SDK `InteractiveMode`**                             | `createAgentSession()` accepts `customTools`; the SDK also exposes a full `InteractiveMode` TUI. The SDK can load explicit extension factories and resource paths.                                                                                                                                        | A new Tomekin executable owns the Pi session, model runtime, session manager, TUI lifecycle, event subscription, and product-tool instances directly. The same thin Pi schema/result adapters can call portable handlers without duplication.                                                                                                                                                                               | It is a viable custom-host design, but **not** the chosen standalone-release-binary surface. The prior Bun probe proves session construction, not an interactive production UI, provider login, or tool execution. Pi's package declares a Node engine rather than a Bun support promise, so this needs a separate runtime decision if revived.             |
| **Standalone Pi TUI + separate Tomekin SDK/handler host over an invented IPC channel** | No Pi v0.85.1 source found establishes this tool-delegation protocol. RPC mode is a client-control protocol for Pi, not evidence of a custom tool-host bridge.                                                                                                                                            | Would require a new protocol, lifecycle/cancellation forwarding, result framing, authentication boundary, and error semantics.                                                                                                                                                                                                                                                                                              | **Not a supported topology for this migration.** Do not add it merely to keep handlers in a parent Bun process.                                                                                                                                                                                                                                             |
| **Pi RPC/JSON process controlled by Tomekin**                                          | Pi documents RPC/JSON modes and extensions can distinguish non-TUI mode.                                                                                                                                                                                                                                  | A controller sends prompts and processes Pi events; tools still need to be registered in the Pi process via its loader/extension mechanism.                                                                                                                                                                                                                                                                                 | Appropriate only if a non-terminal client is intentionally added. It does not meet the initial interactive-TUI requirement, and TUI-dependent questioning is unavailable or needs the RPC UI protocol. Keep it out of the first migration.                                                                                                                  |

## Concrete boundary for the standalone-TUI candidate

**Process and ownership.** Tomekin's launcher starts the verified Pi binary under a
PTY and owns only launch configuration and process supervision. Pi owns the
interactive TUI, its session file, model/provider interaction, and the extension
host. The Tomekin extension and its product-tool calls run *in that Pi process*.
The parent observes exit/cancellation; it is not on the tool-call path. This is why
a separate sidecar is unnecessary, but also why it must not be claimed as an
out-of-process product boundary.

**Tool authority.** Pi's `--tools` is an allow-list spanning built-in, extension,
and custom tool names. The controlled profile must enable only the approved
Tomekin names plus `ask_user` for the interactive profile, and must suppress
ambient skills/context files. Package resource filters must explicitly select the
question extension and select no bundled skills. The prior standalone-TUI probe
already demonstrated that profile filtering can load `pi-ask-user` while excluding
its bundled methodology skill.

That allow-list constrains the *model-visible* tool set, not process authority.
Pi documents that extensions run with the host user's permissions and provides no
built-in sandbox. The Tomekin extension must therefore be reviewed and run with
the least host filesystem/process permissions practical; it must not register or
invoke generic filesystem, shell, network, database, MCP, or task-spawning tools.

**Methodology.** Pi's resource loader can discover or receive explicit skills and
extension paths. The adapter should make Tomekin's checked-in Product Methodology
the selected resource set rather than relying on ambient Pi skills. This is
instruction loading, not a second implementation of product behaviour.

**Cancellation and result flow.** Pi custom/extension tool functions receive an
`AbortSignal`, an incremental-update callback, and return `content` plus structured
`details`; Pi emits tool execution lifecycle events. The product adapter should
pass the signal only into work that supports cancellation, translate expected
`Result` failures to the existing model-facing error shape, and close per-call
SQLite resources in `finally`. A cancelled TUI/session must result in normal Pi
tool/session termination, not an orphan external handler process.

**Credentials and sessions.** Pi's profile/session manager owns Pi login material
and its conversation-session persistence. Tomekin neither reads nor writes OAuth
credentials. An isolated `PI_CODING_AGENT_DIR` is a launch-profile decision that
avoids ambient resources and credentials; whether it may reuse an existing
user-controlled Pi profile remains a human privacy/UX decision.

## What is proved, inferred, and still open

### Proved by Pi primary sources and prior release-artifact validation

- Pi extensions are TypeScript modules that register custom model-callable tools
  and can use TUI interaction; Pi's tool lifecycle includes result and error
  events.
- `DefaultResourceLoader` discovers extensions and can take explicit paths or
  factories; the SDK also accepts direct `customTools`.
- `InteractiveMode` is a full SDK TUI; it is distinct from launching the released
  standalone binary.
- Pi's release binary v0.85.1 successfully entered the TUI on this host, and the
  filtered `pi-ask-user@0.15.0` extension loaded with its bundled skill excluded.
- The standalone binary's CLI allow-list can limit model-visible tools to registered
  names. Extensions remain unsandboxed host-process code.

### Supported inference

A project-local Tomekin extension that is a thin caller of existing portable
handlers is the smallest architecture that connects the chosen standalone Pi TUI to
product tools. It retains the Agent Harness Adapter boundary: Pi-specific schemas,
UI, session, and presentation live in the extension/launcher; `core` and `sqlite`
remain Pi-free.

### Open acceptance checks, not topology decisions

1. From the verified release binary, load an extension that imports the intended
   workspace handler composition and execute one restricted tool against a
   temporary database.
2. Exercise an authenticated interactive turn, a product tool result/error, and
   Ctrl-C/abort while confirming that handles are closed and Pi returns to a usable
   state.
3. Confirm the launch profile exposes only the selected product tools and
   `ask_user`, contains Tomekin methodology only, and does not load ambient project
   or user resources.
4. Decide whether an isolated Pi profile is mandatory or an existing
   user-controlled profile may be selected, then test login/logout and session
   resume under that policy.

## Primary sources

- [Pi v0.85.1 extension API](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md):
  extension discovery, custom tool registration, TUI/UI access, lifecycle, and security warning.
- [Pi v0.85.1 SDK API](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/sdk.md):
  `createAgentSession`, `customTools`, resource loaders, session abort/disposal, and `InteractiveMode`.
- [Pi v0.85.1 CLI tool options](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/cli/args.ts):
  CLI tool selection and resource switches.
- [Pi v0.85.1 agent-session source](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/core/agent-session.ts):
  allow-list filtering and activation of built-in, extension, and custom tools.
- [Pi v0.85.1 question extension example](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/examples/extensions/question.ts):
  TUI-only interaction and the non-TUI unavailable path.
- [Pi v0.85.1 security documentation](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/security.md):
  no built-in sandbox and extension/process authority.
- [Pi v0.85.1 release artifact validation](./2026-09-07-pi-released-bun-tui-extension-path.md)
  and [filtered ask-user validation](./2026-09-07-pi-ask-user-0.15.0-standalone-tui-validation.md): locally observed
  release-binary/TUI and resource-filter evidence that is specific to this repository.
