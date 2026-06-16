import {Database} from "bun:sqlite";
import {drizzle} from "drizzle-orm/bun-sqlite";
import {sql} from "drizzle-orm";

import * as schema from "./schema";

export const defaultDatabasePath = ".data/mtg-agent.sqlite";

export function resolveDatabasePath(env = process.env): string {
  return env.MTG_AGENT_DB_PATH?.trim() || defaultDatabasePath;
}

export function openDatabase(path = resolveDatabasePath()) {
  const client = new Database(path);
  const db = drizzle({client, schema});
  db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

export type MtgAgentDatabase = ReturnType<typeof openDatabase>;

export function closeDatabase(db: MtgAgentDatabase): void {
  db.$client.close();
}
