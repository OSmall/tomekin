import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

export const ScryfallBulkDataTypeSchema = z.enum([
  "oracle_cards",
  "all_cards",
  "oracle_tags",
]);
export type ScryfallBulkDataType = z.infer<typeof ScryfallBulkDataTypeSchema>;

export const ImportStatusSchema = z.enum(["succeeded", "failed"]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const CommanderLegalitySchema = z.enum([
  "legal",
  "not_legal",
  "banned",
  "restricted",
]);
export type CommanderLegality = z.infer<typeof CommanderLegalitySchema>;

export const CardIdentitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  manaCost: z.string().nullable(),
  typeLine: z.string().min(1),
  oracleText: z.string().nullable(),
  colorIdentity: z.array(z.string()).readonly(),
  commanderLegality: CommanderLegalitySchema.nullable(),
});
export type CardIdentity = z.infer<typeof CardIdentitySchema>;

export const CardPrintingSchema = z.object({
  id: z.string().min(1),
  cardIdentityId: z.string().min(1),
  name: z.string().min(1),
  setCode: z.string().min(1),
  collectorNumber: z.string().min(1),
  finishes: z.array(z.string()).readonly(),
  language: z.string().min(1).nullable(),
});
export type CardPrinting = z.infer<typeof CardPrintingSchema>;

export const RawScryfallOracleCardSchema = z
  .object({
    object: z.literal("card"),
    id: z.string().min(1),
    oracle_id: z.string().min(1),
    name: z.string().min(1),
    mana_cost: z.string().optional(),
    type_line: z.string().min(1),
    oracle_text: z.string().optional(),
    color_identity: z.array(z.string()),
    legalities: z
      .object({
        commander: CommanderLegalitySchema.optional(),
      })
      .passthrough(),
  })
  .passthrough();
export type RawScryfallOracleCard = z.infer<typeof RawScryfallOracleCardSchema>;

export const RawScryfallAllCardSchema = RawScryfallOracleCardSchema.extend({
  set: z.string().min(1),
  collector_number: z.string().min(1),
  finishes: z.array(z.string()),
  lang: z.string().min(1),
});
export type RawScryfallAllCard = z.infer<typeof RawScryfallAllCardSchema>;

export function mapRawScryfallOracleCardToCardIdentity(
  card: RawScryfallOracleCard,
): CardIdentity {
  return {
    id: card.oracle_id,
    name: card.name,
    manaCost: card.mana_cost ?? null,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? null,
    colorIdentity: card.color_identity,
    commanderLegality: card.legalities.commander ?? null,
  };
}

export function mapRawScryfallAllCardToCardPrinting(
  card: RawScryfallAllCard,
): CardPrinting {
  return {
    id: card.id,
    cardIdentityId: card.oracle_id,
    name: card.name,
    setCode: card.set,
    collectorNumber: card.collector_number,
    finishes: card.finishes,
    language: card.lang,
  };
}

export const ScryfallBulkDataImportSchema = z.object({
  id: z.string().min(1),
  bulkDataType: ScryfallBulkDataTypeSchema,
  status: ImportStatusSchema,
  startedAt: z.date(),
  completedAt: z.date().nullable(),
  sourceUpdatedAt: z.date().nullable(),
  sourceUri: z.string().nullable(),
  importedRecordCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).readonly(),
  blockingErrors: z.array(z.string()).readonly(),
});
export type ScryfallBulkDataImport = z.infer<typeof ScryfallBulkDataImportSchema>;

export const ScryfallSyncRequestSchema = z.object({
  bulkDataTypes: z.array(ScryfallBulkDataTypeSchema).min(1),
});
export type ScryfallSyncRequest = z.infer<typeof ScryfallSyncRequestSchema>;

export type ScryfallRepositoryError = {
  readonly type: "repository_error";
  readonly message: string;
};

export type ScryfallSyncError =
  | {
      readonly type: "validation_failed";
      readonly message: string;
      readonly issues: readonly string[];
    }
  | {
      readonly type: "missing_required_scryfall_datasets";
      readonly message: string;
      readonly missingBulkDataTypes: readonly ScryfallBulkDataType[];
    }
  | {
      readonly type: "not_implemented";
      readonly message: string;
    }
  | ScryfallRepositoryError;

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

export type ScryfallRepository = {
  getLatestSuccessfulBulkDataImport(
    bulkDataType: ScryfallBulkDataType,
  ): Promise<Result<ScryfallBulkDataImport | null, ScryfallRepositoryError>>;
};

export type ScryfallSyncServices = {
  syncScryfallData(
    request: ScryfallSyncRequest,
  ): Promise<Result<ScryfallSyncSummary, ScryfallSyncError>>;
  requireCardReferenceData(): Promise<Result<true, ScryfallSyncError>>;
};

export function createScryfallSyncServices(
  repository: ScryfallRepository,
  clock: Clock,
): ScryfallSyncServices {
  return {
    async syncScryfallData(request) {
      const parsed = ScryfallSyncRequestSchema.safeParse(request);

      if (!parsed.success) {
        return err(toValidationError(parsed.error));
      }

      return err({
        type: "not_implemented",
        message:
          "Live Scryfall downloads are intentionally not implemented in this slice. Import local fixture data through a Scryfall repository implementation.",
      });
    },

    async requireCardReferenceData() {
      const required: readonly ScryfallBulkDataType[] = [
        "oracle_cards",
        "all_cards",
      ];
      const missing: ScryfallBulkDataType[] = [];

      for (const bulkDataType of required) {
        const latest = await repository.getLatestSuccessfulBulkDataImport(
          bulkDataType,
        );
        if (latest.isErr()) {
          return err(latest.error);
        }
        if (latest.value === null) {
          missing.push(bulkDataType);
        }
      }

      if (missing.length > 0) {
        return err({
          type: "missing_required_scryfall_datasets",
          message: `Missing required Scryfall datasets: ${missing.join(", ")}.`,
          missingBulkDataTypes: missing,
        });
      }

      return ok(true);
    },
  };
}

function toValidationError(error: z.ZodError): ScryfallSyncError {
  return {
    type: "validation_failed",
    message: "Scryfall sync request validation failed.",
    issues: error.issues.map((issue) => issue.message),
  };
}
