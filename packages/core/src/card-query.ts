import {err, ok, type Result} from "neverthrow";
import {z} from "zod";
import type {CollectionFinish, CollectionLocationType} from "./collection-import";
import {
    type CardIdentityTaggingWeight,
    type ColorIdentity,
    colorIdentityValues,
    type FormatLegality,
    formatLegalityValues
} from "./scryfall-sync";

export const cardQueryPropertyValues = [
    "identity.id",
    "identity.name",
    "identity.typeLine",
    "identity.oracleText",
    "identity.manaValue",
    "identity.colorIdentity",
    "identity.colors",
    "identity.gameChanger",
    "identity.edhrecRank",
    "legality.commander",
    "tag.id",
    "tag.slug",
    "tag.label",
    "tag.alias",
    "tag.weight",
    "collection.quantity",
    "collection.locationName",
    "collection.locationType",
    "collection.finish",
    "collection.altered",
    "collection.misprint",
] as const;
export type CardQueryProperty = (typeof cardQueryPropertyValues)[number];

export const cardQuerySortablePropertyValues = [
    "identity.id",
    "identity.name",
    "identity.manaValue",
    "identity.colorIdentity",
    "identity.edhrecRank",
    "collection.quantity",
] as const;
export type CardQuerySortableProperty = (typeof cardQuerySortablePropertyValues)[number];

export type CardQueryPropertyRef = { readonly property: CardQueryProperty };
export type CardQueryScalar = string | number | boolean;
export type CardQueryValue = CardQueryScalar | readonly CardQueryScalar[];
export type CardQueryFilter =
    | { readonly op: "and" | "or"; readonly args: readonly CardQueryFilter[] }
    | { readonly op: "not"; readonly args: readonly [CardQueryFilter] }
    | {
    readonly op: "=" | "!=" | "<" | "<=" | ">" | ">=" | "contains" | "in" | "colorIdentitySubsetOf" | "hasTagInHierarchy";
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
};
type AtomicCardQueryFilter = Extract<CardQueryFilter, {
    readonly args: readonly [CardQueryPropertyRef, CardQueryValue]
}>;

export type CardQueryInclude = {
    readonly legalities?: readonly ["commander", ..."commander"[]] | undefined;
    readonly tags?: boolean | undefined;
    readonly collectionCards?: boolean | undefined;
};

export type CardQuerySort = {
    readonly property: CardQuerySortableProperty;
    readonly direction: "asc" | "desc";
};

export type CardQueryInput = {
    readonly filter?: CardQueryFilter | undefined;
    readonly sortby?: readonly CardQuerySort[] | undefined;
    readonly include?: CardQueryInclude | undefined;
    readonly limit?: number | undefined;
};

export type CardQueryCollectionCardResult = {
    readonly collectionCardId: string;
    readonly quantity: number;
    readonly finish: CollectionFinish;
    readonly altered: boolean;
    readonly misprint: boolean;
    readonly condition: string | null;
    readonly locationId: string;
    readonly locationName: string;
    readonly locationType: CollectionLocationType;
    readonly cardPrintingId: string;
    readonly printedName: string | null;
    readonly setCode: string;
    readonly collectorNumber: string;
    readonly language: string;
};

export type CardQueryTagResult = {
    readonly tagId: string;
    readonly slug: string;
    readonly label: string;
    readonly weight: CardIdentityTaggingWeight;
    readonly annotation: string | null;
};

export type CardQueryResultItem = {
    readonly id: string;
    readonly name: string;
    readonly manaCost: string | null;
    readonly manaValue: number;
    readonly typeLine: string;
    readonly oracleText: string | null;
    readonly colorIdentity: ColorIdentity;
    readonly gameChanger: boolean;
    readonly edhrecRank: number | null;
    readonly legalities?: Partial<Record<"commander", FormatLegality>> | undefined;
    readonly tags?: {
        readonly direct: readonly CardQueryTagResult[];
        readonly inherits: readonly CardQueryTagResult[]
    } | undefined;
    readonly collectionCards?: readonly CardQueryCollectionCardResult[] | undefined;
};

export type CardQueryResult = {
    readonly limit: number;
    readonly items: readonly CardQueryResultItem[];
};

export type CardQueryValidationIssue = {
    readonly pointer: string;
    readonly code: string;
    readonly message: string;
    readonly allowedValues?: readonly string[] | undefined;
};

export type CardQueryError =
    | {
    readonly type: "validation_error";
    readonly code: "invalid_card_query";
    readonly message: string;
    readonly issues: readonly CardQueryValidationIssue[]
}
    | { readonly type: "repository_error"; readonly message: string };

export type CardQueryRepository = {
    queryCards(input: CardQueryInput): Promise<Result<CardQueryResult, CardQueryError>>;
};

const propertyValues = new Set<string>(cardQueryPropertyValues);
const sortablePropertyValues = new Set<string>(cardQuerySortablePropertyValues);
const scalarOperators = new Set(["=", "!=", "<", "<=", ">", ">="]);
const operatorValues = new Set(["and", "or", "not", "=", "!=", "<", "<=", ">", ">=", "contains", "in", "colorIdentitySubsetOf", "hasTagInHierarchy"]);
const colorIdentitySet = new Set<string>(colorIdentityValues);
const formatLegalitySet = new Set<string>(formatLegalityValues);
const numericProperties = new Set<CardQueryProperty>(["identity.manaValue", "identity.edhrecRank", "collection.quantity"]);
const booleanProperties = new Set<CardQueryProperty>(["identity.gameChanger", "collection.altered", "collection.misprint"]);

export function parseCardQueryInput(input: unknown): Result<CardQueryInput, CardQueryError> {
    if (input === undefined) return ok({});
    if (!isRecord(input)) return err(validationError([{
        pointer: "#",
        code: "invalid_type",
        message: "Card Query input must be an object."
    }]));

    const issues: CardQueryValidationIssue[] = [];
    for (const key of Object.keys(input)) {
        if (!["filter", "sortby", "include", "limit"].includes(key)) issues.push(unknownFieldIssue(`#/${escapePointer(key)}`, key));
    }
    if ("filter" in input) issues.push(...validateFilter(input.filter, "#/filter"));
    if ("sortby" in input) issues.push(...validateSortby(input.sortby, "#/sortby"));
    if ("include" in input) issues.push(...validateInclude(input.include, "#/include"));
    if ("limit" in input) issues.push(...validateLimit(input.limit, "#/limit"));

    if (issues.length > 0) return err(validationError(issues));
    return ok(input as CardQueryInput);
}

export function filterHasCollectionPredicate(filter: CardQueryFilter | undefined): boolean {
    if (!filter) return false;
    if (filter.op === "and" || filter.op === "or") return filter.args.some(filterHasCollectionPredicate);
    if (filter.op === "not") return filterHasCollectionPredicate(filter.args[0]);
    return isAtomicFilter(filter) && filter.args[0].property.startsWith("collection.");
}

function isAtomicFilter(filter: CardQueryFilter): filter is AtomicCardQueryFilter {
    return filter.op !== "and" && filter.op !== "or" && filter.op !== "not";
}

function validateFilter(value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (!isRecord(value)) return [{pointer, code: "invalid_type", message: "filter must be an object."}];
    const issues: CardQueryValidationIssue[] = [];
    for (const key of Object.keys(value)) {
        if (key !== "op" && key !== "args") issues.push({
            pointer: `${pointer}/${escapePointer(key)}`,
            code: "unknown_field",
            message: `Unknown filter key: ${key}.`
        });
    }
    if (typeof value.op !== "string" || !operatorValues.has(value.op)) {
        issues.push({
            pointer: `${pointer}/op`,
            code: "invalid_operator",
            message: "Unsupported filter operator.",
            allowedValues: [...operatorValues]
        });
        return issues;
    }
    if (!Array.isArray(value.args)) {
        issues.push({pointer: `${pointer}/args`, code: "invalid_type", message: "filter.args must be an array."});
        return issues;
    }
    if (value.op === "and" || value.op === "or") {
        if (value.args.length === 0) issues.push({
            pointer: `${pointer}/args`,
            code: "too_small",
            message: `${value.op} requires at least one argument.`
        });
        return [...issues, ...value.args.flatMap((arg, index) => validateFilter(arg, `${pointer}/args/${index}`))];
    }
    if (value.op === "not") {
        if (value.args.length !== 1) return [...issues, {
            pointer: `${pointer}/args`,
            code: "invalid_length",
            message: "not requires exactly one filter argument."
        }];
        const childIssues = validateFilter(value.args[0], `${pointer}/args/0`);
        if (containsRelationshipPredicate(value.args[0])) issues.push({
            pointer,
            code: "invalid_collection_semantics",
            message: "not is not supported over collection.* or tag.* predicates."
        });
        return [...issues, ...childIssues];
    }
    if (value.args.length !== 2) issues.push({
        pointer: `${pointer}/args`,
        code: "invalid_length",
        message: `${value.op} requires a property reference and one value.`
    });
    const propertyRef = value.args[0];
    if (!isRecord(propertyRef) || typeof propertyRef.property !== "string" || !propertyValues.has(propertyRef.property)) {
        issues.push({
            pointer: `${pointer}/args/0/property`,
            code: "invalid_queryable",
            message: "Unsupported queryable property.",
            allowedValues: cardQueryPropertyValues
        });
        return issues;
    }
    return [...issues, ...validateOperatorValue(value.op, propertyRef.property as CardQueryProperty, value.args[1], `${pointer}/args/1`)];
}

function validateOperatorValue(op: string, property: CardQueryProperty, value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (op === "contains") {
        if (!["identity.name", "identity.typeLine", "identity.oracleText"].includes(property)) return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: `contains is not supported for ${property}.`
        }];
        return typeof value === "string" ? [] : [{
            pointer,
            code: "invalid_type",
            message: "contains requires a string value."
        }];
    }
    if (op === "in") {
        if (booleanProperties.has(property)) return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: `in is not supported for boolean property ${property}.`
        }];
        if (!Array.isArray(value) || value.length === 0) return [{
            pointer,
            code: "invalid_type",
            message: "in requires a non-empty array value."
        }];
        return value.flatMap((item, index) => validateScalarValue("=", property, item, `${pointer}/${index}`));
    }
    if (op === "colorIdentitySubsetOf") {
        if (property !== "identity.colorIdentity") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: "colorIdentitySubsetOf only supports identity.colorIdentity."
        }];
        return typeof value === "string" && colorIdentitySet.has(value) ? [] : [{
            pointer,
            code: "invalid_enum_value",
            message: "colorIdentitySubsetOf requires a valid Color Identity value.",
            allowedValues: colorIdentityValues
        }];
    }
    if (op === "hasTagInHierarchy") {
        if (property !== "tag.id") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: "hasTagInHierarchy only supports tag.id."
        }];
        return typeof value === "string" && z.uuid().safeParse(value).success ? [] : [{
            pointer,
            code: "invalid_string",
            message: "hasTagInHierarchy requires a tag UUID."
        }];
    }
    if (scalarOperators.has(op)) {
        if (property.startsWith("tag.") && op === "!=") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: "!= is not supported for tag.* predicates."
        }];
        if (property.startsWith("collection.") && op === "!=") return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_collection_semantics",
            message: "!= is not supported for collection.* predicates."
        }];
        if (["<", "<=", ">", ">="].includes(op) && !numericProperties.has(property)) return [{
            pointer: pointer.replace(/\/1$/, "/0/property"),
            code: "invalid_operator",
            message: `Ordering comparisons are not supported for ${property}.`
        }];
        return validateScalarValue(op, property, value, pointer);
    }
    return [];
}

function validateScalarValue(op: string, property: CardQueryProperty, value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (property === "identity.manaValue" || property === "identity.edhrecRank") return typeof value === "number" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a number value.`
    }];
    if (property === "identity.gameChanger" || property === "collection.altered" || property === "collection.misprint") return typeof value === "boolean" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a boolean value.`
    }];
    if (property === "identity.colorIdentity" || property === "identity.colors") return typeof value === "string" && colorIdentitySet.has(value) ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: `${property} requires a valid Color Identity value.`,
        allowedValues: colorIdentityValues
    }];
    if (property === "legality.commander") return typeof value === "string" && formatLegalitySet.has(value) ? [] : [{
        pointer,
        code: "invalid_value",
        message: "legality.commander requires a valid legality value.",
        allowedValues: formatLegalityValues
    }];
    if (property === "collection.quantity") {
        if (typeof value !== "number" || !Number.isInteger(value)) return [{
            pointer,
            code: "invalid_type",
            message: "collection.quantity requires a positive integer value."
        }];
        if (value < 0 || (op === "=" && value === 0) || (op === ">=" && value === 0) || (op === "<" && value <= 1) || (op === "<=" && value <= 0)) return [{
            pointer,
            code: "invalid_collection_semantics",
            message: "collection.quantity supports positive quantity comparisons only."
        }];
        return [];
    }
    if (property === "collection.locationType") return value === "binder" || value === "deck" ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: "collection.locationType must be binder or deck.",
        allowedValues: ["binder", "deck"]
    }];
    if (property === "collection.finish") return value === "nonfoil" || value === "foil" || value === "etched" ? [] : [{
        pointer,
        code: "invalid_enum_value",
        message: "collection.finish must be nonfoil, foil, or etched.",
        allowedValues: ["nonfoil", "foil", "etched"]
    }];
    return typeof value === "string" ? [] : [{
        pointer,
        code: "invalid_type",
        message: `${property} requires a string value.`
    }];
}

function validateSortby(value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (!Array.isArray(value)) return [{pointer, code: "invalid_type", message: "sortby must be an array."}];
    const issues: CardQueryValidationIssue[] = [];
    if (value.length === 0) issues.push({pointer, code: "too_small", message: "sortby must not be empty."});
    const seen = new Set<string>();
    value.forEach((item, index) => {
        const itemPointer = `${pointer}/${index}`;
        if (!isRecord(item)) {
            issues.push({pointer: itemPointer, code: "invalid_type", message: "sortby entries must be objects."});
            return;
        }
        for (const key of Object.keys(item)) {
            if (key !== "property" && key !== "direction") issues.push(unknownFieldIssue(`${itemPointer}/${escapePointer(key)}`, key));
        }
        if (typeof item.property !== "string" || !sortablePropertyValues.has(item.property)) issues.push({
            pointer: `${itemPointer}/property`,
            code: "invalid_value",
            message: "Unsupported sort property.",
            allowedValues: cardQuerySortablePropertyValues
        });
        else if (seen.has(item.property)) issues.push({
            pointer: `${itemPointer}/property`,
            code: "duplicate_value",
            message: "sortby must not contain duplicate properties."
        });
        else seen.add(item.property);
        if (item.direction !== "asc" && item.direction !== "desc") issues.push({
            pointer: `${itemPointer}/direction`,
            code: "invalid_value",
            message: "Unsupported sort direction.",
            allowedValues: ["asc", "desc"]
        });
    });
    return issues;
}

function validateInclude(value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (!isRecord(value)) return [{pointer, code: "invalid_type", message: "include must be an object."}];
    const issues: CardQueryValidationIssue[] = [];
    for (const key of Object.keys(value)) {
        if (!["legalities", "tags", "collectionCards"].includes(key)) issues.push(unknownFieldIssue(`${pointer}/${escapePointer(key)}`, key));
    }
    if ("legalities" in value) {
        if (!Array.isArray(value.legalities)) issues.push({
            pointer: `${pointer}/legalities`,
            code: "invalid_type",
            message: "include.legalities must be an array."
        });
        else {
            if (value.legalities.length === 0) issues.push({
                pointer: `${pointer}/legalities`,
                code: "too_small",
                message: "include.legalities must not be empty."
            });
            const seen = new Set<string>();
            value.legalities.forEach((format, index) => {
                const itemPointer = `${pointer}/legalities/${index}`;
                if (format !== "commander") issues.push({
                    pointer: itemPointer,
                    code: "invalid_value",
                    message: "Unsupported legality include format.",
                    allowedValues: ["commander"]
                });
                else if (seen.has(format)) issues.push({
                    pointer: itemPointer,
                    code: "duplicate_value",
                    message: "include.legalities must not contain duplicate formats."
                });
                else seen.add(format);
            });
        }
    }
    if ("tags" in value && typeof value.tags !== "boolean") issues.push({
        pointer: `${pointer}/tags`,
        code: "invalid_type",
        message: "include.tags must be a boolean."
    });
    if ("collectionCards" in value && typeof value.collectionCards !== "boolean") issues.push({
        pointer: `${pointer}/collectionCards`,
        code: "invalid_type",
        message: "include.collectionCards must be a boolean."
    });
    return issues;
}

function validateLimit(value: unknown, pointer: string): CardQueryValidationIssue[] {
    if (typeof value !== "number" || !Number.isInteger(value)) return [{
        pointer,
        code: "invalid_type",
        message: "limit must be a positive integer."
    }];
    if (value < 1) return [{pointer, code: "too_small", message: "limit must be at least 1."}];
    if (value > 200) return [{pointer, code: "too_large", message: "limit must be at most 200."}];
    return [];
}

function containsRelationshipPredicate(value: unknown): boolean {
    if (!isRecord(value) || typeof value.op !== "string" || !Array.isArray(value.args)) return false;
    if (value.op === "and" || value.op === "or") return value.args.some(containsRelationshipPredicate);
    if (value.op === "not") return value.args.some(containsRelationshipPredicate);
    const propertyRef = value.args[0];
    return isRecord(propertyRef) && typeof propertyRef.property === "string" && (propertyRef.property.startsWith("collection.") || propertyRef.property.startsWith("tag."));
}

function unknownFieldIssue(pointer: string, key: string): CardQueryValidationIssue {
    return {pointer, code: "unknown_field", message: `Unknown field: ${key}.`};
}

function validationError(issues: readonly CardQueryValidationIssue[]): CardQueryError {
    return {type: "validation_error", code: "invalid_card_query", message: "Card Query input is invalid.", issues};
}

function escapePointer(value: string): string {
    return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
