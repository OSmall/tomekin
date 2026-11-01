import {describe, expect, test} from "bun:test";
import registerCodemode from "../src/codemode";
import {SessionManager} from "@earendil-works/pi-coding-agent";
import {Type} from "@sinclair/typebox";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

describe("restricted native Pi codemode", () => {
    test("is registered without model authority and keeps direct tools available", () => {
        let definition: any;
        registerCodemode({registerTool: (tool: unknown) => { definition = tool; }, appendEntry: () => {}, getAllTools: () => [], getSettings: () => ({})} as never);
        expect(definition.name).toBe("codemode");
        expect(definition.description).not.toContain("`models`");
        expect(definition.executionMode).toBe("sequential");
    });

    test("does not commit a checkpoint when output is truncated", async () => {
        let definition: any;
        const entries: unknown[] = [];
        registerCodemode({registerTool: (tool: unknown) => { definition = tool; }, appendEntry: (...args: unknown[]) => entries.push(args), getAllTools: () => [], getSettings: () => ({})} as never);
        const ctx = {tools: [], sessionManager: {getBranch: () => []}};
        const result = await definition.execute("call", {code: '// @options: {"max_output_tokens": 100}\nstore("cursor", "next"); text("a".repeat(10000));'}, new AbortController().signal, undefined, ctx);
        expect(result.isError).toBe(true);
        expect(entries).toEqual([]);
        expect(JSON.stringify(result.content)).toContain("checkpoint was not committed");
    }, 30000);
    test("forwards a real cursor and restores committed input and cursor after reopening", async () => {
        const dir = mkdtempSync(join(tmpdir(), "tomekin-codemode-"));
        try {
            let session = SessionManager.create(dir, dir);
            session.appendMessage({role: "user", content: [{type: "text", text: "search"}], timestamp: Date.now()});
            let definition: any;
            registerCodemode({registerTool: (tool: unknown) => { definition = tool; }, appendEntry: (type: string, data: unknown) => session.appendCustomEntry(type, data), getAllTools: () => [], getSettings: () => ({})} as never);
            const inputs: any[] = [];
            const ctx = {tools: [{name: "search_cards", description: "Search", parameters: Type.Object({query: Type.String(), after: Type.Optional(Type.String())})}], sessionManager: session, executeTool: async (_name: string, args: any) => {
                inputs.push(args);
                return {toolCall: {id: "nested"}, isError: false, result: {content: [{type: "text", text: JSON.stringify({edges: [args.after ? "second" : "first"], next_cursor: args.after ? null : "opaque-😀-cursor"})}]}};
            }};
            const code = `const fixed = {query: "dragon"}; const first = JSON.parse(await tools.search_cards(fixed)); const second = JSON.parse(await tools.search_cards({...fixed, after: first.next_cursor})); text(JSON.stringify(second)); store("progress", {fixed, cursor: first.next_cursor});`;
            const first = await definition.execute("call", {code}, new AbortController().signal, undefined, ctx);
            expect(first.isError).toBeUndefined();
            expect(inputs).toEqual([{query: "dragon"}, {query: "dragon", after: "opaque-😀-cursor"}]);
            session = SessionManager.open(session.getSessionFile()!);
            ctx.sessionManager = session;
            const resumed = await definition.execute("resume", {code: 'text(JSON.stringify(load("progress")))'}, new AbortController().signal, undefined, ctx);
            expect(JSON.stringify(resumed.content)).toContain("opaque-😀-cursor");
            expect(JSON.stringify(resumed.content)).toContain("dragon");
            const failed = await definition.execute("failed", {code: 'store("progress", {cursor: "unsafe"}); throw new Error("failed")'}, new AbortController().signal, undefined, ctx);
            expect(failed.isError).toBe(true);
            const afterFailure = await definition.execute("read", {code: 'text(JSON.stringify(load("progress")))'}, new AbortController().signal, undefined, ctx);
            expect(JSON.stringify(afterFailure.content)).toContain("opaque-😀-cursor");
        } finally { rmSync(dir, {recursive: true, force: true}); }
    }, 30000);
});
