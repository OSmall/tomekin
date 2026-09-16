import {createAgentToolHandlers, type Logger} from "@tomekin/core";
import {readFileSync} from "node:fs";
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

export const productMethodologyCatalog = {
    "tomekin-deck-building": {
        description: "Coordinate local deck-building through Tomekin tools.",
        path: "tomekin-deck-building/SKILL.md",
    },
    "query-cards": {
        description: "Compose, fix, and explain query_cards filters.",
        path: "query-cards/SKILL.md",
    },
    "collection-opportunity-discovery": {
        description: "Discover viable Collection-supported Deck Opportunities.",
        path: "collection-opportunity-discovery/SKILL.md",
    },
    "commander-deck-architecture": {
        description: "Construct a Commander Deck Candidate.",
        path: "commander-deck-architecture/SKILL.md",
    },
    "commander-deck-tuning": {
        description: "Tune a Commander Existing Deck or Deck Candidate.",
        path: "commander-deck-tuning/SKILL.md",
    },
    "sixty-card-constructed-deck-architecture": {
        description: "Construct a 60-card Constructed Deck Candidate.",
        path: "sixty-card-constructed-deck-architecture/SKILL.md",
    },
    "sixty-card-constructed-deck-tuning": {
        description: "Tune a 60-card Constructed Existing Deck or Deck Candidate.",
        path: "sixty-card-constructed-deck-tuning/SKILL.md",
    },
} as const;

export type ProductMethodologyName = keyof typeof productMethodologyCatalog;

export type ProductMethodology = {
    readonly name: ProductMethodologyName;
    readonly description: string;
    readonly content: string;
};

export type ProductMethodologyLoadResult =
    | {readonly ok: true; readonly value: ProductMethodology}
    | {readonly ok: false; readonly error: {readonly type: "unknown_product_methodology"; readonly name: string}};

const productMethodologyRoot = new URL("../../../product-methodology/", import.meta.url);

/** Loads only an exact, reviewed Product Methodology entry from the fixed catalog. */
export function loadProductMethodology(name: string): ProductMethodologyLoadResult {
    if (!Object.hasOwn(productMethodologyCatalog, name)) {
        return {ok: false, error: {type: "unknown_product_methodology", name}};
    }
    const entry = productMethodologyCatalog[name as ProductMethodologyName];

    return {
        ok: true,
        value: {
            name: name as ProductMethodologyName,
            description: entry.description,
            content: readFileSync(new URL(entry.path, productMethodologyRoot), "utf8"),
        },
    };
}
