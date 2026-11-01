import {expect, test} from "bun:test";
import {createCollectionImportServices} from "@tomekin/core";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id} from "../../agent/test/fixtures/lookup";

// Focused repository exception: transaction rollback/commit order is itself the contract.
test("active Collection pointer follows successful replacement commit, including equal timestamps, and rolls back with rows", async () => {
    const f = await createCollectionFixture();
    try {
        const sameTime = await f.replace();
        expect(sameTime.id).not.toBe(f.imported.id);
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({collection_context: {collection_import_id: sameTime.id}});
        f.db.$client.exec("CREATE TRIGGER fail_pointer BEFORE UPDATE ON collection_state BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END");
        const failed = await f.repository.replaceCollectionSnapshot({sourcePath: "rollback.csv", importedAt: new Date("2027-01-01T00:00:00Z"), snapshot: {locations: [], cards: []}, summary: {importedRowCount: 0, totalQuantity: 0, locationCount: 0, binderCount: 0, deckCount: 0}, warnings: []});
        expect(failed.isErr()).toBe(true);
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({locations: expect.arrayContaining([{id: id(100), type: "binder", name: "Shared"}]), collection_context: {collection_import_id: sameTime.id}});
        expect((await f.repository.listCollectionCards())._unsafeUnwrap()).toHaveLength(3);
        expect((await f.repository.listCollectionImports())._unsafeUnwrap().filter(attempt => attempt.status === "succeeded")).toHaveLength(2);
    } finally {f.dispose();}
});

test("slow earlier Collection import completing after a newer import becomes active without relying on start time", async () => {
    const f = await createCollectionFixture();
    try {
        let release!: () => void;
        const gate = new Promise<void>(resolve => {release = resolve;});
        let entered!: () => void;
        const waiting = new Promise<void>(resolve => {entered = resolve;});
        const slow = createCollectionImportServices({...f.repository, async resolveCardPrintingById(id) {entered(); await gate; return f.repository.resolveCardPrintingById(id);}}, {now: () => new Date("2026-10-17T00:00:00Z")});
        const fast = createCollectionImportServices(f.repository, {now: () => new Date("2026-10-18T00:00:00Z")});
        const csv = (name: string) => `Binder Name,Binder Type,Name,Set code,Collector number,Foil,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added\n${name},binder,Sol Ring,v10,12,foil,1,source,${id(2)},,false,false,,en,,\n`;
        const earlier = slow.importManaBoxCollectionCsv({sourcePath: "earlier.csv", csvText: csv("Earlier")});
        await waiting;
        const later = (await fast.importManaBoxCollectionCsv({sourcePath: "later.csv", csvText: csv("Later")}))._unsafeUnwrap();
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({collection_context: {collection_import_id: later.id}});
        release();
        const committedLast = (await earlier)._unsafeUnwrap();
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({locations: [{name: "Earlier"}], collection_context: {collection_import_id: committedLast.id, imported_at: "2026-10-17T00:00:00.000Z"}});
    } finally {f.dispose();}
});

test("generated snapshot/date migration preserves existing rows, integer date units and user candidate records", async () => {
    const {readFileSync} = await import("node:fs");
    const f = await createCollectionFixture();
    try {
        const candidate = (await f.runtime.handlers.createDeckCandidate({label: "Preserved candidate", brief: {goal: "Preserve user work", format: "casual_60", powerLevel: null}}))._unsafeUnwrap();
        const before = f.db.$client.prepare("SELECT id, added_at FROM collection_card ORDER BY id").all();
        // Reconstruct the immediately preceding schema while retaining its existing data.
        f.db.$client.exec("DROP TABLE collection_state");
        f.db.$client.exec("ALTER TABLE collection_card DROP COLUMN added_at_exact");
        f.db.$client.exec(readFileSync(new URL("../drizzle/0009_strange_clint_barton.sql", import.meta.url), "utf8"));
        expect(f.db.$client.prepare("SELECT id, added_at FROM collection_card ORDER BY id").all()).toEqual(before);
        expect(f.db.$client.prepare("SELECT added_at_exact FROM collection_card").all()).toEqual([{added_at_exact: null}, {added_at_exact: null}, {added_at_exact: null}]);
        expect((await f.runtime.handlers.listDeckCandidates())._unsafeUnwrap()).toContainEqual(expect.objectContaining({candidate_id: candidate.candidate_id, label: "Preserved candidate"}));
        expect((await f.runtime.handlers.listCollectionLocations())._unsafeUnwrap()).toMatchObject({collection_context: {state: "reimport_required", collection_import_id: null}});
        expect(f.db.$client.query("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {f.dispose();}
});
