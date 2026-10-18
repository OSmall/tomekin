import {availabilityRecords,type AvailabilityResult} from "./collection-availability";
import {createHash} from "node:crypto";
import {err, ok} from "neverthrow";
import {z} from "zod";
import {type DeckCandidate, roleSelectedCopies, summarizeDeckCandidate} from "./deck-candidate";
import {compactJsonBytes, decodeRetrievalCursor, encodeRetrievalCursor, retrievalResponseBudgetBytes, type RetrievalSuccess, type RetrievalFailure, type RetrievalProblem} from "./card-retrieval";
import {renderCandidateReportParts, renderPortableDecklist} from "./deck-candidate-rendering";

export const candidateViewValues = ["summary", "brief", "selected", "options", "pool", "plan", "assessments", "json", "report", "portable_decklist", "availability", "collection_pull_list"] as const;
export const GetDeckCandidateViewArgsSchema = z.strictObject({
    id: z.uuid(), view: z.enum(candidateViewValues).default("summary"),
    first: z.number().int().min(0).max(200).optional(), after: z.string().min(1).optional(),
}).superRefine((v, c) => {
    if (v.view === "summary" && (v.first !== undefined || v.after !== undefined)) c.addIssue({code:"custom", message:"Use view json for recoverable full-state records; summary does not accept pagination.", path:["view"]});
});
export type CandidateViewArgs = z.infer<typeof GetDeckCandidateViewArgsSchema>;
/** Apply these records in order to an empty value; paths are object keys/array indices. Values are complete, never previews. */
export type CandidateViewRecord = {path: (string | number)[]; value: unknown};
export type CandidateViewContext = {candidate_id: string; updated_at: string; view: string; baseline: string; record_format: "path_value_v1"};

export function candidateOptionDetails(candidate: DeckCandidate) {
    return candidate.options.map(option => ({...option,
        memberships: candidate.memberships.filter(m => m.card_identity_id === option.card_identity_id),
        contributions: candidate.plan?.contributions.filter(c => c.card_identity_id === option.card_identity_id) ?? [],
    }));
}
export function candidatePoolView(candidate: DeckCandidate) {
    return {options: candidateOptionDetails(candidate), roles: (candidate.plan?.nodes ?? []).filter(n => n.kind === "role").map(role => ({role,
        selected_copies: roleSelectedCopies(candidate, role),
        option_ids: candidate.plan!.contributions.filter(c => c.role_id === role.id).map(c => c.card_identity_id),
    }))};
}
function recordsFor(candidate: DeckCandidate, view: string): CandidateViewRecord[] {
    if(view === "availability" || view === "collection_pull_list") {
        const evidence=candidate.validation_evidence?.checks?.collection_availability;
        if(!evidence || evidence.status==="absent") return [{path:[],value:{evidence_status:"absent",message:"Explicit Availability check required before assembly."}}];
        if(evidence.status!=="applicable") return [{path:[],value:{evidence_status:"outdated",checked_at:evidence.checked_at,message:"Reconfirm current scope and explicitly recheck Availability before assembly."}}];
        return [{path:["evidence"],value:{status:evidence.status,checked_at:evidence.checked_at,dependencies:evidence.dependencies}},...availabilityRecords(evidence.result as AvailabilityResult,view==="collection_pull_list")];
    }
    let value: unknown;
    if (view === "brief") value = candidate.brief;
    else if (view === "selected") value = candidate.memberships;
    else if (view === "options") value = candidateOptionDetails(candidate);
    else if (view === "pool") value = candidatePoolView(candidate);
    else if (view === "plan") value = candidate.plan;
    else if (view === "assessments") value = {assessments: candidate.assessments, assessment_status: {power_play_experience_fit: candidate.assessments.power_play_experience_fit == null ? "unrecorded" : "recorded", mana_curve_adequacy: candidate.assessments.mana_curve_adequacy == null ? "unrecorded" : "recorded"}, validation_evidence: candidate.validation_evidence ?? summarizeDeckCandidate(candidate).validation_evidence};
    else if (view === "portable_decklist") value = renderPortableDecklist(candidate.format, candidate.cards).split("\n").map(line => `${line}\n`);
    else if (view === "report") value = renderCandidateReportParts(candidate);
    else value = candidate;
    const records: CandidateViewRecord[] = [];
    // Containers are explicit, including empty arrays/objects. Array entities retain all local reasoning together.
    function visit(value: unknown, path: (string | number)[]) {
        if (Array.isArray(value)) {
            records.push({path, value: []});
            value.forEach((item, i) => records.push({path:[...path,i], value:item}));
        } else if (value !== null && typeof value === "object") {
            records.push({path, value:{}});
            for (const [key, item] of Object.entries(value)) visit(item,[...path,key]);
        } else records.push({path, value});
    }
    visit(value,[]);
    return records;
}

export function readCandidateView(candidate: DeckCandidate, args: CandidateViewArgs) {
    const first = args.first ?? 50;
    const records = recordsFor(candidate, args.view);
    // Bind exactly the included view plus content timestamp. Included names/check evidence can change without a content edit; unrelated data must not stale a Brief-only view.
    const baseline = createHash("sha256").update(JSON.stringify({updated_at:candidate.updatedAt,view:args.view,records})).digest("hex");
    const context: CandidateViewContext = {candidate_id:candidate.id, updated_at:candidate.updatedAt, view:args.view, baseline, record_format:"path_value_v1"};
    let offset = 0;
    const metadata = (returned_count: number) => ({requested_count:first, returned_count, response_budget_bytes:retrievalResponseBudgetBytes, provider_total:null, scoped_total:records.length});
    const failure = (problem: RetrievalProblem) => err({type:"retrieval_error" as const, message:problem.message, envelope:{status:"error" as const, ...context, edges:[], error:problem, metadata:metadata(0)} satisfies RetrievalFailure<CandidateViewRecord> & CandidateViewContext});
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return failure(decoded.problem);
        const cursor = decoded.cursor!;
        if (cursor.tool !== "get_deck_candidate" || cursor.source !== "candidate" || JSON.stringify(cursor.bindings) !== JSON.stringify({id:candidate.id,view:args.view}) || !Number.isSafeInteger(cursor.position) || (cursor.position as number) < 0 || (cursor.position as number) > records.length) return failure({code:"invalid_cursor", message:"Cursor does not match this candidate/view or record position.", retryable:false});
        if (cursor.revisions.baseline !== baseline) return failure({code:"stale_cursor", message:"Candidate/view baseline changed. Restart this view without after.", retryable:false, recovery:"restart"});
        offset = cursor.position as number;
    }
    const token = (position: number) => encodeRetrievalCursor({version:1,tool:"get_deck_candidate",source:"candidate",bindings:{id:candidate.id,view:args.view},revisions:{baseline},position});
    const page = (end: number, stop_reason: RetrievalSuccess<CandidateViewRecord>["stop_reason"]) => ({status:"ok" as const, ...context,
        edges:records.slice(offset,end).map(node => ({node})),
        pageInfo:{startCursor:token(offset),endCursor:token(end),hasPreviousPage:offset>0,hasNextPage:end<records.length},stop_reason,metadata:metadata(end-offset)});
    let end = offset;
    while (end < records.length && end-offset < first) {
        // Tentative pages must reserve their eventual stop metadata before accepting a record.
        const proposed = page(end+1,end+1===records.length?"source_exhausted":end+1-offset===first?"first":"response_budget");
        if (compactJsonBytes(proposed) > retrievalResponseBudgetBytes) {
            if (end === offset) return failure({code:"record_too_large", message:`Complete record at ${JSON.stringify(records[end]!.path)} cannot fit intact within the response budget. The recovery cursor remains before this record.`,retryable:false,cursor:token(offset),required_bytes:compactJsonBytes(proposed),limit_bytes:retrievalResponseBudgetBytes});
            return ok(page(end,"response_budget"));
        }
        end++;
    }
    return ok(page(end,end===records.length?"source_exhausted":"first"));
}
