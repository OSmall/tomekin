import {createAgentToolHandlers, createImportFoundationServices} from "@mtg-agent/core";
import {
  closeDatabase,
  createSqliteCardReferenceRepository,
  createSqliteDeckCandidateRepository,
  openDatabase,
  resolveDatabasePath,
} from "@mtg-agent/sqlite";

export function createLocalImportFoundation() {
  return {
    databasePath: resolveDatabasePath(),
    services: createImportFoundationServices({
      now: () => new Date(),
    }),
  };
}

export function createLocalAgentToolHandlers(dbPath = resolveDatabasePath()) {
  const db = openDatabase(dbPath);
  const clock = {now: () => new Date()};
  return {
    databasePath: dbPath,
    handlers: createAgentToolHandlers({
      cardReference: createSqliteCardReferenceRepository(db),
      deckCandidates: createSqliteDeckCandidateRepository(db, clock),
    }) as Record<string, (...args: never[]) => unknown>,
    close: () => closeDatabase(db),
  };
}

export function resultToOpencodeOutput<T>(result: {isOk(): boolean; isErr(): boolean; value?: T; error?: {readonly message: string; readonly type?: string}}): string {
  if (result.isOk()) return JSON.stringify(result.value, null, 2);
  const error = result.error;
  return JSON.stringify({error: error?.type ?? "error", message: error?.message ?? "Unknown tool error."}, null, 2);
}
