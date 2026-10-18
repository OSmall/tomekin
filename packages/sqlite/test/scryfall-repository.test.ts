import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
    type CardIdentity,
    type CardIdentityImportRecord,
    CardIdentityImportRecordSchema,
    type CardIdentityTagImportRecord,
    CardIdentityTagImportRecordSchema,
    type CardPrintingImportRecord,
    CardPrintingImportRecordSchema,
    createScryfallLocalImportServices,
    createScryfallSyncServices,
    createTestRootLoggerFromEnv,
    mapRawScryfallAllCardToCardPrintingImportRecord,
    mapRawScryfallOracleCardToCardIdentityImportRecord,
    mapRawScryfallOracleTagToCardIdentityTagImportRecord,
    RawScryfallAllCardSchema,
    RawScryfallOracleCardSchema,
    RawScryfallOracleTagSchema,
    requiredScryfallImportContractRevisions,
} from "@tomekin/core";
import {
    applySqliteMigrations,
    closeDatabase,
    collectionCard,
    collectionLocation,
    createSqliteScryfallRepository,
    openDatabase,
} from "@tomekin/sqlite";

describe("SQLite Scryfall repository", () => {
  test("successful oracle_cards import records success and exposes Card Identities", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();

    const result = await repository.importCardIdentities(importInput(records));

    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.id).toMatch(uuidV7Pattern);
    expect(result.value.status).toBe("succeeded");
    expect(result.value.bulkDataType).toBe("oracle_cards");
      expect(result.value.importContractRevision).toBe(requiredScryfallImportContractRevisions.oracle_cards);
    expect(result.value.importedRecordCount).toBe(8);

    const imported = await repository.listCardIdentities();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "6ad8011d-3471-4369-9d68-b264cc027487",
        name: "Sol Ring",
        manaCost: "{1}",
        manaValue: 1,
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
          copyLimitOverride: {kind: "none"},
        colorIdentity: "",
        sourcePageUri: expect.stringContaining("scryfall.com/card/"),
      }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "d2075f58-b0e9-4e85-b7e6-0523a27a1d5b",
        name: "Bala Ged Recovery // Bala Ged Sanctuary",
        layout: "modal_dfc",
        manaCost: null,
        manaValue: 3,
        typeLine: "Sorcery // Land",
        oracleText: null,
        colorIdentity: "G",
        producedMana: "G",
        sourcePageUri: expect.stringContaining("scryfall.com/card/"),
      }),
    );
    const parts = await repository.listCardIdentityParts();
    expect(parts.isOk()).toBe(true);
    if (parts.isErr()) throw new Error(parts.error.message);
    expect(parts.value).toContainEqual(
        expect.objectContaining({
          cardIdentityId: "d2075f58-b0e9-4e85-b7e6-0523a27a1d5b",
          partIndex: 0,
          name: "Bala Ged Recovery",
          manaCost: "{2}{G}",
          colors: "G",
        }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "b0d1c34c-30f1-4c07-9527-38b49231eb9f",
        name: "Little Girl",
        manaCost: "{HW}",
        manaValue: 0.5,
        typeLine: "Creature — Human Child",
        oracleText: "",
        colorIdentity: "W",
      }),
    );
    const legalities = await repository.listCardIdentityFormatLegalities();
    expect(legalities.isOk()).toBe(true);
    if (legalities.isErr()) throw new Error(legalities.error.message);
    expect(legalities.value).toContainEqual({
      cardIdentityId: "6ad8011d-3471-4369-9d68-b264cc027487",
      format: "commander",
      legality: "legal",
    });

    const attempts = await repository.listBulkDataImports();
    expect(attempts.isOk()).toBe(true);
    if (attempts.isErr()) throw new Error(attempts.error.message);
    expect(attempts.value.map((attempt) => attempt.status)).toEqual(["succeeded"]);
  });

    test("unsupported Copy Limit Override wording fails without replacing the previous Oracle Cards dataset", async () => {
        const repository = createTestRepository();
        const rawCards = await readFixture("oracle-cards-minimal.json", RawScryfallOracleCardSchema.array());
        expect((await repository.importCardIdentities(importInput(rawCards.map(mapRawScryfallOracleCardToCardIdentityImportRecord)))).isOk()).toBe(true);
        const services = createScryfallLocalImportServices(repository, {now: () => new Date("2025-01-02T00:00:00.000Z")});
        const badCard = {
            ...rawCards[0],
            name: "Future Colony",
            oracle_text: "Your deck may contain as many cards named Future Colony as you like.",
        };

        const failed = await services.importOracleCards({
            stream: () => new Response(JSON.stringify([badCard])).body!,
        }, {sourceUri: "fixture://unsupported-copy-limit"});

        expect(failed.isErr()).toBe(true);
        if (failed.isOk()) throw new Error("expected import failure");
        expect(failed.error.message).toContain("unsupported potential Copy Limit Override wording");
        const identities = await repository.listCardIdentities();
        if (identities.isErr()) throw new Error(identities.error.message);
        expect(identities.value.map((identity) => identity.name)).toContain("Sol Ring");
        expect(identities.value.map((identity) => identity.name)).not.toContain("Future Colony");
    });

  test("failed oracle_cards import records failure and preserves previous Card Identity dataset", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    const initial = await repository.importCardIdentities(importInput(records));
    expect(initial.isOk()).toBe(true);

    const failed = await repository.importCardIdentities(
      importInput<CardIdentityImportRecord>([
        records[0],
        {
          ...records[0],
          identity: { ...records[0].identity, name: "Duplicate Sol Ring" },
        },
      ]),
    );

    expect(failed.isErr()).toBe(true);

    const imported = await repository.listCardIdentities();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value.map((card) => card.name)).toContain("Sol Ring");
    expect(imported.value).toHaveLength(8);
  });

  test("successful all_cards import records success and exposes Card Printings", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    const identities = records.map((record) => record.identity);
    const printings = await readAllCardPrintingsFixture();
    const printingsWithImportedIdentities = filterPrintingsWithKnownIdentities(
      printings,
      identities,
    );
    const identityImport = await repository.importCardIdentities(importInput(records));
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
        layout: "standard",
        printedName: null,
        setId: "3e3ea3e8-3d63-481f-b3ec-03c4f50b602e",
        collectorNumber: "12",
        finishes: ["foil"],
        language: "en",
        tcgplayerId: 36767,
        sourcePageUri: expect.stringContaining("scryfall.com/card/"),
      }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "54cf4f5c-1305-48bb-b046-d56706e9b81e",
        cardIdentityId: "ae92942b-919c-4ea9-b693-85fcef765d5a",
        printedName: null,
        language: "ja",
      }),
    );
    expect(imported.value).toContainEqual(
      expect.objectContaining({
        id: "10b624fe-3eec-487d-8a0d-a9f2e2708263",
        printedName: "Sigillo Arcano",
        language: "it",
      }),
    );
    const parts = await repository.listCardPrintingParts();
    expect(parts.isOk()).toBe(true);
    if (parts.isErr()) throw new Error(parts.error.message);
    expect(parts.value).toContainEqual(
        expect.objectContaining({
          cardPrintingId: "54cf4f5c-1305-48bb-b046-d56706e9b81e",
          partIndex: 0,
          printedName: "火",
          printedTypeLine: "インスタント",
        }),
    );
    const sets = await repository.listCardSets();
    if (sets.isErr()) throw new Error(sets.error.message);
    expect(sets.value).toContainEqual(expect.objectContaining({
      id: "3e3ea3e8-3d63-481f-b3ec-03c4f50b602e",
      code: "v10",
      sourcePageUri: "https://scryfall.com/sets/v10",
      cardSearchUri: expect.stringContaining("?"),
    }));
    const promoTypes = await repository.listCardPrintingPromoTypes();
    if (promoTypes.isErr()) throw new Error(promoTypes.error.message);
    expect(promoTypes.value).toContainEqual(expect.objectContaining({promoType: "universesbeyond"}));
  });

    test("all_cards rejects Set metadata conflicts and code-to-UUID conflicts transactionally", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const printings = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
        expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);
        const baselineSets = await repository.listCardSets();
        if (baselineSets.isErr()) throw new Error(baselineSets.error.message);

        const metadataConflict = {...printings[0], set: {...printings[0].set, name: "Conflicting name"}};
        const metadataResult = await repository.importCardPrintings(importInput([...printings, metadataConflict]));
        expect(metadataResult.isErr()).toBe(true);
        if (metadataResult.isOk()) throw new Error("expected Set metadata conflict");
        expect(metadataResult.error.message).toContain(`conflicting Card Set ID ${printings[0].set.id}`);

        const conflictingSetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        const codeConflict = {
            ...printings[0],
            set: {...printings[0].set, id: conflictingSetId},
            printing: {...printings[0].printing, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", setId: conflictingSetId},
            parts: [],
            promoTypes: [],
        };
        const codeResult = await repository.importCardPrintings(importInput([...printings, codeConflict]));
        expect(codeResult.isErr()).toBe(true);
        if (codeResult.isOk()) throw new Error("expected Set code conflict");
        expect(codeResult.error.message).toContain(`maps Card Set code ${printings[0].set.code} to multiple Set IDs`);

        const after = await repository.listCardSets();
        if (after.isErr()) throw new Error(after.error.message);
        expect(after.value).toEqual(baselineSets.value);
    });

    test("all_cards rejects duplicate promo types and removes stale Sets after Printings", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const printings = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
        expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);
        const printing = printings[0];
        const promo = {cardPrintingId: printing.printing.id, promoType: "duplicate"};
        const duplicateResult = await repository.importCardPrintings(importInput([
            {...printing, promoTypes: [promo, promo]},
        ]));
        expect(duplicateResult.isErr()).toBe(true);

        const retainedSet = printing.set;
        const refresh = await repository.importCardPrintings(importInput([printing]));
        expect(refresh.isOk()).toBe(true);
        const sets = await repository.listCardSets();
        if (sets.isErr()) throw new Error(sets.error.message);
        expect(sets.value).toEqual([retainedSet]);
    });

    test("all_cards can move a retained Printing to a new Set before removing its stale Set", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const [printing] = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        if (!printing) throw new Error("expected a Printing fixture");
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
        expect((await repository.importCardPrintings(importInput([printing]))).isOk()).toBe(true);

        const replacementSet = {
            ...printing.set,
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            code: "new",
            name: "Replacement Set",
        };
        const moved = {
            ...printing,
            set: replacementSet,
            printing: {...printing.printing, setId: replacementSet.id},
        };
        const result = await repository.importCardPrintings(importInput([moved]));

        expect(result.isOk()).toBe(true);
        const sets = await repository.listCardSets();
        const printings = await repository.listCardPrintings();
        if (sets.isErr()) throw new Error(sets.error.message);
        if (printings.isErr()) throw new Error(printings.error.message);
        expect(sets.value).toEqual([replacementSet]);
        expect(printings.value[0]?.setId).toBe(replacementSet.id);
    });

    test("all_cards import accepts equivalent duplicate Card Printing records once", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const printings = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);

        const result = await repository.importCardPrintings(
            importInput([...printings, printings[0]]),
        );

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.importedRecordCount).toBe(printings.length);

        const imported = await repository.listCardPrintings();
        expect(imported.isOk()).toBe(true);
        if (imported.isErr()) throw new Error(imported.error.message);
        expect(imported.value).toHaveLength(printings.length);
    });

    test("all_cards import rejects conflicting duplicate Card Printing records without replacing the previous dataset", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const printings = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
        expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);
        const conflicting = {
            ...printings[0],
            printing: {...printings[0].printing, collectorNumber: "conflict"},
        };

        const result = await repository.importCardPrintings(
            importInput([...printings, conflicting]),
        );

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("expected conflicting duplicate import to fail");
        expect(result.error.message).toContain("conflicting Card Printing ID");
        expect(result.error.message).toContain(printings[0].printing.id);

        const imported = await repository.listCardPrintings();
        expect(imported.isOk()).toBe(true);
        if (imported.isErr()) throw new Error(imported.error.message);
        expect(imported.value).toContainEqual(
            expect.objectContaining({
                id: printings[0].printing.id,
                setId: printings[0].printing.setId,
            }),
        );
    });

    test("all_cards import rejects a duplicate Card Printing ID with different finishes", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const [printing] = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);

        const result = await repository.importCardPrintings(
            importInput([
                printing,
                {...printing, printing: {...printing.printing, finishes: ["nonfoil"]}},
            ]),
        );

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("expected conflicting duplicate import to fail");
        expect(result.error.message).toContain(`conflicting Card Printing ID ${printing.printing.id}`);
    });

    test("all_cards import rejects a duplicate Card Printing ID with different printing parts", async () => {
        const repository = createTestRepository();
        const records = await readOracleCardIdentityRecordsFixture();
        const printings = filterPrintingsWithKnownIdentities(
            await readAllCardPrintingsFixture(),
            records.map((record) => record.identity),
        );
        const printing = printings.find((candidate) => candidate.parts.length > 0);
        if (!printing) throw new Error("expected a printing with parts in the fixture");
        expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);

        const result = await repository.importCardPrintings(
            importInput([
                printing,
                {
                    ...printing,
                    parts: [
                        {...printing.parts[0], printedText: "conflicting printed text"},
                        ...printing.parts.slice(1),
                    ],
                },
            ]),
        );

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("expected conflicting duplicate import to fail");
        expect(result.error.message).toContain(`conflicting Card Printing ID ${printing.printing.id}`);
    });

  test("all_cards derives reversible_card Card Identity from a single face oracle_id", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
    const rawCards = await readFixture(
        "all-cards-minimal.json",
        RawScryfallAllCardSchema.array(),
    );
    const {oracle_id: _oracleId, ...baseCard} = rawCards[0];
    const reversible = mapRawScryfallAllCardToCardPrintingImportRecord(
        RawScryfallAllCardSchema.parse({
          ...baseCard,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          layout: "reversible_card",
          card_faces: [
            {object: "card_face", oracle_id: records[0].identity.id, printed_name: "Front"},
            {object: "card_face", oracle_id: records[0].identity.id, printed_name: "Back"},
          ],
        }),
    );

    const result = await repository.importCardPrintings(importInput([reversible]));

    expect(result.isOk()).toBe(true);
    const imported = await repository.listCardPrintings();
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toContainEqual(
        expect.objectContaining({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          cardIdentityId: records[0].identity.id,
          layout: "reversible_card",
      }),
    );
  });

  test("all_cards import fails when a Card Printing references a missing Card Identity", async () => {
    const repository = createTestRepository();
    const printings = await readAllCardPrintingsFixture();

    const result = await repository.importCardPrintings(importInput(printings));

    expect(result.isErr()).toBe(true);

    const imported = await repository.listCardPrintings();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value).toEqual([]);
  });

  test("failed all_cards import preserves previous Card Printing dataset", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    const identities = records.map((record) => record.identity);
    const printings = filterPrintingsWithKnownIdentities(
      await readAllCardPrintingsFixture(),
      identities,
    );
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
    expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);

    const failed = await repository.importCardPrintings(
        importInput<CardPrintingImportRecord>([
        {
          ...printings[0],
          printing: {
            ...printings[0].printing,
            id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            cardIdentityId: "99999999-9999-9999-9999-999999999999",
          },
        },
      ]),
    );

    expect(failed.isErr()).toBe(true);

    const imported = await repository.listCardPrintings();
    expect(imported.isOk()).toBe(true);
    if (imported.isErr()) throw new Error(imported.error.message);
    expect(imported.value.map((printing) => printing.id)).toContain(
      "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
    );
    expect(imported.value).toHaveLength(6);
  });

    test("all_cards refresh preserves collection rows for printings still present in Scryfall", async () => {
        const fixture = createTestRepositoryFixture();
        try {
            const {repository, db} = fixture;
            const records = await readOracleCardIdentityRecordsFixture();
            const identities = records.map((record) => record.identity);
            const printings = filterPrintingsWithKnownIdentities(
                await readAllCardPrintingsFixture(),
                identities,
            );
            expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
            expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);
            db.insert(collectionLocation)
                .values({id: "11111111-1111-4111-8111-111111111111", name: "Main Box", type: "binder"})
                .run();
            db.insert(collectionCard)
                .values({
                    id: "22222222-2222-4222-8222-222222222222",
                    quantity: 1,
                    collectionLocationId: "11111111-1111-4111-8111-111111111111",
                    finish: "foil",
                    manaBoxId: null,
                    cardPrintingId: "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
                    misprint: false,
                    altered: false,
                    condition: "near_mint",
                    purchasePriceCurrency: null,
                    purchasePrice: null,
                    addedAt: null,
                    sourceRowNumber: 1,
                })
                .run();

            const result = await repository.importCardPrintings(importInput(printings));

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            const collectionRows = await db.select().from(collectionCard);
            expect(collectionRows).toHaveLength(1);
            expect(collectionRows[0]?.cardPrintingId).toBe("073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a");
            const imported = await repository.listCardPrintings();
            if (imported.isErr()) throw new Error(imported.error.message);
            expect(imported.value).toHaveLength(6);
        } finally {
            closeDatabase(fixture.db);
        }
    });

    test("all_cards refresh fails before orphaning collection rows for printings missing from Scryfall", async () => {
        const fixture = createTestRepositoryFixture();
        try {
            const {repository, db} = fixture;
            const records = await readOracleCardIdentityRecordsFixture();
            const identities = records.map((record) => record.identity);
            const printings = filterPrintingsWithKnownIdentities(
                await readAllCardPrintingsFixture(),
                identities,
            );
            expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
            expect((await repository.importCardPrintings(importInput(printings))).isOk()).toBe(true);
            db.insert(collectionLocation)
                .values({id: "11111111-1111-4111-8111-111111111111", name: "Main Box", type: "binder"})
                .run();
            db.insert(collectionCard)
                .values({
                    id: "22222222-2222-4222-8222-222222222222",
                    quantity: 1,
                    collectionLocationId: "11111111-1111-4111-8111-111111111111",
                    finish: "foil",
                    manaBoxId: null,
                    cardPrintingId: "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
                    misprint: false,
                    altered: false,
                    condition: "near_mint",
                    purchasePriceCurrency: null,
                    purchasePrice: null,
                    addedAt: null,
                    sourceRowNumber: 1,
                })
                .run();

            const result = await repository.importCardPrintings(
                importInput(
                    printings.filter(
                        (record) => record.printing.id !== "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
                    ),
                ),
            );

            expect(result.isErr()).toBe(true);
            if (result.isOk()) throw new Error("expected failed import");
            expect(result.error.message).toContain("orphan existing Collection Card references");
            expect(result.error.message).toContain("073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a");
            const collectionRows = await db.select().from(collectionCard);
            expect(collectionRows).toHaveLength(1);
            expect(collectionRows[0]?.cardPrintingId).toBe("073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a");
            const imported = await repository.listCardPrintings();
            if (imported.isErr()) throw new Error(imported.error.message);
            expect(imported.value).toHaveLength(6);
            expect(imported.value.map((printing) => printing.id)).toContain(
                "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a",
            );
        } finally {
            closeDatabase(fixture.db);
        }
    });

  test("successful oracle_tags import records success and exposes tags, aliases, taggings, and hierarchy", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);

    const result = await repository.importCardIdentityTags(
      importInput(oracleTagImportRecords()),
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.bulkDataType).toBe("oracle_tags");
    expect(result.value.importedRecordCount).toBe(2);

    const tags = await repository.listCardIdentityTags();
    const aliases = await repository.listCardIdentityTagAliases();
    const taggings = await repository.listCardIdentityTaggings();
    const hierarchy = await repository.listCardIdentityTagHierarchy();
    if (tags.isErr()) throw new Error(tags.error.message);
    if (aliases.isErr()) throw new Error(aliases.error.message);
    if (taggings.isErr()) throw new Error(taggings.error.message);
    if (hierarchy.isErr()) throw new Error(hierarchy.error.message);
    expect(tags.value).toContainEqual(
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        slug: "mana-rock",
        label: "mana rock",
        description: null,
      }),
    );
    expect(aliases.value).toEqual([
      { tagId: "11111111-1111-4111-8111-111111111111", alias: "mana-stone" },
    ]);
    expect(taggings.value).toContainEqual({
      tagId: "11111111-1111-4111-8111-111111111111",
      cardIdentityId: "6ad8011d-3471-4369-9d68-b264cc027487",
      weight: "very_strong",
      annotation: "format staple",
    });
    expect(hierarchy.value).toEqual([
      {
        parentTagId: "33333333-3333-4333-8333-333333333333",
        childTagId: "11111111-1111-4111-8111-111111111111",
      },
    ]);
  });

  test("failed oracle_tags import preserves previous tag dataset", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
    expect(
      (await repository.importCardIdentityTags(importInput(oracleTagImportRecords()))).isOk(),
    ).toBe(true);

    const failed = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([
        {
          ...oracleTagImportRecords()[0],
          taggings: [
            {
              tagId: "11111111-1111-4111-8111-111111111111",
              cardIdentityId: "99999999-9999-4999-8999-999999999999",
              weight: "median",
              annotation: null,
            },
          ],
        },
      ]),
    );

    expect(failed.isErr()).toBe(true);
    const tags = await repository.listCardIdentityTags();
    if (tags.isErr()) throw new Error(tags.error.message);
    expect(tags.value.map((tag) => tag.slug).sort()).toEqual(["artifact-ramp", "mana-rock"]);
  });

  test("oracle_tags rejects duplicate and invalid staged data", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
    const valid = oracleTagImportRecords();

    const duplicateId = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([valid[0], { ...valid[0], tag: { ...valid[0].tag, slug: "copy" } }]),
    );
    const duplicateSlug = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([valid[0], { ...valid[1], tag: { ...valid[1].tag, slug: valid[0].tag.slug } }]),
    );
    const duplicateAlias = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([{ ...valid[0], aliases: [valid[0].aliases[0], valid[0].aliases[0]] }]),
    );
    const duplicateTagging = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([{ ...valid[0], taggings: [valid[0].taggings[0], valid[0].taggings[0]] }]),
    );
    const duplicateHierarchy = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([{ ...valid[0], hierarchy: [valid[0].hierarchy[0], valid[0].hierarchy[0]] }, valid[1]]),
    );
    const missingParent = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([{ ...valid[1], hierarchy: [{ parentTagId: "99999999-9999-4999-8999-999999999999", childTagId: valid[1].tag.id }] }]),
    );
    const selfParent = await repository.importCardIdentityTags(
      importInput<CardIdentityTagImportRecord>([{ ...valid[1], hierarchy: [{ parentTagId: valid[1].tag.id, childTagId: valid[1].tag.id }] }]),
    );
    const zeroTags = await repository.importCardIdentityTags(importInput([]));

    for (const result of [
      duplicateId,
      duplicateSlug,
      duplicateAlias,
      duplicateTagging,
      duplicateHierarchy,
      missingParent,
      selfParent,
      zeroTags,
    ]) {
      expect(result.isErr()).toBe(true);
    }
  });

  test("oracle_cards replacement fails before orphaning existing Card Identity Taggings", async () => {
    const repository = createTestRepository();
    const records = await readOracleCardIdentityRecordsFixture();
    expect((await repository.importCardIdentities(importInput(records))).isOk()).toBe(true);
    expect(
      (await repository.importCardIdentityTags(importInput(oracleTagImportRecords()))).isOk(),
    ).toBe(true);

    const result = await repository.importCardIdentities(
      importInput(records.filter((record) => record.identity.name !== "Sol Ring")),
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected failed import");
    expect(result.error.message).toContain("orphan");
    const identities = await repository.listCardIdentities();
    if (identities.isErr()) throw new Error(identities.error.message);
    expect(identities.value.map((identity) => identity.name)).toContain("Sol Ring");
  });

  test("required-dataset checks report missing oracle_cards and all_cards clearly", async () => {
    const repository = createTestRepository();
    const services = createScryfallSyncServices(repository, {
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    });

    const result = await services.requireCardReferenceData();

    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("expected missing datasets");
      expect(result.error.type).toBe("reference_data_unready");
      if (result.error.type !== "reference_data_unready") {
      throw new Error("expected missing dataset error");
    }
    expect(result.error.missingBulkDataTypes).toEqual(["oracle_cards", "all_cards"]);
    expect(result.error.message).toContain("oracle_cards");
    expect(result.error.message).toContain("all_cards");
  });
});

const uuidV7Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const testLog = createTestRootLoggerFromEnv();

function createTestRepository() {
    return createTestRepositoryFixture().repository;
}

function createTestRepositoryFixture() {
  const dir = mkdtempSync(join(tmpdir(), "tomekin-sqlite-"));
  const dbPath = join(dir, "test.sqlite");
  applySqliteMigrations(dbPath, {log: testLog});
  const db = openDatabase(dbPath, {log: testLog});
    const repository = createSqliteScryfallRepository(db, {
    now: () => new Date("2025-01-01T00:00:01.000Z"),
  });
    return {db, repository};
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

async function readOracleCardIdentityRecordsFixture(): Promise<
  readonly CardIdentityImportRecord[]
> {
  const rawCards = await readFixture(
    "oracle-cards-minimal.json",
    RawScryfallOracleCardSchema.array(),
  );
  return CardIdentityImportRecordSchema.array().parse(
    rawCards.map(mapRawScryfallOracleCardToCardIdentityImportRecord),
  );
}

async function readAllCardPrintingsFixture(): Promise<readonly CardPrintingImportRecord[]> {
  const rawCards = await readFixture(
    "all-cards-minimal.json",
    RawScryfallAllCardSchema.array(),
  );
  return CardPrintingImportRecordSchema.array().parse(
      rawCards.map(mapRawScryfallAllCardToCardPrintingImportRecord),
  );
}

function filterPrintingsWithKnownIdentities(
    printings: readonly CardPrintingImportRecord[],
  identities: readonly CardIdentity[],
): readonly CardPrintingImportRecord[] {
  const identityIds = new Set(identities.map((identity) => identity.id));
  return printings.filter((record) => identityIds.has(record.printing.cardIdentityId));
}

function oracleTagImportRecords(): readonly CardIdentityTagImportRecord[] {
  return CardIdentityTagImportRecordSchema.array().parse(
    rawOracleTags.map((tag) =>
      mapRawScryfallOracleTagToCardIdentityTagImportRecord(
        RawScryfallOracleTagSchema.parse(tag),
      ),
    ),
  );
}

function importInput<TRecord>(records: readonly TRecord[]) {
  return {
    startedAt: new Date("2025-01-01T00:00:00.000Z"),
    sourceUpdatedAt: new Date("2024-12-31T00:00:00.000Z"),
    sourceUri: "fixture://scryfall",
    records: toAsyncIterable(records),
  };
}

async function* toAsyncIterable<T>(records: readonly T[]): AsyncIterable<T> {
  yield* records;
}

const rawOracleTags = [
  {
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
        oracle_id: "6ad8011d-3471-4369-9d68-b264cc027487",
        weight: "very_strong",
        annotation: "format staple",
      },
    ],
  },
  {
    object: "tag",
    id: "33333333-3333-4333-8333-333333333333",
    label: "artifact ramp",
    slug: "artifact-ramp",
    type: "oracle",
    uri: "https://tagger.scryfall.com/tags/card/artifact-ramp",
    description: "Artifacts that produce mana.",
    parent_ids: [],
    child_ids: ["11111111-1111-4111-8111-111111111111"],
    aliases: [],
    taggings: [],
  },
] as const;


test.each([
    ["clock rollback", "2024-12-31T00:00:00.000Z"],
    ["same timestamp and lower UUID", "2025-01-01T00:00:01.000Z"],
])("Scryfall import readiness and latest facts follow committed replacement under %s", async (_case, timestamp) => {
    const {db, repository} = createTestRepositoryFixture();
    try {
        const records = await readOracleCardIdentityRecordsFixture();
        (await repository.importCardIdentities(importInput(records)))._unsafeUnwrap();
        const oldId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
        db.$client.prepare("UPDATE scryfall_bulk_data_import SET id = ?, import_contract_revision = 0 WHERE bulk_data_type = 'oracle_cards'").run(oldId);
        const replacement = createSqliteScryfallRepository(db, {now: () => new Date(timestamp)});
        const imported = (await replacement.importCardIdentities({...importInput(records), startedAt: new Date(timestamp)}))._unsafeUnwrap();
        expect(imported.id < oldId).toBe(true);
        (await replacement.importCardPrintings(importInput(await readAllCardPrintingsFixture())))._unsafeUnwrap();
        (await replacement.recordFailedBulkDataImport("oracle_cards", {startedAt: new Date("2026-01-01"), completedAt: new Date("2026-01-01"), blockingErrors: ["Synthetic failed replacement"]}))._unsafeUnwrap();
        expect((await replacement.getLatestSuccessfulBulkDataImport("oracle_cards"))._unsafeUnwrap()?.id).toBe(imported.id);
        expect((await createScryfallSyncServices(replacement, {now: () => new Date(timestamp)}).requireCardReferenceData()).isOk()).toBe(true);
        expect((await replacement.listCardIdentities())._unsafeUnwrap().find(card => card.name === "Sol Ring")?.id).toBe("6ad8011d-3471-4369-9d68-b264cc027487");
    } finally {closeDatabase(db);}
});
