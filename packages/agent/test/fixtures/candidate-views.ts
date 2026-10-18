import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {createLookupFixture,id,log} from "./lookup";
export const completeCandidateDescription = 'Full synthetic strategy Æ "quoted". '.repeat(1000);
export async function createCandidateViewFixture(){
    const fixture=await createLookupFixture();
    const runtime=createLocalAgentToolRuntime({databasePath:fixture.databasePath,log});
    try{
        const created=await runtime.handlers.createDeckCandidate({label:"Complete view transport",brief:{format:"casual_60",goal:"Retain all reasoning",powerLevel:null},plan:{schema_version:1,description:completeCandidateDescription,nodes:[{ref:"mana",kind:"role",label:"Mana",description:"Recurring resources"}],contributions:[{card_identity_id:id(1),role_ref:"mana",rationale:"Resource generation",qualifications:["Requires deployment"],evidence:[{reference:"Card facts",note:"Produces mana"}]}]},options:[{card_identity_id:id(1)}],memberships:[{card_identity_id:id(1),quantity:1,section:"mainboard"}]});
        if(created.isErr())throw new Error(created.error.message);
        return {...fixture,candidateId:created.value.candidate_id};
    }catch(error){fixture.dispose();throw error;}finally{runtime.close();}
}
