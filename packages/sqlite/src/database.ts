import {Database} from "bun:sqlite";
import {drizzle} from "drizzle-orm/bun-sqlite";
import {sql} from "drizzle-orm";
import type {LogComponent, Logger} from "@tomekin/core";

import * as schema from "./schema";

export const defaultDatabasePath = ".data/tomekin.sqlite";

export function resolveDatabasePath(env = process.env): string {
  return env.TOMEKIN_DB_PATH?.trim() || defaultDatabasePath;
}

export function openDatabase(path: string, options: { readonly log: Logger }) {
  const client = new Database(path);
  const sqliteLogger = options.log.child({component: "sqlite" satisfies LogComponent, databasePath: path});
  instrumentPreparedStatements(client, sqliteLogger);
  const db = drizzle({
    client,
    schema,
    logger: {
      logQuery(query: string, params: unknown[]) {
        sqliteLogger.debug({operation: "drizzle_query", query, params}, "SQLite query executed by Drizzle");
      },
    },
  });
  sqliteLogger.info({operation: "open_database", databasePath: path}, "SQLite database opened");
  db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

export type TomekinDatabase = ReturnType<typeof openDatabase>;

export function closeDatabase(db: TomekinDatabase): void {
  db.$client.close();
}

type PreparedStatement = ReturnType<Database["prepare"]>;

function instrumentPreparedStatements(client: Database, logger: Logger): void {
  const prepare = client.prepare.bind(client);
  client.prepare = ((query: string) => {
    const statement = prepare(query);
    return instrumentStatement(statement, query, logger);
  }) as Database["prepare"];
}

function instrumentStatement(statement: PreparedStatement, query: string, logger: Logger): PreparedStatement {
  const originalRun = statement.run.bind(statement);
  statement.run = ((...params: Parameters<PreparedStatement["run"]>) => {
    logger.debug({operation: "prepared_statement_run", query, params}, "SQLite prepared statement run");
    return originalRun(...params);
  }) as PreparedStatement["run"];

  const originalAll = statement.all.bind(statement);
  statement.all = ((...params: Parameters<PreparedStatement["all"]>) => {
    logger.debug({operation: "prepared_statement_all", query, params}, "SQLite prepared statement all");
    return originalAll(...params);
  }) as PreparedStatement["all"];

  const originalGet = statement.get.bind(statement);
  statement.get = ((...params: Parameters<PreparedStatement["get"]>) => {
    logger.debug({operation: "prepared_statement_get", query, params}, "SQLite prepared statement get");
    return originalGet(...params);
  }) as PreparedStatement["get"];

  const originalValues = statement.values.bind(statement);
  statement.values = ((...params: Parameters<PreparedStatement["values"]>) => {
    logger.debug({operation: "prepared_statement_values", query, params}, "SQLite prepared statement values");
    return originalValues(...params);
  }) as PreparedStatement["values"];

  return statement;
}
