import {sql} from "drizzle-orm";
import {check, foreignKey, index, integer, primaryKey, real, sqliteTable, text, unique,} from "drizzle-orm/sqlite-core";
import {cardIdentityTaggingWeightValues, colorIdentityValues, formatLegalityValues,} from "@tomekin/core/scryfall-sync";
import {deckFormatValues} from "@tomekin/core/deck-building-brief";
import {deckCandidateCardSectionValues} from "@tomekin/core/deck-candidate";

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

/** The transactionally committed snapshot, never inferred from import start timestamps. */
export const collectionState = sqliteTable("collection_state", {
    singleton: integer("singleton").primaryKey(),
    activeImportId: text("active_import_id").notNull().references(() => collectionImport.id),
}, table => [check("collection_state_singleton_check", sql`${table.singleton} = 1`)]);

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
        index("idx_collection_location_name").on(table.name),
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
        addedAtExact: text("added_at_exact"),
        sourceRowNumber: integer("source_row_number").notNull(),
    },
    (table) => [
        check("collection_card_quantity_check", sql`${table.quantity} > 0`),
        check("collection_card_finish_check", sql`${table.finish} IN ('nonfoil', 'foil', 'etched')`),
        index("idx_collection_card_location_id").on(table.collectionLocationId),
        index("idx_collection_card_card_printing_id").on(table.cardPrintingId),
        index("idx_collection_card_finish").on(table.finish),
        index("idx_collection_card_altered").on(table.altered),
        index("idx_collection_card_misprint").on(table.misprint),
    ],
);

export const deckCandidate = sqliteTable(
    "deck_candidate",
    {
        id: text("id").primaryKey(),
        label: text("label").notNull(),
        format: text("format", {enum: deckFormatValues}).notNull(),
        formatAnchor: text("format_anchor"),
        briefJson: text("brief_json", {mode: "json"}).notNull(),
        collectionImportTimestamp: integer("collection_import_timestamp", {mode: "timestamp"}),
        markdown: text("markdown").notNull(),
        createdAtExact: text("created_at_exact"),
        updatedAtExact: text("updated_at_exact"),
        selectedChangedAt: text("selected_changed_at"),
        briefChangedAt: text("brief_changed_at"),
        planChangedAt: text("plan_changed_at"),
        assessmentsJson: text("assessments_json", {mode: "json"}),
        checkEvidenceJson: text("check_evidence_json", {mode: "json"}),
        createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
        updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
    },
    (table) => [
        check("deck_candidate_label_check", sql`length(${table.label}) > 0`),
        check("deck_candidate_format_check", sql`${table.format} IN ('commander', 'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'casual_60')`),
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
        section: text("section", {enum: deckCandidateCardSectionValues}).notNull(),
        sortOrder: integer("sort_order").notNull(),
        note: text("note"),
    },
    (table) => [
        check("deck_candidate_card_quantity_check", sql`typeof("quantity") = 'integer' AND "quantity" > 0`),
        check("deck_candidate_card_sort_order_check", sql`typeof("sort_order") = 'integer' AND "sort_order" >= 0`),
        check("deck_candidate_card_section_check", sql`"section" IN ('commander', 'mainboard', 'sideboard')`),
        unique("deck_candidate_card_membership_unique").on(table.deckCandidateId, table.cardIdentityId, table.section),
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
        importContractRevision: integer("import_contract_revision").notNull(),
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
        copyLimitOverrideKind: text("copy_limit_override_kind", {enum: ["none", "unlimited", "maximum"]}).notNull(),
        copyLimitOverrideMaximum: integer("copy_limit_override_maximum"),
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
        gameChanger: integer("game_changer", {mode: "boolean"}).notNull(),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        check(
            "card_identity_color_identity_check",
            sql`color_identity IN ('', 'W', 'U', 'B', 'R', 'G', 'WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG', 'WUB', 'WUR', 'WUG', 'WBR', 'WBG', 'WRG', 'UBR', 'UBG', 'URG', 'BRG', 'WUBR', 'WUBG', 'WURG', 'WBRG', 'UBRG', 'WUBRG')`,
        ),
        check(
            "card_identity_copy_limit_override_check",
            sql`(${table.copyLimitOverrideKind} = 'maximum' AND ${table.copyLimitOverrideMaximum} IS NOT NULL AND ${table.copyLimitOverrideMaximum} > 0) OR (${table.copyLimitOverrideKind} IN ('none', 'unlimited') AND ${table.copyLimitOverrideMaximum} IS NULL)`,
        ),
        index("idx_card_identity_color_identity").on(table.colorIdentity),
        index("idx_card_identity_name").on(table.name),
        index("idx_card_identity_type_line").on(table.typeLine),
        index("idx_card_identity_mana_value").on(table.manaValue),
        index("idx_card_identity_colors").on(table.colors),
        index("idx_card_identity_game_changer").on(table.gameChanger),
        index("idx_card_identity_edhrec_rank").on(table.edhrecRank),
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

export const cardSet = sqliteTable(
    "card_set",
    {
        id: text("id").primaryKey(),
        code: text("code").notNull(),
        name: text("name").notNull(),
        setType: text("set_type").notNull(),
        apiUri: text("api_uri").notNull(),
        cardSearchUri: text("card_search_uri").notNull(),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        unique("card_set_code_unique").on(table.code),
        check("card_set_code_check", sql`length(${table.code}) > 0`),
        check("card_set_name_check", sql`length(${table.name}) > 0`),
        check("card_set_set_type_check", sql`length(${table.setType}) > 0`),
        check("card_set_api_uri_check", sql`length(${table.apiUri}) > 0`),
        check("card_set_card_search_uri_check", sql`length(${table.cardSearchUri}) > 0`),
        check("card_set_source_page_uri_check", sql`length(${table.sourcePageUri}) > 0`),
        index("idx_card_set_name").on(table.name),
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
        setId: text("set_id")
            .notNull()
            .references(() => cardSet.id),
        collectorNumber: text("collector_number").notNull(),
        language: text("language").notNull(),
        tcgplayerId: integer("tcgplayer_id"),
        cardmarketId: integer("cardmarket_id"),
        sourcePageUri: text("source_page_uri").notNull(),
    },
    (table) => [
        index("idx_card_printing_card_identity_id").on(table.cardIdentityId),
        index("idx_card_printing_set_id").on(table.setId),
    ],
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

export const cardPrintingPromoType = sqliteTable(
    "card_printing_promo_type",
    {
        cardPrintingId: text("card_printing_id")
            .notNull()
            .references(() => cardPrinting.id),
        promoType: text("promo_type").notNull(),
    },
    (table) => [
        primaryKey({columns: [table.cardPrintingId, table.promoType]}),
        check("card_printing_promo_type_check", sql`length(${table.promoType}) > 0`),
        index("idx_card_printing_promo_type_card_printing_id").on(table.cardPrintingId),
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


// Candidate-owned records; JSON stores only claim-local metadata, never the graph.
export const deckCandidatePlan = sqliteTable(
    "deck_candidate_plan",
    {
        candidateId: text("candidate_id")
            .primaryKey()
            .references(() => deckCandidate.id),
        description: text("description").notNull(),
    },
    (t) => [
        check(
            "deck_candidate_plan_description",
            sql`length(trim(${t.description})) > 0`,
        ),
    ],
);
export const deckCandidateNode = sqliteTable(
    "deck_candidate_node",
    {
        candidateId: text("candidate_id")
            .notNull()
            .references(() => deckCandidatePlan.candidateId),
        id: text("id").notNull(),
        kind: text("kind", { enum: ["role", "win_route"] }).notNull(),
        label: text("label").notNull(),
        description: text("description").notNull(),
        priority: text("priority", { enum: ["primary", "secondary"] }),
        rationale: text("rationale"),
        coverageGoalJson: text("coverage_goal_json", { mode: "json" }),
        coverageAssessmentJson: text("coverage_assessment_json", {
            mode: "json",
        }),
        evidenceJson: text("evidence_json", { mode: "json" }),
    },
    (t) => [
        primaryKey({ columns: [t.candidateId, t.id] }),
        check("candidate_node_kind", sql`${t.kind} IN ('role','win_route')`),
        check(
            "candidate_node_text",
            sql`length(trim(${t.label})) > 0 AND length(trim(${t.description})) > 0`,
        ),
        check(
            "candidate_node_fields",
            sql`(${t.kind} = 'role' AND ${t.priority} IS NULL AND ${t.rationale} IS NULL) OR (${t.kind} = 'win_route' AND ${t.priority} IN ('primary','secondary') AND ${t.rationale} IS NOT NULL AND length(trim(${t.rationale})) > 0 AND ${t.coverageGoalJson} IS NULL AND ${t.coverageAssessmentJson} IS NULL)`,
        ),
    ],
);
export const deckCandidateOption = sqliteTable(
    "deck_candidate_option",
    {
        candidateId: text("candidate_id")
            .notNull()
            .references(() => deckCandidate.id),
        cardIdentityId: text("card_identity_id")
            .notNull()
            .references(() => cardIdentity.id),
        comparisonNote: text("comparison_note"),
    },
    (t) => [
        primaryKey({ columns: [t.candidateId, t.cardIdentityId] }),
        check(
            "candidate_option_note",
            sql`${t.comparisonNote} IS NULL OR length(trim(${t.comparisonNote})) > 0`,
        ),
    ],
);
export const deckCandidateContribution = sqliteTable(
    "deck_candidate_contribution",
    {
        candidateId: text("candidate_id").notNull(),
        cardIdentityId: text("card_identity_id").notNull(),
        roleId: text("role_id").notNull(),
        rationale: text("rationale").notNull(),
        qualificationsJson: text("qualifications_json", { mode: "json" }),
        evidenceJson: text("evidence_json", { mode: "json" }),
    },
    (t) => [
        primaryKey({ columns: [t.candidateId, t.cardIdentityId, t.roleId] }),
        foreignKey({
            columns: [t.candidateId, t.cardIdentityId],
            foreignColumns: [
                deckCandidateOption.candidateId,
                deckCandidateOption.cardIdentityId,
            ],
        }),
        foreignKey({
            columns: [t.candidateId, t.roleId],
            foreignColumns: [
                deckCandidateNode.candidateId,
                deckCandidateNode.id,
            ],
        }),
        check(
            "candidate_contribution_rationale",
            sql`length(trim(${t.rationale})) > 0`,
        ),
    ],
);
export const deckCandidateRelationship = sqliteTable(
    "deck_candidate_relationship",
    {
        candidateId: text("candidate_id").notNull(),
        id: text("id").notNull(),
        kind: text("kind", {
            enum: ["enables", "enhances", "supports", "competes_with"],
        }).notNull(),
        sourceId: text("source_id").notNull(),
        targetId: text("target_id").notNull(),
        rationale: text("rationale").notNull(),
        qualificationsJson: text("qualifications_json", { mode: "json" }),
        evidenceJson: text("evidence_json", { mode: "json" }),
    },
    (t) => [
        primaryKey({ columns: [t.candidateId, t.id] }),
        unique("candidate_relationship_logical").on(
            t.candidateId,
            t.kind,
            t.sourceId,
            t.targetId,
        ),
        foreignKey({
            columns: [t.candidateId, t.sourceId],
            foreignColumns: [
                deckCandidateNode.candidateId,
                deckCandidateNode.id,
            ],
        }),
        foreignKey({
            columns: [t.candidateId, t.targetId],
            foreignColumns: [
                deckCandidateNode.candidateId,
                deckCandidateNode.id,
            ],
        }),
        check(
            "candidate_relationship_kind",
            sql`${t.kind} IN ('enables','enhances','supports','competes_with')`,
        ),
        check(
            "candidate_relationship_distinct",
            sql`${t.sourceId} != ${t.targetId}`,
        ),
        check(
            "candidate_relationship_symmetric",
            sql`${t.kind} != 'competes_with' OR ${t.sourceId} < ${t.targetId}`,
        ),
        check(
            "candidate_relationship_rationale",
            sql`length(trim(${t.rationale})) > 0`,
        ),
    ],
);

/** Downloaded official evidence is distinct from successful application. IDs intentionally have no live-card FK. */
export const scryfallMigrationEvidence = sqliteTable("scryfall_migration_evidence", {
  id: text("id").primaryKey(),
  oldPrintingId: text("old_printing_id").notNull(),
  evidenceJson: text("evidence_json", {mode: "json"}).notNull(),
  sourceUri: text("source_uri").notNull(),
  fetchedAt: integer("fetched_at", {mode: "timestamp_ms"}).notNull(),
}, t => [index("scryfall_migration_old_printing").on(t.oldPrintingId)]);
export const scryfallMigrationApplication = sqliteTable("scryfall_migration_application", {
  id: text("id").primaryKey(),
  migrationId: text("migration_id").notNull().references(() => scryfallMigrationEvidence.id),
  oracleImportId: text("oracle_import_id").notNull().references(() => scryfallBulkDataImport.id),
  oldPrintingId: text("old_printing_id").notNull(),
  newPrintingId: text("new_printing_id"),
  oldIdentityId: text("old_identity_id"),
  newIdentityId: text("new_identity_id"),
  appliedAt: integer("applied_at", {mode: "timestamp_ms"}).notNull(),
}, t => [unique("scryfall_migration_application_unique").on(t.migrationId, t.oracleImportId)]);
