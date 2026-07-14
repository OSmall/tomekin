import {createAgentToolHandlers, createImportFoundationServices, type LogComponent, type Logger} from "@tomekin/core";
import {
    closeDatabase,
    createSqliteCardQueryRepository,
    createSqliteCardReferenceRepository,
    createSqliteCollectionRepository,
    createSqliteDeckCandidateRepository,
    openDatabase,
    resolveDatabasePath,
} from "@tomekin/sqlite";

export type LocalAgentToolHandlers = ReturnType<typeof createAgentToolHandlers>;

export type LocalAgentToolRuntime = {
    readonly databasePath: string;
    readonly handlers: LocalAgentToolHandlers;
    readonly close: () => void;
};

export type LocalRuntimeOptions = {
    readonly databasePath?: string | undefined;
    readonly log: Logger;
};

export function createLocalImportFoundation(options: { readonly log: Logger }) {
    const logger = options.log.child({component: "opencode" satisfies LogComponent});
  logger.info({operation: "create_import_foundation"}, "OpenCode import foundation services created");
  return {
    databasePath: resolveDatabasePath(),
    services: createImportFoundationServices({
      now: () => new Date(),
    }),
  };
}

export function createLocalAgentToolHandlers(options: LocalRuntimeOptions): LocalAgentToolRuntime {
    const dbPath = options.databasePath ?? resolveDatabasePath();
    const logger = options.log.child({component: "opencode" satisfies LogComponent, databasePath: dbPath});
  logger.info({operation: "create_agent_tool_handlers", status: "started"}, "OpenCode agent tool handlers starting");
    const db = openDatabase(dbPath, {log: options.log});
  const clock = {now: () => new Date()};
    const handlers = createAgentToolHandlers({
        cardReference: createSqliteCardReferenceRepository(db),
        cardQuery: createSqliteCardQueryRepository(db),
        collection: createSqliteCollectionRepository(db, clock),
        deckCandidates: createSqliteDeckCandidateRepository(db, clock),
    });
    return {
        databasePath: dbPath,
        handlers,
    close: () => {
      logger.info({operation: "close_agent_tool_handlers", status: "succeeded"}, "OpenCode agent tool handlers closed");
      closeDatabase(db);
    },
  };
}

export function resultToOpencodeOutput<T>(result: {isOk(): boolean; isErr(): boolean; value?: T; error?: {readonly message: string; readonly type?: string}}): string {
  if (result.isOk()) return JSON.stringify(result.value, null, 2);
  const error = result.error;
  return JSON.stringify({error: error?.type ?? "error", message: error?.message ?? "Unknown tool error."}, null, 2);
}
