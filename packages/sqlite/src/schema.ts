import {sql} from "drizzle-orm";
import {check, index, integer, primaryKey, real, sqliteTable, text,} from "drizzle-orm/sqlite-core";
import {cardIdentityTaggingWeightValues, colorIdentityValues, formatLegalityValues,} from "@mtg-agent/core";

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

export const scryfallBulkDataImports = sqliteTable(
    "scryfall_bulk_data_imports",
    {
        id: text("id").primaryKey(),
        bulkDataType: text("bulk_data_type", {
            enum: ["oracle_cards", "all_cards", "oracle_tags"],
        }).notNull(),
        status: text("status", {enum: ["succeeded", "failed"]}).notNull(),
        startedAt: integer("started_at", {mode: "timestamp"}).notNull(),
        completedAt: integer("completed_at", {mode: "timestamp"}),
        sourceUpdatedAt: integer("source_updated_at", {mode: "timestamp"}),
        sourceUri: text("source_uri"),
        importedRecordCount: integer("imported_record_count").notNull().default(0),
        warningsJson: text("warnings_json", {mode: "json"})
            .notNull()
            .default(sql`'[]'`),
        blockingErrorsJson: text("blocking_errors_json", {mode: "json"})
            .notNull()
            .default(sql`'[]'`),
    },
    (table) => [
        check(
            "scryfall_bulk_data_imports_bulk_data_type_check",
            sql`${table.bulkDataType} IN ('oracle_cards', 'all_cards', 'oracle_tags')`,
        ),
        check(
            "scryfall_bulk_data_imports_status_check",
            sql`${table.status} IN ('succeeded', 'failed')`,
        ),
    ],
);

export const cardIdentities = sqliteTable(
    "card_identities",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        layout: text("layout").notNull().default("normal"),
        manaCost: text("mana_cost"),
        manaValue: real("mana_value").notNull(),
        typeLine: text("type_line").notNull(),
        oracleText: text("oracle_text"),
        colorIdentity: text("color_identity", {enum: colorIdentityValues})
            .notNull()
            .default(""),
        colors: text("colors", {enum: colorIdentityValues}),
        colorIndicator: text("color_indicator", {enum: colorIdentityValues}),
        producedMana: text("produced_mana"),
        keywordsJson: text("keywords_json", {mode: "json"}).notNull().default(sql`'[]'`),
        power: text("power"),
        toughness: text("toughness"),
        loyalty: text("loyalty"),
        defense: text("defense"),
        edhrecRank: integer("edhrec_rank"),
        gameChanger: integer("game_changer", {mode: "boolean"}),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        check(
            "card_identities_color_identity_check",
            sql`${table.colorIdentity} IN ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG')`,
        ),
        index("idx_card_identities_color_identity").on(table.colorIdentity),
    ],
);

export const cardIdentityParts = sqliteTable(
    "card_identity_parts",
    {
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentities.id),
        partIndex: integer("part_index").notNull(),
        name: text("name").notNull(),
        manaCost: text("mana_cost"),
        typeLine: text("type_line"),
        oracleText: text("oracle_text"),
        colors: text("colors", {enum: colorIdentityValues}),
        colorIndicator: text("color_indicator", {enum: colorIdentityValues}),
        power: text("power"),
        toughness: text("toughness"),
        loyalty: text("loyalty"),
        defense: text("defense"),
    },
    (table) => [
        primaryKey({columns: [table.cardIdentityId, table.partIndex]}),
        index("idx_card_identity_parts_card_identity_id").on(table.cardIdentityId),
    ],
);

export const cardIdentityFormatLegalities = sqliteTable(
    "card_identity_format_legalities",
    {
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentities.id),
        format: text("format").notNull(),
        legality: text("legality", {enum: formatLegalityValues}).notNull(),
    },
    (table) => [
        primaryKey({columns: [table.cardIdentityId, table.format]}),
        check("card_identity_format_legalities_format_check", sql`length(${table.format}) > 0`),
        check(
            "card_identity_format_legalities_legality_check",
            sql`${table.legality} IN ('legal', 'not_legal', 'banned', 'restricted')`,
        ),
        index("idx_card_identity_format_legalities_card_identity_id").on(
            table.cardIdentityId,
        ),
        index("idx_card_identity_format_legalities_format_legality").on(
            table.format,
            table.legality,
        ),
    ],
);

export const cardPrintings = sqliteTable(
    "card_printings",
    {
        id: text("id").primaryKey(),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentities.id),
        layout: text("layout", {enum: ["standard", "reversible_card"]})
            .notNull()
            .default("standard"),
        printedName: text("printed_name"),
        setCode: text("set_code").notNull(),
        collectorNumber: text("collector_number").notNull(),
        finishesJson: text("finishes_json", {mode: "json"})
            .notNull()
            .default(sql`'[]'`),
        language: text("language").notNull(),
        tcgplayerId: integer("tcgplayer_id"),
        cardmarketId: integer("cardmarket_id"),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [index("idx_card_printings_card_identity_id").on(table.cardIdentityId)],
);

export const cardPrintingParts = sqliteTable(
    "card_printing_parts",
    {
        cardPrintingId: text("card_printing_id")
            .notNull()
            .references(() => cardPrintings.id),
        partIndex: integer("part_index").notNull(),
        printedName: text("printed_name"),
        flavorName: text("flavor_name"),
        printedTypeLine: text("printed_type_line"),
        printedText: text("printed_text"),
        flavorText: text("flavor_text"),
        artist: text("artist"),
        artistId: text("artist_id"),
        illustrationId: text("illustration_id"),
        imageUrisJson: text("image_uris_json", {mode: "json"}),
    },
    (table) => [
        primaryKey({columns: [table.cardPrintingId, table.partIndex]}),
        index("idx_card_printing_parts_card_printing_id").on(table.cardPrintingId),
    ],
);

export const cardIdentityTags = sqliteTable(
    "card_identity_tags",
    {
        id: text("id").primaryKey(),
        slug: text("slug").notNull().unique(),
        label: text("label").notNull(),
        description: text("description"),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        check("card_identity_tags_slug_check", sql`length(${table.slug}) > 0`),
        check("card_identity_tags_label_check", sql`length(${table.label}) > 0`),
    ],
);

export const cardIdentityTagAliases = sqliteTable(
    "card_identity_tag_aliases",
    {
        tagId: text("tag_id")
            .notNull()
            .references(() => cardIdentityTags.id),
        alias: text("alias").notNull(),
    },
    (table) => [
        primaryKey({columns: [table.tagId, table.alias]}),
        check("card_identity_tag_aliases_alias_check", sql`length(${table.alias}) > 0`),
        index("idx_card_identity_tag_aliases_tag_id").on(table.tagId),
    ],
);

export const cardIdentityTaggings = sqliteTable(
    "card_identity_taggings",
    {
        tagId: text("tag_id")
            .notNull()
            .references(() => cardIdentityTags.id),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentities.id),
        weight: text("weight", {enum: cardIdentityTaggingWeightValues}).notNull(),
        annotation: text("annotation"),
    },
    (table) => [
        primaryKey({columns: [table.tagId, table.cardIdentityId]}),
        check(
            "card_identity_taggings_weight_check",
            sql`${table.weight} IN ('very_strong', 'strong', 'median', 'weak')`,
        ),
        index("idx_card_identity_taggings_card_identity_id").on(table.cardIdentityId),
        index("idx_card_identity_taggings_tag_id").on(table.tagId),
    ],
);

export const cardIdentityTagHierarchy = sqliteTable(
    "card_identity_tag_hierarchy",
    {
        parentTagId: text("parent_tag_id")
            .notNull()
            .references(() => cardIdentityTags.id),
        childTagId: text("child_tag_id")
            .notNull()
            .references(() => cardIdentityTags.id),
    },
    (table) => [
        primaryKey({columns: [table.parentTagId, table.childTagId]}),
        index("idx_card_identity_tag_hierarchy_child_tag_id").on(table.childTagId),
    ],
);
