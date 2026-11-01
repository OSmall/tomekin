import {expect, test} from "bun:test";
import {runCollectionQueryEvaluation} from "../src/collection-query";

test("matched Collection workflows recover every expected identity and exact same-row evidence through actual adapters", async () => {
    const report = await runCollectionQueryEvaluation({warmRuns: 1});
    expect(report.workflows.map(workflow => [workflow.name, workflow.returnedCount])).toEqual([["discovery", 8], ["construction", 26], ["tuning", 8], ["assembly", 26]]);
    for (const workflow of report.workflows) {
        expect(workflow.coverage).toEqual({missing: [], unexpected: [], duplicates: []});
        expect(workflow.evidenceCorrect).toBe(true);
        expect(workflow.completeOracleText).toBe(true);
        expect(workflow.scopedTotal).toBeNull();
        expect(workflow.pageBytes.every(bytes => bytes <= 51_200)).toBe(true);
        for (const adapter of Object.values(workflow.adapters)) expect(adapter.completeEnvelope).toBe(true);
    }
}, 30_000);
