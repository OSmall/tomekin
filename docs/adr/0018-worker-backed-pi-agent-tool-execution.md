# Worker-backed Pi Agent Tool execution

Pi remains responsive by dispatching all shared Tomekin Agent Tool execution to one lazily created, session-scoped Bun
Worker rather than running the SQLite-backed runtime in Pi's event loop. The Worker owns its runtime and connection,
executes one request at a time, performs result projection, and is recreated after a terminated or failed generation;
this preserves the existing Drizzle and `bun:sqlite` paths for the portable core and CLI while isolating synchronous
queries and result work from the TUI.

Read-only tools may be cancelled by terminating their Worker, but a dispatched mutation must settle and is never
reported as cancelled. The direct create/edit replacement and explicit check tools are classified as mutations; session shutdown waits for
dispatched mutations to settle. If their Worker exits unexpectedly, Tomekin reports an unknown outcome and the agent verifies through existing Deck Candidate reads rather than assuming either
rollback or commit. Pi-local `read` and Pi-owned `ask_user` remain outside this shared-tool Worker boundary.
