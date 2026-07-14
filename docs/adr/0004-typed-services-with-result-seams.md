# Typed services with Result seams

The portable core will expose typed application-service functions rather than MCP-shaped APIs, opencode-specific tools, or classes-first orchestration objects. Edge adapters such as opencode tools, future MCP servers, HTTP handlers, or background jobs should call these services and translate their results into adapter-specific responses.

Service seams should use `neverthrow` Result types for expected business errors so failures can be propagated and handled explicitly without throwing across adapter boundaries. Zod schemas should be used with these seams to validate runtime data and keep tool, API, and persistence inputs aligned with the TypeScript types.

An `Ok` result means the called operation completed successfully and the caller is on the happy path. If a result would contain a status such as `failed`, reconsider whether that state belongs on the error side instead. `Err` is for expected business errors that a consumer can handle by retrying, changing inputs, choosing a different method, recording a failed attempt, or bubbling a useful message to the user; unhandleable failures such as database connection loss, process resource exhaustion, or programming panics may throw normally rather than being forced into Result types.
