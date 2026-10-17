import {tool} from "@opencode-ai/plugin";
import {cardFactDescriptions, agentToolContracts, createRootLogger, type LogComponent, type Logger, resolveLogConfigFromEnv, serializeError} from "@tomekin/core";
import {createLocalAgentToolHandlers, type LocalRuntimeOptions, resultToOpencodeOutput} from "@tomekin/opencode";

const argsOf = <Name extends keyof typeof agentToolContracts>(name: Name) => agentToolContracts[name].inputSchema.shape;

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
    logger.info({operation: "agent_tool_call", status: resultLike.isErr?.() ? "failed" : "succeeded", durationMs: elapsedMs(startedAtMs), outputBytes: Buffer.byteLength(output, "utf8")}, "Agent tool call finished");
    if (toolName !== "lookup_cards") logger.debug({operation: "agent_tool_call", status: "finished", output}, "Agent tool output");
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
    description: agentToolContracts.draft_deck_building_brief.description,
    args: argsOf("draft_deck_building_brief"),
  async execute(args) {
    return runTool("draft_deck_building_brief", args, (handlers) => handlers.draftDeckBuildingBrief(args));
  },
});

export const query_cards = tool({
    description: agentToolContracts.query_cards.description,
  args: argsOf("query_cards"),
  async execute(args) {
    return runTool("query_cards", args, (handlers) => handlers.queryCards(args));
  },
});

export const search_card_identity_tags = tool({
  description: "Search local Scryfall Oracle Tags by slug, label, or alias.",
  args: argsOf("search_card_identity_tags"),
  async execute(args) {
    return runTool("search_card_identity_tags", args, (handlers) => handlers.searchCardIdentityTags(args));
  },
});

export const search_card_sets = tool({
  description: "Search local Scryfall Card Sets by code or name and return complete Set metadata.",
  args: argsOf("search_card_sets"),
  async execute(args) {
    return runTool("search_card_sets", args, (handlers) => handlers.searchCardSets(args));
  },
});

export const get_format_constraints = tool({
    description: "Return deterministic construction constraints and supported local validation mechanics for a Deck Format.",
    args: argsOf("get_format_constraints"),
  async execute(args) {
    return runTool("get_format_constraints", args, (handlers) => handlers.getFormatConstraints(args));
  },
});

export const validate_format_legality = tool({
    description: "Validate deterministic Format deck construction checks over resolved Card Identity IDs using the authoritative Deck Building Brief Format.",
    args: argsOf("validate_format_legality"),
  async execute(args) {
    return runTool("validate_format_legality", args, (handlers) => handlers.validateFormatLegality(args));
  },
});

export const evaluate_deck_candidate = tool({
    description: "Return a Format-aware aggregate review with legality, power/play-experience context, mana curve, and land count. Use Card Query separately for owned-card evidence.",
    args: argsOf("evaluate_deck_candidate"),
  async execute(args) {
    return runTool("evaluate_deck_candidate", args, (handlers) => handlers.evaluateDeckCandidate(args));
  },
});

export const render_deck_candidate = tool({
    description: "Render stable Deck Candidate Markdown and a strict Format-aware Portable Decklist from resolved cards.",
  args: argsOf("render_deck_candidate"),
  async execute(args) {
    return runTool("render_deck_candidate", args, (handlers) => handlers.renderDeckCandidate(args));
  },
});

export const save_deck_candidate = tool({
    description: "Persist a final Deck Candidate and its resolved Card Identity rows, deriving Format from its authoritative Brief. Pass an existing Deck Candidate ID to update it in place; omit the ID only to create a new candidate.",
  args: argsOf("save_deck_candidate"),
  async execute(args) {
    return runTool("save_deck_candidate", args, (handlers) => handlers.saveDeckCandidate(args));
  },
});

export const get_deck_candidate = tool({
  description: "Retrieve a saved Deck Candidate as structured data.",
  args: argsOf("get_deck_candidate"),
  async execute(args) {
    return runTool("get_deck_candidate", args, (handlers) => handlers.getDeckCandidate(args));
  },
});

export const list_deck_candidates = tool({
  description: "List saved Deck Candidates with scalar metadata and card counts.",
  args: argsOf("list_deck_candidates"),
  async execute() {
    return runTool("list_deck_candidates", {}, (handlers) => handlers.listDeckCandidates());
  },
});

export const list_collection_locations = tool({
  description: "List current imported Collection locations. Locations with type deck are inferred Existing Decks from the collection import.",
  args: argsOf("list_collection_locations"),
  async execute() {
    return runTool("list_collection_locations", {}, (handlers) => handlers.listCollectionLocations());
  },
});

export const hypergeometric_calculator = tool({
    description: agentToolContracts.hypergeometric_calculator.description,
    args: argsOf("hypergeometric_calculator"),
    async execute(args) {
        return runTool("hypergeometric_calculator", args, (handlers) => handlers.hypergeometricCalculator(args));
    },
});

export const lookup_cards = tool({
    description: agentToolContracts.lookup_cards.description,
    // OpenCode bundles Zod 4.1 while Core uses 4.4: metadata registries differ.
    // Build this annotated selector with the actual host schema instance, from Core's one fact list.
    args: {...argsOf("lookup_cards"), select: tool.schema.strictObject(Object.fromEntries(
        Object.entries(cardFactDescriptions).map(([field, description]) => [field, tool.schema.literal(true).describe(description).optional()]),
    )).refine((value) => Object.keys(value).length > 0, "Select at least one fact.").meta({minProperties: 1})},
    async execute(args) {
        return runTool("lookup_cards", args, (handlers) => handlers.lookupCards(args));
    },
});
