import {describe, expect, test} from "bun:test";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createTestRootLoggerFromEnv} from "@mtg-agent/core";
import {applySqliteMigrations} from "@mtg-agent/sqlite";
import {createLocalAgentToolHandlers, resultToOpencodeOutput} from "@mtg-agent/opencode";

const testLog = createTestRootLoggerFromEnv();

describe("opencode adapter tools", () => {
    test("renders Result output as JSON for opencode", () => {
        const output = resultToOpencodeOutput({
            isOk: () => true,
            isErr: () => false,
            value: {ready: true},
        });

        expect(JSON.parse(output)).toEqual({ready: true});
    });

    test("exposes missing reference setup through local handlers", async () => {
        const dbPath = join(mkdtempSync(join(tmpdir(), "mtg-agent-opencode-")), "test.sqlite");
        applySqliteMigrations(dbPath, {log: testLog});
        const local = createLocalAgentToolHandlers({databasePath: dbPath, log: testLog});
        try {
            const result = await local.handlers.summarizeReferenceSupport();
            const output = resultToOpencodeOutput(result);

            expect(JSON.parse(output)).toMatchObject({
                ready: false,
                missing: ["oracle_cards", "all_cards", "oracle_tags"],
            });
        } finally {
            local.close();
        }
    });
});
