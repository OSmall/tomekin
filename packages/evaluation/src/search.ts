import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {
    agentToolResultDetails,
    createProviderDispatchOwner,
    type RetrievalSuccess,
    type CardResult,
} from "@tomekin/core";
import {
    createCoreTool,
    createPiWorkerTransport,
    type PiToolOutput,
} from "@tomekin/pi";
import {resultToOpencodeOutput} from "@tomekin/opencode";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {
    createFixture,
    fixtureRevision,
    id,
    log,
    type WorkflowName,
} from "./fixtures";
import {coverage, summarize, utf8Bytes} from "./baseline";
const measure = (text: string) => ({
    utf8Bytes: utf8Bytes(text),
    estimatedTokens: {
        method: "ceil(UTF-8 bytes / 4)",
        value: Math.ceil(utf8Bytes(text) / 4),
    },
});
async function observe(name: WorkflowName) {
    const fixture = createFixture(name),
        sourceText = "Draw a card. ".repeat(100),
        starts: number[] = [];
    const source = Array.from(
        {length: fixture.manifest.identities},
        (_, index) => ({
            object: "card",
            id: id(index + 100),
            oracle_id: id(index + 1),
            name: `Synthetic ${String(index + 1).padStart(3, "0")} — Æ`,
            layout: "normal",
            oracle_text: index === 0 ? sourceText : "Draw a card.",
        }),
    );
    let time = 0,
        calls = 0;
    const provider = createProviderDispatchOwner({
        now: () => time,
        wallNow: () => time,
        wait: async (ms) => {
            time += ms;
        },
        async dispatch(raw) {
            calls++;
            starts.push(time);
            const url = new URL(raw),
                page = Number(url.searchParams.get("page") ?? 1),
                offset = (page - 1) * 4,
                more = offset + 4 < source.length;
            const next = new URL(url);
            next.searchParams.set("page", String(page + 1));
            return {
                status: 200,
                body: {
                    object: "list",
                    data: source.slice(offset, offset + 4),
                    has_more: more,
                    ...(more ? {next_page: next.href} : {}),
                    total_cards: source.length,
                },
            };
        },
    });
    const runtime = createLocalAgentToolRuntime({
            databasePath: fixture.databasePath,
            log,
            search: {provider},
        }),
        transport = createPiWorkerTransport({
            workerUrl: new URL(
                "../../pi/src/tomekin-worker.ts",
                import.meta.url,
            ).href,
            provider,
        });
    const args = {
        q: "fixture:synthetic",
        unique: "cards" as const,
        select: {name: true as const, oracle_text: true as const},
        first: 3,
    };
    const timings: Record<string, number> = {};
    const stage = async <T>(key: string, work: () => Promise<T> | T) => {
        const start = performance.now();
        try {
            return await work();
        } finally {
            timings[key] = (timings[key] ?? 0) + performance.now() - start;
        }
    };
    try {
        const firstResult = await stage("firstSearchHandler", () =>
            runtime.handlers.searchCards(args),
        );
        if (firstResult.isErr())
            throw new Error(
                JSON.stringify(agentToolResultDetails(firstResult)),
            );
        const first = firstResult.value,
            collected = [...first.edges],
            pageBytes = [utf8Bytes(JSON.stringify(first))];
        let page: RetrievalSuccess<CardResult> = first;
        while (page.pageInfo.hasNextPage) {
            const next = await stage("ordinaryContinuation", () =>
                runtime.handlers.searchCards({
                    ...args,
                    after: page.pageInfo.endCursor!,
                }),
            );
            if (next.isErr())
                throw new Error(JSON.stringify(agentToolResultDetails(next)));
            page = next.value;
            collected.push(...page.edges);
            pageBytes.push(utf8Bytes(JSON.stringify(page)));
        }
        const providerCalls = calls,
            actual = collected.map((edge) => edge.node.card.oracle_id),
            application = await stage("applicationSerialization", () =>
                JSON.stringify(first),
            );
        const openCode = await stage("openCodeSerialization", () =>
            resultToOpencodeOutput(firstResult),
        );
        const fallback = (await stage("piFallbackIncludingRuntime", () =>
            createCoreTool("search_cards", {
                log,
                createRuntime: () =>
                    createLocalAgentToolRuntime({
                        databasePath: fixture.databasePath,
                        log,
                        search: {provider},
                    }),
            }).execute("search-fallback", args, new AbortController().signal),
        )) as PiToolOutput;
        const worker = (await stage("piWorkerIncludingStartupRuntime", () =>
            createCoreTool("search_cards", {
                log,
                transport,
                databasePath: fixture.databasePath,
            }).execute("search-worker", args, new AbortController().signal),
        )) as PiToolOutput;
        const adapter = (output: PiToolOutput) => {
            const text = output.content.map((part) => part.text).join("");
            return {
                ...measure(text),
                completeEnvelope: text === application,
                completeRecords: (JSON.parse(text).edges ?? []).length,
            };
        };
        return {
            name,
            fixtureRevision,
            sourceCount: source.length,
            returnedCount: actual.length,
            providerCalls,
            adapterProviderCalls: calls - providerCalls,
            pages: pageBytes.length,
            pageBytes,
            coverage: coverage(
                source.map((card) => card.oracle_id),
                actual,
            ),
            completeOracleText:
                collected[0]?.node.card.oracle_text === sourceText,
            scopedTotal: page.metadata.scoped_total,
            application: measure(application),
            adapters: {
                openCodeSerialization: {
                    ...measure(openCode),
                    completeEnvelope: openCode === application,
                },
                piFallback: adapter(fallback),
                piWorker: adapter(worker),
            },
            timingsMs: timings,
            fixtureAdmission: {
                clock: "synthetic monotonic clock; no live timing claim",
                actualStartOffsetsMs: starts,
            },
            limits: {
                collection:
                    "Unfiltered card facts; no Collection eligibility or Availability evidence.",
                network:
                    "Injected synthetic provider; no live network, census or throughput claim.",
                models: "No LLM run; tokens are estimates.",
            },
        };
    } finally {
        runtime.close();
        await transport.close();
        fixture.dispose();
    }
}
export async function runSearchEvaluation(options: {warmRuns?: number} = {}) {
    const warmRuns = options.warmRuns ?? 5;
    if (!Number.isInteger(warmRuns) || warmRuns < 1)
        throw new Error("warmRuns must be positive");
    const workflows = [];
    for (const name of [
        "discovery",
        "construction",
        "tuning",
        "assembly",
    ] as const) {
        const cold = await observe(name);
        await observe(name);
        const warm: Awaited<ReturnType<typeof observe>>[] = [];
        for (let i = 0; i < warmRuns; i++) warm.push(await observe(name));
        workflows.push({
            ...cold,
            timingProtocol: {
                cold: cold.timingsMs,
                warm: Object.fromEntries(
                    Object.keys(cold.timingsMs).map((key) => [
                        key,
                        summarize(warm.map((sample) => sample.timingsMs[key]!)),
                    ]),
                ),
            },
        });
    }
    return {
        kind: "provider-search-v1",
        runtime: {
            bun: Bun.version,
            platform: process.platform,
            architecture: process.arch,
        },
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
        }).trim(),
        fixtureSha256: createHash("sha256")
            .update(readFileSync(new URL("./fixtures.ts", import.meta.url)))
            .digest("hex"),
        protocol: {
            cold: 1,
            unmeasuredWarmup: 1,
            warmRuns,
            comparison:
                "Same public synthetic workflow identities/names/complete Oracle text. No Collection filtering or live model/network comparison.",
            openCode:
                "Actual result serializer; actual tool-loader/schema execution has separate adapter integration tests.",
        },
        workflows,
    };
}
if (import.meta.main)
    console.log(JSON.stringify(await runSearchEvaluation(), null, 2));
