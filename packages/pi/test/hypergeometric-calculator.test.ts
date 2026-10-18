import {expect, test} from "bun:test";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {calculateHypergeometric, createRootLogger, resolveLogConfigFromEnv, agentToolInputJsonSchema, AgentToolNameSchema} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {applySqliteMigrations} from "@tomekin/sqlite";
import {auditPiToolRegistry, createCoreTool, createPiWorkerTransport, expectedPiToolNames} from "@tomekin/pi";

const log = createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED: "false"}));

test("Pi exposes both calculator operation schemas and the approved registry name", () => {
    expect(expectedPiToolNames).toContain("hypergeometric_calculator");
    expect(AgentToolNameSchema.safeParse("hypergeometric_calculator").success).toBe(true);
    expect(() => auditPiToolRegistry(expectedPiToolNames)).not.toThrow();
    const definition = createCoreTool("hypergeometric_calculator", {log});
    const schema = agentToolInputJsonSchema("hypergeometric_calculator");
    expect(JSON.parse(JSON.stringify(definition.parameters))).toEqual(schema);
    const alternatives = (schema.oneOf ?? schema.anyOf) as Record<string, unknown>[];
    expect(alternatives).toHaveLength(2);
    expect(alternatives[0]!.required).toEqual(expect.arrayContaining(["operation", "populationSize", "populationSuccesses", "sampleSize", "event"]));
    expect(alternatives[1]!.required).toEqual(expect.arrayContaining(["operation", "populationSize", "sampleSize", "event", "targetProbability"]));
    expect(alternatives.every((alternative) => alternative.additionalProperties === false)).toBe(true);
});

for (const mode of ["fallback", "Worker"] as const) test(`Pi ${mode} executes calculator Results with complete JSON and typed errors`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "tomekin-pi-calculator-"));
    const databasePath = join(directory, "test.sqlite");
    const transport = mode === "Worker" ? createPiWorkerTransport({workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href}) : undefined;
    try {
        applySqliteMigrations(databasePath, {log});
        const definition = createCoreTool("hypergeometric_calculator", {
            log,
            ...(transport ? {transport, databasePath} : {createRuntime: () => createLocalAgentToolRuntime({databasePath, log})}),
        });
        const requests = [
            {operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "exactly", count: 1}},
            {operation: "minimum_successes", populationSize: 5, sampleSize: 2, event: {kind: "at_least", count: 1}, targetProbability: "0.70"},
            {operation: "minimum_successes", populationSize: 0, sampleSize: 0, event: {kind: "at_least", count: 1}, targetProbability: "0.1"},
            {operation: "probability", populationSize: 4, populationSuccesses: 2, sampleSize: 2, event: {kind: "exactly", count: 1}, extra: true},
        ];
        for (const [index, request] of requests.entries()) {
            const expected = calculateHypergeometric(request);
            const details = expected.isOk() ? expected.value : {error: expected.error.type, message: expected.error.message};
            const output = await definition.execute(`calculator-${index}`, request, new AbortController().signal);
            expect(output).toEqual({content: [{type: "text", text: JSON.stringify(details, null, 2)}], details});
        }
    } finally {
        await transport?.close();
        rmSync(directory, {recursive: true, force: true});
    }
});
