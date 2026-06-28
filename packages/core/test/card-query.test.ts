import {describe, expect, test} from "bun:test";
import {parseCardQueryInput} from "@mtg-agent/core";

describe("Card Query validation", () => {
    test("rejects unsupported queryable properties with structured issues", () => {
        const result = parseCardQueryInput({
            filter: {op: "=", args: [{property: "collection.sourceRowNumber"}, 2]},
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("Expected Card Query validation to fail.");
        expect(result.error).toMatchObject({
            type: "validation_error",
            code: "invalid_card_query",
            issues: [
                expect.objectContaining({
                    pointer: "#/filter/args/0/property",
                    code: "invalid_queryable",
                }),
            ],
        });
    });
});
