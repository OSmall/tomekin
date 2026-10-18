import {expect, test} from "bun:test";
import {runWorkflowIntegration} from "../src/workflows";

test("discovery qualifies transient directions and resumes incomplete construction before partially accepted tuning and joint assembly", async () => {
    const result = await runWorkflowIntegration();
    expect(result.discovery).toMatchObject({persistedCandidates: 0, inspected: 5, qualifiedDirections: 1, rejectedTagOnlyHit: true, independentFunctionalSearch: true});
    expect(result.construction).toMatchObject({incompleteSelection: 0, resumedOptions: 6, implicitEvidence: "absent", selectedCopies: 60});
    expect(result.tuning).toMatchObject({selectedCopies: 60, sacrificeCopies: 7, cutOptionRetained: true, rejectedCompensationApplied: false});
    expect(result.assembly).toMatchObject({required: 60, eligible: 60, sufficient: true, recoveredAllocatedCopies: 60, overlapShortage: 1, poolAlternativeExported: false});
    expect(result.adapters).toEqual({piWorker: true, piFallback: true, openCode: true});
    expect(result.statistics.commander).toBeCloseTo(0.703692876224591, 14);
    expect(result.statistics.sixtyCard).toBeCloseTo(0.399499625744, 11);
    expect(result.statistics.minimumCopies).toBe(7);
}, 30_000);
