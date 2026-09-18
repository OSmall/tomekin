export type PiToolOutput = {readonly content: readonly {readonly type: "text"; readonly text: string}[]; readonly details: unknown};

type WorkerRequest = Readonly<Record<string, unknown>> & {readonly toolCallId: string; readonly cancellable?: boolean};
type WorkerResponse = {readonly id: string; readonly output: PiToolOutput};

type PendingInvocation = {
    readonly resolve: (output: PiToolOutput) => void;
    readonly reject: (error: Error) => void;
    readonly id: string;
    readonly mutating: boolean;
};

/** One session-scoped execution lane for work that must not block Pi's event loop. */
export class PiWorkerTransport {
    private worker: Worker | undefined;
    private pending: PendingInvocation | undefined;

    constructor(private readonly options: {readonly workerUrl: string}) {}

    invoke(request: WorkerRequest, signal: AbortSignal): Promise<PiToolOutput> {
        if (signal.aborted) return Promise.resolve(cancelledOutput("Cancelled before dispatch."));
        if (this.pending) return Promise.resolve(failureOutput("tool_error", "Another approved tool is already running."));
        const worker = this.getWorker();
        return new Promise<PiToolOutput>((resolve, reject) => {
            this.pending = {resolve, reject, id: request.toolCallId, mutating: request.cancellable === false};
            const cancel = () => {
                if (request.cancellable === false) return;
                if (!this.pending) return;
                this.pending = undefined;
                void this.terminateWorker();
                resolve(cancelledOutput("Cancelled while the approved tool was running."));
            };
            signal.addEventListener("abort", cancel, {once: true});
            worker.postMessage({id: request.toolCallId, ...request});
        });
    }

    async close(): Promise<void> {
        const pending = this.pending;
        this.pending = undefined;
        if (pending) pending.resolve(failureOutput("tool_error", "The Pi session closed before the approved tool completed."));
        await this.terminateWorker();
    }

    private getWorker(): Worker {
        if (this.worker) return this.worker;
        const worker = new Worker(this.options.workerUrl);
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const pending = this.pending;
            if (!pending || event.data.id !== pending.id) return;
            this.pending = undefined;
            pending.resolve(event.data.output);
        };
        worker.onerror = () => {
            const pending = this.pending;
            this.pending = undefined;
            this.worker = undefined;
            if (pending) pending.resolve(failureOutput("tool_error", pending.mutating
                ? "The save outcome is unknown after a Worker failure. Verify it through Deck Candidate reads."
                : "The approved tool could not complete."));
        };
        this.worker = worker;
        return worker;
    }

    private async terminateWorker(): Promise<void> {
        const worker = this.worker;
        this.worker = undefined;
        if (worker) await worker.terminate();
    }
}

export function createPiWorkerTransport(options: {readonly workerUrl: string}): PiWorkerTransport {
    return new PiWorkerTransport(options);
}

function projectOutput(details: unknown): PiToolOutput {
    return {content: [{type: "text", text: JSON.stringify(details, null, 2) ?? "null"}], details};
}

function cancelledOutput(message: string): PiToolOutput { return projectOutput({error: "cancelled", message}); }
function failureOutput(error: string, message: string): PiToolOutput { return projectOutput({error, message}); }
