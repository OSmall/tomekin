import {createHash} from "node:crypto";
import {z} from "zod";
import {err, ok} from "neverthrow";
import {DeckCheckArgsSchema, DeckCheckInputSchema, type CapturedDeckCheck} from "./deck-checks";
import {CopyRequirementsSchema, collectionPolicyFromBrief, evaluateCopyRequirements, evaluateOwnedRow, resolveCollectionPolicy, type CollectionBrowseRepository, type CopyRequirements, type OwnedRowFacts, type ResolvedCollectionPolicy} from "./collection-policy";
import {DeckCandidateCardSectionSchema} from "./deck-candidate";
import {snapshotRevisions} from "./collection-browse";
import {compactJsonBytes, decodeRetrievalCursor, encodeRetrievalCursor, retrievalResponseBudgetBytes, retrievalScanDeadlineMs, type RetrievalProblem} from "./card-retrieval";
import type {CardLookupOptions} from "./card-lookup";
import type {DeckLegalityCard} from "./format-legality";

export const AvailabilityDemandSchema = z.strictObject({oracle_id:z.uuid(),section:DeckCandidateCardSectionSchema,quantity:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),copy_requirements:CopyRequirementsSchema.default({})});
const extras = {requirements:z.array(AvailabilityDemandSchema).optional(),first:z.number().int().min(0).max(200).optional(),after:z.string().min(1).optional()};
export const CheckCollectionAvailabilityArgsSchema = DeckCheckArgsSchema.extend(extras);
export const CheckCollectionAvailabilityInputSchema = z.intersection(DeckCheckInputSchema, z.object(extras));
export type AvailabilityDemand = z.infer<typeof AvailabilityDemandSchema>;
export type AvailabilityRequirement = AvailabilityDemand & {demand_id:string;owned:number;eligible:number|null;missing_owned:number;policy_shortfall:number|null;compatible_supply:number;uncertain_compatible_supply:number;permitted_uncommitted_supply:number|null;permitted_committed_supply:number|null;excluded_supply:number|null;uncertain_policy_supply:number|null;reasons:string[]};
export type AvailabilityAllocation = {demand_id:string;oracle_id:string;section:AvailabilityDemand["section"];allocated_quantity:number;committed:boolean;row:OwnedRowFacts;proof_fields:string[]};
export type AvailabilityResult = {check_completion:"complete";collection_context:{state:"ready"|"empty_collection"|"no_collection";collection_import_id:string|null;imported_at:string|null;effective_policy:ResolvedCollectionPolicy|null;policy_status:"confirmed"|"unconfirmed"};dependencies:Record<string,string|null>;summary:{required:number;owned:number;eligible:number|null;missing_owned:number;policy_shortfall:number|null;committed:number|null;sufficient:boolean|null;metadata_uncertain:boolean;possession_scope:"recorded_collection_only"};requirements:AvailabilityRequirement[];allocations:AvailabilityAllocation[]};
export function normalizeAvailabilityDemands(cards:readonly DeckLegalityCard[], restrictions?:AvailabilityDemand[]): AvailabilityDemand[] {
    const selected=new Map<string,number>();
    for(const c of cards) {const key=JSON.stringify([c.card.id,c.section]); selected.set(key,(selected.get(key)??0)+c.quantity);}
    const demands=restrictions??[...selected].map(([key,quantity])=>{const [oracle_id,section]=JSON.parse(key);return {oracle_id,section,quantity,copy_requirements:{}};});
    const supplied=new Map<string,number>();
    for(const d of demands) {const key=JSON.stringify([d.oracle_id,d.section]); supplied.set(key,(supplied.get(key)??0)+d.quantity);}
    if(selected.size!==supplied.size || [...selected].some(([key,q])=>supplied.get(key)!==q)) throw new Error("Availability requirements must cover the complete selected quantities in every section exactly; restrictions may only narrow copies.");
    const total=demands.reduce((n,d)=>n+d.quantity,0);
    if(!Number.isSafeInteger(total)||demands.some(d=>!Number.isSafeInteger(d.quantity))) throw new Error("Selected demand exceeds exact safe integer capacity.");
    return [...demands].sort((a,b)=>a.oracle_id.localeCompare(b.oracle_id)||JSON.stringify(a.copy_requirements).localeCompare(JSON.stringify(b.copy_requirements))||a.section.localeCompare(b.section));
}

type Cost=readonly [number,number];
type Edge={to:number;reverse:number;capacity:number;cost:Cost;initial:number};
/** Capacities represent source quantities, never expanded physical-copy vertices. Residual reverse edges allow reassignment. */
function allocate(demands:readonly AvailabilityDemand[], rows:readonly OwnedRowFacts[], policy:ResolvedCollectionPolicy|null) {
    const source=0,rowBase=1,demandBase=rowBase+rows.length,sink=demandBase+demands.length,graph:Edge[][]=Array.from({length:sink+1},()=>[]);
    function edge(from:number,to:number,capacity:number,cost:Cost):Edge {const f={to,reverse:graph[to]!.length,capacity,cost,initial:capacity};const r={to:from,reverse:graph[from]!.length,capacity:0,cost:[-cost[0],-cost[1]] as Cost,initial:0};graph[from]!.push(f);graph[to]!.push(r);return f;}
    const evaluations=rows.map(r=>policy?evaluateOwnedRow(policy,r):null);
    const compatibility=rows.map(r=>demands.map(d=>r.oracle_id===d.oracle_id?evaluateCopyRequirements(d.copy_requirements,r):null));
    const allocations:{row:number;demand:number;edge:Edge}[]=[];
    rows.forEach((row,r)=>{const e=evaluations[r];edge(source,rowBase+r,row.quantity,e?.decision==="eligible"?[0,e.committed?1:0]:[1,0]);demands.forEach((d,i)=>{if(compatibility[r]![i]?.decision==="eligible") allocations.push({row:r,demand:i,edge:edge(rowBase+r,demandBase+i,Math.min(row.quantity,d.quantity),[0,0])});});});
    demands.forEach((d,i)=>edge(demandBase+i,sink,d.quantity,[0,0]));
    const less=(a:Cost,b:Cost)=>a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]);
    for(;;) {
        const distance:(Cost|null)[]=graph.map(()=>null),prev:({node:number;edge:number}|null)[]=graph.map(()=>null);distance[source]=[0,0];
        // Bellman-Ford handles negative residual costs. Strict relaxation and canonical insertion order make ties deterministic.
        for(let pass=0;pass<graph.length-1;pass++) {let changed=false;for(let node=0;node<graph.length;node++){const dist=distance[node];if(!dist)continue;graph[node]!.forEach((e,i)=>{if(e.capacity<=0)return;const next:Cost=[dist[0]+e.cost[0],dist[1]+e.cost[1]];if(!distance[e.to]||less(next,distance[e.to]!)){distance[e.to]=next;prev[e.to]={node,edge:i};changed=true;}});}if(!changed)break;}
        if(!prev[sink])break;
        let amount=Number.MAX_SAFE_INTEGER;
        for(let n=sink;n!==source;){const p=prev[n]!;amount=Math.min(amount,graph[p.node]![p.edge]!.capacity);n=p.node;}
        for(let n=sink;n!==source;){const p=prev[n]!,e=graph[p.node]![p.edge]!;e.capacity-=amount;graph[n]![e.reverse]!.capacity+=amount;n=p.node;}
    }
    return {allocations:allocations.map(a=>({...a,quantity:a.edge.initial-a.edge.capacity})).filter(a=>a.quantity>0),evaluations,compatibility};
}
export async function computeCollectionAvailability(repository:CollectionBrowseRepository,capture:CapturedDeckCheck,requirements:AvailabilityDemand[],options:CardLookupOptions={},signal?:AbortSignal) {
    const now=options.now??(()=>performance.now()),started=now();
    const stop=()=>{if(signal?.aborted)throw new Error("cancelled");if(now()-started>=(options.scanDeadlineMs??retrievalScanDeadlineMs))throw new Error("scan_timeout");};
    stop();
    const snapshotResult=await repository.readCollectionPolicySnapshot();if(snapshotResult.isErr())return snapshotResult;const snapshot=snapshotResult.value;
    if(snapshot.legacySnapshot&&!snapshot.activeImport)return err({type:"validation_error" as const,message:"Reimport the legacy Collection and reconfirm scope before checking Availability."});
    const loaded=collectionPolicyFromBrief(capture.brief);if(loaded.isErr())return err({type:"validation_error" as const,message:loaded.error.message});
    const resolved=loaded.value?resolveCollectionPolicy(loaded.value,snapshot):null;
    if(resolved?.isErr())return err({type:"validation_error" as const,message:resolved.error.message+" List current locations, reconfirm scope and recheck."});
    const policy=resolved?.isOk()?resolved.value:null;
    if(policy){const valid=await repository.collectionCardIdsExist(policy.excluded_collection_card_ids);if(valid.isErr())return valid;if(!valid.value)return err({type:"validation_error" as const,message:"An excluded Collection row is absent from the active snapshot. Reconfirm scope."});}
    const rows:OwnedRowFacts[]=[];
    if(requirements.length&&snapshot.activeImport) for(let offset=0;;offset+=128){stop();const batch=await repository.readOwnedRows({offset,first:128,order:"source_order",oracle_ids:[...new Set(requirements.map(d=>d.oracle_id))]});if(batch.isErr())return batch;if(!batch.value.length)break;for(const row of batch.value){if(!Number.isSafeInteger(row.quantity)||row.quantity<=0)return err({type:"validation_error" as const,message:"Collection quantity exceeds exact safe integer capacity."});rows.push(row);}}
    rows.sort((a,b)=>a.source_row_number-b.source_row_number||a.collection_card_id.localeCompare(b.collection_card_id));
    const relevantTotal=rows.reduce((q,r)=>q+r.quantity,0);if(!Number.isSafeInteger(relevantTotal))return err({type:"validation_error" as const,message:"Collection quantity exceeds exact safe integer capacity."});
    stop();const flow=allocate(requirements,rows,policy);stop();
    const details:AvailabilityRequirement[]=requirements.map((d,i)=>{let owned=0,eligible=0;for(const a of flow.allocations)if(a.demand===i){owned+=a.quantity;if(flow.evaluations[a.row]?.decision==="eligible")eligible+=a.quantity;}
        const supply={compatible_supply:0,uncertain_compatible_supply:0,permitted_uncommitted_supply:0,permitted_committed_supply:0,excluded_supply:0,uncertain_policy_supply:0};const reasons=new Set<string>();
        rows.forEach((r,j)=>{const compatible=flow.compatibility[j]![i];if(!compatible||compatible.decision==="excluded")return;if(compatible.decision==="uncertain"){supply.uncertain_compatible_supply+=r.quantity;for(const f of compatible.uncertain_fields)reasons.add(`unknown_requirement:${f}`);return;}supply.compatible_supply+=r.quantity;const e=flow.evaluations[j];if(!e)return;for(const reason of e.reasons)reasons.add(reason);for(const f of e.uncertain_fields)reasons.add(`unknown_policy:${f}`);if(e.decision==="eligible")supply[e.committed?"permitted_committed_supply":"permitted_uncommitted_supply"]+=r.quantity;else supply[e.decision==="excluded"?"excluded_supply":"uncertain_policy_supply"]+=r.quantity;});
        return {...d,demand_id:`d${i+1}`,owned,eligible:policy?eligible:null,missing_owned:d.quantity-owned,policy_shortfall:policy?owned-eligible:null,...supply,...(!policy?{permitted_uncommitted_supply:null,permitted_committed_supply:null,excluded_supply:null,uncertain_policy_supply:null}:{}),reasons:[...reasons].sort()};});
    const allocations:AvailabilityAllocation[]=flow.allocations.filter(a=>flow.evaluations[a.row]?.decision==="eligible").map(a=>({demand_id:details[a.demand]!.demand_id,oracle_id:requirements[a.demand]!.oracle_id,section:requirements[a.demand]!.section,allocated_quantity:a.quantity,committed:flow.evaluations[a.row]!.committed,row:rows[a.row]!,proof_fields:[...new Set([...flow.evaluations[a.row]!.proof_fields,...flow.compatibility[a.row]![a.demand]!.proof_fields])]}));
    const sum=(key:"quantity"|"owned"|"eligible"|"missing_owned"|"policy_shortfall")=>details.reduce((n,d)=>n+(d[key]??0),0);
    const result:AvailabilityResult={check_completion:"complete",collection_context:{state:!snapshot.activeImport?"no_collection":relevantTotal===0?"empty_collection":"ready",collection_import_id:snapshot.activeImport?.id??null,imported_at:snapshot.activeImport?.imported_at??null,effective_policy:policy,policy_status:policy?"confirmed":"unconfirmed"},dependencies:snapshotRevisions(snapshot),summary:{required:sum("quantity"),owned:sum("owned"),eligible:policy?sum("eligible"):null,missing_owned:sum("missing_owned"),policy_shortfall:policy?sum("policy_shortfall"):null,committed:policy?allocations.filter(a=>a.committed).reduce((n,a)=>n+a.allocated_quantity,0):null,sufficient:policy?sum("eligible")===sum("quantity"):null,metadata_uncertain:details.some(d=>d.uncertain_compatible_supply>0||(d.uncertain_policy_supply??0)>0),possession_scope:"recorded_collection_only"},requirements:details,allocations};
    const current=await repository.readCollectionPolicySnapshot();if(current.isErr())return current;
    if(JSON.stringify(snapshotRevisions(current.value))!==JSON.stringify(result.dependencies))return err({type:"validation_error" as const,message:"Collection or reference imports changed during checking. Reconfirm scope and recompute."});
    return ok(result);
}

/** Complete path/value records share the candidate view reconstruction contract. */
export function availabilityRecords(result:AvailabilityResult,pullList=false) {return [{path:["context"],value:{...result,requirements:undefined,allocations:undefined}},{path:["requirements"],value:[]},...result.requirements.map((value,i)=>({path:["requirements",i],value})),{path:["allocations"],value:[]},...result.allocations.map((value,i)=>({path:["allocations",i],value:pullList?{...value,instruction:value.committed?"Borrow permitted Committed copies from the named source deck; user chooses physical copies.":"Pull recorded copies; user chooses physical copies."}:value}))];}
export function availabilityPage(result:AvailabilityResult,args:{first?:number;after?:string},evidence:{status:string;checked_at:string},options:CardLookupOptions={}) {
    const records=availabilityRecords(result),budget=options.responseBudgetBytes??retrievalResponseBudgetBytes,first=args.first??50;
    const baseline=createHash("sha256").update(JSON.stringify(result)).digest("hex");let offset=0;
    const metadata=(count:number)=>({requested_count:first,returned_count:count,response_budget_bytes:budget,provider_total:null,scoped_total:records.length});
    const fail=(error:RetrievalProblem)=>err({type:"retrieval_error" as const,message:error.message,envelope:{status:"error" as const,check_completion:"complete",edges:[],error,metadata:metadata(0)}});
    if(args.after){const decoded=decodeRetrievalCursor(args.after);if(decoded.problem)return fail(decoded.problem);const c=decoded.cursor!;if(c.tool!=="check_collection_availability"||c.source!=="allocation"||!Number.isSafeInteger(c.position)||(c.position as number)<0||(c.position as number)>records.length)return fail({code:"invalid_cursor",message:"Cursor does not match Availability witness traversal.",retryable:false});if(c.revisions.baseline!==baseline)return fail({code:"stale_cursor",message:"Availability requirements, policy, or imports changed; restart and reconfirm scope where required.",retryable:false,recovery:"restart"});offset=c.position as number;}
    const token=(position:number)=>encodeRetrievalCursor({version:1,tool:"check_collection_availability",source:"allocation",bindings:{},revisions:{baseline},position});
    const page=(end:number,stop_reason:"first"|"source_exhausted"|"response_budget")=>({status:"ok" as const,check_completion:"complete" as const,witness_completion:end===records.length&&offset===0?"complete":"partial",summary:result.summary,collection_context:result.collection_context,evidence,edges:records.slice(offset,end).map(node=>({node:{...node,kind:node.path[0]==="allocations"&&node.path.length===2?"allocation":"record",...(node.path[0]==="allocations"&&node.path.length===2?node.value:{})}})),pageInfo:{startCursor:token(offset),endCursor:token(end),hasPreviousPage:offset>0,hasNextPage:end<records.length},stop_reason,metadata:metadata(end-offset)});
    if(compactJsonBytes(page(offset,"first"))>budget)return fail({code:"response_budget_too_small",message:"Mandatory Availability context exceeds the response budget.",retryable:false,limit_bytes:budget});
    let end=offset;while(end<records.length&&end-offset<first){const proposed=page(end+1,end+1===records.length?"source_exhausted":"first");if(compactJsonBytes(proposed)>budget){if(end===offset)return fail({code:"record_too_large",message:"One complete Availability witness record exceeds the response budget.",retryable:false,cursor:token(offset),required_bytes:compactJsonBytes(proposed),limit_bytes:budget});return ok(page(end,"response_budget"));}end++;}return ok(page(end,end===records.length?"source_exhausted":"first"));
}
