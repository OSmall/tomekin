import {lookupCards, type CardLookupOptions} from "./card-lookup";
import {LookupCardsArgsSchema, type CardLookupRepository} from "./card-retrieval";
import {calculateHypergeometric, HypergeometricCalculatorArgsSchema, HypergeometricCalculatorRequestSchema} from "./hypergeometric-calculator";
import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {DeckBuildingBriefSchema, DeckFormatSchema, draftDeckBuildingBrief} from "./deck-building-brief";
import {CardQueryInputSchema, type CardQueryRepository, parseCardQueryInput} from "./card-query";
import {type CardReferenceRepository, getFormatConstraints, type ReferenceDataStatus} from "./card-reference-queries";
import type {CollectionQueryRepository} from "./collection-import";
import {
    DeckCandidateCardSectionSchema,
    type DeckCandidateRepository,
    CreateDeckCandidateInputSchema, EditDeckCandidateInputSchema, summarizeDeckCandidate
} from "./deck-candidate";
import {GetDeckCandidateViewArgsSchema, readCandidateView} from "./deck-candidate-views";
import {assessDeckLegality} from "./format-legality";
import {DeckCheckInputSchema, DeckCheckArgsSchema, type CapturedDeckCheck, type DeckCheckName} from "./deck-checks";
import type {ScryfallBulkDataImport, ScryfallBulkDataType} from "./scryfall-sync";

export const AgentToolNameSchema = z.enum([
  "draft_deck_building_brief",
  "query_cards",
  "lookup_cards",
  "hypergeometric_calculator",
  "get_card_identity",
  "search_card_identity_tags",
  "search_card_sets",
  "summarize_reference_support",
  "get_format_constraints",
  "resolve_decklist_cards",
  "validate_format_legality",
  "evaluate_deck_candidate",
  "render_deck_candidate",
  "create_deck_candidate",
  "edit_deck_candidate",
  "get_deck_candidate",
  "list_deck_candidates",
  "list_collection_locations",
]);
export type AgentToolName = z.infer<typeof AgentToolNameSchema>;

export const GetCardIdentityArgsSchema = z.object({idOrName: z.string().min(1)});
export const SearchCardIdentityTagsArgsSchema = z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()});
export const SearchCardSetsArgsSchema = z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()});
export const ResolveDecklistCardsArgsSchema = z.object({names: z.array(z.string().min(1)).min(1)});
export const ValidateDeckCandidateArgsSchema = DeckCheckInputSchema;
export const RenderDeckCandidateArgsSchema = z.strictObject({
    candidate_id:z.uuid(), output:z.enum(["report","portable_decklist"]).default("report"),
    first:z.number().int().min(0).max(200).optional(), after:z.string().min(1).optional(),
});
export const CreateDeckCandidateArgsSchema = CreateDeckCandidateInputSchema;
export const EditDeckCandidateArgsSchema = EditDeckCandidateInputSchema;
export const GetDeckCandidateArgsSchema = GetDeckCandidateViewArgsSchema;
export const GetFormatConstraintsArgsSchema = z.object({format: DeckFormatSchema}).strict();
export const EmptyAgentToolArgsSchema = z.strictObject({});

export const agentToolContracts = {
    lookup_cards: {description: "Retrieve known cards locally by exact Oracle ID, canonical whole name or Printing ID. Select explicit complete facts; preserves ordered misses and duplicates. Repeat fixed references and provenance with first/after to recover. No provider fallback or ownership claim.", inputSchema: LookupCardsArgsSchema},
    hypergeometric_calculator: {description: "Calculate a uniform sample without replacement probability (exactly, at_least, at_most, between) or the minimum population qualifying count for an at_least event and explicit decimal-string target. Population at most 1000. Counts are copies in the modeled population. No mulligans, selection sequences, castability or win-rate inference; reads and writes no records.", inputSchema: HypergeometricCalculatorArgsSchema},
    draft_deck_building_brief: {description: "Normalize a proposed Format-specific Deck Building Brief and return assumptions requiring user confirmation.", inputSchema: DeckBuildingBriefSchema},
    query_cards: {description: "Run a structured local Card Query. Load the query-cards skill before non-trivial filters.", inputSchema: CardQueryInputSchema},
    get_card_identity: {description: "Get one local Card Identity by ID or name.", inputSchema: GetCardIdentityArgsSchema},
    search_card_identity_tags: {description: "Search local Card Identity Tags by slug, label, or alias.", inputSchema: SearchCardIdentityTagsArgsSchema},
    search_card_sets: {description: "Search local Card Sets by code or name.", inputSchema: SearchCardSetsArgsSchema},
    summarize_reference_support: {description: "Report local reference-data readiness.", inputSchema: EmptyAgentToolArgsSchema},
    get_format_constraints: {description: "Return deterministic construction constraints for a Deck Format.", inputSchema: GetFormatConstraintsArgsSchema},
    resolve_decklist_cards: {description: "Resolve proposed card names to local Card Identities.", inputSchema: ResolveDecklistCardsArgsSchema},
    validate_format_legality: {description: "Explicitly check Format legality using candidate_id and expected_updated_at, with optional transient changes, or initial cards and Brief. Saved checks conditionally publish latest reusable evidence; trials remain transient.", inputSchema: DeckCheckArgsSchema},
    evaluate_deck_candidate: {description: "Explicitly evaluate legality, power context, mana curve and land count from saved candidate_id/expected_updated_at or initial cards/Brief. Optional changes are a transient trial. Saved evidence publishes only for matching inputs. Collection Availability is separate.", inputSchema: DeckCheckArgsSchema},
    render_deck_candidate: {description: "Generate a saved candidate report or selected-only canonical Portable Decklist. Returns complete ordered path/value records; repeat candidate_id/output with first/after. No editable report input and no implicit checks.", inputSchema: RenderDeckCandidateArgsSchema},
    create_deck_candidate: {description: "Persist provisional or selected structured construction progress. Server assigns IDs; no implicit validation. Inspect list/get before retrying an uncertain create.", inputSchema: CreateDeckCandidateArgsSchema},
    edit_deck_candidate: {description: "Atomically apply targeted changes with the last-read exact updated_at. Omitted fields survive; quantities are absolute. Reload after conflicts or uncertain outcomes. No implicit deck check.", inputSchema: EditDeckCandidateArgsSchema},
    get_deck_candidate: {description: "Read a compact saved candidate summary by default. Explicit brief/selected/options/pool/plan/assessments/json/report/portable_decklist views return complete path/value records with first/after continuation bound to the baseline. Repeat id/view; apply records in order; concatenate report/decklist string values. Pool groups roles and deduplicates options. No implicit checks.", inputSchema: GetDeckCandidateArgsSchema},
    list_deck_candidates: {description: "List saved Deck Candidates.", inputSchema: EmptyAgentToolArgsSchema},
    list_collection_locations: {description: "List imported Collection Locations.", inputSchema: EmptyAgentToolArgsSchema},
} as const;

export function agentToolInputJsonSchema(name: AgentToolName): Record<string, unknown> {
    return z.toJSONSchema(name === "hypergeometric_calculator" ? HypergeometricCalculatorRequestSchema : name === "validate_format_legality" || name === "evaluate_deck_candidate" ? DeckCheckInputSchema : agentToolContracts[name].inputSchema, {unrepresentable: "any"}) as Record<string, unknown>;
}
export type AgentToolRepositories = {
  readonly cardLookup?: CardLookupRepository;
  readonly cardReference: CardReferenceRepository;
  readonly cardQuery: CardQueryRepository;
  readonly deckCandidates: DeckCandidateRepository;
  readonly collection: CollectionQueryRepository;
};

export type AgentToolError =
    | { readonly type: "validation_error" | "tool_error" | "target_unattainable"; readonly message: string }
    | {
    readonly type: "reference_data_unready";
    readonly message: string;
    readonly missingBulkDataTypes: readonly ScryfallBulkDataType[];
    readonly reimportRequiredBulkDataTypes: readonly ScryfallBulkDataType[];
};

export function createAgentToolHandlers(repositories: AgentToolRepositories, options: {lookup?: CardLookupOptions} = {}) {
  return {
      lookupCards(input: unknown, signal?: AbortSignal) {
          if (!repositories.cardLookup) throw new Error("Card lookup repository is unavailable.");
          return lookupCards(repositories.cardLookup, input, options.lookup, signal);
      },
      hypergeometricCalculator: calculateHypergeometric,
      async queryCards(input: unknown) {
      const parsed = parseCardQueryInput(input);
          if (parsed.isErr()) return parsed;
          const ready = await requireReferenceData(repositories.cardReference);
          if (ready.isErr()) return ready;
      return repositories.cardQuery.queryCards(parsed.value);
    },
    draftDeckBuildingBrief(input: unknown) {
        return safeSync(() => draftDeckBuildingBrief(DeckBuildingBriefSchema.parse(input)));
    },
      async getCardIdentity(input: unknown) {
      const args = GetCardIdentityArgsSchema.parse(input);
          const ready = await requireReferenceData(repositories.cardReference);
          if (ready.isErr()) return ready;
      return repositories.cardReference.getCardIdentity(args.idOrName);
    },
      async searchCardIdentityTags(input: unknown) {
          const args = SearchCardIdentityTagsArgsSchema.parse(input);
          const ready = await requireReferenceData(repositories.cardReference);
          if (ready.isErr()) return ready;
          return repositories.cardReference.searchCardIdentityTags(args);
      },
      async searchCardSets(input: unknown) {
          const args = SearchCardSetsArgsSchema.parse(input);
          const ready = await requireReferenceData(repositories.cardReference);
          if (ready.isErr()) return ready;
          return repositories.cardReference.searchCardSets(args);
      },
    summarizeReferenceSupport() {
      return repositories.cardReference.summarizeReferenceSupport();
    },
    getFormatConstraints(input: unknown) {
        const format = GetFormatConstraintsArgsSchema.parse(input ?? {}).format;
      return Promise.resolve(getFormatConstraints(format));
    },
    async resolveDecklistCards(input: unknown) {
      const args = ResolveDecklistCardsArgsSchema.parse(input);
        const ready = await requireReferenceData(repositories.cardReference);
        if (ready.isErr()) return ready;
      const resolved = [];
      const unresolved = [];
      for (const name of args.names) {
        const result = await repositories.cardReference.getCardIdentity(name);
        if (result.isOk()) resolved.push(result.value.identity);
        else unresolved.push({name, reason: result.error.message});
      }
      return ok({resolved, unresolved});
    },
    async validateFormatLegality(input: unknown) {
        const parsed = safeSync(() => ValidateDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
      const rows = await captureCheck(repositories,parsed.value,"format_legality");
      if (rows.isErr()) return err(rows.error);
        const assessment = assessDeckLegality({
            format: rows.value.brief.format,
            cards: rows.value.cards,
            brief: rows.value.brief,
            now:new Date(rows.value.checked_at),
            scryfallSourceUpdatedAt: latestOracleCardsSourceTimestamp(rows.value.reference.imports),
        });
        return assessment.isErr()
            ? err({type: "tool_error", message: assessment.error.message} as const)
            : settleCheck(repositories,rows.value,"format_legality",assessment.value);
    },
    async evaluateDeckCandidate(input: unknown) {
        const parsed = safeSync(() => ValidateDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
      const rows = await captureCheck(repositories,parsed.value,"deck_evaluation");
      if (rows.isErr()) return err(rows.error);
        const args={brief:rows.value.brief};
        const assessed = assessDeckLegality({
            format: args.brief.format,
            cards: rows.value.cards,
            brief: args.brief,
            now:new Date(rows.value.checked_at),
            scryfallSourceUpdatedAt: latestOracleCardsSourceTimestamp(rows.value.reference.imports),
        });
        if (assessed.isErr()) return err({type: "tool_error", message: assessed.error.message} as const);
        const gameChangers = rows.value.cards.filter((row) => row.card.gameChanger).map((row) => row.card.name);
        const landCount = rows.value.cards
            .filter((row) => row.section === "mainboard" && /\bLand\b/i.test(row.card.typeLine))
            .reduce((sum, row) => sum + row.quantity, 0);
        const manaCurve = rows.value.cards.reduce<Record<string, number>>((curve, row) => {
          if (row.section === "mainboard" && !/\bLand\b/i.test(row.card.typeLine)) curve[String(row.card.manaValue)] = (curve[String(row.card.manaValue)] ?? 0) + row.quantity;
        return curve;
      }, {});
      return settleCheck(repositories,rows.value,"deck_evaluation",{
          legality: assessed.value,
          powerAndExperience: args.brief.format === "commander"
              ? {
                  commanderBracket: args.brief.commanderBracket,
                  playExperience: args.brief.playExperience,
                  gameChangerCount: gameChangers.length,
                  gameChangers,
              }
              : {
                  powerLevel: args.brief.powerLevel,
                  playExperience: args.brief.playExperience,
              },
        manaAndCurve: {landCount, manaCurve},
          collectionStatus: "Collection availability is not evaluated by this tool. Use query_cards for owned-copy evidence."
      });
    },
    async renderDeckCandidate(input: unknown) {
        const parsed = safeSync(() => RenderDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
        const result = await repositories.deckCandidates.getDeckCandidate(parsed.value.candidate_id);
        if (result.isErr()) return result;
        return readCandidateView(result.value, {id:parsed.value.candidate_id,view:parsed.value.output, ...parsed.value.first === undefined ? {} : {first:parsed.value.first}, ...parsed.value.after === undefined ? {} : {after:parsed.value.after}});
    },
    async createDeckCandidate(input: unknown) {
        const parsed = safeSync(() => CreateDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
        return repositories.deckCandidates.createDeckCandidate(parsed.value);
    },
    async editDeckCandidate(input: unknown) {
        const parsed = safeSync(() => EditDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
        return repositories.deckCandidates.editDeckCandidate(parsed.value);
    },
    async getDeckCandidate(input: unknown) {
        const parsed = safeSync(() => GetDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
        const result = await repositories.deckCandidates.getDeckCandidate(parsed.value.id);
        if (result.isErr()) return result;
        if (parsed.value.view === "summary") return ok(summarizeDeckCandidate(result.value));
        return readCandidateView(result.value, parsed.value);
    },
    listDeckCandidates() {
        return repositories.deckCandidates.listDeckCandidates();
    },
    listCollectionLocations() {
      return repositories.collection.listCollectionLocations();
    },
  };
}

async function captureCheck(repositories:AgentToolRepositories,input:import("./deck-checks").DeckCheckInput,check:DeckCheckName) {
    const captured=await repositories.deckCandidates.captureDeckCheck(input,check);
    if(captured.isErr()) return captured;
    const reference=captured.value.reference;
    const missing=reference.missing.filter(type=>type==="oracle_cards");
    const reimportRequired=reference.reimportRequired.filter(type=>type==="oracle_cards");
    const ready=referenceReadiness({...reference,missing,reimportRequired,ready:missing.length===0&&reimportRequired.length===0});
    return ready.isErr()?err(ready.error):ok(captured.value);
}
async function settleCheck<T extends object>(repositories:AgentToolRepositories,capture:CapturedDeckCheck,check:DeckCheckName,result:T):Promise<Result<T & {evidence:import("./deck-checks").CheckExecutionEvidence},import("./deck-candidate").DeckCandidateRepositoryError>> {
    if(!capture.candidate_id) return ok({...result,evidence:{status:"transient" as const,checked_at:capture.checked_at}});
    if(capture.trial) return ok({...result,evidence:{status:"transient" as const,checked_at:capture.checked_at}});
    const evidence={checked_at:capture.checked_at,dependencies:capture.dependencies!,result};
    const published=await repositories.deckCandidates.publishDeckCheck(capture.candidate_id,check,evidence);
    return published.isErr()?err(published.error):ok({...result,evidence:{status:published.value,checked_at:capture.checked_at}});
}

async function requireReferenceData(cardReference: CardReferenceRepository): Promise<Result<ReferenceDataStatus, AgentToolError>> {
    const support = await cardReference.summarizeReferenceSupport();
    if (support.isErr()) return err({type: "tool_error", message: support.error.message});
    return referenceReadiness(support.value);
}
function referenceReadiness(support:ReferenceDataStatus):Result<ReferenceDataStatus,AgentToolError> {
    if (support.ready) return ok(support);
    const missing = support.missing;
    const reimportRequired = support.reimportRequired;
    const requirements = [
        missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
        reimportRequired.length > 0 ? `reimport required: ${reimportRequired.join(", ")}` : null,
    ].filter((requirement): requirement is string => requirement !== null);
    return err({
        type: "reference_data_unready",
        message: `Scryfall reference data is not ready (${requirements.join("; ")}).`,
        missingBulkDataTypes: missing,
        reimportRequiredBulkDataTypes: reimportRequired,
    });
}

function latestOracleCardsSourceTimestamp(imports: readonly ScryfallBulkDataImport[]): Date | null {
    const latest = imports
        .filter((item) => item.bulkDataType === "oracle_cards" && item.status === "succeeded")
        .sort((left, right) => importTimestamp(right) - importTimestamp(left))[0];
    return latest?.sourceUpdatedAt ?? null;
}

function importTimestamp(item: ScryfallBulkDataImport): number {
    return (item.completedAt ?? item.startedAt).getTime();
}

function safeSync<T>(fn: () => T): Result<T, AgentToolError> {
  try {
    return ok(fn());
  } catch (error) {
    return err({type: "validation_error", message: error instanceof Error ? error.message : String(error)});
  }
}

/** These tools must settle once dispatched, including future check-evidence publication. */
export function agentToolMutates(name: string): boolean {
    return [
        "create_deck_candidate",
        "edit_deck_candidate",
        "validate_format_legality",
        "evaluate_deck_candidate",
    ].includes(name);
}

/** Candidate reasoning and explicit findings must survive adapter serialization. */
export function agentToolPreservesCompleteOutput(name:string):boolean {
    return name.includes("deck_candidate") || name === "validate_format_legality";
}
