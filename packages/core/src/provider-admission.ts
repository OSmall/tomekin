import {
    ProviderFailure,
    type CardSearchProvider,
    type ProviderReply,
} from "./card-search";
import type {Logger} from "./logging";
export type ProviderControlState = {
    version: 1;
    provider: "scryfall";
    cooldownWallUntil: number;
    uncertain: boolean;
};
export type ProviderOwnerOptions = {
    now?: () => number;
    wallNow?: () => number;
    wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
    dispatch: (url: string) => Promise<ProviderReply>;
    initialState?: ProviderControlState;
    persist?: (state: ProviderControlState) => void;
    log?: Logger;
};
/** The owner performs HTTP itself; caller cancellation only detaches its delivery. */
export function createProviderDispatchOwner(
    options: ProviderOwnerOptions,
): CardSearchProvider {
    const now = options.now ?? (() => performance.now()),
        wall = options.wallNow ?? (() => Date.now()),
        wait = options.wait ?? abortableWait;
    let lastStart = -Infinity,
        cooldown =
            now() +
            Math.max(
                0,
                (options.initialState?.cooldownWallUntil ?? 0) - wall(),
                options.initialState?.uncertain ? 31000 : 0,
            ),
        lane = Promise.resolve(),
        failed = false,
        requestCount = 0;
    let durableWallUntil = options.initialState?.cooldownWallUntil ?? 0;
    const persist = (uncertain: boolean) => {
        try {
            durableWallUntil = Math.max(
                durableWallUntil,
                wall() + Math.max(0, cooldown - now()),
            );
            options.persist?.({
                version: 1,
                provider: "scryfall",
                cooldownWallUntil: durableWallUntil,
                uncertain,
            });
        } catch {
            failed = true;
            throw new ProviderFailure({
                code: "provider_error",
                message:
                    "Provider control state could not be saved; admission is closed.",
                retryable: false,
                reason: "control_state_failure",
            });
        }
    };
    return {
        id: "scryfall",
        dispatch(url, context) {
            const log = options.log?.child({
                tool: "search_cards",
                correlationId: context.correlationId ?? crypto.randomUUID(),
            });
            const enqueued = now(),
                deadline = now() + context.remainingMs;
            const execution = lane.then(async () => {
                log?.info(
                    {
                        operation: "provider_queue",
                        queueWaitMs: now() - enqueued,
                    },
                    "Provider dispatch lane entered",
                );
                if (failed)
                    throw new ProviderFailure({
                        code: "provider_error",
                        message:
                            "Provider admission is closed after a control-state failure.",
                        retryable: false,
                    });
                while (true) {
                    if (context.signal?.aborted) throw cancelled();
                    const remaining = deadline - now(),
                        delay = Math.max(
                            0,
                            lastStart + 500 - now(),
                            cooldown - now(),
                        );
                    if (remaining <= 0 || delay >= remaining)
                        throw new ProviderFailure(
                            cooldown > now()
                                ? {
                                      code: "rate_limited",
                                      message:
                                          "Provider cooldown exceeds the remaining scan budget.",
                                      retryable: true,
                                      retry_after_ms: Math.ceil(
                                          cooldown - now(),
                                      ),
                                  }
                                : {
                                      code: "scan_timeout",
                                      message:
                                          "Search deadline reached before dispatch.",
                                      retryable: true,
                                  },
                        );
                    if (delay === 0) break;
                    const t = now(),
                        cooldownWait = Math.max(0, cooldown - t);
                    await wait(delay, context.signal);
                    log?.info(
                        {
                            operation: "provider_admission",
                            admissionWaitMs: now() - t,
                            cooldownWaitMs: Math.min(now() - t, cooldownWait),
                            cooldownRemainingMs: Math.max(0, cooldown - now()),
                        },
                        "Provider admission waited",
                    );
                }
                if (context.signal?.aborted) throw cancelled();
                persist(true);
                lastStart = now();
                // No await separates this timestamp from transport invocation.
                const response = options.dispatch(url);
                requestCount++;
                log?.info(
                    {
                        operation: "provider_http_start",
                        providerCalls: requestCount,
                        actualStart: lastStart,
                    },
                    "Provider HTTP started",
                );
                let reply: ProviderReply;
                try {
                    reply = await response;
                } catch (error) {
                    persist(false);
                    throw error;
                }
                if (reply.status === 429) {
                    cooldown = Math.max(
                        cooldown,
                        now() + Math.max(31000, reply.retryAfterMs ?? 0),
                    );
                    reply = {
                        ...reply,
                        retryAfterMs: Math.ceil(cooldown - now()),
                    };
                }
                persist(false);
                log?.info(
                    {
                        operation: "provider_dispatch",
                        status: reply.status,
                        httpMs: now() - lastStart,
                        cooldownRemainingMs: Math.max(0, cooldown - now()),
                    },
                    "Provider HTTP completed",
                );
                return reply;
            });
            lane = execution.then(
                () => {},
                () => {},
            );
            return detach(
                execution,
                context.signal,
                Math.max(0, deadline - now()),
            );
        },
    };
}
function cancelled() {
    return new ProviderFailure({
        code: "cancelled",
        message: "Search cancelled.",
        retryable: true,
    });
}
export function abortableWait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(cancelled());
        const done = () => {
            signal?.removeEventListener("abort", abort);
            resolve();
        };
        const timer = setTimeout(done, ms);
        const abort = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            reject(cancelled());
        };
        signal?.addEventListener("abort", abort, {once: true});
    });
}
function detach<T>(
    work: Promise<T>,
    signal: AbortSignal | undefined,
    remaining: number,
): Promise<T> {
    return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>;
        const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
        };
        const abort = () => {
            cleanup();
            reject(cancelled());
        };
        if (signal?.aborted) {
            reject(cancelled());
            return;
        }
        timer = setTimeout(() => {
            cleanup();
            reject(
                new ProviderFailure({
                    code: "scan_timeout",
                    message: "Search deadline reached during provider work.",
                    retryable: true,
                }),
            );
        }, remaining);
        signal?.addEventListener("abort", abort, {once: true});
        work.then(
            (value) => {
                cleanup();
                resolve(value);
            },
            (error) => {
                cleanup();
                reject(error);
            },
        );
    });
}
/** Parse Retry-After once at receipt against wall time, then retain a monotonic deadline. */
export function retryAfterDelay(value: string | null, wallNow: number): number {
    if (value === null) return 31000;
    const trimmed = value.trim();
    const isDate =
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
            trimmed,
        );
    const delay = /^\d+$/.test(trimmed)
        ? Number(trimmed) * 1000
        : isDate
          ? Date.parse(trimmed) - wallNow
          : NaN;
    return Number.isFinite(delay) ? Math.max(31000, delay) : 31000;
}
