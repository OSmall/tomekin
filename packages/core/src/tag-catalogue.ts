import {z} from "zod";
import {err, ok, type Result} from "neverthrow";
import {compactJsonBytes, decodeRetrievalCursor, cursorBindingsMatch, cursorScopeMatches, encodeRetrievalCursor, retrievalResponseBudgetBytes, retrievalScanDeadlineMs, type RetrievalEnvelope, type RetrievalProblem, type RetrievalSuccess, type RetrievalToolError} from "./card-retrieval";
import {requiredScryfallImportContractRevisions, type ScryfallBulkDataImport} from "./scryfall-sync";
import {currentReferenceImports, type CardReferenceRepositoryError} from "./card-reference-queries";
import type {CardLookupOptions} from "./card-lookup";

export const TagCatalogueOperationSchema = z.discriminatedUnion("type", [
    z.strictObject({type: z.literal("search"), query: z.string().trim().min(1).describe("Case-insensitive literal substring in slug, label or alias.")}),
    z.strictObject({type: z.literal("lookup"), slugs: z.array(z.string().min(1)).min(1), hierarchy: z.strictObject({depth: z.number().int().min(1).max(3).default(1).describe("Immediate parents/children by default; explicitly request up to three levels in each direction.")}).optional()}),
    z.strictObject({type: z.literal("list")}),
]);
export const BrowseTagsArgsSchema = z.strictObject({operation: TagCatalogueOperationSchema, first: z.number().int().min(0).max(200).optional(), after: z.string().min(1).optional()});
export type BrowseTagsArgs = z.infer<typeof BrowseTagsArgsSchema>;
export type TagDefinition = {id: string; slug: string; label: string; description: string | null; source_page_uri: string; aliases: string[]};
export type TagHierarchy = {depth: number; parents: TagDefinition[]; children: TagDefinition[]; relationships: {parent_slug: string; child_slug: string}[]};
export type TagCatalogueOutcome = {status: "found"; tag: TagDefinition; hierarchy?: TagHierarchy} | {status: "not_found"; slug: string};
/** Rows and imports share one snapshot; imports are newest committed first. */
export type TagCatalogueSnapshot = {imports: readonly ScryfallBulkDataImport[]; outcomes: TagCatalogueOutcome[]};
export type TagCatalogueRepository = {readTagCatalogue(operation: BrowseTagsArgs["operation"], offset: number, limit: number): Promise<Result<TagCatalogueSnapshot, CardReferenceRepositoryError>>};

/** Complete catalogue records, stateless positional continuation and a successful-import-bound local read view. */
export async function browseTags(repository: TagCatalogueRepository, input: unknown, options: CardLookupOptions = {}, signal?: AbortSignal): Promise<Result<RetrievalSuccess<TagCatalogueOutcome>, RetrievalToolError<TagCatalogueOutcome>>> {
    const parsed = BrowseTagsArgsSchema.safeParse(input);
    const first = parsed.success ? parsed.data.first ?? 50 : 50;
    const budget = options.responseBudgetBytes ?? retrievalResponseBudgetBytes;
    const now = options.now ?? (() => performance.now()), started = now();
    let offset = 0;
    let edges: {node: TagCatalogueOutcome}[] = [];
    const metadata = () => ({requested_count: first, returned_count: edges.length, response_budget_bytes: budget, provider_total: null, scoped_total: null});
    const failure = (error: RetrievalProblem): RetrievalEnvelope<TagCatalogueOutcome> => ({status: "error", edges: [...edges], error, metadata: metadata()});
    const finish = (envelope: RetrievalEnvelope<TagCatalogueOutcome>) => {
        if (compactJsonBytes(envelope) > budget) {
            edges = [];
            envelope = failure({code: "response_budget_too_small", message: "Catalogue diagnostics exceed the response budget.", retryable: false, limit_bytes: budget});
            if (compactJsonBytes(envelope) > budget) throw new Error("Adapter cannot carry a minimal structured catalogue error.");
        }
        options.log?.info({operation: "browse_tags", status: envelope.status, returnedCount: envelope.edges.length, outputBytes: compactJsonBytes(envelope), durationMs: now() - started}, "Tag catalogue completed");
        options.log?.debug({operation: "browse_tags", after: parsed.success ? parsed.data.after : undefined, cursors: envelope.status === "ok" ? envelope.next_cursor : envelope.error.cursor}, "Tag catalogue continuation");
        return envelope.status === "ok" ? ok(envelope) : err({type: "retrieval_error" as const, message: envelope.error.message, envelope});
    };
    if (!parsed.success) return finish(failure({code: "invalid_request", message: "Invalid tag catalogue request.", retryable: false, issues: parsed.error.issues.map(i => ({path: i.path.map(p => typeof p === "symbol" ? String(p) : p), code: i.code}))}));
    const args = parsed.data, bindings = {operation: args.operation};
    let incoming: ReturnType<typeof decodeRetrievalCursor>["cursor"];
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return finish(failure(decoded.problem));
        incoming = decoded.cursor!;
        const reason = incoming.tool !== "browse_tags" ? "tool_mismatch" : incoming.source !== "local_tag_catalogue" ? "source_mismatch" : !cursorBindingsMatch(incoming, bindings) ? "query_mismatch" : undefined;
        if (reason) return finish(failure({code: "invalid_cursor", message: "Cursor does not match this catalogue operation.", reason, retryable: false}));
        if (!Number.isSafeInteger(incoming.position) || (incoming.position as number) < 0 || Object.keys(incoming.revisions).length !== 1 || typeof incoming.revisions.oracle_tags !== "string") return finish(failure({code: "invalid_cursor", message: "Malformed catalogue cursor position or import binding.", reason: "malformed", retryable: false}));
        offset = incoming.position as number;
        if (args.operation.type === "lookup" && offset > args.operation.slugs.length) return finish(failure({code: "invalid_cursor", message: "Catalogue lookup position exceeds inputs.", reason: "malformed", retryable: false}));
    }
    const snapshot = await repository.readTagCatalogue(args.operation, offset, first + 1);
    if (snapshot.isErr()) return finish(failure({code: "local_error", message: snapshot.error.message, retryable: false}));
    const imported = currentReferenceImports(snapshot.value.imports).get("oracle_tags");
    if (incoming && incoming.revisions.oracle_tags !== (imported?.id ?? null)) return finish(failure({code: "stale_cursor", message: "The successful tag import changed. Restart catalogue browsing.", reason: "reference_import_changed", recovery: "restart", retryable: false}));
    if (!imported || imported.importContractRevision !== requiredScryfallImportContractRevisions.oracle_tags) return finish(failure({code: "reference_data_unready", message: "Tag catalogue requires a compatible Oracle Tags import. Run bun run sync:scryfall.", retryable: false, missing_datasets: imported ? [] : ["oracle_tags"], reimport_required_datasets: imported ? ["oracle_tags"] : []}));
    const token = (position: number) => encodeRetrievalCursor({version: 2, tool: "browse_tags", source: "local_tag_catalogue", bindings, revisions: {oracle_tags: imported.id}, position});
    const source = snapshot.value.outcomes;
    const page = (stop_reason: RetrievalSuccess<TagCatalogueOutcome>["stop_reason"]): RetrievalSuccess<TagCatalogueOutcome> => ({status: "ok", edges: [...edges], next_cursor: source.length > edges.length ? token(offset + edges.length) : null, stop_reason, metadata: metadata()});
    const recover = (problem: RetrievalProblem) => {
        let envelope = failure({...problem, cursor: token(offset + edges.length)});
        while (compactJsonBytes(envelope) > budget && edges.length) {edges.pop(); envelope = failure({...problem, cursor: token(offset + edges.length)});}
        if (compactJsonBytes(envelope) > budget) envelope = failure({code: "response_budget_too_small", message: "Catalogue recovery metadata exceeds the response budget.", retryable: false, cursor: token(offset)});
        return finish(envelope);
    };
    const minimal = failure({code: "scan_timeout", message: "Catalogue scan deadline reached.", retryable: true, cursor: token(offset)});
    if (compactJsonBytes(minimal) > budget) return finish(failure({code: "cursor_too_large", message: "Self-contained catalogue cursor exceeds the response budget.", retryable: false, required_bytes: compactJsonBytes(minimal), limit_bytes: budget}));
    for (const node of source.slice(0, first)) {
        if (signal?.aborted) return recover({code: "cancelled", message: "Catalogue browsing cancelled.", retryable: true});
        if (now() - started >= (options.scanDeadlineMs ?? retrievalScanDeadlineMs)) return recover({code: "scan_timeout", message: "Catalogue scan deadline reached.", retryable: true});
        edges.push({node});
        const proposed = page(source.length === edges.length ? "source_exhausted" : "response_budget");
        if (compactJsonBytes(proposed) > budget) {
            const required = compactJsonBytes(proposed); edges.pop();
            if (edges.length) return finish(page("response_budget"));
            return recover({code: "record_too_large", message: "Complete tag definition and requested hierarchy cannot fit intact.", retryable: false, required_bytes: required, limit_bytes: budget});
        }
    }
    if (signal?.aborted) return recover({code: "cancelled", message: "Catalogue browsing cancelled.", retryable: true});
    if (now() - started >= (options.scanDeadlineMs ?? retrievalScanDeadlineMs)) return recover({code: "scan_timeout", message: "Catalogue scan deadline reached.", retryable: true});
    return finish(page(source.length > edges.length ? "first" : "source_exhausted"));
}
