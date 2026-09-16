import {Type} from "@sinclair/typebox";
import {createRootLogger, resolveLogConfigFromEnv, type Logger} from "@tomekin/core";
import {createLocalAgentToolRuntime, loadProductMethodology, type LocalAgentToolRuntime} from "@tomekin/agent";
import {resolveDatabasePath} from "@tomekin/sqlite";
import {expectedPiToolNames} from "./launcher";

const MAX_RESULT_CHARACTERS = 12_000;
const coreToolNames = expectedPiToolNames.filter((name) => name !== "load_methodology" && name !== "ask_user");

type ResultLike = {isOk(): boolean; isErr(): boolean; value?: unknown; error?: {readonly type?: string; readonly message: string}};
type ReferenceRuntime = {readonly handlers: {summarizeReferenceSupport(): Promise<ResultLike>}; close(): void};
type PiTool = {
    readonly name: string;
    readonly label: string;
    readonly description: string;
    readonly parameters: ReturnType<typeof Type.Object>;
    readonly executionMode: "sequential";
    execute(toolCallId: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
};
type PiApi = {registerTool: (tool: PiTool) => void; on(event: "session_start", listener: () => void): void; getActiveTools(): string[]};

export function auditPiToolRegistry(toolNames: readonly string[]): void {
    const seen = new Set<string>();
    for (const toolName of toolNames) {
        if (seen.has(toolName)) throw new Error(`Pi tool registry contains duplicate tool ${toolName}.`);
        seen.add(toolName);
        if (!expectedPiToolNames.includes(toolName as typeof expectedPiToolNames[number])) throw new Error(`Pi tool registry contains unexpected tool ${toolName}.`);
    }
    for (const expected of expectedPiToolNames) if (!seen.has(expected)) throw new Error(`Pi tool registry is missing required tool ${expected}.`);
}

/** Pi gets TypeBox-compatible JSON transport schemas; the portable core owns validation. */
export function createCoreTool(name: string, options: {readonly createRuntime: () => LocalAgentToolRuntime; readonly log: Logger}): PiTool {
    return {
        name,
        label: `Tomekin: ${name.replaceAll("_", " ")}`,
        description: "Run an approved local Tomekin deck-building capability.",
        parameters: Type.Object({}, {additionalProperties: true}),
        executionMode: "sequential",
        async execute(_toolCallId, params, signal) {
            if (signal.aborted) return cancelledOutput("Cancelled before dispatch.");
            const runtime = options.createRuntime();
            try {
                const handler = runtime.handlers[toHandlerName(name)];
                if (typeof handler !== "function") return failureOutput("tool_unavailable", "Approved tool handler is unavailable.");
                const result = await handler(params) as ResultLike;
                if (signal.aborted) return cancelledOutput("Work settled after cancellation; result discarded.");
                const details = result.isOk() ? result.value : {error: result.error?.type ?? "error", message: result.error?.message ?? "Unknown tool error."};
                options.log.info({component: "agent_tool", operation: "pi_tool_call", tool: name, status: result.isOk() ? "succeeded" : "failed"}, "Pi tool call completed");
                return projectOutput(details);
            } catch {
                options.log.warn({component: "agent_tool", operation: "pi_tool_call", tool: name, status: "failed"}, "Pi tool call failed unexpectedly");
                return failureOutput("tool_error", "The approved tool could not complete.");
            } finally {
                runtime.close();
            }
        },
    };
}

export function createReferenceSupportTool(options: {readonly createRuntime: () => ReferenceRuntime; readonly log?: Logger}) {
    return createCoreTool("summarize_reference_support", {
        createRuntime: () => options.createRuntime() as unknown as LocalAgentToolRuntime,
        log: options.log ?? createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"})),
    });
}

export function createLoadMethodologyTool(): PiTool {
    return {
        name: "load_methodology",
        label: "Tomekin: load methodology",
        description: "Load one approved Tomekin Product Methodology entry by exact name.",
        parameters: Type.Object({name: Type.String({minLength: 1})}, {additionalProperties: false}),
        executionMode: "sequential",
        async execute(_toolCallId, params, signal) {
            if (signal.aborted) return cancelledOutput("Cancelled before dispatch.");
            if (typeof params.name !== "string") return failureOutput("validation_error", "name must be a string.");
            const result = loadProductMethodology(params.name, `${process.cwd()}/product-methodology`);
            if (signal.aborted) return cancelledOutput("Work settled after cancellation; result discarded.");
            return result.ok ? projectOutput(result.value) : projectOutput({error: result.error.type, name: result.error.name});
        },
    };
}

function toHandlerName(name: string): keyof LocalAgentToolRuntime["handlers"] {
    const names: Record<string, keyof LocalAgentToolRuntime["handlers"]> = {
        draft_deck_building_brief: "draftDeckBuildingBrief", query_cards: "queryCards", get_card_identity: "getCardIdentity", search_card_identity_tags: "searchCardIdentityTags", search_card_sets: "searchCardSets", summarize_reference_support: "summarizeReferenceSupport", get_format_constraints: "getFormatConstraints", resolve_decklist_cards: "resolveDecklistCards", validate_format_legality: "validateFormatLegality", evaluate_deck_candidate: "evaluateDeckCandidate", render_deck_candidate: "renderDeckCandidate", save_deck_candidate: "saveDeckCandidate", get_deck_candidate: "getDeckCandidate", list_deck_candidates: "listDeckCandidates", list_collection_locations: "listCollectionLocations",
    };
    return names[name]!;
}

function projectOutput(details: unknown) {
    const serialized = JSON.stringify(details, null, 2) ?? "null";
    if (serialized.length <= MAX_RESULT_CHARACTERS) return {content: [{type: "text", text: serialized}], details};
    let previewLength = MAX_RESULT_CHARACTERS;
    let bounded: {truncated: true; originalCharacters: number; preview: string};
    let text: string;
    do {
        bounded = {truncated: true, originalCharacters: serialized.length, preview: serialized.slice(0, previewLength)};
        text = JSON.stringify(bounded, null, 2);
        previewLength -= Math.max(1, text.length - MAX_RESULT_CHARACTERS);
    } while (text.length > MAX_RESULT_CHARACTERS);
    return {content: [{type: "text", text}], details: bounded};
}

function cancelledOutput(message: string) { return projectOutput({error: "cancelled", message}); }
function failureOutput(error: string, message: string) { return projectOutput({error, message}); }

export default function registerTomekinExtension(pi: PiApi) {
    const log = createRootLogger(resolveLogConfigFromEnv(process.env));
    const createRuntime = () => createLocalAgentToolRuntime({databasePath: resolveDatabasePath(), log});
    for (const name of coreToolNames) pi.registerTool(createCoreTool(name, {createRuntime, log}));
    pi.registerTool(createLoadMethodologyTool());
    const registerLaterTool = pi.registerTool.bind(pi);
    pi.registerTool = (tool) => {
        if (!expectedPiToolNames.includes(tool.name as typeof expectedPiToolNames[number])) throw new Error(`Pi tool registry contains unexpected tool ${tool.name}.`);
        registerLaterTool(tool);
        auditPiToolRegistry(pi.getActiveTools());
    };
    pi.on("session_start", () => auditPiToolRegistry(pi.getActiveTools()));
}
