import {readCandidateJson} from "../../core/test/fixtures/read-candidate-json";
import {expect, test} from "bun:test";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {eq} from "drizzle-orm";
import {createAgentToolHandlers, createTestRootLoggerFromEnv, requiredScryfallImportContractRevisions, deckCheckVersions} from "@tomekin/core";
import {applySqliteMigrations, openDatabase, closeDatabase, createSqliteDeckCandidateRepository, createSqliteCardReferenceRepository, createSqliteCardQueryRepository, createSqliteCollectionRepository, cardIdentity, scryfallBulkDataImport} from "@tomekin/sqlite";

const forest = "11111111-1111-4111-8111-111111111111";
const brief = {format: "casual_60", goal: "Build a simple deck", powerLevel: null};
function unwrap(result: any): any {
    if(result.isErr()) throw new Error(JSON.stringify(result.error));
    return result.value;
}
function setup() {
    const root = mkdtempSync(join(tmpdir(), "tomekin-checks-"));
    const path = join(root, "test.sqlite"), log = createTestRootLoggerFromEnv();
    applySqliteMigrations(path, {log});
    const db = openDatabase(path, {log});
    const clock = {now: () => new Date("2026-10-18T00:00:00.000Z")};
    db.insert(cardIdentity).values({id:forest, name:"Forest", layout:"normal", manaCost:null, manaValue:0, typeLine:"Basic Land — Forest", oracleText:"{T}: Add {G}.", copyLimitOverrideKind:"unlimited", copyLimitOverrideMaximum:null, colorIdentity:"G", colors:null, colorIndicator:null, producedMana:"G", keywordsJson:[], power:null, toughness:null, loyalty:null, defense:null, edhrecRank:null, gameChanger:false, sourcePageUri:"https://scryfall.com/card/example"}).run();
    for(const bulkDataType of ["oracle_cards", "all_cards", "oracle_tags"] as const) {
        db.insert(scryfallBulkDataImport).values({id:bulkDataType==="oracle_cards"?"ffffffff-ffff-4fff-8fff-ffffffffffff":crypto.randomUUID(), bulkDataType, importContractRevision:requiredScryfallImportContractRevisions[bulkDataType], status:"succeeded", startedAt:clock.now(), completedAt:clock.now(), sourceUpdatedAt:clock.now(), importedRecordCount:1, warningsJson:[], blockingErrorsJson:[]}).run();
    }
    const repositories = {deckCandidates:createSqliteDeckCandidateRepository(db, clock), cardReference:createSqliteCardReferenceRepository(db), cardQuery:createSqliteCardQueryRepository(db), collection:createSqliteCollectionRepository(db,clock)};
    const handlers = createAgentToolHandlers(repositories);
    return {db,path,clock,repositories,handlers,dispose(){closeDatabase(db);rmSync(root,{recursive:true,force:true});}};
}
async function initial(app: ReturnType<typeof setup>) {
    return unwrap(await app.handlers.createDeckCandidate({label:"Forests",brief,plan:{schema_version:1,description:"Produce resources",nodes:[{ref:"mana",kind:"role",label:"Mana",description:"Produce mana"}],contributions:[{card_identity_id:forest,role_ref:"mana",rationale:"Forest supplies green mana"}]},options:[{card_identity_id:forest}],memberships:[{card_identity_id:forest,section:"mainboard",quantity:60}]}));
}

test("an explicit saved legality check publishes latest reusable evidence without changing content timestamps", async () => {
    const app=setup();
    try {
        const created=await initial(app);
        const result=unwrap(await app.handlers.validateFormatLegality({candidate_id:created.candidate_id,expected_updated_at:created.updated_at}));
        expect(result.status).toBe("legal");
        expect(result.evidence.status).toBe("applicable");
        const read=(await readCandidateJson(app.handlers.getDeckCandidate,created.candidate_id));
        expect(read.updatedAt).toBe(created.updated_at);
        expect(read.validation_evidence.checks.format_legality.status).toBe("applicable");
        expect(read.validation_evidence.checks.format_legality.result.status).toBe("legal");
        const summary=unwrap(await app.handlers.getDeckCandidate({id:created.candidate_id}));
        expect(summary.validation_evidence.checks.format_legality.status).toBe("applicable");
        expect(summary.validation_evidence.checks.format_legality).not.toHaveProperty("result");
        expect(summary.validation_evidence.checks.format_legality).not.toHaveProperty("dependencies");
        const edited=unwrap(await app.handlers.editDeckCandidate({candidate_id:created.candidate_id,expected_updated_at:created.updated_at,changes:{label:"Still forests"}}));
        expect(edited.validation_evidence.checks.format_legality.status).toBe("applicable");
    } finally {app.dispose();}
});

test("initial and saved checks require their Oracle facts without depending on unused Printing or tag imports", async () => {
    const app=setup();
    try {
        app.db.delete(scryfallBulkDataImport).where(eq(scryfallBulkDataImport.bulkDataType,"oracle_tags")).run();
        app.db.delete(scryfallBulkDataImport).where(eq(scryfallBulkDataImport.bulkDataType,"all_cards")).run();
        const explicit=unwrap(await app.handlers.evaluateDeckCandidate({brief,cards:[{cardIdentityId:forest,section:"mainboard",quantity:60}]}));
        expect(explicit.legality.status).toBe("legal");
        expect(explicit.evidence.status).toBe("transient");
        expect(unwrap(await app.handlers.listDeckCandidates())).toEqual([]);
        const created=await initial(app);
        const checked=unwrap(await app.handlers.validateFormatLegality({candidate_id:created.candidate_id,expected_updated_at:created.updated_at}));
        expect(checked.evidence.status).toBe("applicable");
        const recorded=(await readCandidateJson(app.handlers.getDeckCandidate,created.candidate_id));
        expect(recorded.validation_evidence.checks.format_legality.dependencies.reference_imports).toHaveLength(1);
        app.db.delete(scryfallBulkDataImport).where(eq(scryfallBulkDataImport.bulkDataType,"oracle_cards")).run();
        const unavailable=await app.handlers.validateFormatLegality({candidate_id:created.candidate_id,expected_updated_at:created.updated_at});
        expect(unavailable.isErr()).toBe(true);
        if(unavailable.isErr()) expect(unavailable.error).toMatchObject({type:"reference_data_unready",missingBulkDataTypes:["oracle_cards"]});
    }finally{app.dispose();}
});

test("trial changes check the revised selected cards and Brief while leaving saved content and evidence intact",async()=>{
    const app=setup();
    try{
        const created=await initial(app), input={candidate_id:created.candidate_id,expected_updated_at:created.updated_at};
        unwrap(await app.handlers.evaluateDeckCandidate(input));
        const before=(await readCandidateJson(app.handlers.getDeckCandidate,created.candidate_id));
        const trial=unwrap(await app.handlers.evaluateDeckCandidate({...input,changes:{brief:{playExperience:"Trial experience"},memberships:[{action:"set",card_identity_id:forest,section:"mainboard",quantity:59}]}}));
        expect(trial.manaAndCurve.landCount).toBe(59);
        expect(trial.legality.status).toBe("illegal");
        expect(trial.powerAndExperience.playExperience).toBe("Trial experience");
        expect(trial.evidence.status).toBe("transient");
        expect((await readCandidateJson(app.handlers.getDeckCandidate,created.candidate_id))).toEqual(before);
        const illegalTrial=await app.handlers.evaluateDeckCandidate({...input,changes:{memberships:[{action:"set",card_identity_id:forest,section:"mainboard",quantity:0}]}});
        expect(illegalTrial.isErr()).toBe(true);
        const unknown="22222222-2222-4222-8222-222222222222";
        const unresolvedTrial=await app.handlers.evaluateDeckCandidate({...input,changes:{options:[{action:"add",card_identity_id:unknown}],contributions:[{action:"add",contribution:{card_identity_id:unknown,role_id:created.created_ids.mana,rationale:"Proposed option"}}]}});
        expect(unresolvedTrial.isErr()).toBe(true);
        if(unresolvedTrial.isErr()) expect(unresolvedTrial.error.type).toBe("unresolved_card_identity");
        const conflict=await app.handlers.validateFormatLegality({...input,expected_updated_at:"2026-10-17T00:00:00.000Z"});
        expect(conflict.isErr()).toBe(true);
        if(conflict.isErr()) expect(conflict.error.type).toBe("conflict");
        expect((await readCandidateJson(app.handlers.getDeckCandidate,created.candidate_id))).toEqual(before);
    }finally{app.dispose();}
});

test("pool, note, order, plan and unrelated Brief maintenance preserve checks; evaluation context and selected changes stale only their checks",async()=>{
    const app=setup();
    try{
        let saved=await initial(app);
        const id=saved.candidate_id;
        unwrap(await app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at}));
        unwrap(await app.handlers.evaluateDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at}));
        saved=unwrap(await app.handlers.editDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at,changes:{brief:{goal:"Keep maintaining the deck"},plan:{schema_version:1,description:"Explain the resource plan"},options:[{action:"update",card_identity_id:forest,changes:{comparison_note:"Still useful"}}],memberships:[{action:"set",card_identity_id:forest,section:"mainboard",quantity:60,note:"Favourite basic",sort_order:4}]}}));
        expect(saved.validation_evidence.checks.format_legality.status).toBe("applicable");
        expect(saved.validation_evidence.checks.deck_evaluation.status).toBe("applicable");
        saved=unwrap(await app.handlers.editDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at,changes:{brief:{powerLevel:"A stronger local table"}}}));
        expect(saved.validation_evidence.checks.format_legality.status).toBe("applicable");
        expect(saved.validation_evidence.checks.deck_evaluation.status).toBe("outdated");
        saved=unwrap(await app.handlers.editDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at,changes:{memberships:[{action:"set",card_identity_id:forest,section:"mainboard",quantity:59}]}}));
        expect(saved.validation_evidence.checks.format_legality.status).toBe("outdated");
        expect(saved.validation_evidence.checks.deck_evaluation.status).toBe("outdated");
        unwrap(await app.handlers.evaluateDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at}));
        const read=unwrap(await app.handlers.getDeckCandidate({id}));
        expect(read.validation_evidence.checks.format_legality.status).toBe("outdated");
        expect(read.validation_evidence.checks.deck_evaluation.status).toBe("applicable");
    }finally{app.dispose();}
});

test("a concurrent selected edit prevents stale check publication without overwriting newer saved evidence",async()=>{
    const app=setup();
    const connection=openDatabase(app.path,{log:createTestRootLoggerFromEnv()});
    const other=createAgentToolHandlers({...app.repositories,deckCandidates:createSqliteDeckCandidateRepository(connection,app.clock)});
    try{
        const saved=await initial(app), id=saved.candidate_id;
        unwrap(await app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at}));
        // Capture begins synchronously; the handler yields before computing/publishing.
        const pending=app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at});
        const edited=unwrap(await other.editDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at,changes:{memberships:[{action:"set",card_identity_id:forest,section:"mainboard",quantity:59}]}}));
        const newer=unwrap(await other.validateFormatLegality({candidate_id:id,expected_updated_at:edited.updated_at}));
        const outdated=unwrap(await pending);
        expect(outdated.status).toBe("legal");
        expect(outdated.evidence.status).toBe("outdated");
        expect(newer.status).toBe("illegal");
        const read=(await readCandidateJson(app.handlers.getDeckCandidate,id));
        expect(read.validation_evidence.checks.format_legality.status).toBe("applicable");
        expect(read.validation_evidence.checks.format_legality.result.status).toBe("illegal");
    }finally{closeDatabase(connection);app.dispose();}
});

test("pool-only concurrent edits still permit publication and Oracle/validator changes prevent reuse",async()=>{
    const app=setup();
    try{
        const saved=await initial(app), id=saved.candidate_id;
        const pending=app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at});
        const edited=unwrap(await app.handlers.editDeckCandidate({candidate_id:id,expected_updated_at:saved.updated_at,changes:{options:[{action:"update",card_identity_id:forest,changes:{comparison_note:"Reassessed alternative"}}]}}));
        expect(unwrap(await pending).evidence.status).toBe("applicable");
        app.db.insert(scryfallBulkDataImport).values({id:crypto.randomUUID(),bulkDataType:"oracle_tags",importContractRevision:requiredScryfallImportContractRevisions.oracle_tags,status:"succeeded",startedAt:new Date("2026-10-19"),completedAt:new Date("2026-10-19"),importedRecordCount:0,warningsJson:[],blockingErrorsJson:[]}).run();
        expect(unwrap(await app.handlers.getDeckCandidate({id})).validation_evidence.checks.format_legality.status).toBe("applicable");
        const inFlight=app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:edited.updated_at});
        app.db.insert(scryfallBulkDataImport).values({id:crypto.randomUUID(),bulkDataType:"oracle_cards",importContractRevision:requiredScryfallImportContractRevisions.oracle_cards,status:"succeeded",startedAt:new Date("2026-10-19"),completedAt:new Date("2026-10-19"),sourceUpdatedAt:new Date("2026-10-19"),importedRecordCount:1,warningsJson:[],blockingErrorsJson:[]}).run();
        expect(unwrap(await inFlight).evidence.status).toBe("outdated");
        expect(unwrap(await app.handlers.getDeckCandidate({id})).validation_evidence.checks.format_legality.status).toBe("outdated");
        unwrap(await app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:edited.updated_at}));
        const versions={...deckCheckVersions,format_legality:"next-validator"};
        const replacement=createAgentToolHandlers({...app.repositories,deckCandidates:createSqliteDeckCandidateRepository(app.db,app.clock,undefined,versions)});
        expect(unwrap(await replacement.getDeckCandidate({id})).validation_evidence.checks.format_legality.status).toBe("outdated");
        const checking=replacement.validateFormatLegality({candidate_id:id,expected_updated_at:edited.updated_at});
        versions.format_legality="another-validator";
        expect(unwrap(await checking).evidence.status).toBe("outdated");
    }finally{app.dispose();}
});

test("a later Oracle import in the same timestamp tick invalidates a captured check regardless of UUID ordering",async()=>{
    const app=setup();
    try{
        const saved=await initial(app),id=saved.candidate_id;
        const checking=app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at});
        app.db.insert(scryfallBulkDataImport).values({id:"00000000-0000-4000-8000-000000000001",bulkDataType:"oracle_cards",importContractRevision:requiredScryfallImportContractRevisions.oracle_cards,status:"succeeded",startedAt:app.clock.now(),completedAt:app.clock.now(),sourceUpdatedAt:app.clock.now(),importedRecordCount:1,warningsJson:[],blockingErrorsJson:[]}).run();
        expect(unwrap(await checking).evidence.status).toBe("outdated");
        expect(unwrap(await app.handlers.getDeckCandidate({id})).validation_evidence.status).toBe("absent");
    }finally{app.dispose();}
});

test("view continuations bind included evidence and canonical names without staling an unchanged Brief",async()=>{
    const app=setup();
    try{
        const saved=await initial(app),id=saved.candidate_id;
        const json=unwrap(await app.handlers.getDeckCandidate({id,view:"json",first:1}));
        const briefPage=unwrap(await app.handlers.getDeckCandidate({id,view:"brief",first:1}));
        unwrap(await app.handlers.validateFormatLegality({candidate_id:id,expected_updated_at:saved.updated_at}));
        const changedEvidence=await app.handlers.getDeckCandidate({id,view:"json",after:json.pageInfo.endCursor});
        expect(changedEvidence.isErr()).toBe(true);
        expect(changedEvidence.error.envelope.error.code).toBe("stale_cursor");
        expect(unwrap(await app.handlers.getDeckCandidate({id,view:"brief",after:briefPage.pageInfo.endCursor})).status).toBe("ok");
        const selected=unwrap(await app.handlers.getDeckCandidate({id,view:"selected",first:0}));
        app.db.update(cardIdentity).set({name:"Canonical Forest"}).where(eq(cardIdentity.id,forest)).run();
        const renamed=await app.handlers.getDeckCandidate({id,view:"selected",after:selected.pageInfo.endCursor});
        expect(renamed.error.envelope.error.code).toBe("stale_cursor");
        const checked=unwrap(await app.handlers.getDeckCandidate({id,view:"assessments",first:1}));
        app.db.insert(scryfallBulkDataImport).values({id:crypto.randomUUID(),bulkDataType:"oracle_cards",importContractRevision:requiredScryfallImportContractRevisions.oracle_cards,status:"succeeded",startedAt:new Date("2026-10-19"),completedAt:new Date("2026-10-19"),sourceUpdatedAt:new Date("2026-10-19"),importedRecordCount:1,warningsJson:[],blockingErrorsJson:[]}).run();
        const outdated=await app.handlers.getDeckCandidate({id,view:"assessments",after:checked.pageInfo.endCursor});
        expect(outdated.error.envelope.error.code).toBe("stale_cursor");
        expect(unwrap(await app.handlers.getDeckCandidate({id,view:"brief",after:briefPage.pageInfo.endCursor})).status).toBe("ok");
    }finally{app.dispose();}
});
