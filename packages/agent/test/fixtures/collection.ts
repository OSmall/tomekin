import type {CollectionCardImportRecord, CollectionImportAttempt} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {closeDatabase, openDatabase, createSqliteCollectionRepository} from "@tomekin/sqlite";
import {createLookupFixture, id, log} from "./lookup";

export async function createCollectionFixture(): Promise<{
    databasePath: string; reimportOracle: () => Promise<void>; reimportTags: () => Promise<void>; recordFailedImport: () => Promise<void>;
    db: ReturnType<typeof openDatabase>; repository: ReturnType<typeof createSqliteCollectionRepository>; runtime: ReturnType<typeof createLocalAgentToolRuntime>;
    policy: {confirmed: boolean; collection_import_id: string; allowed_locations: {type: string; name: string}[]; copy_requirements: {finish: string[]}};
    imported: CollectionImportAttempt; replace: (rows?: CollectionCardImportRecord[], importedAt?: Date) => Promise<CollectionImportAttempt>; dispose: () => void;
}> {
    const fixture = await createLookupFixture();
    const db = openDatabase(fixture.databasePath, {log});
    const repository = createSqliteCollectionRepository(db, {now: () => new Date("2026-10-18T01:00:00Z")});
    const locations = [{id: id(100), type: "binder" as const, name: "Shared"}, {id: id(101), type: "deck" as const, name: "Shared"}];
    const card = (n: number, location: number, added: string | null, finish: "nonfoil" | "foil" = "nonfoil") => ({id: id(n), quantity: 2, collectionLocationId: id(location), finish, manaBoxId: null, cardPrintingId: id(2), misprint: false, altered: false, condition: null, purchasePriceCurrency: null, purchasePrice: null, addedAt: added ? new Date(added) : null, sourceRowNumber: n});
    const cards: CollectionCardImportRecord[] = [card(110, 100, "2026-10-17T00:00:00.125Z", "foil"), card(111, 100, null), card(112, 101, "2026-10-17T00:00:00.126Z")];
    const replace = async (rows = cards, importedAt = new Date("2026-10-18T01:00:00Z")) => (await repository.replaceCollectionSnapshot({sourcePath: "synthetic.csv", importedAt, snapshot: {locations, cards: rows}, summary: {importedRowCount: rows.length, totalQuantity: rows.length * 2, locationCount: 2, binderCount: 1, deckCount: 1}, warnings: []}))._unsafeUnwrap();
    const imported = await replace();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    const policy = {confirmed: true, collection_import_id: imported.id, allowed_locations: [{type: "binder", name: "Shared"}], copy_requirements: {finish: ["nonfoil"]}};
    return {...fixture, db, repository, runtime, policy, imported, replace, dispose: () => {runtime.close(); closeDatabase(db); fixture.dispose();}};
}
