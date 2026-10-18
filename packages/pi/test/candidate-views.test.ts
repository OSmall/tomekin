import {expect,test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolInputJsonSchema} from "@tomekin/core";
import {createCoreTool,createPiWorkerTransport,type PiToolOutput} from "@tomekin/pi";
import {createCandidateViewFixture,completeCandidateDescription} from "../../agent/test/fixtures/candidate-views";
import {log} from "../../agent/test/fixtures/lookup";
for(const mode of ["fallback","Worker"] as const)test(`Pi ${mode} preserves complete candidate view pages beyond its old preview and structured stale errors`,async()=>{
    const fixture=await createCandidateViewFixture();
    const transport=mode==="Worker"?createPiWorkerTransport({workerUrl:new URL("../src/tomekin-worker.ts",import.meta.url).href}):undefined;
    const tool=createCoreTool("get_deck_candidate",{log,...transport?{transport,databasePath:fixture.databasePath}:{createRuntime:()=>createLocalAgentToolRuntime({databasePath:fixture.databasePath,log})}});
    try{
        const schema=JSON.parse(JSON.stringify(tool.parameters));
        expect(schema).toEqual(agentToolInputJsonSchema("get_deck_candidate"));
        expect(schema.properties.view.enum).toContain("pool");
        expect(schema.properties.view.enum).not.toContain("state");
        let after:string|undefined;
        let description:string|undefined;
        let firstCursor:string|undefined;
        let sawLarge=false;
        do{
            const output=await tool.execute("page",{id:fixture.candidateId,view:"json",first:200,...after?{after}:{}},new AbortController().signal) as PiToolOutput;
            const page=JSON.parse(output.content[0]!.text);
            expect(page).toEqual(output.details);
            expect(page.status).toBe("ok");
            expect(page).not.toHaveProperty("truncated");
            expect(Buffer.byteLength(output.content[0]!.text)).toBeLessThanOrEqual(51200);
            sawLarge ||= output.content[0]!.text.length>16000;
            description??=page.edges.find((e:any)=>e.node.path.join(".")==="plan.description")?.node.value;
            firstCursor??=page.pageInfo.endCursor;
            after=page.pageInfo.hasNextPage?page.pageInfo.endCursor:undefined;
        }while(after);
        expect(sawLarge).toBe(true);
        expect(description).toBe(completeCandidateDescription);
        const runtime=createLocalAgentToolRuntime({databasePath:fixture.databasePath,log});
        try{
            const read=await runtime.handlers.getDeckCandidate({id:fixture.candidateId});
            const updated_at=(read as any).value.updated_at;
            await runtime.handlers.editDeckCandidate({candidate_id:fixture.candidateId,expected_updated_at:updated_at,changes:{label:"Changed baseline"}});
        }finally{runtime.close();}
        const stale=await tool.execute("stale",{id:fixture.candidateId,view:"json",after:firstCursor},new AbortController().signal) as PiToolOutput;
        expect(JSON.parse(stale.content[0]!.text)).toEqual(stale.details);
        expect(stale.details).toMatchObject({status:"error",edges:[],error:{code:"stale_cursor",recovery:"restart"}});
    }finally{await transport?.close();fixture.dispose();}
});
