import {expect, test} from "bun:test";
import {createProviderDispatchOwner} from "../src/provider-admission";

test("paces actual starts without a second response delay and keeps detached 429 cooldown", async () => {
    let time = 0;
    const starts: number[] = [];
    let respond!: (value: any) => void;
    const owner = createProviderDispatchOwner({
        now: () => time,
        wallNow: () => time,
        wait: async (ms) => {
            time += ms;
        },
        dispatch: async () => {
            starts.push(time);
            if (starts.length === 1) {
                time = 700;
                return {status: 200, body: {}};
            }
            if (starts.length === 2)
                return await new Promise((resolve) => {
                    respond = resolve;
                });
            return {status: 200, body: {}};
        },
    });
    await owner.dispatch("https://api.scryfall.com/cards/search?q=a", {
        remainingMs: 120000,
    });
    const controller = new AbortController();
    const cancelled = owner.dispatch(
        "https://api.scryfall.com/cards/search?q=b",
        {remainingMs: 120000, signal: controller.signal},
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({
        problem: {code: "cancelled"},
    });
    time = 1500;
    respond({status: 429, body: {}, retryAfterMs: 60000});
    await owner.dispatch("https://api.scryfall.com/cards/search?q=c", {
        remainingMs: 120000,
    });
    expect(starts).toEqual([0, 700, 61500]);
});

import {
    retryAfterDelay,
    ProviderFailure,
    type ProviderControlState,
} from "../src";
test("late timers reserve from actual dispatches rather than catching up", async () => {
    let time = 0,
        late = true;
    const starts: number[] = [];
    const owner = createProviderDispatchOwner({
        now: () => time,
        wait: async (ms) => {
            time += late ? 900 : ms;
            late = false;
        },
        dispatch: async () => {
            starts.push(time);
            return {status: 200, body: null};
        },
    });
    await Promise.all(
        [1, 2, 3].map(() =>
            owner.dispatch("https://api.scryfall.com/cards/search?q=x", {
                remainingMs: 120000,
            }),
        ),
    );
    expect(starts).toEqual([0, 900, 1400]);
});
test("queued cancellation consumes no start and deadline cannot bypass retained cooldown", async () => {
    let time = 0;
    const starts: number[] = [];
    let respond!: (value: any) => void;
    const owner = createProviderDispatchOwner({
        now: () => time,
        wallNow: () => time,
        wait: async (ms) => {
            time += ms;
        },
        dispatch: async () => {
            starts.push(time);
            if (starts.length === 1)
                return new Promise((resolve) => {
                    respond = resolve;
                });
            return {status: 200, body: null};
        },
    });
    const first = owner.dispatch("https://api.scryfall.com/cards/search?q=a", {
        remainingMs: 120000,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const controller = new AbortController(),
        queued = owner.dispatch("https://api.scryfall.com/cards/search?q=b", {
            remainingMs: 120000,
            signal: controller.signal,
        });
    controller.abort();
    await expect(queued).rejects.toMatchObject({problem: {code: "cancelled"}});
    respond({status: 429, body: null});
    await first;
    await expect(
        owner.dispatch("https://api.scryfall.com/cards/search?q=c", {
            remainingMs: 1000,
        }),
    ).rejects.toMatchObject({
        problem: {code: "rate_limited", retry_after_ms: 31000},
    });
    expect(starts).toEqual([0]);
});
test("persisted longer cooldown and uncertain restart reanchor to the new monotonic clock", async () => {
    for (const [known, uncertain, expected] of [
        [200000, false, 100000],
        [100000, true, 31000],
    ] as const) {
        let time = 50;
        const starts: number[] = [];
        const states: ProviderControlState[] = [];
        const owner = createProviderDispatchOwner({
            now: () => time,
            wallNow: () => 100000,
            initialState: {
                version: 1,
                provider: "scryfall",
                cooldownWallUntil: known,
                uncertain,
            },
            persist: (state) => states.push(state),
            wait: async (ms) => {
                time += ms;
            },
            dispatch: async () => {
                starts.push(time);
                return {status: 200, body: null};
            },
        });
        await owner.dispatch("https://api.scryfall.com/cards/search?q=x", {
            remainingMs: 120000,
        });
        expect(starts).toEqual([50 + expected]);
        expect(states[0]?.uncertain).toBe(true);
        expect(states.at(-1)?.uncertain).toBe(false);
    }
});
test("failed control persistence closes admission before any HTTP start", async () => {
    let starts = 0;
    const owner = createProviderDispatchOwner({
        persist: () => {
            throw new Error("disk full");
        },
        dispatch: async () => {
            starts++;
            return {status: 200, body: null};
        },
    });
    for (let i = 0; i < 2; i++)
        await expect(
            owner.dispatch("https://api.scryfall.com/cards/search?q=x", {
                remainingMs: 120000,
            }),
        ).rejects.toBeInstanceOf(ProviderFailure);
    expect(starts).toBe(0);
});
test("Retry-After accepts longer valid delta/date values and never shortens the margin", () => {
    const wall = Date.UTC(2026, 0, 1);
    for (const value of [
        null,
        "",
        "invalid",
        "0",
        "30",
        "-1",
        "Thu, 01 Jan 1970 00:00:00 GMT",
    ])
        expect(retryAfterDelay(value, wall)).toBe(31000);
    expect(retryAfterDelay("120", wall)).toBe(120000);
    expect(retryAfterDelay("Thu, 01 Jan 2026 00:02:00 GMT", wall)).toBe(120000);
});
