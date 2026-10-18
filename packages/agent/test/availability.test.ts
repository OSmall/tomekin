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
        expect(state.validation_evidence.checks.collection_availability).toMatchObject({status:"applicable", result:{summary:{required:7, owned:6, eligible:2}}});
        expect(page.edges.filter((e:any)=>e.node.kind==="allocation").map((e:any)=>e.node.row.collection_card_id)).toEqual([id(111)]);
        const trial = (await f.runtime.handlers.checkCollectionAvailability({candidate_id:saved.candidate_id,expected_updated_at:saved.updated_at,changes:{memberships:[{action:"set",card_identity_id:id(1),section:"mainboard",quantity:10}]}}))._unsafeUnwrap();
        expect(trial.evidence.status).toBe("transient");
        expect((await readCandidateJson(f.runtime.handlers.getDeckCandidate,saved.candidate_id)).validation_evidence.checks.collection_availability.result.summary.required).toBe(7);
    } finally {f.dispose();}
});
