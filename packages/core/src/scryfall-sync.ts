import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {parseJsonArrayItems} from "./scryfall-json-source";

const MAX_SOURCE_FORMAT_DIAGNOSTICS = 20;
const SCRYFALL_IMPORT_TIMING_RECORD_INTERVAL = 25_000;

export type ScryfallFinalizationPhase =
  | "missing_identity_check"
  | "orphaned_identity_check"
  | "delete_existing_records"
  | "insert_from_staging"
  | "upsert_from_staging"
  | "record_import_attempt";

export type ScryfallImportEvent =
  | {
      readonly type: "source_bytes_consumed";
      readonly bytesConsumed: number;
      readonly totalBytes?: number | undefined;
    }
  | { readonly type: "raw_record_parsed"; readonly rawRecordCount: number }
  | { readonly type: "record_mapped"; readonly mappedRecordCount: number }
  | {
      readonly type: "source_validation_failed";
      readonly validationErrorCount: number;
    }
  | { readonly type: "record_staged"; readonly stagedRecordCount: number }
  | {
      readonly type: "finalization_started";
      readonly phase: ScryfallFinalizationPhase;
    }
  | {
      readonly type: "finalization_finished";
      readonly phase: ScryfallFinalizationPhase;
      readonly elapsedMs: number;
    };

export type ScryfallImportObserver = {
  onEvent(event: ScryfallImportEvent): void;
};

export const ScryfallBulkDataTypeSchema = z.enum([
  "oracle_cards",
  "all_cards",
  "oracle_tags",
]);
export type ScryfallBulkDataType = z.infer<typeof ScryfallBulkDataTypeSchema>;

export const ImportStatusSchema = z.enum(["succeeded", "failed"]);
export type ImportStatus = z.infer<typeof ImportStatusSchema>;

export const formatLegalityValues = [
  "legal",
  "not_legal",
  "banned",
  "restricted",
] as const;

export const FormatLegalitySchema = z.enum(formatLegalityValues);
export type FormatLegality = z.infer<typeof FormatLegalitySchema>;

export const colorIdentityValues = [
  "",
  "W",
  "U",
  "B",
  "R",
  "G",
  "WU",
  "WB",
  "WR",
  "WG",
  "UB",
  "UR",
  "UG",
  "BR",
  "BG",
  "RG",
  "WUB",
  "WUR",
  "WUG",
  "WBR",
  "WBG",
  "WRG",
  "UBR",
  "UBG",
  "URG",
  "BRG",
  "WUBR",
  "WUBG",
  "WURG",
  "WBRG",
  "UBRG",
  "WUBRG",
] as const;

export const ColorIdentitySchema = z.enum(colorIdentityValues);
export type ColorIdentity = z.infer<typeof ColorIdentitySchema>;

const colorIdentityOrder = ["W", "U", "B", "R", "G"] as const;
const colorIdentitySymbols = new Set<string>(colorIdentityOrder);
const producedManaOrder = ["W", "U", "B", "R", "G", "C", "T"] as const;
const producedManaSymbols = new Set<string>(producedManaOrder);

const cardIdentityLayoutValues = [
    "normal",
    "split",
    "flip",
    "transform",
    "modal_dfc",
    "meld",
    "leveler",
    "class",
    "case",
    "saga",
    "adventure",
    "prepare",
    "mutate",
    "prototype",
    "battle",
    "planar",
    "scheme",
    "vanguard",
    "token",
    "double_faced_token",
    "emblem",
    "augment",
    "host",
    "art_series",
    "reversible_card",
] as const;

const cardPrintingLayoutValues = ["standard", "reversible_card"] as const;

export const CardIdentityLayoutSchema = z
    .enum(cardIdentityLayoutValues)
    .refine((layout) => layout !== "reversible_card", {
        message: "reversible_card is a Card Printing layout, not a Card Identity layout.",
    });
export type CardIdentityLayout = z.infer<typeof CardIdentityLayoutSchema>;

export const CardPrintingLayoutSchema = z.enum(cardPrintingLayoutValues);
export type CardPrintingLayout = z.infer<typeof CardPrintingLayoutSchema>;

const NullableColorScalarSchema = ColorIdentitySchema.nullable();

export const CardIdentitySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
    layout: CardIdentityLayoutSchema,
  manaCost: z.string().nullable(),
  manaValue: z.number(),
  typeLine: z.string().min(1),
  oracleText: z.string().nullable(),
  colorIdentity: ColorIdentitySchema,
    colors: NullableColorScalarSchema,
    colorIndicator: NullableColorScalarSchema,
    producedMana: z.string().nullable(),
    keywords: z.array(z.string()).readonly(),
    power: z.string().nullable(),
    toughness: z.string().nullable(),
    loyalty: z.string().nullable(),
    defense: z.string().nullable(),
    edhrecRank: z.number().int().nullable(),
    gameChanger: z.boolean().nullable(),
  sourcePageUri: z.url(),
});
export type CardIdentity = z.infer<typeof CardIdentitySchema>;

export const CardIdentityPartSchema = z.object({
    cardIdentityId: z.uuid(),
    partIndex: z.number().int().nonnegative(),
    name: z.string().min(1),
    manaCost: z.string().nullable(),
    typeLine: z.string().min(1).nullable(),
    oracleText: z.string().nullable(),
    colors: NullableColorScalarSchema,
    colorIndicator: NullableColorScalarSchema,
    power: z.string().nullable(),
    toughness: z.string().nullable(),
    loyalty: z.string().nullable(),
    defense: z.string().nullable(),
});
export type CardIdentityPart = z.infer<typeof CardIdentityPartSchema>;

export const CardIdentityFormatLegalitySchema = z.object({
  cardIdentityId: z.uuid(),
  format: z.string().min(1),
  legality: FormatLegalitySchema,
});
export type CardIdentityFormatLegality = z.infer<
  typeof CardIdentityFormatLegalitySchema
>;

export const CardIdentityImportRecordSchema = z.object({
  identity: CardIdentitySchema,
    parts: z.array(CardIdentityPartSchema).readonly(),
  formatLegalities: z.array(CardIdentityFormatLegalitySchema).readonly(),
});
export type CardIdentityImportRecord = z.infer<
  typeof CardIdentityImportRecordSchema
>;

export const CardPrintingSchema = z.object({
  id: z.uuid(),
  cardIdentityId: z.uuid(),
    layout: CardPrintingLayoutSchema,
  printedName: z.string().min(1).nullable(),
  setCode: z.string().min(1),
  collectorNumber: z.string().min(1),
  finishes: z.array(z.string()).readonly(),
  language: z.string().min(1),
    tcgplayerId: z.number().int().nullable(),
    cardmarketId: z.number().int().nullable(),
  sourcePageUri: z.url(),
});
export type CardPrinting = z.infer<typeof CardPrintingSchema>;

export const CardPrintingPartSchema = z.object({
    cardPrintingId: z.uuid(),
    partIndex: z.number().int().nonnegative(),
    printedName: z.string().min(1).nullable(),
    flavorName: z.string().min(1).nullable(),
    printedTypeLine: z.string().min(1).nullable(),
    printedText: z.string().nullable(),
    flavorText: z.string().nullable(),
    artist: z.string().min(1).nullable(),
    artistId: z.uuid().nullable(),
    illustrationId: z.uuid().nullable(),
    imageUris: z.record(z.string(), z.string()).nullable(),
});
export type CardPrintingPart = z.infer<typeof CardPrintingPartSchema>;

export const CardPrintingImportRecordSchema = z.object({
    printing: CardPrintingSchema,
    parts: z.array(CardPrintingPartSchema).readonly(),
});
export type CardPrintingImportRecord = z.infer<typeof CardPrintingImportRecordSchema>;

export const cardIdentityTaggingWeightValues = [
  "very_strong",
  "strong",
  "median",
  "weak",
] as const;

export const CardIdentityTaggingWeightSchema = z.enum(
  cardIdentityTaggingWeightValues,
);
export type CardIdentityTaggingWeight = z.infer<
  typeof CardIdentityTaggingWeightSchema
>;

export const CardIdentityTagSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable(),
  sourcePageUri: z.url(),
});
export type CardIdentityTag = z.infer<typeof CardIdentityTagSchema>;

export const CardIdentityTagAliasSchema = z.object({
  tagId: z.uuid(),
  alias: z.string().min(1),
});
export type CardIdentityTagAlias = z.infer<typeof CardIdentityTagAliasSchema>;

export const CardIdentityTaggingSchema = z.object({
  tagId: z.uuid(),
  cardIdentityId: z.uuid(),
  weight: CardIdentityTaggingWeightSchema,
  annotation: z.string().nullable(),
});
export type CardIdentityTagging = z.infer<typeof CardIdentityTaggingSchema>;

export const CardIdentityTagHierarchySchema = z.object({
  parentTagId: z.uuid(),
  childTagId: z.uuid(),
});
export type CardIdentityTagHierarchy = z.infer<
  typeof CardIdentityTagHierarchySchema
>;

export const CardIdentityTagImportRecordSchema = z.object({
  tag: CardIdentityTagSchema,
  aliases: z.array(CardIdentityTagAliasSchema).readonly(),
  taggings: z.array(CardIdentityTaggingSchema).readonly(),
  hierarchy: z.array(CardIdentityTagHierarchySchema).readonly(),
});
export type CardIdentityTagImportRecord = z.infer<
  typeof CardIdentityTagImportRecordSchema
>;

export const RawScryfallOracleCardSchema = z
  .object({
    object: z.literal("card"),
    id: z.uuid(),
    oracle_id: z.uuid(),
    name: z.string().min(1),
      layout: z.enum(cardIdentityLayoutValues),
    mana_cost: z.string().optional(),
    cmc: z.number(),
    type_line: z.string().min(1),
    oracle_text: z.string().optional(),
    color_identity: z.array(z.string()),
      colors: z.array(z.string()).optional(),
      color_indicator: z.array(z.string()).optional(),
      produced_mana: z.array(z.string()).optional(),
      keywords: z.array(z.string()),
      power: z.string().optional(),
      toughness: z.string().optional(),
      loyalty: z.string().optional(),
      defense: z.string().optional(),
      edhrec_rank: z.number().int().optional(),
      game_changer: z.boolean().optional(),
      card_faces: z
          .array(
              z.object({
                  object: z.literal("card_face"),
                  name: z.string().min(1),
                  mana_cost: z.string().optional(),
                  type_line: z.string().min(1).optional(),
                  oracle_text: z.string().optional(),
                  colors: z.array(z.string()).optional(),
                  color_indicator: z.array(z.string()).optional(),
                  power: z.string().optional(),
                  toughness: z.string().optional(),
                  loyalty: z.string().optional(),
                  defense: z.string().optional(),
              }),
          )
          .optional(),
    legalities: z.record(z.string().min(1), FormatLegalitySchema),
    scryfall_uri: z.url(),
  });
export type RawScryfallOracleCard = z.infer<typeof RawScryfallOracleCardSchema>;

export const RawScryfallAllCardSchema = z.object({
  object: z.literal("card"),
  id: z.uuid(),
  oracle_id: z.uuid().optional(),
  name: z.string().min(1),
    layout: z.enum(cardIdentityLayoutValues),
  printed_name: z.string().min(1).nullish(),
    tcgplayer_id: z.number().int().optional(),
    cardmarket_id: z.number().int().optional(),
    card_faces: z
        .array(
            z.object({
                object: z.literal("card_face"),
                oracle_id: z.uuid().optional(),
                printed_name: z.string().min(1).nullish(),
                flavor_name: z.string().min(1).nullish(),
                printed_type_line: z.string().min(1).nullish(),
                printed_text: z.string().nullish(),
                flavor_text: z.string().nullish(),
                artist: z.string().min(1).nullish(),
                artist_id: z.uuid().nullish(),
                illustration_id: z.uuid().nullish(),
                image_uris: z.record(z.string(), z.string()).optional(),
            }),
        )
        .optional(),
  set: z.string().min(1),
  collector_number: z.string().min(1),
  finishes: z.array(z.string()),
  lang: z.string().min(1),
  scryfall_uri: z.url(),
});
export type RawScryfallAllCard = z.infer<typeof RawScryfallAllCardSchema>;

export const RawScryfallOracleTagSchema = z.object({
  object: z.literal("tag"),
  id: z.uuid(),
  label: z.string().min(1),
  slug: z.string().min(1),
  type: z.literal("oracle"),
  uri: z.url(),
  description: z.string().nullable(),
  parent_ids: z.array(z.uuid()),
  child_ids: z.array(z.uuid()),
  aliases: z.array(z.string().min(1)),
  taggings: z.array(
    z.object({
      oracle_id: z.uuid(),
      weight: CardIdentityTaggingWeightSchema,
      annotation: z.string().nullish(),
    }),
  ),
});
export type RawScryfallOracleTag = z.infer<typeof RawScryfallOracleTagSchema>;

export function mapRawScryfallOracleCardToCardIdentityImportRecord(
  card: RawScryfallOracleCard,
): CardIdentityImportRecord {
  const identity: CardIdentity = {
    id: card.oracle_id,
    name: card.name,
      layout: CardIdentityLayoutSchema.parse(card.layout),
    manaCost: card.mana_cost ?? null,
    manaValue: card.cmc,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? null,
    colorIdentity: toColorIdentity(card.color_identity),
      colors: card.colors ? toColorIdentity(card.colors) : null,
      colorIndicator: card.color_indicator
          ? toColorIdentity(card.color_indicator)
          : null,
      producedMana: card.produced_mana ? toProducedMana(card.produced_mana) : null,
      keywords: card.keywords,
      power: card.power ?? null,
      toughness: card.toughness ?? null,
      loyalty: card.loyalty ?? null,
      defense: card.defense ?? null,
      edhrecRank: card.edhrec_rank ?? null,
      gameChanger: card.game_changer ?? null,
    sourcePageUri: card.scryfall_uri,
  };

  return {
    identity,
      parts:
          card.card_faces?.map((face, partIndex) => ({
              cardIdentityId: card.oracle_id,
              partIndex,
              name: face.name,
              manaCost: face.mana_cost ?? null,
              typeLine: face.type_line ?? null,
              oracleText: face.oracle_text ?? null,
              colors: face.colors ? toColorIdentity(face.colors) : null,
              colorIndicator: face.color_indicator
                  ? toColorIdentity(face.color_indicator)
                  : null,
              power: face.power ?? null,
              toughness: face.toughness ?? null,
              loyalty: face.loyalty ?? null,
              defense: face.defense ?? null,
          })) ?? [],
    formatLegalities: Object.entries(card.legalities).map(([format, legality]) => ({
      cardIdentityId: card.oracle_id,
      format,
      legality,
    })),
  };
}

export function mapRawScryfallAllCardToCardPrintingImportRecord(
    card: RawScryfallAllCard,
): CardPrintingImportRecord {
    const cardIdentityId = getAllCardIdentityId(card);
  return {
      printing: {
          id: card.id,
          cardIdentityId,
          layout: card.layout === "reversible_card" ? "reversible_card" : "standard",
          printedName: card.printed_name ?? null,
          setCode: card.set,
          collectorNumber: card.collector_number,
          finishes: card.finishes,
          language: card.lang,
          tcgplayerId: card.tcgplayer_id ?? null,
          cardmarketId: card.cardmarket_id ?? null,
          sourcePageUri: card.scryfall_uri,
      },
      parts:
          card.card_faces?.map((face, partIndex) => ({
              cardPrintingId: card.id,
              partIndex,
              printedName: face.printed_name ?? null,
              flavorName: face.flavor_name ?? null,
              printedTypeLine: face.printed_type_line ?? null,
              printedText: face.printed_text ?? null,
              flavorText: face.flavor_text ?? null,
              artist: face.artist ?? null,
              artistId: face.artist_id ?? null,
              illustrationId: face.illustration_id ?? null,
              imageUris: face.image_uris ?? null,
          })) ?? [],
  };
}

export function mapRawScryfallAllCardToCardPrinting(
    card: RawScryfallAllCard,
): CardPrinting {
    return mapRawScryfallAllCardToCardPrintingImportRecord(card).printing;
}

export function mapRawScryfallOracleTagToCardIdentityTagImportRecord(
  rawTag: RawScryfallOracleTag,
): CardIdentityTagImportRecord {
  return {
    tag: {
      id: rawTag.id,
      slug: rawTag.slug,
      label: rawTag.label,
      description: rawTag.description,
      sourcePageUri: rawTag.uri,
    },
    aliases: rawTag.aliases.map((alias) => ({ tagId: rawTag.id, alias })),
    taggings: rawTag.taggings.map((tagging) => ({
      tagId: rawTag.id,
      cardIdentityId: tagging.oracle_id,
      weight: tagging.weight,
      annotation: tagging.annotation ?? null,
    })),
    hierarchy: rawTag.parent_ids.map((parentTagId) => ({
      parentTagId,
      childTagId: rawTag.id,
    })),
  };
}

export function toColorIdentity(colors: readonly string[]): ColorIdentity {
  const seen = new Set<string>();
  for (const color of colors) {
    if (!colorIdentitySymbols.has(color)) {
      throw new Error(`Unexpected color identity symbol: ${color}.`);
    }
    if (seen.has(color)) {
      throw new Error(`Duplicate color identity symbol: ${color}.`);
    }
    seen.add(color);
  }

  const canonical = colorIdentityOrder.filter((color) => seen.has(color)).join("");
  return ColorIdentitySchema.parse(canonical);
}

export function toProducedMana(symbols: readonly string[]): string {
    const seen = new Set<string>();
    for (const symbol of symbols) {
        if (!producedManaSymbols.has(symbol)) {
            throw new Error(`Unexpected produced mana symbol: ${symbol}.`);
        }
        if (seen.has(symbol)) {
            throw new Error(`Duplicate produced mana symbol: ${symbol}.`);
        }
        seen.add(symbol);
    }

    return producedManaOrder.filter((symbol) => seen.has(symbol)).join("");
}

export function getAllCardIdentityId(card: RawScryfallAllCard): string {
    if (hasScryfallOracleId(card)) return card.oracle_id;

    if (card.layout !== "reversible_card") {
        throw new Error(
            `Scryfall card ${card.id} is missing oracle_id and is not a reversible_card.`,
        );
    }

    const faceOracleIds = new Set(
        card.card_faces
            ?.map((face) => face.oracle_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0) ?? [],
    );
    if (faceOracleIds.size !== 1) {
        throw new Error(
            `Scryfall reversible_card ${card.id} has ${faceOracleIds.size} distinct face oracle_id values; expected exactly one.`,
        );
    }

    const [oracleId] = faceOracleIds;
    if (!oracleId) {
        throw new Error(`Scryfall reversible_card ${card.id} has no face oracle_id.`);
    }
    return oracleId;
}

export function hasScryfallOracleId(
  card: RawScryfallAllCard,
): card is RawScryfallAllCard & { readonly oracle_id: string } {
  return typeof card.oracle_id === "string" && card.oracle_id.length > 0;
}

export const ScryfallBulkDataImportSchema = z.object({
  id: z.uuid(),
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

export type ScryfallBulkImportInput<TRecord> = {
  readonly startedAt: Date;
  readonly sourceUpdatedAt?: Date | undefined;
  readonly sourceUri?: string | undefined;
  readonly records: AsyncIterable<TRecord>;
  readonly observer?: ScryfallImportObserver | undefined;
};

export type FailedScryfallBulkDataImportInput = {
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly sourceUpdatedAt?: Date | undefined;
  readonly sourceUri?: string | undefined;
  readonly warnings?: readonly string[] | undefined;
  readonly blockingErrors: readonly string[];
};

export const ScryfallSyncRequestSchema = z.object({
  bulkDataTypes: z.array(ScryfallBulkDataTypeSchema).min(1),
});
export type ScryfallSyncRequest = z.infer<typeof ScryfallSyncRequestSchema>;

export type ScryfallRepositoryError = {
  readonly type: "repository_error";
  readonly message: string;
  readonly blockingErrors?: readonly string[] | undefined;
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
  importCardIdentities(
    input: ScryfallBulkImportInput<CardIdentityImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  importCardPrintings(
      input: ScryfallBulkImportInput<CardPrintingImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  importCardIdentityTags(
    input: ScryfallBulkImportInput<CardIdentityTagImportRecord>,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
  recordFailedBulkDataImport(
    bulkDataType: ScryfallBulkDataType,
    input: FailedScryfallBulkDataImportInput,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallRepositoryError>>;
};

export type ScryfallBulkDataSource = {
  stream(): ReadableStream<Uint8Array>;
};

export type ScryfallBulkDataSourceMetadata = {
  readonly sourceUri: string;
  readonly sourceUpdatedAt?: Date | undefined;
};

export type ScryfallLocalImportOptions = {
  readonly observer?: ScryfallImportObserver | undefined;
};

export type ScryfallLocalImportError =
  | {
      readonly type: "import_failed";
      readonly message: string;
      readonly importAttempt: ScryfallBulkDataImport;
    }
  | ScryfallRepositoryError;

export type ScryfallLocalImportServices = {
  importOracleCards(
    source: ScryfallBulkDataSource,
    metadata: ScryfallBulkDataSourceMetadata,
    options?: ScryfallLocalImportOptions,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallLocalImportError>>;
  importAllCards(
    source: ScryfallBulkDataSource,
    metadata: ScryfallBulkDataSourceMetadata,
    options?: ScryfallLocalImportOptions,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallLocalImportError>>;
  importOracleTags(
    source: ScryfallBulkDataSource,
    metadata: ScryfallBulkDataSourceMetadata,
    options?: ScryfallLocalImportOptions,
  ): Promise<Result<ScryfallBulkDataImport, ScryfallLocalImportError>>;
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

export function createScryfallLocalImportServices(
  repository: ScryfallRepository,
  clock: Clock,
): ScryfallLocalImportServices {
  return {
    async importOracleCards(source, metadata, options) {
      const startedAt = clock.now();

      const imported = await repository.importCardIdentities({
        startedAt,
        sourceUpdatedAt: metadata.sourceUpdatedAt,
        sourceUri: metadata.sourceUri,
        observer: options?.observer,
        records: mapScryfallRecords(
          source,
          RawScryfallOracleCardSchema,
          mapRawScryfallOracleCardToCardIdentityImportRecord,
          CardIdentityImportRecordSchema,
          options?.observer,
        ),
      });
      if (imported.isErr()) {
        return recordFailedLocalImport(repository, "oracle_cards", {
          startedAt,
          completedAt: clock.now(),
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUri: metadata.sourceUri,
          blockingErrors: imported.error.blockingErrors ?? [imported.error.message],
        });
      }

      return ok(imported.value);
    },

    async importAllCards(source, metadata, options) {
      const startedAt = clock.now();
      const oracleCardsImport = await repository.getLatestSuccessfulBulkDataImport(
        "oracle_cards",
      );
      if (oracleCardsImport.isErr()) {
        return err(oracleCardsImport.error);
      }
      if (oracleCardsImport.value === null) {
        return recordFailedLocalImport(repository, "all_cards", {
          startedAt,
          completedAt: clock.now(),
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUri: metadata.sourceUri,
          blockingErrors: [
            "all_cards import requires a latest successful oracle_cards Scryfall Bulk Data Import.",
          ],
        });
      }

      const imported = await repository.importCardPrintings({
        startedAt,
        sourceUpdatedAt: metadata.sourceUpdatedAt,
        sourceUri: metadata.sourceUri,
        observer: options?.observer,
          records: mapScryfallRecords(
              source,
              RawScryfallAllCardSchema,
              mapRawScryfallAllCardToCardPrintingImportRecord,
              CardPrintingImportRecordSchema,
              options?.observer,
          ),
      });
      if (imported.isErr()) {
        return recordFailedLocalImport(repository, "all_cards", {
          startedAt,
          completedAt: clock.now(),
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUri: metadata.sourceUri,
          blockingErrors: imported.error.blockingErrors ?? [imported.error.message],
        });
      }

      return ok(imported.value);
    },

    async importOracleTags(source, metadata, options) {
      const startedAt = clock.now();
      const oracleCardsImport = await repository.getLatestSuccessfulBulkDataImport(
        "oracle_cards",
      );
      if (oracleCardsImport.isErr()) {
        return err(oracleCardsImport.error);
      }
      if (oracleCardsImport.value === null) {
        return recordFailedLocalImport(repository, "oracle_tags", {
          startedAt,
          completedAt: clock.now(),
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUri: metadata.sourceUri,
          blockingErrors: [
            "oracle_tags import requires a latest successful oracle_cards Scryfall Bulk Data Import.",
          ],
        });
      }

      const imported = await repository.importCardIdentityTags({
        startedAt,
        sourceUpdatedAt: metadata.sourceUpdatedAt,
        sourceUri: metadata.sourceUri,
        observer: options?.observer,
        records: mapScryfallRecords(
          source,
          RawScryfallOracleTagSchema,
          mapRawScryfallOracleTagToCardIdentityTagImportRecord,
          CardIdentityTagImportRecordSchema,
          options?.observer,
        ),
      });
      if (imported.isErr()) {
        return recordFailedLocalImport(repository, "oracle_tags", {
          startedAt,
          completedAt: clock.now(),
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          sourceUri: metadata.sourceUri,
          blockingErrors: imported.error.blockingErrors ?? [imported.error.message],
        });
      }

      return ok(imported.value);
    },
  };
}

async function* mapScryfallRecords<TRaw, TRecord>(
  source: ScryfallBulkDataSource,
  rawSchema: z.ZodType<TRaw>,
  map: (record: TRaw) => TRecord,
  recordSchema: z.ZodType<TRecord>,
  observer?: ScryfallImportObserver,
): AsyncIterable<TRecord> {
  const issues: string[] = [];
  let index = 0;
  let mappedRecordCount = 0;

  try {
    for await (const item of parseJsonArrayItems(source.stream())) {
      emitRecordCounter(observer, "raw_record_parsed", index + 1);
      const raw = rawSchema.safeParse(item);
      if (!raw.success) {
        issues.push(...toIndexedZodIssues(index, raw.error));
      } else {
        const record = recordSchema.safeParse(map(raw.data));
        if (record.success) {
          mappedRecordCount += 1;
          emitRecordCounter(observer, "record_mapped", mappedRecordCount);
          yield record.data;
        } else {
          issues.push(...toIndexedZodIssues(index, record.error));
        }
      }

      if (issues.length >= MAX_SOURCE_FORMAT_DIAGNOSTICS) {
        observer?.onEvent({
          type: "source_validation_failed",
          validationErrorCount: issues.length,
        });
        throw sourceFormatError(issues.slice(0, MAX_SOURCE_FORMAT_DIAGNOSTICS));
      }
      index += 1;
    }
  } catch (error) {
    if (isBlockingError(error)) {
      throw error;
    }
    throw sourceFormatError([`Failed to parse Scryfall source: ${toErrorMessage(error)}.`]);
  }

  if (issues.length > 0) {
    observer?.onEvent({
      type: "source_validation_failed",
      validationErrorCount: issues.length,
    });
    throw sourceFormatError(issues);
  }

  emitRecordCounter(observer, "raw_record_parsed", index, true);
  emitRecordCounter(observer, "record_mapped", mappedRecordCount, true);
}

function emitRecordCounter(
  observer: ScryfallImportObserver | undefined,
  type: "raw_record_parsed" | "record_mapped" | "record_staged",
  count: number,
  force = false,
): void {
  if (!observer || count === 0) return;
  if (!force && count % SCRYFALL_IMPORT_TIMING_RECORD_INTERVAL !== 0) return;

  if (type === "raw_record_parsed") {
    observer.onEvent({ type, rawRecordCount: count });
    return;
  }
  if (type === "record_mapped") {
    observer.onEvent({ type, mappedRecordCount: count });
    return;
  }
  observer.onEvent({ type, stagedRecordCount: count });
}

async function recordFailedLocalImport(
  repository: ScryfallRepository,
  bulkDataType: ScryfallBulkDataType,
  input: FailedScryfallBulkDataImportInput,
): Promise<Result<ScryfallBulkDataImport, ScryfallLocalImportError>> {
  const recorded = await repository.recordFailedBulkDataImport(bulkDataType, input);
  if (recorded.isErr()) {
    return err(recorded.error);
  }

  return err({
    type: "import_failed",
    message: recorded.value.blockingErrors.join(" ") || "Scryfall import failed.",
    importAttempt: recorded.value,
  });
}

function toValidationError(error: z.ZodError): ScryfallSyncError {
  return {
    type: "validation_failed",
    message: "Scryfall sync request validation failed.",
    issues: error.issues.map((issue) => issue.message),
  };
}

function toZodIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function toIndexedZodIssues(index: number, error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => {
    const path = [index, ...issue.path].join(".");
    return `${path}: ${issue.message}`;
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceFormatError(blockingErrors: readonly string[]): Error {
  const error = new Error(blockingErrors.join(" ") || "Scryfall source validation failed.");
  Object.assign(error, { blockingErrors });
  return error;
}

function isBlockingError(error: unknown): error is { readonly blockingErrors: readonly string[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    Array.isArray((error as { readonly blockingErrors?: unknown }).blockingErrors)
  );
}
