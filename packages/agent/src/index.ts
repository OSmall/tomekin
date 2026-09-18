import {createAgentToolHandlers, type Logger} from "@tomekin/core";
import {
    closeDatabase,
    createSqliteCardQueryRepository,
    createSqliteCardReferenceRepository,
    createSqliteCollectionRepository,
    createSqliteDeckCandidateRepository,
    openDatabase,
} from "@tomekin/sqlite";

export type LocalAgentToolHandlers = ReturnType<typeof createAgentToolHandlers>;

export type LocalAgentToolRuntime = {
    readonly databasePath: string;
    readonly handlers: LocalAgentToolHandlers;
    readonly close: () => void;
};

export type LocalAgentToolRuntimeOptions = {
    readonly databasePath: string;
    readonly log: Logger;
};

/**
 * Composes the local, SQLite-backed Agent Tools without selecting an Agent
 * Harness Adapter. Callers own the runtime lifetime and must call close.
 */
export function createLocalAgentToolRuntime(options: LocalAgentToolRuntimeOptions): LocalAgentToolRuntime {
    const logger = options.log.child({component: "agent_runtime", databasePath: options.databasePath});
    logger.info({operation: "create_agent_tool_runtime", status: "started"}, "Local Agent Tool runtime starting");
    const database = openDatabase(options.databasePath, {log: options.log});
    const clock = {now: () => new Date()};
    const handlers = createAgentToolHandlers({
        cardReference: createSqliteCardReferenceRepository(database),
        cardQuery: createSqliteCardQueryRepository(database),
        collection: createSqliteCollectionRepository(database, clock),
        deckCandidates: createSqliteDeckCandidateRepository(database, clock),
    });

    return {
        databasePath: options.databasePath,
        handlers,
        close: () => {
            logger.info({operation: "close_agent_tool_runtime", status: "succeeded"}, "Local Agent Tool runtime closed");
            closeDatabase(database);
        },
    };
}
