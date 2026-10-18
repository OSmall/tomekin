import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {cpus} from "node:os";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {closeDatabase, createSqliteCollectionRepository, openDatabase} from "@tomekin/sqlite";
import {createCoreTool, createPiWorkerTransport, type PiToolOutput} from "@tomekin/pi";
import {resultToOpencodeOutput} from "@tomekin/opencode";
import type {DeckCandidate, CandidateViewRecord} from "@tomekin/core";
import {brief, createFixture, fixtureRevision, id, log} from "./fixtures";
import {coverage, summarize, utf8Bytes} from "./baseline";

type Runtime = ReturnType<typeof createLocalAgentToolRuntime>;
type Workload = "tuning" | "commanderSize";
function unwrap<T>(result: {isErr(): boolean; value?: T; error?: unknown}): T {
    if (result.isErr()) throw new Error(JSON.stringify(result.error));
    return result.value!;
}
function requireEvidence(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(`Incomplete performance fixture: ${message}`);
}

// Traverse the supported public continuation, retaining every complete record.
async function readView(runtime: Runtime, candidateId: string, view: "json" | "portable_decklist" | "report" | "collection_pull_list") {
    const records: CandidateViewRecord[] = [];
    let after: string | undefined, pages = 0, bytes = 0;
    do {
        const result = await runtime.handlers.getDeckCandidate({id: candidateId, view, first: 50, ...(after ? {after} : {})});
        if (result.isErr()) throw new Error(JSON.stringify(result.error));
        const page = result.value;
        if (!("edges" in page)) throw new Error("Expected bounded candidate view");
        records.push(...page.edges.map(edge => edge.node));
        bytes += utf8Bytes(JSON.stringify(page));
        pages++;
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor! : undefined;
    } while (after);
    return {records, pages, bytes};
}
function restore(records: CandidateViewRecord[]): DeckCandidate {
    let value: any;
    for (const record of records) {
        if (!record.path.length) {value = record.value; continue;}
        let parent = value;
        for (const key of record.path.slice(0, -1)) parent = parent[key];
        parent[record.path.at(-1)!] = record.value;
    }
    return value;
}
function checkStatuses(candidate: DeckCandidate) {
    const checks = candidate.validation_evidence!.checks!;
    return {legality: checks.format_legality.status, evaluation: checks.deck_evaluation.status, collection_availability: checks.collection_availability.status};
}

async function observe(name: Workload) {
    const fixture = createFixture(name), timingsMs: Record<string, number> = {};
    async function stage<T>(key: string, work: () => Promise<T> | T): Promise<T> {
        const start = performance.now();
        try {return await work();} finally {timingsMs[key] = (timingsMs[key] ?? 0) + performance.now() - start;}
    }
    // The old fixture's owned rows predate import identity. Give the same rows a successful,
    // current snapshot before timing, so final Availability proves actual current ownership.
    const db = openDatabase(fixture.databasePath, {log});
    let importedId: string;
    try {
        importedId = unwrap(await createSqliteCollectionRepository(db, {now: () => new Date("2026-10-18T00:00:00.123Z")}).replaceCollectionSnapshot({
            sourcePath: "synthetic-performance.csv", importedAt: new Date("2026-10-18T00:00:00.123Z"),
            snapshot: {
                locations: [{id: id(901), type: "binder", name: "Allowed 1"}, {id: id(902), type: "binder", name: "Allowed 2"}, {id: id(903), type: "deck", name: "Excluded"}],
                cards: fixture.rows.map((row, i) => ({id: row.id, quantity: row.quantity, collectionLocationId: row.locationId, finish: row.finish, manaBoxId: null, cardPrintingId: row.printingId, misprint: false, altered: false, condition: null, purchasePriceCurrency: null, purchasePrice: null, addedAt: null, sourceRowNumber: i + 1})),
            },
            summary: {importedRowCount: fixture.rows.length, totalQuantity: fixture.manifest.copies, locationCount: 3, binderCount: 2, deckCount: 1}, warnings: [],
        })).id;
    } finally {closeDatabase(db);}
    const runtime = await stage("runtimeStartup", () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log}));
    const transport = createPiWorkerTransport({workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url).href, createWorker: url => new Worker(url, {env: {...process.env as Record<string, string>, TOMEKIN_LOG_ENABLED: "false"}})});
    try {
        const rowCount = name === "tuning" ? 12 : 69;
        const initial = Array.from({length: rowCount}, (_, i) => id(i + 1));
        const added = Array.from({length: 3}, (_, i) => id(rowCount + i + 1));
        const final = [...initial.slice(0, -3), ...added];
        const quantity = (i: number) => name === "tuning" ? 5 : i === 0 ? 32 : 1;
        const input = {
            label: "Synthetic three-card revision",
            brief: {...brief, collectionAccessPolicy: {confirmed: true, collection_import_id: importedId, allowed_locations: [{type: "binder", name: "Allowed 1"}, {type: "binder", name: "Allowed 2"}]}},
            plan: {schema_version: 1, description: "Synthetic persistence measurement; no strategy claim.", nodes: [{ref: "role", kind: "role", label: "Synthetic role", description: "Retain contextual fixture reasoning."}], contributions: initial.map(card_identity_id => ({card_identity_id, role_ref: "role", rationale: "Synthetic complete contribution retained for measurement."}))},
            options: initial.map(card_identity_id => ({card_identity_id})),
            memberships: initial.map((card_identity_id, i) => ({card_identity_id, section: "mainboard", quantity: quantity(i), sort_order: i})),
        };
        const created = unwrap(await stage("candidateCreate", () => runtime.handlers.createDeckCandidate(input)));
        const editInputFor = (candidate: typeof created) => ({candidate_id: candidate.candidate_id, expected_updated_at: candidate.updated_at, changes: {
            options: added.map(card_identity_id => ({action: "add", card_identity_id})),
            contributions: added.map(card_identity_id => ({action: "add", contribution: {card_identity_id, role_id: candidate.created_ids.role, rationale: "Synthetic replacement; preserve the same role."}})),
            memberships: [...initial.slice(-3).map(card_identity_id => ({action: "remove", card_identity_id, section: "mainboard"})), ...added.map((card_identity_id, i) => ({action: "set", card_identity_id, section: "mainboard", quantity: quantity(rowCount - 3 + i), sort_order: rowCount - 3 + i}))],
        }});
        const editInput = editInputFor(created);
        const editResult = await stage("candidateEdit", () => runtime.handlers.editDeckCandidate(editInput));
        const edited = unwrap(editResult);
        const before = restore((await stage("completeReadBeforeChecks", () => readView(runtime, created.candidate_id, "json"))).records);
        const checkInput = {candidate_id: created.candidate_id, expected_updated_at: edited.updated_at};
        const legality = unwrap(await stage("explicitLegality", () => runtime.handlers.validateFormatLegality(checkInput)));
        const evaluation = unwrap(await stage("explicitEvaluation", () => runtime.handlers.evaluateDeckCandidate(checkInput)));
        const availability = unwrap(await stage("explicitAvailability", () => runtime.handlers.checkCollectionAvailability(checkInput)));
        const after = restore((await stage("completeReadAfterChecks", () => readView(runtime, created.candidate_id, "json"))).records);
        const report = await stage("optionalCompleteReport", () => readView(runtime, created.candidate_id, "report"));
        const decklist = await stage("optionalCompletePortableDecklist", () => readView(runtime, created.candidate_id, "portable_decklist"));
        const pulls = await stage("optionalCompletePullList", () => readView(runtime, created.candidate_id, "collection_pull_list"));
        const lookup = unwrap(await stage("replacementFactLookup", () => runtime.handlers.lookupCards({references: added.map(value => ({kind: "oracle_id", value})), select: {name: true, oracle_text: true, mana_cost: true, type_line: true}, first: 3})));
        requireEvidence(lookup.edges.length === 3, "all replacement facts found");
        const serialized = await stage("applicationSerialization", () => JSON.stringify(edited));
        const openCode = await stage("openCodeSerialization", () => resultToOpencodeOutput(editResult));
        const adapterEdit = async (mode: "fallback" | "workerCold" | "workerWarm") => {
            // Separate equivalent candidates prevent replaying a mutation or reusing its stale timestamp.
            const candidate = unwrap(await runtime.handlers.createDeckCandidate(input));
            const args = editInputFor(candidate);
            const tool = createCoreTool("edit_deck_candidate", mode === "fallback" ? {log, createRuntime: () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log})} : {log, transport, databasePath: fixture.databasePath});
            const output = await stage(`adapterEdit_${mode}`, () => tool.execute(`performance-${mode}`, args, new AbortController().signal)) as PiToolOutput;
            const text = output.content.map(part => part.text).join("");
            const envelope = JSON.parse(text);
            const saved = restore((await readView(runtime, candidate.candidate_id, "json")).records);
            const complete = envelope.candidate_id === candidate.candidate_id && envelope.updated_at === saved.updatedAt && saved.memberships.length === rowCount && final.every(card => saved.memberships.some(item => item.card_identity_id === card));
            requireEvidence(complete, `complete ${mode} edit`);
            return {complete, inputBytes: utf8Bytes(JSON.stringify(args)), outputBytes: utf8Bytes(text)};
        };
        const adapterEdits = {fallback: await adapterEdit("fallback"), workerCold: await adapterEdit("workerCold"), workerWarm: await adapterEdit("workerWarm"), openCode: {complete: JSON.stringify(JSON.parse(openCode)) === serialized, outputBytes: utf8Bytes(openCode)}};
        const selectedCoverage = coverage(final, after.memberships.map(item => item.card_identity_id));
        const checksBeforeExplicit = checkStatuses(before), checksAfterExplicit = checkStatuses(after);
        const selection = {beforeRows: initial.length, afterRows: after.memberships.length, copies: after.memberships.reduce((sum, row) => sum + row.quantity, 0), added: after.memberships.filter(row => !initial.includes(row.card_identity_id)).length, removed: initial.filter(card => !after.memberships.some(row => row.card_identity_id === card)).length, retainedCutOptions: initial.slice(-3).filter(card => after.options.some(option => option.card_identity_id === card)).length, roleReferencesIntact: after.plan!.contributions.every(contribution => contribution.role_id === created.created_ids.role)};
        requireEvidence(!selectedCoverage.missing.length && !selectedCoverage.unexpected.length && !selectedCoverage.duplicates.length, "selected identities");
        requireEvidence(Object.values(checksBeforeExplicit).every(status => status === "absent"), "mutation must not invoke checks");
        requireEvidence(Object.values(checksAfterExplicit).every(status => status === "applicable"), "matching reusable explicit evidence");
        requireEvidence(availability.check_completion === "complete", "complete final joint Availability");
        requireEvidence(before.updatedAt === edited.updated_at && after.updatedAt === edited.updated_at, "checks preserve exact content timestamp");
        const renderedSelectedRows = decklist.records.filter(record => record.path.length === 1 && typeof record.value === "string" && /^\d+ /.test(record.value)).length;
        requireEvidence(renderedSelectedRows === rowCount, "complete Portable Decklist");
        timingsMs.editAndExplicitChecks = ["candidateEdit", "explicitLegality", "explicitEvaluation", "explicitAvailability"].reduce((sum, key) => sum + timingsMs[key]!, 0);
        timingsMs.editChecksAndCompleteOptionalOutputs = timingsMs.editAndExplicitChecks + ["optionalCompleteReport", "optionalCompletePortableDecklist", "optionalCompletePullList", "replacementFactLookup"].reduce((sum, key) => sum + timingsMs[key]!, 0);
        return {name, selection, coverage: selectedCoverage, checksBeforeExplicit, checksAfterExplicit, contentTimestampPreservedByChecks: after.updatedAt === edited.updated_at, availability: availability.summary, legality, evaluation, renderedSelectedRows, editPayload: {inputBytes: utf8Bytes(JSON.stringify(editInput)), outputBytes: utf8Bytes(serialized), repeatedBriefBytes: 0, repeatedUnchangedMemberships: 0}, adapterEdits, optionalOutputs: {report: {pages: report.pages, bytes: report.bytes}, portableDecklist: {pages: decklist.pages, bytes: decklist.bytes}, pullList: {pages: pulls.pages, bytes: pulls.bytes}}, timingsMs};
    } finally {await transport.close(); runtime.close(); fixture.dispose();}
}

function variance(samples: number[]) {
    const meanMs = samples.reduce((sum, n) => sum + n, 0) / samples.length;
    return {...summarize(samples), meanMs, populationStdDevMs: Math.sqrt(samples.reduce((sum, n) => sum + (n - meanMs) ** 2, 0) / samples.length)};
}

export async function runCandidatePerformance(options: {warmRuns?: number} = {}) {
    const warmRuns = options.warmRuns ?? 5;
    if (!Number.isInteger(warmRuns) || warmRuns < 1) throw new Error("warmRuns must be a positive integer");
    const workloads = [];
    for (const name of ["tuning", "commanderSize"] as const) {
        const cold = await observe(name);
        await observe(name);
        const warm: Awaited<ReturnType<typeof observe>>[] = [];
        for (let i = 0; i < warmRuns; i++) warm.push(await observe(name));
        workloads.push({...cold, timings: Object.fromEntries(Object.keys(cold.timingsMs).map(key => [key, {coldMs: cold.timingsMs[key]!, warm: variance(warm.map(run => run.timingsMs[key]!))}])) as Record<string, {coldMs: number; warm: ReturnType<typeof variance>}>});
    }
    const hash = (path: string) => createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex");
    return {kind: "candidate-performance-v1", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), harnessSha256: hash("./performance.ts"), fixtureSha256: hash("./fixtures.ts"), fixtureRevision, runtime: {bun: Bun.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model}, protocol: {warmRuns, cold: "First dispatch per workload against fresh on-disk synthetic SQLite; OS cache not flushed; later workload shares process/module caches.", warm: "One unmeasured equivalent warm-up, then fresh equivalent databases. Worker cold starts a new Worker each observation; Worker warm reuses that Worker.", logging: "Disabled throughout; no logging latency measurement or attribution.", setup: "Schema migration, source seeding and successful Collection import excluded. Runtime startup and candidate creation recorded separately.", completion: "Mutation, explicit legality/evaluation/final Availability, full paged optional views, serializers and adapter edits timed separately. Composite timings sum the same observation stages; exclude setup/create/verification reads and duplicate adapter probes. No model, provider or live/private data.", oldComparator: "Immutable pre-migration-v1.json and pinned evaluate:legacy source3f23b7a; old saves include implicit checks, old read/outputs have different completeness. Raw handler times are not end-to-end speedup ratios.", target: "Characterize observed local complete three-card edits and requested checks; achieved timing envelope is reported with variance, never enforced as a CI threshold or live-session guarantee."}, workloads};
}
if (import.meta.main) console.log(JSON.stringify(await runCandidatePerformance(), null, 2));
