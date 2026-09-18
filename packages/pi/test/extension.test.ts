import {describe, expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {appendTomekinPiBootstrap, auditPiToolRegistry, createCoreTool, createMethodologyReadTool, createReferenceSupportTool, expectedPiToolNames, registerTomekinExtension} from "@tomekin/pi";
import type {Logger} from "@tomekin/core";
import {createPiWorkerTransport} from "@tomekin/pi";

describe("Pi Worker transport", () => {
    test("leaves Pi's event loop responsive while a delegated task runs", async () => {
        const transport = createPiWorkerTransport({workerUrl: new URL("./fixtures/worker-transport-fixture.ts", import.meta.url).href});
        try {
            const result = transport.invoke({toolCallId: "slow-call", waitMilliseconds: 100}, new AbortController().signal);
            let ticked = false;
            await new Promise<void>((resolve) => setTimeout(() => { ticked = true; resolve(); }, 10));
            expect(ticked).toBe(true);
            await expect(result).resolves.toEqual({content: [{type: "text", text: "done"}], details: {done: true}});
        } finally {
            await transport.close();
        }
    });
});

describe("Pi reference-status transport", () => {
    const log = {info: () => {}, warn: () => {}} as unknown as Logger;
    test("translates successful and expected Result failures and closes its runtime", async () => {
        let closed = 0;
        const success = createReferenceSupportTool({
            createRuntime: () => ({
                handlers: {summarizeReferenceSupport: async () => ({isOk: () => true, isErr: () => false, value: {ready: true}})},
                close: () => { closed += 1; },
            }),
        });
        await expect(success.execute("call", {}, new AbortController().signal)).resolves.toEqual({
            content: [{type: "text", text: JSON.stringify({ready: true}, null, 2)}],
            details: {ready: true},
        });

        const failure = createReferenceSupportTool({
            createRuntime: () => ({
                handlers: {summarizeReferenceSupport: async () => ({isOk: () => false, isErr: () => true, error: {type: "tool_error", message: "Reference data unavailable."}})},
                close: () => { closed += 1; },
            }),
        });
        await expect(failure.execute("call", {}, new AbortController().signal)).resolves.toEqual({
            content: [{type: "text", text: JSON.stringify({error: "tool_error", message: "Reference data unavailable."}, null, 2)}],
            details: {error: "tool_error", message: "Reference data unavailable."},
        });
        expect(closed).toBe(2);
    });

    test("defines the complete fixed interactive capability registry", () => {
        expect(expectedPiToolNames).toEqual([
            "draft_deck_building_brief", "query_cards", "get_card_identity", "search_card_identity_tags",
            "search_card_sets", "summarize_reference_support", "get_format_constraints", "resolve_decklist_cards",
            "validate_format_legality", "evaluate_deck_candidate", "render_deck_candidate", "save_deck_candidate",
            "get_deck_candidate", "list_deck_candidates", "list_collection_locations", "read", "ask_user",
        ]);
        expect(() => auditPiToolRegistry(expectedPiToolNames)).not.toThrow();
    });

    test("forwards typed transport arguments, bounds output, and always closes the runtime", async () => {
        let received: unknown;
        let closed = 0;
        const tool = createCoreTool("draft_deck_building_brief", {
            createRuntime: () => ({
                handlers: {draftDeckBuildingBrief: async (input: unknown) => {
                    received = input;
                    return {isOk: () => true, isErr: () => false, value: {text: "x".repeat(16_100)}};
                }},
                close: () => { closed += 1; },
            }) as never,
            log,
        });
        const output = await tool.execute("call", {goal: "Build Modern control."}, new AbortController().signal) as {content: readonly {text: string}[]; details: Record<string, unknown>};
        expect(received).toEqual({goal: "Build Modern control."});
        expect(output.details).toMatchObject({truncated: true, originalCharacters: expect.any(Number)});
        expect(output.content[0]!.text.length).toBeLessThanOrEqual(16_000);
        expect(closed).toBe(1);
    });

    test("reads working-tree skills in line ranges without the core tool cap", async () => {
        const workspacePath = mkdtempSync(join(tmpdir(), "tomekin-pi-methodology-"));
        const methodologyPath = join(workspacePath, "skills", "example");
        mkdirSync(methodologyPath, {recursive: true});
        writeFileSync(join(methodologyPath, "SKILL.md"), ["first", "second", "third"].join("\n"));
        try {
            const read = createMethodologyReadTool({workspacePath});
            await expect(read.execute("call", {path: "skills/example/SKILL.md", offset: 2, limit: 1}, new AbortController().signal)).resolves.toEqual({
                content: [{type: "text", text: "second"}],
                details: {path: "skills/example/SKILL.md", offset: 2, limit: 1, totalLines: 3, nextOffset: 3},
            });
            await expect(read.execute("call", {path: "README.md"}, new AbortController().signal)).resolves.toMatchObject({
                details: {error: "access_denied"},
            });
        } finally {
            rmSync(workspacePath, {recursive: true, force: true});
        }
    });

    test("does not apply the 16k core-tool cap to Tomekin skills", async () => {
        const workspacePath = mkdtempSync(join(tmpdir(), "tomekin-pi-methodology-"));
        const methodologyPath = join(workspacePath, "skills", "long");
        const content = "x".repeat(16_100);
        mkdirSync(methodologyPath, {recursive: true});
        writeFileSync(join(methodologyPath, "SKILL.md"), content);
        try {
            const read = createMethodologyReadTool({workspacePath});
            const output = await read.execute("call", {path: "skills/long/SKILL.md"}, new AbortController().signal) as {content: readonly {text: string}[]};
            expect(output.content[0]!.text).toBe(content);
        } finally {
            rmSync(workspacePath, {recursive: true, force: true});
        }
    });

    test("accepts every regular child path and preserves the native read byte limit", async () => {
        const workspacePath = mkdtempSync(join(tmpdir(), "tomekin-pi-skills-"));
        const dottedSkillPath = join(workspacePath, "skills", "..references");
        const unicodeSkillPath = join(workspacePath, "skills", "unicode");
        mkdirSync(dottedSkillPath, {recursive: true});
        mkdirSync(unicodeSkillPath, {recursive: true});
        writeFileSync(join(dottedSkillPath, "SKILL.md"), "available");
        writeFileSync(join(unicodeSkillPath, "SKILL.md"), "😀".repeat(30_000));
        try {
            const read = createMethodologyReadTool({workspacePath});
            const dotted = await read.execute("call", {path: "skills/..references/SKILL.md"}, new AbortController().signal) as {content: readonly {text: string}[]};
            const unicode = await read.execute("call", {path: "skills/unicode/SKILL.md"}, new AbortController().signal) as {content: readonly {text: string}[]};
            expect(dotted.content[0]!.text).toBe("available");
            expect(Buffer.byteLength(unicode.content[0]!.text, "utf8")).toBeLessThanOrEqual(50 * 1024);
        } finally {
            rmSync(workspacePath, {recursive: true, force: true});
        }
    });

    test("sanitizes unexpected failures and discards completed work after cancellation", async () => {
        let closed = 0;
        const unexpected = createCoreTool("draft_deck_building_brief", {
            createRuntime: () => ({handlers: {draftDeckBuildingBrief: async () => { throw new Error("token=secret"); }}, close: () => { closed += 1; }}) as never,
            log,
        });
        await expect(unexpected.execute("call", {}, new AbortController().signal)).resolves.toMatchObject({details: {error: "tool_error", message: "The approved tool could not complete."}});
        const controller = new AbortController();
        const cancelled = createCoreTool("draft_deck_building_brief", {
            createRuntime: () => ({handlers: {draftDeckBuildingBrief: async () => { controller.abort(); return {isOk: () => true, isErr: () => false, value: {saved: true}}; }}, close: () => { closed += 1; }}) as never,
            log,
        });
        await expect(cancelled.execute("call", {}, controller.signal)).resolves.toMatchObject({details: {error: "cancelled"}});
        expect(closed).toBe(2);
    });

    test("fails closed when the effective registry differs from the approved capability", () => {
        expect(() => auditPiToolRegistry(["summarize_reference_support"])).toThrow("missing required tool");
        expect(() => auditPiToolRegistry(["bash", ...expectedPiToolNames])).toThrow("unexpected tool bash");
        expect(() => auditPiToolRegistry([...expectedPiToolNames, "ask_user"])).toThrow("duplicate tool ask_user");
    });

    test("audits Pi's active registry when every session starts", () => {
        let listener: (() => void) | undefined;
        const registered: string[] = [];
        registerTomekinExtension({
            registerTool: (tool) => { registered.push(tool.name); },
            on: (event, registered) => { if (event === "session_start") listener = registered as () => void; },
            getActiveTools: () => ["bash", ...expectedPiToolNames],
        });
        expect(registered).toEqual(expectedPiToolNames.filter((name) => name !== "ask_user"));
        expect(listener).toBeDefined();
        expect(listener!).toThrow("unexpected tool bash");
    });

    test("registers a controlled bootstrap for every agent turn without replacing Pi's prompt", () => {
        let beforeAgentStart: ((event: {systemPrompt: string}) => {systemPrompt: string}) | undefined;
        registerTomekinExtension({
            registerTool: () => {},
            on: (event, listener) => { if (event === "before_agent_start") beforeAgentStart = listener as typeof beforeAgentStart; },
            getActiveTools: () => [...expectedPiToolNames],
        });
        expect(beforeAgentStart).toBeDefined();
        const prompt = beforeAgentStart!({systemPrompt: "Pi base prompt"}).systemPrompt;
        expect(prompt).toStartWith("Pi base prompt");
        expect(prompt).toContain("collection-first Magic: The Gathering deck-building assistant");
        expect(prompt).toContain("read skills/tomekin-deck-building/SKILL.md");
        expect(prompt).toContain("no general filesystem, shell, network, raw database, or generic coding authority");
        expect(prompt).toBe(appendTomekinPiBootstrap("Pi base prompt"));
    });

    test("fails closed when a capability is registered after Tomekin's extension", () => {
        const active: string[] = [...expectedPiToolNames];
        const api = {
            registerTool: (tool: {name: string}) => { active.push(tool.name); },
            on: () => {}, getActiveTools: () => active,
        };
        registerTomekinExtension(api as never);
        expect(() => api.registerTool({name: "bash"})).toThrow("unexpected tool bash");
    });
});
