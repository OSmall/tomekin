import {describe, expect, test} from "bun:test";
import {parseCardQueryInput} from "@tomekin/core";

describe("Card Query validation", () => {
    test("accepts omitted envelope fields and empty include objects", () => {
        expect(parseCardQueryInput({}).isOk()).toBe(true);
        expect(parseCardQueryInput({include: {}}).isOk()).toBe(true);
    });

    test("accepts collection quantity greater than zero as the owned-card idiom", () => {
        expect(parseCardQueryInput({
            filter: {op: ">", args: [{property: "collection.quantity"}, 0]},
        }).isOk()).toBe(true);
    });

    test("accepts explicit relationship-scope operators with valid child subtrees", () => {
        expect(parseCardQueryInput({
            filter: {
                op: "withTagging",
                args: [{
                    op: "and",
                    args: [
                        {op: "hasTagInHierarchy", args: [{property: "tag.id"}, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]},
                        {op: "=", args: [{property: "tag.weight"}, "strong"]},
                    ],
                }],
            },
        }).isOk()).toBe(true);

        expect(parseCardQueryInput({
            filter: {
                op: "withCollectionCard",
                args: [{
                    op: "or",
                    args: [
                        {op: "=", args: [{property: "collection.locationType"}, "binder"]},
                        {op: ">", args: [{property: "collection.quantity"}, 0]},
                    ],
                }],
            },
        }).isOk()).toBe(true);
    });

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

    test.each([
        ["filter", {filter: null}, "#/filter", "invalid_type"],
        ["sortby", {sortby: null}, "#/sortby", "invalid_type"],
        ["include", {include: null}, "#/include", "invalid_type"],
        ["limit", {limit: null}, "#/limit", "invalid_type"],
        ["empty filter", {filter: {}}, "#/filter/op", "invalid_operator"],
        ["empty and", {filter: {op: "and", args: []}}, "#/filter/args", "too_small"],
        ["empty or", {filter: {op: "or", args: []}}, "#/filter/args", "too_small"],
        ["empty sortby", {sortby: []}, "#/sortby", "too_small"],
        ["empty legalities", {include: {legalities: []}}, "#/include/legalities", "too_small"],
        ["boolean in", {
            filter: {
                op: "in",
                args: [{property: "identity.gameChanger"}, [true]]
            }
        }, "#/filter/args/0/property", "invalid_operator"],
        ["ordering string", {
            filter: {
                op: ">",
                args: [{property: "identity.name"}, "Sol Ring"]
            }
        }, "#/filter/args/0/property", "invalid_operator"],
        ["tag ranked comparison", {
            filter: {
                op: ">",
                args: [{property: "tag.weight"}, "strong"]
            }
        }, "#/filter/args/0/property", "invalid_operator"],
        ["tag inequality", {
            filter: {
                op: "!=",
                args: [{property: "tag.slug"}, "ramp"]
            }
        }, "#/filter/args/0/property", "invalid_operator"],
        ["collection inequality", {
            filter: {
                op: "!=",
                args: [{property: "collection.locationType"}, "binder"]
            }
        }, "#/filter/args/0/property", "invalid_collection_semantics"],
        ["collection zero quantity", {
            filter: {
                op: "=",
                args: [{property: "collection.quantity"}, 0]
            }
        }, "#/filter/args/1", "invalid_collection_semantics"],
        ["collection less than one", {
            filter: {
                op: "<",
                args: [{property: "collection.quantity"}, 1]
            }
        }, "#/filter/args/1", "invalid_collection_semantics"],
        ["not over tag", {
            filter: {
                op: "not",
                args: [{op: "=", args: [{property: "tag.slug"}, "ramp"]}]
            }
        }, "#/filter", "invalid_collection_semantics"],
        ["not over collection", {
            filter: {
                op: "not",
                args: [{op: "=", args: [{property: "collection.locationType"}, "binder"]}]
            }
        }, "#/filter", "invalid_collection_semantics"],
        ["not over withTagging", {
            filter: {
                op: "not",
                args: [{op: "withTagging", args: [{op: "=", args: [{property: "tag.slug"}, "draw"]}]}]
            }
        }, "#/filter", "invalid_collection_semantics"],
        ["withTagging multiple children", {
            filter: {
                op: "withTagging",
                args: [
                    {op: "=", args: [{property: "tag.slug"}, "draw"]},
                    {op: "=", args: [{property: "tag.weight"}, "strong"]},
                ]
            }
        }, "#/filter/args", "invalid_length"],
        ["withCollectionCard multiple children", {
            filter: {
                op: "withCollectionCard",
                args: [
                    {op: "=", args: [{property: "collection.locationName"}, "Main Binder"]},
                    {op: "=", args: [{property: "collection.finish"}, "foil"]},
                ]
            }
        }, "#/filter/args", "invalid_length"],
        ["identity inside withTagging", {
            filter: {
                op: "withTagging",
                args: [{op: "=", args: [{property: "identity.name"}, "Rhystic Study"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["legality inside withTagging", {
            filter: {
                op: "withTagging",
                args: [{op: "=", args: [{property: "legality.commander"}, "legal"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["collection inside withTagging", {
            filter: {
                op: "withTagging",
                args: [{op: "=", args: [{property: "collection.locationType"}, "binder"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["not inside withTagging", {
            filter: {
                op: "withTagging",
                args: [{op: "not", args: [{op: "=", args: [{property: "tag.slug"}, "draw"]}]}]
            }
        }, "#/filter/args/0", "invalid_relationship_scope"],
        ["identity inside withCollectionCard", {
            filter: {
                op: "withCollectionCard",
                args: [{op: "=", args: [{property: "identity.name"}, "Sol Ring"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["legality inside withCollectionCard", {
            filter: {
                op: "withCollectionCard",
                args: [{op: "=", args: [{property: "legality.commander"}, "legal"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["tag inside withCollectionCard", {
            filter: {
                op: "withCollectionCard",
                args: [{op: "=", args: [{property: "tag.slug"}, "draw"]}]
            }
        }, "#/filter/args/0/args/0/property", "invalid_relationship_scope"],
        ["hasTagInHierarchy inside withCollectionCard", {
            filter: {
                op: "withCollectionCard",
                args: [{op: "hasTagInHierarchy", args: [{property: "tag.id"}, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]}]
            }
        }, "#/filter/args/0", "invalid_relationship_scope"],
        ["not inside withCollectionCard", {
            filter: {
                op: "withCollectionCard",
                args: [{op: "not", args: [{op: "=", args: [{property: "collection.locationType"}, "binder"]}]}]
            }
        }, "#/filter/args/0", "invalid_relationship_scope"],
    ])("rejects invalid input: %s", (_name, input, pointer, code) => {
        const issue = firstIssue(parseCardQueryInput(input));

        expect(issue).toEqual(expect.objectContaining({pointer, code}));
    });

    test("reports unknown envelope, include, filter, and sort fields with product-stable issue codes", () => {
        const result = parseCardQueryInput({
            extra: true,
            include: {tags: true, extraInclude: true},
            sortby: [{property: "identity.name", direction: "asc", extraSort: true}],
            filter: {op: "=", args: [{property: "identity.name"}, "Sol Ring"], extraFilter: true},
        });

        expectIssues(result, [
            ["#/extra", "unknown_field"],
            ["#/include/extraInclude", "unknown_field"],
            ["#/sortby/0/extraSort", "unknown_field"],
            ["#/filter/extraFilter", "unknown_field"],
        ]);
    });

    test("reports duplicate sort and legality values at the later duplicate pointer", () => {
        const result = parseCardQueryInput({
            include: {legalities: ["commander", "commander"]},
            sortby: [
                {property: "identity.name", direction: "asc"},
                {property: "identity.name", direction: "desc"},
            ],
        });

        expectIssues(result, [
            ["#/include/legalities/1", "duplicate_value"],
            ["#/sortby/1/property", "duplicate_value"],
        ]);
    });

    test("returns allowed values for finite invalid values", () => {
        const result = parseCardQueryInput({
            include: {legalities: ["all"]},
            sortby: [{property: "tag.weight", direction: "up"}],
            filter: {op: "=", args: [{property: "legality.commander"}, "unknown"]},
        });

        expect(result.isErr()).toBe(true);
        if (result.isOk()) throw new Error("Expected Card Query validation to fail.");
        expect(result.error.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                pointer: "#/include/legalities/0",
                code: "invalid_value",
                allowedValues: ["commander"]
            }),
            expect.objectContaining({
                pointer: "#/sortby/0/property",
                code: "invalid_value",
                allowedValues: expect.arrayContaining(["identity.name"])
            }),
            expect.objectContaining({
                pointer: "#/sortby/0/direction",
                code: "invalid_value",
                allowedValues: ["asc", "desc"]
            }),
            expect.objectContaining({
                pointer: "#/filter/args/1",
                code: "invalid_value",
                allowedValues: expect.arrayContaining(["legal"])
            }),
        ]));
    });
});

function firstIssue(result: ReturnType<typeof parseCardQueryInput>) {
    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("Expected Card Query validation to fail.");
    return result.error.issues[0];
}

function expectIssues(result: ReturnType<typeof parseCardQueryInput>, expected: readonly (readonly [string, string])[]) {
    expect(result.isErr()).toBe(true);
    if (result.isOk()) throw new Error("Expected Card Query validation to fail.");
    expect(result.error.issues).toEqual(expect.arrayContaining(expected.map(([pointer, code]) => expect.objectContaining({
        pointer,
        code
    }))));
}
