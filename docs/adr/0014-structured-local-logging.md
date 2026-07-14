# Structured local logging

The alpha release will use Pino as the first-class local logging API. Logs are human-readable by default in development,
with production defaulting to structured JSON records for machine parsing.

Pino is chosen over broader transport-oriented alternatives because this project needs efficient high-volume structured
logs for local agent-tool calls, SQL queries, imports, and sync activity, while preserving a clean path to later cloud
logging. Pino's JSON-first model, child loggers, redaction support, TypeScript types, and low overhead fit that shape.
Winston remains a reasonable future option if the app later needs in-process fan-out to many logging backends, but the
alpha should prefer emitting stable structured events cheaply and letting infrastructure route them later.

Logging configuration is resolved once at composition roots and tests. Those boundaries create one root Pino logger and
pass it as a dependency. Lower-level modules create contextual child loggers with fields such as `component`,
`databasePath`, `command`, and `toolName`; lower-level modules must not read logging environment variables.

The first implementation uses `NODE_ENV` profile defaults. `development` is the default profile and logs at debug level
because this is a local alpha and diagnostic visibility matters. `production` defaults to info-level JSON on `stdout`.
`test` defaults to info-level pretty logs on `stderr` so project logs do not pollute CLI stdout assertions or append to
the developer's local log file. Full tool payloads, tool outputs, SQL query text, and SQL parameters are debug-level
detail and therefore excluded from production and default test logs. SQL query text and parameters should be logged at
the SQLite adapter boundary, including Drizzle queries and direct prepared statements where Drizzle cannot observe them.

Logging is configured through environment variables resolved once at application and test boundaries. `NODE_ENV=test`
selects test defaults, `NODE_ENV=production` selects production defaults, and any other value selects development
defaults. Logging-specific overrides are `TOMEKIN_LOG_ENABLED=true|false`,
`TOMEKIN_LOG_DESTINATION=file|stdout|stderr`, `TOMEKIN_LOG_FILE`,
`TOMEKIN_LOG_LEVEL=trace|debug|info|warn|error`, and `TOMEKIN_LOG_FORMAT=pretty|json`. Invalid values fail fast
during config resolution. `TOMEKIN_LOG_ENABLED=false` wins over every other log setting and uses Pino's silent logging
level.

The profile defaults are:

| Profile       | Enabled | Destination | File                  | Level   | Format   |
|---------------|---------|-------------|-----------------------|---------|----------|
| `development` | `true`  | `file`      | `.data/tomekin.log` | `debug` | `pretty` |
| `production`  | `true`  | `stdout`    | `.data/tomekin.log` | `info`  | `json`   |
| `test`        | `true`  | `stderr`    | `.data/tomekin.log` | `info`  | `pretty` |

Log records should expose project-level concepts such as component, operation, status, duration, database path, source
URI, bulk data type, tool name, and error details as structured fields.
