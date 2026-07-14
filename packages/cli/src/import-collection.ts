import {stat} from "node:fs/promises";
import {resolve} from "node:path";
import {
    type Clock,
    createCollectionImportServices,
    createRootLogger,
    type LogComponent,
    type Logger,
    resolveLogConfigFromEnv,
    serializeError
} from "@tomekin/core";
import {closeDatabase, createSqliteCollectionRepository, openDatabase, resolveDatabasePath} from "@tomekin/sqlite";

export type ImportCollectionCommandIo = {
    readonly stdout: { write(message: string): void };
    readonly stderr: { write(message: string): void };
};

export type ImportCollectionCommandEnv = {
    readonly TOMEKIN_DB_PATH?: string | undefined;
};

export type ImportCollectionCommandRuntime = {
    readonly log: Logger;
};

export async function runImportCollectionCommand(
    args: readonly string[],
    env: ImportCollectionCommandEnv,
    io: ImportCollectionCommandIo,
    clock: Clock = {now: () => new Date()},
    runtime: ImportCollectionCommandRuntime,
): Promise<number> {
    const startedAtMs = performance.now();
    const logger = runtime.log.child({component: "cli" satisfies LogComponent, command: "import:collection"});
    const parsed = parseArgs(args);
    if (parsed.type === "error") {
        logger.warn({operation: "parse_args", status: "failed", message: parsed.message}, "Collection import command argument parsing failed");
        io.stderr.write(`${parsed.message}\n${usage()}\n`);
        return 1;
    }

    const dbPath = parsed.dbPath ?? resolveDatabasePath(env);
    const sourcePath = resolve(parsed.sourcePath);
    const context = {operation: "import_collection", source: parsed.source, sourcePath, databasePath: dbPath};
    logger.info({...context, status: "started"}, "Collection import command started");
    try {
        const sourceStat = await stat(sourcePath);
        if (!sourceStat.isFile()) throw new Error("not a file");
    } catch (error) {
        logger.error({...context, status: "failed", durationMs: elapsedMs(startedAtMs), error: serializeError(error)}, "Collection import source file was missing");
        io.stderr.write(`Missing Collection source file: ${sourcePath}\n`);
        io.stderr.write(`Target database: ${dbPath}\n`);
        return 1;
    }

    const csvText = await Bun.file(sourcePath).text();
    const db = openDatabase(dbPath, {log: runtime.log});
    try {
        const repository = createSqliteCollectionRepository(db, clock);
        const services = createCollectionImportServices(repository, clock);
        const result = await services.importManaBoxCollectionCsv({sourcePath, csvText});
        if (result.isErr()) {
            logger.error({...context, status: "failed", durationMs: elapsedMs(startedAtMs), error: result.error}, "Collection import command failed");
            if (result.error.type === "import_failed") {
                for (const warning of result.error.importAttempt.warnings) io.stderr.write(`Warning: ${warning}\n`);
                for (const error of result.error.importAttempt.errors) io.stderr.write(`Error: ${error}\n`);
            } else {
                io.stderr.write(`Error: ${result.error.message}\n`);
            }
            io.stderr.write(`Previous Collection snapshot was preserved.\n`);
            return 1;
        }

        for (const warning of result.value.warnings) io.stderr.write(`Warning: ${warning}\n`);
        renderSuccess(io, result.value);
        logger.info({...context, status: "succeeded", durationMs: elapsedMs(startedAtMs), importedRowCount: result.value.importedRowCount, totalQuantity: result.value.totalQuantity, warningCount: result.value.warningCount}, "Collection import command succeeded");
        return 0;
    } finally {
        closeDatabase(db);
    }
}

type ParsedArgs =
    | {
    readonly type: "ok";
    readonly source: "manabox";
    readonly sourcePath: string;
    readonly dbPath?: string | undefined
}
    | { readonly type: "error"; readonly message: string };

function parseArgs(args: readonly string[]): ParsedArgs {
    const positional: string[] = [];
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
        if (arg?.startsWith("--")) return {type: "error", message: `Unknown option: ${arg}.`};
        if (arg) positional.push(arg);
    }
    if (positional.length !== 2) return {type: "error", message: "Expected source and local CSV file path."};
    if (positional[0] !== "manabox") return {type: "error", message: "Supported collection import source is manabox."};
    return {type: "ok", source: "manabox", sourcePath: positional[1]!, ...(dbPath ? {dbPath} : {})};
}

function renderSuccess(io: ImportCollectionCommandIo, summary: {
    readonly sourcePath: string;
    readonly importedRowCount: number;
    readonly totalQuantity: number;
    readonly locationCount: number;
    readonly binderCount: number;
    readonly deckCount: number;
    readonly warningCount: number;
}): void {
    io.stdout.write(`Collection Import succeeded.\n`);
    io.stdout.write(`Source file: ${summary.sourcePath}\n`);
    io.stdout.write(`Imported row count: ${summary.importedRowCount}\n`);
    io.stdout.write(`Total quantity: ${summary.totalQuantity}\n`);
    io.stdout.write(`Location count: ${summary.locationCount} (${summary.binderCount} binder, ${summary.deckCount} deck)\n`);
    io.stdout.write(`Warning count: ${summary.warningCount}\n`);
}

function usage(): string {
    return "Usage: bun run import:collection -- [--db <sqlite-path>] manabox <collection.csv>";
}

function elapsedMs(startedAtMs: number): number {
    return Math.round(performance.now() - startedAtMs);
}

if (import.meta.main) {
    const log = createRootLogger(resolveLogConfigFromEnv(process.env));
    const exitCode = await runImportCollectionCommand(Bun.argv.slice(2), {
        TOMEKIN_DB_PATH: process.env.TOMEKIN_DB_PATH,
    }, {
        stdout: {write: (message) => process.stdout.write(message)},
        stderr: {write: (message) => process.stderr.write(message)},
    }, {now: () => new Date()}, {log});
    process.exit(exitCode);
}
