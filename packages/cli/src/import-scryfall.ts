import {stat} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {heapStats} from "bun:jsc";
import {
  type Clock,
  createScryfallLocalImportServices,
  type ScryfallBulkDataType,
  ScryfallBulkDataTypeSchema,
  type ScryfallFinalizationPhase,
  type ScryfallImportEvent,
  type ScryfallImportObserver,
} from "@mtg-agent/core";
import {closeDatabase, createSqliteScryfallRepository, openDatabase, resolveDatabasePath,} from "@mtg-agent/sqlite";

const SOURCE_PROGRESS_STEP_PERCENT = 5;
const TIMING_RENDER_INTERVAL_MS = 5_000;

export type ImportScryfallCommandIo = {
  readonly stdout: { write(message: string): void };
  readonly stderr: { write(message: string): void };
};

export type ImportScryfallCommandEnv = {
  readonly MTG_AGENT_DB_PATH?: string | undefined;
};

export async function runImportScryfallCommand(
  args: readonly string[],
  env: ImportScryfallCommandEnv,
  io: ImportScryfallCommandIo,
  clock: Clock = { now: () => new Date() },
): Promise<number> {
  const parsed = parseArgs(args);
  if (parsed.type === "error") {
    io.stderr.write(`${parsed.message}\n${usage()}\n`);
    return 1;
  }

  const dbPath = parsed.dbPath ?? resolveDatabasePath(env);
  const sourcePath = resolve(parsed.sourcePath);
  const timingObserver = parsed.timing ? createCliTimingObserver(io.stderr) : undefined;
  let sourceStat: Awaited<ReturnType<typeof stat>>;

  try {
    sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) {
      io.stderr.write(`Missing Scryfall source file: ${sourcePath}\n`);
      io.stderr.write(`Target database: ${dbPath}\n`);
      return 1;
    }
  } catch {
    io.stderr.write(`Missing Scryfall source file: ${sourcePath}\n`);
    io.stderr.write(`Target database: ${dbPath}\n`);
    return 1;
  }

  const db = openDatabase(dbPath);

  try {
    const repository = createSqliteScryfallRepository(db, clock);
    const services = createScryfallLocalImportServices(repository, clock);
    renderProgressStart(io, {
      dbPath,
      bulkDataType: parsed.bulkDataType,
      sourcePath,
      sourceSizeBytes: sourceStat.size,
    });
    const source = {
      stream: () =>
        withSourceReadProgress(Bun.file(sourcePath).stream(), {
          io,
          clock,
          totalBytes: sourceStat.size,
          observer: timingObserver,
        }),
    };
    const metadata = {
      sourceUri: pathToFileURL(sourcePath).href,
      sourceUpdatedAt: sourceStat.mtime,
    };

    const result =
      parsed.bulkDataType === "oracle_cards"
        ? await services.importOracleCards(source, metadata, {
            observer: timingObserver,
          })
        : parsed.bulkDataType === "oracle_tags"
          ? await services.importOracleTags(source, metadata, {
              observer: timingObserver,
            })
        : await services.importAllCards(source, metadata, {
            observer: timingObserver,
          });
    timingObserver?.finish();

    if (result.isOk()) {
      renderSuccess(io, {
        dbPath,
        bulkDataType: parsed.bulkDataType,
        sourcePath,
        importedRecordCount: result.value.importedRecordCount,
      });
      return 0;
    }

    renderFailure(io, {
      dbPath,
      bulkDataType: parsed.bulkDataType,
      sourcePath,
      errors:
        result.error.type === "import_failed"
          ? result.error.importAttempt.blockingErrors
          : [result.error.message],
    });
    return 1;
  } finally {
    closeDatabase(db);
  }
}

type ParsedArgs =
  | {
      readonly type: "ok";
      readonly bulkDataType: ScryfallBulkDataType;
      readonly sourcePath: string;
      readonly dbPath?: string;
      readonly timing: boolean;
    }
  | { readonly type: "error"; readonly message: string };

function parseArgs(args: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  let dbPath: string | undefined;
  let timing = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--db") {
      const value = args[index + 1];
      if (!value) {
        return { type: "error", message: "Missing value for --db." };
      }
      dbPath = value;
      index += 1;
      continue;
    }

    if (arg === "--timing") {
      timing = true;
      continue;
    }

    if (arg?.startsWith("--")) {
      return { type: "error", message: `Unknown option: ${arg}.` };
    }

    if (arg) {
      positional.push(arg);
    }
  }

  if (positional.length !== 2) {
    return {
      type: "error",
      message: "Expected one bulk data type and one local JSON file path.",
    };
  }

  const bulkDataType = ScryfallBulkDataTypeSchema.safeParse(positional[0]);
  if (!bulkDataType.success) {
    return {
      type: "error",
      message: "Supported bulk data types are oracle_cards, all_cards, and oracle_tags.",
    };
  }

  return {
    type: "ok",
    bulkDataType: bulkDataType.data,
    sourcePath: positional[1]!,
    timing,
    ...(dbPath ? { dbPath } : {}),
  };
}

function renderSuccess(
  io: ImportScryfallCommandIo,
  summary: {
    readonly dbPath: string;
    readonly bulkDataType: ScryfallBulkDataType;
    readonly sourcePath: string;
    readonly importedRecordCount: number;
  },
): void {
  io.stdout.write(`Scryfall Bulk Data Import succeeded.\n`);
  io.stdout.write(`Target database: ${summary.dbPath}\n`);
  io.stdout.write(`Imported bulk data type: ${summary.bulkDataType}\n`);
  io.stdout.write(`Imported record count: ${summary.importedRecordCount}\n`);
  io.stdout.write(`Source file: ${summary.sourcePath}\n`);
  io.stdout.write(`No live Scryfall network call was made.\n`);
}

function renderProgressStart(
  io: ImportScryfallCommandIo,
  summary: {
    readonly dbPath: string;
    readonly bulkDataType: ScryfallBulkDataType;
    readonly sourcePath: string;
    readonly sourceSizeBytes: number;
  },
): void {
  io.stderr.write(`Starting Scryfall Bulk Data Import: ${summary.bulkDataType}\n`);
  io.stderr.write(`Target database: ${summary.dbPath}\n`);
  io.stderr.write(`Source file: ${summary.sourcePath}\n`);
  io.stderr.write(`Source size: ${formatBytes(summary.sourceSizeBytes)}\n`);
}

function withSourceReadProgress(
  stream: ReadableStream<Uint8Array>,
  progress: {
    readonly io: ImportScryfallCommandIo;
    readonly clock: Clock;
    readonly totalBytes: number;
    readonly observer?: ScryfallImportObserver | undefined;
  },
): ReadableStream<Uint8Array> {
  let bytesRead = 0;
  let nextPercent = SOURCE_PROGRESS_STEP_PERCENT;
  let lastReportedPercent = 0;
  let finalizingReported = false;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesRead += chunk.byteLength;
        progress.observer?.onEvent({
          type: "source_bytes_consumed",
          bytesConsumed: bytesRead,
          totalBytes: progress.totalBytes,
        });
        controller.enqueue(chunk);
        reportSourceReadProgress(progress.io, {
          clock: progress.clock,
          bytesRead,
          totalBytes: progress.totalBytes,
          nextPercent,
          lastReportedPercent,
        });

        const currentPercent = percentComplete(bytesRead, progress.totalBytes);
        if (currentPercent >= nextPercent) {
          lastReportedPercent = currentPercent;
          nextPercent = Math.floor(currentPercent / SOURCE_PROGRESS_STEP_PERCENT + 1) *
            SOURCE_PROGRESS_STEP_PERCENT;
        }
        if (currentPercent >= 100 && !finalizingReported) {
          progress.io.stderr.write(
            `Finished reading source file; finalizing database import...\n`,
          );
          finalizingReported = true;
        }
      },
      flush() {
        if (progress.totalBytes === 0) {
          progress.io.stderr.write(
            `Read source: 0 B at ${formatTimestamp(progress.clock.now())}; finalizing database import...\n`,
          );
          return;
        }

        if (lastReportedPercent < 100) {
          progress.io.stderr.write(
            `Read source: 100% (${formatBytes(bytesRead)} of ${formatBytes(progress.totalBytes)}) at ${formatTimestamp(progress.clock.now())}\n`,
          );
        }
        if (!finalizingReported) {
          progress.io.stderr.write(
            `Finished reading source file; finalizing database import...\n`,
          );
        }
      },
    }),
  );
}

function reportSourceReadProgress(
  io: ImportScryfallCommandIo,
  progress: {
    readonly clock: Clock;
    readonly bytesRead: number;
    readonly totalBytes: number;
    readonly nextPercent: number;
    readonly lastReportedPercent: number;
  },
): void {
  if (progress.totalBytes <= 0) {
    return;
  }

  const currentPercent = percentComplete(progress.bytesRead, progress.totalBytes);
  if (currentPercent < progress.nextPercent || currentPercent === progress.lastReportedPercent) {
    return;
  }

  io.stderr.write(
    `Read source: ${currentPercent}% (${formatBytes(progress.bytesRead)} of ${formatBytes(progress.totalBytes)}) at ${formatTimestamp(progress.clock.now())}\n`,
  );
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function percentComplete(bytesRead: number, totalBytes: number): number {
  if (totalBytes <= 0) {
    return 100;
  }
  return Math.min(100, Math.floor((bytesRead / totalBytes) * 100));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  return `${(kib / 1024).toFixed(1)} MiB`;
}

type CliTimingObserver = ScryfallImportObserver & {
  finish(): void;
};

type TimingState = {
  readonly startedAtMs: number;
  lastRenderedAtMs: number;
  bytesConsumed: number;
  totalBytes: number | null;
  rawRecordCount: number;
  mappedRecordCount: number;
  stagedRecordCount: number;
  validationErrorCount: number;
  finalizationPhases: Partial<Record<ScryfallFinalizationPhase, number>>;
};

function createCliTimingObserver(
  stderr: ImportScryfallCommandIo["stderr"],
): CliTimingObserver {
  const now = performance.now();
  const state: TimingState = {
    startedAtMs: now,
    lastRenderedAtMs: now,
    bytesConsumed: 0,
    totalBytes: null,
    rawRecordCount: 0,
    mappedRecordCount: 0,
    stagedRecordCount: 0,
    validationErrorCount: 0,
    finalizationPhases: {},
  };

  return {
    onEvent(event) {
      applyTimingEvent(state, event);
      maybeRenderTiming(stderr, state, false);
    },
    finish() {
      renderTiming(stderr, state, true);
    },
  };
}

function applyTimingEvent(state: TimingState, event: ScryfallImportEvent): void {
  switch (event.type) {
    case "source_bytes_consumed":
      state.bytesConsumed = event.bytesConsumed;
      state.totalBytes = event.totalBytes ?? null;
      return;
    case "raw_record_parsed":
      state.rawRecordCount = event.rawRecordCount;
      return;
    case "record_mapped":
      state.mappedRecordCount = event.mappedRecordCount;
      return;
    case "source_validation_failed":
      state.validationErrorCount = event.validationErrorCount;
      return;
    case "record_staged":
      state.stagedRecordCount = event.stagedRecordCount;
      return;
    case "finalization_started":
      return;
    case "finalization_finished":
      state.finalizationPhases[event.phase] =
        (state.finalizationPhases[event.phase] ?? 0) + event.elapsedMs;
      return;
  }
}

function maybeRenderTiming(
  stderr: ImportScryfallCommandIo["stderr"],
  state: TimingState,
  final: boolean,
): void {
  const now = performance.now();
  if (!final && now - state.lastRenderedAtMs < TIMING_RENDER_INTERVAL_MS) {
    return;
  }

  renderTiming(stderr, state, final);
}

function renderTiming(
  stderr: ImportScryfallCommandIo["stderr"],
  state: TimingState,
  final: boolean,
): void {
  const now = performance.now();
  const elapsedMs = now - state.startedAtMs;
  state.lastRenderedAtMs = now;
  const source = state.totalBytes === null
    ? formatBytes(state.bytesConsumed)
    : `${percentComplete(state.bytesConsumed, state.totalBytes)}% (${formatBytes(state.bytesConsumed)} of ${formatBytes(state.totalBytes)})`;
  const validation = state.validationErrorCount > 0
    ? `; validation errors ${state.validationErrorCount}`
    : "";

  stderr.write(
      `[timing] ${final ? "final" : "interval"}: ${formatDuration(elapsedMs)} elapsed; source ${source}; raw ${state.rawRecordCount}; mapped ${state.mappedRecordCount}; staged ${state.stagedRecordCount}${validation}${formatFinalizationPhases(state.finalizationPhases)}${formatJavaScriptHeapStats()}\n`,
  );
}

function formatFinalizationPhases(
  phases: Partial<Record<ScryfallFinalizationPhase, number>>,
): string {
  const entries = Object.entries(phases);
  if (entries.length === 0) return "";

  return `; finalization ${entries
    .map(([phase, elapsedMs]) => `${phase} ${formatDuration(elapsedMs ?? 0)}`)
    .join(", ")}`;
}

function formatJavaScriptHeapStats(): string {
  try {
    const stats = heapStats() as { readonly heapSize?: number | undefined };
    return typeof stats.heapSize === "number"
      ? `; js heap ${formatBytes(stats.heapSize)}`
      : "";
  } catch {
    return "";
  }
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs.toFixed(0)} ms`;
  }
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function renderFailure(
  io: ImportScryfallCommandIo,
  summary: {
    readonly dbPath: string;
    readonly bulkDataType: ScryfallBulkDataType;
    readonly sourcePath: string;
    readonly errors: readonly string[];
  },
): void {
  io.stderr.write(`Scryfall Bulk Data Import failed.\n`);
  io.stderr.write(`Failed dataset: ${summary.bulkDataType}\n`);
  io.stderr.write(`Previous usable dataset was preserved.\n`);
  io.stderr.write(`Target database: ${summary.dbPath}\n`);
  io.stderr.write(`Source file: ${summary.sourcePath}\n`);
  for (const error of summary.errors) {
    io.stderr.write(`Blocking error: ${error}\n`);
  }
}

function usage(): string {
  return `Usage: bun run import:scryfall -- [--timing] [--db <path>] <oracle_cards|all_cards|oracle_tags> <path>`;
}

if (import.meta.main) {
  const exitCode = await runImportScryfallCommand(
    process.argv.slice(2),
    { MTG_AGENT_DB_PATH: process.env.MTG_AGENT_DB_PATH },
    {
      stdout: { write: (message) => process.stdout.write(message) },
      stderr: { write: (message) => process.stderr.write(message) },
    },
  );
  process.exit(exitCode);
}
