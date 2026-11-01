import {expect, test} from "bun:test";
import {tool} from "@opencode-ai/plugin";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import * as tools from "../../../.opencode/tools/tomekin";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id, log} from "../../agent/test/fixtures/lookup";

test("OpenCode serializes closed Collection selectors with an independent metadata registry and returns the complete envelope", async () => {
    const schema = tool.schema.toJSONSchema(tool.schema.object(tools.browse_collection_cards.args), {metadata: tool.schema.registry()});
    expect((schema.properties as any).select).toEqual((agentToolInputJsonSchema("browse_collection_cards").properties as any).select);
    expect((schema.properties as any).select).toMatchObject({minProperties: 1, additionalProperties: false});
    const f = await createCollectionFixture();
    const restore = tools.configureAgentToolRuntimeForTests({log, createHandlers: options => createLocalAgentToolHandlers({...options, databasePath: f.databasePath})});
    try {
        const args = {collection_import_id: f.imported.id, policy: {kind: "explicit", policy: f.policy}, select: {added_at: true}};
        const result = await tools.browse_collection_cards.execute(args as never);
        const parsed = JSON.parse(result);
        expect(result).toBe(JSON.stringify(parsed));
        expect(parsed).toMatchObject({status: "ok", edges: [{node: {collection_card_id: id(111)}}], collection_context: {policy_id: expect.any(String)}});
        expect(JSON.parse(await tools.browse_collection_cards.execute({...args, select: {unknown: true}} as never))).toMatchObject({status: "error", error: {code: "invalid_request"}});
    } finally {restore(); f.dispose();}
});
