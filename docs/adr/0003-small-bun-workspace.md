# Small Bun workspace

The repository will use a small Bun workspace from the start, with separate packages for the portable core and the local opencode adapter. This keeps the product logic independent from the first delivery surface without introducing a large monorepo structure before the project needs it.

Starting with workspace boundaries is preferable to a single package because the core must remain reusable by a later web-based, multi-user hosted product, while opencode-specific tools, agents, and skills should stay adapter code.
