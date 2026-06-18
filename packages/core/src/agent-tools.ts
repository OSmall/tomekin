import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import {draftDeckBuildingBrief, DraftDeckBuildingBriefInputSchema} from "./deck-building-brief";
import {getFormatConstraints, type CardReferenceRepository} from "./card-reference-queries";
import {normalizeDeckCandidateForSave, SaveDeckCandidateInputSchema, type DeckCandidateRepository} from "./deck-candidate";
import {renderDeckCandidateMarkdown, renderPortableDecklist} from "./deck-candidate-rendering";
import {validateCommanderDeck, type CommanderDeckCard} from "./commander-legality";

export const AgentToolNameSchema = z.enum([
  "draft_deck_building_brief",
  "search_card_identities",
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
]);
export type AgentToolName = z.infer<typeof AgentToolNameSchema>;

export const SearchCardIdentitiesArgsSchema = z.object({
  query: z.string().optional(),
  colorIdentity: z.string().optional(),
  commanderColorIdentitySubset: z.string().optional(),
  typeLine: z.string().optional(),
  oracleText: z.string().optional(),
  tag: z.string().optional(),
  commanderLegalOnly: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
});
export const GetCardIdentityArgsSchema = z.object({idOrName: z.string().min(1)});
export const SearchCardIdentityTagsArgsSchema = z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()});
export const ResolveDecklistCardsArgsSchema = z.object({names: z.array(z.string().min(1)).min(1)});
export const ValidateDeckCandidateArgsSchema = z.object({cards: z.array(z.object({cardIdentityId: z.uuid(), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"])})).min(1), brief: z.unknown().optional()});
export const RenderDeckCandidateArgsSchema = z.object({label: z.string().min(1), cards: z.array(z.object({cardIdentityId: z.uuid(), cardName: z.string().min(1), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"]), sortOrder: z.number().int().nonnegative().default(0), note: z.string().nullable().default(null)})).min(1), sections: z.record(z.string(), z.string()).optional()});
export const SaveDeckCandidateArgsSchema = SaveDeckCandidateInputSchema;
export const GetDeckCandidateArgsSchema = z.object({id: z.uuid()});

export type AgentToolRepositories = {
  readonly cardReference: CardReferenceRepository;
  readonly deckCandidates: DeckCandidateRepository;
};

export type AgentToolError = {readonly type: "validation_error" | "tool_error"; readonly message: string};

export function createAgentToolHandlers(repositories: AgentToolRepositories) {
  return {
    draftDeckBuildingBrief(input: unknown) {
      return safeSync(() => draftDeckBuildingBrief(DraftDeckBuildingBriefInputSchema.parse(input)));
    },
    searchCardIdentities(input: unknown) {
      return repositories.cardReference.searchCardIdentities(SearchCardIdentitiesArgsSchema.parse(input));
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
      return ok({legality, powerAndExperience: {gameChangerCount: gameChangers.length, gameChangers}, manaAndCurve: {landCount, manaCurve}, collectionStatus: "Collection is empty; every card is a Missing Card."});
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
