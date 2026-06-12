import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schema";

export const defaultDatabasePath = ".data/mtg-agent.sqlite";

export function resolveDatabasePath(env = process.env): string {
  return env.MTG_AGENT_DB_PATH?.trim() || defaultDatabasePath;
}

export function openDatabase(path = resolveDatabasePath()) {
  const client = new Database(path);
  return drizzle({ client, schema });
}
