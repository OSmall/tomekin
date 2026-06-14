import { describe, expect, test } from "bun:test";
import {
  createScryfallSyncServices,
  createScryfallLocalImportServices,
  RawScryfallAllCardSchema,
  RawScryfallOracleCardSchema,
  type ScryfallBulkDataImport,
  type ScryfallBulkDataType,
  type ScryfallRepository,
} from "@mtg-agent/core";
import { err, ok } from "neverthrow";

const clock = {
  now: () => new Date("2025-01-01T00:00:00.000Z"),
};

describe("Scryfall sync services", () => {
  test("validates requested bulk data types", async () => {
    const services = createScryfallSyncServices(fakeRepository([]), clock);

    const result = await services.syncScryfallData({
      bulkDataTypes: ["default_cards"],
    } as never);

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected validation failure");
    expect(result.error.type).toBe("validation_failed");
    if (result.error.type !== "validation_failed") {
      throw new Error("expected validation failure");
    }
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  test("returns structured failures for missing required card reference datasets", async () => {
    const services = createScryfallSyncServices(fakeRepository(["oracle_cards"]), clock);

    const result = await services.requireCardReferenceData();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected missing dataset failure");
    expect(result.error.type).toBe("missing_required_scryfall_datasets");
    if (result.error.type !== "missing_required_scryfall_datasets") {
      throw new Error("expected missing dataset failure");
    }
    expect(result.error.missingBulkDataTypes).toEqual(["all_cards"]);
  });

  test("does not expose SQLite or Drizzle details through core service errors", async () => {
    const services = createScryfallSyncServices(
      {
        async getLatestSuccessfulBulkDataImport() {
          return err({ type: "repository_error", message: "storage unavailable" });
        },
      },
      clock,
    );

    const result = await services.requireCardReferenceData();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected repository failure");
    expect(JSON.stringify(result.error).toLowerCase()).not.toContain("sqlite");
    expect(JSON.stringify(result.error).toLowerCase()).not.toContain("drizzle");
  });

  test("local import records failed attempts when source text rejects", async () => {
    const repository = fakeRepository(["oracle_cards"]);
    const services = createScryfallLocalImportServices(repository, clock);

    const result = await services.importOracleCards(
      {
        stream() {
          throw new Error("read failed");
        },
      },
      { sourceUri: "fixture://broken" },
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected failed import");
    expect(result.error.type).toBe("import_failed");
    if (result.error.type !== "import_failed") {
      throw new Error("expected failed import");
    }
    expect(result.error.importAttempt.status).toBe("failed");
    expect(result.error.importAttempt.blockingErrors[0]).toContain("read failed");
  });

  test("local all_cards import fails before reading source without oracle_cards", async () => {
    const services = createScryfallLocalImportServices(fakeRepository([]), clock);
    let read = false;

    const result = await services.importAllCards(
      {
        stream() {
          read = true;
          return new ReadableStream<Uint8Array>();
        },
      },
      { sourceUri: "fixture://all-cards" },
    );

    expect(result.isErr()).toBe(true);
    expect(read).toBe(false);
    if (result.isOk()) throw new Error("expected failed import");
    expect(result.error.type).toBe("import_failed");
  });

  test("local import caps source-format validation diagnostics", async () => {
    const repository = fakeRepository(["oracle_cards"]);
    const services = createScryfallLocalImportServices(repository, clock);

    const result = await services.importOracleCards(
      streamSource(Array.from({ length: 25 }, () => ({ object: "card" }))),
      { sourceUri: "fixture://invalid" },
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected failed import");
    expect(result.error.type).toBe("import_failed");
    if (result.error.type !== "import_failed") {
      throw new Error("expected failed import");
    }
    expect(result.error.importAttempt.blockingErrors).toHaveLength(20);
  });

  test("raw Scryfall schemas accept unknown fields without preserving them", () => {
    const oracle = RawScryfallOracleCardSchema.parse({
      object: "card",
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      oracle_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Sol Ring",
      mana_cost: "{1}",
      type_line: "Artifact",
      oracle_text: "{T}: Add {C}{C}.",
      color_identity: [],
      legalities: {
        commander: "legal",
        future_format: "legal",
      },
      future_scryfall_field: "accepted but stripped",
    });
    const allCard = RawScryfallAllCardSchema.parse({
      object: "card",
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      oracle_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Sol Ring",
      set: "v10",
      collector_number: "12",
      finishes: ["foil"],
      lang: "en",
      future_scryfall_field: "accepted but stripped",
    });

    expect("future_scryfall_field" in oracle).toBe(false);
    expect("future_format" in oracle.legalities).toBe(false);
    expect("future_scryfall_field" in allCard).toBe(false);
  });
});

function fakeRepository(
  availableBulkDataTypes: readonly ScryfallBulkDataType[],
): ScryfallRepository {
  return {
    async getLatestSuccessfulBulkDataImport(bulkDataType) {
      if (!availableBulkDataTypes.includes(bulkDataType)) {
        return ok(null);
      }

      return ok({
        id: `${bulkDataType}-import`,
        bulkDataType,
        status: "succeeded",
        startedAt: clock.now(),
        completedAt: clock.now(),
        sourceUpdatedAt: clock.now(),
        sourceUri: "fixture://scryfall",
        importedRecordCount: 1,
        warnings: [],
        blockingErrors: [],
      } satisfies ScryfallBulkDataImport);
    },
    async importCardIdentities(input) {
      try {
        return ok(importAttempt("oracle_cards", await countRecords(input.records), "succeeded"));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },
    async importCardPrintings(input) {
      try {
        return ok(importAttempt("all_cards", await countRecords(input.records), "succeeded"));
      } catch (error) {
        return err(toRepositoryError(error));
      }
    },
    async recordFailedBulkDataImport(bulkDataType, input) {
      return ok({
        ...importAttempt(bulkDataType, 0, "failed"),
        sourceUri: input.sourceUri ?? null,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        blockingErrors: input.blockingErrors,
        warnings: input.warnings ?? [],
      });
    },
  };
}

async function countRecords(records: AsyncIterable<unknown>): Promise<number> {
  let count = 0;
  for await (const _record of records) {
    count += 1;
  }
  return count;
}

function toRepositoryError(error: unknown) {
  const blockingErrors =
    typeof error === "object" &&
    error !== null &&
    Array.isArray((error as { readonly blockingErrors?: unknown }).blockingErrors)
      ? (error as { readonly blockingErrors: readonly string[] }).blockingErrors
      : undefined;

  return {
    type: "repository_error" as const,
    message: error instanceof Error ? error.message : String(error),
    ...(blockingErrors ? { blockingErrors } : {}),
  };
}

function streamSource(value: unknown) {
  return {
    stream() {
      return new Response(JSON.stringify(value)).body!;
    },
  };
}

function importAttempt(
  bulkDataType: ScryfallBulkDataType,
  importedRecordCount: number,
  status: "succeeded" | "failed",
): ScryfallBulkDataImport {
  return {
    id: `${bulkDataType}-${status}`,
    bulkDataType,
    status,
    startedAt: clock.now(),
    completedAt: clock.now(),
    sourceUpdatedAt: clock.now(),
    sourceUri: "fixture://scryfall",
    importedRecordCount,
    warnings: [],
    blockingErrors: [],
  };
}
