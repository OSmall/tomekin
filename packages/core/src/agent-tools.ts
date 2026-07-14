import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {draftDeckBuildingBrief, DraftDeckBuildingBriefInputSchema} from "./deck-building-brief";
import {type CardQueryRepository, parseCardQueryInput} from "./card-query";
import {type CardReferenceRepository, getFormatConstraints} from "./card-reference-queries";
import type {CollectionQueryRepository} from "./collection-import";
import {
  type DeckCandidateRepository,
  normalizeDeckCandidateForSave,
  SaveDeckCandidateInputSchema
} from "./deck-candidate";
import {renderDeckCandidateMarkdown, renderPortableDecklist} from "./deck-candidate-rendering";
import {type CommanderDeckCard, validateCommanderDeck} from "./commander-legality";

export const AgentToolNameSchema = z.enum([
  "draft_deck_building_brief",
  "query_cards",
  "get_card_identity",
  "search_card_identity_tags",
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
export const ResolveDecklistCardsArgsSchema = z.object({names: z.array(z.string().min(1)).min(1)});
export const ValidateDeckCandidateArgsSchema = z.object({cards: z.array(z.object({cardIdentityId: z.uuid(), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"])})).min(1), brief: z.unknown().optional()});
export const RenderDeckCandidateArgsSchema = z.object({label: z.string().min(1), cards: z.array(z.object({cardIdentityId: z.uuid(), cardName: z.string().min(1), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"]), sortOrder: z.number().int().nonnegative().default(0), note: z.string().nullable().default(null)})).min(1), sections: z.record(z.string(), z.string()).optional()});
export const SaveDeckCandidateArgsSchema = SaveDeckCandidateInputSchema;
export const GetDeckCandidateArgsSchema = z.object({id: z.uuid()});
export type AgentToolRepositories = {
  readonly cardReference: CardReferenceRepository;
  readonly cardQuery: CardQueryRepository;
  readonly deckCandidates: DeckCandidateRepository;
  readonly collection: CollectionQueryRepository;
};

export type AgentToolError = {readonly type: "validation_error" | "tool_error"; readonly message: string};

export function createAgentToolHandlers(repositories: AgentToolRepositories) {
  return {
    queryCards(input: unknown) {
      const parsed = parseCardQueryInput(input);
      if (parsed.isErr()) return Promise.resolve(parsed);
      return repositories.cardQuery.queryCards(parsed.value);
    },
    draftDeckBuildingBrief(input: unknown) {
      return safeSync(() => draftDeckBuildingBrief(DraftDeckBuildingBriefInputSchema.parse(input)));
    },
    getCardIdentity(input: unknown) {
      const args = GetCardIdentityArgsSchema.parse(input);
      return repositories.cardReference.getCardIdentity(args.idOrName);
    },
    searchCardIdentityTags(input: unknown) {
      return repositories.cardReference.searchCardIdentityTags(SearchCardIdentityTagsArgsSchema.parse(input));
    },
    summarizeReferenceSupport() {
      return repositories.cardReference.summarizeReferenceSupport();
    },
    getFormatConstraints(input: unknown) {
      const format = z.object({format: z.string().default("commander")}).parse(input ?? {}).format;
      return Promise.resolve(getFormatConstraints(format));
    },
    async resolveDecklistCards(input: unknown) {
      const args = ResolveDecklistCardsArgsSchema.parse(input);
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
      const args = ValidateDeckCandidateArgsSchema.parse(input);
      const rows = await rowsWithDetails(repositories, args.cards);
      if (rows.isErr()) return rows;
      return ok(validateCommanderDeck(rows.value, undefined));
    },
    async evaluateDeckCandidate(input: unknown) {
      const args = ValidateDeckCandidateArgsSchema.parse(input);
      const rows = await rowsWithDetails(repositories, args.cards);
      if (rows.isErr()) return rows;
      const legality = validateCommanderDeck(rows.value, undefined);
      const gameChangers = rows.value.filter((row) => row.card.gameChanger).map((row) => row.card.name);
      const landCount = rows.value.filter((row) => /\bLand\b/i.test(row.card.typeLine)).reduce((sum, row) => sum + row.quantity, 0);
      const manaCurve = rows.value.reduce<Record<string, number>>((curve, row) => {
        if (row.section === "deck" && !/\bLand\b/i.test(row.card.typeLine)) curve[String(row.card.manaValue)] = (curve[String(row.card.manaValue)] ?? 0) + row.quantity;
        return curve;
      }, {});
      return ok({
        legality,
        powerAndExperience: {gameChangerCount: gameChangers.length, gameChangers},
        manaAndCurve: {landCount, manaCurve},
        collectionStatus: "Collection availability is not evaluated by this tool. Use search_collection_cards for owned-copy evidence."
      });
    },
    renderDeckCandidate(input: unknown) {
      const args = RenderDeckCandidateArgsSchema.parse(input);
      return safeSync(() => ({markdown: renderDeckCandidateMarkdown(args), portableDecklist: renderPortableDecklist(args.cards)}));
    },
    saveDeckCandidate(input: unknown) {
      return repositories.deckCandidates.saveDeckCandidate(normalizeDeckCandidateForSave(SaveDeckCandidateArgsSchema.parse(input)));
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

async function rowsWithDetails(repositories: AgentToolRepositories, cards: readonly {cardIdentityId: string; quantity: number; section: "commander" | "deck"}[]): Promise<Result<readonly CommanderDeckCard[], AgentToolError>> {
  const details = await repositories.cardReference.listCardIdentitiesByIds(cards.map((card) => card.cardIdentityId));
  if (details.isErr()) return err({type: "tool_error", message: details.error.message});
  return ok(cards.map((card) => {
    const detail = details.value.find((candidate) => candidate.identity.id === card.cardIdentityId);
    if (!detail) throw new Error(`Missing Card Identity detail: ${card.cardIdentityId}`);
    return {card: detail.identity, quantity: card.quantity, section: card.section, legalities: detail.legalities, parts: detail.parts};
  }));
}

function safeSync<T>(fn: () => T): Result<T, AgentToolError> {
  try {
    return ok(fn());
  } catch (error) {
    return err({type: "validation_error", message: error instanceof Error ? error.message : String(error)});
  }
}
