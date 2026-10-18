import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createLookupFixture, id, log} from "./fixtures/lookup";

test("lookup preserves exact references, ordered misses and duplicates across pages", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "Sol Ring"}, {kind: "oracle_id", value: id(99)}, {kind: "printing_id", value: id(2)}, {kind: "name", value: "Sol Ring"}];
        const first = (await runtime.handlers.lookupCards({references, select: {name: true}, first: 2}))._unsafeUnwrap();
        expect(first).toMatchObject({status: "ok", edges: [{node: {status: "found", card: {oracle_id: id(1), name: "Sol Ring"}}}, {node: {status: "not_found", reference: references[1]}}], metadata: {returned_count: 2, lookup: {input_count: 4, start_index: 0, next_index: 2}}, pageInfo: {hasNextPage: true, hasPreviousPage: false}});
        const next = (await runtime.handlers.lookupCards({references, select: {oracle_id: true}, after: first.pageInfo.endCursor}))._unsafeUnwrap();
        expect(next).toMatchObject({status: "ok", edges: [{node: {status: "found", card: {oracle_id: id(1), printing_id: id(2)}}}, {node: {status: "found", card: {oracle_id: id(1)}}}], pageInfo: {hasNextPage: false, hasPreviousPage: true}, metadata: {lookup: {start_index: 2, next_index: 4}}});
        expect(next.edges[1]!.node).toEqual({status: "found", card: {oracle_id: id(1)}});
    } finally { runtime.close(); fixture.dispose(); }
});

test("lookup rejects closed-selector and original-batch incompatibilities before readiness or cursor execution", async () => {
    const fixture = await createLookupFixture({ready: false});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        for (const select of [{}, {name: false}, {name: "true"}, {cmc: true}, {name: true, extra: true}]) {
            const error = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select}))._unsafeUnwrapErr().envelope;
            expect(error).toMatchObject({status: "error", edges: [], error: {code: "invalid_request", retryable: false}});
            expect(error).not.toHaveProperty("pageInfo");
            expect(error.error).not.toHaveProperty("cursor");
        }
        const invalid = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}, {kind: "printing_id", value: id(2)}], select: {set: true}, after: "malformed"}))._unsafeUnwrapErr().envelope;
        expect(invalid.error).toMatchObject({code: "invalid_request", issues: [{path: ["select", "set"], code: "incompatible_reference_kind", field: "set", reference_indices: [0]}]});
        const unready = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select: {name: true}}))._unsafeUnwrapErr().envelope;
        expect(unready.error).toMatchObject({code: "reference_data_unready", missing_datasets: ["oracle_cards", "all_cards"], reimport_required_datasets: [], message: expect.stringContaining("bun run sync:scryfall")});
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup preserves top-level null and all existing ordered face facts, without inventing ordinary faces", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "Bala Ged Recovery // Bala Ged Sanctuary"}, {kind: "name", value: "Sol Ring"}];
        const text = (await runtime.handlers.lookupCards({references, select: {oracle_text: true, colors: true, color_identity: true, color_indicator: true, produced_mana: true, power: true, keywords: true, legalities: true, tags: true}}))._unsafeUnwrap();
        expect(text.edges[0]!.node).toMatchObject({status: "found", card: {oracle_text: null, colors: null, color_identity: ["G"], color_indicator: null, produced_mana: ["G"], power: null, keywords: [], card_faces: [{name: "Bala Ged Recovery", oracle_text: "Return target card from your graveyard to your hand."}, {name: "Bala Ged Sanctuary", oracle_text: "This land enters tapped.\n{T}: Add {G}."}]}, unavailable_fields: {tags: "dataset_not_imported"}});
        if (text.edges[1]!.node.status !== "found") throw new Error("Expected Sol Ring");
        expect(text.edges[1]!.node.card).not.toHaveProperty("card_faces");
        expect(text.edges[1]!.node.card).toMatchObject({colors: [], oracle_text: "{T}: Add {C}{C}.", legalities: {commander: "legal", vintage: "restricted", legacy: "banned"}});
        const full = (await runtime.handlers.lookupCards({references, select: {card_faces: true, oracle_text: true}}))._unsafeUnwrap();
        expect(full.edges[0]!.node).toMatchObject({card: {card_faces: [{name: "Bala Ged Recovery", mana_cost: "{2}{G}", type_line: "Sorcery", colors: ["G"], color_indicator: null, power: null, toughness: null, loyalty: null, defense: null}, {name: "Bala Ged Sanctuary", mana_cost: "", type_line: "Land", colors: [], color_indicator: null, power: null, toughness: null, loyalty: null, defense: null}]}});
        expect(full.edges[1]!.node).toMatchObject({card: {card_faces: []}});
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup returns complete direct/inherited tag facts and exact Printing facts", async () => {
    const fixture = await createLookupFixture({tags: true});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const result = (await runtime.handlers.lookupCards({references: [{kind: "printing_id", value: id(2)}], select: {name: true, tags: true, set: true, set_id: true, set_name: true, set_type: true, collector_number: true, lang: true, printed_name: true, finishes: true, promo_types: true, tcgplayer_id: true, cardmarket_id: true, printing_layout: true}, include_provenance: true}))._unsafeUnwrap();
        expect(result.edges[0]!.node).toMatchObject({status: "found", card: {oracle_id: id(1), printing_id: id(2), name: "Sol Ring", set: "v10", set_name: "From the Vault: Relics", set_type: "from_the_vault", collector_number: "12", lang: "en", printed_name: null, finishes: ["foil"], promo_types: [], printing_layout: "standard", tags: {direct: [{slug: "mana-rock", weight: "strong", annotation: null}, {slug: "resource", weight: "weak", annotation: "Synthetic direct preference"}], inherited: [{slug: "mana", weight: "strong"}]}}});
        expect(result.provenance!.reference_imports.map((entry) => entry.dataset)).toEqual(["oracle_cards", "all_cards", "oracle_tags"]);
        const empty = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Little Girl"}], select: {tags: true}}))._unsafeUnwrap();
        expect(empty.edges[0]!.node).toMatchObject({card: {tags: {direct: [], inherited: []}}});
        expect(empty).not.toHaveProperty("provenance");
        expect(empty).not.toHaveProperty("collection_context");
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup zero-first does not consume occurrences and exact names do not match face names or casing", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "sol ring"}, {kind: "name", value: "Bala Ged Recovery"}];
        const zero = (await runtime.handlers.lookupCards({references, select: {name: true}, first: 0}))._unsafeUnwrap();
        expect(zero).toMatchObject({edges: [], pageInfo: {startCursor: null, endCursor: null, hasNextPage: true, hasPreviousPage: false}, metadata: {lookup: {next_index: 0}}});
        const first = (await runtime.handlers.lookupCards({references, select: {name: true}, first: 1}))._unsafeUnwrap();
        const last = (await runtime.handlers.lookupCards({references, select: {name: true}, after: first.pageInfo.endCursor}))._unsafeUnwrap();
        expect(first.edges[0]!.node).toMatchObject({status: "not_found", reference: references[0]});
        expect(last.edges[0]!.node).toMatchObject({status: "not_found", reference: references[1]});
        const end = (await runtime.handlers.lookupCards({references, select: {oracle_id: true}, first: 0, after: last.pageInfo.endCursor}))._unsafeUnwrap();
        expect(end).toMatchObject({edges: [], pageInfo: {startCursor: null, endCursor: null, hasNextPage: false, hasPreviousPage: true}, stop_reason: "source_exhausted"});
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup binds fixed inputs and relevant successful imports, including first introduced optional absence", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "Sol Ring"}, {kind: "oracle_id", value: id(1)}];
        const args = {references, select: {name: true}, first: 1};
        const page = (await runtime.handlers.lookupCards(args))._unsafeUnwrap();
        const after = page.pageInfo.endCursor;
        for (const request of [{...args, references: [...references].reverse(), after}, {...args, include_provenance: true, after}, {...args, after: "broken"}, {...args, after: Buffer.from('{"version":99}').toString("base64url")}]) {
            expect((await runtime.handlers.lookupCards(request))._unsafeUnwrapErr().envelope.error.code).toBe("invalid_cursor");
        }
        await fixture.recordFailedImport();
        expect((await runtime.handlers.lookupCards({...args, after})).isOk()).toBe(true);
        const optional = (await runtime.handlers.lookupCards({...args, select: {tags: true}, after}))._unsafeUnwrap();
        expect(optional.edges[0]!.node).toMatchObject({unavailable_fields: {tags: "dataset_not_imported"}});
        await fixture.reimportTags();
        expect((await runtime.handlers.lookupCards({...args, after})).isOk()).toBe(true);
        const staleTags = (await runtime.handlers.lookupCards({...args, after: optional.pageInfo.endCursor}))._unsafeUnwrapErr().envelope;
        expect(staleTags.error).toMatchObject({code: "stale_cursor", reason: "reference_import_changed", recovery: "restart"});
        expect(staleTags.error).not.toHaveProperty("cursor");
        await fixture.reimportOracle();
        expect((await runtime.handlers.lookupCards({...args, after}))._unsafeUnwrapErr().envelope.error.code).toBe("stale_cursor");
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup splits complete escaped UTF-8 outcomes and resumes every occurrence without loss or replay", async () => {
    const annotation = 'Synthetic annotation: Æ 🧙 "quoted" \\ newline\n'.repeat(65);
    const fixture = await createLookupFixture({tags: true, tagAnnotation: annotation});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {responseBudgetBytes: 7_500}});
    try {
        const references = [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Missing — 🧙"}, {kind: "name", value: "Sol Ring"}, {kind: "oracle_id", value: id(1)}];
        const nodes = [];
        let after: string | undefined;
        const starts = [];
        for (let pageNumber = 0; pageNumber < 5; pageNumber++) {
            const page = (await runtime.handlers.lookupCards({references, select: {tags: true}, ...(after ? {after} : {})}))._unsafeUnwrap();
            expect(Buffer.byteLength(JSON.stringify(page), "utf8")).toBeLessThanOrEqual(7_500);
            starts.push(page.metadata.lookup!.start_index);
            for (const edge of page.edges) if (edge.node.status === "found") expect((edge.node.card.tags as any).direct[1].annotation).toBe(annotation);
            nodes.push(...page.edges.map((edge) => edge.node));
            if (!page.pageInfo.hasNextPage) break;
            expect(page.stop_reason).toBe("response_budget");
            after = page.pageInfo.endCursor!;
        }
        expect(starts).toEqual([0, 2, 3]);
        expect(nodes.map((node) => node.status)).toEqual(["found", "not_found", "found", "found"]);
    } finally {runtime.close(); fixture.dispose();}
});

test("oversized selected content returns an intact structured error and safe recovery before that occurrence", async () => {
    const fixture = await createLookupFixture({tags: true, tagAnnotation: 'Synthetic "🧙"\n'.repeat(8_000)});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "Missing"}, {kind: "name", value: "Sol Ring"}, {kind: "name", value: "Sol Ring"}];
        const failed = (await runtime.handlers.lookupCards({references, select: {tags: true}}))._unsafeUnwrapErr().envelope;
        expect(failed).toMatchObject({status: "error", edges: [{node: {status: "not_found", reference: references[0]}}], error: {code: "record_too_large", retryable: false, limit_bytes: 51_200}, metadata: {lookup: {next_index: 1}}});
        expect(failed.error.required_bytes!).toBeGreaterThan(51_200);
        expect(failed.error.message).not.toMatch(/narrow|summary|fields/i);
        expect(failed).not.toHaveProperty("pageInfo");
        expect(Buffer.byteLength(JSON.stringify(failed), "utf8")).toBeLessThanOrEqual(51_200);
        const recovered = (await runtime.handlers.lookupCards({references, select: {oracle_id: true}, after: failed.error.cursor}))._unsafeUnwrap();
        expect(recovered.edges).toHaveLength(2);
        expect(recovered.metadata.lookup).toMatchObject({start_index: 1, next_index: 3});
    } finally {runtime.close(); fixture.dispose();}
});

test("cursor preflight rejects oversized self-contained bindings without a recovery token", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const failed = (await runtime.handlers.lookupCards({references: [{kind: "name", value: 'Unresolved "🧙" '.repeat(8_000)}], select: {oracle_id: true}}))._unsafeUnwrapErr().envelope;
        expect(failed).toMatchObject({edges: [], error: {code: "cursor_too_large", retryable: false, limit_bytes: 51_200}});
        expect(failed.error).not.toHaveProperty("cursor");
        expect(Buffer.byteLength(JSON.stringify(failed), "utf8")).toBeLessThanOrEqual(51_200);
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup deadline and cooperative cancellation retain complete progress and safe ordinary-call recovery", async () => {
    const fixture = await createLookupFixture();
    const references = [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Little Girl"}, {kind: "name", value: "Missing"}];
    let ticks = 0;
    const timeout = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {now: () => ++ticks < 4 ? 0 : 120_000}});
    const normal = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const failed = (await timeout.handlers.lookupCards({references, select: {name: true}}))._unsafeUnwrapErr().envelope;
        expect(failed).toMatchObject({status: "error", edges: [{node: {status: "found", card: {name: "Sol Ring"}}}], error: {code: "scan_timeout", retryable: true}, metadata: {lookup: {next_index: 1}}});
        const recovered = (await normal.handlers.lookupCards({references, select: {name: true}, after: failed.error.cursor}))._unsafeUnwrap();
        expect(recovered.edges.map((edge) => edge.node.status)).toEqual(["found", "not_found"]);
        expect(recovered.metadata.lookup!.start_index).toBe(1);
        const controller = new AbortController(); controller.abort();
        const cancelled = (await normal.handlers.lookupCards({references, select: {name: true}}, controller.signal))._unsafeUnwrapErr().envelope;
        expect(cancelled).toMatchObject({edges: [], error: {code: "cancelled", retryable: true}, metadata: {lookup: {next_index: 0}}});
        expect((await normal.handlers.lookupCards({references, select: {name: true}, after: cancelled.error.cursor}))._unsafeUnwrap().edges).toHaveLength(3);
    } finally {timeout.close(); normal.close(); fixture.dispose();}
});

test("lookup accepts an exact whole-envelope byte boundary and rejects one byte less without clipping", async () => {
    const fixture = await createLookupFixture({tags: true});
    const args = {references: [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Sol Ring"}], select: {tags: true}, first: 1};
    const normal = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const page = (await normal.handlers.lookupCards(args))._unsafeUnwrap();
        let exactBytes = Buffer.byteLength(JSON.stringify(page));
        for (let iteration = 0; iteration < 3; iteration++) exactBytes = Buffer.byteLength(JSON.stringify({...page, metadata: {...page.metadata, response_budget_bytes: exactBytes}}));
        const exact = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {responseBudgetBytes: exactBytes}});
        const short = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log, lookup: {responseBudgetBytes: exactBytes - 1}});
        try {
            const fitting = (await exact.handlers.lookupCards(args))._unsafeUnwrap();
            expect(Buffer.byteLength(JSON.stringify(fitting))).toBe(exactBytes);
            const rejected = (await short.handlers.lookupCards(args))._unsafeUnwrapErr().envelope;
            expect(rejected.error.code).toBe("record_too_large");
            expect(rejected.metadata.lookup!.next_index).toBe(0);
            expect(rejected.edges).toEqual([]);
            expect(Buffer.byteLength(JSON.stringify(rejected))).toBeLessThanOrEqual(exactBytes - 1);
        } finally {exact.close(); short.close();}
    } finally {normal.close(); fixture.dispose();}
});

test("lookup distinguishes incompatible core snapshots from optional incompatible tag enrichment", async () => {
    for (const dataset of ["oracle_cards", "all_cards", "oracle_tags"] as const) {
        const fixture = await createLookupFixture({tags: true, incompatible: dataset});
        const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
        try {
            const result = await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select: {name: true, tags: true}});
            if (dataset === "oracle_tags") expect(result._unsafeUnwrap().edges[0]!.node).toMatchObject({status: "found", card: {name: "Sol Ring"}, unavailable_fields: {tags: "dataset_incompatible"}});
            else expect(result._unsafeUnwrapErr().envelope.error).toMatchObject({code: "reference_data_unready", missing_datasets: [], reimport_required_datasets: [dataset]});
        } finally {runtime.close(); fixture.dispose();}
    }
});
