import {describe, expect, setSystemTime, test} from "bun:test";
import {err, ok} from "neverthrow";
import {
    type AgentToolRepositories,
    type CardIdentity,
    createAgentToolHandlers,
    requiredScryfallImportContractRevisions,
} from "@tomekin/core";

const forestId = "11111111-1111-4111-8111-111111111111";
const commanderId = "33333333-3333-4333-8333-333333333333";
const sourceUpdatedAt = new Date("2026-08-01T00:00:00.000Z");

describe("agent tool handlers", () => {
    test("validates a legal 60-card Constructed candidate with source provenance", async () => {
        setSystemTime(new Date("2026-08-06T00:00:00.000Z"));
        try {
            const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

            const result = await handlers.validateFormatLegality({
                brief: modernBrief(),
                cards: [{cardIdentityId: forestId, quantity: 60, section: "mainboard"}],
            });

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value).toEqual({
                status: "legal",
                reasons: [],
                warnings: [],
                scryfallSourceUpdatedAt: sourceUpdatedAt,
            });
        } finally {
            setSystemTime();
        }
    });

    test("warns through the public handler when Scryfall reference data is stale", async () => {
        setSystemTime(new Date("2026-08-16T00:00:00.000Z"));
        try {
            const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

            const result = await handlers.validateFormatLegality({
                brief: modernBrief(),
                cards: [{cardIdentityId: forestId, quantity: 60, section: "mainboard"}],
            });

            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value).toEqual({
                status: "legal",
                reasons: [],
                warnings: ["Scryfall reference data is 15 days old; refresh if current external facts matter."],
                scryfallSourceUpdatedAt: sourceUpdatedAt,
            });
        } finally {
            setSystemTime();
        }
    });

    test("returns an illegal assessment for a recognized section that Modern does not permit", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

        const result = await handlers.validateFormatLegality({
            brief: modernBrief(),
            cards: [
                {cardIdentityId: forestId, quantity: 60, section: "mainboard"},
                {cardIdentityId: forestId, quantity: 1, section: "commander"},
            ],
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.status).toBe("illegal");
        expect(result.value.reasons).toContain("Forest is in the Commander section, which is not permitted in Modern.");
    });

    test("returns a validation error for a section outside the shared vocabulary", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

        const result = await handlers.validateFormatLegality({
            brief: modernBrief(),
            cards: [{cardIdentityId: forestId, quantity: 60, section: "deck"}],
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("expected invalid tool input");
        expect(result.error.type).toBe("validation_error");
    });

    test("accepts an optional 60-card Constructed Sideboard through the public handler", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

        const result = await handlers.validateFormatLegality({
            brief: modernBrief(),
            cards: [
                {cardIdentityId: forestId, quantity: 60, section: "mainboard"},
                {cardIdentityId: forestId, quantity: 15, section: "sideboard"},
            ],
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.status).toBe("legal");
    });

    test("evaluates 60-card power and play experience without Commander-only signals", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

        const result = await handlers.evaluateDeckCandidate({
            brief: modernBrief(),
            cards: [{cardIdentityId: forestId, quantity: 60, section: "mainboard"}],
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.powerAndExperience).toEqual({
            powerLevel: "Competitive at the local store.",
            playExperience: "Synergistic, varied, expressive, and fair-feeling.",
        });
        expect(result.value.powerAndExperience).not.toHaveProperty("gameChangers");
    });

    test("counts lands from the 60-card Mainboard without inflating the result from the Sideboard", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest()]));

        const result = await handlers.evaluateDeckCandidate({
            brief: modernBrief(),
            cards: [
                {cardIdentityId: forestId, quantity: 60, section: "mainboard"},
                {cardIdentityId: forestId, quantity: 15, section: "sideboard"},
            ],
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.manaAndCurve.landCount).toBe(60);
    });

    test("preserves Commander power and Game Changer context", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([basicForest(), commander()]));

        const result = await handlers.evaluateDeckCandidate({
            brief: {
                goal: "Build a Commander deck.",
                format: "commander",
                commanderBracket: "Core",
                ruleZeroExceptions: [],
            },
            cards: [
                {cardIdentityId: commanderId, quantity: 1, section: "commander"},
                {cardIdentityId: forestId, quantity: 99, section: "mainboard"},
            ],
        });

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value.powerAndExperience).toMatchObject({
            commanderBracket: "Core",
            gameChangerCount: 1,
            gameChangers: ["Example Commander"],
        });
    });

    test("searches Card Sets through the public handler", async () => {
        const handlers = createAgentToolHandlers(repositoriesWithCards([]));

        const result = await handlers.searchCardSets({query: "WHO", limit: 10});

        expect(result.isOk()).toBe(true);
        if (result.isErr()) throw new Error(result.error.message);
        expect(result.value).toEqual([expect.objectContaining({code: "who", name: "Doctor Who"})]);
    });
});

function modernBrief() {
    return {
        goal: "Build an interactive Modern deck.",
        format: "modern" as const,
        powerLevel: "Competitive at the local store.",
    };
}

function basicForest(): CardIdentity {
    return {
        id: forestId,
        name: "Forest",
        layout: "normal",
        manaCost: null,
        manaValue: 0,
        typeLine: "Basic Land — Forest",
        oracleText: "{T}: Add {G}.",
        copyLimitOverride: {kind: "none"},
        colorIdentity: "G",
        colors: null,
        colorIndicator: null,
        producedMana: "G",
        keywords: [],
        power: null,
        toughness: null,
        loyalty: null,
        defense: null,
        edhrecRank: null,
        gameChanger: false,
        sourcePageUri: "https://scryfall.com/card/test/1/forest",
    };
}

function commander(): CardIdentity {
    return {
        ...basicForest(),
        id: commanderId,
        name: "Example Commander",
        manaCost: "{2}{G}",
        manaValue: 3,
        typeLine: "Legendary Creature — Elf",
        oracleText: null,
        colors: "G",
        power: "3",
        toughness: "3",
        gameChanger: true,
        sourcePageUri: "https://scryfall.com/card/test/2/example-commander",
    };
}

function repositoriesWithCards(cards: readonly CardIdentity[]): AgentToolRepositories {
    const details = cards.map((identity) => ({
        identity,
        parts: [],
        legalities: [
            {cardIdentityId: identity.id, format: "commander", legality: "legal" as const},
            {cardIdentityId: identity.id, format: "modern", legality: "legal" as const},
        ],
        tags: [],
    }));
    return {
        cardReference: {
            searchCardIdentities: async () => ok(cards),
            getCardIdentity: async (idOrName) => {
                const detail = details.find((candidate) => candidate.identity.id === idOrName || candidate.identity.name === idOrName);
                return detail ? ok(detail) : err({type: "not_found" as const, message: `Unknown card: ${idOrName}`});
            },
            searchCardIdentityTags: async () => ok([]),
            searchCardSets: async ({query}) => ok(query?.toLowerCase() === "who" ? [{
                id: "44444444-4444-4444-8444-444444444444",
                code: "who",
                name: "Doctor Who",
                setType: "expansion",
                apiUri: "https://api.scryfall.com/sets/44444444-4444-4444-8444-444444444444",
                cardSearchUri: "https://api.scryfall.com/cards/search?q=e%3Awho",
                sourcePageUri: "https://scryfall.com/sets/who",
            }] : []),
            summarizeReferenceSupport: async () => ok({
                required: ["oracle_cards", "all_cards", "oracle_tags"],
                imports: [{
                    id: "22222222-2222-4222-8222-222222222222",
                    bulkDataType: "oracle_cards",
                    importContractRevision: requiredScryfallImportContractRevisions.oracle_cards,
                    status: "succeeded",
                    startedAt: new Date("2026-08-01T00:00:00.000Z"),
                    completedAt: new Date("2026-08-01T00:01:00.000Z"),
                    sourceUpdatedAt,
                    sourceUri: "file:///oracle-cards.json",
                    importedRecordCount: cards.length,
                    warnings: [],
                    blockingErrors: [],
                }],
                missing: [],
                reimportRequired: [],
                warnings: [],
                ready: true,
            }),
            listCardIdentitiesByIds: async (ids) => ok(details.filter((detail) => ids.includes(detail.identity.id))),
        },
        cardQuery: {queryCards: async () => ok({limit: 50, items: []})},
        collection: {
            listCollectionLocations: async () => ok([]),
            listCollectionImports: async () => ok([]),
        },
        deckCandidates: {
            createDeckCandidate: async () => err({type: "repository_error", message: "Not used by this test."}),
            editDeckCandidate: async () => err({type: "repository_error", message: "Not used by this test."}),
            getDeckCandidate: async () => err({type: "not_found", message: "Not used by this test."}),
            listDeckCandidates: async () => ok([]),
        },
    };
}
