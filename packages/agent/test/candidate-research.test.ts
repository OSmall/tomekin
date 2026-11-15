import {expect, test} from "bun:test";
import {createLocalAgentToolRuntime} from "@tomekin/agent";
import {reconstructCandidateView} from "@tomekin/core";
import {createLookupFixture, log} from "./fixtures/lookup";

async function read(runtime: ReturnType<typeof createLocalAgentToolRuntime>, id: string, view: string) {
    const records: any[] = [];
    let after: string | undefined;
    do {
        const page = (await runtime.handlers.getDeckCandidate({id, view, first: 2, ...(after ? {after} : {})}))._unsafeUnwrap() as any;
        records.push(...page.edges.map((edge: any) => edge.node));
        after = page.next_cursor ?? undefined;
    } while (after);
    return reconstructCandidateView(records);
}

test("candidate research is independently saved, reopened, paged, and cleared", async () => {
    const f = await createLookupFixture();
    let runtime = createLocalAgentToolRuntime({databasePath:f.databasePath, log});
    try {
        const analysis = 'Action Æ 🧙 "cost"\n'.repeat(5000);
        const created = (await runtime.handlers.createDeckCandidate({label:"Early", brief:{format:"casual_60",goal:"Explore",powerLevel:null}, plan:{schema_version:1,description:"Strategy\n\n## Resume\nResearch next.",action_analysis_markdown:analysis}}))._unsafeUnwrap();
        expect(created.summary).not.toContain(analysis);
        runtime.close();
        runtime = createLocalAgentToolRuntime({databasePath:f.databasePath, log});
        expect(await read(runtime, created.candidate_id, "action_analysis")).toBe(analysis);
        const initialPlan = await read(runtime, created.candidate_id, "plan") as any;
        expect(initialPlan.action_analysis_markdown).toBe(analysis);
        expect((await read(runtime, created.candidate_id, "json") as any).plan.action_analysis_markdown).toBe(analysis);
        expect((await read(runtime, created.candidate_id, "report") as string[]).join("")).toContain(analysis);
        const summary = (await runtime.handlers.getDeckCandidate({id:created.candidate_id}))._unsafeUnwrap() as any;
        expect(summary).toMatchObject({updated_at:created.updated_at, pool_size:0, research:{action_analysis:{present:true,bytes:Buffer.byteLength(analysis)},search_research:{present:false,bytes:0}}});
        expect(summary.validation_evidence.status).toBe("absent");
        const saved = (await runtime.handlers.editDeckCandidate({candidate_id:created.candidate_id,expected_updated_at:created.updated_at,changes:{plan:{schema_version:1,search_research_markdown:"Exemplars and tag meanings"}}}))._unsafeUnwrap();
        expect(saved.summary).not.toContain(analysis);
        expect(saved.research).toMatchObject({action_analysis:{present:true,bytes:Buffer.byteLength(analysis)},search_research:{present:true,bytes:26}});
        expect(await read(runtime, created.candidate_id, "action_analysis")).toBe(analysis);
        expect(await read(runtime, created.candidate_id, "search_research")).toBe("Exemplars and tag meanings");
        const conflict = await runtime.handlers.editDeckCandidate({candidate_id:created.candidate_id,expected_updated_at:created.updated_at,changes:{plan:{schema_version:1,action_analysis_markdown:null}}});
        expect(conflict.isErr()).toBe(true);
        (await runtime.handlers.editDeckCandidate({candidate_id:created.candidate_id,expected_updated_at:saved.updated_at,changes:{plan:{schema_version:1,action_analysis_markdown:null}}}))._unsafeUnwrap();
        const plan = await read(runtime, created.candidate_id, "plan") as any;
        expect(plan.action_analysis_markdown).toBeNull();
        expect(plan.search_research_markdown).toBe("Exemplars and tag meanings");
        expect(plan.nodes).toEqual([]);
    } finally {runtime.close(); f.dispose();}
});
