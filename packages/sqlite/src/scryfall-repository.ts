import {randomUUIDv7} from "bun";
import {desc, sql} from "drizzle-orm";
import {err, ok, type Result} from "neverthrow";
import type {
  CardIdentity,
  CardIdentityFormatLegality,
  CardIdentityImportRecord,
  CardIdentityPart,
  CardIdentityTag,
  CardIdentityTagAlias,
  CardIdentityTagging,
  CardIdentityTagHierarchy,
  CardIdentityTagImportRecord,
  CardPrinting,
  CardPrintingImportRecord,
  CardPrintingPart,
  Clock,
  ScryfallBulkDataImport,
  ScryfallBulkDataType,
  ScryfallBulkImportInput,
  ScryfallFinalizationPhase,
  ScryfallImportObserver,
  ScryfallRepository,
  ScryfallRepositoryError,
} from "@mtg-agent/core";
import {CardIdentityLayoutSchema} from "@mtg-agent/core";

import type {MtgAgentDatabase} from "./database";
import {
  cardIdentity,
  cardIdentityFormatLegality,
  cardIdentityPart,
  cardIdentityTag,
  cardIdentityTagAlias,
  cardIdentityTagging,
  cardIdentityTagHierarchy,
  cardPrinting,
  cardPrintingFinish,
  cardPrintingPart,
  scryfallBulkDataImport,
} from "./schema";

const SCRYFALL_IMPORT_TIMING_RECORD_INTERVAL = 25_000;

export type SqliteScryfallRepository = ScryfallRepository & {
  importCardIdentities(
    input: ScryfallBulkImportInput<CardIdentityImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  listCardIdentityFormatLegalities(): Promise<
    Result<readonly CardIdentityFormatLegality[], ScryfallRepositoryError>
  >;
  importCardPrintings(
      input: ScryfallBulkImportInput<CardPrintingImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  listCardIdentityParts(): Promise<Result<readonly CardIdentityPart[], ScryfallRepositoryError>>;
  listCardPrintingParts(): Promise<Result<readonly CardPrintingPart[], ScryfallRepositoryError>>;
  importCardIdentityTags(
    input: ScryfallBulkImportInput<CardIdentityTagImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  listCardIdentities(): Promise<Result<readonly CardIdentity[], ScryfallRepositoryError>>;
  listCardPrintings(): Promise<Result<readonly CardPrinting[], ScryfallRepositoryError>>;
  listCardIdentityTags(): Promise<Result<readonly CardIdentityTag[], ScryfallRepositoryError>>;
  listCardIdentityTagAliases(): Promise<
    Result<readonly CardIdentityTagAlias[], ScryfallRepositoryError>
  >;
  listCardIdentityTaggings(): Promise<
    Result<readonly CardIdentityTagging[], ScryfallRepositoryError>
  >;
  listCardIdentityTagHierarchy(): Promise<
    Result<readonly CardIdentityTagHierarchy[], ScryfallRepositoryError>
  >;
  listBulkDataImports(): Promise<
    Result<readonly ScryfallBulkDataImport[], ScryfallRepositoryError>
  >;
};

export function createSqliteScryfallRepository(
  db: MtgAgentDatabase,
  clock: Clock,
): SqliteScryfallRepository {
  return {
    async importCardIdentities(input) {
      let importedRecordCount = 0;
      try {
        beginTransaction(db);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            layout TEXT NOT NULL,
            mana_cost TEXT,
            mana_value REAL NOT NULL,
            type_line TEXT NOT NULL,
            oracle_text TEXT,
            color_identity TEXT NOT NULL,
            colors TEXT,
            color_indicator TEXT,
            produced_mana TEXT,
            keywords_json TEXT NOT NULL,
            power TEXT,
            toughness TEXT,
            loyalty TEXT,
            defense TEXT,
            edhrec_rank INTEGER,
            game_changer INTEGER NOT NULL,
            source_page_uri TEXT NOT NULL
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_part`);
        db.run(sql`
          CREATE
          TEMP TABLE import_card_identity_part (
            card_identity_id TEXT NOT NULL,
            part_index INTEGER NOT NULL,
            name TEXT NOT NULL,
            mana_cost TEXT,
            type_line TEXT,
            oracle_text TEXT,
            colors TEXT,
            color_indicator TEXT,
            power TEXT,
            toughness TEXT,
            loyalty TEXT,
            defense TEXT,
            PRIMARY KEY (card_identity_id, part_index)
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_format_legality`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_format_legality (
            card_identity_id TEXT NOT NULL,
            format TEXT NOT NULL,
            legality TEXT NOT NULL,
            PRIMARY KEY (card_identity_id, format)
          )
        `);

        const insertIdentity = db.$client.prepare(`
          INSERT INTO import_card_identity (
            id,
            name,
            layout,
            mana_cost,
            mana_value,
            type_line,
            oracle_text,
            color_identity,
            colors,
            color_indicator,
            produced_mana,
            keywords_json,
            power,
            toughness,
            loyalty,
            defense,
            edhrec_rank,
            game_changer,
            source_page_uri)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
        `);
        const insertIdentityPart = db.$client.prepare(`
          INSERT INTO import_card_identity_part (card_identity_id,
                                                  part_index,
                                                  name,
                                                  mana_cost,
                                                  type_line,
                                                  oracle_text,
                                                  colors,
                                                  color_indicator,
                                                  power,
                                                  toughness,
                                                  loyalty,
                                                  defense)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        `);
        const insertLegality = db.$client.prepare(`
          INSERT INTO import_card_identity_format_legality (
            card_identity_id,
            format,
            legality
          ) VALUES (?1, ?2, ?3)
        `);
        try {
          for await (const record of input.records) {
            const {identity, parts, formatLegalities} = record;
            insertIdentity.run(
              identity.id,
              identity.name,
                identity.layout,
              identity.manaCost,
              identity.manaValue,
              identity.typeLine,
              identity.oracleText,
              identity.colorIdentity,
                identity.colors,
                identity.colorIndicator,
                identity.producedMana,
                JSON.stringify(identity.keywords),
                identity.power,
                identity.toughness,
                identity.loyalty,
                identity.defense,
                identity.edhrecRank,
                identity.gameChanger ? 1 : 0,
              identity.sourcePageUri,
            );
            for (const part of parts) {
              insertIdentityPart.run(
                  part.cardIdentityId,
                  part.partIndex,
                  part.name,
                  part.manaCost,
                  part.typeLine,
                  part.oracleText,
                  part.colors,
                  part.colorIndicator,
                  part.power,
                  part.toughness,
                  part.loyalty,
                  part.defense,
              );
            }
            for (const legality of formatLegalities) {
              insertLegality.run(
                legality.cardIdentityId,
                legality.format,
                legality.legality,
              );
            }
            importedRecordCount += 1;
            emitStagedRecordCounter(input.observer, importedRecordCount);
          }
        } finally {
          insertLegality.finalize();
          insertIdentityPart.finalize();
          insertIdentity.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);

        const orphaned = timedFinalizationPhase(
          input.observer,
          "orphaned_identity_check",
          () =>
            db.all<{ id: string; source: string }>(sql`
              SELECT DISTINCT card_identity_id AS id, 'Card Printings' AS source
              FROM card_printing
              WHERE card_identity_id NOT IN (SELECT id FROM import_card_identity)
              UNION
              SELECT DISTINCT card_identity_id AS id, 'Card Identity Taggings' AS source
              FROM card_identity_tagging
              WHERE card_identity_id NOT IN (SELECT id FROM import_card_identity)
            `),
        );
        if (orphaned.length > 0) {
          throw importRejection([
            `oracle_cards import would orphan existing Card Identity references for Card Identity IDs: ${orphaned.map((row) => row.id).join(", ")}.`,
          ]);
        }

        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardIdentityFormatLegality).run();
          db.delete(cardIdentityPart).run();
          db.run(sql`
            DELETE FROM card_identity
            WHERE id NOT IN (SELECT id FROM import_card_identity)
          `);
        });
        timedFinalizationPhase(input.observer, "upsert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_identity (
              id,
              name,
              layout,
              mana_cost,
              mana_value,
              type_line,
              oracle_text,
              color_identity,
              colors,
              color_indicator,
              produced_mana,
              keywords_json,
              power,
              toughness,
              loyalty,
              defense,
              edhrec_rank,
              game_changer,
              source_page_uri
            )
            SELECT
              id,
              name,
              layout,
              mana_cost,
              mana_value,
              type_line,
              oracle_text,
              color_identity,
              colors,
              color_indicator,
              produced_mana,
              keywords_json,
              power,
              toughness,
              loyalty,
              defense,
              edhrec_rank,
              game_changer,
              source_page_uri
            FROM import_card_identity
            WHERE true
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
                                             layout = excluded.layout,
              mana_cost = excluded.mana_cost,
              mana_value = excluded.mana_value,
              type_line = excluded.type_line,
              oracle_text = excluded.oracle_text,
              color_identity = excluded.color_identity,
                                             colors = excluded.colors,
                                             color_indicator = excluded.color_indicator,
                                             produced_mana = excluded.produced_mana,
                                             keywords_json = excluded.keywords_json,
                                             power = excluded.power,
                                             toughness = excluded.toughness,
                                             loyalty = excluded.loyalty,
                                             defense = excluded.defense,
                                             edhrec_rank = excluded.edhrec_rank,
                                             game_changer = excluded.game_changer,
              source_page_uri = excluded.source_page_uri
          `);
          db.run(sql`
            INSERT INTO card_identity_part (card_identity_id,
                                             part_index,
                                             name,
                                             mana_cost,
                                             type_line,
                                             oracle_text,
                                             colors,
                                             color_indicator,
                                             power,
                                             toughness,
                                             loyalty,
                                             defense)
            SELECT card_identity_id,
                   part_index,
                   name,
                   mana_cost,
                   type_line,
                   oracle_text,
                   colors,
                   color_indicator,
                   power,
                   toughness,
                   loyalty,
                   defense
            FROM import_card_identity_part
          `);
          db.run(sql`
            INSERT INTO card_identity_format_legality (
              card_identity_id,
              format,
              legality
            )
            SELECT
              card_identity_id,
              format,
              legality
            FROM import_card_identity_format_legality
          `);
        });

        const imported = timedFinalizationPhase(
          input.observer,
          "record_import_attempt",
          () =>
            insertImportRecord(
              db,
              "oracle_cards",
              "succeeded",
              { ...input, completedAt: clock.now(), importedRecordCount },
              [],
              [],
            ),
        );
        commitTransaction(db);
        return ok(imported);
      } catch (error) {
        rollbackTransaction(db);
        return err(toRepositoryError(error));
      }
    },

    async importCardPrintings(input) {
      let importedRecordCount = 0;
      try {
        beginTransaction(db);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_printing`);
        db.run(sql`
          CREATE TEMP TABLE import_card_printing (
            id TEXT PRIMARY KEY NOT NULL,
            card_identity_id TEXT NOT NULL,
            layout TEXT NOT NULL,
            printed_name TEXT,
            set_code TEXT NOT NULL,
            collector_number TEXT NOT NULL,
            language TEXT NOT NULL,
            tcgplayer_id INTEGER,
            cardmarket_id INTEGER,
            source_page_uri TEXT NOT NULL
          )
        `);
          db.run(sql`DROP TABLE IF EXISTS temp.import_card_printing_finish`);
          db.run(sql`
              CREATE
              TEMP TABLE import_card_printing_finish (
            card_printing_id TEXT NOT NULL,
            finish TEXT NOT NULL,
            PRIMARY KEY (card_printing_id, finish)
          )
          `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_printing_part`);
        db.run(sql`
          CREATE
          TEMP TABLE import_card_printing_part (
            card_printing_id TEXT NOT NULL,
            part_index INTEGER NOT NULL,
            printed_name TEXT,
            flavor_name TEXT,
            printed_type_line TEXT,
            printed_text TEXT,
            flavor_text TEXT,
            artist TEXT,
            artist_id TEXT,
            illustration_id TEXT,
            image_uris_json TEXT,
            PRIMARY KEY (card_printing_id, part_index)
          )
        `);

        const insertPrinting = db.$client.prepare(`
          INSERT INTO import_card_printing (
            id,
            card_identity_id,
            layout,
            printed_name,
            set_code,
            collector_number,
            language,
            tcgplayer_id,
            cardmarket_id,
            source_page_uri)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        `);
          const insertPrintingFinish = db.$client.prepare(`
          INSERT INTO import_card_printing_finish (card_printing_id, finish)
          VALUES (?1, ?2)
        `);
        const insertPrintingPart = db.$client.prepare(`
          INSERT INTO import_card_printing_part (card_printing_id,
                                                  part_index,
                                                  printed_name,
                                                  flavor_name,
                                                  printed_type_line,
                                                  printed_text,
                                                  flavor_text,
                                                  artist,
                                                  artist_id,
                                                  illustration_id,
                                                  image_uris_json)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        `);
        try {
          for await (const record of input.records) {
            const {printing, parts} = record;
            insertPrinting.run(
                printing.id,
                printing.cardIdentityId,
                printing.layout,
                printing.printedName,
                printing.setCode,
                printing.collectorNumber,
                printing.language,
                printing.tcgplayerId,
                printing.cardmarketId,
                printing.sourcePageUri,
            );
              for (const finish of printing.finishes) {
                  insertPrintingFinish.run(printing.id, finish);
              }
            for (const part of parts) {
              insertPrintingPart.run(
                  part.cardPrintingId,
                  part.partIndex,
                  part.printedName,
                  part.flavorName,
                  part.printedTypeLine,
                  part.printedText,
                  part.flavorText,
                  part.artist,
                  part.artistId,
                  part.illustrationId,
                  part.imageUris === null ? null : JSON.stringify(part.imageUris),
              );
            }
            importedRecordCount += 1;
            emitStagedRecordCounter(input.observer, importedRecordCount);
          }
        } finally {
          insertPrintingPart.finalize();
            insertPrintingFinish.finalize();
          insertPrinting.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);

        const missingIdentityIds = timedFinalizationPhase(
          input.observer,
          "missing_identity_check",
          () =>
            db.all<{ id: string }>(sql`
              SELECT DISTINCT card_identity_id AS id
              FROM import_card_printing
              WHERE card_identity_id NOT IN (SELECT id FROM card_identity)
            `),
        );
        if (missingIdentityIds.length > 0) {
          throw importRejection([
            `all_cards import references missing Card Identity IDs: ${missingIdentityIds.map((row) => row.id).join(", ")}.`,
          ]);
        }

        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardPrintingPart).run();
            db.delete(cardPrintingFinish).run();
          db.delete(cardPrinting).run();
        });
        timedFinalizationPhase(input.observer, "insert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_printing (
              id,
              card_identity_id,
              layout,
              printed_name,
              set_code,
              collector_number,
              language,
              tcgplayer_id,
              cardmarket_id,
              source_page_uri
            )
            SELECT
              id,
              card_identity_id,
              layout,
              printed_name,
              set_code,
              collector_number,
              language, tcgplayer_id, cardmarket_id,
              source_page_uri
            FROM import_card_printing
          `);
            db.run(sql`
            INSERT INTO card_printing_finish (card_printing_id, finish)
            SELECT card_printing_id, finish
            FROM import_card_printing_finish
          `);
          db.run(sql`
            INSERT INTO card_printing_part (card_printing_id,
                                             part_index,
                                             printed_name,
                                             flavor_name,
                                             printed_type_line,
                                             printed_text,
                                             flavor_text,
                                             artist,
                                             artist_id,
                                             illustration_id,
                                             image_uris_json)
            SELECT card_printing_id,
                   part_index,
                   printed_name,
                   flavor_name,
                   printed_type_line,
                   printed_text,
                   flavor_text,
                   artist,
                   artist_id,
                   illustration_id,
                   image_uris_json
            FROM import_card_printing_part
          `);
        });

        const imported = timedFinalizationPhase(
          input.observer,
          "record_import_attempt",
          () =>
            insertImportRecord(
              db,
              "all_cards",
              "succeeded",
              { ...input, completedAt: clock.now(), importedRecordCount },
              [],
              [],
            ),
        );
        commitTransaction(db);
        return ok(imported);
      } catch (error) {
        rollbackTransaction(db);
        return err(toRepositoryError(error));
      }
    },

    async importCardIdentityTags(input) {
      let importedRecordCount = 0;
      try {
        beginTransaction(db);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_tag`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_tag (
            id TEXT PRIMARY KEY NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL,
            description TEXT,
            source_page_uri TEXT NOT NULL
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_tag_alias`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_tag_alias (
            tag_id TEXT NOT NULL,
            alias TEXT NOT NULL,
            PRIMARY KEY (tag_id, alias)
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_tagging`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_tagging (
            tag_id TEXT NOT NULL,
            card_identity_id TEXT NOT NULL,
            weight TEXT NOT NULL,
            annotation TEXT,
            PRIMARY KEY (tag_id, card_identity_id)
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_tag_hierarchy`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_tag_hierarchy (
            parent_tag_id TEXT NOT NULL,
            child_tag_id TEXT NOT NULL,
            PRIMARY KEY (parent_tag_id, child_tag_id)
          )
        `);

        const insertTag = db.$client.prepare(`
          INSERT INTO import_card_identity_tag (
            id, slug, label, description, source_page_uri
          ) VALUES (?1, ?2, ?3, ?4, ?5)
        `);
        const insertAlias = db.$client.prepare(`
          INSERT INTO import_card_identity_tag_alias (tag_id, alias)
          VALUES (?1, ?2)
        `);
        const insertTagging = db.$client.prepare(`
          INSERT INTO import_card_identity_tagging (
            tag_id, card_identity_id, weight, annotation
          ) VALUES (?1, ?2, ?3, ?4)
        `);
        const insertHierarchy = db.$client.prepare(`
          INSERT INTO import_card_identity_tag_hierarchy (parent_tag_id, child_tag_id)
          VALUES (?1, ?2)
        `);
        try {
          for await (const record of input.records) {
            insertTag.run(
              record.tag.id,
              record.tag.slug,
              record.tag.label,
              record.tag.description,
              record.tag.sourcePageUri,
            );
            for (const alias of record.aliases) {
              insertAlias.run(alias.tagId, alias.alias);
            }
            for (const tagging of record.taggings) {
              insertTagging.run(
                tagging.tagId,
                tagging.cardIdentityId,
                tagging.weight,
                tagging.annotation,
              );
            }
            for (const link of record.hierarchy) {
              insertHierarchy.run(link.parentTagId, link.childTagId);
            }
            importedRecordCount += 1;
            emitStagedRecordCounter(input.observer, importedRecordCount);
          }
        } finally {
          insertHierarchy.finalize();
          insertTagging.finalize();
          insertAlias.finalize();
          insertTag.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);

        if (importedRecordCount === 0) {
          throw importRejection(["oracle_tags import must contain at least one tag."]);
        }

        const missingIdentityIds = timedFinalizationPhase(
          input.observer,
          "missing_identity_check",
          () =>
            db.all<{ id: string }>(sql`
              SELECT DISTINCT card_identity_id AS id
              FROM import_card_identity_tagging
              WHERE card_identity_id NOT IN (SELECT id FROM card_identity)
            `),
        );
        if (missingIdentityIds.length > 0) {
          throw importRejection([
            `oracle_tags import references missing Card Identity IDs: ${missingIdentityIds.map((row) => row.id).join(", ")}.`,
          ]);
        }

        const hierarchyErrors = timedFinalizationPhase(
          input.observer,
          "missing_identity_check",
          () => {
            const missingParents = db.all<{ id: string }>(sql`
              SELECT DISTINCT parent_tag_id AS id
              FROM import_card_identity_tag_hierarchy
              WHERE parent_tag_id NOT IN (SELECT id FROM import_card_identity_tag)
            `);
            const selfParents = db.all<{ id: string }>(sql`
              SELECT DISTINCT child_tag_id AS id
              FROM import_card_identity_tag_hierarchy
              WHERE parent_tag_id = child_tag_id
            `);
            return { missingParents, selfParents };
          },
        );
        const blockingErrors: string[] = [];
        if (hierarchyErrors.missingParents.length > 0) {
          blockingErrors.push(
            `oracle_tags import references missing parent Tag IDs: ${hierarchyErrors.missingParents.map((row) => row.id).join(", ")}.`,
          );
        }
        if (hierarchyErrors.selfParents.length > 0) {
          blockingErrors.push(
            `oracle_tags import contains self-parenting Tag IDs: ${hierarchyErrors.selfParents.map((row) => row.id).join(", ")}.`,
          );
        }
        if (blockingErrors.length > 0) {
          throw importRejection(blockingErrors);
        }

        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardIdentityTagHierarchy).run();
          db.delete(cardIdentityTagging).run();
          db.delete(cardIdentityTagAlias).run();
          db.delete(cardIdentityTag).run();
        });
        timedFinalizationPhase(input.observer, "insert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_identity_tag (id, slug, label, description, source_page_uri)
            SELECT id, slug, label, description, source_page_uri
            FROM import_card_identity_tag
          `);
          db.run(sql`
            INSERT INTO card_identity_tag_alias (tag_id, alias)
            SELECT tag_id, alias FROM import_card_identity_tag_alias
          `);
          db.run(sql`
            INSERT INTO card_identity_tagging (tag_id, card_identity_id, weight, annotation)
            SELECT tag_id, card_identity_id, weight, annotation
            FROM import_card_identity_tagging
          `);
          db.run(sql`
            INSERT INTO card_identity_tag_hierarchy (parent_tag_id, child_tag_id)
            SELECT parent_tag_id, child_tag_id
            FROM import_card_identity_tag_hierarchy
          `);
        });

        const imported = timedFinalizationPhase(
          input.observer,
          "record_import_attempt",
          () =>
            insertImportRecord(
              db,
              "oracle_tags",
              "succeeded",
              { ...input, completedAt: clock.now(), importedRecordCount },
              [],
              [],
            ),
        );
        commitTransaction(db);
        return ok(imported);
      } catch (error) {
        rollbackTransaction(db);
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentities() {
      try {
        const rows = await db
          .select()
          .from(cardIdentity)
          .orderBy(cardIdentity.name);
        return ok(rows.map(toCardIdentity));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityTags() {
      try {
        const rows = await db.select().from(cardIdentityTag).orderBy(cardIdentityTag.slug);
        return ok(rows.map(toCardIdentityTag));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityParts() {
      try {
        const rows = await db
            .select()
            .from(cardIdentityPart)
            .orderBy(cardIdentityPart.cardIdentityId, cardIdentityPart.partIndex);
        return ok(rows.map(toCardIdentityPart));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityTagAliases() {
      try {
        const rows = await db
          .select()
          .from(cardIdentityTagAlias)
          .orderBy(cardIdentityTagAlias.tagId, cardIdentityTagAlias.alias);
        return ok(rows.map(toCardIdentityTagAlias));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityTaggings() {
      try {
        const rows = await db
          .select()
          .from(cardIdentityTagging)
          .orderBy(cardIdentityTagging.tagId, cardIdentityTagging.cardIdentityId);
        return ok(rows.map(toCardIdentityTagging));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityTagHierarchy() {
      try {
        const rows = await db
          .select()
          .from(cardIdentityTagHierarchy)
          .orderBy(cardIdentityTagHierarchy.parentTagId, cardIdentityTagHierarchy.childTagId);
        return ok(rows.map(toCardIdentityTagHierarchy));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardPrintings() {
      try {
        const rows = await db
          .select()
          .from(cardPrinting)
          .orderBy(cardPrinting.printedName, cardPrinting.setCode, cardPrinting.collectorNumber);
          const finishRows = await db.select().from(cardPrintingFinish);
          const finishesByPrinting = new Map<string, string[]>();
          for (const finish of finishRows) {
              const finishes = finishesByPrinting.get(finish.cardPrintingId) ?? [];
              finishes.push(finish.finish);
              finishesByPrinting.set(finish.cardPrintingId, finishes);
          }
          return ok(rows.map((row) => toCardPrinting(row, finishesByPrinting.get(row.id) ?? [])));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardPrintingParts() {
      try {
        const rows = await db
            .select()
            .from(cardPrintingPart)
            .orderBy(cardPrintingPart.cardPrintingId, cardPrintingPart.partIndex);
        return ok(rows.map(toCardPrintingPart));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityFormatLegalities() {
      try {
        const rows = await db
          .select()
          .from(cardIdentityFormatLegality)
          .orderBy(
            cardIdentityFormatLegality.cardIdentityId,
            cardIdentityFormatLegality.format,
          );
        return ok(rows.map(toCardIdentityFormatLegality));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listBulkDataImports() {
      try {
        const rows = await db
          .select()
          .from(scryfallBulkDataImport)
          .orderBy(scryfallBulkDataImport.startedAt);
        return ok(rows.map(toScryfallBulkDataImport));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async getLatestSuccessfulBulkDataImport(bulkDataType) {
      try {
        const [row] = await db
          .select()
          .from(scryfallBulkDataImport)
          .where(
            sql`${scryfallBulkDataImport.bulkDataType} = ${bulkDataType} AND ${scryfallBulkDataImport.status} = 'succeeded'`,
          )
          .orderBy(desc(scryfallBulkDataImport.completedAt))
          .limit(1);
        return ok(row ? toScryfallBulkDataImport(row) : null);
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async recordFailedBulkDataImport(bulkDataType, input) {
      return recordFailedImport(db, bulkDataType, input, input.blockingErrors);
    },
  };
}

type ScryfallImportRecordInput = {
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly sourceUpdatedAt?: Date | undefined;
  readonly sourceUri?: string | undefined;
  readonly importedRecordCount?: number | undefined;
};

async function recordFailedImport(
  db: MtgAgentDatabase,
  bulkDataType: ScryfallBulkDataType,
  input: ScryfallImportRecordInput,
  blockingErrors: readonly string[],
): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>> {
  try {
    const imported = insertImportRecord(
      db,
      bulkDataType,
      "failed",
      input,
      [],
      blockingErrors,
    );
    return ok(imported);
  } catch (error) {
    return err(toRepositoryError(error));
  }
}

function insertImportRecord<TRecord>(
  db: Pick<MtgAgentDatabase, "insert">,
  bulkDataType: ScryfallBulkDataType,
  status: "succeeded" | "failed",
  input: ScryfallImportRecordInput,
  warnings: readonly string[],
  blockingErrors: readonly string[],
): ScryfallBulkDataImport {
  const imported: ScryfallBulkDataImport = {
    id: randomUUIDv7("hex", input.startedAt.getTime()),
    bulkDataType,
    status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    sourceUri: input.sourceUri ?? null,
    importedRecordCount: status === "succeeded" ? input.importedRecordCount ?? 0 : 0,
    warnings,
    blockingErrors,
  };

  db.insert(scryfallBulkDataImport)
    .values({
      id: imported.id,
      bulkDataType: imported.bulkDataType,
      status: imported.status,
      startedAt: imported.startedAt,
      completedAt: imported.completedAt,
      sourceUpdatedAt: imported.sourceUpdatedAt,
      sourceUri: imported.sourceUri,
      importedRecordCount: imported.importedRecordCount,
      warningsJson: [...warnings],
      blockingErrorsJson: [...blockingErrors],
    })
    .run();

  return imported;
}

function beginTransaction(db: MtgAgentDatabase): void {
  db.run(sql`BEGIN IMMEDIATE`);
}

function commitTransaction(db: MtgAgentDatabase): void {
  db.run(sql`COMMIT`);
}

function rollbackTransaction(db: MtgAgentDatabase): void {
  try {
    db.run(sql`ROLLBACK`);
  } catch {
    // No active transaction remains when BEGIN itself fails.
  }
}

function emitStagedRecordCounter(
  observer: ScryfallImportObserver | undefined,
  stagedRecordCount: number,
  force = false,
): void {
  if (!observer || stagedRecordCount === 0) return;
  if (!force && stagedRecordCount % SCRYFALL_IMPORT_TIMING_RECORD_INTERVAL !== 0) return;

  observer.onEvent({ type: "record_staged", stagedRecordCount });
}

function timedFinalizationPhase<T>(
  observer: ScryfallImportObserver | undefined,
  phase: ScryfallFinalizationPhase,
  run: () => T,
): T {
  const startedAt = performance.now();
  observer?.onEvent({ type: "finalization_started", phase });
  try {
    return run();
  } finally {
    observer?.onEvent({
      type: "finalization_finished",
      phase,
      elapsedMs: performance.now() - startedAt,
    });
  }
}

function importRejection(blockingErrors: readonly string[]): Error {
  const error = new Error(blockingErrors.join(" "));
  Object.assign(error, { blockingErrors });
  return error;
}

function toCardIdentity(row: typeof cardIdentity.$inferSelect): CardIdentity {
  return {
    id: row.id,
    name: row.name,
    layout: CardIdentityLayoutSchema.parse(row.layout),
    manaCost: row.manaCost,
    manaValue: row.manaValue,
    typeLine: row.typeLine,
    oracleText: row.oracleText,
    colorIdentity: row.colorIdentity,
    colors: row.colors,
    colorIndicator: row.colorIndicator,
    producedMana: row.producedMana,
    keywords: asStringArray(row.keywordsJson),
    power: row.power,
    toughness: row.toughness,
    loyalty: row.loyalty,
    defense: row.defense,
    edhrecRank: row.edhrecRank,
    gameChanger: row.gameChanger,
    sourcePageUri: row.sourcePageUri,
  };
}

function toCardIdentityPart(row: typeof cardIdentityPart.$inferSelect): CardIdentityPart {
  return {
    cardIdentityId: row.cardIdentityId,
    partIndex: row.partIndex,
    name: row.name,
    manaCost: row.manaCost,
    typeLine: row.typeLine,
    oracleText: row.oracleText,
    colors: row.colors,
    colorIndicator: row.colorIndicator,
    power: row.power,
    toughness: row.toughness,
    loyalty: row.loyalty,
    defense: row.defense,
  };
}

function toCardIdentityFormatLegality(
  row: typeof cardIdentityFormatLegality.$inferSelect,
): CardIdentityFormatLegality {
  return {
    cardIdentityId: row.cardIdentityId,
    format: row.format,
    legality: row.legality,
  };
}

function toCardPrinting(row: typeof cardPrinting.$inferSelect, finishes: readonly string[]): CardPrinting {
  return {
    id: row.id,
    cardIdentityId: row.cardIdentityId,
    layout: row.layout,
    printedName: row.printedName,
    setCode: row.setCode,
    collectorNumber: row.collectorNumber,
      finishes,
    language: row.language,
    tcgplayerId: row.tcgplayerId,
    cardmarketId: row.cardmarketId,
    sourcePageUri: row.sourcePageUri,
  };
}

function toCardPrintingPart(row: typeof cardPrintingPart.$inferSelect): CardPrintingPart {
  return {
    cardPrintingId: row.cardPrintingId,
    partIndex: row.partIndex,
    printedName: row.printedName,
    flavorName: row.flavorName,
    printedTypeLine: row.printedTypeLine,
    printedText: row.printedText,
    flavorText: row.flavorText,
    artist: row.artist,
    artistId: row.artistId,
    illustrationId: row.illustrationId,
    imageUris: isStringRecord(row.imageUrisJson) ? row.imageUrisJson : null,
  };
}

function toCardIdentityTag(row: typeof cardIdentityTag.$inferSelect): CardIdentityTag {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    sourcePageUri: row.sourcePageUri,
  };
}

function toCardIdentityTagAlias(
  row: typeof cardIdentityTagAlias.$inferSelect,
): CardIdentityTagAlias {
  return {
    tagId: row.tagId,
    alias: row.alias,
  };
}

function toCardIdentityTagging(
  row: typeof cardIdentityTagging.$inferSelect,
): CardIdentityTagging {
  return {
    tagId: row.tagId,
    cardIdentityId: row.cardIdentityId,
    weight: row.weight,
    annotation: row.annotation,
  };
}

function toCardIdentityTagHierarchy(
  row: typeof cardIdentityTagHierarchy.$inferSelect,
): CardIdentityTagHierarchy {
  return {
    parentTagId: row.parentTagId,
    childTagId: row.childTagId,
  };
}

function toScryfallBulkDataImport(
  row: typeof scryfallBulkDataImport.$inferSelect,
): ScryfallBulkDataImport {
  return {
    id: row.id,
    bulkDataType: row.bulkDataType,
    status: row.status,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    sourceUpdatedAt: row.sourceUpdatedAt,
    sourceUri: row.sourceUri,
    importedRecordCount: row.importedRecordCount,
    warnings: asStringArray(row.warningsJson),
    blockingErrors: asStringArray(row.blockingErrorsJson),
  };
}

function asStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
      typeof value === "object" &&
      value !== null &&
      Object.values(value).every((item) => typeof item === "string")
  );
}

function toRepositoryError(error: unknown): ScryfallRepositoryError {
  const blockingErrors = getBlockingErrors(error);
  return {
    type: "repository_error",
    message: toErrorMessage(error),
    ...(blockingErrors ? { blockingErrors } : {}),
  };
}

function getBlockingErrors(error: unknown): readonly string[] | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    Array.isArray((error as { readonly blockingErrors?: unknown }).blockingErrors)
  ) {
    return (error as { readonly blockingErrors: readonly string[] }).blockingErrors;
  }

  return undefined;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
