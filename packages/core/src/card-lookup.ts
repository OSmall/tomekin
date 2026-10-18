import {collectionRequestBindings, prepareCollectionRetrieval, CollectionRetrievalFailure, type CollectionRetrievalSession, type CollectionRetrievalDependencies, type CollectionRetrievalContext} from "./collection-retrieval";
import {err, ok, type Result} from "neverthrow";
import {requiredScryfallImportContractRevisions, type ScryfallBulkDataImport} from "./scryfall-sync";
import {LookupCardsArgsSchema, compactJsonBytes, decodeRetrievalCursor, encodeRetrievalCursor, printingFacts, projectLocalCard, retrievalResponseBudgetBytes, retrievalScanDeadlineMs, type CardLookupRepository, type CardReference, type CardFact, type LookupOutcome, type RetrievalEnvelope, type RetrievalFailure, type RetrievalMetadata, type RetrievalProblem, type RetrievalSuccess, type RetrievalToolError, type RetrievalCursor, type RetrievalIssue} from "./card-retrieval";
import type {Logger} from "./logging";

export type CardLookupOptions = {responseBudgetBytes?: number; scanDeadlineMs?: number; now?: () => number; log?: Logger; collection?: CollectionRetrievalDependencies | undefined};
/** One public handler/service path; snapshots are read atomically by the repository. */
export async function lookupCards(repository: CardLookupRepository, input: unknown, options: CardLookupOptions = {}, signal?: AbortSignal): Promise<Result<RetrievalSuccess<LookupOutcome>, RetrievalToolError<LookupOutcome>>> {
    const log = options.log?.child({tool: "lookup_cards", correlationId: crypto.randomUUID()});
    let lookupReadMs = 0, projectionMs = 0;
    const readSnapshot = async (references: readonly CardReference[], includeTags: boolean) => {
        const started = performance.now();
        try {return await repository.readSnapshot(references, includeTags);} finally {lookupReadMs += performance.now() - started;}
    };
    const now = options.now ?? (() => performance.now());
    const started = now(), budget = options.responseBudgetBytes ?? retrievalResponseBudgetBytes;
    const deadline = options.scanDeadlineMs ?? retrievalScanDeadlineMs;
    const parsed = LookupCardsArgsSchema.safeParse(input);
    const first = parsed.success ? parsed.data.first ?? 50 : 50;
    const inputCount = parsed.success ? parsed.data.references.length : 0;
    let start = 0;
    let collection: CollectionRetrievalSession | undefined;
    let collectionErrorContext: CollectionRetrievalContext | undefined;
    let provenance: RetrievalEnvelope<LookupOutcome>["provenance"];
    let edges: {node: LookupOutcome}[] = [];
    const metadata = (next = start + edges.length): RetrievalMetadata => ({requested_count: first, returned_count: edges.length, response_budget_bytes: budget, provider_total: null, scoped_total: null, lookup: {input_count: inputCount, start_index: start, next_index: next}});
    const failure = (problem: RetrievalProblem, next = start + edges.length): RetrievalFailure<LookupOutcome> => ({status: "error", edges: [...edges], error: problem, metadata: metadata(next), ...(provenance ? {provenance} : {}), ...((collection?.context ?? collectionErrorContext) ? {collection_context: (collection?.context ?? collectionErrorContext)!} : {})});
    const finish = (envelope: RetrievalEnvelope<LookupOutcome>) => {
        const serializationStarted = performance.now();
        let bytes = compactJsonBytes(envelope);
        if (bytes > budget) {
            // Input diagnostics can themselves be unbounded. Return a bounded explicit failure.
            // Execution failures are fitted with positional rollback by recover() below.
            if (envelope.edges.length || (envelope.status === "error" && envelope.error.cursor)) throw new Error("Cannot carry a coherent lookup recovery envelope.");
            envelope = {status: "error", edges: [], error: {code: "response_budget_too_small", message: "Request diagnostics exceed the response budget.", retryable: false, required_bytes: bytes, limit_bytes: budget}, metadata: {...metadata(start), returned_count: 0}};
            bytes = compactJsonBytes(envelope);
            if (bytes > budget) throw new Error("Adapter response budget cannot carry a minimal structured lookup error.");
        }
        log?.info({operation: "lookup_cards", status: envelope.status, selectedFields: parsed.success ? Object.keys(parsed.data.select) : [], returnedCount: envelope.edges.length, outputBytes: bytes, lookupReadMs, projectionMs, finalSerializationMs: performance.now() - serializationStarted, ...(envelope.status === "error" ? {errorCode: envelope.error.code, requiredBytes: envelope.error.required_bytes, limitBytes: envelope.error.limit_bytes} : {}), durationMs: Math.round(now() - started), recovery: envelope.status === "error" ? !!envelope.error.cursor : envelope.pageInfo.hasNextPage}, "Local lookup completed");
        log?.debug({operation: "lookup_cards", after: parsed.success ? parsed.data.after : undefined, cursors: envelope.status === "error" ? envelope.error.cursor : envelope.pageInfo}, "Lookup continuation positions");
        if (envelope.status === "error") return err({type: "retrieval_error" as const, message: envelope.error.message, envelope});
        return ok(envelope);
    };
    if (!parsed.success) return finish(failure({code: "invalid_request", message: "Invalid lookup request.", retryable: false, issues: parsed.error.issues.flatMap<RetrievalIssue>((issue) => {
        const path = issue.path.map((part) => typeof part === "symbol" ? String(part) : part);
        return issue.code === "unrecognized_keys" ? issue.keys.map((field) => ({path: [...path, field], code: "unknown_field", field})) : [{path, code: issue.code}];
    })}));
    const args = parsed.data;
    const printing = (Object.keys(args.select) as CardFact[]).filter((field) => printingFacts.has(field));
    const incompatible = args.references.flatMap((reference, index) => reference.kind === "printing_id" ? [] : [index]);
    if (printing.length && incompatible.length) return finish(failure({code: "invalid_request", message: "Printing facts require exact Printing references throughout the original batch.", retryable: false, issues: printing.map((field) => ({path: ["select", field], code: "incompatible_reference_kind", field, reference_indices: incompatible}))}));
    const bindings = {references: args.references, include_provenance: args.include_provenance ?? false, ...collectionRequestBindings(args)};
    let incoming: RetrievalCursor | undefined;
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return finish(failure(decoded.problem));
        incoming = decoded.cursor!;
        const reason = incoming.tool !== "lookup_cards" ? "tool_mismatch" : incoming.source !== "local_reference" ? "source_mismatch" : JSON.stringify(incoming.bindings) !== JSON.stringify(bindings) ? "query_mismatch" : null;
        if (reason) return finish(failure({code: "invalid_cursor", message: "Cursor does not match this lookup request.", reason, retryable: false}));
        const pos = incoming.position as {next_index?: unknown} | null;
        if (!pos || Object.keys(pos).length !== 1 || !Number.isInteger(pos.next_index) || (pos.next_index as number) < 0 || (pos.next_index as number) > inputCount) return finish(failure({code: "invalid_cursor", message: "Malformed lookup position.", reason: "malformed", retryable: false}));
        start = pos.next_index as number;
    }
    if (args.collection_scope?.match === "printing" && incompatible.length) return finish(failure({code: "invalid_request", reason: "incompatible_reference_kind", message: "Printing matching requires exact Printing references throughout the original lookup batch.", retryable: false}));
    try {collection = await prepareCollectionRetrieval(args, options.collection, incoming?.revisions);} catch (e) {if (e instanceof CollectionRetrievalFailure) {collectionErrorContext = e.context; return finish(failure(e.problem));} throw e;}
    const snapshot = await readSnapshot([], false);
    if (snapshot.isErr()) return finish(failure({code: "local_error", message: snapshot.error.message, retryable: false}));
    const imports = latestSuccessful(snapshot.value.imports);
    const core = ["oracle_cards", "all_cards"] as const;
    const missing = core.filter((dataset) => !imports.has(dataset));
    const incompatibleImports = core.filter((dataset) => imports.has(dataset) && imports.get(dataset)!.importContractRevision !== requiredScryfallImportContractRevisions[dataset]);
    if (missing.length || incompatibleImports.length) return finish(failure({code: "reference_data_unready", message: "Local lookup requires compatible Oracle Cards and All Cards imports. Run bun run sync:scryfall.", retryable: false, missing_datasets: missing, reimport_required_datasets: incompatibleImports}));
    const revisions: Record<string, string | null> = {...incoming?.revisions};
    if (!collection && ["collection", "collection_policy"].some(key => key in revisions)) return finish(failure({code: "invalid_cursor", reason: "malformed", message: "Unexpected Collection cursor dependencies.", retryable: false}));
    Object.assign(revisions, collection?.revisions);
    for (const [dataset, revision] of Object.entries(revisions).filter(([key]) => !["collection", "collection_policy"].includes(key))) {
        if (!["oracle_cards", "all_cards", "oracle_tags"].includes(dataset)) return finish(failure({code: "invalid_cursor", message: "Unknown cursor dependency.", reason: "malformed", retryable: false}));
        if ((imports.get(dataset)?.id ?? null) !== revision) return finish(failure({code: "stale_cursor", message: "A bound successful reference import changed. Restart the lookup.", reason: "reference_import_changed", recovery: "restart", retryable: false}));
    }
    if (incoming && core.some((dataset) => !(dataset in revisions))) return finish(failure({code: "invalid_cursor", message: "Cursor lacks required import bindings.", reason: "malformed", retryable: false}));
    for (const dataset of core) revisions[dataset] = imports.get(dataset)!.id;
    if (args.select.tags) revisions.oracle_tags = imports.get("oracle_tags")?.id ?? null;
    const tagsImport = imports.get("oracle_tags");
    const tagUnavailable = !tagsImport ? "dataset_not_imported" : tagsImport.importContractRevision !== requiredScryfallImportContractRevisions.oracle_tags ? "dataset_incompatible" : undefined;
    const used = Object.keys(revisions).flatMap((dataset) => imports.get(dataset) ? [imports.get(dataset)!] : []);
    if (args.include_provenance) provenance = {reference_imports: used.map((item) => ({dataset: item.bulkDataType, import_id: item.id, completed_at: item.completedAt?.toISOString() ?? null, source_updated_at: item.sourceUpdatedAt?.toISOString() ?? null}))};
    const cursor = (next: number) => encodeRetrievalCursor({version: 1, tool: "lookup_cards", source: "local_reference", bindings, revisions, position: {next_index: next}});
    const page = (stop: RetrievalSuccess<LookupOutcome>["stop_reason"]): RetrievalSuccess<LookupOutcome> => ({status: "ok", edges: [...edges], pageInfo: {startCursor: edges.length ? cursor(start + 1) : null, endCursor: edges.length ? cursor(start + edges.length) : null, hasNextPage: start + edges.length < inputCount, hasPreviousPage: start > 0}, stop_reason: stop, metadata: metadata(), ...(provenance ? {provenance} : {}), ...((collection?.context ?? collectionErrorContext) ? {collection_context: (collection?.context ?? collectionErrorContext)!} : {})});
    const recover = (problem: RetrievalProblem) => {
        let envelope = failure({...problem, cursor: cursor(start + edges.length)});
        while (compactJsonBytes(envelope) > budget && edges.length) { edges.pop(); envelope = failure({...problem, cursor: cursor(start + edges.length)}); }
        if (compactJsonBytes(envelope) > budget) envelope = failure({code: "response_budget_too_small", message: "Recovery metadata exceeds the response budget.", retryable: false, cursor: cursor(start)});
        if (compactJsonBytes(envelope) > budget) {
            // No result was committed; a nonrecoverable fixed-context failure is explicit.
            provenance = undefined;
            envelope = failure({code: "response_budget_too_small", message: "Mandatory recovery context exceeds the response budget.", retryable: false, limit_bytes: budget});
        }
        return envelope;
    };
    // Both success and failure metadata must fit before any source progress is committed.
    const minimal = failure({code: "scan_timeout", message: "Lookup scan deadline reached.", retryable: true, cursor: cursor(start)});
    if (compactJsonBytes(minimal) > budget) {
        provenance = undefined;
        const problem: RetrievalProblem = {code: "cursor_too_large", message: "Self-contained lookup continuation exceeds the response budget.", retryable: false, required_bytes: compactJsonBytes(minimal), limit_bytes: budget};
        const envelope = failure(problem);
        if (compactJsonBytes(envelope) > budget) throw new Error("Adapter response budget cannot carry a minimal structured lookup error.");
        return finish(envelope);
    }
    if (compactJsonBytes(page(start >= inputCount ? "source_exhausted" : "first")) > budget) return finish(failure({code: "response_budget_too_small", message: "Mandatory lookup context exceeds the response budget.", retryable: false, limit_bytes: budget}));
    if (signal?.aborted) return finish(recover({code: "cancelled", message: "Lookup cancelled.", retryable: true}));
    if (now() - started >= deadline) return finish(recover({code: "scan_timeout", message: "Lookup scan deadline reached.", retryable: true}));
    const source = await readSnapshot(args.references.slice(start, start + first), !!args.select.tags);
    if (source.isErr()) return finish(recover({code: "local_error", message: source.error.message, retryable: false}));
    const sourceImports = latestSuccessful(source.value.imports);
    if (Object.entries(revisions).filter(([key]) => !["collection", "collection_policy"].includes(key)).some(([dataset, revision]) => (sourceImports.get(dataset)?.id ?? null) !== revision)) {
        return finish(failure({code: "stale_cursor", message: "A required reference import changed during lookup. Restart the lookup.", reason: "reference_import_changed", recovery: "restart", retryable: false}));
    }
    const check = () => {
        if (signal?.aborted) throw new CollectionRetrievalFailure({code: "cancelled", message: "Lookup cancelled.", retryable: true});
        if (now() - started >= deadline) throw new CollectionRetrievalFailure({code: "scan_timeout", message: "Lookup scan deadline reached.", retryable: true});
    };
    const settle = async (response: RetrievalEnvelope<LookupOutcome>) => {
        try {
            await collection?.assertCurrent();
            const current = await readSnapshot([], false);
            if (current.isErr()) throw new CollectionRetrievalFailure({code: "local_error", message: current.error.message, retryable: false});
            const imports = latestSuccessful(current.value.imports);
            if (Object.entries(revisions).filter(([key]) => !["collection", "collection_policy"].includes(key)).some(([key, value]) => (imports.get(key)?.id ?? null) !== value)) throw new CollectionRetrievalFailure({code: "stale_cursor", reason: "reference_import_changed", message: "A bound reference import changed during lookup.", retryable: false, recovery: "restart"});
            if (collection && response.status === "ok") {try {check();} catch (e) {if (!(e instanceof CollectionRetrievalFailure)) throw e; return finish(recover(e.problem));}}
            return finish(response);
        } catch (e) {if (!(e instanceof CollectionRetrievalFailure)) throw e; edges = []; return finish(failure(e.problem));}
    };
    try {
    for (let offset = 0; offset < Math.min(first, inputCount - start); offset++) {
        if (signal?.aborted) return settle(recover({code: "cancelled", message: "Lookup cancelled.", retryable: true}));
        if (now() - started >= deadline) return settle(recover({code: "scan_timeout", message: "Lookup scan deadline reached.", retryable: true}));
        const record = source.value.records[offset];
        const reference = args.references[start + offset]!;
        const projectionStarted = performance.now();
        const node: LookupOutcome = record ? {status: "found", ...projectLocalCard(record, args.select, tagUnavailable)} : {status: "not_found", reference};
        if (collection && node.status === "found") await collection.evaluate(node, record?.printing?.id, check);
        if (collection) check();
        projectionMs += performance.now() - projectionStarted;
        edges.push({node});
        const candidate = page(start + edges.length === inputCount ? "source_exhausted" : edges.length === first ? "first" : "response_budget");
        if (compactJsonBytes(candidate) <= budget) continue;
        edges.pop();
        const retained = edges;
        edges = [{node}];
        // Test this whole object in its own envelope at its actual input position.
        const oldStart = start;
        start = oldStart + offset;
        const aloneBytes = compactJsonBytes(page(start + 1 === inputCount ? "source_exhausted" : first === 1 ? "first" : "response_budget"));
        start = oldStart;
        edges = retained;
        if (aloneBytes > budget) return settle(recover({code: "record_too_large", message: "A complete lookup outcome exceeds the response budget.", retryable: false, required_bytes: aloneBytes, limit_bytes: budget}));
        const result = page("response_budget");
        if (compactJsonBytes(result) > budget) return settle(recover({code: "response_budget_too_small", message: "Lookup page metadata exceeds the response budget.", retryable: false, limit_bytes: budget}));
        return settle(result);
    }
    if (signal?.aborted) return settle(recover({code: "cancelled", message: "Lookup cancelled.", retryable: true}));
    if (now() - started >= deadline) return settle(recover({code: "scan_timeout", message: "Lookup scan deadline reached.", retryable: true}));
    return settle(page(start + edges.length === inputCount ? "source_exhausted" : "first"));
    } catch (e) {
        if (!(e instanceof CollectionRetrievalFailure)) throw e;
        if (e.problem.code === "stale_cursor") {edges = []; return finish(failure(e.problem));}
        return settle(recover(e.problem));
    }
}
function latestSuccessful(imports: readonly ScryfallBulkDataImport[]) {
    const latest = new Map<string, ScryfallBulkDataImport>();
    for (const item of imports) if (item.status === "succeeded") {
        const previous = latest.get(item.bulkDataType);
        if (!previous || (item.completedAt ?? item.startedAt).getTime() > (previous.completedAt ?? previous.startedAt).getTime() || ((item.completedAt ?? item.startedAt).getTime() === (previous.completedAt ?? previous.startedAt).getTime() && item.id > previous.id)) latest.set(item.bulkDataType, item);
    }
    return latest;
}
