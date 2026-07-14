# Clone-based alpha distribution

The `alpha1.0.0` public release will target GitHub clone-based usage rather than npm publishing or an installer. Users
are expected to clone the repository, install Bun dependencies, apply SQLite migrations, sync/import Scryfall reference
data, import a ManaBox Collection export, open opencode, and interact with the local deck-building agent.

This distribution model is intentionally not the long-term ideal, but it matches the current product maturity. The local
opencode adapter, SQLite persistence, Scryfall import workflow, logging, and documentation need real user feedback
before becoming a stable install contract.

The release should not add `SECURITY.md`, `CONTRIBUTING.md`, or a license file until the owner chooses those policies
explicitly. It should also not prepare npm package metadata or public package exports beyond what the current workspace
needs for local development.

Future packaging may introduce a small CLI with commands such as `init`, `sync-scryfall`, `import manabox`, and
`doctor`, plus an easier opencode integration path. That future packaging should preserve the existing portable core and
adapter boundaries rather than turning clone-local scripts into permanent product architecture.
