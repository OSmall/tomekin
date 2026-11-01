---
status: accepted
---

# Bun-managed Pi through its public modular entrypoint

Manage Pi as an exact workspace package dependency with Bun's lockfile, and launch its public modular `main` in a Bun
child that owns the native TUI and hosts Tomekin's restricted extension. The published npm CLI bundle fails under the
project's Bun runtime, but the public modular entrypoint passes actual TUI, extension, and production SQLite Worker
checks and the user's interactive trial; this replaces custom standalone artifact acquisition without introducing a
Node-to-Bun bridge or changing the Worker execution and mutation-settlement boundary in [ADR 0018](0018-worker-backed-pi-agent-tool-execution.md).
Pi is the developer-facing Agent Harness Adapter for the current clone-based phase. Upgrade it through ordinary
reviewed dependency changes in Tomekin commits; normal launch uses the installed pinned version, with no independent
Tomekin updater. Model catalog refresh, model/provider support, and provider authentication remain Pi concerns.
Preserve existing user state during normal upgrades, but provide no downgrade or cross-version profile/session
compatibility guarantee in this developer phase; recovery from a deliberate downgrade is the operator's responsibility.
The developer currently uses macOS arm64; portable code does not establish Windows/Linux support. Retain automated
tests of Tomekin's tool, Worker, and adapter contracts, but require neither automated integrated-CLI launch tests nor a
formal manual terminal smoke test for dependency upgrades in this phase. Normal developer use supplies terminal
feedback. Pi also owns acquisition and behavior of its optional `fd`/`rg` terminal helpers; Tomekin adds no separate
helper manager.

The longer-term product direction is a hosted website with an embedded chatbot and user accounts. This decision does
not require bundling Pi into that product or choose its future interface, account, or hosting architecture.
See the [dated comparison and probes](../research/2026-11-01-pi-dependency-management-options.md) for the standalone/mise
alternatives and the distinction between modular and bundled CLI entrypoints.
