import {describe, expect, test} from "bun:test";
import {appendTomekinPiBootstrap, auditPiToolRegistry, createCoreTool, createReferenceSupportTool, expectedPiToolNames, registerTomekinExtension} from "@tomekin/pi";
import type {Logger} from "@tomekin/core";

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
            "get_deck_candidate", "list_deck_candidates", "list_collection_locations", "load_methodology", "ask_user",
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
                    return {isOk: () => true, isErr: () => false, value: {text: "x".repeat(12_100)}};
                }},
                close: () => { closed += 1; },
            }) as never,
            log,
        });
        const output = await tool.execute("call", {goal: "Build Modern control."}, new AbortController().signal) as {content: readonly {text: string}[]; details: Record<string, unknown>};
        expect(received).toEqual({goal: "Build Modern control."});
        expect(output.details).toMatchObject({truncated: true, originalCharacters: expect.any(Number)});
        expect(output.content[0]!.text.length).toBeLessThanOrEqual(12_000);
        expect(closed).toBe(1);
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
        expect(prompt).toContain("load the approved Product Methodology entry named tomekin-deck-building");
        expect(prompt).toContain("no filesystem, shell, network, raw database, or generic coding authority");
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
