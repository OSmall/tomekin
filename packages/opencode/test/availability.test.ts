import {expect,test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolInputJsonSchema,agentToolMutates} from "@tomekin/core";
import {createCoreTool,createPiWorkerTransport,expectedPiToolNames} from "../../pi/src/index";
import {createCollectionFixture} from "../../agent/test/fixtures/collection";
import {id,log} from "../../agent/test/fixtures/lookup";
import {check_collection_availability,configureAgentToolRuntimeForTests} from "../../../.opencode/tools/tomekin";

test("Availability exposes closed public check inputs and settles complete structured evidence through OpenCode and actual Pi Worker/fallback",async()=>{
    const f=await createCollectionFixture(),restore=configureAgentToolRuntimeForTests({log,createHandlers:()=>createLocalAgentToolRuntime({databasePath:f.databasePath,log})});
    const transport=createPiWorkerTransport({workerUrl:new URL("../../pi/src/tomekin-worker.ts",import.meta.url).href});
    try{
        expect(expectedPiToolNames).toContain("check_collection_availability");expect(agentToolMutates("check_collection_availability")).toBe(true);
        const schema:any=agentToolInputJsonSchema("check_collection_availability");expect(schema.anyOf).toHaveLength(2);expect(schema.anyOf.every((a:any)=>a.additionalProperties===false&&a.properties.requirements)).toBe(true);
        const input={brief:{format:"casual_60",goal:"Assemble",powerLevel:null,collectionAccessPolicy:f.policy},cards:[{cardIdentityId:id(1),section:"mainboard",quantity:7}],requirements:[{oracle_id:id(1),section:"mainboard",quantity:7,copy_requirements:{printing_ids:[id(2)]}}],first:2};
        const open=JSON.parse(await check_collection_availability.execute(input as never,{} as never));expect(open).toMatchObject({status:"ok",check_completion:"complete",evidence:{status:"transient"},summary:{owned:6,eligible:2,missing_owned:1,policy_shortfall:4}});
        for(const mode of ["Worker","fallback"] as const){
            const tool=createCoreTool("check_collection_availability",{log,...mode==="Worker"?{transport,databasePath:f.databasePath}:{createRuntime:()=>createLocalAgentToolRuntime({databasePath:f.databasePath,log})}});
            expect(JSON.parse(JSON.stringify(tool.parameters))).toEqual(schema);
            const controller=new AbortController(),pending=tool.execute(mode,input,controller.signal);controller.abort();
            const output:any=await pending;expect(JSON.parse(output.content[0].text)).toEqual(JSON.parse(JSON.stringify(output.details)));expect(output.details).toMatchObject({status:"ok",check_completion:"complete",summary:{owned:6,eligible:2}});expect(Buffer.byteLength(output.content[0].text)).toBeLessThanOrEqual(51200);
            const stale:any=await tool.execute("stale",{...input,cards:[{...input.cards[0],quantity:8}],requirements:[{...input.requirements[0],quantity:8}],after:output.details.pageInfo.endCursor},new AbortController().signal);expect(stale.details).toMatchObject({status:"error",edges:[],error:{code:"stale_cursor"}});
        }
    }finally{restore();await transport.close();f.dispose();}
});
