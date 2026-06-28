import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
    applySqliteMigrations,
    cardIdentity,
    cardIdentityFormatLegality,
    cardPrinting,
    closeDatabase,
    collectionCard,
    collectionLocation,
    createSqliteCardQueryRepository,
    openDatabase,
} from "@mtg-agent/sqlite";

describe("SQLite Card Query repository", () => {
    test("queries Card Identities with Collection predicates and included owned rows", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-")), "test.sqlite");
        applySqliteMigrations(dbPath);
        const db = openDatabase(dbPath);
        try {
            db.insert(cardIdentity).values([
                identity("11111111-1111-4111-8111-111111111111", "Sol Ring"),
                identity("55555555-5555-4555-8555-555555555555", "Arcane Signet"),
            ]).run();
            db.insert(cardIdentityFormatLegality).values([
                {cardIdentityId: "11111111-1111-4111-8111-111111111111", format: "commander", legality: "legal"},
                {cardIdentityId: "55555555-5555-4555-8555-555555555555", format: "commander", legality: "legal"},
            ]).run();
            db.insert(cardPrinting).values({
                id: "22222222-2222-4222-8222-222222222222",
                cardIdentityId: "11111111-1111-4111-8111-111111111111",
                layout: "standard",
                printedName: null,
                setCode: "CMM",
                collectorNumber: "400",
                language: "en",
                tcgplayerId: null,
                cardmarketId: null,
                sourcePageUri: "https://scryfall.com/card/cmm/400/sol-ring",
            }).run();
            db.insert(collectionLocation).values({
                id: "33333333-3333-4333-8333-333333333333",
                name: "Artifact Precon",
                type: "deck"
            }).run();
            db.insert(collectionCard).values({
                id: "44444444-4444-4444-8444-444444444444",
                quantity: 1,
                collectionLocationId: "33333333-3333-4333-8333-333333333333",
                finish: "nonfoil",
                manaBoxId: "mb-1",
                cardPrintingId: "22222222-2222-4222-8222-222222222222",
                misprint: false,
                altered: false,
                condition: "near_mint",
                purchasePriceCurrency: null,
                purchasePrice: null,
                addedAt: null,
                sourceRowNumber: 2,
            }).run();

            const repository = createSqliteCardQueryRepository(db);
            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: "=", args: [{property: "legality.commander"}, "legal"]},
                        {op: "=", args: [{property: "collection.locationType"}, "deck"]},
                        {op: ">", args: [{property: "collection.quantity"}, 0]},
                    ],
                },
                include: {legalities: ["commander"], collectionCards: true},
                limit: 25,
            });

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value.items).toEqual([
                expect.objectContaining({
                    id: "11111111-1111-4111-8111-111111111111",
                    name: "Sol Ring",
                    legalities: {commander: "legal"},
                    collectionCards: [
                        expect.objectContaining({
                            locationName: "Artifact Precon",
                            locationType: "deck",
                            quantity: 1,
                            altered: false,
                            misprint: false,
                            setCode: "CMM",
                            collectorNumber: "400",
                        }),
                    ],
                }),
            ]);
            expect(result.value.items[0]?.collectionCards?.[0]).not.toHaveProperty("sourceRowNumber");
        } finally {
            closeDatabase(db);
        }
    });
});

function identity(id: string, name: string) {
    return {
        id,
        name,
        layout: "normal" as const,
        manaCost: null,
        manaValue: 1,
        typeLine: "Artifact",
        oracleText: null,
        colorIdentity: "" as const,
        colors: null,
        colorIndicator: null,
        producedMana: null,
        keywordsJson: [],
        power: null,
        toughness: null,
        loyalty: null,
        defense: null,
        edhrecRank: null,
        gameChanger: false,
        sourcePageUri: "https://scryfall.com/card/example",
    };
}
