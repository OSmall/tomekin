import {createHash} from "node:crypto";
import {deflateRawSync, inflateRawSync} from "node:zlib";
import type {CollectionContext} from "./collection-browse";
import {z} from "zod";
import {collectionRetrievalShape, type CollectionEvidence, type CollectionRetrievalContext} from "./collection-retrieval";
import type {CardIdentity, CardIdentityPart, CardIdentityTaggingWeight, CardPrinting, CardSet, ScryfallBulkDataImport} from "./scryfall-sync";
import type {CardIdentityDetail, CardReferenceRepositoryError} from "./card-reference-queries";
import type {Result} from "neverthrow";

/** Shared card projection contract. Every selector requests the complete supported fact. */
export const cardFactDescriptions = {
    oracle_id: "Canonical Oracle identity; always returned.", printing_id: "Exact Printing identifier; always returned for exact Printing references.",
    name: "Canonical whole identity name.", layout: "Canonical gameplay layout.", mana_cost: "Complete mana cost or null.", mana_value: "Numeric mana value.",
    type_line: "Complete type line.", oracle_text: "Complete top-level Oracle text, including null, plus existing ordered face names and text.",
    colors: "Colors as an array; null means absent, [] means known colorless.", color_identity: "Color Identity as a WUBRG array.", color_indicator: "Color indicator array or null.",
    produced_mana: "Supported produced mana symbols in stored order, or null.", keywords: "Complete keyword list.", power: "Power string or null.", toughness: "Toughness string or null.",
    loyalty: "Loyalty string or null.", defense: "Defense string or null.", legalities: "Complete imported format-legality map.", game_changer: "Source Game Changer flag.", edhrec_rank: "Source rank or null.",
    card_faces: "All existing ordered faces with name, mana_cost, type_line, oracle_text, colors, color_indicator, power, toughness, loyalty and defense; [] if none.",
    tags: "Complete direct tags (slug, prominence weight, nullable annotation) and reachable inherited tags (slug, strongest supporting weight), deduplicated with direct preference.",
    set: "Exact Printing Set code.", set_id: "Exact Printing Set UUID.", set_name: "Exact Printing Set name.", set_type: "Exact Printing Set type.",
    collector_number: "Exact Printing collector number, preserved as a string.", lang: "Exact Printing language.", printed_name: "Actual printed name or null; no canonical substitution.",
    finishes: "All supported Printing finishes, not owned-copy finish.", promo_types: "All Printing promo types.", tcgplayer_id: "Printing TCGplayer ID or null.", cardmarket_id: "Printing Cardmarket ID or null.", printing_layout: "Printing presentation: standard or reversible_card.",
} as const;
export type CardFact = keyof typeof cardFactDescriptions;
export const printingFacts = new Set<CardFact>(["printing_id", "set", "set_id", "set_name", "set_type", "collector_number", "lang", "printed_name", "finishes", "promo_types", "tcgplayer_id", "cardmarket_id", "printing_layout"]);
const selectionShape = Object.fromEntries(Object.entries(cardFactDescriptions).map(([name, description]) => [name, z.literal(true).describe(description).optional()])) as {[K in CardFact]: z.ZodOptional<z.ZodLiteral<true>>};
export const CardSelectionSchema = z.strictObject({...selectionShape, tags: z.union([z.literal(true), z.strictObject({mode:z.literal("compact"),slugs:z.array(z.string().min(1)).min(1).optional()})]).describe("true: complete annotations; compact: direct/inherited slugs and prominence, optionally restricted to named slugs.").optional()}).refine((value) => Object.keys(value).length > 0, "Select at least one fact.").meta({minProperties: 1});
export type CardSelection = z.infer<typeof CardSelectionSchema>;
export const CardReferenceSchema = z.discriminatedUnion("kind", [
    z.strictObject({kind: z.literal("oracle_id"), value: z.uuid()}),
    z.strictObject({kind: z.literal("name"), value: z.string().min(1)}),
    z.strictObject({kind: z.literal("printing_id"), value: z.uuid()}),
]);
export type CardReference = z.infer<typeof CardReferenceSchema>;
export const LookupCardsArgsSchema = z.strictObject({
    references: z.array(CardReferenceSchema).min(1), select: CardSelectionSchema, ...collectionRetrievalShape,
    first: z.number().int().min(0).max(200).optional(), after: z.string().min(1).optional(), include_provenance: z.boolean().optional(),
});
export type LookupCardsArgs = z.infer<typeof LookupCardsArgsSchema>;
export type CardResult = {card: {oracle_id: string; printing_id?: string} & Record<string, unknown>; unavailable_fields?: Record<string, string>; collection_evidence?: CollectionEvidence};
export type LookupOutcome = ({status: "found"} & CardResult) | {status: "not_found"; reference: CardReference};
export type RetrievalMetadata = {requested_count: number; returned_count: number; response_budget_bytes: number; provider_total: number | null; scoped_total: number | null; lookup?: {input_count: number; start_index: number; next_index: number}};
export type RetrievalErrorCode = "invalid_request" | "invalid_cursor" | "stale_cursor" | "cursor_anchor_not_found" | "reference_data_unready" | "provider_error" | "unsupported_source_record" | "local_error" | "rate_limited" | "scan_timeout" | "cancelled" | "record_too_large" | "cursor_too_large" | "response_budget_too_small";
export type RetrievalIssue = {path: (string | number)[]; code: string; field?: string; reference_indices?: number[]};
export type RetrievalProblem = {code: RetrievalErrorCode; message: string; retryable: boolean; cursor?: string; retry_after_ms?: number; issues?: RetrievalIssue[]; missing_datasets?: string[]; reimport_required_datasets?: string[]; reason?: string; required_bytes?: number; limit_bytes?: number; recovery?: "restart" | "reconfirm_scope"};
export type RetrievalProvenance = {collection_import?: {import_id: string; imported_at: string}; provider?: {name: string; retrieved_at: string}; reference_imports: {dataset: string; import_id: string; completed_at: string | null; source_updated_at: string | null}[]};
/**
 * Agent-efficient continuation envelope with opaque first/after pagination.
 * One continuation is returned while more results remain; exhaustion returns null.
 * Relay does not prescribe the internal cursor encoding.
 * @see https://relay.dev/graphql/connections.htm
 * @see https://github.com/OSmall/tomekin/issues/29#issuecomment-6230187644
 */
export type RetrievalSuccess<N> = {status: "ok"; edges: {node: N}[]; next_cursor: string | null; stop_reason: "first" | "response_budget" | "source_exhausted"; metadata: RetrievalMetadata; provenance?: RetrievalProvenance; collection_context?: CollectionRetrievalContext | CollectionContext};
export type RetrievalFailure<N> = {status: "error"; edges: {node: N}[]; error: RetrievalProblem; metadata: RetrievalMetadata; provenance?: RetrievalProvenance; collection_context?: CollectionRetrievalContext | CollectionContext};
export type RetrievalEnvelope<N> = RetrievalSuccess<N> | RetrievalFailure<N>;
/** Expected failures stay on Result's error side; adapters expose the envelope intact. */
export type RetrievalToolError<N> = {type: "retrieval_error"; message: string; envelope: RetrievalFailure<N>};
export const retrievalResponseBudgetBytes = 51_200;
export const retrievalScanDeadlineMs = 120_000;
export const compactJsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** Internal cursor context. Wire tokens retain fingerprints, never the supplied bindings. */
export type RetrievalCursor = {version: 2; tool: string; source: string; bindings: unknown; scope?: string | null; revisions: Record<string, string | null>; position: unknown};
const cursorTools = ["search_cards", "lookup_cards", "browse_tags", "browse_collection_cards", "get_deck_candidate", "check_collection_availability"] as const;
const revisionKeys = ["oracle_cards", "all_cards", "oracle_tags", "collection", "collection_policy", "policy", "baseline"] as const;
const digestSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
const wireCursorSchema = z.tuple([
    z.number().int().min(0).max(cursorTools.length - 1), z.string().min(1).max(128), digestSchema, digestSchema.nullable(),
    z.array(z.tuple([z.number().int().min(0).max(revisionKeys.length - 1), z.string().max(128).nullable()])).max(revisionKeys.length), z.unknown(),
]);
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b, "en")).map(([k,v]) => [k,canonical(v)]));
    return value;
}
/** A bounded consistency check, not an authorization credential or a saved-result key. */
export const cursorFingerprint = (value: unknown): string => createHash("sha256").update(JSON.stringify(canonical(value))).digest().subarray(0,16).toString("base64url");
function scopeOf(bindings: unknown) {
    return Object.fromEntries(Object.entries((bindings ?? {}) as Record<string,unknown>).filter(([k]) => ["collection_scope", "collection_policy", "collection_evidence"].includes(k)));
}
export const cursorBindingsMatch = (cursor: RetrievalCursor, bindings: unknown): boolean => cursor.bindings === cursorFingerprint(bindings);
export const cursorScopeMatches = (cursor: RetrievalCursor, bindings: unknown): boolean => cursor.scope === (Object.keys(scopeOf(bindings)).length ? cursorFingerprint(scopeOf(bindings)) : null);
/** Version 2: deflated positional JSON. Offline token comparisons are recorded by evaluate:economy. */
export function encodeRetrievalCursor(cursor: RetrievalCursor): string {
    const tool = cursorTools.indexOf(cursor.tool as typeof cursorTools[number]);
    const revisions = Object.entries(cursor.revisions).sort(([a],[b]) => revisionKeys.indexOf(a as any)-revisionKeys.indexOf(b as any)).map(([k,v]) => {
        const key = revisionKeys.indexOf(k as typeof revisionKeys[number]);
        if (key < 0) throw new Error("Unknown cursor dependency.");
        return [key,v];
    });
    const scope = scopeOf(cursor.bindings);
    const wire = [tool,cursor.source,cursorFingerprint(cursor.bindings),Object.keys(scope).length ? cursorFingerprint(scope) : null,revisions,cursor.position];
    return `2.${deflateRawSync(JSON.stringify(wire)).toString("base64url")}`;
}
export function decodeRetrievalCursor(token: string): {cursor?: RetrievalCursor; problem?: RetrievalProblem} {
    try {
        if (!token.startsWith("2.")) {
            try {const legacy = JSON.parse(Buffer.from(token,"base64url").toString("utf8")); if (Number.isInteger(legacy.version)) return {problem:{code:"invalid_cursor",message:"Cursor format changed. Restart without after.",retryable:false,reason:"unsupported_version",recovery:"restart"}};} catch {}
            throw new Error("encoding");
        }
        const encoded = token.slice(2);
        if (encoded.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("encoding");
        const bytes = Buffer.from(encoded,"base64url");
        if (bytes.toString("base64url") !== encoded) throw new Error("encoding");
        const raw = JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(inflateRawSync(bytes,{maxOutputLength:4096})));
        const parsed = wireCursorSchema.safeParse(raw);
        if (!parsed.success) throw new Error("shape");
        const [tool,source,bindings,scope,entries,position] = parsed.data;
        if (new Set(entries.map(([k])=>k)).size !== entries.length) throw new Error("duplicate dependency");
        const revisions = Object.fromEntries(entries.map(([k,v])=>[revisionKeys[k]!,v]));
        return {cursor:{version:2,tool:cursorTools[tool]!,source,bindings,scope,revisions,position}};
    } catch {return {problem:{code:"invalid_cursor",message:"Malformed continuation cursor. Restart without after.",retryable:false,reason:"malformed",recovery:"restart"}};}
}
export type CardTags = {direct: {slug: string; weight: CardIdentityTaggingWeight; annotation: string | null}[]; inherited: {slug: string; weight: CardIdentityTaggingWeight}[]};
export function projectCardTags(tags: CardTags, selection: CardSelection["tags"]) {
    if (selection === true) return tags;
    const wanted = selection?.slugs ? new Set(selection.slugs) : null;
    const selected = (tag: {slug:string}) => !wanted || wanted.has(tag.slug);
    return {direct:tags.direct.filter(selected).map(({slug,weight})=>({slug,weight})), inherited:tags.inherited.filter(selected).map(({slug,weight})=>({slug,weight}))};
}
export type LocalLookupRecord = {detail: CardIdentityDetail; printing?: CardPrinting; set?: CardSet; promoTypes?: string[]; tags?: CardTags};
/** Import records are newest committed insertion first; wall-clock timestamps do not establish replacement authority. */
export type CardLookupSnapshot = {imports: readonly ScryfallBulkDataImport[]; records: readonly (LocalLookupRecord | null)[]};
export type CardLookupRepository = {readSnapshot(references: readonly CardReference[], includeTags: boolean): Promise<Result<CardLookupSnapshot, CardReferenceRepositoryError>>};

const identityFields = {name: "name", layout: "layout", mana_cost: "manaCost", mana_value: "manaValue", type_line: "typeLine", oracle_text: "oracleText", keywords: "keywords", power: "power", toughness: "toughness", loyalty: "loyalty", defense: "defense", legalities: "legalities", game_changer: "gameChanger", edhrec_rank: "edhrecRank"} as const;
const colorArray = (value: string | null) => value === null ? null : [...value];
export function projectLocalCard(record: LocalLookupRecord, select: CardSelection, tagUnavailable?: string): CardResult {
    const {identity, parts, legalities} = record.detail;
    const card: CardResult["card"] = {oracle_id: identity.id, ...(record.printing ? {printing_id: record.printing.id} : {})};
    for (const field of Object.keys(select) as CardFact[]) {
        if (field in identityFields && field !== "legalities") (card as Record<string, unknown>)[field] = identity[identityFields[field as keyof typeof identityFields] as keyof CardIdentity];
        if (field === "legalities") card.legalities = Object.fromEntries(legalities.map((row) => [row.format, row.legality]));
        if (field === "colors") card.colors = colorArray(identity.colors);
        if (field === "color_identity") card.color_identity = colorArray(identity.colorIdentity);
        if (field === "color_indicator") card.color_indicator = colorArray(identity.colorIndicator);
        if (field === "produced_mana") card.produced_mana = colorArray(identity.producedMana);
    }
    if (select.card_faces || (select.oracle_text && parts.length > 0)) card.card_faces = [...parts].sort((a, b) => a.partIndex - b.partIndex).map((part) => projectFace(part, !!select.card_faces));
    if (select.tags && !tagUnavailable) card.tags = projectCardTags(record.tags ?? {direct: [], inherited: []}, select.tags);
    if (record.printing && record.set) {
        const p = record.printing, s = record.set;
        const facts = {printing_id: p.id, set: s.code, set_id: s.id, set_name: s.name, set_type: s.setType, collector_number: p.collectorNumber, lang: p.language, printed_name: p.printedName, finishes: p.finishes, promo_types: record.promoTypes ?? [], tcgplayer_id: p.tcgplayerId, cardmarket_id: p.cardmarketId, printing_layout: p.layout};
        for (const [field, value] of Object.entries(facts)) if (select[field as CardFact]) card[field] = value;
    }
    return {card, ...(select.tags && tagUnavailable ? {unavailable_fields: {tags: tagUnavailable}} : {})};
}
function projectFace(part: CardIdentityPart, full: boolean) {
    const narrow = {name: part.name, oracle_text: part.oracleText};
    return full ? {...narrow, mana_cost: part.manaCost, type_line: part.typeLine, colors: colorArray(part.colors), color_indicator: colorArray(part.colorIndicator), power: part.power, toughness: part.toughness, loyalty: part.loyalty, defense: part.defense} : narrow;
}
