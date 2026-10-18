import type {PiProviderResponse} from "./provider-protocol";
import {
    createLocalAgentToolRuntime,
    type LocalAgentToolRuntime,
} from "@tomekin/agent";
import {
    ProviderFailure,
    type ProviderReply,
    agentToolMutates,
    agentToolPreservesCompleteOutput,
    agentToolResultDetails,
    isRetrievalEnvelope,
    serializeAgentToolDetails,
    createRootLogger,
    resolveLogConfigFromEnv,
    type Logger,
} from "@tomekin/core";

declare const self: Worker;

const maxCharacters = 16_000;
let runtime: LocalAgentToolRuntime | undefined;
let runtimePath: string | undefined;
const log = createRootLogger(resolveLogConfigFromEnv(process.env));

const handlers: Record<string, keyof LocalAgentToolRuntime["handlers"]> = {
    check_collection_availability: "checkCollectionAvailability",
    browse_collection_cards: "browseCollectionCards",
    search_cards: "searchCards",
    lookup_cards: "lookupCards",
    draft_deck_building_brief: "draftDeckBuildingBrief",
    legacy_query_cards: "legacyQueryCards",
    hypergeometric_calculator: "hypergeometricCalculator",
    get_card_identity: "getCardIdentity",
    browse_tags: "browseTags",
    search_card_sets: "searchCardSets",
    summarize_reference_support: "summarizeReferenceSupport",
    get_format_constraints: "getFormatConstraints",
    resolve_decklist_cards: "resolveDecklistCards",
    validate_format_legality: "validateFormatLegality",
    evaluate_deck_candidate: "evaluateDeckCandidate",
    render_deck_candidate: "renderDeckCandidate",
    create_deck_candidate: "createDeckCandidate",
    edit_deck_candidate: "editDeckCandidate",
    get_deck_candidate: "getDeckCandidate",
    list_deck_candidates: "listDeckCandidates",
    list_collection_locations: "listCollectionLocations",
};

const providerReplies = new Map<
    string,
    {resolve: (reply: ProviderReply) => void; reject: (error: unknown) => void}
>();
self.onmessage = async (
    event: MessageEvent<
        | PiProviderResponse
        | {
              kind?: "tool_request";
              id: string;
              toolName: string;
              params: unknown;
              databasePath: string;
          }
    >,
) => {
    if (event.data.kind === "provider_reply") {
        const pending = providerReplies.get(event.data.requestId!);
        if (pending) {
            providerReplies.delete(event.data.requestId!);
            event.data.problem
                ? pending.reject(new ProviderFailure(event.data.problem))
                : pending.resolve(event.data.reply!);
        }
        return;
    }
    const {id, toolName, params, databasePath} = event.data;
    try {
        if (!runtime || runtimePath !== databasePath) {
            runtime?.close();
            runtime = createLocalAgentToolRuntime({
                databasePath,
                log,
                search: {
                    provider: {
                        id: "scryfall",
                        dispatch(url, context) {
                            const requestId = crypto.randomUUID();
                            return new Promise((resolve, reject) => {
                                providerReplies.set(requestId, {
                                    resolve,
                                    reject,
                                });
                                postMessage({
                                    kind: "provider_request",
                                    requestId,
                                    url,
                                    remainingMs: context.remainingMs,
                                    correlationId: context.correlationId,
                                    scanBudgetMs: context.scanBudgetMs,
                                });
                            });
                        },
                    },
                },
            });
            runtimePath = databasePath;
        }
        const handler = runtime.handlers[handlers[toolName]!];
        if (typeof handler !== "function")
            return postMessage({
                id,
                output: output({
                    error: "tool_unavailable",
                    message: "Approved tool handler is unavailable.",
                }),
            });
        const result = (await handler(params)) as {
            isOk(): boolean;
            value?: unknown;
            error?: {type?: string; message: string};
        };
        const details = agentToolResultDetails(result);
        const serializationStarted = performance.now();
        const serialized = output(details, agentToolPreservesCompleteOutput(toolName));
        log.info(
            {
                operation: "pi_worker_output",
                tool: toolName,
                correlationId: id,
                adapterBytes: Buffer.byteLength(
                    serialized.content[0]?.text ?? "",
                    "utf8",
                ),
                adapterSerializationMs:
                    performance.now() - serializationStarted,
            },
            "Pi Worker output serialized",
        );
        postMessage({id, output: serialized});
    } catch {
        postMessage({
            id,
            output: output({
                error: agentToolMutates(toolName)
                    ? "unknown_write_outcome"
                    : "tool_error",
                message: agentToolMutates(toolName)
                    ? "The write outcome is unknown. Inspect candidate list/get and reconcile before retrying."
                    : "The approved tool could not complete.",
            }),
        });
    }
};

function output(details: unknown, preserveComplete = false) {
    const serialized = serializeAgentToolDetails(details);
    if (
        preserveComplete ||
        isRetrievalEnvelope(details) ||
        serialized.length <= maxCharacters
    )
        return {content: [{type: "text" as const, text: serialized}], details};
    const bounded = {
        truncated: true,
        originalCharacters: serialized.length,
        preview: serialized.slice(0, maxCharacters - 100),
    };
    return {
        content: [
            {type: "text" as const, text: JSON.stringify(bounded, null, 2)},
        ],
        details: bounded,
    };
}
