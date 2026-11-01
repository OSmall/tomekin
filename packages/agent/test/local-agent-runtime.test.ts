import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {createRootLogger, createTestRootLoggerFromEnv, resolveLogConfigFromEnv} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {applySqliteMigrations} from "@tomekin/sqlite";

const log = createTestRootLoggerFromEnv();

describe("local Agent Tool runtime", () => {
    test("uses an isolated SQLite database for successful and failed calls, then closes it", () => {
        const directory = mkdtempSync(join(tmpdir(), "tomekin-agent-runtime-"));
        const dbPath = join(directory, "test.sqlite");

        try {
            applySqliteMigrations(dbPath, {log});
            const logPath = join(directory, "agent-runtime.log");
            const runtimeLog = createRootLogger(resolveLogConfigFromEnv({
                TOMEKIN_LOG_DESTINATION: "file",
                TOMEKIN_LOG_FILE: logPath,
                TOMEKIN_LOG_FORMAT: "json",
            }));
            const runtime = createLocalAgentToolRuntime({databasePath: dbPath, log: runtimeLog});

            try {
                const successful = runtime.handlers.draftDeckBuildingBrief({
                    goal: "Build Modern control.",
                    format: "modern",
                    powerLevel: "Competitive at the local store.",
                });
                const failing = runtime.handlers.draftDeckBuildingBrief({
                    goal: "Build Modern control.",
                    format: "modern",
                    powerLevel: null,
                    commanderBracket: null,
                });

                expect(successful.isOk()).toBe(true);
                expect(failing.isErr()).toBe(true);
                if (failing.isErr()) expect(failing.error.type).toBe("validation_error");
            } finally {
                runtime.close();
            }

            const records = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
            expect(records).toContainEqual(expect.objectContaining({
                component: "agent_runtime",
                operation: "close_agent_tool_runtime",
                status: "succeeded",
            }));
        } finally {
            rmSync(directory, {recursive: true, force: true});
        }
    });
});

test("calculates without reference readiness or candidate persistence through the shared runtime", async () => {
    const directory = mkdtempSync(join(tmpdir(), "tomekin-calculator-runtime-"));
    const databasePath = join(directory, "test.sqlite");
    try {
        applySqliteMigrations(databasePath, {log});
        const runtime = createLocalAgentToolRuntime({databasePath, log});
        try {
            const before = await runtime.handlers.listDeckCandidates();
            const result = runtime.handlers.hypergeometricCalculator({operation: "minimum_successes", populationSize: 99, sampleSize: 10, event: {kind: "at_least", count: 1}, targetProbability: "0.70"});
            expect(result.isOk()).toBe(true);
            if (result.isErr()) throw new Error(result.error.message);
            expect(result.value).toMatchObject({minimumSuccesses: 11, previous: {populationSuccesses: 10}});
            expect(result.value.probability).toBeCloseTo(0.7102774789751556, 14);
            expect((await runtime.handlers.summarizeReferenceSupport())._unsafeUnwrap().ready).toBe(false);
            expect((await runtime.handlers.listDeckCandidates())._unsafeUnwrap()).toEqual(before._unsafeUnwrap());
            const invalid = runtime.handlers.hypergeometricCalculator({operation: "probability", populationSize: 1001, sampleSize: 0, populationSuccesses: 0, event: {kind: "exactly", count: 0}});
            expect(invalid.isErr() && invalid.error.type).toBe("validation_error");
            const impossible = runtime.handlers.hypergeometricCalculator({operation: "minimum_successes", populationSize: 0, sampleSize: 0, event: {kind: "at_least", count: 1}, targetProbability: "0.1"});
            expect(impossible.isErr() && impossible.error.type).toBe("target_unattainable");
        } finally { runtime.close(); }
    } finally { rmSync(directory, {recursive: true, force: true}); }
});
