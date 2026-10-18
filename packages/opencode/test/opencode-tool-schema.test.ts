import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRootLogger, resolveLogConfigFromEnv} from "@tomekin/core";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import {applySqliteMigrations} from "@tomekin/sqlite";
import {tool, type ToolDefinition} from "@opencode-ai/plugin";
import * as tomekinTools from "../../../.opencode/tools/tomekin";

function isToolDefinition(value: unknown): value is ToolDefinition {
    return typeof value === "object" && value !== null && "description" in value && "args" in value && "execute" in value;
}

describe("opencode tool schemas", () => {
    test("are representable as JSON Schema", () => {
        const tools = Object.entries(tomekinTools).filter((entry): entry is [string, ToolDefinition] => isToolDefinition(entry[1]));

        expect(tools.length).toBeGreaterThan(0);
        for (const [name, definition] of tools) {
            expect(() => tool.schema.toJSONSchema(tool.schema.object(definition.args)), name).not.toThrow();
        }
    });

    test("exposes search_cards and Card Set discovery, but not the retired narrow Collection search", () => {
        expect(isToolDefinition(tomekinTools.search_cards)).toBe(true);
        expect(isToolDefinition(tomekinTools.search_card_sets)).toBe(true);
        expect("search_collection_cards" in tomekinTools).toBe(false);
        expect("list_collection_imports" in tomekinTools).toBe(false);
    });

    test("exposes every supported Deck Format through repo-local tool schemas", () => {
        const draft = tomekinTools.draft_deck_building_brief;
        const constraints = tomekinTools.get_format_constraints;
        expect(isToolDefinition(draft)).toBe(true);
        expect(isToolDefinition(constraints)).toBe(true);
        if (!isToolDefinition(draft) || !isToolDefinition(constraints)) throw new Error("expected tool definitions");

        const schemas = JSON.stringify([
            tool.schema.toJSONSchema(tool.schema.object(draft.args)),
            tool.schema.toJSONSchema(tool.schema.object(constraints.args)),
        ]);
        for (const format of ["commander", "standard", "pioneer", "modern", "legacy", "vintage", "pauper", "casual_60"]) {
            expect(schemas).toContain(format);
        }
    });

    test("executes 60-card Constructed Brief drafting through the repo-local tool", async () => {
        const dir = mkdtempSync(join(tmpdir(), "tomekin-opencode-modern-tool-"));
        const dbPath = join(dir, "test.sqlite");
        const log = createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"}));
        applySqliteMigrations(dbPath, {log});
        const restoreRuntime = tomekinTools.configureAgentToolRuntimeForTests({
            log,
            createHandlers: (options) => createLocalAgentToolHandlers({...options, databasePath: dbPath}),
        });
        try {
            const output = await tomekinTools.draft_deck_building_brief.execute({
                goal: "Build Modern control.",
                format: "modern",
                powerLevel: "Competitive at the local store.",
            });

            expect(JSON.parse(output)).toMatchObject({
                brief: {format: "modern", powerLevel: "Competitive at the local store."},
                confirmationRequired: true,
            });
        } finally {
            restoreRuntime();
        }
    });

    test("logs opencode tool invocation metadata", async () => {
        const dir = mkdtempSync(join(tmpdir(), "tomekin-opencode-log-"));
        const dbPath = join(dir, "test.sqlite");
        const logPath = join(dir, "agent.log");
        const log = createRootLogger(resolveLogConfigFromEnv({
            TOMEKIN_LOG_DESTINATION: "file",
            TOMEKIN_LOG_FILE: logPath,
            TOMEKIN_LOG_LEVEL: "debug",
            TOMEKIN_LOG_FORMAT: "json"
        }));
        applySqliteMigrations(dbPath, {log});
        const restoreRuntime = tomekinTools.configureAgentToolRuntimeForTests({
            log,
            createHandlers: (options) => createLocalAgentToolHandlers({...options, databasePath: dbPath}),
        });
        try {
            await tomekinTools.get_format_constraints.execute({format: "commander"});
        } finally {
            restoreRuntime();
        }

        const records = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
        expect(records).toContainEqual(expect.objectContaining({
            component: "agent_tool",
            toolName: "get_format_constraints",
            operation: "agent_tool_call",
            status: "started",
        }));
        expect(records).toContainEqual(expect.objectContaining({
            component: "agent_tool",
            toolName: "get_format_constraints",
            operation: "agent_tool_call",
            status: "succeeded",
        }));
    });
});

test("exposes and executes the generic calculator through OpenCode with actionable errors", async () => {
    const definition = tomekinTools.hypergeometric_calculator;
    expect(isToolDefinition(definition)).toBe(true);
    const schema = tool.schema.toJSONSchema(tool.schema.object(definition.args));
    expect(JSON.stringify(schema)).toContain("minimum_successes");
    expect(JSON.stringify(schema)).toContain("targetProbability");
    // OpenCode wraps a raw property shape: the root operation-dependent requirements remain runtime checks.
    expect(schema.required).toEqual(["operation", "populationSize", "sampleSize", "event"]);
    expect(schema.additionalProperties).toBe(false);
    expect((schema.properties as Record<string, unknown>).populationSuccesses).toBeDefined();
    expect((schema.properties as Record<string, unknown>).targetProbability).toBeDefined();
    const probability = {operation: "probability" as const, populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "between" as const, lower: 1, upper: 2}};
    const minimum = {operation: "minimum_successes" as const, populationSize: 5, sampleSize: 2, event: {kind: "at_least" as const, count: 1}, targetProbability: "0.70"};
    expect(tool.schema.object(definition.args).safeParse(probability).success).toBe(true);
    expect(tool.schema.object(definition.args).safeParse(minimum).success).toBe(true);
    const directory = mkdtempSync(join(tmpdir(), "tomekin-opencode-calculator-"));
    const databasePath = join(directory, "test.sqlite");
    const log = createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"}));
    applySqliteMigrations(databasePath, {log});
    const restore = tomekinTools.configureAgentToolRuntimeForTests({log, createHandlers: (options) => createLocalAgentToolHandlers({...options, databasePath})});
    try {
        expect(JSON.parse(await definition.execute(probability))).toMatchObject({probability: 5 / 6, eventStatus: "nontrivial"});
        expect(JSON.parse(await definition.execute(minimum))).toMatchObject({minimumSuccesses: 2, previous: {populationSuccesses: 1}});
        expect(JSON.parse(await definition.execute({...probability, extra: true} as never))).toMatchObject({error: "validation_error", message: expect.stringContaining("extra")});
        const {populationSuccesses: _omitted, ...missingCount} = probability;
        for (const invalid of [missingCount, {...minimum, populationSuccesses: 1}, {...probability, targetProbability: "0.7"}, {...minimum, event: {kind: "exactly", count: 1}}]) {
            expect(JSON.parse(await definition.execute(invalid as never))).toMatchObject({error: "validation_error", message: expect.any(String)});
        }
        expect(JSON.parse(await definition.execute({...minimum, sampleSize: 0}))).toMatchObject({error: "target_unattainable", message: expect.stringContaining("sampleSize 0")});
        const agent = readFileSync(new URL("../../../.opencode/agents/tomekin-deck-builder.md", import.meta.url), "utf8");
        expect(agent).toContain('"tomekin_hypergeometric_calculator": allow');
    } finally { restore(); rmSync(directory, {recursive: true, force: true}); }
});
