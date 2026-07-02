# SQL-backed Card Query repository

The SQLite `CardQueryRepository` will replace its current in-memory evaluator with a SQL-backed implementation while
keeping the public Card Query tool shape and documented feature set stable. Supported filtering, sorting, limiting, and
Collection quantity aggregation should be pushed into SQLite through a bounded SQL compiler inside the SQLite adapter,
with TypeScript limited to assembling already-constrained rows into the result shape. This deliberately uses
adapter-local raw SQL fragments rather than forcing a dynamic expression tree through Drizzle's fluent API; the detailed
implementation handoff lives in `docs/plans/sql-backed-card-query-repository.md`, and accidental behaviour from the old
evaluator should not define the replacement.
