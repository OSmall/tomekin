# Pi / Bun compatibility findings

**Question.** Can Pi run in Tomekin's Bun-hosted local process, together with its portable core and SQLite adapter,
without a Node sidecar?

**Investigated:** 2026-09-07. This note records runtime/package evidence only; it does not choose Card Query policy or
change the portable-core/SQLite seams.

## Result

**Conditional go for an in-process Bun adapter.** The exact current Pi SDK package constructed an in-memory session
under the repository's Bun runtime while `bun:sqlite`, `@tomekin/core`, and `@tomekin/sqlite` loaded in the same
process. A Node sidecar is therefore not justified by the evidence collected.

This is compatibility evidence, not a promise of Bun as Pi's officially supported execution runtime: Pi publishes a Node
engine floor and its normal SDK documentation describes Node.js. Keep a small Bun integration probe in the eventual
adapter test suite, pin the top-level Pi SDK plus lockfile, and stop for a sidecar decision only if a required
production flow demonstrably fails under Bun.

## Versioned evidence

| Component                          | Evidence as investigated                                                                                                                                                                                                                                       | Implication                                                                                                                                                                |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Tomekin runtime                    | `bun --version` reported **1.3.14**; the root workspace pins `@types/bun` 1.3.14.                                                                                                                                                                              | The probe represents the present local runtime.                                                                                                                            |
| Node available to this environment | `node --version` reported **v26.4.0**.                                                                                                                                                                                                                         | It exceeds Pi's declared `>=22.19.0` floor. This does not turn Pi's Node declaration into a Bun guarantee.                                                                 |
| Pi SDK                             | npm registry metadata reports **`@earendil-works/pi-coding-agent@0.85.1`**, `engines.node: >=22.19.0`, no Bun engine, and the `pi` executable at `dist/bundle/cli.js`. Its runtime dependencies include `pi-ai`, `pi-agent-core`, and `pi-tui` with `^0.85.1`. | Use `@earendil-works/pi-coding-agent` as the adapter dependency, initially pinned to `0.85.1` with a committed lockfile rather than adding its internal packages directly. |
| Pi subpackages actually resolved   | An isolated Bun lock resolved `pi-ai`, `pi-agent-core`, `pi-tui`, and `chord` all to **0.85.1**.                                                                                                                                                               | The tested dependency graph was internally version-aligned.                                                                                                                |
| Bun capabilities                   | Bun documents Node/npm package compatibility and `bun:sqlite`; its SQLite API supports `new Database(\":memory:\")`, `run`, and `query`.                                                                                                                       | Pi and the current SQLite adapter can share one Bun process; this is not a second persistence path.                                                                        |

Pi's first-party installation guide explicitly includes `bun add -g --ignore-scripts @earendil-works/pi-coding-agent`,
and the source also includes a Bun-compiled CLI entry point. Those are meaningful Bun signals. They are narrower than a
declared Bun execution support policy, so the recommendation remains conditional.

## Minimal runnable probe

An isolated temporary directory installed only `@earendil-works/pi-coding-agent@0.85.1` with Bun 1.3.14. Install
reported two blocked, unrelated lifecycle scripts (`@google/genai` preinstall and `protobufjs` postinstall); no trust
override was used. The following command exited 0:

```sh
bun -e 'const pi = await import("@earendil-works/pi-coding-agent"); const { Database } = await import("bun:sqlite"); const core = await import("/Users/osmall/code/tomekin/packages/core/src/index.ts"); const sqlite = await import("/Users/osmall/code/tomekin/packages/sqlite/src/index.ts"); const db = new Database(":memory:"); db.run("select 1"); const modelRuntime = await pi.ModelRuntime.create(); const outcome = await pi.createAgentSession({ modelRuntime, sessionManager: pi.SessionManager.inMemory(), tools: [] }); console.log(JSON.stringify({ piExports: ["createAgentSession", "ModelRuntime", "SessionManager"].every((key) => key in pi), coreExports: Object.keys(core).length, sqliteExports: Object.keys(sqlite).length, sqlite: db.query("select 1 as ok").get(), session: Boolean(outcome.session) }));'
```

Output:

```json
{"piExports":true,"coreExports":109,"sqliteExports":29,"sqlite":{"ok":1},"session":true}
```

The probe creates no model request and uses Pi's in-memory session manager. It verifies import/linkage and session
construction, not provider authentication, tool execution, terminal rendering, or a production conversation.

## Seam and next verification

The adapter should own Pi session construction and translate only between Pi tools/events and existing core Agent Tool
contracts. It must not import Pi from `packages/core` or add `bun:sqlite` access to Pi-facing code: `packages/sqlite`
remains the existing implementation of the core repository ports. Before implementation is accepted, rerun the probe
from an installed workspace dependency and add an adapter-level test for the intended tool/event bridge. Test a real
configured-provider prompt separately, since it needs credentials and exercises a different boundary.

## Primary sources

- [Pi coding-agent 0.85.1 npm registry metadata](https://registry.npmjs.org/@earendil-works/pi-coding-agent/0.85.1)
- [Pi AI 0.85.1 npm registry metadata](https://registry.npmjs.org/@earendil-works/pi-ai/0.85.1)
- [Pi SDK session examples](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/README.md)
- [Pi coding-agent package manifest](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/package.json)
- [Pi installation documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/index.md)
- [Pi Bun CLI entry point](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/bun/cli.ts)
- [Bun Node.js compatibility documentation](https://bun.com/docs/runtime/nodejs-compat)
- [Bun SQLite documentation](https://bun.com/docs/runtime/sqlite)
