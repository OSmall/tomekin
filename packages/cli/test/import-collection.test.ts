import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {runImportCollectionCommand, runImportScryfallCommand} from "@tomekin/cli";
import {createTestRootLoggerFromEnv} from "@tomekin/core";
import {applySqliteMigrations, closeDatabase, createSqliteCollectionRepository, openDatabase} from "@tomekin/sqlite";

const clock = {now: () => new Date("2025-01-01T00:00:00.000Z")};
const testLog = createTestRootLoggerFromEnv();

describe("import:collection command", () => {
    test("imports a ManaBox CSV into the Collection snapshot", async () => {
        const paths = await createFixtureFiles();
        await importReferenceData(paths);

        const result = await runCommand(["--db", paths.dbPath, "manabox", paths.collectionPath], {});

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Collection Import succeeded");
        expect(result.stdout).toContain("Imported row count: 2");
        expect(result.stdout).toContain("Total quantity: 3");
        expect(result.stdout).toContain("Location count: 2 (1 binder, 1 deck)");
        expect(result.stdout).toContain("Warning count: 5");
        expect(result.stderr).toContain("ManaBox ID is blank");
        expect(result.stderr).toContain("differs from local Card Printing name");

        const snapshot = await readCollectionSnapshot(paths.dbPath);
        expect(snapshot.locations).toContainEqual(expect.objectContaining({name: "Trade Binder", type: "binder"}));
        expect(snapshot.locations).toContainEqual(expect.objectContaining({name: "Commander Deck", type: "deck"}));
        expect(snapshot.cards).toHaveLength(2);
        expect(snapshot.cards.map((card) => card.quantity)).toEqual([2, 1]);
        expect(snapshot.cards.map((card) => card.finish)).toEqual(["nonfoil", "foil"]);
        expect(snapshot.imports).toContainEqual(expect.objectContaining({
            status: "succeeded",
            importedRowCount: 2,
            totalQuantity: 3
        }));
    });

    test("imports the sanitized real ManaBox slice fixture", async () => {
        const paths = await createRealSliceFixtureFiles();
        await importReferenceData(paths);

        const result = await runCommand(["--db", paths.dbPath, "manabox", paths.collectionPath], {});

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Imported row count: 8");
        expect(result.stdout).toContain("Total quantity: 8");
        expect(result.stdout).toContain("Location count: 2 (1 binder, 1 deck)");
        const snapshot = await readCollectionSnapshot(paths.dbPath);
        expect(snapshot.cards).toHaveLength(8);
        expect(snapshot.locations.map((location) => location.name).sort()).toEqual([
            "Fixture Binder",
            "Fixture Deck",
        ]);
    });

    test("records failed attempts and preserves the previous snapshot on blocking row errors", async () => {
        const paths = await createFixtureFiles();
        await importReferenceData(paths);
        expect((await runCommand(["--db", paths.dbPath, "manabox", paths.collectionPath], {})).exitCode).toBe(0);
        const badPath = join(paths.dir, "bad-collection.csv");
        await Bun.write(badPath, manaBoxCsv([{...collectionRows[0], Quantity: "0"}]));

        const result = await runCommand(["--db", paths.dbPath, "manabox", badPath], {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Quantity must be a positive integer");
        expect(result.stderr).toContain("Previous Collection snapshot was preserved");
        const snapshot = await readCollectionSnapshot(paths.dbPath);
        expect(snapshot.cards).toHaveLength(2);
        expect(snapshot.imports.map((attempt) => attempt.status)).toEqual(["succeeded", "failed"]);
    });

    test("missing input file exits without creating a CollectionImport", async () => {
        const paths = await createFixtureFiles();
        const missingPath = join(paths.dir, "missing.csv");

        const result = await runCommand(["--db", paths.dbPath, "manabox", missingPath], {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Missing Collection source file");
        const snapshot = await readCollectionSnapshot(paths.dbPath);
        expect(snapshot.imports).toHaveLength(0);
    });

    test("missing Scryfall prerequisites are recorded as failed attempts", async () => {
        const paths = await createFixtureFiles();

        const result = await runCommand(["--db", paths.dbPath, "manabox", paths.collectionPath], {});

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("oracle_cards");
        expect(result.stderr).toContain("all_cards");
        const snapshot = await readCollectionSnapshot(paths.dbPath);
        expect(snapshot.imports).toContainEqual(expect.objectContaining({status: "failed"}));
    });
});

type TestCommandEnv = {
    readonly TOMEKIN_DB_PATH?: string;
};

async function runCommand(args: readonly string[], env: TestCommandEnv) {
    let stdout = "";
    let stderr = "";
    const exitCode = await runImportCollectionCommand(
        args,
        env,
        {stdout: {write: (message) => (stdout += message)}, stderr: {write: (message) => (stderr += message)}},
        clock,
        {log: testLog},
    );
    return {exitCode, stdout, stderr};
}

async function importReferenceData(paths: Awaited<ReturnType<typeof createFixtureFiles>>): Promise<void> {
    for (const args of [
        ["--db", paths.dbPath, "oracle_cards", paths.oraclePath],
        ["--db", paths.dbPath, "all_cards", paths.allCardsPath],
    ] as const) {
        const exitCode = await runImportScryfallCommand(args, {}, {
            stdout: {
                write() {
                }
            }, stderr: {
                write() {
                }
            }
        }, clock, {log: testLog});
        expect(exitCode).toBe(0);
    }
}

async function createFixtureFiles() {
    const dir = mkdtempSync(join(tmpdir(), "tomekin-collection-cli-"));
    const dbPath = join(dir, "collection.sqlite");
    const oraclePath = join(dir, "oracle-cards.json");
    const allCardsPath = join(dir, "all-cards.json");
    const collectionPath = join(dir, "collection.csv");
    await Bun.write(oraclePath, JSON.stringify(rawOracleCards));
    await Bun.write(allCardsPath, JSON.stringify(rawAllCards));
    await Bun.write(collectionPath, manaBoxCsv(collectionRows));
    applySqliteMigrations(dbPath, {log: testLog});
    return {dir, dbPath, oraclePath, allCardsPath, collectionPath};
}

async function createRealSliceFixtureFiles() {
    const dir = mkdtempSync(join(tmpdir(), "tomekin-collection-real-slice-cli-"));
    const dbPath = join(dir, "collection.sqlite");
    const oraclePath = join(dir, "oracle-cards.json");
    const allCardsPath = join(dir, "all-cards.json");
    const collectionPath = join(dir, "collection.csv");
    const csvText = await Bun.file(new URL("./fixtures/manabox-collection-real-slice.csv", import.meta.url)).text();
    const rows = parseFixtureCsv(csvText);
    await Bun.write(collectionPath, csvText);
    await Bun.write(oraclePath, JSON.stringify(rows.map(toRawOracleCardFixture)));
    await Bun.write(allCardsPath, JSON.stringify(rows.map(toRawAllCardFixture)));
    applySqliteMigrations(dbPath, {log: testLog});
    return {dir, dbPath, oraclePath, allCardsPath, collectionPath};
}

async function readCollectionSnapshot(dbPath: string) {
    const db = openDatabase(dbPath, {log: testLog});
    try {
        const repository = createSqliteCollectionRepository(db, clock);
        const locations = await repository.listCollectionLocations();
        const cards = await repository.listCollectionCards();
        const imports = await repository.listCollectionImports();
        if (locations.isErr()) throw new Error(locations.error.message);
        if (cards.isErr()) throw new Error(cards.error.message);
        if (imports.isErr()) throw new Error(imports.error.message);
        return {locations: locations.value, cards: cards.value, imports: imports.value};
    } finally {
        closeDatabase(db);
    }
}

function manaBoxCsv(rows: readonly Record<string, string>[]): string {
    const headers = [
        "Binder Name",
        "Binder Type",
        "Name",
        "Set code",
        "Set name",
        "Collector number",
        "Foil",
        "Rarity",
        "Quantity",
        "ManaBox ID",
        "Scryfall ID",
        "Purchase price",
        "Misprint",
        "Altered",
        "Condition",
        "Language",
        "Purchase price currency",
        "Added",
        "Ignored Extra",
    ];
    return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))].join("\n");
}

function csvCell(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function parseFixtureCsv(csvText: string): Record<string, string>[] {
    const [headerLine, ...lines] = csvText.trimEnd().split("\n");
    const headers = parseFixtureCsvLine(headerLine ?? "");
    return lines.map((line) => {
        const values = parseFixtureCsvLine(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    });
}

function parseFixtureCsvLine(line: string): string[] {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (quoted && line[index + 1] === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
            continue;
        }
        if (char === "," && !quoted) {
            values.push(value);
            value = "";
            continue;
        }
        value += char;
    }
    values.push(value);
    return values;
}

function toRawOracleCardFixture(row: Record<string, string>, index: number) {
    return {
        object: "card",
        id: fakeUuid(index, "10000000"),
        oracle_id: fakeUuid(index, "20000000"),
        name: row.Name,
        layout: "normal",
        mana_cost: "",
        cmc: 0,
        type_line: "Creature",
        oracle_text: "Fixture oracle text.",
        color_identity: [],
        keywords: [],
        game_changer: false,
        legalities: {commander: "legal"},
        scryfall_uri: `https://scryfall.com/card/${row["Set code"]}/${row["Collector number"]}/fixture`,
    };
}

function toRawAllCardFixture(row: Record<string, string>, index: number) {
    return {
        ...toRawOracleCardFixture(row, index),
        id: row["Scryfall ID"],
        oracle_id: fakeUuid(index, "20000000"),
        set: row["Set code"].toLowerCase(),
        collector_number: row["Collector number"],
        finishes: [row.Foil === "normal" ? "nonfoil" : row.Foil],
        lang: row.Language,
    };
}

function fakeUuid(index: number, prefix: string): string {
    return `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

const rawOracleCards = [
    {
        object: "card",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        oracle_id: "6ad8011d-3471-4369-9d68-b264cc027487",
        name: "Sol Ring",
        layout: "normal",
        mana_cost: "{1}",
        cmc: 1,
        type_line: "Artifact",
        oracle_text: "{T}: Add {C}{C}.",
        color_identity: [],
        keywords: [],
        game_changer: false,
        legalities: {commander: "legal"},
        scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
    },
    {
        object: "card",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        oracle_id: "8b755881-a72d-4e21-a369-d2924eb4585a",
        name: "Cultivate",
        layout: "normal",
        mana_cost: "{2}{G}",
        cmc: 3,
        type_line: "Sorcery",
        oracle_text: "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
        color_identity: ["G"],
        keywords: [],
        game_changer: false,
        legalities: {commander: "legal"},
        scryfall_uri: "https://scryfall.com/card/m11/168/cultivate",
    },
] as const;

const rawAllCards = [
    {
        ...rawOracleCards[0],
        id: "11111111-1111-4111-8111-111111111111",
        set: "v10",
        collector_number: "12",
        finishes: ["nonfoil", "foil"],
        lang: "en"
    },
    {
        ...rawOracleCards[1],
        id: "22222222-2222-4222-8222-222222222222",
        set: "m11",
        collector_number: "168",
        finishes: ["nonfoil", "foil"],
        lang: "en"
    },
] as const;

const collectionRows = [
    {
        "Binder Name": "Trade Binder",
        "Binder Type": "binder",
        Name: "Sol Ring",
        "Set code": "v10",
        "Set name": "From the Vault: Relics",
        "Collector number": "12",
        Foil: "normal",
        Rarity: "rare",
        Quantity: "2",
        "ManaBox ID": "",
        "Scryfall ID": "11111111-1111-4111-8111-111111111111",
        "Purchase price": "1.25",
        Misprint: "false",
        Altered: "false",
        Condition: "Near Mint",
        Language: "en",
        "Purchase price currency": "usd",
        Added: "2024-01-01T00:00:00.000Z",
        "Ignored Extra": "ignored",
    },
    {
        "Binder Name": "Commander Deck",
        "Binder Type": "deck",
        Name: "Cultivate but source typo",
        "Set code": "m11",
        "Set name": "Magic 2011",
        "Collector number": "168",
        Foil: "foil",
        Rarity: "common",
        Quantity: "1",
        "ManaBox ID": "mb-2",
        "Scryfall ID": "22222222-2222-4222-8222-222222222222",
        "Purchase price": "bad",
        Misprint: "false",
        Altered: "false",
        Condition: "Lightly Played",
        Language: "en",
        "Purchase price currency": "eur",
        Added: "not-a-date",
        "Ignored Extra": "ignored",
    },
] as const;
