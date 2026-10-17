// Throwaway investigation, not a production provider. No API calls without --live.
// bun docs/research/scryfall-pacing-evidence/scratch.ts --self-test
// bun docs/research/scryfall-pacing-evidence/scratch.ts --live --out=docs/research/scryfall-pacing-evidence/live.json
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { z } from "../../../packages/core/node_modules/zod";
import zodPackage from "../../../packages/core/node_modules/zod/package.json";

type Policy = "start" | "completion";
type Clock = { now(): number; wall(): number; sleep(ms: number, signal: AbortSignal): Promise<void> };
const clock: Clock = {
  now: () => performance.now(), wall: () => Date.now(),
  sleep: (ms, signal) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  }),
};
class Stop extends Error {
  constructor(readonly reason: string, readonly retryMs = 0) { super(reason); }
}
function retryDelay(value: string | null, wall: number): number {
  if (!value) return 31_000;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : NaN;
  const delay = Number.isFinite(seconds) ? seconds : Date.parse(value) - wall;
  return Math.max(31_000, Number.isFinite(delay) ? delay : 0);
}
// Shared control state. No search results/cursors; lifetime must exceed an invocation.
class Gate {
  lastStart = -Infinity;
  lastCompletion = -Infinity;
  cooldownUntil = -Infinity;
  private tail: Promise<void> = Promise.resolve();
  constructor(readonly clock: Clock, readonly spacingMs = 550) {}
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.then(() => {}, () => {});
    return result;
  }
  limited(retryAfter: string | null) {
    this.cooldownUntil = Math.max(this.cooldownUntil, this.clock.now() + retryDelay(retryAfter, this.clock.wall()));
  }
  async admit(policy: Policy, deadline: number, signal: AbortSignal) {
    for (;;) {
      signal.throwIfAborted();
      const now = this.clock.now();
      const eligible = Math.max(this.cooldownUntil,
        (policy === "start" ? this.lastStart : this.lastCompletion) + this.spacingMs);
      if (now >= deadline || eligible >= deadline) {
        if (this.cooldownUntil > now) throw new Stop("rate_limited", this.cooldownUntil - now);
        throw new Stop("scan_timeout");
      }
      if (eligible > now) { await this.clock.sleep(eligible - now, signal); continue; }
      this.lastStart = now; // Recheck after waits: never catch up by bursting.
      return now;
    }
  }
}
const Page = z.object({
  object: z.literal("list"), total_cards: z.number().int().nonnegative(),
  has_more: z.boolean(), next_page: z.string().optional(),
  data: z.array(z.object({ object: z.literal("card"), id: z.string().uuid() })),
});
const headers = { "User-Agent": "Tomekin-Pacing-Research/0.0.0 (https://github.com/OSmall/tomekin/issues/82)", Accept: "application/json" };
function searchUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== "https://api.scryfall.com" || url.pathname !== "/cards/search") throw new Stop("invalid_next_page");
  return url.href;
}
type Row = {
  url: string; startMs: number; headersMs?: number; bodyMs?: number; completeMs?: number;
  headerLatencyMs?: number; transferMs?: number; decodeMs?: number; jsonMs?: number;
  validationMs?: number; status?: number; bytes?: number; cards?: number;
  hasMore?: boolean; nextPage?: string; totalCards?: number; retryAfter?: string | null;
  cooldownMs?: number; error?: string; cacheAge?: string | null; cacheStatus?: string | null;
};
type Http = (url: string, init: RequestInit) => Promise<Response>;
async function request(url: string, policy: Policy, gate: Gate, deadline: number, signal: AbortSignal, http: Http, rows: Row[]) {
  return gate.exclusive(async () => {
    const start = await gate.admit(policy, deadline, signal);
    const row: Row = { url: searchUrl(url), startMs: start };
    rows.push(row);
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.ceil(deadline - gate.clock.now())))]);
    try {
      const response = await http(row.url, { headers, signal: requestSignal, redirect: "error" });
      const received = gate.clock.now();
      row.headersMs = received;
      row.headerLatencyMs = received - start;
      row.status = response.status;
      row.retryAfter = response.headers.get("retry-after");
      row.cacheAge = response.headers.get("age");
      row.cacheStatus = response.headers.get("cf-cache-status");
      // Publish cooldown immediately on headers, before cancellation/body processing.
      if (response.status === 429) {
        gate.limited(row.retryAfter);
        row.cooldownMs = gate.cooldownUntil - received;
        await response.body?.cancel();
        throw new Stop("rate_limited", gate.cooldownUntil - gate.clock.now());
      }
      if (!response.ok) { await response.body?.cancel(); throw new Stop(`http_${response.status}`); }
      const body = await response.arrayBuffer();
      row.bodyMs = gate.clock.now();
      gate.lastCompletion = row.bodyMs;
      row.transferMs = row.bodyMs - received;
      row.bytes = body.byteLength; // Decoded HTTP body bytes, not compressed wire bytes.
      const text = new TextDecoder().decode(body);
      const decoded = gate.clock.now(); row.decodeMs = decoded - row.bodyMs;
      const json: unknown = JSON.parse(text);
      const parsed = gate.clock.now(); row.jsonMs = parsed - decoded;
      const page = Page.parse(json);
      row.completeMs = gate.clock.now(); row.validationMs = row.completeMs - parsed;
      signal.throwIfAborted();
      if (gate.clock.now() >= deadline) throw new Stop("scan_timeout");
      if (page.has_more && !page.next_page) throw new Stop("invalid_response");
      const next = page.has_more ? searchUrl(page.next_page!) : undefined;
      row.cards = page.data.length; row.hasMore = page.has_more;
      row.nextPage = next; row.totalCards = page.total_cards;
      return next;
    } catch (error) {
      const reason = error instanceof Stop ? error.reason : signal.aborted ? "cancelled"
        : requestSignal.aborted || gate.clock.now() >= deadline ? "scan_timeout" : "transport_or_response_error";
      row.error = reason;
      throw error instanceof Stop ? error : new Stop(reason);
    } finally {
      if (!Number.isFinite(gate.lastCompletion) || gate.lastCompletion < start) gate.lastCompletion = gate.clock.now();
    }
  });
}
function summary(rows: Row[], elapsedMs: number) {
  const completed = rows.filter(row => row.cards !== undefined);
  const cards = completed.reduce((n, row) => n + row.cards!, 0);
  const stats = (values: number[]) => {
    const sorted = values.toSorted((a, b) => a - b);
    return { min: sorted[0] ?? null, median: sorted[Math.floor(sorted.length / 2)] ?? null,
      max: sorted.at(-1) ?? null, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
  };
  const gaps = rows.slice(1).map((r, i) => r.startMs - rows[i]!.startMs);
  const meanGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  return { requests: rows.length, completed: completed.length, cards, elapsedMs,
    cardsPerSecond: cards / (elapsedMs / 1000),
    // A short batch gets a free first dispatch. Use steady start gaps for extrapolation.
    steadyProjectedFullPagesIn120Seconds: meanGap ? Math.floor(120_000 / meanGap) : null,
    steadyProjectedCardsIn120Seconds: meanGap && completed.length
      ? Math.floor(120_000 / meanGap) * cards / completed.length : null,
    startGapMs: stats(gaps),
    headerLatencyMs: stats(completed.map(r => r.headerLatencyMs!)),
    transferMs: stats(completed.map(r => r.transferMs!)),
    jsonMs: stats(completed.map(r => r.jsonMs!)), validationMs: stats(completed.map(r => r.validationMs!)),
    pageSizes: [...new Set(completed.map(r => r.cards))],
  };
}
async function live() {
  const gate = new Gate(clock);
  const abort = new AbortController();
  process.once("SIGINT", () => abort.abort(new Stop("cancelled")));
  const initial = new URL("https://api.scryfall.com/cards/search");
  initial.search = new URLSearchParams({ q: "game:paper", unique: "prints", order: "set", dir: "asc" }).toString();
  const report = {
    startedAt: new Date().toISOString(), bun: Bun.version, zod: zodPackage.version,
    platform: `${process.platform}/${process.arch}`, spacingMs: gate.spacingMs,
    query: initial.href, headers, maxPagesPerRun: 12, deadlineMsPerRun: 120_000,
    note: "ABBA order; sequential next_page only; stop entire experiment on any error/429; no retries. 120s coverage is extrapolated, not a measured 120s scan. Schema validates list and card identities, not the whole production projection.",
    runs: [] as { policy: Policy; startedAt: string; rows: Row[]; stop: string; summary: ReturnType<typeof summary> }[],
  };
  for (const policy of ["start", "completion", "completion", "start"] as const) {
    // Quiet gap between bounded runs. No hidden warmup requests.
    if (report.runs.length) await clock.sleep(2000, abort.signal);
    const started = clock.now();
    const rows: Row[] = [];
    let next: string | undefined = initial.href;
    let stop = "page_cap";
    try {
      for (let i = 0; i < report.maxPagesPerRun && next; i++) {
        next = await request(next, policy, gate, started + 120_000, abort.signal, fetch, rows);
      }
      if (!next) stop = "exhausted";
    } catch (error) { stop = error instanceof Stop ? error.reason : "cancelled"; }
    const run = { policy, startedAt: new Date(clock.wall() - (clock.now() - started)).toISOString(), rows, stop, summary: summary(rows, clock.now() - started) };
    report.runs.push(run);
    console.log(JSON.stringify({ policy, stop, ...run.summary }));
    if (stop !== "page_cap" && stop !== "exhausted") break;
  }
  const out = process.argv.find(arg => arg.startsWith("--out="))?.slice(6) ?? "/tmp/tomekin-scryfall-pacing.json";
  await writeFile(out, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`Evidence: ${out}`);
  // Deliberately no further HTTP, including during cooldown. Persist remaining delay for a later process.
  if (report.runs.some(run => run.stop === "rate_limited")) {
    const until = Math.ceil(clock.wall() + Math.max(0, gate.cooldownUntil - clock.now()));
    await writeFile("/tmp/tomekin-scryfall-pacing-cooldown-until", String(until));
  }
}
async function fixtures() {
  let time = 0;
  const fake: Clock = { now: () => time, wall: () => Date.UTC(2026, 9, 17) + time,
    sleep: async (ms, signal) => { signal.throwIfAborted(); time += ms; } };
  const signal = new AbortController().signal;
  const reset = () => { time = 0; return new Gate(fake); };
  const url = "https://api.scryfall.com/cards/search?q=game%3Apaper";
  const page = () => Response.json({ object: "list", total_cards: 1, has_more: false,
    data: [{ object: "card", id: "00000000-0000-4000-8000-000000000001" }] });
  const slow: Http = async () => { time += 800; return page(); };
  const checks: string[] = [];
  for (const policy of ["start", "completion"] as const) {
    const gate = reset(); const rows: Row[] = [];
    await request(url, policy, gate, 10_000, signal, slow, rows);
    await request(url, policy, gate, 10_000, signal, slow, rows);
    assert.equal(rows[1]!.startMs, policy === "start" ? 800 : 1350);
    checks.push(`${policy} clock with response slower than spacing`);
  }
  for (const value of [null, "5", "60", "Sat, 17 Oct 2026 00:01:00 GMT", "nonsense"]) {
    const gate = reset(); const rows: Row[] = [];
    await assert.rejects(request(url, "start", gate, 120_000, signal,
      async () => new Response(null, { status: 429, headers: value ? { "Retry-After": value } : {} }), rows),
      (e: unknown) => e instanceof Stop && e.reason === "rate_limited");
    const delay = value === "60" || value?.startsWith("Sat") ? 60_000 : 31_000;
    assert.equal(gate.cooldownUntil, delay);
    let sent = false;
    await assert.rejects(request(url, "start", gate, 30_999, signal, async () => { sent = true; return page(); }, rows));
    assert.equal(sent, false);
    // A new invocation shares the gate; it can proceed only at expiry.
    await request(url, "start", gate, 120_000, signal, async () => { assert.equal(time, delay); return page(); }, rows);
    checks.push(`429 cooldown and new invocation: Retry-After=${value}`);
  }
  {
    const gate = reset(); const rows: Row[] = [];
    await Promise.all([0, 1, 2].map(() => request(url, "start", gate, 10_000, signal, async () => page(), rows)));
    assert.deepEqual(rows.map(r => r.startMs), [0, 550, 1100]);
    checks.push("simultaneous callers serialize and space starts");
  }
  {
    const gate = reset(); gate.lastStart = 0;
    const sleeping = fake.sleep;
    let waits = 0;
    fake.sleep = async (ms, s) => {
      await sleeping(ms, s);
      if (++waits === 1) gate.limited("60");
    };
    assert.equal(await gate.admit("start", 120_000, signal), 60_550);
    fake.sleep = sleeping;
    time += 2000;
    assert.equal(await gate.admit("start", 120_000, signal), 62_550);
    assert.equal(await gate.admit("start", 120_000, signal), 63_100);
    checks.push("cooldown rechecked after wait and no late-timer catch-up burst");
  }
  {
    const gate = reset(); gate.lastStart = 0;
    const controller = new AbortController(); const rows: Row[] = [];
    const sleeping = fake.sleep;
    fake.sleep = async (_ms, s) => { controller.abort(); s.throwIfAborted(); };
    await assert.rejects(request(url, "start", gate, 1000, controller.signal, async () => page(), rows));
    assert.equal(rows.length, 0); fake.sleep = sleeping;
    checks.push("cancellation while waiting dispatches nothing");
  }
  {
    const gate = reset(); const controller = new AbortController(); const rows: Row[] = [];
    await assert.rejects(request(url, "start", gate, 1000, controller.signal,
      async (_url, init) => { controller.abort(); init.signal!.throwIfAborted(); return page(); }, rows),
      (e: unknown) => e instanceof Stop && e.reason === "cancelled");
    checks.push("in-flight HTTP cancellation propagates");
  }
  {
    const gate = reset(); const rows: Row[] = []; gate.lastStart = 0;
    await assert.rejects(request(url, "start", gate, 500, signal, async () => page(), rows),
      (e: unknown) => e instanceof Stop && e.reason === "scan_timeout");
    assert.equal(rows.length, 0);
    await assert.rejects(request(url, "start", gate, 600, signal, slow, rows),
      (e: unknown) => e instanceof Stop && e.reason === "scan_timeout");
    assert.equal(rows[0]!.cards, undefined);
    checks.push("deadline prevents dispatch and rejects late response");
  }
  console.log(JSON.stringify({ bun: Bun.version, zod: zodPackage.version, checks, passed: checks.length }, null, 2));
}
if (process.argv.includes("--self-test")) await fixtures();
else if (process.argv.includes("--live")) {
  const saved = Bun.file("/tmp/tomekin-scryfall-pacing-cooldown-until");
  if (await saved.exists() && Number(await saved.text()) > Date.now()) throw new Error("Prior 429 cooldown is still active; do not dispatch.");
  await live();
} else console.log("Pass --self-test (offline) or --live [--out=path] (at most 48 HTTP requests, 550ms minimum spacing).");
