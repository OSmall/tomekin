import {test,expect} from "bun:test";
import {tool} from "@opencode-ai/plugin";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {reconstructCandidateView} from "@tomekin/core";
import * as tools from "../../../.opencode/tools/tomekin";
import {createCandidateViewFixture,completeCandidateDescription} from "../../agent/test/fixtures/candidate-views";
import {log} from "../../agent/test/fixtures/lookup";
test("actual OpenCode candidate schema and output expose complete recoverable views and saved rendering",async()=>{
    const fixture=await createCandidateViewFixture();
    const restore=tools.configureAgentToolRuntimeForTests({log,createHandlers:options=>createLocalAgentToolHandlers({...options,databasePath:fixture.databasePath})});
    try{
        const schema=tool.schema.toJSONSchema(tool.schema.object(tools.get_deck_candidate.args));
        expect((schema.properties as any).view.enum).toContain("json");
        const renderSchema=tool.schema.toJSONSchema(tool.schema.object(tools.render_deck_candidate.args));
        expect((renderSchema.properties as any)).toHaveProperty("candidate_id");
        expect((renderSchema.properties as any)).not.toHaveProperty("sections");
        const output=await tools.get_deck_candidate.execute({id:fixture.candidateId,view:"json",first:200} as never);
        const page=JSON.parse(output);
        expect(Buffer.byteLength(output)).toBeGreaterThan(16000);
        expect(Buffer.byteLength(output)).toBeLessThanOrEqual(51200);
        expect(page.edges.find((e:any)=>e.node.path.join(".")==="plan.description").node.value).toBe(completeCandidateDescription);
        expect(page).not.toHaveProperty("truncated");
        const prefix=JSON.parse(await tools.get_deck_candidate.execute({id:fixture.candidateId,view:"json",first:0} as never));
        const mismatch=JSON.parse(await tools.get_deck_candidate.execute({id:fixture.candidateId,view:"pool",after:prefix.next_cursor} as never));
        expect(mismatch).toMatchObject({status:"error",edges:[],error:{code:"invalid_cursor"}});
        const rendered=JSON.parse(await tools.render_deck_candidate.execute({candidate_id:fixture.candidateId,output:"portable_decklist"} as never));
        expect(rendered.edges.map((e:any)=>typeof e.node.value==="string"?e.node.value:"").join("")).toBe("Mainboard\n1 Sol Ring\n");
    }finally{restore();fixture.dispose();}
});


test("OpenCode recovers a fragmented escaped strategy",async()=>{
    const fixture=await createCandidateViewFixture();
    const runtime=createLocalAgentToolRuntime({databasePath:fixture.databasePath,log});
    const restore=tools.configureAgentToolRuntimeForTests({log,createHandlers:options=>createLocalAgentToolHandlers({...options,databasePath:fixture.databasePath})});
    const description='🦊\\"\n'.repeat(18000);
    try {
        const summary=await runtime.handlers.getDeckCandidate({id:fixture.candidateId});
        if(summary.isErr())throw new Error(summary.error.message);
        const update=await runtime.handlers.editDeckCandidate({candidate_id:fixture.candidateId,expected_updated_at:(summary.value as any).updated_at,changes:{plan:{schema_version:1,description}}});
        if(update.isErr())throw new Error(update.error.message);
        let after:string|undefined; const records:any[]=[];
        do {
            const output=await tools.get_deck_candidate.execute({id:fixture.candidateId,view:"json",first:20,...after?{after}:{}} as never);
            const page=JSON.parse(output); expect(page.status).toBe("ok");
            expect(Buffer.byteLength(output)).toBeLessThanOrEqual(51200);
            records.push(...page.edges.map((edge:any)=>edge.node)); after=page.next_cursor??undefined;
        } while(after);
        expect((reconstructCandidateView(records) as any).plan.description).toBe(description);
    } finally {restore();runtime.close();fixture.dispose();}
});
