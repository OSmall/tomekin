import {createImportFoundationServices, type LogComponent, type Logger} from "@tomekin/core";
import {createLocalAgentToolRuntime, type LocalAgentToolHandlers, type LocalAgentToolRuntime} from "@tomekin/agent";
import {resolveDatabasePath} from "@tomekin/sqlite";

export type {LocalAgentToolHandlers, LocalAgentToolRuntime};

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
    const runtime = createLocalAgentToolRuntime({databasePath: dbPath, log: options.log});
    return {
        ...runtime,
        close: () => {
      logger.info({operation: "close_agent_tool_handlers", status: "succeeded"}, "OpenCode agent tool handlers closed");
            runtime.close();
        },
    };
}

export function resultToOpencodeOutput<T>(result: {
    isOk(): boolean;
    isErr(): boolean;
    value?: T;
    error?: { readonly message: string; readonly type?: string; readonly [key: string]: unknown };
}): string {
  if (result.isOk()) return JSON.stringify(result.value, null, 2);
  const error = result.error;
    if (!error) return JSON.stringify({error: "error", message: "Unknown tool error."}, null, 2);
    const {type, ...details} = error;
    return JSON.stringify({...details, error: type ?? "error"}, null, 2);
}
