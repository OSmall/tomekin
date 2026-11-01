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

export const clock = {
  now: () => new Date("2025-01-01T00:00:00.000Z"),
};
export const testLog = createTestRootLoggerFromEnv();

export async function runCommand(
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

export function createDatabase(): {readonly dbPath: string} {
  const dir = mkdtempSync(join(tmpdir(), "tomekin-sync-cli-"));
  const dbPath = join(dir, "reference.sqlite");
  applySqliteMigrations(dbPath, {log: testLog});
  return {dbPath};
}

export async function readRepositorySnapshot(dbPath: string) {
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

export function fakeSyncPorts(
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

export function metadata(): readonly ScryfallBulkDataMetadata[] {
  return ["oracle_cards", "all_cards", "oracle_tags"].map((bulkDataType) => ({
    bulkDataType: bulkDataType as ScryfallBulkDataType,
    sourceUri: `https://api.scryfall.com/bulk-data/${bulkDataType}`,
    downloadUri: `https://data.scryfall.io/${bulkDataType}.jsonl.gz`,
    sourceUpdatedAt: clock.now(),
  }));
}

export function liveMetadata(): readonly Record<string, unknown>[] {
    return ["oracle_cards", "all_cards", "oracle_tags"].map((bulkDataType) => ({
        type: bulkDataType,
        uri: `https://api.scryfall.com/bulk-data/${bulkDataType}`,
        download_uri: `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.json`,
        jsonl_download_uri: `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.jsonl.gz`,
        updated_at: clock.now().toISOString(),
    }));
}

export function defaultBulkDataTypeForJsonlUrl(url: string): ScryfallBulkDataType | null {
    for (const bulkDataType of ["oracle_cards", "all_cards", "oracle_tags"] as const) {
        if (url === `https://data.scryfall.io/${bulkDataType}/${bulkDataType}.jsonl.gz`) {
            return bulkDataType;
        }
    }
    return null;
}

export function jsonlGzipResponse(records: readonly unknown[]): Response {
    return new Response(jsonlGzipStream(records), {status: 200});
}

export function recordsFor(
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

export function jsonlGzipStream(records: readonly unknown[]): ReadableStream<Uint8Array> {
  return new Response(records.map((record) => JSON.stringify(record)).join("\n"))
    .body!.pipeThrough(new CompressionStream("gzip"));
}

export function rawOracleCard() {
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
      legalities: fixtureLegalities(),
    scryfall_uri: "https://scryfall.com/card/v10/12/sol-ring",
  };
}

export function rawAllCard() {
  return {
    ...rawOracleCard(),
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    set_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    set: "v10",
    set_name: "From the Vault: Relics",
    set_type: "from_the_vault",
    set_uri: "https://api.scryfall.com/sets/dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    set_search_uri: "https://api.scryfall.com/cards/search?q=e%3Av10&unique=prints",
    scryfall_set_uri: "https://scryfall.com/sets/v10?utm_source=api",
    collector_number: "12",
    finishes: ["foil"],
    lang: "en",
  };
}

export function fixtureLegalities() {
    return {
        commander: "legal" as const,
        standard: "legal" as const,
        pioneer: "legal" as const,
        modern: "legal" as const,
        legacy: "legal" as const,
        vintage: "legal" as const,
        pauper: "legal" as const
    };
}

export function rawOracleTag() {
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
