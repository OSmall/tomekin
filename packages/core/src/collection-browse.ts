import {z} from "zod";
import {err, ok, type Result} from "neverthrow";
import {CollectionPolicyInputSchema, CopyRequirementsSchema, UtcInstantSchema, evaluateCopyRequirements, evaluateOwnedRow, resolveCollectionPolicy, validDateRequirements, type CollectionBrowseRepository, type CollectionPolicyInput, type CollectionAccessPolicy, type CollectionPolicySnapshot, type OwnedRowFacts, type ResolvedCollectionPolicy} from "./collection-policy";
import {compactJsonBytes, decodeRetrievalCursor, encodeRetrievalCursor, retrievalResponseBudgetBytes, retrievalScanDeadlineMs, type RetrievalCursor, type RetrievalEnvelope, type RetrievalProblem, type RetrievalSuccess, type RetrievalToolError} from "./card-retrieval";
import {requiredScryfallImportContractRevisions} from "./scryfall-sync";
import type {CardLookupOptions} from "./card-lookup";

export const collectionCopyFactDescriptions = {
    collection_card_id: "Snapshot-local source row ID; always returned.", oracle_id: "Actual owned Printing's Oracle identity; always returned.", printing_id: "Exact owned Printing ID; always returned.", quantity: "Source-row quantity; always returned, not a physical copy ID or allocation.",
    location: "Exact current location ID, type and name.", added_at: "Reliable source-added UTC instant or null; never import/release date. Legacy lost precision is unknown.", date_reliability: "source, unknown, or legacy_precision_lost.", finish: "Owned finish, distinct from Printing finishes.", condition: "Source condition or null.", altered: "Source altered flag.", misprint: "Source misprint flag.", purchase_price: "Source purchase price or null; not market value.", purchase_price_currency: "Source purchase currency or null.", source_row_number: "Original CSV row number.",
    set: "Owned Printing Set code.", set_id: "Owned Printing Set UUID.", set_name: "Owned Printing Set name.", set_type: "Owned Printing Set type.", lang: "Owned Printing language.", collector_number: "Owned Printing collector number as a string.", printed_name: "Owned Printing printed name or null.", printing_layout: "Owned Printing presentation layout.", finishes: "All supported finishes for the owned Printing, distinct from owned finish.", promo_types: "Complete owned Printing promo types.", tcgplayer_id: "Owned Printing TCGplayer ID or null.", cardmarket_id: "Owned Printing Cardmarket ID or null.",
} as const;
export type CollectionCopyFact = keyof typeof collectionCopyFactDescriptions;
const selectionShape = Object.fromEntries(Object.entries(collectionCopyFactDescriptions).map(([key, description]) => [key, z.literal(true).describe(description).optional()])) as {[K in CollectionCopyFact]: z.ZodOptional<z.ZodLiteral<true>>};
export const CollectionCopySelectionSchema = z.strictObject(selectionShape).refine(value => Object.keys(value).length > 0, "Select at least one copy fact.").meta({minProperties: 1});
export type CollectionCopySelection = z.infer<typeof CollectionCopySelectionSchema>;
export const BrowseCollectionCardsArgsSchema = z.strictObject({
    collection_import_id: z.uuid(), policy: CollectionPolicyInputSchema,
    oracle_ids: z.array(z.uuid()).min(1).optional(), printing_ids: z.array(z.uuid()).min(1).optional(),
    date_state: z.enum(["any", "known", "unknown"]).default("any"), added_at_from: UtcInstantSchema.optional(), added_at_before: UtcInstantSchema.optional(),
    copy_requirements: CopyRequirementsSchema.default({}), order: z.enum(["source_order", "added_at_asc", "added_at_desc"]).default("source_order"),
    select: CollectionCopySelectionSchema, first: z.number().int().min(0).max(200).optional(), after: z.string().min(1).optional(), include_provenance: z.boolean().optional(),
}).refine(value => {
    if (!validDateRequirements(value)) return false;
    const r = value.copy_requirements;
    const unknown = value.date_state === "unknown" || r.date_state === "unknown";
    const known = value.date_state === "known" || r.date_state === "known" || !!value.added_at_from || !!value.added_at_before || !!r.added_at_from || !!r.added_at_before;
    if (unknown && known) return false;
    const from = [value.added_at_from, r.added_at_from].filter((v): v is string => !!v).map(Date.parse);
    const before = [value.added_at_before, r.added_at_before].filter((v): v is string => !!v).map(Date.parse);
    return !from.length || !before.length || Math.max(...from) < Math.min(...before);
}, "Date constraints conflict or the interval is empty.");
export type BrowseCollectionCardsArgs = z.infer<typeof BrowseCollectionCardsArgsSchema>;
export type CollectionCopyResult = {collection_card_id: string; oracle_id: string; printing_id: string; quantity: number; committed: boolean} & Record<string, unknown>;
export function projectCollectionCopy(row: OwnedRowFacts, select: CollectionCopySelection): CollectionCopyResult {
    const result: CollectionCopyResult = {collection_card_id: row.collection_card_id, oracle_id: row.oracle_id, printing_id: row.printing_id, quantity: row.quantity, committed: row.location.type === "deck"};
    if (result.committed) result.location = row.location;
    for (const key of Object.keys(select) as CollectionCopyFact[]) (result as Record<string, unknown>)[key] = row[key];
    return result;
}
export type CollectionContext = {state: "ready" | "no_collection" | "reimport_required"; collection_import_id: string | null; effective_policy: ResolvedCollectionPolicy | null; policy_status: "confirmed" | "unconfirmed"};
export type CollectionBrowseExtras = {collection_context: CollectionContext; date_coverage: {undated: "present" | "unchecked" | "absent"; completion: "complete" | "partial"; legacy_precision_lost: boolean}};
export type CollectionBrowseSuccess = RetrievalSuccess<CollectionCopyResult> & CollectionBrowseExtras;
export type CollectionPolicyLoader = (input: CollectionPolicyInput) => Promise<Result<CollectionAccessPolicy | null, {message: string}>>;

export async function browseCollectionCards(repository: CollectionBrowseRepository, loadPolicy: CollectionPolicyLoader, input: unknown, options: CardLookupOptions = {}, signal?: AbortSignal): Promise<Result<CollectionBrowseSuccess, RetrievalToolError<CollectionCopyResult>>> {
    const now = options.now ?? (() => performance.now()), started = now(), budget = options.responseBudgetBytes ?? retrievalResponseBudgetBytes, deadline = options.scanDeadlineMs ?? retrievalScanDeadlineMs;
    const parsed = BrowseCollectionCardsArgsSchema.safeParse(input), first = parsed.success ? parsed.data.first ?? 50 : 50;
    let edges: {node: CollectionCopyResult}[] = [], positions: number[] = [], start = 0, safe = 0;
    let context: CollectionContext = {state: "no_collection", collection_import_id: null, effective_policy: null, policy_status: "unconfirmed"};
    let coverage: CollectionBrowseExtras["date_coverage"] = {undated: "unchecked", completion: "partial", legacy_precision_lost: false};
    let provenance: RetrievalEnvelope<CollectionCopyResult>["provenance"];
    const metadata = () => ({requested_count: first, returned_count: edges.length, response_budget_bytes: budget, provider_total: null, scoped_total: null});
    const extras = () => ({collection_context: context, date_coverage: coverage, ...(provenance ? {provenance} : {})});
    const failure = (error: RetrievalProblem) => ({status: "error" as const, edges: [...edges], error, metadata: metadata(), ...extras()});
    const finish = (envelope: RetrievalEnvelope<CollectionCopyResult> & Partial<CollectionBrowseExtras>): Result<CollectionBrowseSuccess, RetrievalToolError<CollectionCopyResult>> => {
        if (compactJsonBytes(envelope) > budget) {
            envelope = {status: "error", edges: [], error: {code: "response_budget_too_small", message: "Mandatory Collection context exceeds the response budget.", retryable: false, limit_bytes: budget}, metadata: {...metadata(), returned_count: 0}};
            if (compactJsonBytes(envelope) > budget) throw new Error("Adapter cannot carry a minimal Collection browse error.");
        }
        options.log?.info({operation: "browse_collection_cards", status: envelope.status, selectedFields: parsed.success ? Object.keys(parsed.data.select) : [], returnedCount: envelope.edges.length, outputBytes: compactJsonBytes(envelope), durationMs: now() - started}, "Collection browse completed");
        options.log?.debug({operation: "browse_collection_cards", after: parsed.success ? parsed.data.after : undefined, cursors: envelope.status === "error" ? envelope.error.cursor : envelope.pageInfo}, "Collection browse continuation");
        return envelope.status === "error" ? err({type: "retrieval_error", message: envelope.error.message, envelope}) : ok(envelope as CollectionBrowseSuccess);
    };
    if (!parsed.success) return finish(failure({code: "invalid_request", message: "Invalid Collection browse request.", retryable: false, issues: parsed.error.issues.map(issue => ({path: issue.path.map(part => typeof part === "symbol" ? String(part) : part), code: issue.code}))}));
    const args = parsed.data;
    const {select: _select, first: _first, after: _after, ...fixed} = args;
    let incoming: RetrievalCursor | undefined;
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return finish(failure(decoded.problem));
        incoming = decoded.cursor!;
        const reason = incoming.tool !== "browse_collection_cards" ? "tool_mismatch" : incoming.source !== "local_collection" ? "source_mismatch" : JSON.stringify(incoming.bindings) !== JSON.stringify(fixed) ? "scope_mismatch" : null;
        if (reason) return finish(failure({code: "invalid_cursor", reason, message: "Cursor does not match this Collection browse request.", retryable: false}));
        const pos = incoming.position as {next_index?: unknown} | null;
        if (!pos || Object.keys(pos).length !== 1 || !Number.isSafeInteger(pos.next_index) || (pos.next_index as number) < 0) return finish(failure({code: "invalid_cursor", reason: "malformed", message: "Malformed Collection browse position.", retryable: false}));
        start = safe = pos.next_index as number;
    }
    const snapshotResult = await repository.readCollectionPolicySnapshot();
    if (snapshotResult.isErr()) return finish(failure({code: "local_error", message: snapshotResult.error.message, retryable: false}));
    const snapshot = snapshotResult.value;
    context = {state: snapshot.activeImport ? "ready" : snapshot.legacySnapshot ? "reimport_required" : "no_collection", collection_import_id: snapshot.activeImport?.id ?? null, effective_policy: null, policy_status: "unconfirmed"};
    if (snapshot.activeImport?.id !== args.collection_import_id) return finish(failure({code: incoming ? "stale_cursor" : "invalid_request", reason: "collection_import_changed", message: snapshot.legacySnapshot ? "Reimport the legacy Collection to establish a reliable active snapshot." : "Requested Collection snapshot is not active. Reconfirm scope.", retryable: false, recovery: "reconfirm_scope"}));
    const loaded = await loadPolicy(args.policy);
    if (loaded.isErr()) return finish(failure({code: "invalid_request", reason: "invalid_policy", message: loaded.error.message, retryable: false}));
    const resolved = resolveCollectionPolicy(loaded.value, snapshot);
    if (resolved.isErr()) return finish(failure({code: "invalid_request", reason: resolved.error.reason, message: resolved.error.message, retryable: false, recovery: "reconfirm_scope"}));
    const policy = resolved.value;
    context = {...context, effective_policy: policy, policy_status: "confirmed"};
    const validIds = await repository.collectionCardIdsExist(policy.excluded_collection_card_ids);
    if (validIds.isErr()) return finish(failure({code: "local_error", message: validIds.error.message, retryable: false}));
    if (!validIds.value) return finish(failure({code: "invalid_request", reason: "unknown_collection_card", message: "An excluded Collection row is absent from this snapshot.", retryable: false}));
    const revisions = snapshotRevisions(snapshot);
    revisions.policy = JSON.stringify(policy);
    if (incoming && JSON.stringify(incoming.revisions) !== JSON.stringify(revisions)) {
        const reason = incoming.revisions.policy !== revisions.policy ? "candidate_policy_changed" : incoming.revisions.collection !== revisions.collection ? "collection_import_changed" : "reference_import_changed";
        return finish(failure({code: "stale_cursor", reason, message: "A bound Collection, policy, or reference import changed.", retryable: false, recovery: reason === "reference_import_changed" ? "restart" : "reconfirm_scope"}));
    }
    const latest = latestReferences(snapshot);
    const missing = ["oracle_cards", "all_cards"].filter(dataset => !latest.has(dataset));
    const incompatible = ["oracle_cards", "all_cards"].filter(dataset => latest.has(dataset) && latest.get(dataset)!.importContractRevision !== requiredScryfallImportContractRevisions[dataset as "oracle_cards" | "all_cards"]);
    if (missing.length || incompatible.length) return finish(failure({code: "reference_data_unready", message: "Collection browsing requires compatible Oracle Cards and All Cards imports.", retryable: false, missing_datasets: missing, reimport_required_datasets: incompatible}));
    if (args.include_provenance) provenance = {reference_imports: [...latest.values()].map(item => ({dataset: item.bulkDataType, import_id: item.id, completed_at: item.completedAt?.toISOString() ?? null, source_updated_at: item.sourceUpdatedAt?.toISOString() ?? null}))};
    const cursor = (position: number) => encodeRetrievalCursor({version: 1, tool: "browse_collection_cards", source: "local_collection", bindings: fixed, revisions, position: {next_index: position}});
    const page = (hasNextPage: boolean, stop_reason: RetrievalSuccess<CollectionCopyResult>["stop_reason"]): CollectionBrowseSuccess => ({status: "ok", edges: [...edges], pageInfo: {startCursor: positions.length ? cursor(positions[0]!) : null, endCursor: positions.length ? cursor(positions.at(-1)!) : null, hasNextPage, hasPreviousPage: start > 0}, stop_reason, metadata: metadata(), ...extras()});
    const recover = (problem: RetrievalProblem) => {
        let tokenPosition = safe;
        let envelope = failure({...problem, cursor: cursor(tokenPosition)});
        while (compactJsonBytes(envelope) > budget && edges.length) {const removed = positions.pop()!; edges.pop(); tokenPosition = removed - 1; envelope = failure({...problem, cursor: cursor(tokenPosition)});}
        return envelope;
    };
    if (compactJsonBytes(failure({code: "scan_timeout", message: "Collection browse deadline reached.", retryable: true, cursor: cursor(start)})) > budget) return finish(failure({code: "cursor_too_large", message: "Self-contained Collection continuation exceeds the response budget.", retryable: false, limit_bytes: budget}));
    if (compactJsonBytes(page(false, "source_exhausted")) > budget) return finish(failure({code: "response_budget_too_small", message: "Mandatory Collection context exceeds the response budget.", retryable: false}));
    let offset = start;
    // Keep both conjuncts: browse criteria never replace constraints carried in copy_requirements.
    const dateCriteria = {date_state: args.date_state === "any" ? undefined : args.date_state, added_at_from: args.added_at_from, added_at_before: args.added_at_before};
    const consistent = async () => {
        const current = await repository.readCollectionPolicySnapshot();
        const currentPolicy = await loadPolicy(args.policy);
        if (current.isErr() || currentPolicy.isErr()) return false;
        const p = resolveCollectionPolicy(currentPolicy.value, current.value);
        return p.isOk() && JSON.stringify({...snapshotRevisions(current.value), policy: JSON.stringify(p.value)}) === JSON.stringify(revisions);
    };
    const settle = async (envelope: ReturnType<typeof page> | ReturnType<typeof recover>) => {
        if (await consistent()) {
            if (envelope.status === "ok" && compactJsonBytes(envelope) > budget) {
                const requiredBytes = compactJsonBytes(envelope);
                while (edges.length && compactJsonBytes(envelope) > budget) {
                    safe = positions.pop()! - 1; edges.pop();
                    coverage = {...coverage, completion: "partial"};
                    if (!edges.length) return finish(recover({code: "record_too_large", message: "A complete Collection row exceeds the response budget.", retryable: false, required_bytes: requiredBytes, limit_bytes: budget}));
                    envelope = page(true, "response_budget");
                }
            }
            return finish(envelope);
        }
        edges = []; positions = []; coverage = {undated: "unchecked", completion: "partial", legacy_precision_lost: false};
        return finish(failure({code: "stale_cursor", reason: "collection_import_changed", message: "A bound snapshot or policy changed during Collection browse.", retryable: false, recovery: "reconfirm_scope"}));
    };
    for (;;) {
        if (signal?.aborted) return settle(recover({code: "cancelled", message: "Collection browse cancelled.", retryable: true}));
        if (now() - started >= deadline) return settle(recover({code: "scan_timeout", message: "Collection browse deadline reached.", retryable: true}));
        const batch = await repository.readOwnedRows({offset, first: 128, order: args.order, oracle_ids: args.oracle_ids, printing_ids: args.printing_ids});
        if (batch.isErr()) return settle(recover({code: "local_error", message: batch.error.message, retryable: false}));
        if (!batch.value.length) {
            coverage = {...coverage, completion: "complete", undated: coverage.undated === "present" ? "present" : start === 0 ? "absent" : "unchecked"};
            return settle(page(false, "source_exhausted"));
        }
        for (const row of batch.value) {
            if (signal?.aborted) return settle(recover({code: "cancelled", message: "Collection browse cancelled.", retryable: true}));
            if (now() - started >= deadline) return settle(recover({code: "scan_timeout", message: "Collection browse deadline reached.", retryable: true}));
            const evaluation = evaluateOwnedRow(policy, row);
            if (row.date_reliability === "legacy_precision_lost") coverage.legacy_precision_lost = true;
            if (row.added_at === null && (evaluation.decision === "eligible" || (evaluation.decision === "uncertain" && evaluation.uncertain_fields.every(field => field === "added_at")))) coverage.undated = "present";
            const matches = evaluation.decision === "eligible" && evaluateCopyRequirements(args.copy_requirements, row).decision === "eligible" && evaluateCopyRequirements(dateCriteria, row).decision === "eligible";
            if (!matches) {safe = ++offset; continue;}
            if (edges.length >= first) return settle(page(true, "first"));
            const node = projectCollectionCopy(row, args.select);
            edges.push({node}); positions.push(offset + 1);
            const candidate = page(true, edges.length === first ? "first" : "response_budget");
            if (compactJsonBytes(candidate) > budget) {
                edges.pop(); positions.pop();
                const retained = edges, retainedPositions = positions;
                edges = [{node}]; positions = [offset + 1];
                const aloneBytes = compactJsonBytes(page(true, "response_budget"));
                edges = retained; positions = retainedPositions;
                if (aloneBytes > budget) return settle(recover({code: "record_too_large", message: "A complete Collection row exceeds the response budget.", retryable: false, required_bytes: aloneBytes, limit_bytes: budget}));
                return settle(page(true, "response_budget"));
            }
            safe = ++offset;
        }
    }
}
function latestReferences(snapshot: CollectionPolicySnapshot) {
    const latest = new Map<string, CollectionPolicySnapshot["referenceImports"][number]>();
    for (const item of snapshot.referenceImports) if (item.status === "succeeded" && ["oracle_cards", "all_cards"].includes(item.bulkDataType)) {
        const old = latest.get(item.bulkDataType), time = (item.completedAt ?? item.startedAt).getTime();
        if (!old || time > (old.completedAt ?? old.startedAt).getTime() || (time === (old.completedAt ?? old.startedAt).getTime() && item.id > old.id)) latest.set(item.bulkDataType, item);
    }
    return latest;
}
export function snapshotRevisions(snapshot: CollectionPolicySnapshot): Record<string, string | null> {
    const imports = latestReferences(snapshot);
    return {collection: snapshot.activeImport?.id ?? null, oracle_cards: imports.get("oracle_cards")?.id ?? null, all_cards: imports.get("all_cards")?.id ?? null};
}
