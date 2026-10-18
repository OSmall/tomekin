import {z} from "zod";
import {err, ok, type Result} from "neverthrow";
import type {CollectionLocationImportRecord, CollectionRepositoryError} from "./collection-import";
import type {ScryfallBulkDataImport} from "./scryfall-sync";

/** Accept explicit source offsets only, validating the calendar before Date can normalize it. */
export function parseReliableSourceInstant(input: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(input);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, , zone] = m;
    const year = Number(y), month = Number(mo), day = Number(d);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
    if (zone !== "Z" && (Number(zone!.slice(1, 3)) > 23 || Number(zone!.slice(4)) > 59)) return null;
    const date = new Date(input);
    return Number.isFinite(date.getTime()) ? date : null;
}
export const UtcInstantSchema = z.string().refine(value => value.endsWith("Z") && parseReliableSourceInstant(value) !== null, "Expected a valid explicit UTC calendar instant.");
const nonemptyStrings = z.array(z.string().min(1)).min(1);
const ids = z.array(z.uuid()).min(1);
const requirementsShape = {
    finish: z.array(z.enum(["nonfoil", "foil", "etched"])).min(1).optional(),
    condition: nonemptyStrings.optional(), altered: z.boolean().optional(), misprint: z.boolean().optional(),
    date_state: z.enum(["known", "unknown"]).optional(), added_at_from: UtcInstantSchema.optional(), added_at_before: UtcInstantSchema.optional(),
    purchase_price: z.strictObject({currency: z.string().regex(/^[A-Z]{3}$/), min: z.number().finite().min(0).optional(), max: z.number().finite().min(0).optional()}).refine(value => (value.min !== undefined || value.max !== undefined) && (value.min === undefined || value.max === undefined || value.min <= value.max), "Expected a nonempty valid price range.").optional(),
    printing_ids: ids.optional(), set_ids: ids.optional(), set_codes: nonemptyStrings.optional(), languages: nonemptyStrings.optional(),
};
export function validDateRequirements(value: {date_state?: string | undefined; added_at_from?: string | undefined; added_at_before?: string | undefined}): boolean {
    return !(value.date_state === "unknown" && (value.added_at_from || value.added_at_before)) && !(value.added_at_from && value.added_at_before && Date.parse(value.added_at_from) >= Date.parse(value.added_at_before));
}
export const CopyRequirementsSchema = z.strictObject(requirementsShape).refine(validDateRequirements, "Date constraints conflict or the interval is empty.");
export type CopyRequirements = z.infer<typeof CopyRequirementsSchema>;
export const CollectionLocationReferenceSchema = z.union([
    z.strictObject({id: z.uuid(), type: z.enum(["binder", "deck"]), name: z.string().min(1)}),
    z.strictObject({type: z.enum(["binder", "deck"]), name: z.string().min(1)}),
]);
export const CollectionAccessPolicySchema = z.strictObject({
    confirmed: z.literal(true), collection_import_id: z.uuid(),
    allowed_locations: z.array(CollectionLocationReferenceSchema),
    protected_locations: z.array(CollectionLocationReferenceSchema).default([]), excluded_locations: z.array(CollectionLocationReferenceSchema).default([]),
    excluded_oracle_ids: z.array(z.uuid()).default([]), excluded_printing_ids: z.array(z.uuid()).default([]), excluded_collection_card_ids: z.array(z.uuid()).default([]),
    copy_requirements: CopyRequirementsSchema.default({}),
});
export type CollectionAccessPolicy = z.infer<typeof CollectionAccessPolicySchema>;
export const CollectionPolicyInputSchema = z.discriminatedUnion("kind", [
    z.strictObject({kind: z.literal("explicit"), policy: CollectionAccessPolicySchema}),
    z.strictObject({kind: z.literal("candidate"), candidate_id: z.uuid()}),
]);
/** Candidate consumers load permission through the whole Brief so strict intent cannot be dropped. */
export function collectionPolicyFromBrief(brief: {
    collectionAccessPolicy: CollectionAccessPolicy | null;
    recentAdditions: {purpose: "strict_copy_eligibility" | "exploratory_inspiration"; added_at_from?: string | undefined; added_at_before?: string | undefined} | null;
}): Result<CollectionAccessPolicy | null, CollectionPolicyProblem> {
    const policy = brief.collectionAccessPolicy, recent = brief.recentAdditions;
    if (!policy || recent?.purpose !== "strict_copy_eligibility") return ok(policy);
    const requirements = policy.copy_requirements;
    const missingInterval = !recent.added_at_from && !recent.added_at_before;
    const widensStart = recent.added_at_from && (!requirements.added_at_from || Date.parse(requirements.added_at_from) < Date.parse(recent.added_at_from));
    const widensEnd = recent.added_at_before && (!requirements.added_at_before || Date.parse(requirements.added_at_before) > Date.parse(recent.added_at_before));
    if (missingInterval || widensStart || widensEnd || requirements.date_state === "unknown") return err({reason: "invalid_policy", message: "Strict recent-copy intent requires an explicit interval and confirmed copy_requirements date bounds at least as restrictive. Confirm and update the Brief policy before claiming eligibility."});
    return ok(policy);
}
export type CollectionPolicyInput = z.infer<typeof CollectionPolicyInputSchema>;
export type ResolvedCollectionPolicy = Omit<CollectionAccessPolicy, "allowed_locations" | "protected_locations" | "excluded_locations"> & {allowed_locations: CollectionLocationImportRecord[]; protected_locations: CollectionLocationImportRecord[]; excluded_locations: CollectionLocationImportRecord[]};
export type CollectionPolicyProblem = {reason: "collection_import_changed" | "unconfirmed_policy" | "invalid_policy" | "unknown_location" | "conflicting_locations" | "unknown_collection_card"; message: string};
export function resolveCollectionPolicy(policy: CollectionAccessPolicy | null, snapshot: CollectionPolicySnapshot): Result<ResolvedCollectionPolicy, CollectionPolicyProblem> {
    if (!policy) return err({reason: "unconfirmed_policy", message: "Confirm the Collection Access Policy in the Brief or pass an explicit confirmed policy."});
    if (snapshot.activeImport?.id !== policy.collection_import_id) return err({reason: "collection_import_changed", message: "Collection replacement requires scope reconfirmation."});
    const output = {...policy, allowed_locations: [], protected_locations: [], excluded_locations: []} as ResolvedCollectionPolicy;
    const dispositions = new Map<string, string>();
    for (const key of ["allowed_locations", "protected_locations", "excluded_locations"] as const) for (const reference of policy[key]) {
        const found = snapshot.locations.find(location => location.type === reference.type && location.name === reference.name && (!("id" in reference) || location.id === reference.id));
        if (!found) return err({reason: "unknown_location", message: "An exact location reference is absent from the active snapshot."});
        const prior = dispositions.get(found.id);
        if (prior && prior !== key) return err({reason: "conflicting_locations", message: "A location has contradictory policy dispositions."});
        dispositions.set(found.id, key);
        if (!output[key].some(location => location.id === found.id)) output[key].push(found);
    }
    return ok(output);
}
/** Actual row facts used by browse, retrieval evidence and whole-demand allocation. No representative Printing. */
export type OwnedRowFacts = {
    collection_card_id: string; oracle_id: string; printing_id: string; quantity: number;
    location: CollectionLocationImportRecord; added_at: string | null; date_reliability: "source" | "unknown" | "legacy_precision_lost";
    finish: "nonfoil" | "foil" | "etched"; condition: string | null; altered: boolean | null; misprint: boolean | null;
    purchase_price: number | null; purchase_price_currency: string | null; source_row_number: number;
    set: string; set_id: string; set_name: string; set_type: string; lang: string; collector_number: string;
    printed_name: string | null; printing_layout: string; finishes: string[]; promo_types: string[]; tcgplayer_id: number | null; cardmarket_id: number | null;
};
export type RowPolicyEvaluation = {decision: "eligible" | "excluded" | "uncertain"; committed: boolean; reasons: string[]; uncertain_fields: string[]; proof_fields: string[]};
/** A known failure defeats a conjunction even when other requested facts are unknown. */
export function evaluateCopyRequirements(requirements: CopyRequirements, row: OwnedRowFacts): Pick<RowPolicyEvaluation, "decision" | "reasons" | "uncertain_fields" | "proof_fields"> {
    const reasons: string[] = [], uncertain_fields: string[] = [], proof_fields: string[] = [];
    const test = (field: string, value: unknown, passes: (value: never) => boolean) => {
        proof_fields.push(field);
        if (value === null || value === undefined) {uncertain_fields.push(field); return;}
        if (!passes(value as never)) reasons.push(`requirement:${field}`);
    };
    for (const field of ["finish", "condition"] as const) if (requirements[field]) test(field, row[field], value => requirements[field]!.includes(value));
    for (const field of ["altered", "misprint"] as const) if (requirements[field] !== undefined) test(field, row[field], value => value === requirements[field]);
    if (requirements.date_state) {proof_fields.push("added_at"); if (requirements.date_state === "known" && row.added_at === null) uncertain_fields.push("added_at"); else if (requirements.date_state === "unknown" && row.added_at !== null) reasons.push("requirement:date_state");}
    if (requirements.added_at_from) test("added_at", row.added_at, value => Date.parse(value) >= Date.parse(requirements.added_at_from!));
    if (requirements.added_at_before) test("added_at", row.added_at, value => Date.parse(value) < Date.parse(requirements.added_at_before!));
    const price = requirements.purchase_price;
    if (price) {
        test("purchase_price_currency", row.purchase_price_currency, value => value === price.currency);
        test("purchase_price", row.purchase_price, value => (price.min === undefined || value >= price.min) && (price.max === undefined || value <= price.max));
    }
    const membership = {printing_ids: "printing_id", set_ids: "set_id", set_codes: "set", languages: "lang"} as const;
    for (const [key, field] of Object.entries(membership) as [keyof typeof membership, typeof membership[keyof typeof membership]][]) if (requirements[key]) test(field, row[field], value => requirements[key]!.includes(value));
    return {decision: reasons.length ? "excluded" : uncertain_fields.length ? "uncertain" : "eligible", reasons, uncertain_fields: [...new Set(uncertain_fields)], proof_fields: [...new Set(proof_fields)]};
}
export function evaluateOwnedRow(policy: ResolvedCollectionPolicy, row: OwnedRowFacts): RowPolicyEvaluation {
    const result = evaluateCopyRequirements(policy.copy_requirements, row);
    const reasons = [...result.reasons];
    if (!policy.allowed_locations.some(location => location.id === row.location.id)) reasons.push(row.location.type === "deck" ? "protected_committed_location" : "outside_allowed_locations");
    if (policy.protected_locations.some(location => location.id === row.location.id)) reasons.push("protected_location");
    if (policy.excluded_locations.some(location => location.id === row.location.id)) reasons.push("excluded_location");
    if (policy.excluded_oracle_ids.includes(row.oracle_id)) reasons.push("excluded_oracle_id");
    if (policy.excluded_printing_ids.includes(row.printing_id)) reasons.push("excluded_printing_id");
    if (policy.excluded_collection_card_ids.includes(row.collection_card_id)) reasons.push("excluded_collection_card_id");
    return {...result, reasons, decision: reasons.length ? "excluded" : result.decision, committed: row.location.type === "deck"};
}
export type CollectionPolicySnapshot = {activeImport: {id: string; imported_at: string} | null; legacySnapshot: boolean; locations: readonly CollectionLocationImportRecord[]; referenceImports: readonly ScryfallBulkDataImport[]};
export type CollectionRowOrder = "source_order" | "added_at_asc" | "added_at_desc";
export type CollectionBrowseRepository = {
    readCollectionPolicySnapshot(): Promise<Result<CollectionPolicySnapshot, CollectionRepositoryError>>;
    readOwnedRows(input: {offset: number; first: number; order: CollectionRowOrder; oracle_ids?: string[] | undefined; printing_ids?: string[] | undefined}): Promise<Result<readonly OwnedRowFacts[], CollectionRepositoryError>>;
    collectionCardIdsExist(ids: readonly string[]): Promise<Result<boolean, CollectionRepositoryError>>;
};
