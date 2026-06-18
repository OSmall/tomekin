import {tool} from "@opencode-ai/plugin";
import {z} from "zod";
import {createLocalAgentToolHandlers, resultToOpencodeOutput} from "@mtg-agent/opencode";

function withHandlers<TArgs>(run: (args: TArgs, handlers: ReturnType<typeof createLocalAgentToolHandlers>["handlers"]) => Promise<unknown> | unknown) {
  return async (args: TArgs) => {
    const local = createLocalAgentToolHandlers();
    try {
      return resultToOpencodeOutput(await run(args, local.handlers) as never);
    } catch (error) {
      return JSON.stringify({
        error: "tool_error",
        message: error instanceof Error ? error.message : String(error),
      }, null, 2);
    } finally {
      local.close();
    }
  };
}

export const draft_deck_building_brief = tool({
  description: "Normalize a proposed Commander Deck Building Brief and return assumptions that require user confirmation.",
  args: z.object({
    goal: z.string().min(1),
    formatAnchor: z.string().min(1).nullable().optional(),
    playExperience: z.string().min(1).optional(),
    commanderBracket: z.string().min(1).nullable().optional(),
    budget: z.string().min(1).nullable().optional(),
    missingCardTolerance: z.string().min(1).optional(),
    comboTolerance: z.string().min(1).optional(),
    constraints: z.array(z.string().min(1)).optional(),
    exclusions: z.array(z.string().min(1)).optional(),
    assumptions: z.array(z.string().min(1)).optional(),
    ruleZeroExceptions: z.array(z.string().min(1)).optional(),
  }),
  execute: withHandlers((args, handlers) => handlers.draftDeckBuildingBrief(args)),
});

export const search_card_identities = tool({
  description: "Search local Scryfall Card Identity reference data. No network calls are made.",
  args: z.object({
    query: z.string().optional(),
    colorIdentity: z.string().optional(),
    commanderColorIdentitySubset: z.string().optional(),
    typeLine: z.string().optional(),
    oracleText: z.string().optional(),
    tag: z.string().optional(),
    commanderLegalOnly: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
  }),
  execute: withHandlers((args, handlers) => handlers.searchCardIdentities(args)),
});

export const get_card_identity = tool({
  description: "Get one local Card Identity with parts, Commander legality rows, tags, EDHREC rank, Game Changer flag, and source URI.",
  args: z.object({idOrName: z.string().min(1)}),
  execute: withHandlers((args, handlers) => handlers.getCardIdentity(args)),
});

export const search_card_identity_tags = tool({
  description: "Search local Scryfall Oracle Tags by slug, label, or alias.",
  args: z.object({query: z.string().optional(), limit: z.number().int().positive().max(100).optional()}),
  execute: withHandlers((args, handlers) => handlers.searchCardIdentityTags(args)),
});

export const summarize_reference_support = tool({
  description: "Report local Scryfall reference-data readiness for oracle_cards, all_cards, and oracle_tags.",
  args: z.object({}),
  execute: withHandlers((_args, handlers) => handlers.summarizeReferenceSupport()),
});

export const get_format_constraints = tool({
  description: "Return deterministic Commander construction constraints and supported local validation mechanics.",
  args: z.object({format: z.literal("commander").optional()}),
  execute: withHandlers((args, handlers) => handlers.getFormatConstraints(args)),
});

export const resolve_decklist_cards = tool({
  description: "Resolve proposed card names to exact local Card Identity records before validation or persistence.",
  args: z.object({names: z.array(z.string().min(1)).min(1)}),
  execute: withHandlers((args, handlers) => handlers.resolveDecklistCards(args)),
});

export const validate_format_legality = tool({
  description: "Validate deterministic Commander deck construction checks over resolved Card Identity IDs.",
  args: z.object({cards: z.array(z.object({cardIdentityId: z.string().uuid(), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"])})).min(1)}),
  execute: withHandlers((args, handlers) => handlers.validateFormatLegality(args)),
});

export const evaluate_deck_candidate = tool({
  description: "Return a first-slice aggregate review with legality, Game Changers, mana curve, land count, and empty-Collection status.",
  args: z.object({cards: z.array(z.object({cardIdentityId: z.string().uuid(), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"])})).min(1)}),
  execute: withHandlers((args, handlers) => handlers.evaluateDeckCandidate(args)),
});

export const render_deck_candidate = tool({
  description: "Render stable Deck Candidate Markdown and a strict Commander/Deck Portable Decklist from resolved cards.",
  args: z.object({
    label: z.string().min(1),
    cards: z.array(z.object({cardIdentityId: z.string().uuid(), cardName: z.string().min(1), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"]), sortOrder: z.number().int().nonnegative().optional(), note: z.string().nullable().optional()})).min(1),
    sections: z.record(z.string(), z.string()).optional(),
  }),
  execute: withHandlers((args, handlers) => handlers.renderDeckCandidate(args)),
});

export const save_deck_candidate = tool({
  description: "Persist a final Commander Deck Candidate and its resolved Card Identity rows.",
  args: z.object({
    id: z.string().uuid().optional(),
    label: z.string().min(1),
    format: z.literal("commander").optional(),
    formatAnchor: z.string().min(1).nullable().optional(),
    commanderBracket: z.string().min(1).nullable().optional(),
    brief: z.record(z.string(), z.unknown()),
    collectionImportTimestamp: z.string().datetime().nullable().optional(),
    markdown: z.string().min(1),
    cards: z.array(z.object({cardIdentityId: z.string().uuid(), quantity: z.number().int().positive(), section: z.enum(["commander", "deck"]), sortOrder: z.number().int().nonnegative().optional(), note: z.string().nullable().optional()})).min(1),
  }),
  execute: withHandlers((args, handlers) => handlers.saveDeckCandidate(args)),
});

export const get_deck_candidate = tool({
  description: "Retrieve a saved Deck Candidate as structured data.",
  args: z.object({id: z.string().uuid()}),
  execute: withHandlers((args, handlers) => handlers.getDeckCandidate(args)),
});

export const list_deck_candidates = tool({
  description: "List saved Deck Candidates with scalar metadata and card counts.",
  args: z.object({}),
  execute: withHandlers((_args, handlers) => handlers.listDeckCandidates()),
});
