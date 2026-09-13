# Pi ask-user extension boundary

**Question.** Can `pi-ask-user@0.15.0` supply Tomekin's user-decision boundary when Pi is introduced as the local
adapter?

**Investigated:** 2026-09-07. This is package/runtime evidence, not a decision to add the dependency or change the
product's confirmation contracts.

## Result

**Do not use it as Tomekin's current ask-user solution.** The exact published package is a terminal-UI extension for a
Pi CLI host, not a substitute for Tomekin's application-level ask-user boundary. It registers one Pi tool, `ask_user`,
and a bundled decision-gating skill. It blocks its own tool execution until an answer, collects the response through
Pi's `ctx.ui` terminal APIs, and returns the answer in Pi tool-result `details`.

That makes it a possible future fit only if the supported adapter runs an interactive Pi terminal with the package
loader enabled. It does **not** expose an SDK-level prompt callback or a generic UI protocol that Tomekin can drive from
its own client. In a no-UI context it returns an error asking for interactive mode; Pi SDK session construction alone
does not establish that UI or load third-party packages. Moreover, the actual Pi CLI `0.85.1` failed before showing help
under this workspace's Bun `1.3.14` (details below), so its terminal path is not currently established here. Therefore
an eventual Pi adapter must either:

1. treat this as an optional CLI enhancement, with Tomekin owning a separate confirmation/input transport for every
   supported client; or
2. explicitly narrow the supported Pi surface to the interactive Pi CLI and prove package loading plus end-to-end
   prompting there.

Do not make the package's bundled `ask-user` skill the product's sole enforcement mechanism: it is prompt methodology,
while the product's Brief/persistence confirmations remain application contracts.

## Exact published artifact

The npm registry describes `pi-ask-user@0.15.0` as an ESM Pi extension, published 2026-09-02. Its integrity is
`sha512-wmgcHUSGptAS+u+9AT4Fbjxo+iclOXERDym9m/VeX7pDcVs5vwloSKP+BcQ96beuxMEVEhFVydPkXzoYmIvpVQ==`, its SHA-1 is
`a7c9af73ab72d55e148ae5ceaee857b858d6ed84`, and it contains seven files.

The manifest declares:

```json
{
  "pi": { "extensions": ["./index.ts"], "skills": ["./skills"] },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": ">=0.74.0",
    "@earendil-works/pi-tui": ">=0.74.0",
    "@sinclair/typebox": "*"
  }
}
```

There are no production dependencies, commands, or resources declarations. The seven packed files are `LICENSE`,
`README.md`, `index.ts`, `single-select-layout.ts`, `package.json`, `skills/ask-user/SKILL.md`, and
`skills/ask-user/references/ask-user-skill-extension-spec.md`. In particular, it brings no cards, database access,
network client, product tools, or external process launcher.

## The actual extension contract

`index.ts` default-exports `function(pi: ExtensionAPI)` and calls `pi.registerTool` once. The registration is for
`ask_user`, has `executionMode: "sequential"`, and accepts:

- required `question`;
- optional `context`, structured `options`, `allowMultiple`, `allowFreeform`, `allowComment`, `displayMode`,
  `singleSelectLayout`, `contextExpanded`, `overlayToggleKey`, `commentToggleKey`, and `timeout`.

The implementation calls only Pi's extension/UI/event surface and Pi TUI primitives. It uses `ctx.ui.custom` for the
rich terminal interface, falls back to `ctx.ui.select`/`ctx.ui.input` for RPC/headless UI mode, and emits
`herdr:blocked`, `ask:answered`, and `ask:cancelled` through `pi.events`. The default event payload intentionally omits
selections/freeform text; the complete response is instead in the tool result's structured `details` (unless an opt-in
environment variable enables full event payloads).

The decisive negative path is explicit: when `!ctx.hasUI || !ctx.ui`, the tool returns `isError: true`,
`cancelled: true`, and text beginning `Ask requires interactive mode. Please answer:`. It does not pause for, receive,
or relay an answer through a non-Pi host.

The only non-Pi platform import is `node:module`'s `createRequire`, used to read the package version from adjacent
`package.json`. No Node-engine field is declared by this package; that is not a claim that the peer Pi runtime itself
officially supports Bun.

## Bundled skill and resource scope

The package's `pi.skills` declaration exposes exactly one `ask-user` skill and one adjacent reference. The skill says to
call `ask_user` before high-stakes architectural decisions, irreversible changes, or material ambiguity, and specifies a
one-question evidence → summary → question → commit handshake. The reference gives a trigger matrix and a maximum of two
attempts per decision.

This is agent-facing instruction, not a guard at Tomekin's persistence, schema, or tool boundary. A model can still fail
to follow it, and a non-Pi consumer will not discover it merely by constructing a Pi SDK session. Preserve deterministic
product confirmations independently.

## Bun probe

On this workspace's Bun `1.3.14`, an isolated temporary project installed the exact packed local `pi-ask-user@0.15.0`
plus the existing Pi investigation's peer set: `@earendil-works/pi-coding-agent@0.85.1`,
`@earendil-works/pi-tui@0.85.1`, and `@sinclair/typebox@0.34.41`. The following exited 0:

```sh
bun -e 'const mod = await import("pi-ask-user"); const calls=[]; mod.default({ registerTool: (tool) => calls.push({name:tool.name, executionMode:tool.executionMode, parameterKeys:Object.keys(tool.parameters.properties), hasExecute:typeof tool.execute === "function"}), events:{emit(){}} }); console.log(JSON.stringify(calls));'
```

Output:

```json
[{"name":"ask_user","executionMode":"sequential","parameterKeys":["question","context","options","allowMultiple","allowFreeform","allowComment","displayMode","singleSelectLayout","contextExpanded","overlayToggleKey","commentToggleKey","timeout"],"hasExecute":true}]
```

This proves Bun can import the published TypeScript extension and invoke its registration function against its declared
peers. It does **not** prove Pi's CLI package installer/loader under Bun, a live terminal prompt, an RPC client, or a
Tomekin UI bridge.

The smallest available CLI check failed:

```sh
bunx --bun @earendil-works/pi-coding-agent@0.85.1 --help
```

It exited non-zero before printing help with `TypeError: webidl.util.markAsUncloneable is not a function` from Pi's
bundled `undici` cache-storage initialisation (Bun `1.3.14`, macOS arm64). This does not contradict the earlier
successful in-process SDK session probe: the CLI bundle exercises a broader runtime surface. It does mean that
installing this package cannot presently provide a Bun-hosted Pi terminal ask-user path without first resolving or
upgrading that Pi/Bun CLI incompatibility.

## Evidence and reproducible commands

1. Registry metadata: `npm view pi-ask-user@0.15.0 --json` returned the version, `pi` manifest fields, peers, seven-file
   count, integrity, tarball URL, and publisher repository below.
2. Exact artifact: `npm pack pi-ask-user@0.15.0 --pack-destination <temporary-directory>` reported the seven files and
   the same integrity/SHA-1; extracting it supplied the source inspected above.
3. Publisher tag: `git ls-remote --tags https://github.com/edlsh/pi-ask-user.git v0.15.0` returned commit
   `2a1c4a916303770b33229493e670faeea5f02612` for `refs/tags/v0.15.0`.
4. The Bun registration probe and the unsuccessful Pi CLI probe are shown above. They used only isolated temporary
   directories and did not alter the repository's dependencies or product code.

## Primary sources

- [npm registry metadata for pi-ask-user 0.15.0](https://registry.npmjs.org/pi-ask-user/0.15.0)
- [Published tarball for pi-ask-user 0.15.0](https://registry.npmjs.org/pi-ask-user/-/pi-ask-user-0.15.0.tgz)
- [Publisher's v0.15.0 manifest](https://github.com/edlsh/pi-ask-user/blob/v0.15.0/package.json)
- [Publisher's v0.15.0 extension implementation](https://github.com/edlsh/pi-ask-user/blob/v0.15.0/index.ts)
- [Publisher's v0.15.0 bundled ask-user skill](https://github.com/edlsh/pi-ask-user/blob/v0.15.0/skills/ask-user/SKILL.md)
- [Publisher's v0.15.0 skill/extension interaction specification](https://github.com/edlsh/pi-ask-user/blob/v0.15.0/skills/ask-user/references/ask-user-skill-extension-spec.md)
- [Pi extension package installation documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
