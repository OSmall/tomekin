import {expect, test} from "bun:test";
import {createBunScryfallSyncPorts} from "@tomekin/cli";
import {dispatchScryfallHttp} from "@tomekin/agent";
import {createProviderDispatchOwner, type ProviderControlState} from "@tomekin/core";
import {liveMetadata, jsonlGzipResponse, rawOracleCard} from "./fixtures/scryfall-sync";

const metadataUrl = "https://api.scryfall.com/bulk-data", migrationsUrl = "https://api.scryfall.com/migrations";
const budget = {remainingMs: 180000, remainingBytes: 1024 * 1024, remainingRequests: 32};
function harness(reply: (url: string, call: number) => Response, lateTimer = 0, initialState?: ProviderControlState) {
  let now = 0, state: ProviderControlState | undefined;
  const starts: {url: string; at: number}[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input); starts.push({url, at: now}); return reply(url, starts.length);
  }) as typeof fetch;
  const owner = createProviderDispatchOwner({now: () => now, wallNow: () => Date.parse("2025-01-01T00:00:00Z") + now,
    wait: async delay => {now += delay + lateTimer;}, dispatch: url => dispatchScryfallHttp(url, () => Date.parse("2025-01-01T00:00:00Z") + now),
    intervalMs: url => new URL(url).pathname === "/cards/search" ? 500 : 100,
    persist: value => {state = value;}, ...(initialState ? {initialState} : {})});
  return {owner, starts, now: () => now, advance(ms: number) {now += ms;}, state: () => state!, restore() {globalThis.fetch = original;}};
}
function success(url: string) {
  return Response.json(url === metadataUrl ? {data: liveMetadata()} : {data: [], has_more: false});
}

test("real sync HTTP adapter paces actual API starts, preserves stricter search cadence and excludes bulk origins", async () => {
  const app = harness(url => url.startsWith("https://data.scryfall.io") ? jsonlGzipResponse([rawOracleCard()]) : success(url));
  const runtime = await createBunScryfallSyncPorts(app.owner, app.now);
  try {
    const metadata = await runtime.ports.listBulkDataMetadata(); expect(metadata.isOk()).toBe(true);
    if (metadata.isErr()) throw metadata.error;
    expect((await runtime.ports.downloadBulkData(metadata.value[0]!)).isOk()).toBe(true);
    expect((await runtime.ports.listCardMigrations!(migrationsUrl, budget)).isOk()).toBe(true);
    await app.owner.dispatch("https://api.scryfall.com/cards/search?q=ring", {remainingMs: 2000});
    await runtime.ports.listBulkDataMetadata();
    expect(app.starts.map(start => start.at)).toEqual([0, 0, 100, 600, 1100]);
  } finally {app.restore(); await runtime.cleanup();}
});

test("late timers never cause catch-up bursts and long responses need no extra post-response interval", async () => {
  const app = harness(url => success(url), 50), runtime = await createBunScryfallSyncPorts(app.owner, app.now);
  try {
    await runtime.ports.listBulkDataMetadata();
    await runtime.ports.listCardMigrations!(migrationsUrl, budget);
    await runtime.ports.listCardMigrations!(migrationsUrl, budget);
    app.advance(500);
    await runtime.ports.listBulkDataMetadata();
    expect(app.starts.map(row => row.at)).toEqual([0, 150, 300, 800]);
  } finally {app.restore(); await runtime.cleanup();}
});

for (const [header, delay] of [[null, 31000], ["invalid", 31000], ["2", 31000], ["45", 45000], ["Wed, 01 Jan 2025 00:01:00 GMT", 60000]] as const) {
  test(`real HTTP 429 honors ${header ?? "absent Retry-After"} with cooldown ${delay}`, async () => {
    const app = harness((url, call) => call === 1 ? new Response(null, {status: 429, headers: header ? {"Retry-After": header} : {}}) : success(url));
    const runtime = await createBunScryfallSyncPorts(app.owner, app.now);
    try {
      expect((await runtime.ports.listBulkDataMetadata()).isOk()).toBe(true);
      expect(app.starts.map(row => row.at)).toEqual([0, delay]);
      expect(app.state().cooldownWallUntil).toBeGreaterThanOrEqual(Date.parse("2025-01-01T00:00:00Z") + delay);
    } finally {app.restore(); await runtime.cleanup();}
  });
}

test("three 429 responses exhaust exactly two retries; another invocation and search retain cooldown", async () => {
  const app = harness(() => new Response(null, {status: 429}));
  const first = await createBunScryfallSyncPorts(app.owner, app.now);
  try {
    const result = await first.ports.listBulkDataMetadata();
    expect(result.isErr()).toBe(true); if (result.isErr()) expect(result.error.message).toContain("rate_limit_exhausted");
    expect(app.starts.map(row => row.at)).toEqual([0, 31000, 62000]);
    await expect(app.owner.dispatch("https://api.scryfall.com/cards/search?q=ring", {remainingMs: 1000})).rejects.toMatchObject({problem: {code: "rate_limited"}});
    const second = await createBunScryfallSyncPorts(app.owner, app.now);
    try {await second.ports.listCardMigrations!(migrationsUrl, {remainingMs: 1000, remainingBytes: 1024, remainingRequests: 1});}
    finally {await second.cleanup();}
    expect(app.starts).toHaveLength(3);
  } finally {app.restore(); await first.cleanup();}
});

test("cooldown that cannot fit the discovery budget performs no early retry and survives owner restart", async () => {
  const app = harness(() => new Response(null, {status: 429, headers: {"Retry-After": "120"}}));
  const runtime = await createBunScryfallSyncPorts(app.owner, app.now);
  let persisted: ProviderControlState;
  try {
    expect((await runtime.ports.listCardMigrations!(migrationsUrl, {...budget, remainingMs: 1000})).isErr()).toBe(true);
    expect(app.starts).toHaveLength(1); persisted = app.state();
  } finally {app.restore(); await runtime.cleanup();}
  const restarted = harness(url => success(url), 0, persisted!);
  const second = await createBunScryfallSyncPorts(restarted.owner, restarted.now);
  try {
    expect((await second.ports.listCardMigrations!(migrationsUrl, {...budget, remainingMs: 1000})).isErr()).toBe(true);
    expect(restarted.starts).toEqual([]);
  } finally {restarted.restore(); await second.cleanup();}
});

test("bounded HTTP body reading rejects an oversized migration response", async () => {
  const app = harness(() => new Response(' '.repeat(1024 * 1024 + 1)));
  const runtime = await createBunScryfallSyncPorts(app.owner, app.now);
  try {expect((await runtime.ports.listCardMigrations!(migrationsUrl, budget)).isErr()).toBe(true); expect(app.starts).toHaveLength(1);}
  finally {app.restore(); await runtime.cleanup();}
});
