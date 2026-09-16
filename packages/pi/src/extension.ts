import {createRootLogger, resolveLogConfigFromEnv} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {resolveDatabasePath} from "@tomekin/sqlite";
import {expectedPiToolNames} from "./launcher";

type ResultLike = {isOk(): boolean; isErr(): boolean; value?: unknown; error?: {readonly type?: string; readonly message: string; readonly [key: string]: unknown}};
type ReferenceRuntime = {readonly handlers: {summarizeReferenceSupport(): Promise<ResultLike>}; close(): void};

export function auditPiToolRegistry(toolNames: readonly string[]): void {
    const seen = new Set<string>();
    for (const toolName of toolNames) {
        if (seen.has(toolName)) throw new Error(`Pi tool registry contains duplicate tool ${toolName}.`);
        seen.add(toolName);
        if (!expectedPiToolNames.includes(toolName as typeof expectedPiToolNames[number])) {
            throw new Error(`Pi tool registry contains unexpected tool ${toolName}.`);
        }
    }
    for (const expected of expectedPiToolNames) {
        if (!seen.has(expected)) throw new Error(`Pi tool registry is missing required tool ${expected}.`);
    }
}

export function createReferenceSupportTool(options: {readonly createRuntime: () => ReferenceRuntime}) {
    return {
        name: "summarize_reference_support",
        label: "Tomekin reference status",
        description: "Report whether Tomekin's local card reference data is ready for deck-building.",
        parameters: {type: "object", properties: {}, additionalProperties: false},
        async execute(_toolCallId: string, _params: Record<string, never>, signal: AbortSignal) {
            if (signal.aborted) return cancelledOutput("Cancelled before dispatch.");
            const runtime = options.createRuntime();
            try {
                const result = await runtime.handlers.summarizeReferenceSupport();
                if (signal.aborted) return cancelledOutput("Work settled after cancellation; result discarded.");
                const details = result.isOk()
                    ? result.value
                    : {error: result.error?.type ?? "error", message: result.error?.message ?? "Unknown tool error."};
                return {content: [{type: "text", text: JSON.stringify(details, null, 2)}], details};
            } finally {
                runtime.close();
            }
        },
    };
}

function cancelledOutput(message: string) {
    const details = {error: "cancelled", message};
    return {content: [{type: "text", text: JSON.stringify(details, null, 2)}], details};
}

export default function registerTomekinExtension(pi: {
    registerTool(tool: ReturnType<typeof createReferenceSupportTool>): void;
    on(event: "session_start", listener: () => void): void;
    getActiveTools(): string[];
}) {
    const tool = createReferenceSupportTool({
        createRuntime: () => createLocalAgentToolRuntime({
            databasePath: resolveDatabasePath(),
            log: createRootLogger(resolveLogConfigFromEnv(process.env)),
        }),
    });
    pi.registerTool(tool);
    pi.on("session_start", () => auditPiToolRegistry(pi.getActiveTools()));
}
