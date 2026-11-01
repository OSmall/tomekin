# Pi dependency management and eventual application distribution

**Date:** 2026-11-01. **Context:** [issue #101](https://github.com/OSmall/tomekin/issues/101), with installation-platform overlap in [#59](https://github.com/OSmall/tomekin/issues/59).

This records the comparison before selecting an integration route. Following the branch trial below, the user accepted
the Bun-managed modular entrypoint in [ADR 0022](../adr/0022-bun-managed-pi-modular-entrypoint.md); the remaining upgrade
and recovery policy was clarified afterward: ordinary reviewed dependency upgrades, Pi-owned model/provider concerns,
no downgrade guarantee, and normal developer use on macOS without a mandatory CLI launch/smoke-test gate. Helper
acquisition remains entirely Pi-owned. Automated Tomekin tool/Worker/adapter tests remain in scope. The original comparison
explored installed application packaging; the user subsequently clarified that the preferred longer-term product is a
hosted website with an embedded chatbot and user accounts. The distribution possibilities below are historical
comparison context, not a commitment to bundling Pi into the eventual product.

## Findings that change the comparison

Pi's latest official release checked on this date is **1.4.0**, published **2026-10-21**. Its official release still includes standalone archives, including macOS arm64. The release API reports SHA-256 `79d9979d76a2a5adb7c28e27e9b44629928ccd0dc9fbb6ae7217860bd5e8be5d` for `pi-darwin-arm64.tar.gz`. This identifies an available version, not Tomekin's next supported version. [Release](https://github.com/earendil-works/pi/releases/tag/v1.4.0).

The npm CLI bundle and SDK are materially different entrypoints. Pi officially documents the SDK as supporting **Node.js or Bun**, and the published package root exports `createAgentSession`, `createAgentSessionRuntime`, `InteractiveMode`, and `main`. Consequently, the npm CLI's failure under Bun does **not** establish that Tomekin must retain a standalone binary. [SDK documentation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/sdk.md), [public exports](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/index.ts), [package manifest](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/package.json).

## Options

| Approach | Dependency ownership today | Effect on current adapter | Eventual installed application |
|---|---|---|---|
| Existing verified standalone acquisition | Tomekin pins release URL, checksum, and version in launcher code | Smallest runtime change; retains Bun-hosted extension and Worker | Ship the full runtime archive layout privately beside Tomekin, with application-owned version selection |
| mise-managed official standalone | Project configuration pins Pi; mise installs and resolves its executable | Can retain the existing extension/Worker host; acquisition and executable resolution move to mise | Build/release tooling can acquire artifacts with mise; end users need not use mise |
| Exact npm dependency, modular Pi entrypoint under Bun | `package.json` plus the repository lockfile can own Pi alongside other dependencies | Promising: native TUI starts and Bun Worker runs in isolated probe; launcher/bootstrap integration changes | Can package a Bun-hosted launcher and its dependencies/assets, but that packaging remains unproven |
| Official managed Pi installer, Node runtime | Upstream installer owns a dependency lock and active release | Supported upstream installation; current Bun Worker transport needs a deliberate Node/Bun bridge | Can carry private Node/Bun processes, at the cost of additional runtime and bridge ownership |
| Plain npm CLI with Node | Package manager owns installation; upstream warns that plain npm installation does not pin transitives | CLI starts, but current global Bun Worker implementation cannot run unchanged under Node | Requires managed private runtimes/dependencies or a separately installed runtime |

The future-distribution column contains architectural possibilities, not a demonstrated application bundle. None of these choices requires that the future application be a single executable.

### mise as a project tool manager

The official mise registry has a `pi` entry with `aqua:earendil-works/pi`, `github:earendil-works/pi`, and npm alternatives. The aqua recipe for modern versions downloads the complete platform archive and points at `pi/pi`; it therefore preserves the runtime asset layout rather than extracting only the executable. An explicitly selected backend avoids ambiguity. [mise registry](https://github.com/jdx/mise/blob/main/registry/pi.toml), [aqua recipe](https://github.com/aquaproj/aqua-registry/blob/main/pkgs/earendil-works/pi/registry.yaml).

For example, preserving the current pin while changing acquisition could be expressed as:

```toml
[tools]
"aqua:earendil-works/pi" = "0.85.1"
```

This is an example, not a selected target version. Current mise documentation supports platform-specific lock generation and `mise install --locked`, recording resolved URLs/checksums. `mise which --tool` can resolve the installed binary without relying on a shell shim. The locally installed mise 2026.6.14 recognizes the registry and relevant resolution/locked-install commands, but a Pi install and lock generation were **not exercised** in this research. The minimum suitable mise version and precise lock behavior need verification against the version actually adopted. [Lockfile documentation](https://mise.jdx.dev/dev-tools/mise-lock.html), [GitHub backend](https://mise.jdx.dev/dev-tools/backends/github.html).

Using mise in a build pipeline to obtain the full archive does not imply making mise an installed application's runtime prerequisite. That separation is an architectural inference; no installed-app packaging was performed here.

### Exact package dependency with Bun and Pi's native TUI

Pi's manifest separates the npm command (`dist/bundle/cli.js`) from the modular public package import (`dist/index.js`). Its exports map exposes the package root and an RPC entry; internal filesystem paths such as `dist/bun/cli.js` are not public subpath APIs. The official standalone build compiles a separate Bun source entry with additional runtime setup. [Manifest](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/package.json), [Bun entry](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/bun/cli.ts), [runtime setup](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/bun/runtime-setup.ts).

The package root publicly exports `main(args, options)` and `InteractiveMode`. `main` retains Pi's ordinary argument parsing, resource setup, native interactive mode, and session services. This allows testing a thin Bun launcher rather than rebuilding a terminal interface around a headless SDK session. The SDK documentation explicitly covers Node/Bun integration; using exported `main` as an embedding seam is supported by its exports/declarations and source, but is less documented than `createAgentSession`. [Exports](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/index.ts), [main implementation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/main.ts), [SDK](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/sdk.md).

The normal CLI also calls an internal `setupCli()` before `main()`: it sets the process title, `PI_CODING_AGENT`/`AI_AGENT`, suppresses warnings, and configures HTTP dispatch. `main()` itself configures HTTP dispatch again after loading proxy settings and later applies the configured idle timeout. This makes the missing setup a small, explicit integration audit rather than grounds for assuming equivalence. The Bun compiled entry additionally registers Bun OAuth flows, Bedrock handling, and an embedded QuickJS Wasm path. Whether each addition is needed for an uncompiled modular Bun host must be checked before claiming authentication/provider parity. [CLI entry](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/cli.ts), [CLI setup](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/cli/setup.ts), [Bun setup](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/bun/runtime-setup.ts).

An exact dependency and lockfile would make version changes ordinary repository dependency changes. It would not by itself prove that arbitrary future Pi releases remain compatible, or that upstream `pi update` should mutate a repository-managed installation.

### Upstream-managed installation

Current Pi quickstart recommends its managed installer, which pins all dependencies; the alternative plain npm route requires Node **22.19.0 or newer** and does not pin transitive dependencies. Nix is another documented route with its own update/pinning mechanism. [Quickstart](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/quickstart.md).

Inspection of the official installer, without executing it, found versioned release directories, staging, downloaded package/lock metadata, `npm ci --ignore-scripts`, executable-version verification, and an atomically replaced active-version file. Its normal flow obtains upstream latest. This solves upstream installation mechanics, but not Tomekin's compatibility selection. The current Tomekin transport uses global `new Worker(...)`, absent in Node; changing to Node would require an intentional bridge to Bun rather than only changing the installer. [Installer](https://pi.dev/install.sh), [existing Worker decision](../adr/0018-worker-backed-pi-agent-tool-execution.md).

## Representative probes

Probes used temporary directories under `/private/tmp`, Bun **1.3.14**, Node **26.4.0**, macOS arm64, and the published npm package **1.4.0**, installed with lifecycle scripts disabled. They made no provider/model requests, did not authenticate, and did not modify Tomekin's source, database, or profile.

| Probe | Result |
|---|---|
| Published npm CLI under Node, `--version` | Pass, `1.4.0` |
| Published npm CLI under Node, help/update help | Pass |
| Published npm CLI under Bun, `--version` | Fails before startup with historical Undici `webidl.util.markAsUncloneable is not a function` |
| Modular public package import under Bun | Pass; session factories, `InteractiveMode`, and `main` are functions |
| Exported modular `main(["--version"])` under Bun | Pass, `1.4.0` |
| Exported modular `main` in a pseudo-terminal under Bun | Native Pi 1.4.0 TUI starts, with expected unauthenticated/no-model warning |
| Inline extension's `session_start` handler | Runs during that native TUI launch |
| Global Bun Worker started by that handler | Echo round-trip succeeds and reports Bun `1.3.14` |
| Active tools with all tools/discovery disabled for the probe | Empty list |
| Ctrl-C exit | Process exits 0 and emits terminal teardown sequences |

The TUI probe explicitly selected isolated profile storage, offline mode, no session persistence, no MCP, no project approval, and disabled ambient extensions/skills/context/templates/themes/built-in tools. Its one explicit inline extension tested a generic Bun Worker, **not the complete Tomekin SQLite Worker or `pi-ask-user`**. It did not prove reload/resume, real authentication, model switching, mutation settlement, or production packaging.

An initial Node help invocation attempted the default global settings lock, which the filesystem sandbox denied; subsequent probes explicitly used isolated profile storage. There were no user-profile writes.

The package test install and SDK harness remain in `/private/tmp/tomekin-pi-npm-1.4.0-probe` and `/private/tmp/tomekin-pi-bun-sdk-probe`. They are disposable research artifacts, not project dependencies or supported launch commands.

## Models, updates, and state compatibility

Both the pinned **0.85.1** and **1.4.0** already implement per-provider remote catalog overlays from pi.dev. They use a four-hour freshness interval and conditional revalidation; usable cached catalogs survive transient failures. Model IDs for an implemented provider can therefore become available without replacing Pi. This is not a guarantee that an old client understands new transports, authentication flows, capability fields, or model types. [0.85.1 catalog source](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/core/remote-catalog-provider.ts), [1.4.0 source](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/remote-catalog-provider.ts).

Current docs expose `pi update --models` for a forced refresh and distinguish compatible endpoint/model configuration from provider extensions for new protocols/authentication. Current executable help says bare `pi update` updates Pi; `--extensions` updates packages, while `--all` updates both. Blindly using `--all` would therefore undermine Tomekin's reviewed question-extension pin. [Models documentation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/models.md), [main command implementation](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/main.ts).

The current source also demonstrates real software-upgrade needs: 0.86 corrected Copilot GPT transport selection, and 1.0.3 added Azure Chat Completions support and renamed the Azure provider, requiring auth/settings changes. Model-catalog freshness and executable freshness must be described separately. [Changelog](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/CHANGELOG.md).

Both versions declare session format **3**, but that is insufficient as a downgrade guarantee. Newer releases add transcript-backed system/tool changes and restore active tools across resume. Current CLI `--tools` also retains MCP tools unless explicitly constrained; newer discovery controls include `--no-mcp` and `--no-approve`. These changes explain why version output alone cannot establish adapter compatibility; the accepted developer-phase policy does not require formal CLI or downgrade tests. [Session manager](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/core/session-manager.ts), [changelog](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/CHANGELOG.md), [CLI options source](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/cli/args.ts).

Executable rollback does not imply that newer-written profiles/sessions are safe for an older client. No broad upstream downgrade guarantee was found. Preserve Pi-owned authentication and conversations; a recovery design must not assume restoring old credential copies is safe or necessary.

## Distribution implications

Pi is MIT-licensed, with a requirement to preserve its copyright/permission notice in copies or substantial portions. The application would also need to account for bundled third-party notices; this research did not audit every transitive dependency's redistribution terms. [Pi license](https://github.com/earendil-works/pi/blob/v1.4.0/LICENSE).

The official standalone is an **archive with runtime assets**, not merely the `pi` executable. The build copies package metadata, README/changelog, themes, interactive assets, export templates, docs/examples, image-processing Wasm, and architecture-specific native helpers. It explicitly includes Worker entrypoints when compiling. Preserve the full expected layout unless a separately tested packaging step intentionally replaces it. [Build script](https://github.com/earendil-works/pi/blob/v1.4.0/scripts/build-binaries.sh), [asset path resolution](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/config.ts).

A terminal application can continue spawning the native Pi TUI. A future custom/graphical client can use Pi's officially documented RPC subprocess or its in-process SDK. RPC forwards supported extension dialogs, but some TUI-only capabilities are unavailable or degraded; changing presentation would therefore require separate validation of the question extension. This research selects neither an application framework nor a UI. [CLI integration](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/cli-integration.md), [RPC](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/rpc.md).

Bun's current compiler documentation supports standalone executables containing imported packages, separately bundled Worker entrypoints, and embedded assets. That supplies a plausible packaging direction for the modular route; it does not prove that Pi's dynamic resources, native helpers, extension loading, and Tomekin's database/migration assets will all package unchanged. The current documentation may also describe capabilities newer than Tomekin's pinned Bun runtime. [Bun executable documentation](https://github.com/oven-sh/bun/blob/main/docs/compiler/executables.mdx).

## Provisional assessment

For the stated preference for ordinary repository dependency management, an **exact Pi package dependency with a Bun wrapper around its modular public entrypoint** is a credible candidate. The successful native TUI/extension/Worker probe removes the original blanket objection to npm under Bun. It still needs targeted Tomekin integration validation before selection.

For the smallest runtime change, **mise acquiring the official standalone** is credible: it delegates development-tool acquisition while preserving the host architecture, and does not commit a future installed application's users to mise. Choosing between these routes should follow their focused compatibility and acquisition evidence; current research does not justify declaring either production-ready or introducing an automatic update policy.

The recommendation for discussion is to keep Pi's supported version in repository commits and prefer the **Bun-managed modular package route**, conditional on preserving the real Tomekin adapter's behavior. That best matches the requested dependency-management model and eventual application-owned runtime. If its startup/provider/resource integration requires substantial upstream-internal duplication, prefer **mise-managed standalone** instead. A later application release can ship its tested Pi runtime and upgrade it with the application, regardless of which development acquisition route is selected. This is a recommendation, not an accepted decision or a change to issue #101's specification.

Context7 was used first to resolve `/earendil-works/pi` and fetch current installation, model-catalog, and SDK guidance. Claims were checked against the versioned official source and release metadata. The mise comparison uses its official registry/documentation and the referenced aqua registry recipe. No implementation strategy or new domain term was adopted during this research.

## Authorized branch trial after the research

The subsequent user request authorized implementing a Bun/package trial on the existing branch for manual testing.
The branch now pins Pi **1.4.0** in `packages/pi/package.json` and `bun.lock`. The launcher builds the production
extension and Worker, then spawns Bun running `packages/pi/src/pi-main.ts`, which verifies the installed version and
calls the public modular `main`. It removes the standalone downloader and platform-specific artifact selection.
Pi remains responsible for the TUI, authentication, model selection, and conversations; shared Agent Tools still run
in the session's lazy Bun Worker. No Node subprocess bridge or new product-tool execution path was introduced.

The reviewed `pi-ask-user@0.15.0` is loaded from the workspace dependency's exact `index.ts` file. The launcher disables
ambient extensions, MCP, project approval, skills, contexts, prompt templates and themes, then explicitly supplies
Tomekin's skills and the two reviewed extension files. It preserves non-package Pi settings while clearing independent
Pi package acquisition. Malformed settings fail without overwrite. Existing credentials, conversations, databases, and
old standalone caches were not accessed or removed by these verification runs.

Verification on macOS arm64, Bun **1.3.14**:

- Frozen-lockfile installation succeeds; `bun run tomekin --version` reports **1.4.0**.
- All **48 Pi tests** pass, including an isolated actual SDK session loading both real extensions and the bundled
  production SQLite Worker. The new integration exercises successful lookup and calculator calls, scoped skill reads,
  denied source reads, the exact active registry, resource isolation and reload followed by another Worker lookup.
- Typecheck passes. The full default suite reports **463 passed, 1 failed**: the unchanged
  `packages/sqlite/test/candidate-checks.test.ts` source-age/readiness assertion expects no warnings for 18 October
  fixtures, but the readiness handler uses the current date and reports those sources as 14 days old. This failure
  also reproduces with that test alone; there are no changes to `packages/core` or `packages/sqlite` in this trial.
- A pseudo-terminal runs the normal `bun run tomekin` script in a temporary clone-shaped workspace with isolated
  profile/HOME, no account credentials and `PI_OFFLINE=1`. Pi displays v1.4.0, the canonical skills, and exactly the
  question and Tomekin extension entries. `/model` and `/reload` are exercised; reload completes and double Ctrl-C
  exits **0** with terminal teardown sequences. A preliminary exit check spaced Ctrl-C presses a second apart,
  outside Pi's 500 ms double-press window; the corrected check uses consecutive presses.

The first terminal probe also exposed Pi's optional native helper acquisition: its TUI checks for `fd` and `rg` and
can download missing tools independently of the package manager. `PI_OFFLINE=1` skips those downloads; merely writing
an `offline` field to settings does not set that process-wide mode. Missing helpers do not widen the model-visible
tool registry. A future offline application bundle must account for them explicitly. [Tool manager source](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/utils/tools-manager.ts),
[interactive startup](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/src/modes/interactive/interactive-mode.ts).

This establishes a runnable branch candidate, not completed issue #101 acceptance. Account-backed prompts,
authentication, question-dialog answer/cancel behavior, older-profile resume compatibility, Linux/Windows execution,
and application packaging remain unverified. The README describes the trial's current launch and version-bump contract;
no automatic updater or platform support beyond the measured host is claimed. The user's subsequent interactive
trial was reported to work well, and the user selected this integration route. That confirmation does not establish
which account, resume, or question-dialog scenarios were exercised.
