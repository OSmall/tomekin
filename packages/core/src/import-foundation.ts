import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export const CollectionSourceFormatSchema = z.literal("manabox_collection_csv");
export type CollectionSourceFormat = z.infer<typeof CollectionSourceFormatSchema>;

export const ScryfallBulkDataTypeSchema = z.enum([
  "oracle_cards",
  "all_cards",
  "oracle_tags",
]);
export type ScryfallBulkDataType = z.infer<typeof ScryfallBulkDataTypeSchema>;

export const ImportStatusSchema = z.enum(["succeeded", "failed"]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const ManaBoxCollectionImportRequestSchema = z.object({
  sourceFormat: CollectionSourceFormatSchema,
  sourceLabel: z.string().min(1),
  csvText: z.string().min(1),
});
export type ManaBoxCollectionImportRequest = z.infer<
  typeof ManaBoxCollectionImportRequestSchema
>;

export const ScryfallSyncRequestSchema = z.object({
  bulkDataTypes: z.array(ScryfallBulkDataTypeSchema).min(1),
});
export type ScryfallSyncRequest = z.infer<typeof ScryfallSyncRequestSchema>;

export type ImportServiceError =
  | {
      type: "validation_failed";
      message: string;
      issues: readonly string[];
    }
  | {
      type: "not_implemented";
      message: string;
    };

export type ImportSummary = {
  readonly status: ImportStatus;
  readonly sourceFormat: CollectionSourceFormat;
  readonly importedAt: Date;
  readonly sourceLabel: string;
  readonly importedOwnedCardRows: number;
  readonly totalOwnedCardQuantity: number;
  readonly importedBinderCount: number;
  readonly inferredExistingDeckCount: number;
  readonly skippedManaBoxLists: readonly string[];
  readonly validationErrors: readonly string[];
  readonly warnings: readonly string[];
};

export type ScryfallSyncSummary = {
  readonly status: ImportStatus;
  readonly syncedAt: Date;
  readonly bulkDataTypes: readonly ScryfallBulkDataType[];
  readonly importedRecordCounts: Readonly<Record<ScryfallBulkDataType, number>>;
  readonly validationErrors: readonly string[];
  readonly warnings: readonly string[];
};

export type Clock = {
  now(): Date;
};

export type ImportFoundationServices = {
  importManaBoxCollection(
    request: ManaBoxCollectionImportRequest,
  ): Promise<Result<ImportSummary, ImportServiceError>>;
  syncScryfallData(
    request: ScryfallSyncRequest,
  ): Promise<Result<ScryfallSyncSummary, ImportServiceError>>;
};

export function createImportFoundationServices(clock: Clock): ImportFoundationServices {
  return {
    async importManaBoxCollection(request) {
      const parsed = ManaBoxCollectionImportRequestSchema.safeParse(request);

      if (!parsed.success) {
        return err(toValidationError(parsed.error));
      }

      return err({
        type: "not_implemented",
        message:
          "ManaBox Collection import validation is defined, but row parsing and persistence are not implemented yet.",
      });
    },

    async syncScryfallData(request) {
      const parsed = ScryfallSyncRequestSchema.safeParse(request);

      if (!parsed.success) {
        return err(toValidationError(parsed.error));
      }

      return ok({
        status: "failed",
        syncedAt: clock.now(),
        bulkDataTypes: parsed.data.bulkDataTypes,
        importedRecordCounts: {
          oracle_cards: 0,
          all_cards: 0,
          oracle_tags: 0,
        },
        validationErrors: [
          "Scryfall bulk data download, validation, and persistence are not implemented yet.",
        ],
        warnings: [],
      });
    },
  };
}

function toValidationError(error: z.ZodError): ImportServiceError {
  return {
    type: "validation_failed",
    message: "Import request validation failed.",
    issues: error.issues.map((issue) => issue.message),
  };
}
