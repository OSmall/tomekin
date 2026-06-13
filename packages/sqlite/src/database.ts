import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";

import * as schema from "./schema";

export const defaultDatabasePath = ".data/mtg-agent.sqlite";

export function resolveDatabasePath(env = process.env): string {
  return env.MTG_AGENT_DB_PATH?.trim() || defaultDatabasePath;
}

export function openDatabase(path = resolveDatabasePath()) {
  const client = new Database(path);
  return drizzle({ client, schema });
}

export type MtgAgentDatabase = ReturnType<typeof openDatabase>;

export function closeDatabase(db: MtgAgentDatabase): void {
  db.$client.close();
}

export function initializeDatabaseSchema(db: MtgAgentDatabase): void {
  db.run(sql`PRAGMA foreign_keys = ON`);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS collection_imports (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      imported_at INTEGER NOT NULL,
      source_format TEXT NOT NULL,
      source_label TEXT NOT NULL,
      imported_owned_card_rows INTEGER NOT NULL DEFAULT 0,
      total_owned_card_quantity INTEGER NOT NULL DEFAULT 0,
      imported_binder_count INTEGER NOT NULL DEFAULT 0,
      inferred_existing_deck_count INTEGER NOT NULL DEFAULT 0,
      skipped_manabox_lists_json TEXT NOT NULL DEFAULT '[]',
      validation_errors_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS scryfall_bulk_data_imports (
      id TEXT PRIMARY KEY NOT NULL,
      bulk_data_type TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      source_updated_at INTEGER,
      source_uri TEXT,
      imported_record_count INTEGER NOT NULL DEFAULT 0,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      blocking_errors_json TEXT NOT NULL DEFAULT '[]'
    )
  `);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS card_identities (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      mana_cost TEXT,
      type_line TEXT NOT NULL,
      oracle_text TEXT,
      color_identity_json TEXT NOT NULL DEFAULT '[]',
      commander_legality TEXT
    )
  `);
  db.run(sql`
    CREATE TABLE IF NOT EXISTS card_printings (
      id TEXT PRIMARY KEY NOT NULL,
      card_identity_id TEXT NOT NULL REFERENCES card_identities(id),
      name TEXT NOT NULL,
      set_code TEXT NOT NULL,
      collector_number TEXT NOT NULL,
      finishes_json TEXT NOT NULL DEFAULT '[]',
      language TEXT
    )
  `);
}
