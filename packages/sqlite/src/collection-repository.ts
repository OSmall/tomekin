import {randomUUIDv7} from "bun";
import {eq, sql} from "drizzle-orm";
import {err, ok, type Result} from "neverthrow";
import type {
    Clock,
    CollectionCardImportRecord,
    CollectionImportAttempt,
    CollectionImportRepository,
    CollectionLocationImportRecord,
    CollectionQueryRepository,
    CollectionRepositoryError,
    ResolvedCollectionCardPrinting,
} from "@mtg-agent/core";
import type {MtgAgentDatabase} from "./database";
import {
    cardIdentity,
    cardPrinting,
    cardPrintingFinish,
    collectionCard,
    collectionImport,
    collectionLocation,
    scryfallBulkDataImport,
} from "./schema";

export type SqliteCollectionRepository = CollectionImportRepository & CollectionQueryRepository & {
    listCollectionLocations(): Promise<Result<readonly CollectionLocationImportRecord[], CollectionRepositoryError>>;
    listCollectionCards(): Promise<Result<readonly CollectionCardImportRecord[], CollectionRepositoryError>>;
    listCollectionImports(): Promise<Result<readonly CollectionImportAttempt[], CollectionRepositoryError>>;
};

export function createSqliteCollectionRepository(
    db: MtgAgentDatabase,
    _clock: Clock,
): SqliteCollectionRepository {
    return {
        async hasRequiredReferenceData() {
            try {
                const rows = await db
                    .select({bulkDataType: scryfallBulkDataImport.bulkDataType})
                    .from(scryfallBulkDataImport)
                    .where(sql`${scryfallBulkDataImport.status} = 'succeeded' AND ${scryfallBulkDataImport.bulkDataType} IN ('oracle_cards', 'all_cards')`);
                const imported = new Set(rows.map((row) => row.bulkDataType));
                const missing = ["oracle_cards", "all_cards"].filter((type) => !imported.has(type as never));
                if (missing.length > 0) {
                    return err({
                        type: "repository_error",
                        message: `Collection import requires latest successful Scryfall imports: ${missing.join(", ")}.`
                    });
                }
                return ok(true);
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },

        async resolveCardPrintingById(id) {
            try {
                const [row] = await db
                    .select({
                        id: cardPrinting.id,
                        cardIdentityName: cardIdentity.name,
                        printedName: cardPrinting.printedName,
                        setCode: cardPrinting.setCode,
                        collectorNumber: cardPrinting.collectorNumber,
                        language: cardPrinting.language,
                    })
                    .from(cardPrinting)
                    .innerJoin(cardIdentity, eq(cardPrinting.cardIdentityId, cardIdentity.id))
                    .where(eq(cardPrinting.id, id))
                    .limit(1);
                if (!row) return ok(null);
                const finishes = await db
                    .select({finish: cardPrintingFinish.finish})
                    .from(cardPrintingFinish)
                    .where(eq(cardPrintingFinish.cardPrintingId, id));
                return ok({
                    ...row,
                    finishes: finishes.map((finish) => finish.finish)
                } satisfies ResolvedCollectionCardPrinting);
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },

        async replaceCollectionSnapshot(input) {
            try {
                beginTransaction(db);
                db.delete(collectionCard).run();
                db.delete(collectionLocation).run();
                for (const location of input.snapshot.locations) {
                    db.insert(collectionLocation).values(location).run();
                }
                for (const card of input.snapshot.cards) {
                    db.insert(collectionCard).values(card).run();
                }
                const attempt = insertCollectionImport(db, {
                    status: "succeeded",
                    sourcePath: input.sourcePath,
                    importedAt: input.importedAt,
                    importedRowCount: input.summary.importedRowCount,
                    totalQuantity: input.summary.totalQuantity,
                    locationCount: input.summary.locationCount,
                    binderCount: input.summary.binderCount,
                    deckCount: input.summary.deckCount,
                    warnings: input.warnings,
                    errors: [],
                });
                commitTransaction(db);
                return ok(attempt);
            } catch (error) {
                rollbackTransaction(db);
                return err(toRepositoryError(error));
            }
        },

        async recordFailedCollectionImport(input) {
            try {
                const attempt = insertCollectionImport(db, {
                    status: "failed",
                    sourcePath: input.sourcePath,
                    importedAt: input.importedAt,
                    importedRowCount: input.summary?.importedRowCount ?? 0,
                    totalQuantity: input.summary?.totalQuantity ?? 0,
                    locationCount: input.summary?.locationCount ?? 0,
                    binderCount: input.summary?.binderCount ?? 0,
                    deckCount: input.summary?.deckCount ?? 0,
                    warnings: input.warnings,
                    errors: input.errors,
                });
                return ok(attempt);
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },

        async listCollectionLocations() {
            try {
                const rows = await db.select().from(collectionLocation).orderBy(collectionLocation.type, collectionLocation.name);
                return ok(rows);
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },

        async listCollectionCards() {
            try {
                const rows = await db.select().from(collectionCard).orderBy(collectionCard.sourceRowNumber);
                return ok(rows);
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },

        async listCollectionImports() {
            try {
                const rows = await db.select().from(collectionImport).orderBy(collectionImport.importedAt);
                return ok(rows.map(toCollectionImportAttempt));
            } catch (error) {
                return err(toRepositoryError(error));
            }
        },
    };
}

function insertCollectionImport(
    db: Pick<MtgAgentDatabase, "insert">,
    input: {
        readonly status: "succeeded" | "failed";
        readonly sourcePath: string;
        readonly importedAt: Date;
        readonly importedRowCount: number;
        readonly totalQuantity: number;
        readonly locationCount: number;
        readonly binderCount: number;
        readonly deckCount: number;
        readonly warnings: readonly string[];
        readonly errors: readonly string[];
    },
): CollectionImportAttempt {
    const attempt: CollectionImportAttempt = {
        id: randomUUIDv7("hex", input.importedAt.getTime()),
        status: input.status,
        importedAt: input.importedAt,
        sourceFormat: "manabox_collection_csv",
        sourcePath: input.sourcePath,
        importedRowCount: input.status === "succeeded" ? input.importedRowCount : 0,
        totalQuantity: input.status === "succeeded" ? input.totalQuantity : 0,
        locationCount: input.status === "succeeded" ? input.locationCount : 0,
        binderCount: input.status === "succeeded" ? input.binderCount : 0,
        deckCount: input.status === "succeeded" ? input.deckCount : 0,
        warningCount: input.warnings.length,
        warnings: input.warnings,
        errors: input.errors,
    };

    db.insert(collectionImport)
        .values({
            id: attempt.id,
            status: attempt.status,
            importedAt: attempt.importedAt,
            sourceFormat: attempt.sourceFormat,
            sourceLabel: attempt.sourcePath,
            importedOwnedCardRows: attempt.importedRowCount,
            totalOwnedCardQuantity: attempt.totalQuantity,
            importedBinderCount: attempt.binderCount,
            inferredExistingDeckCount: attempt.deckCount,
            skippedManaBoxListsJson: [],
            validationErrorsJson: [...attempt.errors],
            warningsJson: [...attempt.warnings],
        })
        .run();

    return attempt;
}

function toCollectionImportAttempt(row: typeof collectionImport.$inferSelect): CollectionImportAttempt {
    const warnings = asStringArray(row.warningsJson);
    const errors = asStringArray(row.validationErrorsJson);
    return {
        id: row.id,
        status: row.status,
        importedAt: row.importedAt,
        sourceFormat: row.sourceFormat,
        sourcePath: row.sourceLabel,
        importedRowCount: row.importedOwnedCardRows,
        totalQuantity: row.totalOwnedCardQuantity,
        locationCount: row.importedBinderCount + row.inferredExistingDeckCount,
        binderCount: row.importedBinderCount,
        deckCount: row.inferredExistingDeckCount,
        warningCount: warnings.length,
        warnings,
        errors,
    };
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
    }
}

function asStringArray(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function toRepositoryError(error: unknown): CollectionRepositoryError {
    return {type: "repository_error", message: error instanceof Error ? error.message : String(error)};
}
