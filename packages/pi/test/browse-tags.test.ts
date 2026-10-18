import {expect, test} from "bun:test";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createCoreTool, createPiWorkerTransport, expectedPiToolNames, type PiToolOutput} from "@tomekin/pi";
import {createLookupFixture, id, log} from "../../agent/test/fixtures/lookup";
import {openDatabase, closeDatabase, cardIdentityTag} from "@tomekin/sqlite";

test("Pi exposes explicit catalogue operations and retires overlapping tag search", () => {
    expect(expectedPiToolNames).toContain("browse_tags");
    expect(expectedPiToolNames as readonly string[]).not.toContain("search_card_identity_tags");
    expect(JSON.parse(JSON.stringify(createCoreTool("browse_tags", {log}).parameters))).toEqual(agentToolInputJsonSchema("browse_tags"));
});
for (const mode of ["fallback", "Worker"] as const) test(`Pi ${mode} carries complete tag definitions and structured request errors`, async () => {
    const fixture = await createLookupFixture({tags: true});
    const text = 'Complete Æ "definition"\n'.repeat(800);
    const db = openDatabase(fixture.databasePath, {log});
    db.$client.prepare("UPDATE card_identity_tag SET description = ? WHERE id = ?").run(text, id(20)); closeDatabase(db);
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href}) : undefined;
    const definition = createCoreTool("browse_tags", {log, ...(transport ? {transport, databasePath: fixture.databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath: fixture.databasePath, log})})});
    try {
        const output = await definition.execute("tags", {operation: {type: "lookup", slugs: ["mana-rock"]}}, new AbortController().signal) as PiToolOutput;
        expect(output.content[0]!.text.length).toBeGreaterThan(16_000);
        expect(JSON.parse(output.content[0]!.text)).toEqual(output.details);
        expect((output.details as any).edges[0].node.tag.description).toBe(text);
        const invalid = await definition.execute("invalid", {operation: {type: "lookup", slugs: ["mana-rock"], hierarchy: {depth: 9}}}, new AbortController().signal) as PiToolOutput;
        expect(invalid.details).toMatchObject({status: "error", error: {code: "invalid_request"}});
    } finally {await transport?.close(); fixture.dispose();}
});
