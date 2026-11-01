import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createLookupFixture, log} from "./fixtures/lookup";

test("catalogue lookup returns complete definitions without hierarchy and explicit misses", async () => {
    const fixture = await createLookupFixture({tags: true});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const result = await runtime.handlers.browseTags({operation: {type: "lookup", slugs: ["mana-rock", "absent"]}});
        expect(result.isOk()).toBe(true);
        expect(result.value.edges).toMatchObject([{node: {status: "found", tag: {slug: "mana-rock", label: "mana rock", description: null, aliases: []}}}, {node: {status: "not_found", slug: "absent"}}]);
        expect(result.value.edges[0].node).not.toHaveProperty("hierarchy");
    } finally {runtime.close(); fixture.dispose();}
});

test("requested hierarchy defaults to immediate edges and deeper exploration is explicit and bounded", async () => {
    const fixture = await createLookupFixture({tags: true});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const read = (hierarchy: unknown) => runtime.handlers.browseTags({operation: {type: "lookup", slugs: ["mana-rock"], hierarchy}});
        const immediate = (await read({}))._unsafeUnwrap().edges[0]!.node;
        expect(immediate).toMatchObject({hierarchy: {depth: 1, parents: [{slug: "mana"}], children: [], relationships: [{parent_slug: "mana", child_slug: "mana-rock"}]}});
        expect(JSON.stringify(immediate)).not.toContain('"resource"');
        const deeper = (await read({depth: 2}))._unsafeUnwrap().edges[0]!.node;
        expect(deeper).toMatchObject({hierarchy: {depth: 2, parents: [{slug: "mana"}, {slug: "resource"}], relationships: [{parent_slug: "mana", child_slug: "mana-rock"}, {parent_slug: "resource", child_slug: "mana"}]}});
        expect((await read({depth: 4}))._unsafeUnwrapErr().envelope.error.code).toBe("invalid_request");
    } finally {runtime.close(); fixture.dispose();}
});

test("catalogue search covers slug, label and alias and list recovers every complete definition", async () => {
    const fixture = await createLookupFixture({tags: true});
    const {openDatabase, closeDatabase, cardIdentityTagAlias} = await import("@tomekin/sqlite");
    const {id} = await import("./fixtures/lookup");
    const db = openDatabase(fixture.databasePath, {log});
    db.insert(cardIdentityTagAlias).values({tagId: id(20), alias: "Artifact accelerator"}).run(); closeDatabase(db);
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        for (const query of ["MANA-ROCK", "mana rock", "ACCELERATOR"]) {
            const page = (await runtime.handlers.browseTags({operation: {type: "search", query}}))._unsafeUnwrap();
            expect(page.edges).toMatchObject([{node: {tag: {slug: "mana-rock", aliases: ["Artifact accelerator"]}}}]);
        }
        expect((await runtime.handlers.browseTags({operation: {type: "search", query: "%"}}))._unsafeUnwrap().edges).toEqual([]);
        const slugs: string[] = []; let after: string | undefined;
        do {
            const page = (await runtime.handlers.browseTags({operation: {type: "list"}, first: 1, ...(after ? {after} : {})}))._unsafeUnwrap();
            slugs.push(...page.edges.map(({node}) => node.status === "found" ? node.tag.slug : "missing"));
            after = Boolean(page.next_cursor) ? page.next_cursor! : undefined;
        } while (after);
        expect(slugs).toEqual(["mana", "mana-rock", "resource"]);
        const zero = (await runtime.handlers.browseTags({operation: {type: "list"}, first: 0}))._unsafeUnwrap();
        expect(structuredClone(zero)).toMatchObject({edges: [], next_cursor: expect.any(String)});
    } finally {runtime.close(); fixture.dispose();}
});

test("tag readiness is distinct from search emptiness and exact-slug miss, with relevant import invalidation", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const args = {operation: {type: "list"}};
        expect((await runtime.handlers.browseTags(args))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "reference_data_unready", missing_datasets: ["oracle_tags"]});
        await fixture.reimportTags();
        const first = (await runtime.handlers.browseTags({...args, first: 1}))._unsafeUnwrap();
        const after = first.next_cursor!;
        await fixture.recordFailedImport(); await fixture.reimportOracle();
        expect((await runtime.handlers.browseTags({...args, after})).isOk()).toBe(true);
        expect((await runtime.handlers.browseTags({operation: {type: "search", query: "mana"}, after}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "invalid_cursor", reason: "query_mismatch"});
        await fixture.reimportTags();
        expect((await runtime.handlers.browseTags({...args, after}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "stale_cursor", reason: "reference_import_changed"});
    } finally {runtime.close(); fixture.dispose();}
});

test("Set discovery uses imported code/name metadata without requiring an unrelated tag import", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const all = (await runtime.handlers.searchCardSets({}))._unsafeUnwrap();
        expect(all.length).toBeGreaterThan(0);
        const code = all[0]!.code;
        const found = (await runtime.handlers.searchCardSets({query: code.toUpperCase()}))._unsafeUnwrap();
        expect(found[0]!.code).toBe(code);
    } finally {runtime.close(); fixture.dispose();}
});

test("bounded catalogue UTF-8 pages preserve whole definitions and recover oversized records without loss", async () => {
    const fixture = await createLookupFixture({tags: true});
    const {openDatabase, closeDatabase} = await import("@tomekin/sqlite");
    const {id} = await import("./fixtures/lookup");
    const db = openDatabase(fixture.databasePath, {log});
    const text = 'Æ "complete"\n'.repeat(40);
    db.$client.prepare("UPDATE card_identity_tag SET description = ?").run(text); closeDatabase(db);
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {responseBudgetBytes: 2000}});
    try {
        const args = {operation: {type: "list"},first:1};
        const first = (await runtime.handlers.browseTags(args))._unsafeUnwrap();
        expect(first.stop_reason).toBe("first");
        expect(first.edges).toHaveLength(1);
        expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThanOrEqual(2000);
        const second = (await runtime.handlers.browseTags({...args, after: first.next_cursor}))._unsafeUnwrap();
        expect(second.edges).toMatchObject([{node: {tag: {slug: "mana-rock", description: text}}}]);
        const edit = openDatabase(fixture.databasePath, {log});
        edit.$client.prepare("UPDATE card_identity_tag SET description = ? WHERE id = ?").run(text.repeat(100), id(22)); closeDatabase(edit);
        const oversized = (await runtime.handlers.browseTags({...args, after: second.next_cursor}))._unsafeUnwrapErr().envelope;
        expect(oversized).toMatchObject({edges: [], error: {code: "record_too_large", retryable: false}});
        expect(typeof oversized.error.cursor).toBe("string");
        expect(oversized).not.toHaveProperty("pageInfo");
        expect(Buffer.byteLength(JSON.stringify(oversized))).toBeLessThanOrEqual(2000);
        const retry = (await runtime.handlers.browseTags({...args, after: oversized.error.cursor}))._unsafeUnwrapErr().envelope;
        expect(retry.error.code).toBe("record_too_large");
    } finally {runtime.close(); fixture.dispose();}
});

test("catalogue reports malformed cursors, oversized bindings and safe cancellation explicitly", async () => {
    const fixture = await createLookupFixture({tags: true});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {responseBudgetBytes: 2000}});
    try {
        const args = {operation: {type: "list"}};
        expect((await runtime.handlers.browseTags({...args, after: "bad!"}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "invalid_cursor", reason: "malformed"});
        const long = (await runtime.handlers.browseTags({operation: {type: "lookup", slugs: ["x".repeat(4000)]}}))._unsafeUnwrapErr().envelope;
        expect(long).toMatchObject({edges: [], error: {code: "record_too_large"}});
        const abort = new AbortController(); abort.abort();
        const cancelled = (await runtime.handlers.browseTags(args, abort.signal))._unsafeUnwrapErr().envelope;
        expect(cancelled).toMatchObject({edges: [], error: {code: "cancelled"}});
        expect(typeof cancelled.error.cursor).toBe("string");
        const resumed = (await runtime.handlers.browseTags({...args, after: cancelled.status === "error" ? cancelled.error.cursor : undefined, first: 1}))._unsafeUnwrap();
        expect(resumed.edges).toMatchObject([{node: {tag: {slug: "mana"}}}]);
    } finally {runtime.close(); fixture.dispose();}
});


test.each([
    ["clock rollback", "2026-10-17T00:00:00.000Z"],
    ["same timestamp and lower UUID", "2026-10-18T00:00:00.000Z"],
])("catalogue continuation rejects a committed replacement under %s", async (_case, timestamp) => {
    let now = new Date("2026-10-18T00:00:00.000Z");
    const fixture = await createLookupFixture({tags: true, now: () => now});
    const {openDatabase, closeDatabase, createSqliteScryfallRepository} = await import("@tomekin/sqlite");
    const {id} = await import("./fixtures/lookup");
    const db = openDatabase(fixture.databasePath, {log});
    // A later replacement must win even when its UUID sorts below the old import.
    const oldId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    db.$client.prepare("UPDATE scryfall_bulk_data_import SET id = ? WHERE bulk_data_type = 'oracle_tags'").run(oldId);
    const repo = createSqliteScryfallRepository(db, {now: () => now});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const args = {operation: {type: "list"}, first: 1};
        const first = (await runtime.handlers.browseTags(args))._unsafeUnwrap();
        expect(first.edges).toMatchObject([{node: {tag: {slug: "mana", label: "mana"}}}]);
        const after = first.next_cursor!;
        (await repo.recordFailedBulkDataImport("oracle_tags", {startedAt: now, completedAt: now, blockingErrors: ["Synthetic failed replacement"]}))._unsafeUnwrap();
        await fixture.reimportOracle();
        expect((await runtime.handlers.browseTags({...args, after})).isOk()).toBe(true);
        now = new Date(timestamp);
        const replaced = (await repo.importCardIdentityTags({startedAt: now, records: (async function*() {
            yield {tag: {id: id(20), slug: "mana-rock", label: "replacement mana rock", description: null, sourcePageUri: "https://example.invalid/tag"}, aliases: [], taggings: [], hierarchy: []};
            yield {tag: {id: id(21), slug: "mana", label: "replacement mana", description: null, sourcePageUri: "https://example.invalid/tag"}, aliases: [], taggings: [], hierarchy: []};
        })()}))._unsafeUnwrap();
        expect(replaced.id < oldId).toBe(true);
        expect((await runtime.handlers.browseTags({...args, after}))._unsafeUnwrapErr().envelope).toMatchObject({edges: [], error: {code: "stale_cursor", reason: "reference_import_changed"}});
        expect((await runtime.handlers.browseTags(args))._unsafeUnwrap().edges).toMatchObject([{node: {tag: {slug: "mana", label: "replacement mana"}}}]);
    } finally {runtime.close(); closeDatabase(db); fixture.dispose();}
});
