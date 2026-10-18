import {expect, test} from "bun:test";
import {rmSync, readFileSync} from "node:fs";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {prepareLiveParityFixture} from "../src/live-parity";
import {log} from "../src/fixtures";

test("live preparation creates matching isolated public-card databases without candidates or account access", async () => {
    const prepared = await prepareLiveParityFixture();
    try {
        expect(readFileSync(prepared.databases.pi)).toEqual(readFileSync(prepared.databases.openCode));
        for (const databasePath of Object.values(prepared.databases)) {
            const runtime = createLocalAgentToolRuntime({databasePath, log});
            try {
                const locations = (await runtime.handlers.listCollectionLocations())._unsafeUnwrap();
                expect(JSON.stringify(locations)).toContain("Parity Shelf");
                expect(JSON.stringify(locations)).toContain('"binder"');
                expect(JSON.stringify(locations)).toContain('"deck"');
                const lookup = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select: {name: true, oracle_text: true}}))._unsafeUnwrap();
                expect(lookup.edges[0]!.node).toMatchObject({status: "found", card: {name: "Sol Ring", oracle_text: "{T}: Add {C}{C}."}});
                expect((await runtime.handlers.listDeckCandidates())._unsafeUnwrap()).toEqual([]);
            } finally {runtime.close();}
        }
    } finally {rmSync(prepared.directory, {recursive: true, force: true});}
}, 30_000);
