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
                expect(locations.collection_context.state).toBe("ready");
                expect(locations.locations.map(({type, name}) => ({type, name}))).toEqual([
                    {type: "binder", name: "Parity Shelf"}, {type: "deck", name: "Parity Shelf"},
                ]);
                const importId = locations.collection_context.collection_import_id!;
                const owned = (await runtime.handlers.browseCollectionCards({collection_import_id: importId, policy: {kind: "explicit", policy: {confirmed: true, collection_import_id: importId, allowed_locations: [{type: "binder", name: "Parity Shelf"}]}}, select: {quantity: true}, first: 50}))._unsafeUnwrap();
                expect(owned.edges).toHaveLength(6);
                expect(owned.edges.reduce((sum, edge) => sum + edge.node.quantity!, 0)).toBe(8);
                const lookup = (await runtime.handlers.lookupCards({references: [{kind: "name", value: "Sol Ring"}], select: {name: true, oracle_text: true}}))._unsafeUnwrap();
                expect(lookup.edges[0]!.node).toMatchObject({status: "found", card: {name: "Sol Ring", oracle_text: "{T}: Add {C}{C}."}});
                expect((await runtime.handlers.listDeckCandidates())._unsafeUnwrap()).toEqual([]);
            } finally {runtime.close();}
        }
    } finally {rmSync(prepared.directory, {recursive: true, force: true});}
}, 30_000);


test("separate preparations preserve the same public sources and synthetic rows in new directories", async () => {
    const first = await prepareLiveParityFixture();
    let second: Awaited<ReturnType<typeof prepareLiveParityFixture>> | undefined;
    try {
        second = await prepareLiveParityFixture();
        expect(first.directory).not.toBe(second.directory);
        expect(first.sources).toEqual(second.sources);
        expect(readFileSync(first.collectionCsv, "utf8")).toBe(readFileSync(second.collectionCsv, "utf8"));
    } finally {
        rmSync(first.directory, {recursive: true, force: true});
        if (second) rmSync(second.directory, {recursive: true, force: true});
    }
}, 30_000);
