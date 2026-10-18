import { agentToolMutates, retrievalCancellationEnvelope, serializeAgentToolDetails } from "@tomekin/core";
export type PiToolOutput = {
    readonly content: readonly {
        readonly type: "text";
        readonly text: string;
    }[];
    readonly details: unknown;
};
type WorkerRequest = Readonly<Record<string, unknown>> & {
    readonly toolCallId: string;
    readonly cancellable?: boolean;
};
type WorkerResponse = { readonly id: string; readonly output: PiToolOutput };
type PendingInvocation = {
    readonly resolve: (output: PiToolOutput) => void;
    readonly id: string;
    readonly mutating: boolean;
    readonly settled: Promise<void>;
    readonly toolName: string;
};
/** One session-scoped execution lane. Dispatched mutations always settle. */
export class PiWorkerTransport {
    private worker: Worker | undefined;
    private pending: PendingInvocation | undefined;
    private closing = false;
    constructor(
        private readonly options: {
            readonly workerUrl: string;
            readonly createWorker?: (url: string) => Worker;
        },
    ) {}
    invoke(request: WorkerRequest, signal: AbortSignal): Promise<PiToolOutput> {
        if (signal.aborted)
            return Promise.resolve(
                cancelledOutput("Cancelled before dispatch.", request),
            );
        if (this.closing)
            return Promise.resolve(
                failureOutput("tool_error", "The Pi session is closing."),
            );
        if (this.pending)
            return Promise.resolve(
                failureOutput(
                    "tool_error",
                    "Another approved tool is already running.",
                ),
            );
        const worker = this.getWorker();
        const toolName =
            typeof request.toolName === "string" ? request.toolName : "";
        const mutating =
            agentToolMutates(toolName) || request.cancellable === false;
        return new Promise((resolve) => {
            let settle!: () => void;
            const settled = new Promise<void>((done) => {
                settle = done;
            });
            const finish = (output: PiToolOutput) => {
                signal.removeEventListener("abort", cancel);
                resolve(output);
                settle();
            };
            const cancel = () => {
                if (mutating || !this.pending) return;
                this.pending = undefined;
                void this.terminateWorker();
                finish(
                    cancelledOutput(
                        "Cancelled while the approved tool was running. Reuse the last received cursor or original request.", request,
                    ),
                );
            };
            this.pending = {
                resolve: finish,
                id: request.toolCallId,
                mutating,
                settled,
                toolName,
            };
            signal.addEventListener("abort", cancel, { once: true });
            try {
                worker.postMessage({ id: request.toolCallId, ...request });
            } catch {
                const pending = this.pending;
                this.pending = undefined;
                pending.resolve(unknownOrFailure(pending));
                void this.terminateWorker();
            }
        });
    }
    async close(): Promise<void> {
        this.closing = true;
        const pending = this.pending;
        if (pending?.mutating) await pending.settled;
        else if (pending) {
            this.pending = undefined;
            pending.resolve(
                failureOutput(
                    "tool_error",
                    "The Pi session closed before the approved tool completed.",
                ),
            );
        }
        await this.terminateWorker();
    }
    private getWorker(): Worker {
        if (this.worker) return this.worker;
        const worker =
            this.options.createWorker?.(this.options.workerUrl) ??
            new Worker(this.options.workerUrl);
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const pending = this.pending;
            if (
                this.worker !== worker ||
                !pending ||
                event.data.id !== pending.id
            )
                return;
            this.pending = undefined;
            pending.resolve(event.data.output);
        };
        worker.onerror = () => {
            if (this.worker !== worker) return;
            const pending = this.pending;
            this.pending = undefined;
            this.worker = undefined;
            if (pending) pending.resolve(unknownOrFailure(pending));
            void worker.terminate();
        };
        this.worker = worker;
        return worker;
    }
    private async terminateWorker() {
        const worker = this.worker;
        this.worker = undefined;
        if (worker) await worker.terminate();
    }
}
export function createPiWorkerTransport(options: {
    readonly workerUrl: string;
    readonly createWorker?: (url: string) => Worker;
}): PiWorkerTransport {
    return new PiWorkerTransport(options);
}
function unknownOrFailure(pending: PendingInvocation) {
    return failureOutput(
        pending.mutating ? "unknown_write_outcome" : "tool_error",
        pending.mutating
            ? `The ${pending.toolName || "mutation"} outcome is unknown after a Worker failure. Inspect list_deck_candidates/get_deck_candidate and reconcile before retrying.`
            : "The approved tool could not complete.",
    );
}
function projectOutput(details: unknown): PiToolOutput {
    return {
        content: [
            { type: "text", text: serializeAgentToolDetails(details) },
        ],
        details,
    };
}
function cancelledOutput(message: string, request?: WorkerRequest) {
    return projectOutput(["lookup_cards", "browse_tags"].includes(request?.toolName ?? "") ? retrievalCancellationEnvelope(request.params, message) : { error: "cancelled", message });
}
function failureOutput(error: string, message: string) {
    return projectOutput({ error, message });
}
