import {expect, test} from "bun:test";
import {runBaseline} from "../src/baseline";

// Full runs seed fresh SQLite databases and start actual Workers for every observation.
// Allow concurrent CI work without turning Bun's default timeout into a latency target.
const workflowTestTimeoutMs = 30_000;

test("synthetic workflow baseline accounts for complete local evidence and legacy three-card replacement", async () => {
    const report = await runBaseline({warmRuns: 1});
    expect(report.workflows.map((workflow) => workflow.name)).toEqual(["discovery", "construction", "tuning", "assembly"]);
    expect(report.workflows[0]!.observed).toMatchObject({identities: 12, printings: 16, ownedRows: 10, copies: 14, allowedIdentities: 8});
    expect(report.workflows[1]!.observed).toMatchObject({identities: 26, printings: 30, ownedRows: 28, copies: 100, allowedIdentities: 26});
    expect(report.workflows[2]!.threeCardSave).toMatchObject({beforeRows: 12, afterRows: 12, quantity: 60, added: 3, removed: 3});
    expect(report.workflows[3]!.selected).toMatchObject({rows: 20, copies: 60});
    for (const workflow of report.workflows) expect(workflow.coverage).toEqual({missing: [], unexpected: [], duplicates: []});
}, workflowTestTimeoutMs);

import {coverage, utf8Bytes} from "../src/baseline";
import {createFixture, id} from "../src/fixtures";

test("baseline detects missing, unexpected and duplicated evidence independently", () => {
    expect(coverage(["a", "b"], ["a", "a", "c"])).toEqual({missing: ["b"], unexpected: ["c"], duplicates: ["a"]});
    expect(utf8Bytes("Æ😀")).toBe(6);
});

test("adapter measurements expose whole-record loss and preserve same-copy witnesses", async () => {
    const report = await runBaseline({warmRuns: 1});
    const construction = report.workflows[1]!;
    expect(construction.application.utf8Bytes).toBeGreaterThan(construction.application.utf16Characters);
    expect(construction.adapters.piFallback.clipped).toBe(true);
    expect(construction.adapters.piWorker.clipped).toBe(true);
    expect(construction.adapters.piWorker.completeRecords).toBe(0);
    expect(construction.adapters.openCode.completeRecords).toBe(26);
    const fixture = createFixture("construction");
    try {
        expect(construction.scopedEvidence.sameRowWitnesses).toEqual(fixture.rows.map((row) => ({row: row.id, printing: row.printingId, location: row.locationId, finish: row.finish, quantity: row.quantity})).sort((a, b) => a.row.localeCompare(b.row)));
    } finally {fixture.dispose();}
    expect(report.workflows[0]!.scopedEvidence.sameRowWitnesses.every((row) => row.location !== id(903))).toBe(true);
}, workflowTestTimeoutMs);

test("baseline exposes old bounded-query and long-text losses rather than certifying complete facts", async () => {
    const report = await runBaseline({warmRuns: 1});
    expect(report.workflows[0]!.boundedTraversal).toMatchObject({requested: 3, returned: 3, missing: 5, recovery: "unsupported"});
    expect(report.workflows[0]!.factCompleteness).toMatchObject({longTextSourceCharacters: 1300, longTextReturnedCharacters: 500, complete: false});
    expect(report.commanderSizeWorkload).toMatchObject({beforeRows: 69, afterRows: 69, quantity: 100, added: 3, removed: 3});
}, workflowTestTimeoutMs);
