import type {ProviderReply, RetrievalProblem} from "@tomekin/core";

/** Transient HTTP messages carry budget context, never a saved search/result handle. */
export type PiProviderRequest = {
    kind: "provider_request";
    requestId: string;
    url: string;
    remainingMs: number;
    correlationId?: string | undefined;
    scanBudgetMs?: number | undefined;
};
export type PiProviderResponse = {
    kind: "provider_reply";
    requestId: string;
    reply?: ProviderReply;
    problem?: RetrievalProblem;
};
