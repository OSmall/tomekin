import {expect, test} from "bun:test";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {resolvePiToolNames, supportedPiVersion} from "@tomekin/pi";

test("the actual Pi package loads the restricted Tomekin extension and executes its SQLite Worker across reload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "tomekin-pi-integration-"));
    const child = Bun.spawn([process.execPath, fileURLToPath(new URL("./fixtures/package-runtime.ts", import.meta.url))], {
        env: {
            PATH: process.env.PATH, HOME: directory, PI_CODING_AGENT_DIR: join(directory, "profile"),
            TOMEKIN_LOG_ENABLED: "false", TOMEKIN_ENABLE_LEGACY_QUERY: "false", PI_TELEMETRY_DISABLED: "1",
        },
        stdout: "pipe", stderr: "pipe",
    });
    try {
        const [stdout, stderr, exitCode] = await Promise.all([
            new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
        ]);
        expect(exitCode, stderr).toBe(0);
        const actual = JSON.parse(stdout);
        expect(actual.version).toBe(supportedPiVersion);
        expect([...actual.beforeReload].sort()).toEqual([...resolvePiToolNames({TOMEKIN_ENABLE_LEGACY_QUERY: "false"})].sort());
        expect(actual.afterReload).toEqual(actual.beforeReload);
        expect(actual.errors).toEqual([]);
        expect(actual.lookup).toEqual(actual.afterReloadLookup);
        expect(JSON.stringify(actual.lookup)).toContain("Sol Ring");
        expect(actual.lookup.error).toBeUndefined();
        expect(actual.arithmetic.result).toBe(13);
        expect(actual.arithmeticSchema).toMatchObject({type: "object", additionalProperties: false, required: ["expression"], properties: {expression: {type: "string", maxLength: 512}}});
        expect(actual.calculator.error).toBeUndefined();
        expect(actual.calculator.probability).toBeCloseTo(2 / 3, 12);
        expect(JSON.stringify(actual.skill)).toContain("tomekin-deck-building");
        expect(actual.denied.error).toBe("access_denied");
        expect(actual.skills).toContain("tomekin-deck-building");
        expect(actual.skills).not.toContain("ask-user");
        expect(actual.contexts).toBe(0);
        expect(actual.prompts).toBe(0);
        expect(actual.extensions).toHaveLength(4);
        expect(actual.systemPrompt).toContain("Collection-first Magic: The Gathering assistant");
        expect(actual.systemPrompt).toContain("tomekin-deck-building");
        expect(actual.systemPrompt).not.toContain("expert coding assistant");
        expect(actual.todoAdd.todos[0].text).toBe("Research");
        expect(actual.todoList.todos).toHaveLength(1);
        expect(actual.todoToggle.todos[0].done).toBe(true);
        expect(actual.todoClear.todos).toHaveLength(0);
        expect(actual.context).toHaveProperty("estimatedTokens");
        expect(JSON.stringify(actual.composed)).toContain("Sol Ring");
    } finally {
        child.kill();
        await child.exited;
        await rm(directory, {recursive: true, force: true});
    }
}, 30_000);
