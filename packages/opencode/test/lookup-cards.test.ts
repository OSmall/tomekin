import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {tool} from "@opencode-ai/plugin";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import * as tools from "../../../.opencode/tools/tomekin";
import {createLookupFixture, id, log} from "../../agent/test/fixtures/lookup";

test("OpenCode publishes closed typed selection and carries the exact complete bounded envelope", async () => {
    for (const retired of ["get_card_identity", "resolve_decklist_cards", "summarize_reference_support"]) expect(retired in tools).toBe(false);
    const schema = tool.schema.toJSONSchema(tool.schema.object(tools.lookup_cards.args));
    expect((schema.properties as any).select).toMatchObject({minProperties: 1, additionalProperties: false, properties: {oracle_text: {const: true, description: expect.stringContaining("Complete")}}});
    const annotation = 'Synthetic annotation Æ "quoted"\n'.repeat(600);
    const fixture = await createLookupFixture({tags: true, tagAnnotation: annotation});
    const restore = tools.configureAgentToolRuntimeForTests({log, createHandlers: (options) => createLocalAgentToolHandlers({...options, databasePath: fixture.databasePath})});
    try {
        const args = {references: [{kind: "oracle_id" as const, value: id(1)}], select: {tags: true as const}};
        const output = await tools.lookup_cards.execute(args);
        expect(Buffer.byteLength(output)).toBeGreaterThan(16_000);
        expect(Buffer.byteLength(output)).toBeLessThanOrEqual(51_200);
        const parsed = JSON.parse(output);
        expect(output).toBe(JSON.stringify(parsed));
        expect(parsed.edges[0].node.card.tags.direct[1].annotation).toBe(annotation);
        const invalid = JSON.parse(await tools.lookup_cards.execute({...args, select: {name: false}} as never));
        expect(invalid).toMatchObject({status: "error", edges: [], error: {code: "invalid_request", retryable: false, issues: [{path: ["select", "name"]}]}});
        expect(readFileSync(new URL("../../../.opencode/agents/tomekin-deck-builder.md", import.meta.url), "utf8")).toContain('"tomekin_lookup_cards": allow');
    } finally {restore(); fixture.dispose();}
});

test("OpenCode lookup selection remains complete with an independent consumer metadata registry", () => {
    // A standalone host/plugin installation can use a different Zod registry from this tool module.
    const schema = tool.schema.toJSONSchema(tool.schema.object(tools.lookup_cards.args), {metadata: tool.schema.registry()});
    expect((schema.properties as any).select).toMatchObject({minProperties: 1, additionalProperties: false, properties: {oracle_text: {const: true, description: expect.stringContaining("Complete")}}});
    expect(Object.keys((schema.properties as any).select.properties)).toHaveLength(34);
    expect((schema.properties as any).select).toEqual((agentToolInputJsonSchema("lookup_cards").properties as Record<string, unknown>).select);
    expect(tool.schema.object(tools.lookup_cards.args).safeParse({references: [{kind: "name", value: "Sol Ring"}], select: {name: true}}).success).toBe(true);
    expect(tool.schema.object(tools.lookup_cards.args).safeParse({references: [{kind: "name", value: "Sol Ring"}], select: {name: true, extra: true}}).success).toBe(false);
    expect(tool.schema.object(tools.lookup_cards.args).safeParse({references: [{kind: "name", value: "Sol Ring"}], select: {}}).success).toBe(false);
    expect(tool.schema.object(tools.lookup_cards.args).safeParse({references: [{kind: "name", value: "Sol Ring"}], select: {name: false}}).success).toBe(false);
});
