import {expect, test} from "bun:test";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, type PiToolOutput} from "@tomekin/pi";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id, log} from "../../agent/test/fixtures/lookup";

test("Pi search/lookup expose the canonical closed copy selector", () => {
    for (const name of ["search_cards", "lookup_cards"] as const) {
        const schema = JSON.parse(JSON.stringify(createCoreTool(name, {log}).parameters));
        expect(schema).toEqual(agentToolInputJsonSchema(name));
        const copies = schema.properties.collection_evidence.oneOf?.find((s: any) => s.properties.mode.const === "copies") ?? schema.properties.collection_evidence.anyOf.find((s: any) => s.properties.mode.const === "copies");
        expect(copies.properties.select).toMatchObject({minProperties: 1, additionalProperties: false});
    }
});
for (const mode of ["fallback", "Worker"] as const) test(`actual Pi ${mode} search/lookup preserve matching-only whole copy evidence and safe errors`, async () => {
    const f = await createCollectionFixture();
    const condition = 'Complete synthetic Æ 🧙 "condition"\n'.repeat(500);
    f.db.$client.prepare("UPDATE collection_card SET condition = ? WHERE id = ?").run(condition, id(111));
    const provider = {id: "scryfall", async dispatch() {return {status: 200, body: {object: "list", data: [{object: "card", id: id(998), oracle_id: id(1), layout: "normal"}], has_more: false}};}};
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href, provider}) : undefined;
    try {
        for (const [name, input] of [["lookup_cards", {references: [{kind: "oracle_id", value: id(1)}]}], ["search_cards", {q: "f:commander"}]] as const) {
            const definition = createCoreTool(name, {log, ...(transport ? {transport, databasePath: f.databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath: f.databasePath, log, search: {provider}})})});
            const args = {...input, select: {oracle_id: true}, collection_policy: {kind: "explicit", policy: f.policy}, collection_evidence: {mode: "copies", select: {condition: true, finish: true}}};
            const output = await definition.execute("collection", args, new AbortController().signal) as PiToolOutput;
            const result = JSON.parse(output.content[0]!.text);
            expect(result).toEqual(output.details);
            expect(Buffer.byteLength(output.content[0]!.text)).toBeGreaterThan(16_000);
            expect(Buffer.byteLength(output.content[0]!.text)).toBeLessThanOrEqual(51_200);
            expect(result).toMatchObject({status: "ok", collection_context: {match: "identity", collection_import_id: f.imported.id}, edges: [{node: {collection_evidence: {summary: {owned_quantity: 6, eligible_quantity: 2}, copies: [{collection_card_id: id(111), printing_id: id(2), condition}]}}}]});
            const invalid = await definition.execute("invalid", {...args, collection_evidence: {mode: "copies", select: {condition: false}}}, new AbortController().signal) as PiToolOutput;
            expect(invalid.details).toMatchObject({status: "error", edges: [], error: {code: "invalid_request"}});
            const controller = new AbortController(); controller.abort();
            const cancelled = await definition.execute("cancelled", args, controller.signal) as PiToolOutput;
            expect(cancelled.details).toMatchObject({status: "error", error: {code: "cancelled"}});
            expect((cancelled.details as any).error.cursor).toBeUndefined();
        }
    } finally {await transport?.close(); f.dispose();}
});
