import { err, type Result } from "neverthrow";
import { z } from "zod";
import {
  createScryfallSyncServices,
  type Clock,
  type ImportStatus,
  type ScryfallSyncError,
  type ScryfallSyncRequest,
  type ScryfallSyncSummary,
} from "./scryfall-sync";

export const CollectionSourceFormatSchema = z.literal("manabox_collection_csv");
export type CollectionSourceFormat = z.infer<typeof CollectionSourceFormatSchema>;

export const ManaBoxCollectionImportRequestSchema = z.object({
  sourceFormat: CollectionSourceFormatSchema,
  sourceLabel: z.string().min(1),
  csvText: z.string().min(1),
});
export type ManaBoxCollectionImportRequest = z.infer<
  typeof ManaBoxCollectionImportRequestSchema
>;

export type ImportServiceError =
  | {
      type: "validation_failed";
      message: string;
      issues: readonly string[];
    }
  | {
      type: "not_implemented";
      message: string;
    }
  | ScryfallSyncError;

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

export type ImportFoundationServices = {
  importManaBoxCollection(
    request: ManaBoxCollectionImportRequest,
  ): Promise<Result<ImportSummary, ImportServiceError>>;
  syncScryfallData(
    request: ScryfallSyncRequest,
  ): Promise<Result<ScryfallSyncSummary, ImportServiceError>>;
};

export function createImportFoundationServices(clock: Clock): ImportFoundationServices {
  const scryfallSyncServices = createScryfallSyncServices(
    {
      async getLatestSuccessfulBulkDataImport() {
        return err({
          type: "repository_error",
          message: "Scryfall repository is not configured.",
        });
      },
      async importCardIdentities() {
        return err({
          type: "repository_error",
          message: "Scryfall repository is not configured.",
        });
      },
      async importCardPrintings() {
        return err({
          type: "repository_error",
          message: "Scryfall repository is not configured.",
        });
      },
      async importCardIdentityTags() {
        return err({
          type: "repository_error",
          message: "Scryfall repository is not configured.",
        });
      },
      async recordFailedBulkDataImport() {
        return err({
          type: "repository_error",
          message: "Scryfall repository is not configured.",
        });
      },
    },
    clock,
  );

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
      return scryfallSyncServices.syncScryfallData(request);
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
