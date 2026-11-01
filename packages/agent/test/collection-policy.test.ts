import {createCollectionFixture as collectionFixture} from "./fixtures/collection";
import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {closeDatabase, openDatabase, createSqliteCollectionRepository} from "@tomekin/sqlite";
import {createLookupFixture, id, log} from "./fixtures/lookup";


test("bounded Collection browse enforces confirmed same-row policy before bounds and exposes undated coverage", async () => {
    const f = await collectionFixture();
    try {
        const page = (await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: f.policy}, select: {quantity: true, location: true, added_at: true}, first: 1}))._unsafeUnwrap();
        expect(page).toMatchObject({status: "ok", edges: [{node: {collection_card_id: id(111), oracle_id: id(1), printing_id: id(2), quantity: 2, added_at: null, location: {id: id(100), type: "binder", name: "Shared"}}}], next_cursor: null, collection_context: {state: "ready", collection_import_id: f.imported.id, effective_policy: {allowed_locations: [{id: id(100), type: "binder", name: "Shared"}]}}, date_coverage: {undated: "present"}});
    } finally {f.dispose();}
});

test("UTC half-open source chronology retains milliseconds, nulls last in both directions and no import-date inference", async () => {
    const f = await collectionFixture();
    try {
        const policy = {...f.policy, allowed_locations: [{type: "binder", name: "Shared"}, {type: "deck", name: "Shared"}], copy_requirements: {}};
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy}, select: {added_at: true, date_reliability: true}, order: "added_at_asc"};
        const bounded = (await f.runtime.handlers.browseCollectionCards({...args, added_at_from: "2026-10-17T00:00:00.125Z", added_at_before: "2026-10-17T00:00:00.126Z"}))._unsafeUnwrap();
        expect(bounded.edges.map(e => e.node.collection_card_id)).toEqual([id(110)]);
        expect(bounded.edges[0]!.node.added_at).toBe("2026-10-17T00:00:00.125Z");
        expect(bounded.date_coverage).toMatchObject({undated: "present", completion: "complete"});
        const asc = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        const desc = (await f.runtime.handlers.browseCollectionCards({...args, order: "added_at_desc"}))._unsafeUnwrap();
        expect(asc.edges.map(e => e.node.collection_card_id)).toEqual([id(110), id(112), id(111)]);
        expect(desc.edges.map(e => e.node.collection_card_id)).toEqual([id(112), id(110), id(111)]);
        const unknown = (await f.runtime.handlers.browseCollectionCards({...args, date_state: "unknown"}))._unsafeUnwrap();
        expect(unknown.edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        expect(asc.edges.find(e => e.node.collection_card_id === id(112))!.node).toMatchObject({committed: true, location: {type: "deck", name: "Shared"}});
    } finally {f.dispose();}
});

test("exact policy references reject stale UUIDs, name collisions, conflicts, unsupported predicates and invalid calendars", async () => {
    const f = await collectionFixture();
    try {
        const base = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: f.policy}, select: {quantity: true}};
        const policies = [
            {...f.policy, allowed_locations: [{name: "Shared"}]},
            {...f.policy, allowed_locations: [{id: id(101), type: "binder", name: "Shared"}]},
            {...f.policy, allowed_locations: [{type: "binder", name: "shared"}]},
            {...f.policy, protected_locations: [{type: "binder", name: "Shared"}]},
            {...f.policy, excluded_collection_card_ids: [id(999)]},
            {...f.policy, copy_requirements: {finish: {not: "foil"}}},
            {...f.policy, copy_requirements: {purchase_price: {currency: "AUD", min: 5, max: 4}}},
        ];
        for (const policy of policies) expect((await f.runtime.handlers.browseCollectionCards({...base, policy: {kind: "explicit", policy}}))._unsafeUnwrapErr().envelope.error.code).toBe("invalid_request");
        for (const dates of [{added_at_from: "2026-02-30T00:00:00Z"}, {added_at_from: "2026-10-17"}, {added_at_from: "2026-10-17T00:00:00+10:00"}, {date_state: "unknown", added_at_from: "2026-10-17T00:00:00Z"}, {added_at_from: "2026-10-18T00:00:00Z", added_at_before: "2026-10-17T00:00:00Z"}]) expect((await f.runtime.handlers.browseCollectionCards({...base, ...dates}))._unsafeUnwrapErr().envelope.error.code).toBe("invalid_request");
        const empty = (await f.runtime.handlers.browseCollectionCards({...base, policy: {kind: "explicit", policy: {...f.policy, allowed_locations: []}}}))._unsafeUnwrap();
        expect(empty.edges).toEqual([]);
        expect(empty.collection_context).toMatchObject({state: "ready", policy_status: "confirmed", effective_policy: {allowed_locations: []}});
    } finally {f.dispose();}
});

test("known-card narrowing and conjunctive copy requirements use actual owned Printing and never unknown metadata as proof", async () => {
    const f = await collectionFixture();
    try {
        const policy = {...f.policy, copy_requirements: {}};
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy}, select: {set: true, lang: true, finish: true}, first: 1};
        const printing = (await f.runtime.handlers.browseCollectionCards({...args, copy_requirements: {set_codes: ["v10"], languages: ["en"], printing_ids: [id(2)], finish: ["foil"]}}))._unsafeUnwrap();
        expect(printing.edges).toHaveLength(1);
        expect(printing.edges[0]!.node).toMatchObject({collection_card_id: id(110), set: "v10", lang: "en", finish: "foil"});
        for (const restriction of [{set_codes: ["fic"]}, {languages: ["de"]}, {condition: ["mint"]}, {purchase_price: {currency: "AUD", max: 10}}, {printing_ids: [id(333)]}]) expect((await f.runtime.handlers.browseCollectionCards({...args, copy_requirements: restriction}))._unsafeUnwrap().edges).toEqual([]);
        const denied = (await f.runtime.handlers.browseCollectionCards({...args, policy: {kind: "explicit", policy: {...policy, excluded_printing_ids: [id(2)]}}}))._unsafeUnwrap();
        expect(denied.edges).toEqual([]);
        expect((await f.runtime.handlers.browseCollectionCards({...args, oracle_ids: [id(999)]}))._unsafeUnwrap().edges).toEqual([]);
    } finally {f.dispose();}
});

test("continuation permits selector/count changes without local loss or replay and binds successful snapshot replacements", async () => {
    const f = await collectionFixture();
    try {
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {}}}, select: {quantity: true}, first: 1};
        const zero = (await f.runtime.handlers.browseCollectionCards({...args, first: 0}))._unsafeUnwrap();
        expect(structuredClone(zero)).toMatchObject({edges: [], next_cursor: expect.any(String)});
        const one = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        expect(one.edges.map(e => e.node.collection_card_id)).toEqual([id(110)]);
        expect(Boolean(one.next_cursor)).toBe(true);
        const after = one.next_cursor;
        await f.repository.recordFailedCollectionImport({sourcePath: "failed", importedAt: new Date("2027-01-01T00:00:00Z"), warnings: [], errors: ["synthetic"]});
        const two = (await f.runtime.handlers.browseCollectionCards({...args, after, select: {location: true}, first: 100}))._unsafeUnwrap();
        expect(two.edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        expect(two.next_cursor).toBeNull();
        expect((await f.runtime.handlers.browseCollectionCards({...args, after, order: "added_at_desc"}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "invalid_cursor", reason: "scope_mismatch"});
        const newer = await f.replace(undefined, new Date("2026-10-17T01:00:00Z"));
        // A later replacement with an earlier start time is authoritative.
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({collection_context: {collection_import_id: newer.id}});
        expect((await f.runtime.handlers.browseCollectionCards({...args, after}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "stale_cursor", reason: "collection_import_changed", recovery: "reconfirm_scope"});
        expect((await f.runtime.handlers.browseCollectionCards({...args, collection_import_id: newer.id}))._unsafeUnwrapErr().envelope.error.reason).toBe("collection_import_changed");
    } finally {f.dispose();}
});

test("candidate-owned Brief policy stays inspectable and changes invalidate continuation without unrelated edit invalidation", async () => {
    const f = await collectionFixture();
    try {
        const created = (await f.runtime.handlers.createDeckCandidate({label: "Provisional policy", brief: {goal: "Explore recent cards", format: "casual_60", powerLevel: null, collectionAccessPolicy: {...f.policy, copy_requirements: {}}}}))._unsafeUnwrap();
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "candidate", candidate_id: created.candidate_id}, select: {quantity: true}, first: 1};
        const page = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        expect(page.collection_context.effective_policy).toMatchObject({allowed_locations: [{id: id(100), type: "binder", name: "Shared"}]});
        const edited = (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: created.updated_at, changes: {label: "Renamed"}}))._unsafeUnwrap();
        expect((await f.runtime.handlers.browseCollectionCards({...args, after: page.next_cursor})).isOk()).toBe(true);
        (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: edited.updated_at, changes: {brief: {collectionAccessPolicy: {...f.policy, allowed_locations: []}}}}))._unsafeUnwrap();
        expect((await f.runtime.handlers.browseCollectionCards({...args, after: page.next_cursor}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "stale_cursor", reason: "candidate_policy_changed"});
        const unconfirmed = (await f.runtime.handlers.createDeckCandidate({label: "No permission", brief: {goal: "Explore", format: "casual_60", powerLevel: null}}))._unsafeUnwrap();
        expect((await f.runtime.handlers.browseCollectionCards({...args, policy: {kind: "candidate", candidate_id: unconfirmed.candidate_id}}))._unsafeUnwrapErr().envelope).toMatchObject({error: {reason: "unconfirmed_policy"}, collection_context: {policy_id: null, policy_status: "unconfirmed"}});
    } finally {f.dispose();}
});

test("contradictory date selectors across row criteria reject instead of hiding an impossible request", async () => {
    const f = await collectionFixture();
    try {
        const result = await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: f.policy}, select: {added_at: true}, date_state: "unknown", copy_requirements: {added_at_from: "2026-10-17T00:00:00Z"}});
        expect(result._unsafeUnwrapErr().envelope.error.code).toBe("invalid_request");
    } finally {f.dispose();}
});

test("importer accepts only reliable calendar instants, normalizes explicit offsets and preserves subsecond source precision", async () => {
    const f = await collectionFixture();
    try {
        const {createCollectionImportServices} = await import("@tomekin/core");
        const service = createCollectionImportServices(f.repository, {now: () => new Date("2026-10-18T00:00:00Z")});
        const headers = ["Binder Name", "Binder Type", "Name", "Set code", "Collector number", "Foil", "Quantity", "ManaBox ID", "Scryfall ID", "Purchase price", "Misprint", "Altered", "Condition", "Language", "Purchase price currency", "Added"];
        const dates = ["2026-10-17T11:00:00.125+11:00", "2026-02-30T00:00:00Z", "2026-10-17T11:00:00", "10/17/2026", "2024-02-29T00:00:00Z", "2026-10-17T00:00:00.1234Z", ""];
        const csv = [headers.join(","), ...dates.map((date, index) => ["Shared", "binder", "Sol Ring", "v10", "12", "foil", "1", String(index), id(2), "", "false", "false", "", "en", "", date].join(","))].join("\n");
        const imported = (await service.importManaBoxCollectionCsv({sourcePath: "dates.csv", csvText: csv}))._unsafeUnwrap();
        expect(imported.warningCount).toBe(4);
        const page = (await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: imported.id, policy: {kind: "explicit", policy: {...f.policy, collection_import_id: imported.id, copy_requirements: {}}}, select: {added_at: true}, order: "source_order"}))._unsafeUnwrap();
        expect(page.edges.map(e => e.node.added_at)).toEqual(["2026-10-17T00:00:00.125Z", null, null, null, "2024-02-29T00:00:00.000Z", null, null]);
        const noDates = headers.filter(header => header !== "Added").join(",") + "\n";
        const empty = (await service.importManaBoxCollectionCsv({sourcePath: "empty.csv", csvText: noDates}))._unsafeUnwrap();
        expect(empty.importedRowCount).toBe(0);
        const importedEmpty = (await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: empty.id, policy: {kind: "explicit", policy: {...f.policy, collection_import_id: empty.id, allowed_locations: [], copy_requirements: {}}}, select: {quantity: true}}))._unsafeUnwrap();
        expect(importedEmpty).toMatchObject({edges: [], collection_context: {state: "ready", collection_import_id: empty.id}, date_coverage: {undated: "absent", completion: "complete"}});
    } finally {f.dispose();}
});

test("source date uncertainty stays discoverable under strict date eligibility without becoming positive proof", async () => {
    const f = await collectionFixture();
    try {
        const policy = {...f.policy, copy_requirements: {added_at_from: "2026-10-17T00:00:00Z"}};
        const result = (await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy}, select: {added_at: true}}))._unsafeUnwrap();
        expect(result.edges.map(e => e.node.collection_card_id)).toEqual([id(110)]);
        expect(result.date_coverage.undated).toBe("present");
        const known = (await f.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...policy, copy_requirements: {date_state: "known"}}}, select: {added_at: true}}))._unsafeUnwrap();
        expect(known.date_coverage.undated).toBe("present");
    } finally {f.dispose();}
});

test("byte-bounded whole rows recover without clipping, loss or replay and oversized rows remain unconsumed", async () => {
    const f = await collectionFixture();
    const bounded = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {responseBudgetBytes: 8_000}});
    try {
        f.db.$client.prepare("UPDATE collection_card SET condition = ?").run('Synthetic Æ 🧙 "condition"\n'.repeat(130));
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {}}}, select: {condition: true}};
        const one = (await bounded.handlers.browseCollectionCards(args))._unsafeUnwrap();
        expect(one.edges.map(e => e.node.collection_card_id)).toEqual([id(110)]);
        expect(Boolean(one.next_cursor)).toBe(true);
        expect(Buffer.byteLength(JSON.stringify(one))).toBeLessThanOrEqual(8_000);
        const two = (await bounded.handlers.browseCollectionCards({...args, after: one.next_cursor}))._unsafeUnwrap();
        expect(two.edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        expect(Boolean(two.next_cursor)).toBe(false);
        f.db.$client.prepare("UPDATE collection_card SET condition = ? WHERE id = ?").run('Synthetic "🧙"\n'.repeat(8_000), id(111));
        const failed = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrapErr().envelope;
        expect(failed).toMatchObject({status: "error", edges: [{node: {collection_card_id: id(110)}}], error: {code: "record_too_large", retryable: false}});
        expect(Buffer.byteLength(JSON.stringify(failed))).toBeLessThanOrEqual(51_200);
        const recovered = (await f.runtime.handlers.browseCollectionCards({...args, select: {quantity: true}, after: failed.error.cursor}))._unsafeUnwrap();
        expect(recovered.edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        expect(Boolean(recovered.next_cursor)).toBe(false);
    } finally {bounded.close(); f.dispose();}
});

test("cancellation and scan deadline preserve safe ordinary-call recovery without claiming lookahead completion", async () => {
    const f = await collectionFixture();
    let ticks = 0;
    const timed = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {now: () => ++ticks < 4 ? 0 : 120_000}});
    try {
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {}}}, select: {quantity: true}};
        const error = (await timed.handlers.browseCollectionCards(args))._unsafeUnwrapErr().envelope;
        expect(error).toMatchObject({status: "error", edges: [{node: {collection_card_id: id(110)}}], error: {code: "scan_timeout", retryable: true}});
        expect(error).not.toHaveProperty("pageInfo");
        const resumed = (await f.runtime.handlers.browseCollectionCards({...args, after: error.error.cursor}))._unsafeUnwrap();
        expect(resumed.edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        const controller = new AbortController(); controller.abort();
        const cancelled = (await f.runtime.handlers.browseCollectionCards(args, controller.signal))._unsafeUnwrapErr().envelope;
        expect(cancelled).toMatchObject({edges: [], error: {code: "cancelled", retryable: true}});
        expect((await f.runtime.handlers.browseCollectionCards({...args, after: cancelled.error.cursor}))._unsafeUnwrap().edges).toHaveLength(2);
        const after = (await f.runtime.handlers.browseCollectionCards({...args, first: 1}))._unsafeUnwrap().next_cursor;
        await f.reimportOracle();
        expect((await f.runtime.handlers.browseCollectionCards({...args, after}))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "stale_cursor", reason: "reference_import_changed", recovery: "restart"});
    } finally {timed.close(); f.dispose();}
});

test("exhaustion metadata is included in exact byte decisions and an over-budget final row remains recoverable", async () => {
    const f = await collectionFixture();
    f.db.$client.prepare("UPDATE collection_card SET condition = ?").run("A".repeat(600));
    try {
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: f.policy}, select: {quantity: true, condition:true}};
        const baseline = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        let size = Buffer.byteLength(JSON.stringify(baseline));
        for (let i = 0; i < 3; i++) size = Buffer.byteLength(JSON.stringify({...baseline, metadata: {...baseline.metadata, response_budget_bytes: size}}));
        const exact = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {responseBudgetBytes: size}});
        const short = createLocalAgentToolRuntime({databasePath: f.databasePath, log, lookup: {responseBudgetBytes: size - 1}});
        try {
            expect(Buffer.byteLength(JSON.stringify((await exact.handlers.browseCollectionCards(args))._unsafeUnwrap()))).toBe(size);
            const failed = (await short.handlers.browseCollectionCards(args))._unsafeUnwrapErr().envelope;
            expect(failed).toMatchObject({edges: [], error: {code: "record_too_large", retryable: false}});
            expect(failed.error.cursor).toBeString();
            expect((await f.runtime.handlers.browseCollectionCards({...args, after: failed.error.cursor}))._unsafeUnwrap().edges.map(e => e.node.collection_card_id)).toEqual([id(111)]);
        } finally {exact.close(); short.close();}
    } finally {f.dispose();}
});

test("no import, imported empty, unconfirmed permission and legacy precision are distinct inspectable states", async () => {
    const f = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: f.databasePath, log});
    try {
        expect((await runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({locations: [], collection_context: {state: "no_collection", collection_import_id: null}});
        const missing = (await runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: id(999), policy: {kind: "explicit", policy: {confirmed: true, collection_import_id: id(999), allowed_locations: []}}, select: {quantity: true}}))._unsafeUnwrapErr().envelope;
        expect(missing).toMatchObject({collection_context: {state: "no_collection", collection_import_id: null, policy_id: null}});
    } finally {runtime.close(); f.dispose();}
    const c = await collectionFixture();
    try {
        // Legacy stored seconds do not recover the source's original subsecond boundary.
        c.db.$client.prepare("UPDATE collection_card SET added_at_exact = NULL WHERE id = ?").run(id(110));
        const page = (await c.runtime.handlers.browseCollectionCards({include_collection_policy:true, collection_import_id: c.imported.id, policy: {kind: "explicit", policy: {...c.policy, copy_requirements: {}}}, select: {added_at: true, date_reliability: true}, date_state: "unknown"}))._unsafeUnwrap();
        expect(page.edges[0]!.node).toMatchObject({collection_card_id: id(110), added_at: null, date_reliability: "legacy_precision_lost"});
        expect(page.date_coverage).toMatchObject({undated: "present", legacy_precision_lost: true});
        c.db.$client.exec("DELETE FROM collection_state");
        expect((await c.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({collection_context: {state: "reimport_required", collection_import_id: null}});
    } finally {c.dispose();}
});

test("strict recent-copy intent cannot silently widen a candidate policy while exploratory inspiration permits wider assembly", async () => {
    const f = await collectionFixture();
    try {
        const recentAdditions = {purpose: "strict_copy_eligibility", added_at_from: "2026-10-17T00:00:00.125Z", added_at_before: "2026-10-17T00:00:00.126Z", timezone: "Australia/Sydney"};
        const created = (await f.runtime.handlers.createDeckCandidate({label: "Recent strict", brief: {goal: "Use recent copies", format: "casual_60", powerLevel: null, collectionAccessPolicy: {...f.policy, copy_requirements: {}}, recentAdditions}}))._unsafeUnwrap();
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "candidate", candidate_id: created.candidate_id}, select: {added_at: true}};
        expect((await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrapErr().envelope.error).toMatchObject({code: "invalid_request", reason: "invalid_policy"});
        const corrected = (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: created.updated_at, changes: {brief: {collectionAccessPolicy: {...f.policy, copy_requirements: {added_at_from: recentAdditions.added_at_from, added_at_before: recentAdditions.added_at_before}}}}}))._unsafeUnwrap();
        const strict = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        expect(strict.edges.map(e => e.node.collection_card_id)).toEqual([id(110)]);
        expect(strict.date_coverage.undated).toBe("present");
        (await f.runtime.handlers.editDeckCandidate({candidate_id: created.candidate_id, expected_updated_at: corrected.updated_at, changes: {brief: {collectionAccessPolicy: {...f.policy, copy_requirements: {}}, recentAdditions: {...recentAdditions, purpose: "exploratory_inspiration"}}}}))._unsafeUnwrap();
        const exploratory = (await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap();
        expect(exploratory.edges.map(e => e.node.collection_card_id)).toEqual([id(110), id(111)]);
    } finally {f.dispose();}
});

test("policy predicates cannot combine one row's date with another row's Finish or a different Printing of the same identity", async () => {
    const f = await collectionFixture();
    try {
        // A second synthetic version of the same Oracle identity makes independent-EXISTS mistakes observable.
        f.db.$client.prepare("INSERT INTO card_printing (id, card_identity_id, layout, set_id, collector_number, language, source_page_uri) SELECT ?, card_identity_id, layout, set_id, collector_number, 'de', source_page_uri FROM card_printing WHERE id = ?").run(id(500), id(2));
        f.db.$client.prepare("UPDATE collection_card SET card_printing_id = ? WHERE id = ?").run(id(500), id(111));
        const args = {include_collection_policy:true, collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {finish: ["nonfoil"], languages: ["de"], added_at_from: "2026-10-17T00:00:00Z"}}}, select: {lang: true, added_at: true}};
        expect((await f.runtime.handlers.browseCollectionCards(args))._unsafeUnwrap().edges).toEqual([]);
        const actual = (await f.runtime.handlers.browseCollectionCards({...args, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {languages: ["de"]}}}}))._unsafeUnwrap();
        expect(actual.edges).toHaveLength(1);
        expect(actual.edges[0]!.node).toMatchObject({collection_card_id: id(111), oracle_id: id(1), printing_id: id(500), lang: "de", added_at: null});
        const priceArgs = {...args, policy: {kind: "explicit", policy: {...f.policy, copy_requirements: {purchase_price: {currency: "AUD", min: 2, max: 3}}}}, select: {purchase_price: true, purchase_price_currency: true}};
        f.db.$client.prepare("UPDATE collection_card SET purchase_price = 2.5, purchase_price_currency = 'USD' WHERE id = ?").run(id(111));
        expect((await f.runtime.handlers.browseCollectionCards(priceArgs))._unsafeUnwrap().edges).toEqual([]);
        f.db.$client.prepare("UPDATE collection_card SET purchase_price_currency = 'AUD' WHERE id = ?").run(id(111));
        expect((await f.runtime.handlers.browseCollectionCards(priceArgs))._unsafeUnwrap().edges[0]!.node).toMatchObject({collection_card_id: id(111), purchase_price: 2.5, purchase_price_currency: "AUD"});
    } finally {f.dispose();}
});
