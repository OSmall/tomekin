# Typed services with Result seams

The portable core will expose typed application-service functions rather than MCP-shaped APIs, opencode-specific tools, or classes-first orchestration objects. Edge adapters such as opencode tools, future MCP servers, HTTP handlers, or background jobs should call these services and translate their results into adapter-specific responses.

Service seams should use `neverthrow` Result types for expected business errors so failures can be propagated and handled explicitly without throwing across adapter boundaries. Zod schemas should be used with these seams to validate runtime data and keep tool, API, and persistence inputs aligned with the TypeScript types.
