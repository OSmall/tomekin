import {getProcessCardSearchProvider} from "./provider";
export {getProcessCardSearchProvider} from "./provider";
import {createAgentToolHandlers, type Logger, type CardSearchOptions, type CardLookupOptions} from "@tomekin/core";
import {
    closeDatabase,
    createSqliteCardLookupRepository,
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
    readonly lookup?: CardLookupOptions;
    readonly search?: CardSearchOptions;
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
    const cardReference = createSqliteCardReferenceRepository(database);
    void cardReference.summarizeReferenceSupport().then((support) => {
        logger.info(support.isOk() ? {operation: "reference_readiness", status: support.value.ready ? "ready" : "unready", missingDatasets: support.value.missing, reimportRequiredDatasets: support.value.reimportRequired} : {operation: "reference_readiness", status: "failed"}, "Local reference readiness diagnostic");
    });
    const handlers = createAgentToolHandlers({
        cardLookup: createSqliteCardLookupRepository(database),
        cardReference,
        cardQuery: createSqliteCardQueryRepository(database),
        collection: createSqliteCollectionRepository(database, clock),
        deckCandidates: createSqliteDeckCandidateRepository(database, clock),
    }, {enableLegacyQuery: process.env.TOMEKIN_ENABLE_LEGACY_QUERY === "true", search: {...options.search, provider: options.search?.provider ?? {id: "scryfall", dispatch: (url, context) => getProcessCardSearchProvider(options.log).dispatch(url, context)}, log: options.log}, lookup: {...options.lookup, log: options.log}});

    return {
        databasePath: options.databasePath,
        handlers,
        close: () => {
            logger.info({operation: "close_agent_tool_runtime", status: "succeeded"}, "Local Agent Tool runtime closed");
            closeDatabase(database);
        },
    };
}
