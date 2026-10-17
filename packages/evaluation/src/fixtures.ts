import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRootLogger, requiredScryfallImportContractRevisions, resolveLogConfigFromEnv, type Logger} from "@tomekin/core";
import {applySqliteMigrations, cardIdentity, cardPrinting, cardSet, collectionCard, collectionLocation, closeDatabase, openDatabase, scryfallBulkDataImport} from "@tomekin/sqlite";

export const log: Logger = createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"}));
export const fixtureRevision = "synthetic-workflows-v1";
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const brief = {goal: "Synthetic measurement", format: "casual_60", powerLevel: "Synthetic", constraints: [], exclusions: [], assumptions: []};
export const manifests = {
    discovery: {identities: 12, printings: 16, ownedRows: 10, copies: 14, allowedIdentities: 8},
    construction: {identities: 26, printings: 30, ownedRows: 28, copies: 100, allowedIdentities: 26},
    tuning: {identities: 20, printings: 22, ownedRows: 10, copies: 12, allowedIdentities: 8},
    commanderSize: {identities: 72, printings: 72, ownedRows: 0, copies: 0, allowedIdentities: 0},
    assembly: {identities: 26, printings: 30, ownedRows: 28, copies: 100, allowedIdentities: 26},
} as const;
export type WorkflowName = keyof typeof manifests;

export function createFixture(name: WorkflowName) {
    const manifest = manifests[name];
    const directory = mkdtempSync(join(tmpdir(), "tomekin-evaluation-"));
    const databasePath = join(directory, "fixture.sqlite");
    applySqliteMigrations(databasePath, {log});
    const db = openDatabase(databasePath, {log});
    const rows: {id: string; identityId: string; printingId: string; quantity: number; locationId: string; finish: "foil" | "nonfoil"}[] = [];
    try {
        for (const [type, revision] of Object.entries(requiredScryfallImportContractRevisions)) {
            db.insert(scryfallBulkDataImport).values({id: id(950 + Object.keys(requiredScryfallImportContractRevisions).indexOf(type)), bulkDataType: type as keyof typeof requiredScryfallImportContractRevisions, importContractRevision: revision, status: "succeeded", startedAt: new Date("2026-01-01Z"), completedAt: new Date("2026-01-01Z"), importedRecordCount: manifest.identities}).run();
        }
        db.insert(cardSet).values({id: id(900), code: "syn", name: "Synthetic Set", setType: "expansion", apiUri: "https://example.invalid/set", cardSearchUri: "https://example.invalid/search", sourcePageUri: "https://example.invalid/set"}).run();
        for (let i = 1; i <= 3; i++) db.insert(collectionLocation).values({id: id(900 + i), name: i === 3 ? "Excluded" : `Allowed ${i}`, type: i === 3 ? "deck" : "binder"}).run();
        for (let i = 1; i <= manifest.identities; i++) {
            db.insert(cardIdentity).values({id: id(i), name: `Synthetic ${String(i).padStart(3, "0")} — Æ`, layout: "normal", manaCost: "{1}", manaValue: 1, typeLine: i >= 25 ? "Basic Land" : "Artifact", oracleText: i === 1 ? "Draw a card. ".repeat(100) : "Draw a card.", copyLimitOverrideKind: "none", copyLimitOverrideMaximum: null, colorIdentity: "", colors: null, colorIndicator: null, producedMana: null, keywordsJson: [], power: null, toughness: null, loyalty: null, defense: null, edhrecRank: null, gameChanger: false, sourcePageUri: "https://example.invalid/card"}).run();
        }
        for (let i = 0; i < manifest.printings; i++) db.insert(cardPrinting).values({id: id(100 + i), cardIdentityId: id(i % manifest.identities + 1), layout: "standard", printedName: null, setId: id(900), collectorNumber: String(i), language: "en", tcgplayerId: null, cardmarketId: null, sourcePageUri: "https://example.invalid/printing"}).run();
        for (let i = 0; i < manifest.ownedRows; i++) {
            // Tuning's Addition Pool is identities 13..20; the twelve selected rows are independent.
            const identityIndex = name === "tuning" ? 12 + i % 8 : i % manifest.allowedIdentities;
            const printingIndex = name === "discovery" && i >= 8 ? i : identityIndex;
            const quantity = i === 0 ? manifest.copies - manifest.ownedRows + 1 : 1;
            const locationId = id(name === "discovery" && i >= 8 ? 903 : 901 + i % 2);
            const row = {id: id(200 + i), identityId: id(printingIndex + 1), printingId: id(100 + printingIndex), quantity, locationId, finish: i % 2 ? "foil" as const : "nonfoil" as const};
            rows.push(row);
            db.insert(collectionCard).values({id: row.id, quantity, collectionLocationId: locationId, finish: row.finish as "foil" | "nonfoil", manaBoxId: null, cardPrintingId: row.printingId, misprint: false, altered: false, condition: null, purchasePriceCurrency: null, purchasePrice: null, addedAt: null, sourceRowNumber: i + 1}).run();
        }
    } finally { closeDatabase(db); }
    return {databasePath, rows, manifest, dispose: () => rmSync(directory, {recursive: true, force: true})};
}
