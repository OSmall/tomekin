import {expect, test} from "bun:test";
import {tool} from "@opencode-ai/plugin";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import * as tools from "../../../.opencode/tools/tomekin";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id, log} from "../../agent/test/fixtures/lookup";

test("OpenCode publishes the closed Collection evidence selector across independent registries", () => {
    for (const name of ["search_cards", "lookup_cards"] as const) {
        const schema = tool.schema.toJSONSchema(tool.schema.object(tools[name].args), {metadata: tool.schema.registry()});
        expect((schema.properties as any).collection_evidence).toEqual((agentToolInputJsonSchema(name).properties as any).collection_evidence);
        const copies = (schema.properties as any).collection_evidence.oneOf?.find((s: any) => s.properties.mode.const === "copies") ?? (schema.properties as any).collection_evidence.anyOf.find((s: any) => s.properties.mode.const === "copies");
        expect(copies.properties.select).toMatchObject({minProperties: 1, additionalProperties: false, properties: {finish: {const: true}}});
        expect(Object.keys(copies.properties.select.properties)).toHaveLength(24);
    }
});

test("actual OpenCode search/lookup carry complete same-row evidence and opaque recovery", async () => {
    const f = await createCollectionFixture();
    const condition = 'Complete synthetic Æ 🧙 "condition"\n'.repeat(500);
    f.db.$client.prepare("UPDATE collection_card SET condition = ? WHERE id = ?").run(condition, id(111));
    const provider = {id: "scryfall", async dispatch() {return {status: 200, body: {object: "list", data: [{object: "card", id: id(998), oracle_id: id(1), layout: "normal"}], has_more: false}};}};
    const restore = tools.configureAgentToolRuntimeForTests({log, createHandlers: options => createLocalAgentToolHandlers({...options, databasePath: f.databasePath, search: {provider}})});
    try {
        const common = {select: {oracle_id: true as const}, collection_policy: {kind: "explicit" as const, policy: f.policy}, collection_evidence: {mode: "copies" as const, select: {condition: true as const, finish: true as const}}};
        for (const [definition, input] of [[tools.lookup_cards, {references: [{kind: "oracle_id", value: id(1)}]}], [tools.search_cards, {q: "f:commander"}]] as const) {
            const output = await definition.execute({...input, ...common} as never);
            const result = JSON.parse(output);
            expect(output).toBe(JSON.stringify(result));
            expect(Buffer.byteLength(output)).toBeGreaterThan(16_000);
            expect(Buffer.byteLength(output)).toBeLessThanOrEqual(51_200);
            expect(result.edges[0].node.collection_evidence).toMatchObject({summary: {owned_quantity: 6, eligible_quantity: 2}, copies: [{collection_card_id: id(111), condition, finish: "nonfoil"}]});
            const invalid = JSON.parse(await definition.execute({...input, ...common, collection_evidence: {mode: "copies", select: {condition: false}}} as never));
            expect(invalid).toMatchObject({status: "error", edges: [], error: {code: "invalid_request"}});
        }
    } finally {restore(); f.dispose();}
});
