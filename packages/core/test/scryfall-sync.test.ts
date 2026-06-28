import {describe, expect, test} from "bun:test";
import {
    createScryfallLocalImportServices,
    createScryfallSyncServices,
    mapRawScryfallOracleCardToCardIdentityImportRecord,
    mapRawScryfallOracleTagToCardIdentityTagImportRecord,
    RawScryfallAllCardSchema,
    RawScryfallOracleCardSchema,
    RawScryfallOracleTagSchema,
    type ScryfallBulkDataImport,
    type ScryfallBulkDataType,
    type ScryfallRepository,
} from "@mtg-agent/core";
import {err, ok} from "neverthrow";

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

  test("local oracle_tags import fails before reading source without oracle_cards", async () => {
    const services = createScryfallLocalImportServices(fakeRepository([]), clock);
    let read = false;

    const result = await services.importOracleTags(
      {
        stream() {
          read = true;
          return new ReadableStream<Uint8Array>();
        },
      },
      { sourceUri: "fixture://oracle-tags" },
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
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      oracle_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Sol Ring",
        layout: "normal",
      mana_cost: "{1}",
      cmc: 1,
      type_line: "Artifact",
      oracle_text: "{T}: Add {C}{C}.",
      color_identity: [],
        keywords: [],
        game_changer: false,
      legalities: {
        commander: "legal",
        future_format: "legal",
      },
      scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
      future_scryfall_field: "accepted but stripped",
    });
    const allCard = RawScryfallAllCardSchema.parse({
      object: "card",
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      oracle_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "Sol Ring",
        layout: "normal",
      printed_name: "Sol Ring",
      set: "v10",
      collector_number: "12",
      finishes: ["foil"],
      lang: "en",
      scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
      future_scryfall_field: "accepted but stripped",
    });

    expect("future_scryfall_field" in oracle).toBe(false);
    expect(oracle.legalities.future_format).toBe("legal");
    expect("future_scryfall_field" in allCard).toBe(false);
  });

    test("oracle_cards accepts Scryfall prepare layout cards", () => {
        const raw = RawScryfallOracleCardSchema.parse({
            object: "card",
            id: "d40cc7da-c731-418e-8547-7033d1939450",
            oracle_id: "02125db4-4507-467a-ac0c-406de2c7d533",
            name: "Adventurous Eater // Have a Bite",
            layout: "prepare",
            mana_cost: "{1}{G} // {G}",
            cmc: 2,
            type_line: "Creature — Halfling Citizen // Instant — Omen",
            color_identity: ["G"],
            colors: ["G"],
            keywords: [],
            game_changer: false,
            card_faces: [
                {
                    object: "card_face",
                    name: "Adventurous Eater",
                    mana_cost: "{1}{G}",
                    type_line: "Creature — Halfling Citizen",
                    oracle_text: "When this creature enters, create a Food token.",
                    colors: ["G"],
                    power: "2",
                    toughness: "2",
                },
                {
                    object: "card_face",
                    name: "Have a Bite",
                    mana_cost: "{G}",
                    type_line: "Instant — Omen",
                    oracle_text: "Create a Food token.",
                    colors: ["G"],
                },
            ],
            legalities: {commander: "legal"},
            scryfall_uri:
                "https://scryfall.com/card/fin/000/adventurous-eater-have-a-bite",
        });

        const record = mapRawScryfallOracleCardToCardIdentityImportRecord(raw);

        expect(record.identity.layout).toBe("prepare");
        expect(record.parts).toHaveLength(2);
        expect(record.parts[0]).toEqual(
            expect.objectContaining({name: "Adventurous Eater", partIndex: 0}),
        );
    });

    test("oracle_cards requires Game Changer data", () => {
        const result = RawScryfallOracleCardSchema.safeParse({
            object: "card",
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            oracle_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Sol Ring",
            layout: "normal",
            mana_cost: "{1}",
            cmc: 1,
            type_line: "Artifact",
            oracle_text: "{T}: Add {C}{C}.",
            color_identity: [],
            keywords: [],
            legalities: {commander: "legal"},
            scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
        });

        expect(result.success).toBe(false);
        if (result.success) throw new Error("expected missing game_changer to fail");
        expect(result.error.issues).toContainEqual(
            expect.objectContaining({path: ["game_changer"]}),
        );
    });

    test("oracle_cards accepts Sole Performer's Un-card produced mana", async () => {
        const rawJson = await Bun.file(
            new URL("./fixtures/sole-performer.json", import.meta.url),
        ).json();
        const raw = RawScryfallOracleCardSchema.parse(rawJson);

        const record = mapRawScryfallOracleCardToCardIdentityImportRecord(raw);

        expect(record.identity.name).toBe("Sole Performer");
        expect(record.identity.producedMana).toBe("T");
    });

  test("maps raw Scryfall oracle tags including nullable fields, aliases, annotations, and parents", () => {
    const raw = RawScryfallOracleTagSchema.parse(rawOracleTag());

    const record = mapRawScryfallOracleTagToCardIdentityTagImportRecord(raw);

    expect(record.tag).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      slug: "mana-rock",
      label: "mana rock",
      description: null,
      sourcePageUri: "https://tagger.scryfall.com/tags/card/mana-rock",
    });
    expect(record.aliases).toEqual([
      { tagId: "11111111-1111-4111-8111-111111111111", alias: "mana-stone" },
    ]);
    expect(record.taggings).toEqual([
      {
        tagId: "11111111-1111-4111-8111-111111111111",
        cardIdentityId: "22222222-2222-4222-8222-222222222222",
        weight: "very_strong",
        annotation: "format staple",
      },
    ]);
    expect(record.hierarchy).toEqual([
      {
        parentTagId: "33333333-3333-4333-8333-333333333333",
        childTagId: "11111111-1111-4111-8111-111111111111",
      },
    ]);
  });

  test("raw Scryfall oracle tags reject unknown types and weights", () => {
    expect(() =>
      RawScryfallOracleTagSchema.parse({ ...rawOracleTag(), type: "art" }),
    ).toThrow();
    expect(() =>
      RawScryfallOracleTagSchema.parse({
        ...rawOracleTag(),
        taggings: [{ oracle_id: "22222222-2222-4222-8222-222222222222", weight: "heavy" }],
      }),
    ).toThrow();
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
    async importCardIdentityTags(input) {
      try {
        return ok(importAttempt("oracle_tags", await countRecords(input.records), "succeeded"));
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

function rawOracleTag() {
  return {
    object: "tag",
    id: "11111111-1111-4111-8111-111111111111",
    label: "mana rock",
    slug: "mana-rock",
    type: "oracle",
    uri: "https://tagger.scryfall.com/tags/card/mana-rock",
    description: null,
    parent_ids: ["33333333-3333-4333-8333-333333333333"],
    child_ids: [],
    aliases: ["mana-stone"],
    taggings: [
      {
        oracle_id: "22222222-2222-4222-8222-222222222222",
        weight: "very_strong",
        annotation: "format staple",
      },
    ],
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
