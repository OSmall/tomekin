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
import {dispatchScryfallHttp} from "@tomekin/agent";
import {createProviderDispatchOwner} from "@tomekin/core";

import {clock, testLog, createDatabase, runCommand, readRepositorySnapshot, fakeSyncPorts,
  recordsFor, metadata, rawOracleCard, rawAllCard, rawOracleTag, jsonlGzipStream,
  liveMetadata, defaultBulkDataTypeForJsonlUrl, jsonlGzipResponse} from "./fixtures/scryfall-sync";

describe("sync:scryfall command", () => {
  test("reconciles an official merge when all incoming datasets retire the old identity", async () => {
    const paths = createDatabase();
    expect((await runCommand(["--db", paths.dbPath], fakeSyncPorts())).exitCode).toBe(0);
    const replacementIdentity = "33333333-3333-4333-8333-333333333333";
    const replacementPrinting = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const ports = fakeSyncPorts();
    const refreshed = {
      ...ports,
      async downloadBulkData(dataset: ScryfallBulkDataMetadata) {
        const records = recordsFor(dataset.bulkDataType, {}).map((record) => {
          if (dataset.bulkDataType === "oracle_tags") return {...rawOracleTag(), taggings: []};
          return {...record as object, oracle_id: replacementIdentity,
            ...(dataset.bulkDataType === "all_cards" ? {id: replacementPrinting} : {})};
        });
        return ok({bulkDataType: dataset.bulkDataType, sourceUri: dataset.downloadUri,
          sourceUpdatedAt: dataset.sourceUpdatedAt, stream: () => jsonlGzipStream(records)});
      },
      async listCardMigrations() {
        return ok({data: [{object: "migration", id: "44444444-4444-4444-8444-444444444444",
          performed_at: "2025-01-01", migration_strategy: "merge",
          old_scryfall_id: rawAllCard().id, new_scryfall_id: replacementPrinting}], has_more: false});
      },
    };
    const result = await runCommand(["--db", paths.dbPath], refreshed);
    expect(result.exitCode).toBe(0);
    const snapshot = await readRepositorySnapshot(paths.dbPath);
    expect(snapshot.identities.map(card => card.id)).toEqual([replacementIdentity]);
    expect(snapshot.printings.map(card => card.id)).toEqual([replacementPrinting]);
    expect(snapshot.imports.filter(attempt => attempt.status === "succeeded")).toHaveLength(6);
  });

  test("downloads through injected ports and imports default datasets into SQLite", async () => {
    const paths = createDatabase();

    const result = await runCommand(["--db", paths.dbPath], fakeSyncPorts());

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("live Scryfall Bulk Data Sync");
    expect(result.stderr).toContain("Downloading oracle_cards");
    expect(result.stderr).toContain("Importing all_cards");
    expect(result.stderr).toContain("Staged oracle_cards: 1 record.");
    expect(result.stderr).toContain("Staged all_cards: 1 record.");
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
                {log: testLog, apiProvider: createProviderDispatchOwner({dispatch: dispatchScryfallHttp})},
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
    ]);
  });
});
