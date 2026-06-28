import {createAgentToolHandlers, createImportFoundationServices} from "@mtg-agent/core";
import {
    closeDatabase,
    createSqliteCardQueryRepository,
    createSqliteCardReferenceRepository,
    createSqliteCollectionRepository,
    createSqliteDeckCandidateRepository,
    openDatabase,
    resolveDatabasePath,
} from "@mtg-agent/sqlite";

export type LocalAgentToolHandlers = ReturnType<typeof createAgentToolHandlers>;

export type LocalAgentToolRuntime = {
    readonly databasePath: string;
    readonly handlers: LocalAgentToolHandlers;
    readonly close: () => void;
};

export function createLocalImportFoundation() {
  return {
    databasePath: resolveDatabasePath(),
    services: createImportFoundationServices({
      now: () => new Date(),
    }),
  };
}

export function createLocalAgentToolHandlers(dbPath = resolveDatabasePath()): LocalAgentToolRuntime {
  const db = openDatabase(dbPath);
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
    close: () => closeDatabase(db),
  };
}

export function resultToOpencodeOutput<T>(result: {isOk(): boolean; isErr(): boolean; value?: T; error?: {readonly message: string; readonly type?: string}}): string {
  if (result.isOk()) return JSON.stringify(result.value, null, 2);
  const error = result.error;
  return JSON.stringify({error: error?.type ?? "error", message: error?.message ?? "Unknown tool error."}, null, 2);
}
