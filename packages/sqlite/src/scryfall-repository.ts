import {randomUUIDv7} from "bun";
import {eq, sql} from "drizzle-orm";
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
  CardPrintingPromoType,
  CardSet,
  Clock,
  ScryfallBulkDataImport,
  ScryfallBulkDataType,
  ScryfallBulkImportInput,
  ScryfallFinalizationPhase,
  ScryfallImportObserver,
  ScryfallRepository,
  ScryfallRepositoryError,
  ScryfallRefreshDiagnostics, ScryfallRefreshGraph, ScryfallReconciliationPlan, CardMigration,
} from "@tomekin/core";
import {ScryfallRefreshFailure, CardMigrationSchema, CardIdentityLayoutSchema, requiredScryfallImportContractRevisions} from "@tomekin/core";

import type {TomekinDatabase} from "./database";
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
  cardPrintingPromoType,
  cardSet,
  scryfallBulkDataImport,
  scryfallMigrationEvidence, scryfallMigrationApplication,
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
  listCardSets(): Promise<Result<readonly CardSet[], ScryfallRepositoryError>>;
  listCardPrintingPromoTypes(): Promise<Result<readonly CardPrintingPromoType[], ScryfallRepositoryError>>;
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
  db: TomekinDatabase,
  clock: Clock,
): SqliteScryfallRepository {
  return {
    async refreshReferenceData(input) {
      const version = () => db.$client.query("PRAGMA data_version").get() as {data_version: number};
      const baseline = version().data_version;
      let phase: ScryfallRefreshDiagnostics["phase"] = "staging";
      try {
        // Batch TEMP writes so large sources do not autocommit every row after the cache spills.
        // DEFERRED leaves the main database writable; finish this transaction before discovery/network waits.
        db.run(sql`BEGIN DEFERRED`);
        const identityCount = await stageCardIdentities(db, input.identities);
        const printingCount = await stageCardPrintings(db, input.printings);
        const tagCount = await stageCardIdentityTags(db, input.tags);
        commitTransaction(db);
        if (!identityCount || !printingCount || !tagCount) throw importRejection(["invalid_snapshot: all three datasets must be nonempty."]);
        phase = "incoming_validation";
        validateIncomingGraph(db);
        const graph = refreshGraph(db);
        const cached = db.select().from(scryfallMigrationEvidence).all().map(row => CardMigrationSchema.parse(row.evidenceJson));
        phase = "migration_discovery";
        const reconciliation = await input.reconcile(graph, cached, records => cacheMigrationEvidence(db, clock, records));
        if (reconciliation.isErr()) throw reconciliation.error;
        const plan = reconciliation.value;
        beginTransaction(db);
        if (version().data_version !== baseline) throw new ScryfallRefreshFailure("concurrent_state_changed", "concurrent_state_changed: data changed during staging or discovery. Previous data preserved; retry sync.");
        // User references are read and checked again under the publication write lock.
        phase = "user_reference_validation";
        validateUserRemapping(db, plan);
        phase = "publication";
        publishCardIdentities(db, input.identities, true);
        establishPrintingTargets(db);
        applyUserRemapping(db, plan, clock);
        publishCardIdentityTags(db, input.tags);
        publishCardPrintings(db, input.printings);
        db.run(sql`DELETE FROM card_identity WHERE id NOT IN (SELECT id FROM import_card_identity)`);
        const counts = [identityCount, printingCount, tagCount];
        const imports = (["oracle_cards", "all_cards", "oracle_tags"] as const).map((kind, index) =>
          insertImportRecord(db, kind, "succeeded", {...[input.identities, input.printings, input.tags][index]!,
            completedAt: clock.now(), importedRecordCount: counts[index]!}, [], []));
        for (const migration of plan.applied) {
          const old = graph.removedPrintings.find(row => row.id === migration.old_scryfall_id);
          db.insert(scryfallMigrationApplication).values({id: randomUUIDv7(), migrationId: migration.id,
            oracleImportId: imports[0]!.id, oldPrintingId: migration.old_scryfall_id,
            newPrintingId: plan.printings.get(migration.old_scryfall_id) ?? null,
            oldIdentityId: old?.cardIdentityId ?? null,
            newIdentityId: plan.printings.get(migration.old_scryfall_id) ? graph.incomingPrintingIdentity(plan.printings.get(migration.old_scryfall_id)!) : null,
            appliedAt: clock.now()}).run();
        }
        commitTransaction(db);
        return ok(imports);
      } catch (error) {
        rollbackTransaction(db);
        const failure = toRepositoryError(error);
        return err({...failure, message: failure.message.slice(0, 2400), diagnostics: {phase,
          reason: error instanceof ScryfallRefreshFailure ? error.reason : phase === "publication" ? "publication_failed" : "source_validation_failed",
          ...(error instanceof ScryfallRefreshFailure && error.referenceCounts ? {referenceCounts: error.referenceCounts} : {}),
          ...(error instanceof ScryfallRefreshFailure && error.exampleIds ? {exampleIds: error.exampleIds.slice(0, 5)} : {}),
          sources: (["oracle_cards", "all_cards", "oracle_tags"] as const).map((bulkDataType, index) => ({bulkDataType,
            sourceUri: [input.identities, input.printings, input.tags][index]!.sourceUri,
            sourceUpdatedAt: [input.identities, input.printings, input.tags][index]!.sourceUpdatedAt})),
        }});
      }
    },

    async importCardIdentities(input) {
      try {
        beginTransaction(db);
        const importedRecordCount = await stageCardIdentities(db, input);
        protectLocalRemovals(db, "oracle_cards");
        validateCardIdentities(db, input, importedRecordCount);
        publishCardIdentities(db, input);
        const imported = insertImportRecord(db, "oracle_cards", "succeeded",
          {...input, completedAt: clock.now(), importedRecordCount}, [], []);
        commitTransaction(db);
        return ok(imported);
      } catch (error) {
        rollbackTransaction(db);
        return err(toRepositoryError(error));
      }
    },

    async importCardPrintings(input) {
      try {
        beginTransaction(db);
        const importedRecordCount = await stageCardPrintings(db, input);
        validateCardPrintings(db, input, importedRecordCount);
        protectLocalRemovals(db, "all_cards");
        publishCardPrintings(db, input);
        const imported = insertImportRecord(db, "all_cards", "succeeded",
          {...input, completedAt: clock.now(), importedRecordCount}, [], []);
        commitTransaction(db);
        return ok(imported);
      } catch (error) {
        rollbackTransaction(db);
        return err(toRepositoryError(error));
      }
    },

    async importCardIdentityTags(input) {
      try {
        beginTransaction(db);
        const importedRecordCount = await stageCardIdentityTags(db, input);
        protectLocalRemovals(db, "oracle_tags");
        validateCardIdentityTags(db, input, importedRecordCount);
        publishCardIdentityTags(db, input);
        const imported = insertImportRecord(db, "oracle_tags", "succeeded",
          {...input, completedAt: clock.now(), importedRecordCount}, [], []);
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
          .orderBy(cardPrinting.printedName, cardPrinting.setId, cardPrinting.collectorNumber);
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

    async listCardSets() {
      try {
        return ok((await db.select().from(cardSet).orderBy(cardSet.name, cardSet.code)).map((row) => ({...row})));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },

    async listCardPrintingPromoTypes() {
      try {
        return ok((await db.select().from(cardPrintingPromoType).orderBy(cardPrintingPromoType.cardPrintingId, cardPrintingPromoType.promoType)).map((row) => ({...row})));
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
      // Administrative history retains start-time order; it is not a current-snapshot authority source.
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
          .orderBy(sql`rowid DESC`)
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
  db: TomekinDatabase,
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
  db: Pick<TomekinDatabase, "insert">,
  bulkDataType: ScryfallBulkDataType,
  status: "succeeded" | "failed",
  input: ScryfallImportRecordInput,
  warnings: readonly string[],
  blockingErrors: readonly string[],
): ScryfallBulkDataImport {
  const imported: ScryfallBulkDataImport = {
    id: randomUUIDv7("hex", input.startedAt.getTime()),
    bulkDataType,
      importContractRevision: requiredScryfallImportContractRevisions[bulkDataType],
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
        importContractRevision: imported.importContractRevision,
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

function beginTransaction(db: TomekinDatabase): void {
  db.run(sql`BEGIN IMMEDIATE`);
}

function commitTransaction(db: TomekinDatabase): void {
  db.run(sql`COMMIT`);
}

function rollbackTransaction(db: TomekinDatabase): void {
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

type StagedCardPrintingRow = {
  readonly id: string;
  readonly cardIdentityId: string;
  readonly layout: string;
  readonly printedName: string | null;
  readonly setId: string;
  readonly collectorNumber: string;
  readonly language: string;
  readonly tcgplayerId: number | null;
  readonly cardmarketId: number | null;
  readonly sourcePageUri: string;
};

type StagedCardSetRow = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly setType: string;
  readonly apiUri: string;
  readonly cardSearchUri: string;
  readonly sourcePageUri: string;
};

function sameStagedCardSet(staged: StagedCardSetRow, incoming: CardSet): boolean {
  return staged.id === incoming.id
      && staged.code === incoming.code
      && staged.name === incoming.name
      && staged.setType === incoming.setType
      && staged.apiUri === incoming.apiUri
      && staged.cardSearchUri === incoming.cardSearchUri
      && staged.sourcePageUri === incoming.sourcePageUri;
}

type StagedCardPrintingPartRow = {
  readonly cardPrintingId: string;
  readonly partIndex: number;
  readonly printedName: string | null;
  readonly flavorName: string | null;
  readonly printedTypeLine: string | null;
  readonly printedText: string | null;
  readonly flavorText: string | null;
  readonly artist: string | null;
  readonly artistId: string | null;
  readonly illustrationId: string | null;
  readonly imageUrisJson: string | null;
};

function sameStagedCardPrinting(
    staged: StagedCardPrintingRow,
    incoming: CardPrinting,
): boolean {
  return staged.id === incoming.id
      && staged.cardIdentityId === incoming.cardIdentityId
      && staged.layout === incoming.layout
      && staged.printedName === incoming.printedName
      && staged.setId === incoming.setId
      && staged.collectorNumber === incoming.collectorNumber
      && staged.language === incoming.language
      && staged.tcgplayerId === incoming.tcgplayerId
      && staged.cardmarketId === incoming.cardmarketId
      && staged.sourcePageUri === incoming.sourcePageUri;
}

function sameStringValues(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function sameStagedCardPrintingParts(
    staged: readonly StagedCardPrintingPartRow[],
    incoming: readonly CardPrintingPart[],
): boolean {
  if (staged.length !== incoming.length) return false;
  const sortedIncoming = [...incoming].sort((left, right) => left.partIndex - right.partIndex);
  return staged.every((part, index) => {
    const candidate = sortedIncoming[index];
    return candidate !== undefined
        && part.cardPrintingId === candidate.cardPrintingId
        && part.partIndex === candidate.partIndex
        && part.printedName === candidate.printedName
        && part.flavorName === candidate.flavorName
        && part.printedTypeLine === candidate.printedTypeLine
        && part.printedText === candidate.printedText
        && part.flavorText === candidate.flavorText
        && part.artist === candidate.artist
        && part.artistId === candidate.artistId
        && part.illustrationId === candidate.illustrationId
        && sameSerializedStringRecord(part.imageUrisJson, candidate.imageUris);
  });
}

function sameSerializedStringRecord(
    serialized: string | null,
    incoming: Readonly<Record<string, string>> | null,
): boolean {
  if (serialized === null || incoming === null) return serialized === incoming;
  const parsed: unknown = JSON.parse(serialized);
  if (!isStringRecord(parsed)) return false;
  const stagedEntries = Object.entries(parsed).sort(([left], [right]) => left.localeCompare(right));
  const incomingEntries = Object.entries(incoming).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(stagedEntries) === JSON.stringify(incomingEntries);
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
      copyLimitOverride: row.copyLimitOverrideKind === "maximum"
          ? {kind: "maximum", maximum: row.copyLimitOverrideMaximum!}
          : {kind: row.copyLimitOverrideKind},
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
  if (row.setId === null) throw new Error(`Card Printing ${row.id} requires an all_cards reimport for Card Set metadata.`);
  return {
    id: row.id,
    cardIdentityId: row.cardIdentityId,
    layout: row.layout,
    printedName: row.printedName,
    setId: row.setId,
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
      importContractRevision: row.importContractRevision,
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

async function stageCardIdentities(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityImportRecord>): Promise<number> {
  let importedRecordCount = 0;
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
            copy_limit_override_kind TEXT NOT NULL,
            copy_limit_override_maximum INTEGER,
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
            copy_limit_override_kind,
            copy_limit_override_maximum,
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
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
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
                identity.copyLimitOverride.kind,
                identity.copyLimitOverride.kind === "maximum" ? identity.copyLimitOverride.maximum : null,
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


  return importedRecordCount;
}
function validateCardIdentities(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityImportRecord>, importedRecordCount: number): void {
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


}
function publishCardIdentities(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityImportRecord>, keepObsolete = false): void {
        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardIdentityFormatLegality).run();
          db.delete(cardIdentityPart).run();
          if (!keepObsolete) db.run(sql`
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
              copy_limit_override_kind,
              copy_limit_override_maximum,
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
              copy_limit_override_kind,
              copy_limit_override_maximum,
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
              copy_limit_override_kind = excluded.copy_limit_override_kind,
              copy_limit_override_maximum = excluded.copy_limit_override_maximum,
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


}

async function stageCardPrintings(db: TomekinDatabase, input: ScryfallBulkImportInput<CardPrintingImportRecord>): Promise<number> {
  let importedRecordCount = 0;
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_set`);
        db.run(sql`
          CREATE TEMP TABLE import_card_set (
            id TEXT PRIMARY KEY NOT NULL,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            set_type TEXT NOT NULL,
            api_uri TEXT NOT NULL,
            card_search_uri TEXT NOT NULL,
            source_page_uri TEXT NOT NULL
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_printing`);
        db.run(sql`
          CREATE TEMP TABLE import_card_printing (
            id TEXT PRIMARY KEY NOT NULL,
            card_identity_id TEXT NOT NULL,
            layout TEXT NOT NULL,
            printed_name TEXT,
            set_id TEXT NOT NULL,
            collector_number TEXT NOT NULL,
            language TEXT NOT NULL,
            tcgplayer_id INTEGER,
            cardmarket_id INTEGER,
            source_page_uri TEXT NOT NULL
          )
        `);
        db.run(sql`DROP TABLE IF EXISTS temp.import_card_printing_promo_type`);
        db.run(sql`
          CREATE TEMP TABLE import_card_printing_promo_type (
            card_printing_id TEXT NOT NULL,
            promo_type TEXT NOT NULL,
            PRIMARY KEY (card_printing_id, promo_type)
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

        const insertSet = db.$client.prepare(`
          INSERT INTO import_card_set (id, code, name, set_type, api_uri, card_search_uri, source_page_uri)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
          ON CONFLICT(id) DO NOTHING
        `);
        const insertPrinting = db.$client.prepare(`
          INSERT INTO import_card_printing (
            id,
            card_identity_id,
            layout,
            printed_name,
            set_id,
            collector_number,
            language,
            tcgplayer_id,
            cardmarket_id,
            source_page_uri)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
          ON CONFLICT(id) DO NOTHING
        `);
        const insertPromoType = db.$client.prepare(`
          INSERT INTO import_card_printing_promo_type (card_printing_id, promo_type)
          VALUES (?1, ?2)
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
            const {set, printing, parts, promoTypes} = record;
            const [setWithCode] = db.all<{id: string}>(sql`SELECT id FROM import_card_set WHERE code = ${set.code}`);
            if (setWithCode && setWithCode.id !== set.id) {
              throw importRejection([`all_cards import maps Card Set code ${set.code} to multiple Set IDs.`]);
            }
            const insertedSet = insertSet.run(set.id, set.code, set.name, set.setType, set.apiUri, set.cardSearchUri, set.sourcePageUri);
            if (insertedSet.changes === 0) {
              const [stagedSet] = db.all<StagedCardSetRow>(sql`
                SELECT id, code, name, set_type AS setType, api_uri AS apiUri,
                       card_search_uri AS cardSearchUri, source_page_uri AS sourcePageUri
                FROM import_card_set WHERE id = ${set.id}
              `);
              if (!stagedSet || !sameStagedCardSet(stagedSet, set)) {
                throw importRejection([`all_cards import contains conflicting Card Set ID ${set.id}.`]);
              }
            }
            const inserted = insertPrinting.run(
                printing.id,
                printing.cardIdentityId,
                printing.layout,
                printing.printedName,
                printing.setId,
                printing.collectorNumber,
                printing.language,
                printing.tcgplayerId,
                printing.cardmarketId,
                printing.sourcePageUri,
            );
            if (inserted.changes === 0) {
              const [stagedPrinting] = db.all<StagedCardPrintingRow>(sql`
                SELECT id,
                       card_identity_id AS cardIdentityId,
                       layout,
                       printed_name     AS printedName,
                       set_id           AS setId,
                       collector_number AS collectorNumber,
                       language,
                       tcgplayer_id     AS tcgplayerId,
                       cardmarket_id    AS cardmarketId,
                       source_page_uri  AS sourcePageUri
                FROM import_card_printing
                WHERE id = ${printing.id}
              `);
              const stagedFinishes = db.all<{ readonly finish: string }>(sql`
                SELECT finish
                FROM import_card_printing_finish
                WHERE card_printing_id = ${printing.id}
                ORDER BY finish
              `).map((row) => row.finish);
              const stagedParts = db.all<StagedCardPrintingPartRow>(sql`
                SELECT card_printing_id  AS cardPrintingId,
                       part_index        AS partIndex,
                       printed_name      AS printedName,
                       flavor_name       AS flavorName,
                       printed_type_line AS printedTypeLine,
                       printed_text      AS printedText,
                       flavor_text       AS flavorText,
                       artist,
                       artist_id         AS artistId,
                       illustration_id   AS illustrationId,
                       image_uris_json   AS imageUrisJson
                FROM import_card_printing_part
                WHERE card_printing_id = ${printing.id}
                ORDER BY part_index
              `);
              const stagedPromoTypes = db.all<{readonly promoType: string}>(sql`
                SELECT promo_type AS promoType
                FROM import_card_printing_promo_type
                WHERE card_printing_id = ${printing.id}
                ORDER BY promo_type
              `).map((row) => row.promoType);
              if (
                  !stagedPrinting
                  || !sameStagedCardPrinting(stagedPrinting, printing)
                  || !sameStringValues(stagedFinishes, printing.finishes)
                  || !sameStagedCardPrintingParts(stagedParts, parts)
                  || !sameStringValues(stagedPromoTypes, promoTypes.map((item) => item.promoType))
              ) {
                throw importRejection([
                  `all_cards import contains conflicting Card Printing ID ${printing.id}.`,
                ]);
              }
              continue;
            }
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
            for (const promoType of promoTypes) {
              insertPromoType.run(promoType.cardPrintingId, promoType.promoType);
            }
            importedRecordCount += 1;
            emitStagedRecordCounter(input.observer, importedRecordCount);
          }
        } finally {
          insertPromoType.finalize();
          insertPrintingPart.finalize();
            insertPrintingFinish.finalize();
          insertPrinting.finalize();
          insertSet.finalize();
        }
        emitStagedRecordCounter(input.observer, importedRecordCount, true);


  return importedRecordCount;
}
function validateCardPrintings(db: TomekinDatabase, input: ScryfallBulkImportInput<CardPrintingImportRecord>, importedRecordCount: number): void {
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

        const missingSetIds = db.all<{id: string}>(sql`
          SELECT DISTINCT set_id AS id FROM import_card_printing
          WHERE set_id NOT IN (SELECT id FROM import_card_set)
        `);
        if (missingSetIds.length > 0) {
          throw importRejection([`all_cards import references missing Card Set IDs: ${missingSetIds.map((row) => row.id).join(", ")}.`]);
        }

          const orphanedCollectionPrintings = timedFinalizationPhase(
              input.observer,
              "orphaned_collection_printing_check",
              () =>
                  db.all<{ id: string }>(sql`
                      SELECT DISTINCT card_printing_id AS id
                      FROM collection_card
                      WHERE card_printing_id NOT IN (SELECT id FROM import_card_printing)
                  `),
          );
          if (orphanedCollectionPrintings.length > 0) {
              throw importRejection([
                  `all_cards import would orphan existing Collection Card references for Card Printing IDs: ${orphanedCollectionPrintings.map((row) => row.id).join(", ")}. Use coordinated sync:scryfall with official migration evidence for removals.`,
              ]);
          }


}
function publishCardPrintings(db: TomekinDatabase, input: ScryfallBulkImportInput<CardPrintingImportRecord>): void {
        timedFinalizationPhase(input.observer, "delete_existing_records", () => {
          db.delete(cardPrintingPromoType).run();
          db.delete(cardPrintingPart).run();
            db.delete(cardPrintingFinish).run();
            db.run(sql`
            DELETE FROM card_printing
            WHERE id NOT IN (SELECT id FROM import_card_printing)
          `);
        });
          timedFinalizationPhase(input.observer, "upsert_from_staging", () => {
          db.run(sql`
            INSERT INTO card_set (id, code, name, set_type, api_uri, card_search_uri, source_page_uri)
            SELECT id, code, name, set_type, api_uri, card_search_uri, source_page_uri FROM import_card_set
            WHERE true
            ON CONFLICT(id) DO UPDATE SET code = excluded.code, name = excluded.name,
              set_type = excluded.set_type, api_uri = excluded.api_uri,
              card_search_uri = excluded.card_search_uri, source_page_uri = excluded.source_page_uri
          `);
          db.run(sql`
            INSERT INTO card_printing (
              id,
              card_identity_id,
              layout,
              printed_name,
              set_id,
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
              set_id,
              collector_number,
              language, tcgplayer_id, cardmarket_id,
              source_page_uri
            FROM import_card_printing
            WHERE true
            ON CONFLICT(id) DO UPDATE SET
              card_identity_id = excluded.card_identity_id,
              layout = excluded.layout,
              printed_name = excluded.printed_name,
              set_id = excluded.set_id,
              collector_number = excluded.collector_number,
              language = excluded.language,
              tcgplayer_id = excluded.tcgplayer_id,
              cardmarket_id = excluded.cardmarket_id,
              source_page_uri = excluded.source_page_uri
          `);
            db.run(sql`
            INSERT INTO card_printing_finish (card_printing_id, finish)
            SELECT card_printing_id, finish
            FROM import_card_printing_finish
          `);
          db.run(sql`
            INSERT INTO card_printing_promo_type (card_printing_id, promo_type)
            SELECT card_printing_id, promo_type FROM import_card_printing_promo_type
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
          db.run(sql`DELETE FROM card_set WHERE id NOT IN (SELECT id FROM import_card_set)`);
        });


}

async function stageCardIdentityTags(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityTagImportRecord>): Promise<number> {
  let importedRecordCount = 0;
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


  return importedRecordCount;
}
function validateCardIdentityTags(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityTagImportRecord>, importedRecordCount: number): void {
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


}
function publishCardIdentityTags(db: TomekinDatabase, input: ScryfallBulkImportInput<CardIdentityTagImportRecord>): void {
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


}

function protectLocalRemovals(db: TomekinDatabase, kind: ScryfallBulkDataType): void {
  const table = kind === "oracle_cards" ? "card_identity" : kind === "all_cards" ? "card_printing" : null;
  if (!table) return;
  const missing = db.$client.query(`SELECT id FROM ${table} WHERE id NOT IN (SELECT id FROM import_${table}) LIMIT 5`).all();
  if (missing.length) throw importRejection([`${kind} removal requires coordinated sync:scryfall with official migration evidence. Previous data preserved.`]);
}

function validateIncomingGraph(db: TomekinDatabase): void {
  for (const [table, source] of [["import_card_printing", "All Cards"], ["import_card_identity_tagging", "Oracle Tags"]]) {
    const missing = db.$client.query(`SELECT DISTINCT card_identity_id AS id FROM ${table} WHERE card_identity_id NOT IN (SELECT id FROM import_card_identity) LIMIT 5`).all();
    if (missing.length) throw new ScryfallRefreshFailure("snapshot_incompatible", `snapshot_incompatible: ${source} references missing incoming identities; examples: ${JSON.stringify(missing)}. Retry compatible snapshots.`);
  }
  const invalid = db.$client.query(`SELECT parent_tag_id AS id FROM import_card_identity_tag_hierarchy
    WHERE parent_tag_id NOT IN (SELECT id FROM import_card_identity_tag) OR parent_tag_id = child_tag_id LIMIT 5`).all();
  if (invalid.length) throw new ScryfallRefreshFailure("snapshot_incompatible", "snapshot_incompatible: invalid incoming tag hierarchy.");
}
function refreshGraph(db: TomekinDatabase): ScryfallRefreshGraph {
  return {
    removedPrintings: db.all<{id: string; cardIdentityId: string}>(sql`SELECT id, card_identity_id AS cardIdentityId FROM card_printing WHERE id NOT IN (SELECT id FROM import_card_printing)`),
    removedIdentities: db.all<{id: string}>(sql`SELECT id FROM card_identity WHERE id NOT IN (SELECT id FROM import_card_identity)`).map(row => row.id),
    incomingPrintingIdentity(id) {
      return db.$client.query<{card_identity_id: string}, [string]>("SELECT card_identity_id FROM import_card_printing WHERE id = ?").get(id)?.card_identity_id ?? null;
    },
  };
}
function cacheMigrationEvidence(db: TomekinDatabase, clock: Clock, records: readonly CardMigration[]): void {
  db.$client.transaction(() => {
    for (const record of records) {
      const previous = db.select().from(scryfallMigrationEvidence).where(eq(scryfallMigrationEvidence.id, record.id)).get();
      if (previous && JSON.stringify(CardMigrationSchema.parse(previous.evidenceJson)) !== JSON.stringify(record)) throw new ScryfallRefreshFailure("migration_conflict", "migration_conflict: cached migration changed.");
      db.insert(scryfallMigrationEvidence).values({id: record.id, oldPrintingId: record.old_scryfall_id,
        evidenceJson: record, sourceUri: "https://api.scryfall.com/migrations", fetchedAt: clock.now()}).onConflictDoNothing().run();
    }
  })();
}
function validateUserRemapping(db: TomekinDatabase, plan: ScryfallReconciliationPlan): void {
  db.run(sql`DROP TABLE IF EXISTS temp.identity_remapping`);
  db.run(sql`CREATE TEMP TABLE identity_remapping (old_id TEXT PRIMARY KEY, new_id TEXT)`);
  for (const [old, target] of plan.identities) db.$client.query("INSERT INTO identity_remapping VALUES (?, ?)").run(old, target);
  db.run(sql`DROP TABLE IF EXISTS temp.printing_remapping`);
  db.run(sql`CREATE TEMP TABLE printing_remapping (old_id TEXT PRIMARY KEY, new_id TEXT)`);
  for (const [old, target] of plan.printings) db.$client.query("INSERT INTO printing_remapping VALUES (?, ?)").run(old, target);
  const referenceCounts: Record<string, number> = {};
  const examples = new Set<string>();
  for (const [source, table, column, remapping] of [
    ["Collection", "collection_card", "card_printing_id", "printing_remapping"],
    ["candidateMemberships", "deck_candidate_card", "card_identity_id", "identity_remapping"],
    ["candidateOptions", "deck_candidate_option", "card_identity_id", "identity_remapping"],
    ["candidateContributions", "deck_candidate_contribution", "card_identity_id", "identity_remapping"],
  ]) {
    const join = `FROM ${table} r JOIN ${remapping} m ON m.old_id=r.${column} WHERE m.new_id IS NULL`;
    referenceCounts[source!] = db.$client.query<{count: number}, []>(`SELECT count(*) AS count ${join}`).get()!.count;
    for (const row of db.$client.query<{id: string}, []>(`SELECT DISTINCT m.old_id AS id ${join} LIMIT 5`).all()) examples.add(row.id);
  }
  if (Object.values(referenceCounts).some(count => count > 0)) throw new ScryfallRefreshFailure("referenced_deletion",
    `referenced_deletion: Collection and candidate membership/option references would break; counts=${JSON.stringify(referenceCounts)}; examples=${[...examples].slice(0, 5).join(", ")}. Repair user references before retrying.`, referenceCounts, [...examples]);
  const refs = `(SELECT deck_candidate_id AS candidate_id, card_identity_id FROM deck_candidate_card UNION SELECT candidate_id, card_identity_id FROM deck_candidate_option)`;
  const collisions = db.$client.query(`SELECT r.candidate_id, coalesce(m.new_id,r.card_identity_id) AS target FROM ${refs} r
    LEFT JOIN identity_remapping m ON m.old_id=r.card_identity_id GROUP BY r.candidate_id,target HAVING count(DISTINCT r.card_identity_id)>1 LIMIT 5`).all();
  if (collisions.length) throw new ScryfallRefreshFailure("user_data_conflict", `user_data_conflict: candidate identity collisions; examples=${JSON.stringify(collisions)}. Quantities, options and contributions cannot be combined automatically.`);
}
function establishPrintingTargets(db: TomekinDatabase): void {
  db.run(sql`INSERT INTO card_set (id, code, name, set_type, api_uri, card_search_uri, source_page_uri)
    SELECT id,code,name,set_type,api_uri,card_search_uri,source_page_uri FROM import_card_set WHERE true
    ON CONFLICT(id) DO NOTHING`);
  db.run(sql`INSERT INTO card_printing (id, card_identity_id, layout, printed_name, set_id, collector_number, language, tcgplayer_id, cardmarket_id, source_page_uri)
    SELECT id,card_identity_id,layout,printed_name,set_id,collector_number,language,tcgplayer_id,cardmarket_id,source_page_uri FROM import_card_printing WHERE true ON CONFLICT(id) DO NOTHING`);
}
function applyUserRemapping(db: TomekinDatabase, plan: ScryfallReconciliationPlan, clock: Clock): void {
  const affected = db.$client.query<{id: string; updated: string | null}, []>(`SELECT DISTINCT d.id, coalesce(d.updated_at_exact, strftime('%Y-%m-%dT%H:%M:%fZ',d.updated_at,'unixepoch')) AS updated
    FROM deck_candidate d WHERE d.id IN (SELECT deck_candidate_id FROM deck_candidate_card WHERE card_identity_id IN (SELECT old_id FROM identity_remapping)
      UNION SELECT candidate_id FROM deck_candidate_option WHERE card_identity_id IN (SELECT old_id FROM identity_remapping))`).all();
  for (const row of affected) {
    const timestamp = new Date(Math.max(clock.now().getTime(), Date.parse(row.updated!) + 1)).toISOString();
    db.$client.query("UPDATE deck_candidate SET updated_at_exact=?, updated_at=?, selected_changed_at=?, plan_changed_at=? WHERE id=?")
      .run(timestamp, Math.floor(Date.parse(timestamp) / 1000), timestamp, timestamp, row.id);
  }
  for (const [old, target] of plan.printings) if (target) db.$client.query("UPDATE collection_card SET card_printing_id = ? WHERE card_printing_id = ?").run(target, old);
  // Establish the composite parent before moving contributions; no FK disabling or deferred invalid graph.
  db.run(sql`INSERT INTO deck_candidate_option (candidate_id, card_identity_id, comparison_note)
    SELECT o.candidate_id,m.new_id,o.comparison_note FROM deck_candidate_option o JOIN identity_remapping m ON o.card_identity_id=m.old_id WHERE m.new_id IS NOT NULL`);
  db.run(sql`UPDATE deck_candidate_contribution SET card_identity_id=(SELECT new_id FROM identity_remapping WHERE old_id=card_identity_id)
    WHERE card_identity_id IN (SELECT old_id FROM identity_remapping WHERE new_id IS NOT NULL)`);
  db.run(sql`DELETE FROM deck_candidate_option WHERE card_identity_id IN (SELECT old_id FROM identity_remapping)`);
  db.run(sql`UPDATE deck_candidate_card SET card_identity_id=(SELECT new_id FROM identity_remapping WHERE old_id=card_identity_id)
    WHERE card_identity_id IN (SELECT old_id FROM identity_remapping WHERE new_id IS NOT NULL)`);
}
