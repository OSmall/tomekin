import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {openDatabase,closeDatabase,collectionImport,collectionState,cardIdentityTag,cardIdentityTagging} from "@tomekin/sqlite";
import {copyFileSync,mkdtempSync,writeFileSync,openSync,closeSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawn} from "node:child_process";
import {createFixture,id,log} from "./fixtures";
import {withEconomyBaseline,economyBaselineReference} from "./economy-baseline";

const root=resolve(import.meta.dir,"../../..");
const cards=[
    [1,"Feast Reader","As an additional cost to cast this spell, sacrifice a creature. Draw two cards.",["synthetic-feast","synthetic-access"]],
    [2,"Focused Reader","Draw two cards.",["synthetic-access"]],
    [3,"Feast Outlet","Sacrifice another creature: You gain 1 life.",["synthetic-feast","synthetic-sacrifice"]],
    [4,"Feast Reward","Whenever another creature you control dies, each opponent loses 1 life.",["synthetic-feast","synthetic-reward"]],
    [5,"Misleading Seed","When this enters, look at the top card of your library. Put it on the bottom.",["synthetic-feast","synthetic-access"]],
    [6,"Patient Supplier","{2}: Create a 1/1 colorless creature token.",["synthetic-fodder","synthetic-sacrifice"]],
    [25,"Synthetic Meadow","{T}: Add {G}.",["synthetic-mana"]],
] as const;

/** Fresh isolated copies; all cards, tags and ownership are explicitly synthetic. No model call. */
export async function prepareEconomyLive() {
    const fixture=createFixture("construction");
    const directory=mkdtempSync(join(tmpdir(),"tomekin-economy-live-"));
    const db=openDatabase(fixture.databasePath,{log});
    try {
        db.insert(collectionImport).values({id:id(980),status:"succeeded",importedAt:new Date("2026-10-18Z"),sourceFormat:"manabox_collection_csv",sourceLabel:"synthetic-live-economy",importedOwnedCardRows:28,totalOwnedCardQuantity:100,importedBinderCount:2}).run();
        db.insert(collectionState).values({singleton:1,activeImportId:id(980)}).run();
        const slugs=[...new Set(cards.flatMap(c=>[...c[3]]))];
        for(const [n,slug] of slugs.entries()) db.insert(cardIdentityTag).values({id:id(500+n),slug,label:slug,description:"Synthetic evaluation association; inspect card rules for fit.",sourcePageUri:"https://example.invalid/synthetic"}).run();
        for(const [number,name,text,tags] of cards){
            db.$client.prepare("UPDATE card_identity SET name=?,oracle_text=?,type_line=? WHERE id=?").run(name,text,number===25?"Basic Land":"Creature",id(number));
            for(const slug of tags) db.insert(cardIdentityTagging).values({tagId:id(500+slugs.indexOf(slug)),cardIdentityId:id(number),weight:"strong",annotation:"Synthetic annotation for a tag hypothesis, not a verified contribution. ".repeat(10)}).run();
        }
    } finally {closeDatabase(db);}
    const runtime=createLocalAgentToolRuntime({databasePath:fixture.databasePath,log});
    let candidate;
    try {
        const selected=[[1,4],[3,4],[4,4],[25,48]] as const;
        candidate=(await runtime.handlers.createDeckCandidate({label:"Synthetic pool research",brief:{goal:"Explore sacrifice/death engine alternatives while preserving selection",format:"casual_60",powerLevel:"Synthetic",collectionAccessPolicy:{confirmed:true,collection_import_id:id(980),allowed_locations:[{type:"binder",name:"Allowed 1"},{type:"binder",name:"Allowed 2"}]}},plan:{schema_version:1,description:"Synthetic provisional engine; research assessed alternatives without selecting them.",nodes:[{ref:"engine",kind:"role",label:"Engine support",description:"Access, sacrifice supply, death rewards and supporting mana"}],contributions:selected.map(([n])=>({card_identity_id:id(n),role_ref:"engine",rationale:"Fixture-selected engine piece or supporting mana; static synthetic baseline."}))},options:selected.map(([n])=>({card_identity_id:id(n)})),memberships:selected.map(([n,quantity])=>({card_identity_id:id(n),section:"mainboard",quantity}))}))._unsafeUnwrap();
    } finally {runtime.close();}
    if(!candidate || !("candidate_id" in candidate)) throw new Error("Synthetic live candidate was not saved.");
    const databases={baseline:join(directory,"baseline.sqlite"),current:join(directory,"current.sqlite")};
    for(const target of Object.values(databases)) copyFileSync(fixture.databasePath,target);
    fixture.dispose();
    const source=cards.map(([n,name,oracle_text,tags])=>({object:"card",id:id(99+n),oracle_id:id(n),name,oracle_text,tags,layout:"normal",cmc:1,type_line:n===25?"Basic Land":"Creature"}));
    const sourcePath=join(directory,"source.json");writeFileSync(sourcePath,JSON.stringify(source));
    const prompt=`Review existing Deck Candidate ${candidate.candidate_id} and research useful additional options for its Deck Card Pool. Its Brief and policy are already confirmed: Casual 60, sacrifice/death engine, both Allowed 1 and Allowed 2 binders, no deck borrowing, selected 60 cards must remain unchanged. This authorizes saving justified pool-only options and contributions, not selection changes. Compare conditional access, actual net card advantage, creature supply and death payoffs, inspecting rules for promising contenders. Explain useful options, qualifications, rejected misleading fits and incomplete coverage. This is a bounded synthetic fixture, not real MTG card data or a completed playable deck. Discover synthetic tag vocabulary through browse_tags. The injected fixture provider supports queries otag:<one discovered synthetic slug> and o:"draw two cards" (independent functional search); these enumerate that exact finite synthetic population. Native controls/pagination work normally. There is no live Scryfall or whole-Collection census. Use your judgment; do not use a fixed weight threshold or shortlist quota.`;
    const manifest={directory,databases,candidate_id:candidate.candidate_id,sourcePath,prompt,baselineRef:economyBaselineReference,limits:"Synthetic fixture provider, production public tool handlers and Pi fallback adapter. No live Scryfall, production Collection or full-format quality claim. Human outcome review remains separate."};
    writeFileSync(join(directory,"manifest.json"),JSON.stringify(manifest,null,2));
    return manifest;
}

async function runOne(workspace:string,mode:"baseline"|"current",manifest:Awaited<ReturnType<typeof prepareEconomyLive>>,model:string,thinking:string) {
    const entry=join(manifest.directory,`${mode}-extension.ts`);
    const extension=`import {createCoreTool,createMethodologyReadTool,resolvePiToolNames} from ${JSON.stringify(join(workspace,"packages/pi/src/index.ts"))};
import {appendTomekinPiBootstrap} from ${JSON.stringify(join(workspace,"packages/pi/src/bootstrap.ts"))};
import {createLocalAgentToolRuntime} from ${JSON.stringify(join(workspace,"packages/agent/src/index.ts"))};
import {createRootLogger,resolveLogConfigFromEnv} from ${JSON.stringify(join(workspace,"packages/core/src/index.ts"))};
const source=JSON.parse(await Bun.file(${JSON.stringify(manifest.sourcePath)}).text());
const log=createRootLogger(resolveLogConfigFromEnv({TOMEKIN_LOG_ENABLED:"false"}));
const provider={id:"scryfall",async dispatch(raw){const url=new URL(raw),q=url.searchParams.get("q"),page=Number(url.searchParams.get("page")??1);let data=q==='o:"draw two cards"'?source.filter(c=>[1,2].some(n=>c.oracle_id.endsWith(String(n).padStart(12,"0")))):q?.startsWith("otag:")?source.filter(c=>c.tags.includes(q.slice(5))):null;if(!data)return {status:400,body:{object:"error",details:"Fixture supports one synthetic otag slug or the documented independent functional query."}};const offset=(page-1)*2,next=new URL(url);next.searchParams.set("page",String(page+1));return {status:200,body:{object:"list",data:data.slice(offset,offset+2),has_more:offset+2<data.length,...(offset+2<data.length?{next_page:next.href}:{}),total_cards:data.length}};}};
export default function(pi){for(const name of resolvePiToolNames().filter(n=>!["read","ask_user"].includes(n)))pi.registerTool(createCoreTool(name,{log,createRuntime:()=>createLocalAgentToolRuntime({databasePath:${JSON.stringify(manifest.databases[mode])},log,search:{provider}})}));pi.registerTool(createMethodologyReadTool({workspacePath:${JSON.stringify(workspace)}}));pi.on("before_agent_start",event=>({systemPrompt:appendTomekinPiBootstrap(event.systemPrompt)}));}
`;
    writeFileSync(entry,extension);
    const built=await Bun.build({entrypoints:[entry],outdir:manifest.directory,naming:`${mode}-extension.mjs`,target:"bun",format:"esm"});
    if(!built.success) throw new Error(built.logs.map(String).join("\n"));
    const eventsPath=join(manifest.directory,`${mode}.jsonl`),stderrPath=join(manifest.directory,`${mode}.stderr`);
    const out=openSync(eventsPath,"w"),stderr=openSync(stderrPath,"w");
    let stopped:string|null=null,toolCalls=0;
    const child=spawn(join(root,".data/tomekin-pi-runtime/0.85.1/pi/pi"),["--offline","--no-extensions","--extension",join(manifest.directory,`${mode}-extension.mjs`),"--extension",join(root,"packages/pi/node_modules/pi-ask-user/index.ts"),"--no-skills","--skill",join(workspace,"skills"),"--no-context-files","--no-builtin-tools","--no-session","--mode","json","--print","--model",model,"--thinking",thinking,manifest.prompt],{cwd:workspace,env:{...process.env,PI_CODING_AGENT_DIR:join(root,".data/pi"),TOMEKIN_LOG_ENABLED:"false"},stdio:["ignore","pipe",stderr]});
    let pending="";
    child.stdout!.on("data",chunk=>{writeFileSync(out,chunk);pending+=chunk.toString();const lines=pending.split("\n");pending=lines.pop()!;for(const line of lines){try{if(JSON.parse(line).type==="tool_execution_start"&&++toolCalls>=30){stopped="tool_call_bound";child.kill("SIGINT");}}catch{}}});
    const timer=setTimeout(()=>{stopped="elapsed_bound";child.kill("SIGINT");},240_000);
    const hardStop=setTimeout(()=>child.kill("SIGKILL"),250_000);
    const exitCode=await new Promise<number|null>((resolve,reject)=>{child.on("exit",resolve);child.on("error",reject);});
    clearTimeout(timer);clearTimeout(hardStop);closeSync(out);closeSync(stderr);
    return {mode,model,thinking,exitCode,stopped,toolCalls,eventsPath,stderrPath};
}

if(import.meta.main){
    const manifest=await prepareEconomyLive();
    console.log(JSON.stringify(manifest,null,2));
    if(process.argv.includes("--run")){
        const model=process.argv.find(s=>s.startsWith("--model="))?.slice(8);
        const thinking=process.argv.find(s=>s.startsWith("--thinking="))?.slice(11);
        if(!model||!thinking) throw new Error("Explicit account-holder-approved --model=provider/id and --thinking=effort are required.");
        const baseline=await withEconomyBaseline(workspace=>runOne(workspace,"baseline",manifest,model,thinking));
        console.log(JSON.stringify(baseline));
        const current=await runOne(root,"current",manifest,model,thinking);
        console.log(JSON.stringify(current));
        writeFileSync(join(manifest.directory,"runs.json"),JSON.stringify({baseline,current},null,2));
    }
}
