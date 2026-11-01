import {expect,test} from "bun:test";
import baseline from "../src/economy-baseline.json";
import {runEconomyEvaluation} from "../src/economy";

test("matched research preserves required facts while reducing cumulative tool-text tokens on every actual adapter", async () => {
    const staged = await runEconomyEvaluation();
    const rich = await runEconomyEvaluation({staged:false});
    expect(staged.fixtureSha256).toBe(baseline.fixtureSha256);
    expect(staged.requiredFacts).toEqual(baseline.requiredFacts);
    expect(rich.requiredFacts).toEqual(baseline.requiredFacts);
    expect(staged.modelRun).toBe(false);
    for(const surface of ["application","opencode","pi_fallback","pi_worker"] as const) {
        expect(rich.surfaces[surface]!.totalTokens).toBeLessThan(baseline.surfaces[surface].totalTokens);
        expect(staged.surfaces[surface]!.totalTokens).toBeLessThan(rich.surfaces[surface]!.totalTokens);
        // Measured staged count is 2,333; this ceiling allows encoding/runtime variation without erasing savings.
        expect(staged.surfaces[surface]!.totalTokens).toBeLessThanOrEqual(2500);
    }
    expect(staged.componentTokens.collectionEvidence).toBe(0);
    expect(staged.hydratedOccurrences).toBe(2);
    expect(staged.repeatedHydratedFacts).toBe(0);
    expect(staged.maxCursorCharacters).toBeLessThanOrEqual(260);
    expect(staged.encodingComparison.reduce((n,e)=>n+e.deflated,0)).toBeLessThan(staged.encodingComparison.reduce((n,e)=>n+e.positionalJson,0));
},30000);
