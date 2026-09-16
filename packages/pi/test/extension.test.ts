import {describe, expect, test} from "bun:test";
import {auditPiToolRegistry, createReferenceSupportTool, registerTomekinExtension} from "@tomekin/pi";

describe("Pi reference-status transport", () => {
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

    test("fails closed when the effective registry differs from the approved capability", () => {
        expect(() => auditPiToolRegistry(["summarize_reference_support"])).not.toThrow();
        expect(() => auditPiToolRegistry(["bash", "summarize_reference_support"])).toThrow("unexpected tool bash");
        expect(() => auditPiToolRegistry(["summarize_reference_support", "summarize_reference_support"])).toThrow("duplicate tool summarize_reference_support");
    });

    test("audits Pi's active registry when every session starts", () => {
        let listener: (() => void) | undefined;
        registerTomekinExtension({
            registerTool: () => {},
            on: (_event, registered) => { listener = registered; },
            getActiveTools: () => ["bash", "summarize_reference_support"],
        });
        expect(listener).toBeDefined();
        expect(listener!).toThrow("unexpected tool bash");
    });
});
