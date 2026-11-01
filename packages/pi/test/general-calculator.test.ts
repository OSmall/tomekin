import {expect, test} from "bun:test";
import {auditPiToolRegistry, createGeneralCalculatorTool, expectedPiToolNames} from "@tomekin/pi";

test("approved calculator executes a bounded numeric expression without data access", async () => {
    expect(expectedPiToolNames).toContain("calculate");
    expect(() => auditPiToolRegistry(expectedPiToolNames)).not.toThrow();
    const tool = createGeneralCalculatorTool();
    expect(JSON.parse(JSON.stringify(tool.parameters)).additionalProperties).toBe(false);
    const output = await tool.execute("arithmetic", {expression: "3 * (1 + 2)^2"}, new AbortController().signal);
    expect(output.details).toEqual({expression: "3 * (1 + 2)^2", result: 27});
});


test("calculator rejects invalid, non-finite and privileged expressions", async () => {
    const tool = createGeneralCalculatorTool();
    for (const expression of ["1 / 0", "sqrt(-1)", "a = 3", "import(1)", "process.env", "[1, 2]", "1 +", "2!", "x".repeat(513)]) {
        const output = await tool.execute("invalid", {expression}, new AbortController().signal);
        expect(output.details).toMatchObject({error: "invalid_expression", message: expect.any(String)});
    }
    const output = await tool.execute("functions", {expression: "sqrt(16) + max(2, 3)"}, new AbortController().signal);
    expect(output.details).toEqual({expression: "sqrt(16) + max(2, 3)", result: 7});
});
