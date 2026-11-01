import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createLookupFixture, log} from "./fixtures/lookup";
import {createCollectionFixture} from "./fixtures/collection";
import {id} from "./fixtures/lookup";

test("known-card research returns one continuation, including before consuming any references", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const args = {references: [{kind: "name", value: "Sol Ring"}, {kind: "name", value: "Little Girl"}], select: {oracle_id: true}};
        const zero = (await runtime.handlers.lookupCards({...args, first: 0}))._unsafeUnwrap();
        expect(zero).not.toHaveProperty("pageInfo");
        expect(zero).toHaveProperty("next_cursor", expect.any(String));
        const one = (await runtime.handlers.lookupCards({...args, first: 1, after: (zero as any).next_cursor}))._unsafeUnwrap();
        expect(one.edges[0]!.node).toMatchObject({status: "found", card: {oracle_id: expect.any(String)}});
        const last = (await runtime.handlers.lookupCards({...args, after: (one as any).next_cursor}))._unsafeUnwrap();
        expect(last).toHaveProperty("next_cursor", null);
        expect(last.edges).toHaveLength(1);
    } finally {runtime.close(); fixture.dispose();}
});

test("foil-scoped discovery trusts owned-copy filtering and exposes full policy only on inspection", async () => {
    const fixture = await createCollectionFixture();
    const runtime = createLocalAgentToolRuntime({databasePath:fixture.databasePath,log,search:{provider:{id:"fixture",async dispatch(){return {status:200,body:{object:"list",data:[{object:"card",id:id(2),oracle_id:id(1),layout:"normal",finishes:["nonfoil"]}],has_more:false}};}}}});
    try {
        const args = {q:"fixture",select:{oracle_id:true},collection_scope:{},collection_policy:{kind:"explicit",policy:{...fixture.policy,copy_requirements:{finish:["foil"]}}}};
        const result = (await runtime.handlers.searchCards(args))._unsafeUnwrap();
        expect(result.edges).toEqual([{node:{card:{oracle_id:id(1)}}}]);
        expect(result.collection_context).not.toHaveProperty("effective_policy");
        expect(result.collection_context).toHaveProperty("policy_id",expect.any(String));
        const inspect = (await runtime.handlers.searchCards({...args,include_collection_policy:true}))._unsafeUnwrap();
        expect(inspect.collection_context).toMatchObject({policy_id:(result.collection_context as any).policy_id,effective_policy:{copy_requirements:{finish:["foil"]}}});
    } finally {runtime.close();fixture.dispose();}
});

test("compact tag discovery learns all associations and can focus on named functions without annotations", async () => {
    const fixture = await createLookupFixture({tags: true, tagAnnotation: "Source detail that is unnecessary for discovery."});
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = [{kind: "name", value: "Sol Ring"}];
        const all = (await runtime.handlers.lookupCards({references, select: {tags: {mode: "compact"}}}))._unsafeUnwrap();
        expect(all.edges[0]!.node).toMatchObject({card: {tags: {
            direct: [{slug:"mana-rock",weight:"strong"},{slug:"resource",weight:"weak"}],
            inherited: [{slug:"mana",weight:"strong"}],
        }}});
        expect(JSON.stringify(all.edges)).not.toContain("annotation");
        const focused = (await runtime.handlers.lookupCards({references, select: {tags: {mode:"compact",slugs:["mana","absent"]}}}))._unsafeUnwrap();
        expect(focused.edges[0]!.node).toMatchObject({card: {tags:{direct:[],inherited:[{slug:"mana",weight:"strong"}]}}});
        const full = (await runtime.handlers.lookupCards({references, select: {tags:true}}))._unsafeUnwrap();
        expect(JSON.stringify(full.edges)).toContain("annotation");
    } finally {runtime.close(); fixture.dispose();}
});

test("lookup continuation stays bounded for large reference batches and rejects changed inputs", async () => {
    const fixture = await createLookupFixture();
    const runtime = createLocalAgentToolRuntime({databasePath: fixture.databasePath, log});
    try {
        const references = Array.from({length: 400}, () => ({kind: "name", value: "Sol Ring"}));
        const args = {references, select: {oracle_id: true}, first: 1};
        const first = (await runtime.handlers.lookupCards(args))._unsafeUnwrap();
        expect(first.next_cursor!.length).toBeLessThan(500);
        const changed = await runtime.handlers.lookupCards({...args, references: [...references, {kind: "name", value: "Little Girl"}], after: first.next_cursor});
        expect(changed._unsafeUnwrapErr().envelope.error).toMatchObject({code: "invalid_cursor", reason: "query_mismatch"});
        const resumed = (await runtime.handlers.lookupCards({...args, after: first.next_cursor}))._unsafeUnwrap();
        expect(resumed.metadata.lookup?.start_index).toBe(1);
    } finally {runtime.close(); fixture.dispose();}
});
