import {availabilityRecords,type AvailabilityResult} from "./collection-availability";
import {createHash} from "node:crypto";
import {err, ok} from "neverthrow";
import {z} from "zod";
import {type DeckCandidate, roleSelectedCopies, summarizeDeckCandidate} from "./deck-candidate";
import {compactJsonBytes, decodeRetrievalCursor, cursorBindingsMatch, cursorScopeMatches, encodeRetrievalCursor, retrievalResponseBudgetBytes, type RetrievalSuccess, type RetrievalFailure, type RetrievalProblem} from "./card-retrieval";
import {renderCandidateReportParts, renderPortableDecklist} from "./deck-candidate-rendering";

export const candidateViewValues = ["summary", "brief", "selected", "options", "pool", "plan", "assessments", "json", "report", "portable_decklist", "availability", "collection_pull_list"] as const;
export const GetDeckCandidateViewArgsSchema = z.strictObject({
    id: z.uuid(), view: z.enum(candidateViewValues).default("summary"),
    first: z.number().int().min(0).max(200).optional(), after: z.string().min(1).optional(),
    role_id: z.uuid().optional(), card_identity_id: z.uuid().optional(),
}).refine(v => v.view !== "summary" || (v.first === undefined && v.after === undefined), {message:"Use view json for recoverable full-state records; summary does not accept pagination.", path:["view"]})
  .refine(v => (v.role_id === undefined && v.card_identity_id === undefined) || v.view === "pool" || v.view === "options", {message:"role_id and card_identity_id are only supported for pool and options views.", path:["view"]});
export type CandidateViewArgs = z.infer<typeof GetDeckCandidateViewArgsSchema>;
/** Values assign complete values; text fragments establish and append a string in index order. */
export type CandidateViewRecord = {path: (string | number)[]; kind: "value"; value: unknown; text?: never; index?: never; final?: never} | {path: (string | number)[]; kind: "text_fragment"; text: string; index: number; final: boolean; value?: never};
/** Reconstruct one exhausted traversal, rejecting missing, interleaved, or incomplete fragments. */
export function reconstructCandidateView(records: CandidateViewRecord[]): unknown {
    let root: any;
    let pending: {path: string; index: number; text: string} | undefined;
    const assign = (path: (string | number)[], value: unknown) => {
        if (!path.length) {root = value; return;}
        let parent = root;
        for (const key of path.slice(0,-1)) parent = parent[key];
        parent[path.at(-1)!] = value;
    };
    for (const record of records) {
        if (record.kind === "value") {
            if (pending) throw new Error("Incomplete candidate text fragments");
            assign(record.path, record.value);
            continue;
        }
        const path = JSON.stringify(record.path);
        if (!pending) {
            if (record.index !== 0) throw new Error("Candidate text fragments must start at zero");
            pending = {path, index:0, text:""};
        }
        if (pending.path !== path || pending.index !== record.index) throw new Error("Candidate text fragments are out of order");
        pending.text += record.text;
        pending.index++;
        if (record.final) {assign(record.path, pending.text); pending = undefined;}
    }
    if (pending) throw new Error("Incomplete candidate text fragments");
    return root;
}

export type CandidateViewContext = {candidate_id: string; updated_at: string; view: string; baseline: string; record_format: "path_value_text_v2"};

export function candidateOptionDetails(candidate: DeckCandidate, filters: {role_id?: string | undefined; card_identity_id?: string | undefined} = {}) {
    return candidate.options.filter(option =>
        (filters.card_identity_id === undefined || option.card_identity_id === filters.card_identity_id) &&
        (filters.role_id === undefined || candidate.plan?.contributions.some(c => c.card_identity_id === option.card_identity_id && c.role_id === filters.role_id))
    ).map(option => ({...option,
        memberships: candidate.memberships.filter(m => m.card_identity_id === option.card_identity_id),
        contributions: candidate.plan?.contributions.filter(c => c.card_identity_id === option.card_identity_id && (filters.role_id === undefined || c.role_id === filters.role_id)) ?? [],
    }));
}
export function candidatePoolView(candidate: DeckCandidate, filters: {role_id?: string | undefined; card_identity_id?: string | undefined} = {}) {
    const roles = (candidate.plan?.nodes ?? []).filter(n => n.kind === "role").filter(n =>
        (filters.role_id === undefined || n.id === filters.role_id) &&
        (filters.role_id !== undefined || filters.card_identity_id === undefined || candidate.plan?.contributions.some(c => c.role_id === n.id && c.card_identity_id === filters.card_identity_id)));
    return {options: candidateOptionDetails(candidate, filters), roles: roles.map(role => ({role,
        selected_copies: roleSelectedCopies(candidate, role),
        ...(filters.card_identity_id === undefined ? {} : {counts_scope: "whole_role" as const}),
        option_ids: candidate.plan!.contributions.filter(c => c.role_id === role.id).map(c => c.card_identity_id),
    }))};
}
function encodeRecords(raw: {path: (string | number)[]; value: unknown}[]): CandidateViewRecord[] {
    const result: CandidateViewRecord[] = [];
    // Reserve ample room for the escaped envelope, cursor and path. Only split objects that need it.
    const valueLimit = 44_000, fragmentLimit = 16_000;
    function emit(value: unknown, path: (string | number)[]) {
        if (compactJsonBytes({path, value}) <= valueLimit) {
            result.push({kind:"value", path, value});
        } else if (typeof value === "string") {
            const fragments: string[] = [];
            let part = "", bytes = 0;
            for (const char of value) {
                const size = Buffer.byteLength(JSON.stringify(char), "utf8") - 2;
                if (bytes + size > fragmentLimit && part) { fragments.push(part); part = ""; bytes = 0; }
                part += char; bytes += size;
            }
            if (part) fragments.push(part);
            fragments.forEach((text, index) => result.push({kind:"text_fragment", path, index, text, final:index === fragments.length - 1}));
        } else if (Array.isArray(value)) {
            result.push({kind:"value",path,value:[]});
            value.forEach((item, i) => emit(item, [...path,i]));
        } else if (value !== null && typeof value === "object") {
            result.push({kind:"value",path,value:{}});
            for (const [key,item] of Object.entries(value)) emit(item,[...path,key]);
        } else result.push({kind:"value",path,value});
    }
    raw.forEach(record => emit(record.value,record.path));
    return result;
}
function recordsFor(candidate: DeckCandidate, args: CandidateViewArgs): CandidateViewRecord[] {
    const {view} = args;
    const filters = args;
    if(view === "availability" || view === "collection_pull_list") {
        const evidence=candidate.validation_evidence?.checks?.collection_availability;
        if(!evidence || evidence.status==="absent") return encodeRecords([{path:[],value:{evidence_status:"absent",message:"Explicit Availability check required before assembly."}}]);
        if(evidence.status!=="applicable") return encodeRecords([{path:[],value:{evidence_status:"outdated",checked_at:evidence.checked_at,message:"Reconfirm current scope and explicitly recheck Availability before assembly."}}]);
        return encodeRecords([{path:["evidence"],value:{status:evidence.status,checked_at:evidence.checked_at,dependencies:evidence.dependencies}},...availabilityRecords(evidence.result as AvailabilityResult,view==="collection_pull_list")]);
    }
    let value: unknown;
    if (view === "brief") value = candidate.brief;
    else if (view === "selected") value = candidate.memberships;
    else if (view === "options") value = candidateOptionDetails(candidate, filters);
    else if (view === "pool") value = candidatePoolView(candidate, filters);
    else if (view === "plan") value = candidate.plan;
    else if (view === "assessments") value = {assessments: candidate.assessments, assessment_status: {power_play_experience_fit: candidate.assessments.power_play_experience_fit == null ? "unrecorded" : "recorded", mana_curve_adequacy: candidate.assessments.mana_curve_adequacy == null ? "unrecorded" : "recorded"}, validation_evidence: candidate.validation_evidence ?? summarizeDeckCandidate(candidate).validation_evidence};
    else if (view === "portable_decklist") value = renderPortableDecklist(candidate.format, candidate.cards).split("\n").map(line => `${line}\n`);
    else if (view === "report") value = renderCandidateReportParts(candidate);
    else value = candidate;
    const records: {path: (string | number)[]; value: unknown}[] = [];
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
    return encodeRecords(records);
}

export function readCandidateView(candidate: DeckCandidate, args: CandidateViewArgs) {
    const first = args.first ?? 50;
    const records = recordsFor(candidate, args);
    const bindings = {id:candidate.id,view:args.view,format:"path_value_text_v2",role_id:args.role_id ?? null,card_identity_id:args.card_identity_id ?? null};
    // Bind exactly the included view plus content timestamp. Included names/check evidence can change without a content edit; unrelated data must not stale a Brief-only view.
    const baseline = createHash("sha256").update(JSON.stringify({updated_at:candidate.updatedAt,view:args.view,records})).digest("hex");
    const context: CandidateViewContext = {candidate_id:candidate.id, updated_at:candidate.updatedAt, view:args.view, baseline, record_format:"path_value_text_v2"};
    let offset = 0;
    const metadata = (returned_count: number) => ({requested_count:first, returned_count, response_budget_bytes:retrievalResponseBudgetBytes, provider_total:null, scoped_total:records.length});
    const failure = (problem: RetrievalProblem) => err({type:"retrieval_error" as const, message:problem.message, envelope:{status:"error" as const, ...context, edges:[], error:problem, metadata:metadata(0)} satisfies RetrievalFailure<CandidateViewRecord> & CandidateViewContext});
    if (args.after) {
        const decoded = decodeRetrievalCursor(args.after);
        if (decoded.problem) return failure(decoded.problem);
        const cursor = decoded.cursor!;
        if (cursor.tool !== "get_deck_candidate" || cursor.source !== "candidate" || !cursorBindingsMatch(cursor, bindings) || !Number.isSafeInteger(cursor.position) || (cursor.position as number) < 0 || (cursor.position as number) > records.length) return failure({code:"invalid_cursor", message:"Cursor does not match this candidate/view, representation or record position. Restart this view without after.", retryable:false, recovery:"restart"});
        if (cursor.revisions.baseline !== baseline) return failure({code:"stale_cursor", message:"Candidate/view baseline changed. Restart this view without after.", retryable:false, recovery:"restart"});
        offset = cursor.position as number;
    }
    const token = (position: number) => encodeRetrievalCursor({version:2,tool:"get_deck_candidate",source:"candidate",bindings:bindings,revisions:{baseline},position});
    const page = (end: number, stop_reason: RetrievalSuccess<CandidateViewRecord>["stop_reason"]) => ({status:"ok" as const, ...context,
        edges:records.slice(offset,end).map(node => ({node})),
        next_cursor:end<records.length?token(end):null,stop_reason,metadata:metadata(end-offset)});
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
