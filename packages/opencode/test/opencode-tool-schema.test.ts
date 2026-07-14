import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync} from "node:fs";
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

    test("exposes query_cards and not the retired narrow Collection search", () => {
        expect(isToolDefinition(tomekinTools.query_cards)).toBe(true);
        expect("search_collection_cards" in tomekinTools).toBe(false);
        expect("list_collection_imports" in tomekinTools).toBe(false);
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
            await tomekinTools.summarize_reference_support.execute({});
        } finally {
            restoreRuntime();
        }

        const records = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
        expect(records).toContainEqual(expect.objectContaining({
            component: "agent_tool",
            toolName: "summarize_reference_support",
            operation: "agent_tool_call",
            status: "started",
        }));
        expect(records).toContainEqual(expect.objectContaining({
            component: "agent_tool",
            toolName: "summarize_reference_support",
            operation: "agent_tool_call",
            status: "succeeded",
        }));
    });
});
