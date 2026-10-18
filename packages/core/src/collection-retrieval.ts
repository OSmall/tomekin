import {z} from "zod";
import {CollectionLocationReferenceSchema, CollectionPolicyInputSchema, CopyRequirementsSchema, evaluateCopyRequirements, evaluateOwnedRow, resolveCollectionPolicy, type CollectionBrowseRepository, type CollectionPolicySnapshot, type ResolvedCollectionPolicy} from "./collection-policy";
import type {CollectionPolicyLoader} from "./collection-browse";
import type {CardResult, RetrievalProblem} from "./card-retrieval";
import {requiredScryfallImportContractRevisions} from "./scryfall-sync";

const copyDescriptions = {
    collection_card_id: "Snapshot-local owned source row ID; always returned.", printing_id: "Actual owned Printing UUID; always returned.", quantity: "Complete source-row quantity, not allocation; always returned.",
    location: "Exact source location ID, type and case-sensitive name.", added_at: "Reliable source-added UTC instant or null.", finish: "Singular owned finish, distinct from supported Printing finishes.", condition: "Source condition or null.", altered: "Source altered flag or null.", misprint: "Source misprint flag or null.", purchase_price: "Source purchase price or null.", purchase_price_currency: "Source purchase currency or null.", source_row_number: "Source CSV row number.",
    set: "Actual owned Printing Set code.", set_id: "Actual owned Printing Set UUID.", set_name: "Actual owned Printing Set name.", set_type: "Actual owned Printing Set type.", collector_number: "Actual owned Printing collector number string.", lang: "Actual owned Printing language.", printed_name: "Actual printed name or null.", finishes: "Complete supported finishes of the actual owned Printing.", promo_types: "Complete promo types of the actual owned Printing.", tcgplayer_id: "Actual Printing TCGplayer ID or null.", cardmarket_id: "Actual Printing Cardmarket ID or null.", printing_layout: "Actual Printing presentation layout.",
} as const;
type CopyFact = keyof typeof copyDescriptions;
export const CopySelectionSchema = z.strictObject(Object.fromEntries(Object.entries(copyDescriptions).map(([key, description]) => [key, z.literal(true).describe(description).optional()])) as {[K in CopyFact]: z.ZodOptional<z.ZodLiteral<true>>}).refine(value => Object.keys(value).length > 0, "Select at least one copy fact.").meta({minProperties: 1});
export const CollectionEvidenceInputSchema = z.discriminatedUnion("mode", [z.strictObject({mode: z.literal("summary")}), z.strictObject({mode: z.literal("copies"), select: CopySelectionSchema})]);
export const CollectionScopeSchema = z.strictObject({match: z.enum(["identity", "printing"]).default("identity"), locations: z.array(z.union([CollectionLocationReferenceSchema, z.strictObject({id: z.uuid()})])).optional(), copy_requirements: CopyRequirementsSchema.default({})});
export const collectionRetrievalShape = {collection_scope: CollectionScopeSchema.optional(), collection_policy: CollectionPolicyInputSchema.optional(), collection_evidence: CollectionEvidenceInputSchema.optional()};
export type CollectionRetrievalArgs = {collection_scope?: z.infer<typeof CollectionScopeSchema> | undefined; collection_policy?: z.infer<typeof CollectionPolicyInputSchema> | undefined; collection_evidence?: z.infer<typeof CollectionEvidenceInputSchema> | undefined};
export type CollectionRetrievalContext = {state: "ready" | "no_collection" | "reimport_required"; collection_import_id: string | null; match: "identity" | "printing"; effective_policy: ResolvedCollectionPolicy | null};
export type CollectionEvidence = {summary: {owned_quantity: number; eligible_quantity: number | null; uncertain_quantity: number | null; policy_status: "confirmed" | "unconfirmed"}; copies?: ({collection_card_id: string; printing_id: string; quantity: number} & Record<string, unknown>)[]};
export type CollectionRetrievalDependencies = {repository: CollectionBrowseRepository; loadPolicy: CollectionPolicyLoader};
export class CollectionRetrievalFailure extends Error {constructor(readonly problem: RetrievalProblem, readonly context?: CollectionRetrievalContext) {super(problem.message);}}
const fail = (problem: RetrievalProblem): never => {throw new CollectionRetrievalFailure(problem);};
export const collectionRevisionKeys = ["collection", "collection_policy"] as const;
export function collectionRequestBindings(args: CollectionRetrievalArgs) {
    return {...(args.collection_scope ? {collection_scope: args.collection_scope} : {}), ...(args.collection_policy ? {collection_policy: args.collection_policy} : {}), ...(args.collection_evidence ? {collection_evidence: {mode: args.collection_evidence.mode}} : {})};
}
function latest(snapshot: CollectionPolicySnapshot) {
    const result = new Map<string, CollectionPolicySnapshot["referenceImports"][number]>();
    for (const item of snapshot.referenceImports) if (item.status === "succeeded") {const old = result.get(item.bulkDataType); if (!old || (item.completedAt ?? item.startedAt).getTime() > (old.completedAt ?? old.startedAt).getTime()) result.set(item.bulkDataType, item);}
    return result;
}
/** Local evaluation is complete per source card, transient, and bound before anything is emitted. */
export async function prepareCollectionRetrieval(args: CollectionRetrievalArgs, dependencies: CollectionRetrievalDependencies | undefined, incoming?: Record<string, string | null>) {
    if (!args.collection_scope && !args.collection_policy && !args.collection_evidence) return undefined;
    if (!dependencies) return fail({code: "local_error", message: "Collection retrieval repository is unavailable.", retryable: false});
    const {repository, loadPolicy} = dependencies;
    const match = args.collection_scope?.match ?? "identity";
    const read = async () => {
        const snapshot = await repository.readCollectionPolicySnapshot();
        if (snapshot.isErr()) return fail({code: "local_error", message: snapshot.error.message, retryable: false});
        const loaded = args.collection_policy ? await loadPolicy(args.collection_policy) : null;
        if (loaded?.isErr()) return fail({code: incoming ? "stale_cursor" : "invalid_request", reason: incoming ? "candidate_policy_changed" : "invalid_policy", message: loaded.error.message, retryable: false, ...(incoming ? {recovery: "reconfirm_scope" as const} : {})});
        const policy = loaded?.isOk() ? loaded.value : null;
        const imports = latest(snapshot.value);
        return {snapshot: snapshot.value, imports, policy};
    };
    const initial = await read();
    const {snapshot, imports} = initial;
    const revisions: Record<string, string | null> = {collection: snapshot.activeImport?.id ?? (snapshot.legacySnapshot ? "legacy" : null), collection_policy: initial.policy ? JSON.stringify(initial.policy) : null};
    if (snapshot.activeImport) for (const dataset of ["oracle_cards", "all_cards"]) revisions[dataset] = imports.get(dataset)?.id ?? null;
    const compare = (current: Record<string, string | null>, original: Record<string, string | null>) => {
        for (const [key, revision] of Object.entries(original)) if (key in current && current[key] !== revision) return fail({code: "stale_cursor", reason: key === "collection" ? "collection_import_changed" : key === "collection_policy" ? "candidate_policy_changed" : "reference_import_changed", message: "A bound Collection, reference import, or effective policy changed.", recovery: key === "collection" || key === "collection_policy" ? "reconfirm_scope" : "restart", retryable: false});
    };
    if (incoming) {
        for (const key of Object.keys(revisions)) if (!(key in incoming)) return fail({code: "invalid_cursor", reason: "malformed", message: "Cursor lacks required Collection dependencies.", retryable: false});
        compare(revisions, incoming);
    }
    if (snapshot.legacySnapshot && !snapshot.activeImport) throw new CollectionRetrievalFailure({code: "reference_data_unready", reason: "collection_reimport_required", message: "Reimport the legacy Collection to establish a reliable active snapshot.", recovery: "reconfirm_scope", retryable: false}, {state: "reimport_required", collection_import_id: null, match, effective_policy: null});
    let policy: ResolvedCollectionPolicy | null = null;
    if (initial.policy) {
        const resolved = resolveCollectionPolicy(initial.policy, snapshot);
        if (resolved.isErr()) return fail({code: "invalid_request", reason: resolved.error.reason, message: resolved.error.message, retryable: false, recovery: "reconfirm_scope"});
        policy = resolved.value;
        const ids = await repository.collectionCardIdsExist(policy.excluded_collection_card_ids);
        if (ids.isErr()) return fail({code: "local_error", message: ids.error.message, retryable: false});
        if (!ids.value) return fail({code: "invalid_request", reason: "unknown_collection_card", message: "An excluded Collection row is absent from the active snapshot.", retryable: false});
    }
    if (args.collection_scope && !policy) return fail({code: "invalid_request", reason: "unconfirmed_policy", message: "Collection-scoped discovery requires a confirmed Collection Access Policy.", retryable: false});
    const locations = args.collection_scope?.locations?.map(reference => {
        const found = snapshot.locations.find(location => (!("type" in reference) || (location.type === reference.type && location.name === reference.name)) && (!("id" in reference) || location.id === reference.id));
        return found ?? fail({code: "invalid_request", reason: "unknown_location", message: "An exact Collection scope location is absent from the active snapshot.", recovery: "reconfirm_scope", retryable: false});
    });
    if (snapshot.activeImport) {
        const missing = ["oracle_cards", "all_cards"].filter(dataset => !imports.has(dataset));
        const incompatible = ["oracle_cards", "all_cards"].filter(dataset => imports.has(dataset) && imports.get(dataset)!.importContractRevision !== requiredScryfallImportContractRevisions[dataset as "oracle_cards" | "all_cards"]);
        if (missing.length || incompatible.length) return fail({code: "reference_data_unready", message: "Collection evidence requires compatible Oracle Cards and All Cards imports. Run bun run sync:scryfall.", missing_datasets: missing, reimport_required_datasets: incompatible, retryable: false});
    }
    const context: CollectionRetrievalContext = {state: snapshot.activeImport ? "ready" : "no_collection", collection_import_id: snapshot.activeImport?.id ?? null, match, effective_policy: policy};
    const assertCurrent = async () => {
        let current: Awaited<ReturnType<typeof read>>;
        try { current = await read(); } catch (e) {if (e instanceof CollectionRetrievalFailure && e.problem.reason === "invalid_policy") return fail({...e.problem, code: "stale_cursor", reason: "candidate_policy_changed", recovery: "reconfirm_scope"}); throw e;}
        const currentRevisions: Record<string, string | null> = {collection: current.snapshot.activeImport?.id ?? (current.snapshot.legacySnapshot ? "legacy" : null), collection_policy: current.policy ? JSON.stringify(current.policy) : null};
        for (const dataset of ["oracle_cards", "all_cards"]) if (dataset in revisions) currentRevisions[dataset] = current.imports.get(dataset)?.id ?? null;
        compare(currentRevisions, revisions);
    };
    return {context, revisions, provenance: snapshot.activeImport ? {collection_import: {import_id: snapshot.activeImport.id, imported_at: snapshot.activeImport.imported_at}} : {}, assertCurrent, async evaluate(node: CardResult, printingId: string | undefined, check: () => void) {
        if (match === "printing" && !printingId) return fail({code: "invalid_request", reason: "incompatible_reference_kind", message: "Printing matching requires exact Printing references throughout the lookup batch.", retryable: false});
        let owned = 0, eligible = 0, uncertain = 0, offset = 0;
        const copies: NonNullable<CollectionEvidence["copies"]> = [];
        if (snapshot.activeImport) for (;;) {
            check();
            const batch = await repository.readOwnedRows({offset, first: 128, order: "source_order", ...(match === "printing" ? {printing_ids: [printingId!]} : {oracle_ids: [node.card.oracle_id]})});
            check();
            if (batch.isErr()) return fail({code: "local_error", message: batch.error.message, retryable: false});
            if (!batch.value.length) break;
            for (const row of batch.value) {
                check(); offset++;
                if (locations && !locations.some(location => location.id === row.location.id)) continue;
                const criteria = evaluateCopyRequirements(args.collection_scope?.copy_requirements ?? {}, row);
                if (criteria.decision === "eligible") owned += row.quantity;
                const permission = policy ? evaluateOwnedRow(policy, row) : null;
                const excluded = criteria.decision === "excluded" || permission?.decision === "excluded";
                if (!excluded && (criteria.decision === "uncertain" || permission?.decision === "uncertain")) uncertain += row.quantity;
                if (criteria.decision !== "eligible" || permission?.decision !== "eligible") continue;
                eligible += row.quantity;
                if (args.collection_evidence?.mode === "copies") {
                    const copy: NonNullable<CollectionEvidence["copies"]>[number] = {collection_card_id: row.collection_card_id, printing_id: row.printing_id, quantity: row.quantity};
                    if (row.location.type === "deck") {copy.committed = true; copy.location = row.location;}
                    for (const field of Object.keys(args.collection_evidence.select) as CopyFact[]) (copy as Record<string, unknown>)[field] = row[field];
                    copies.push(copy);
                }
            }
        }
        await assertCurrent(); check();
        if (args.collection_evidence) node.collection_evidence = {summary: {owned_quantity: owned, eligible_quantity: policy ? eligible : null, uncertain_quantity: policy ? uncertain : null, policy_status: policy ? "confirmed" : "unconfirmed"}, ...(args.collection_evidence.mode === "copies" ? {copies} : {})};
        return !args.collection_scope || eligible > 0;
    }};
}
export type CollectionRetrievalSession = NonNullable<Awaited<ReturnType<typeof prepareCollectionRetrieval>>>;
