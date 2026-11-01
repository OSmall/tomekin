import {createCollectionImportServices, createScryfallLocalImportServices} from "@tomekin/core";
import {applySqliteMigrations, closeDatabase, createSqliteCollectionRepository, createSqliteScryfallRepository, openDatabase} from "@tomekin/sqlite";
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {log} from "./fixtures";

// Developer preparation only: no target argument, existing DB, provider, profile or model access.
export async function prepareLiveParityFixture() {
    const directory = mkdtempSync(join(tmpdir(), "tomekin-live-parity-"));
    const base = join(directory, "baseline.sqlite");
    const collectionCsv = join(directory, "synthetic-collection.csv");
    const clock = {now: () => new Date("2026-10-18T00:00:00.000Z")};
    try {
        applySqliteMigrations(base, {log});
        const db = openDatabase(base, {log});
        const sources = ["oracle-cards-minimal.json", "all-cards-minimal.json"].map(name => new URL(`../../sqlite/test/fixtures/${name}`, import.meta.url));
        const hashes = sources.map(source => ({file: source.pathname.split("/").at(-1), sha256: createHash("sha256").update(readFileSync(source)).digest("hex")}));
        try {
            const services = createScryfallLocalImportServices(createSqliteScryfallRepository(db, clock), clock);
            for (const [index, source] of sources.entries()) {
                const stream = {stream: () => Bun.file(source).stream()};
                const metadata = {sourceUri: source.href, sourceUpdatedAt: clock.now()};
                const result = index === 0 ? await services.importOracleCards(stream, metadata) : await services.importAllCards(stream, metadata);
                if (result.isErr()) throw new Error(JSON.stringify(result.error));
            }
            const printings = JSON.parse(readFileSync(sources[1]!, "utf8")) as {id: string; name: string; set: string; set_name: string; collector_number: string; lang: string; finishes: string[]}[];
            const cell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
            const row = (card: typeof printings[number], type: string, quantity: number, finish: string, added: string) => ["Parity Shelf", type, card.name, card.set, card.set_name, card.collector_number, finish, "", quantity, "", card.id, "", false, false, "near_mint", card.lang, "AUD", added].map(cell).join(",");
            const csv = ["Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added", ...printings.map((card, index) => row(card, index === 3 ? "deck" : "binder", 1, card.finishes.includes("nonfoil") ? "normal" : "foil", index === 0 ? "2026-01-01T00:00:00Z" : index === 1 ? "2026-10-17T12:00:00Z" : "")), row(printings[0]!, "deck", 1, "foil", "2026-10-17T12:00:00Z"), row(printings[1]!, "binder", 3, "normal", "2026-01-01T00:00:00Z")].join("\n") + "\n";
            writeFileSync(collectionCsv, csv, {flag: "wx"});
            const imported = await createCollectionImportServices(createSqliteCollectionRepository(db, clock), clock).importManaBoxCollectionCsv({sourcePath: collectionCsv, csvText: csv});
            if (imported.isErr()) throw new Error(JSON.stringify(imported.error));
        } finally {closeDatabase(db);}
        const databases = {pi: join(directory, "pi.sqlite"), openCode: join(directory, "opencode.sqlite")};
        for (const target of Object.values(databases)) copyFileSync(base, target);
        const manifest = {kind: "live-parity-preparation-v1", directory, databases, baseline: base, collectionCsv, sources: hashes, collection: {synthetic: true, rows: 8, copies: 10, locations: [{type: "binder", name: "Parity Shelf"}, {type: "deck", name: "Parity Shelf"}]}, limits: "Eight public identities, six Printings; no basic lands or tags. No complete legal-deck, live provider/model, account or human acceptance evidence."};
        writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {flag: "wx"});
        return manifest;
    } catch (error) {rmSync(directory, {recursive: true, force: true}); throw error;}
}
if (import.meta.main) {
    if (process.argv.length > 2) throw new Error("No arguments accepted: preparation always creates a new temporary directory.");
    console.log(JSON.stringify(await prepareLiveParityFixture(), null, 2));
}
