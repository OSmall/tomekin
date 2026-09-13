# Pi released Bun TUI and extension path

**Question.** Can Tomekin run Pi's supported interactive terminal UI from a Bun-hosted adapter, with a question
extension and without importing that extension's bundled methodology skill?

## Decision

**Go, subject to an adapter spike using Pi's standalone release binary.** Pi publishes and release-tests a Bun-compiled
terminal executable. Tomekin should launch that executable as a child process; it should **not** run the npm package
through `bunx --bun`.

`bunx --bun @earendil-works/pi-coding-agent@0.85.1 --help` is the exact command that previously failed on this macOS
arm64 host (Bun 1.3.14):

```text
TypeError: webidl.util.markAsUncloneable is not a function
```

The exception occurs in the npm CLI's bundled Undici CacheStorage initialisation, before CLI/TUI startup. That npm
package declares `pi` as `dist/bundle/cli.js` and an engine of Node 22.19+, whereas Pi's release workflow separately
compiles `dist/bun/cli.js` with Bun. It is therefore the wrong artifact for judging Pi's Bun TUI
compatibility. [Pi npm manifest](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/package.json), [Bun binary build script](https://github.com/earendil-works/pi/blob/v0.85.1/scripts/build-binaries.sh#L117-L157).

Pi upstream treats the compiled Bun binary as a supported release surface: its release workflow pins Bun 1.3.14,
compiles the native binaries, and smoke-tests `--help` and `--version` on macOS, Linux, and Windows. The project's
release checklist additionally includes starting the Bun interactive
TUI. [Release workflow](https://github.com/earendil-works/pi/blob/v0.85.1/.github/workflows/build-binaries.yml#L35-L208), [upstream release checklist](https://github.com/earendil-works/pi/blob/c1d4c801114545f47c440921d8b3e04aeb1e565d/AGENTS.md#L133-L152).

## Release artifact verified locally

The current released version was **v0.85.1** (published 2026-09-05). I downloaded the official macOS arm64 archive,
`pi-darwin-arm64.tar.gz`, and verified its SHA-256:

```text
d5f70e3c0cf7398eac239fd0261ee074d98b7ba7f6b43fe3617f052ed5b79d06
```

It matches both the release `SHA256SUMS` asset and GitHub's release-asset digest. The archive is a standalone compiled
Pi binary plus its runtime assets. It is pin-able by release tag and checksum:

```text
https://github.com/earendil-works/pi/releases/download/v0.85.1/pi-darwin-arm64.tar.gz
https://github.com/earendil-works/pi/releases/download/v0.85.1/SHA256SUMS
```

[v0.85.1 release assets](https://github.com/earendil-works/pi/releases/tag/v0.85.1), [release publication workflow, including checksum creation](https://github.com/earendil-works/pi/blob/v0.85.1/.github/workflows/build-binaries.yml#L88-L126).

On this host, the verified executable returned `0.85.1` for `--version` and rendered its full `--help` successfully. A
pseudo-terminal launch entered the regular Pi TUI and rendered its header, editor/status region, keyboard help, and the
expected unauthenticated warning (`No models available. Use /login …`). Sending Ctrl-C exited it. Thus the actual
supported artifact starts interactively without credentials.

Its safe unauthenticated one-shot probe also entered normal startup and then exited 1 with the expected
`No API key found for the selected model` message. A real prompt/answer exchange remains untested because it needs a
user-authenticated provider; it is a separate adapter acceptance test, not a compatibility failure.

## Extension and authority isolation

Pi's official extension API explicitly supports terminal interaction with `ctx.ui.select`, `ctx.ui.confirm`,
`ctx.ui.input`, and custom TUI components. An extension loaded with `--extension` can register a model-callable tool, so
a Pi question tool is feasible in the interactive
TUI. [Pi extensions documentation](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/extensions.md#L1-L37).

The extension is not authority-neutral: extensions execute with full system permissions and bundled skills can instruct
the model. Pi packages therefore need an explicit resource filter. In settings, name the intended extension resource and
set `skills: []`; omitting `skills` loads all package
skills. [Package filtering](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/packages.md#L188-L211), [package security warning](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/packages.md#L13-L18).

I verified this distinction in an isolated `PI_CODING_AGENT_DIR` using a temporary package with one extension and one
deliberately detectable skill:

- Direct `--extension <package-directory> --no-skills` **still loaded** the package's declared skill. Pi treats
  explicitly supplied package resources as intentional; `--no-skills` only suppresses discovered resources.
- A settings package entry with `extensions: ["index.ts"]` and `skills: []` loaded the extension command but produced a
  system prompt with no `available_skills` block and no detectable package skill.

The launch profile must therefore use package filtering, not rely on `--no-skills`, when loading `pi-ask-user` or any
package that carries a methodology skill. The standard Pi tools remain present unless separately constrained with
`--tools`, `--exclude-tools`, `--no-tools`, or `--no-builtin-tools`; these options apply to built-in and extension
tools. [Pi CLI options](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/src/cli/args.ts#L297-L307).

## Remediation and next decision

Replace the disproven `bunx --bun` launcher assumption with a pinned, checksum-verified standalone Pi binary per
platform. Have Bun spawn it in a pseudo-terminal with a controlled Pi config directory and a filtered package resource
entry selecting only the question extension. The next spike should authenticate a test provider under a user-controlled
Pi profile and prove: question shown, answer returned to the agent, cancel/interrupt semantics, session shutdown, and
zero bundled skills.

## Sources and method

Context7 was queried first with `/earendil-works/pi` for Pi's official installation, TUI, extensions, skills, and
package filtering documentation. Primary-source validation then used the linked Pi source/release artifacts only. Local
probes used temporary directories under `/private/tmp`; no Tomekin dependency, configuration, or source file was
changed.
