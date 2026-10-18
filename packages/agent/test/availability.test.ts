import {expect, test} from "bun:test";
import {createCollectionFixture} from "./fixtures/collection";
import {id} from "./fixtures/lookup";
import {readCandidateJson} from "../../core/test/fixtures/read-candidate-json";

test("final Availability jointly allocates complete selected sections and publishes reusable proof without editing content", async () => {
    const f = await createCollectionFixture();
    try {
        const saved = (await f.runtime.handlers.createDeckCandidate({label:"Joint assembly", brief:{format:"casual_60", goal:"Assemble selected copies", powerLevel:null, collectionAccessPolicy:f.policy}, plan:{schema_version:1,description:"Assembly",nodes:[{ref:"role",kind:"role",label:"Mana",description:"Resources"}],contributions:[{card_identity_id:id(1),role_ref:"role",rationale:"Produces resources"}]}, options:[{card_identity_id:id(1)}], memberships:[{card_identity_id:id(1), section:"mainboard", quantity:4},{card_identity_id:id(1), section:"sideboard", quantity:3}]}))._unsafeUnwrap();
        const page = (await f.runtime.handlers.checkCollectionAvailability({candidate_id:saved.candidate_id, expected_updated_at:saved.updated_at}))._unsafeUnwrap();
        expect(page).toMatchObject({status:"ok", check_completion:"complete", evidence:{status:"applicable"}, summary:{required:7, owned:6, eligible:2, missing_owned:1, policy_shortfall:4, sufficient:false}});
        const state = await readCandidateJson(f.runtime.handlers.getDeckCandidate, saved.candidate_id);
        expect(state.updatedAt).toBe(saved.updated_at);
        const pulls=(await f.runtime.handlers.renderDeckCandidate({candidate_id:saved.candidate_id,output:"collection_pull_list"}))._unsafeUnwrap();
        expect(pulls.edges.some((e:any)=>e.node.value?.row?.collection_card_id===id(111))).toBe(true);
        expect(state.validation_evidence.checks.collection_availability).toMatchObject({status:"applicable", result:{summary:{required:7, owned:6, eligible:2}}});
        expect(page.edges.filter((e:any)=>e.node.path[0]==="allocations"&&e.node.path.length===2).map((e:any)=>e.node.value.row.collection_card_id)).toEqual([id(111)]);
        const trial = (await f.runtime.handlers.checkCollectionAvailability({candidate_id:saved.candidate_id,expected_updated_at:saved.updated_at,changes:{memberships:[{action:"set",card_identity_id:id(1),section:"mainboard",quantity:10}]}}))._unsafeUnwrap();
        expect(trial.evidence.status).toBe("transient");
        expect((await readCandidateJson(f.runtime.handlers.getDeckCandidate,saved.candidate_id)).validation_evidence.checks.collection_availability.result.summary.required).toBe(7);
    } finally {f.dispose();}
});

const brief = (policy:any=null)=>({format:"casual_60",goal:"Explicit physical assembly",powerLevel:null,collectionAccessPolicy:policy});
const selected = (section="mainboard",quantity=1)=>({cardIdentityId:id(1),section,quantity});
const requirement = (section="mainboard",quantity=1,copy_requirements:any={})=>({oracle_id:id(1),section,quantity,copy_requirements});
const values = (page:any,path:string)=>page.edges.filter((e:any)=>e.node.path[0]===path&&e.node.path.length===2).map((e:any)=>e.node.value);

test("overlapping exact Printing demands reassign broad demand, prefer uncommitted copies and preserve source deck borrowing",async()=>{
    const f=await createCollectionFixture();
    try{
        f.db.$client.prepare("INSERT INTO card_printing (id,card_identity_id,layout,set_id,collector_number,language,source_page_uri) SELECT ?,card_identity_id,layout,set_id,collector_number,'de',source_page_uri FROM card_printing WHERE id = ?").run(id(500),id(2));
        f.db.$client.prepare("UPDATE collection_card SET quantity=1, card_printing_id=CASE WHEN id=? THEN ? ELSE card_printing_id END").run(id(111),id(500));
        const policy={...f.policy,allowed_locations:[{type:"binder",name:"Shared"},{type:"deck",name:"Shared"}],copy_requirements:{}};
        const input={brief:brief(policy),cards:[selected("mainboard"),selected("sideboard")],requirements:[requirement("mainboard",1,{printing_ids:[id(2),id(500)]}),requirement("sideboard",1,{printing_ids:[id(2)]})]};
        const page=(await f.runtime.handlers.checkCollectionAvailability(input))._unsafeUnwrap();
        expect(page.summary).toMatchObject({owned:2,eligible:2,committed:0,missing_owned:0,policy_shortfall:0,sufficient:true});
        expect(values(page,"allocations").sort((a:any,b:any)=>a.section.localeCompare(b.section)).map((a:any)=>[a.section,a.row.printing_id,a.row.location.type])).toEqual([["mainboard",id(500),"binder"],["sideboard",id(2),"binder"]]);
        const borrowing=(await f.runtime.handlers.checkCollectionAvailability({...input,cards:[selected("mainboard",2),selected("sideboard")],requirements:[requirement("mainboard",2),requirement("sideboard",1,{printing_ids:[id(2)]})]}))._unsafeUnwrap();
        expect(borrowing.summary).toMatchObject({required:3,owned:3,eligible:3,committed:1});
        expect(values(borrowing,"allocations").find((a:any)=>a.committed).row.location).toMatchObject({type:"deck",name:"Shared"});
        expect((await f.runtime.handlers.checkCollectionAvailability({...input,requirements:[requirement("mainboard")]}))._unsafeUnwrapErr()).toMatchObject({type:"validation_error"});
    }finally{f.dispose();}
});

test("no Collection, empty import, unconfirmed permission, strict recent intent and nullable metadata remain distinct",async()=>{
    const f=await createCollectionFixture();
    try{
        const unknown=(await f.runtime.handlers.checkCollectionAvailability({brief:brief(),cards:[selected("mainboard",7)]}))._unsafeUnwrap();
        expect(unknown.summary).toMatchObject({owned:6,eligible:null,policy_shortfall:null,sufficient:null});
        const uncertain=(await f.runtime.handlers.checkCollectionAvailability({brief:brief({...f.policy,copy_requirements:{condition:["mint"]}}),cards:[selected("mainboard",2)]}))._unsafeUnwrap();
        expect(uncertain.summary).toMatchObject({owned:2,eligible:0,missing_owned:0,policy_shortfall:2,metadata_uncertain:true});
        const demandUnknown=(await f.runtime.handlers.checkCollectionAvailability({brief:brief({...f.policy,copy_requirements:{}}),cards:[selected()],requirements:[requirement("mainboard",1,{condition:["mint"]})]}))._unsafeUnwrap();
        expect(demandUnknown.summary).toMatchObject({owned:0,missing_owned:1,metadata_uncertain:true});
        expect(values(demandUnknown,"requirements")[0]).toMatchObject({uncertain_compatible_supply:6,reasons:["unknown_requirement:condition"]});
        const strictBrief={...brief({...f.policy,copy_requirements:{}}),recentAdditions:{purpose:"strict_copy_eligibility",added_at_from:"2026-10-17T00:00:00.125Z",timezone:"Australia/Sydney"}};
        expect((await f.runtime.handlers.checkCollectionAvailability({brief:strictBrief,cards:[selected()]}))._unsafeUnwrapErr()).toMatchObject({type:"validation_error"});
        const strict=(await f.runtime.handlers.checkCollectionAvailability({brief:{...strictBrief,collectionAccessPolicy:{...f.policy,copy_requirements:{added_at_from:"2026-10-17T00:00:00.125Z"}}},cards:[selected("mainboard",5)]}))._unsafeUnwrap();
        expect(strict.summary).toMatchObject({owned:5,eligible:2,metadata_uncertain:true});
        expect(values(strict,"requirements")[0]).toMatchObject({uncertain_policy_supply:2});
        const imported=await f.replace([]);
        const empty=(await f.runtime.handlers.checkCollectionAvailability({brief:brief({...f.policy,collection_import_id:imported.id,copy_requirements:{}}),cards:[selected()]}))._unsafeUnwrap();
        expect(empty).toMatchObject({collection_context:{state:"empty_collection"},summary:{owned:0,eligible:0,missing_owned:1}});
    }finally{f.dispose();}
    const {createLookupFixture,log}=await import("./fixtures/lookup");
    const {createLocalAgentToolRuntime}=await import("@tomekin/agent");
    const missing=await createLookupFixture(),runtime=createLocalAgentToolRuntime({databasePath:missing.databasePath,log});
    try{const page=(await runtime.handlers.checkCollectionAvailability({brief:brief(),cards:[selected()]}))._unsafeUnwrap();expect(page).toMatchObject({collection_context:{state:"no_collection"},summary:{owned:0,eligible:null,missing_owned:1}});}finally{runtime.close();missing.dispose();}
});

test("bounded complete witness recovery is stateless and rejects changed requirements, policy, imports and saved input baselines",async()=>{
    const f=await createCollectionFixture();
    try{
        const input={brief:brief({...f.policy,copy_requirements:{}}),cards:[selected("mainboard",5)],first:1};
        let after:string|undefined;const seen:any[]=[];let initial:string|undefined;
        do{const page=(await f.runtime.handlers.checkCollectionAvailability({...input,...after?{after}:{}}))._unsafeUnwrap();expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(51200);expect(page).toMatchObject({check_completion:"complete",witness_completion:"partial"});initial??=page.pageInfo.endCursor!;seen.push(...page.edges.map((e:any)=>e.node));after=page.pageInfo.hasNextPage?page.pageInfo.endCursor!:undefined;}while(after);
        expect(seen.filter(n=>n.path[0]==="allocations"&&n.path.length===2).reduce((n,a)=>n+a.value.allocated_quantity,0)).toBe(4);
        const changed=(await f.runtime.handlers.checkCollectionAvailability({...input,cards:[selected("mainboard",6)],after:initial}))._unsafeUnwrapErr();expect(changed.envelope.error.code).toBe("stale_cursor");
        await f.reimportTags();expect((await f.runtime.handlers.checkCollectionAvailability({...input,after:initial})).isOk()).toBe(true);
        await f.recordFailedImport();expect((await f.runtime.handlers.checkCollectionAvailability({...input,after:initial})).isOk()).toBe(true);
        await f.reimportOracle();expect((await f.runtime.handlers.checkCollectionAvailability({...input,after:initial}))._unsafeUnwrapErr().envelope.error.code).toBe("stale_cursor");
    }finally{f.dispose();}
});

test("small exhaustive independent match enumeration confirms joint owned, eligible and minimal borrowing optima",async()=>{
    const f=await createCollectionFixture();
    try{
        const printings=[id(2),id(500),id(501)],rowIds=[id(110),id(111),id(112)],sections=["commander","mainboard","sideboard"];
        for(const printing of printings.slice(1)) f.db.$client.prepare("INSERT INTO card_printing (id,card_identity_id,layout,set_id,collector_number,language,source_page_uri) SELECT ?,card_identity_id,layout,set_id,collector_number,language,source_page_uri FROM card_printing WHERE id = ?").run(printing,id(2));
        rowIds.forEach((row,i)=>f.db.$client.prepare("UPDATE collection_card SET quantity=1,card_printing_id=? WHERE id=?").run(printings[i]!,row));
        let cases=0;
        for(let statusCode=0;statusCode<27;statusCode++){
            const states=[0,1,2].map(i=>Math.floor(statusCode/3**i)%3);
            rowIds.forEach((row,i)=>f.db.$client.prepare("UPDATE collection_card SET collection_location_id=? WHERE id=?").run(states[i]===1?id(101):id(100),row));
            const policy={...f.policy,allowed_locations:[{type:"binder",name:"Shared"},{type:"deck",name:"Shared"}],copy_requirements:{},excluded_collection_card_ids:rowIds.filter((_,i)=>states[i]===2)};
            for(let graph=0;graph<512;graph++){
                const compatible=(r:number,d:number)=>!!(graph&(1<<(r*3+d)));
                // Enumerate assignments of the three demand occurrences to distinct rows or no row.
                // This contains no flow/residual machinery and is independent of production allocation.
                let optimum=[0,0,0];
                function enumerate(d:number,used:number,score:number[]){if(d===3){if(score[0]!>optimum[0]!||score[0]===optimum[0]&&(score[1]!>optimum[1]!||score[1]===optimum[1]&&score[2]!>optimum[2]!))optimum=score;return;}enumerate(d+1,used,score);for(let r=0;r<3;r++)if(!(used&(1<<r))&&compatible(r,d))enumerate(d+1,used|(1<<r),[score[0]!+1,score[1]!+(states[r]===2?0:1),score[2]!+(states[r]===0?1:0)]);}
                enumerate(0,0,[0,0,0]);
                const requirements=sections.map((section,d)=>requirement(section,1,{printing_ids:printings.filter((_,r)=>compatible(r,d)).length?printings.filter((_,r)=>compatible(r,d)):[id(999)]}));
                const page=(await f.runtime.handlers.checkCollectionAvailability({brief:brief(policy),cards:sections.map(section=>selected(section)),requirements}))._unsafeUnwrap();
                expect([page.summary.owned,page.summary.eligible,page.summary.eligible!-page.summary.committed!]).toEqual(optimum);
                expect([page.summary.missing_owned,page.summary.policy_shortfall]).toEqual([3-optimum[0]!,optimum[0]!-optimum[1]!]);
                const allocations=values(page,"allocations"), used=allocations.map((a:any)=>a.row.collection_card_id);
                expect(new Set(used).size).toBe(used.length);
                expect(allocations.every((a:any)=>compatible(rowIds.indexOf(a.row.collection_card_id),sections.indexOf(a.section))&&a.allocated_quantity===1)).toBe(true);
                cases++;
            }
        }
        expect(cases).toBe(13824);
    }finally{f.dispose();}
},120_000);
