import {DeckBuildingBriefSchema, type DeckCandidate} from "@tomekin/core";
export function candidatePlanFixture(): DeckCandidate {
    const id = "11111111-1111-4111-8111-111111111111", a = "22222222-2222-4222-8222-222222222222", b = "33333333-3333-4333-8333-333333333333";
    const time = "2026-10-18T00:00:00.000Z";
    return {id, label:'Forest "engine" <safe> & [plan]', format:"casual_60", formatAnchor:null,
        brief:DeckBuildingBriefSchema.parse({format:"casual_60",goal:"Explain a synthetic public plan",powerLevel:null}),createdAt:time,updatedAt:time,selectedChangedAt:time,briefChangedAt:time,planChangedAt:time,
        options:[{card_identity_id:a,card_name:"Forest",comparison_note:"Repeatable source"},{card_identity_id:b,card_name:"Pool Alternative",comparison_note:"Costs a card"}],
        memberships:[{card_identity_id:a,card_name:"Forest",quantity:3,section:"mainboard"},{card_identity_id:a,card_name:"Forest",quantity:1,section:"sideboard"}],
        cards:[{cardIdentityId:a,cardName:"Forest",quantity:3,section:"mainboard",sortOrder:0,note:null},{cardIdentityId:a,cardName:"Forest",quantity:1,section:"sideboard",sortOrder:0,note:null}],
        assessments:{mana_curve_adequacy:"Provisional; not sufficient yet."},
        plan:{schema_version:1,candidate_id:id,description:"Recurring resource engine; uncertain resilience.",
            nodes:[{id:"mana",kind:"role",label:'Mana "quoted" <br/> & | [x]',description:"Produce resources"},{id:"draw",kind:"role",label:"Draw",description:"Replenish cards"},{id:"gap",kind:"role",label:"Protection",description:"Desired disconnected gap",coverage_assessment:{summary:"Still seeking resilient protection"}},{id:"win",kind:"win_route",label:"Spend resources",description:"Finish",priority:"primary",rationale:"Main intended finish"},{id:"backup",kind:"win_route",label:"Backup",description:"Secondary finish",priority:"secondary",rationale:"Fallback"}],
            contributions:[{card_identity_id:a,role_id:"mana",rationale:"Repeatable mana",qualifications:["One use per turn"],evidence:[{reference:"Synthetic card facts",note:"Produces a resource"}]},{card_identity_id:b,role_id:"mana",rationale:"Alternative source"},{card_identity_id:b,role_id:"draw",rationale:"Conditional card access"}],
            relationships:[{id:"r1",kind:"enables",source_id:"mana",target_id:"win",rationale:"Pays for finish"},{id:"r2",kind:"supports",source_id:"mana",target_id:"draw",rationale:"Pays for draw"},{id:"r3",kind:"enhances",source_id:"draw",target_id:"mana",rationale:"Finds resources"},{id:"r4",kind:"competes_with",source_id:"mana",target_id:"draw",rationale:"Spend limited mana"},{id:"r5",kind:"enhances",source_id:"mana",target_id:"draw",rationale:"More access"}]}}
}
/** Public/synthetic inspection corpus: 24 selected identities, 8 active alternatives, section quantities and multi-role options. */
export function representativeCandidatePlanFixture(): DeckCandidate {
    const candidate=candidatePlanFixture();
    candidate.label="Synthetic resource engine";
    const roleNames=["Mana development","Card access","Create creatures","Sacrifice outlets","Death rewards","Protection","Recovery"];
    const ids=roleNames.map((_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`);
    candidate.plan!.nodes=roleNames.map((label,i)=>({id:ids[i]!,kind:"role" as const,label,description:`Current contextual role: ${label}`,coverage_goal:{sections:["mainboard"],minimum_copies:null,criteria:"Reliable access in context",rationale:"Support the resource plan"}}));
    candidate.plan!.nodes.push({id:"10000000-0000-4000-8000-000000000100",kind:"role",label:"Disconnected desired resilience",description:"A deliberately unfilled desired role",coverage_assessment:{summary:"Current options do not provide this function; revisit after testing"}},{id:"10000000-0000-4000-8000-000000000101",kind:"win_route",label:"Drain through recurring creatures",description:"Convert recurring creatures into life loss",priority:"primary",rationale:"The main proposed finish"},{id:"10000000-0000-4000-8000-000000000102",kind:"win_route",label:"Wide creature combat",description:"Attack with accumulated creatures",priority:"secondary",rationale:"Fallback if the drain route is disrupted"});
    candidate.plan!.relationships=ids.slice(0,6).map((source_id,i)=>({id:`20000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,kind:"supports" as const,source_id,target_id:ids[i+1]!,rationale:"Supports the next contextual function"}));
    candidate.plan!.relationships.push({id:"20000000-0000-4000-8000-000000000010",kind:"competes_with",source_id:ids[0]!,target_id:ids[1]!,rationale:"Resource expenditure competes"},{id:"20000000-0000-4000-8000-000000000011",kind:"enhances",source_id:ids[6]!,target_id:ids[2]!,rationale:"Recovery renews creature inputs"},{id:"20000000-0000-4000-8000-000000000012",kind:"enables",source_id:ids[4]!,target_id:"10000000-0000-4000-8000-000000000101",rationale:"Death rewards convert resources into life loss"},{id:"20000000-0000-4000-8000-000000000013",kind:"supports",source_id:ids[2]!,target_id:"10000000-0000-4000-8000-000000000102",rationale:"Creatures support combat"});
    candidate.options=[];candidate.memberships=[];candidate.cards=[];candidate.plan!.contributions=[];
    for(let i=0;i<32;i++) {
        const id=`30000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,name=`Synthetic option ${i+1}`;
        candidate.options.push({card_identity_id:id,card_name:name,comparison_note:i<24?"Selected for the current plan":"Active alternative with different conditions"});
        candidate.plan!.contributions.push({card_identity_id:id,role_id:ids[i%7]!,rationale:"A contextual synthetic contribution",qualifications:["A synthetic fixture, not strategic or rules validation"]});
        if(i%5===0)candidate.plan!.contributions.push({card_identity_id:id,role_id:ids[(i+1)%7]!,rationale:"Additional contextual function"});
        if(i<24){
            const quantity=i===0?20:i<5?3:1;
            candidate.memberships.push({card_identity_id:id,card_name:name,quantity,section:"mainboard"});
            candidate.cards.push({cardIdentityId:id,cardName:name,quantity,section:"mainboard",sortOrder:i,note:null});
            if(i===1){candidate.memberships.push({card_identity_id:id,card_name:name,quantity:1,section:"sideboard"});candidate.cards.push({cardIdentityId:id,cardName:name,quantity:1,section:"sideboard",sortOrder:i,note:null});}
        }
    }
    return candidate;
}
