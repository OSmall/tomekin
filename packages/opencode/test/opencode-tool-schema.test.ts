import {describe, expect, test} from "bun:test";
import {tool, type ToolDefinition} from "@opencode-ai/plugin";
import * as mtgAgentTools from "../../../.opencode/tools/mtg-agent";

function isToolDefinition(value: unknown): value is ToolDefinition {
    return typeof value === "object" && value !== null && "description" in value && "args" in value && "execute" in value;
}

describe("opencode tool schemas", () => {
    test("are representable as JSON Schema", () => {
        const tools = Object.entries(mtgAgentTools).filter((entry): entry is [string, ToolDefinition] => isToolDefinition(entry[1]));

        expect(tools.length).toBeGreaterThan(0);
        for (const [name, definition] of tools) {
            expect(() => tool.schema.toJSONSchema(tool.schema.object(definition.args)), name).not.toThrow();
        }
    });

    test("exposes query_cards and not the retired narrow Collection search", () => {
        expect(isToolDefinition(mtgAgentTools.query_cards)).toBe(true);
        expect("search_collection_cards" in mtgAgentTools).toBe(false);
        expect("list_collection_imports" in mtgAgentTools).toBe(false);
    });
});
