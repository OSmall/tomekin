import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {
    agentToolInputJsonSchema,
    createProviderDispatchOwner,
} from "@tomekin/core";
import {
    createCoreTool,
    createPiWorkerTransport,
    type PiToolOutput,
} from "@tomekin/pi";
import {createLookupFixture, log, id} from "../../agent/test/fixtures/lookup";
const text = 'Complete 語 "quoted"\n'.repeat(1000);
const body = {
    object: "list",
    data: [
        {
            object: "card",
            id: id(101),
            oracle_id: id(1),
            layout: "adventure",
            oracle_text: null,
            card_faces: [
                {name: "First", oracle_text: text},
                {name: "Second", oracle_text: "Complete second part"},
            ],
        },
    ],
    has_more: false,
    total_cards: 1,
};
for (const mode of ["fallback", "Worker"] as const)
    test(`Pi ${mode} search preserves complete face text and structured provider errors`, async () => {
        const fixture = await createLookupFixture({ready: false});
        let status = 200;
        const provider = {
            id: "scryfall",
            async dispatch() {
                return {status, body};
            },
        };
        const transport =
            mode === "Worker"
                ? createPiWorkerTransport({
                      workerUrl: new URL(
                          "../src/tomekin-worker.ts",
                          import.meta.url,
                      ).href,
                      provider,
                  })
                : undefined;
        const definition = createCoreTool("search_cards", {
            log,
            ...(transport
                ? {transport, databasePath: fixture.databasePath}
                : {
                      createRuntime: () =>
                          createLocalAgentToolRuntime({
                              databasePath: fixture.databasePath,
                              log,
                              search: {provider},
                          }),
                  }),
        });
        try {
            expect(JSON.parse(JSON.stringify(definition.parameters))).toEqual(
                agentToolInputJsonSchema("search_cards"),
            );
            const args = {q: "fixture", select: {oracle_text: true}};
            const result = (await definition.execute(
                "complete",
                args,
                new AbortController().signal,
            )) as PiToolOutput;
            expect(result.content[0]!.text.length).toBeGreaterThan(16000);
            expect(
                Buffer.byteLength(result.content[0]!.text),
            ).toBeLessThanOrEqual(51200);
            expect(JSON.parse(result.content[0]!.text)).toEqual(result.details);
            expect(
                (result.details as any).edges[0].node.card.card_faces[0]
                    .oracle_text,
            ).toBe(text);
            status = 429;
            const failed = (await definition.execute(
                "limited",
                args,
                new AbortController().signal,
            )) as PiToolOutput;
            expect(failed.details).toMatchObject({
                status: "error",
                error: {
                    code: "rate_limited",
                    retry_after_ms: 31000,
                    cursor: expect.any(String),
                },
            });
            expect(JSON.parse(failed.content[0]!.text)).toEqual(failed.details);
        } finally {
            await transport?.close();
            fixture.dispose();
        }
    });
test("a detached production Worker request observes 429 in its host owner and replacement respects cooldown", async () => {
    const fixture = await createLookupFixture({ready: false});
    let time = 0,
        started!: () => void,
        respond!: (value: any) => void;
    const began = new Promise<void>((resolve) => {
        started = resolve;
    });
    const starts: number[] = [];
    const provider = createProviderDispatchOwner({
        now: () => time,
        wallNow: () => time,
        wait: async (ms) => {
            time += ms;
        },
        dispatch: async () => {
            starts.push(time);
            if (starts.length === 1) {
                started();
                return new Promise((resolve) => {
                    respond = resolve;
                });
            }
            return {status: 200, body};
        },
    });
    const transport = createPiWorkerTransport({
        workerUrl: new URL("../src/tomekin-worker.ts", import.meta.url).href,
        provider,
    });
    try {
        const tool = createCoreTool("search_cards", {
            log,
            transport,
            databasePath: fixture.databasePath,
        });
        const controller = new AbortController();
        const pending = tool.execute(
            "old",
            {q: "fixture", select: {oracle_id: true}},
            controller.signal,
        );
        await began;
        controller.abort();
        expect(((await pending) as PiToolOutput).details).toMatchObject({
            status: "error",
            error: {code: "cancelled"},
        });
        time = 1000;
        respond({status: 429, body: null, retryAfterMs: 60000});
        const replacement = (await tool.execute(
            "new",
            {q: "fixture", select: {oracle_id: true}},
            new AbortController().signal,
        )) as PiToolOutput;
        expect(replacement.details).toMatchObject({status: "ok"});
        expect(starts).toEqual([0, 61000]);
    } finally {
        await transport.close();
        fixture.dispose();
    }
});
