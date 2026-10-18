import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolResultDetails} from "@tomekin/core";
import {createCollectionFixture} from "./fixtures/collection";
import {id, log} from "./fixtures/lookup";

const card = (printing = id(2), oracle = id(1)) => ({object: "card", id: printing, oracle_id: oracle, name: "Sol Ring", layout: "normal", set: "representative"});
const envelope = (r: unknown): any => agentToolResultDetails(r as any);

test("search and lookup return exact same-row policy summaries and selected actual owned Printing evidence", async () => {
    const f = await createCollectionFixture();
    const requests: string[] = [];
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch(url) {requests.push(url); return {status: 200, body: {object: "list", data: [card(id(998))], has_more: false, total_cards: 1}};}}}});
    try {
        const common = {select: {name: true, set: true}, collection_policy: {kind: "explicit", policy: f.policy}, collection_evidence: {mode: "copies", select: {location: true, finish: true, set: true}}};
        const result = envelope(await runtime.handlers.searchCards({q: "  unique:cards f:commander  ", ...common}));
        expect(result).toMatchObject({status: "ok", collection_context: {state: "ready", collection_import_id: f.imported.id, match: "identity"}, edges: [{node: {card: {set: "representative"}, collection_evidence: {summary: {owned_quantity: 6, eligible_quantity: 2, uncertain_quantity: 0, policy_status: "confirmed"}, copies: [{collection_card_id: id(111), printing_id: id(2), quantity: 2, set: "v10", finish: "nonfoil", location: {id: id(100), type: "binder", name: "Shared"}}]}}}]});
        expect(result.edges[0].node.collection_evidence.copies).toHaveLength(1);
        expect(new URL(requests[0]!).searchParams.get("q")).toBe("  unique:cards f:commander  ");
        expect(requests[0]).not.toContain(f.imported.id);
        const lookup = envelope(await runtime.handlers.lookupCards({...common, select: {name: true}, references: [{kind: "oracle_id", value: id(1)}]}));
        expect(lookup.edges[0].node.collection_evidence).toEqual(result.edges[0].node.collection_evidence);
        const ordinary = envelope(await runtime.handlers.lookupCards({references: [{kind: "oracle_id", value: id(1)}], select: {name: true}}));
        expect(ordinary.collection_context).toBeUndefined();
        expect(ordinary.edges[0].node.collection_evidence).toBeUndefined();
    } finally {runtime.close(); f.dispose();}
});

test("Collection scope uses one actual row conjunction and exact Printing mode never treats a representative as owned", async () => {
    const f = await createCollectionFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data: [card(id(998)), card()], has_more: false}};}}}});
    try {
        const base = {q: 'unique:cards', unique: "prints", select: {oracle_id: true}, collection_policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {}}}, collection_evidence: {mode: "copies", select: {set: true}}, first: 1};
        const identity = envelope(await runtime.handlers.searchCards({...base, collection_scope: {match: "identity"}}));
        expect(identity.edges[0].node.card).toEqual({oracle_id: id(1)});
        expect(identity.edges[0].node.collection_evidence.summary.eligible_quantity).toBe(4);
        const printing = envelope(await runtime.handlers.searchCards({...base, collection_scope: {match: "printing"}}));
        expect(printing.edges).toHaveLength(1);
        expect(printing.pageInfo.hasNextPage).toBe(false);
        expect(printing.edges[0].node.collection_evidence.copies.map((r: any) => r.printing_id)).toEqual([id(2), id(2)]);
        // Foil and a reliable recent date occur together only on the binder row. The undated nonfoil row is not proof.
        const impossible = envelope(await runtime.handlers.searchCards({...base, collection_scope: {copy_requirements: {finish: ["nonfoil"], added_at_from: "2026-10-17T00:00:00Z"}}}));
        expect(impossible.edges).toEqual([]);
        const scopedDeck = envelope(await runtime.handlers.searchCards({...base, collection_scope: {locations: [{type: "deck", name: "Shared"}]}}));
        expect(scopedDeck.edges).toEqual([]);
        const invalid = envelope(await runtime.handlers.lookupCards({references: [{kind: "oracle_id", value: id(1)}], select: {name: true}, collection_scope: {match: "printing"}, collection_policy: base.collection_policy}));
        expect(invalid.error).toMatchObject({code: "invalid_request", reason: "incompatible_reference_kind"});
    } finally {runtime.close(); f.dispose();}
});

test("ownership evidence distinguishes unconfirmed policy, missing Collection, imported empty, and uncertain strict metadata", async () => {
    const f = await createCollectionFixture();
    try {
        const args = {references: [{kind: "oracle_id", value: id(1)}], select: {oracle_id: true}, collection_evidence: {mode: "copies", select: {quantity: true}}};
        const unconfirmed = envelope(await f.runtime.handlers.lookupCards(args));
        expect(unconfirmed).toMatchObject({collection_context: {state: "ready", effective_policy: null}, edges: [{node: {collection_evidence: {summary: {owned_quantity: 6, eligible_quantity: null, uncertain_quantity: null, policy_status: "unconfirmed"}, copies: []}}}]});
        const uncertain = envelope(await f.runtime.handlers.lookupCards({...args, collection_policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {added_at_from: "2026-10-17T00:00:00Z"}}}}));
        expect(uncertain.edges[0].node.collection_evidence).toMatchObject({summary: {owned_quantity: 6, eligible_quantity: 2, uncertain_quantity: 2}, copies: [{collection_card_id: id(110)}]});
        await f.replace([]);
        const empty = envelope(await f.runtime.handlers.lookupCards(args));
        expect(empty).toMatchObject({collection_context: {state: "ready"}, edges: [{node: {collection_evidence: {summary: {owned_quantity: 0}}}}]});
        f.db.$client.prepare("DELETE FROM collection_state").run();
        f.db.$client.prepare("DELETE FROM collection_import").run();
        const missing = envelope(await f.runtime.handlers.lookupCards(args));
        expect(missing).toMatchObject({collection_context: {state: "no_collection", collection_import_id: null}, edges: [{node: {collection_evidence: {summary: {owned_quantity: 0}}}}]});
    } finally {f.dispose();}
});

test("scoped provider scan fills through nonmatches and resumes the raw Printing position without skipping unreturned matches", async () => {
    const f = await createCollectionFixture();
    const requests: string[] = [];
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch(url) {requests.push(url); const u = new URL(url); return {status: 200, body: u.searchParams.has("page") ? {object: "list", data: [card(id(203)), card(id(204), id(999))], has_more: false} : {object: "list", data: [card(id(200), id(999)), card(id(201)), card(id(202), id(999))], has_more: true, next_page: 'https://api.scryfall.com/cards/search?q=f%3Acommander&page=2'}};}}}});
    try {
        const args = {q: "f:commander", select: {printing_id: true}, collection_scope: {}, collection_policy: {kind: "explicit", policy: f.policy}, first: 1};
        const first = envelope(await runtime.handlers.searchCards(args));
        expect(first.edges.map((e: any) => e.node.card.printing_id)).toEqual([id(201)]);
        expect(first.pageInfo.hasNextPage).toBe(true);
        expect(requests).toHaveLength(2);
        const second = envelope(await runtime.handlers.searchCards({...args, after: first.pageInfo.endCursor, select: {oracle_id: true}}));
        expect(second.edges).toHaveLength(1);
        expect(second.pageInfo.hasNextPage).toBe(false);
        expect(second.edges[0].node.card).toEqual({oracle_id: id(1)});
        const zero = envelope(await runtime.handlers.searchCards({...args, first: 0}));
        expect(zero).toMatchObject({edges: [], pageInfo: {hasNextPage: true, endCursor: null}});
    } finally {runtime.close(); f.dispose();}
});

test("complete copy evidence is indivisible and selector changes recover all rows through ordinary lookup and provider anchors", async () => {
    const f = await createCollectionFixture();
    await f.replace(Array.from({length: 140}, (_, n) => ({id: id(1000 + n), quantity: 1, collectionLocationId: id(100), finish: "nonfoil" as const, manaBoxId: null, cardPrintingId: id(2), misprint: false, altered: false, condition: 'Æ🧙 "whole"\n'.repeat(50), purchasePriceCurrency: null, purchasePrice: null, addedAt: null, sourceRowNumber: n + 1})));
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {responseBudgetBytes: 30_000}, search: {responseBudgetBytes: 30_000, provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data: [card()], has_more: false}};}}}});
    try {
        const imported = envelope(await runtime.handlers.listCollectionLocations()).collection_context.collection_import_id;
        const common = {select: {oracle_id: true}, collection_policy: {kind: "explicit", policy: {...f.policy, collection_import_id: imported}}, collection_evidence: {mode: "copies", select: {condition: true}}};
        for (const [handler, input] of [[runtime.handlers.lookupCards, {references: [{kind: "oracle_id", value: id(1)}]}], [runtime.handlers.searchCards, {q: "f:commander"}]] as const) {
            const failed = envelope(await handler({...input, ...common}));
            expect(failed).toMatchObject({edges: [], error: {code: "record_too_large", retryable: false}});
            expect(Buffer.byteLength(JSON.stringify(failed))).toBeLessThanOrEqual(30_000);
            const recovered = envelope(await handler({...input, ...common, after: failed.error.cursor, collection_evidence: {mode: "copies", select: {quantity: true}}}));
            expect(recovered.status).toBe("ok");
            expect(recovered.edges[0].node.collection_evidence.summary).toMatchObject({owned_quantity: 140, eligible_quantity: 140});
            expect(recovered.edges[0].node.collection_evidence.copies).toHaveLength(140);
            expect(new Set(recovered.edges[0].node.collection_evidence.copies.map((r: any) => r.collection_card_id)).size).toBe(140);
        }
    } finally {runtime.close(); f.dispose();}
});

test("dependent cursors bind Collection and policy but ignore failed and unrelated imports", async () => {
    const f = await createCollectionFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data: [card(id(200)), card(id(201))], has_more: false}};}}}});
    try {
        const args = {q: "f:commander", select: {oracle_id: true}, collection_evidence: {mode: "summary"}, first: 1};
        const one = envelope(await runtime.handlers.searchCards(args));
        await f.recordFailedImport(); await f.reimportTags();
        const after = one.pageInfo.endCursor;
        expect(envelope(await runtime.handlers.searchCards({...args, after})).status).toBe("ok");
        expect(envelope(await runtime.handlers.searchCards({...args, after, collection_evidence: {mode: "copies", select: {quantity: true}}})).error.code).toBe("invalid_cursor");
        const fixed = {...args, collection_policy: {kind: "explicit", policy: f.policy}};
        const bound = envelope(await runtime.handlers.searchCards(fixed));
        expect(envelope(await runtime.handlers.searchCards({...fixed, after: bound.pageInfo.endCursor, collection_policy: {kind: "explicit", policy: {...f.policy, allowed_locations: []}}})).error.code).toBe("invalid_cursor");
        await f.replace();
        const stale = envelope(await runtime.handlers.searchCards({...args, after}));
        expect(stale).toMatchObject({edges: [], error: {code: "stale_cursor", reason: "collection_import_changed", recovery: "reconfirm_scope"}});
        expect(stale.error.cursor).toBeUndefined();
    } finally {runtime.close(); f.dispose();}
});

test("a Collection replacement during provider work discards dependent results and a pure live query stays independent", async () => {
    const f = await createCollectionFixture();
    let started!: () => void, release!: () => void;
    const pending = new Promise<void>(resolve => {started = resolve;});
    const gate = new Promise<void>(resolve => {release = resolve;});
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch() {started(); await gate; return {status: 200, body: {object: "list", data: [card()], has_more: false}};}}}});
    try {
        const result = runtime.handlers.searchCards({q: "f:commander", select: {oracle_id: true}, collection_evidence: {mode: "summary"}});
        await pending; await f.replace([]); release();
        const stale = envelope(await result);
        expect(stale).toMatchObject({edges: [], error: {code: "stale_cursor", reason: "collection_import_changed"}});
        expect(stale.error.cursor).toBeUndefined();
        expect(envelope(await runtime.handlers.searchCards({q: "f:commander", select: {oracle_id: true}})).status).toBe("ok");
    } finally {release(); runtime.close(); f.dispose();}
});

test("candidate Brief policy changes stale evidence while unrelated label edits preserve continuation", async () => {
    const f = await createCollectionFixture();
    try {
        const created = (await f.runtime.handlers.createDeckCandidate({label: "Owned shortlist", brief: {goal: "Explore", format: "casual_60", powerLevel: null, collectionAccessPolicy: f.policy}}))._unsafeUnwrap();
        const args = {references: [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Sol Ring"}], select: {name: true}, collection_policy: {kind: "candidate", candidate_id: created.candidate_id}, collection_evidence: {mode: "summary"}, first: 1};
        const first = envelope(await f.runtime.handlers.lookupCards(args));
        const edit = (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: created.updated_at, changes: {label: "Rename"}}))._unsafeUnwrap();
        expect(envelope(await f.runtime.handlers.lookupCards({...args, after: first.pageInfo.endCursor})).status).toBe("ok");
        (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: edit.updated_at, changes: {brief: {collectionAccessPolicy: {...f.policy, allowed_locations: []}}}}))._unsafeUnwrap();
        expect(envelope(await f.runtime.handlers.lookupCards({...args, after: first.pageInfo.endCursor}))).toMatchObject({edges: [], error: {code: "stale_cursor", reason: "candidate_policy_changed", recovery: "reconfirm_scope"}});
    } finally {f.dispose();}
});

test("unfinished local copy evaluation emits no partial quantities and deadline recovery does not consume its card", async () => {
    const f = await createCollectionFixture();
    let clock = 0;
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {now: () => {clock += 1; return clock;}, scanDeadlineMs: 8}});
    try {
        const args = {references: [{kind: "name", value: "Sol Ring"}], select: {oracle_id: true}, collection_evidence: {mode: "summary"}};
        const failed = envelope(await runtime.handlers.lookupCards(args));
        expect(failed).toMatchObject({edges: [], error: {code: "scan_timeout"}});
        const recovered = envelope(await f.runtime.handlers.lookupCards({...args, after: failed.error.cursor}));
        expect(recovered).toMatchObject({status: "ok", edges: [{node: {collection_evidence: {summary: {owned_quantity: 6}}}}]});
    } finally {runtime.close(); f.dispose();}
});

test("same-tick successful reference replacement stales search and lookup evidence independent of UUID lexical order", async () => {
    const f = await createCollectionFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data: [card(), card(id(201))], has_more: false}};}}}});
    try {
        const common = {select: {oracle_id: true}, collection_evidence: {mode: "summary"}, first: 1};
        const lookupInput = {references: [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Sol Ring"}], ...common};
        const searchInput = {q: "f:commander", ...common};
        const lookup = envelope(await runtime.handlers.lookupCards(lookupInput));
        const search = envelope(await runtime.handlers.searchCards(searchInput));
        const old = f.db.$client.prepare("SELECT id, started_at, completed_at FROM scryfall_bulk_data_import WHERE bulk_data_type = 'oracle_cards' AND status = 'succeeded' ORDER BY rowid DESC LIMIT 1").get() as {id: string; started_at: number; completed_at: number};
        await f.reimportOracle();
        // Synthetic same-tick successful replacement with a UUID below the prior import. Row order remains authoritative.
        f.db.$client.prepare("UPDATE scryfall_bulk_data_import SET id = ?, started_at = ?, completed_at = ? WHERE bulk_data_type = 'oracle_cards' AND id != ?").run(id(0), old.started_at, old.completed_at, old.id);
        for (const [handler, args, after] of [[runtime.handlers.lookupCards, lookupInput, lookup.pageInfo.endCursor], [runtime.handlers.searchCards, searchInput, search.pageInfo.endCursor]] as const) expect(envelope(await handler({...args, after}))).toMatchObject({edges: [], error: {code: "stale_cursor", reason: "reference_import_changed", recovery: "restart"}});
    } finally {runtime.close(); f.dispose();}
});

test("exact UUID locations and permitted deck borrowing stay inspectable; legacy snapshots require explicit reimport", async () => {
    const f = await createCollectionFixture();
    try {
        const args = {references: [{kind: "printing_id", value: id(2)}], select: {oracle_id: true}, collection_scope: {locations: [{id: id(101)}]}, collection_policy: {kind: "explicit", policy: {...f.policy, allowed_locations: [{type: "deck", name: "Shared"}], copy_requirements: {}}}, collection_evidence: {mode: "copies", select: {quantity: true}}};
        const result = envelope(await f.runtime.handlers.lookupCards(args));
        expect(result.edges[0].node.collection_evidence).toMatchObject({summary: {owned_quantity: 2, eligible_quantity: 2}, copies: [{collection_card_id: id(112), committed: true, location: {id: id(101), type: "deck", name: "Shared"}}]});
        f.db.$client.prepare("DELETE FROM collection_state").run();
        const legacy = envelope(await f.runtime.handlers.lookupCards({references: args.references, select: args.select, collection_evidence: {mode: "summary"}}));
        expect(legacy).toMatchObject({edges: [], error: {code: "reference_data_unready", reason: "collection_reimport_required"}, collection_context: {state: "reimport_required", collection_import_id: null}});
    } finally {f.dispose();}
});

test("copy selectors, scope validation and mandatory Collection context budget fail explicitly before provider work", async () => {
    const f = await createCollectionFixture();
    let dispatched = 0;
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {responseBudgetBytes: 500, provider: {id: "fixture", async dispatch() {dispatched++; return {status: 200, body: {object: "list", data: [], has_more: false}};}}}});
    try {
        const base = {q: "f:commander", select: {oracle_id: true}, collection_policy: {kind: "explicit", policy: f.policy}, collection_evidence: {mode: "summary"}};
        expect(envelope(await runtime.handlers.searchCards(base))).toMatchObject({edges: [], error: {code: "response_budget_too_small"}});
        expect(dispatched).toBe(0);
        const input = {references: [{kind: "name", value: "Sol Ring"}], select: {oracle_id: true}};
        for (const select of [{}, {finish: false}, {finish: "true"}, {oracle_id: true}, {date_reliability: true}, {extra: true}]) expect(envelope(await f.runtime.handlers.lookupCards({...input, collection_evidence: {mode: "copies", select}})).error.code).toBe("invalid_request");
        for (const locations of [[{name: "Shared"}], [{type: "binder", name: "shared"}], [{id: id(999)}]]) expect(envelope(await f.runtime.handlers.lookupCards({...input, collection_scope: {locations}, collection_policy: base.collection_policy})).error.code).toBe("invalid_request");
        const provenance = envelope(await f.runtime.handlers.lookupCards({...input, collection_evidence: {mode: "summary"}, include_provenance: true}));
        expect(provenance.provenance.collection_import).toMatchObject({import_id: f.imported.id, imported_at: "2026-10-18T01:00:00.000Z"});
    } finally {runtime.close(); f.dispose();}
});

test("unsafe aggregate quantities and incidental exact-Printing identity conflicts cannot become exact ownership claims", async () => {
    const f = await createCollectionFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider: {id: "fixture", async dispatch() {return {status: 200, body: {object: "list", data: [card(id(2), id(999))], has_more: false}};}}}});
    try {
        const conflict = envelope(await runtime.handlers.searchCards({q: "fixture", select: {oracle_id: true}, collection_scope: {match: "printing"}, collection_policy: {kind: "explicit", policy: f.policy}, collection_evidence: {mode: "summary"}}));
        expect(conflict).toMatchObject({edges: [], error: {code: "local_error", reason: "reference_identity_disagreement"}});
        f.db.$client.prepare("UPDATE collection_card SET quantity = ?").run(Number.MAX_SAFE_INTEGER);
        const unsafe = envelope(await f.runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select: {oracle_id: true}, collection_evidence: {mode: "summary"}}));
        expect(unsafe).toMatchObject({edges: [], error: {code: "local_error", reason: "unsafe_quantity"}});
    } finally {runtime.close(); f.dispose();}
});
