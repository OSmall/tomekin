# Drizzle for SQLite repositories

The MVP SQLite repository implementation will use Drizzle ORM. Drizzle fits the project's repository-port architecture because it provides a lightweight, TypeScript-first, SQL-oriented persistence layer without making the generated persistence model the centre of the application design.

Drizzle schema, migrations, and query code should stay inside the persistence adapter. Service inputs, service outputs, and domain types should not expose Drizzle-specific types so the core remains portable to future hosted persistence implementations.
