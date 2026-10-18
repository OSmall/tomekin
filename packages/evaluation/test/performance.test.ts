import {expect, test} from "bun:test";
import {runCandidatePerformance} from "../src/performance";

test("three-card performance measurements preserve complete selection and explicit final evidence", async () => {
    const report = await runCandidatePerformance({warmRuns: 1});
    expect(report.workloads.map(item => item.name)).toEqual(["tuning", "commanderSize"]);
    for (const workload of report.workloads) {
        expect(workload.selection).toMatchObject({added: 3, removed: 3, retainedCutOptions: 3, roleReferencesIntact: true});
        expect(workload.coverage).toEqual({missing: [], unexpected: [], duplicates: []});
        expect(workload.checksBeforeExplicit).toEqual({legality: "absent", evaluation: "absent", collection_availability: "absent"});
        expect(workload.checksAfterExplicit).toEqual({legality: "applicable", evaluation: "applicable", collection_availability: "applicable"});
        expect(workload.contentTimestampPreservedByChecks).toBe(true);
        expect(workload.availability).toMatchObject({required: workload.name === "tuning" ? 60 : 100, missing_owned: workload.name === "tuning" ? 53 : 100, sufficient: false});
        expect(workload.renderedSelectedRows).toBe(workload.name === "tuning" ? 12 : 69);
        expect(workload.editPayload).toMatchObject({repeatedBriefBytes: 0, repeatedUnchangedMemberships: 0});
        expect(workload.adapterEdits).toMatchObject({fallback: {complete: true}, workerCold: {complete: true}, workerWarm: {complete: true}, openCode: {complete: true}});
        expect(workload.timings.candidateEdit!.warm.samplesMs).toHaveLength(1);
    }
}, 30_000);
