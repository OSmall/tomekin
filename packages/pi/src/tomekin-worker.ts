import {createLocalAgentToolRuntime, type LocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolMutates, agentToolPreservesCompleteOutput, agentToolResultDetails, isRetrievalEnvelope, serializeAgentToolDetails, createRootLogger, resolveLogConfigFromEnv, type Logger} from "@tomekin/core";

declare const self: Worker;

const maxCharacters = 16_000;
let runtime: LocalAgentToolRuntime | undefined;
let runtimePath: string | undefined;
const log = createRootLogger(resolveLogConfigFromEnv(process.env));

const handlers: Record<string, keyof LocalAgentToolRuntime["handlers"]> = {
    lookup_cards: "lookupCards", draft_deck_building_brief: "draftDeckBuildingBrief", query_cards: "queryCards", hypergeometric_calculator: "hypergeometricCalculator", get_card_identity: "getCardIdentity", search_card_identity_tags: "searchCardIdentityTags", search_card_sets: "searchCardSets", summarize_reference_support: "summarizeReferenceSupport", get_format_constraints: "getFormatConstraints", resolve_decklist_cards: "resolveDecklistCards", validate_format_legality: "validateFormatLegality", evaluate_deck_candidate: "evaluateDeckCandidate", render_deck_candidate: "renderDeckCandidate", create_deck_candidate: "createDeckCandidate", edit_deck_candidate: "editDeckCandidate", get_deck_candidate: "getDeckCandidate", list_deck_candidates: "listDeckCandidates", list_collection_locations: "listCollectionLocations",
};

self.onmessage = async (event: MessageEvent<{id: string; toolName: string; params: unknown; databasePath: string}>) => {
    const {id, toolName, params, databasePath} = event.data;
    try {
        if (!runtime || runtimePath !== databasePath) {
            runtime?.close();
            runtime = createLocalAgentToolRuntime({databasePath, log});
            runtimePath = databasePath;
        }
        const handler = runtime.handlers[handlers[toolName]!];
        if (typeof handler !== "function") return postMessage({id, output: output({error: "tool_unavailable", message: "Approved tool handler is unavailable."})});
        const result = await handler(params) as {isOk(): boolean; value?: unknown; error?: {type?: string; message: string}};
        const details = agentToolResultDetails(result);
        postMessage({id, output: output(details, agentToolPreservesCompleteOutput(toolName))});
    } catch {
        postMessage({id, output: output({error: agentToolMutates(toolName) ? "unknown_write_outcome" : "tool_error", message: agentToolMutates(toolName) ? "The write outcome is unknown. Inspect candidate list/get and reconcile before retrying." : "The approved tool could not complete."})});
    }
};

function output(details: unknown, preserveComplete = false) {
    const serialized = serializeAgentToolDetails(details);
    if (preserveComplete || isRetrievalEnvelope(details) || serialized.length <= maxCharacters) return {content: [{type: "text" as const, text: serialized}], details};
    const bounded = {truncated: true, originalCharacters: serialized.length, preview: serialized.slice(0, maxCharacters - 100)};
    return {content: [{type: "text" as const, text: JSON.stringify(bounded, null, 2)}], details: bounded};
}
