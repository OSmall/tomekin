/** One transport spelling for bounded retrieval envelopes, including Result failures. */
export function agentToolResultDetails(result: {isOk(): boolean; value?: unknown; error?: unknown}): unknown {
    if (result.isOk()) return result.value;
    if (typeof result.error !== "object" || result.error === null) return {error: "error", message: "Unknown tool error."};
    const error = result.error as {type?: string; message?: string; envelope?: unknown};
    if (error.envelope) return error.envelope;
    const {type, ...details} = error;
    return {error: type ?? "error", ...details};
}
export function isRetrievalEnvelope(value: unknown): boolean {
    return typeof value === "object" && value !== null && "status" in value && "edges" in value && "metadata" in value;
}
export function serializeAgentToolDetails(details: unknown): string {
    return (isRetrievalEnvelope(details) ? JSON.stringify(details) : JSON.stringify(details, null, 2)) ?? "null";
}

/** Hard Worker cancellation has no newly delivered source position. */
export function retrievalCancellationEnvelope(input: unknown, message: string, defaultFirst = 50) {
    const first = typeof input === "object" && input !== null && "first" in input && Number.isInteger(input.first) && typeof input.first === "number" && input.first >= 0 && input.first <= 200 ? input.first : defaultFirst;
    return {status: "error", edges: [], error: {code: "cancelled", message, retryable: true}, metadata: {requested_count: first, returned_count: 0, response_budget_bytes: 51_200, provider_total: null, scoped_total: null}};
}
