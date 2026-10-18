import {expect, test} from "bun:test";
import {runSearchEvaluation} from "../src/search";
test("matched synthetic provider workflows measure complete ordinary traversal and adapter envelopes", async () => {
    const report = await runSearchEvaluation({warmRuns: 1});
    expect(report.workflows.map((workflow) => workflow.name)).toEqual([
        "discovery",
        "construction",
        "tuning",
        "assembly",
    ]);
    for (const workflow of report.workflows) {
        expect(workflow.coverage).toEqual({
            missing: [],
            unexpected: [],
            duplicates: [],
        });
        expect(workflow.returnedCount).toBe(workflow.sourceCount);
        expect(workflow.completeOracleText).toBe(true);
        expect(workflow.scopedTotal).toBeNull();
        expect(workflow.providerCalls).toBeGreaterThan(0);
        for (const adapter of Object.values(workflow.adapters))
            expect(adapter.completeEnvelope).toBe(true);
        expect(workflow.pageBytes.every((bytes) => bytes <= 51200)).toBe(true);
    }
}, 30000);
