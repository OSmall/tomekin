import {expect, test} from "bun:test";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, expectedPiToolNames, type PiToolOutput} from "@tomekin/pi";
import {createLookupFixture, id, log} from "../../agent/test/fixtures/lookup";

test("Pi exposes closed nonempty typed lookup selections in its actual serialized schema", () => {
    const schema = JSON.parse(JSON.stringify(createCoreTool("lookup_cards", {log}).parameters));
    expect(schema).toEqual(agentToolInputJsonSchema("lookup_cards"));
    expect(schema.properties.select).toMatchObject({type: "object", minProperties: 1, additionalProperties: false});
    expect(schema.properties.select.properties.oracle_text).toMatchObject({const: true, description: expect.stringContaining("Complete")});
    expect(Object.keys(schema.properties.select.properties)).toHaveLength(34);
    expect(expectedPiToolNames).toContain("lookup_cards");
    for (const retired of ["get_card_identity", "resolve_decklist_cards", "summarize_reference_support"]) expect(expectedPiToolNames as readonly string[]).not.toContain(retired);
});
for (const mode of ["fallback", "Worker"] as const) test(`Pi ${mode} preserves complete bounded lookup envelopes beyond its old preview cap and structured errors`, async () => {
    const annotation = 'Synthetic annotation Æ "quoted"\n'.repeat(600);
    const fixture = await createLookupFixture({tags: true, tagAnnotation: annotation});
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href}) : undefined;
    const definition = createCoreTool("lookup_cards", {log, ...(transport ? {transport, databasePath: fixture.databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log})})});
    try {
        const args = {references: [{kind: "oracle_id", value: id(1)}], select: {tags: true}};
        const output = await definition.execute("complete", args, new AbortController().signal) as PiToolOutput;
        expect(output.content[0]!.text.length).toBeGreaterThan(16_000);
        expect(Buffer.byteLength(output.content[0]!.text)).toBeLessThanOrEqual(51_200);
        const envelope = JSON.parse(output.content[0]!.text);
        expect(envelope).toEqual(output.details);
        expect(envelope.status).toBe("ok");
        expect(envelope.edges[0].node.card.tags.direct[1].annotation).toBe(annotation);
        expect(envelope).not.toHaveProperty("truncated");
        const compact = await definition.execute("compact", {...args, select:{tags:{mode:"compact",slugs:["mana"]}}}, new AbortController().signal) as PiToolOutput;
        expect(JSON.parse(compact.content[0]!.text)).toMatchObject({status:"ok",next_cursor:null,edges:[{node:{card:{tags:{direct:[],inherited:[{slug:"mana",weight:"strong"}]}}}}]});
        expect(compact.content[0]!.text).not.toContain("annotation");
        const invalid = await definition.execute("invalid", {...args, select: {name: false}}, new AbortController().signal) as PiToolOutput;
        expect(JSON.parse(invalid.content[0]!.text)).toEqual(invalid.details);
        expect(invalid.details).toMatchObject({status: "error", edges: [], error: {code: "invalid_request", issues: [{path: ["select", "name"], code: "invalid_value"}]}});
    } finally {await transport?.close(); fixture.dispose();}
});

test("Pi terminated lookup returns cancellation without an invented progress cursor and can restart its Worker", async () => {
    const fixture = await createLookupFixture();
    const transport = createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href});
    try {
        const args = {references: [{kind: "name", value: "Sol Ring"}], select: {name: true}};
        const definition = createCoreTool("lookup_cards", {log, transport, databasePath: fixture.databasePath});
        const controller = new AbortController();
        const pending = definition.execute("cancelled-lookup", args, controller.signal);
        controller.abort();
        const output = await pending as PiToolOutput;
        expect(output.details).toMatchObject({status: "error", edges: [], error: {code: "cancelled", retryable: true}});
        expect((output.details as any).error).not.toHaveProperty("cursor");
        const restarted = await definition.execute("restarted-lookup", args, new AbortController().signal) as PiToolOutput;
        expect(restarted.details).toMatchObject({status: "ok", edges: [{node: {card: {name: "Sol Ring"}}}]});
    } finally {await transport.close(); fixture.dispose();}
});
