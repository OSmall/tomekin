import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runImportScryfallCommand } from "@mtg-agent/cli";
import {
  closeDatabase,
  createSqliteScryfallRepository,
  initializeDatabaseSchema,
  openDatabase,
} from "@mtg-agent/sqlite";

const clock = {
  now: () => new Date("2025-01-01T00:00:00.000Z"),
};

describe("import:scryfall command", () => {
  test("imports oracle_cards and all_cards fixtures into the configured SQLite database", async () => {
    const paths = await createFixtureFiles();

    const oracleResult = await runCommand(
      ["--db", paths.dbPath, "oracle_cards", paths.oraclePath],
      {},
    );
    const allCardsResult = await runCommand(
      ["--db", paths.dbPath, "all_cards", paths.allCardsPath],
      {},
    );

    expect(oracleResult.exitCode).toBe(0);
    expect(allCardsResult.exitCode).toBe(0);
    expect(oracleResult.stdout).toContain("Target database");
    expect(oracleResult.stdout).toContain(paths.dbPath);
    expect(oracleResult.stdout).toContain("oracle_cards");
    expect(oracleResult.stdout).toContain("Imported record count: 2");
    expect(oracleResult.stderr).toContain("Starting Scryfall Bulk Data Import: oracle_cards");
    expect(oracleResult.stderr).toContain("Read source: 100%");
    expect(oracleResult.stderr).toContain("finalizing database import");
    expect(allCardsResult.stdout).toContain("all_cards");
    expect(allCardsResult.stdout).toContain("No live Scryfall network call was made");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.identities.map((card) => card.name).sort()).toEqual([
      "Cultivate",
      "Sol Ring",
    ]);
    expect(snapshot.printings.map((card) => card.printedName)).toEqual([null, null]);
    expect(snapshot.imports.map((attempt) => attempt.bulkDataType)).toEqual([
      "oracle_cards",
      "all_cards",
    ]);
  });

  test("imports exactly the requested bulk data type", async () => {
    const paths = await createFixtureFiles();

    const result = await runCommand(
      ["oracle_cards", paths.oraclePath],
      { MTG_AGENT_DB_PATH: paths.dbPath },
    );

    expect(result.exitCode).toBe(0);
    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.identities).toHaveLength(2);
    expect(snapshot.printings).toHaveLength(0);
    expect(snapshot.imports.map((attempt) => attempt.bulkDataType)).toEqual([
      "oracle_cards",
    ]);
  });

  test("emits timing output when requested", async () => {
    const paths = await createFixtureFiles();

    const result = await runCommand(
      ["--timing", "--db", paths.dbPath, "oracle_cards", paths.oraclePath],
      {},
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("[timing] final");
    expect(result.stderr).toContain("raw");
    expect(result.stderr).toContain("staged");
  });

  test("all_cards fails clearly when oracle_cards has not succeeded", async () => {
    const paths = await createFixtureFiles();

    const result = await runCommand(
      ["--db", paths.dbPath, "all_cards", paths.allCardsPath],
      {},
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("all_cards");
    expect(result.stderr).toContain("oracle_cards");
    expect(result.stderr).toContain("Previous usable dataset was preserved");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.printings).toHaveLength(0);
    expect(snapshot.imports).toContainEqual(
      expect.objectContaining({ bulkDataType: "all_cards", status: "failed" }),
    );
  });

  test("missing input file exits non-zero without creating an import record", async () => {
    const paths = await createFixtureFiles();
    const missingPath = join(paths.dir, "missing.json");

    const result = await runCommand(
      ["--db", paths.dbPath, "oracle_cards", missingPath],
      {},
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing Scryfall source file");
    expect(result.stderr).toContain(missingPath);

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.imports).toHaveLength(0);
  });

  test("invalid JSON records failure and preserves the previous usable dataset", async () => {
    const paths = await createFixtureFiles();
    const badPath = join(paths.dir, "bad-oracle.json");
    await Bun.write(badPath, "{");

    expect(
      (
        await runCommand(["--db", paths.dbPath, "oracle_cards", paths.oraclePath], {})
      ).exitCode,
    ).toBe(0);

    const result = await runCommand(
      ["--db", paths.dbPath, "oracle_cards", badPath],
      {},
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Failed to parse Scryfall source");
    expect(result.stderr).toContain("Previous usable dataset was preserved");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.identities).toHaveLength(2);
    expect(snapshot.imports.map((attempt) => attempt.status)).toEqual([
      "succeeded",
      "failed",
    ]);
  });

  test("all_cards with a missing oracle_id preserves the previous Card Printing dataset", async () => {
    const paths = await createFixtureFiles();
    const badAllCardsPath = join(paths.dir, "bad-all-cards.json");
    await Bun.write(
      badAllCardsPath,
      JSON.stringify([
        {
          ...rawAllCards[0],
          id: "33333333-3333-4333-8333-333333333333",
          oracle_id: "99999999-9999-4999-8999-999999999999",
        },
      ]),
    );

    expect(
      (
        await runCommand(["--db", paths.dbPath, "oracle_cards", paths.oraclePath], {})
      ).exitCode,
    ).toBe(0);
    expect(
      (
        await runCommand(["--db", paths.dbPath, "all_cards", paths.allCardsPath], {})
      ).exitCode,
    ).toBe(0);

    const result = await runCommand(
      ["--db", paths.dbPath, "all_cards", badAllCardsPath],
      {},
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing Card Identity IDs");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.printings.map((printing) => printing.id).sort()).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});

async function runCommand(
  args: readonly string[],
  env: { readonly MTG_AGENT_DB_PATH?: string },
): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runImportScryfallCommand(
    args,
    env,
    {
      stdout: { write: (message) => (stdout += message) },
      stderr: { write: (message) => (stderr += message) },
    },
    clock,
  );
  return { exitCode, stdout, stderr };
}

async function createFixtureFiles(): Promise<{
  readonly dir: string;
  readonly dbPath: string;
  readonly oraclePath: string;
  readonly allCardsPath: string;
}> {
  const dir = mkdtempSync(join(tmpdir(), "mtg-agent-cli-"));
  const dbPath = join(dir, "reference.sqlite");
  const oraclePath = join(dir, "oracle-cards.json");
  const allCardsPath = join(dir, "all-cards.json");
  await Bun.write(oraclePath, JSON.stringify(rawOracleCards));
  await Bun.write(allCardsPath, JSON.stringify(rawAllCards));
  return { dir, dbPath, oraclePath, allCardsPath };
}

async function readRepositorySnapshot(dbPath: string) {
  const db = openDatabase(dbPath);
  try {
    initializeDatabaseSchema(db);
    const repository = createSqliteScryfallRepository(db, clock);
    const identities = await repository.listCardIdentities();
    const printings = await repository.listCardPrintings();
    const imports = await repository.listBulkDataImports();
    if (identities.isErr()) throw new Error(identities.error.message);
    if (printings.isErr()) throw new Error(printings.error.message);
    if (imports.isErr()) throw new Error(imports.error.message);
    return {
      identities: identities.value,
      printings: printings.value,
      imports: imports.value,
    };
  } finally {
    closeDatabase(db);
  }
}

const rawOracleCards = [
  {
    object: "card",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    oracle_id: "6ad8011d-3471-4369-9d68-b264cc027487",
    name: "Sol Ring",
    mana_cost: "{1}",
    type_line: "Artifact",
    oracle_text: "{T}: Add {C}{C}.",
    color_identity: [],
    legalities: { commander: "legal" },
    scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
  },
  {
    object: "card",
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    oracle_id: "8b755881-a72d-4e21-a369-d2924eb4585a",
    name: "Cultivate",
    mana_cost: "{2}{G}",
    type_line: "Sorcery",
    oracle_text:
      "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    color_identity: ["G"],
    legalities: { commander: "legal" },
    scryfall_uri: "https://scryfall.com/card/m11/168/cultivate",
  },
] as const;

const rawAllCards = [
  {
    ...rawOracleCards[0],
    id: "11111111-1111-4111-8111-111111111111",
    set: "v10",
    collector_number: "12",
    finishes: ["foil"],
    lang: "en",
  },
  {
    ...rawOracleCards[1],
    id: "22222222-2222-4222-8222-222222222222",
    set: "m11",
    collector_number: "168",
    finishes: ["nonfoil"],
    lang: "en",
  },
] as const;
