# Structured local logging

The alpha release will use Pino for structured local file logging, wrapped behind a small project logging boundary so
core and adapter code are not coupled directly to Pino APIs. Logs will be JSON records written locally by default, with
environment-controlled level and destination.

Pino is chosen over broader transport-oriented alternatives because this project needs efficient high-volume structured
logs for local agent-tool calls, SQL queries, imports, and sync activity, while preserving a clean path to later cloud
logging. Pino's JSON-first model, child loggers, redaction support, TypeScript types, and low overhead fit that shape.
Winston remains a reasonable future option if the app later needs in-process fan-out to many logging backends, but the
alpha should prefer emitting stable structured events cheaply and letting infrastructure route them later.

The first implementation should log basic operational events by default and reserve full tool payloads, tool outputs,
and other potentially large or sensitive details for debug or trace level. SQL query text and parameters should be
logged at the SQLite adapter boundary, including Drizzle queries and direct prepared statements where Drizzle cannot
observe them.

The logging boundary should expose project-level concepts such as component, operation, status, duration, database path,
source URI, bulk data type, tool name, and error details rather than leaking Pino-specific logger construction
throughout product code.
