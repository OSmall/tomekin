import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { colorIdentityValues, formatLegalityValues } from "@mtg-agent/core";

export const collectionImports = sqliteTable("collection_imports", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
  importedAt: integer("imported_at", { mode: "timestamp" }).notNull(),
  sourceFormat: text("source_format", {
    enum: ["manabox_collection_csv"],
  }).notNull(),
  sourceLabel: text("source_label").notNull(),
  importedOwnedCardRows: integer("imported_owned_card_rows").notNull().default(0),
  totalOwnedCardQuantity: integer("total_owned_card_quantity").notNull().default(0),
  importedBinderCount: integer("imported_binder_count").notNull().default(0),
  inferredExistingDeckCount: integer("inferred_existing_deck_count")
    .notNull()
    .default(0),
  skippedManaBoxListsJson: text("skipped_manabox_lists_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
  validationErrorsJson: text("validation_errors_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
  warningsJson: text("warnings_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
});

export const scryfallBulkDataImports = sqliteTable("scryfall_bulk_data_imports", {
  id: text("id").primaryKey(),
  bulkDataType: text("bulk_data_type", {
    enum: ["oracle_cards", "all_cards", "oracle_tags"],
  }).notNull(),
  status: text("status", { enum: ["succeeded", "failed"] }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp" }),
  sourceUri: text("source_uri"),
  importedRecordCount: integer("imported_record_count").notNull().default(0),
  warningsJson: text("warnings_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
  blockingErrorsJson: text("blocking_errors_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
});

export const cardIdentities = sqliteTable("card_identities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  manaCost: text("mana_cost"),
  typeLine: text("type_line").notNull(),
  oracleText: text("oracle_text"),
  colorIdentity: text("color_identity", { enum: colorIdentityValues })
    .notNull()
    .default(""),
  sourcePageUri: text("source_page_uri").notNull(),
});

export const cardIdentityFormatLegalities = sqliteTable("card_identity_format_legalities", {
  cardIdentityId: text("card_identity_id")
    .notNull()
    .references(() => cardIdentities.id),
  format: text("format").notNull(),
  legality: text("legality", { enum: formatLegalityValues }).notNull(),
});

export const cardPrintings = sqliteTable("card_printings", {
  id: text("id").primaryKey(),
  cardIdentityId: text("card_identity_id")
    .notNull()
    .references(() => cardIdentities.id),
  printedName: text("printed_name"),
  setCode: text("set_code").notNull(),
  collectorNumber: text("collector_number").notNull(),
  finishesJson: text("finishes_json", { mode: "json" })
    .notNull()
    .default(sql`'[]'`),
  language: text("language").notNull(),
  sourcePageUri: text("source_page_uri").notNull(),
});
