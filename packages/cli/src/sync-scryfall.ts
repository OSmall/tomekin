import {mkdtemp, rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {err, ok} from "neverthrow";
import {
    type Clock,
    createRootLogger,
    createScryfallSyncServices,
    defaultScryfallSyncBulkDataTypes,
    type LogComponent,
    type Logger,
    resolveLogConfigFromEnv,
    type ScryfallBulkDataMetadata,
    type ScryfallBulkDataSyncPorts,
    type ScryfallBulkDataType,
    ScryfallBulkDataTypeSchema,
    type ScryfallImportEvent,
    type ScryfallImportObserver,
    type ScryfallSyncEvent,
    type ScryfallSyncObserver,
    serializeError,
} from "@mtg-agent/core";
import {closeDatabase, createSqliteScryfallRepository, openDatabase, resolveDatabasePath} from "@mtg-agent/sqlite";

const SCRYFALL_BULK_DATA_URL = "https://api.scryfall.com/bulk-data";
const USER_AGENT = "mtg-agent-alpha/0.0.0";

export type SyncScryfallCommandIo = {
  readonly stdout: { write(message: string): void };
  readonly stderr: { write(message: string): void };
};

export type SyncScryfallCommandEnv = {
  readonly MTG_AGENT_DB_PATH?: string | undefined;
};

export type SyncScryfallCommandRuntime = {
  readonly log: Logger;
  readonly syncPorts?: ScryfallBulkDataSyncPorts | undefined;
};

export async function runSyncScryfallCommand(
  args: readonly string[],
  env: SyncScryfallCommandEnv,
  io: SyncScryfallCommandIo,
  clock: Clock = {now: () => new Date()},
  runtime: SyncScryfallCommandRuntime,
): Promise<number> {
  const startedAtMs = performance.now();
  const logger = runtime.log.child({component: "cli" satisfies LogComponent, command: "sync:scryfall"});
  const parsed = parseArgs(args);
  if (parsed.type === "error") {
    logger.warn({operation: "parse_args", status: "failed", message: parsed.message}, "Scryfall sync command argument parsing failed");
    io.stderr.write(`${parsed.message}\n${usage()}\n`);
    return 1;
  }

  const dbPath = parsed.dbPath ?? resolveDatabasePath(env);
  const bulkDataTypes = parsed.bulkDataTypes;
  const context = {operation: "sync_scryfall", bulkDataTypes, databasePath: dbPath};
  logger.info({...context, status: "started"}, "Scryfall sync command started");
  renderStart(io, {dbPath, bulkDataTypes});

  const db = openDatabase(dbPath, {log: runtime.log});
  const temporaryPorts = runtime.syncPorts ? null : await createBunScryfallSyncPorts();

  try {
    const repository = createSqliteScryfallRepository(db, clock);
    const services = createScryfallSyncServices(
      repository,
      clock,
      runtime.syncPorts ?? temporaryPorts!.ports,
    );
      const importLogState: SyncImportLogState = {currentBulkDataType: null};
      const observer = createCliSyncObserver(io, importLogState);
      const importObserver = createLoggingImportObserver(logger, context, importLogState);
      const result = await services.syncScryfallData({bulkDataTypes: [...bulkDataTypes]}, {observer, importObserver});

    if (result.isOk()) {
      renderSuccess(io, {dbPath, bulkDataTypes: result.value.bulkDataTypes, importedRecordCounts: result.value.importedRecordCounts});
      logger.info({...context, status: "succeeded", durationMs: elapsedMs(startedAtMs), importedRecordCounts: result.value.importedRecordCounts}, "Scryfall sync command succeeded");
      return 0;
    }

    logger.error({...context, status: "failed", durationMs: elapsedMs(startedAtMs), error: result.error}, "Scryfall sync command failed");
    renderFailure(io, {dbPath, message: result.error.message});
    return 1;
  } catch (error) {
    logger.error({...context, status: "failed", durationMs: elapsedMs(startedAtMs), error: serializeError(error)}, "Scryfall sync command failed unexpectedly");
    renderFailure(io, {dbPath, message: error instanceof Error ? error.message : String(error)});
    return 1;
  } finally {
    closeDatabase(db);
    if (temporaryPorts) {
      await temporaryPorts.cleanup();
    }
  }
}

type ParsedArgs =
  | {
      readonly type: "ok";
      readonly dbPath?: string;
      readonly bulkDataTypes: readonly ScryfallBulkDataType[];
    }
  | {readonly type: "error"; readonly message: string};

function parseArgs(args: readonly string[]): ParsedArgs {
  let dbPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--db") {
      const value = args[index + 1];
      if (!value) return {type: "error", message: "Missing value for --db."};
      dbPath = value;
      index += 1;
      continue;
    }

    if (arg?.startsWith("--")) {
      return {type: "error", message: `Unknown option: ${arg}.`};
    }

    if (arg) {
      return {type: "error", message: "sync:scryfall imports the default Scryfall datasets; partial live sync is not supported."};
    }
  }

  return {
    type: "ok",
    ...(dbPath ? {dbPath} : {}),
    bulkDataTypes: defaultScryfallSyncBulkDataTypes,
  };
}

type SyncImportLogState = {
    currentBulkDataType: ScryfallBulkDataType | null;
};

function createCliSyncObserver(
    io: SyncScryfallCommandIo,
    importLogState?: SyncImportLogState,
): ScryfallSyncObserver {
  return {
    onEvent(event) {
        if (event.type === "import_started") {
            if (importLogState) importLogState.currentBulkDataType = event.bulkDataType;
        }
        if (event.type === "import_finished") {
            if (importLogState) importLogState.currentBulkDataType = null;
        }
      renderSyncEvent(io, event);
    },
  };
}

function createLoggingImportObserver(
    logger: Logger,
    context: {
        readonly operation: string;
        readonly bulkDataTypes: readonly ScryfallBulkDataType[];
        readonly databasePath: string
    },
    state: SyncImportLogState,
): ScryfallImportObserver {
    return {
        onEvent(event) {
            logImportEvent(logger, context, state.currentBulkDataType, event);
        },
    };
}

function logImportEvent(
    logger: Logger,
    context: {
        readonly operation: string;
        readonly bulkDataTypes: readonly ScryfallBulkDataType[];
        readonly databasePath: string
    },
    bulkDataType: ScryfallBulkDataType | null,
    event: ScryfallImportEvent,
): void {
    const fields = {...context, operation: "sync_scryfall_import", bulkDataType};
    switch (event.type) {
        case "finalization_started":
            logger.info({
                ...fields,
                phase: event.phase,
                status: "started"
            }, "Scryfall import finalization phase started");
            return;
        case "finalization_finished":
            logger.info({
                ...fields,
                phase: event.phase,
                status: "succeeded",
                durationMs: Math.round(event.elapsedMs)
            }, "Scryfall import finalization phase finished");
            return;
        case "source_validation_failed":
            logger.warn({
                ...fields,
                validationErrorCount: event.validationErrorCount,
                status: "failed"
            }, "Scryfall import source validation failed");
            return;
        case "source_bytes_consumed":
            logger.debug({
                ...fields,
                bytesConsumed: event.bytesConsumed,
                totalBytes: event.totalBytes
            }, "Scryfall import source bytes consumed");
            return;
        case "raw_record_parsed":
            logger.debug({...fields, rawRecordCount: event.rawRecordCount}, "Scryfall import raw records parsed");
            return;
        case "record_mapped":
            logger.debug({...fields, mappedRecordCount: event.mappedRecordCount}, "Scryfall import records mapped");
            return;
        case "record_staged":
            logger.debug({...fields, stagedRecordCount: event.stagedRecordCount}, "Scryfall import records staged");
            return;
    }
}

function renderSyncEvent(io: SyncScryfallCommandIo, event: ScryfallSyncEvent): void {
  switch (event.type) {
    case "metadata_fetch_started":
      io.stderr.write("Fetching Scryfall bulk metadata from the live Bulk Data API...\n");
      return;
    case "metadata_fetch_finished":
      io.stderr.write(`Resolved ${event.datasetCount} Scryfall bulk metadata entries.\n`);
      return;
    case "download_started":
      io.stderr.write(`Downloading ${event.bulkDataType}: ${event.sourceUri}\n`);
      return;
    case "download_finished":
      io.stderr.write(`Downloaded ${event.bulkDataType}.\n`);
      return;
    case "import_started":
      io.stderr.write(`Importing ${event.bulkDataType} into local SQLite...\n`);
      return;
    case "import_finished":
      io.stderr.write(`Imported ${event.bulkDataType}: ${event.importedRecordCount} records.\n`);
      return;
  }
}

async function createBunScryfallSyncPorts(): Promise<{
  readonly ports: ScryfallBulkDataSyncPorts;
  cleanup(): Promise<void>;
}> {
  const tempDir = await mkdtemp(join(tmpdir(), "mtg-agent-scryfall-sync-"));
  const ports: ScryfallBulkDataSyncPorts = {
    async listBulkDataMetadata() {
      try {
        const response = await fetch(SCRYFALL_BULK_DATA_URL, {
          headers: {"User-Agent": USER_AGENT, Accept: "application/json"},
        });
        if (!response.ok) {
          return err({message: `Scryfall bulk metadata request failed with HTTP ${response.status}.`});
        }
        const body = await response.json();
        return ok(parseBulkDataMetadata(body));
      } catch (error) {
        return err({message: error instanceof Error ? error.message : String(error)});
      }
    },
    async downloadBulkData(metadata) {
      try {
        const response = await fetch(metadata.downloadUri, {
          headers: {"User-Agent": USER_AGENT},
        });
        if (!response.ok || !response.body) {
          return err({message: `Scryfall download failed with HTTP ${response.status}.`});
        }
        const path = join(tempDir, `${metadata.bulkDataType}.jsonl.gz`);
        await Bun.write(path, await response.arrayBuffer());
        return ok({
          bulkDataType: metadata.bulkDataType,
          sourceUri: metadata.downloadUri,
          sourceUpdatedAt: metadata.sourceUpdatedAt,
          stream: () => Bun.file(path).stream(),
        });
      } catch (error) {
        return err({message: error instanceof Error ? error.message : String(error)});
      }
    },
  };

  return {
    ports,
    cleanup: () => rm(tempDir, {recursive: true, force: true}),
  };
}

function parseBulkDataMetadata(body: unknown): readonly ScryfallBulkDataMetadata[] {
  if (typeof body !== "object" || body === null || !Array.isArray((body as {data?: unknown}).data)) {
    throw new Error("Unexpected Scryfall bulk metadata response shape.");
  }

  const metadata: ScryfallBulkDataMetadata[] = [];
  for (const item of (body as {data: readonly unknown[]}).data) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const bulkDataType = ScryfallBulkDataTypeSchema.safeParse(record.type);
    if (!bulkDataType.success) continue;
      const downloadUri =
          typeof record.jsonl_download_uri === "string"
              ? record.jsonl_download_uri
              : record.download_uri;
      if (typeof downloadUri !== "string") {
          throw new Error(`Scryfall metadata for ${bulkDataType.data} is missing a download URI.`);
    }
    const updatedAt = typeof record.updated_at === "string" ? new Date(record.updated_at) : undefined;
    metadata.push({
      bulkDataType: bulkDataType.data,
        sourceUri: typeof record.uri === "string" ? record.uri : downloadUri,
        downloadUri,
      ...(updatedAt && !Number.isNaN(updatedAt.valueOf()) ? {sourceUpdatedAt: updatedAt} : {}),
    });
  }
  return metadata;
}

function renderStart(io: SyncScryfallCommandIo, summary: {readonly dbPath: string; readonly bulkDataTypes: readonly ScryfallBulkDataType[]}): void {
  io.stderr.write("Starting explicit live Scryfall Bulk Data Sync.\n");
  io.stderr.write("This command will make live network calls to Scryfall.\n");
  io.stderr.write(`Target database: ${summary.dbPath}\n`);
  io.stderr.write(`Datasets: ${summary.bulkDataTypes.join(", ")}\n`);
}

function renderSuccess(io: SyncScryfallCommandIo, summary: {readonly dbPath: string; readonly bulkDataTypes: readonly ScryfallBulkDataType[]; readonly importedRecordCounts: Readonly<Record<ScryfallBulkDataType, number>>}): void {
  io.stdout.write("Scryfall Bulk Data Sync succeeded.\n");
  io.stdout.write(`Target database: ${summary.dbPath}\n`);
  for (const bulkDataType of summary.bulkDataTypes) {
    io.stdout.write(`Imported ${bulkDataType}: ${summary.importedRecordCounts[bulkDataType]} records\n`);
  }
}

function renderFailure(io: SyncScryfallCommandIo, summary: {readonly dbPath: string; readonly message: string}): void {
  io.stderr.write("Scryfall Bulk Data Sync failed.\n");
  io.stderr.write("Previous usable datasets were preserved for failed imports.\n");
  io.stderr.write(`Target database: ${summary.dbPath}\n`);
  io.stderr.write(`Blocking error: ${summary.message}\n`);
}

function usage(): string {
  return "Usage: bun run sync:scryfall -- [--db <path>]";
}

function elapsedMs(startedAtMs: number): number {
  return Math.round(performance.now() - startedAtMs);
}

if (import.meta.main) {
  const log = createRootLogger(resolveLogConfigFromEnv(process.env));
  const exitCode = await runSyncScryfallCommand(
    process.argv.slice(2),
    {MTG_AGENT_DB_PATH: process.env.MTG_AGENT_DB_PATH},
    {
      stdout: {write: (message) => process.stdout.write(message)},
      stderr: {write: (message) => process.stderr.write(message)},
    },
    {now: () => new Date()},
    {log},
  );
  process.exit(exitCode);
}
