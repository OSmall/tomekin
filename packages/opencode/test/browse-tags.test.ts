import {expect, test} from "bun:test";
import {tool} from "@opencode-ai/plugin";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import * as tools from "../../../.opencode/tools/tomekin";
import {openDatabase, closeDatabase} from "@tomekin/sqlite";
import {createLookupFixture, id, log} from "../../agent/test/fixtures/lookup";

test("OpenCode catalogue operations preserve closed nested metadata across independent registries", () => {
    expect("search_card_identity_tags" in tools).toBe(false);
    const schema = tool.schema.toJSONSchema(tool.schema.object(tools.browse_tags.args), {metadata: tool.schema.registry()});
    expect((schema.properties as any).operation).toEqual((agentToolInputJsonSchema("browse_tags").properties as any).operation);
    expect(JSON.stringify((schema.properties as any).operation)).toContain('"maximum":3');
    const validator = tool.schema.object(tools.browse_tags.args);
    expect(validator.safeParse({operation: {type: "lookup", slugs: ["mana-rock"], hierarchy: {}}}).success).toBe(true);
    expect(validator.safeParse({operation: {type: "search", query: "mana", hierarchy: {}}}).success).toBe(false);
    expect(validator.safeParse({operation: {type: "lookup", slugs: ["mana-rock"], hierarchy: {depth: 4}}}).success).toBe(false);
});
test("OpenCode returns complete catalogue definitions and structured misses and errors", async () => {
    const fixture = await createLookupFixture({tags: true});
    const text = 'Complete Æ "definition"\n'.repeat(800);
    const db = openDatabase(fixture.databasePath, {log});
    db.$client.prepare("UPDATE card_identity_tag SET description = ? WHERE id = ?").run(text, id(20)); closeDatabase(db);
    const restore = tools.configureAgentToolRuntimeForTests({log, createHandlers: options => createLocalAgentToolHandlers({...options, databasePath: fixture.databasePath})});
    try {
        const output = await tools.browse_tags.execute({operation: {type: "lookup", slugs: ["mana-rock", "absent"]}});
        expect(Buffer.byteLength(output)).toBeGreaterThan(16_000);
        const parsed = JSON.parse(output); expect(output).toBe(JSON.stringify(parsed));
        expect(parsed.edges[0].node.tag.description).toBe(text);
        expect(parsed.edges[1].node).toEqual({status: "not_found", slug: "absent"});
        const invalid = JSON.parse(await tools.browse_tags.execute({operation: {type: "lookup", slugs: []}} as never));
        expect(invalid).toMatchObject({status: "error", error: {code: "invalid_request", retryable: false}});
    } finally {restore(); fixture.dispose();}
});
