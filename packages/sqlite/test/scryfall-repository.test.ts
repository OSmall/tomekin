import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CardIdentitySchema,
  CardPrintingSchema,
  createScryfallSyncServices,
  mapRawScryfallAllCardToCardPrinting,
  mapRawScryfallOracleCardToCardIdentity,
  RawScryfallAllCardSchema,
  RawScryfallOracleCardSchema,
  type CardIdentity,
  type CardPrinting,
} from "@mtg-agent/core";
import {
  createSqliteScryfallRepository,
  initializeDatabaseSchema,
  openDatabase,
} from "@mtg-agent/sqlite";

describe("SQLite Scryfall repository", () => {
  test("successful oracle_cards import records success and exposes Card Identities", async () => {
    const repository = createTestRepository();
    const identities = await readOracleCardIdentitiesFixture();

    const result = await repository.importCardIdentities(importInput(identities));

    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.status).toBe("succeeded");
    expect(result.value.bulkDataType).toBe("oracle_cards");
    expect(result.value.importedRecordCount).toBe(7);

    const imported = await repository.listCardIdentities();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "6ad8011d-3471-4369-9d68-b264cc027487",
        name: "Sol Ring",
        manaCost: "{1}",
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
        colorIdentity: [],
        commanderLegality: "legal",
      }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "d2075f58-b0e9-4e85-b7e6-0523a27a1d5b",
        name: "Bala Ged Recovery // Bala Ged Sanctuary",
        manaCost: null,
        typeLine: "Sorcery // Land",
        oracleText: null,
        colorIdentity: ["G"],
        commanderLegality: "legal",
      }),
    );

    const attempts = await repository.listBulkDataImports();
    expect(attempts.isOk()).toBe(true);
    if (attempts.isErr()) throw new Error(attempts.error.message);
    expect(attempts.value.map((attempt) => attempt.status)).toEqual(["succeeded"]);
  });

  test("failed oracle_cards import records failure and preserves previous Card Identity dataset", async () => {
    const repository = createTestRepository();
    const identities = await readOracleCardIdentitiesFixture();
    const initial = await repository.importCardIdentities(importInput(identities));
    expect(initial.isOk()).toBe(true);

    const failed = await repository.importCardIdentities(
      importInput<CardIdentity>([
        identities[0],
        { ...identities[0], name: "Duplicate Sol Ring" },
      ]),
    );

    expect(failed.isOk()).toBe(true);
    if (failed.isErr()) throw new Error(failed.error.message);
    expect(failed.value.status).toBe("failed");
    expect(failed.value.blockingErrors[0]).toContain("Duplicate Card Identity IDs");

    const imported = await repository.listCardIdentities();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value.map((card) => card.name)).toContain("Sol Ring");
    expect(imported.value).toHaveLength(7);
  });

  test("successful all_cards import records success and exposes Card Printings", async () => {
    const repository = createTestRepository();
    const identities = await readOracleCardIdentitiesFixture();
    const printings = await readAllCardPrintingsFixture();
    const printingsWithImportedIdentities = filterPrintingsWithKnownIdentities(
      printings,
      identities,
    );
    const identityImport = await repository.importCardIdentities(importInput(identities));
    expect(identityImport.isOk()).toBe(true);

    const result = await repository.importCardPrintings(
      importInput(printingsWithImportedIdentities),
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.status).toBe("succeeded");
    expect(result.value.bulkDataType).toBe("all_cards");
    expect(result.value.importedRecordCount).toBe(6);

    const imported = await repository.listCardPrintings();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
        cardIdentityId: "6ad8011d-3471-4369-9d68-b264cc027487",
        name: "Sol Ring",
        setCode: "v10",
        collectorNumber: "12",
        finishes: ["foil"],
        language: "en",
      }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "54cf4f5c-1305-48bb-b046-d56706e9b81e",
        cardIdentityId: "ae92942b-919c-4ea9-b693-85fcef765d5a",
        name: "Fire // Ice",
        language: "ja",
      }),
    );
  });

  test("all_cards import fails when a Card Printing references a missing Card Identity", async () => {
    const repository = createTestRepository();
    const printings = await readAllCardPrintingsFixture();

    const result = await repository.importCardPrintings(importInput(printings));

    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.status).toBe("failed");
    expect(result.value.blockingErrors[0]).toContain(
      "all_cards import references missing Card Identity IDs",
    );

    const imported = await repository.listCardPrintings();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toEqual([]);
  });

  test("failed all_cards import preserves previous Card Printing dataset", async () => {
    const repository = createTestRepository();
    const identities = await readOracleCardIdentitiesFixture();
    const printings = filterPrintingsWithKnownIdentities(
      await readAllCardPrintingsFixture(),
      identities,
    );
    expect((await repository.importCardIdentities(importInput(identities))).isOk()).toBe(true);
    expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);

    const failed = await repository.importCardPrintings(
      importInput<CardPrinting>([
        {
          ...printings[0],
          id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
          cardIdentityId: "99999999-9999-9999-9999-999999999999",
        },
      ]),
    );

    expect(failed.isOk()).toBe(true);
    if (failed.isErr()) throw new Error(failed.error.message);
    expect(failed.value.status).toBe("failed");

    const imported = await repository.listCardPrintings();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value.map((printing) => printing.id)).toContain(
      "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
    );
    expect(imported.value).toHaveLength(6);
  });

  test("required-dataset checks report missing oracle_cards and all_cards clearly", async () => {
    const repository = createTestRepository();
    const services = createScryfallSyncServices(repository, {
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    const result = await services.requireCardReferenceData();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected missing datasets");
    expect(result.error.type).toBe("missing_required_scryfall_datasets");
    if (result.error.type !== "missing_required_scryfall_datasets") {
      throw new Error("expected missing dataset error");
    }
    expect(result.error.missingBulkDataTypes).toEqual(["oracle_cards", "all_cards"]);
    expect(result.error.message).toContain("oracle_cards");
    expect(result.error.message).toContain("all_cards");
  });
});

function createTestRepository() {
  const dir = mkdtempSync(join(tmpdir(), "mtg-agent-sqlite-"));
  const db = openDatabase(join(dir, "test.sqlite"));
  initializeDatabaseSchema(db);
  return createSqliteScryfallRepository(db);
}

async function readFixture<T>(
  fixtureName: string,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const value = await Bun.file(
    new URL(`./fixtures/${fixtureName}`, import.meta.url),
  ).json();
  return schema.parse(value);
}

async function readOracleCardIdentitiesFixture(): Promise<readonly CardIdentity[]> {
  const rawCards = await readFixture(
    "oracle-cards-minimal.json",
    RawScryfallOracleCardSchema.array(),
  );
  return CardIdentitySchema.array().parse(
    rawCards.map(mapRawScryfallOracleCardToCardIdentity),
  );
}

async function readAllCardPrintingsFixture(): Promise<readonly CardPrinting[]> {
  const rawCards = await readFixture(
    "all-cards-minimal.json",
    RawScryfallAllCardSchema.array(),
  );
  return CardPrintingSchema.array().parse(
    rawCards.map(mapRawScryfallAllCardToCardPrinting),
  );
}

function filterPrintingsWithKnownIdentities(
  printings: readonly CardPrinting[],
  identities: readonly CardIdentity[],
): readonly CardPrinting[] {
  const identityIds = new Set(identities.map((identity) => identity.id));
  return printings.filter((printing) => identityIds.has(printing.cardIdentityId));
}

function importInput<TRecord>(records: readonly TRecord[]) {
  return {
    startedAt: new Date("2025-01-01T00:00:00.000Z"),
    completedAt: new Date("2025-01-01T00:00:01.000Z"),
    sourceUpdatedAt: new Date("2024-12-31T00:00:00.000Z"),
    sourceUri: "fixture://scryfall",
    records,
  };
}
