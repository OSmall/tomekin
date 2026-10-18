import {expect, test} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
    createTestRootLoggerFromEnv,
    agentToolResultDetails,
} from "@tomekin/core";
import {applySqliteMigrations} from "@tomekin/sqlite";
import {createLocalAgentToolRuntime} from "../src";

const card = (id: string) => ({
    object: "card",
    id,
    oracle_id: `oracle-${id}`,
    name: `Card ${id}`,
    layout: "normal",
});
test("searches without local imports and resumes by raw Printing anchor without losing or replaying cards", async () => {
    const dir = mkdtempSync(join(tmpdir(), "provider-search-")),
        databasePath = join(dir, "test.sqlite"),
        log = createTestRootLoggerFromEnv();
    applySqliteMigrations(databasePath, {log});
    const requests: string[] = [];
    const provider = {
        id: "fixture",
        async dispatch(url: string) {
            requests.push(url);
            return {
                status: 200,
                body: {
                    object: "list",
                    data: [card("a"), card("b"), card("c")],
                    has_more: false,
                    total_cards: 3,
                },
            };
        },
    };
    const runtime = createLocalAgentToolRuntime({
        databasePath,
        log,
        search: {provider},
    });
    try {
        const input = {
            q: '  name:"é" unique:prints ',
            select: {name: true},
            first: 1,
        };
        const first = agentToolResultDetails(
            await runtime.handlers.searchCards(input),
        ) as any;
        expect(first).toMatchObject({
            status: "ok",
            edges: [{node: {card: {oracle_id: "oracle-a", name: "Card a"}}}],
            pageInfo: {hasNextPage: true},
            metadata: {scoped_total: null},
        });
        const second = agentToolResultDetails(
            await runtime.handlers.searchCards({
                ...input,
                first: 2,
                after: first.pageInfo.endCursor,
            }),
        ) as any;
        expect(second.edges.map((e: any) => e.node.card.oracle_id)).toEqual([
            "oracle-b",
            "oracle-c",
        ]);
        expect(second.pageInfo.hasNextPage).toBe(false);
        expect(new URL(requests[0]!).searchParams.get("q")).toBe(input.q);
        expect(new URL(requests[0]!).searchParams.has("unique")).toBe(false);
    } finally {
        runtime.close();
        rmSync(dir, {recursive: true, force: true});
    }
});

async function withSearch(
    run: (
        runtime: ReturnType<typeof createLocalAgentToolRuntime>,
        requests: string[],
        set: (handler: (url: string) => any) => void,
    ) => Promise<void>,
    options: Record<string, unknown> = {},
) {
    const dir = mkdtempSync(join(tmpdir(), "search-cases-")),
        databasePath = join(dir, "test.sqlite"),
        log = createTestRootLoggerFromEnv();
    applySqliteMigrations(databasePath, {log});
    const requests: string[] = [];
    let handler = (url: string): any => ({
        status: 200,
        body: {
            object: "list",
            data: [card("a"), card("b"), card("c")],
            has_more: false,
            total_cards: 3,
        },
    });
    const runtime = createLocalAgentToolRuntime({
        databasePath,
        log,
        search: {
            provider: {
                id: "fixture",
                async dispatch(url) {
                    requests.push(url);
                    return handler(url);
                },
            },
            ...options,
        },
    });
    try {
        await run(runtime, requests, (value) => {
            handler = value;
        });
    } finally {
        runtime.close();
        rmSync(dir, {recursive: true, force: true});
    }
}
const details = async (
    result: ReturnType<
        ReturnType<
            typeof createLocalAgentToolRuntime
        >["handlers"]["searchCards"]
    >,
) => agentToolResultDetails(await result) as any;
const request = {q: "fixture", select: {name: true}};
test("follows exact supplied next_page across empty pages and never rereads a completed page", async () =>
    withSearch(async (runtime, requests, set) => {
        const page2 =
                "https://api.scryfall.com/cards/search?q=fixture&page=2&unique=cards",
            page3 =
                "https://api.scryfall.com/cards/search?q=fixture&page=3&unique=cards";
        set((url) => ({
            status: 200,
            body: {
                object: "list",
                data: url.includes("page=2")
                    ? []
                    : [card(url.includes("page=3") ? "c" : "a")],
                has_more: !url.includes("page=3"),
                next_page: url.includes("page=2") ? page3 : page2,
            },
        }));
        const a = await details(
            runtime.handlers.searchCards({...request, first: 1}),
        );
        expect(a.pageInfo.hasNextPage).toBe(true);
        expect(requests).toEqual([
            "https://api.scryfall.com/cards/search?q=fixture",
            page2,
            page3,
        ]);
        requests.length = 0;
        const b = await details(
            runtime.handlers.searchCards({
                ...request,
                first: 1,
                after: a.pageInfo.endCursor,
            }),
        );
        expect(b.edges[0].node.card.oracle_id).toBe("oracle-c");
        expect(requests).toEqual([page2, page3]);
        expect(b.metadata.scoped_total).toBeNull();
    }));
test("zero-first establishes another match without consuming it and empty exhaustion is successful", async () =>
    withSearch(async (runtime, requests, set) => {
        const zero = await details(
            runtime.handlers.searchCards({...request, first: 0}),
        );
        expect(zero).toMatchObject({
            status: "ok",
            edges: [],
            pageInfo: {hasNextPage: true, startCursor: null, endCursor: null},
        });
        set(() => ({
            status: 200,
            body: {object: "list", data: [], has_more: false, total_cards: 0},
        }));
        const empty = await details(
            runtime.handlers.searchCards({...request, first: 0}),
        );
        expect(empty).toMatchObject({
            status: "ok",
            edges: [],
            pageInfo: {hasNextPage: false},
            stop_reason: "source_exhausted",
            metadata: {provider_total: 0, scoped_total: null},
        });
    }));
test("missing and duplicate raw Printing anchors fail explicitly instead of guessing", async () =>
    withSearch(async (runtime, requests, set) => {
        const a = await details(
            runtime.handlers.searchCards({...request, first: 1}),
        );
        for (const data of [[card("b")], [card("a"), card("a"), card("b")]]) {
            set(() => ({
                status: 200,
                body: {object: "list", data, has_more: false},
            }));
            const failed = await details(
                runtime.handlers.searchCards({
                    ...request,
                    after: a.pageInfo.endCursor,
                }),
            );
            expect(failed.status).toBe("error");
            expect(failed.error.code).toBe(
                data.length === 1
                    ? "cursor_anchor_not_found"
                    : "provider_error",
            );
            if (data.length > 1)
                expect(failed.error.reason).toBe("duplicate_anchor");
        }
    }));
test("a filled prefix whose lookahead times out has only complete edges and safe failure recovery", async () => {
    let time = 0;
    await withSearch(
        async (runtime, requests, set) => {
            const page2 =
                "https://api.scryfall.com/cards/search?q=fixture&page=2";
            set((url) => {
                if (url === page2) {
                    time = 100;
                    return {
                        status: 200,
                        body: {
                            object: "list",
                            data: [card("b")],
                            has_more: false,
                        },
                    };
                }
                return {
                    status: 200,
                    body: {
                        object: "list",
                        data: [card("a")],
                        has_more: true,
                        next_page: page2,
                    },
                };
            });
            const failed = await details(
                runtime.handlers.searchCards({...request, first: 1}),
            );
            expect(failed).toMatchObject({
                status: "error",
                edges: [{node: {card: {oracle_id: "oracle-a"}}}],
                error: {code: "scan_timeout", retryable: true},
            });
            expect(typeof failed.error.cursor).toBe("string");
            expect(failed).not.toHaveProperty("pageInfo");
            time = 0;
            set(() => ({
                status: 200,
                body: {object: "list", data: [card("b")], has_more: false},
            }));
            const resumed = await details(
                runtime.handlers.searchCards({
                    ...request,
                    after: failed.error.cursor,
                }),
            );
            expect(
                resumed.edges.map((e: any) => e.node.card.oracle_id),
            ).toEqual(["oracle-b"]);
        },
        {now: () => time, scanDeadlineMs: 100},
    );
});
test("UTF-8 whole-object byte pages traverse exactly once and oversized records remain unconsumed", async () =>
    withSearch(
        async (runtime, requests, set) => {
            const source = Array.from({length: 8}, (_, i) => ({
                ...card(String(i)),
                oracle_text: 'é "quoted"\n'.repeat(25),
            }));
            set(() => ({
                status: 200,
                body: {object: "list", data: source, has_more: false},
            }));
            const received: string[] = [];
            let after: string | undefined;
            do {
                const response = await details(
                    runtime.handlers.searchCards({
                        q: "fixture",
                        select: {oracle_text: true},
                        ...(after ? {after} : {}),
                    }),
                );
                expect(response.status).toBe("ok");
                expect(
                    Buffer.byteLength(JSON.stringify(response)),
                ).toBeLessThanOrEqual(2400);
                received.push(
                    ...response.edges.map((e: any) => e.node.card.oracle_id),
                );
                after = response.pageInfo.hasNextPage
                    ? response.pageInfo.endCursor
                    : undefined;
            } while (after);
            expect(received).toEqual(source.map((c) => c.oracle_id));
            set(() => ({
                status: 200,
                body: {
                    object: "list",
                    data: [{...card("large"), oracle_text: "語".repeat(2000)}],
                    has_more: false,
                },
            }));
            const failed = await details(
                runtime.handlers.searchCards({
                    q: "fixture",
                    select: {oracle_text: true},
                }),
            );
            expect(failed).toMatchObject({
                status: "error",
                edges: [],
                error: {code: "record_too_large"},
            });
            const resumed = await details(
                runtime.handlers.searchCards({
                    q: "fixture",
                    select: {oracle_id: true},
                    after: failed.error.cursor,
                }),
            );
            expect(resumed.edges[0].node.card.oracle_id).toBe("oracle-large");
        },
        {responseBudgetBytes: 2400},
    ));
test("large fixed bindings fail preflight and upstream URL changes never dispatch", async () =>
    withSearch(
        async (runtime, requests, set) => {
            const failed = await details(
                runtime.handlers.searchCards({
                    q: "x".repeat(4000),
                    select: {oracle_id: true},
                }),
            );
            expect(failed.error.code).toBe("cursor_too_large");
            expect(requests).toEqual([]);
            set(() => ({
                status: 200,
                body: {
                    object: "list",
                    data: [],
                    has_more: true,
                    next_page:
                        "https://example.invalid/cards/search?q=fixture&page=2",
                },
            }));
            const invalid = await details(
                runtime.handlers.searchCards(request),
            );
            expect(invalid.error).toMatchObject({
                code: "provider_error",
                reason: "invalid_response",
            });
            expect(requests).toHaveLength(1);
        },
        {responseBudgetBytes: 2400},
    ));

test("reversible presentations use an unambiguous face identity and canonical gameplay layout", async () =>
    withSearch(async (runtime, requests, set) => {
        const face = {
            oracle_id: "oracle-reversible",
            layout: "normal",
            name: "Canonical card",
            type_line: "Artifact",
            cmc: 2,
            oracle_text: "Complete gameplay text",
        };
        set(() => ({
            status: 200,
            body: {
                object: "list",
                data: [
                    {
                        object: "card",
                        id: "reversible-print",
                        layout: "reversible_card",
                        card_faces: [face, {...face}],
                    },
                ],
                has_more: false,
            },
        }));
        const response = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {
                    name: true,
                    layout: true,
                    mana_value: true,
                    printing_layout: true,
                    oracle_text: true,
                },
            }),
        );
        expect(response).toMatchObject({
            status: "ok",
            edges: [
                {
                    node: {
                        card: {
                            oracle_id: "oracle-reversible",
                            printing_id: "reversible-print",
                            layout: "normal",
                            printing_layout: "reversible_card",
                            name: "Canonical card",
                            mana_value: 2,
                            oracle_text: "Complete gameplay text",
                            card_faces: [
                                {
                                    name: "Canonical card",
                                    oracle_text: "Complete gameplay text",
                                },
                                {
                                    name: "Canonical card",
                                    oracle_text: "Complete gameplay text",
                                },
                            ],
                        },
                    },
                },
            ],
        });
    }));

import {createLookupFixture, id} from "./fixtures/lookup";
test("tag enrichment binds successful import or known absence and retains dependencies when selectors change", async () => {
    const fixture = await createLookupFixture(),
        log = createTestRootLoggerFromEnv();
    const provider = {
        id: "fixture",
        async dispatch() {
            return {
                status: 200,
                body: {
                    object: "list",
                    data: [
                        {...card("a"), oracle_id: id(1)},
                        {...card("b"), oracle_id: id(2)},
                    ],
                    has_more: false,
                },
            };
        },
    };
    const runtime = createLocalAgentToolRuntime({
        databasePath: fixture.databasePath,
        log,
        search: {provider},
    });
    try {
        const pure = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {oracle_id: true},
                first: 1,
            }),
        );
        const absent = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {tags: true},
                first: 1,
            }),
        );
        expect(absent.edges[0].node).toMatchObject({
            unavailable_fields: {tags: "dataset_not_imported"},
        });
        expect(absent.edges[0].node.card).not.toHaveProperty("tags");
        await fixture.recordFailedImport();
        const retained = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {name: true},
                first: 0,
                after: absent.pageInfo.endCursor,
            }),
        );
        expect(retained.status).toBe("ok");
        await fixture.reimportTags();
        const stale = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {name: true},
                after: absent.pageInfo.endCursor,
            }),
        );
        expect(stale).toMatchObject({
            status: "error",
            edges: [],
            error: {code: "stale_cursor", reason: "reference_import_changed"},
        });
        expect(stale.error).not.toHaveProperty("cursor");
        const unrelated = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {name: true},
                after: pure.pageInfo.endCursor,
            }),
        );
        expect(unrelated.status).toBe("ok");
        const enriched = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {tags: true},
                first: 1,
            }),
        );
        expect(enriched.edges[0].node.card.tags).toEqual({
            direct: [
                {slug: "mana-rock", weight: "strong", annotation: null},
                {
                    slug: "resource",
                    weight: "weak",
                    annotation: "Synthetic direct preference",
                },
            ],
            inherited: [{slug: "mana", weight: "strong"}],
        });
    } finally {
        runtime.close();
        fixture.dispose();
    }
});

test("native controls pass through unchanged including false and conflicting query directives", async () =>
    withSearch(async (runtime, requests) => {
        const input = {
            q: 'o:"語" unique:prints',
            unique: "cards",
            order: "cmc",
            dir: "desc",
            include_extras: false,
            include_multilingual: true,
            include_variations: false,
            select: {oracle_id: true},
            first: 0,
        };
        const result = await details(runtime.handlers.searchCards(input));
        expect(result.status).toBe("ok");
        const params = new URL(requests[0]!).searchParams;
        for (const key of [
            "q",
            "unique",
            "order",
            "dir",
            "include_extras",
            "include_multilingual",
            "include_variations",
        ] as const)
            expect(params.get(key)).toBe(String(input[key]));
        expect(Object.keys(result.edges)).toHaveLength(0);
    }));
test("dynamic supplied positions that outgrow the envelope stop at a representable safe position", async () =>
    withSearch(
        async (runtime, requests, set) => {
            const next =
                "https://api.scryfall.com/cards/search?q=fixture&page=2&pretty=" +
                "x".repeat(5000);
            set(() => ({
                status: 200,
                body: {
                    object: "list",
                    data: [],
                    has_more: true,
                    next_page: next,
                },
            }));
            const failed = await details(runtime.handlers.searchCards(request));
            expect(failed.error.code).toBe("cursor_too_large");
            expect(typeof failed.error.cursor).toBe("string");
            expect(
                Buffer.byteLength(JSON.stringify(failed)),
            ).toBeLessThanOrEqual(2400);
            set(() => ({
                status: 200,
                body: {object: "list", data: [card("a")], has_more: false},
            }));
            const resumed = await details(
                runtime.handlers.searchCards({
                    ...request,
                    after: failed.error.cursor,
                }),
            );
            expect(resumed.edges[0].node.card.oracle_id).toBe("oracle-a");
        },
        {responseBudgetBytes: 2400},
    ));
test("cooperative cancellation returns complete edges and the source position before unreturned matches", async () => {
    const controller = new AbortController();
    await withSearch(async (runtime, requests, set) => {
        const page2 = "https://api.scryfall.com/cards/search?q=fixture&page=2";
        set((url) => {
            if (url === page2) {
                controller.abort();
                return {
                    status: 200,
                    body: {object: "list", data: [card("b")], has_more: false},
                };
            }
            return {
                status: 200,
                body: {
                    object: "list",
                    data: [card("a")],
                    has_more: true,
                    next_page: page2,
                },
            };
        });
        const failed = await details(
            runtime.handlers.searchCards(request, controller.signal),
        );
        expect(failed).toMatchObject({
            status: "error",
            edges: [{node: {card: {oracle_id: "oracle-a"}}}],
            error: {code: "cancelled", retryable: true},
        });
        expect(typeof failed.error.cursor).toBe("string");
        set(() => ({
            status: 200,
            body: {object: "list", data: [card("b")], has_more: false},
        }));
        const recovered = await details(
            runtime.handlers.searchCards({
                ...request,
                after: failed.error.cursor,
            }),
        );
        expect(recovered.edges.map((e: any) => e.node.card.oracle_id)).toEqual([
            "oracle-b",
        ]);
    });
});

import {
    ProviderFailure,
    createRootLogger,
    resolveLogConfigFromEnv,
} from "@tomekin/core";
test("larger error metadata rolls back omitted matches and recovery together without replay", async () =>
    withSearch(
        async (runtime, requests, set) => {
            const page2 =
                    "https://api.scryfall.com/cards/search?q=fixture&page=2",
                source = [card("a"), card("b"), card("c")].map((raw) => ({
                    ...raw,
                    oracle_text: "Complete rules. ".repeat(14),
                }));
            let fail = true;
            set((url) => {
                if (url === page2) {
                    if (fail)
                        throw new ProviderFailure({
                            code: "provider_error",
                            message: "Failure diagnostic. ".repeat(60),
                            retryable: true,
                        });
                    return {
                        status: 200,
                        body: {object: "list", data: [], has_more: false},
                    };
                }
                return {
                    status: 200,
                    body: {
                        object: "list",
                        data: source,
                        has_more: true,
                        next_page: page2,
                    },
                };
            });
            const input = {q: "fixture", select: {oracle_text: true}},
                failed = await details(runtime.handlers.searchCards(input));
            expect(failed.status).toBe("error");
            expect(failed.edges).toHaveLength(2);
            expect(
                Buffer.byteLength(JSON.stringify(failed)),
            ).toBeLessThanOrEqual(2400);
            fail = false;
            const recovered = await details(
                runtime.handlers.searchCards({
                    ...input,
                    after: failed.error.cursor,
                }),
            );
            expect(
                [...failed.edges, ...recovered.edges].map(
                    (edge: any) => edge.node.card.oracle_id,
                ),
            ).toEqual(["oracle-a", "oracle-b", "oracle-c"]);
        },
        {responseBudgetBytes: 2400},
    ));
test("search logs exact bytes and stage/count diagnostics with deliberate debug q/cursors and no card dumps", async () => {
    const dir = mkdtempSync(join(tmpdir(), "search-logs-")),
        databasePath = join(dir, "test.sqlite"),
        path = join(dir, "operations.jsonl");
    const log = createRootLogger(
        resolveLogConfigFromEnv({
            NODE_ENV: "production",
            TOMEKIN_LOG_DESTINATION: "file",
            TOMEKIN_LOG_FILE: path,
            TOMEKIN_LOG_LEVEL: "debug",
            TOMEKIN_LOG_FORMAT: "json",
        }),
    );
    applySqliteMigrations(databasePath, {log});
    const sentinel = 'Private complete result text 語 "quoted"\n';
    const provider = {
        id: "fixture",
        async dispatch() {
            return {
                status: 200,
                body: {
                    object: "list",
                    data: [{...card("a"), oracle_text: sentinel}],
                    has_more: false,
                },
            };
        },
    };
    const runtime = createLocalAgentToolRuntime({
        databasePath,
        log,
        search: {provider},
    });
    try {
        const response = await details(
            runtime.handlers.searchCards({
                q: '  o:"語" ',
                select: {oracle_text: true},
            }),
        );
        const records = (await Bun.file(path).text())
                .trim()
                .split("\n")
                .map((line) => JSON.parse(line)),
            completed = records.find(
                (record) =>
                    record.operation === "search_cards" && record.level === 30,
            ),
            debug = records.find((record) => record.level === 20 && record.q);
        expect(completed.outputBytes).toBe(
            Buffer.byteLength(JSON.stringify(response)),
        );
        expect(completed).toMatchObject({
            providerDispatchAttempts: 1,
            providerPages: 1,
            rawCount: 1,
            returnedCount: 1,
            stopReason: "source_exhausted",
        });
        for (const stage of [
            "providerStageMs",
            "projectionMs",
            "localMs",
            "finalSerializationMs",
            "durationMs",
        ])
            expect(typeof completed[stage]).toBe("number");
        expect(debug.q).toBe('  o:"語" ');
        expect(typeof debug.cursors.endCursor).toBe("string");
        expect(
            records.some(
                (record) =>
                    "edges" in record || "output" in record || "body" in record,
            ),
        ).toBe(false);
        expect(JSON.stringify(records)).not.toContain(
            "Private complete result text",
        );
    } finally {
        runtime.close();
        rmSync(dir, {recursive: true, force: true});
    }
});

test("Printing anchors preserve multiple Printings of the same Oracle identity", async () =>
    withSearch(async (runtime, requests, set) => {
        set(() => ({
            status: 200,
            body: {
                object: "list",
                data: [
                    {...card("a"), oracle_id: "same-oracle"},
                    {...card("b"), oracle_id: "same-oracle"},
                    card("c"),
                ],
                has_more: false,
            },
        }));
        const a = await details(
                runtime.handlers.searchCards({...request, first: 1}),
            ),
            b = await details(
                runtime.handlers.searchCards({
                    ...request,
                    first: 1,
                    after: a.pageInfo.endCursor,
                }),
            );
        expect(a.edges[0].node.card.oracle_id).toBe("same-oracle");
        expect(b.edges[0].node.card).toEqual({
            oracle_id: "same-oracle",
            name: "Card b",
        });
    }));
test("accepted live drift can omit a moved record while a retained anchor still resolves", async () =>
    withSearch(async (runtime, requests, set) => {
        const first = await details(
            runtime.handlers.searchCards({...request, first: 2}),
        );
        set(() => ({
            status: 200,
            body: {
                object: "list",
                data: [card("c"), card("a"), card("b"), card("d")],
                has_more: false,
            },
        }));
        const changed = await details(
            runtime.handlers.searchCards({
                ...request,
                after: first.pageInfo.endCursor,
            }),
        );
        expect(
            changed.edges.map((edge: any) => edge.node.card.oracle_id),
        ).toEqual(["oracle-d"]);
        expect(changed.metadata.scoped_total).toBeNull();
    }));

test("newer provider identities have unavailable local enrichment and tag reads retain Oracle import dependency", async () => {
    const fixture = await createLookupFixture({tags: true}),
        log = createTestRootLoggerFromEnv();
    const provider = {
        id: "fixture",
        async dispatch() {
            return {
                status: 200,
                body: {
                    object: "list",
                    data: [
                        {...card("new"), oracle_id: id(999)},
                        {...card("known"), oracle_id: id(1)},
                    ],
                    has_more: false,
                },
            };
        },
    };
    const runtime = createLocalAgentToolRuntime({
        databasePath: fixture.databasePath,
        log,
        search: {provider},
    });
    try {
        const first = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {tags: true},
                first: 1,
            }),
        );
        expect(first.edges[0].node).toMatchObject({
            unavailable_fields: {tags: "identity_not_in_local_reference_data"},
        });
        expect(first.edges[0].node.card).not.toHaveProperty("tags");
        await fixture.reimportOracle();
        const stale = await details(
            runtime.handlers.searchCards({
                q: "fixture",
                select: {name: true},
                after: first.pageInfo.endCursor,
            }),
        );
        expect(stale.error.code).toBe("stale_cursor");
    } finally {
        runtime.close();
        fixture.dispose();
    }
});

test("opt-in provenance names the provider actually read without inventing local imports", async () =>
    withSearch(async (runtime) => {
        const response = await details(
            runtime.handlers.searchCards({
                ...request,
                include_provenance: true,
            }),
        );
        expect(response.provenance).toMatchObject({
            provider: {name: "fixture"},
            reference_imports: [],
        });
        expect(
            Number.isFinite(
                Date.parse(response.provenance.provider.retrieved_at),
            ),
        ).toBe(true);
        const omitted = await details(runtime.handlers.searchCards(request));
        expect(omitted).not.toHaveProperty("provenance");
    }));


test("public Sol Ring Printing preserves empty promo associations and nullable scalars in search and lookup", async () => {
    const fixture = await createLookupFixture();
    const raw = JSON.parse(readFileSync(new URL("../test/fixtures/all-cards-minimal.json", import.meta.resolve("@tomekin/sqlite")), "utf8")).find((record: any) => record.name === "Sol Ring");
    expect(raw).not.toHaveProperty("promo_types");
    expect(raw).not.toHaveProperty("printed_name");
    let source = raw;
    const provider = {id: "public-fixture", async dispatch() {return {status: 200, body: {object: "list", data: [source], has_more: false}};}};
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log: createTestRootLoggerFromEnv(), search: {provider}});
    try {
        const select = {promo_types: true, printed_name: true};
        const search = await details(runtime.handlers.searchCards({q: "Sol Ring", select}));
        const lookup = agentToolResultDetails(await runtime.handlers.lookupCards({references: [{kind: "printing_id", value: raw.id}], select})) as any;
        const expected = {oracle_id: raw.oracle_id, printing_id: raw.id, promo_types: [], printed_name: null};
        expect(search.edges[0].node.card).toEqual(expected);
        expect(lookup.edges[0].node.card).toEqual(expected);
        source = {...raw, promo_types: ["prerelease"]};
        expect((await details(runtime.handlers.searchCards({q: "Sol Ring", select}))).edges[0].node.card.promo_types).toEqual(["prerelease"]);
        for (const malformed of [null, "prerelease", {}, [1], ["prerelease", null]]) {
            source = {...raw, promo_types: malformed};
            expect(await details(runtime.handlers.searchCards({q: "Sol Ring", select}))).toMatchObject({status: "error", edges: [], error: {code: "unsupported_source_record", retryable: false}});
        }
    } finally {runtime.close(); fixture.dispose();}
});
