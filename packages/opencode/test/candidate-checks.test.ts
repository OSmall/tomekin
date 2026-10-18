import {expect,test} from "bun:test";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {agentToolInputJsonSchema,agentToolMutates,createTestRootLoggerFromEnv,requiredScryfallImportContractRevisions} from "@tomekin/core";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {applySqliteMigrations,openDatabase,closeDatabase,scryfallBulkDataImport,cardIdentity} from "@tomekin/sqlite";
import {createCoreTool,createPiWorkerTransport,expectedPiToolNames} from "../../pi/src/index";
import {configureAgentToolRuntimeForTests,validate_format_legality,evaluate_deck_candidate} from "../../../.opencode/tools/tomekin";

const log=createTestRootLoggerFromEnv();
const brief={format:"casual_60",goal:"Check provisional progress",powerLevel:null};
function unwrap(result:any):any{if(result.isErr())throw new Error(JSON.stringify(result.error));return result.value;}
function setup(){
    const root=mkdtempSync(join(tmpdir(),"tomekin-check-adapters-")),databasePath=join(root,"test.sqlite");
    applySqliteMigrations(databasePath,{log});
    const db=openDatabase(databasePath,{log}),now=new Date("2026-10-18T00:00:00.000Z");
    db.insert(scryfallBulkDataImport).values({id:crypto.randomUUID(),bulkDataType:"oracle_cards",importContractRevision:requiredScryfallImportContractRevisions.oracle_cards,status:"succeeded",startedAt:now,completedAt:now,sourceUpdatedAt:now,importedRecordCount:0,warningsJson:[],blockingErrorsJson:[]}).run();
    closeDatabase(db);
    return {databasePath,dispose(){rmSync(root,{recursive:true,force:true});}};
}

test("Pi serializes the closed saved/initial check union and classifies both evidence publishers as writes",()=>{
    for(const name of ["validate_format_legality","evaluate_deck_candidate"] as const){
        expect(expectedPiToolNames).toContain(name);
        expect(agentToolMutates(name)).toBe(true);
        const definition=createCoreTool(name,{log}),schema=agentToolInputJsonSchema(name);
        expect(JSON.parse(JSON.stringify(definition.parameters))).toEqual(schema);
        const alternatives=schema.anyOf as Record<string,unknown>[];
        expect(alternatives).toHaveLength(2);
        expect(alternatives[0]!.required).toEqual(["candidate_id","expected_updated_at"]);
        expect(alternatives[1]!.required).toEqual(["cards","brief"]);
        expect(alternatives.every(a=>a.additionalProperties===false)).toBe(true);
    }
});

test("OpenCode, Pi Worker and fallback publish real evidence; dispatched check writes settle after abort and session close",async()=>{
    const app=setup(),runtime=createLocalAgentToolRuntime({...app,log});
    const restore=configureAgentToolRuntimeForTests({log,createHandlers:()=>createLocalAgentToolRuntime({...app,log})});
    const transport=createPiWorkerTransport({workerUrl:new URL("../../pi/src/tomekin-worker.ts",import.meta.url).href});
    try{
        const saved=unwrap(await runtime.handlers.createDeckCandidate({label:"Provisional",brief}));
        const input={candidate_id:saved.candidate_id,expected_updated_at:saved.updated_at};
        const opencode=JSON.parse(await validate_format_legality.execute(input as never,{} as never));
        expect(opencode).toMatchObject({status:"illegal",evidence:{status:"applicable"}});
        const tool=createCoreTool("evaluate_deck_candidate",{log,transport,databasePath:app.databasePath});
        const controller=new AbortController();
        const checking=tool.execute("check",input,controller.signal);
        controller.abort();
        const closing=transport.close();
        const output=await checking as any;
        await closing;
        expect(output.details).toMatchObject({legality:{status:"illegal"},manaAndCurve:{landCount:0},evidence:{status:"applicable"}});
        expect(JSON.parse(output.content[0].text)).toEqual(JSON.parse(JSON.stringify(output.details)));
        const state=unwrap(await runtime.handlers.getDeckCandidate({id:saved.candidate_id,view:"state"}));
        expect(state.updatedAt).toBe(saved.updated_at);
        expect(state.validation_evidence.checks.deck_evaluation.status).toBe("applicable");
        const fallback=createCoreTool("validate_format_legality",{log,createRuntime:()=>createLocalAgentToolRuntime({...app,log})});
        const fallbackController=new AbortController(),pending=fallback.execute("fallback",input,fallbackController.signal);
        fallbackController.abort();
        expect((await pending as any).details.evidence.status).toBe("applicable");
        const invalid=JSON.parse(await evaluate_deck_candidate.execute({...input,cards:[]} as never,{} as never));
        expect(invalid).toMatchObject({error:"validation_error",message:expect.any(String)});
    }finally{restore();await transport.close();runtime.close();app.dispose();}
});

test("a lost real Worker check response is an unknown write outcome whose saved evidence can be inspected",async()=>{
    const app=setup(),runtime=createLocalAgentToolRuntime({...app,log});
    const transport=createPiWorkerTransport({workerUrl:new URL("../../pi/src/tomekin-worker.ts",import.meta.url).href,createWorker(url){
        const actual=new Worker(url);
        const boundary={onmessage:undefined,onerror:undefined as ((event:ErrorEvent)=>void)|undefined,postMessage:actual.postMessage.bind(actual),terminate:actual.terminate.bind(actual)};
        actual.onmessage=()=>boundary.onerror?.(new ErrorEvent("error",{message:"Lost committed check response"}));
        actual.onerror=event=>boundary.onerror?.(event);
        return boundary as unknown as Worker;
    }});
    try{
        const saved=unwrap(await runtime.handlers.createDeckCandidate({label:"Recover evidence",brief}));
        const output=await transport.invoke({toolCallId:"lost",toolName:"validate_format_legality",databasePath:app.databasePath,params:{candidate_id:saved.candidate_id,expected_updated_at:saved.updated_at}},new AbortController().signal);
        expect(output.details).toMatchObject({error:"unknown_write_outcome"});
        const state=unwrap(await runtime.handlers.getDeckCandidate({id:saved.candidate_id,view:"state"}));
        expect(state.validation_evidence.checks.format_legality).toMatchObject({status:"applicable",result:{status:"illegal"}});
        expect(state.updatedAt).toBe(saved.updated_at);
    }finally{await transport.close();runtime.close();app.dispose();}
});

test("explicit legality findings remain complete beyond the old Pi preview boundary through both actual paths",async()=>{
    const app=setup(),name="Synthetic long Card Identity ".repeat(750),id="11111111-1111-4111-8111-111111111111";
    const db=openDatabase(app.databasePath,{log});
    db.insert(cardIdentity).values({id,name,layout:"normal",manaCost:null,manaValue:0,typeLine:"Basic Land — Forest",oracleText:"{T}: Add {G}.",copyLimitOverrideKind:"unlimited",copyLimitOverrideMaximum:null,colorIdentity:"G",colors:null,colorIndicator:null,producedMana:"G",keywordsJson:[],power:null,toughness:null,loyalty:null,defense:null,edhrecRank:null,gameChanger:false,sourcePageUri:"https://scryfall.com/card/example"}).run();
    closeDatabase(db);
    const transport=createPiWorkerTransport({workerUrl:new URL("../../pi/src/tomekin-worker.ts",import.meta.url).href});
    try{
        for(const mode of ["fallback","Worker"] as const){
            const tool=createCoreTool("validate_format_legality",{log,...(mode==="Worker"?{transport,databasePath:app.databasePath}:{createRuntime:()=>createLocalAgentToolRuntime({...app,log})})});
            const output=await tool.execute(mode,{brief,cards:[{cardIdentityId:id,quantity:1,section:"commander"}]},new AbortController().signal) as any;
            expect(output.content[0].text.length).toBeGreaterThan(16000);
            expect(output.details.truncated).toBeUndefined();
            expect(JSON.parse(output.content[0].text).reasons).toContain(`${name} is in the Commander section, which is not permitted in Casual 60.`);
        }
    }finally{await transport.close();app.dispose();}
});
