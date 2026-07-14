import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {runSyncScryfallCommand} from "@tomekin/cli";
import {
    createTestRootLoggerFromEnv,
    type ScryfallBulkDataMetadata,
    type ScryfallBulkDataSyncPorts,
    type ScryfallBulkDataType
} from "@tomekin/core";
import {applySqliteMigrations, closeDatabase, createSqliteScryfallRepository, openDatabase} from "@tomekin/sqlite";
import {ok} from "neverthrow";

const clock = {
  now: () => new Date("2025-01-01T00:00:00.000Z"),
};
const testLog = createTestRootLoggerFromEnv();

describe("sync:scryfall command", () => {
  test("downloads through injected ports and imports default datasets into SQLite", async () => {
    const paths = createDatabase();

    const result = await runCommand(["--db", paths.dbPath], fakeSyncPorts());

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("live Scryfall Bulk Data Sync");
    expect(result.stderr).toContain("Downloading oracle_cards");
    expect(result.stderr).toContain("Importing all_cards");
    expect(result.stdout).toContain("Scryfall Bulk Data Sync succeeded");
    expect(result.stdout).toContain("Imported oracle_tags: 1 records");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.identities.map((card) => card.name)).toEqual(["Sol Ring"]);
    expect(snapshot.printings.map((printing) => printing.id)).toEqual([
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
    expect(snapshot.tags.map((tag) => tag.slug)).toEqual(["mana-rock"]);
    expect(snapshot.imports.map((attempt) => attempt.bulkDataType)).toEqual([
      "oracle_cards",
      "all_cards",
      "oracle_tags",
    ]);
  });

    test("uses Scryfall jsonl_download_uri when live metadata provides it", async () => {
        const paths = createDatabase();
        const originalFetch = globalThis.fetch;
        const requestedUrls: string[] = [];
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            requestedUrls.push(url);
            if (url === "https://api.scryfall.com/bulk-data") {
                return new Response(JSON.stringify({data: liveMetadata()}), {status: 200});
            }

            const bulkDataType = defaultBulkDataTypeForJsonlUrl(url);
            if (!bulkDataType) return new Response(null, {status: 404});
            return jsonlGzipResponse(recordsFor(bulkDataType, {}));
        }) as typeof fetch;

        try {
            const result = await runSyncScryfallCommand(
                ["--db", paths.dbPath],
                {},
                {
                    stdout: {write: () => undefined},
                    stderr: {write: () => undefined},
                },
                clock,
                {log: testLog},
            );

            expect(result).toBe(0);
            expect(requestedUrls).toContain("https://data.scryfall.io/oracle_cards/oracle_cards.jsonl.gz");
            expect(requestedUrls).toContain("https://data.scryfall.io/all_cards/all_cards.jsonl.gz");
            expect(requestedUrls).toContain("https://data.scryfall.io/oracle_tags/oracle_tags.jsonl.gz");
            expect(requestedUrls).not.toContain("https://data.scryfall.io/oracle_cards/oracle_cards.json");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

  test("failed sync preserves previously imported SQLite datasets", async () => {
    const paths = createDatabase();
    expect((await runCommand(["--db", paths.dbPath], fakeSyncPorts())).exitCode).toBe(0);

    const result = await runCommand(
      ["--db", paths.dbPath],
      fakeSyncPorts({badAllCardsOracleId: true}),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Scryfall Bulk Data Sync failed");
    expect(result.stderr).toContain("Previous usable datasets were preserved");

    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.printings.map((printing) => printing.id)).toEqual([
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);
    expect(snapshot.imports.map((attempt) => attempt.status)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
      "succeeded",
      "failed",
    ]);
  });
});

async function runCommand(
  args: readonly string[],
  syncPorts: ScryfallBulkDataSyncPorts,
): Promise<{readonly exitCode: number; readonly stdout: string; readonly stderr: string}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runSyncScryfallCommand(
    args,
    {},
    {
      stdout: {write: (message) => (stdout += message)},
      stderr: {write: (message) => (stderr += message)},
    },
    clock,
    {log: testLog, syncPorts},
  );
  return {exitCode, stdout, stderr};
}

function createDatabase(): {readonly dbPath: string} {
  const dir = mkdtempSync(join(tmpdir(), "tomekin-sync-cli-"));
  const dbPath = join(dir, "reference.sqlite");
  applySqliteMigrations(dbPath, {log: testLog});
  return {dbPath};
}

async function readRepositorySnapshot(dbPath: string) {
  const db = openDatabase(dbPath, {log: testLog});
  try {
    const repository = createSqliteScryfallRepository(db, clock);
    const identities = await repository.listCardIdentities();
    const printings = await repository.listCardPrintings();
    const tags = await repository.listCardIdentityTags();
    const imports = await repository.listBulkDataImports();
    if (identities.isErr()) throw new Error(identities.error.message);
    if (printings.isErr()) throw new Error(printings.error.message);
    if (tags.isErr()) throw new Error(tags.error.message);
    if (imports.isErr()) throw new Error(imports.error.message);
    return {
      identities: identities.value,
      printings: printings.value,
      tags: tags.value,
      imports: imports.value,
    };
  } finally {
    closeDatabase(db);
  }
}

function fakeSyncPorts(
  options: {readonly badAllCardsOracleId?: boolean} = {},
): ScryfallBulkDataSyncPorts {
  return {
    async listBulkDataMetadata() {
      return ok(metadata());
    },
    async downloadBulkData(dataset) {
      return ok({
        bulkDataType: dataset.bulkDataType,
        sourceUri: dataset.downloadUri,
        sourceUpdatedAt: dataset.sourceUpdatedAt,
        stream: () => jsonlGzipStream(recordsFor(dataset.bulkDataType, options)),
      });
    },
  };
}

function metadata(): readonly ScryfallBulkDataMetadata[] {
  return ["oracle_cards", "all_cards", "oracle_tags"].map((bulkDataType) => ({
    bulkDataType: bulkDataType as ScryfallBulkDataType,
    sourceUri: `https://api.scryfall.com/bulk-data/${bulkDataType}`,
    downloadUri: `https://data.scryfall.io/${bulkDataType}.jsonl.gz`,
    sourceUpdatedAt: clock.now(),
  }));
}

function liveMetadata(): readonly Record<string, unknown>[] {
    return ["oracle_cards", "all_cards", "oracle_tags"].map((bulkDataType) => ({
        type: bulkDataType,
        uri: `https://api.scryfall.com/bulk-data/${bulkDataType}`,
        download_uri: `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.json`,
        jsonl_download_uri: `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.jsonl.gz`,
        updated_at: clock.now().toISOString(),
    }));
}

function defaultBulkDataTypeForJsonlUrl(url: string): ScryfallBulkDataType | null {
    for (const bulkDataType of ["oracle_cards", "all_cards", "oracle_tags"] as const) {
        if (url === `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.jsonl.gz`) {
            return bulkDataType;
        }
    }
    return null;
}

function jsonlGzipResponse(records: readonly unknown[]): Response {
    return new Response(jsonlGzipStream(records), {status: 200});
}

function recordsFor(
  bulkDataType: ScryfallBulkDataType,
  options: {readonly badAllCardsOracleId?: boolean},
): readonly unknown[] {
  if (bulkDataType === "oracle_cards") return [rawOracleCard()];
  if (bulkDataType === "all_cards") {
    return [
      options.badAllCardsOracleId
        ? {...rawAllCard(), oracle_id: "99999999-9999-4999-8999-999999999999"}
        : rawAllCard(),
    ];
  }
  return [rawOracleTag()];
}

function jsonlGzipStream(records: readonly unknown[]): ReadableStream<Uint8Array> {
  return new Response(records.map((record) => JSON.stringify(record)).join("\n"))
    .body!.pipeThrough(new CompressionStream("gzip"));
}

function rawOracleCard() {
  return {
    object: "card",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    oracle_id: "22222222-2222-4222-8222-222222222222",
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
  };
}

function rawAllCard() {
  return {
    ...rawOracleCard(),
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    set: "v10",
    collector_number: "12",
    finishes: ["foil"],
    lang: "en",
  };
}

function rawOracleTag() {
  return {
    object: "tag",
    id: "11111111-1111-4111-8111-111111111111",
    label: "mana rock",
    slug: "mana-rock",
    type: "oracle",
    uri: "https://tagger.scryfall.com/tags/card/mana-rock",
    description: null,
    parent_ids: [],
    child_ids: [],
    aliases: ["mana-stone"],
    taggings: [
      {
        oracle_id: "22222222-2222-4222-8222-222222222222",
        weight: "very_strong",
        annotation: "format staple",
      },
    ],
  };
}
