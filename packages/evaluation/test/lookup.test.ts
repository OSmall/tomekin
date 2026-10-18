import {expect, test} from "bun:test";
import {runLookupEvaluation} from "../src/lookup";

test("matched workflow lookup measures complete facts, ordinary recovery and actual adapter envelopes", async () => {
    const report = await runLookupEvaluation({warmRuns: 1});
    expect(report.workflows.map((workflow) => workflow.name)).toEqual(["discovery", "construction", "tuning", "assembly"]);
    for (const workflow of report.workflows) {
        expect(workflow).toMatchObject({providerCalls: 0, requestedOccurrences: 7, returnedOccurrences: 7, pages: 3, coverage: {missing: [], unexpected: [], duplicates: []}, completeRequiredFacts: {oracleTextSourceCharacters: 1300, oracleTextReturnedCharacters: 1300, completeOracleText: true}, additionalFacts: {returned: 5, repeatedOracleText: 0}});
        for (const adapter of Object.values(workflow.adapters)) expect(adapter.completeEnvelope).toBe(true);
        expect(workflow.pageBytes.every((bytes) => bytes <= 51_200)).toBe(true);
    }
}, 30_000);
