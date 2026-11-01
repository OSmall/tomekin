import {expect,test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolInputJsonSchema, reconstructCandidateView} from "@tomekin/core";
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
        expect(schema.properties.role_id).toBeDefined();
        expect(schema.properties.card_identity_id).toBeDefined();
        const filtered=await tool.execute("filtered",{id:fixture.candidateId,view:"options",card_identity_id:"00000000-0000-4000-8000-000000000001"},new AbortController().signal) as PiToolOutput;
        expect(JSON.parse(filtered.content[0]!.text)).toEqual(filtered.details);
        expect(filtered.details).toMatchObject({status:"ok"});
        expect(schema.properties.view.enum).not.toContain("state");
        let after:string|undefined;
        let description:string|undefined;
        const prefix=await tool.execute("prefix",{id:fixture.candidateId,view:"json",first:0},new AbortController().signal) as PiToolOutput;
        const firstCursor=JSON.parse(prefix.content[0]!.text).next_cursor;
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
            after=Boolean(page.next_cursor)?page.next_cursor:undefined;
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

for(const mode of ["fallback", "Worker"] as const)test(`Pi ${mode} can recover a very large escaped Unicode strategy across bounded text fragments`,async()=>{
    const fixture=await createCandidateViewFixture();
    const runtime=createLocalAgentToolRuntime({databasePath:fixture.databasePath,log});
    const transport=mode==="Worker"?createPiWorkerTransport({workerUrl:new URL("../src/tomekin-worker.ts",import.meta.url).href}):undefined;
    const tool=createCoreTool("get_deck_candidate",{log,...transport?{transport,databasePath:fixture.databasePath}:{createRuntime:()=>createLocalAgentToolRuntime({databasePath:fixture.databasePath,log})}});
    const description='🦊\\\"\n'.repeat(30000);
    try {
        const current=await runtime.handlers.getDeckCandidate({id:fixture.candidateId});
        if(current.isErr())throw new Error(current.error.message);
        const update=await runtime.handlers.editDeckCandidate({candidate_id:fixture.candidateId,expected_updated_at:(current.value as any).updated_at,changes:{plan:{schema_version:1,description},nodes:[{action:"add",node:{ref:"large",kind:"role",label:"Large",description,coverage_assessment:{summary:"No selected contributors."}}}]}});
        if(update.isErr())throw new Error(update.error.message);
        let after:string|undefined, index=0, result='';
        const records:any[]=[];
        do {
            const read=await tool.execute("large",{id:fixture.candidateId,view:"plan",first:2,...after?{after}:{}},new AbortController().signal) as PiToolOutput;
            const page=JSON.parse(read.content[0]!.text);
            expect(page).toEqual(read.details); expect(page.status).toBe("ok");
            records.push(...page.edges.map((edge:any)=>edge.node));
            expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(51200);
            for(const {node} of page.edges) if(node.kind==='text_fragment' && node.path.join('.')==='description') {
                expect(node.index).toBe(index++); result+=node.text;
                if(node.final)expect(result).toBe(description);
            }
            after=page.next_cursor??undefined;
        } while(after);
        expect(index).toBeGreaterThan(1); expect(result).toBe(description);
        expect((reconstructCandidateView(records) as any).description).toBe(description);
        const firstFragment=records.findIndex(record=>record.kind==='text_fragment');
        expect(()=>reconstructCandidateView(records.slice(0,firstFragment+1))).toThrow();
        expect(()=>reconstructCandidateView(records.filter((_,i)=>i!==firstFragment))).toThrow();
        for (const view of ["json", "report"] as const) {
            const all:any[]=[]; let cursor:string|undefined;
            do {
                const output=await tool.execute("full",{id:fixture.candidateId,view,first:200,...cursor?{after:cursor}:{}},new AbortController().signal) as PiToolOutput;
                const page=JSON.parse(output.content[0]!.text);
                expect(page.status).toBe("ok"); expect(Buffer.byteLength(output.content[0]!.text)).toBeLessThanOrEqual(51200);
                all.push(...page.edges.map((edge:any)=>edge.node)); cursor=page.next_cursor??undefined;
            } while(cursor);
            const reconstructed:any=reconstructCandidateView(all);
            if(view==="json") {expect(reconstructed.plan.description).toBe(description); expect(reconstructed.plan.nodes.find((node:any)=>node.label==="Large").description).toBe(description);}
            else expect(reconstructed.join("")).toContain(description);
        }
    } finally {await transport?.close();runtime.close();fixture.dispose();}
});
