import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {agentToolResultDetails, serializeAgentToolDetails} from "@tomekin/core";
import {createCoreTool, createPiWorkerTransport, type PiToolOutput} from "@tomekin/pi";
import {resultToOpencodeOutput} from "@tomekin/opencode";
import {cardIdentityTag, cardIdentityTagging, cardIdentityTagHierarchy, collectionImport, collectionState, openDatabase, closeDatabase} from "@tomekin/sqlite";
import {getEncoding} from "js-tiktoken";
import {deflateRawSync, inflateRawSync} from "node:zlib";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createFixture, fixtureRevision, id, log} from "./fixtures";

// These are text counts under a declared encoding, not provider billing or hidden prompt usage.
const tokenizer = getEncoding("o200k_base");
export const textTokens = (text: string): number => tokenizer.encode(text, [], []).length;
const bytes = (text: string) => Buffer.byteLength(text,"utf8");
type Page = {status:string; edges:{node:{status?:string; card:Record<string,any>;collection_evidence?:unknown}}[]; next_cursor?:string|null;pageInfo?:{hasNextPage:boolean;startCursor:string|null;endCursor:string|null};collection_context?:unknown;error?:unknown};
type Observation = {stage:string;tool:string;request:string;outputs:Record<string,string>;page:Page};
const cursorOf = (page: Page): string | null => page.next_cursor ?? (page.pageInfo?.hasNextPage ? page.pageInfo.endCursor : null);

/** Matched synthetic research, with a literal contender set rather than a deck-quality algorithm. */
export async function runEconomyEvaluation({staged = true, adapters = true} = {}) {
    const fixture = createFixture("discovery");
    const db = openDatabase(fixture.databasePath,{log});
    try {
        db.insert(collectionImport).values({id:id(980),status:"succeeded",importedAt:new Date("2026-10-18T00:00:00Z"),sourceFormat:"manabox_collection_csv",sourceLabel:"synthetic-economy",importedOwnedCardRows:10,totalOwnedCardQuantity:14,importedBinderCount:2,inferredExistingDeckCount:1}).run();
        db.insert(collectionState).values({singleton:1,activeImportId:id(980)}).run();
        for (const [i,slug] of ["draw","resource"].entries()) db.insert(cardIdentityTag).values({id:id(970+i),slug,label:slug,description:null,sourcePageUri:"https://example.invalid/tag"}).run();
        db.insert(cardIdentityTagHierarchy).values({parentTagId:id(971),childTagId:id(970)}).run();
        for(let n=1;n<=12;n++) db.insert(cardIdentityTagging).values({tagId:id(970),cardIdentityId:id(n),weight:"strong",annotation:"Synthetic optional source annotation. ".repeat(20)}).run();
    } finally {closeDatabase(db);}
    const source = Array.from({length:12},(_,i)=>({object:"card",id:id(100+i),oracle_id:id(1+i),name:`Synthetic ${String(i+1).padStart(3,"0")} — Æ`,layout:"normal",cmc:1,oracle_text:i===0?"Draw a card. ".repeat(100):"Draw a card."}));
    const provider = {id:"scryfall",async dispatch(raw:string){const url=new URL(raw),page=Number(url.searchParams.get("page")??1),offset=(page-1)*4,next=new URL(url);next.searchParams.set("page",String(page+1));return {status:200,body:{object:"list",data:source.slice(offset,offset+4),has_more:offset+4<source.length,...(offset+4<source.length?{next_page:next.href}:{}),total_cards:12}};}};
    const runtime = createLocalAgentToolRuntime({databasePath:fixture.databasePath,log,search:{provider}});
    const transport = adapters ? createPiWorkerTransport({workerUrl:new URL("../../pi/src/tomekin-worker.ts",import.meta.url).href,provider}) : undefined;
    const observations:Observation[]=[];
    const observe = async (stage:string,tool:"search_cards"|"lookup_cards",input:Record<string,unknown>) => {
        const result = await (tool==="search_cards"?runtime.handlers.searchCards(input):runtime.handlers.lookupCards(input));
        const page=agentToolResultDetails(result) as Page;
        if(page.status!=="ok") throw new Error(JSON.stringify(page));
        const outputs:Record<string,string>={application:serializeAgentToolDetails(page)};
        if(adapters){
            outputs.opencode=resultToOpencodeOutput<unknown>(result);
            const fallback=createCoreTool(tool,{log,createRuntime:()=>createLocalAgentToolRuntime({databasePath:fixture.databasePath,log,search:{provider}})});
            outputs.pi_fallback=((await fallback.execute("economy",input,new AbortController().signal)) as PiToolOutput).content[0]!.text;
            const worker=createCoreTool(tool,{log,transport:transport!,databasePath:fixture.databasePath});
            outputs.pi_worker=((await worker.execute("economy",input,new AbortController().signal)) as PiToolOutput).content[0]!.text;
            for(const [surface,text] of Object.entries(outputs)) if(text!==outputs.application) throw new Error(`${surface} changed the complete model-visible envelope`);
        }
        observations.push({stage,tool,request:JSON.stringify(input),outputs,page});
        return page;
    };
    try {
        const policy={kind:"explicit",policy:{confirmed:true,collection_import_id:id(980),allowed_locations:[{type:"binder",name:"Allowed 1"},{type:"binder",name:"Allowed 2"}]}};
        const request={q:"fixture:synthetic",unique:"cards",first:3,collection_scope:{},collection_policy:policy,select:staged?{oracle_id:true,mana_value:true,tags:{mode:"compact"}}:{oracle_id:true,mana_value:true,tags:true,oracle_text:true},...(!staged?{collection_evidence:{mode:"summary"}}:{})};
        let after:string|null=null;
        do {const page=await observe("discovery","search_cards",{...request,...(after?{after}:{})});after=cursorOf(page);}while(after);
        const discovery=observations.flatMap(o=>o.page.edges.map(e=>e.node.card));
        const expected=Array.from({length:8},(_,i)=>id(i+1));
        if(JSON.stringify(discovery.map(c=>c.oracle_id))!==JSON.stringify(expected)) throw new Error("Discovery coverage changed");
        for(const card of discovery) if(card.mana_value!==1 || card.tags.direct[0]?.slug!=="draw" || card.tags.direct[0]?.weight!=="strong" || card.tags.inherited[0]?.slug!=="resource") throw new Error("Required compact discovery facts changed");
        // Fixed by the measurement protocol; this is not a recommendation or shortlist policy.
        const contenders=[id(1),id(3)];
        if(staged) await observe("contender_rules","lookup_cards",{references:contenders.map(value=>({kind:"oracle_id",value})),select:{oracle_text:true}});
        const cards=observations.flatMap(o=>o.page.edges.map(e=>e.node.card));
        const rules=contenders.map(oracle=>({oracle_id:oracle,oracle_text:cards.find(c=>c.oracle_id===oracle && "oracle_text" in c)?.oracle_text}));
        if(rules[0]?.oracle_text!=="Draw a card. ".repeat(100)||rules[1]?.oracle_text!=="Draw a card.") throw new Error("Contender rules were lost");
        const counts = (surface:string) => {
            const requestTokens=observations.reduce((n,o)=>n+textTokens(o.request),0);
            const responseTokens=observations.reduce((n,o)=>n+textTokens(o.outputs[surface]!),0);
            return {requestTokens,responseTokens,totalTokens:requestTokens+responseTokens,responseBytes:observations.reduce((n,o)=>n+bytes(o.outputs[surface]!),0)};
        };
        const cursors=observations.flatMap(o=>o.page.next_cursor?[o.page.next_cursor]:o.page.pageInfo?[o.page.pageInfo.startCursor,o.page.pageInfo.endCursor].filter((s):s is string=>s!==null):[]);
        const parts={cursors:cursors.reduce((n,s)=>n+textTokens(JSON.stringify(s)),0),collectionContext:observations.reduce((n,o)=>n+(o.page.collection_context?textTokens(JSON.stringify(o.page.collection_context)):0),0),collectionEvidence:observations.reduce((n,o)=>n+o.page.edges.reduce((m,e)=>m+(e.node.collection_evidence?textTokens(JSON.stringify(e.node.collection_evidence)):0),0),0)};
        const hydrated=cards.filter(c=>"oracle_text" in c).map(c=>c.oracle_id);
        const encodings=cursors.filter(s=>s.startsWith("2.")).map(token=>{
            const raw=inflateRawSync(Buffer.from(token.slice(2),"base64url")).toString("utf8");
            return {positionalJson:textTokens(JSON.stringify(raw)),base64url:textTokens(JSON.stringify(Buffer.from(raw).toString("base64url"))),deflated:textTokens(JSON.stringify(`2.${deflateRawSync(raw).toString("base64url")}`))};
        });
        return {protocol:"economical-research-v1",fixtureRevision,fixtureSha256:createHash("sha256").update(readFileSync(new URL("./fixtures.ts",import.meta.url))).digest("hex"),tokenizer:{package:"js-tiktoken",version:"1.0.21",encoding:"o200k_base",scope:"serialized tool arguments and model-visible text only; not billed/session usage"},staged,calls:observations.length,requiredFacts:{identities:expected,contenderRules:rules},surfaces:Object.fromEntries(Object.keys(observations[0]!.outputs).map(s=>[s,counts(s)])),componentTokens:parts,componentsAreIndependentlyTokenized:true,identityOccurrences:cards.length,repeatedIdentities:cards.length-new Set(cards.map(c=>c.oracle_id)).size,hydratedOccurrences:hydrated.length,repeatedHydratedFacts:hydrated.length-new Set(hydrated).size,maxCursorCharacters:Math.max(0,...cursors.map(s=>s.length)),encodingComparison:encodings,modelRun:false};
    } finally {runtime.close();await transport?.close();fixture.dispose();}
}

if(import.meta.main) console.log(JSON.stringify(await runEconomyEvaluation({staged:!process.argv.includes("--rich"),adapters:!process.argv.includes("--application-only")}),null,2));
