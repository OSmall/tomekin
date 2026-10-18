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
