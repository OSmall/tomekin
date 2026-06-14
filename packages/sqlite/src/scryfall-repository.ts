import { randomUUIDv7 } from "bun";
import { desc, sql } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import type {
  CardIdentity,
  CardIdentityFormatLegality,
  CardIdentityImportRecord,
  CardPrinting,
  Clock,
  ScryfallBulkDataImport,
  ScryfallBulkDataType,
  ScryfallFinalizationPhase,
  ScryfallImportObserver,
  ScryfallBulkImportInput,
  ScryfallRepository,
  ScryfallRepositoryError,
} from "@mtg-agent/core";

import type { MtgAgentDatabase } from "./database";
import {
  cardIdentityFormatLegalities,
  cardIdentities,
  cardPrintings,
  scryfallBulkDataImports,
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
    input: ScryfallBulkImportInput<CardPrinting>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  listCardIdentities(): Promise<Result<readonly CardIdentity[], ScryfallRepositoryError>>;
  listCardPrintings(): Promise<Result<readonly CardPrinting[], ScryfallRepositoryError>>;
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
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identities`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identities (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            mana_cost TEXT,
            type_line TEXT NOT NULL,
            oracle_text TEXT,
            color_identity TEXT NOT NULL,
            source_page_uri TEXT NOT NULL
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_identity_format_legalities`);
        db.run(sql`
          CREATE TEMP TABLE import_card_identity_format_legalities (
            card_identity_id TEXT NOT NULL,
            format TEXT NOT NULL,
            legality TEXT NOT NULL,
            PRIMARY KEY (card_identity_id, format)
          )
        `);

        const insertIdentity = db.$client.prepare(`
          INSERT INTO import_card_identities (
            id,
            name,
            mana_cost,
            type_line,
            oracle_text,
            color_identity,
            source_page_uri
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        `);
        const insertLegality = db.$client.prepare(`
          INSERT INTO import_card_identity_format_legalities (
            card_identity_id,
            format,
            legality
          ) VALUES (?1, ?2, ?3)
        `);
        try {
          for await (const record of input.records) {
            const { identity, formatLegalities } = record;
            insertIdentity.run(
              identity.id,
              identity.name,
              identity.manaCost,
              identity.typeLine,
              identity.oracleText,
              identity.colorIdentity,
              identity.sourcePageUri,
            );
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
          insertIdentity.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);

        const orphaned = timedFinalizationPhase(
          input.observer,
          "orphaned_identity_check",
          () =>
            db.all<{ id: string }>(sql`
              SELECT DISTINCT card_identity_id AS id
              FROM card_printings
              WHERE card_identity_id NOT IN (SELECT id FROM import_card_identities)
            `),
        );
        if (orphaned.length > 0) {
          throw importRejection([
            `oracle_cards import would orphan existing Card Printings for Card Identity IDs: ${orphaned.map((row) => row.id).join(", ")}.`,
          ]);
        }

        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardIdentityFormatLegalities).run();
          db.run(sql`
            DELETE FROM card_identities
            WHERE id NOT IN (SELECT id FROM import_card_identities)
          `);
        });
        timedFinalizationPhase(input.observer, "upsert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_identities (
              id,
              name,
              mana_cost,
              type_line,
              oracle_text,
              color_identity,
              source_page_uri
            )
            SELECT
              id,
              name,
              mana_cost,
              type_line,
              oracle_text,
              color_identity,
              source_page_uri
            FROM import_card_identities
            WHERE true
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              mana_cost = excluded.mana_cost,
              type_line = excluded.type_line,
              oracle_text = excluded.oracle_text,
              color_identity = excluded.color_identity,
              source_page_uri = excluded.source_page_uri
          `);
          db.run(sql`
            INSERT INTO card_identity_format_legalities (
              card_identity_id,
              format,
              legality
            )
            SELECT
              card_identity_id,
              format,
              legality
            FROM import_card_identity_format_legalities
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
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_printings`);
        db.run(sql`
          CREATE TEMP TABLE import_card_printings (
            id TEXT PRIMARY KEY NOT NULL,
            card_identity_id TEXT NOT NULL,
            printed_name TEXT,
            set_code TEXT NOT NULL,
            collector_number TEXT NOT NULL,
            finishes_json TEXT NOT NULL,
            language TEXT NOT NULL,
            source_page_uri TEXT NOT NULL
          )
        `);

        const insertPrinting = db.$client.prepare(`
          INSERT INTO import_card_printings (
            id,
            card_identity_id,
            printed_name,
            set_code,
            collector_number,
            finishes_json,
            language,
            source_page_uri
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        `);
        try {
          for await (const record of input.records) {
            insertPrinting.run(
              record.id,
              record.cardIdentityId,
              record.printedName,
              record.setCode,
              record.collectorNumber,
              JSON.stringify(record.finishes),
              record.language,
              record.sourcePageUri,
            );
            importedRecordCount += 1;
            emitStagedRecordCounter(input.observer, importedRecordCount);
          }
        } finally {
          insertPrinting.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);

        const missingIdentityIds = timedFinalizationPhase(
          input.observer,
          "missing_identity_check",
          () =>
            db.all<{ id: string }>(sql`
              SELECT DISTINCT card_identity_id AS id
              FROM import_card_printings
              WHERE card_identity_id NOT IN (SELECT id FROM card_identities)
            `),
        );
        if (missingIdentityIds.length > 0) {
          throw importRejection([
            `all_cards import references missing Card Identity IDs: ${missingIdentityIds.map((row) => row.id).join(", ")}.`,
          ]);
        }

        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardPrintings).run();
        });
        timedFinalizationPhase(input.observer, "insert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_printings (
              id,
              card_identity_id,
              printed_name,
              set_code,
              collector_number,
              finishes_json,
              language,
              source_page_uri
            )
            SELECT
              id,
              card_identity_id,
              printed_name,
              set_code,
              collector_number,
              finishes_json,
              language,
              source_page_uri
            FROM import_card_printings
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

    async listCardIdentities() {
      try {
        const rows = await db
          .select()
          .from(cardIdentities)
          .orderBy(cardIdentities.name);
        return ok(rows.map(toCardIdentity));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardPrintings() {
      try {
        const rows = await db
          .select()
          .from(cardPrintings)
          .orderBy(cardPrintings.printedName, cardPrintings.setCode, cardPrintings.collectorNumber);
        return ok(rows.map(toCardPrinting));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardIdentityFormatLegalities() {
      try {
        const rows = await db
          .select()
          .from(cardIdentityFormatLegalities)
          .orderBy(
            cardIdentityFormatLegalities.cardIdentityId,
            cardIdentityFormatLegalities.format,
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
          .from(scryfallBulkDataImports)
          .orderBy(scryfallBulkDataImports.startedAt);
        return ok(rows.map(toScryfallBulkDataImport));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async getLatestSuccessfulBulkDataImport(bulkDataType) {
      try {
        const [row] = await db
          .select()
          .from(scryfallBulkDataImports)
          .where(
            sql`${scryfallBulkDataImports.bulkDataType} = ${bulkDataType} AND ${scryfallBulkDataImports.status} = 'succeeded'`,
          )
          .orderBy(desc(scryfallBulkDataImports.completedAt))
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

  db.insert(scryfallBulkDataImports)
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

function toCardIdentity(row: typeof cardIdentities.$inferSelect): CardIdentity {
  return {
    id: row.id,
    name: row.name,
    manaCost: row.manaCost,
    typeLine: row.typeLine,
    oracleText: row.oracleText,
    colorIdentity: row.colorIdentity,
    sourcePageUri: row.sourcePageUri,
  };
}

function toCardIdentityFormatLegality(
  row: typeof cardIdentityFormatLegalities.$inferSelect,
): CardIdentityFormatLegality {
  return {
    cardIdentityId: row.cardIdentityId,
    format: row.format,
    legality: row.legality,
  };
}

function toCardPrinting(row: typeof cardPrintings.$inferSelect): CardPrinting {
  return {
    id: row.id,
    cardIdentityId: row.cardIdentityId,
    printedName: row.printedName,
    setCode: row.setCode,
    collectorNumber: row.collectorNumber,
    finishes: asStringArray(row.finishesJson),
    language: row.language,
    sourcePageUri: row.sourcePageUri,
  };
}

function toScryfallBulkDataImport(
  row: typeof scryfallBulkDataImports.$inferSelect,
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
