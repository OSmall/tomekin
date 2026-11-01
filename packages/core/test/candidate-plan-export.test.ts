import {expect,test} from "bun:test";
import {exportCandidatePlan,renderSavedDeckCandidate,renderPortableDecklist} from "@tomekin/core";
import {candidatePlanFixture} from "./fixtures/candidate-plan";
test("developer JSON preserves all authority and Mermaid distinguishes selection, alternatives, gaps, priorities and symmetric competition", () => {
    const candidate = candidatePlanFixture();
    const json = exportCandidatePlan(candidate,{format:"json",projection:"strategy"});
    expect(json.isOk()).toBe(true);
    expect(JSON.parse(json.value).candidate).toEqual(candidate);
    const pool = exportCandidatePlan(candidate,{format:"mermaid",projection:"pool"}).value;
    expect(pool).toContain("competes_with");
    expect(pool).toContain(' ---|"competes_with"| ');
    expect(pool).toContain("3 mainboard; 1 sideboard");
    expect(pool).toContain("Pool only");
    expect(pool).toContain("Gap: Protection");
    expect(pool).toContain("primary");
    expect(pool).toContain("secondary");
    expect(pool).toContain("#34;");
    expect(pool).not.toContain("<br/>");
    const reordered = {...candidate, options:[...candidate.options].reverse(),plan:{...candidate.plan!,nodes:[...candidate.plan!.nodes].reverse(),relationships:[...candidate.plan!.relationships].reverse(),contributions:[...candidate.plan!.contributions].reverse()}};
    expect(exportCandidatePlan(reordered,{format:"mermaid",projection:"pool"}).value).toBe(pool);
    const strategy = exportCandidatePlan(candidate,{format:"mermaid",projection:"strategy"}).value;
    expect(strategy).not.toContain("Forest (3 mainboard");
    const selected = exportCandidatePlan(candidate,{format:"mermaid",projection:"selected"}).value;
    expect(selected).toContain("Forest");
    expect(selected).not.toContain("Pool Alternative");
    expect(exportCandidatePlan({...candidate,plan:null},{format:"mermaid",projection:"pool"}).isErr()).toBe(true);
    expect(exportCandidatePlan(candidate,{format:"svg",projection:"pool"}).isErr()).toBe(true);
});
test("saved reports retain reasoning and selected canonical decklist with explicit missing judgments", () => {
    const report = renderSavedDeckCandidate(candidatePlanFixture());
    expect(report.portableDecklist).toBe("Mainboard\n3 Forest\n\nSideboard\n1 Forest");
    expect(report.markdown).toContain("Unrecorded.");
    expect(report.markdown).toContain("One use per turn");
    expect(report.markdown).toContain("Synthetic card facts");
    expect(report.markdown).toContain("Still seeking resilient protection");
    expect(report.markdown).toContain('"status": "absent"');
});
test("reports preserve complete recorded findings and mark outdated evidence without manufacturing focused judgments",()=>{
    const candidate=candidatePlanFixture();
    candidate.validation_evidence={status:"outdated",checks:{format_legality:{status:"outdated",checked_at:candidate.updatedAt,dependencies:{selected_changed_at:candidate.updatedAt,brief_changed_at:candidate.updatedAt,brief_inputs:{format:"casual_60"},reference_imports:[],reference_contract_revision:1,validator_versions:{format_legality:"1"}},result:{status:"illegal",reasons:["Recorded construction finding remains inspectable"]}},deck_evaluation:{status:"absent"}}};
    const report=renderSavedDeckCandidate(candidate).markdown;
    expect(report).toContain("Recorded construction finding remains inspectable");
    expect(report).toContain('"status": "outdated"');
    expect(report).toContain("Unrecorded.");
});

test("Portable Decklist exposes every persisted selected section even for incomplete unchecked construction",()=>{
    const candidate=candidatePlanFixture();
    expect(renderPortableDecklist("commander",candidate.cards)).toBe("Commander\n\nMainboard\n3 Forest\n\nSideboard\n1 Forest");
});
