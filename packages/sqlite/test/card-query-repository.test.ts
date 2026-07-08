import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {type CardQueryError, type CardQueryResult, createTestRootLoggerFromEnv} from "@mtg-agent/core";
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
import type {Result} from "neverthrow";

const testLog = createTestRootLoggerFromEnv();

describe("SQLite Card Query repository", () => {
    test("queries Card Identities with Collection predicates and included owned rows", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-")), "test.sqlite");
        applySqliteMigrations(dbPath, {log: testLog});
        const db = openDatabase(dbPath, {log: testLog});
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
                    totalQuantity: 1,
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
        applySqliteMigrations(dbPath, {log: testLog});
        const db = openDatabase(dbPath, {log: testLog});
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
        applySqliteMigrations(dbPath, {log: testLog});
        const db = openDatabase(dbPath, {log: testLog});
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
        applySqliteMigrations(dbPath, {log: testLog});
        const db = openDatabase(dbPath, {log: testLog});
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

    test("matches independent draw and ramp tag predicates on separate taggings", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentities(db, [
                identity("10000000-0000-4000-8000-000000000001", "Growth Spiral"),
                identity("10000000-0000-4000-8000-000000000002", "Divination"),
            ]);
            insertTags(db, [
                tag(DRAW_TAG_ID, "draw", "Draw"),
                tag(RAMP_TAG_ID, "ramp", "Ramp"),
            ]);
            db.insert(cardIdentityTagging).values([
                tagging("10000000-0000-4000-8000-000000000001", DRAW_TAG_ID, "median"),
                tagging("10000000-0000-4000-8000-000000000001", RAMP_TAG_ID, "median"),
                tagging("10000000-0000-4000-8000-000000000002", DRAW_TAG_ID, "strong"),
            ]).run();

            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, DRAW_TAG_ID]},
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, RAMP_TAG_ID]},
                    ],
                },
            });

            expectOkNames(result, ["Growth Spiral"]);
        });
    });

    test("requires tag metadata inside withTagging to match the same tagging row", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentities(db, [
                identity("10000000-0000-4000-8000-000000000011", "Weak Draw Strong Ramp"),
                identity("10000000-0000-4000-8000-000000000012", "Strong Draw"),
            ]);
            insertTags(db, [
                tag(DRAW_TAG_ID, "draw", "Draw"),
                tag(RAMP_TAG_ID, "ramp", "Ramp"),
            ]);
            db.insert(cardIdentityTagging).values([
                tagging("10000000-0000-4000-8000-000000000011", DRAW_TAG_ID, "weak"),
                tagging("10000000-0000-4000-8000-000000000011", RAMP_TAG_ID, "strong"),
                tagging("10000000-0000-4000-8000-000000000012", DRAW_TAG_ID, "strong"),
            ]).run();

            const result = await repository.queryCards({
                filter: {
                    op: "withTagging",
                    args: [{
                        op: "and",
                        args: [
                            {op: "hasTagInHierarchy", args: [{property: "tag.id"}, DRAW_TAG_ID]},
                            {op: "=", args: [{property: "tag.weight"}, "strong"]},
                        ],
                    }],
                },
            });

            expectOkNames(result, ["Strong Draw"]);
        });
    });

    test("matches descendant taggings through hasTagInHierarchy", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentities(db, [identity("10000000-0000-4000-8000-000000000021", "Fact or Fiction")]);
            insertTags(db, [
                tag(CARD_ADVANTAGE_TAG_ID, "card-advantage", "Card Advantage"),
                tag(DRAW_TAG_ID, "draw", "Draw"),
                tag(CARD_SELECTION_TAG_ID, "card-selection", "Card Selection"),
            ]);
            db.insert(cardIdentityTagHierarchy).values([
                {parentTagId: CARD_ADVANTAGE_TAG_ID, childTagId: DRAW_TAG_ID},
                {parentTagId: DRAW_TAG_ID, childTagId: CARD_SELECTION_TAG_ID},
            ]).run();
            db.insert(cardIdentityTagging).values(tagging("10000000-0000-4000-8000-000000000021", CARD_SELECTION_TAG_ID, "strong")).run();

            const result = await repository.queryCards({
                filter: {op: "hasTagInHierarchy", args: [{property: "tag.id"}, CARD_ADVANTAGE_TAG_ID]},
            });

            expectOkNames(result, ["Fact or Fiction"]);
        });
    });

    test("does not inflate collection quantity when tag predicates match multiple tag rows", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000031",
                name: "Tagged One Copy",
                rows: [{locationName: "Main Binder", locationType: "binder", quantity: 1}],
            });
            insertTags(db, [
                tag(DRAW_TAG_ID, "draw", "Draw"),
                tag(RAMP_TAG_ID, "ramp", "Ramp"),
            ]);
            db.insert(cardIdentityTagging).values([
                tagging("10000000-0000-4000-8000-000000000031", DRAW_TAG_ID, "strong"),
                tagging("10000000-0000-4000-8000-000000000031", RAMP_TAG_ID, "strong"),
            ]).run();

            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, DRAW_TAG_ID]},
                        {op: ">", args: [{property: "collection.quantity"}, 1]},
                    ],
                },
            });

            expectOkNames(result, []);
        });
    });

    test("scopes collection location and finish to the same retained row set", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000041",
                name: "Split Finish Card",
                rows: [
                    {locationName: "Deck Box", locationType: "deck", finish: "nonfoil", quantity: 1},
                    {locationName: "Trade Binder", locationType: "binder", finish: "foil", quantity: 1},
                ],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000042",
                name: "Deck Foil Card",
                rows: [{locationName: "Deck Box", locationType: "deck", finish: "foil", quantity: 1}],
            });

            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: "=", args: [{property: "collection.locationName"}, "Deck Box"]},
                        {op: "=", args: [{property: "collection.finish"}, "foil"]},
                    ],
                },
                include: {collectionCards: true},
            });

            expectOkNames(result, ["Deck Foil Card"]);
            if (result.isOk()) expect(result.value.items[0]?.collectionCards?.map((row) => row.locationName)).toEqual(["Deck Box"]);
        });
    });

    test("aggregates collection quantity only over rows surviving collection predicates", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000051",
                name: "One Foil Two Nonfoil",
                rows: [
                    {locationName: "Main Binder", locationType: "binder", finish: "foil", quantity: 1},
                    {locationName: "Main Binder", locationType: "binder", finish: "nonfoil", quantity: 2},
                ],
            });

            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {op: "=", args: [{property: "collection.finish"}, "foil"]},
                        {op: ">", args: [{property: "collection.quantity"}, 1]},
                    ],
                },
            });

            expectOkNames(result, []);
        });
    });

    test("projects totalQuantity over the matching collection row scope", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000055",
                name: "Multi Printing Deck Card",
                rows: [
                    {locationName: "Simic Ramp Control", locationType: "deck", quantity: 1},
                    {locationName: "Simic Ramp Control", locationType: "deck", quantity: 2},
                    {locationName: "Main Box", locationType: "binder", quantity: 5},
                ],
            });

            const result = await repository.queryCards({
                filter: {op: "=", args: [{property: "collection.locationName"}, "Simic Ramp Control"]},
                include: {collectionCards: true},
            });

            expectOkNames(result, ["Multi Printing Deck Card"]);
            if (result.isOk()) {
                expect(result.value.items[0]?.totalQuantity).toBe(3);
                expect(result.value.items[0]?.collectionCards?.map((row) => row.quantity)).toEqual([1, 2]);
            }
        });
    });

    test("keeps collection quantity branch-local under or", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000061",
                name: "One In Each Box",
                rows: [
                    {locationName: "Simic Ramp Control", locationType: "deck", quantity: 1},
                    {locationName: "Main Box", locationType: "binder", quantity: 1},
                ],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000062",
                name: "Two In Main Box",
                rows: [{locationName: "Main Box", locationType: "binder", quantity: 2}],
            });

            const result = await repository.queryCards({
                filter: {
                    op: "or",
                    args: [
                        {
                            op: "and",
                            args: [
                                {op: "=", args: [{property: "collection.locationName"}, "Simic Ramp Control"]},
                                {op: ">=", args: [{property: "collection.quantity"}, 2]},
                            ],
                        },
                        {
                            op: "and",
                            args: [
                                {op: "=", args: [{property: "collection.locationName"}, "Main Box"]},
                                {op: ">=", args: [{property: "collection.quantity"}, 2]},
                            ],
                        },
                    ],
                },
            });

            expectOkNames(result, ["Two In Main Box"]);
        });
    });

    test("combines unioned collection scope when quantity is outside an or", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000071",
                name: "One In Each Box",
                rows: [
                    {locationName: "Simic Ramp Control", locationType: "deck", quantity: 1},
                    {locationName: "Main Box", locationType: "binder", quantity: 1},
                ],
            });

            const result = await repository.queryCards({
                filter: {
                    op: "and",
                    args: [
                        {
                            op: "or",
                            args: [
                                {op: "=", args: [{property: "collection.locationName"}, "Simic Ramp Control"]},
                                {op: "=", args: [{property: "collection.locationName"}, "Main Box"]},
                            ],
                        },
                        {op: ">=", args: [{property: "collection.quantity"}, 2]},
                    ],
                },
                include: {collectionCards: true},
            });

            expectOkNames(result, ["One In Each Box"]);
            if (result.isOk()) expect(result.value.items[0]?.collectionCards?.map((row) => row.locationName).sort()).toEqual(["Main Box", "Simic Ramp Control"]);
        });
    });

    test("returns no collection evidence for mixed or identities that match only through tags", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000081",
                name: "Tagged Elsewhere",
                rows: [{locationName: "Trade Binder", locationType: "binder", quantity: 3}],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000082",
                name: "Deck Match",
                rows: [{locationName: "Simic Ramp Control", locationType: "deck", quantity: 1}],
            });
            insertTags(db, [tag(DRAW_TAG_ID, "draw", "Draw")]);
            db.insert(cardIdentityTagging).values(tagging("10000000-0000-4000-8000-000000000081", DRAW_TAG_ID, "strong")).run();

            const result = await repository.queryCards({
                filter: {
                    op: "or",
                    args: [
                        {op: "=", args: [{property: "collection.locationName"}, "Simic Ramp Control"]},
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, DRAW_TAG_ID]},
                    ],
                },
                include: {collectionCards: true},
                sortby: [{property: "identity.name", direction: "asc"}],
            });

            expectOkNames(result, ["Deck Match", "Tagged Elsewhere"]);
            if (result.isOk()) {
                expect(result.value.items.map((item) => item.collectionCards?.map((row) => row.locationName))).toEqual([
                    ["Simic Ramp Control"],
                    [],
                ]);
                expect(result.value.items.map((item) => item.totalQuantity)).toEqual([1, 0]);
            }
        });
    });

    test("sorts mixed or tag-only matches as zero collection quantity", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000091",
                name: "Tagged Elsewhere",
                rows: [{locationName: "Trade Binder", locationType: "binder", quantity: 9}],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000092",
                name: "Deck Match",
                rows: [{locationName: "Simic Ramp Control", locationType: "deck", quantity: 1}],
            });
            insertTags(db, [tag(DRAW_TAG_ID, "draw", "Draw")]);
            db.insert(cardIdentityTagging).values(tagging("10000000-0000-4000-8000-000000000091", DRAW_TAG_ID, "strong")).run();

            const result = await repository.queryCards({
                filter: {
                    op: "or",
                    args: [
                        {op: "=", args: [{property: "collection.locationName"}, "Simic Ramp Control"]},
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, DRAW_TAG_ID]},
                    ],
                },
                sortby: [{property: "collection.quantity", direction: "desc"}],
            });

            expectOkNames(result, ["Deck Match", "Tagged Elsewhere"]);
        });
    });

    test("sorts by total owned quantity when no collection predicate exists", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000101",
                name: "Three Copies",
                rows: [{locationName: "Main Binder", locationType: "binder", quantity: 3}],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000102",
                name: "One Copy",
                rows: [{locationName: "Main Binder", locationType: "binder", quantity: 1}],
            });
            insertIdentities(db, [identity("10000000-0000-4000-8000-000000000103", "No Copies")]);

            const result = await repository.queryCards({
                filter: {op: "contains", args: [{property: "identity.typeLine"}, "Artifact"]},
                sortby: [{property: "collection.quantity", direction: "desc"}],
            });

            expectOkNames(result, ["Three Copies", "One Copy", "No Copies"]);
            if (result.isOk()) expect(result.value.items.map((item) => item.totalQuantity)).toEqual([3, 1, 0]);
        });
    });

    test("hydrates only requested includes while preserving primary result order", async () => {
        await withTempCardQueryRepository(async ({db, repository}) => {
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000111",
                name: "Later Alphabetically",
                rows: [{locationName: "Main Binder", locationType: "binder", quantity: 1}],
            });
            insertIdentityWithCollectionRows(db, {
                identityId: "10000000-0000-4000-8000-000000000112",
                name: "Earlier Alphabetically",
                rows: [{locationName: "Main Binder", locationType: "binder", quantity: 2}],
            });
            db.insert(cardIdentityFormatLegality).values([
                {cardIdentityId: "10000000-0000-4000-8000-000000000111", format: "commander", legality: "legal"},
                {cardIdentityId: "10000000-0000-4000-8000-000000000112", format: "commander", legality: "banned"},
            ]).run();
            insertTags(db, [tag(DRAW_TAG_ID, "draw", "Draw")]);
            db.insert(cardIdentityTagging).values([
                tagging("10000000-0000-4000-8000-000000000111", DRAW_TAG_ID, "weak"),
                tagging("10000000-0000-4000-8000-000000000112", DRAW_TAG_ID, "strong"),
            ]).run();

            const legalitiesOnly = await repository.queryCards({
                sortby: [{property: "identity.name", direction: "asc"}],
                include: {legalities: ["commander"]},
            });
            const allRequested = await repository.queryCards({
                sortby: [{property: "identity.name", direction: "asc"}],
                include: {legalities: ["commander"], tags: true, collectionCards: true},
            });

            expectOkNames(legalitiesOnly, ["Earlier Alphabetically", "Later Alphabetically"]);
            if (legalitiesOnly.isOk()) {
                expect(legalitiesOnly.value.items.map((item) => item.legalities?.commander)).toEqual(["banned", "legal"]);
                expect(legalitiesOnly.value.items[0]).not.toHaveProperty("tags");
                expect(legalitiesOnly.value.items[0]).not.toHaveProperty("collectionCards");
            }
            expectOkNames(allRequested, ["Earlier Alphabetically", "Later Alphabetically"]);
            if (allRequested.isOk()) {
                expect(allRequested.value.items.map((item) => item.tags?.direct[0]?.weight)).toEqual(["strong", "weak"]);
                expect(allRequested.value.items.map((item) => item.collectionCards?.[0]?.quantity)).toEqual([2, 1]);
            }
        });
    });
});

const DRAW_TAG_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RAMP_TAG_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_ADVANTAGE_TAG_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CARD_SELECTION_TAG_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

async function withTempCardQueryRepository(run: (context: {
    db: ReturnType<typeof openDatabase>;
    repository: ReturnType<typeof createSqliteCardQueryRepository>;
}) => Promise<void>) {
    const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-card-query-contract-")), "test.sqlite");
    applySqliteMigrations(dbPath, {log: testLog});
    const db = openDatabase(dbPath, {log: testLog});
    try {
        await run({db, repository: createSqliteCardQueryRepository(db)});
    } finally {
        closeDatabase(db);
    }
}

function expectOkNames(result: Result<CardQueryResult, CardQueryError>, names: readonly string[]) {
    expect(result.isOk()).toBe(true);
    if (result.isErr()) throw new Error(result.error.message);
    expect(result.value.items.map((item) => item.name)).toEqual(names);
}

function tag(id: string, slug: string, label: string) {
    return {id, slug, label, description: null, sourcePageUri: `https://tagger.scryfall.com/tags/${slug}`};
}

function insertTags(db: ReturnType<typeof openDatabase>, tags: readonly ReturnType<typeof tag>[]) {
    db.insert(cardIdentityTag).values(tags).run();
}

function tagging(cardIdentityId: string, tagId: string, weight: "very_strong" | "strong" | "median" | "weak") {
    return {cardIdentityId, tagId, weight, annotation: null};
}

function insertIdentities(db: ReturnType<typeof openDatabase>, identities: readonly ReturnType<typeof identity>[]) {
    db.insert(cardIdentity).values(identities).run();
}

function insertIdentityWithCollectionRows(db: ReturnType<typeof openDatabase>, options: {
    identityId: string;
    name: string;
    rows: readonly {
        locationName: string;
        locationType: "binder" | "deck";
        quantity: number;
        finish?: "nonfoil" | "foil" | "etched";
    }[];
}) {
    db.insert(cardIdentity).values(identity(options.identityId, options.name)).run();
    options.rows.forEach((row, index) => {
        const printingId = `${options.identityId}-printing-${index + 1}`;
        const existingLocation = db.select().from(collectionLocation).all().find((location) => location.name === row.locationName && location.type === row.locationType);
        const locationId = existingLocation?.id ?? `${options.identityId}-location-${index + 1}`;
        db.insert(cardPrinting).values({
            id: printingId,
            cardIdentityId: options.identityId,
            layout: "standard",
            printedName: null,
            setCode: "CMM",
            collectorNumber: String(400 + index),
            language: "en",
            tcgplayerId: null,
            cardmarketId: null,
            sourcePageUri: `https://scryfall.com/card/cmm/${400 + index}/example`,
        }).run();
        if (!existingLocation) db.insert(collectionLocation).values({
            id: locationId,
            name: row.locationName,
            type: row.locationType,
        }).run();
        db.insert(collectionCard).values({
            id: `${options.identityId}-collection-${index + 1}`,
            quantity: row.quantity,
            collectionLocationId: locationId,
            finish: row.finish ?? "nonfoil",
            manaBoxId: null,
            cardPrintingId: printingId,
            misprint: false,
            altered: false,
            condition: "near_mint",
            purchasePriceCurrency: null,
            purchasePrice: null,
            addedAt: null,
            sourceRowNumber: index + 2,
        }).run();
    });
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
