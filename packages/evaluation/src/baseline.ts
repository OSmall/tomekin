import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {cpus} from "node:os";
import {createHash} from "node:crypto";
import type {DeckCandidate} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, type PiToolOutput} from "@tomekin/pi";
import {resultToOpencodeOutput} from "@tomekin/opencode";
import {brief, createFixture, fixtureRevision, id, log, manifests, type WorkflowName} from "./fixtures";

export const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;
export function coverage(expected: readonly string[], actual: readonly string[]) {
    const expectedSet = new Set(expected), actualSet = new Set(actual);
    return {missing: [...expectedSet].filter((value) => !actualSet.has(value)), unexpected: [...actualSet].filter((value) => !expectedSet.has(value)), duplicates: [...actualSet].filter((value) => actual.filter((item) => item === value).length > 1)};
}
const unknown = (reason: string) => ({status: "unknown" as const, reason});
function unwrap<T>(result: {isErr(): boolean; value?: T; error?: unknown}): T {
    if (result.isErr()) throw new Error(`Synthetic workflow failed: ${JSON.stringify(result.error)}`);
    return result.value!;
}
function measurement(text: string) {
    return {utf8Bytes: utf8Bytes(text), utf16Characters: text.length, tokens: {status: "estimated", method: "ceil(UTF-8 bytes / 4)", value: Math.ceil(utf8Bytes(text) / 4)}};
}
export function summarize(samples: readonly number[]) {
    const sorted = [...samples].sort((a, b) => a - b);
    return {samplesMs: samples, medianMs: sorted[Math.floor(sorted.length / 2)]!, minMs: sorted[0]!, maxMs: sorted.at(-1)!};
}

async function runWorkflow(name: WorkflowName) {
    const fixture = createFixture(name);
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    const timings: Record<string, number> = {};
    async function stage<T>(name: string, work: () => Promise<T> | T) {
        const start = performance.now();
        try {return await work();} finally {timings[name] = (timings[name] ?? 0) + performance.now() - start;}
    }
    try {
        const input = {filter: {op: "=", args: [{property: "collection.locationType"}, "binder"]}, include: {collectionCards: true, tags: true}, limit: 200};
        const queried = await stage("queryHandlerIncludingReadinessCompilationSelectionTotalsHydration", () => runtime.handlers.queryCards(input));
        const query = unwrap(queried);
        const allIdentities = unwrap(await runtime.handlers.queryCards({limit: 200}));
        const bounded = unwrap(await stage("boundedQueryHandler", () => runtime.handlers.queryCards({...input, limit: 3})));
        const factNames = query.items.slice(0, 7).map((item) => item.name);
        const firstLookup = unwrap(await stage("firstKnownCardLookup", () => runtime.handlers.resolveDecklistCards({names: factNames.slice(0, 5)})));
        const secondLookup = unwrap(await stage("secondKnownCardLookup", () => runtime.handlers.resolveDecklistCards({names: factNames})));
        const actual = query.items.map((item) => item.id);
        const expected = Array.from({length: fixture.manifest.allowedIdentities}, (_, index) => id(index + (name === "tuning" ? 13 : 1)));
        const observedRows = query.items.flatMap((item) => item.collectionCards ?? []);
        const ownedCopies = observedRows.reduce((total, row) => total + row.quantity, 0);
        const applicationText = await stage("applicationSerialization", () => JSON.stringify(query, null, 2));
        const opencode = await stage("openCodeSerialization", () => resultToOpencodeOutput(queried));
        const piFallback = await stage("piFallbackIncludingRuntimeAndQuery", () => createCoreTool("query_cards", {log, createRuntime: () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log})}).execute("synthetic-fallback", input, new AbortController().signal)) as PiToolOutput;
        const transport = createPiWorkerTransport({workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url).href});
        let piWorker: PiToolOutput;
        try {
            piWorker = await stage("piWorkerIncludingStartupRuntimeAndQuery", () => transport.invoke({toolCallId: "synthetic-worker", toolName: "query_cards", params: input, databasePath: fixture.databasePath}, new AbortController().signal));
        } finally {await transport.close();}
        const adapter = (output: PiToolOutput) => {
            const details = output.details as {truncated?: boolean; items?: {id: string}[]};
            return {...measurement(output.content.map((item) => item.text).join("")), clipped: details.truncated === true, wholeRecordLoss: details.truncated ? query.items.length : 0, completeRecords: details.truncated ? 0 : details.items?.length ?? 0, recovery: {status: "unsupported", reason: "Legacy query_cards has neither cursor nor offset; clipped preview is not a complete result."}};
        };
        const selectedRows = name === "tuning" ? 12 : 20;
        const initialIds = Array.from({length: selectedRows}, (_, index) => id(index + 1));
        const finalIds = name === "tuning" ? [...initialIds.slice(0, 9), id(13), id(14), id(15)] : initialIds;
        const initialInput = candidateCreateInput(initialIds, "Synthetic candidate", () => selectedRows === 12 ? 5 : 3);
        let threeCardSave: {beforeRows: number; afterRows: number; quantity: number; added: number; removed: number} | null = null;
        let legality: unknown = null;
        let selected: {rows: number; copies: number} | null = null;
        let candidatePayload: {fullPayloads: number; inputBytes: number; repeatedBriefBytes: number; repeatedUnchangedCardRows: number} | null = null;
        if (name !== "discovery") {
            const candidate = await stage("candidateCreateHandler", () => runtime.handlers.createDeckCandidate(initialInput).then(unwrap));
            const editInput = candidateRevisionInput(candidate, initialIds, finalIds, () => selectedRows === 12 ? 5 : 3);
            await stage("candidateEditHandler", () => runtime.handlers.editDeckCandidate(editInput).then(unwrap));
            const read = unwrap<DeckCandidate | unknown>(await stage("candidateReadHandler", () => runtime.handlers.getDeckCandidate({id: candidate.candidate_id, view: "state"}))) as DeckCandidate;
            if (!("cards" in read)) throw new Error("Expected explicit candidate state");
            const savedIds = read.cards.map((card) => card.cardIdentityId);
            if (coverage(finalIds, savedIds).missing.length || savedIds.length !== selectedRows) throw new Error("Saved candidate coverage mismatch");
            selected = {rows: read.cards.length, copies: read.cards.reduce((total, card) => total + card.quantity, 0)};
            if (name === "tuning") threeCardSave = {beforeRows: initialIds.length, afterRows: read.cards.length, quantity: selected.copies, added: 3, removed: 3};
            const check = {candidate_id:read.id,expected_updated_at:read.updatedAt};
            const validation = await stage("explicitValidationHandler", () => runtime.handlers.validateFormatLegality(check).then(unwrap));
            legality = validation;
            await stage("explicitEvaluationHandler", () => runtime.handlers.evaluateDeckCandidate(check).then(unwrap));
            await stage("explicitRenderingHandler", () => runtime.handlers.renderDeckCandidate({candidate_id:candidate.candidate_id, output:"report"}));
            candidatePayload = {fullPayloads: 1, inputBytes: utf8Bytes(JSON.stringify(initialInput)) + utf8Bytes(JSON.stringify(editInput)), repeatedBriefBytes: 0, repeatedUnchangedCardRows: 0};
        }
        return {name, boundedTraversal: {requested: 3, returned: bounded.items.length, missing: coverage(expected, bounded.items.map((item) => item.id)).missing.length, recovery: "unsupported"},
            factCompleteness: {longTextSourceCharacters: 1300, longTextReturnedCharacters: query.items.find((item) => item.id === id(1))?.oracleText?.length ?? null, complete: name === "tuning" ? null : query.items.find((item) => item.id === id(1))?.oracleText === "Draw a card. ".repeat(100), multipart: unknown("This pre-migration corpus has no multipart facts; later projection fixtures must add their acceptance oracle")},
            factLookups: {first: firstLookup.resolved.length, second: secondLookup.resolved.length, repeated: firstLookup.resolved.filter((card) => secondLookup.resolved.some((other) => other.id === card.id)).length, misses: firstLookup.unresolved.length + secondLookup.unresolved.length, providerCalls: 0},
            legality, observed: {identities: allIdentities.items.length, printings: fixture.manifest.printings, ownedRows: fixture.rows.length, copies: fixture.rows.reduce((total, row) => total + row.quantity, 0), allowedIdentities: actual.length}, coverage: coverage(expected, actual), scopedEvidence: {rows: observedRows.length, copies: ownedCopies, sameRowWitnesses: observedRows.map((row) => ({row: row.collectionCardId, printing: row.cardPrintingId, location: row.locationId, finish: row.finish, quantity: row.quantity})).sort((a, b) => a.row.localeCompare(b.row))}, application: measurement(applicationText), adapters: {openCode: {...measurement(opencode), clipped: false, completeRecords: query.items.length, hostClipping: unknown("OpenCode host capacity is outside this serializer seam")}, piFallback: adapter(piFallback), piWorker: adapter(piWorker)}, timingsMs: timings, threeCardSave, selected, candidatePayload,
            repeatedFacts: {requestedRetrievals: 3, repeatedIdentityOccurrences: actual.length * 2, reason: "The same complete query is repeated solely to compare actual adapter paths; not agent workflow efficiency."},
            limitations: {provider: unknown("Legacy local SQL path makes zero provider calls; provider scheduling/cooldown not applicable"), internalStages: unknown("Existing repository does not instrument individual compile/selection/totals/hydration spans"), finalAvailability: unknown("Current tools do not establish whole-deck joint allocation"), strategicQuality: unknown("Synthetic facts are measurement inputs, not human-reviewed strategy"), legalRealDeck: unknown("Synthetic names and facts cannot establish real-card format legality")}};
    } finally {runtime.close(); fixture.dispose();}
}
export async function runBaseline(options: {warmRuns?: number} = {}) {
    const count = options.warmRuns ?? 5;
    if (!Number.isInteger(count) || count < 1) throw new Error("warmRuns must be a positive integer");
    const workflows = [];
    for (const name of ["discovery", "construction", "tuning", "assembly"] as const) {
        const cold = await runWorkflow(name);
        await runWorkflow(name); // one unmeasured warm-up
        const warm: Awaited<ReturnType<typeof runWorkflow>>[] = [];
        for (let i = 0; i < count; i++) warm.push(await runWorkflow(name));
        workflows.push({...cold, conditions: {cold: "First dispatch against freshly seeded on-disk SQLite; OS cache not flushed", warm: "One warm-up then fresh equivalent databases; process/modules and OS cache may be warm", warmRuns: count}, stageVariance: Object.fromEntries(Object.keys(cold.timingsMs).map((stage) => [stage, {coldMs: cold.timingsMs[stage], warm: summarize(warm.map((run) => run.timingsMs[stage]!))}]))});
    }
    const commanderCold = await runCommanderSizeSave();
    await runCommanderSizeSave();
    const commanderWarm = [];
    for (let index = 0; index < count; index++) commanderWarm.push((await runCommanderSizeSave()).timingsMs);
    return {sourceCommit: process.env.TOMEKIN_EVALUATION_SOURCE_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), harnessSourceSha256: createHash("sha256").update(readFileSync(new URL("./baseline.ts", import.meta.url))).digest("hex"), fixtureSourceSha256: createHash("sha256").update(readFileSync(new URL("./fixtures.ts", import.meta.url))).digest("hex"), commanderSizeWorkload: {...commanderCold, variance: summarize(commanderWarm)}, schemaVersion: 1, fixtureRevision, fixtureManifestSha256: createHash("sha256").update(JSON.stringify(manifests)).digest("hex"), runtime: {bun: Bun.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? "unknown"}, mode: "synthetic-local-no-network-no-LLM", workflows};
}
async function runCommanderSizeSave() {
    const fixture = createFixture("commanderSize");
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const initial = Array.from({length: 69}, (_, index) => id(index + 1));
        const final = [...initial.slice(0, 66), id(70), id(71), id(72)];
        const input = candidateCreateInput(initial, "Synthetic 100-copy size probe", index => index === 0 ? 32 : 1);
        const created = unwrap(await runtime.handlers.createDeckCandidate(input));
        const editInput = candidateRevisionInput(created, initial, final, index => index === 0 ? 32 : 1);
        const start = performance.now();
        const edited = unwrap(await runtime.handlers.editDeckCandidate(editInput));
        const result = unwrap<DeckCandidate | unknown>(await runtime.handlers.getDeckCandidate({id: created.candidate_id, view: "state"})) as DeckCandidate;
        if (!("cards" in result)) throw new Error("Expected explicit candidate state");
        const timingsMs = performance.now() - start;
        return {beforeRows: 69, afterRows: result.cards.length, quantity: result.cards.reduce((sum, card) => sum + card.quantity, 0), added: coverage(initial, final).unexpected.length, removed: coverage(initial, final).missing.length, timingsMs, inputBytes: utf8Bytes(JSON.stringify(editInput)), outputBytes: utf8Bytes(JSON.stringify(edited)), shape: "Commander-sized only; synthetic Casual 60 create/edit, no legality or strategic claim"};
    } finally {runtime.close(); fixture.dispose();}
}
function candidateCreateInput(
    ids: string[],
    label: string,
    quantity: (index: number) => number,
) {
    return {
        label,
        brief,
        plan: {
            schema_version: 1,
            description:
                "Synthetic fixture selection; no strategic-quality claim.",
            nodes: [
                {
                    ref: "selection",
                    kind: "role",
                    label: "Synthetic selection",
                    description: "Retain fixture options for measurement",
                },
            ],
            contributions: ids.map((card_identity_id) => ({
                card_identity_id,
                role_ref: "selection",
                rationale:
                    "Synthetic fixture contribution for persistence measurement",
            })),
        },
        options: ids.map((card_identity_id) => ({ card_identity_id })),
        memberships: ids.map((card_identity_id, index) => ({
            card_identity_id,
            section: "mainboard",
            quantity: quantity(index),
            sort_order: index,
        })),
    };
}
function candidateRevisionInput(
    created: {
        candidate_id: string;
        updated_at: string;
        created_ids: Record<string, string>;
    },
    before: string[],
    after: string[],
    quantity: (index: number) => number,
) {
    const added = after.filter((id) => !before.includes(id)),
        removed = before.filter((id) => !after.includes(id));
    return {
        candidate_id: created.candidate_id,
        expected_updated_at: created.updated_at,
        changes: {
            options: added.map((card_identity_id) => ({
                action: "add",
                card_identity_id,
            })),
            contributions: added.map((card_identity_id) => ({
                action: "add",
                contribution: {
                    card_identity_id,
                    role_id: created.created_ids.selection,
                    rationale:
                        "Synthetic fixture contribution for persistence measurement",
                },
            })),
            memberships: [
                ...removed.map((card_identity_id) => ({
                    action: "remove",
                    card_identity_id,
                    section: "mainboard",
                })),
                ...added.map((card_identity_id) => {
                    const index = after.indexOf(card_identity_id);
                    return {
                        action: "set",
                        card_identity_id,
                        section: "mainboard",
                        quantity: quantity(index),
                        sort_order: index,
                    };
                }),
            ],
        },
    };
}
if (import.meta.main) {
    const report = await runBaseline();
    console.log(JSON.stringify(report, null, 2));
}
