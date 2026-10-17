import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, type PiToolOutput} from "@tomekin/pi";
import {resultToOpencodeOutput} from "@tomekin/opencode";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createFixture, fixtureRevision, id, log, type WorkflowName} from "./fixtures";
import {coverage, summarize, utf8Bytes} from "./baseline";

const measure = (text: string) => ({utf8Bytes: utf8Bytes(text), tokenEstimate: {method: "ceil(UTF-8 bytes / 4)", value: Math.ceil(utf8Bytes(text) / 4)}});
async function observe(name: WorkflowName) {
    const fixture = createFixture(name);
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    const transport = createPiWorkerTransport({workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url).href});
    const references = Array.from({length: 7}, (_, index) => ({kind: "oracle_id" as const, value: id(index + 1)}));
    const args = {references, select: {name: true as const, oracle_text: true as const}, first: 3};
    const timings: Record<string, number> = {};
    const stage = async <T>(name: string, work: () => Promise<T> | T) => {const started = performance.now(); try {return await work();} finally {timings[name] = performance.now() - started;}};
    try {
        const first = (await stage("firstLookupHandler", () => runtime.handlers.lookupCards(args)))._unsafeUnwrap();
        const collected = [...first.edges];
        const pageBytes = [utf8Bytes(JSON.stringify(first))];
        let page = first;
        while (page.pageInfo.hasNextPage) {
            page = (await stage(`continuation${pageBytes.length}`, () => runtime.handlers.lookupCards({...args, after: page.pageInfo.endCursor})))._unsafeUnwrap();
            pageBytes.push(utf8Bytes(JSON.stringify(page)));
            collected.push(...page.edges);
        }
        const actual = collected.flatMap((edge) => edge.node.status === "found" ? [edge.node.card.oracle_id] : []);
        const applicationText = await stage("applicationSerialization", () => JSON.stringify(first));
        const openCode = await stage("openCodeSerialization", () => resultToOpencodeOutput({isOk: () => true, isErr: () => false, value: first}));
        const fallback = await stage("piFallbackIncludingRuntime", () => createCoreTool("lookup_cards", {log, createRuntime: () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log})}).execute("lookup-fallback", args, new AbortController().signal)) as PiToolOutput;
        const worker = await stage("piWorkerIncludingStartupRuntime", () => createCoreTool("lookup_cards", {log, transport, databasePath: fixture.databasePath}).execute("lookup-worker", args, new AbortController().signal)) as PiToolOutput;
        const adapter = (output: PiToolOutput) => {const text = output.content.map((part) => part.text).join(""); const envelope = JSON.parse(text); return {...measure(text), completeEnvelope: text === JSON.stringify(envelope) && JSON.stringify(envelope) === JSON.stringify(first), completeRecords: envelope.edges.length, clipped: "truncated" in envelope};};
        const sourceText = "Draw a card. ".repeat(100);
        const returnedText = collected.flatMap((edge) => edge.node.status === "found" && edge.node.card.oracle_id === id(1) ? [edge.node.card.oracle_text] : [])[0];
        const additional = (await stage("additionalSelectedFacts", () => runtime.handlers.lookupCards({references: references.slice(0, 5), select: {tags: true}})))._unsafeUnwrap();
        const repeatedOracleText = additional.edges.filter((edge) => edge.node.status === "found" && "oracle_text" in edge.node.card).length;
        return {name, fixtureRevision, providerCalls: 0, requestedOccurrences: 7, returnedOccurrences: actual.length, pages: pageBytes.length, pageBytes, coverage: coverage(references.map((reference) => reference.value), actual), completeRequiredFacts: {oracleTextSourceCharacters: sourceText.length, oracleTextReturnedCharacters: typeof returnedText === "string" ? returnedText.length : null, completeOracleText: returnedText === sourceText, multipart: "Not present in matched workflow fixture; independently covered by public multipart handler tests."}, additionalFacts: {returned: additional.edges.length, repeatedOracleText}, application: measure(applicationText), adapters: {openCode: {...measure(openCode), completeEnvelope: openCode === applicationText}, piFallback: adapter(fallback), piWorker: adapter(worker)}, timingsMs: timings, limits: {collectionEvidence: "Not requested; no Collection or final Availability claim.", liveModelNetwork: "Not run; no measured tokens or network pacing evidence."}};
    } finally {runtime.close(); await transport.close(); fixture.dispose();}
}
export async function runLookupEvaluation(options: {warmRuns?: number} = {}) {
    const warmRuns = options.warmRuns ?? 5;
    if (!Number.isInteger(warmRuns) || warmRuns < 1) throw new Error("warmRuns must be positive");
    const workflows = [];
    for (const name of ["discovery", "construction", "tuning", "assembly"] as const) {
        const cold = await observe(name);
        await observe(name);
        const warm: Awaited<ReturnType<typeof observe>>[] = [];
        for (let index = 0; index < warmRuns; index++) warm.push(await observe(name));
        workflows.push({...cold, timingProtocol: {cold: cold.timingsMs, warm: Object.fromEntries(Object.keys(cold.timingsMs).map((stage) => [stage, summarize(warm.map((sample) => sample.timingsMs[stage]!))]))}});
    }
    return {kind: "local-lookup-v1", runtime: {bun: Bun.version, platform: process.platform, architecture: process.arch}, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), fixtureSha256: createHash("sha256").update(readFileSync(new URL("./fixtures.ts", import.meta.url))).digest("hex"), protocol: {cold: 1, unmeasuredWarmup: 1, warmRuns, tokenUsage: "Estimates only; no model run.", comparison: "Matched synthetic source records and required full Oracle text. This lookup-only slice does not measure provider discovery, candidate edits or final Availability."}, workflows};
}
if (import.meta.main) console.log(JSON.stringify(await runLookupEvaluation(), null, 2));
