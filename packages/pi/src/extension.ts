import {Type, type TSchema} from "@sinclair/typebox";
import {agentToolContracts, agentToolInputJsonSchema, createRootLogger, resolveLogConfigFromEnv, type Logger} from "@tomekin/core";
import {createLocalAgentToolRuntime, type LocalAgentToolRuntime} from "@tomekin/agent";
import {resolveDatabasePath} from "@tomekin/sqlite";
import {readFileSync, realpathSync, statSync} from "node:fs";
import {relative, resolve, sep} from "node:path";
import {expectedPiToolNames} from "./launcher";
import {appendTomekinPiBootstrap} from "./bootstrap";

const MAX_CORE_RESULT_CHARACTERS = 16_000;
const MAX_READ_LINES = 2_000;
const MAX_READ_BYTES = 50 * 1024;
const coreToolNames = expectedPiToolNames.filter((name) => name !== "read" && name !== "ask_user");

type ResultLike = {isOk(): boolean; isErr(): boolean; value?: unknown; error?: {readonly type?: string; readonly message: string}};
type ReferenceRuntime = {readonly handlers: {summarizeReferenceSupport(): Promise<ResultLike>}; close(): void};
type PiTool = {
    readonly name: string;
    readonly label: string;
    readonly description: string;
    readonly parameters: TSchema;
    readonly executionMode: "sequential";
    execute(toolCallId: string, params: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
};
type PiApi = {
    registerTool: (tool: PiTool) => void;
    on(event: string, listener: (...args: any[]) => unknown): void;
    getActiveTools(): string[];
};

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
    const contract = agentToolContracts[name as keyof typeof agentToolContracts];
    return {
        name,
        label: `Tomekin: ${name.replaceAll("_", " ")}`,
        description: contract.description,
        parameters: Type.Unsafe<Record<string, unknown>>(agentToolInputJsonSchema(name as keyof typeof agentToolContracts)),
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

/** Pi's native skills use read; this replacement limits it to working-tree Tomekin skills. */
export function createMethodologyReadTool(options: {readonly workspacePath: string}): PiTool {
    return {
        name: "read",
        label: "read",
        description: "Read a Tomekin skill file. Paths outside skills are not available. Use offset and limit to read long files in line ranges.",
        parameters: Type.Object({
            path: Type.String({minLength: 1, description: "Tomekin skill file path, relative to the workspace or absolute"}),
            offset: Type.Optional(Type.Integer({minimum: 1, description: "1-indexed line number to start reading from"})),
            limit: Type.Optional(Type.Integer({minimum: 1, description: "Maximum number of lines to read"})),
        }, {additionalProperties: false}),
        executionMode: "sequential",
        async execute(_toolCallId, params, signal) {
            if (signal.aborted) return cancelledOutput("Cancelled before dispatch.");
            if (typeof params.path !== "string") return failureOutput("validation_error", "path must be a string.");
            if ((params.offset !== undefined && (typeof params.offset !== "number" || !Number.isInteger(params.offset) || params.offset < 1))
                || (params.limit !== undefined && (typeof params.limit !== "number" || !Number.isInteger(params.limit) || params.limit < 1))) {
                return failureOutput("validation_error", "offset and limit must be positive integers.");
            }
            const offset = typeof params.offset === "number" ? params.offset : 1;
            const limit = typeof params.limit === "number" ? params.limit : MAX_READ_LINES;
            try {
                const root = realpathSync(resolve(options.workspacePath, "skills"));
                const requestedPath = resolve(options.workspacePath, params.path);
                const path = realpathSync(requestedPath);
                const pathWithinRoot = relative(root, path);
                if (pathWithinRoot === "" || pathWithinRoot === ".." || pathWithinRoot.startsWith(`..${sep}`) || !statSync(path).isFile()) throw new Error("outside skills root");
                const lines = readFileSync(path, "utf8").split("\n");
                const selected = lines.slice(offset - 1, offset - 1 + Math.min(limit, MAX_READ_LINES));
                const bounded = selectedLinesWithinByteLimit(selected);
                const nextOffset = offset + bounded.lines.length;
                const hasMore = bounded.truncated || nextOffset <= lines.length;
                const details = {path: params.path, offset, limit: Math.min(limit, MAX_READ_LINES), totalLines: lines.length, ...(hasMore ? {nextOffset} : {})};
                if (signal.aborted) return cancelledOutput("Work settled after cancellation; result discarded.");
                return {content: [{type: "text", text: bounded.lines.join("\n")}], details};
            } catch {
                return failureOutput("access_denied", "read is limited to existing regular files under skills.");
            }
        },
    };
}

function toHandlerName(name: string): keyof LocalAgentToolRuntime["handlers"] {
    const names: Record<string, keyof LocalAgentToolRuntime["handlers"]> = {
        draft_deck_building_brief: "draftDeckBuildingBrief", query_cards: "queryCards", get_card_identity: "getCardIdentity", search_card_identity_tags: "searchCardIdentityTags", search_card_sets: "searchCardSets", summarize_reference_support: "summarizeReferenceSupport", get_format_constraints: "getFormatConstraints", resolve_decklist_cards: "resolveDecklistCards", validate_format_legality: "validateFormatLegality", evaluate_deck_candidate: "evaluateDeckCandidate", render_deck_candidate: "renderDeckCandidate", save_deck_candidate: "saveDeckCandidate", get_deck_candidate: "getDeckCandidate", list_deck_candidates: "listDeckCandidates", list_collection_locations: "listCollectionLocations",
    };
    return names[name]!;
}

function selectedLinesWithinByteLimit(lines: readonly string[]): {readonly lines: readonly string[]; readonly truncated: boolean} {
    const selected: string[] = [];
    let bytes = 0;
    for (const line of lines) {
        const lineBytes = Buffer.byteLength(`${selected.length === 0 ? "" : "\n"}${line}`, "utf8");
        if (selected.length > 0 && bytes + lineBytes > MAX_READ_BYTES) return {lines: selected, truncated: true};
        if (selected.length === 0 && lineBytes > MAX_READ_BYTES) return {lines: [truncateUtf8ToByteLimit(line)], truncated: true};
        selected.push(line);
        bytes += lineBytes;
    }
    return {lines: selected, truncated: false};
}

function truncateUtf8ToByteLimit(text: string): string {
    const bytes = Buffer.from(text, "utf8");
    let end = Math.min(bytes.length, MAX_READ_BYTES);
    while (end > 0 && end < bytes.length && (bytes[end]! & 0b1100_0000) === 0b1000_0000) end -= 1;
    return bytes.subarray(0, end).toString("utf8");
}

/** Temporary safety cap for core tools pending their compact/recoverable output contracts. */
function projectOutput(details: unknown) {
    const serialized = JSON.stringify(details, null, 2) ?? "null";
    if (serialized.length <= MAX_CORE_RESULT_CHARACTERS) return {content: [{type: "text", text: serialized}], details};
    let previewLength = MAX_CORE_RESULT_CHARACTERS;
    let bounded: {truncated: true; originalCharacters: number; preview: string};
    let text: string;
    do {
        bounded = {truncated: true, originalCharacters: serialized.length, preview: serialized.slice(0, previewLength)};
        text = JSON.stringify(bounded, null, 2);
        previewLength -= Math.max(1, text.length - MAX_CORE_RESULT_CHARACTERS);
    } while (text.length > MAX_CORE_RESULT_CHARACTERS);
    return {content: [{type: "text", text}], details: bounded};
}

function cancelledOutput(message: string) { return projectOutput({error: "cancelled", message}); }
function failureOutput(error: string, message: string) { return projectOutput({error, message}); }

export default function registerTomekinExtension(pi: PiApi) {
    const log = createRootLogger(resolveLogConfigFromEnv(process.env));
    const createRuntime = () => createLocalAgentToolRuntime({databasePath: resolveDatabasePath(), log});
    for (const name of coreToolNames) pi.registerTool(createCoreTool(name, {createRuntime, log}));
    pi.registerTool(createMethodologyReadTool({workspacePath: process.cwd()}));
    const registerLaterTool = pi.registerTool.bind(pi);
    pi.registerTool = (tool) => {
        if (!expectedPiToolNames.includes(tool.name as typeof expectedPiToolNames[number])) throw new Error(`Pi tool registry contains unexpected tool ${tool.name}.`);
        registerLaterTool(tool);
        auditPiToolRegistry(pi.getActiveTools());
    };
    pi.on("session_start", () => auditPiToolRegistry(pi.getActiveTools()));
    pi.on("before_agent_start", (event) => ({systemPrompt: appendTomekinPiBootstrap(event.systemPrompt)}));
}
