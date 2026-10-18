import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    createAgentToolHandlers,
    createTestRootLoggerFromEnv,
} from "@tomekin/core";
import {
    applySqliteMigrations,
    openDatabase,
    closeDatabase,
    createSqliteDeckCandidateRepository,
    createSqliteCardReferenceRepository,
    createSqliteCardQueryRepository,
    createSqliteCollectionRepository,
} from "@tomekin/sqlite";
const log = createTestRootLoggerFromEnv();
const brief = {
    format: "casual_60",
    goal: "Develop a provisional deck",
    powerLevel: null,
};
function setup(newId?: () => string) {
    const root = mkdtempSync(join(tmpdir(), "tomekin-structured-"));
    const path = join(root, "test.sqlite");
    applySqliteMigrations(path, { log });
    const db = openDatabase(path, { log });
    const clock = { now: () => new Date("2026-10-17T00:00:00.000Z") };
    const handlers = createAgentToolHandlers({
        deckCandidates: createSqliteDeckCandidateRepository(db, clock, newId),
        cardReference: createSqliteCardReferenceRepository(db),
        cardQuery: createSqliteCardQueryRepository(db),
        collection: createSqliteCollectionRepository(db, clock),
    });
    return {
        db,
        path,
        handlers,
        dispose() {
            closeDatabase(db);
            rmSync(root, { recursive: true, force: true });
        },
    };
}
function unwrap(result: any): any {
    if (result.isErr()) throw new Error(JSON.stringify(result.error));
    return result.value;
}
test("durable provisional candidates need no selected cards, Markdown or automatic deck check", async () => {
    const app = setup();
    try {
        const saved = unwrap(
            await app.handlers.createDeckCandidate({
                label: "Work in progress",
                brief,
            }),
        );
        expect(saved.candidate_id).toMatch(/^[a-f0-9-]{36}$/);
        expect(saved.validation_evidence.status).toBe("absent");
        const read = unwrap(
            await app.handlers.getDeckCandidate({ id: saved.candidate_id }),
        );
        expect(read.label).toBe("Work in progress");
        expect(read.pool_size).toBe(0);
        expect(read.selected_quantities).toEqual({
            commander: 0,
            mainboard: 0,
            sideboard: 0,
        });
        expect(read).not.toHaveProperty("brief");
        const list = unwrap(await app.handlers.listDeckCandidates());
        expect(list[0].candidate_id).toBe(saved.candidate_id);
    } finally {
        app.dispose();
    }
});
const forest = "11111111-1111-4111-8111-111111111111",
    draw = "22222222-2222-4222-8222-222222222222";
function card(id: string, name: string) {
    return {
        id,
        name,
        layout: "normal" as const,
        manaCost: null,
        manaValue: 0,
        typeLine: "Basic Land — Forest",
        oracleText: "Add green.",
        copyLimitOverrideKind: "unlimited" as const,
        copyLimitOverrideMaximum: null,
        colorIdentity: "G",
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
async function initial(app: ReturnType<typeof setup>) {
    const { cardIdentity } = await import("@tomekin/sqlite");
    app.db
        .insert(cardIdentity)
        .values([card(forest, "Forest"), card(draw, "Another Forest")])
        .run();
    return unwrap(
        await app.handlers.createDeckCandidate({
            label: "Forest engine",
            brief,
            plan: {
                schema_version: 1,
                description: "Use recurring resources",
                nodes: [
                    {
                        ref: "mana",
                        kind: "role",
                        label: "Mana",
                        description: "Produce mana",
                    },
                    {
                        ref: "win",
                        kind: "win_route",
                        label: "Win",
                        description: "Spend resources to win",
                        priority: "primary",
                        rationale: "The intended finish",
                    },
                ],
                contributions: [
                    {
                        card_identity_id: forest,
                        role_ref: "mana",
                        rationale: "Reliable repeatable mana",
                        qualifications: ["One activation each turn"],
                        evidence: [
                            { reference: "Card facts", note: "A mana ability" },
                        ],
                    },
                ],
                relationships: [
                    {
                        ref: "enable",
                        kind: "enables",
                        source_ref: "mana",
                        target_ref: "win",
                        rationale: "Supplies resources",
                    },
                ],
            },
            options: [
                {
                    card_identity_id: forest,
                    comparison_note: "Repeatable source",
                },
            ],
            memberships: [
                {
                    card_identity_id: forest,
                    section: "mainboard",
                    quantity: 30,
                    note: "Keep these selected",
                },
                { card_identity_id: forest, section: "sideboard", quantity: 1 },
            ],
            assessments: { mana_curve_adequacy: "Still under construction" },
        }),
    );
}
async function state(app: ReturnType<typeof setup>, id: string) {
    return unwrap(await app.handlers.getDeckCandidate({ id, view: "state" }));
}
test("linked local refs persist stable identities, repeated copies and section-aware coverage after reopening", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        expect(Object.keys(created.created_ids)).toEqual([
            "mana",
            "win",
            "enable",
        ]);
        const read = await state(app, created.candidate_id);
        expect(read.options).toHaveLength(1);
        expect(read.memberships.map((m: any) => m.quantity)).toEqual([30, 1]);
        expect(read.plan.nodes.find((n: any) => n.kind === "role").id).toBe(
            created.created_ids.mana,
        );
        const changed = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    nodes: [
                        {
                            action: "update",
                            id: created.created_ids.mana,
                            changes: {
                                label: "Repeatable mana",
                                coverage_goal: {
                                    sections: ["mainboard"],
                                    minimum_copies: 30,
                                    criteria: "Available in the main deck",
                                    rationale: "Supports development",
                                },
                            },
                        },
                    ],
                },
            }),
        );
        const reopened = openDatabase(app.path, { log });
        try {
            const repository = createSqliteDeckCandidateRepository(reopened, {
                now: () => new Date(),
            });
            const after = unwrap(
                await repository.getDeckCandidate(created.candidate_id),
            );
            expect(
                after.plan.nodes.find((n: any) => n.kind === "role").id,
            ).toBe(created.created_ids.mana);
            expect(after.plan.relationships[0].source_id).toBe(
                created.created_ids.mana,
            );
            expect(after.memberships).toEqual(read.memberships);
            expect(after.options).toEqual(read.options);
            expect(after.selectedChangedAt).toBe(read.selectedChangedAt);
            expect(after.briefChangedAt).toBe(read.briefChangedAt);
            expect(changed.updated_at).toBe("2026-10-17T00:00:00.001Z");
        } finally {
            closeDatabase(reopened);
        }
        const summary = unwrap(
            await app.handlers.getDeckCandidate({ id: created.candidate_id }),
        );
        expect(summary.roles[0].selected_copies).toBe(30);
    } finally {
        app.dispose();
    }
});
test("selected cuts retain assessed options and require an explained desired gap", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        const changes = {
            memberships: [
                {
                    action: "remove",
                    card_identity_id: forest,
                    section: "mainboard",
                },
                {
                    action: "remove",
                    card_identity_id: forest,
                    section: "sideboard",
                },
            ],
        };
        const rejected = await app.handlers.editDeckCandidate({
            candidate_id: created.candidate_id,
            expected_updated_at: created.updated_at,
            changes,
        });
        expect(rejected.isErr()).toBe(true);
        expect(await state(app, created.candidate_id)).toEqual(before);
        unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    ...changes,
                    nodes: [
                        {
                            action: "update",
                            id: created.created_ids.mana,
                            changes: {
                                coverage_assessment: {
                                    summary:
                                        "Mana remains desired; replacement not selected",
                                },
                            },
                        },
                    ],
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(after.memberships).toEqual([]);
        expect(after.options).toEqual(before.options);
        expect(after.plan.contributions).toEqual(before.plan.contributions);
    } finally {
        app.dispose();
    }
});
test("candidate-wide optimistic guard rejects same-clock-tick stale edits from another connection", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const other = openDatabase(app.path, { log });
        try {
            const repo = createSqliteDeckCandidateRepository(other, {
                now: () => new Date("2026-10-17T00:00:00.000Z"),
            });
            const first = unwrap(
                await app.handlers.editDeckCandidate({
                    candidate_id: created.candidate_id,
                    expected_updated_at: created.updated_at,
                    changes: { label: "First writer" },
                }),
            );
            const second = await repo.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: { label: "Stale writer" },
            });
            expect(second.isErr()).toBe(true);
            if (second.isErr())
                expect(second.error).toMatchObject({
                    type: "conflict",
                    expected_updated_at: created.updated_at,
                    current_updated_at: first.updated_at,
                });
            const third = unwrap(
                await repo.editDeckCandidate({
                    candidate_id: created.candidate_id,
                    expected_updated_at: first.updated_at,
                    changes: { label: "Reconciled writer" },
                }),
            );
            expect(third.updated_at).toBe("2026-10-17T00:00:00.002Z");
            expect((await state(app, created.candidate_id)).label).toBe(
                "Reconciled writer",
            );
        } finally {
            closeDatabase(other);
        }
    } finally {
        app.dispose();
    }
});
test("coordinated edits preserve omitted values and allow explicit optional clearing", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        const updated = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    brief: { goal: "Refined intent" },
                    options: [
                        {
                            action: "update",
                            card_identity_id: forest,
                            changes: { comparison_note: null },
                        },
                    ],
                    memberships: [
                        {
                            action: "set",
                            card_identity_id: forest,
                            section: "mainboard",
                            quantity: 29,
                        },
                    ],
                    contributions: [
                        {
                            action: "update",
                            card_identity_id: forest,
                            role_id: created.created_ids.mana,
                            changes: { qualifications: null },
                        },
                    ],
                    assessments: { mana_curve_adequacy: null },
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(
            after.memberships.find((m: any) => m.section === "mainboard"),
        ).toMatchObject({ quantity: 29, note: "Keep these selected" });
        expect(
            after.memberships.find((m: any) => m.section === "sideboard"),
        ).toEqual(
            before.memberships.find((m: any) => m.section === "sideboard"),
        );
        expect(after.options[0].comparison_note).toBeNull();
        expect(after.plan.contributions[0].qualifications).toBeUndefined();
        expect(after.plan.contributions[0].evidence).toEqual(
            before.plan.contributions[0].evidence,
        );
        expect(after.brief.goal).toBe("Refined intent");
        expect(after.brief.playExperience).toBe(before.brief.playExperience);
        expect(after.assessments.mana_curve_adequacy).toBeNull();
        expect(updated.updated_at).not.toBe(created.updated_at);
    } finally {
        app.dispose();
    }
});
test("reasoned pool-only maintenance retains selected input timestamps and can add/remove linked records together", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        const updated = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    options: [{ action: "add", card_identity_id: draw }],
                    nodes: [
                        {
                            action: "add",
                            node: {
                                ref: "alternative",
                                kind: "role",
                                label: "Backup mana",
                                description: "Alternative development",
                                coverage_assessment: {
                                    summary:
                                        "Desired backup awaiting selection",
                                },
                            },
                        },
                    ],
                    contributions: [
                        {
                            action: "add",
                            contribution: {
                                card_identity_id: draw,
                                role_ref: "alternative",
                                rationale: "Another independent mana source",
                            },
                        },
                    ],
                    relationships: [
                        {
                            action: "add",
                            relationship: {
                                ref: "support",
                                kind: "supports",
                                source_ref: "alternative",
                                target_id: created.created_ids.mana,
                                rationale: "Supports development",
                            },
                        },
                    ],
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(after.selectedChangedAt).toBe(before.selectedChangedAt);
        expect(after.memberships).toEqual(before.memberships);
        expect(after.planChangedAt).toBe(updated.updated_at);
        unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: updated.updated_at,
                changes: {
                    options: [{ action: "remove", card_identity_id: draw }],
                    contributions: [
                        {
                            action: "remove",
                            card_identity_id: draw,
                            role_id: updated.created_ids.alternative,
                        },
                    ],
                    relationships: [
                        { action: "remove", id: updated.created_ids.support },
                    ],
                    nodes: [
                        {
                            action: "remove",
                            id: updated.created_ids.alternative,
                        },
                    ],
                },
            }),
        );
        const cleaned = await state(app, created.candidate_id);
        expect(cleaned.options).toEqual(before.options);
        expect(cleaned.plan).toEqual(before.plan);
    } finally {
        app.dispose();
    }
});
test("invalid resulting ownership, participation, endpoints and logical duplicates reject the entire edit", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const other = unwrap(
            await app.handlers.createDeckCandidate({
                label: "Other",
                brief,
                plan: {
                    schema_version: 1,
                    description: "Other strategy",
                    nodes: [
                        {
                            ref: "other",
                            kind: "role",
                            label: "Other role",
                            description: "Other",
                            coverage_assessment: { summary: "Unfilled" },
                        },
                    ],
                },
            }),
        );
        const before = await state(app, created.candidate_id);
        const cases: any[] = [
            { options: [{ action: "remove", card_identity_id: forest }] },
            {
                contributions: [
                    {
                        action: "remove",
                        card_identity_id: forest,
                        role_id: created.created_ids.mana,
                    },
                ],
            },
            { nodes: [{ action: "remove", id: created.created_ids.mana }] },
            {
                nodes: [
                    {
                        action: "update",
                        id: other.created_ids.other,
                        changes: { label: "Cross candidate" },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "add",
                        contribution: {
                            card_identity_id: forest,
                            role_id: other.created_ids.other,
                            rationale: "Cross candidate",
                        },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "add",
                        contribution: {
                            card_identity_id: forest,
                            role_id: created.created_ids.mana,
                            rationale: "Duplicate",
                        },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "add",
                        contribution: {
                            card_identity_id: draw,
                            role_ref: "missing",
                            rationale: "Missing",
                        },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "add",
                        relationship: {
                            ref: "self",
                            kind: "supports",
                            source_id: created.created_ids.mana,
                            target_id: created.created_ids.mana,
                            rationale: "Self",
                        },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "add",
                        relationship: {
                            ref: "outgoing",
                            kind: "supports",
                            source_id: created.created_ids.win,
                            target_id: created.created_ids.mana,
                            rationale: "Wrong source",
                        },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "add",
                        relationship: {
                            ref: "competition",
                            kind: "competes_with",
                            source_id: created.created_ids.mana,
                            target_id: created.created_ids.win,
                            rationale: "Wrong endpoint",
                        },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "add",
                        relationship: {
                            ref: "duplicate",
                            kind: "enables",
                            source_id: created.created_ids.mana,
                            target_id: created.created_ids.win,
                            rationale: "Duplicate",
                        },
                    },
                ],
            },
            {
                options: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        changes: { comparison_note: "One" },
                    },
                    { action: "remove", card_identity_id: forest },
                ],
            },
            {
                memberships: [
                    {
                        action: "set",
                        card_identity_id: draw,
                        section: "mainboard",
                        quantity: 1,
                    },
                ],
            },
            { plan: null },
        ];
        for (const changes of cases) {
            const rejected = await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: { label: "Must roll back", ...changes },
            });
            expect(rejected.isErr()).toBe(true);
            expect(await state(app, created.candidate_id)).toEqual(before);
        }
    } finally {
        app.dispose();
    }
});
test("tool schemas reject unknown fields, invalid refs, sections and overlong Unicode fields without writes", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        const cases: any[] = [
            { label: "   " },
            { brief: { goal: " " } },
            { plan: { schema_version: 2, description: "Unsupported" } },
            {
                memberships: [
                    {
                        action: "set",
                        card_identity_id: forest,
                        section: "mainboard",
                        quantity: 0,
                    },
                ],
            },
            {
                memberships: [
                    {
                        action: "set",
                        card_identity_id: forest,
                        section: "companion",
                        quantity: 1,
                    },
                ],
            },
            {
                options: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        changes: { comparison_note: "😀".repeat(501) },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        role_id: created.created_ids.mana,
                        role_ref: "both",
                        changes: { rationale: "Bad" },
                    },
                ],
            },
            {
                nodes: [
                    {
                        action: "add",
                        node: {
                            ref: "same",
                            kind: "role",
                            label: "A",
                            description: "A",
                        },
                    },
                    {
                        action: "add",
                        node: {
                            ref: "same",
                            kind: "role",
                            label: "B",
                            description: "B",
                        },
                    },
                ],
            },
            { unexpected: "field" },
        ];
        for (const changes of cases) {
            const result = await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes,
            });
            expect(result.isErr()).toBe(true);
            expect(await state(app, created.candidate_id)).toEqual(before);
        }
        const overlong = await app.handlers.editDeckCandidate({
            candidate_id: created.candidate_id,
            expected_updated_at: created.updated_at,
            changes: {
                options: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        changes: { comparison_note: "😀".repeat(501) },
                    },
                ],
            },
        });
        if (overlong.isErr())
            expect(overlong.error.message).toContain("actual length 501");
        unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    options: [
                        {
                            action: "update",
                            card_identity_id: forest,
                            changes: { comparison_note: "😀".repeat(500) },
                        },
                    ],
                },
            }),
        );
        expect(
            (await state(app, created.candidate_id)).options[0].comparison_note,
        ).toBe("😀".repeat(500));
    } finally {
        app.dispose();
    }
});
test("failed SQLite writes roll back candidate fields and new relational records", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        // A database boundary failure after metadata and option writes proves transaction rollback.
        app.db.$client.run(
            "CREATE TRIGGER fail_membership BEFORE UPDATE ON deck_candidate_card BEGIN SELECT RAISE(ABORT, 'injected membership failure'); END",
        );
        const rejected = await app.handlers.editDeckCandidate({
            candidate_id: created.candidate_id,
            expected_updated_at: created.updated_at,
            changes: {
                label: "Must roll back",
                options: [{ action: "add", card_identity_id: draw }],
                contributions: [
                    {
                        action: "add",
                        contribution: {
                            card_identity_id: draw,
                            role_id: created.created_ids.mana,
                            rationale: "Another mana option",
                        },
                    },
                ],
                memberships: [
                    {
                        action: "set",
                        card_identity_id: forest,
                        section: "mainboard",
                        quantity: 20,
                    },
                ],
            },
        });
        expect(rejected.isErr()).toBe(true);
        expect(await state(app, created.candidate_id)).toEqual(before);
    } finally {
        app.dispose();
    }
});
test("database constraints prevent cross-candidate graph references and duplicate or nonintegral membership", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const other = unwrap(
            await app.handlers.createDeckCandidate({
                label: "Other",
                brief,
                plan: {
                    schema_version: 1,
                    description: "Other",
                    nodes: [
                        {
                            ref: "role",
                            kind: "role",
                            label: "Role",
                            description: "Role",
                            coverage_assessment: { summary: "Unfilled" },
                        },
                    ],
                },
            }),
        );
        const { deckCandidateContribution, deckCandidateCard } = await import(
            "@tomekin/sqlite"
        );
        expect(() =>
            app.db
                .insert(deckCandidateContribution)
                .values({
                    candidateId: created.candidate_id,
                    cardIdentityId: forest,
                    roleId: other.created_ids.role,
                    rationale: "Cross candidate",
                })
                .run(),
        ).toThrow();
        for (const quantity of [0, -1, 1.5])
            expect(() =>
                app.db
                    .insert(deckCandidateCard)
                    .values({
                        id: crypto.randomUUID(),
                        deckCandidateId: created.candidate_id,
                        cardIdentityId: draw,
                        quantity,
                        section: "mainboard",
                        sortOrder: 0,
                    })
                    .run(),
            ).toThrow();
        expect(() =>
            app.db
                .insert(deckCandidateCard)
                .values({
                    id: crypto.randomUUID(),
                    deckCandidateId: created.candidate_id,
                    cardIdentityId: forest,
                    quantity: 1,
                    section: "mainboard",
                    sortOrder: 0,
                })
                .run(),
        ).toThrow();
        const read = await state(app, created.candidate_id);
        expect(read.memberships).toHaveLength(2);
    } finally {
        app.dispose();
    }
});
test("relationship endpoint changes reconcile with node removals in one resulting-state edit", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const changed = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    nodes: [
                        {
                            action: "add",
                            node: {
                                ref: "new-win",
                                kind: "win_route",
                                label: "New finish",
                                description: "New finish",
                                priority: "primary",
                                rationale: "Updated direction",
                            },
                        },
                        { action: "remove", id: created.created_ids.win },
                    ],
                    relationships: [
                        {
                            action: "update",
                            id: created.created_ids.enable,
                            changes: {
                                target_ref: "new-win",
                                rationale: "Feeds new finish",
                            },
                        },
                    ],
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(after.plan.relationships[0]).toMatchObject({
            id: created.created_ids.enable,
            target_id: changed.created_ids["new-win"],
        });
        expect(
            after.plan.nodes.some((n: any) => n.id === created.created_ids.win),
        ).toBe(false);
    } finally {
        app.dispose();
    }
});
test("cycles among distinct roles persist and symmetric competition is logically unique", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const changed = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    nodes: [
                        {
                            action: "add",
                            node: {
                                ref: "resource",
                                kind: "role",
                                label: "Resources",
                                description: "Recurring engine resources",
                                coverage_assessment: {
                                    summary:
                                        "Desired resource engine awaiting selection",
                                },
                            },
                        },
                    ],
                    relationships: [
                        {
                            action: "add",
                            relationship: {
                                ref: "forward",
                                kind: "enables",
                                source_id: created.created_ids.mana,
                                target_ref: "resource",
                                rationale: "Mana fuels resource production",
                                qualifications: ["Requires startup material"],
                            },
                        },
                        {
                            action: "add",
                            relationship: {
                                ref: "return",
                                kind: "enables",
                                source_ref: "resource",
                                target_id: created.created_ids.mana,
                                rationale: "Resources fuel mana conversion",
                            },
                        },
                        {
                            action: "add",
                            relationship: {
                                ref: "competition",
                                kind: "competes_with",
                                source_ref: "resource",
                                target_id: created.created_ids.mana,
                                rationale:
                                    "The same material cannot fuel both uses",
                            },
                        },
                    ],
                },
            }),
        );
        const before = await state(app, created.candidate_id);
        expect(before.plan.relationships).toHaveLength(4);
        const duplicate = await app.handlers.editDeckCandidate({
            candidate_id: created.candidate_id,
            expected_updated_at: changed.updated_at,
            changes: {
                relationships: [
                    {
                        action: "add",
                        relationship: {
                            ref: "reverse",
                            kind: "competes_with",
                            source_id: created.created_ids.mana,
                            target_id: changed.created_ids.resource,
                            rationale: "The same competition reversed",
                        },
                    },
                ],
            },
        });
        expect(duplicate.isErr()).toBe(true);
        expect(await state(app, created.candidate_id)).toEqual(before);
    } finally {
        app.dispose();
    }
});
test("selected notes/order do not change deterministic selected-input timestamps", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    memberships: [
                        {
                            action: "set",
                            card_identity_id: forest,
                            section: "mainboard",
                            quantity: 30,
                            sort_order: 42,
                            note: null,
                        },
                    ],
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(after.selectedChangedAt).toBe(before.selectedChangedAt);
        expect(after.updatedAt).not.toBe(before.updatedAt);
        expect(
            after.memberships.find((m: any) => m.section === "mainboard"),
        ).toMatchObject({ sort_order: 42, note: null });
    } finally {
        app.dispose();
    }
});

test("generated candidate and authored identifiers can be deterministic at the repository seam", async () => {
    let sequence = 0;
    const app = setup(
        () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
    );
    try {
        const created = await initial(app);
        expect(created.candidate_id).toBe(
            "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        );
        expect(created.created_ids).toEqual({
            mana: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
            win: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
            enable: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
        });
        expect(
            (await state(app, created.candidate_id)).plan.nodes,
        ).toHaveLength(2);
    } finally {
        app.dispose();
    }
});

test("all bounded reasoning fields report code-point limits and invalid creates leave no candidate", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const before = await state(app, created.candidate_id);
        const long = "😀".repeat(501);
        const changes = [
            {
                contributions: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        role_id: created.created_ids.mana,
                        changes: { rationale: long },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        role_id: created.created_ids.mana,
                        changes: { qualifications: [long] },
                    },
                ],
            },
            {
                contributions: [
                    {
                        action: "update",
                        card_identity_id: forest,
                        role_id: created.created_ids.mana,
                        changes: {
                            evidence: [{ reference: "Facts", note: long }],
                        },
                    },
                ],
            },
            {
                nodes: [
                    {
                        action: "update",
                        id: created.created_ids.win,
                        changes: { rationale: long },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "update",
                        id: created.created_ids.enable,
                        changes: { rationale: long },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "update",
                        id: created.created_ids.enable,
                        changes: { qualifications: [long] },
                    },
                ],
            },
            {
                relationships: [
                    {
                        action: "update",
                        id: created.created_ids.enable,
                        changes: {
                            evidence: [{ reference: "Facts", note: long }],
                        },
                    },
                ],
            },
        ];
        for (const change of changes) {
            const result = await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: change,
            });
            expect(result.isErr()).toBe(true);
            if (result.isErr())
                expect(result.error.message).toContain("actual length 501");
            expect(await state(app, created.candidate_id)).toEqual(before);
        }
        const unknown = "99999999-9999-4999-8999-999999999999";
        const failed = await app.handlers.createDeckCandidate({
            label: "Must not persist",
            brief,
            plan: {
                schema_version: 1,
                description: "Unknown option",
                nodes: [
                    {
                        ref: "role",
                        kind: "role",
                        label: "Role",
                        description: "Role",
                    },
                ],
                contributions: [
                    {
                        card_identity_id: unknown,
                        role_ref: "role",
                        rationale: "Unknown global card",
                    },
                ],
            },
            options: [{ card_identity_id: unknown }],
            memberships: [
                {
                    card_identity_id: unknown,
                    section: "mainboard",
                    quantity: 1,
                },
            ],
        });
        expect(failed.isErr()).toBe(true);
        if (failed.isErr()) expect(failed.error.message).toContain(unknown);
        expect(unwrap(await app.handlers.listDeckCandidates())).toHaveLength(1);
    } finally {
        app.dispose();
    }
});

test("Brief Format switches retain shared preferences and require the new branch fields without automatic legality checks", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const result = unwrap(
            await app.handlers.editDeckCandidate({
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: {
                    brief: {
                        format: "commander",
                        commanderBracket: "Bracket 2",
                        ruleZeroExceptions: [],
                    },
                },
            }),
        );
        const after = await state(app, created.candidate_id);
        expect(after.brief.format).toBe("commander");
        expect(after.brief).not.toHaveProperty("powerLevel");
        expect(after.brief.goal).toBe(brief.goal);
        expect(
            after.memberships.reduce(
                (sum: number, m: any) => sum + m.quantity,
                0,
            ),
        ).toBe(31);
        expect(result.validation_evidence.status).toBe("absent");
    } finally {
        app.dispose();
    }
});

test("complete candidate reasoning is recoverable through baseline-bound views beyond the old adapter preview", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        const description = "Complete strategic uncertainty. ".repeat(1400);
        const changed = unwrap(await app.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: created.updated_at, changes: {plan: {schema_version: 1, description}}}));
        const first = unwrap(await app.handlers.getDeckCandidate({id: created.candidate_id, view: "json", first: 2}));
        expect(first.status).toBe("ok");
        expect(first.pageInfo.hasNextPage).toBe(true);
        const records = [...first.edges];
        let cursor = first.pageInfo.endCursor;
        while (cursor) {
            const page = unwrap(await app.handlers.getDeckCandidate({id: created.candidate_id, view: "json", first: 2, after: cursor}));
            records.push(...page.edges);
            cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
        }
        expect(records.find((e: any) => e.node.path.join(".") === "plan.description").node.value).toBe(description);
        expect(records.find((e: any) => e.node.path.join(".") === "plan.contributions.0").node.value).toMatchObject({rationale: "Reliable repeatable mana", qualifications: ["One activation each turn"], evidence: [{reference: "Card facts", note: "A mana ability"}]});
        const wrongView = await app.handlers.getDeckCandidate({id: created.candidate_id, view: "pool", after: first.pageInfo.endCursor});
        expect(wrongView.isErr()).toBe(true);
        await app.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: changed.updated_at, changes: {label: "New baseline"}});
        const stale = await app.handlers.getDeckCandidate({id: created.candidate_id, view: "json", after: first.pageInfo.endCursor});
        expect(stale.isErr()).toBe(true);
        expect(stale.error.envelope.error.code).toBe("stale_cursor");
    } finally { app.dispose(); }
});

test("on-demand pool and generated output keep alternatives distinct from selected canonical membership", async () => {
    const app = setup();
    try {
        const created = await initial(app);
        unwrap(await app.handlers.editDeckCandidate({candidate_id:created.candidate_id,expected_updated_at:created.updated_at,changes:{options:[{action:"add",card_identity_id:draw,comparison_note:"Assessed alternative"}],contributions:[{action:"add",contribution:{card_identity_id:draw,role_id:created.created_ids.mana,rationale:"Fallback resource"}}]}}));
        const pool = unwrap(await app.handlers.getDeckCandidate({id:created.candidate_id,view:"pool"}));
        expect(pool.edges.filter((e:any)=>e.node.path[0]==="options" && e.node.path.length===2)).toHaveLength(2);
        const alternative = pool.edges.find((e:any)=>e.node.path[0]==="options" && e.node.path.length===2 && e.node.value.card_identity_id===draw).node.value;
        expect(alternative).toMatchObject({card_name:"Another Forest",comparison_note:"Assessed alternative",memberships:[],contributions:[{rationale:"Fallback resource"}]});
        const role = pool.edges.find((e:any)=>e.node.path.join(".")==="roles.0").node.value;
        expect(role.option_ids).toHaveLength(2);
        expect(role.selected_copies).toBe(31);
        const rendered = unwrap(await app.handlers.renderDeckCandidate({candidate_id:created.candidate_id,output:"portable_decklist"}));
        const text = rendered.edges.map((e:any)=>typeof e.node.value === "string" ? e.node.value : "").join("");
        expect(text).toBe("Mainboard\n30 Forest\n\nSideboard\n1 Forest\n");
        expect(text).not.toContain("Another Forest");
        const forbidden = await app.handlers.renderDeckCandidate({label:"Forged report",format:"casual_60",cards:[{cardName:"Forged",cardIdentityId:forest,quantity:1,section:"mainboard"}]});
        expect(forbidden.isErr()).toBe(true);
    } finally {app.dispose();}
});
