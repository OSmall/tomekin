import {test,expect} from "bun:test";
import {tool} from "@opencode-ai/plugin";
import {createLocalAgentToolHandlers} from "@tomekin/opencode";
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
        const mismatch=JSON.parse(await tools.get_deck_candidate.execute({id:fixture.candidateId,view:"pool",after:page.pageInfo.endCursor} as never));
        expect(mismatch).toMatchObject({status:"error",edges:[],error:{code:"invalid_cursor"}});
        const rendered=JSON.parse(await tools.render_deck_candidate.execute({candidate_id:fixture.candidateId,output:"portable_decklist"} as never));
        expect(rendered.edges.map((e:any)=>typeof e.node.value==="string"?e.node.value:"").join("")).toBe("Mainboard\n1 Sol Ring\n");
    }finally{restore();fixture.dispose();}
});
