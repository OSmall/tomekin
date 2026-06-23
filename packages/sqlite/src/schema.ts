import {sql} from "drizzle-orm";
import {check, index, integer, primaryKey, real, sqliteTable, text, unique,} from "drizzle-orm/sqlite-core";
import {cardIdentityTaggingWeightValues, colorIdentityValues, formatLegalityValues,} from "@mtg-agent/core";

export const collectionImport = sqliteTable("collection_import", {
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

export const collectionLocation = sqliteTable(
    "collection_location",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        type: text("type", {enum: ["binder", "deck"]}).notNull(),
    },
    (table) => [
        unique("collection_location_type_name_unique").on(table.type, table.name),
        check("collection_location_name_check", sql`length(${table.name}) > 0`),
        check("collection_location_type_check", sql`${table.type} IN ('binder', 'deck')`),
    ],
);

export const collectionCard = sqliteTable(
    "collection_card",
    {
        id: text("id").primaryKey(),
        quantity: integer("quantity").notNull(),
        collectionLocationId: text("collection_location_id")
            .notNull()
            .references(() => collectionLocation.id),
        finish: text("finish", {enum: ["nonfoil", "foil", "etched"]}).notNull(),
        manaBoxId: text("mana_box_id"),
        cardPrintingId: text("card_printing_id")
            .notNull()
            .references(() => cardPrinting.id),
        misprint: integer("misprint", {mode: "boolean"}).notNull(),
        altered: integer("altered", {mode: "boolean"}).notNull(),
        condition: text("condition"),
        purchasePriceCurrency: text("purchase_price_currency"),
        purchasePrice: real("purchase_price"),
        addedAt: integer("added_at", {mode: "timestamp"}),
        sourceRowNumber: integer("source_row_number").notNull(),
    },
    (table) => [
        check("collection_card_quantity_check", sql`${table.quantity} > 0`),
        check("collection_card_finish_check", sql`${table.finish} IN ('nonfoil', 'foil', 'etched')`),
        index("idx_collection_card_location_id").on(table.collectionLocationId),
        index("idx_collection_card_card_printing_id").on(table.cardPrintingId),
    ],
);

export const deckCandidate = sqliteTable(
    "deck_candidate",
    {
        id: text("id").primaryKey(),
        label: text("label").notNull(),
        format: text("format", {enum: ["commander"]}).notNull(),
        formatAnchor: text("format_anchor"),
        commanderBracket: text("commander_bracket"),
        briefJson: text("brief_json", {mode: "json"}).notNull(),
        collectionImportTimestamp: integer("collection_import_timestamp", {mode: "timestamp"}),
        markdown: text("markdown").notNull(),
        createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
        updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
    },
    (table) => [
        check("deck_candidate_label_check", sql`length(${table.label}) > 0`),
        check("deck_candidate_format_check", sql`${table.format} IN ('commander')`),
    ],
);

export const deckCandidateCard = sqliteTable(
    "deck_candidate_card",
    {
        id: text("id").primaryKey(),
        deckCandidateId: text("deck_candidate_id")
            .notNull()
            .references(() => deckCandidate.id),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
        quantity: integer("quantity").notNull(),
        section: text("section", {enum: ["commander", "deck"]}).notNull(),
        sortOrder: integer("sort_order").notNull(),
        note: text("note"),
    },
    (table) => [
        check("deck_candidate_card_quantity_check", sql`${table.quantity} > 0`),
        check("deck_candidate_card_section_check", sql`${table.section} IN ('commander', 'deck')`),
        index("idx_deck_candidate_card_deck_candidate_id").on(table.deckCandidateId),
        index("idx_deck_candidate_card_card_identity_id").on(table.cardIdentityId),
    ],
);

export const scryfallBulkDataImport = sqliteTable(
    "scryfall_bulk_data_import",
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
            "scryfall_bulk_data_import_bulk_data_type_check",
            sql`${table.bulkDataType} IN ('oracle_cards', 'all_cards', 'oracle_tags')`,
        ),
        check(
            "scryfall_bulk_data_import_status_check",
            sql`${table.status} IN ('succeeded', 'failed')`,
        ),
    ],
);

export const cardIdentity = sqliteTable(
    "card_identity",
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
            "card_identity_color_identity_check",
            sql`${table.colorIdentity} IN ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG')`,
        ),
        index("idx_card_identity_color_identity").on(table.colorIdentity),
    ],
);

export const cardIdentityPart = sqliteTable(
    "card_identity_part",
    {
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
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
        index("idx_card_identity_part_card_identity_id").on(table.cardIdentityId),
    ],
);

export const cardIdentityFormatLegality = sqliteTable(
    "card_identity_format_legality",
    {
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
        format: text("format").notNull(),
        legality: text("legality", {enum: formatLegalityValues}).notNull(),
    },
    (table) => [
        primaryKey({columns: [table.cardIdentityId, table.format]}),
        check("card_identity_format_legality_format_check", sql`length(${table.format}) > 0`),
        check(
            "card_identity_format_legality_legality_check",
            sql`${table.legality} IN ('legal', 'not_legal', 'banned', 'restricted')`,
        ),
        index("idx_card_identity_format_legality_card_identity_id").on(
            table.cardIdentityId,
        ),
        index("idx_card_identity_format_legality_format_legality").on(
            table.format,
            table.legality,
        ),
    ],
);

export const cardPrinting = sqliteTable(
    "card_printing",
    {
        id: text("id").primaryKey(),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
        layout: text("layout", {enum: ["standard", "reversible_card"]})
            .notNull()
            .default("standard"),
        printedName: text("printed_name"),
        setCode: text("set_code").notNull(),
        collectorNumber: text("collector_number").notNull(),
        language: text("language").notNull(),
        tcgplayerId: integer("tcgplayer_id"),
        cardmarketId: integer("cardmarket_id"),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [index("idx_card_printing_card_identity_id").on(table.cardIdentityId)],
);

export const cardPrintingFinish = sqliteTable(
    "card_printing_finish",
    {
        cardPrintingId: text("card_printing_id")
            .notNull()
            .references(() => cardPrinting.id),
        finish: text("finish", {enum: ["nonfoil", "foil", "etched"]}).notNull(),
    },
    (table) => [
        primaryKey({columns: [table.cardPrintingId, table.finish]}),
        check("card_printing_finish_finish_check", sql`${table.finish} IN ('nonfoil', 'foil', 'etched')`),
        index("idx_card_printing_finish_card_printing_id").on(table.cardPrintingId),
    ],
);

export const cardPrintingPart = sqliteTable(
    "card_printing_part",
    {
        cardPrintingId: text("card_printing_id")
            .notNull()
            .references(() => cardPrinting.id),
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
        index("idx_card_printing_part_card_printing_id").on(table.cardPrintingId),
    ],
);

export const cardIdentityTag = sqliteTable(
    "card_identity_tag",
    {
        id: text("id").primaryKey(),
        slug: text("slug").notNull().unique(),
        label: text("label").notNull(),
        description: text("description"),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        check("card_identity_tag_slug_check", sql`length(${table.slug}) > 0`),
        check("card_identity_tag_label_check", sql`length(${table.label}) > 0`),
    ],
);

export const cardIdentityTagAlias = sqliteTable(
    "card_identity_tag_alias",
    {
        tagId: text("tag_id")
            .notNull()
            .references(() => cardIdentityTag.id),
        alias: text("alias").notNull(),
    },
    (table) => [
        primaryKey({columns: [table.tagId, table.alias]}),
        check("card_identity_tag_alias_alias_check", sql`length(${table.alias}) > 0`),
        index("idx_card_identity_tag_alias_tag_id").on(table.tagId),
    ],
);

export const cardIdentityTagging = sqliteTable(
    "card_identity_tagging",
    {
        tagId: text("tag_id")
            .notNull()
            .references(() => cardIdentityTag.id),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
        weight: text("weight", {enum: cardIdentityTaggingWeightValues}).notNull(),
        annotation: text("annotation"),
    },
    (table) => [
        primaryKey({columns: [table.tagId, table.cardIdentityId]}),
        check(
            "card_identity_tagging_weight_check",
            sql`${table.weight} IN ('very_strong', 'strong', 'median', 'weak')`,
        ),
        index("idx_card_identity_tagging_card_identity_id").on(table.cardIdentityId),
        index("idx_card_identity_tagging_tag_id").on(table.tagId),
    ],
);

export const cardIdentityTagHierarchy = sqliteTable(
    "card_identity_tag_hierarchy",
    {
        parentTagId: text("parent_tag_id")
            .notNull()
            .references(() => cardIdentityTag.id),
        childTagId: text("child_tag_id")
            .notNull()
            .references(() => cardIdentityTag.id),
    },
    (table) => [
        primaryKey({columns: [table.parentTagId, table.childTagId]}),
        index("idx_card_identity_tag_hierarchy_child_tag_id").on(table.childTagId),
    ],
);
