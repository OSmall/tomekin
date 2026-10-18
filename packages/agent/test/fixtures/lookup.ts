import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createTestRootLoggerFromEnv, mapRawScryfallAllCardToCardPrintingImportRecord, mapRawScryfallOracleCardToCardIdentityImportRecord, RawScryfallAllCardSchema, RawScryfallOracleCardSchema, type Logger, type CardIdentityTagImportRecord} from "@tomekin/core";
import {applySqliteMigrations, openDatabase, closeDatabase, createSqliteScryfallRepository} from "@tomekin/sqlite";
export const log: Logger = createTestRootLoggerFromEnv();
export const id = (n: number) => n === 1 ? "6ad8011d-3471-4369-9d68-b264cc027487" : n === 2 ? "073bfdca-d7b8-4f4b-93f3-6e7c44bc0b0a" : `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function createLookupFixture(options: {text?: string; tagAnnotation?: string; tags?: boolean; ready?: boolean; incompatible?: "oracle_cards" | "all_cards" | "oracle_tags"} = {}): Promise<{databasePath: string; reimportOracle: () => Promise<void>; reimportTags: () => Promise<void>; recordFailedImport: () => Promise<void>; dispose: () => void}> {
    const directory = mkdtempSync(join(tmpdir(), "tomekin-lookup-"));
    const databasePath = join(directory, "test.sqlite");
    applySqliteMigrations(databasePath, {log});
    let tick = 0;
    const clock = {now: () => new Date(Date.UTC(2026, 0, 1) + ++tick)};
    const identityRecords = JSON.parse(readFileSync(new URL("../test/fixtures/oracle-cards-minimal.json", import.meta.resolve("@tomekin/sqlite")), "utf8")).map((raw: unknown) => mapRawScryfallOracleCardToCardIdentityImportRecord(RawScryfallOracleCardSchema.parse(raw)));
    if (options.text !== undefined) identityRecords.find((row: {identity: {id: string}}) => row.identity.id === id(1)).identity.oracleText = options.text;
    const printingRecords = JSON.parse(readFileSync(new URL("../test/fixtures/all-cards-minimal.json", import.meta.resolve("@tomekin/sqlite")), "utf8")).map((raw: unknown) => mapRawScryfallAllCardToCardPrintingImportRecord(RawScryfallAllCardSchema.parse(raw)));
    const importInput = <T>(rows: readonly T[]) => ({startedAt: clock.now(), records: (async function*() {yield* rows;})()});
    const run = async <T>(action: (repo: ReturnType<typeof createSqliteScryfallRepository>) => Promise<T>) => {const db = openDatabase(databasePath, {log}); try {return await action(createSqliteScryfallRepository(db, clock));} finally {closeDatabase(db);}};
    const tagRecords: CardIdentityTagImportRecord[] = [
        {tag: {id: id(20), slug: "mana-rock", label: "mana rock", description: null, sourcePageUri: "https://example.invalid/tag"}, aliases: [], taggings: [{tagId: id(20), cardIdentityId: id(1), weight: "strong", annotation: null}], hierarchy: [{parentTagId: id(21), childTagId: id(20)}]},
        {tag: {id: id(21), slug: "mana", label: "mana", description: null, sourcePageUri: "https://example.invalid/tag"}, aliases: [], taggings: [], hierarchy: [{parentTagId: id(22), childTagId: id(21)}]},
        {tag: {id: id(22), slug: "resource", label: "resource", description: null, sourcePageUri: "https://example.invalid/tag"}, aliases: [], taggings: [{tagId: id(22), cardIdentityId: id(1), weight: "weak", annotation: options.tagAnnotation ?? "Synthetic direct preference"}], hierarchy: []},
    ];
    const reimportOracle = async () => {(await run((repo) => repo.importCardIdentities(importInput(identityRecords))))._unsafeUnwrap();};
    const reimportTags = async () => {(await run((repo) => repo.importCardIdentityTags(importInput(tagRecords))))._unsafeUnwrap();};
    if (options.ready !== false) {
        await reimportOracle();
        (await run((repo) => repo.importCardPrintings(importInput(printingRecords))))._unsafeUnwrap();
        if (options.tags) await reimportTags();
    }
    if (options.incompatible) {
        const db = openDatabase(databasePath, {log});
        try {db.$client.prepare("UPDATE scryfall_bulk_data_import SET import_contract_revision = 0 WHERE bulk_data_type = ?").run(options.incompatible);} finally {closeDatabase(db);}
    }
    return {databasePath, reimportOracle, reimportTags, recordFailedImport: async () => {(await run((repo) => repo.recordFailedBulkDataImport("oracle_cards", {startedAt: clock.now(), completedAt: clock.now(), blockingErrors: ["Synthetic failed attempt"]})))._unsafeUnwrap();}, dispose: () => rmSync(directory, {recursive: true, force: true})};
}
