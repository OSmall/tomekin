import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
    applySqliteMigrations,
    cardIdentity,
    cardIdentityFormatLegality,
    cardIdentityTag,
    cardIdentityTagging,
    cardIdentityTagHierarchy,
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

    test("keeps outer Collection row scope for reference-only nested branches", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-scope-")), "test.sqlite");
        applySqliteMigrations(dbPath);
        const db = openDatabase(dbPath);
        try {
            insertIdentityWithCollection(db, {
                identityId: "11111111-1111-4111-8111-111111111111",
                name: "Blood Artist",
                locationType: "binder",
                locationName: "Main Binder",
                quantity: 2,
                printingId: "22222222-2222-4222-8222-222222222222",
                collectionCardId: "33333333-3333-4333-8333-333333333333",
                locationId: "44444444-4444-4444-8444-444444444444",
            });

            const repository = createSqliteCardQueryRepository(db);
            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: ">", args: [{property: "collection.quantity"}, 0]},
                        {op: "or", args: [{op: "contains", args: [{property: "identity.name"}, "Blood"]}]},
                    ],
                },
                include: {collectionCards: true},
                sortby: [{property: "collection.quantity", direction: "desc"}],
            });

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value.items).toHaveLength(1);
            expect(result.value.items[0]?.collectionCards).toEqual([
                expect.objectContaining({locationName: "Main Binder", quantity: 2}),
            ]);
        } finally {
            closeDatabase(db);
        }
    });

    test("sorts nullable reference values null-last in both directions", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-sort-")), "test.sqlite");
        applySqliteMigrations(dbPath);
        const db = openDatabase(dbPath);
        try {
            db.insert(cardIdentity).values([
                {...identity("11111111-1111-4111-8111-111111111111", "Ranked Low"), edhrecRank: 10},
                {...identity("22222222-2222-4222-8222-222222222222", "Unranked"), edhrecRank: null},
                {...identity("33333333-3333-4333-8333-333333333333", "Ranked High"), edhrecRank: 100},
            ]).run();

            const repository = createSqliteCardQueryRepository(db);
            const result = await repository.queryCards({
                sortby: [{
                    property: "identity.edhrecRank",
                    direction: "desc"
                }]
            });

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value.items.map((item) => item.name)).toEqual(["Ranked High", "Ranked Low", "Unranked"]);
        } finally {
            closeDatabase(db);
        }
    });

    test("projects inherited tags from broader ancestors deterministically", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-tags-")), "test.sqlite");
        applySqliteMigrations(dbPath);
        const db = openDatabase(dbPath);
        try {
            db.insert(cardIdentity).values(identity("11111111-1111-4111-8111-111111111111", "Reassembling Skeleton")).run();
            db.insert(cardIdentityTag).values([
                tag("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "aristocrats", "Aristocrats"),
                tag("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "sacrifice", "Sacrifice"),
                tag("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "death-triggers", "Death Triggers"),
            ]).run();
            db.insert(cardIdentityTagHierarchy).values([
                {
                    parentTagId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    childTagId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
                },
                {
                    parentTagId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    childTagId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
                },
            ]).run();
            db.insert(cardIdentityTagging).values([
                {
                    cardIdentityId: "11111111-1111-4111-8111-111111111111",
                    tagId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    weight: "weak",
                    annotation: "direct sacrifice"
                },
                {
                    cardIdentityId: "11111111-1111-4111-8111-111111111111",
                    tagId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    weight: "strong",
                    annotation: "direct death trigger"
                },
            ]).run();

            const repository = createSqliteCardQueryRepository(db);
            const result = await repository.queryCards({include: {tags: true}});

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value.items[0]?.tags?.direct.map((tag) => tag.slug)).toEqual(["death-triggers", "sacrifice"]);
            expect(result.value.items[0]?.tags?.inherits).toEqual([
                expect.objectContaining({slug: "aristocrats", weight: "strong", annotation: null}),
            ]);
        } finally {
            closeDatabase(db);
        }
    });
});

function tag(id: string, slug: string, label: string) {
    return {id, slug, label, description: null, sourcePageUri: `https://tagger.scryfall.com/tags/${slug}`};
}

function insertIdentityWithCollection(db: ReturnType<typeof openDatabase>, options: {
    identityId: string;
    name: string;
    printingId: string;
    locationId: string;
    collectionCardId: string;
    locationName: string;
    locationType: "binder" | "deck";
    quantity: number;
}) {
    db.insert(cardIdentity).values(identity(options.identityId, options.name)).run();
    db.insert(cardPrinting).values({
        id: options.printingId,
        cardIdentityId: options.identityId,
        layout: "standard",
        printedName: null,
        setCode: "CMM",
        collectorNumber: "400",
        language: "en",
        tcgplayerId: null,
        cardmarketId: null,
        sourcePageUri: "https://scryfall.com/card/cmm/400/example",
    }).run();
    db.insert(collectionLocation).values({
        id: options.locationId,
        name: options.locationName,
        type: options.locationType,
    }).run();
    db.insert(collectionCard).values({
        id: options.collectionCardId,
        quantity: options.quantity,
        collectionLocationId: options.locationId,
        finish: "nonfoil",
        manaBoxId: null,
        cardPrintingId: options.printingId,
        misprint: false,
        altered: false,
        condition: "near_mint",
        purchasePriceCurrency: null,
        purchasePrice: null,
        addedAt: null,
        sourceRowNumber: 2,
    }).run();
}

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
