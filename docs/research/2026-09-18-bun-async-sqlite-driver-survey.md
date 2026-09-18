# Bun-compatible asynchronous SQLite driver survey

Date: 2026-09-18

## Question

Can Tomekin replace `bun:sqlite` with a maintained, Bun-compatible local SQLite driver that:

1. executes a long query away from the caller's JavaScript event loop;
2. can interrupt an in-flight query;
3. works under the pinned Bun 1.3.14 runtime and inside Pi's compiled standalone executable;
4. retains a practical Drizzle integration; and
5. does not introduce an external database service?

## Conclusion

No surveyed driver is presently proven to satisfy all five requirements.

`node-sqlite3` 6.0.1 is the only local driver in this survey that demonstrably both runs SQL away from Bun's caller
event loop and exposes a working `interrupt()`. It ran correctly under Bun 1.3.14 on macOS arm64, but its normal package
loader failed inside a Bun 1.3.14 compiled executable, it has no first-class Drizzle adapter, and its upstream
repository was archived as unmaintained on 2026-07-01. Those are material product and distribution risks, not minor
integration details.

The maintained Promise-shaped local alternatives tested here—Bun SQL's SQLite mode, `@libsql/client` with a local file,
and `@tursodatabase/database`—all performed the SQL synchronously on the caller's event loop. A Promise return type is
therefore not evidence of off-event-loop execution.

This leaves a Worker around the existing `bun:sqlite` adapter as a strong option, but this report does **not** adopt
that design. It establishes only that changing drivers is not currently a lower-risk route to the required behavior.

## Terminology

A local SQLite database has no database server. SQLite is a library loaded into the application process. A JavaScript
API can make it appear asynchronous only by doing at least one of the following:

- scheduling SQLite work onto a native thread pool;
- running SQLite in a JavaScript Worker or another process; or
- talking over I/O to a separate server, such as PostgreSQL, Turso/libSQL server, or Neon.

An `async` function or Promise by itself does not move native work to another thread.

## Summary matrix

| Candidate                            | Genuine off-caller-event-loop local query?                                | In-flight interruption                                                                     | Bun 1.3.14                            | Compiled standalone                                    | Drizzle                                                             | Maintenance / distribution                                                                                         |
|--------------------------------------|---------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|---------------------------------------|--------------------------------------------------------|---------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| `bun:sqlite`                         | No; synchronous API                                                       | No public `interrupt()` in 1.3.14                                                          | Built in                              | Supported directly                                     | First-class `bun-sqlite` adapter                                    | Maintained with Bun; no extra native artifact                                                                      |
| `Bun.SQL` with SQLite                | No; docs explicitly say SQLite runs synchronously beneath its Promise API | `cancel()` exists on queries, but same-loop code cannot invoke it while SQLite is blocking | Built in                              | Built-in API; expected supported                       | No direct SQLite adapter established; custom proxy remains possible | Maintained with Bun; no extra native artifact                                                                      |
| `@libsql/client` local file          | No; source calls the native statement synchronously, confirmed by probe   | No local-query interrupt API found                                                         | Works in probe                        | Works in probe                                         | First-class `libsql` adapter                                        | Maintained; native per-platform `libsql` dependency                                                                |
| `node-sqlite3` 6.0.1                 | **Yes**, confirmed by probe                                               | **Yes**, `Database.interrupt()`, confirmed by probe                                        | Works in probe                        | **Fails unmodified** in probe                          | No first-class adapter; custom proxy/repository work required       | Native N-API prebuild; upstream archived and unmaintained                                                          |
| `@tursodatabase/database` 0.7.2      | No, confirmed by probe                                                    | No interrupt/cancel API found                                                              | Loads and queries in probe            | **Fails unmodified** in probe                          | No first-class adapter found                                        | Actively developed native addon, pre-1.0; not full SQLite feature parity yet                                       |
| `better-sqlite3` 13.0.3              | No; deliberately synchronous                                              | No public interrupt API                                                                    | **Crashes Bun 1.3.14** in basic probe | Builds, then **crashes at runtime**                    | First-class adapter                                                 | Popular and actively maintained; upstream recommends Workers for slow queries                                      |
| `kysely-bun-worker`                  | Yes, by putting `bun:sqlite` in a Bun Worker                              | No per-query abort API found; the Worker can be terminated                                 | Requires Bun 1.1.14+                  | Requires deliberately packaging the Worker entry point | Kysely, not Drizzle                                                 | Actively published, but a small third-party package; validates the pattern rather than supplying a Tomekin drop-in |
| Drizzle SQLite proxy + custom Worker | Yes, if Tomekin supplies a Worker-backed async callback                   | Determined by Tomekin's Worker protocol                                                    | Plausible                             | Requires deliberately packaging the Worker entry point | First-class proxy surface, custom transport                         | Custom Tomekin architecture rather than a replacement driver                                                       |
| SQLite WASM Worker APIs              | Yes only because the application explicitly uses a Worker                 | Worker termination is possible; graceful query interruption was not established            | Not established                       | Not established                                        | No direct Tomekin-compatible adapter                                | Browser-oriented; persistent Node/Bun file use is not supported by the official package                            |
| Remote libSQL / PostgreSQL           | Yes; query runs in a server process                                       | Driver/server dependent; commonly supported                                                | Plausible, not tested here            | Plausible, not tested here                             | First-class adapters exist                                          | Requires a server/service and changes Tomekin's local/offline architecture                                         |

## Exact-runtime probes

These probes ran on macOS arm64 using the repository's pinned Bun 1.3.14. They were created in an isolated directory
under `/private/tmp`; no probe dependency or source file was added to the repository.

The event-loop test started a 10 ms interval immediately before a deliberately expensive query and counted timer
callbacks until the query completed. Zero callbacks during a query lasting more than a second is direct evidence that
the caller's event loop was blocked.

| Driver and query                                                        | Observed result                                                     |
|-------------------------------------------------------------------------|---------------------------------------------------------------------|
| `@libsql/client@0.17.4`, local `file::memory:`, recursive CTE           | 1,219 ms; **0 timer ticks**                                         |
| Bun SQL SQLite, recursive CTE                                           | 1,662 ms; **0 timer ticks**                                         |
| `@tursodatabase/database@0.7.2`, 27-million-row cross join aggregate    | 4,482 ms; **0 timer ticks**                                         |
| `sqlite3@6.0.1`, recursive CTE, `setTimeout(() => db.interrupt(), 100)` | interrupted after 101 ms with `SQLITE_INTERRUPT`; **9 timer ticks** |

Additional exact-runtime observations:

- A Bun 1.3.14 `bun:sqlite` `Database` instance had no `interrupt` method.
- Importing `node:sqlite` under Bun 1.3.14 failed with `No such built-in module: node:sqlite`.
- A compiled `@libsql/client` local-file probe ran successfully.
- A compiled `sqlite3` probe failed at startup because its `bindings` loader could not locate a module root inside
  `/$bunfs/root/...`.
- A compiled `@tursodatabase/database` probe failed because its generated loader could not locate the platform native
  binding.
- `better-sqlite3` 13.0.3 crashed Bun 1.3.14 with a fatal N-API error while opening a basic in-memory database, both
  from source and from a compiled standalone executable.
- `@tursodatabase/database` rejected the recursive CTE used by the other probes because recursive CTEs were not yet
  supported, so its blocking probe used a cross join instead.

These observations establish behavior for the exact macOS-arm64/Bun-1.3.14 target only. They do not establish
cross-platform behavior.

## Candidate details

### 1. `bun:sqlite`

**Established facts**

- Tomekin currently constructs a `bun:sqlite` `Database` and passes it to `drizzle-orm/bun-sqlite`.
- Bun presents `bun:sqlite` as a synchronous SQLite API. Bun's request to make SQLite asynchronous describes the current
  problem as SQLite blocking the main thread; that request was closed as not
  planned: [Bun issue #2326](https://github.com/oven-sh/bun/issues/2326).
- Bun 1.3.14 exposes no `Database.interrupt()` method. A separate request to expose `sqlite3_interrupt()` remained open
  during this research: [Bun issue #31014](https://github.com/oven-sh/bun/issues/31014).
- Bun documents direct `bun:sqlite` support in compiled
  executables: [Bun standalone executable SQLite documentation](https://bun.sh/docs/bundler/executables#sqlite).
- Drizzle has a first-class `bun-sqlite` adapter, which Tomekin already
  uses: [Drizzle SQLite core source and connector examples](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/sqlite-core/README.md).

**Implication**

Changing only the way Tomekin awaits a `bun:sqlite` call cannot make it nonblocking. Isolation must occur outside that
call's current event loop.

### 2. Bun SQL with a SQLite URL

**Established facts**

- Bun SQL provides a uniform Promise API for PostgreSQL, MySQL, and SQLite.
- Its documentation explicitly states that SQLite queries execute synchronously underneath that Promise
  API: [Bun SQL SQLite-specific query execution](https://bun.sh/docs/runtime/sql#query-execution).
- Drizzle's `bun-sql` adapter is documented for PostgreSQL. This survey did not establish a direct Drizzle SQLite
  adapter for Bun SQL; the generic SQLite proxy remains available for a custom transport.
- The exact-runtime probe confirmed that a 1.66-second SQLite query allowed zero interval callbacks.
- Bun SQL documents `query.cancel()`: [Bun SQL query cancellation](https://bun.sh/docs/runtime/sql#query-cancellation).

**Cancellation limitation**

The cancellation method does not solve this use case when the SQLite query and cancellation callback share one event
loop. A timer, Escape handler, or abort listener cannot call `cancel()` until the synchronous query returns. The query
object is also not a practical cross-thread control handle.

**Unknown**

This survey did not establish whether an immediate `cancel()` issued before evaluation begins has SQLite-specific
behavior. That would not provide interactive cancellation after a query has started, which is Tomekin's requirement.

### 3. `@libsql/client` with a local file

**Established facts**

- Drizzle has a first-class `libsql` adapter.
- The local client exposes Promise-returning methods and is actively maintained: [
  `libsql-client-ts`](https://github.com/tursodatabase/libsql-client-ts).
- The local client's `async execute()` directly returns `executeStmt(...)` on its native `Database`; it does not await a
  scheduling
  boundary: [local client source](https://github.com/tursodatabase/libsql-client-ts/blob/main/packages/libsql-client/src/sqlite3.ts).
- The exact-runtime probe confirmed same-event-loop behavior: 1.22 seconds and zero interval callbacks.
- The local client and its native dependency compiled and ran successfully in the Bun 1.3.14 standalone probe.

**Cancellation**

No public interrupt or per-query cancellation API was found for local execution. Closing or reconnecting the client
cannot be scheduled from the same blocked event loop while a query is running.

**Implication**

This is the most migration-friendly apparent alternative because Drizzle supports it, but it does not address Pi
responsiveness.

### 4. `node-sqlite3` / npm package `sqlite3`

**Established facts**

- The package describes itself as asynchronous and nonblocking and implements operations through N-API asynchronous
  work: [`node-sqlite3` repository](https://github.com/TryGhost/node-sqlite3).
- It exposes `Database.interrupt()`: [
  `sqlite3` type/API surface](https://github.com/TryGhost/node-sqlite3/blob/master/lib/sqlite3.d.ts).
- SQLite itself defines `sqlite3_interrupt()` to cause a running operation to return
  `SQLITE_INTERRUPT`: [SQLite C API](https://www.sqlite.org/c3ref/interrupt.html).
- Version 6.0.1 supplies a macOS-arm64 N-API prebuild: [
  `node-sqlite3` 6.0.1 release](https://github.com/TryGhost/node-sqlite3/releases/tag/v6.0.1).
- Under Bun 1.3.14, the probe kept processing timers and successfully interrupted an expensive query.
- Upstream archived the repository on 2026-07-01 and labels it deprecated and unmaintained: [
  `node-sqlite3` repository](https://github.com/TryGhost/node-sqlite3).

**Standalone distribution**

Bun supports embedding N-API `.node` files, but warns that packages using `@mapbox/node-pre-gyp`-style resolution must
require the native file
directly: [Bun N-API addon embedding](https://bun.sh/docs/bundler/executables#embed-n-api-addons). `sqlite3` normally
resolves its binary dynamically through the `bindings` package. The unmodified compiled probe therefore built but failed
at runtime while trying to discover its module root inside Bun's virtual filesystem.

A package-specific shim that directly imports the correct `.node` asset may be possible. It was not implemented or
validated here, and it would make cross-platform packaging Tomekin's responsibility.

**Drizzle integration**

Drizzle 0.45.2 has no `node-sqlite3` driver export. Its SQLite proxy adapter could potentially bridge an asynchronous
driver, but that would be custom adapter work, not a drop-in replacement. Tomekin also uses direct `bun:sqlite` prepared
statements for compiled Card Query SQL, so repository code would still require changes.

**Assessment**

This proves that the desired execution and interruption semantics are technically possible with local SQLite. It does
not provide a supportable current dependency choice without accepting an archived native dependency and custom
standalone packaging.

### 5. Maintained `node-sqlite3` successor fork

The actively maintained [`@appthreat/sqlite3` fork](https://github.com/AppThreat/node-sqlite3) continues the
asynchronous driver design and ships platform prebuilds. Its own installation guidance says to use `bun:sqlite` on Bun
because the addon requires N-API behavior that Bun 1.4 does not provide. Bun 1.3.14 is therefore not a credible target
for this fork.

This is a useful future signal, but not a present Tomekin option.

### 6. `@tursodatabase/database`

This is a newer, actively developed, in-process, SQLite-compatible database package from Turso. Its API is Promise-based
and it ships platform-native
packages: [Turso JavaScript API](https://github.com/tursodatabase/turso/blob/main/docs/javascript-api-reference.md)
and [npm package](https://www.npmjs.com/package/@tursodatabase/database).

**Established facts from the probe**

- The package loaded and executed local queries under Bun 1.3.14.
- A 4.48-second aggregate allowed zero timer callbacks, so its Promise API did not keep Bun's caller event loop
  responsive.
- The generated native-binding loader failed in a compiled Bun 1.3.14 executable.
- Recursive CTEs were not supported by the tested 0.7.2 engine.
- No public interrupt/cancel API was found in the installed JavaScript or TypeScript API.

**Drizzle and maturity**

No first-class Drizzle adapter for `@tursodatabase/database` was found. The package is pre-1.0 and advertises SQLite
compatibility rather than being a transparent replacement for every SQLite feature. Even if its standalone packaging
were solved, it does not solve event-loop blocking today.

### 7. `better-sqlite3`

`better-sqlite3` is popular, actively maintained, and supported by a first-class Drizzle adapter. It therefore warranted
a fuller evaluation than its initial summary received.

Its API is intentionally synchronous. Upstream explicitly recommends Worker threads for large or slow queries and
publishes an example Worker pool: [
`better-sqlite3` Worker documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md). It would
therefore not replace the Worker architecture under consideration; it would replace `bun:sqlite` *inside* that
architecture.

Its public API does not expose `sqlite3_interrupt()`; the longstanding request remains open: [
`better-sqlite3` issue #568](https://github.com/WiseLibs/better-sqlite3/issues/568).

Version 13 moved to N-API and says prebuilt binaries might work in runtimes such as Bun. Version 13.0.2 also fixed a
process abort associated with terminating Worker threads: [
`better-sqlite3` releases](https://github.com/WiseLibs/better-sqlite3/releases). Those changes made an exact-runtime
probe worthwhile.

Under Tomekin's pinned Bun 1.3.14 on macOS arm64, `better-sqlite3` 13.0.3 installed successfully but crashed Bun with a
fatal N-API error while constructing a basic in-memory database. A Bun standalone executable bundled successfully and
then failed with the same runtime crash. Because the driver could not execute a basic query, Worker termination behavior
was not meaningfully testable on Tomekin's runtime.

Even if a future Bun release resolves that compatibility failure, adopting `better-sqlite3` would add a native
dependency and packaging surface while retaining synchronous execution and the need for a Worker. It offers no clear
architectural advantage over keeping Bun's built-in driver inside the same Worker boundary.

### 8. SQLite WASM and `wa-sqlite`

SQLite WASM can be placed in a Worker, producing an asynchronous client-facing API. That is Worker isolation, not SQLite
query execution becoming intrinsically asynchronous.

The official SQLite WASM project is browser-focused and states that non-browser runtimes are not supported. Its npm
subproject currently limits Node support to non-persistent in-memory
databases: [SQLite WASM npm guidance](https://www.sqlite.org/wasm/doc/trunk/npm.md) and [
`sqlite-wasm` Node support](https://github.com/sqlite/sqlite-wasm#nodejs-support).

`wa-sqlite` offers synchronous and Asyncify/JSPI builds, but the asynchronous builds exist to enable asynchronous
JavaScript VFS implementations such as IndexedDB and OPFS. They do not by themselves move CPU-bound query execution off
the caller's thread: [`wa-sqlite` README](https://github.com/rhashimoto/wa-sqlite).

For Tomekin, a WASM route would therefore still require a Worker, replace native filesystem integration with a new
VFS/persistence design, and abandon the existing Drizzle/bun-sqlite adapter. It is a much larger change than running the
current native SQLite adapter in a Worker.

### 9. Existing Worker-backed ORM adapters

[`kysely-bun-worker`](https://github.com/subframe7536/kysely-sqlite-tools/tree/master/packages/dialect-bun-worker) is an
actively published Kysely dialect which runs `bun:sqlite` in a Bun Worker. Its executor still calls synchronous
`Statement.all()` and `Statement.run()`; responsiveness comes from the Worker boundary. It requires Kysely rather than
Drizzle and exposes no per-query abort signal in its public configuration. It is therefore evidence that the Bun
ecosystem uses Worker isolation for this requirement, not a Tomekin-compatible driver replacement.

Drizzle's [`sqlite-proxy`](https://orm.drizzle.team/docs/connect-drizzle-proxy) accepts an asynchronous callback for
executing generated SQL, so Tomekin could connect Drizzle to a custom Worker RPC layer. The proxy implements async
transactions as separate `BEGIN`, statement, and `COMMIT`/`ROLLBACK` callback calls. That can work with a serialized,
connection-affine Worker protocol, but Tomekin would own the protocol, cancellation rules, transaction ordering, result
serialization, logging, and lifecycle. Card Query also uses `db.$client` directly today, so it would still need adapter
work.

This database-level seam is narrower than moving all Agent Tool execution, but it leaves JavaScript result hydration and
other tool CPU work on Pi's event loop. It would also either affect high-volume CLI imports or create a second database
access path used only by interactive harnesses.

Bun documents Workers as separate JavaScript instances on separate threads and supports forceful
`worker.terminate()`: [Bun Workers](https://bun.sh/docs/runtime/workers). Tomekin's Pi extension is emitted as a
standalone ESM bundle rather than compiled into Pi, so a Worker entry point would need to be emitted and staged
alongside that bundle deliberately.

### 10. Remote libSQL, PostgreSQL, or a hosted service

A remote database client waits on network I/O while a server process executes SQL, so it naturally frees Pi's event
loop. Drizzle supports relevant remote adapters.

That is not a local SQLite driver solution. It introduces provisioning, credentials, connectivity, latency, schema
deployment, and an external authority. It may be valid for a future product architecture, but it does not preserve
Tomekin's current self-contained, offline-capable shape.

## What is known versus still unknown

### Known

- The current freeze is avoidable without abandoning SQLite; `node-sqlite3` proves this by using native asynchronous
  work.
- Bun's maintained local SQLite APIs do not currently provide that behavior.
- A Promise-shaped API is insufficient; both Bun SQL SQLite and local libSQL block.
- `node-sqlite3` is not a clean production candidate because it is archived and its standard loader fails in the
  required standalone runtime.
- The official SQLite WASM distributions do not provide a supported persistent Bun filesystem solution.

### Unknown and worth prototyping only if driver replacement remains attractive

- Whether a deliberate direct-native-addon shim can make `sqlite3` 6.0.1 reliable in Pi's exact compiled binary across
  every supported platform.
- Whether Tomekin is willing to own that packaging after the dependency's upstream archival.
- Whether a custom Drizzle SQLite proxy can preserve all transaction, migration, logging, and Card Query semantics
  without effectively becoming a second persistence adapter.
- Whether a future Bun release will add asynchronous `bun:sqlite`, expose `sqlite3_interrupt()`, or make a maintained
  N-API async driver viable. Pi is pinned to Bun 1.3.14 today, so future-runtime features do not resolve issue #63.
- Whether Tomekin's result hydration and serialization remain expensive enough to require isolation even after SQL
  execution moves off-thread. An async driver frees the event loop during SQLite execution, but JavaScript-side
  transformation still runs on Pi's event loop unless separately isolated.

## Decision implication, not a decision

The driver survey does not produce a maintained drop-in asynchronous SQLite driver for Tomekin's actual runtime and
distribution constraints.

The remaining credible directions are therefore:

1. keep `bun:sqlite` and isolate whole Agent Tool executions in a Worker;
2. accept the risks of an archived `node-sqlite3` dependency plus custom Drizzle and standalone packaging work; or
3. change the product boundary to a client/server database.

Option 1 now has a stronger evidence base than before this survey: it supplies the same essential scheduling boundary
that a native asynchronous driver would supply, while retaining the existing supported database, repositories,
migrations, and standalone packaging. Cancellation semantics still need an explicit read/write policy because
`bun:sqlite` itself remains non-interruptible.

No implementation choice is adopted by this research note.
