import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {DeckBuildingBriefSchema, DeckFormatSchema, draftDeckBuildingBrief} from "./deck-building-brief";
import {CardQueryInputSchema, type CardQueryRepository, parseCardQueryInput} from "./card-query";
import {type CardReferenceRepository, getFormatConstraints, type ReferenceDataStatus} from "./card-reference-queries";
import type {CollectionQueryRepository} from "./collection-import";
import {
    DeckCandidateCardSectionSchema,
    type DeckCandidateRepository,
    normalizeDeckCandidateForSave,
    SaveDeckCandidateInputSchema
} from "./deck-candidate";
import {renderDeckCandidateMarkdown, renderPortableDecklist} from "./deck-candidate-rendering";
import {assessDeckLegality, type DeckLegalityCard} from "./format-legality";
import type {ScryfallBulkDataImport, ScryfallBulkDataType} from "./scryfall-sync";

export const AgentToolNameSchema = z.enum([
  "draft_deck_building_brief",
  "query_cards",
  "get_card_identity",
  "search_card_identity_tags",
  "search_card_sets",
  "summarize_reference_support",
  "get_format_constraints",
  "resolve_decklist_cards",
  "validate_format_legality",
  "evaluate_deck_candidate",
  "render_deck_candidate",
  "save_deck_candidate",
  "get_deck_candidate",
  "list_deck_candidates",
  "list_collection_locations",
]);
export type AgentToolName = z.infer<typeof AgentToolNameSchema>;

export const GetCardIdentityArgsSchema = z.object({idOrName: z.string().min(1)});
export const SearchCardIdentityTagsArgsSchema = z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()});
export const SearchCardSetsArgsSchema = z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()});
export const ResolveDecklistCardsArgsSchema = z.object({names: z.array(z.string().min(1)).min(1)});
export const ValidateDeckCandidateArgsSchema = z.strictObject({
    cards: z.array(z.object({
        cardIdentityId: z.uuid(),
        quantity: z.number().int().positive(),
        section: DeckCandidateCardSectionSchema,
    })).min(1),
    brief: DeckBuildingBriefSchema,
});
export const RenderDeckCandidateArgsSchema = z.strictObject({
    label: z.string().min(1),
    format: DeckFormatSchema,
    cards: z.array(z.object({
        cardIdentityId: z.uuid(),
        cardName: z.string().min(1),
        quantity: z.number().int().positive(),
        section: DeckCandidateCardSectionSchema,
        sortOrder: z.number().int().nonnegative().default(0),
        note: z.string().nullable().default(null)
    })).min(1),
    sections: z.record(z.string(), z.string()).optional()
});
export const SaveDeckCandidateArgsSchema = SaveDeckCandidateInputSchema;
/** JSON transport preserves the public ISO timestamp form accepted by the save normalizer. */
export const SaveDeckCandidateTransportArgsSchema = SaveDeckCandidateInputSchema.extend({
    collectionImportTimestamp: z.string().datetime({offset: true}).nullable().default(null),
});
export const GetDeckCandidateArgsSchema = z.object({id: z.uuid()});
export const GetFormatConstraintsArgsSchema = z.object({format: DeckFormatSchema}).strict();
export const EmptyAgentToolArgsSchema = z.strictObject({});

export const agentToolContracts = {
    draft_deck_building_brief: {description: "Normalize a proposed Format-specific Deck Building Brief and return assumptions requiring user confirmation.", inputSchema: DeckBuildingBriefSchema},
    query_cards: {description: "Run a structured local Card Query. Load the query-cards skill before non-trivial filters.", inputSchema: CardQueryInputSchema},
    get_card_identity: {description: "Get one local Card Identity by ID or name.", inputSchema: GetCardIdentityArgsSchema},
    search_card_identity_tags: {description: "Search local Card Identity Tags by slug, label, or alias.", inputSchema: SearchCardIdentityTagsArgsSchema},
    search_card_sets: {description: "Search local Card Sets by code or name.", inputSchema: SearchCardSetsArgsSchema},
    summarize_reference_support: {description: "Report local reference-data readiness.", inputSchema: EmptyAgentToolArgsSchema},
    get_format_constraints: {description: "Return deterministic construction constraints for a Deck Format.", inputSchema: GetFormatConstraintsArgsSchema},
    resolve_decklist_cards: {description: "Resolve proposed card names to local Card Identities.", inputSchema: ResolveDecklistCardsArgsSchema},
    validate_format_legality: {description: "Validate deterministic Format construction and legality.", inputSchema: ValidateDeckCandidateArgsSchema},
    evaluate_deck_candidate: {description: "Evaluate a candidate's legality, power context, mana curve, and land count.", inputSchema: ValidateDeckCandidateArgsSchema},
    render_deck_candidate: {description: "Render stable Deck Candidate Markdown and a Portable Decklist.", inputSchema: RenderDeckCandidateArgsSchema},
    save_deck_candidate: {description: "Persist a final Deck Candidate.", inputSchema: SaveDeckCandidateTransportArgsSchema},
    get_deck_candidate: {description: "Retrieve a saved Deck Candidate.", inputSchema: GetDeckCandidateArgsSchema},
    list_deck_candidates: {description: "List saved Deck Candidates.", inputSchema: EmptyAgentToolArgsSchema},
    list_collection_locations: {description: "List imported Collection Locations.", inputSchema: EmptyAgentToolArgsSchema},
} as const;

export function agentToolInputJsonSchema(name: AgentToolName): Record<string, unknown> {
    return z.toJSONSchema(agentToolContracts[name].inputSchema, {unrepresentable: "any"}) as Record<string, unknown>;
}
export type AgentToolRepositories = {
  readonly cardReference: CardReferenceRepository;
  readonly cardQuery: CardQueryRepository;
  readonly deckCandidates: DeckCandidateRepository;
  readonly collection: CollectionQueryRepository;
};

export type AgentToolError =
    | { readonly type: "validation_error" | "tool_error"; readonly message: string }
    | {
    readonly type: "reference_data_unready";
    readonly message: string;
    readonly missingBulkDataTypes: readonly ScryfallBulkDataType[];
    readonly reimportRequiredBulkDataTypes: readonly ScryfallBulkDataType[];
};

export function createAgentToolHandlers(repositories: AgentToolRepositories) {
  return {
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
        const args = parsed.value;
      const rows = await rowsWithDetails(repositories, args.cards);
      if (rows.isErr()) return rows;
        const assessment = assessDeckLegality({
            format: args.brief.format,
            cards: rows.value.cards,
            brief: args.brief,
            scryfallSourceUpdatedAt: latestOracleCardsSourceTimestamp(rows.value.referenceImports),
        });
        return assessment.isErr()
            ? err({type: "tool_error", message: assessment.error.message} as const)
            : ok(assessment.value);
    },
    async evaluateDeckCandidate(input: unknown) {
        const parsed = safeSync(() => ValidateDeckCandidateArgsSchema.parse(input));
        if (parsed.isErr()) return parsed;
        const args = parsed.value;
      const rows = await rowsWithDetails(repositories, args.cards);
      if (rows.isErr()) return rows;
        const assessed = assessDeckLegality({
            format: args.brief.format,
            cards: rows.value.cards,
            brief: args.brief,
            scryfallSourceUpdatedAt: latestOracleCardsSourceTimestamp(rows.value.referenceImports),
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
      return ok({
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
    renderDeckCandidate(input: unknown) {
        return safeSync(() => {
            const args = RenderDeckCandidateArgsSchema.parse(input);
            return {
                markdown: renderDeckCandidateMarkdown(args),
                portableDecklist: renderPortableDecklist(args.format, args.cards)
            };
        });
    },
      async saveDeckCandidate(input: unknown) {
          const candidate = normalizeDeckCandidateForSave(SaveDeckCandidateArgsSchema.parse(input));
          const ready = await requireReferenceData(repositories.cardReference);
          if (ready.isErr()) return ready;
          return repositories.deckCandidates.saveDeckCandidate(candidate);
    },
    getDeckCandidate(input: unknown) {
      const args = GetDeckCandidateArgsSchema.parse(input);
      return repositories.deckCandidates.getDeckCandidate(args.id);
    },
    listDeckCandidates() {
      return repositories.deckCandidates.listDeckCandidates();
    },
    listCollectionLocations() {
      return repositories.collection.listCollectionLocations();
    },
  };
}

async function rowsWithDetails(repositories: AgentToolRepositories, cards: readonly {
    cardIdentityId: string;
    quantity: number;
    section: "commander" | "mainboard" | "sideboard";
}[]): Promise<Result<{
    readonly cards: readonly DeckLegalityCard[];
    readonly referenceImports: readonly ScryfallBulkDataImport[];
}, AgentToolError>> {
    const ready = await requireReferenceData(repositories.cardReference);
    if (ready.isErr()) return err(ready.error);
  const details = await repositories.cardReference.listCardIdentitiesByIds(cards.map((card) => card.cardIdentityId));
  if (details.isErr()) return err({type: "tool_error", message: details.error.message});
    const resolved: DeckLegalityCard[] = [];
    for (const card of cards) {
    const detail = details.value.find((candidate) => candidate.identity.id === card.cardIdentityId);
        if (!detail) return err({type: "tool_error", message: `Unresolved Card Identity: ${card.cardIdentityId}.`});
        resolved.push({
            card: detail.identity,
            quantity: card.quantity,
            section: card.section,
            legalities: detail.legalities,
            parts: detail.parts
        });
    }
    return ok({cards: resolved, referenceImports: ready.value.imports});
}

async function requireReferenceData(cardReference: CardReferenceRepository): Promise<Result<ReferenceDataStatus, AgentToolError>> {
    const support = await cardReference.summarizeReferenceSupport();
    if (support.isErr()) return err({type: "tool_error", message: support.error.message});
    if (support.value.ready) return ok(support.value);
    const missing = support.value.missing;
    const reimportRequired = support.value.reimportRequired;
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
