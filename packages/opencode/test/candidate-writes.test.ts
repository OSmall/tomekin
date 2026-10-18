import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestRootLoggerFromEnv } from "@tomekin/core";
import { createLocalAgentToolRuntime } from "@tomekin/agent";
import { applySqliteMigrations } from "@tomekin/sqlite";
import { createCoreTool, createPiWorkerTransport } from "../../pi/src/index";
import {
    create_deck_candidate,
    edit_deck_candidate,
    configureAgentToolRuntimeForTests,
    get_deck_candidate,
} from "../../../.opencode/tools/tomekin";
const log = createTestRootLoggerFromEnv();
const brief = {
    format: "casual_60",
    goal: "Recover interrupted construction",
    powerLevel: null,
};
function unwrap(result: any): any {
    if (result.isErr()) throw new Error(JSON.stringify(result.error));
    return result.value;
}
function setup() {
    const root = mkdtempSync(join(tmpdir(), "tomekin-write-recovery-"));
    const databasePath = join(root, "test.sqlite");
    applySqliteMigrations(databasePath, { log });
    return {
        databasePath,
        dispose() {
            rmSync(root, { recursive: true, force: true });
        },
    };
}
test("unknown create and edit Worker outcomes are inspectable before reconciliation", async () => {
    const app = setup();
    const runtime = createLocalAgentToolRuntime({ ...app, log });
    // Inject a lost response at the Worker boundary after the real Worker has committed.
    const transport = createPiWorkerTransport({
        workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url)
            .href,
        createWorker(url) {
            const actual = new Worker(url);
            const boundary = {
                onmessage: undefined,
                onerror: undefined as ((event: ErrorEvent) => void) | undefined,
                postMessage: actual.postMessage.bind(actual),
                terminate: actual.terminate.bind(actual),
            };
            actual.onmessage = () =>
                boundary.onerror?.(
                    new ErrorEvent("error", {
                        message: "Injected lost write response",
                    }),
                );
            actual.onerror = (event) => boundary.onerror?.(event);
            return boundary as unknown as Worker;
        },
    });
    try {
        const created = await transport.invoke(
            {
                toolCallId: "create",
                toolName: "create_deck_candidate",
                databasePath: app.databasePath,
                params: { label: "Recoverable label", brief },
            },
            new AbortController().signal,
        );
        expect(created.details).toMatchObject({
            error: "unknown_write_outcome",
        });
        const matches = unwrap(
            await runtime.handlers.listDeckCandidates(),
        ).filter((c: any) => c.label === "Recoverable label");
        expect(matches).toHaveLength(1);
        const baseline = unwrap(
            await runtime.handlers.getDeckCandidate({
                id: matches[0].candidate_id,
                view: "state",
            }),
        );
        expect(baseline.brief.goal).toBe(brief.goal);
        const input = {
            candidate_id: baseline.id,
            expected_updated_at: baseline.updatedAt,
            changes: { label: "Recovered edit" },
        };
        const edited = await transport.invoke(
            {
                toolCallId: "edit",
                toolName: "edit_deck_candidate",
                databasePath: app.databasePath,
                params: input,
            },
            new AbortController().signal,
        );
        expect(edited.details).toMatchObject({
            error: "unknown_write_outcome",
        });
        const inspected = unwrap(
            await runtime.handlers.getDeckCandidate({
                id: baseline.id,
                view: "state",
            }),
        );
        expect(inspected.label).toBe("Recovered edit");
        expect(inspected.updatedAt).not.toBe(baseline.updatedAt);
        const blindRetry = await runtime.handlers.editDeckCandidate(input);
        expect(blindRetry.isErr()).toBe(true);
        if (blindRetry.isErr()) expect(blindRetry.error.type).toBe("conflict");
        // A label is useful recovery context, not an idempotency or uniqueness key.
        unwrap(
            await runtime.handlers.createDeckCandidate({
                label: "Recovered edit",
                brief,
            }),
        );
        expect(
            unwrap(await runtime.handlers.listDeckCandidates()).filter(
                (c: any) => c.label === "Recovered edit",
            ),
        ).toHaveLength(2);
    } finally {
        await transport.close();
        runtime.close();
        app.dispose();
    }
});
test("OpenCode and real Pi Worker expose create/edit and preserve exact conflict context", async () => {
    const app = setup();
    const reset = configureAgentToolRuntimeForTests({
        log,
        createHandlers: ({ log }) =>
            createLocalAgentToolRuntime({
                databasePath: app.databasePath,
                log,
            }),
    });
    const transport = createPiWorkerTransport({
        workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url)
            .href,
    });
    try {
        const created = JSON.parse(
            await create_deck_candidate.execute(
                { label: "Adapter candidate", brief } as never,
                {} as never,
            ),
        );
        const tool = createCoreTool("edit_deck_candidate", {
            log,
            transport,
            databasePath: app.databasePath,
        });
        const controller = new AbortController();
        const pending = tool.execute(
            "edit",
            {
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: { label: "Through Pi" },
            },
            controller.signal,
        );
        controller.abort();
        const edited = (await pending) as any;
        expect(edited.details.candidate_id).toBe(created.candidate_id);
        expect(edited.details.updated_at).not.toBe(created.updated_at);
        const conflict = JSON.parse(
            await edit_deck_candidate.execute(
                {
                    candidate_id: created.candidate_id,
                    expected_updated_at: created.updated_at,
                    changes: { label: "Stale" },
                } as never,
                {} as never,
            ),
        );
        expect(conflict).toMatchObject({
            error: "conflict",
            expected_updated_at: created.updated_at,
            current_updated_at: edited.details.updated_at,
            candidate_id: created.candidate_id,
        });
        const piConflict = (await tool.execute(
            "stale",
            {
                candidate_id: created.candidate_id,
                expected_updated_at: created.updated_at,
                changes: { label: "Stale" },
            },
            new AbortController().signal,
        )) as any;
        expect(piConflict.details).toMatchObject({
            error: "conflict",
            expected_updated_at: created.updated_at,
            current_updated_at: edited.details.updated_at,
        });
        const read = JSON.parse(
            await get_deck_candidate.execute(
                { id: created.candidate_id } as never,
                {} as never,
            ),
        );
        expect(read.label).toBe("Through Pi");
    } finally {
        reset();
        await transport.close();
        app.dispose();
    }
});

test("explicit candidate state survives Pi Worker and fallback without irreversible output clipping", async () => {
    const app = setup();
    const runtime = createLocalAgentToolRuntime({ ...app, log });
    const transport = createPiWorkerTransport({
        workerUrl: new URL("../../pi/src/tomekin-worker.ts", import.meta.url)
            .href,
    });
    try {
        const description = "Complete current reasoning 😀 ".repeat(1000);
        const created = unwrap(
            await runtime.handlers.createDeckCandidate({
                label: "Long reasoning",
                brief,
                plan: { schema_version: 1, description },
            }),
        );
        const tool = createCoreTool("get_deck_candidate", {
            log,
            transport,
            databasePath: app.databasePath,
        });
        const output = (await tool.execute(
            "read",
            { id: created.candidate_id, view: "state" },
            new AbortController().signal,
        )) as any;
        expect(output.details.truncated).toBeUndefined();
        expect(JSON.parse(output.content[0].text).plan.description).toBe(
            description,
        );
        const fallback = createCoreTool("get_deck_candidate", {
            log,
            createRuntime: () => createLocalAgentToolRuntime({ ...app, log }),
        });
        const local = (await fallback.execute(
            "read",
            { id: created.candidate_id, view: "state" },
            new AbortController().signal,
        )) as any;
        expect(local.details.truncated).toBeUndefined();
        expect(JSON.parse(local.content[0].text).plan.description).toBe(
            description,
        );
    } finally {
        await transport.close();
        runtime.close();
        app.dispose();
    }
});
