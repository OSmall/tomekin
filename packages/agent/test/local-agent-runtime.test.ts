import {describe, expect, test} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {createRootLogger, createTestRootLoggerFromEnv, resolveLogConfigFromEnv} from "@tomekin/core";
import {createLocalAgentToolRuntime, loadProductMethodology} from "@tomekin/agent";
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

describe("Product Methodology catalog", () => {
    test("loads the seven reviewed entries by exact name and rejects unknown names", () => {
        const expectedNames = [
            "tomekin-deck-building",
            "query-cards",
            "collection-opportunity-discovery",
            "commander-deck-architecture",
            "commander-deck-tuning",
            "sixty-card-constructed-deck-architecture",
            "sixty-card-constructed-deck-tuning",
        ] as const;

        for (const name of expectedNames) {
            const result = loadProductMethodology(name);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.name).toBe(name);
                expect(result.value.content.length).toBeGreaterThan(0);
            }
        }

        for (const name of ["../AGENTS.md", "toString", "constructor", "__proto__", "hasOwnProperty"]) {
            expect(loadProductMethodology(name)).toEqual({
                ok: false,
                error: {type: "unknown_product_methodology", name},
            });
        }
    });
});
