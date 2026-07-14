import {tool} from "@opencode-ai/plugin";
import {z} from "zod";
import {
  createRootLogger,
  type LogComponent,
  type Logger,
  resolveLogConfigFromEnv,
  serializeError
} from "@tomekin/core";
import {createLocalAgentToolHandlers, type LocalRuntimeOptions, resultToOpencodeOutput} from "@tomekin/opencode";

const cardQuerySortablePropertyValues = ["identity.id", "identity.name", "identity.manaValue", "identity.colorIdentity", "identity.edhrecRank", "collection.quantity"] as const;

const cardRowSchema = z.object({
  cardIdentityId: z.uuid(),
  quantity: z.number().int().positive(),
  section: z.enum(["commander", "deck"]),
});

const renderCardRowSchema = cardRowSchema.extend({
  cardName: z.string().min(1),
  sortOrder: z.number().int().nonnegative().default(0),
  note: z.string().nullable().default(null),
});

const briefSchema = z.object({
  goal: z.string().min(1),
  format: z.enum(["commander"]).default("commander"),
  formatAnchor: z.string().min(1).nullable().default(null),
  playExperience: z.string().min(1).default("Synergistic, varied, expressive, and fair-feeling."),
  commanderBracket: z.string().min(1).nullable().default(null),
  budget: z.string().min(1).nullable().default(null),
  missingCardTolerance: z.string().min(1).default("Moderate; check the imported Collection before treating cards as Missing Cards."),
  comboTolerance: z.string().min(1).default("Avoid deterministic combo wins unless explicitly requested."),
  constraints: z.array(z.string().min(1)).default([]),
  exclusions: z.array(z.string().min(1)).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  ruleZeroExceptions: z.array(z.string().min(1)).default([]),
});

const saveCardRowSchema = cardRowSchema.extend({
  sortOrder: z.number().int().nonnegative().default(0),
  note: z.string().min(1).nullable().default(null),
});

const jsonDateTimeSchema = z.string().datetime({offset: true});

type AgentToolRuntime = {
  readonly log: Logger;
  readonly createHandlers: typeof createLocalAgentToolHandlers;
  readonly handlerOptions?: Omit<LocalRuntimeOptions, "log"> | undefined;
};

let runtimeOverride: AgentToolRuntime | undefined;

export function configureAgentToolRuntimeForTests(runtime: AgentToolRuntime | undefined): () => void {
  const previous = runtimeOverride;
  runtimeOverride = runtime;
  return () => {
    runtimeOverride = previous;
  };
}

function resolveAgentToolRuntime(): AgentToolRuntime {
  if (runtimeOverride) return runtimeOverride;
  const log = createRootLogger(resolveLogConfigFromEnv(process.env));
  return {
    log,
    createHandlers: createLocalAgentToolHandlers,
  };
}

async function runTool<T>(toolName: string, args: unknown, fn: (handlers: ReturnType<typeof createLocalAgentToolHandlers>["handlers"]) => Promise<T> | T): Promise<string> {
  const startedAtMs = performance.now();
  const runtime = resolveAgentToolRuntime();
  const logger = runtime.log.child({component: "agent_tool" satisfies LogComponent, toolName});
  logger.info({operation: "agent_tool_call", status: "started"}, "Agent tool call started");
  logger.debug({operation: "agent_tool_call", status: "started", args}, "Agent tool arguments");
  const local = runtime.createHandlers({...runtime.handlerOptions, log: runtime.log});
  try {
    const result = await fn(local.handlers);
    const output = resultToOpencodeOutput(result as Parameters<typeof resultToOpencodeOutput>[0]);
    const resultLike = result as {isOk?: () => boolean; isErr?: () => boolean};
    logger.info({operation: "agent_tool_call", status: resultLike.isErr?.() ? "failed" : "succeeded", durationMs: elapsedMs(startedAtMs), outputBytes: output.length}, "Agent tool call finished");
    logger.debug({operation: "agent_tool_call", status: "finished", output}, "Agent tool output");
    return output;
  } catch (error) {
    logger.error({operation: "agent_tool_call", status: "threw", durationMs: elapsedMs(startedAtMs), error: serializeError(error)}, "Agent tool call threw");
    return JSON.stringify({
      error: "tool_error",
      message: error instanceof Error ? error.message : String(error),
    }, null, 2);
  } finally {
    local.close();
  }
}

function elapsedMs(startedAtMs: number): number {
  return Math.round(performance.now() - startedAtMs);
}

export const draft_deck_building_brief = tool({
  description: "Normalize a proposed Commander Deck Building Brief and return assumptions that require user confirmation.",
  args: {brief: briefSchema.partial({goal: true}).extend({goal: z.string().min(1)})},
  async execute(args) {
    return runTool("draft_deck_building_brief", args, (handlers) => handlers.draftDeckBuildingBrief(args.brief));
  },
});

export const query_cards = tool({
  description: "Run a structured Card Query over local Card Identities, Commander legality, Card Identity Tags, and imported Collection card rows. For filter syntax and examples, load the query-cards skill before composing non-trivial filters or after validation errors.",
  args: {
    filter: z.unknown().optional(),
    sortby: z.array(z.object({
      property: z.enum(cardQuerySortablePropertyValues),
      direction: z.enum(["asc", "desc"])
    }).strict()).optional(),
    include: z.object({
      legalities: z.array(z.enum(["commander"])).optional(),
      tags: z.boolean().optional(),
      collectionCards: z.boolean().optional(),
    }).strict().optional(),
    limit: z.number().int().positive().max(200).optional(),
  },
  async execute(args) {
    return runTool("query_cards", args, (handlers) => handlers.queryCards(args));
  },
});

export const get_card_identity = tool({
  description: "Get one local Card Identity with parts, Commander legality rows, tags, EDHREC rank, Game Changer flag, and source URI.",
  args: {idOrName: z.string().min(1)},
  async execute(args) {
    return runTool("get_card_identity", args, (handlers) => handlers.getCardIdentity(args));
  },
});

export const search_card_identity_tags = tool({
  description: "Search local Scryfall Oracle Tags by slug, label, or alias.",
  args: {query: z.string().optional(), limit: z.number().int().positive().max(100).optional()},
  async execute(args) {
    return runTool("search_card_identity_tags", args, (handlers) => handlers.searchCardIdentityTags(args));
  },
});

export const summarize_reference_support = tool({
  description: "Report local Scryfall reference-data readiness for oracle_cards, all_cards, and oracle_tags.",
  args: {},
  async execute() {
    return runTool("summarize_reference_support", {}, (handlers) => handlers.summarizeReferenceSupport());
  },
});

export const get_format_constraints = tool({
  description: "Return deterministic Commander construction constraints and supported local validation mechanics.",
  args: {format: z.enum(["commander"]).default("commander")},
  async execute(args) {
    return runTool("get_format_constraints", args, (handlers) => handlers.getFormatConstraints(args));
  },
});

export const resolve_decklist_cards = tool({
  description: "Resolve proposed card names to exact local Card Identity records before validation or persistence.",
  args: {names: z.array(z.string().min(1)).min(1)},
  async execute(args) {
    return runTool("resolve_decklist_cards", args, (handlers) => handlers.resolveDecklistCards(args));
  },
});

export const validate_format_legality = tool({
  description: "Validate deterministic Commander deck construction checks over resolved Card Identity IDs.",
  args: {cards: z.array(cardRowSchema).min(1), brief: briefSchema.optional()},
  async execute(args) {
    return runTool("validate_format_legality", args, (handlers) => handlers.validateFormatLegality(args));
  },
});

export const evaluate_deck_candidate = tool({
  description: "Return an aggregate review with legality, Game Changers, mana curve, and land count. Use Collection tools separately for owned-card evidence.",
  args: {cards: z.array(cardRowSchema).min(1), brief: briefSchema.optional()},
  async execute(args) {
    return runTool("evaluate_deck_candidate", args, (handlers) => handlers.evaluateDeckCandidate(args));
  },
});

export const render_deck_candidate = tool({
  description: "Render stable Deck Candidate Markdown and a strict Commander/Deck Portable Decklist from resolved cards.",
  args: {
    label: z.string().min(1),
    cards: z.array(renderCardRowSchema).min(1),
    sections: z.record(z.string(), z.string()).optional(),
  },
  async execute(args) {
    return runTool("render_deck_candidate", args, (handlers) => handlers.renderDeckCandidate(args));
  },
});

export const save_deck_candidate = tool({
  description: "Persist a final Commander Deck Candidate and its resolved Card Identity rows.",
  args: {
    id: z.uuid().optional(),
    label: z.string().min(1),
    format: z.enum(["commander"]).default("commander"),
    formatAnchor: z.string().min(1).nullable().default(null),
    commanderBracket: z.string().min(1).nullable().default(null),
    brief: briefSchema,
    collectionImportTimestamp: jsonDateTimeSchema.nullable().default(null),
    markdown: z.string().min(1),
    cards: z.array(saveCardRowSchema).min(1),
  },
  async execute(args) {
    return runTool("save_deck_candidate", args, (handlers) => handlers.saveDeckCandidate(args));
  },
});

export const get_deck_candidate = tool({
  description: "Retrieve a saved Deck Candidate as structured data.",
  args: {id: z.uuid()},
  async execute(args) {
    return runTool("get_deck_candidate", args, (handlers) => handlers.getDeckCandidate(args));
  },
});

export const list_deck_candidates = tool({
  description: "List saved Deck Candidates with scalar metadata and card counts.",
  args: {},
  async execute() {
    return runTool("list_deck_candidates", {}, (handlers) => handlers.listDeckCandidates());
  },
});

export const list_collection_locations = tool({
  description: "List current imported Collection locations. Locations with type deck are inferred Existing Decks from the collection import.",
  args: {},
  async execute() {
    return runTool("list_collection_locations", {}, (handlers) => handlers.listCollectionLocations());
  },
});
