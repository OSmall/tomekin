import {z} from "zod";
import {DeckBuildingBriefSchema, type DeckBuildingBrief} from "./deck-building-brief";
import {DeckCandidateCardSectionSchema, DeckCandidateChangesSchema, type DeckCandidateState, type DeckCandidateRepositoryError} from "./deck-candidate";
import type {DeckLegalityCard} from "./format-legality";
import type {ReferenceDataStatus} from "./card-reference-queries";
import type {ScryfallBulkDataImport} from "./scryfall-sync";
import {requiredScryfallImportContractRevisions} from "./scryfall-sync";
import type {Result} from "neverthrow";

export const InitialDeckCheckSchema = z.strictObject({
    cards: z.array(z.strictObject({cardIdentityId:z.uuid(),quantity:z.number().int().positive(),section:DeckCandidateCardSectionSchema})),
    brief: DeckBuildingBriefSchema,
});
export const SavedDeckCheckSchema = z.strictObject({
    candidate_id:z.uuid(), expected_updated_at:z.iso.datetime({precision:3}), changes:DeckCandidateChangesSchema.optional(),
});
export const DeckCheckInputSchema = z.union([SavedDeckCheckSchema, InitialDeckCheckSchema]);
/** OpenCode accepts a property shape; the handler enforces the closed union. */
export const DeckCheckArgsSchema = z.strictObject({
    candidate_id:SavedDeckCheckSchema.shape.candidate_id.optional(),
    expected_updated_at:SavedDeckCheckSchema.shape.expected_updated_at.optional(),
    changes:SavedDeckCheckSchema.shape.changes,
    cards:InitialDeckCheckSchema.shape.cards.optional(),
    brief:InitialDeckCheckSchema.shape.brief.optional(),
});
export type DeckCheckInput = z.infer<typeof DeckCheckInputSchema>;
export type DeckCheckName = "format_legality" | "deck_evaluation" | "collection_availability";
/** Advance the owning version whenever its deterministic computation changes. */
export const deckCheckVersions = {format_legality:"1", deck_evaluation:"1", collection_availability:"1"} as const;
export type DeckCheckVersions = Record<DeckCheckName,string>;
export type DeckCheckDependencies = {
    selected_changed_at:string;
    brief_changed_at:string;
    brief_inputs:unknown;
    reference_imports:readonly {id:string; completed_at:string; source_updated_at:string|null; import_contract_revision:number}[];
    reference_contract_revision:number;
    validator_versions:Partial<DeckCheckVersions>;
    collection_snapshot?:string|null;
    availability_requirements?:readonly import("./collection-availability").AvailabilityDemand[];
};
export type RecordedDeckCheck = {checked_at:string; dependencies:DeckCheckDependencies; result:unknown};
export type CheckExecutionEvidence = {status:"transient"|"applicable"|"outdated";checked_at:string};
export type DeckCheckEvidence = {status:"absent"} | (RecordedDeckCheck & {status:"applicable"|"outdated"});
export type CandidateValidationEvidence = {status:"absent"|"applicable"|"outdated"; checks?:Record<DeckCheckName,DeckCheckEvidence>};
export type CandidateValidationSummary = {status:CandidateValidationEvidence["status"];checks?:Record<DeckCheckName,{status:DeckCheckEvidence["status"];checked_at?:string}>};
export type CapturedDeckCheck = {
    brief:DeckBuildingBrief;
    cards:readonly DeckLegalityCard[];
    reference:ReferenceDataStatus;
    checked_at:string;
    candidate_id?:string;
    trial:boolean;
    dependencies?:DeckCheckDependencies;
};
export type DeckCheckRepository = {
    captureDeckCheck(input:DeckCheckInput,check:DeckCheckName):Promise<Result<CapturedDeckCheck,DeckCandidateRepositoryError>>;
    publishDeckCheck(candidateId:string,check:DeckCheckName,evidence:RecordedDeckCheck):Promise<Result<"applicable"|"outdated",DeckCandidateRepositoryError>>;
};

export function checkDependencies(candidate:DeckCandidateState, check:DeckCheckName, imports:readonly ScryfallBulkDataImport[], versions:DeckCheckVersions=deckCheckVersions, collectionSnapshot?:string|null, requirements?:readonly import("./collection-availability").AvailabilityDemand[]):DeckCheckDependencies {
    const oracle = imports.filter(i=>i.bulkDataType==="oracle_cards"&&i.status==="succeeded")
        .sort((a,b)=>(b.completedAt??b.startedAt).getTime()-(a.completedAt??a.startedAt).getTime())[0];
    const brief=candidate.brief;
    return {
        selected_changed_at:candidate.selectedChangedAt,
        brief_changed_at:candidate.briefChangedAt,
        brief_inputs:check==="collection_availability" ? {collectionAccessPolicy:brief.collectionAccessPolicy,recentAdditions:brief.recentAdditions} : check==="format_legality" ? {format:brief.format,...(brief.format==="commander"?{ruleZeroExceptions:brief.ruleZeroExceptions}:{})} : {format:brief.format,...(brief.format==="commander"?{ruleZeroExceptions:brief.ruleZeroExceptions,commanderBracket:brief.commanderBracket}:{powerLevel:brief.powerLevel}),playExperience:brief.playExperience},
        reference_imports:check==="collection_availability" ? imports.filter(i=>["oracle_cards","all_cards"].includes(i.bulkDataType)&&i.status==="succeeded").sort((a,b)=>a.bulkDataType.localeCompare(b.bulkDataType)||(b.completedAt??b.startedAt).getTime()-(a.completedAt??a.startedAt).getTime()).filter((i,n,all)=>all.findIndex(j=>j.bulkDataType===i.bulkDataType)===n).map(i=>({id:i.id,completed_at:(i.completedAt??i.startedAt).toISOString(),source_updated_at:i.sourceUpdatedAt?.toISOString()??null,import_contract_revision:i.importContractRevision})) : oracle?[{id:oracle.id,completed_at:(oracle.completedAt??oracle.startedAt).toISOString(),source_updated_at:oracle.sourceUpdatedAt?.toISOString()??null,import_contract_revision:oracle.importContractRevision}]:[],
        reference_contract_revision:requiredScryfallImportContractRevisions.oracle_cards,
        ...(check==="collection_availability"?{collection_snapshot:collectionSnapshot??null,...requirements?{availability_requirements:requirements}:{}}:{}),
        validator_versions:check==="collection_availability" ? {collection_availability:versions.collection_availability} : check==="format_legality"?{format_legality:versions.format_legality}:{format_legality:versions.format_legality,deck_evaluation:versions.deck_evaluation},
    };
}
export function matchingCheckDependencies(a:DeckCheckDependencies,b:DeckCheckDependencies):boolean {
    // A Brief edit unrelated to this check does not invalidate its captured facts.
    const {brief_changed_at:_a,...left}=a, {brief_changed_at:_b,...right}=b;
    const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value!==null&&typeof value==="object"?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
    return JSON.stringify(canonical(left))===JSON.stringify(canonical(right));
}
export function candidateValidationEvidence(candidate:DeckCandidateState, records:Partial<Record<DeckCheckName,RecordedDeckCheck>>, imports:readonly ScryfallBulkDataImport[], versions:DeckCheckVersions=deckCheckVersions, collectionSnapshot?:string|null):CandidateValidationEvidence {
    const evidence=(check:DeckCheckName):DeckCheckEvidence=>records[check] ? {...records[check],status:matchingCheckDependencies(records[check].dependencies,checkDependencies(candidate,check,imports,versions,collectionSnapshot,records[check]?.dependencies.availability_requirements))?"applicable":"outdated"}:{status:"absent"};
    const checks={format_legality:evidence("format_legality"),deck_evaluation:evidence("deck_evaluation"),collection_availability:evidence("collection_availability")};
    const statuses=Object.values(checks).map(e=>e.status);
    return {status:statuses.every(s=>s==="absent")?"absent":statuses.includes("outdated")?"outdated":"applicable",checks};
}
