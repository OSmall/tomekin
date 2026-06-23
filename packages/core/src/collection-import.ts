import {parse} from "csv-parse/sync";
import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {randomUUIDv7} from "bun";
import type {Clock} from "./scryfall-sync";

export const collectionFinishValues = ["nonfoil", "foil", "etched"] as const;
export type CollectionFinish = (typeof collectionFinishValues)[number];
export type CollectionLocationType = "binder" | "deck";

export type CollectionLocationImportRecord = {
    readonly id: string;
    readonly name: string;
    readonly type: CollectionLocationType;
};

export type CollectionCardImportRecord = {
    readonly id: string;
    readonly quantity: number;
    readonly collectionLocationId: string;
    readonly finish: CollectionFinish;
    readonly manaBoxId: string | null;
    readonly cardPrintingId: string;
    readonly misprint: boolean;
    readonly altered: boolean;
    readonly condition: string | null;
    readonly purchasePriceCurrency: string | null;
    readonly purchasePrice: number | null;
    readonly addedAt: Date | null;
    readonly sourceRowNumber: number;
};

export type ResolvedCollectionCardPrinting = {
    readonly id: string;
    readonly cardIdentityName: string;
    readonly printedName: string | null;
    readonly setCode: string;
    readonly collectorNumber: string;
    readonly language: string;
    readonly finishes: readonly string[];
};

export type CollectionImportSnapshot = {
    readonly locations: readonly CollectionLocationImportRecord[];
    readonly cards: readonly CollectionCardImportRecord[];
};

export type CollectionImportSummary = {
    readonly sourcePath: string;
    readonly importedRowCount: number;
    readonly totalQuantity: number;
    readonly locationCount: number;
    readonly binderCount: number;
    readonly deckCount: number;
    readonly warningCount: number;
};

export type CollectionImportAttempt = CollectionImportSummary & {
    readonly id: string;
    readonly status: "succeeded" | "failed";
    readonly importedAt: Date;
    readonly sourceFormat: "manabox_collection_csv";
    readonly warnings: readonly string[];
    readonly errors: readonly string[];
};

export type CollectionRepositoryError = {
    readonly type: "repository_error";
    readonly message: string;
};

export type CollectionImportError =
    | { readonly type: "import_failed"; readonly message: string; readonly importAttempt: CollectionImportAttempt }
    | CollectionRepositoryError;

export type CollectionImportRepository = {
    hasRequiredReferenceData(): Promise<Result<true, CollectionRepositoryError>>;
    resolveCardPrintingById(id: string): Promise<Result<ResolvedCollectionCardPrinting | null, CollectionRepositoryError>>;
    replaceCollectionSnapshot(input: {
        readonly sourcePath: string;
        readonly importedAt: Date;
        readonly snapshot: CollectionImportSnapshot;
        readonly summary: Omit<CollectionImportSummary, "sourcePath" | "warningCount">;
        readonly warnings: readonly string[];
    }): Promise<Result<CollectionImportAttempt, CollectionRepositoryError>>;
    recordFailedCollectionImport(input: {
        readonly sourcePath: string;
        readonly importedAt: Date;
        readonly summary?: Partial<Omit<CollectionImportSummary, "sourcePath" | "warningCount">> | undefined;
        readonly warnings: readonly string[];
        readonly errors: readonly string[];
    }): Promise<Result<CollectionImportAttempt, CollectionRepositoryError>>;
};

export type CollectionImportServices = {
    importManaBoxCollectionCsv(input: {
        readonly sourcePath: string;
        readonly csvText: string;
    }): Promise<Result<CollectionImportAttempt, CollectionImportError>>;
};

const requiredHeaders = [
    "Binder Name",
    "Binder Type",
    "Name",
    "Set code",
    "Collector number",
    "Foil",
    "Quantity",
    "ManaBox ID",
    "Scryfall ID",
    "Purchase price",
    "Misprint",
    "Altered",
    "Condition",
    "Language",
    "Purchase price currency",
    "Added",
] as const;

const allowedHeaders = new Set<string>([...requiredHeaders, "Set name", "Rarity"]);
const uuidSchema = z.uuid();

export function createCollectionImportServices(
    repository: CollectionImportRepository,
    clock: Clock,
): CollectionImportServices {
    return {
        async importManaBoxCollectionCsv(input) {
            const importedAt = clock.now();
            const prerequisites = await repository.hasRequiredReferenceData();
            if (prerequisites.isErr()) {
                const recorded = await repository.recordFailedCollectionImport({
                    sourcePath: input.sourcePath,
                    importedAt,
                    warnings: [],
                    errors: [prerequisites.error.message],
                });
                return recorded.isErr() ? err(recorded.error) : failed(recorded.value);
            }

            const parsed = await parseManaBoxCollectionCsv(input.csvText, async (id) => {
                const resolved = await repository.resolveCardPrintingById(id);
                if (resolved.isErr()) throw new RepositoryLookupError(resolved.error.message);
                return resolved.value;
            });

            if (parsed.isErr()) {
                if (parsed.error.type === "repository_error") return err(parsed.error);
                const recorded = await repository.recordFailedCollectionImport({
                    sourcePath: input.sourcePath,
                    importedAt,
                    summary: parsed.error.summary,
                    warnings: parsed.error.warnings,
                    errors: parsed.error.errors,
                });
                return recorded.isErr() ? err(recorded.error) : failed(recorded.value);
            }

            const saved = await repository.replaceCollectionSnapshot({
                sourcePath: input.sourcePath,
                importedAt,
                snapshot: parsed.value.snapshot,
                summary: parsed.value.summary,
                warnings: parsed.value.warnings,
            });
            if (saved.isErr()) return err(saved.error);
            return ok(saved.value);
        },
    };
}

type ParseSuccess = {
    readonly snapshot: CollectionImportSnapshot;
    readonly summary: Omit<CollectionImportSummary, "sourcePath" | "warningCount">;
    readonly warnings: readonly string[];
};

type ParseFailure = {
    readonly type: "validation_failed";
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
    readonly summary: Partial<Omit<CollectionImportSummary, "sourcePath" | "warningCount">>;
};

export async function parseManaBoxCollectionCsv(
    csvText: string,
    resolvePrinting: (id: string) => Promise<ResolvedCollectionCardPrinting | null>,
): Promise<Result<ParseSuccess, ParseFailure | CollectionRepositoryError>> {
    let rows: Record<string, string>[];
    try {
        rows = parse(csvText, {columns: true, bom: true, skip_empty_lines: true, trim: false});
    } catch (error) {
        return err({
            type: "validation_failed",
            errors: [`CSV parse error: ${toErrorMessage(error)}.`],
            warnings: [],
            summary: {}
        });
    }

    const headerRows = parse(csvText, {bom: true, to_line: 1, trim: false}) as string[][];
    const headers = headerRows[0] ?? [];
    const warnings: string[] = [];
    const errors: string[] = [];
    for (const header of requiredHeaders) {
        if (!headers.includes(header)) errors.push(`Missing required CSV header: ${header}.`);
    }
    for (const header of headers) {
        if (!allowedHeaders.has(header)) warnings.push(`Ignoring extra CSV header: ${header}.`);
    }
    if (errors.length > 0) return err({
        type: "validation_failed",
        errors,
        warnings,
        summary: {importedRowCount: rows.length}
    });

    const locations = new Map<string, CollectionLocationImportRecord>();
    const cards: CollectionCardImportRecord[] = [];
    let totalQuantity = 0;

    for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]!;
        const rowNumber = index + 2;
        const locationName = value(row, "Binder Name");
        const locationType = value(row, "Binder Type");
        const quantity = parsePositiveInteger(value(row, "Quantity"));
        const finish = normalizeFinish(value(row, "Foil"));
        const scryfallId = value(row, "Scryfall ID");
        const misprint = parseBoolean(value(row, "Misprint"));
        const altered = parseBoolean(value(row, "Altered"));
        const purchase = parsePurchasePrice(value(row, "Purchase price"));
        const added = parseAddedAt(value(row, "Added"));
        const currency = value(row, "Purchase price currency").toUpperCase() || null;
        const manaBoxId = value(row, "ManaBox ID") || null;

        if (!locationName) errors.push(rowError(rowNumber, "Binder Name must not be blank."));
        if (locationType !== "binder" && locationType !== "deck") errors.push(rowError(rowNumber, `Binder Type must be binder or deck, got ${JSON.stringify(locationType)}.`));
        if (quantity === null) errors.push(rowError(rowNumber, "Quantity must be a positive integer."));
        if (finish === null) errors.push(rowError(rowNumber, "Foil must be normal, foil, or etched."));
        if (misprint === null) errors.push(rowError(rowNumber, "Misprint must be true or false."));
        if (altered === null) errors.push(rowError(rowNumber, "Altered must be true or false."));
        if (!uuidSchema.safeParse(scryfallId).success) errors.push(rowError(rowNumber, "Scryfall ID must be a UUID."));
        if (!manaBoxId) warnings.push(rowWarning(rowNumber, "ManaBox ID is blank."));
        if (purchase.warning) warnings.push(rowWarning(rowNumber, purchase.warning));
        if (added.warning) warnings.push(rowWarning(rowNumber, added.warning));

        let printing: ResolvedCollectionCardPrinting | null = null;
        if (uuidSchema.safeParse(scryfallId).success) {
            try {
                printing = await resolvePrinting(scryfallId);
            } catch (error) {
                if (error instanceof RepositoryLookupError) return err({
                    type: "repository_error",
                    message: error.message
                });
                throw error;
            }
            if (!printing) errors.push(rowError(rowNumber, `Scryfall ID ${scryfallId} was not found in local Card Printings.`));
        }

        if (printing) {
            if (value(row, "Set code").toLowerCase() !== printing.setCode.toLowerCase()) errors.push(rowError(rowNumber, `Set code disagrees with local Card Printing ${printing.id}.`));
            if (value(row, "Collector number") !== printing.collectorNumber) errors.push(rowError(rowNumber, `Collector number disagrees with local Card Printing ${printing.id}.`));
            if (value(row, "Language") !== printing.language) errors.push(rowError(rowNumber, `Language disagrees with local Card Printing ${printing.id}.`));
            if (finish && !printing.finishes.includes(finish)) errors.push(rowError(rowNumber, `Finish ${finish} is not available for local Card Printing ${printing.id}.`));
            const sourceName = value(row, "Name");
            const localNames = [printing.cardIdentityName, printing.printedName].filter((name): name is string => !!name);
            if (sourceName && !localNames.some((name) => name.toLowerCase() === sourceName.toLowerCase())) warnings.push(rowWarning(rowNumber, `Name ${JSON.stringify(sourceName)} differs from local Card Printing name.`));
        }

        if (locationName && (locationType === "binder" || locationType === "deck") && quantity && finish && misprint !== null && altered !== null && printing) {
            const locationKey = `${locationType}\0${locationName}`;
            let location = locations.get(locationKey);
            if (!location) {
                location = {id: randomUUIDv7(), name: locationName, type: locationType};
                locations.set(locationKey, location);
            }
            cards.push({
                id: randomUUIDv7(),
                quantity,
                collectionLocationId: location.id,
                finish,
                manaBoxId,
                cardPrintingId: printing.id,
                misprint,
                altered,
                condition: value(row, "Condition") || null,
                purchasePriceCurrency: currency,
                purchasePrice: purchase.value,
                addedAt: added.value,
                sourceRowNumber: rowNumber,
            });
            totalQuantity += quantity;
        }
    }

    const locationList = [...locations.values()];
    const summary = {
        importedRowCount: rows.length,
        totalQuantity,
        locationCount: locationList.length,
        binderCount: locationList.filter((location) => location.type === "binder").length,
        deckCount: locationList.filter((location) => location.type === "deck").length,
    };

    if (errors.length > 0) return err({type: "validation_failed", errors, warnings, summary});
    return ok({snapshot: {locations: locationList, cards}, summary, warnings});
}

function value(row: Record<string, string>, key: string): string {
    return (row[key] ?? "").trim();
}

function normalizeFinish(input: string): CollectionFinish | null {
    if (input === "normal") return "nonfoil";
    return collectionFinishValues.includes(input as CollectionFinish) ? (input as CollectionFinish) : null;
}

function parsePositiveInteger(input: string): number | null {
    if (!/^\d+$/.test(input)) return null;
    const value = Number(input);
    return value > 0 ? value : null;
}

function parseBoolean(input: string): boolean | null {
    if (input === "true") return true;
    if (input === "false") return false;
    return null;
}

function parsePurchasePrice(input: string): { readonly value: number | null; readonly warning?: string | undefined } {
    if (!input) return {value: null};
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0) return {
        value: null,
        warning: `Purchase price ${JSON.stringify(input)} is malformed or negative; stored null.`
    };
    return {value};
}

function parseAddedAt(input: string): { readonly value: Date | null; readonly warning?: string | undefined } {
    if (!input) return {value: null};
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return {
        value: null,
        warning: `Added timestamp ${JSON.stringify(input)} is malformed; stored null.`
    };
    return {value: date};
}

function rowError(rowNumber: number, message: string): string {
    return `Row ${rowNumber}: ${message}`;
}

function rowWarning(rowNumber: number, message: string): string {
    return `Row ${rowNumber}: ${message}`;
}

function failed(importAttempt: CollectionImportAttempt): Result<CollectionImportAttempt, CollectionImportError> {
    return err({
        type: "import_failed",
        message: importAttempt.errors.join(" ") || "Collection import failed.",
        importAttempt
    });
}

class RepositoryLookupError extends Error {
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
