import { desc, notInArray, sql } from "drizzle-orm";
import { err, ok, type Result } from "neverthrow";
import type {
  CardIdentity,
  CardPrinting,
  ScryfallBulkDataImport,
  ScryfallBulkDataType,
  ScryfallRepository,
  ScryfallRepositoryError,
} from "@mtg-agent/core";

import type { MtgAgentDatabase } from "./database";
import {
  cardIdentities,
  cardPrintings,
  scryfallBulkDataImports,
} from "./schema";

export type ScryfallBulkImportInput<TRecord> = {
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly sourceUpdatedAt?: Date;
  readonly sourceUri?: string;
  readonly records: readonly TRecord[];
};

export type SqliteScryfallRepository = ScryfallRepository & {
  importCardIdentities(
    input: ScryfallBulkImportInput<CardIdentity>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
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
): SqliteScryfallRepository {
  return {
    async importCardIdentities(input) {
      const duplicateIds = findDuplicateIds(input.records);
      if (duplicateIds.length > 0) {
        return recordFailedImport(db, "oracle_cards", input, [
          `Duplicate Card Identity IDs: ${duplicateIds.join(", ")}.`,
        ]);
      }

      const newIds = input.records.map((record) => record.id);
      const orphanedPrintingIdentityIds = await findPrintingIdentityIdsOutside(
        db,
        newIds,
      );
      if (orphanedPrintingIdentityIds.length > 0) {
        return recordFailedImport(db, "oracle_cards", input, [
          `oracle_cards import would orphan existing Card Printings for Card Identity IDs: ${orphanedPrintingIdentityIds.join(", ")}.`,
        ]);
      }

      try {
        const imported = db.transaction((tx) => {
          if (newIds.length > 0) {
            tx.delete(cardIdentities)
              .where(notInArray(cardIdentities.id, newIds))
              .run();
          } else {
            tx.delete(cardIdentities).run();
          }

          for (const record of input.records) {
            tx.run(sql`
              INSERT INTO card_identities (
                id,
                name,
                mana_cost,
                type_line,
                oracle_text,
                color_identity_json,
                commander_legality
              )
              VALUES (
                ${record.id},
                ${record.name},
                ${record.manaCost},
                ${record.typeLine},
                ${record.oracleText},
                ${JSON.stringify(record.colorIdentity)},
                ${record.commanderLegality}
              )
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                mana_cost = excluded.mana_cost,
                type_line = excluded.type_line,
                oracle_text = excluded.oracle_text,
                color_identity_json = excluded.color_identity_json,
                commander_legality = excluded.commander_legality
            `);
          }

          return insertImportRecord(tx, "oracle_cards", "succeeded", input, [], []);
        });
        return ok(imported);
      } catch (error) {
        return recordFailedImport(db, "oracle_cards", input, [toErrorMessage(error)]);
      }
    },

    async importCardPrintings(input) {
      const duplicateIds = findDuplicateIds(input.records);
      if (duplicateIds.length > 0) {
        return recordFailedImport(db, "all_cards", input, [
          `Duplicate Card Printing IDs: ${duplicateIds.join(", ")}.`,
        ]);
      }

      const identityIds = new Set(
        (await db.select({ id: cardIdentities.id }).from(cardIdentities)).map(
          (row) => row.id,
        ),
      );
      const missingIdentityIds = [
        ...new Set(
          input.records
            .filter((record) => !identityIds.has(record.cardIdentityId))
            .map((record) => record.cardIdentityId),
        ),
      ];

      if (missingIdentityIds.length > 0) {
        return recordFailedImport(db, "all_cards", input, [
          `all_cards import references missing Card Identity IDs: ${missingIdentityIds.join(", ")}.`,
        ]);
      }

      try {
        const imported = db.transaction((tx) => {
          tx.delete(cardPrintings).run();

          for (const record of input.records) {
            tx.insert(cardPrintings)
              .values({
                id: record.id,
                cardIdentityId: record.cardIdentityId,
                name: record.name,
                setCode: record.setCode,
                collectorNumber: record.collectorNumber,
                finishesJson: [...record.finishes],
                language: record.language,
              })
              .run();
          }

          return insertImportRecord(tx, "all_cards", "succeeded", input, [], []);
        });
        return ok(imported);
      } catch (error) {
        return recordFailedImport(db, "all_cards", input, [toErrorMessage(error)]);
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
          .orderBy(cardPrintings.name, cardPrintings.setCode, cardPrintings.collectorNumber);
        return ok(rows.map(toCardPrinting));
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
  };
}

async function findPrintingIdentityIdsOutside(
  db: MtgAgentDatabase,
  identityIds: readonly string[],
): Promise<readonly string[]> {
  const rows =
    identityIds.length > 0
      ? await db
          .selectDistinct({ id: cardPrintings.cardIdentityId })
          .from(cardPrintings)
          .where(notInArray(cardPrintings.cardIdentityId, [...identityIds]))
      : await db.selectDistinct({ id: cardPrintings.cardIdentityId }).from(cardPrintings);

  return rows.map((row) => row.id);
}

async function recordFailedImport<TRecord>(
  db: MtgAgentDatabase,
  bulkDataType: ScryfallBulkDataType,
  input: ScryfallBulkImportInput<TRecord>,
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
  input: ScryfallBulkImportInput<TRecord>,
  warnings: readonly string[],
  blockingErrors: readonly string[],
): ScryfallBulkDataImport {
  const imported: ScryfallBulkDataImport = {
    id: crypto.randomUUID(),
    bulkDataType,
    status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    sourceUri: input.sourceUri ?? null,
    importedRecordCount: status === "succeeded" ? input.records.length : 0,
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

function findDuplicateIds(records: readonly { readonly id: string }[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    if (seen.has(record.id)) {
      duplicates.add(record.id);
    }
    seen.add(record.id);
  }

  return [...duplicates];
}

function toCardIdentity(row: typeof cardIdentities.$inferSelect): CardIdentity {
  return {
    id: row.id,
    name: row.name,
    manaCost: row.manaCost,
    typeLine: row.typeLine,
    oracleText: row.oracleText,
    colorIdentity: asStringArray(row.colorIdentityJson),
    commanderLegality: row.commanderLegality,
  };
}

function toCardPrinting(row: typeof cardPrintings.$inferSelect): CardPrinting {
  return {
    id: row.id,
    cardIdentityId: row.cardIdentityId,
    name: row.name,
    setCode: row.setCode,
    collectorNumber: row.collectorNumber,
    finishes: asStringArray(row.finishesJson),
    language: row.language,
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
  return {
    type: "repository_error",
    message: toErrorMessage(error),
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
