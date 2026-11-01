import {expect, test} from "bun:test";
import {agentToolInputJsonSchema, agentToolMutates} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, expectedPiToolNames, type PiToolOutput} from "@tomekin/pi";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id, log} from "../../agent/test/fixtures/lookup";

test("Pi advertises the canonical closed Collection copy selector and browse is read-only", () => {
    const schema = JSON.parse(JSON.stringify(createCoreTool("browse_collection_cards", {log}).parameters));
    expect(schema).toEqual(agentToolInputJsonSchema("browse_collection_cards"));
    expect(schema.properties.select).toMatchObject({type: "object", minProperties: 1, additionalProperties: false, properties: {added_at: {const: true, description: expect.stringContaining("source")}}});
    expect(expectedPiToolNames).toContain("browse_collection_cards");
    expect(agentToolMutates("browse_collection_cards")).toBe(false);
});
for (const mode of ["fallback", "Worker"] as const) test(`Pi ${mode} preserves complete Collection browse envelopes and ordinary recovery`, async () => {
    const f = await createCollectionFixture();
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href}) : undefined;
    const tool = createCoreTool("browse_collection_cards", {log, ...(transport ? {transport, databasePath: f.databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath: f.databasePath, log})})});
    try {
        const longName = 'Synthetic Æ 🧙 "name" '.repeat(850);
        // Setup a long source location; the schema and exact policy carry it unchanged.
        f.db.$client.prepare("UPDATE collection_location SET name = ? WHERE id = ?").run(longName, id(100));
        const args = {collection_import_id: f.imported.id, policy: {kind: "explicit", policy: {...f.policy, allowed_locations: [{id: id(100), type: "binder", name: longName}]}}, select: {location: true}, first: 1};
        const output = await tool.execute("browse", args, new AbortController().signal) as PiToolOutput;
        expect(output.content[0]!.text.length).toBeGreaterThan(16_000);
        expect(Buffer.byteLength(output.content[0]!.text)).toBeLessThanOrEqual(51_200);
        const result = JSON.parse(output.content[0]!.text);
        expect(result).toEqual(output.details);
        expect(result).toMatchObject({status: "ok", edges: [{node: {collection_card_id: id(111), location: {name: longName}}}]});
        const invalid = await tool.execute("invalid", {...args, select: {added_at: false}}, new AbortController().signal) as PiToolOutput;
        expect(invalid.details).toMatchObject({status: "error", edges: [], error: {code: "invalid_request"}});
        const controller = new AbortController(); controller.abort();
        const cancelled = await tool.execute("cancelled", args, controller.signal) as PiToolOutput;
        expect(cancelled.details).toMatchObject({status: "error", error: {code: "cancelled", retryable: true}});
        expect((cancelled.details as any).error).not.toHaveProperty("cursor");
    } finally {await transport?.close(); f.dispose();}
});
for (const mode of ["fallback", "Worker"] as const) test(`Pi ${mode} preserves the complete location inspection and authoritative snapshot context`, async () => {
    const f = await createCollectionFixture();
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href}) : undefined;
    const definition = createCoreTool("list_collection_locations", {log, ...(transport ? {transport, databasePath: f.databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath: f.databasePath, log})})});
    try {
        const name = 'Synthetic source Æ 🧙 "location" '.repeat(700);
        f.db.$client.prepare("UPDATE collection_location SET name = ? WHERE id = ?").run(name, id(100));
        const output = await definition.execute("locations", {}, new AbortController().signal) as PiToolOutput;
        expect(output.content[0]!.text.length).toBeGreaterThan(16_000);
        expect(JSON.parse(output.content[0]!.text)).toEqual(output.details);
        expect(output.details).toMatchObject({locations: expect.arrayContaining([{id: id(100), type: "binder", name}, {id: id(101), type: "deck", name: "Shared"}]), collection_context: {state: "ready", collection_import_id: f.imported.id}});
        expect(output.details).not.toHaveProperty("truncated");
    } finally {await transport?.close(); f.dispose();}
});
