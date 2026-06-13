import { describe, expect, test } from "bun:test";
import {
  createScryfallSyncServices,
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
  };
}
